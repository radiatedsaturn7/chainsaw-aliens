import { getPackedRaceWorkerEnvironmentTransferables } from './PackedRaceWorkerEnvironment.js';
import {
  createVehicleControlInputBuffer,
  createVehicleEnvironmentUpdateBuffer,
  createVehicleResetCommandBuffer
} from './VehicleDynamicsWorkerProtocol.js';
import { VehicleDynamicsWorkerClient } from './VehicleDynamicsWorkerClient.js';
import {
  eulerFromQuaternion,
  rotateVectorByQuaternion,
  rotateVectorToBody
} from './RigidBodyMath.js';
import { RACE_WHEEL_IDS } from './SimulationMath.js';
import {
  reconstructVehicleRenderState,
  VEHICLE_RENDER_WHEEL_FLAGS
} from './VehicleRenderState.js';

function copyVector(target = {}, source = {}, includeW = false) {
  target.x = Number(source?.x || 0);
  target.y = Number(source?.y || 0);
  target.z = Number(source?.z || 0);
  if (includeW) target.w = Number(source?.w ?? 1);
  return target;
}

function transformResetPoint(point = {}, previousPosition = {}, previousOrientation = {},
  nextPosition = {}, nextOrientation = {}) {
  const relativeWorld = {
    x: Number(point.x || 0) - Number(previousPosition.x || 0),
    y: Number(point.y || 0) - Number(previousPosition.y || 0),
    z: Number(point.z || 0) - Number(previousPosition.z || 0)
  };
  const local = rotateVectorToBody(relativeWorld, previousOrientation);
  const rotated = rotateVectorByQuaternion(local, nextOrientation);
  return {
    x: Number(nextPosition.x || 0) + rotated.x,
    y: Number(nextPosition.y || 0) + rotated.y,
    z: Number(nextPosition.z || 0) + rotated.z
  };
}

export function createRaceVehicleProvisionalResetRenderState(
  session, resetState = {}, resetGeneration = 0
) {
  if (!session) return null;
  const canonical = session.vehicleRenderState || session.vehicleDynamicsPresentationState;
  const vehicle = session.vehicle3d || {};
  const previousPosition = canonical?.position || vehicle.position;
  const previousOrientation = canonical?.orientation || vehicle.orientation;
  const nextPosition = resetState.position;
  const nextOrientation = resetState.orientation;
  if (!previousPosition || !previousOrientation || !nextPosition || !nextOrientation) return null;
  const wheels = {};
  for (const wheelId of RACE_WHEEL_IDS) {
    const prior = canonical?.wheels?.[wheelId] || {};
    const front = wheelId[0] === 'f';
    const left = wheelId[1] === 'l';
    const fallbackHub = { x: left ? -0.8 : 0.8, y: -0.2, z: front ? 1.3 : -1.3 };
    const contactPointWorld = prior.contactPointWorld
      ? transformResetPoint(
          prior.contactPointWorld, previousPosition, previousOrientation,
          nextPosition, nextOrientation
        ) : { ...nextPosition };
    const surfaceNormalWorld = prior.surfaceNormalWorld
      ? rotateVectorByQuaternion(
          rotateVectorToBody(prior.surfaceNormalWorld, previousOrientation), nextOrientation
        ) : { x: 0, y: 1, z: 0 };
    wheels[wheelId] = {
      ...prior,
      hubPositionBody: { ...(prior.hubPositionBody || fallbackHub) },
      suspensionMountBody: {
        ...(prior.suspensionMountBody || {
          x: fallbackHub.x, y: fallbackHub.y + 0.3, z: fallbackHub.z
        })
      },
      suspensionAxisBody: { ...(prior.suspensionAxisBody || { x: 0, y: -1, z: 0 }) },
      contactPointWorld,
      surfaceNormalWorld,
      normalLoadN: 0,
      flags: VEHICLE_RENDER_WHEEL_FLAGS.provisional,
      validTreadContact: false,
      geometricContact: false,
      loadBearing: false,
      normalLoadKnown: false,
      terrainDataAvailable: false,
      provisional: true,
      resetGeneration
    };
  }
  return reconstructVehicleRenderState({
    ...(canonical || {}),
    resetGeneration,
    position: { ...nextPosition },
    orientation: { ...nextOrientation },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    wheels,
    suspensionPose: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId, Number(wheels[wheelId].suspensionCompressionM || 0)
    ])),
    provisional: true
  });
}

export function applyRaceVehicleProvisionalResetPresentation(
  session, resetState = {}, resetGeneration = 0
) {
  const renderState = createRaceVehicleProvisionalResetRenderState(
    session, resetState, resetGeneration
  );
  if (!renderState) return false;
  applyRaceVehicleRenderSnapshot(session, renderState);
  session.vehicleDynamicsPresentationState.resetGeneration = resetGeneration;
  return renderState;
}

function syncWorkerPresentationState(session, snapshot, euler) {
  const state = session.vehicleDynamicsPresentationState || {};
  state.authoritativeSource = 'VehicleDynamicsWorkerSnapshot';
  state.resetGeneration = Number(snapshot.resetGeneration || 0);
  state.position = copyVector(state.position || {}, snapshot.position);
  state.orientation = copyVector(state.orientation || {}, snapshot.orientation, true);
  state.velocity = copyVector(state.velocity || {}, snapshot.velocity);
  state.angularVelocityWorld = copyVector(
    state.angularVelocityWorld || {}, snapshot.angularVelocity
  );
  state.yawRad = euler.yaw;
  state.pitchRad = euler.pitch;
  state.rollRad = euler.roll;
  state.speedMps = Number(snapshot.speedMps || 0);
  state.groundSpeedMps = Number(snapshot.groundSpeedMps ?? snapshot.speedMps ?? 0);
  state.bodyLongitudinalSpeedMps = Number(
    snapshot.bodyLongitudinalSpeedMps ?? snapshot.speedMps ?? 0
  );
  state.bodyLateralSpeedMps = Number(snapshot.bodyLateralSpeedMps || 0);
  state.signedTravelSpeedMps = Number(
    snapshot.signedTravelSpeedMps ?? snapshot.speedMps ?? 0
  );
  state.gear = Number(snapshot.gear || 0);
  state.engineRpm = Number(snapshot.engineRpm || 0);
  state.grounded = (Number(snapshot.visualState || 0) & 1) !== 0;
  state.suspensionTravel = { ...snapshot.suspensionPose };
  state.wheelAngularVelocityRadps = { ...snapshot.wheelAngularVelocity };
  state.wheelLoadsN ||= {};
  state.contactPatches ||= {};
  state.suspensionState ||= {};
  state.tireState ||= {};
  for (const [wheelId, wheel] of Object.entries(snapshot.wheelPoses || {})) {
    const lateral = rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, wheel.orientation);
    const patch = state.contactPatches[wheelId] || {};
    patch.hubPositionWorld = copyVector(patch.hubPositionWorld || {}, wheel.position);
    patch.wheelCenterWorld = copyVector(patch.wheelCenterWorld || {}, wheel.position);
    patch.contactPointWorld = copyVector(patch.contactPointWorld || {}, wheel.contactPoint);
    patch.surfaceNormalWorld = copyVector(patch.surfaceNormalWorld || {}, wheel.normal);
    patch.suspensionMountPositionWorld = copyVector(
      patch.suspensionMountPositionWorld || {}, wheel.suspensionMount
    );
    patch.suspensionAxisWorld = copyVector(
      patch.suspensionAxisWorld || {}, wheel.suspensionAxis
    );
    patch.wheelLateralWorld = copyVector(patch.wheelLateralWorld || {}, lateral);
    patch.normalLoadN = Number(wheel.normalLoadN || 0);
    patch.gripCoefficient = Number(wheel.gripCoefficient || 0);
    patch.steeringAngleRad = Number(wheel.steeringAngleRad || 0);
    patch.lateralForceN = Number(wheel.lateralForceN || 0);
    patch.selfAligningMomentNm = Number(wheel.selfAligningMomentNm || 0);
    patch.validTreadContact = wheel.validTreadContact === true;
    patch.geometricContact = wheel.geometricContact === true;
    patch.normalLoadKnown = wheel.normalLoadKnown !== false;
    patch.resetGeneration = Number(snapshot.resetGeneration || 0);
    patch.provisional = wheel.provisional === true;
    state.contactPatches[wheelId] = patch;
    state.wheelLoadsN[wheelId] = patch.normalLoadN;
    state.suspensionState[wheelId] = {
      ...(state.suspensionState[wheelId] || {}),
      hubPositionWorld: patch.hubPositionWorld,
      suspensionMountPositionWorld: patch.suspensionMountPositionWorld,
      suspensionAxisWorld: patch.suspensionAxisWorld,
      compressionRatio: Number(snapshot.suspensionPose?.[wheelId] || 0)
    };
    state.tireState[wheelId] = {
      ...(state.tireState[wheelId] || {}),
      temperatureF: Number(snapshot.tireTemperature?.[wheelId] ?? 70)
    };
  }
  state.powertrainState = {
    ...(state.powertrainState || {}),
    engineRpm: state.engineRpm,
    gear: state.gear
  };
  session.vehicleDynamicsPresentationState = state;
  session.vehicleRenderState = snapshot;
  session.vehicleResetGeneration = Number(snapshot.resetGeneration || 0);
  return state;
}

function clonePackedSampler(sampler = null) {
  if (!sampler?.packed) return null;
  const clone = { ...sampler, bucketLookup: null };
  for (const key of [
    'positions', 'normals', 'bounds', 'regions', 'sources', 'priorities',
    'bucketCoords', 'bucketOffsets', 'bucketTriangles'
  ]) {
    if (ArrayBuffer.isView(sampler[key])) clone[key] = sampler[key].slice();
  }
  clone.regionTable = [...(sampler.regionTable || [])];
  clone.sourceTable = [...(sampler.sourceTable || [])];
  return clone;
}

export function prepareRaceVehicleDynamicsWorkerSurface(sampler = null) {
  const prepared = clonePackedSampler(sampler);
  if (prepared) prepared.workerTransferOwned = true;
  return prepared;
}

export function createRaceVehicleDynamicsWorkerInitialization({
  runner,
  surfaceSampler,
  staticColliderDefinitions = [],
  materialByRegion = {},
  environmentState = {},
  trackState = null,
  weatherForcing = {},
  tireCompoundByWheel = {},
  activeAiVehicles = []
} = {}) {
  if (!runner?.config || !runner?.state) {
    throw new TypeError('Worker initialization requires the qualified authoritative runner');
  }
  const workerSampler = surfaceSampler?.workerTransferOwned === true
    ? surfaceSampler
    : clonePackedSampler(surfaceSampler);
  if (!workerSampler) throw new TypeError('Worker initialization requires a packed race surface');
  const physicsWorld = {
    surfaceSampler: workerSampler,
    staticColliderDefinitions,
    materialByRegion,
    environmentState
  };
  const vehicles = [{
    id: 'player',
    player: true,
    active: true,
    config: { ...runner.config, telemetryRetention: 'none' },
    initialState: runner.createStateSnapshot(),
    renderWheelSpinAngles: { ...runner.renderWheelSpinAngles },
    inputTimeline: runner.inputTimeline?.createSnapshot?.() || [],
    physicsWorld
  }, ...activeAiVehicles.filter(({ runner: aiRunner }) => aiRunner?.config).map((entry, index) => ({
    id: entry.id || `ai-${index}`,
    player: false,
    active: entry.active !== false,
    config: { ...entry.runner.config, telemetryRetention: 'none' },
    initialState: entry.runner.createStateSnapshot(),
    renderWheelSpinAngles: { ...entry.runner.renderWheelSpinAngles },
    inputTimeline: entry.runner.inputTimeline?.createSnapshot?.() || [],
    physicsWorld: {
      ...physicsWorld,
      environmentState: entry.environmentState || physicsWorld.environmentState
    }
  }))];
  return {
    payload: {
      vehicles,
      trackState: trackState ? {
        snapshot: trackState.createSnapshot(),
        weatherForcing,
        tireCompoundByWheel,
        contactStepSeconds: 1 / runner.config.chassisHz
      } : null
    },
    transferables: getPackedRaceWorkerEnvironmentTransferables(physicsWorld)
  };
}

export function applyRaceVehicleRenderSnapshot(session, snapshot) {
  if (!session || !snapshot) return;
  const euler = eulerFromQuaternion(snapshot.orientation);
  const state = syncWorkerPresentationState(session, snapshot, euler);
  session.worldX = snapshot.position.x;
  session.worldY = snapshot.position.y;
  session.worldZ = snapshot.position.z;
  session.bodyX = snapshot.position.x;
  session.bodyY = snapshot.position.y;
  session.bodyZ = snapshot.position.z;
  session.velocityX = Number(snapshot.velocity?.x || 0);
  session.velocityY = Number(snapshot.velocity?.y || 0);
  session.velocityZ = Number(snapshot.velocity?.z || 0);
  session.speedMps = snapshot.speedMps;
  session.groundSpeedMps = Number(snapshot.groundSpeedMps ?? snapshot.speedMps);
  session.bodyLongitudinalSpeedMps = state.bodyLongitudinalSpeedMps;
  session.bodyLateralSpeedMps = state.bodyLateralSpeedMps;
  session.signedTravelSpeedMps = state.signedTravelSpeedMps;
  session.velocityYaw = Math.atan2(session.velocityX, session.velocityZ);
  session.verticalVelocityMps = session.velocityY;
  session.engineRpm = snapshot.engineRpm;
  session.gear = Number(snapshot.gear || 0);
  session.carYaw = euler.yaw;
  session.pitchRad = euler.pitch;
  session.rollRad = euler.roll;
  session.pitchRate = Number(snapshot.angularVelocity?.x || 0);
  session.yawVelocityRadps = Number(snapshot.angularVelocity?.y || 0);
  session.rollRate = Number(snapshot.angularVelocity?.z || 0);
  session.grounded = state.grounded;
  session.airborne = !state.grounded;
  session.authoritativeHandbrakeActive = (Number(snapshot.visualState || 0) & 8) !== 0;
  session.vehicle3d ||= {};
  session.vehicle3d.enabled = true;
  session.vehicle3d.authoritativeSource = 'VehicleDynamicsWorker';
  session.vehicle3d.resetGeneration = Number(snapshot.resetGeneration || 0);
  session.vehicle3d.position = state.position;
  session.vehicle3d.linearVelocity = state.velocity;
  session.vehicle3d.orientation = state.orientation;
  session.vehicle3d.angularVelocity = state.angularVelocityWorld;
  session.vehicle3d.yaw = euler.yaw;
  session.vehicle3d.pitch = euler.pitch;
  session.vehicle3d.roll = euler.roll;
  session.vehicle3d.wheels = snapshot.wheelPoses;
  session.suspensionTravel = snapshot.suspensionPose;
  session.wheelAngularVelocityRadps = snapshot.wheelAngularVelocity;
  session.wheelContacts = state.contactPatches;
  session.vehicleDynamicsEventSequence = snapshot.eventSequence;
  session.vehicleDynamicsVisualState = snapshot.visualState;
}

export function applyWorkerTrackStateVisualDelta(session, delta = null) {
  if (!session || !delta?.cells) return 0;
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  session.workerTrackStateVisual ||= {
    cells: new Map(), stepIndex: 0, cellRevision: 0, eventSequence: 0
  };
  const visual = session.workerTrackStateVisual;
  let applied = 0;
  for (const cell of delta.cells) {
    const previous = visual.cells.get(cell.key);
    if (previous && Number(previous.revision || 0) > Number(cell.revision || 0)) continue;
    visual.cells.set(cell.key, { ...cell });
    applied += 1;
  }
  visual.stepIndex = Math.max(visual.stepIndex, Number(delta.stepIndex || 0));
  visual.cellRevision = Math.max(visual.cellRevision, Number(delta.cellRevision || 0));
  visual.visualRevision = Math.max(
    Number(visual.visualRevision || 0), Number(delta.visualRevision ?? delta.cellRevision ?? 0)
  );
  visual.dirtyAtlasTiles = (delta.dirtyAtlasTiles || []).map((tile) => ({ ...tile }));
  visual.eventSequence = Math.max(visual.eventSequence, Number(delta.eventSequence || 0));
  visual.remainingDirtyCellCount = Number(delta.remainingDirtyCellCount || 0);
  session.trackStateVisualCache = null;
  session.trackStateVisualAtlas = null;
  const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
  const timers = session.physicsSurfaceDebugTimers
    || (session.physicsSurfaceDebugTimers = Object.create(null));
  const samples = timers.trackStateVisualSynchronization
    || (timers.trackStateVisualSynchronization = []);
  samples.push(Math.max(0, elapsedMs));
  if (samples.length > 120) samples.splice(0, samples.length - 120);
  return applied;
}

export function resetWorkerTrackStateVisualPresentation(session, {
  clearCells = true, eventSequence = null
} = {}) {
  if (!session) return;
  const previous = session.workerTrackStateVisual;
  session.workerTrackStateVisual = {
    cells: clearCells ? new Map() : new Map(previous?.cells || []),
    stepIndex: 0,
    cellRevision: 0,
    visualRevision: 0,
    eventSequence: Number(eventSequence ?? session.vehicleDynamicsEventSequence ?? 0),
    dirtyAtlasTiles: [],
    remainingDirtyCellCount: 0
  };
  session.trackStateVisualCache = null;
  session.trackStateVisualAtlas = null;
}

export class RaceVehicleDynamicsWorkerBridge {
  constructor({ worker, qualification, now = () => performance.now() } = {}) {
    this.now = now;
    this.client = new VehicleDynamicsWorkerClient({
      worker,
      performanceQualification: qualification,
      now
    });
    this.inputSequence = 0;
    this.inputSequenceByVehicle = new Map();
    this.activeByVehicle = new Map();
    this.resetSequence = 0;
    this.backlogWarningFrames = 0;
    this.presentationTimeSeconds = null;
    this.lastPresentationWallTimeMs = null;
  }

  initialize(options) {
    const initialization = createRaceVehicleDynamicsWorkerInitialization(options);
    this.client.initialize(initialization.payload, initialization.transferables);
  }

  update({ controls, session, environmentUpdate = null }) {
    const renderStartMs = this.now();
    this.inputSequence += 1;
    if (environmentUpdate) {
      this.client.submitEnvironmentUpdate(
        createVehicleEnvironmentUpdateBuffer(environmentUpdate)
      );
    }
    this.client.submitInput(
      createVehicleControlInputBuffer({
        ...controls,
        gear: controls.gear ?? controls.requestedGear,
        absEnabled: controls.absEnabled ?? controls.assists?.absEnabled,
        tractionControlEnabled: controls.tractionControlEnabled
          ?? controls.assists?.tractionControlEnabled,
        autoShift: controls.autoShift ?? controls.assists?.autoShift
      }),
      this.inputSequence,
      this.now()
    );
    const latest = this.client.latestSnapshot;
    const trackStateVisualDelta = this.client.latestTrackStateVisualDelta;
    if (trackStateVisualDelta) {
      applyWorkerTrackStateVisualDelta(session, trackStateVisualDelta);
      this.client.latestTrackStateVisualDelta = null;
    }
    if (!latest) {
      if (session.vehicleRenderState) applyRaceVehicleRenderSnapshot(
        session, session.vehicleRenderState
      );
      return session.vehicleRenderState || null;
    }
    const history = this.client.snapshotsByVehicle.get('player');
    const intervalSeconds = Math.max(
      1 / 120, Number(history?.snapshotIntervalSeconds || 0)
    );
    const interpolationDelaySeconds = intervalSeconds * 2;
    const delivery = this.client.getPresentationTelemetry();
    const desiredRenderTimeSeconds = latest.simulationTimeSeconds
      + Math.max(0, Number(delivery.snapshotAgeMs || 0)) / 1000
      - interpolationDelaySeconds;
    const elapsedPresentationSeconds = this.lastPresentationWallTimeMs === null
      ? intervalSeconds
      : Math.max(0, (renderStartMs - this.lastPresentationWallTimeMs) / 1000);
    const maximumAdvanceSeconds = Math.max(
      intervalSeconds,
      Math.min(0.033, elapsedPresentationSeconds * 1.5)
    );
    this.presentationTimeSeconds = this.presentationTimeSeconds === null
      ? desiredRenderTimeSeconds
      : Math.min(
          desiredRenderTimeSeconds,
          this.presentationTimeSeconds + maximumAdvanceSeconds
        );
    this.lastPresentationWallTimeMs = renderStartMs;
    const renderTimeSeconds = this.presentationTimeSeconds;
    const snapshot = this.client.getInterpolatedSnapshot(renderTimeSeconds);
    applyRaceVehicleRenderSnapshot(session, snapshot);
    session.vehicleDynamicsWorkerError = this.client.lastError;
    session.vehicleDynamicsResetDiagnostics = this.client.latestResetAcknowledgementByVehicle
      .get('player') || session.vehicleDynamicsResetDiagnostics || null;
    this.client.metrics.recordRender(this.now() - renderStartMs);
    session.vehicleDynamicsWorkerMetrics = this.client.getMetrics({ force: false });
    const quaternionDot = Math.abs(
      Number(snapshot.orientation?.x || 0) * Number(latest.orientation?.x || 0)
      + Number(snapshot.orientation?.y || 0) * Number(latest.orientation?.y || 0)
      + Number(snapshot.orientation?.z || 0) * Number(latest.orientation?.z || 0)
      + Number(snapshot.orientation?.w ?? 1) * Number(latest.orientation?.w ?? 1)
    );
    const wheelLocalOffsetErrorByWheel = {};
    for (const wheelId of Object.keys(snapshot.wheels || {})) {
      const rendered = snapshot.wheels[wheelId]?.hubPositionBody || {};
      const authoritative = latest.wheels?.[wheelId]?.hubPositionBody || {};
      wheelLocalOffsetErrorByWheel[wheelId] = Math.hypot(
        Number(rendered.x || 0) - Number(authoritative.x || 0),
        Number(rendered.y || 0) - Number(authoritative.y || 0),
        Number(rendered.z || 0) - Number(authoritative.z || 0)
      );
    }
    session.vehicleDynamicsPresentationTelemetry = {
      authorityThread: 'worker',
      workerMigrationTimeMs: Number(session.vehicleDynamicsWorkerMigrationTimeMs || 0),
      ...delivery,
      interpolationDelayMs: interpolationDelaySeconds * 1000,
      interpolationAlpha: Number(snapshot.interpolationAlpha ?? 1),
      extrapolationDurationMs: Number(snapshot.extrapolationDurationSeconds || 0) * 1000,
      bodyVisualAuthoritativeAngleErrorDeg: 2 * Math.acos(Math.min(1, quaternionDot)) * 180 / Math.PI,
      wheelLocalOffsetErrorByWheel
    };
    const backlogSteps = Number(
      session.vehicleDynamicsWorkerMetrics?.backlog?.current || 0
    );
    this.backlogWarningFrames = backlogSteps > 8 ? this.backlogWarningFrames + 1 : 0;
    session.vehicleDynamicsWorkerBacklogWarning = this.backlogWarningFrames >= 60
      ? { backlogSteps, sustainedFrames: this.backlogWarningFrames }
      : null;
    return snapshot;
  }

  updateAiVehicle({ vehicleId, controls, ai, active = true }) {
    const renderStartMs = this.now();
    const id = String(vehicleId);
    const isActive = active !== false;
    if (this.activeByVehicle.get(id) !== isActive) {
      this.activeByVehicle.set(id, isActive);
      this.client.setVehicleActive(id, isActive);
    }
    if (!isActive) {
      this.client.metrics.recordRender(this.now() - renderStartMs);
      return null;
    }
    const sequence = (this.inputSequenceByVehicle.get(id) || 0) + 1;
    this.inputSequenceByVehicle.set(id, sequence);
    this.client.submitInput(
      createVehicleControlInputBuffer({
        ...controls,
        gear: controls.gear ?? controls.requestedGear,
        absEnabled: controls.absEnabled ?? controls.assists?.absEnabled,
        tractionControlEnabled: controls.tractionControlEnabled
          ?? controls.assists?.tractionControlEnabled,
        autoShift: controls.autoShift ?? controls.assists?.autoShift
      }),
      sequence,
      this.now(),
      id
    );
    const latest = this.client.snapshotsByVehicle.get(id)?.latest;
    if (!latest) {
      this.client.metrics.recordRender(this.now() - renderStartMs);
      return null;
    }
    const renderTimeSeconds = latest.simulationTimeSeconds - 1 / 120;
    const snapshot = this.client.getInterpolatedSnapshot(renderTimeSeconds, id);
    ai.worldX = snapshot.position.x;
    ai.worldY = snapshot.position.y;
    ai.worldZ = snapshot.position.z;
    ai.speedMps = snapshot.speedMps;
    ai.rpm = snapshot.engineRpm;
    ai.carYaw = Math.atan2(
      2 * (snapshot.orientation.w * snapshot.orientation.y
        + snapshot.orientation.x * snapshot.orientation.z),
      1 - 2 * (snapshot.orientation.y ** 2 + snapshot.orientation.z ** 2)
    );
    ai.vehicleDynamicsSnapshot = snapshot;
    this.client.metrics.recordRender(this.now() - renderStartMs);
    return snapshot;
  }

  resetVehicle(state, vehicleId = 'player', session = null) {
    this.resetSequence = Math.max(
      this.resetSequence,
      Number(session?.vehicleRenderState?.resetGeneration || 0),
      Number(session?.vehicleResetGeneration || 0)
    ) + 1;
    let provisionalSnapshot = null;
    if (vehicleId === 'player' && session) {
      provisionalSnapshot = applyRaceVehicleProvisionalResetPresentation(
        session, state, this.resetSequence
      );
      session.trackStateVisualCache = null;
      session.trackStateVisualAtlas = null;
    }
    this.client.submitReset(
      createVehicleResetCommandBuffer(state),
      this.resetSequence,
      vehicleId,
      provisionalSnapshot
    );
    return this.resetSequence;
  }

  close() {
    this.client.close();
  }
}
