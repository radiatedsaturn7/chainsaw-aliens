import { RACE_WHEEL_IDS } from './SimulationMath.js';
import { hashTrackStateValue, stableTrackStateStringify } from '../trackState/TrackStateMath.js';

export const PHYSICS_INCIDENT_FIXTURE_VERSION = 1;

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const q = (value, precision = 6) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(precision)) : null;
};
const vectorArray = (value) => value ? [q(value.x), q(value.y), q(value.z)] : null;
const vectorObject = (value) => value ? { x: value[0], y: value[1], z: value[2] } : null;
const FRAME = Object.freeze({
  step: 0, substep: 1, time: 2, previousPosition: 3, state: 4, controls: 5,
  routeDistance: 6, worldPosition: 7, wheels: 8, terrain: 9, bodySupport: 10,
  body: 11, triangleIds: 12, recovery: 13, recoveryState: 14, triggers: 15
});

function stateChecksum(state = {}) {
  return hashTrackStateValue(stableTrackStateStringify(state));
}

function createSweptBounds(frames = [], paddingM = 3) {
  const positions = frames.flatMap((packed) => {
    const frame = unpackPhysicsIncidentFrame(packed);
    return [
    frame.state?.position,
    frame.previousPosition,
    ...Object.values(frame.wheels || {}).map((wheel) => wheel.contactPatch?.contactPointWorld)
    ];
  }).filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z)));
  if (!positions.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  return {
    minX: q(Math.min(...positions.map((point) => Number(point.x))) - paddingM),
    maxX: q(Math.max(...positions.map((point) => Number(point.x))) + paddingM),
    minZ: q(Math.min(...positions.map((point) => Number(point.z))) - paddingM),
    maxZ: q(Math.max(...positions.map((point) => Number(point.z))) + paddingM)
  };
}

const KINEMATIC_KEYS = Object.freeze([
  'wheelCenterWorld', 'hubPositionWorld', 'suspensionMountPositionWorld',
  'contactPointWorld', 'contactVelocityWorld', 'wheelForwardWorld', 'wheelLateralWorld',
  'surfaceNormalWorld', 'surfaceTangentForwardWorld', 'surfaceTangentLateralWorld'
]);
const KINEMATIC_SCALARS = Object.freeze([
  'longitudinalVelocityMps', 'lateralVelocityMps', 'slipRatio', 'slipAngleRad',
  'camberAngleRad', 'normalLoadN', 'wheelAngularVelocityRadps',
  'effectiveRollingRadiusM', 'supportAlignment'
]);
const SUSPENSION_VECTOR_KEYS = Object.freeze([
  'suspensionAxisLocal', 'suspensionAxisWorld', 'hubPositionWorld', 'hubVelocityWorld',
  'suspensionMountPositionWorld', 'suspensionMountVelocityWorld'
]);
const SUSPENSION_SCALARS = Object.freeze([
  'requestedCompressionM', 'suspensionTravelM', 'compressionM', 'compressionRatio',
  'compressionVelocityMps', 'unsprungVelocityMps', 'restLengthM', 'droopTravelM',
  'bumpTravelM', 'staticSagTargetM', 'bumpStopClearanceM', 'springForceN',
  'springRateNpm', 'damperRateNsM', 'damperVelocityMps', 'damperForceN',
  'antiRollLoadTransferN', 'unsprungMassKg', 'tireVerticalStiffnessNpm', 'bumpStopForceN',
  'rawRequestedCompressionM', 'clampedCompressionM', 'overtravelM',
  'remainingBumpTravelM', 'hardStopForceN', 'tireVerticalDeflectionM',
  'contactSolveIterationCount'
]);

function packNamedVectorsAndScalars(value, vectorKeys, scalarKeys) {
  return [
    ...vectorKeys.map((key) => vectorArray(value?.[key])),
    ...scalarKeys.map((key) => q(value?.[key]))
  ];
}

function unpackNamedVectorsAndScalars(value, vectorKeys, scalarKeys) {
  return Object.fromEntries([
    ...vectorKeys.map((key, index) => [key, vectorObject(value?.[index])]),
    ...scalarKeys.map((key, index) => [key, value?.[vectorKeys.length + index] ?? null])
  ]);
}

function packTerrainSample(sample = {}) {
  return [
    sample.kind || null, sample.wheelId || null, sample.offsetIndex ?? null,
    vectorArray(sample.point),
    [sample.physics?.valid === false ? null : q(sample.physics?.heightM),
      vectorArray(sample.physics?.normal), sample.physics?.region || null,
      sample.physics?.surfaceId || null, q(sample.physics?.friction),
      sample.physics?.valid === false ? 0 : 1,
      sample.physics?.triangleId ?? null, sample.physics?.source || null,
      sample.physics?.reason || null],
    [sample.prepared?.triangleId ?? null, q(sample.prepared?.heightM),
      vectorArray(sample.prepared?.normal), sample.prepared?.source || null],
    [q(sample.analytical?.heightM), vectorArray(sample.analytical?.normal)],
    sample.projection ? [q(sample.projection.distance), q(sample.projection.lateral), q(sample.projection.yaw)] : null
  ];
}

function unpackTerrainSample(sample = []) {
  return {
    kind: sample[0], wheelId: sample[1], offsetIndex: sample[2], point: vectorObject(sample[3]),
    physics: { heightM: sample[4]?.[0], normal: vectorObject(sample[4]?.[1]),
      region: sample[4]?.[2], surfaceId: sample[4]?.[3], friction: sample[4]?.[4],
      valid: sample[4]?.[5] === undefined ? Number.isFinite(Number(sample[4]?.[0])) : sample[4]?.[5] === 1,
      triangleId: sample[4]?.[6] ?? null, source: sample[4]?.[7] || null,
      reason: sample[4]?.[8] || null },
    prepared: { triangleId: sample[5]?.[0], heightM: sample[5]?.[1],
      normal: vectorObject(sample[5]?.[2]), source: sample[5]?.[3] },
    analytical: { heightM: sample[6]?.[0], normal: vectorObject(sample[6]?.[1]) },
    projection: sample[7] ? { distance: sample[7][0], lateral: sample[7][1], yaw: sample[7][2] } : null
  };
}

function packPhysicsIncidentFrame(frame) {
  return [
    frame.stepIndex, frame.substepIndex, frame.timeSeconds, vectorArray(frame.previousPosition),
    frame.state, frame.controls, frame.routeDistanceM, vectorArray(frame.worldPosition),
    RACE_WHEEL_IDS.map((wheelId) => {
      const wheel = frame.wheels[wheelId];
      return [
        packNamedVectorsAndScalars(wheel.kinematics, KINEMATIC_KEYS, KINEMATIC_SCALARS),
        wheel.requestedCompressionM, wheel.actualCompressionM, wheel.suspensionTravelM,
        packNamedVectorsAndScalars(wheel.suspension, SUSPENSION_VECTOR_KEYS, SUSPENSION_SCALARS),
        wheel.validTreadContact ? 1 : 0, wheel.invalidContactReason
      ];
    }),
    frame.terrainSamples.map(packTerrainSample),
    frame.bodySupportPoints.map((point) => [point.id, point.pieceId, point.wheelId,
      point.contactType, vectorArray(point.worldPoint)]),
    {
      contacts: frame.body.contacts.map((contact) => [
        contact.id || null, contact.pieceId || null, contact.wheelId || null,
        contact.contactType || 'body', vectorArray(contact.pointWorld), vectorArray(contact.normal),
        q(contact.penetrationM), q(contact.normalImpulseNs), q(contact.tangentialImpulseNs)
      ]),
      maximumPenetrationM: frame.body.maximumPenetrationM,
      positionalCorrectionWorldM: vectorArray(frame.body.positionalCorrectionWorldM),
      surfaceConsistency: frame.body.surfaceConsistency
    },
    frame.preparedTriangleIds, frame.recovery, frame.recoveryState, frame.triggers
  ];
}

export function unpackPhysicsIncidentFrame(packed = [], terrainSampleTable = null) {
  const wheels = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId, index) => {
    const wheel = packed[FRAME.wheels]?.[index] || [];
    return [wheelId, {
      kinematics: unpackNamedVectorsAndScalars(wheel[0], KINEMATIC_KEYS, KINEMATIC_SCALARS),
      contactPatch: unpackNamedVectorsAndScalars(wheel[0], KINEMATIC_KEYS, KINEMATIC_SCALARS),
      requestedCompressionM: wheel[1], actualCompressionM: wheel[2], suspensionTravelM: wheel[3],
      suspension: unpackNamedVectorsAndScalars(wheel[4], SUSPENSION_VECTOR_KEYS, SUSPENSION_SCALARS),
      validTreadContact: wheel[5] === 1, invalidContactReason: wheel[6] || null
    }];
  }));
  const body = packed[FRAME.body] || {};
  return {
    stepIndex: packed[FRAME.step], substepIndex: packed[FRAME.substep],
    timeSeconds: packed[FRAME.time], previousPosition: vectorObject(packed[FRAME.previousPosition]),
    state: packed[FRAME.state] || {}, controls: packed[FRAME.controls] || {},
    routeDistanceM: packed[FRAME.routeDistance], worldPosition: vectorObject(packed[FRAME.worldPosition]),
    wheels,
    terrainSamples: (packed[FRAME.terrain] || []).map((sample) => (
      unpackTerrainSample(typeof sample === 'number' ? terrainSampleTable?.[sample] : sample)
    )),
    bodySupportPoints: (packed[FRAME.bodySupport] || []).map((point) => ({
      id: point[0], pieceId: point[1], wheelId: point[2], contactType: point[3],
      worldPoint: vectorObject(point[4])
    })),
    body: {
      contacts: (body.contacts || []).map((contact) => ({
        id: contact[0], pieceId: contact[1], wheelId: contact[2], contactType: contact[3],
        pointWorld: vectorObject(contact[4]), normal: vectorObject(contact[5]), penetrationM: contact[6],
        normalImpulseNs: contact[7], tangentialImpulseNs: contact[8]
      })),
      maximumPenetrationM: body.maximumPenetrationM,
      positionalCorrectionWorldM: vectorObject(body.positionalCorrectionWorldM),
      surfaceConsistency: body.surfaceConsistency || {}
    },
    preparedTriangleIds: packed[FRAME.triangleIds] || [], recovery: packed[FRAME.recovery],
    recoveryState: packed[FRAME.recoveryState], triggers: packed[FRAME.triggers] || []
  };
}

function compactWheelFrame(tireResult = {}) {
  return Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const suspension = tireResult.suspensionState?.[wheelId] || {};
    const patch = tireResult.contactPatches?.[wheelId] || {};
    return [wheelId, {
      kinematics: clone({
        wheelCenterWorld: patch.wheelCenterWorld,
        hubPositionWorld: patch.hubPositionWorld,
        suspensionMountPositionWorld: patch.suspensionMountPositionWorld,
        contactPointWorld: patch.contactPointWorld,
        contactVelocityWorld: patch.contactVelocityWorld,
        wheelForwardWorld: patch.wheelForwardWorld,
        wheelLateralWorld: patch.wheelLateralWorld,
        surfaceNormalWorld: patch.surfaceNormalWorld,
        surfaceTangentForwardWorld: patch.surfaceTangentForwardWorld,
        surfaceTangentLateralWorld: patch.surfaceTangentLateralWorld,
        longitudinalVelocityMps: patch.longitudinalVelocityMps,
        lateralVelocityMps: patch.lateralVelocityMps,
        slipRatio: patch.slipRatio,
        slipAngleRad: patch.slipAngleRad,
        camberAngleRad: patch.camberAngleRad,
        normalLoadN: patch.normalLoadN,
        wheelAngularVelocityRadps: patch.wheelAngularVelocityRadps,
        effectiveRollingRadiusM: patch.effectiveRollingRadiusM,
        supportAlignment: patch.supportAlignment
      }),
      requestedCompressionM: q(suspension.requestedCompressionM),
      actualCompressionM: q(suspension.compressionM),
      suspensionTravelM: q(suspension.suspensionTravelM),
      suspension: compactSuspension(suspension),
      validTreadContact: suspension.validTreadContact === true,
      invalidContactReason: suspension.invalidContactReason || null
    }];
  }));
}

function compactSuspension(suspension = {}) {
  return clone({
    requestedCompressionM: suspension.requestedCompressionM,
    suspensionTravelM: suspension.suspensionTravelM,
    compressionM: suspension.compressionM,
    compressionRatio: suspension.compressionRatio,
    compressionVelocityMps: suspension.compressionVelocityMps,
    unsprungVelocityMps: suspension.unsprungVelocityMps,
    suspensionAxisLocal: suspension.suspensionAxisLocal,
    suspensionAxisWorld: suspension.suspensionAxisWorld,
    restLengthM: suspension.restLengthM,
    droopTravelM: suspension.droopTravelM,
    bumpTravelM: suspension.bumpTravelM,
    staticSagTargetM: suspension.staticSagTargetM,
    bumpStopClearanceM: suspension.bumpStopClearanceM,
    hubPositionWorld: suspension.hubPositionWorld,
    hubVelocityWorld: suspension.hubVelocityWorld,
    suspensionMountPositionWorld: suspension.suspensionMountPositionWorld,
    suspensionMountVelocityWorld: suspension.suspensionMountVelocityWorld,
    springForceN: suspension.springForceN,
    springRateNpm: suspension.springRateNpm,
    damperRateNsM: suspension.damperRateNsM,
    damperVelocityMps: suspension.damperVelocityMps,
    damperForceN: suspension.damperForceN,
    antiRollLoadTransferN: suspension.antiRollLoadTransferN,
    unsprungMassKg: suspension.unsprungMassKg,
    tireVerticalStiffnessNpm: suspension.tireVerticalStiffnessNpm,
    bumpStopForceN: suspension.bumpStopForceN,
    rawRequestedCompressionM: suspension.rawRequestedCompressionM,
    clampedCompressionM: suspension.clampedCompressionM,
    overtravelM: suspension.overtravelM,
    remainingBumpTravelM: suspension.remainingBumpTravelM,
    hardStopForceN: suspension.hardStopForceN,
    tireVerticalDeflectionM: suspension.tireVerticalDeflectionM,
    contactSolveIterationCount: suspension.contactSolveIterationCount,
    bottomedOut: suspension.bottomedOut,
    terrainSampleValid: suspension.terrainSampleValid,
    terrainTriangleId: suspension.terrainTriangleId,
    terrainSampleSource: suspension.terrainSampleSource,
    terrainSampleReason: suspension.terrainSampleReason,
    contactState: suspension.contactState,
    geometricContact: suspension.geometricContact,
    geometricTerrainProximity: suspension.geometricTerrainProximity,
    validTreadContact: suspension.validTreadContact,
    invalidContactReason: suspension.invalidContactReason
  });
}

function compactAuthoritativeState(state = {}) {
  const tireState = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const tire = state.tireState?.[wheelId] || {};
    return [wheelId, {
      treadTemperatureC: tire.treadTemperatureC,
      carcassTemperatureC: tire.carcassTemperatureC,
      internalAirTemperatureC: tire.internalAirTemperatureC,
      temperatureF: tire.temperatureF,
      coldPressurePsi: tire.coldPressurePsi,
      pressureReferenceTemperatureC: tire.pressureReferenceTemperatureC,
      effectivePressurePsi: tire.effectivePressurePsi,
      longitudinalFrictionWorkJ: tire.longitudinalFrictionWorkJ,
      lateralFrictionWorkJ: tire.lateralFrictionWorkJ,
      frictionHeatingWorkJ: tire.frictionHeatingWorkJ,
      carcassFlexHeatingWorkJ: tire.carcassFlexHeatingWorkJ,
      loadHeatingWorkJ: tire.loadHeatingWorkJ,
      surfaceConductionWorkJ: tire.surfaceConductionWorkJ,
      waterCoolingWorkJ: tire.waterCoolingWorkJ,
      ambientCoolingWorkJ: tire.ambientCoolingWorkJ,
      wear: tire.wear,
      damage: tire.damage
    }];
  }));
  return clone({
    position: state.position,
    previousPosition: state.previousPosition,
    orientation: state.orientation,
    velocity: state.velocity,
    angularVelocityWorld: state.angularVelocityWorld,
    yawRad: state.yawRad,
    pitchRad: state.pitchRad,
    rollRad: state.rollRad,
    yawRateRadps: state.yawRateRadps,
    groundSpeedMps: state.groundSpeedMps,
    bodyLongitudinalSpeedMps: state.bodyLongitudinalSpeedMps,
    bodyLateralSpeedMps: state.bodyLateralSpeedMps,
    signedTravelSpeedMps: state.signedTravelSpeedMps,
    wheelAngularVelocityRadps: state.wheelAngularVelocityRadps,
    wheelRotationRad: state.wheelRotationRad,
    // Suspension is recorded once in `frame.wheels`; retaining it again here
    // more than doubles a five-second incident without adding replay state.
    suspensionTravel: state.suspensionTravel,
    tireState,
    powertrainState: state.powertrainState,
    engineRpm: state.engineRpm,
    gear: state.gear,
    handbrakeCommandState: state.handbrakeCommandState,
    grounded: state.grounded,
    wheelGrounded: state.wheelGrounded,
    bodyGrounded: state.bodyGrounded,
    supportedWheelCount: state.supportedWheelCount,
    validTreadContactByWheel: state.validTreadContactByWheel,
    invalidContactReasonByWheel: state.invalidContactReasonByWheel,
    penetrationRecovery: state.penetrationRecovery ? {
      reason: state.penetrationRecovery.reason,
      source: state.penetrationRecovery.sourceKey || state.penetrationRecovery.source,
      penetrationIncidentId: state.penetrationRecovery.penetrationIncidentId,
      recoveryMode: state.penetrationRecovery.recoveryMode,
      hardFailure: state.penetrationRecovery.hardFailure,
      sequence: state.penetrationRecovery.sequence,
      stepIndex: state.penetrationRecovery.stepIndex,
      restoredStepIndex: state.penetrationRecovery.restoredStepIndex,
      position: state.penetrationRecovery.position
    } : null
  });
}

function incidentReasons(frame, previousFrame, recoveryRegions, toleranceM) {
  const reasons = [];
  RACE_WHEEL_IDS.forEach((wheelId) => {
    const wheel = frame.wheels?.[wheelId] || {};
    const previous = previousFrame?.wheels?.[wheelId] || {};
    if (wheel.invalidContactReason === 'outside-suspension-reach'
      && previous.invalidContactReason !== 'outside-suspension-reach') {
      reasons.push({ type: 'outside-suspension-reach', wheelId });
    }
    if (Number(wheel.requestedCompressionM) > Number(wheel.suspensionTravelM) + 1e-6) {
      reasons.push({
        type: 'requested-compression-exceeds-travel', wheelId,
        requestedCompressionM: wheel.requestedCompressionM,
        suspensionTravelM: wheel.suspensionTravelM
      });
    }
  });
  if (Number(frame.body?.maximumPenetrationM || 0) > toleranceM + 1e-6) {
    reasons.push({
      type: 'body-penetration',
      penetrationM: q(frame.body.maximumPenetrationM),
      toleranceM: q(toleranceM)
    });
  }
  if (frame.recovery) {
    reasons.push({ type: 'emergency-recovery',
      source: frame.recovery.sourceKey || frame.recovery.source || null,
      penetrationIncidentId: frame.recovery.penetrationIncidentId || null,
      reason: frame.recovery.reason || null });
    const position = frame.state?.position || {};
    const region = frame.recovery.penetrationIncidentId
      || `${Math.round(Number(position.x || 0) / 2)}:${Math.round(Number(position.z || 0) / 2)}`;
    const count = (recoveryRegions.get(region) || 0) + 1;
    recoveryRegions.set(region, count);
    if (count >= 2) reasons.push({ type: 'repeated-recovery-region', region, count });
  }
  return reasons;
}

export class PhysicsIncidentRecorder {
  constructor({
    tireHz = 360,
    preIncidentSeconds = 2,
    postIncidentSeconds = 3,
    enabled = true,
    sourceDocumentChecksum = null,
    vehicleConfiguration = null,
    triangleProvider = null
  } = {}) {
    this.tireHz = Math.max(1, Math.trunc(Number(tireHz) || 360));
    this.preIncidentSubsteps = Math.max(1, Math.ceil(preIncidentSeconds * this.tireHz));
    this.postIncidentSubsteps = Math.max(1, Math.ceil(postIncidentSeconds * this.tireHz));
    this.enabled = enabled !== false;
    this.sourceDocumentChecksum = sourceDocumentChecksum;
    this.vehicleConfiguration = clone(vehicleConfiguration);
    this.triangleProvider = typeof triangleProvider === 'function' ? triangleProvider : null;
    this.ring = [];
    this.active = null;
    this.completed = [];
    this.previousFrame = null;
    this.recoveryRegions = new Map();
    this.sequence = 0;
    this.cooldownRemainingSubsteps = 0;
  }

  configureMetadata({ sourceDocumentChecksum, vehicleConfiguration, triangleProvider } = {}) {
    if (sourceDocumentChecksum !== undefined) this.sourceDocumentChecksum = sourceDocumentChecksum;
    if (vehicleConfiguration !== undefined) this.vehicleConfiguration = clone(vehicleConfiguration);
    if (typeof triangleProvider === 'function') this.triangleProvider = triangleProvider;
  }

  createFrame({
    state, controls, tireResult, bodyResult, environment, stepIndex, substepIndex,
    timeSeconds, previousPosition = null, recovery = null, toleranceM = 0.008
  } = {}) {
    const diagnostics = environment?.physicsIncidentDiagnostics || {};
    const frame = {
      stepIndex: Math.max(0, Math.trunc(Number(stepIndex) || 0)),
      substepIndex: Math.max(0, Math.trunc(Number(substepIndex) || 0)),
      timeSeconds: q(timeSeconds, 12),
      previousPosition: clone(previousPosition),
      state: compactAuthoritativeState(state),
      controls: clone(controls),
      routeDistanceM: q(diagnostics.routeDistanceM ?? state?.routeDistance),
      worldPosition: clone(state?.position),
      wheels: compactWheelFrame(tireResult),
      terrainSamples: clone(diagnostics.terrainSamples || []),
      bodySupportPoints: clone(bodyResult?.supportPoints || diagnostics.bodySupportPoints || []),
      body: {
        contacts: clone(bodyResult?.contacts || []),
        maximumPenetrationM: q(bodyResult?.maximumPenetrationAfterSolveM
          ?? bodyResult?.residualPenetrationM ?? bodyResult?.maximumPenetrationM ?? 0),
        positionalCorrectionWorldM: clone(bodyResult?.positionalCorrectionWorldM || {}),
        surfaceConsistency: clone(bodyResult?.surfaceConsistency || {})
      },
      preparedTriangleIds: [...new Set((diagnostics.terrainSamples || [])
        .map((sample) => sample?.prepared?.triangleId ?? sample?.triangleId)
        .filter((value) => value !== null && value !== undefined))]
        .sort((left, right) => String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0),
      recovery: clone(recovery || bodyResult?.emergencyRecovery || null),
      recoveryState: diagnostics.recoveryState ? clone({
        previousMaximumPenetrationM: diagnostics.recoveryState.previousMaximumPenetrationM,
        failedProgressSteps: diagnostics.recoveryState.failedProgressSteps,
        progressIncidentId: diagnostics.recoveryState.progressIncidentId,
        currentIncident: diagnostics.recoveryState.currentIncident,
        sequence: diagnostics.recoveryState.sequence,
        latest: diagnostics.recoveryState.history?.at(-1) || null
      }) : null
    };
    frame.triggers = incidentReasons(frame, this.previousFrame, this.recoveryRegions, toleranceM);
    return frame;
  }

  recordSubstep(payload = {}) {
    if (!this.enabled) return null;
    const frame = this.createFrame(payload);
    const packedFrame = packPhysicsIncidentFrame(frame);
    if (this.cooldownRemainingSubsteps > 0) this.cooldownRemainingSubsteps -= 1;
    if (!this.active && this.cooldownRemainingSubsteps === 0 && frame.triggers.length) {
      this.active = {
        sequence: ++this.sequence,
        reasons: clone(frame.triggers),
        triggerStepIndex: frame.stepIndex,
        triggerSubstepIndex: frame.substepIndex,
        frames: [...this.ring],
        remainingPostSubsteps: this.postIncidentSubsteps
      };
    } else if (this.active && frame.triggers.length) {
      frame.triggers.forEach((reason) => {
        const key = `${reason.type}:${reason.wheelId || ''}:${reason.region || ''}:${reason.source || ''}`;
        if (!this.active.reasons.some((entry) => (
          `${entry.type}:${entry.wheelId || ''}:${entry.region || ''}:${entry.source || ''}` === key
        ))) {
          this.active.reasons.push(clone(reason));
        }
      });
    }
    if (this.active) {
      this.active.frames.push(packedFrame);
      this.active.remainingPostSubsteps -= 1;
      if (this.active.remainingPostSubsteps <= 0) this.finalizeActiveIncident();
    }
    this.ring.push(packedFrame);
    if (this.ring.length > this.preIncidentSubsteps) this.ring.shift();
    this.previousFrame = frame;
    return frame.triggers.length ? clone(frame.triggers) : null;
  }

  finalizeActiveIncident() {
    if (!this.active) return null;
    const frames = this.active.frames;
    const finalFrame = unpackPhysicsIncidentFrame(frames.at(-1));
    const sweptAabb = createSweptBounds(frames);
    const terrainSampleTable = [];
    const terrainSampleIndices = new Map();
    const compactFrames = frames.map((frame) => {
      const compact = [...frame];
      compact[FRAME.terrain] = (frame[FRAME.terrain] || []).map((sample) => {
        const key = JSON.stringify(sample);
        if (!terrainSampleIndices.has(key)) {
          terrainSampleIndices.set(key, terrainSampleTable.length);
          terrainSampleTable.push(sample);
        }
        return terrainSampleIndices.get(key);
      });
      return compact;
    });
    const fixture = {
      version: PHYSICS_INCIDENT_FIXTURE_VERSION,
      sequence: this.active.sequence,
      sourceDocumentChecksum: this.sourceDocumentChecksum || null,
      replayChecksum: stateChecksum(finalFrame.state || {}),
      trigger: {
        stepIndex: this.active.triggerStepIndex,
        substepIndex: this.active.triggerSubstepIndex,
        reasons: clone(this.active.reasons)
      },
      tireHz: this.tireHz,
      frameEncoding: 'physics-incident-compact-v1',
      terrainSampleTable,
      durationSeconds: q(frames.length / this.tireHz, 12),
      sweptVehicleAabb: sweptAabb,
      vehicleConfiguration: clone(this.vehicleConfiguration),
      initialState: unpackPhysicsIncidentFrame(frames[0]).state,
      inputTimeline: frames.filter((frame) => frame[FRAME.substep] === 0).map((frame) => ({
        stepIndex: frame[FRAME.step],
        timeSeconds: frame[FRAME.time],
        input: frame[FRAME.controls]
      })),
      preparedWorldTriangles: clone(this.triangleProvider?.(sweptAabb) || []),
      frames: compactFrames
    };
    fixture.fixtureChecksum = hashTrackStateValue(JSON.stringify(fixture));
    this.completed.push(fixture);
    if (this.completed.length > 4) this.completed.shift();
    this.active = null;
    this.cooldownRemainingSubsteps = this.preIncidentSubsteps;
    return fixture;
  }

  getCompletedIncidents() {
    return clone(this.completed);
  }

  exportIncident(sequence = null) {
    const incident = sequence === null
      ? this.completed.at(-1)
      : this.completed.find((candidate) => candidate.sequence === sequence);
    return incident ? JSON.stringify(incident) : null;
  }
}

export function verifyPhysicsIncidentFixture(fixture = {}) {
  const payload = clone(fixture);
  const expected = String(payload.fixtureChecksum || '');
  delete payload.fixtureChecksum;
  return {
    valid: Boolean(expected) && hashTrackStateValue(JSON.stringify(payload)) === expected,
    replayChecksum: stateChecksum(unpackPhysicsIncidentFrame(
      payload.frames?.at(-1), payload.terrainSampleTable
    ).state || {})
  };
}

export default PhysicsIncidentRecorder;
