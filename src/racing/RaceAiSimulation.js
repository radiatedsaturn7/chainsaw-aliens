import {getRaceAiRoadPlan} from './RaceAiDirector.js';
import {raceAiRoadPlanIndex} from './RaceAiRoadPlan.js';
import {recordRaceRecoveryPosition, getRaceRecoveryHistoryCandidates} from './RaceRecoveryHistory.js';
import {shouldRetryRaceAiCheap,tryRecoverRaceAiCheap} from './RaceAiCheapRecovery.js';
import {assignRaceAiPhysicsBudget} from './RaceAiPhysicsBudget.js';
import {sampleRaceAiWheelContacts} from './RaceAiRoadContacts.js';
import { observeRaceAiRecovery } from './RaceAiRecoveryWatchdog.js';
import { prepareRaceAiDirector, getRaceAiDirector } from './RaceAiDirector.js';
import {useRaceAiRemotePowertrain, stepRaceAiRemotePowertrain} from './RaceAiRemotePowertrain.js';
import {createRaceAiSurfaceProbe} from './RaceAiSurfaceProbe.js';
import { planRaceAiControls, syncRaceAiPhysicalTireEffects } from './RaceAiControls.js';
import { advanceRaceAiDistantPhysics, holdRaceAiCheapPhysics, restoreRaceAiDetailedPhysics, getReusableRaceAiDistantContacts, canUseRaceAiDistantPhysics } from './RaceAiDistantPhysics.js';
import { shouldRefreshRaceAiSurfacePlan, consumeRaceAiSimulationStep, getRaceAiSurfaceObservationCache } from './RaceAiScheduling.js';
import { createRaceWheelContactStateFromSamples } from './RaceVehicleSurfaceContact.js';
import { classifyRaceAiTerrainCollision } from './RaceAiTerrainCollision.js';
import { createPhysicsTerrainQueryFrameCache } from './simulation/PhysicsTerrainQueryFrame.js';
import { planRaceAiDriving, getRaceAiRoadSafety, preferRaceAiRacingLine } from './RaceAiDriving.js';
import { RACE_AI_PHYSICS_HZ, RACE_PEDAL_INPUT, RACE_THREE_ELEVATION_M } from './simulation/RaceSimulationConfig.js';
import { RACE_WHEEL_IDS, clamp } from './simulation/SimulationMath.js';
import { getSurfaceById } from './raceData.js';
import {
  VehicleDynamicsRunner,
  createVehicleDynamicsConfigFromTuning
} from './simulation/VehicleDynamicsRunner.js';
import { syncVehicleDynamicsCompatibilityOutputs } from './simulation/VehicleState.js';
import { calculateWheelContactKinematics, createWheelContactKinematicsScratch } from './simulation/ContactPatchTireModel.js';
import { createDeterministicAtmosphere, getRaceWakeSourcesForFrame } from './simulation/AeroEnvironment.js';
import { quaternionFromEuler, rotateVectorByQuaternion } from './simulation/RigidBodyMath.js';
import { applyRaceVehicleRenderSnapshot } from './simulation/RaceVehicleDynamicsWorkerBridge.js';

// Runtime cars are independent, fixed race-start snapshots. Cache only those;
// authoring cars without a snapshot still resolve their current tuning each call.
const runtimeTuningCache = new WeakMap();
const compatibilitySessions = new WeakMap();
// Owned by one AI. These positions are consumed synchronously by its provider,
// never shared with another car or retained as authoritative vehicle state.
export function prepareRaceAiWheelKinematics(ai, state, controls, config) {
  const scratch = ai.wheelKinematicsScratch ||= {
    wheels: Object.fromEntries(RACE_WHEEL_IDS.map(id => [id, createWheelContactKinematicsScratch()])),
    patches: {}, positions: {}, request: { environment: {} }
  };
  const request = scratch.request;
  request.state = state; request.controls = controls; request.config = config;
  for (const id of RACE_WHEEL_IDS) {
    request.wheelId = id;
    request.target = scratch.wheels[id].target;
    request.computationScratch = scratch.wheels[id].computation;
    const patch = calculateWheelContactKinematics(request);
    scratch.patches[id] = patch;
    scratch.positions[id] = patch.contactPointWorld;
  }
  return scratch;
}
export function getRaceAiRuntimeTuning(editor, ai, car) {
  const transmissionType = ai.shiftMode === 'manual' ? 'manual' : 'automatic';
  if (car !== ai.runtimeCar) return editor.getRaceCarTuning(car, { transmissionType });
  let cached = runtimeTuningCache.get(car);
  if (!cached) { cached = {}; runtimeTuningCache.set(car, cached); }
  return cached[transmissionType] ||= editor.getRaceCarTuning(car, { transmissionType });
}

// Share the player's prepared terrain query path: collision sweeps can reject
// smooth road patches without issuing hundreds of complete world queries.
export function prepareRaceAiTerrainFrame(editor, ai, runner, state, previousState, chassisStepDt = 1 / 120) {
  const bake = editor.playtestSession?.worldBake || editor.raceWorldBakeCache;
  if (!bake?.surfaceSampler) return null;
  ai.terrainQueryFrameCache ||= createPhysicsTerrainQueryFrameCache({resultCapacity:128});
  const config = runner.config, profile = config.bodyProfile || {};
  const reach = Math.hypot(Number(profile.overallWidthM || config.bodyWidthM || 1.8) / 2,
    Number(profile.overallLengthM || config.bodyLengthM || 4.5) / 2,
    Number(profile.overallHeightM || config.bodyHeightM || 1.45))
    + Math.max(0.5, Number(config.wheelRadiusM || 0.34));
  const x = Number(state.position?.x || 0), z = Number(state.position?.z || 0);
  const predictedX = x + Number(state.velocity?.x || 0) * chassisStepDt;
  const predictedZ = z + Number(state.velocity?.z || 0) * chassisStepDt;
  const previousX = Number(previousState?.position?.x ?? x), previousZ = Number(previousState?.position?.z ?? z);
  return ai.terrainQueryFrameCache.begin({
    sampler:bake.surfaceSampler, revision:bake.surfaceRevision ?? bake.revision ?? bake.key ?? 0,
    elevationScaleM:RACE_THREE_ELEVATION_M,
    physicsCostAccounting: runner.physicsCostAccounting,
    bounds:{minX:Math.min(x,previousX,predictedX)-reach,maxX:Math.max(x,previousX,predictedX)+reach,
      minZ:Math.min(z,previousZ,predictedZ)-reach,maxZ:Math.max(z,previousZ,predictedZ)+reach}
  });
}

// Footprint probes need geometry only. Reuse the authoritative terrain query
// frame instead of recomputing road materials and weather for every probe.
export function sampleRaceAiFootprintGeometry(frame, positions) {
  const heights = {}, contacts = {};
  for (const wheelId of RACE_WHEEL_IDS) {
    const sample = frame.samplePoint(positions[wheelId]);
    heights[wheelId] = sample?.valid === true ? sample.heightM : null;
    contacts[wheelId] = {normal: sample?.valid === true ? sample.normal : null};
  }
  return {heights, contacts};
}

export function getRaceAiAeroAwareness(wakeState = {}, { severity = 0, speedMps = 0, index = 0 } = {}) {
  const wakeIntensity = clamp(Number(wakeState.intensity || 0), 0, 1);
  return {
    draftOpportunity: clamp(Number(wakeState.dragReduction || 0) * (1 - clamp(severity * 2, 0, 1)), 0, 0.35),
    dirtyAirCornerPenalty: clamp(Number(wakeState.frontDownforceLoss || 0)
      * clamp(severity * 2.8, 0, 1), 0, 0.55),
    dirtyAirBrakingPenalty: clamp(Number(wakeState.frontDownforceLoss || 0)
      * clamp(Math.abs(Number(speedMps || 0)) / 45, 0, 1), 0, 0.42),
    crosswindRisk: clamp(Number(wakeState.crosswindRisk || 0), 0, 1),
    overtakeOffset: wakeIntensity > 0.42 ? (index % 2 === 0 ? 0.18 : -0.18) : 0,
    wakeIntensity
  };
}

export function getRaceAiDifficultyProfile(editor, difficulty = 'easy') {
  return {
    easy: { pace: 0.64, corner: 0.56, brake: 0.58, shift: 0.72, variance: 0.18 },
    medium: { pace: 0.78, corner: 0.72, brake: 0.74, shift: 0.84, variance: 0.11 },
    hard: { pace: 0.9, corner: 0.86, brake: 0.88, shift: 0.94, variance: 0.055 },
    expert: { pace: 1.02, corner: 1, brake: 1, shift: 1, variance: 0.018 }
  }[difficulty] || { pace: 0.72, corner: 0.68, brake: 0.7, shift: 0.8, variance: 0.12 };
}

export function getRaceAiLookaheadSeverity(editor, distance = 0, speedMps = 0) {
  const lookahead = Math.max(40, Math.abs(Number(speedMps || 0)) * 2.2);
  const plan=getRaceAiRoadPlan(editor);
  if(plan?.racingLine){
    let severity=0;
    for(const fraction of [.25,.55,.9]){const i=raceAiRoadPlanIndex(plan,distance+lookahead*fraction);severity=Math.max(severity,plan.curvature[i]*25,Math.abs(plan.grade[i])*2);}
    return clamp(severity,0,1);
  }
  const samples = [0.25, 0.55, 0.9].map((weight) => editor.getRaceSegmentAtDistance(distance + lookahead * weight, { wrap: true }).segment || {});
  return samples.reduce((max, segment) => Math.max(
    max,
    Math.abs(Number(segment.curve || 0)) * 0.86
      + Math.abs(Number(segment.elevation || 0)) * 0.22
      + Number(segment.bumpiness || 0) * 0.28
  ), 0);
}

export function getRaceAiContactState(editor, ai = {}, car = editor.selectedCar, tuning = editor.getRaceCarTuning(car)) {
  const distance = Number(ai.projectedDistance ?? ai.distance ?? 0) || 0;
  const runtimeType = editor.playtestSession?.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const pose = editor.getRaceWorldPoseAtDistance(distance, { runtimeType });
  const sectionOptions = {
    routeLength: editor.playtestSession?.routeLength || editor.getRaceRouteLength(),
    runtimeType
  };
  const metrics = editor.getRaceSurfaceMetricsAtDistance
    ? editor.getRaceSurfaceMetricsAtDistance(distance, sectionOptions)
    : editor.getRaceSurfaceSectionAtDistance(distance, sectionOptions).metrics;
  const roadHalfWidth = Math.max(1, Number(metrics?.roadEnd || editor.getRaceRoadHalfWidthWorld(pose.segment)));
  const lateral = clamp(Number(ai.lineOffset || 0), -0.85, 0.85) * roadHalfWidth;
  const right = editor.getRaceRightVector(pose.yaw);
  const runnerState = ai.vehicleDynamicsRunner?.dormant !== true
    ? ai.vehicleDynamicsRunner?.state
    : ai.vehicleRenderState || ai.vehicleDynamicsPresentationState;
  const aiSession = {
    worldX: Number(runnerState?.position?.x ?? ai.worldX ?? (Number(pose.x || 0) + right.x * lateral)),
    worldZ: Number(runnerState?.position?.z ?? ai.worldZ ?? (Number(pose.z ?? pose.y ?? 0) + right.z * lateral)),
    carYaw: Number(runnerState?.yawRad ?? ai.carYaw ?? pose.yaw ?? 0),
    speedMps: Number(ai.speedMps || 0),
    heightM: Number(runnerState?.position?.y ?? ai.bodyY
      ?? (Number(pose.elevation || 0) * RACE_THREE_ELEVATION_M + Number(ai.vehicleDynamicsRunner?.config?.cgHeightM || .55)))
      - Number(ai.vehicleDynamicsRunner?.config?.cgHeightM || .55),
    routeRuntimeType: runtimeType,
    trackState: Number(editor.playtestSession?.countdownRemainingMs || 0) > 0
      ? null
      : editor.playtestSession?.trackState || null
  };
  const previousContacts = getReusableRaceAiDistantContacts(editor, ai);
  const contacts = previousContacts ? createRaceWheelContactStateFromSamples({
    positions:previousContacts.positions, surfaceSamples:previousContacts.surfaceSamples,
    tuning, trackState:aiSession.trackState, elevationScaleM:RACE_THREE_ELEVATION_M
  }) : sampleRaceAiWheelContacts(editor,ai,{ car, tuning, session: aiSession });
  const surfaceGrip = RACE_WHEEL_IDS.reduce((sum, wheelId) => {
    const contact = contacts.contacts?.[wheelId] || {};
    return sum + clamp(Number(contact.friction || 1), 0.18, 1.2);
  }, 0) / RACE_WHEEL_IDS.length;
  return {
    pose,
    lateral,
    session: aiSession,
    contacts,
    averageSurfaceGrip: clamp(surfaceGrip, 0.18, 1.2)
  };
}

// Require sustained inversion, not a transient bank or a single tumbling frame.
// Read the authoritative snapshot in worker mode; its local runner is dormant.
export function recoverUpsideDownRaceAi(editor, ai, { car, tuning, seconds = 0, contactState = null } = {}) {
  const runner = ai.vehicleDynamicsRunner;
  const bridge = editor.vehicleDynamicsAuthority?.workerBridge;
  const state = bridge ? ai.vehicleRenderState : runner?.state;
  const dt = Math.max(0, Number(seconds) || 0);
  if (!runner || !state?.orientation || dt === 0) return false;
  if (ai.upsideDownResetPending) {
    ai.upsideDownResetPending.seconds += dt;
    const rejection = bridge?.client?.lastError;
    if (rejection && rejection !== ai.lastRecoveryWorkerError
        && rejection.requestType === 'resetVehicle' && rejection.vehicleId === ai.workerVehicleId) {
      ai.lastRecoveryWorkerError = rejection;
      ai.lastUpsideDownResetError = rejection.message;
    }
    if (Number(state.resetGeneration || 0) >= ai.upsideDownResetPending.generation) {
      ai.upsideDownResetPending = null;
      ai.upsideDownRecoveryAttempt = 0;
    } else if (ai.upsideDownResetPending.seconds < 3) {
      return false;
    } else {
      // A rejected worker reset must be retryable, without sending one per frame.
      ai.upsideDownResetPending = null;
      ai.upsideDownRecoveryAttempt = Number(ai.upsideDownRecoveryAttempt || 0) + 1;
    }
  }
  const up = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, state.orientation);
  ai.routeRuntimeType = editor.playtestSession?.routeRuntimeType;
  recordRaceRecoveryPosition(editor, ai, state, up.y, dt);
  ai.upsideDownRecoverySeconds = up.y < -0.25
    ? Number(ai.upsideDownRecoverySeconds || 0) + dt : 0;
  const roadPose=contactState?.pose;
  const roadHeightM=Number.isFinite(roadPose?.elevation)?roadPose.elevation*RACE_THREE_ELEVATION_M:null;
  const onRoadCorridor=roadPose && Math.hypot(state.position?.x-Number(roadPose.x),
    state.position?.z-Number(roadPose.z??roadPose.y))<Math.max(3,editor.getRaceRoadHalfWidthWorld(roadPose.segment));
  const director=getRaceAiDirector(editor);
  const watchedReason=observeRaceAiRecovery(ai,editor.playtestSession,state,dt,{roadHeightM,onRoadCorridor,
    canAttempt:!director||director.recoveryAttemptsThisUpdate===undefined||director.recoveryAttemptsThisUpdate<1});
  const recoveryReason=ai.recoveryRetryReason || (ai.upsideDownRecoverySeconds>=1.5?'ai-upside-down':watchedReason);
  ai.recoveryRetryReason = null;
  if(!recoveryReason)return false;
  // All recovery causes share the director budget, including inverted cars.
  // Retain the request so a deferred car does not have to repeat its dwell.
  if (director?.recoveryAttemptsThisUpdate !== undefined) {
    if (director.recoveryAttemptsThisUpdate >= 1) {
      ai.recoveryRetryReason = recoveryReason;
      return false;
    }
    director.recoveryAttemptsThisUpdate++;
  }
  ai.upsideDownRecoverySeconds = 0;
  if (bridge && !ai.workerVehicleId) return false;
  const recoveryOffsets = [0, 8, 16, 24, 40, 64];
  const attempt = Math.max(0, Math.trunc(Number(ai.upsideDownRecoveryAttempt || 0)));
  const history = getRaceRecoveryHistoryCandidates(ai);
  const safe = history[attempt];
  const routeAttempt = Math.max(0, attempt - history.length);
  const distance = safe?.distance ?? Math.max(0, Number(ai.projectedDistance ?? ai.distance ?? 0)
    - (recoveryOffsets[routeAttempt % recoveryOffsets.length]
      + Math.floor(routeAttempt / recoveryOffsets.length) * 80));
  const runtimeType = editor.playtestSession?.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const pose = safe || editor.getRaceWorldPoseAtDistance(distance, { runtimeType });
  const occupied = [editor.playtestSession, ...(editor.playtestSession?.aiRuntime || [])].some(other =>
    other && other !== ai && Number.isFinite(other.worldX) && Number.isFinite(other.worldZ)
    && Math.hypot(Number(pose.x || 0)-other.worldX, Number(pose.z ?? pose.y ?? 0)-other.worldZ) < 8);
  if (occupied) {
    ai.upsideDownRecoveryAttempt = attempt + 1;
    ai.lastUpsideDownResetError = 'Recovery location occupied';
    ai.recoveryWait = { seconds: 4, reason: recoveryReason };
    return false;
  }
  const yaw = Number(pose.yaw || 0);
  const contacts = editor.getRaceWheelContactState({ car, tuning, session: {
    worldX: Number(pose.x || 0), worldZ: Number(pose.z ?? pose.y ?? 0),
    carYaw: yaw, routeRuntimeType: runtimeType, speedMps: 0,
    heightM:Number(pose.elevation || 0)*RACE_THREE_ELEVATION_M
  } });
  let orientation = quaternionFromEuler({ yaw,
    pitch: -Number(contacts.terrainPitchRad || 0), roll: Number(contacts.terrainRollRad || 0) });
  if (rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, orientation).y <= 0.1) {
    orientation = quaternionFromEuler({ yaw, pitch: 0, roll: 0 });
  }
  const resetState = {
    position: { x: Number(pose.x || 0), z: Number(pose.z ?? pose.y ?? 0),
      y: Number(contacts.averageHeightM ?? Number(pose.elevation || 0) * RACE_THREE_ELEVATION_M) + runner.config.cgHeightM },
    orientation, routeDistance: distance, velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 }, speedMps: 0, grounded: true,
    engineRpm: runner.config.idleRpm, gear: 1, parkUntilDrive: true,
    ...(safe?.verifiedRoadPose || {})
  };
  try {
    if (bridge) {
      const generation = bridge.resetVehicle(resetState, ai.workerVehicleId, ai, recoveryReason);
      ai.upsideDownResetPending = { generation, seconds: 0 };
    } else {
      const reset = runner.resetAuthoritativeState(resetState, { reason: recoveryReason, parkUntilDrive: true,
        verifiedRoadPose: Boolean(safe?.verifiedRoadPose), maximumRouteRecoveryCandidates: 1 });
      syncVehicleDynamicsCompatibilityOutputs(runner, ai);
      ai.vehicleRenderState = reset.renderState;
      ai.vehicleResetGeneration = reset.resetGeneration;
      ai.vehicle3d.wheels = reset.renderState.wheelPoses;
      ai.vehicle3d.resetGeneration = reset.resetGeneration;
    }
  } catch (error) {
    ai.lastUpsideDownResetError = String(error?.message || error);
    ai.recoveryWait = { seconds: 4, reason: recoveryReason };
    ai.upsideDownRecoveryAttempt = attempt + 1;
    return false;
  }
  ai.lastUpsideDownResetError = null;
  ai.recoveryWait = null;
  if (!bridge) ai.upsideDownRecoveryAttempt = 0;
  ai.automaticVehicleResetCount = Number(ai.automaticVehicleResetCount || 0) + 1;
  ai.lastVehicleResetReason = recoveryReason;
  ai.trackStatePreviousWheelPositions = null;
  ai.tireTrackLastContactByWheel = {};
  ai.drivingPlan = null;
  return true;
}

export function updateRaceAiVehiclePhysics(editor, ai = {}, {
  car = editor.selectedCar,
  tuning = editor.getRaceCarTuning(car),
  seconds = 0,
  previousSpeedMps = Number(ai.speedMps || 0),
  targetVelocityWorld = null,
  contactState: suppliedContactState = null
} = {}) {
  if (!ai) return null;
  const contactState = suppliedContactState || editor.getRaceAiContactState(ai, car, tuning);
  const engineDrive = ai.engineDrive || {};
  if (!ai.vehicleDynamicsRunner) {
    const config = createVehicleDynamicsConfigFromTuning(
      { ...tuning, handlingPreset: 'sport' },
      {
        chassisHz: RACE_AI_PHYSICS_HZ,
        tireHz: RACE_AI_PHYSICS_HZ,
        // A hitch must not request an entire second of collision solving for
        // every opponent in one render update. Retain debt, drain it in bounded
        // batches; the player's authoritative catch-up policy is unchanged.
        maxCatchUpSteps: 4,
        telemetryLimit: 1,
        telemetryRetention: 'none',
        postResetDiagnosticsEnabled: globalThis.__RTG_CAPTURE_PHYSICS_INCIDENTS__ === true,
        inputTimelineLimit: 512
      }
    );
    ai.vehicleDynamicsRunner = new VehicleDynamicsRunner({
      config,
      initialState: {
        worldX: contactState.session.worldX,
        heightM: Number(contactState.contacts?.averageHeightM
          ?? Number(contactState.pose?.elevation || 0) * RACE_THREE_ELEVATION_M)
          + config.cgHeightM,
        worldZ: contactState.session.worldZ,
        speedMps: targetVelocityWorld
          ? Math.hypot(Number(targetVelocityWorld.x || 0), Number(targetVelocityWorld.z || 0))
          : Number(ai.speedMps || 0),
        carYaw: contactState.session.carYaw,
        pitchRad: -Number(contactState.contacts?.terrainPitchRad || 0),
        rollRad: Number(contactState.contacts?.terrainRollRad || 0),
        velocity: {
          x: targetVelocityWorld?.x ?? Math.sin(contactState.session.carYaw) * Number(ai.speedMps || 0),
          y: targetVelocityWorld?.y ?? Number(ai.speedMps || 0) * Math.tan(Number(contactState.contacts?.terrainPitchRad || 0)),
          z: targetVelocityWorld?.z ?? Math.cos(contactState.session.carYaw) * Number(ai.speedMps || 0)
        },
        engineRpm: ai.rpm,
        gear: ai.gear
      },
      inputTimeline: [{ timeSeconds: 0, input: {} }]
    });
  }
  const runner = ai.vehicleDynamicsRunner;
  const tireSetup = editor.getRaceCarSetup(car);
  if (!ai.tireConfigByWheel) {
    ai.tireConfigByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      {
        compound: editor.getRaceTireCompound(tireSetup.tireCompoundByWheel[wheelId], car),
        widthMm: tireSetup.tireSize?.widthMm,
        aspectRatio: tireSetup.tireSize?.aspectRatio,
        wheelDiameterIn: tireSetup.tireSize?.wheelDiameterIn,
        coldPressurePsi: tireSetup.tirePressurePsi[wheelId]
      }
    ]));
  }
  const aiWeather = editor.getRaceWeatherState(editor.selectedRace, editor.playtestSession);
  const ambientTemperatureC = aiWeather.id === 'snow' ? -4
    : aiWeather.id === 'storm' ? 13
      : aiWeather.id === 'rain' ? 16 : 22;
  const surfaceModel = editor.getRaceSurfaceModel();
  const runtimeType = contactState.session.routeRuntimeType || editor.getActiveRaceRuntimeType();
  const wakeSources = getRaceWakeSourcesForFrame(editor.playtestSession, {
    playerWidthM: Number(editor.playtestSession?.runtimeCarWidthM || editor.getRaceCarTuning(editor.selectedCar)?.widthM || 1.8)
  });
  runner.environmentProvider = ({ state, previousState, chassisStepDt, terrainQueryFrameGeneration, controls: fixedControls, timeSeconds }) => {
    const costs = runner.physicsCostAccounting?.detailedCaptureActive ? runner.physicsCostAccounting : null;
    let stage = costs?.start('environmentTerrainPreparation');
    const terrainQueryFrame = prepareRaceAiTerrainFrame(editor, ai, runner, state, previousState, chassisStepDt);
    costs?.end(stage);
    stage = costs?.start('environmentWheelKinematics');
    const { patches: preliminaryPatches, positions } = prepareRaceAiWheelKinematics(
      ai, state, fixedControls, runner.config
    );
    costs?.end(stage);
    stage = costs?.start('environmentWheelMaterials');
    let fixedContacts;
    if (terrainQueryFrame) {
      const surfaceSamples = {};
      const queryContext = { runtimeType, weatherState: aiWeather };
      for (let index = 0; index < RACE_WHEEL_IDS.length; index++) {
        const wheelId = RACE_WHEEL_IDS[index];
        const point = positions[wheelId];
        const geometry = terrainQueryFrame.samplePoint(point);
        const material = terrainQueryFrame.materialForWheelSignature(index,
          geometry.triangleId, geometry.region, geometry.source,
          (p) => surfaceModel.samplePhysicsGeometry(p, queryContext), point);
        surfaceSamples[wheelId] = {
          ...geometry, friction: material?.friction, surfaceId: material?.surfaceId,
          projection: material?.projection, segment: material?.projection?.segment
        };
      }
      fixedContacts = createRaceWheelContactStateFromSamples({
        positions, surfaceSamples, tuning, preparedSamples: true,
        trackState: contactState.session.trackState,
        groundedByWheel: state.validTreadContactByWheel,
        elevationScaleM: RACE_THREE_ELEVATION_M
      });
    } else {
      fixedContacts = editor.getRaceWheelContactState({
        car,
        tuning,
        session: {
          ...contactState.session,
          worldX: Number(state.position?.x || 0),
          worldZ: Number(state.position?.z || 0),
          carYaw: Number(state.yawRad || 0),
          grounded: state.grounded,
          airborne: !state.grounded,
          vehicle3d: null
        },
        wheelSurfaceState: { positions }
      });
    }
    costs?.end(stage);
    stage = costs?.start('environmentFootprintGeometry');
    const footprintOffsets = [[-0.7, -0.42], [-0.7, 0.42], [0.7, -0.42], [0.7, 0.42],
      [-0.15, 0], [0.15, 0], [0, -0.48], [0, 0.48]]
      .slice(0, runner.config.contactFootprintSamples);
    const tireWidthM = Math.max(0.12, Number(tireSetup.tireSize?.widthMm || 245) / 1000);
    const sampleFootprint = ([longitudinal, lateral]) => {
      const samplePositions = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
        const patch = preliminaryPatches[wheelId];
        return [wheelId, {
          x: patch.contactPointWorld.x + patch.wheelForwardWorld.x * longitudinal * 0.16
            + patch.wheelLateralWorld.x * lateral * tireWidthM,
          y: patch.contactPointWorld.y,
          z: patch.contactPointWorld.z + patch.wheelForwardWorld.z * longitudinal * 0.16
            + patch.wheelLateralWorld.z * lateral * tireWidthM
        }];
      }));
      if (terrainQueryFrame) return sampleRaceAiFootprintGeometry(terrainQueryFrame, samplePositions);
      return editor.getRaceWheelContactState({ car, tuning,
        session: { ...contactState.session, worldX: state.position.x, worldZ: state.position.z,
          carYaw: state.yawRad, grounded: state.grounded, airborne: !state.grounded, vehicle3d: null },
        wheelSurfaceState: { positions: samplePositions } });
    };
    const footprintContacts = footprintOffsets.slice(0, 4).map(sampleFootprint);
    const needsAdaptiveSamples = RACE_WHEEL_IDS.some((wheelId) => {
      const heights = footprintContacts.map((sample) => sample.heights?.[wheelId]);
      return heights.some((height) => !Number.isFinite(height))
        || Math.max(...heights) - Math.min(...heights) > 0.02;
    });
    if (needsAdaptiveSamples) {
      footprintContacts.push(...footprintOffsets.slice(4).map(sampleFootprint));
    }
    costs?.end(stage);
    stage = costs?.start('environmentCollisionClassification');
    const collisionEnvironment = classifyRaceAiTerrainCollision(terrainQueryFrame, state, runner.config, positions, chassisStepDt);
    costs?.end(stage);
    const atmosphere = createDeterministicAtmosphere({
      weatherState: aiWeather,
      race: editor.selectedRace,
      timeSeconds
    });
    const panelDamage = ai.damage?.panels || {};
    return {
      surfaceHeightByWheel: { ...(fixedContacts.heights || {}) },
      surfaceNormalByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
        wheelId, fixedContacts.contacts?.[wheelId]?.normal
      ])),
      contactSamplesByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId,
        footprintContacts.map((sample) => {
          const normal = sample.contacts?.[wheelId]?.normal || { x: 0, y: 1, z: 0 };
          return { heightM: sample.heights?.[wheelId], normalX: normal.x, normalY: normal.y,
            normalZ: normal.z, supported: Number.isFinite(sample.heights?.[wheelId]) };
        })
      ])),
      materialByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
        const contact = fixedContacts.contacts?.[wheelId] || {};
        const sample = contact.trackState;
        const baseSurfaceId = sample?.cell?.baseSurfaceId || contact.baseSurfaceId || 'asphalt';
        const nominalBaseGrip = Math.max(0.025, Number(getSurfaceById(baseSurfaceId)?.grip || 1));
        const localBaseGrip = Number(sample?.cell?.baseGrip ?? contact.friction ?? nominalBaseGrip);
        return [wheelId, {
          ...(sample?.cell || {}),
          baseSurfaceId,
          grip: sample?.effectiveGrip ?? contact.friction ?? 1,
          effectiveGrip: sample?.effectiveGrip ?? contact.friction ?? 1,
          effectiveGripMultiplier: sample?.effectiveGripMultiplier ?? 1,
          // Match the player contact model: preserve absolute ground friction.
          surfaceGripScale: localBaseGrip
            * Number(sample?.effectiveGripMultiplier ?? 1),
          surfaceId: contact.surfaceId || contact.surface,
          trackStateConditionApplied: Boolean(sample)
        }];
      })),
      ...collisionEnvironment,
      staticColliderWorld: editor.vehicleDynamicsAuthority?.raceEnvironmentProviderContext?.staticColliderWorld,
      physicsTerrainQueryFrame: terrainQueryFrame,
      terrainQueryFrameGeneration,
      sampleTerrainAtWorldPoint: (worldPoint, query = {}) => {
        // Tire iterations retain their samples through the four-wheel solve.
        // Honor their output buffer instead of aliasing the frame's scalar scratch.
        if (terrainQueryFrame) return terrainQueryFrame.samplePoint(worldPoint, query.target || undefined);
        const sample = surfaceModel.sampleWorld(worldPoint, 0, {
          runtimeType,
          fallbackSurfaceId: fixedContacts.contacts?.fl?.surfaceId || 'asphalt'
        });
        return {
          heightM: Number(sample.elevation || 0) * RACE_THREE_ELEVATION_M,
          normal: sample.normal || { x: 0, y: 1, z: 0 },
          friction: Number(sample.friction || 1)
        };
      },
      tireByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
        const fixedTire = ai.tireConfigByWheel[wheelId];
        const thermal = state.tireState?.[wheelId] || {};
        return [wheelId, {
          ...fixedTire,
          pressurePsi: thermal.effectivePressurePsi ?? tireSetup.tirePressurePsi[wheelId],
          effectivePressurePsi: thermal.effectivePressurePsi ?? tireSetup.tirePressurePsi[wheelId],
          treadTemperatureC: thermal.treadTemperatureC,
          temperatureF: thermal.temperatureF ?? 70,
          wear: thermal.wear ?? 0,
          damage: Number(ai.damage?.tires?.[wheelId] || 0)
        }];
      })),
      ambientTemperatureC,
      ...atmosphere,
      vehicleId: String(ai.id || ai.driverId || 'ai'),
      wakeSources,
      bodyDamage: Math.max(0, ...Object.values(panelDamage).map(Number)),
      frontAeroDamage: clamp(Number(panelDamage.front || 0) / 100, 0, 1),
      rearAeroDamage: clamp(Number(panelDamage.rear || 0) / 100, 0, 1),
      activeAeroState: Number(ai.activeAeroState || 0),
      targetVelocityWorld
    };
  };
  const drivingPlan = ai.drivingPlan || planRaceAiDriving(editor, ai, tuning, {
    grip: contactState.averageSurfaceGrip,
    profile: editor.getRaceAiDifficultyProfile(ai.difficulty)
  });
  const physicalCenterSteeringAngle = drivingPlan.steeringAngleRad;
  const normalizedSteering = clamp(physicalCenterSteeringAngle / runner.config.maxSteerAngleRad, -1, 1);
  const physicsInput = {
    itemSpeedMultiplier:ai.itemSpeedMultiplier||1,
    steering: normalizedSteering,
    centerSteeringAngleRad: physicalCenterSteeringAngle,
    steeringInputMode: 'ai',
    throttle: Number(engineDrive.throttle || 0),
    brake: Number(engineDrive.brake || 0),
    requestedGear: Number(ai.gear || 1),
    assists: { stabilityControlEnabled: true }
  };
  const workerBridge = editor.vehicleDynamicsAuthority?.workerBridge;
  const workerSnapshot = workerBridge && ai.workerVehicleId
    ? workerBridge.updateAiVehicle({
        vehicleId: ai.workerVehicleId,
      controls: physicsInput,
      ai,
      active: ai.sleeping !== true
      })
    : null;
  if (!workerBridge) runner.advance(seconds, { input: physicsInput });
  if (workerBridge && !workerSnapshot) return runner.state;
  // Compatibility synchronization already supports in-place records. Retain
  // them instead of recreating every body/wheel/diagnostic object each update.
  // A rebuilt runner gets a fresh profile and contact-presentation history.
  let compatibility = compatibilitySessions.get(ai);
  if (!compatibility || compatibility.runner !== runner) {
    compatibility = { runner, session: {} };
    compatibilitySessions.set(ai, compatibility);
  }
  const aiSession = compatibility.session;
  if (workerSnapshot) {
    applyRaceVehicleRenderSnapshot(aiSession, workerSnapshot);
  } else {
    syncVehicleDynamicsCompatibilityOutputs(runner, aiSession);
  }
  ai.vehicle3d = aiSession.vehicle3d;
  ai.vehicleRenderState = aiSession.vehicleRenderState;
  ai.vehicleDynamicsPresentationState = aiSession.vehicleDynamicsPresentationState;
  ai.speedMps = aiSession.speedMps;
  ai.worldX = aiSession.worldX;
  ai.worldZ = aiSession.worldZ;
  ai.carYaw = aiSession.carYaw;
  ai.bodyY = aiSession.bodyY;
  ai.heightM = Number(aiSession.bodyY) - runner.config.cgHeightM;
  ai.pitchRad = aiSession.pitchRad;
  ai.rollRad = aiSession.rollRad;
  ai.verticalVelocityMps = aiSession.verticalVelocityMps;
  ai.velocityYaw = aiSession.velocityYaw;
  ai.yawVelocityRadps = aiSession.yawVelocityRadps;
  ai.rpm = aiSession.engineRpm;
  ai.gear = aiSession.gear;
  ai.grounded = aiSession.grounded;
  ai.airborne = aiSession.airborne;
  ai.wheelContacts3d = aiSession.wheelContacts3d;
  ai.suspensionTravel = aiSession.suspensionTravel;
  ai.terrainRollRad = Number(contactState.contacts?.terrainRollRad || 0);
  ai.terrainPitchRad = Number(contactState.contacts?.terrainPitchRad || 0);
  ai.averageSurfaceGrip = Number(contactState.averageSurfaceGrip || 1);
  ai.wheelRegions = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    aiSession.vehicle3d?.wheels?.[wheelId]?.surface?.region
      || contactState.contacts?.contacts?.[wheelId]?.region
      || 'terrain'
  ]));
  recoverUpsideDownRaceAi(editor, ai, { car, tuning, seconds, contactState });
  return workerSnapshot || runner.state;
}

export function getRaceAiLongitudinalPhysicsStep(editor, ai = {}, {
  car = editor.selectedCar,
  tuning = editor.getRaceCarTuning(car),
  targetMps = 0,
  profile = editor.getRaceAiDifficultyProfile(ai.difficulty),
  contactState = null,
  seconds = 0
} = {}) {
  const dt = Math.max(0.0001, Number(seconds) || 0.0001);
  const speed = Math.max(0, Number(ai.speedMps || 0));
  const aiDistance = Number(ai.projectedDistance ?? ai.distance ?? 0) || 0;
  const target = Math.max(0, Number(targetMps) || 0);
  const controls = planRaceAiControls(editor,ai,tuning,target,profile);
  const {braking,throttle,brake}=controls;
  const drivenWheelIds = editor.getRaceDrivenWheelIds(tuning);
  const contacts = contactState || editor.getRaceAiContactState(ai, car, tuning);
  const wheelContacts = contacts.contacts?.contacts || {};
  const wheelContacts3d = ai.vehicle3d?.wheels || ai.wheelContacts3d || null;
  const aiAirborneWithoutContacts = !wheelContacts3d && (ai.airborne || ai.grounded === false);
  const aiWheelContactCount = wheelContacts3d
    ? RACE_WHEEL_IDS.filter((wheelId) => {
      const wheel = wheelContacts3d?.[wheelId];
      if (!wheel?.inContact) return false;
      if (wheel.normalLoadKnown === false) return true;
      return Number(wheel.normalLoadN || 0) > 1;
    }).length
    : (aiAirborneWithoutContacts ? 0 : RACE_WHEEL_IDS.length);
  const tireContactScale = clamp(aiWheelContactCount / RACE_WHEEL_IDS.length, 0, 1);
  const zeroLoadsIfAirborne = (loads = {}) => {
    if (tireContactScale > 0.001) return loads;
    RACE_WHEEL_IDS.forEach((wheelId) => {
      loads[wheelId] = 0;
    });
    return loads;
  };
  const aiDamage = ai.damage || {};
  const setup = editor.getRaceCarSetup(car);
  ai.tireTemperature = {
    fl: 70,
    fr: 70,
    rl: 70,
    rr: 70,
    ...(ai.tireTemperature || {})
  };
  const weatherState = editor.getRaceWeatherState(editor.selectedRace, editor.playtestSession);
  const normalizedGripSetup = {
    ...setup,
    tireSize: editor.normalizeCarTireSize(setup.tireSize || {})
  };
  const perWheelGrip = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const contact = wheelContacts[wheelId] || {};
    const surfaceId = contact.surface || contact.surfaceId || contacts.contacts?.surfaceByWheel?.[wheelId] || 'asphalt';
    return [
      wheelId,
      editor.getRaceWheelGripForSurface({
        car,
        normalizedSetup: normalizedGripSetup,
        wheelId,
        surfaceId,
        baseSurfaceId: contact.baseSurface || contacts.contacts?.baseSurfaceByWheel?.[wheelId] || surfaceId,
        snowDepthInches: contact.snowDepthInches
          ?? contacts.contacts?.snowDepthByWheel?.[wheelId]
          ?? weatherState.snowDepthInches,
        weather: weatherState.id,
        material: contact.trackState?.cell || null,
        damage: aiDamage,
        terrainGripScale: contact.terrainGripScale || 1,
        temperatureF: ai.tireTemperature[wheelId]
      })
    ];
  }));
  const looseSurfaceFactor = editor.getRaceLooseSurfaceFactor({
    surfaceByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      wheelContacts[wheelId]?.surface || wheelContacts[wheelId]?.surfaceId || contacts.contacts?.surfaceByWheel?.[wheelId] || 'asphalt'
    ])),
    terrainByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      wheelContacts[wheelId]?.region || contacts.contacts?.terrainByWheel?.[wheelId] || 'road'
    ]))
  });
  const setupModifiers = editor.getRaceSetupPhysicsModifiers(tuning, speed);
  const aeroLoadEffectiveness = editor.getRaceAeroLoadEffectiveness(looseSurfaceFactor);
  const referenceNormalLoads = editor.getRaceWheelNormalLoads(tuning, 0, 0, speed, { aeroLoadEffectiveness });
  const aeroDownforceForLoads = editor.getRaceEffectiveAeroDownforceByAxle(tuning, speed, looseSurfaceFactor);
  const normalLoads = editor.getRace3DResolvedWheelNormalLoads(
    referenceNormalLoads,
    wheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  const bumpNormalLoadScales = editor.getRaceBumpNormalLoadScales({
    segment: contacts.pose?.segment || editor.getRaceSegmentAtDistance(aiDistance).segment,
    distance: aiDistance,
    speedMps: speed
  });
  editor.applyRaceBumpNormalLoadScales(normalLoads, bumpNormalLoadScales);
  zeroLoadsIfAirborne(normalLoads);
  const referenceFrontNormal = Math.max(1, Number(referenceNormalLoads.fl || 0) + Number(referenceNormalLoads.fr || 0));
  const referenceRearNormal = Math.max(1, Number(referenceNormalLoads.rl || 0) + Number(referenceNormalLoads.rr || 0));
  const frontNormal = Number(normalLoads.fl || 0) + Number(normalLoads.fr || 0);
  const rearNormal = Number(normalLoads.rl || 0) + Number(normalLoads.rr || 0);
  const lateralContactScale = clamp((frontNormal + rearNormal) / Math.max(1, referenceFrontNormal + referenceRearNormal), 0, 1);
  const drivenStaticLoad = drivenWheelIds.reduce((sum, wheelId) => sum + Math.max(1, Number(referenceNormalLoads[wheelId] || 0)), 0);
  const drivenContactLoad = wheelContacts3d
    ? drivenWheelIds.reduce((sum, wheelId) => {
      const wheel = wheelContacts3d[wheelId];
      if (!wheel || wheel.inContact === false) return sum;
      return sum + Math.max(0, Number(normalLoads[wheelId] || 0));
    }, 0)
    : drivenStaticLoad * tireContactScale;
  const drivenLoadScale = tireContactScale <= 0.001
    ? 0
    : clamp(drivenContactLoad / Math.max(1, drivenStaticLoad), 0, 1);
  const gripFactor = Math.max(0.35, Math.min(1.4, tuning.tireGrip))
    * clamp(Number(contacts.averageSurfaceGrip || 1), 0.22, 1.2)
    * (editor.playtestSession?.trackState
      ? 1
      : editor.getRaceWeatherGripMultiplier(editor.getRaceWeatherState(editor.selectedRace, editor.playtestSession)))
    * setupModifiers.grip;
  const {gear,rpm,automaticOverrevUpshifts,automaticUpshiftRpm}=controls;
  const gearRatio = editor.getRaceGearRatio(tuning,gear);
  const engineTorqueNm = editor.getRaceTorqueNmAtRpm(rpm, tuning);
  const driveForceComponents = editor.getRaceDriveForceComponents({
    tuning,
    gearRatio,
    engineTorqueNm,
    availablePowerW: tuning.powerHp * 745.7,
    speedMps: speed
  });
  const driveForceCommandRaw = driveForceComponents.baseForceN * tuning.accelerationCalibration * throttle;
  const driveForceRaw = drivenLoadScale > 0.001 ? driveForceCommandRaw : 0;
  const preliminaryDrivenTraction = editor.getRaceDrivenTractionLimit({
    tuning,
    drivenWheelIds,
    normalLoads,
    referenceNormalLoads,
    gripByWheel: perWheelGrip,
    gripFactor,
    looseSurfaceFactor,
    setupModifiers
  });
  const preliminaryDrivenTractionLimit = preliminaryDrivenTraction.tractionLimitN;
  const preliminaryDriveDemandRatio = driveForceCommandRaw ? Math.abs(driveForceCommandRaw) / Math.max(1, preliminaryDrivenTractionLimit) : 0;
  const preliminaryExcessDriveSlip = clamp((preliminaryDriveDemandRatio - 1) / 1.2, 0, 1);
  const preliminaryPostPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(
    preliminaryExcessDriveSlip,
    looseSurfaceFactor,
    false
  );
  const preliminaryEffectiveDrivenTractionLimit = preliminaryDrivenTractionLimit * preliminaryPostPeakTractionEfficiency;
  const preliminaryAppliedDriveForce = Math.min(driveForceRaw, preliminaryEffectiveDrivenTractionLimit);
  const driveLoadAcceleration = clamp(
    preliminaryAppliedDriveForce / Math.max(450, Number(tuning.weightKg) || 1400),
    -9.5,
    9.5
  );
  const driveNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, driveLoadAcceleration, 0, speed, { aeroLoadEffectiveness }),
    wheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(driveNormalLoads, bumpNormalLoadScales);
  zeroLoadsIfAirborne(driveNormalLoads);
  const drivenTraction = editor.getRaceDrivenTractionLimit({
    tuning,
    drivenWheelIds,
    normalLoads: driveNormalLoads,
    referenceNormalLoads,
    gripByWheel: perWheelGrip,
    gripFactor,
    looseSurfaceFactor,
    setupModifiers
  });
  const drivenTractionLimit = drivenTraction.tractionLimitN;
  const driveLoadSensitivityByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    editor.getRaceTireLoadSensitivityMultiplier(driveNormalLoads[wheelId], referenceNormalLoads[wheelId], looseSurfaceFactor)
  ]));
  const driveForceDemandRaw = driveForceCommandRaw;
  const driveDemandRatio = driveForceDemandRaw ? Math.abs(driveForceDemandRaw) / Math.max(1, drivenTractionLimit) : 0;
  const excessDriveSlip = clamp((driveDemandRatio - 1) / 1.2, 0, 1);
  const postPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(
    excessDriveSlip,
    looseSurfaceFactor,
    false
  );
  const effectiveDrivenTractionLimit = drivenTractionLimit * postPeakTractionEfficiency;
  const driveForce = Math.min(driveForceRaw, effectiveDrivenTractionLimit);
  const appliedDriveDemandRatio = driveForceRaw ? Math.abs(driveForceRaw) / Math.max(1, drivenTractionLimit) : 0;
  const wheelSpinRatio = clamp(appliedDriveDemandRatio, 0, 1.8);
  const relaxedWheelSpinRatio = editor.getRaceRelaxedLongitudinalSlipRatio({
    targetSlipRatio: wheelSpinRatio,
    previousSlipRatio: ai.longitudinalWheelSlipRatio,
    speedMps: speed,
    looseSurfaceFactor,
    tireContactScale,
    seconds
  });
  ai.longitudinalWheelSlipRatio = relaxedWheelSpinRatio;
  const driveForceShareByWheel = drivenTraction.forceShareByWheel
    || editor.getRaceDriveForceShareByWheel(tuning, drivenWheelIds, {
      normalLoads: driveNormalLoads,
      gripByWheel: perWheelGrip,
      driveForce: driveForceRaw
    });
  const driveForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    driveForce * Number(driveForceShareByWheel[wheelId] || 0)
  ]));
  const engineBraking = editor.getRaceEngineBrakingForce({
    tuning,
    gearRatio,
    throttle,
    speedMps: speed,
    engineRpm: rpm,
    drivenTractionLimit,
    tireContactScale: drivenLoadScale
  });
  const engineBrakeForceShareByWheel = editor.getRaceDriveForceShareByWheel(tuning, drivenWheelIds, {
    normalLoads: driveNormalLoads,
    gripByWheel: perWheelGrip,
    driveForce: engineBraking.force
  });
  const engineBrakeForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    engineBraking.force * Number(engineBrakeForceShareByWheel[wheelId] || 0)
  ]));
  const chassisLongitudinalForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Number(driveForceByWheel[wheelId] || 0) + Number(engineBrakeForceByWheel[wheelId] || 0)
  ]));
  const preliminaryBrakeState = editor.getRaceBrakeForceForInput({
    tuning,
    brake,
    handbrake: 0,
    gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
    normalLoads,
    referenceNormalLoads,
    looseSurfaceFactor,
    speedMps: speed
  });
  if (tireContactScale <= 0.001) preliminaryBrakeState.force = 0;
  const brakeLoadAcceleration = -preliminaryBrakeState.force / Math.max(450, Number(tuning.weightKg) || 1400);
  const brakeNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, brakeLoadAcceleration, 0, speed, { aeroLoadEffectiveness }),
    wheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(brakeNormalLoads, bumpNormalLoadScales);
  zeroLoadsIfAirborne(brakeNormalLoads);
  const brakeState = editor.getRaceBrakeForceForInput({
    tuning,
    brake,
    handbrake: 0,
    gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
    normalLoads: brakeNormalLoads,
    referenceNormalLoads,
    looseSurfaceFactor,
    speedMps: speed
  });
  if (tireContactScale <= 0.001) {
    brakeState.force = 0;
    brakeState.appliedByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
    brakeState.lockByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
  }
  const wheelLongitudinalUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const wheelLimit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: brakeNormalLoads,
      referenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor
    });
    const driveUsage = Math.abs(driveForceRaw) * Number(driveForceShareByWheel[wheelId] || 0);
    const engineBrakeUsage = Math.abs(engineBraking.force) * Number(engineBrakeForceShareByWheel[wheelId] || 0);
    const brakeUsage = Number(brakeState.appliedByWheel?.[wheelId] || 0);
    if (wheelLimit <= 0.001) return [wheelId, 0];
    return [wheelId, clamp((driveUsage + engineBrakeUsage + brakeUsage) / wheelLimit, 0, 2.2)];
  }));
  const routeCurve = Number(contacts.pose?.segment?.curve || ai.curve || 0);
  const aiLateralAcceleration = speed * speed * routeCurve * 0.0025;
  const aiTireLongitudinalLoadAcceleration = clamp(
    (driveForce + engineBraking.force - brakeState.force) / Math.max(450, Number(tuning.weightKg) || 1400),
    -9.5,
    9.5
  );
  const dynamicNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, aiTireLongitudinalLoadAcceleration, aiLateralAcceleration, speed, { aeroLoadEffectiveness }),
    wheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(dynamicNormalLoads, bumpNormalLoadScales);
  zeroLoadsIfAirborne(dynamicNormalLoads);
  const dynamicFrontNormal = Number(dynamicNormalLoads.fl || 0) + Number(dynamicNormalLoads.fr || 0);
  const dynamicRearNormal = Number(dynamicNormalLoads.rl || 0) + Number(dynamicNormalLoads.rr || 0);
  const dynamicLateralContactScale = clamp(
    (dynamicFrontNormal + dynamicRearNormal) / Math.max(1, referenceFrontNormal + referenceRearNormal),
    0,
    1
  );
  const lateralForceTotal = Math.abs(aiLateralAcceleration) * Math.max(450, Number(tuning.weightKg) || 1400);
  const aiAxleLateralGripModifier = { front: 1, rear: 1 };
  const wheelRemainingLateralLimit = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    editor.getRaceWheelRemainingLateralLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads,
      gripByWheel: perWheelGrip,
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      longitudinalUsage: wheelLongitudinalUsage[wheelId],
      axleGripModifier: wheelId === 'fl' || wheelId === 'fr' ? aiAxleLateralGripModifier.front : aiAxleLateralGripModifier.rear
    })
  ]));
  const wheelLateralUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const isFront = wheelId === 'fl' || wheelId === 'fr';
    const axleShare = isFront ? 0.56 : 0.44;
    const wheelLimit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor
    });
    const remainingLateralLimit = Number(wheelRemainingLateralLimit[wheelId] || 0);
    if (wheelLimit <= 0.001) return [wheelId, 0];
    return [wheelId, clamp(Math.min(lateralForceTotal * axleShare * 0.5, remainingLateralLimit) / wheelLimit, 0, 1.45)];
  }));
  const wheelFrictionUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Math.hypot(Number(wheelLongitudinalUsage[wheelId] || 0), Number(wheelLateralUsage[wheelId] || 0))
  ]));
  const combinedLongitudinalEfficiency = editor.getRaceCombinedLongitudinalEfficiency(
    wheelFrictionUsage,
    wheelLongitudinalUsage,
    looseSurfaceFactor,
    dynamicLateralContactScale
  );
  const longitudinalTireForce = driveForce + engineBraking.force - brakeState.force;
  const combinedLongitudinalForceLoss = longitudinalTireForce * (1 - combinedLongitudinalEfficiency);
  const combinedLongitudinalAppliedForce = longitudinalTireForce - combinedLongitudinalForceLoss;
  const combinedLongitudinalForceScale = Math.abs(longitudinalTireForce) > 0.001
    ? clamp(Math.abs(combinedLongitudinalAppliedForce / longitudinalTireForce), 0, 1)
    : 1;
  const combinedChassisLongitudinalForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Number(chassisLongitudinalForceByWheel[wheelId] || 0) * combinedLongitudinalForceScale
  ]));
  const combinedBrakeState = {
    ...brakeState,
    force: Number(brakeState.force || 0) * combinedLongitudinalForceScale,
    appliedByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(brakeState.appliedByWheel?.[wheelId] || 0) * combinedLongitudinalForceScale
    ]))
  };
  const aiWheelContactScaleByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const referenceLoad = Math.max(1, Number(referenceNormalLoads[wheelId] || 1));
    const rawLoad = Number(dynamicNormalLoads[wheelId]);
    const load = Number.isFinite(rawLoad) ? Math.max(0, rawLoad) : referenceLoad;
    return [wheelId, clamp(load / referenceLoad, 0, 1)];
  }));
  const aiContactWheelSpinRatioByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    drivenWheelIds.includes(wheelId)
      ? relaxedWheelSpinRatio * Number(aiWheelContactScaleByWheel[wheelId] || 0)
      : 0
  ]));
  const aiFreeWheelSpinRatioByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    drivenWheelIds.includes(wheelId)
      ? relaxedWheelSpinRatio * (1 - Number(aiWheelContactScaleByWheel[wheelId] || 0))
      : 0
  ]));
  const aiTireSlipByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Math.max(
      Math.max(0, Number(aiContactWheelSpinRatioByWheel[wheelId] || 0) - 0.78) * 1.1,
      Math.max(0, Number(wheelLongitudinalUsage[wheelId] || 0) - 0.92) * 0.8,
      Math.max(0, Number(wheelLateralUsage[wheelId] || 0) - 0.85) * 1.4,
      Number(brakeState.lockByWheel?.[wheelId] || 0)
    ) * Number(aiWheelContactScaleByWheel[wheelId] || 0)
  ]));
  const tirePressureDynamicsByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const compound = editor.getRaceTireCompound(setup.tireCompoundByWheel[wheelId], car);
    const surfaceId = wheelContacts[wheelId]?.surface || wheelContacts[wheelId]?.surfaceId || contacts.contacts?.surfaceByWheel?.[wheelId] || 'asphalt';
    return [wheelId, editor.getRaceTirePressureDynamics({
      pressurePsi: setup.tirePressurePsi[wheelId],
      compoundId: compound.id,
      surfaceId,
      tireSize: setup.tireSize,
      temperatureF: ai.tireTemperature[wheelId]
    })];
  }));
  const nextTireTemperature = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const staticLoad = Math.max(1, Number(referenceNormalLoads[wheelId] || 1));
    const rawLoad = Number(dynamicNormalLoads[wheelId]);
    const load = Number.isFinite(rawLoad) ? Math.max(0, rawLoad) : staticLoad;
    return [wheelId, editor.getRaceUpdatedTireTemperature({
      previousTemperatureF: ai.tireTemperature[wheelId],
      seconds: dt,
      speedMps: speed,
      loadRatio: load / staticLoad,
      slip: aiTireSlipByWheel[wheelId],
      pressureDynamics: tirePressureDynamicsByWheel[wheelId],
      handbrake: 0,
      wheelId,
      contactLoadScale: aiWheelContactScaleByWheel[wheelId],
      surfaceId: wheelContacts[wheelId]?.surface || wheelContacts[wheelId]?.surfaceId || contacts.contacts?.surfaceByWheel?.[wheelId] || 'asphalt',
      terrain: wheelContacts[wheelId]?.terrain || contacts.contacts?.terrainByWheel?.[wheelId] || 'road'
    })];
  }));
  const tirePressureRollingMultiplier = RACE_WHEEL_IDS.reduce((sum, wheelId) => {
    const pressureDynamics = tirePressureDynamicsByWheel[wheelId] || {};
    return sum + Number(pressureDynamics.rollingMultiplier || 1);
  }, 0) / RACE_WHEEL_IDS.length;
  const tireTemperatureGrip = editor.getRaceTireTemperatureGripMultipliers(ai.tireTemperature);
  const snowDepthInches = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
    sum + Number(
      wheelContacts[wheelId]?.snowDepthInches
      ?? contacts.contacts?.snowDepthByWheel?.[wheelId]
      ?? weatherState.snowDepthInches
      ?? 0
    )
  ), 0) / RACE_WHEEL_IDS.length;
  const trackStateRollingResistance = editor.playtestSession?.trackState
    ? RACE_WHEEL_IDS.reduce((sum, wheelId) => (
      sum + (
        Number(wheelContacts[wheelId]?.trackState?.rollingResistanceMultiplier || 1)
        / Math.max(0.2, Number(wheelContacts[wheelId]?.trackState?.cell?.baseRollingResistance || 1))
      )
    ), 0) / RACE_WHEEL_IDS.length
    : 1;
  const terrainResistance = (1 + looseSurfaceFactor * 0.32
    + editor.getRaceSnowResistanceMultiplier(snowDepthInches)) * trackStateRollingResistance;
  const resistanceForces = editor.getRaceLongitudinalResistanceForces({
    tuning,
    speedMps: speed,
    setupModifiers,
    terrainResistance,
    looseSurfaceFactor,
    tirePressureRollingMultiplier,
    tireContactScale
  });
  const runtimeType = editor.playtestSession?.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const roadGrade = Number(editor.getRaceRoadSurfaceProfileAtDistance(aiDistance, { runtimeType }).grade || 0);
  const gradeForce = -Math.max(450, Number(tuning.weightKg) || 1400) * 9.81 * editor.getRaceGradeGravityRatio(roadGrade) * tireContactScale;
  const acceleration = (combinedLongitudinalAppliedForce + gradeForce - resistanceForces.totalN) / Math.max(450, Number(tuning.weightKg) || 1400);
  const topSpeedLimitMps = editor.getRaceRuntimeTopSpeedLimitMps(car, tuning, {
    setupModifiers,
    gripFactor,
    looseSurfaceFactor,
    tirePressureRollingMultiplier
  });
  ai.gear = gear;
  ai.rpm = rpm;
  ai.engineDrive = {
    throttle,
    brake,
    topSpeedLimitMps,
    driveDemandRatio,
    automaticUpshiftRpm,
    automaticOverrevUpshifts,
    postPeakTractionEfficiency,
    limitingSource: driveForceComponents.limitingSource,
    powerLimitBlend: driveForceComponents.powerLimitBlend,
    tractionLimitN: drivenTractionLimit,
    drivenTraction,
    demandedForceN: driveForceDemandRaw,
    appliedRawForceN: driveForceRaw,
    driveForceN: driveForce,
    appliedDriveDemandRatio,
    wheelSpinRatio: relaxedWheelSpinRatio,
    targetWheelSpinRatio: wheelSpinRatio,
    referenceNormalLoads,
    normalLoads,
    driveNormalLoads,
    brakeNormalLoads,
    dynamicNormalLoads,
    bumpNormalLoadScales,
    tireLongitudinalLoadAcceleration: aiTireLongitudinalLoadAcceleration,
    brakeLoadAcceleration,
    brakeState,
    combinedBrakeState,
    preliminaryBrakeForce: preliminaryBrakeState.force,
    driveLoadAcceleration,
    preliminaryDrivenTractionLimit,
    preliminaryAppliedDriveForce,
    driveLoadSensitivityByWheel,
    driveForceShareByWheel,
    engineBrakeForceShareByWheel,
    engineBrakeForceByWheel,
    driveForceByWheel,
    chassisLongitudinalForceByWheel,
    combinedChassisLongitudinalForceByWheel,
    wheelLongitudinalUsage,
    wheelLateralUsage,
    wheelFrictionUsage,
    wheelRemainingLateralLimit,
    combinedLongitudinalForceScale,
    combinedSlipEfficiency: combinedLongitudinalEfficiency,
    combinedSlipAppliedForceN: combinedLongitudinalAppliedForce,
    combinedSlipForceLossN: combinedLongitudinalForceLoss,
    lateralAcceleration: aiLateralAcceleration,
    lateralContactScale: dynamicLateralContactScale,
    neutralLateralContactScale: lateralContactScale,
    engineBraking,
    tireSlipByWheel: aiTireSlipByWheel,
    contactWheelSpinRatioByWheel: aiContactWheelSpinRatioByWheel,
    freeWheelSpinRatioByWheel: aiFreeWheelSpinRatioByWheel,
    wheelContactScaleByWheel: aiWheelContactScaleByWheel,
    tireTemperature: { ...ai.tireTemperature },
    nextTireTemperature,
    tireTemperatureGrip,
    tirePressureDynamics: tirePressureDynamicsByWheel,
    perWheelGrip,
    tirePressureRollingMultiplier,
    resistanceForces,
    tireContactScale,
    drivenLoadScale,
    wheelContacts3d: wheelContacts3d || null
  };
  ai.tireTemperature = nextTireTemperature;
  ai.driveForceShareByWheel = driveForceShareByWheel;
  const nextAiSpeedMps = Math.max(0, speed + acceleration * dt);
  return {
    speedMps: throttle > RACE_PEDAL_INPUT.activeThreshold && acceleration > 0
      ? Math.min(nextAiSpeedMps, topSpeedLimitMps * 1.02)
      : nextAiSpeedMps,
    acceleration,
    braking,
    gripFactor,
    looseSurfaceFactor
  };
}

// Only failed, distant main-thread recoveries sleep. No accumulated physics
// debt: the car stays in place while waiting, and cannot gain race progress.
export function waitForRaceAiRecovery(editor, ai, seconds, car, tuning) {
  const wait = ai.recoveryWait;
  if (!wait || editor.vehicleDynamicsAuthority?.workerBridge) return false;
  const session = editor.playtestSession;
  const far = Math.hypot(ai.worldX - session.worldX, ai.worldZ - session.worldZ) > 120;
  if (!far) { ai.recoveryWait = null; return false; }
  wait.seconds -= seconds;
  if (wait.seconds <= 0) {
    const director = getRaceAiDirector(editor);
    if (director && director.recoveryAttemptsThisUpdate >= 1) return true;
    ai.recoveryRetryReason = wait.reason;
    recoverUpsideDownRaceAi(editor, ai, {car, tuning, seconds});
  }
  return true;
}

export function updateRaceAiDrivers(editor, seconds = 0, {
  preStartMode = 'none',
  rollingStartSpeedMps = 0
} = {}) {
  const session = editor.playtestSession;
  if (!session?.aiRuntime?.length) {
    if(session) assignRaceAiPhysicsBudget(session);
    return;
  }
  const dt = Math.max(0, Number(seconds) || 0);
  const routeLength = Math.max(1, Number(session.routeLength || editor.getRaceRouteLength()));
  const isCircuit = (session.routeRuntimeType || editor.getSelectedRaceRuntimeType()) === 'circuit';
  assignRaceAiPhysicsBudget(session, {worker:!!editor.vehicleDynamicsAuthority?.workerBridge, seconds:dt});
  if (preStartMode === 'standing' || preStartMode === 'rolling') {
    const stagedSpeedMps = preStartMode === 'rolling'
      ? Math.max(0, Number(rollingStartSpeedMps || 0))
      : 0;
    session.aiRuntime.forEach((ai) => {
      const car = ai.runtimeCar || editor.findRaceProjectCarById?.(ai.carId) || editor.project.cars.find((candidate) => candidate.id === ai.carId) || editor.selectedCar;
      const tuning = getRaceAiRuntimeTuning(editor, ai, car);
      ai.rpm = tuning.idleRpm;
      ai.engineDrive = {
        throttle: 0,
        brake: 0,
        driveForceN: 0,
        demandedForceN: 0,
        appliedRawForceN: 0,
        wheelSpinRatio: 0,
        tireSlipByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        contactWheelSpinRatioByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        wheelLongitudinalUsage: { fl: 0, fr: 0, rl: 0, rr: 0 },
        wheelLateralUsage: { fl: 0, fr: 0, rl: 0, rr: 0 },
        chassisLongitudinalForceByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        combinedChassisLongitudinalForceByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        combinedBrakeState: {
          force: 0,
          appliedByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 }
        }
      };
      const contactState = editor.getRaceAiContactState(ai, car, tuning);
      const yaw = Number(
        ai.vehicleRenderState?.yawRad ?? ai.vehicleDynamicsPresentationState?.yawRad
          ?? ai.vehicleDynamicsRunner?.state?.yawRad
          ?? contactState.pose?.yaw
          ?? 0
      );
      if ((ai.physicsBudgetDetail !== 'cheap' || (tuning.powertrainType === 'electric' || tuning.cvt))) restoreRaceAiDetailedPhysics(editor,ai);
      if ((ai.physicsBudgetDetail !== 'cheap' || (tuning.powertrainType === 'electric' || tuning.cvt)) || !ai.vehicleDynamicsRunner) editor.updateRaceAiVehiclePhysics(ai, {
        car,
        tuning,
        seconds: ai.physicsBudgetDetail === 'cheap' ? 0 : dt,
        contactState,
        targetVelocityWorld: {
          x: Math.sin(yaw) * stagedSpeedMps,
          y: 0,
          z: Math.cos(yaw) * stagedSpeedMps
        }
      });
      if (ai.physicsBudgetDetail === 'cheap') {
        ai.drivingPlan={steeringAngleRad:0,targetSpeedMps:stagedSpeedMps};
        if (!stagedSpeedMps || !advanceRaceAiDistantPhysics(editor,ai,{
          car,tuning,contactState,physics:{speedMps:stagedSpeedMps},seconds:dt
        })) holdRaceAiCheapPhysics(editor,ai,dt);
      }
      const projection = editor.getRaceRouteProjectionForWorldPoint({ x: ai.worldX, z: ai.worldZ,
        heightM: ai.vehicleDynamicsRunner?.state?.position?.y });
      if (stagedSpeedMps > 0) {
        const previousDistance = ((Number(ai.projectedDistance ?? ai.distance ?? 0) % routeLength) + routeLength) % routeLength;
        ai.distance = Number(projection.distance ?? ai.distance ?? 0);
        if (isCircuit && previousDistance > routeLength * 0.8 && ai.distance < routeLength * 0.2) {
          ai.awaitingStartLine = false;
        }
      }
      ai.projectedDistance = isCircuit
        ? ((ai.distance % routeLength) + routeLength) % routeLength
        : clamp(ai.distance, 0, routeLength);
    });
    return;
  }
  prepareRaceAiDirector(editor);
  session.cheapRecoveryAttempted=false;
  const frameDt = dt;
  const updateDriver = (ai, index) => {
    ai.currentLapMs += frameDt * 1000;
    const dt = consumeRaceAiSimulationStep(ai, session, frameDt, index, {
      worker: !!editor.vehicleDynamicsAuthority?.workerBridge
    });
    if (!dt) return;
    const car = ai.runtimeCar || editor.findRaceProjectCarById?.(ai.carId) || editor.project.cars.find((candidate) => candidate.id === ai.carId) || editor.selectedCar;
    const tuning = getRaceAiRuntimeTuning(editor, ai, car);
    if (!shouldRetryRaceAiCheap(ai,dt)) {
      holdRaceAiCheapPhysics(editor,ai,dt);return;
    }
    if(ai.physicsBudgetDetail==='cheap' && ai.cheapPhysicsHeld)
      tryRecoverRaceAiCheap(editor,ai,{car,tuning});
    if ((ai.physicsBudgetDetail !== 'cheap' || (tuning.powertrainType === 'electric' || tuning.cvt)) && waitForRaceAiRecovery(editor, ai, dt, car, tuning)) return;
    const profile = editor.getRaceAiDifficultyProfile(ai.difficulty);
    const roadSafety = getRaceAiRoadSafety(editor, ai, tuning);
    const wakeState = ai.vehicleRenderState?.aeroState?.wake
      || ai.vehicleDynamicsPresentationState?.aeroState?.wake
      || ai.vehicleDynamicsRunner?.state?.aeroState?.wake || {};
    const preliminaryAeroAwareness = getRaceAiAeroAwareness(wakeState, {
      speedMps: ai.speedMps,
      index
    });
    const overtakeOffset = preliminaryAeroAwareness.overtakeOffset;
    const surfacePlanRefreshed = shouldRefreshRaceAiSurfacePlan(ai, session, dt, index);
    if (surfacePlanRefreshed) {
      ai.surfacePlanUpdates = (ai.surfacePlanUpdates || 0) + 1;
      let lineDecision = editor.raceSimulationSystems.surface.evaluateTrackStateAiCandidates({
        trackState: session.trackState,
        observationCache: getRaceAiSurfaceObservationCache(session),
        distance: Number(ai.projectedDistance ?? ai.distance ?? 0),
        currentOffset: Number(ai.trackStateTargetLineOffset ?? ai.lineOffset ?? 0),
        candidateOffsets: [-0.68, -0.34, 0, 0.34, 0.68],
        lookaheadDistances: [10, 22, 38, 56],
        nextSwitchStep: Number(ai.trackStateNextLineSwitchStep || 0),
        hysteresis: 0.025,
        switchCooldownSteps: 12,
        getWorldPoint: createRaceAiSurfaceProbe(editor, session, routeLength)
      });
      if(getRaceAiRoadPlan(editor)?.racingLine)lineDecision=preferRaceAiRacingLine(lineDecision);
      ai.trackStateTargetLineOffset = clamp(lineDecision.chosenOffset + overtakeOffset, -0.78, 0.78);
      ai.trackStateNextLineSwitchStep = lineDecision.nextSwitchStep;
      ai.trackStateLineDecision = lineDecision;
      ai.trackStateLastObservationStep = session.trackState.stepIndex;
    }
    if (session.trackState || getRaceAiRoadPlan(editor)?.racingLine) {
      const targetOffset = session.trackState ? Number(ai.trackStateTargetLineOffset ?? ai.lineOffset ?? 0) : overtakeOffset;
      const currentOffset = Number(ai.lineOffset || 0);
      const maxOffsetChange = Math.max(0, dt) * 0.42;
      ai.lineOffset = currentOffset + clamp(
        targetOffset - currentOffset,
        -maxOffsetChange,
        maxOffsetChange
      );
    }
    // Diagnostic experiment: ask drivers to stay centered without changing
    // their physical pose, collision handling, or recovery behavior.
    ai.lineOffset = clamp(Number(ai.lineOffset || 0), -roadSafety.maxLineOffset, roadSafety.maxLineOffset);
    if(session.debugAiCenterSlow)ai.lineOffset=0;
    const contactState = editor.getRaceAiContactState(ai, car, tuning);
    // Initialize state without running fixed physics for the cheap fleet.
    if (ai.physicsBudgetDetail === 'cheap' && !ai.vehicleDynamicsRunner)
      editor.updateRaceAiVehiclePhysics(ai, {car,tuning,seconds:0,contactState});
    const terrainRollRad = Number(contactState.contacts?.terrainRollRad || 0);
    const bankAssist = clamp(Math.abs(terrainRollRad) * 0.75, 0, 0.28);
    const gripScale = clamp(Number(contactState.averageSurfaceGrip || 1), 0.28, 1.12);
    const predictiveGripScale = session.trackState
      ? Math.min(gripScale, clamp(Number(ai.trackStateLineDecision?.gripScale || gripScale), 0.18, 1.12))
      : gripScale;
    const predictiveSurfaceRisk = session.trackState
      ? clamp(Number(ai.trackStateLineDecision?.risk || 0), 0, 1)
      : 0;
    const setupModifiers = editor.getRaceSetupPhysicsModifiers(tuning, Number(ai.speedMps || 0));
    const topSpeedLimitMps = editor.getRaceRuntimeTopSpeedLimitMps(car, tuning, {
      setupModifiers,
      terrainResistance: 1 + editor.getRaceLooseSurfaceFactor(contactState.contacts) * 0.32,
      gripFactor: gripScale,
      looseSurfaceFactor: editor.getRaceLooseSurfaceFactor(contactState.contacts)
    });
    const severity = editor.getRaceAiLookaheadSeverity(ai.projectedDistance || ai.distance || 0, ai.speedMps || 0) * (1 - bankAssist);
    ai.aeroAwareness = getRaceAiAeroAwareness(wakeState, { severity, speedMps: ai.speedMps, index });
    const { draftOpportunity, dirtyAirCornerPenalty, dirtyAirBrakingPenalty, crosswindRisk } = ai.aeroAwareness;
    const variance = Math.sin((Number(session.elapsedMs || 0) / 1000) * (0.45 + index * 0.04) + index) * profile.variance;
    const paceTargetMps = Math.max(
      0,
      topSpeedLimitMps
        * profile.pace
        * Math.sqrt(predictiveGripScale)
        * (1 - predictiveSurfaceRisk * 0.34)
        * (getRaceAiRoadPlan(editor)?.racingLine ? 1 : (1 - clamp(severity * (0.48 - profile.corner * 0.16), 0, 0.66)))
        * (1 + draftOpportunity * 0.18)
        * (1 - dirtyAirCornerPenalty * 0.32 - dirtyAirBrakingPenalty * 0.12 - crosswindRisk * 0.08)
        * (1 + variance)
    );
    ai.drivingPlan = planRaceAiDriving(editor, ai, tuning, {
      grip: predictiveGripScale, profile, roadSafety, seconds: dt, scheduleIndex: index, surfacePlanRefreshed, topSpeedMps: session.debugAiCenterSlow ? Math.min(8,paceTargetMps) : paceTargetMps
    });
    const targetMps = ai.drivingPlan.targetSpeedMps;
    const previousSpeedMps = Number(ai.speedMps || 0);
    const previousProjectedDistance = Number(ai.projectedDistance ?? ai.distance ?? 0);
    const detailedControlsOnly = (tuning.powertrainType === 'electric' || tuning.cvt) || (!editor.vehicleDynamicsAuthority?.workerBridge
      && ai.physicsBudgetDetail !== 'cheap'
      && (ai.physicsBudgetDetail === 'full' || !canUseRaceAiDistantPhysics(editor,ai,contactState,dt)));
    let aiPhysics;
    if (detailedControlsOnly) {
      const controls=planRaceAiControls(editor,ai,tuning,targetMps,profile);
      ai.gear=controls.gear;ai.rpm=controls.rpm;ai.engineDrive=controls;
      ai.distantContactState=null;
      aiPhysics={
        gripFactor:Math.max(.35,Math.min(1.4,tuning.tireGrip))
          * clamp(Number(contactState.averageSurfaceGrip||1),.22,1.2)
          * (session.trackState?1:editor.getRaceWeatherGripMultiplier(editor.getRaceWeatherState(editor.selectedRace,session)))
          * setupModifiers.grip,
        looseSurfaceFactor:editor.getRaceLooseSurfaceFactor(contactState.contacts)
      };
    } else if (!editor.vehicleDynamicsAuthority?.workerBridge && (tuning.powertrainType !== 'electric' && !tuning.cvt) && useRaceAiRemotePowertrain(ai,session,tuning)) {
      aiPhysics=stepRaceAiRemotePowertrain(editor,ai,{car,tuning,targetMps,profile,contactState,seconds:dt});
    } else {
      aiPhysics=editor.getRaceAiLongitudinalPhysicsStep(ai,{
        car,tuning,targetMps,profile,contactState,seconds:dt
      });
    }
    if (detailedControlsOnly || !advanceRaceAiDistantPhysics(editor, ai, {
      car, tuning, contactState, physics: aiPhysics, seconds: dt
    })) {
      if (ai.physicsBudgetDetail === 'cheap' && (tuning.powertrainType !== 'electric' && !tuning.cvt)) {
        holdRaceAiCheapPhysics(editor,ai,dt);
      } else {
      restoreRaceAiDetailedPhysics(editor, ai);
      editor.updateRaceAiVehiclePhysics(ai, {
        car, tuning, seconds: dt, previousSpeedMps, contactState
      });
      if(!editor.vehicleDynamicsAuthority?.workerBridge) syncRaceAiPhysicalTireEffects(ai);
      }
    }
    const physicalProjection = editor.getRaceRouteProjectionForWorldPoint({
      x: Number(ai.worldX || 0),
      z: Number(ai.worldZ || 0),
      heightM: ai.vehicleDynamicsRunner?.state?.position?.y
    });
    ai.distance = Number(physicalProjection.distance ?? ai.distance ?? 0);
    if (isCircuit) {
      if (previousProjectedDistance > routeLength * 0.8
        && ai.distance < routeLength * 0.2
        && Number(ai.speedMps || 0) > 0) {
        if (ai.awaitingStartLine) {
          ai.awaitingStartLine = false;
        } else {
          ai.lap += 1;
          if (!ai.bestLapMs || ai.currentLapMs < ai.bestLapMs) ai.bestLapMs = ai.currentLapMs;
        }
        ai.currentLapMs = 0;
      }
      ai.projectedDistance = ((ai.distance % routeLength) + routeLength) % routeLength;
    } else {
      ai.distance = Math.min(ai.distance, routeLength);
      ai.projectedDistance = clamp(ai.distance, 0, routeLength);
    }
    if (session.trackState) {
      const aiSurfaceSession = {
        ...contactState.session,
        worldX: Number(ai.worldX ?? contactState.session.worldX ?? 0),
        worldZ: Number(ai.worldZ ?? contactState.session.worldZ ?? 0),
        carYaw: Number(ai.carYaw ?? contactState.session.carYaw ?? 0),
        speedMps: Number(ai.speedMps || 0),
        vehicle3d: ai.vehicle3d,
        routeRuntimeType: session.routeRuntimeType,
        trackState: session.trackState
      };
      const wheelSurfaceState = editor.getRaceWheelSurfaceState({
        car,
        tuning,
        session: aiSurfaceSession,
        sampledContacts: ai.distantContactState || null,
        damage: ai.damage || {}
      });
      editor.raceSimulationSystems.surface.queueTrackStateTireEvents(session.trackState, {
        // The driver never uses accepted-event receipts. Skip their arrays and
        // records while preserving the same wheel order and physical events.
        collectAcceptedEvents: false,
        wheelIds: RACE_WHEEL_IDS,
        vehicleId: ai.id || ai.carId || `ai-${index}`,
        normalLoads: ai.engineDrive?.dynamicNormalLoads || {},
        tireSlipByWheel: ai.engineDrive?.tireSlipByWheel || {},
        wheelContactScaleByWheel: ai.engineDrive?.wheelContactScaleByWheel || {},
        wheelSurfaceState,
        previousPositions: ai.trackStatePreviousWheelPositions || {},
        speedMps: Math.abs(Number(ai.speedMps || 0)),
        tireCompoundByWheel: editor.getRaceCarSetup(car).tireCompoundByWheel,
        tireTemperatures: ai.tireTemperature || {},
        brakeState: ai.engineDrive?.combinedBrakeState || ai.engineDrive?.brakeState || {},
        wheelSpinByWheel: ai.engineDrive?.contactWheelSpinRatioByWheel || {},
        contactDurationSeconds: dt,
        direction: editor.getRaceForwardVector(Number(ai.carYaw || 0))
      });
      ai.trackStatePreviousWheelPositions = Object.fromEntries(
        Object.entries(wheelSurfaceState.positions || {}).map(([wheelId, position]) => [
          wheelId,
          { x: Number(position.x || 0), z: Number(position.z || 0) }
        ])
      );
    }
    ai.consistencyError = variance + severity * (1 - profile.corner) * 0.2;
    ai.averageSurfaceGrip = Number(aiPhysics.gripFactor || contactState.averageSurfaceGrip || 1);
    ai.looseSurfaceFactor = Number(aiPhysics.looseSurfaceFactor || 0);
  };
  const capture=editor.racePerformanceCapture;
  session.aiRuntime.forEach((ai,index)=>{
    if(capture?.active && capture.detailed) capture.timeAiDriver(ai,index,()=>updateDriver(ai,index));
    else updateDriver(ai,index);
  });
}
