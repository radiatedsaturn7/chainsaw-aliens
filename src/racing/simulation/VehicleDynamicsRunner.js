import { RACE_WHEEL_IDS, clamp, normalizeAngle } from './SimulationMath.js';
import {
  ContactPatchTireModel,
  resolvePhysicalCenterSteeringAngle
} from './ContactPatchTireModel.js';
import { HandlingAssist } from './HandlingAssist.js';
import { advanceTireThermalState } from './TireThermalModel.js';
import { normalizeSuspensionDefinition } from './SuspensionGeometry.js';
import { AeroModel } from './AeroModel.js';
import { sampleWakeAtVehicle } from './WakeModel.js';
import { ChassisBodyCollision } from './ChassisBodyCollision.js';
import { PhysicsIncidentRecorder } from './PhysicsIncidentRecorder.js';
import { createSurfaceSample } from './SurfaceSample.js';
import { createWheelCylinderSupportFeatures } from './WheelCylinderCollision.js';
import { normalizeVehicleBodyProfile, resolveVehicleBodyProfile } from './VehicleBodyProfile.js';
import {
  getRaceNormalizedSuspensionTravelM,
  getRaceVehicleSuspensionRates
} from '../RaceVehiclePhysics.js';
import {
  addVector3,
  crossVector3,
  eulerFromQuaternion,
  integrateBodyAngularMotion,
  multiplyBodyInertia,
  normalizeBodyInertiaTensor,
  quaternionFromEuler,
  rotateVectorByQuaternion,
  rotateVectorToBody,
  scaleVector3
} from './RigidBodyMath.js';

export const VEHICLE_DYNAMICS_CHASSIS_HZ = 120;
export const VEHICLE_DYNAMICS_MAX_TIRE_HZ = 360;
export const VEHICLE_DYNAMICS_SUBSYSTEM_ORDER = Object.freeze([
  'sample-controls',
  'aerodynamic-forces',
  'tire-contact-substeps',
  'chassis-integration',
  'finalize-state',
  'telemetry',
  'legacy-comparison'
]);

const EPSILON = 1e-9;
const dotVector3 = (a = {}, b = {}) => (
  Number(a.x || 0) * Number(b.x || 0)
  + Number(a.y || 0) * Number(b.y || 0)
  + Number(a.z || 0) * Number(b.z || 0)
);

export function evaluatePhysicalSleepCondition({
  state = {}, config = {}, tires = {}, totalLinearImpulse = {}, totalAngularImpulse = {},
  dt = 1 / 120, pendingCollisionCount = 0
} = {}) {
  const patches = RACE_WHEEL_IDS.map((wheelId) => state.contactPatches?.[wheelId])
    .filter((patch) => Number(patch?.normalLoadN || 0) > 1);
  if (!tires.grounded || pendingCollisionCount || tires.bodyCollision?.contacts?.length || !patches.length) return false;
  const normal = patches.reduce((sum, patch) => addVector3(sum, patch.surfaceNormalWorld), { x: 0, y: 0, z: 0 });
  const normalLength = Math.max(EPSILON, Math.hypot(normal.x, normal.y, normal.z));
  const gravityTangentN = Number(config.massKg || 0) * 9.81
    * Math.sqrt(Math.max(0, 1 - clamp(normal.y / normalLength, -1, 1) ** 2));
  const staticFrictionCapacityN = patches.reduce((sum, patch) => (
    sum + Number(patch.normalLoadN || 0) * Math.max(0, Number(patch.gripCoefficient || 0)) * 0.92
  ), 0);
  const activeDriveTorqueNm = patches.reduce((sum, patch) => (
    sum + Math.abs(Number(patch.driveTorqueNm || 0))
  ), 0);
  const netForceN = Math.hypot(
    Number(totalLinearImpulse.x || 0), Number(totalLinearImpulse.y || 0), Number(totalLinearImpulse.z || 0)
  ) / Math.max(EPSILON, dt);
  const netMomentNm = Math.hypot(
    Number(totalAngularImpulse.x || 0), Number(totalAngularImpulse.y || 0), Number(totalAngularImpulse.z || 0)
  ) / Math.max(EPSILON, dt);
  return gravityTangentN <= staticFrictionCapacityN
    && netForceN < Number(config.massKg || 0) * 9.81 * 0.025
    && netMomentNm < Math.max(50, Number(config.massKg || 0) * 9.81 * 0.03)
    && activeDriveTorqueNm < 0.5
    && Math.hypot(Number(state.velocity?.x || 0), Number(state.velocity?.y || 0), Number(state.velocity?.z || 0)) < 0.025
    && Math.hypot(
      Number(state.angularVelocityWorld?.x || 0),
      Number(state.angularVelocityWorld?.y || 0),
      Number(state.angularVelocityWorld?.z || 0)
    ) < 0.025;
}
const CONTINUOUS_CONTROL_FIELDS = Object.freeze([
  'steering',
  'driverSteeringIntent',
  'steeringTarget',
  'controllerFilterOutput',
  'throttle',
  'brake',
  'clutch',
  'handbrake'
]);

function quantize(value, precision = 6) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(precision)) : 0;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isFiniteVehiclePose(state = {}) {
  return [
    state.position?.x, state.position?.y, state.position?.z,
    state.velocity?.x, state.velocity?.y, state.velocity?.z,
    state.orientation?.x, state.orientation?.y, state.orientation?.z, state.orientation?.w,
    state.angularVelocityWorld?.x, state.angularVelocityWorld?.y, state.angularVelocityWorld?.z
  ].every((value) => Number.isFinite(Number(value)));
}

function normalizeRecoveryNormal(value = {}) {
  const magnitude = Math.hypot(
    Number(value.x || 0), Number(value.y || 0), Number(value.z || 0)
  );
  return magnitude > EPSILON
    ? {
        x: Number(value.x || 0) / magnitude,
        y: Number(value.y || 0) / magnitude,
        z: Number(value.z || 0) / magnitude
      }
    : { x: 0, y: 1, z: 0 };
}

function stableIdentityValues(values = []) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined)
    .map(String))].sort();
}

function calculateKineticEnergyJ(state = {}, config = {}) {
  const velocity = state.velocity || {};
  const translational = 0.5 * Number(config.massKg || 0) * (
    Number(velocity.x || 0) ** 2
    + Number(velocity.y || 0) ** 2
    + Number(velocity.z || 0) ** 2
  );
  const omegaBody = rotateVectorToBody(
    state.angularVelocityWorld || {}, state.orientation || {}
  );
  const angularMomentumBody = multiplyBodyInertia(
    config.inertiaTensorBodyKgM2 || {}, omegaBody
  );
  const rotational = 0.5 * dotVector3(omegaBody, angularMomentumBody);
  const wheelRotational = RACE_WHEEL_IDS.reduce((sum, wheelId) => {
    const angularVelocityRadps = Number(state.wheelAngularVelocityRadps?.[wheelId] || 0);
    return sum + 0.5 * Number(config.wheelInertiaKgM2 || 0) * angularVelocityRadps ** 2;
  }, 0);
  return quantize(Math.max(0, translational + rotational + wheelRotational));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function controlsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeAssists(assists = {}) {
  return Object.fromEntries(Object.entries(assists || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [String(key), typeof value === 'boolean' ? value : quantize(value)]));
}

export function normalizeVehicleControlInput(input = {}) {
  const explicitCenterAngle = input.centerSteeringAngleRad;
  return {
    steering: quantize(clamp(Number(input.steering ?? input.steeringWheel ?? 0), -1, 1)),
    driverSteeringIntent: quantize(clamp(Number(input.driverSteeringIntent ?? input.steering ?? 0), -1, 1)),
    steeringTarget: quantize(clamp(Number(input.steeringTarget ?? input.steering ?? 0), -1, 1)),
    controllerFilterOutput: quantize(clamp(Number(input.controllerFilterOutput ?? input.steering ?? 0), -1, 1)),
    centerSteeringAngleRad: typeof explicitCenterAngle === 'number' && Number.isFinite(explicitCenterAngle)
      ? quantize(explicitCenterAngle)
      : null,
    steeringInputMode: String(input.steeringInputMode || 'normalized'),
    throttle: quantize(clamp(Number(input.throttle ?? input.throttleAxis ?? 0), 0, 1)),
    brake: quantize(clamp(Number(input.brake ?? input.brakeAxis ?? 0), 0, 1)),
    clutch: quantize(clamp(Number(input.clutch ?? input.clutchAxis ?? 0), 0, 1)),
    handbrake: quantize(clamp(Number(input.handbrake || 0), 0, 1)),
    handbrakeHoldSequence: Math.max(0, Math.trunc(Number(input.handbrakeHoldSequence || 0))),
    handbrakeHoldSeconds: quantize(clamp(Number(input.handbrakeHoldSeconds ?? 0.36), 0, 2)),
    requestedGear: Math.trunc(Number(input.requestedGear ?? input.gear ?? 0) || 0),
    assists: normalizeAssists(input.assists || {
      absEnabled: input.absEnabled !== false,
      tractionControlEnabled: input.tractionControlEnabled !== false,
      stabilityControlEnabled: input.stabilityControlEnabled !== false,
      autoShift: input.autoShift !== false
    })
  };
}

export class VehicleControlInputTimeline {
  constructor(samples = []) {
    this.samples = [];
    this.nextSequence = 1;
    samples.forEach((sample) => this.addSample(sample.timeSeconds, sample.input || sample, {
      sequence: sample.sequence
    }));
  }

  addSample(timeSeconds = 0, input = {}, { sequence = null } = {}) {
    const sample = {
      timeSeconds: quantize(Math.max(0, Number(timeSeconds) || 0), 12),
      sequence: Number.isInteger(sequence) && sequence > 0 ? sequence : this.nextSequence,
      input: normalizeVehicleControlInput(input)
    };
    this.nextSequence = Math.max(this.nextSequence, sample.sequence + 1);
    const previous = this.samples[this.samples.length - 1];
    const plateauStart = this.samples[this.samples.length - 2];
    if (previous
      && plateauStart
      && sample.timeSeconds >= previous.timeSeconds
      && controlsEqual(previous.input, sample.input)
      && controlsEqual(plateauStart.input, sample.input)) {
      // Retain both ends of a held-input plateau so interpolation and replay are
      // exact without recording the same render-frame sample indefinitely.
      this.samples[this.samples.length - 1] = sample;
      return clone(sample);
    }
    this.samples.push(sample);
    this.samples.sort((left, right) => (
      left.timeSeconds - right.timeSeconds || left.sequence - right.sequence
    ));
    return clone(sample);
  }

  sampleAt(timeSeconds = 0) {
    const time = Math.max(0, Number(timeSeconds) || 0);
    if (!this.samples.length) return normalizeVehicleControlInput();
    let leftIndex = -1;
    let rightIndex = -1;
    for (let index = 0; index < this.samples.length; index += 1) {
      const sample = this.samples[index];
      if (sample.timeSeconds <= time + EPSILON) leftIndex = index;
      if (sample.timeSeconds > time + EPSILON) {
        rightIndex = index;
        break;
      }
    }
    if (leftIndex < 0) return clone(this.samples[0].input);
    const left = this.samples[leftIndex];
    if (rightIndex < 0) return clone(left.input);
    const right = this.samples[rightIndex];
    const span = right.timeSeconds - left.timeSeconds;
    const ratio = span > EPSILON ? clamp((time - left.timeSeconds) / span, 0, 1) : 0;
    const sampled = {
      requestedGear: left.input.requestedGear,
      assists: clone(left.input.assists),
      steeringInputMode: left.input.steeringInputMode,
      handbrakeHoldSequence: left.input.handbrakeHoldSequence,
      handbrakeHoldSeconds: left.input.handbrakeHoldSeconds,
      centerSteeringAngleRad: null
    };
    CONTINUOUS_CONTROL_FIELDS.forEach((field) => {
      sampled[field] = quantize(
        Number(left.input[field] || 0)
          + (Number(right.input[field] || 0) - Number(left.input[field] || 0)) * ratio,
        4
      );
    });
    if (typeof left.input.centerSteeringAngleRad === 'number'
      && typeof right.input.centerSteeringAngleRad === 'number') {
      sampled.centerSteeringAngleRad = quantize(
        left.input.centerSteeringAngleRad
          + (right.input.centerSteeringAngleRad - left.input.centerSteeringAngleRad) * ratio
      );
    } else if (typeof left.input.centerSteeringAngleRad === 'number') {
      sampled.centerSteeringAngleRad = left.input.centerSteeringAngleRad;
    }
    return sampled;
  }

  createSnapshot() {
    return this.samples.map(clone);
  }

  restoreSnapshot(samples = []) {
    this.samples = [];
    this.nextSequence = 1;
    samples.forEach((sample) => this.addSample(sample.timeSeconds, sample.input, {
      sequence: sample.sequence
    }));
  }
}

export function createVehicleDynamicsState(initial = {}) {
  const initialYaw = Number(initial.yawRad ?? initial.carYaw ?? initial.velocityYaw ?? 0) || 0;
  const initialSpeed = Number(initial.speedMps || 0) || 0;
  const hasExplicitVelocity = initial.velocity && (
    Number.isFinite(Number(initial.velocity.x))
    || Number.isFinite(Number(initial.velocity.z))
  );
  const wheelValue = (field, fallback = 0) => Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    quantize(initial[field]?.[wheelId] ?? fallback)
  ]));
  return {
    position: {
      x: quantize(initial.position?.x ?? initial.worldX ?? 0),
      y: quantize(initial.position?.y ?? initial.heightM ?? initial.bodyY ?? 0),
      z: quantize(initial.position?.z ?? initial.worldZ ?? 0)
    },
    velocity: {
      x: quantize(hasExplicitVelocity ? initial.velocity?.x : Math.sin(initialYaw) * initialSpeed),
      y: quantize(initial.velocity?.y ?? initial.verticalVelocityMps ?? 0),
      z: quantize(hasExplicitVelocity ? initial.velocity?.z : Math.cos(initialYaw) * initialSpeed)
    },
    speedMps: quantize(initialSpeed),
    groundSpeedMps: quantize(initial.groundSpeedMps ?? Math.hypot(
      Number(hasExplicitVelocity ? initial.velocity?.x : Math.sin(initialYaw) * initialSpeed) || 0,
      Number(hasExplicitVelocity ? initial.velocity?.z : Math.cos(initialYaw) * initialSpeed) || 0
    )),
    bodyLongitudinalSpeedMps: quantize(initial.bodyLongitudinalSpeedMps ?? initialSpeed),
    bodyLateralSpeedMps: quantize(initial.bodyLateralSpeedMps ?? 0),
    signedTravelSpeedMps: quantize(initial.signedTravelSpeedMps ?? initialSpeed),
    yawRad: quantize(initialYaw),
    yawRateRadps: quantize(initial.yawRateRadps ?? initial.yawVelocityRadps ?? 0),
    angularVelocityWorld: {
      x: quantize(initial.angularVelocityWorld?.x ?? initial.pitchRateRadps ?? 0),
      y: quantize(initial.angularVelocityWorld?.y ?? initial.yawRateRadps ?? initial.yawVelocityRadps ?? 0),
      z: quantize(initial.angularVelocityWorld?.z ?? initial.rollRateRadps ?? 0)
    },
    orientation: clone(initial.orientation || quaternionFromEuler({
      yaw: initial.yawRad ?? initial.carYaw ?? 0,
      pitch: initial.pitchRad ?? 0,
      roll: initial.rollRad ?? 0
    })),
    pitchRad: quantize(initial.pitchRad ?? 0),
    rollRad: quantize(initial.rollRad ?? 0),
    lateralAccelerationMps2: quantize(initial.lateralAccelerationMps2 ?? 0),
    engineRpm: quantize(initial.engineRpm ?? initial.rpm ?? 800),
    gear: Math.trunc(Number(initial.gear || 0)),
    handbrakeCommandState: clone(initial.handbrakeCommandState || {
      active: false,
      remainingSeconds: 0,
      consumedHoldSequence: 0
    }),
    powertrainState: clone(initial.powertrainState || { engineRpm: initial.engineRpm ?? initial.rpm ?? 800, gear: initial.gear || 0 }),
    suspensionState: clone(initial.suspensionState || {}),
    tireState: clone(initial.tireState || {}),
    grounded: initial.grounded !== false,
    wheelGrounded: initial.wheelGrounded ?? initial.grounded !== false,
    bodyGrounded: initial.bodyGrounded === true,
    wheelSidewallGrounded: initial.wheelSidewallGrounded === true,
    supportedWheelCount: Math.max(0, Math.trunc(Number(initial.supportedWheelCount
      ?? (initial.grounded === false ? 0 : 4)))),
    validTreadContactByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Boolean(initial.validTreadContactByWheel?.[wheelId] ?? initial.grounded !== false)
    ])),
    invalidContactReasonByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      initial.invalidContactReasonByWheel?.[wheelId] || null
    ])),
    wheelLoadsN: wheelValue('wheelLoadsN'),
    wheelSlip: wheelValue('wheelSlip'),
    wheelAngularVelocityRadps: wheelValue('wheelAngularVelocityRadps'),
    suspensionTravel: wheelValue('suspensionTravel'),
    tireForcesN: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      {
        longitudinal: quantize(initial.tireForcesN?.[wheelId]?.longitudinal || 0),
        lateral: quantize(initial.tireForcesN?.[wheelId]?.lateral || 0)
      }
    ])),
    contactPatches: clone(initial.contactPatches || {}),
    steeringTelemetry: clone(initial.steeringTelemetry || {}),
    aeroState: clone(initial.aeroState || {}),
    penetrationRecovery: clone(initial.penetrationRecovery || null)
  };
}

export function createVehicleDynamicsConfig(config = {}) {
  const chassisHz = Math.max(1, Math.trunc(Number(config.chassisHz) || VEHICLE_DYNAMICS_CHASSIS_HZ));
  const requestedTireHz = Number(config.tireHz) || VEHICLE_DYNAMICS_MAX_TIRE_HZ;
  if (!Number.isInteger(requestedTireHz)) {
    throw new Error('VehicleDynamicsRunner tireHz must be an integer multiple of chassisHz');
  }
  const tireHz = Math.max(chassisHz, Math.min(
    VEHICLE_DYNAMICS_MAX_TIRE_HZ,
    requestedTireHz
  ));
  if (tireHz % chassisHz !== 0) {
    throw new Error('VehicleDynamicsRunner tireHz must be an integer multiple of chassisHz');
  }
  const massKg = Math.max(100, Number(config.massKg) || 1450);
  const wheelbaseM = Math.max(0.5, Number(config.wheelbaseM) || 2.65);
  const frontWeightDistribution = clamp(Number(config.frontWeightDistribution) || 0.5, 0.35, 0.72);
  const suspensionSpringRateNpm = Math.max(1000, Number(config.suspensionSpringRateNpm) || 32000);
  const suspensionDamperRateNsM = Math.max(100, Number(config.suspensionDamperRateNsM) || 3200);
  const suspensionTravelM = Math.max(0.05, Number(config.suspensionTravelM) || 0.22);
  const staticSagRatio = clamp(Number(config.staticSagRatio ?? 0.42), 0.2, 0.7);
  const explicitPitchStiffness = Number(config.pitchStiffnessNmPerRad);
  const explicitRollStiffness = Number(config.rollStiffnessNmPerRad);
  const explicitPitchDamping = Number(config.pitchDampingNmsPerRad);
  const explicitRollDamping = Number(config.rollDampingNmsPerRad);
  const inertiaTensorBodyKgM2 = normalizeBodyInertiaTensor(config.inertiaTensorBodyKgM2, {
    xx: Math.max(100, Number(config.pitchInertiaKgM2) || massKg * 1.4),
    yy: Math.max(100, Number(config.yawInertiaKgM2) || massKg * 1.65),
    zz: Math.max(100, Number(config.rollInertiaKgM2) || massKg * 0.65)
  });
  const telemetryRetention = ['history', 'latest', 'transient', 'none'].includes(config.telemetryRetention)
    ? config.telemetryRetention
    : 'history';
  const bodyProfile = normalizeVehicleBodyProfile(config.bodyProfile || {}, {
    lengthM: config.bodyLengthM || config.lengthM,
    widthM: config.bodyWidthM || config.widthM,
    heightM: config.bodyHeightM || config.heightM,
    groundClearanceM: config.bodyGroundClearanceM,
    cgPositionM: config.cgLocationBodyM || { y: config.cgHeightM },
    collisionFriction: config.bodyCollisionFriction,
    collisionRestitution: config.bodyCollisionRestitution
  });
  return Object.freeze({
    chassisHz,
    tireHz,
    tireSubstepsPerChassisStep: tireHz / chassisHz,
    maxCatchUpSteps: Math.max(1, Math.trunc(Number(config.maxCatchUpSteps) || 30)),
    telemetryLimit: Math.max(1, Math.trunc(Number(config.telemetryLimit) || 4096)),
    telemetryRetention,
    inputTimelineLimit: Math.max(0, Math.trunc(Number(config.inputTimelineLimit) || 0)),
    massKg,
    wheelbaseM,
    frontWeightDistribution,
    frontAxleDistanceFromCgM: Math.max(0.1, Number(config.frontAxleDistanceFromCgM)
      || wheelbaseM * (1 - frontWeightDistribution)),
    rearAxleDistanceFromCgM: Math.max(0.1, Number(config.rearAxleDistanceFromCgM)
      || wheelbaseM * frontWeightDistribution),
    trackWidthM: Math.max(0.5, Number(config.trackWidthM) || 1.58),
    frontTrackWidthM: Math.max(0.5, Number(config.frontTrackWidthM || config.trackWidthM) || 1.58),
    rearTrackWidthM: Math.max(0.5, Number(config.rearTrackWidthM || config.trackWidthM) || 1.58),
    wheelRadiusM: Math.max(0.1, Number(config.wheelRadiusM) || 0.337),
    cgHeightM: Math.max(0.15, Number(config.cgHeightM) || 0.55),
    cgLocationBodyM: Object.freeze({
      x: Number(config.cgLocationBodyM?.x || 0),
      y: Number(config.cgLocationBodyM?.y ?? config.cgHeightM ?? 0.55),
      z: Number(config.cgLocationBodyM?.z || 0)
    }),
    bodyProfile,
    bodyShapePreset: bodyProfile.preset,
    bodyLengthM: bodyProfile.overallLengthM,
    bodyWidthM: bodyProfile.overallWidthM,
    bodyHeightM: bodyProfile.overallHeightM,
    bodyGroundClearanceM: bodyProfile.groundClearanceM,
    bodyCollisionToleranceM: clamp(Number(config.bodyCollisionToleranceM) || 0.008, 0.001, 0.04),
    bodyCollisionRestitution: bodyProfile.collisionRestitution,
    bodyCollisionFriction: bodyProfile.collisionFriction,
    bodyCollisionSolverIterations: clamp(Math.trunc(Number(config.bodyCollisionSolverIterations) || 4), 1, 12),
    bodyCollisionSupportSpacingM: clamp(Number(config.bodyCollisionSupportSpacingM || 0.55), 0.2, 0.8),
    wheelCylinderSweepSpacingM: clamp(Number(config.wheelCylinderSweepSpacingM ?? 0.02), 0.005, 0.05),
    wheelCylinderRadialSamples: clamp(
      Math.trunc(Number(config.wheelCylinderRadialSamples) || 24), 16, 48
    ),
    physicsIncidentRecordingEnabled: config.physicsIncidentRecordingEnabled === true,
    physicsIncidentPreSeconds: clamp(Number(config.physicsIncidentPreSeconds ?? 2), 2, 10),
    physicsIncidentPostSeconds: clamp(Number(config.physicsIncidentPostSeconds ?? 3), 1, 10),
    minimumTreadSupportAlignment: clamp(Number(config.minimumTreadSupportAlignment ?? 0.2), 0.01, 0.95),
    maximumTreadAxleNormalAlignment: clamp(Number(config.maximumTreadAxleNormalAlignment ?? 0.72), 0.2, 0.95),
    treadReachToleranceM: clamp(Number(config.treadReachToleranceM ?? 0.025), 0.002, 0.08),
    emergencyBodyPenetrationM: clamp(Number(config.emergencyBodyPenetrationM ?? 0.18), 0.05, 0.5),
    penetrationFailureStepLimit: clamp(Math.trunc(Number(config.penetrationFailureStepLimit) || 4), 2, 12),
    penetrationRecoveryRewindM: clamp(Number(config.penetrationRecoveryRewindM ?? 0.35), 0.1, 1),
    penetrationRecoverySafetyMarginM: clamp(
      Number(config.penetrationRecoverySafetyMarginM ?? 0.025), 0.005, 0.1
    ),
    penetrationRecoveryMinimumDistanceM: clamp(
      Number(config.penetrationRecoveryMinimumDistanceM ?? 0.5), 0.1, 5
    ),
    penetrationRecoveryMinimumAgeSeconds: clamp(
      Number(config.penetrationRecoveryMinimumAgeSeconds ?? 0.12), 0.02, 1
    ),
    penetrationRecoveryMaximumTangentSpeedMps: clamp(
      Number(config.penetrationRecoveryMaximumTangentSpeedMps ?? 4), 0.5, 12
    ),
    penetrationIncidentSpatialQuantumM: clamp(
      Number(config.penetrationIncidentSpatialQuantumM ?? 5), 1, 25
    ),
    penetrationIncidentRouteQuantumM: clamp(
      Number(config.penetrationIncidentRouteQuantumM ?? 10), 2, 50
    ),
    penetrationIncidentClearDistanceM: clamp(
      Number(config.penetrationIncidentClearDistanceM ?? 8), 2, 30
    ),
    penetrationIncidentClearSeconds: clamp(
      Number(config.penetrationIncidentClearSeconds ?? 1), 0.25, 5
    ),
    penetrationTerrainEnvelopeDepthM: clamp(
      Number(config.penetrationTerrainEnvelopeDepthM ?? 0.1), 0.05, 0.5
    ),
    penetrationHistoryLimit: clamp(Math.trunc(Number(config.penetrationHistoryLimit) || 32), 4, 128),
    penetrationHistoryMaximumAgeSeconds: clamp(
      Number(config.penetrationHistoryMaximumAgeSeconds ?? 0.25), 0.05, 1
    ),
    terrainDiscrepancyToleranceM: clamp(Number(config.terrainDiscrepancyToleranceM ?? 0.02), 0.005, 0.1),
    surfaceConsistencySampleIntervalSteps: clamp(Math.trunc(Number(
      config.surfaceConsistencySampleIntervalSteps
    ) || 60), 1, 120),
    surfaceConsistencySamplesPerCheck: clamp(Math.trunc(Number(
      config.surfaceConsistencySamplesPerCheck
    ) || 2), 1, 16),
    wheelInertiaKgM2: Math.max(0.05, Number(config.wheelInertiaKgM2) || 1.35),
    inertiaTensorBodyKgM2,
    yawInertiaKgM2: inertiaTensorBodyKgM2.yy,
    pitchInertiaKgM2: inertiaTensorBodyKgM2.xx,
    rollInertiaKgM2: inertiaTensorBodyKgM2.zz,
    // Normal runtime body attitude is restored by suspension forces applied at
    // the four contact patches. These remain explicit opt-in compatibility
    // moments for isolated fixtures instead of hidden defaults.
    pitchStiffnessNmPerRad: Number.isFinite(explicitPitchStiffness) ? Math.max(0, explicitPitchStiffness) : 0,
    rollStiffnessNmPerRad: Number.isFinite(explicitRollStiffness) ? Math.max(0, explicitRollStiffness) : 0,
    pitchDampingNmsPerRad: Number.isFinite(explicitPitchDamping) ? Math.max(0, explicitPitchDamping) : 0,
    rollDampingNmsPerRad: Number.isFinite(explicitRollDamping) ? Math.max(0, explicitRollDamping) : 0,
    suspensionSpringRateNpm,
    suspensionDamperRateNsM,
    suspensionTravelM,
    suspensionSpringRateFrontNpm: Math.max(1000, Number(config.suspensionSpringRateFrontNpm) || suspensionSpringRateNpm),
    suspensionSpringRateRearNpm: Math.max(1000, Number(config.suspensionSpringRateRearNpm) || suspensionSpringRateNpm),
    suspensionBumpDamperFrontNsM: Math.max(100, Number(config.suspensionBumpDamperFrontNsM) || suspensionDamperRateNsM),
    suspensionReboundDamperFrontNsM: Math.max(100, Number(config.suspensionReboundDamperFrontNsM) || suspensionDamperRateNsM),
    suspensionBumpDamperRearNsM: Math.max(100, Number(config.suspensionBumpDamperRearNsM) || suspensionDamperRateNsM),
    suspensionReboundDamperRearNsM: Math.max(100, Number(config.suspensionReboundDamperRearNsM) || suspensionDamperRateNsM),
    suspensionTravelFrontM: Math.max(0.05, Number(config.suspensionTravelFrontM) || suspensionTravelM),
    suspensionTravelRearM: Math.max(0.05, Number(config.suspensionTravelRearM) || suspensionTravelM),
    staticSagRatioFront: clamp(Number(config.staticSagRatioFront ?? staticSagRatio), 0.2, 0.7),
    staticSagRatioRear: clamp(Number(config.staticSagRatioRear ?? staticSagRatio), 0.2, 0.7),
    suspensionRestLengthFrontM: Math.max(0.05, Number(config.suspensionRestLengthFrontM)
      || Math.max(0.05, (Number(config.cgHeightM) || 0.55) - (Number(config.wheelRadiusM) || 0.337)
        + Math.max(0.05, Number(config.suspensionTravelFrontM) || suspensionTravelM) * clamp(Number(config.staticSagRatioFront ?? staticSagRatio), 0.2, 0.7))),
    suspensionRestLengthRearM: Math.max(0.05, Number(config.suspensionRestLengthRearM)
      || Math.max(0.05, (Number(config.cgHeightM) || 0.55) - (Number(config.wheelRadiusM) || 0.337)
        + Math.max(0.05, Number(config.suspensionTravelRearM) || suspensionTravelM) * clamp(Number(config.staticSagRatioRear ?? staticSagRatio), 0.2, 0.7))),
    antiRollFront: clamp(Number(config.antiRollFront) || 0.5, 0.1, 1),
    antiRollRear: clamp(Number(config.antiRollRear) || 0.5, 0.1, 1),
    antiRollStiffnessFrontNpm: Math.max(0, Number(config.antiRollStiffnessFrontNpm) || 0),
    antiRollStiffnessRearNpm: Math.max(0, Number(config.antiRollStiffnessRearNpm) || 0),
    rollStiffnessNormalized: clamp(Number(config.rollStiffnessNormalized) || 0.76, 0.2, 1.4),
    maxSuspensionLoadFactor: Math.max(1, Number(config.maxSuspensionLoadFactor) || 6),
    ackermannRatio: clamp(Number(config.ackermannRatio ?? 1), 0, 1.5),
    steeringRackRatio: Math.max(0.05, Number(config.steeringRackRatio) || 1),
    camberFrontRad: Number(config.camberFrontRad || 0),
    camberRearRad: Number(config.camberRearRad || 0),
    toeFrontRad: Number(config.toeFrontRad || 0),
    toeRearRad: Number(config.toeRearRad || 0),
    casterFrontRad: Number(config.casterFrontRad || 0),
    suspensionDefinitionFront: normalizeSuspensionDefinition({
      ...(Number.isFinite(Number(config.casterFrontRad)) ? { casterRad: Number(config.casterFrontRad) } : {}),
      ...(config.suspensionDefinitionFront || {})
    }, 'macpherson'),
    suspensionDefinitionRear: normalizeSuspensionDefinition(config.suspensionDefinitionRear, 'multilink'),
    unsprungMassKg: clamp(Number(config.unsprungMassKg) || 42, 12, 120),
    unsprungMassByWheelKg: Object.freeze(Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      clamp(Number(config.unsprungMassByWheelKg?.[wheelId] ?? config.unsprungMassKg) || 42, 12, 120)
    ]))),
    tireVerticalStiffnessNpm: clamp(Number(config.tireVerticalStiffnessNpm) || 210000, 50000, 600000),
    tireVerticalDampingNsM: clamp(Number(config.tireVerticalDampingNsM) || 1800, 100, 12000),
    maximumTireVerticalDeflectionM: clamp(
      Number(config.maximumTireVerticalDeflectionM)
        || (Math.max(0.1, Number(config.wheelRadiusM) || 0.337) * 0.12),
      0.005,
      0.08
    ),
    progressiveSpringRate: clamp(Number(config.progressiveSpringRate ?? 0.35), 0, 4),
    bumpStopStartRatio: clamp(Number(config.bumpStopStartRatio) || 0.95, 0.5, 0.98),
    bumpStopRateNpm: clamp(Number(config.bumpStopRateNpm) || 120000, 10000, 2000000),
    hardStopRateNpm: clamp(
      Number(config.hardStopRateNpm)
        || Math.max(
          (Number(config.bumpStopRateNpm) || 120000) * 4,
          (Number(config.tireVerticalStiffnessNpm) || 210000) * 1.5
        ),
      100000,
      8000000
    ),
    damperHighSpeedThresholdMps: clamp(Number(config.damperHighSpeedThresholdMps) || 0.25, 0.05, 2),
    damperHighSpeedScale: clamp(Number(config.damperHighSpeedScale ?? 0.35), 0, 3),
    contactFootprintSamples: clamp(Math.trunc(Number(config.contactFootprintSamples) || 6), 4, 8),
    contactFootprintMaxGapM: clamp(Number(config.contactFootprintMaxGapM) || 0.045, 0.015, 0.12),
    maxSteerAngleRad: clamp(Number(config.maxSteerAngleRad) || 0.52, 0.05, 1.2),
    steeringWheelRatio: Math.max(1, Number(config.steeringWheelRatio) || 14),
    physicalProfileId: config.physicalProfileId ? String(config.physicalProfileId) : null,
    powerHp: Math.max(0, Number(config.powerHp) || 0),
    enginePeakTorqueNm: Math.max(0, Number(config.enginePeakTorqueNm) || 0),
    drivetrainEfficiency: clamp(Number(config.drivetrainEfficiency) || 0.85, 0.35, 1),
    engineForceN: Math.max(0, Number(config.engineForceN) || 7200),
    engineBrakeForceN: Math.max(0, Number(config.engineBrakeForceN) || 1600),
    brakeForceN: Math.max(0, Number(config.brakeForceN) || 14500),
    handbrakeForceN: Math.max(0, Number(config.handbrakeForceN) || 7200),
    frontBrakeBias: clamp(Number(config.frontBrakeBias ?? 0.62), 0.4, 0.85),
    brakePressure: clamp(Number(config.brakePressure ?? 1), 0.2, 1.5),
    rollingResistanceN: Math.max(0, Number(config.rollingResistanceN) || 180),
    dragCoefficient: clamp(Number(config.dragCoefficient) || 0.34, 0.04, 1.5),
    frontalAreaM2: clamp(Number(config.frontalAreaM2) || 2.2, 0.8, 6),
    frontDownforceCoefficient: clamp(Number(config.frontDownforceCoefficient) || 0, 0, 3),
    rearDownforceCoefficient: clamp(Number(config.rearDownforceCoefficient) || 0, 0, 3),
    frontRideHeightM: clamp(Number(config.frontRideHeightM) || 0.16, 0.04, 0.5),
    rearRideHeightM: clamp(Number(config.rearRideHeightM) || 0.17, 0.04, 0.5),
    groundEffectGain: clamp(Number(config.groundEffectGain ?? 0.18), 0, 2),
    groundEffectReferenceHeightM: clamp(Number(config.groundEffectReferenceHeightM) || 0.12, 0.03, 0.4),
    floorStallHeightM: clamp(Number(config.floorStallHeightM) || 0.055, 0.015, 0.2),
    diffuserRakeSensitivity: clamp(Number(config.diffuserRakeSensitivity) || 3.5, -10, 20),
    yawDragSensitivity: clamp(Number(config.yawDragSensitivity) || 0.65, 0, 4),
    extremeYawLiftCoefficient: clamp(Number(config.extremeYawLiftCoefficient) || 0.24, 0, 2),
    damageDragGain: clamp(Number(config.damageDragGain) || 0.55, 0, 3),
    aeroMap: clone(config.aeroMap || {}),
    yawResponsePerSecond: Math.max(0.1, Number(config.yawResponsePerSecond) || 9),
    idleRpm: Math.max(0, Number(config.idleRpm) || 800),
    maxRpm: Math.max(1000, Number(config.maxRpm) || 7000),
    revLimiterDropRpm: Math.max(40, Number(config.revLimiterDropRpm) || 280),
    handlingPreset: String(config.handlingPreset || 'sport').toLowerCase(),
    powertrainTuning: clone(config.powertrainTuning || {}),
    tireByWheel: clone(config.tireByWheel || {}),
    drivenWheelIds: (config.drivenWheelIds || ['rl', 'rr'])
      .filter((wheelId) => RACE_WHEEL_IDS.includes(wheelId))
  });
}

export function createVehicleDynamicsConfigFromTuning(tuning = {}, {
  chassisHz = VEHICLE_DYNAMICS_CHASSIS_HZ,
  tireHz = VEHICLE_DYNAMICS_MAX_TIRE_HZ,
  maxCatchUpSteps = 30,
  telemetryLimit = 4096,
  telemetryRetention = 'history',
  inputTimelineLimit = 0,
  physicsIncidentRecordingEnabled = false
} = {}) {
  const physical = tuning.physicalVehicleProfile || null;
  const powerW = Math.max(0, Number(tuning.powerHp || 0) * 745.7);
  const massKg = Math.max(100, Number(tuning.weightKg ?? physical?.massKg) || 1450);
  const torqueReferenceRpm = Math.max(
    1000,
    Number(tuning.torquePeakEndRpm)
      || Number(tuning.revLimitRpm || tuning.redlineRpm || 7000) * 0.75
  );
  const authoredTorqueNm = Math.max(0, Number(tuning.torqueLbFt || 0) * 1.3558179483);
  const powerDerivedTorqueNm = powerW > 0
    ? powerW / (torqueReferenceRpm * Math.PI * 2 / 60)
    : 0;
  const extremePowerTorqueScale = clamp(
    Math.sqrt(Math.max(1, Number(tuning.powerHp || 0) / 600)),
    1,
    1.8
  );
  const frontBump = getRaceVehicleSuspensionRates(tuning, massKg, 'fl', 1);
  const frontRebound = getRaceVehicleSuspensionRates(tuning, massKg, 'fl', -1);
  const rearBump = getRaceVehicleSuspensionRates(tuning, massKg, 'rl', 1);
  const rearRebound = getRaceVehicleSuspensionRates(tuning, massKg, 'rl', -1);
  const drivetrain = String(tuning.drivetrain || tuning.driveType || 'RWD').toUpperCase();
  const bodyProfile = resolveVehicleBodyProfile(tuning);
  return createVehicleDynamicsConfig({
    chassisHz,
    tireHz,
    maxCatchUpSteps,
    telemetryLimit,
    telemetryRetention,
    inputTimelineLimit,
    physicsIncidentRecordingEnabled,
    massKg,
    physicalProfileId: physical?.id,
    cgLocationBodyM: physical?.cgLocationBodyM,
    inertiaTensorBodyKgM2: physical?.inertiaTensorBodyKgM2,
    wheelbaseM: tuning.wheelbaseM,
    frontWeightDistribution: physical?.frontWeightDistribution ?? tuning.frontWeightDistribution,
    trackWidthM: tuning.trackWidthM,
    frontTrackWidthM: tuning.trackFrontM || tuning.trackWidthM,
    rearTrackWidthM: tuning.trackRearM || tuning.trackWidthM,
    wheelRadiusM: tuning.wheelRadiusM,
    cgHeightM: physical?.cgLocationBodyM?.y ?? tuning.cgHeightM,
    bodyLengthM: tuning.lengthM,
    bodyWidthM: tuning.widthM,
    bodyHeightM: tuning.heightM,
    bodyGroundClearanceM: tuning.groundClearanceM,
    bodyProfile,
    wheelInertiaKgM2: tuning.wheelInertiaKgM2,
    yawInertiaKgM2: tuning.yawInertiaKgM2,
    ackermannRatio: tuning.ackermannRatio,
    maxSteerAngleRad: physical?.maxSteerAngleRad ?? tuning.maxSteerAngleRad,
    steeringRackRatio: physical?.steeringRackRatio ?? tuning.steeringRackRatio,
    steeringWheelRatio: physical?.steeringWheelRatio ?? tuning.steeringWheelRatio,
    camberFrontRad: Number(tuning.camberFront || 0) * Math.PI / 180,
    camberRearRad: Number(tuning.camberRear || 0) * Math.PI / 180,
    toeFrontRad: Number(tuning.toeFront || 0) * Math.PI / 180,
    toeRearRad: Number(tuning.toeRear || 0) * Math.PI / 180,
    casterFrontRad: Number(tuning.casterFront || 0) * Math.PI / 180,
    suspensionDefinitionFront: tuning.suspensionDefinitionFront || tuning.suspensionGeometry?.front,
    suspensionDefinitionRear: tuning.suspensionDefinitionRear || tuning.suspensionGeometry?.rear,
    unsprungMassKg: tuning.unsprungMassKg,
    unsprungMassByWheelKg: physical?.unsprungMassByWheelKg ?? tuning.unsprungMassByWheelKg,
    tireVerticalStiffnessNpm: physical?.tireVerticalStiffnessNpm ?? tuning.tireVerticalStiffnessNpm,
    tireVerticalDampingNsM: physical?.tireVerticalDampingNsM ?? tuning.tireVerticalDampingNsM,
    maximumTireVerticalDeflectionM: physical?.maximumTireVerticalDeflectionM
      ?? tuning.maximumTireVerticalDeflectionM,
    progressiveSpringRate: tuning.progressiveSpringRate,
    bumpStopStartRatio: tuning.bumpStopStartRatio,
    bumpStopRateNpm: tuning.bumpStopRateNpm,
    hardStopRateNpm: physical?.hardStopRateNpm ?? tuning.hardStopRateNpm,
    damperHighSpeedThresholdMps: physical?.damperHighSpeedThresholdMps ?? tuning.damperHighSpeedThresholdMps,
    damperHighSpeedScale: physical?.damperHighSpeedScale ?? tuning.damperHighSpeedScale,
    contactFootprintSamples: tuning.contactFootprintSamples,
    contactFootprintMaxGapM: tuning.contactFootprintMaxGapM,
    powerHp: tuning.powerHp,
    enginePeakTorqueNm: Math.max(authoredTorqueNm, powerDerivedTorqueNm) * extremePowerTorqueScale,
    drivetrainEfficiency: tuning.drivetrainEfficiency,
    suspensionSpringRateNpm: tuning.springRateNpm,
    suspensionDamperRateNsM: tuning.damperRateNsM,
    suspensionSpringRateFrontNpm: physical?.suspensionSpringRateFrontNpm ?? frontBump.springRateNpm,
    suspensionSpringRateRearNpm: physical?.suspensionSpringRateRearNpm ?? rearBump.springRateNpm,
    suspensionBumpDamperFrontNsM: physical?.suspensionBumpDamperFrontNsM ?? frontBump.damperRateNsM,
    suspensionReboundDamperFrontNsM: physical?.suspensionReboundDamperFrontNsM ?? frontRebound.damperRateNsM,
    suspensionBumpDamperRearNsM: physical?.suspensionBumpDamperRearNsM ?? rearBump.damperRateNsM,
    suspensionReboundDamperRearNsM: physical?.suspensionReboundDamperRearNsM ?? rearRebound.damperRateNsM,
    suspensionTravelFrontM: physical?.suspensionTravelFrontM ?? getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelFront),
    suspensionTravelRearM: physical?.suspensionTravelRearM ?? getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelRear),
    staticSagRatioFront: physical?.staticSagRatioFront ?? tuning.staticSagRatioFront ?? tuning.staticSagRatio,
    staticSagRatioRear: physical?.staticSagRatioRear ?? tuning.staticSagRatioRear ?? tuning.staticSagRatio,
    suspensionRestLengthFrontM: tuning.suspensionRestLengthFrontM,
    suspensionRestLengthRearM: tuning.suspensionRestLengthRearM,
    antiRollFront: frontBump.antiRollNormalized,
    antiRollRear: rearBump.antiRollNormalized,
    antiRollStiffnessFrontNpm: physical?.antiRollStiffnessFrontNpm,
    antiRollStiffnessRearNpm: physical?.antiRollStiffnessRearNpm,
    rollStiffnessNormalized: tuning.rollStiffness,
    engineForceN: clamp(18000 + Math.max(0, powerW - 300000) / 45, 18000, 30000),
    engineBrakeForceN: Math.max(900, Number(tuning.weightKg || 1450) * 1.15),
    brakeForceN: Math.max(9000, Number(tuning.weightKg || 1450) * 10),
    handbrakeForceN: Math.max(4500, Number(tuning.handbrakeForceN) || Number(tuning.weightKg || 1450) * 5),
    frontBrakeBias: tuning.frontBrakeBias ?? tuning.brakeBalance ?? 0.62,
    brakePressure: tuning.brakePressure,
    rollingResistanceN: Math.max(100, Number(tuning.weightKg || 1450) * 0.12),
    dragCoefficient: physical?.dragCoefficient ?? tuning.dragCoefficient,
    frontalAreaM2: physical?.frontalAreaM2 ?? (tuning.frontalAreaM2
      || Math.max(1.55, Number(tuning.widthM || 1.8) * Number(tuning.lengthM || 4.5) * 0.26)),
    frontDownforceCoefficient: physical?.frontDownforceCoefficient
      ?? clamp(Number(tuning.aeroFront) || 0, 0, 1) * 0.6,
    rearDownforceCoefficient: physical?.rearDownforceCoefficient
      ?? clamp(Number(tuning.aeroRear) || 0, 0, 1) * 0.6,
    frontRideHeightM: physical?.frontRideHeightM ?? tuning.frontRideHeightM
      ?? (0.11 + clamp(Number(tuning.rideHeightFront ?? 0.5), 0, 1) * 0.1),
    rearRideHeightM: physical?.rearRideHeightM ?? tuning.rearRideHeightM
      ?? (0.11 + clamp(Number(tuning.rideHeightRear ?? 0.5), 0, 1) * 0.1),
    groundEffectGain: physical?.groundEffectGain ?? tuning.groundEffectGain,
    groundEffectReferenceHeightM: physical?.groundEffectReferenceHeightM ?? tuning.groundEffectReferenceHeightM,
    floorStallHeightM: physical?.floorStallHeightM ?? tuning.floorStallHeightM,
    diffuserRakeSensitivity: physical?.diffuserRakeSensitivity ?? tuning.diffuserRakeSensitivity,
    yawDragSensitivity: tuning.yawDragSensitivity,
    extremeYawLiftCoefficient: tuning.extremeYawLiftCoefficient,
    damageDragGain: tuning.damageDragGain,
    aeroMap: tuning.aeroMap,
    idleRpm: tuning.idleRpm,
    maxRpm: tuning.revLimitRpm || tuning.redlineRpm,
    revLimiterDropRpm: tuning.revLimiterDropRpm,
    handlingPreset: tuning.handlingPreset || 'sport',
    powertrainTuning: tuning,
    drivenWheelIds: drivetrain === 'AWD'
      ? [...RACE_WHEEL_IDS]
      : drivetrain === 'FWD' ? ['fl', 'fr'] : ['rl', 'rr']
  });
}

export class DeterministicTireContactSubsystem {
  step({ state, controls, config, environment = {}, dt = 0 }) {
    const staticLoad = config.massKg * 9.81 / RACE_WHEEL_IDS.length;
    const driven = new Set(config.drivenWheelIds);
    const direction = controls.requestedGear < 0 ? -1 : 1;
    const drivePerWheel = config.engineForceN * controls.throttle
      / Math.max(1, driven.size);
    const brakePerWheel = config.brakeForceN * controls.brake / RACE_WHEEL_IDS.length;
    const steerAngle = resolvePhysicalCenterSteeringAngle(controls, config, state);
    const lateralDemand = Math.abs(state.speedMps) ** 2
      * Math.tan(steerAngle) / Math.max(0.5, config.wheelbaseM)
      * config.massKg / RACE_WHEEL_IDS.length;
    const wheelLoadsN = {};
    const wheelSlip = {};
    const suspensionTravel = {};
    const tireForcesN = {};
    let longitudinalForceN = 0;
    let lateralForceN = 0;
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const contactScale = clamp(Number(environment.contactScaleByWheel?.[wheelId] ?? 1), 0, 1);
      const loadScale = Math.max(0, Number(environment.normalLoadScaleByWheel?.[wheelId] ?? 1));
      const curbLoad = Math.max(0, Number(environment.curbLoadNByWheel?.[wheelId] || 0));
      const load = (staticLoad * loadScale + curbLoad) * contactScale;
      const grip = Math.max(0.05, Number(environment.gripByWheel?.[wheelId] ?? 1));
      const capacity = load * grip;
      const drive = driven.has(wheelId) ? drivePerWheel * direction : 0;
      const handbrake = wheelId === 'rl' || wheelId === 'rr'
        ? config.handbrakeForceN * controls.handbrake * 0.5
        : 0;
      const brakeDirection = Math.abs(state.speedMps) > 0.001
        ? -Math.sign(state.speedMps)
        : -direction;
      const requestedLongitudinal = drive + (brakePerWheel + handbrake) * brakeDirection;
      const longitudinal = clamp(requestedLongitudinal, -capacity, capacity);
      const lateralSign = steerAngle === 0 ? 0 : Math.sign(steerAngle);
      const lateral = clamp(lateralDemand * lateralSign, -capacity, capacity);
      const demand = Math.hypot(requestedLongitudinal, lateralDemand);
      wheelLoadsN[wheelId] = quantize(load);
      wheelSlip[wheelId] = quantize(contactScale > 0 ? clamp(demand / Math.max(1, capacity) - 0.82, 0, 3) : 0);
      suspensionTravel[wheelId] = quantize(clamp(
        Number(environment.suspensionTravelByWheel?.[wheelId]
          ?? (load / Math.max(1, staticLoad) - 0.7) / 0.6),
        0,
        1
      ));
      tireForcesN[wheelId] = {
        longitudinal: quantize(longitudinal),
        lateral: quantize(lateral)
      };
      longitudinalForceN += longitudinal;
      lateralForceN += lateral;
    });
    return {
      dt: quantize(dt, 12),
      longitudinalForceN: quantize(longitudinalForceN),
      lateralForceN: quantize(lateralForceN),
      verticalAccelerationMps2: quantize(Number(environment.verticalAccelerationMps2 || 0)),
      groundHeightM: Number.isFinite(Number(environment.groundHeightM))
        ? quantize(environment.groundHeightM)
        : null,
      grounded: environment.grounded !== false,
      wheelLoadsN,
      wheelSlip,
      suspensionTravel,
      tireForcesN
    };
  }
}

function aggregateTireResults(results = [], tireSubstepDt = 0) {
  const count = Math.max(1, results.length);
  const accumulatedDuration = Math.max(EPSILON, results.length * tireSubstepDt);
  const average = (field) => quantize(
    results.reduce((sum, result) => sum + Number(result[field] || 0), 0) / count
  );
  const impulse = (field) => results.reduce((total, result) => addVector3(
    total,
    scaleVector3(result[field] || {}, tireSubstepDt)
  ), { x: 0, y: 0, z: 0 });
  const tireImpulseWorldNs = impulse('worldForceN');
  const suspensionImpulseWorldNs = impulse('suspensionForceWorldN');
  const externalImpulseWorldNs = impulse('externalForceWorldN');
  const tireAngularImpulseWorldNms = impulse('worldMomentNm');
  const externalAngularImpulseWorldNms = impulse('externalMomentWorldNm');
  const equivalentForce = (value) => scaleVector3(value, 1 / accumulatedDuration);
  const latest = results.at(-1) || {};
  const tireEnergyFields = [
    'longitudinalFrictionWorkJ',
    'lateralFrictionWorkJ',
    'carcassFlexWorkJ',
    'loadHeatingWorkJ',
    'surfaceConductionWorkJ',
    'waterCoolingWorkJ'
  ];
  const contactPatches = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const latestPatch = latest.contactPatches?.[wheelId] || {};
    const tireEnergyWork = Object.fromEntries(tireEnergyFields.map((field) => [
      field,
      quantize(results.reduce((sum, result) => (
        sum + Number(result.contactPatches?.[wheelId]?.tireEnergyWork?.[field] || 0)
      ), 0))
    ]));
    return [wheelId, { ...latestPatch, tireEnergyWork }];
  }));
  const suspensionImpulseByWheelNs = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    quantize(results.reduce((sum, result) => (
      sum + Number(result.contactPatches?.[wheelId]?.suspensionForceN || 0) * tireSubstepDt
    ), 0))
  ]));
  const tireVerticalImpulseByWheelNs = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    quantize(results.reduce((sum, result) => (
      sum + Number(result.contactPatches?.[wheelId]?.tireVerticalForceN || 0) * tireSubstepDt
    ), 0))
  ]));
  return {
    longitudinalForceN: average('longitudinalForceN'),
    lateralForceN: average('lateralForceN'),
    yawMomentNm: average('yawMomentNm'),
    // These equivalent forces remain useful telemetry, but chassis integration
    // consumes the corresponding impulses below. No final substep vector is
    // stretched over the public chassis interval.
    worldForceN: equivalentForce(tireImpulseWorldNs),
    worldMomentNm: equivalentForce(tireAngularImpulseWorldNms),
    suspensionForceWorldN: equivalentForce(suspensionImpulseWorldNs),
    externalForceWorldN: equivalentForce(externalImpulseWorldNs),
    externalMomentWorldNm: equivalentForce(externalAngularImpulseWorldNms),
    tireImpulseWorldNs,
    suspensionImpulseWorldNs,
    externalImpulseWorldNs,
    tireAngularImpulseWorldNms,
    externalAngularImpulseWorldNms,
    accumulatedDuration,
    targetVelocityWorld: latest.targetVelocityWorld || null,
    freeRevEngineRpm: latest.freeRevEngineRpm,
    verticalAccelerationMps2: average('verticalAccelerationMps2'),
    groundHeightM: latest.groundHeightM ?? null,
    grounded: results.some((result) => result.grounded !== false),
    wheelGrounded: latest.wheelGrounded === true,
    supportedWheelCount: Math.max(0, Number(latest.supportedWheelCount || 0)),
    validTreadContactByWheel: latest.validTreadContactByWheel || {},
    invalidContactReasonByWheel: latest.invalidContactReasonByWheel || {},
    geometricTerrainProximityByWheel: latest.geometricTerrainProximityByWheel || {},
    contactTypeByWheel: latest.contactTypeByWheel || {},
    wheelLoadsN: latest.wheelLoadsN || {},
    wheelSlip: latest.wheelSlip || {},
    suspensionTravel: latest.suspensionTravel || {},
    suspensionState: latest.suspensionState || {},
    tireForcesN: latest.tireForcesN || {},
    wheelAngularVelocityRadps: latest.wheelAngularVelocityRadps || {},
    wheelAngularMomentumReactionImpulseWorldNms: Object.fromEntries(
      RACE_WHEEL_IDS.map((wheelId) => [wheelId, results.reduce((sum, result) => addVector3(
        sum,
        result.wheelAngularMomentumReactionImpulseWorldNms?.[wheelId]
      ), { x: 0, y: 0, z: 0 })])
    ),
    contactPatches,
    suspensionImpulseByWheelNs,
    tireVerticalImpulseByWheelNs,
    aeroState: latest.aeroState || {},
    powertrainState: latest.powertrainState || {},
    powertrainTelemetry: latest.powertrainTelemetry || {},
    steeringTelemetry: latest.steeringTelemetry || {}
  };
}

function createDifference(legacyValue, shadowValue) {
  const legacy = Number(legacyValue);
  return Number.isFinite(legacy) ? quantize(Number(shadowValue || 0) - legacy) : null;
}

export function createLegacyVehicleComparisonSnapshot(legacy = null) {
  if (!legacy) return null;
  return {
    speedMps: Number(legacy.speedMps),
    position: {
      x: Number(legacy.position?.x ?? legacy.worldX),
      y: Number(legacy.position?.y ?? legacy.heightM ?? legacy.bodyY),
      z: Number(legacy.position?.z ?? legacy.worldZ)
    },
    yawRad: Number(legacy.yawRad ?? legacy.carYaw),
    yawRateRadps: Number(legacy.yawRateRadps ?? legacy.yawVelocityRadps),
    lateralAccelerationMps2: Number(
      legacy.lateralAccelerationMps2
        ?? Number(legacy.diagnostics?.lateralG) * 9.81
    ),
    wheelLoadsN: clone(legacy.wheelLoadsN || legacy.dynamicNormalLoads || legacy.diagnostics?.tireLoad),
    wheelSlip: clone(legacy.wheelSlip || legacy.tireSlipByWheel || legacy.tireSlip),
    engineRpm: Number(legacy.engineRpm),
    suspensionTravel: clone(legacy.suspensionTravel || legacy.diagnostics?.suspensionTravel)
  };
}

function compareVehicleStates(legacy, shadow) {
  if (!legacy) return null;
  const perWheel = (legacyField, shadowField) => Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    createDifference(legacyField?.[wheelId], shadowField?.[wheelId])
  ]));
  return {
    speedMps: createDifference(legacy.speedMps, shadow.speedMps),
    position: {
      x: createDifference(legacy.position?.x, shadow.position.x),
      y: createDifference(legacy.position?.y, shadow.position.y),
      z: createDifference(legacy.position?.z, shadow.position.z)
    },
    yawRad: createDifference(legacy.yawRad, shadow.yawRad),
    yawRateRadps: createDifference(legacy.yawRateRadps, shadow.yawRateRadps),
    lateralAccelerationMps2: createDifference(
      legacy.lateralAccelerationMps2,
      shadow.lateralAccelerationMps2
    ),
    wheelLoadsN: perWheel(legacy.wheelLoadsN, shadow.wheelLoadsN),
    wheelSlip: perWheel(legacy.wheelSlip, shadow.wheelSlip),
    engineRpm: createDifference(legacy.engineRpm, shadow.engineRpm),
    suspensionTravel: perWheel(legacy.suspensionTravel, shadow.suspensionTravel)
  };
}

export class VehicleDynamicsRunner {
  constructor({
    config = {},
    initialState = {},
    inputTimeline = null,
    tireContactSubsystem = null,
    environmentProvider = null,
    handlingAssist = null,
    physicsIncidentRecorder = null
  } = {}) {
    this.config = createVehicleDynamicsConfig(config);
    this.initialState = createVehicleDynamicsState(initialState);
    this.state = createVehicleDynamicsState(initialState);
    if (!initialState.wheelAngularVelocityRadps) {
      RACE_WHEEL_IDS.forEach((wheelId) => {
        const rollingAngularVelocity = this.state.speedMps / this.config.wheelRadiusM;
        this.initialState.wheelAngularVelocityRadps[wheelId] = quantize(rollingAngularVelocity);
        this.state.wheelAngularVelocityRadps[wheelId] = quantize(rollingAngularVelocity);
      });
    }
    this.inputTimeline = inputTimeline instanceof VehicleControlInputTimeline
      ? inputTimeline
      : new VehicleControlInputTimeline(inputTimeline || []);
    this.tireContactSubsystem = tireContactSubsystem || new ContactPatchTireModel();
    this.environmentProvider = typeof environmentProvider === 'function'
      ? environmentProvider
      : () => ({});
    this.handlingAssist = handlingAssist || new HandlingAssist();
    this.aeroModel = new AeroModel();
    this.bodyCollision = new ChassisBodyCollision(this.config);
    this.physicsIncidentRecorder = physicsIncidentRecorder || new PhysicsIncidentRecorder({
      tireHz: this.config.tireHz,
      preIncidentSeconds: this.config.physicsIncidentPreSeconds,
      postIncidentSeconds: this.config.physicsIncidentPostSeconds,
      enabled: this.config.physicsIncidentRecordingEnabled,
      vehicleConfiguration: this.config
    });
    this.pendingCollisionImpulses = [];
    this.collisionTimeline = [];
    this.scheduledReplayCollisions = new Map();
    this.stepIndex = 0;
    this.observedTimeSeconds = 0;
    this.telemetry = [];
    this.impactHistory = [];
    this.activeImpact = null;
    this.takeoffHistory = [];
    this.takeoffContactState = {
      initialized: false,
      frontGrounded: false,
      rearGrounded: false,
      recentFrontSuspensionImpulse: [],
      recentRearSuspensionImpulse: [],
      recentUnderbodyContacts: [],
      activeTakeoff: null
    };
    this.lastNonPenetratingState = null;
    this.nonPenetratingStateHistory = [];
    this.penetrationRecoveryState = {
      previousMaximumPenetrationM: 0,
      failedProgressSteps: 0,
      lastProgressEvaluationStep: -1,
      progressIncidentId: null,
      currentIncident: null,
      lastClearedIncidentId: null,
      sequence: 0,
      history: []
    };
    this.surfaceConsistencyCursor = 0;
    this.diagnostics = {
      completedSteps: 0,
      completedTireSubsteps: 0,
      catchUpLimitedAdvances: 0,
      backlogSteps: 0,
      peakBacklogSteps: 0,
      droppedTimeSeconds: 0
    };
    this.performanceDiagnostics = {
      environmentQueries: 0,
      retainedTelemetrySnapshots: 0,
      transientTelemetrySteps: 0,
      bodyBroadphaseRejectedSubsteps: 0,
      bodyNarrowphaseSubsteps: 0,
      lastAdvanceWallTimeMs: 0,
      peakAdvanceWallTimeMs: 0
    };
  }

  addInputSample(timeSeconds, input, options = {}) {
    const sample = this.inputTimeline.addSample(timeSeconds, input, options);
    const limit = this.config.inputTimelineLimit;
    if (limit > 1 && this.inputTimeline.samples.length > limit) {
      this.inputTimeline.samples.splice(0, this.inputTimeline.samples.length - limit);
    }
    return sample;
  }

  get simulationTimeSeconds() {
    return quantize(this.stepIndex / this.config.chassisHz, 12);
  }

  createStateSnapshot() {
    return createVehicleDynamicsState(this.state);
  }

  replaceAuthoritativeState(nextState = {}) {
    this.state = createVehicleDynamicsState(nextState);
    if (!nextState.wheelAngularVelocityRadps) {
      RACE_WHEEL_IDS.forEach((wheelId) => {
        this.state.wheelAngularVelocityRadps[wheelId] = quantize(
          this.state.speedMps / this.config.wheelRadiusM
        );
      });
    }
    this.pendingCollisionImpulses = [];
    return this.createStateSnapshot();
  }

  queueCollisionImpulse({ impulseWorldNs = {}, pointWorld = null, source = 'collision' } = {}, {
    record = true,
    stepIndex = this.stepIndex + 1
  } = {}) {
    const collision = {
      impulseWorldNs: clone(impulseWorldNs),
      pointWorld: clone(pointWorld || this.state.position),
      source
    };
    this.pendingCollisionImpulses.push(collision);
    if (record) this.collisionTimeline.push({ stepIndex, ...clone(collision) });
  }

  queueCollisionContact({
    pointWorld = null,
    normalWorld = {},
    penetrationM = 0,
    restitution = 0.2,
    friction = 0.7,
    source = 'collision-contact'
  } = {}, { record = true, stepIndex = this.stepIndex + 1 } = {}) {
    const length = Math.hypot(
      Number(normalWorld.x || 0), Number(normalWorld.y || 0), Number(normalWorld.z || 0)
    );
    if (length <= EPSILON) return;
    const collision = {
      contact: true,
      pointWorld: clone(pointWorld || this.state.position),
      normalWorld: {
        x: Number(normalWorld.x || 0) / length,
        y: Number(normalWorld.y || 0) / length,
        z: Number(normalWorld.z || 0) / length
      },
      penetrationM: quantize(Math.max(0, Number(penetrationM || 0))),
      restitution: quantize(clamp(Number(restitution), 0, 1)),
      friction: quantize(clamp(Number(friction), 0, 1.5)),
      source
    };
    this.pendingCollisionImpulses.push(collision);
    if (record) this.collisionTimeline.push({ stepIndex, ...clone(collision) });
  }

  integrateChassis(controls, tires, dt, { preintegrated = false } = {}) {
    const state = this.state;
    const config = this.config;
    let totalLinearImpulse = addVector3(addVector3(
      addVector3(tires.tireImpulseWorldNs, tires.suspensionImpulseWorldNs),
      addVector3(
        { x: 0, y: -config.massKg * 9.81 * dt, z: 0 },
        tires.externalImpulseWorldNs
      )
    ), tires.bodyCollision?.linearImpulseWorldNs);
    if (tires.targetVelocityWorld) {
      const velocityError = addVector3(tires.targetVelocityWorld, scaleVector3(state.velocity, -1));
      totalLinearImpulse.x = velocityError.x * config.massKg;
      totalLinearImpulse.z = velocityError.z * config.massKg;
    }
    let totalAngularImpulse = addVector3(
      addVector3(tires.tireAngularImpulseWorldNms, tires.externalAngularImpulseWorldNms),
      tires.bodyCollision?.angularImpulseWorldNms
    );
    let postSubstepAngularImpulse = { x: 0, y: 0, z: 0 };
    const supportedLoadN = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
      sum + Math.max(0, Number(tires.wheelLoadsN?.[wheelId] || 0))
    ), 0);
    const supportScale = clamp(supportedLoadN / Math.max(1, config.massKg * 9.81), 0, 1);
    const pitchSupportImpulse = (
      -Number(state.pitchRad || 0) * config.pitchStiffnessNmPerRad
      - Number(state.angularVelocityWorld.x || 0) * config.pitchDampingNmsPerRad
    ) * supportScale * dt;
    const rollSupportImpulse = (
      -Number(state.rollRad || 0) * config.rollStiffnessNmPerRad
      - Number(state.angularVelocityWorld.z || 0) * config.rollDampingNmsPerRad
    ) * supportScale * dt;
    totalAngularImpulse.x += pitchSupportImpulse;
    totalAngularImpulse.z += rollSupportImpulse;
    postSubstepAngularImpulse.x += pitchSupportImpulse;
    postSubstepAngularImpulse.z += rollSupportImpulse;
    const assistInterventions = this.handlingAssist.calculatePhysicalInterventions({
      preset: config.handlingPreset, state, controls, config, supportScale
    });
    assistInterventions.forEach((intervention) => {
      totalAngularImpulse = addVector3(
        totalAngularImpulse,
        scaleVector3(intervention.momentWorldNm, dt)
      );
      postSubstepAngularImpulse = addVector3(
        postSubstepAngularImpulse,
        scaleVector3(intervention.momentWorldNm, dt)
      );
    });
    const canSleep = evaluatePhysicalSleepCondition({
      state, config, tires, totalLinearImpulse, totalAngularImpulse, dt,
      pendingCollisionCount: this.pendingCollisionImpulses.length
    });
    const collisionImpulses = this.pendingCollisionImpulses.splice(0);
    collisionImpulses.forEach((collision) => {
      const { pointWorld } = collision;
      let impulseWorldNs = collision.impulseWorldNs;
      if (collision.contact) {
        const normal = collision.normalWorld;
        const arm = addVector3(pointWorld, scaleVector3(state.position, -1));
        const pointVelocity = addVector3(state.velocity, crossVector3(state.angularVelocityWorld, arm));
        const normalVelocity = dotVector3(pointVelocity, normal);
        const tangentVelocity = addVector3(pointVelocity, scaleVector3(normal, -normalVelocity));
        const tangentSpeed = Math.hypot(tangentVelocity.x, tangentVelocity.y, tangentVelocity.z);
        const normalImpulse = normalVelocity > 0
          ? config.massKg * normalVelocity * (1 + collision.restitution)
          : 0;
        const tangentImpulse = Math.min(
          config.massKg * tangentSpeed,
          normalImpulse * collision.friction
        );
        impulseWorldNs = addVector3(
          scaleVector3(normal, -normalImpulse),
          tangentSpeed > EPSILON
            ? scaleVector3(tangentVelocity, -tangentImpulse / tangentSpeed)
            : { x: 0, y: 0, z: 0 }
        );
        const correction = Math.min(0.12, Math.max(0, collision.penetrationM - 0.002) * 0.65);
        state.position = addVector3(state.position, scaleVector3(normal, -correction));
        collision.impulseWorldNs = clone(impulseWorldNs);
      }
      state.velocity = addVector3(state.velocity, scaleVector3(impulseWorldNs, 1 / config.massKg));
      const arm = addVector3(pointWorld, scaleVector3(state.position, -1));
      const collisionAngularImpulse = crossVector3(arm, impulseWorldNs);
      totalAngularImpulse = addVector3(totalAngularImpulse, collisionAngularImpulse);
      postSubstepAngularImpulse = addVector3(postSubstepAngularImpulse, collisionAngularImpulse);
    });
    const acceleration = scaleVector3(totalLinearImpulse, 1 / (config.massKg * dt));
    if (!preintegrated) {
      state.velocity = addVector3(state.velocity, scaleVector3(totalLinearImpulse, 1 / config.massKg));
      state.position = addVector3(
        addVector3(state.position, tires.bodyCollision?.positionalCorrectionWorldM),
        scaleVector3(state.velocity, dt)
      );
    }
    const groundConstraintImpulseNs = Math.max(
      0,
      Number(tires.bodyCollision?.linearImpulseWorldNs?.y || 0)
    );
    const angularMotion = integrateBodyAngularMotion({
      orientation: state.orientation,
      angularVelocityWorld: state.angularVelocityWorld,
      angularImpulseWorld: preintegrated ? postSubstepAngularImpulse : totalAngularImpulse,
      inertiaTensorBody: config.inertiaTensorBodyKgM2,
      dt: preintegrated ? 0 : dt
    });
    state.angularVelocityWorld = angularMotion.angularVelocityWorld;
    state.orientation = angularMotion.orientation;
    state.angularVelocityWorld = Object.fromEntries(Object.entries(
      state.angularVelocityWorld
    ).map(([axis, value]) => [axis, Math.abs(Number(value || 0)) < 1e-12 ? 0 : value]));
    if (canSleep) {
      state.velocity = { x: 0, y: 0, z: 0 };
      state.angularVelocityWorld = { x: 0, y: 0, z: 0 };
    }
    if (tires.targetVelocityWorld) {
      state.velocity.x = Number(tires.targetVelocityWorld.x || 0);
      state.velocity.z = Number(tires.targetVelocityWorld.z || 0);
    }
    const euler = eulerFromQuaternion(state.orientation);
    state.yawRad = quantize(normalizeAngle(euler.yaw));
    state.pitchRad = quantize(euler.pitch);
    state.rollRad = quantize(euler.roll);
    state.yawRateRadps = quantize(state.angularVelocityWorld.y);
    const forward = { x: Math.sin(state.yawRad), y: 0, z: Math.cos(state.yawRad) };
    const right = { x: Math.cos(state.yawRad), y: 0, z: -Math.sin(state.yawRad) };
    const bodyLongitudinalSpeedMps = state.velocity.x * forward.x + state.velocity.z * forward.z;
    const bodyLateralSpeedMps = state.velocity.x * right.x + state.velocity.z * right.z;
    const groundSpeedMps = Math.hypot(state.velocity.x, state.velocity.z);
    const travelDirectionThresholdMps = Math.max(0.1, groundSpeedMps * 0.02);
    const signedTravelSpeedMps = groundSpeedMps <= EPSILON
      ? 0
      : groundSpeedMps * (Math.abs(bodyLongitudinalSpeedMps) > travelDirectionThresholdMps
        ? Math.sign(bodyLongitudinalSpeedMps)
        : controls.requestedGear < 0 ? -1 : 1);
    state.speedMps = quantize(bodyLongitudinalSpeedMps);
    state.groundSpeedMps = quantize(groundSpeedMps);
    state.bodyLongitudinalSpeedMps = quantize(bodyLongitudinalSpeedMps);
    state.bodyLateralSpeedMps = quantize(bodyLateralSpeedMps);
    state.signedTravelSpeedMps = quantize(signedTravelSpeedMps);
    if (tires.targetVelocityWorld) {
      const targetMagnitude = Math.hypot(
        Number(tires.targetVelocityWorld.x || 0),
        Number(tires.targetVelocityWorld.z || 0)
      );
      state.speedMps = quantize(targetMagnitude * (controls.requestedGear < 0 ? -1 : 1));
      state.groundSpeedMps = quantize(targetMagnitude);
      state.bodyLongitudinalSpeedMps = state.speedMps;
      state.bodyLateralSpeedMps = 0;
      state.signedTravelSpeedMps = state.speedMps;
    }
    state.lateralAccelerationMps2 = quantize(acceleration.x * Math.cos(state.yawRad) - acceleration.z * Math.sin(state.yawRad));
    Object.keys(state.position).forEach((axis) => { state.position[axis] = quantize(state.position[axis]); });
    Object.keys(state.velocity).forEach((axis) => { state.velocity[axis] = quantize(state.velocity[axis]); });
    Object.keys(state.angularVelocityWorld).forEach((axis) => { state.angularVelocityWorld[axis] = quantize(state.angularVelocityWorld[axis]); });
    const authoritativePowertrain = tires.powertrainState || state.powertrainState || {};
    state.engineRpm = quantize(clamp(
      Number(authoritativePowertrain.engineRpm ?? state.engineRpm ?? config.idleRpm),
      config.idleRpm,
      config.maxRpm
    ));
    state.gear = Math.trunc(Number(authoritativePowertrain.gear ?? state.gear ?? 0));
    state.wheelGrounded = tires.wheelGrounded === true;
    state.bodyGrounded = tires.bodyCollision?.bodyGrounded === true;
    state.wheelSidewallGrounded = tires.bodyCollision?.wheelSidewallGrounded === true;
    state.grounded = state.wheelGrounded || state.bodyGrounded || state.wheelSidewallGrounded;
    state.supportedWheelCount = Math.max(0, Number(tires.supportedWheelCount || 0));
    state.validTreadContactByWheel = { ...(tires.validTreadContactByWheel || {}) };
    state.invalidContactReasonByWheel = { ...(tires.invalidContactReasonByWheel || {}) };
    state.wheelLoadsN = tires.wheelLoadsN;
    state.wheelSlip = tires.wheelSlip;
    state.suspensionTravel = tires.suspensionTravel;
    state.tireForcesN = tires.tireForcesN;
    state.wheelAngularVelocityRadps = tires.wheelAngularVelocityRadps;
    state.contactPatches = tires.contactPatches;
    state.steeringTelemetry = tires.steeringTelemetry || {};
    state.aeroState = tires.aeroState || {};
    state.powertrainState = {
      ...authoritativePowertrain,
      engineRpm: state.engineRpm,
      gear: state.gear,
      telemetry: tires.powertrainTelemetry || {}
    };
    state.suspensionState = tires.suspensionState;
    state.tireState = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
      const patch = tires.contactPatches?.[wheelId] || {};
      const previous = state.tireState?.[wheelId] || {};
      const thermal = advanceTireThermalState({
        previous,
        tire: patch.tireParameters || config.tireByWheel?.[wheelId] || {},
        patch,
        material: patch.material || {},
        ambientTemperatureC: Number(patch.ambientTemperatureC ?? 21),
        dt
      });
      const slipWorkJ = Number(thermal.frictionHeatingWorkJ || 0) / 0.78;
      return [wheelId, {
        ...patch,
        ...thermal,
        wear: quantize(clamp(Number(previous.wear || 0) + slipWorkJ * 1e-9, 0, 1)),
        damage: quantize(clamp(Number(patch.tireParameters?.damage ?? previous.damage ?? 0), 0, 100))
      }];
    }));
    state.contactPatches = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      {
        ...(state.contactPatches?.[wheelId] || {}),
        frictionHeatingWorkJ: state.tireState[wheelId].frictionHeatingWorkJ,
        carcassFlexHeatingWorkJ: state.tireState[wheelId].carcassFlexHeatingWorkJ,
        loadHeatingWorkJ: state.tireState[wheelId].loadHeatingWorkJ,
        treadTemperatureC: state.tireState[wheelId].treadTemperatureC,
        carcassTemperatureC: state.tireState[wheelId].carcassTemperatureC,
        internalAirTemperatureC: state.tireState[wheelId].internalAirTemperatureC,
        effectivePressurePsi: state.tireState[wheelId].effectivePressurePsi,
        temperatureF: state.tireState[wheelId].temperatureF
      }
    ]));
    return {
      totalForceWorldN: scaleVector3(totalLinearImpulse, 1 / dt),
      totalMomentWorldNm: scaleVector3(totalAngularImpulse, 1 / dt),
      linearImpulseWorldNs: totalLinearImpulse,
      angularImpulseWorldNms: totalAngularImpulse,
      tireImpulseWorldNs: clone(tires.tireImpulseWorldNs),
      suspensionImpulseWorldNs: clone(tires.suspensionImpulseWorldNs),
      aerodynamicAndExternalImpulseWorldNs: clone(tires.externalImpulseWorldNs),
      bodyCollisionImpulseWorldNs: clone(tires.bodyCollision?.linearImpulseWorldNs),
      bodyCollisionAngularImpulseWorldNms: clone(tires.bodyCollision?.angularImpulseWorldNms),
      bodyCollision: tires.bodyCollision || {},
      wheelAngularMomentumReactionImpulseWorldNms: clone(
        tires.wheelAngularMomentumReactionImpulseWorldNms || {}
      ),
      bodyContacts: clone(tires.bodyCollision?.contacts || []),
      collisionImpulseWorldNs: collisionImpulses.reduce((sum, collision) => (
        addVector3(sum, collision.impulseWorldNs)
      ), { x: 0, y: 0, z: 0 }),
      supportScale: quantize(supportScale),
      groundConstraintImpulseNs: quantize(groundConstraintImpulseNs),
      assistInterventions,
      sleeping: canSleep,
      collisionImpulses
    };
  }

  recordTakeoffSubstep({ timeSeconds, tireResult, bodyResult, state, environment, dt }) {
    const tracking = this.takeoffContactState;
    const currentEuler = eulerFromQuaternion(state.orientation);
    const wheelSupported = (wheelId) => tireResult.contactPatches?.[wheelId]?.inContact === true
      || Number(tireResult.wheelLoadsN?.[wheelId] || 0) > 1;
    const frontGrounded = wheelSupported('fl') || wheelSupported('fr');
    const rearGrounded = wheelSupported('rl') || wheelSupported('rr');
    const axleImpulse = (wheelIds) => wheelIds.reduce((sum, wheelId) => (
      sum + Math.max(0, Number(
        tireResult.contactPatches?.[wheelId]?.suspensionNormalLoadN
          ?? tireResult.wheelLoadsN?.[wheelId]
          ?? 0
      )) * dt
    ), 0);
    const cutoffTimeSeconds = timeSeconds - 0.25;
    tracking.recentFrontSuspensionImpulse.push({
      timeSeconds,
      impulseNs: quantize(axleImpulse(['fl', 'fr']))
    });
    tracking.recentRearSuspensionImpulse.push({
      timeSeconds,
      impulseNs: quantize(axleImpulse(['rl', 'rr']))
    });
    tracking.recentFrontSuspensionImpulse = tracking.recentFrontSuspensionImpulse.filter(
      (sample) => sample.timeSeconds >= cutoffTimeSeconds
    );
    tracking.recentRearSuspensionImpulse = tracking.recentRearSuspensionImpulse.filter(
      (sample) => sample.timeSeconds >= cutoffTimeSeconds
    );
    (bodyResult.contacts || []).filter(({ id }) => (
      /underbody|underside|rocker/.test(String(id || ''))
    )).forEach((contact) => tracking.recentUnderbodyContacts.push({
      timeSeconds: quantize(timeSeconds, 12),
      id: contact.id,
      penetrationM: quantize(contact.penetrationM || 0)
    }));
    tracking.recentUnderbodyContacts = tracking.recentUnderbodyContacts.filter(
      (sample) => sample.timeSeconds >= timeSeconds - 0.1
    );
    if (!tracking.initialized) {
      tracking.initialized = true;
      tracking.frontGrounded = frontGrounded;
      tracking.rearGrounded = rearGrounded;
      return;
    }
    const previousAnyContact = tracking.frontGrounded || tracking.rearGrounded;
    const anyContact = frontGrounded || rearGrounded;
    const bodyContact = (bodyResult.contacts || []).some(
      (contact) => contact.contactType !== 'wheel-sidewall'
    );
    const rampId = environment.authoredRampId ?? environment.rampId ?? null;
    const ensureTakeoff = () => {
      if (!tracking.activeTakeoff) {
        tracking.activeTakeoff = {
          sequence: Math.max(0, Number(this.takeoffHistory.at(-1)?.sequence || 0)) + 1,
          rampId,
          frontWheelReleaseTimeSeconds: null,
          rearWheelReleaseTimeSeconds: null,
          frontSuspensionImpulseBeforeReleaseNs: null,
          rearSuspensionImpulseBeforeReleaseNs: null,
          underbodyContactsNearCrest: [],
          pitchAngularVelocityAtFinalContactRadps: null,
          takeoffPitchAngleRad: null,
          flightPitchSamples: [],
          landingTimeSeconds: null,
          landingOrientation: null,
          complete: false
        };
      }
      if (tracking.activeTakeoff.rampId === null && rampId !== null) {
        tracking.activeTakeoff.rampId = rampId;
      }
      return tracking.activeTakeoff;
    };
    if (tracking.frontGrounded && !frontGrounded) {
      const takeoff = ensureTakeoff();
      takeoff.frontWheelReleaseTimeSeconds = quantize(timeSeconds, 12);
      takeoff.frontSuspensionImpulseBeforeReleaseNs = quantize(
        tracking.recentFrontSuspensionImpulse.reduce((sum, sample) => sum + sample.impulseNs, 0)
      );
    }
    if (tracking.rearGrounded && !rearGrounded) {
      const takeoff = ensureTakeoff();
      takeoff.rearWheelReleaseTimeSeconds = quantize(timeSeconds, 12);
      takeoff.rearSuspensionImpulseBeforeReleaseNs = quantize(
        tracking.recentRearSuspensionImpulse.reduce((sum, sample) => sum + sample.impulseNs, 0)
      );
    }
    if (previousAnyContact && !anyContact) {
      const takeoff = ensureTakeoff();
      takeoff.finalContactTimeSeconds = quantize(timeSeconds, 12);
      takeoff.pitchAngularVelocityAtFinalContactRadps = quantize(
        state.angularVelocityWorld?.x || 0
      );
      takeoff.takeoffPitchAngleRad = quantize(currentEuler.pitch || 0);
      takeoff.underbodyContactsNearCrest = clone(tracking.recentUnderbodyContacts);
    }
    if (!anyContact && tracking.activeTakeoff?.finalContactTimeSeconds !== undefined) {
      tracking.activeTakeoff.flightPitchSamples.push({
        timeSeconds: quantize(timeSeconds, 12),
        pitchAngleRad: quantize(currentEuler.pitch || 0),
        pitchAngularVelocityRadps: quantize(state.angularVelocityWorld?.x || 0)
      });
    }
    if (!previousAnyContact && (anyContact || bodyContact) && tracking.activeTakeoff) {
      const takeoff = tracking.activeTakeoff;
      takeoff.landingTimeSeconds = quantize(timeSeconds, 12);
      takeoff.landingOrientation = {
        quaternion: clone(state.orientation),
        yawRad: quantize(currentEuler.yaw || 0),
        pitchRad: quantize(currentEuler.pitch || 0),
        rollRad: quantize(currentEuler.roll || 0)
      };
      takeoff.complete = true;
      this.takeoffHistory.push(takeoff);
      if (this.takeoffHistory.length > 128) this.takeoffHistory.shift();
      tracking.activeTakeoff = null;
    }
    tracking.frontGrounded = frontGrounded;
    tracking.rearGrounded = rearGrounded;
  }

  createRecoverySourceKey({ state, routeDistance = null, triangleIds = [], terrainSources = [] } = {}) {
    const spatialQuantumM = 0.25;
    const x = finiteNumber(state?.position?.x);
    const z = finiteNumber(state?.position?.z);
    const route = finiteNumber(routeDistance);
    const spatial = x === null || z === null
      ? 'unknown'
      : `${Math.round(x / spatialQuantumM)}:${Math.round(z / spatialQuantumM)}`;
    const routeRegion = route === null ? 'none' : Math.round(route / 0.5);
    return [
      'safe',
      spatial,
      routeRegion,
      stableIdentityValues(triangleIds).join(','),
      stableIdentityValues(terrainSources).join(','),
      this.config.bodyProfile?.preset || this.config.bodyShapePreset || 'car'
    ].join('|');
  }

  createLastNonPenetratingState(state, tireResult, simulationStep, validation = {}) {
    const penetrationSample = validation.penetrationSample || {};
    const bodyResult = validation.bodyResult || {};
    const routeDistance = finiteNumber(validation.routeDistanceM ?? state.routeDistance);
    const patchValues = Object.values(tireResult.contactPatches || state.contactPatches || {});
    const maximumWheelOvertravelM = Math.max(0, ...Object.values(
      tireResult.suspensionState || state.suspensionState || {}
    ).map((suspension) => Number(suspension?.overtravelM || 0)));
    const bodyClearanceM = penetrationSample.maximumPenetrationM === null
      || penetrationSample.maximumPenetrationM === undefined
      ? this.config.penetrationRecoverySafetyMarginM
      : Math.max(0, -Number(penetrationSample.maximumPenetrationM));
    const triangleIds = stableIdentityValues([
      ...(penetrationSample.terrainTriangleIds || []),
      ...patchValues.map((patch) => patch?.terrainTriangleId)
    ]);
    const terrainSources = stableIdentityValues([
      ...(penetrationSample.terrainSources || []),
      ...patchValues.map((patch) => patch?.terrainSampleSource)
    ]);
    const terrainSamplesValid = Number(penetrationSample.invalidTerrainSampleCount || 0) === 0
      && !patchValues.some((patch) => patch?.terrainSampleValid === false);
    const unresolvedBodyContact = Number(
      bodyResult.residualPenetrationM ?? penetrationSample.maximumPenetrationM ?? 0
    ) > this.config.bodyCollisionToleranceM + 1e-6;
    const eligibleForRecovery = bodyClearanceM >= this.config.penetrationRecoverySafetyMarginM
      && maximumWheelOvertravelM <= 1e-6
      && terrainSamplesValid
      && !unresolvedBodyContact
      && isFiniteVehiclePose(state);
    const sourceKey = this.createRecoverySourceKey({
      state,
      routeDistance,
      triangleIds,
      terrainSources
    });
    return {
      position: clone(state.position),
      orientation: clone(state.orientation),
      velocity: clone(state.velocity),
      angularVelocityWorld: clone(state.angularVelocityWorld),
      suspensionState: clone(tireResult.suspensionState || state.suspensionState || {}),
      wheelState: {
        wheelAngularVelocityRadps: clone(tireResult.wheelAngularVelocityRadps
          || state.wheelAngularVelocityRadps || {}),
        wheelLoadsN: clone(tireResult.wheelLoadsN || state.wheelLoadsN || {}),
        wheelSlip: clone(tireResult.wheelSlip || state.wheelSlip || {}),
        contactPatches: clone(tireResult.contactPatches || state.contactPatches || {})
      },
      powertrainState: clone(tireResult.powertrainState || state.powertrainState || {}),
      simulationStep,
      routeDistance,
      bodyClearanceM: quantize(bodyClearanceM),
      maximumWheelOvertravelM: quantize(maximumWheelOvertravelM),
      terrainSamplesValid,
      unresolvedBodyContact,
      eligibleForRecovery,
      triangleIds,
      terrainSources,
      sourceKey
    };
  }

  recordNonPenetratingState(state, tireResult, simulationStep, validation = {}) {
    const snapshot = this.createLastNonPenetratingState(
      state, tireResult, simulationStep, validation
    );
    this.lastNonPenetratingState = snapshot;
    const previous = this.nonPenetratingStateHistory.at(-1);
    if (previous?.sourceKey !== snapshot.sourceKey) {
      this.nonPenetratingStateHistory.push(snapshot);
      if (this.nonPenetratingStateHistory.length > this.config.penetrationHistoryLimit) {
        this.nonPenetratingStateHistory.splice(
          0,
          this.nonPenetratingStateHistory.length - this.config.penetrationHistoryLimit
        );
      }
    }
    return snapshot;
  }

  createPenetrationIncidentId({ state, tireResult, bodyResult, penetrationSample, environment }) {
    const position = state.position || {};
    const spatialQuantumM = this.config.penetrationIncidentSpatialQuantumM;
    const routeQuantumM = this.config.penetrationIncidentRouteQuantumM;
    const routeDistance = finiteNumber(
      environment.physicsIncidentDiagnostics?.routeDistanceM
        ?? environment.routeDistanceM
        ?? state.routeDistance
    );
    const triangleIds = stableIdentityValues([
      ...(penetrationSample.terrainTriangleIds || []),
      ...(bodyResult.contacts || []).map((contact) => contact.triangleId),
      ...Object.values(tireResult.contactPatches || {}).map((patch) => patch?.terrainTriangleId)
    ]);
    const featureIds = stableIdentityValues([
      ...(penetrationSample.penetratingFeatureIds || []),
      ...(bodyResult.contacts || []).map((contact) => contact.id)
    ]);
    const terrainSources = stableIdentityValues([
      ...(penetrationSample.terrainSources || []),
      ...(bodyResult.contacts || []).map((contact) => contact.terrainSource),
      ...Object.values(tireResult.contactPatches || {}).map((patch) => patch?.terrainSampleSource)
    ]);
    const region = `${Math.floor(Number(position.x || 0) / spatialQuantumM)}:${Math.floor(
      Number(position.z || 0) / spatialQuantumM
    )}`;
    const routeRegion = routeDistance === null ? 'none' : Math.floor(routeDistance / routeQuantumM);
    return [
      'penetration',
      region,
      routeRegion,
      triangleIds.join(','),
      featureIds.join(','),
      terrainSources.join(','),
      this.config.bodyProfile?.preset || this.config.bodyShapePreset || 'car'
    ].join('|');
  }

  ensurePenetrationIncident(context) {
    if (this.penetrationRecoveryState.currentIncident) {
      return this.penetrationRecoveryState.currentIncident;
    }
    const id = this.createPenetrationIncidentId(context);
    const routeDistance = finiteNumber(
      context.environment.physicsIncidentDiagnostics?.routeDistanceM
        ?? context.environment.routeDistanceM
        ?? context.state.routeDistance
    );
    const incident = {
      id,
      openedStepIndex: context.stepIndex,
      anchorPosition: clone(context.state.position),
      anchorRouteDistance: routeDistance,
      lastFailureStepIndex: context.stepIndex,
      lastRecoveryStepIndex: -1,
      nonPenetratingSteps: 0,
      recoveryCount: 0,
      historicalRecoveryCount: 0,
      routeRecoveryCount: 0,
      hardFailureCount: 0,
      sourceBlacklist: [],
      failedPathSourceKeys: [],
      failedPaths: [],
      lastRecoverySourceKey: null,
      lastRecoveryPosition: null,
      lastRecoveryRouteDistance: null,
      hardFailure: false
    };
    this.penetrationRecoveryState.currentIncident = incident;
    return incident;
  }

  updatePenetrationIncidentClearState({ state, penetrationSample, stepIndex }) {
    const incident = this.penetrationRecoveryState.currentIncident;
    if (!incident || incident.lastClearEvaluationStep === stepIndex) return false;
    incident.lastClearEvaluationStep = stepIndex;
    const nonPenetrating = isFiniteVehiclePose(state)
      && Number(penetrationSample.invalidTerrainSampleCount || 0) === 0
      && Number(penetrationSample.maximumPenetrationM || 0)
        <= this.config.bodyCollisionToleranceM + 1e-6;
    incident.nonPenetratingSteps = nonPenetrating ? incident.nonPenetratingSteps + 1 : 0;
    const distanceM = Math.hypot(
      Number(state.position?.x || 0) - Number(incident.anchorPosition?.x || 0),
      Number(state.position?.z || 0) - Number(incident.anchorPosition?.z || 0)
    );
    const requiredSteps = Math.ceil(
      this.config.penetrationIncidentClearSeconds * this.config.chassisHz
    );
    if (distanceM < this.config.penetrationIncidentClearDistanceM
      || incident.nonPenetratingSteps < requiredSteps) return false;
    this.penetrationRecoveryState.lastClearedIncidentId = incident.id;
    this.penetrationRecoveryState.currentIncident = null;
    this.penetrationRecoveryState.failedProgressSteps = 0;
    this.penetrationRecoveryState.previousMaximumPenetrationM = 0;
    this.penetrationRecoveryState.progressIncidentId = null;
    return true;
  }

  sampleSurfaceConsistency({ previousState, proposedState, tireResult, bodyResult, environment }) {
    const physicsSample = environment.sampleTerrainAtWorldPoint;
    const renderedSample = environment.sampleRenderedTerrainAtWorldPoint
      || environment.sampleBakedTerrainAtWorldPoint;
    if (typeof physicsSample !== 'function' || typeof renderedSample !== 'function') {
      return { samples: [], discrepancies: [] };
    }
    const points = [
      { id: 'cg-previous', point: previousState.position },
      { id: 'cg-proposed', point: proposedState.position }
    ];
    const bodyContactIds = new Set((bodyResult?.contacts || []).map((contact) => contact.id));
    this.bodyCollision.candidates.filter((candidate) => bodyContactIds.has(candidate.id)).forEach((candidate) => {
      const previousArm = rotateVectorByQuaternion(candidate.localPoint, previousState.orientation);
      const proposedArm = rotateVectorByQuaternion(candidate.localPoint, proposedState.orientation);
      points.push({ id: `body-${candidate.id}-previous`, point: addVector3(previousState.position, previousArm) });
      points.push({ id: `body-${candidate.id}-proposed`, point: addVector3(proposedState.position, proposedArm) });
    });
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const previousPoint = previousState.contactPatches?.[wheelId]?.contactPointWorld;
      const proposedPoint = tireResult.contactPatches?.[wheelId]?.contactPointWorld;
      if (previousPoint) points.push({ id: `wheel-${wheelId}-previous`, point: previousPoint });
      if (proposedPoint) points.push({ id: `wheel-${wheelId}-proposed`, point: proposedPoint });
    });
    const sampleCount = Math.min(this.config.surfaceConsistencySamplesPerCheck, points.length);
    const selectedPoints = Array.from({ length: sampleCount }, (_unused, offset) => (
      points[(this.surfaceConsistencyCursor + offset) % points.length]
    ));
    this.surfaceConsistencyCursor = points.length
      ? (this.surfaceConsistencyCursor + sampleCount) % points.length
      : 0;
    const samples = selectedPoints.map(({ id, point }) => {
      const physics = createSurfaceSample(physicsSample(point), {
        queryPosition: point,
        source: 'physics-consistency-query'
      });
      const rendered = createSurfaceSample(
        typeof renderedSample === 'function' ? renderedSample(point) : null,
        { queryPosition: point, source: 'rendered-consistency-query' }
      );
      const physicsHeightM = physics.valid ? physics.heightM : null;
      const renderedHeightM = rendered.valid ? rendered.heightM : null;
      const differenceM = physics.valid && rendered.valid
        ? Math.abs(physicsHeightM - renderedHeightM)
        : null;
      return {
        id,
        point: clone(point),
        physicsHeightM: Number.isFinite(physicsHeightM) ? quantize(physicsHeightM) : null,
        renderedHeightM: Number.isFinite(renderedHeightM) ? quantize(renderedHeightM) : null,
        differenceM: differenceM === null ? null : quantize(differenceM),
        discrepancy: differenceM !== null
          && differenceM > this.config.terrainDiscrepancyToleranceM
      };
    });
    return { samples, discrepancies: samples.filter((sample) => sample.discrepancy) };
  }

  updateDerivedMotionState(state) {
    const euler = eulerFromQuaternion(state.orientation);
    state.yawRad = normalizeAngle(euler.yaw);
    state.pitchRad = euler.pitch;
    state.rollRad = euler.roll;
    state.yawRateRadps = Number(state.angularVelocityWorld?.y || 0);
    state.pitchRateRadps = Number(state.angularVelocityWorld?.x || 0);
    state.rollRateRadps = Number(state.angularVelocityWorld?.z || 0);
    state.groundSpeedMps = Math.hypot(Number(state.velocity?.x || 0), Number(state.velocity?.z || 0));
    const forward = { x: Math.sin(state.yawRad), y: 0, z: Math.cos(state.yawRad) };
    const right = { x: Math.cos(state.yawRad), y: 0, z: -Math.sin(state.yawRad) };
    state.bodyLongitudinalSpeedMps = dotVector3(state.velocity, forward);
    state.bodyLateralSpeedMps = dotVector3(state.velocity, right);
    state.signedTravelSpeedMps = state.groundSpeedMps
      * (Math.sign(state.bodyLongitudinalSpeedMps) || 1);
  }

  createSweptWheelCylinders({ tireResult, previousState, proposedState }) {
    return RACE_WHEEL_IDS.flatMap((wheelId) => {
      const patch = tireResult.contactPatches?.[wheelId];
      const hub = patch?.hubPositionWorld || patch?.wheelCenterWorld;
      if (!hub) return [];
      const startPosition = previousState?.position || proposedState?.position || {};
      const startOrientation = previousState?.orientation || proposedState?.orientation
        || { x: 0, y: 0, z: 0, w: 1 };
      const endPosition = proposedState?.position || startPosition;
      const endOrientation = proposedState?.orientation || startOrientation;
      const transformPointToProposedPose = (point) => addVector3(
        endPosition,
        rotateVectorByQuaternion(
          rotateVectorToBody(addVector3(point, scaleVector3(startPosition, -1)), startOrientation),
          endOrientation
        )
      );
      const transformAxisToProposedPose = (axis) => rotateVectorByQuaternion(
        rotateVectorToBody(axis, startOrientation), endOrientation
      );
      const previousLateral = patch.wheelLateralWorld || { x: 1, y: 0, z: 0 };
      const previousForward = patch.wheelForwardWorld || { x: 0, y: 0, z: 1 };
      const previousSuspension = patch.suspensionAxisWorld || { x: 0, y: -1, z: 0 };
      const radiusM = Math.max(0.1, Number(patch.effectiveRollingRadiusM || this.config.wheelRadiusM));
      const widthM = Math.max(0.08, Number(this.config.tireByWheel?.[wheelId]?.widthMm || 225) / 1000);
      return [{
        wheelId,
        previousHubPositionWorld: { ...hub },
        hubPositionWorld: transformPointToProposedPose(hub),
        previousWheelForwardWorld: { ...previousForward },
        wheelForwardWorld: transformAxisToProposedPose(previousForward),
        previousWheelLateralWorld: { ...previousLateral },
        wheelLateralWorld: transformAxisToProposedPose(previousLateral),
        previousSuspensionAxisWorld: { ...previousSuspension },
        suspensionAxisWorld: transformAxisToProposedPose(previousSuspension),
        radiusM,
        widthM,
        validTreadContact: patch.validTreadContact === true,
        collisionFriction: this.config.bodyCollisionFriction
      }];
    });
  }

  createWheelCollisionSupportFeatures(tireResult, previousState = null, proposedState = null) {
    const referenceState = proposedState || previousState || this.state;
    const cylinders = this.createSweptWheelCylinders({
      tireResult,
      previousState: previousState || referenceState,
      proposedState: referenceState
    });
    return createWheelCylinderSupportFeatures(cylinders, 1);
  }

  isHistoricalRecoverySourceEligible(candidate, {
    failedPosition, environment, stepIndex, incident, ignoreSeparation = false
  }) {
    if (!candidate || candidate.eligibleForRecovery === false
      || candidate.terrainSamplesValid === false
      || candidate.unresolvedBodyContact === true
      || Number(candidate.maximumWheelOvertravelM || 0) > 1e-6
      || Number(candidate.bodyClearanceM ?? this.config.penetrationRecoverySafetyMarginM)
        < this.config.penetrationRecoverySafetyMarginM
      || incident.sourceBlacklist.includes(candidate.sourceKey)
      || incident.failedPathSourceKeys.includes(candidate.sourceKey)) return false;
    const ageSteps = Math.max(0, stepIndex - Number(candidate.simulationStep || 0));
    const distanceM = Math.hypot(
      Number(candidate.position?.x || 0) - Number(failedPosition.x || 0),
      Number(candidate.position?.z || 0) - Number(failedPosition.z || 0)
    );
    const separated = ageSteps >= Math.ceil(
      this.config.penetrationRecoveryMinimumAgeSeconds * this.config.chassisHz
    ) || distanceM >= this.config.penetrationRecoveryMinimumDistanceM;
    if (!ignoreSeparation && !separated) return false;
    const maximumAgeSteps = Math.max(1, Math.ceil(
      this.config.penetrationHistoryMaximumAgeSeconds * this.config.chassisHz
    ));
    const candidateSpeedMps = Math.hypot(
      Number(candidate.velocity?.x || 0),
      Number(candidate.velocity?.y || 0),
      Number(candidate.velocity?.z || 0)
    );
    const maximumReachM = Math.max(
      2,
      candidateSpeedMps * this.config.penetrationHistoryMaximumAgeSeconds + 1
    );
    if (ageSteps > maximumAgeSteps || distanceM > maximumReachM) return false;
    const sample = this.bodyCollision.samplePosePenetration(
      candidate, environment, this.config.bodyCollisionToleranceM
    );
    return sample.maximumPenetrationM !== null
      && sample.maximumPenetrationM <= -this.config.penetrationRecoverySafetyMarginM + 1e-6
      && Number(sample.invalidTerrainSampleCount || 0) === 0;
  }

  selectHistoricalRecoverySource({ failedPosition, environment, stepIndex, incident,
    ignoreCircuitBreaker = false, ignoreSeparation = false }) {
    if (!ignoreCircuitBreaker && incident.historicalRecoveryCount >= 1) return null;
    const history = this.nonPenetratingStateHistory.length
      ? this.nonPenetratingStateHistory
      : (this.lastNonPenetratingState ? [this.lastNonPenetratingState] : []);
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const candidate = history[index];
      if (this.isHistoricalRecoverySourceEligible(candidate, {
        failedPosition, environment, stepIndex, incident, ignoreSeparation
      })) return candidate;
    }
    return null;
  }

  validateRouteRecoveryCandidate(candidate, environment, incident) {
    if (!candidate?.position) return null;
    const rawValues = [candidate.position.x, candidate.position.y, candidate.position.z];
    if (candidate.orientation) rawValues.push(
      candidate.orientation.x,
      candidate.orientation.y,
      candidate.orientation.z,
      candidate.orientation.w
    );
    if (candidate.velocity) rawValues.push(
      candidate.velocity.x ?? 0, candidate.velocity.y ?? 0, candidate.velocity.z ?? 0
    );
    if (candidate.angularVelocityWorld) rawValues.push(
      candidate.angularVelocityWorld.x ?? 0,
      candidate.angularVelocityWorld.y ?? 0,
      candidate.angularVelocityWorld.z ?? 0
    );
    if (!rawValues.every((value) => Number.isFinite(Number(value)))) return null;
    const routeDistance = finiteNumber(candidate.routeDistance);
    if (routeDistance === null) return null;
    const state = createVehicleDynamicsState(candidate);
    if (!isFiniteVehiclePose(state)) return null;
    const sample = this.bodyCollision.samplePosePenetration(
      state, environment, this.config.bodyCollisionToleranceM
    );
    const validation = candidate.recoveryValidation || {};
    if (sample.maximumPenetrationM === null
      || sample.maximumPenetrationM > -this.config.penetrationRecoverySafetyMarginM + 1e-6
      || Number(sample.invalidTerrainSampleCount || 0) > 0
      || validation.terrainSamplesValid === false
      || validation.wheelsValid === false
      || validation.bodyResolved === false
      || Number(validation.maximumWheelOvertravelM || 0) > 1e-6) return null;
    const sourceKey = candidate.sourceKey || this.createRecoverySourceKey({
      state,
      routeDistance,
      triangleIds: validation.triangleIds || sample.terrainTriangleIds,
      terrainSources: validation.terrainSources || sample.terrainSources
    });
    if (incident.sourceBlacklist.includes(sourceKey)
      || incident.failedPathSourceKeys.includes(sourceKey)) return null;
    const repeatsFailedPath = (incident.failedPaths || []).some((failedPath) => {
      const routeSeparationM = routeDistance !== null && finiteNumber(failedPath.routeDistance) !== null
        ? Math.abs(routeDistance - Number(failedPath.routeDistance)) : Infinity;
      const spatialSeparationM = failedPath.position ? Math.hypot(
        Number(state.position.x || 0) - Number(failedPath.position.x || 0),
        Number(state.position.z || 0) - Number(failedPath.position.z || 0)
      ) : Infinity;
      return routeSeparationM < this.config.penetrationRecoveryMinimumDistanceM
        || spatialSeparationM < this.config.penetrationRecoveryMinimumDistanceM;
    });
    if (repeatsFailedPath) return null;
    return {
      ...candidate,
      ...state,
      routeDistance,
      sourceKey,
      recoveryValidation: {
        ...validation,
        terrainSamplesValid: true,
        wheelsValid: true,
        bodyResolved: true,
        bodyClearanceM: quantize(-Number(sample.maximumPenetrationM))
      }
    };
  }

  requestRouteRecoverySource({ reason, substepState, environment, stepIndex, incident, stage }) {
    if (typeof environment.getRouteRecoveryState !== 'function') return null;
    const preferredRouteDistances = [
      ...this.nonPenetratingStateHistory.slice().reverse()
        .filter((state) => state.eligibleForRecovery === true)
        .map((state) => state.routeDistance),
      this.lastNonPenetratingState?.eligibleForRecovery === true
        ? this.lastNonPenetratingState.routeDistance : null,
      incident.anchorRouteDistance
    ].map(finiteNumber).filter((value) => value !== null)
      .filter((value, index, values) => values.indexOf(value) === index);
    const rejectedSourceKeys = new Set([
      ...incident.sourceBlacklist, ...incident.failedPathSourceKeys
    ]);
    for (let attempt = 0; attempt < 128; attempt += 1) {
      const requested = environment.getRouteRecoveryState({
        failedState: clone(substepState),
        lastSafeState: clone(this.lastNonPenetratingState),
        preferredRouteDistances,
        rejectedSourceKeys: [...rejectedSourceKeys],
        failedRecoveryPaths: clone(incident.failedPaths || []),
        penetrationIncidentId: incident.id,
        reason,
        stage,
        stepIndex
      });
      const candidates = Array.isArray(requested) ? requested : requested ? [requested] : [];
      if (!candidates.length) break;
      let discoveredSource = false;
      for (const candidate of candidates) {
        const validated = this.validateRouteRecoveryCandidate(candidate, environment, incident);
        if (validated) return validated;
        if (candidate?.sourceKey && !rejectedSourceKeys.has(candidate.sourceKey)) {
          rejectedSourceKeys.add(candidate.sourceKey);
          discoveredSource = true;
        }
      }
      if (!discoveredSource) break;
    }
    return null;
  }

  recoverFromPenetration({ reason, substepState, environment, stepIndex,
    tireResult = {}, bodyResult = {}, penetrationSample = {}, blockingNormal = null }) {
    const failedPosition = clone(substepState.position);
    const incident = this.ensurePenetrationIncident({
      state: substepState,
      tireResult,
      bodyResult,
      penetrationSample,
      environment,
      stepIndex
    });
    incident.lastFailureStepIndex = stepIndex;
    if (incident.lastRecoverySourceKey
      && !incident.failedPathSourceKeys.includes(incident.lastRecoverySourceKey)) {
      incident.failedPathSourceKeys.push(incident.lastRecoverySourceKey);
      incident.failedPaths.push({
        sourceKey: incident.lastRecoverySourceKey,
        position: clone(incident.lastRecoveryPosition),
        routeDistance: incident.lastRecoveryRouteDistance
      });
    }
    let restored = this.selectHistoricalRecoverySource({
      failedPosition, environment, stepIndex, incident
    });
    let recoveryMode = restored ? 'historical' : null;
    if (!restored && incident.routeRecoveryCount < 1) {
      restored = this.requestRouteRecoverySource({
        reason, substepState, environment, stepIndex, incident, stage: 'route'
      });
      recoveryMode = restored ? 'route' : null;
    }
    let hardFailure = false;
    if (!restored) {
      hardFailure = true;
      restored = this.requestRouteRecoverySource({
        reason, substepState, environment, stepIndex, incident, stage: 'hard-stop'
      }) || this.selectHistoricalRecoverySource({
        failedPosition,
        environment,
        stepIndex,
        incident,
        ignoreCircuitBreaker: true,
        ignoreSeparation: true
      });
      recoveryMode = restored ? 'hard-stop' : 'hard-stop-unresolved';
    }
    const routeRecoveryState = recoveryMode === 'route'
      || (recoveryMode === 'hard-stop' && Boolean(restored?.recoveryValidation));
    const normalized = restored?.wheelState ? restored : restored ? {
      position: clone(restored.position),
      orientation: clone(restored.orientation),
      velocity: clone(restored.velocity || {}),
      angularVelocityWorld: clone(restored.angularVelocityWorld || {}),
      suspensionState: clone(restored.suspensionState || {}),
      wheelState: {
        wheelAngularVelocityRadps: clone(restored.wheelAngularVelocityRadps || {}),
        wheelLoadsN: clone(restored.wheelLoadsN || {}),
        wheelSlip: clone(restored.wheelSlip || {}),
        contactPatches: clone(restored.contactPatches || {})
      },
      powertrainState: clone(restored.powertrainState || {}),
      simulationStep: stepIndex,
      routeDistance: restored.routeDistance,
      sourceKey: restored.sourceKey
    } : null;
    const velocityBeforeRecovery = clone(substepState.velocity);
    const normal = normalizeRecoveryNormal(
      blockingNormal || penetrationSample.deepestNormal || { x: 0, y: 1, z: 0 }
    );
    const repeatedIncident = incident.recoveryCount > 0;
    if (normalized) {
      substepState.position = clone(normalized.position);
      substepState.orientation = clone(normalized.orientation);
      const sourceVelocity = clone(normalized.velocity || {});
      const intoNormalSpeedMps = Math.min(0, dotVector3(sourceVelocity, normal));
      let safeVelocity = addVector3(sourceVelocity, scaleVector3(normal, -intoNormalSpeedMps));
      const safeSpeedMps = Math.hypot(
        Number(safeVelocity.x || 0), Number(safeVelocity.y || 0), Number(safeVelocity.z || 0)
      );
      if (safeSpeedMps > this.config.penetrationRecoveryMaximumTangentSpeedMps) {
        safeVelocity = scaleVector3(
          safeVelocity,
          this.config.penetrationRecoveryMaximumTangentSpeedMps / safeSpeedMps
        );
      }
      substepState.velocity = repeatedIncident || hardFailure
        ? { x: 0, y: 0, z: 0 }
        : safeVelocity;
      substepState.angularVelocityWorld = repeatedIncident || hardFailure
        ? { x: 0, y: 0, z: 0 }
        : {
            x: 0,
            y: clamp(Number(normalized.angularVelocityWorld?.y || 0), -0.5, 0.5),
            z: 0
          };
      substepState.suspensionState = clone(normalized.suspensionState || {});
      substepState.wheelAngularVelocityRadps = clone(
        normalized.wheelState?.wheelAngularVelocityRadps || {}
      );
      substepState.wheelLoadsN = clone(normalized.wheelState?.wheelLoadsN || {});
      substepState.wheelSlip = clone(normalized.wheelState?.wheelSlip || {});
      substepState.contactPatches = clone(normalized.wheelState?.contactPatches || {});
      substepState.powertrainState = clone(normalized.powertrainState || {});
    } else {
      substepState.velocity = { x: 0, y: 0, z: 0 };
      substepState.angularVelocityWorld = { x: 0, y: 0, z: 0 };
    }
    this.updateDerivedMotionState(substepState);
    const sourceKey = normalized?.sourceKey || `unresolved:${incident.id}`;
    if (!incident.sourceBlacklist.includes(sourceKey)) incident.sourceBlacklist.push(sourceKey);
    incident.lastRecoverySourceKey = sourceKey;
    incident.lastRecoveryPosition = clone(substepState.position);
    incident.lastRecoveryRouteDistance = finiteNumber(normalized?.routeDistance);
    incident.lastRecoveryStepIndex = stepIndex;
    incident.recoveryCount += 1;
    if (recoveryMode === 'historical') incident.historicalRecoveryCount += 1;
    if (recoveryMode === 'route') incident.routeRecoveryCount += 1;
    if (hardFailure) {
      incident.hardFailure = true;
      incident.hardFailureCount += 1;
    }
    const recovery = {
      sequence: ++this.penetrationRecoveryState.sequence,
      stepIndex,
      reason,
      penetrationIncidentId: incident.id,
      recoveryMode,
      hardFailure,
      restoredSimulationStep: normalized?.simulationStep ?? null,
      usedLastNonPenetratingState: recoveryMode === 'historical',
      usedRouteRecoveryPath: routeRecoveryState,
      sourceKey,
      sourceAgeSteps: recoveryMode === 'historical'
        ? Math.max(0, stepIndex - Number(normalized?.simulationStep || 0)) : null,
      rewindDistanceM: normalized ? quantize(Math.hypot(
        Number(normalized.position?.x || 0) - Number(failedPosition.x || 0),
        Number(normalized.position?.z || 0) - Number(failedPosition.z || 0)
      )) : 0,
      routeDistance: finiteNumber(normalized?.routeDistance),
      blockingNormal: normal,
      velocityBeforeRecovery,
      velocityAfterRecovery: clone(substepState.velocity),
      velocityIntoBlockingNormalMps: quantize(dotVector3(substepState.velocity, normal)),
      sourceBlacklistSize: incident.sourceBlacklist.length,
      historicalRecoveryCount: incident.historicalRecoveryCount,
      routeRecoveryCount: incident.routeRecoveryCount,
      position: clone(substepState.position)
    };
    this.penetrationRecoveryState.history.push(recovery);
    if (this.penetrationRecoveryState.history.length > 128) {
      this.penetrationRecoveryState.history.shift();
    }
    this.penetrationRecoveryState.failedProgressSteps = 0;
    this.penetrationRecoveryState.previousMaximumPenetrationM = 0;
    this.penetrationRecoveryState.progressIncidentId = null;
    return recovery;
  }

  runStep(legacySnapshot = null) {
    const nextStepIndex = this.stepIndex + 1;
    const chassisStepPreImpactKineticEnergyJ = calculateKineticEnergyJ(this.state, this.config);
    const preImpactVerticalVelocityMps = Number(this.state.velocity?.y || 0);
    (this.scheduledReplayCollisions.get(nextStepIndex) || []).forEach((collision) => {
      if (collision.contact) {
        this.queueCollisionContact(collision, { record: false, stepIndex: nextStepIndex });
      } else {
        this.queueCollisionImpulse(collision, { record: false, stepIndex: nextStepIndex });
      }
    });
    const stepTimeSeconds = nextStepIndex / this.config.chassisHz;
    const sampledControls = this.inputTimeline.sampleAt(stepTimeSeconds);
    const previousHandbrakeCommand = this.state.handbrakeCommandState || {};
    const holdSequence = Math.max(0, Math.trunc(Number(sampledControls.handbrakeHoldSequence || 0)));
    const newHoldCommand = holdSequence > Math.max(0, Math.trunc(Number(
      previousHandbrakeCommand.consumedHoldSequence || 0
    )));
    let handbrakeRemainingSeconds = newHoldCommand
      ? Math.max(0, Number(sampledControls.handbrakeHoldSeconds || 0.36))
      : Math.max(0, Number(previousHandbrakeCommand.remainingSeconds || 0));
    const directHandbrake = Number(sampledControls.handbrake || 0) > 0.001;
    const authoritativeHandbrakeActive = directHandbrake || handbrakeRemainingSeconds > EPSILON;
    const controls = {
      ...sampledControls,
      handbrake: authoritativeHandbrakeActive ? Math.max(1, Number(sampledControls.handbrake || 0)) : 0
    };
    handbrakeRemainingSeconds = directHandbrake
      ? handbrakeRemainingSeconds
      : Math.max(0, handbrakeRemainingSeconds - 1 / this.config.chassisHz);
    this.state.handbrakeCommandState = {
      active: authoritativeHandbrakeActive,
      remainingSeconds: quantize(handbrakeRemainingSeconds, 12),
      consumedHoldSequence: Math.max(
        Math.trunc(Number(previousHandbrakeCommand.consumedHoldSequence || 0)), holdSequence
      ),
      direct: directHandbrake
    };
    const tireResults = [];
    const bodyCollisionResults = [];
    let substepState = {
      ...this.state,
      position: { ...this.state.position },
      velocity: { ...this.state.velocity },
      angularVelocityWorld: { ...this.state.angularVelocityWorld },
      orientation: { ...this.state.orientation },
      wheelLoadsN: { ...this.state.wheelLoadsN },
      wheelSlip: { ...this.state.wheelSlip },
      suspensionTravel: { ...this.state.suspensionTravel },
      wheelAngularVelocityRadps: { ...this.state.wheelAngularVelocityRadps }
    };
    for (let substepIndex = 0;
      substepIndex < this.config.tireSubstepsPerChassisStep;
      substepIndex += 1) {
      const substepStartState = {
        position: clone(substepState.position),
        orientation: clone(substepState.orientation),
        velocity: clone(substepState.velocity),
        angularVelocityWorld: clone(substepState.angularVelocityWorld),
        contactPatches: substepState.contactPatches || {}
      };
      const substepTimeSeconds = (
        this.stepIndex * this.config.tireSubstepsPerChassisStep + substepIndex + 1
      ) / this.config.tireHz;
      let environment = this.environmentProvider({
        timeSeconds: substepTimeSeconds,
        stepIndex: nextStepIndex,
        substepIndex,
        state: substepState,
        controls
      }) || {};
      if (environment.physicsIncidentMetadata) {
        this.physicsIncidentRecorder.configureMetadata(environment.physicsIncidentMetadata);
      }
      this.performanceDiagnostics.environmentQueries += 1;
      if (Array.isArray(environment.wakeSources)) {
        environment.wakeState = sampleWakeAtVehicle({
          vehicle: {
            id: environment.vehicleId || 'vehicle',
            position: substepState.position,
            yawRad: substepState.yawRad,
            speedMps: Math.abs(substepState.speedMps)
          },
          sources: environment.wakeSources,
          windWorldMps: environment.windWorldMps,
          stepIndex: nextStepIndex
        });
      }
      const aeroState = this.aeroModel.calculateForces({
        state: substepState,
        config: this.config,
        environment
      });
      let tireResult = this.tireContactSubsystem.step({
        state: substepState,
        controls,
        config: this.config,
        environment,
        dt: 1 / this.config.tireHz,
        stepIndex: nextStepIndex,
        substepIndex,
        timeSeconds: substepTimeSeconds
      });
      tireResult.externalForceWorldN = addVector3(
        environment.externalForceWorldN || {},
        aeroState.totalForceWorldN
      );
      tireResult.externalMomentWorldNm = addVector3(
        environment.externalMomentWorldNm || {},
        aeroState.totalMomentWorldNm
      );
      tireResult.aeroState = aeroState;
      tireResult.targetVelocityWorld = environment.targetVelocityWorld || null;
      tireResult.freeRevEngineRpm = environment.freeRevEngineRpm;
      const tireSubstepDt = 1 / this.config.tireHz;
      const tireAndSuspensionLinearImpulse = scaleVector3(addVector3(
        tireResult.worldForceN || {}, tireResult.suspensionForceWorldN || {}
      ), tireSubstepDt);
      const aeroAndGravityLinearImpulse = scaleVector3(addVector3(
        tireResult.externalForceWorldN || {}, {
          x: 0, y: -this.config.massKg * 9.81, z: 0
        }
      ), tireSubstepDt);
      const tireAngularImpulse = scaleVector3(
        tireResult.worldMomentNm || {}, tireSubstepDt
      );
      const externalAngularImpulse = scaleVector3(
        tireResult.externalMomentWorldNm || {}, tireSubstepDt
      );
      substepState.velocity = addVector3(
        substepState.velocity,
        scaleVector3(tireAndSuspensionLinearImpulse, 1 / this.config.massKg)
      );
      let angularMotion = integrateBodyAngularMotion({
        orientation: substepState.orientation,
        angularVelocityWorld: substepState.angularVelocityWorld,
        angularImpulseWorld: tireAngularImpulse,
        inertiaTensorBody: this.config.inertiaTensorBodyKgM2,
        dt: 0
      });
      substepState.angularVelocityWorld = angularMotion.angularVelocityWorld;
      substepState.velocity = addVector3(
        substepState.velocity,
        scaleVector3(aeroAndGravityLinearImpulse, 1 / this.config.massKg)
      );
      angularMotion = integrateBodyAngularMotion({
        orientation: substepState.orientation,
        angularVelocityWorld: substepState.angularVelocityWorld,
        angularImpulseWorld: externalAngularImpulse,
        inertiaTensorBody: this.config.inertiaTensorBodyKgM2,
        dt: 0
      });
      substepState.angularVelocityWorld = angularMotion.angularVelocityWorld;
      if (tireResult.targetVelocityWorld) {
        substepState.velocity.x = Number(tireResult.targetVelocityWorld.x || 0);
        substepState.velocity.z = Number(tireResult.targetVelocityWorld.z || 0);
      }
      angularMotion = integrateBodyAngularMotion({
        orientation: substepState.orientation,
        angularVelocityWorld: substepState.angularVelocityWorld,
        angularImpulseWorld: {},
        inertiaTensorBody: this.config.inertiaTensorBodyKgM2,
        dt: tireSubstepDt
      });
      substepState.angularVelocityWorld = angularMotion.angularVelocityWorld;
      substepState.orientation = angularMotion.orientation;
      substepState.position = addVector3(
        substepState.position,
        scaleVector3(substepState.velocity, tireSubstepDt)
      );
      const euler = eulerFromQuaternion(substepState.orientation);
      substepState.yawRad = normalizeAngle(euler.yaw);
      substepState.pitchRad = euler.pitch;
      substepState.rollRad = euler.roll;
      substepState.yawRateRadps = Number(substepState.angularVelocityWorld.y || 0);
      substepState.groundSpeedMps = Math.hypot(
        Number(substepState.velocity.x || 0), Number(substepState.velocity.z || 0)
      );
      const forward = { x: Math.sin(substepState.yawRad), y: 0, z: Math.cos(substepState.yawRad) };
      const right = { x: Math.cos(substepState.yawRad), y: 0, z: -Math.sin(substepState.yawRad) };
      substepState.bodyLongitudinalSpeedMps = dotVector3(substepState.velocity, forward);
      substepState.bodyLateralSpeedMps = dotVector3(substepState.velocity, right);
      const supportedWheels = RACE_WHEEL_IDS.filter((wheelId) => (
        Number(tireResult.wheelLoadsN?.[wheelId] || 0) > 1
      ));
      const availableBumpTravelM = supportedWheels.length
        ? Math.max(...supportedWheels.map((wheelId) => {
            const suspension = tireResult.suspensionState?.[wheelId] || {};
            const travelM = wheelId[0] === 'f'
              ? this.config.suspensionTravelFrontM : this.config.suspensionTravelRearM;
            return Math.max(0, travelM - Number(suspension.compressionM || 0));
          }))
        : 0;
      environment.suspensionBodyContactSupport = {
        supportedWheelCount: supportedWheels.length,
        availableBumpTravelM,
        bottomedOutWheelCount: supportedWheels.filter((wheelId) => (
          tireResult.suspensionState?.[wheelId]?.bottomedOut === true
        )).length,
        maximumOvertravelM: Math.max(0, ...supportedWheels.map((wheelId) => Number(
          tireResult.suspensionState?.[wheelId]?.overtravelM || 0
        )))
      };
      environment.wheelCylinderSweeps = this.createSweptWheelCylinders({
        tireResult,
        previousState: substepStartState,
        proposedState: substepState
      });
      environment.wheelCollisionSupportFeatures = createWheelCylinderSupportFeatures(
        environment.wheelCylinderSweeps, 1
      );
      const bodyPreImpactKineticEnergyJ = calculateKineticEnergyJ(substepState, this.config);
      let bodyResult = this.bodyCollision.step({
        workingState: substepState,
        previousWorkingState: substepStartState,
        config: this.config,
        environment,
        dt: tireSubstepDt,
        advanceState: false
      });
      bodyResult.preImpactKineticEnergyJ = bodyPreImpactKineticEnergyJ;
      bodyResult.postImpactKineticEnergyJ = calculateKineticEnergyJ(substepState, this.config);
      bodyResult.surfaceConsistency = substepIndex === this.config.tireSubstepsPerChassisStep - 1
        && this.stepIndex % this.config.surfaceConsistencySampleIntervalSteps === 0
        ? this.sampleSurfaceConsistency({
            previousState: substepStartState,
            proposedState: substepState,
            tireResult,
            bodyResult,
            environment
          })
        : { samples: [], discrepancies: [] };
      const hasBodyTerrainQuery = typeof environment.sampleTerrainAtWorldPoint === 'function'
        || typeof environment.sampleTerrainAtWorldPoints === 'function';
      const penetrationSample = hasBodyTerrainQuery && !bodyResult.broadphaseRejected
        ? this.bodyCollision.samplePosePenetration(
            substepState,
            environment,
            this.config.bodyCollisionToleranceM
          )
        : {
            maximumPenetrationM: 0,
            invalidTerrainSampleCount: 0,
            allBodySamplesBelowTerrain: false,
            allTerrainSamplesInvalid: false
          };
      bodyResult.maximumPenetrationAfterSolveM = penetrationSample.maximumPenetrationM;
      bodyResult.invalidTerrainSampleCount = penetrationSample.invalidTerrainSampleCount;
      bodyResult.allBodySamplesBelowTerrain = penetrationSample.allBodySamplesBelowTerrain;
      const currentPenetrationM = Math.max(0, Number(penetrationSample.maximumPenetrationM || 0));
      const resolvedToleranceM = this.config.bodyCollisionToleranceM + 1e-6;
      const finalTireSubstep = substepIndex === this.config.tireSubstepsPerChassisStep - 1;
      let penetrationCorrectionStalled = false;
      if (finalTireSubstep
        && this.penetrationRecoveryState.lastProgressEvaluationStep !== nextStepIndex) {
        const progressIncidentId = currentPenetrationM > resolvedToleranceM
          ? this.createPenetrationIncidentId({
              state: substepState,
              tireResult,
              bodyResult,
              penetrationSample,
              environment
            }) : null;
        const previousPenetrationM = Math.max(0, Number(
          this.penetrationRecoveryState.previousMaximumPenetrationM || 0
        ));
        if (currentPenetrationM > resolvedToleranceM) {
          this.penetrationRecoveryState.failedProgressSteps = previousPenetrationM > resolvedToleranceM
            && this.penetrationRecoveryState.progressIncidentId === progressIncidentId
            && currentPenetrationM >= previousPenetrationM - 0.001
            ? this.penetrationRecoveryState.failedProgressSteps + 1
            : 1;
        } else {
          this.penetrationRecoveryState.failedProgressSteps = 0;
        }
        this.penetrationRecoveryState.previousMaximumPenetrationM = currentPenetrationM;
        this.penetrationRecoveryState.progressIncidentId = progressIncidentId;
        this.penetrationRecoveryState.lastProgressEvaluationStep = nextStepIndex;
        penetrationCorrectionStalled = currentPenetrationM > resolvedToleranceM
          && this.penetrationRecoveryState.failedProgressSteps
            >= this.config.penetrationFailureStepLimit;
      }
      const cgTerrain = createSurfaceSample(
        typeof environment.sampleTerrainAtWorldPoint === 'function'
          ? environment.sampleTerrainAtWorldPoint(substepState.position)
          : null,
        { queryPosition: substepState.position, source: 'cg-terrain-envelope' }
      );
      const cgTerrainHeightM = cgTerrain.valid ? cgTerrain.heightM : null;
      const hasValidContactManifold = Number(tireResult.supportedWheelCount || 0) > 0
        || (bodyResult.contacts || []).length > 0;
      let recoveryReason = null;
      if (!isFiniteVehiclePose(substepState)) {
        recoveryReason = 'non-finite-vehicle-state';
      }
      else if (penetrationSample.allTerrainSamplesInvalid
        && environment.requireValidTerrainEnvelope === true) {
        recoveryReason = 'invalid-terrain-envelope';
      }
      else if (currentPenetrationM > this.config.emergencyBodyPenetrationM) recoveryReason = 'deep-body-penetration';
      else if (penetrationCorrectionStalled) recoveryReason = 'penetration-correction-stalled';
      else if (cgTerrain.valid
        && Number(substepState.position.y || 0)
          < cgTerrainHeightM - this.config.penetrationTerrainEnvelopeDepthM
        && !hasValidContactManifold) {
        recoveryReason = 'body-below-terrain-envelope';
      }
      const activeIncident = this.penetrationRecoveryState.currentIncident;
      if (recoveryReason && activeIncident?.lastRecoveryStepIndex === nextStepIndex) {
        bodyResult.recoveryDeferredToNextChassisStep = true;
        recoveryReason = null;
      }
      let substepRecovery = null;
      if (recoveryReason) {
        const recovery = this.recoverFromPenetration({
          reason: recoveryReason,
          substepState,
          environment,
          stepIndex: nextStepIndex,
          tireResult,
          bodyResult,
          penetrationSample,
          blockingNormal: penetrationSample.deepestNormal
        });
        substepRecovery = recovery;
        // The failed manifold is transactionally discarded. Re-query the
        // environment and rebuild wheel, suspension, tread, body and sidewall
        // contacts from the restored pose; no impulse or correction produced
        // by the submerged pose survives this boundary.
        environment = this.environmentProvider({
          timeSeconds: substepTimeSeconds,
          stepIndex: nextStepIndex,
          substepIndex,
          state: substepState,
          controls,
          recoveryRecalculation: true
        }) || {};
        this.performanceDiagnostics.environmentQueries += 1;
        tireResult = this.tireContactSubsystem.step({
          state: substepState,
          controls,
          config: this.config,
          environment,
          dt: tireSubstepDt,
          stepIndex: nextStepIndex,
          substepIndex,
          timeSeconds: substepTimeSeconds,
          recoveryRecalculation: true
        });
        const cleanAeroState = this.aeroModel.calculateForces({
          state: substepState,
          config: this.config,
          environment
        });
        tireResult.externalForceWorldN = addVector3(
          environment.externalForceWorldN || {}, cleanAeroState.totalForceWorldN
        );
        tireResult.externalMomentWorldNm = addVector3(
          environment.externalMomentWorldNm || {}, cleanAeroState.totalMomentWorldNm
        );
        tireResult.aeroState = cleanAeroState;
        tireResult.targetVelocityWorld = environment.targetVelocityWorld || null;
        tireResult.freeRevEngineRpm = environment.freeRevEngineRpm;
        substepState.suspensionState = tireResult.suspensionState || {};
        substepState.wheelAngularVelocityRadps = tireResult.wheelAngularVelocityRadps || {};
        substepState.wheelLoadsN = tireResult.wheelLoadsN || {};
        substepState.wheelSlip = tireResult.wheelSlip || {};
        substepState.contactPatches = tireResult.contactPatches || {};
        substepState.powertrainState = tireResult.powertrainState || substepState.powertrainState;
        this.updateDerivedMotionState(substepState);
        const cleanSupportedWheels = RACE_WHEEL_IDS.filter((wheelId) => (
          Number(tireResult.wheelLoadsN?.[wheelId] || 0) > 1
        ));
        environment.suspensionBodyContactSupport = {
          supportedWheelCount: cleanSupportedWheels.length,
          availableBumpTravelM: cleanSupportedWheels.length
            ? Math.max(...cleanSupportedWheels.map((wheelId) => {
                const travelM = wheelId[0] === 'f'
                  ? this.config.suspensionTravelFrontM : this.config.suspensionTravelRearM;
                return Math.max(0, travelM - Number(
                  tireResult.suspensionState?.[wheelId]?.compressionM || 0
                ));
              })) : 0,
          bottomedOutWheelCount: cleanSupportedWheels.filter((wheelId) => (
            tireResult.suspensionState?.[wheelId]?.bottomedOut === true
          )).length,
          maximumOvertravelM: Math.max(0, ...cleanSupportedWheels.map((wheelId) => Number(
            tireResult.suspensionState?.[wheelId]?.overtravelM || 0
          )))
        };
        environment.wheelCylinderSweeps = this.createSweptWheelCylinders({
          tireResult,
          previousState: substepState,
          proposedState: substepState
        });
        environment.wheelCollisionSupportFeatures = createWheelCylinderSupportFeatures(
          environment.wheelCylinderSweeps, 1
        );
        const cleanBodyPreImpactKineticEnergyJ = calculateKineticEnergyJ(substepState, this.config);
        bodyResult = this.bodyCollision.step({
          workingState: substepState,
          previousWorkingState: null,
          config: this.config,
          environment,
          dt: tireSubstepDt,
          advanceState: false
        });
        bodyResult.emergencyRecovery = recovery;
        bodyResult.discardedFailedManifold = true;
        bodyResult.preImpactKineticEnergyJ = cleanBodyPreImpactKineticEnergyJ;
        bodyResult.postImpactKineticEnergyJ = calculateKineticEnergyJ(substepState, this.config);
        bodyResult.surfaceConsistency = { samples: [], discrepancies: [] };
        const cleanPenetration = this.bodyCollision.samplePosePenetration(
          substepState, environment, this.config.bodyCollisionToleranceM
        );
        bodyResult.maximumPenetrationAfterSolveM = cleanPenetration.maximumPenetrationM;
      } else if (hasBodyTerrainQuery && finalTireSubstep) {
        if (currentPenetrationM <= resolvedToleranceM
          && (!penetrationSample.allTerrainSamplesInvalid
            || environment.requireValidTerrainEnvelope !== true)) {
          this.recordNonPenetratingState(substepState, tireResult, nextStepIndex, {
            penetrationSample,
            bodyResult,
            environment,
            routeDistanceM: environment.physicsIncidentDiagnostics?.routeDistanceM
              ?? environment.routeDistanceM
          });
        }
        this.updatePenetrationIncidentClearState({
          state: substepState,
          penetrationSample,
          stepIndex: nextStepIndex
        });
      }
      const bodyCorrection = bodyResult.positionalCorrectionWorldM || {};
      if (Math.hypot(
        Number(bodyCorrection.x || 0),
        Number(bodyCorrection.y || 0),
        Number(bodyCorrection.z || 0)
      ) > EPSILON) {
        RACE_WHEEL_IDS.forEach((wheelId) => {
          const suspension = tireResult.suspensionState?.[wheelId];
          if (!suspension || suspension.inContact !== true) return;
          const axis = suspension.suspensionAxisWorld || { x: 0, y: -1, z: 0 };
          const correctionAlongAxisM = dotVector3(bodyCorrection, axis);
          const travelM = wheelId[0] === 'f'
            ? this.config.suspensionTravelFrontM
            : this.config.suspensionTravelRearM;
          const correctedCompressionM = clamp(
            Number(suspension.compressionM || 0) + correctionAlongAxisM,
            0,
            travelM
          );
          tireResult.suspensionState[wheelId] = {
            ...suspension,
            compressionM: quantize(correctedCompressionM),
            compressionRatio: quantize(correctedCompressionM / Math.max(EPSILON, travelM))
          };
        });
      }
      this.physicsIncidentRecorder.recordSubstep({
        state: substepState,
        controls,
        tireResult,
        bodyResult,
        environment,
        stepIndex: nextStepIndex,
        substepIndex,
        timeSeconds: substepTimeSeconds,
        previousPosition: substepStartState.position,
        recovery: substepRecovery,
        toleranceM: this.config.bodyCollisionToleranceM
      });
      this.recordTakeoffSubstep({
        timeSeconds: substepTimeSeconds,
        tireResult,
        bodyResult,
        state: substepState,
        environment,
        dt: tireSubstepDt
      });
      tireResults.push(tireResult);
      bodyCollisionResults.push(bodyResult);
      substepState.wheelAngularVelocityRadps = tireResult.wheelAngularVelocityRadps || substepState.wheelAngularVelocityRadps;
      substepState.suspensionState = tireResult.suspensionState || substepState.suspensionState;
      substepState.contactPatches = tireResult.contactPatches || substepState.contactPatches;
      substepState.powertrainState = tireResult.powertrainState || substepState.powertrainState;
      substepState.engineRpm = Number(substepState.powertrainState?.engineRpm ?? substepState.engineRpm);
      substepState.gear = Number(substepState.powertrainState?.gear ?? substepState.gear);
    }
    const tires = aggregateTireResults(tireResults, 1 / this.config.tireHz);
    const bodyBroadphaseRejectedSubsteps = bodyCollisionResults.reduce((sum, result) => (
      sum + (result.broadphaseRejected ? 1 : 0)
    ), 0);
    this.performanceDiagnostics.bodyBroadphaseRejectedSubsteps += bodyBroadphaseRejectedSubsteps;
    this.performanceDiagnostics.bodyNarrowphaseSubsteps += bodyCollisionResults.length
      - bodyBroadphaseRejectedSubsteps;
    const sumBodyVector = (field) => bodyCollisionResults.reduce((sum, result) => (
      addVector3(sum, result[field])
    ), { x: 0, y: 0, z: 0 });
    let positionalCorrectionWorldM = sumBodyVector('positionalCorrectionWorldM');
    const correctionMagnitude = Math.hypot(
      positionalCorrectionWorldM.x,
      positionalCorrectionWorldM.y,
      positionalCorrectionWorldM.z
    );
    if (correctionMagnitude > 0.12) {
      positionalCorrectionWorldM = scaleVector3(positionalCorrectionWorldM, 0.12 / correctionMagnitude);
    }
    tires.bodyCollision = {
      linearImpulseWorldNs: sumBodyVector('linearImpulseWorldNs'),
      angularImpulseWorldNms: sumBodyVector('angularImpulseWorldNms'),
      positionalCorrectionWorldM,
      positionalAngularCorrectionWorldRad: sumBodyVector(
        'positionalAngularCorrectionWorldRad'
      ),
      broadphaseRejectedSubsteps: bodyBroadphaseRejectedSubsteps,
      contacts: bodyCollisionResults.flatMap((result, substepIndex) => (
        result.contacts.map((contact) => ({ ...contact, substepIndex }))
      )),
      bodyNormalImpulseNs: bodyCollisionResults.reduce((sum, result) => (
        sum + Number(result.bodyNormalImpulseNs || 0)
      ), 0),
      bodyFrictionImpulseNs: bodyCollisionResults.reduce((sum, result) => (
        sum + Number(result.bodyFrictionImpulseNs || 0)
      ), 0),
      wheelCylinderNormalImpulseNs: bodyCollisionResults.reduce((sum, result) => (
        sum + Number(result.wheelCylinderNormalImpulseNs || 0)
      ), 0),
      wheelCylinderFrictionImpulseNs: bodyCollisionResults.reduce((sum, result) => (
        sum + Number(result.wheelCylinderFrictionImpulseNs || 0)
      ), 0),
      wheelCylinderSweeps: bodyCollisionResults.flatMap((result, substepIndex) => (
        result.wheelCylinderSweep
          ? [{ ...result.wheelCylinderSweep, substepIndex }] : []
      )),
      restitutionContributionNs: bodyCollisionResults.reduce((sum, result) => (
        sum + Number(result.restitutionContributionNs || 0)
      ), 0),
      penetrationBiasContributionNs: 0,
      bodyGrounded: Boolean(bodyCollisionResults.at(-1)?.contacts?.some(
        (contact) => !String(contact.contactType || '').startsWith('wheel-')
      )),
      wheelSidewallGrounded: Boolean(bodyCollisionResults.at(-1)?.contacts?.some(
        (contact) => contact.contactType === 'wheel-sidewall'
      )),
      wheelCylinderGrounded: Boolean(bodyCollisionResults.at(-1)?.contacts?.some(
        (contact) => String(contact.contactType || '').startsWith('wheel-')
      )),
      sweptContactCount: bodyCollisionResults.filter((result) => result.swept).length,
      maximumPenetrationAfterSolveM: bodyCollisionResults.reduce((maximum, result) => (
        Math.max(maximum, Number(result.maximumPenetrationAfterSolveM || 0))
      ), 0),
      initialUnsupportedMaximumPenetrationM: bodyCollisionResults.reduce((maximum, result) => (
        Math.max(maximum, Number(result.initialUnsupportedMaximumPenetrationM || 0))
      ), 0),
      initialUnsupportedAllBodySamplesBelowTerrain: bodyCollisionResults.some((result) => (
        result.initialUnsupportedAllBodySamplesBelowTerrain === true
      )),
      emergencyRecoveries: bodyCollisionResults.map((result) => result.emergencyRecovery).filter(Boolean),
      surfaceDiscrepancies: bodyCollisionResults.flatMap((result) => (
        result.surfaceConsistency?.discrepancies || []
      ))
    };
    this.state.position = { ...substepState.position };
    this.state.velocity = { ...substepState.velocity };
    this.state.orientation = { ...substepState.orientation };
    this.state.angularVelocityWorld = Object.fromEntries(Object.entries(
      substepState.angularVelocityWorld
    ).map(([axis, value]) => [axis, Math.abs(Number(value || 0)) < 1e-12 ? 0 : value]));
    this.state.yawRad = substepState.yawRad;
    this.state.pitchRad = substepState.pitchRad;
    this.state.rollRad = substepState.rollRad;
    this.state.penetrationRecovery = clone(
      tires.bodyCollision.emergencyRecoveries.at(-1)
        || this.penetrationRecoveryState.history.at(-1)
        || null
    );
    const integrationControls = tires.powertrainState?.handbrakeEscSuppressed === true
      ? {
          ...controls,
          assists: { ...(controls.assists || {}), stabilityControlEnabled: false }
        }
      : controls;
    const integration = this.integrateChassis(
      integrationControls, tires, 1 / this.config.chassisHz, { preintegrated: true }
    );
    const postImpactKineticEnergyJ = calculateKineticEnergyJ(this.state, this.config);
    const bodyNormalImpulseNs = Number(tires.bodyCollision.bodyNormalImpulseNs || 0);
    const tireVerticalImpulseNs = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
      sum + Number(tires.tireVerticalImpulseByWheelNs?.[wheelId] || 0)
    ), 0);
    const impactStarted = bodyNormalImpulseNs > 1 || (
      preImpactVerticalVelocityMps < -0.25 && tireVerticalImpulseNs > 1
    );
    const physicalBodyImpactSubsteps = bodyCollisionResults.filter((result) => (
      Number(result.bodyNormalImpulseNs || 0) > 0
    ));
    const preImpactKineticEnergyJ = physicalBodyImpactSubsteps.length
      ? Number(physicalBodyImpactSubsteps[0].preImpactKineticEnergyJ || 0)
      : chassisStepPreImpactKineticEnergyJ;
    const resolvedPostImpactKineticEnergyJ = physicalBodyImpactSubsteps.length
      ? preImpactKineticEnergyJ + physicalBodyImpactSubsteps.reduce((energyDeltaJ, result) => (
          energyDeltaJ
          + Number(result.postImpactKineticEnergyJ || 0)
          - Number(result.preImpactKineticEnergyJ || 0)
        ), 0)
      : postImpactKineticEnergyJ;
    if (impactStarted && (!this.activeImpact || this.activeImpact.complete === true)) {
      const impact = {
        sequence: Math.max(0, Number(this.impactHistory.at(-1)?.sequence || 0)) + 1,
        stepIndex: nextStepIndex,
        timeSeconds: quantize(nextStepIndex / this.config.chassisHz, 12),
        preImpactKineticEnergyJ,
        postImpactKineticEnergyJ: resolvedPostImpactKineticEnergyJ,
        suspensionImpulseByWheelNs: clone(tires.suspensionImpulseByWheelNs),
        tireVerticalImpulseByWheelNs: clone(tires.tireVerticalImpulseByWheelNs),
        bodyNormalImpulseNs: quantize(bodyNormalImpulseNs),
        bodyFrictionImpulseNs: quantize(tires.bodyCollision.bodyFrictionImpulseNs || 0),
        restitutionContributionNs: quantize(tires.bodyCollision.restitutionContributionNs || 0),
        penetrationBiasContributionNs: 0,
        positionalCorrectionWorldM: clone(tires.bodyCollision.positionalCorrectionWorldM),
        firstReboundApexM: null,
        secondReboundApexM: null,
        reboundPhase: 'awaiting-first-apex',
        previousVerticalVelocityMps: Number(this.state.velocity?.y || 0),
        complete: false
      };
      this.impactHistory.push(impact);
      if (this.impactHistory.length > 128) this.impactHistory.shift();
      this.activeImpact = impact;
    } else if (this.activeImpact) {
      RACE_WHEEL_IDS.forEach((wheelId) => {
        this.activeImpact.suspensionImpulseByWheelNs[wheelId] = quantize(
          Number(this.activeImpact.suspensionImpulseByWheelNs?.[wheelId] || 0)
            + Number(tires.suspensionImpulseByWheelNs?.[wheelId] || 0)
        );
        this.activeImpact.tireVerticalImpulseByWheelNs[wheelId] = quantize(
          Number(this.activeImpact.tireVerticalImpulseByWheelNs?.[wheelId] || 0)
            + Number(tires.tireVerticalImpulseByWheelNs?.[wheelId] || 0)
        );
      });
      this.activeImpact.bodyNormalImpulseNs = quantize(
        Number(this.activeImpact.bodyNormalImpulseNs || 0) + bodyNormalImpulseNs
      );
      this.activeImpact.bodyFrictionImpulseNs = quantize(
        Number(this.activeImpact.bodyFrictionImpulseNs || 0)
          + Number(tires.bodyCollision.bodyFrictionImpulseNs || 0)
      );
      this.activeImpact.restitutionContributionNs = quantize(
        Number(this.activeImpact.restitutionContributionNs || 0)
          + Number(tires.bodyCollision.restitutionContributionNs || 0)
      );
      this.activeImpact.positionalCorrectionWorldM = addVector3(
        this.activeImpact.positionalCorrectionWorldM,
        tires.bodyCollision.positionalCorrectionWorldM
      );
      const previousVy = Number(this.activeImpact.previousVerticalVelocityMps || 0);
      const currentVy = Number(this.state.velocity?.y || 0);
      if (this.activeImpact.reboundPhase === 'awaiting-second-impact'
        && impactStarted && preImpactVerticalVelocityMps < -0.25) {
        this.activeImpact.reboundPhase = 'awaiting-second-apex';
      }
      if (previousVy > 0 && currentVy <= 0) {
        if (this.activeImpact.reboundPhase === 'awaiting-first-apex') {
          this.activeImpact.firstReboundApexM = quantize(this.state.position.y);
          this.activeImpact.reboundPhase = 'awaiting-second-impact';
        } else if (this.activeImpact.reboundPhase === 'awaiting-second-apex') {
          this.activeImpact.secondReboundApexM = quantize(this.state.position.y);
          this.activeImpact.reboundPhase = 'complete';
          this.activeImpact.complete = true;
        }
      }
      this.activeImpact.previousVerticalVelocityMps = currentVy;
    }
    integration.impactEnergy = this.activeImpact ? clone(this.activeImpact) : null;
    integration.takeoff = clone(
      this.takeoffContactState.activeTakeoff || this.takeoffHistory.at(-1) || null
    );
    this.stepIndex = nextStepIndex;
    this.diagnostics.completedSteps += 1;
    this.diagnostics.completedTireSubsteps += tireResults.length;
    const retention = this.config.telemetryRetention;
    const retained = retention === 'history' || retention === 'latest';
    if (retained) this.performanceDiagnostics.retainedTelemetrySnapshots += 1;
    if (retention === 'transient') this.performanceDiagnostics.transientTelemetrySteps += 1;
    const state = retained ? this.createStateSnapshot() : this.state;
    const telemetry = {
      stepIndex: this.stepIndex,
      timeSeconds: this.simulationTimeSeconds,
      controls: retained ? clone(controls) : controls,
      subsystemOrder: [...VEHICLE_DYNAMICS_SUBSYSTEM_ORDER],
      tireSubstepCount: tireResults.length,
      state,
      forces: retained ? clone(integration) : integration,
      assistInterventions: retained
        ? clone(integration.assistInterventions)
        : integration.assistInterventions,
      catchUp: {
        maxCatchUpSteps: this.config.maxCatchUpSteps,
        completedSteps: this.diagnostics.completedSteps,
        completedTireSubsteps: this.diagnostics.completedTireSubsteps,
        droppedTimeSeconds: this.diagnostics.droppedTimeSeconds
      },
      legacyDifference: retention === 'none' ? null : compareVehicleStates(legacySnapshot, state)
    };
    if (retention === 'history') {
      this.telemetry.push(telemetry);
      if (this.telemetry.length > this.config.telemetryLimit) {
        this.telemetry.splice(0, this.telemetry.length - this.config.telemetryLimit);
      }
    } else if (retention === 'latest') {
      this.telemetry[0] = telemetry;
      this.telemetry.length = 1;
    }
    return retention === 'none' ? null : telemetry;
  }

  advance(deltaSeconds = 0, {
    input = null,
    inputTimeSeconds = null,
    legacySnapshot = null,
    onFixedStep = null
  } = {}) {
    const wallStartMs = typeof globalThis.performance?.now === 'function'
      ? globalThis.performance.now() : null;
    const delta = Math.max(0, Number(deltaSeconds) || 0);
    const nextObservedTime = quantize(
      inputTimeSeconds === null
        ? this.observedTimeSeconds + delta
        : Math.max(this.observedTimeSeconds, Number(inputTimeSeconds) || 0),
      12
    );
    if (input) this.addInputSample(nextObservedTime, input);
    this.observedTimeSeconds = nextObservedTime;
    const targetStepIndex = Math.floor(
      (this.observedTimeSeconds + EPSILON) * this.config.chassisHz
    );
    const dueSteps = Math.max(0, targetStepIndex - this.stepIndex);
    const completedSteps = Math.min(dueSteps, this.config.maxCatchUpSteps);
    for (let index = 0; index < completedSteps; index += 1) {
      const telemetry = this.runStep(legacySnapshot);
      if (telemetry && typeof onFixedStep === 'function') onFixedStep(telemetry);
    }
    const backlogSteps = Math.max(0, targetStepIndex - this.stepIndex);
    this.diagnostics.backlogSteps = backlogSteps;
    this.diagnostics.peakBacklogSteps = Math.max(
      this.diagnostics.peakBacklogSteps,
      backlogSteps
    );
    if (backlogSteps > 0) this.diagnostics.catchUpLimitedAdvances += 1;
    const advanceWallTimeMs = wallStartMs === null ? 0 : Math.max(
      0, globalThis.performance.now() - wallStartMs
    );
    this.performanceDiagnostics.lastAdvanceWallTimeMs = advanceWallTimeMs;
    this.performanceDiagnostics.peakAdvanceWallTimeMs = Math.max(
      Number(this.performanceDiagnostics.peakAdvanceWallTimeMs || 0),
      advanceWallTimeMs
    );
    return {
      completedSteps,
      completedTireSubsteps: completedSteps * this.config.tireSubstepsPerChassisStep,
      stepIndex: this.stepIndex,
      simulationTimeSeconds: this.simulationTimeSeconds,
      observedTimeSeconds: this.observedTimeSeconds,
      backlogSteps,
      advanceWallTimeMs,
      catchUpLimited: backlogSteps > 0,
      peakBacklogSteps: this.diagnostics.peakBacklogSteps,
      droppedTimeSeconds: this.diagnostics.droppedTimeSeconds
    };
  }

  drainCatchUp({ legacySnapshot = null } = {}) {
    let completedSteps = 0;
    while (this.diagnostics.backlogSteps > 0) {
      const targetStepIndex = Math.floor(
        (this.observedTimeSeconds + EPSILON) * this.config.chassisHz
      );
      const count = Math.min(
        targetStepIndex - this.stepIndex,
        this.config.maxCatchUpSteps
      );
      if (count <= 0) break;
      for (let index = 0; index < count; index += 1) this.runStep(legacySnapshot);
      completedSteps += count;
      this.diagnostics.backlogSteps = Math.max(0, targetStepIndex - this.stepIndex);
    }
    return completedSteps;
  }

  createSnapshot() {
    return {
      version: 1,
      config: clone(this.config),
      initialState: clone(this.initialState),
      state: this.createStateSnapshot(),
      stepIndex: this.stepIndex,
      observedTimeSeconds: this.observedTimeSeconds,
      inputTimeline: this.inputTimeline.createSnapshot(),
      telemetry: clone(this.telemetry),
      impactHistory: clone(this.impactHistory),
      activeImpactSequence: this.activeImpact?.sequence || null,
      takeoffHistory: clone(this.takeoffHistory),
      takeoffContactState: clone(this.takeoffContactState),
      diagnostics: clone(this.diagnostics),
      pendingCollisionImpulses: clone(this.pendingCollisionImpulses),
      collisionTimeline: clone(this.collisionTimeline),
      lastNonPenetratingState: clone(this.lastNonPenetratingState),
      nonPenetratingStateHistory: clone(this.nonPenetratingStateHistory),
      penetrationRecoveryState: clone(this.penetrationRecoveryState),
      surfaceConsistencyCursor: this.surfaceConsistencyCursor
    };
  }

  restoreSnapshot(snapshot = {}) {
    if (Number(snapshot.version) !== 1) {
      throw new Error(`Unsupported VehicleDynamicsRunner snapshot version: ${snapshot.version}`);
    }
    this.state = createVehicleDynamicsState(snapshot.state);
    this.initialState = createVehicleDynamicsState(snapshot.initialState);
    this.stepIndex = Math.max(0, Math.trunc(Number(snapshot.stepIndex) || 0));
    this.observedTimeSeconds = quantize(snapshot.observedTimeSeconds, 12);
    this.inputTimeline.restoreSnapshot(snapshot.inputTimeline || []);
    this.telemetry = clone(snapshot.telemetry || []);
    this.impactHistory = clone(snapshot.impactHistory || []);
    this.activeImpact = this.impactHistory.find((impact) => (
      impact.sequence === snapshot.activeImpactSequence
    )) || null;
    this.takeoffHistory = clone(snapshot.takeoffHistory || []);
    this.takeoffContactState = clone(snapshot.takeoffContactState || {
      initialized: false,
      frontGrounded: false,
      rearGrounded: false,
      recentFrontSuspensionImpulse: [],
      recentRearSuspensionImpulse: [],
      recentUnderbodyContacts: [],
      activeTakeoff: null
    });
    this.diagnostics = clone(snapshot.diagnostics || this.diagnostics);
    this.pendingCollisionImpulses = clone(snapshot.pendingCollisionImpulses || []);
    this.collisionTimeline = clone(snapshot.collisionTimeline || []);
    this.lastNonPenetratingState = clone(snapshot.lastNonPenetratingState || null);
    this.nonPenetratingStateHistory = clone(snapshot.nonPenetratingStateHistory
      || (this.lastNonPenetratingState ? [this.lastNonPenetratingState] : []));
    this.penetrationRecoveryState = {
      previousMaximumPenetrationM: 0,
      failedProgressSteps: 0,
      lastProgressEvaluationStep: -1,
      progressIncidentId: null,
      currentIncident: null,
      lastClearedIncidentId: null,
      sequence: 0,
      history: [],
      ...clone(snapshot.penetrationRecoveryState || {})
    };
    this.surfaceConsistencyCursor = Math.max(0, Math.trunc(Number(
      snapshot.surfaceConsistencyCursor || 0
    )));
    return this;
  }

  createReplayRecord() {
    return {
      version: 1,
      config: clone(this.config),
      initialState: clone(this.initialState),
      inputTimeline: this.inputTimeline.createSnapshot(),
      finalObservedTimeSeconds: this.observedTimeSeconds,
      finalStepIndex: this.stepIndex,
      finalState: this.createStateSnapshot(),
      finalTelemetry: clone(this.telemetry),
      impactHistory: clone(this.impactHistory),
      takeoffHistory: clone(this.takeoffHistory),
      finalDiagnostics: clone(this.diagnostics),
      collisionTimeline: clone(this.collisionTimeline)
    };
  }

  static replay(record = {}, options = {}) {
    if (Number(record.version) !== 1) {
      throw new Error(`Unsupported VehicleDynamicsRunner replay version: ${record.version}`);
    }
    const runner = new VehicleDynamicsRunner({
      config: record.config,
      initialState: record.initialState,
      inputTimeline: record.inputTimeline,
      tireContactSubsystem: options.tireContactSubsystem,
      environmentProvider: options.environmentProvider
    });
    (record.collisionTimeline || []).forEach((collision) => {
      const step = Math.max(1, Math.trunc(Number(collision.stepIndex) || 1));
      const scheduled = runner.scheduledReplayCollisions.get(step) || [];
      scheduled.push(clone(collision));
      runner.scheduledReplayCollisions.set(step, scheduled);
    });
    runner.advance(record.finalObservedTimeSeconds);
    runner.drainCatchUp();
    runner.collisionTimeline = clone(record.collisionTimeline || []);
    return runner;
  }
}
