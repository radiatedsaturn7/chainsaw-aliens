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
import { PhysicsCostAccounting } from './PhysicsCostAccounting.js';
import { createSurfaceSample } from './SurfaceSample.js';
import { createWheelCylinderSupportFeatures } from './WheelCylinderCollision.js';
import { PreparedStaticRaceColliderWorld } from './StaticRaceColliderWorld.js';
import { normalizeVehicleBodyProfile, resolveVehicleBodyProfile } from './VehicleBodyProfile.js';
import {
  getRaceNormalizedSuspensionTravelM,
  getRaceVehicleSuspensionRates
} from '../RaceVehiclePhysics.js';
import {
  addVector3,
  crossVector3,
  createBodyAngularMotionScratch,
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
export const VEHICLE_DYNAMICS_QUALITY_PROFILES = Object.freeze({
  realtime: Object.freeze({ chassisHz: 120, tireHz: 120, geometryHz: 120, incidentRecording: false }),
  'high-fidelity': Object.freeze({ chassisHz: 120, tireHz: 360, geometryHz: 120, incidentRecording: false }),
  diagnostic: Object.freeze({ chassisHz: 120, tireHz: 360, geometryHz: 120, incidentRecording: true })
});
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
// Keep reset parking immune to analog trigger noise. Digital throttle and an
// intentional analog press still exceed this threshold immediately.
const STATIONARY_RESET_WAKE_THROTTLE = 0.15;
const dotVector3 = (a = {}, b = {}) => (
  Number(a.x || 0) * Number(b.x || 0)
  + Number(a.y || 0) * Number(b.y || 0)
  + Number(a.z || 0) * Number(b.z || 0)
);

export function evaluatePhysicalSleepCondition({
  state = {}, config = {}, tires = {}, totalLinearImpulse = {}, totalAngularImpulse = {},
  dt = 1 / 120, pendingCollisionCount = 0
} = {}) {
  if (!tires.grounded || pendingCollisionCount || tires.bodyCollision?.contacts?.length) return false;
  let supportedPatchCount = 0;
  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;
  let staticFrictionCapacityN = 0;
  let activeDriveTorqueNm = 0;
  let maximumUnsprungSpeedMps = 0;
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const patch = state.contactPatches?.[RACE_WHEEL_IDS[wheelIndex]];
    const normalLoadN = Number(patch?.normalLoadN || 0);
    if (!(normalLoadN > 1)) continue;
    supportedPatchCount += 1;
    normalX += Number(patch.surfaceNormalWorld?.x || 0);
    normalY += Number(patch.surfaceNormalWorld?.y || 0);
    normalZ += Number(patch.surfaceNormalWorld?.z || 0);
    staticFrictionCapacityN += normalLoadN
      * Math.max(0, Number(patch.gripCoefficient || 0)) * 0.92;
    activeDriveTorqueNm += Math.abs(Number(patch.driveTorqueNm || 0));
    maximumUnsprungSpeedMps = Math.max(maximumUnsprungSpeedMps, Math.abs(Number(
      tires.suspensionState?.[RACE_WHEEL_IDS[wheelIndex]]?.unsprungVelocityMps || 0
    )));
  }
  if (!supportedPatchCount) return false;
  const normalLength = Math.max(EPSILON, Math.hypot(normalX, normalY, normalZ));
  const gravityTangentN = Number(config.massKg || 0) * 9.81
    * Math.sqrt(Math.max(0, 1 - clamp(normalY / normalLength, -1, 1) ** 2));
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
    && maximumUnsprungSpeedMps < 0.08
    && Math.hypot(Number(state.velocity?.x || 0), Number(state.velocity?.y || 0), Number(state.velocity?.z || 0)) < 0.025
    && Math.hypot(
      Number(state.angularVelocityWorld?.x || 0),
      Number(state.angularVelocityWorld?.y || 0),
      Number(state.angularVelocityWorld?.z || 0)
    ) < 0.08;
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
const KNOWN_ASSIST_FIELDS = Object.freeze([
  'absEnabled',
  'autoShift',
  'launchControlEnabled',
  'stabilityControlEnabled',
  'tractionControlEnabled'
]);

const QUANTIZE_SCALE_BY_PRECISION = Object.freeze({
  6: 1e6,
  9: 1e9,
  12: 1e12
});

function quantize(value, precision = 6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scale = QUANTIZE_SCALE_BY_PRECISION[precision] || 10 ** precision;
  return Math.round(numeric * scale) / scale;
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

function removeVelocityIntoNormal(velocity = {}, normalValue = {}) {
  const normal = normalizeRecoveryNormal(normalValue);
  const inwardSpeedMps = Math.min(0, dotVector3(velocity, normal));
  return {
    velocity: inwardSpeedMps < 0
      ? addVector3(velocity, scaleVector3(normal, -inwardSpeedMps))
      : clone(velocity),
    normal,
    removedInwardSpeedMps: quantize(-inwardSpeedMps)
  };
}

function maximumContactClosingSpeedMps(state = {}, contacts = [], fallbackNormal = null) {
  let maximum = 0;
  const source = contacts.length ? contacts : (fallbackNormal ? [{ normal: fallbackNormal }] : []);
  for (let index = 0; index < source.length; index += 1) {
    const contact = source[index] || {};
    const normal = normalizeRecoveryNormal(contact.normal || fallbackNormal || {});
    const arm = contact.arm || (contact.pointWorld ? addVector3(
      contact.pointWorld,
      scaleVector3(state.position || {}, -1)
    ) : null);
    const pointVelocity = arm
      ? addVector3(
          state.velocity || {},
          crossVector3(state.angularVelocityWorld || {}, arm)
        )
      : state.velocity || {};
    maximum = Math.max(maximum, -dotVector3(pointVelocity, normal));
  }
  return Math.max(0, maximum);
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

const RESET_PERSISTENT_TIRE_FIELDS = Object.freeze([
  'treadTemperatureC',
  'carcassTemperatureC',
  'internalAirTemperatureC',
  'coldPressurePsi',
  'pressureReferenceTemperatureC',
  'temperatureF',
  'effectivePressurePsi',
  'wear',
  'damage'
]);

function copyPersistentTireState(source = {}) {
  const result = {};
  for (const wheelId of RACE_WHEEL_IDS) {
    const tire = source?.[wheelId] || {};
    const persistent = {};
    for (const field of RESET_PERSISTENT_TIRE_FIELDS) {
      if (tire[field] !== undefined) persistent[field] = Number(tire[field]);
    }
    result[wheelId] = persistent;
  }
  return result;
}

function copyRecoveryWheelScalars(source = {}) {
  const result = {};
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    result[wheelId] = Number(source?.[wheelId] || 0);
  }
  return result;
}

function copyRecoverySuspensionState(source = {}) {
  const result = {};
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    const suspension = source?.[wheelId] || {};
    result[wheelId] = {
      compressionM: Number(suspension.compressionM || 0),
      unsprungVelocityMps: Number(suspension.unsprungVelocityMps || 0)
    };
  }
  return result;
}

function copyRecoveryContactPatches(source = {}) {
  const result = {};
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    const patch = source?.[wheelId] || {};
    result[wheelId] = {
      relaxedSlipRatio: Number(patch.relaxedSlipRatio || 0),
      relaxedSlipAngleRad: Number(patch.relaxedSlipAngleRad || 0),
      breakawayActive: patch.breakawayActive === true
    };
  }
  return result;
}

function controlsEqual(left, right) {
  if (!left || !right
    || left.steering !== right.steering
    || left.driverSteeringIntent !== right.driverSteeringIntent
    || left.steeringTarget !== right.steeringTarget
    || left.controllerFilterOutput !== right.controllerFilterOutput
    || left.centerSteeringAngleRad !== right.centerSteeringAngleRad
    || left.steeringInputMode !== right.steeringInputMode
    || left.throttle !== right.throttle
    || left.brake !== right.brake
    || left.clutch !== right.clutch
    || left.handbrake !== right.handbrake
    || left.handbrakeHoldSequence !== right.handbrakeHoldSequence
    || left.handbrakeHoldSeconds !== right.handbrakeHoldSeconds
    || left.requestedGear !== right.requestedGear) return false;
  const leftAssists = left.assists || {};
  const rightAssists = right.assists || {};
  let leftCount = 0;
  let rightCount = 0;
  for (const key in leftAssists) {
    leftCount += 1;
    if (!Object.hasOwn(rightAssists, key) || leftAssists[key] !== rightAssists[key]) {
      return false;
    }
  }
  for (const key in rightAssists) rightCount += 1;
  return leftCount === rightCount;
}

function pruneTimedSamples(samples, cutoffTimeSeconds, recyclePool = null) {
  let removeCount = 0;
  while (removeCount < samples.length
    && samples[removeCount].timeSeconds < cutoffTimeSeconds) removeCount += 1;
  if (removeCount <= 0) return;
  if (recyclePool) {
    for (let index = 0; index < removeCount; index += 1) {
      recyclePool.push(samples[index]);
    }
  }
  samples.copyWithin(0, removeCount);
  samples.length -= removeCount;
}

function normalizeAssists(assists = {}) {
  const source = assists || {};
  let hasUnknownField = false;
  for (const key in source) {
    if (!KNOWN_ASSIST_FIELDS.includes(key)) {
      hasUnknownField = true;
      break;
    }
  }
  if (hasUnknownField) {
    const sortedKeys = Object.keys(source).sort((left, right) => left.localeCompare(right));
    const fallback = {};
    for (let index = 0; index < sortedKeys.length; index += 1) {
      const key = sortedKeys[index];
      const value = source[key];
      fallback[String(key)] = typeof value === 'boolean' ? value : quantize(value);
    }
    return fallback;
  }
  const result = {};
  for (let index = 0; index < KNOWN_ASSIST_FIELDS.length; index += 1) {
    const key = KNOWN_ASSIST_FIELDS[index];
    if (!Object.hasOwn(source, key)) continue;
    const value = source[key];
    result[key] = typeof value === 'boolean' ? value : quantize(value);
  }
  return result;
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

function copyVehicleControlInputInto(target, source) {
  target.steering = source.steering;
  target.driverSteeringIntent = source.driverSteeringIntent;
  target.steeringTarget = source.steeringTarget;
  target.controllerFilterOutput = source.controllerFilterOutput;
  target.centerSteeringAngleRad = source.centerSteeringAngleRad;
  target.steeringInputMode = source.steeringInputMode;
  target.throttle = source.throttle;
  target.brake = source.brake;
  target.clutch = source.clutch;
  target.handbrake = source.handbrake;
  target.handbrakeHoldSequence = source.handbrakeHoldSequence;
  target.handbrakeHoldSeconds = source.handbrakeHoldSeconds;
  target.requestedGear = source.requestedGear;
  const assists = target.assists && typeof target.assists === 'object'
    ? target.assists : {};
  for (const key in assists) delete assists[key];
  const sourceAssists = source.assists || {};
  for (const key in sourceAssists) assists[key] = sourceAssists[key];
  target.assists = assists;
  return target;
}

export class VehicleControlInputTimeline {
  constructor(samples = []) {
    this.samples = [];
    this.nextSequence = 1;
    this.defaultInput = normalizeVehicleControlInput();
    samples.forEach((sample) => this.addSample(sample.timeSeconds, sample.input || sample, {
      sequence: sample.sequence
    }));
  }

  addSample(timeSeconds = 0, input = {}, {
    sequence = null,
    returnSnapshot = true
  } = {}) {
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
      return returnSnapshot ? clone(sample) : sample;
    }
    this.samples.push(sample);
    this.samples.sort((left, right) => (
      left.timeSeconds - right.timeSeconds || left.sequence - right.sequence
    ));
    return returnSnapshot ? clone(sample) : sample;
  }

  discardAtOrAfter(timeSeconds = 0) {
    const cutoff = Math.max(0, Number(timeSeconds) || 0) - EPSILON;
    const index = this.samples.findIndex((sample) => sample.timeSeconds >= cutoff);
    if (index < 0) return 0;
    const removed = this.samples.length - index;
    this.samples.splice(index, removed);
    return removed;
  }

  sampleAt(timeSeconds = 0, target = null) {
    const time = Math.max(0, Number(timeSeconds) || 0);
    if (!this.samples.length) {
      return target ? copyVehicleControlInputInto(target, this.defaultInput)
        : normalizeVehicleControlInput();
    }
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
    if (leftIndex < 0) return target
      ? copyVehicleControlInputInto(target, this.samples[0].input)
      : clone(this.samples[0].input);
    const left = this.samples[leftIndex];
    if (rightIndex < 0) return target
      ? copyVehicleControlInputInto(target, left.input)
      : clone(left.input);
    const right = this.samples[rightIndex];
    const span = right.timeSeconds - left.timeSeconds;
    const ratio = span > EPSILON ? clamp((time - left.timeSeconds) / span, 0, 1) : 0;
    const sampled = target && typeof target === 'object' ? target : {};
    sampled.requestedGear = left.input.requestedGear;
    sampled.steeringInputMode = left.input.steeringInputMode;
    sampled.handbrakeHoldSequence = left.input.handbrakeHoldSequence;
    sampled.handbrakeHoldSeconds = left.input.handbrakeHoldSeconds;
    sampled.centerSteeringAngleRad = null;
    const assists = sampled.assists && typeof sampled.assists === 'object'
      ? sampled.assists : {};
    for (const key in assists) delete assists[key];
    for (const key in left.input.assists || {}) assists[key] = left.input.assists[key];
    sampled.assists = assists;
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
    contactStabilization: clone(initial.contactStabilization || null),
    penetrationRecovery: clone(initial.penetrationRecovery || null)
  };
}

export function createVehicleDynamicsConfig(config = {}) {
  const requestedQualityProfile = String(config.physicsQualityProfile || '').toLowerCase();
  const qualityProfile = VEHICLE_DYNAMICS_QUALITY_PROFILES[requestedQualityProfile] || null;
  const chassisHz = Math.max(1, Math.trunc(Number(
    config.chassisHz ?? qualityProfile?.chassisHz
  ) || VEHICLE_DYNAMICS_CHASSIS_HZ));
  const requestedTireHz = Number(config.tireHz ?? qualityProfile?.tireHz)
    || VEHICLE_DYNAMICS_MAX_TIRE_HZ;
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
  const catastrophicBodyPenetrationM = Math.max(
    0.35,
    Number(bodyProfile.overallHeightM || 0) * 0.25,
    Number(config.catastrophicBodyPenetrationM || 0)
  );
  return Object.freeze({
    physicsQualityProfile: qualityProfile ? requestedQualityProfile : 'custom',
    chassisHz,
    tireHz,
    geometryHz: chassisHz,
    tireSubstepsPerChassisStep: tireHz / chassisHz,
    maxCatchUpSteps: Math.max(1, Math.trunc(Number(config.maxCatchUpSteps) || 30)),
    telemetryLimit: Math.max(1, Math.trunc(Number(config.telemetryLimit) || 4096)),
    telemetryRetention,
    physicsCostAccountingEnabled: config.physicsCostAccountingEnabled === true,
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
    staticColliderToleranceM: clamp(
      Number(config.staticColliderToleranceM ?? config.bodyCollisionToleranceM ?? 0.008),
      0.001,
      0.04
    ),
    staticColliderImpactIterations: clamp(
      Math.trunc(Number(config.staticColliderImpactIterations) || 16),
      4,
      24
    ),
    staticColliderMaximumPositionalCorrectionM: clamp(
      Number(config.staticColliderMaximumPositionalCorrectionM ?? 1),
      0.05,
      2
    ),
    wheelCylinderSweepSpacingM: clamp(Number(config.wheelCylinderSweepSpacingM ?? 0.02), 0.005, 0.05),
    wheelCylinderRadialSamples: clamp(
      Math.trunc(Number(config.wheelCylinderRadialSamples) || 24), 16, 48
    ),
    physicsIncidentRecordingEnabled: qualityProfile?.incidentRecording === true
      || config.physicsIncidentRecordingEnabled === true,
    surfaceConsistencySamplingEnabled: config.surfaceConsistencySamplingEnabled
      ?? (qualityProfile ? qualityProfile.incidentRecording === true : true),
    physicsIncidentPreSeconds: clamp(Number(config.physicsIncidentPreSeconds ?? 2), 2, 10),
    physicsIncidentPostSeconds: clamp(Number(config.physicsIncidentPostSeconds ?? 3), 1, 10),
    minimumTreadSupportAlignment: clamp(Number(config.minimumTreadSupportAlignment ?? 0.2), 0.01, 0.95),
    maximumTreadAxleNormalAlignment: clamp(Number(config.maximumTreadAxleNormalAlignment ?? 0.72), 0.2, 0.95),
    treadReachToleranceM: clamp(Number(config.treadReachToleranceM ?? 0.025), 0.002, 0.08),
    shallowContactPenetrationM: clamp(
      Number(config.shallowContactPenetrationM ?? 0.03), 0.008, 0.1
    ),
    localCcdRollbackMaximumPenetrationM: clamp(
      Number(config.localCcdRollbackMaximumPenetrationM ?? 0.25), 0.03, 0.35
    ),
    catastrophicBodyPenetrationM,
    // Kept as a compatibility alias for snapshots and diagnostics. Runtime
    // recovery classification uses the catastrophic threshold above.
    emergencyBodyPenetrationM: catastrophicBodyPenetrationM,
    catastrophicCgSubmersionM: Math.max(
      0.5, Number(config.catastrophicCgSubmersionM || 0)
    ),
    invalidTerrainRecoveryDelaySeconds: Math.max(
      0.25, Number(config.invalidTerrainRecoveryDelaySeconds || 0)
    ),
    localCcdRollbackMaximumAgeSteps: clamp(
      Math.trunc(Number(config.localCcdRollbackMaximumAgeSteps) || 1), 1, 2
    ),
    localCcdRollbackFailureLimit: clamp(
      Math.trunc(Number(config.localCcdRollbackFailureLimit) || 3), 2, 12
    ),
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
  tireHz = null,
  physicsQualityProfile = null,
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
    physicsQualityProfile,
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

const TIRE_ENERGY_WORK_FIELDS = Object.freeze([
  'longitudinalFrictionWorkJ',
  'lateralFrictionWorkJ',
  'carcassFlexWorkJ',
  'loadHeatingWorkJ',
  'surfaceConductionWorkJ',
  'waterCoolingWorkJ'
]);

function createTireAggregateScratch() {
  const tireImpulseWorldNs = { x: 0, y: 0, z: 0 };
  const suspensionImpulseWorldNs = { x: 0, y: 0, z: 0 };
  const externalImpulseWorldNs = { x: 0, y: 0, z: 0 };
  const tireAngularImpulseWorldNms = { x: 0, y: 0, z: 0 };
  const externalAngularImpulseWorldNms = { x: 0, y: 0, z: 0 };
  const worldForceN = { x: 0, y: 0, z: 0 };
  const worldMomentNm = { x: 0, y: 0, z: 0 };
  const suspensionForceWorldN = { x: 0, y: 0, z: 0 };
  const externalForceWorldN = { x: 0, y: 0, z: 0 };
  const externalMomentWorldNm = { x: 0, y: 0, z: 0 };
  const contactPatches = {};
  const suspensionImpulseByWheelNs = {};
  const tireVerticalImpulseByWheelNs = {};
  const wheelAngularMomentumReactionImpulseWorldNms = {};
  const bodyCollision = {
    linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
    angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
    positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
    positionalAngularCorrectionWorldRad: { x: 0, y: 0, z: 0 },
    broadphaseRejectedSubsteps: 0,
    contacts: [],
    bodyNormalImpulseNs: 0,
    bodyFrictionImpulseNs: 0,
    wheelCylinderNormalImpulseNs: 0,
    wheelCylinderFrictionImpulseNs: 0,
    wheelCylinderSweeps: [],
    restitutionContributionNs: 0,
    penetrationBiasContributionNs: 0,
    bodyGrounded: false,
    wheelSidewallGrounded: false,
    wheelCylinderGrounded: false,
    sweptContactCount: 0,
    maximumPenetrationAfterSolveM: 0,
    initialUnsupportedMaximumPenetrationM: 0,
    initialUnsupportedAllBodySamplesBelowTerrain: false,
    emergencyRecoveries: [],
    ordinaryCorrections: [],
    localCcdRollbacks: [],
    catastrophicRecoveries: [],
    surfaceDiscrepancies: []
  };
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    const tireEnergyWork = {};
    for (let fieldIndex = 0; fieldIndex < TIRE_ENERGY_WORK_FIELDS.length; fieldIndex += 1) {
      tireEnergyWork[TIRE_ENERGY_WORK_FIELDS[fieldIndex]] = 0;
    }
    contactPatches[wheelId] = { tireEnergyWork };
    suspensionImpulseByWheelNs[wheelId] = 0;
    tireVerticalImpulseByWheelNs[wheelId] = 0;
    wheelAngularMomentumReactionImpulseWorldNms[wheelId] = { x: 0, y: 0, z: 0 };
  }
  return {
    result: {
      longitudinalForceN: 0,
      lateralForceN: 0,
      yawMomentNm: 0,
      worldForceN,
      worldMomentNm,
      suspensionForceWorldN,
      externalForceWorldN,
      externalMomentWorldNm,
      tireImpulseWorldNs,
      suspensionImpulseWorldNs,
      externalImpulseWorldNs,
      tireAngularImpulseWorldNms,
      externalAngularImpulseWorldNms,
      accumulatedDuration: 0,
      targetVelocityWorld: null,
      freeRevEngineRpm: undefined,
      verticalAccelerationMps2: 0,
      groundHeightM: null,
      grounded: false,
      wheelGrounded: false,
      supportedWheelCount: 0,
      validTreadContactByWheel: {},
      invalidContactReasonByWheel: {},
      geometricTerrainProximityByWheel: {},
      contactTypeByWheel: {},
      wheelLoadsN: {},
      wheelSlip: {},
      suspensionTravel: {},
      suspensionState: {},
      tireForcesN: {},
      wheelAngularVelocityRadps: {},
      wheelAngularMomentumReactionImpulseWorldNms,
      contactPatches,
      suspensionImpulseByWheelNs,
      tireVerticalImpulseByWheelNs,
      aeroState: {},
      powertrainState: {},
      powertrainTelemetry: {},
      steeringTelemetry: {},
      bodyCollision
    },
    bodyContactPool: [],
    wheelCylinderSweepPool: [],
    aggregatedContactPatches: contactPatches,
    aggregatedWheelAngularMomentumReactionImpulseWorldNms:
      wheelAngularMomentumReactionImpulseWorldNms,
    bodyCcdActivations: 0,
    wheelCcdActivations: 0
  };
}

function createIntegrationResultScratch() {
  const wheelAngularMomentumReactionImpulseWorldNms = {};
  const rolloverSources = {};
  for (const name of [
    'leftTireLateral', 'rightTireLateral', 'suspensionNormal', 'antiRollLoadTransfer',
    'bumpStops', 'hardStops', 'wheelLeadingTreadCollision', 'wheelSidewallCollision',
    'bodyCollision', 'handlingAssist', 'aerodynamicForce'
  ]) rolloverSources[name] = { rollMomentNm: 0, rollAngularImpulseNms: 0 };
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    wheelAngularMomentumReactionImpulseWorldNms[RACE_WHEEL_IDS[wheelIndex]] = {
      x: 0,
      y: 0,
      z: 0
    };
  }
  return {
    emptyBodyContacts: [],
    emptyCollisionImpulses: [],
    totalLinearImpulse: { x: 0, y: 0, z: 0 },
    totalAngularImpulse: { x: 0, y: 0, z: 0 },
    postSubstepAngularImpulse: { x: 0, y: 0, z: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
    result: {
      totalForceWorldN: { x: 0, y: 0, z: 0 },
      totalMomentWorldNm: { x: 0, y: 0, z: 0 },
      linearImpulseWorldNs: null,
      angularImpulseWorldNms: null,
      tireImpulseWorldNs: { x: 0, y: 0, z: 0 },
      suspensionImpulseWorldNs: { x: 0, y: 0, z: 0 },
      aerodynamicAndExternalImpulseWorldNs: { x: 0, y: 0, z: 0 },
      bodyCollisionImpulseWorldNs: { x: 0, y: 0, z: 0 },
      bodyCollisionAngularImpulseWorldNms: { x: 0, y: 0, z: 0 },
      bodyCollision: {},
      wheelAngularMomentumReactionImpulseWorldNms,
      bodyContacts: [],
      collisionImpulseWorldNs: { x: 0, y: 0, z: 0 },
      supportScale: 0,
      groundConstraintImpulseNs: 0,
      assistInterventions: [],
      rollover: {
        sources: rolloverSources,
        cgHeightM: 0,
        effectiveSupportPolygon: [],
        supportedWheelCount: 0,
        insideWheelLoadN: 0,
        outsideWheelLoadN: 0,
        lateralAccelerationMps2: 0,
        rollAngleRad: 0,
        rollVelocityRadps: 0,
        contactFeatures: [],
        classification: null
      },
      sleeping: false,
      collisionImpulses: []
    }
  };
}

function createTireSubstepIntegrationScratch() {
  return {
    externalForceWorldN: { x: 0, y: 0, z: 0 },
    externalMomentWorldNm: { x: 0, y: 0, z: 0 },
    tireAndSuspensionLinearImpulse: { x: 0, y: 0, z: 0 },
    aeroAndGravityLinearImpulse: { x: 0, y: 0, z: 0 },
    tireAngularImpulse: { x: 0, y: 0, z: 0 },
    externalAngularImpulse: { x: 0, y: 0, z: 0 },
    suspensionBodyContactSupport: {
      supportedWheelCount: 0,
      availableBumpTravelM: 0,
      bottomedOutWheelCount: 0,
      maximumOvertravelM: 0
    },
    environmentRequest: {},
    aeroRequest: {},
    tireStepRequest: {},
    angularMotionRequest: {},
    zeroAngularImpulse: { x: 0, y: 0, z: 0 },
    wheelSweepRequest: {},
    bodyCollisionRequest: {},
    deferredBodyCollisionResult: {
      linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
      angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
      positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
      positionalAngularCorrectionWorldRad: { x: 0, y: 0, z: 0 },
      contacts: [],
      broadphaseRejected: true,
      terrainCollisionDeferred: true,
      bodySupportLod: 'chassis-rate-deferred',
      maximumPenetrationM: 0,
      bodyNormalImpulseNs: 0,
      bodyFrictionImpulseNs: 0,
      restitutionContributionNs: 0
    },
    surfaceConsistencyRequest: {},
    emptySurfaceConsistency: { samples: [], discrepancies: [] },
    clearPenetrationSample: {
      maximumPenetrationM: 0,
      invalidTerrainSampleCount: 0,
      allBodySamplesBelowTerrain: false,
      allTerrainSamplesInvalid: false
    },
    staticPenetrationSample: {
      maximumPenetrationM: 0,
      minimumPenetrationM: 0,
      deepestNormal: null,
      invalidTerrainSampleCount: 0,
      validTerrainSampleCount: 1,
      belowTerrainSampleCount: 0,
      validLowerBodySupportSampleCount: 1,
      submergedLowerBodySupportSampleCount: 0,
      minimumLowerBodySupportPenetrationM: 0,
      terrainTriangleIds: [],
      terrainSources: [],
      terrainRegions: [],
      penetratingFeatureIds: [],
      allLowerBodySupportFeaturesBelowTerrain: false,
      allBodySamplesBelowTerrain: false,
      allTerrainSamplesInvalid: false
    }
  };
}

function resetMutableVector3(value) {
  value.x = 0;
  value.y = 0;
  value.z = 0;
}

function copyMutableVector3(target, source) {
  target.x = Number(source?.x || 0);
  target.y = Number(source?.y || 0);
  target.z = Number(source?.z || 0);
}

function copyRaceWheelMap(target, source) {
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    target[wheelId] = source?.[wheelId];
  }
}

function createMutableSubstepState() {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocityWorld: { x: 0, y: 0, z: 0 },
    wheelLoadsN: {},
    wheelSlip: {},
    suspensionTravel: {},
    wheelAngularVelocityRadps: {}
  };
}

function copyVehicleStateIntoSubstep(target, source) {
  const position = target.position;
  const velocity = target.velocity;
  const orientation = target.orientation;
  const angularVelocityWorld = target.angularVelocityWorld;
  const wheelLoadsN = target.wheelLoadsN;
  const wheelSlip = target.wheelSlip;
  const suspensionTravel = target.suspensionTravel;
  const wheelAngularVelocityRadps = target.wheelAngularVelocityRadps;
  Object.assign(target, source);
  target.position = position;
  target.velocity = velocity;
  target.orientation = orientation;
  target.angularVelocityWorld = angularVelocityWorld;
  target.wheelLoadsN = wheelLoadsN;
  target.wheelSlip = wheelSlip;
  target.suspensionTravel = suspensionTravel;
  target.wheelAngularVelocityRadps = wheelAngularVelocityRadps;
  copyMutableVector3(position, source.position);
  copyMutableVector3(velocity, source.velocity);
  copyMutableVector3(angularVelocityWorld, source.angularVelocityWorld);
  orientation.x = Number(source.orientation?.x || 0);
  orientation.y = Number(source.orientation?.y || 0);
  orientation.z = Number(source.orientation?.z || 0);
  orientation.w = Number(source.orientation?.w ?? 1);
  copyRaceWheelMap(wheelLoadsN, source.wheelLoadsN);
  copyRaceWheelMap(wheelSlip, source.wheelSlip);
  copyRaceWheelMap(suspensionTravel, source.suspensionTravel);
  copyRaceWheelMap(wheelAngularVelocityRadps, source.wheelAngularVelocityRadps);
  return target;
}

function copySubstepStartState(target, source) {
  copyMutableVector3(target.position, source.position);
  copyMutableVector3(target.velocity, source.velocity);
  copyMutableVector3(target.angularVelocityWorld, source.angularVelocityWorld);
  target.orientation.x = Number(source.orientation?.x || 0);
  target.orientation.y = Number(source.orientation?.y || 0);
  target.orientation.z = Number(source.orientation?.z || 0);
  target.orientation.w = Number(source.orientation?.w ?? 1);
  target.contactPatches = source.contactPatches || {};
  return target;
}

function accumulateScaledVector3(target, value, scale) {
  target.x += Number(value?.x || 0) * scale;
  target.y += Number(value?.y || 0) * scale;
  target.z += Number(value?.z || 0) * scale;
}

function aggregateTireResults(results = [], tireSubstepDt = 0, scratch = createTireAggregateScratch()) {
  const output = scratch.result;
  const count = Math.max(1, results.length);
  const accumulatedDuration = Math.max(EPSILON, results.length * tireSubstepDt);
  const latest = results[results.length - 1] || {};
  resetMutableVector3(output.tireImpulseWorldNs);
  resetMutableVector3(output.suspensionImpulseWorldNs);
  resetMutableVector3(output.externalImpulseWorldNs);
  resetMutableVector3(output.tireAngularImpulseWorldNms);
  resetMutableVector3(output.externalAngularImpulseWorldNms);
  let longitudinalForceN = 0;
  let lateralForceN = 0;
  let yawMomentNm = 0;
  let verticalAccelerationMps2 = 0;
  let grounded = false;
  const singleResult = results.length === 1;
  if (singleResult) {
    const result = latest;
    longitudinalForceN = Number(result.longitudinalForceN || 0);
    lateralForceN = Number(result.lateralForceN || 0);
    yawMomentNm = Number(result.yawMomentNm || 0);
    verticalAccelerationMps2 = Number(result.verticalAccelerationMps2 || 0);
    grounded = result.grounded !== false;
    accumulateScaledVector3(output.tireImpulseWorldNs, result.worldForceN, tireSubstepDt);
    accumulateScaledVector3(
      output.suspensionImpulseWorldNs,
      result.suspensionForceWorldN,
      tireSubstepDt
    );
    accumulateScaledVector3(output.externalImpulseWorldNs, result.externalForceWorldN, tireSubstepDt);
    accumulateScaledVector3(
      output.tireAngularImpulseWorldNms,
      result.worldMomentNm,
      tireSubstepDt
    );
    accumulateScaledVector3(
      output.externalAngularImpulseWorldNms,
      result.externalMomentWorldNm,
      tireSubstepDt
    );
    output.contactPatches = latest.contactPatches || scratch.aggregatedContactPatches;
    output.wheelAngularMomentumReactionImpulseWorldNms = (
      latest.wheelAngularMomentumReactionImpulseWorldNms
      || scratch.aggregatedWheelAngularMomentumReactionImpulseWorldNms
    );
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const patch = result.contactPatches?.[wheelId];
      output.suspensionImpulseByWheelNs[wheelId] = quantize(
        Number(patch?.suspensionForceN || 0) * tireSubstepDt
      );
      output.tireVerticalImpulseByWheelNs[wheelId] = quantize(
        Number(patch?.tireVerticalForceN || 0) * tireSubstepDt
      );
    }
  } else {
    output.contactPatches = scratch.aggregatedContactPatches;
    output.wheelAngularMomentumReactionImpulseWorldNms = (
      scratch.aggregatedWheelAngularMomentumReactionImpulseWorldNms
    );
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const tireEnergyWork = output.contactPatches[wheelId].tireEnergyWork;
      output.suspensionImpulseByWheelNs[wheelId] = 0;
      output.tireVerticalImpulseByWheelNs[wheelId] = 0;
      resetMutableVector3(output.wheelAngularMomentumReactionImpulseWorldNms[wheelId]);
      for (let fieldIndex = 0; fieldIndex < TIRE_ENERGY_WORK_FIELDS.length; fieldIndex += 1) {
        tireEnergyWork[TIRE_ENERGY_WORK_FIELDS[fieldIndex]] = 0;
      }
    }
    for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
      const result = results[resultIndex];
      longitudinalForceN += Number(result.longitudinalForceN || 0);
      lateralForceN += Number(result.lateralForceN || 0);
      yawMomentNm += Number(result.yawMomentNm || 0);
      verticalAccelerationMps2 += Number(result.verticalAccelerationMps2 || 0);
      grounded ||= result.grounded !== false;
      accumulateScaledVector3(output.tireImpulseWorldNs, result.worldForceN, tireSubstepDt);
      accumulateScaledVector3(
        output.suspensionImpulseWorldNs,
        result.suspensionForceWorldN,
        tireSubstepDt
      );
      accumulateScaledVector3(output.externalImpulseWorldNs, result.externalForceWorldN, tireSubstepDt);
      accumulateScaledVector3(
        output.tireAngularImpulseWorldNms,
        result.worldMomentNm,
        tireSubstepDt
      );
      accumulateScaledVector3(
        output.externalAngularImpulseWorldNms,
        result.externalMomentWorldNm,
        tireSubstepDt
      );
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const wheelId = RACE_WHEEL_IDS[wheelIndex];
        const patch = result.contactPatches?.[wheelId];
        const tireEnergyWork = output.contactPatches[wheelId].tireEnergyWork;
        for (let fieldIndex = 0; fieldIndex < TIRE_ENERGY_WORK_FIELDS.length; fieldIndex += 1) {
          const field = TIRE_ENERGY_WORK_FIELDS[fieldIndex];
          tireEnergyWork[field] += Number(patch?.tireEnergyWork?.[field] || 0);
        }
        output.suspensionImpulseByWheelNs[wheelId] += Number(patch?.suspensionForceN || 0)
          * tireSubstepDt;
        output.tireVerticalImpulseByWheelNs[wheelId] += Number(patch?.tireVerticalForceN || 0)
          * tireSubstepDt;
        accumulateScaledVector3(
          output.wheelAngularMomentumReactionImpulseWorldNms[wheelId],
          result.wheelAngularMomentumReactionImpulseWorldNms?.[wheelId],
          1
        );
      }
    }
  }
  const inverseDuration = 1 / accumulatedDuration;
  output.worldForceN.x = output.tireImpulseWorldNs.x * inverseDuration;
  output.worldForceN.y = output.tireImpulseWorldNs.y * inverseDuration;
  output.worldForceN.z = output.tireImpulseWorldNs.z * inverseDuration;
  output.worldMomentNm.x = output.tireAngularImpulseWorldNms.x * inverseDuration;
  output.worldMomentNm.y = output.tireAngularImpulseWorldNms.y * inverseDuration;
  output.worldMomentNm.z = output.tireAngularImpulseWorldNms.z * inverseDuration;
  output.suspensionForceWorldN.x = output.suspensionImpulseWorldNs.x * inverseDuration;
  output.suspensionForceWorldN.y = output.suspensionImpulseWorldNs.y * inverseDuration;
  output.suspensionForceWorldN.z = output.suspensionImpulseWorldNs.z * inverseDuration;
  output.externalForceWorldN.x = output.externalImpulseWorldNs.x * inverseDuration;
  output.externalForceWorldN.y = output.externalImpulseWorldNs.y * inverseDuration;
  output.externalForceWorldN.z = output.externalImpulseWorldNs.z * inverseDuration;
  output.externalMomentWorldNm.x = output.externalAngularImpulseWorldNms.x * inverseDuration;
  output.externalMomentWorldNm.y = output.externalAngularImpulseWorldNms.y * inverseDuration;
  output.externalMomentWorldNm.z = output.externalAngularImpulseWorldNms.z * inverseDuration;
  if (!singleResult) {
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const aggregatePatch = output.contactPatches[wheelId];
      const tireEnergyWork = aggregatePatch.tireEnergyWork;
      Object.assign(aggregatePatch, latest.contactPatches?.[wheelId] || {});
      aggregatePatch.tireEnergyWork = tireEnergyWork;
      for (let fieldIndex = 0; fieldIndex < TIRE_ENERGY_WORK_FIELDS.length; fieldIndex += 1) {
        const field = TIRE_ENERGY_WORK_FIELDS[fieldIndex];
        tireEnergyWork[field] = quantize(tireEnergyWork[field]);
      }
      output.suspensionImpulseByWheelNs[wheelId] = quantize(
        output.suspensionImpulseByWheelNs[wheelId]
      );
      output.tireVerticalImpulseByWheelNs[wheelId] = quantize(
        output.tireVerticalImpulseByWheelNs[wheelId]
      );
    }
  }
  output.longitudinalForceN = quantize(longitudinalForceN / count);
  output.lateralForceN = quantize(lateralForceN / count);
  output.yawMomentNm = quantize(yawMomentNm / count);
  output.verticalAccelerationMps2 = quantize(verticalAccelerationMps2 / count);
  output.accumulatedDuration = accumulatedDuration;
  output.targetVelocityWorld = latest.targetVelocityWorld || null;
  output.freeRevEngineRpm = latest.freeRevEngineRpm;
  output.groundHeightM = latest.groundHeightM ?? null;
  output.grounded = grounded;
  output.wheelGrounded = latest.wheelGrounded === true;
  output.supportedWheelCount = Math.max(0, Number(latest.supportedWheelCount || 0));
  output.validTreadContactByWheel = latest.validTreadContactByWheel || {};
  output.invalidContactReasonByWheel = latest.invalidContactReasonByWheel || {};
  output.geometricTerrainProximityByWheel = latest.geometricTerrainProximityByWheel || {};
  output.contactTypeByWheel = latest.contactTypeByWheel || {};
  output.wheelLoadsN = latest.wheelLoadsN || {};
  output.wheelSlip = latest.wheelSlip || {};
  output.suspensionTravel = latest.suspensionTravel || {};
  output.suspensionState = latest.suspensionState || {};
  output.tireForcesN = latest.tireForcesN || {};
  output.wheelAngularVelocityRadps = latest.wheelAngularVelocityRadps || {};
  output.aeroState = latest.aeroState || {};
  output.powertrainState = latest.powertrainState || {};
  output.powertrainTelemetry = latest.powertrainTelemetry || {};
  output.steeringTelemetry = latest.steeringTelemetry || {};
  // Equivalent forces remain useful telemetry, but chassis integration
  // consumes the corresponding impulses above. No final substep vector is
  // stretched over the public chassis interval.
  return output;
}

function assignPooledSubstepRecord(pool, index, source, substepIndex) {
  let target = pool[index];
  if (!target) {
    target = {};
    pool[index] = target;
  } else {
    for (const key in target) delete target[key];
  }
  Object.assign(target, source);
  target.substepIndex = substepIndex;
  return target;
}

function aggregateBodyCollisionResults(results, scratch) {
  const output = scratch.result.bodyCollision;
  resetMutableVector3(output.linearImpulseWorldNs);
  resetMutableVector3(output.angularImpulseWorldNms);
  resetMutableVector3(output.positionalCorrectionWorldM);
  resetMutableVector3(output.positionalAngularCorrectionWorldRad);
  output.contacts.length = 0;
  output.wheelCylinderSweeps.length = 0;
  output.emergencyRecoveries.length = 0;
  output.ordinaryCorrections.length = 0;
  output.localCcdRollbacks.length = 0;
  output.catastrophicRecoveries.length = 0;
  output.surfaceDiscrepancies.length = 0;
  output.bodyNormalImpulseNs = 0;
  output.bodyFrictionImpulseNs = 0;
  output.wheelCylinderNormalImpulseNs = 0;
  output.wheelCylinderFrictionImpulseNs = 0;
  output.restitutionContributionNs = 0;
  output.penetrationBiasContributionNs = 0;
  output.sweptContactCount = 0;
  output.maximumPenetrationAfterSolveM = 0;
  output.initialUnsupportedMaximumPenetrationM = 0;
  output.initialUnsupportedAllBodySamplesBelowTerrain = false;
  scratch.bodyCcdActivations = 0;
  scratch.wheelCcdActivations = 0;
  let broadphaseRejectedSubsteps = 0;
  let contactPoolIndex = 0;
  let wheelSweepPoolIndex = 0;
  for (let substepIndex = 0; substepIndex < results.length; substepIndex += 1) {
    const result = results[substepIndex];
    if (result.broadphaseRejected) broadphaseRejectedSubsteps += 1;
    if (result.swept) {
      output.sweptContactCount += 1;
      if (result.sweepSource === 'body') scratch.bodyCcdActivations += 1;
      if (result.sweepSource === 'wheel-cylinder') scratch.wheelCcdActivations += 1;
    }
    accumulateScaledVector3(output.linearImpulseWorldNs, result.linearImpulseWorldNs, 1);
    accumulateScaledVector3(output.angularImpulseWorldNms, result.angularImpulseWorldNms, 1);
    accumulateScaledVector3(
      output.positionalCorrectionWorldM,
      result.positionalCorrectionWorldM,
      1
    );
    accumulateScaledVector3(
      output.positionalAngularCorrectionWorldRad,
      result.positionalAngularCorrectionWorldRad,
      1
    );
    const contacts = result.contacts || [];
    for (let contactIndex = 0; contactIndex < contacts.length; contactIndex += 1) {
      output.contacts.push(assignPooledSubstepRecord(
        scratch.bodyContactPool,
        contactPoolIndex,
        contacts[contactIndex],
        substepIndex
      ));
      contactPoolIndex += 1;
    }
    output.bodyNormalImpulseNs += Number(result.bodyNormalImpulseNs || 0);
    output.bodyFrictionImpulseNs += Number(result.bodyFrictionImpulseNs || 0);
    output.wheelCylinderNormalImpulseNs += Number(result.wheelCylinderNormalImpulseNs || 0);
    output.wheelCylinderFrictionImpulseNs += Number(result.wheelCylinderFrictionImpulseNs || 0);
    if (result.wheelCylinderSweep) {
      output.wheelCylinderSweeps.push(assignPooledSubstepRecord(
        scratch.wheelCylinderSweepPool,
        wheelSweepPoolIndex,
        result.wheelCylinderSweep,
        substepIndex
      ));
      wheelSweepPoolIndex += 1;
    }
    output.restitutionContributionNs += Number(result.restitutionContributionNs || 0);
    output.maximumPenetrationAfterSolveM = Math.max(
      output.maximumPenetrationAfterSolveM,
      Number(result.maximumPenetrationAfterSolveM || 0)
    );
    output.initialUnsupportedMaximumPenetrationM = Math.max(
      output.initialUnsupportedMaximumPenetrationM,
      Number(result.initialUnsupportedMaximumPenetrationM || 0)
    );
    output.initialUnsupportedAllBodySamplesBelowTerrain ||= (
      result.initialUnsupportedAllBodySamplesBelowTerrain === true
    );
    if (result.emergencyRecovery) output.emergencyRecoveries.push(result.emergencyRecovery);
    if (result.ordinaryContactStabilization) {
      output.ordinaryCorrections.push(result.ordinaryContactStabilization);
    }
    if (result.localCcdRollback) output.localCcdRollbacks.push(result.localCcdRollback);
    if (result.catastrophicRecovery) {
      output.catastrophicRecoveries.push(result.catastrophicRecovery);
    }
    const discrepancies = result.surfaceConsistency?.discrepancies || [];
    for (let discrepancyIndex = 0; discrepancyIndex < discrepancies.length; discrepancyIndex += 1) {
      output.surfaceDiscrepancies.push(discrepancies[discrepancyIndex]);
    }
  }
  const correctionMagnitude = Math.hypot(
    output.positionalCorrectionWorldM.x,
    output.positionalCorrectionWorldM.y,
    output.positionalCorrectionWorldM.z
  );
  if (correctionMagnitude > 0.12) {
    const correctionScale = 0.12 / correctionMagnitude;
    output.positionalCorrectionWorldM.x *= correctionScale;
    output.positionalCorrectionWorldM.y *= correctionScale;
    output.positionalCorrectionWorldM.z *= correctionScale;
  }
  const latestContacts = results[results.length - 1]?.contacts || [];
  output.bodyGrounded = false;
  output.wheelSidewallGrounded = false;
  output.wheelCylinderGrounded = false;
  for (let contactIndex = 0; contactIndex < latestContacts.length; contactIndex += 1) {
    const contactType = String(latestContacts[contactIndex].contactType || '');
    if (!contactType.startsWith('wheel-')) output.bodyGrounded = true;
    if (contactType === 'wheel-sidewall') output.wheelSidewallGrounded = true;
    if (contactType.startsWith('wheel-')) output.wheelCylinderGrounded = true;
  }
  output.broadphaseRejectedSubsteps = broadphaseRejectedSubsteps;
  return output;
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

function createVehicleDifferenceScratch() {
  return {
    speedMps: null,
    position: { x: null, y: null, z: null },
    yawRad: null,
    yawRateRadps: null,
    lateralAccelerationMps2: null,
    wheelLoadsN: { fl: null, fr: null, rl: null, rr: null },
    wheelSlip: { fl: null, fr: null, rl: null, rr: null },
    engineRpm: null,
    suspensionTravel: { fl: null, fr: null, rl: null, rr: null }
  };
}

function compareVehicleStates(legacy, shadow, target = null) {
  if (!legacy) return null;
  const output = target || createVehicleDifferenceScratch();
  output.speedMps = createDifference(legacy.speedMps, shadow.speedMps);
  output.position.x = createDifference(legacy.position?.x, shadow.position.x);
  output.position.y = createDifference(legacy.position?.y, shadow.position.y);
  output.position.z = createDifference(legacy.position?.z, shadow.position.z);
  output.yawRad = createDifference(legacy.yawRad, shadow.yawRad);
  output.yawRateRadps = createDifference(legacy.yawRateRadps, shadow.yawRateRadps);
  output.lateralAccelerationMps2 = createDifference(
    legacy.lateralAccelerationMps2,
    shadow.lateralAccelerationMps2
  );
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    output.wheelLoadsN[wheelId] = createDifference(
      legacy.wheelLoadsN?.[wheelId], shadow.wheelLoadsN?.[wheelId]
    );
    output.wheelSlip[wheelId] = createDifference(
      legacy.wheelSlip?.[wheelId], shadow.wheelSlip?.[wheelId]
    );
    output.suspensionTravel[wheelId] = createDifference(
      legacy.suspensionTravel?.[wheelId], shadow.suspensionTravel?.[wheelId]
    );
  }
  output.engineRpm = createDifference(legacy.engineRpm, shadow.engineRpm);
  return output;
}

export class VehicleDynamicsRunner {
  constructor({
    config = {},
    initialState = {},
    inputTimeline = null,
    tireContactSubsystem = null,
    environmentProvider = null,
    handlingAssist = null,
    physicsIncidentRecorder = null,
    physicsCostAccounting = null
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
    this.physicsCostAccounting = physicsCostAccounting instanceof PhysicsCostAccounting
      ? physicsCostAccounting
      : new PhysicsCostAccounting({ enabled: this.config.physicsCostAccountingEnabled });
    this.physicsStepBeginMetadataScratch = {
      stepIndex: 0,
      tireHz: this.config.tireHz,
      chassisHz: this.config.chassisHz
    };
    this.physicsStepFinishMetadataScratch = {
      stepIndex: 0,
      tireSubsteps: 0
    };
    this.physicsIncidentRecorder = physicsIncidentRecorder || new PhysicsIncidentRecorder({
      tireHz: this.config.tireHz,
      preIncidentSeconds: this.config.physicsIncidentPreSeconds,
      postIncidentSeconds: this.config.physicsIncidentPostSeconds,
      enabled: this.config.physicsIncidentRecordingEnabled,
      vehicleConfiguration: this.config
    });
    this.bodyAngularMotionScratch = createBodyAngularMotionScratch();
    this.eulerScratch = { yaw: 0, pitch: 0, roll: 0 };
    this.emptyWheelCylinderSweeps = [];
    this.emptyWheelCollisionSupportFeatures = [];
    this.zeroWakeState = {
      intensity: 0,
      dragReduction: 0,
      frontDownforceLoss: 0,
      rearDownforceChange: 0,
      turbulence: 0,
      lateralTurbulence: 0,
      crosswindRisk: 0,
      contributions: []
    };
    this.pendingCollisionImpulses = [];
    this.collisionTimeline = [];
    this.scheduledReplayCollisions = new Map();
    this.resetTimeline = [];
    this.scheduledReplayResets = new Map();
    this.authoritativeResetSequence = 0;
    this.stationaryResetHold = null;
    this.suspensionModeSettleSteps = 0;
    this.stepIndex = 0;
    this.renderWheelSpinAngles = Object.fromEntries(
      RACE_WHEEL_IDS.map((wheelId) => [wheelId, 0])
    );
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
    this.takeoffFrontSuspensionSamplePool = Array.from(
      { length: 96 }, () => ({ timeSeconds: 0, impulseNs: 0 })
    );
    this.takeoffRearSuspensionSamplePool = Array.from(
      { length: 96 }, () => ({ timeSeconds: 0, impulseNs: 0 })
    );
    this.takeoffUnderbodyContactPool = Array.from(
      { length: 48 }, () => ({ timeSeconds: 0, id: null, penetrationM: 0 })
    );
    this.takeoffFlightSamplePool = Array.from(
      { length: 384 },
      () => ({ timeSeconds: 0, pitchAngleRad: 0, pitchAngularVelocityRadps: 0 })
    );
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
    this.contactStabilizationState = {
      sequence: 0,
      ordinaryCorrectionCount: 0,
      localCcdRollbackCount: 0,
      catastrophicHistoricalRecoveryCount: 0,
      catastrophicRouteRecoveryCount: 0,
      gameplayResetCount: 0,
      temporaryInvalidTerrainCount: 0,
      invalidTerrainSubsteps: 0,
      invalidTerrainDurationSeconds: 0,
      localRollbackFailureCount: 0,
      latest: null,
      history: []
    };
    this.lastValidLocalCollisionFrame = null;
    // A rollback source only remains eligible for two chassis steps. Eight
    // slots therefore cover the maximum six 360 Hz contact substeps without
    // retaining a deep JSON clone of every wheel/contact graph each substep.
    this.localCollisionFrameScratchCursor = 0;
    this.localCollisionFrameScratch = Array.from({ length: 8 }, () => ({
      stepIndex: 0,
      substepIndex: 0,
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocityWorld: { x: 0, y: 0, z: 0 },
      suspensionState: null,
      tireState: null,
      wheelAngularVelocityRadps: null,
      wheelLoadsN: null,
      wheelSlip: null,
      contactPatches: null,
      powertrainState: null,
      routeDistance: null,
      supportNormal: { x: 0, y: 1, z: 0 }
    }));
    // Aggregate outputs can remain reachable from the public state until a
    // later chassis boundary. Rotate a bounded scratch ring instead of
    // rebuilding its wheel maps and vector graph at 120 Hz.
    this.tireAggregateScratchCursor = 0;
    this.tireAggregateScratch = Array.from(
      { length: 8 },
      () => createTireAggregateScratch()
    );
    this.integrationResultScratchCursor = 0;
    this.integrationResultScratch = Array.from(
      { length: 8 },
      () => createIntegrationResultScratch()
    );
    this.tireSubstepResultsScratch = [];
    this.bodyCollisionResultsScratch = [];
    this.sampledControlsScratch = { assists: {} };
    this.legacyDifferenceScratch = createVehicleDifferenceScratch();
    this.transientTelemetryScratch = { catchUp: {} };
    this.tireThermalScratch = { fl: {}, fr: {}, rl: {}, rr: {} };
    this.initialNearBumpByWheelScratch = Object.fromEntries(
      RACE_WHEEL_IDS.map((wheelId) => [wheelId, false])
    );
    this.substepStateScratch = createMutableSubstepState();
    this.tireSubstepIntegrationScratch = Array.from({
      length: Math.max(1, Math.ceil(this.config.tireSubstepsPerChassisStep))
    }, createTireSubstepIntegrationScratch);
    this.substepStartStateScratch = Array.from({
      length: Math.max(1, Math.ceil(this.config.tireSubstepsPerChassisStep))
    }, () => ({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocityWorld: { x: 0, y: 0, z: 0 },
      contactPatches: null
    }));
    this.surfaceConsistencyCursor = 0;
    this.diagnostics = {
      completedSteps: 0,
      completedTireSubsteps: 0,
      catchUpLimitedAdvances: 0,
      catchUpBudgetWarnings: 0,
      lastCatchUpBudgetWarning: null,
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
    this.stationaryResetHold = null;
    if (!nextState.wheelAngularVelocityRadps) {
      RACE_WHEEL_IDS.forEach((wheelId) => {
        this.state.wheelAngularVelocityRadps[wheelId] = quantize(
          this.state.speedMps / this.config.wheelRadiusM
        );
      });
    }
    this.pendingCollisionImpulses = [];
    this.lastValidLocalCollisionFrame = null;
    this.contactStabilizationState.invalidTerrainSubsteps = 0;
    this.contactStabilizationState.invalidTerrainDurationSeconds = 0;
    return this.createStateSnapshot();
  }

  resetAuthoritativeState(nextState = {}, {
    reason = 'authoritative-reset',
    record = true,
    rebuildContacts = true,
    parkUntilDrive = false
  } = {}) {
    const routeDistance = finiteNumber(nextState.routeDistance);
    const idleRpm = Math.max(0, Number(this.config.idleRpm || 800));
    const requestedGear = Math.trunc(Number(nextState.gear ?? 1) || 0);
    // TireState also carries a copy of the last contact patch for thermal
    // accounting. That patch contains crash-frame hub/contact geometry,
    // relaxation, force, and vertical-deflection fields and must never cross
    // an authoritative reset. Preserve only actual long-lived tire condition.
    const preservedTireState = copyPersistentTireState(
      nextState.tireState || this.state.tireState || {}
    );
    let resetState = createVehicleDynamicsState({
      ...nextState,
      velocity: { x: 0, y: 0, z: 0 },
      speedMps: 0,
      groundSpeedMps: 0,
      bodyLongitudinalSpeedMps: 0,
      bodyLateralSpeedMps: 0,
      signedTravelSpeedMps: 0,
      yawRateRadps: 0,
      angularVelocityWorld: { x: 0, y: 0, z: 0 },
      engineRpm: idleRpm,
      gear: requestedGear,
      handbrakeCommandState: {
        active: false,
        remainingSeconds: 0,
        consumedHoldSequence: 0,
        direct: false
      },
      tireState: preservedTireState,
      suspensionState: {},
      contactPatches: {},
      wheelLoadsN: {},
      wheelSlip: {},
      wheelAngularVelocityRadps: {},
      grounded: true
    });
    if (routeDistance !== null) resetState.routeDistance = routeDistance;
    const resetTimeSeconds = this.simulationTimeSeconds;
    const environmentRequest = (state, resetContactRebuild = false) => ({
      timeSeconds: resetTimeSeconds,
      stepIndex: this.stepIndex,
      substepIndex: 0,
      state,
      previousState: state,
      controls: normalizeVehicleControlInput({ requestedGear }),
      tireSubstepDt: 0,
      chassisStepDt: 1 / this.config.chassisHz,
      reuseContactGeometry: false,
      contactRebuildOnly: resetContactRebuild,
      authoritativeReset: true,
      physicsCostAccounting: this.physicsCostAccounting
    });
    let environment = this.environmentProvider(environmentRequest(resetState)) || {};
    if (routeDistance !== null && typeof environment.getRouteRecoveryState === 'function') {
      const routeCandidate = environment.getRouteRecoveryState({
        failedState: clone(resetState),
        lastSafeState: null,
        preferredRouteDistances: [routeDistance],
        rejectedSourceKeys: [],
        failedRecoveryPaths: [],
        penetrationIncidentId: `reset-${this.authoritativeResetSequence + 1}`,
        reason,
        stage: 'user-reset',
        stepIndex: this.stepIndex
      });
      const selected = Array.isArray(routeCandidate) ? routeCandidate[0] : routeCandidate;
      if (selected?.position && selected?.orientation) {
        resetState = createVehicleDynamicsState({
          ...resetState,
          ...selected,
          velocity: { x: 0, y: 0, z: 0 },
          angularVelocityWorld: { x: 0, y: 0, z: 0 },
          wheelAngularVelocityRadps: {},
          wheelSlip: {},
          suspensionState: {},
          contactPatches: {},
          tireState: preservedTireState,
          engineRpm: idleRpm,
          gear: requestedGear
        });
        resetState.routeDistance = finiteNumber(selected.routeDistance) ?? routeDistance;
        environment = this.environmentProvider(environmentRequest(resetState)) || environment;
      }
    }
    let bodySample = this.bodyCollision.samplePosePenetration(
      resetState,
      environment,
      this.config.bodyCollisionToleranceM
    );
    // Packed worker environments intentionally do not carry route geometry.
    // They can still validate and conservatively depenetrate the compact pose
    // supplied by the render-owned reset request using authoritative terrain.
    for (let attempt = 0; attempt < 8
      && bodySample.maximumPenetrationM !== null
      && Number(bodySample.invalidTerrainSampleCount || 0) === 0
      && Number(bodySample.maximumPenetrationM || 0)
        > this.config.bodyCollisionToleranceM + 1e-6;
      attempt += 1) {
      const normal = normalizeRecoveryNormal(bodySample.deepestNormal || { x: 0, y: 1, z: 0 });
      const correctionM = Number(bodySample.maximumPenetrationM || 0)
        + this.config.penetrationRecoverySafetyMarginM;
      resetState.position = addVector3(
        resetState.position,
        scaleVector3(normal, correctionM)
      );
      environment = this.environmentProvider(environmentRequest(resetState)) || environment;
      bodySample = this.bodyCollision.samplePosePenetration(
        resetState,
        environment,
        this.config.bodyCollisionToleranceM
      );
    }
    if (bodySample.maximumPenetrationM === null
      || Number(bodySample.invalidTerrainSampleCount || 0) > 0
      || Number(bodySample.maximumPenetrationM || 0)
        > this.config.bodyCollisionToleranceM + 1e-6) {
      throw new Error('Unable to find a collision-safe vehicle reset pose');
    }
    let rebuilt = null;
    if (rebuildContacts) {
      environment = this.environmentProvider(environmentRequest(resetState, true)) || environment;
      rebuilt = this.tireContactSubsystem.step({
        state: resetState,
        controls: normalizeVehicleControlInput({ requestedGear }),
        config: this.config,
        environment,
        dt: 0,
        stepIndex: this.stepIndex,
        substepIndex: 0,
        timeSeconds: resetTimeSeconds,
        contactRebuildOnly: true,
        authoritativeReset: true
      }) || {};
      for (const field of [
        'suspensionState', 'tireState', 'wheelLoadsN', 'wheelSlip',
        'wheelAngularVelocityRadps', 'contactPatches', 'suspensionTravel',
        'validTreadContactByWheel', 'invalidContactReasonByWheel',
        'supportedWheelCount', 'grounded', 'wheelGrounded', 'powertrainState'
      ]) {
        if (rebuilt[field] !== undefined) resetState[field] = clone(rebuilt[field]);
      }
    }
    for (const wheelId of RACE_WHEEL_IDS) {
      resetState.wheelAngularVelocityRadps[wheelId] = 0;
      resetState.wheelSlip[wheelId] = 0;
      const suspension = resetState.suspensionState[wheelId] || {};
      suspension.unsprungVelocityMps = 0;
      suspension.compressionVelocityMps = 0;
      suspension.damperVelocityMps = 0;
      resetState.suspensionState[wheelId] = suspension;
      const patch = resetState.contactPatches[wheelId];
      if (patch) {
        patch.relaxedSlipRatio = 0;
        patch.relaxedSlipAngleRad = 0;
        patch.breakawayActive = false;
      }
    }
    resetState.velocity = { x: 0, y: 0, z: 0 };
    resetState.angularVelocityWorld = { x: 0, y: 0, z: 0 };
    resetState.speedMps = 0;
    resetState.groundSpeedMps = 0;
    resetState.bodyLongitudinalSpeedMps = 0;
    resetState.bodyLateralSpeedMps = 0;
    resetState.signedTravelSpeedMps = 0;
    resetState.yawRateRadps = 0;
    resetState.engineRpm = idleRpm;
    resetState.gear = requestedGear;
    resetState.penetrationRecovery = null;
    this.state = resetState;
    for (const wheelId of RACE_WHEEL_IDS) this.renderWheelSpinAngles[wheelId] = 0;
    this.stationaryResetHold = parkUntilDrive ? {
      position: clone(resetState.position),
      orientation: clone(resetState.orientation),
      routeDistance: finiteNumber(resetState.routeDistance),
      suspensionState: clone(resetState.suspensionState),
      contactPatches: clone(resetState.contactPatches)
    } : null;
    this.suspensionModeSettleSteps = 0;
    this.pendingCollisionImpulses.length = 0;
    this.lastValidLocalCollisionFrame = rebuilt
      ? this.createLocalCollisionFrame(resetState, rebuilt, {
          stepIndex: this.stepIndex,
          substepIndex: 0,
          routeDistanceM: resetState.routeDistance,
          supportNormal: bodySample.deepestNormal || { x: 0, y: 1, z: 0 }
        })
      : null;
    this.lastNonPenetratingState = rebuilt
      ? this.createLastNonPenetratingState(resetState, rebuilt, this.stepIndex, {
          penetrationSample: bodySample,
          bodyResult: { residualPenetrationM: bodySample.maximumPenetrationM },
          routeDistanceM: resetState.routeDistance
        })
      : null;
    this.nonPenetratingStateHistory = this.lastNonPenetratingState
      ? [this.lastNonPenetratingState] : [];
    this.penetrationRecoveryState.previousMaximumPenetrationM = 0;
    this.penetrationRecoveryState.failedProgressSteps = 0;
    this.penetrationRecoveryState.lastProgressEvaluationStep = -1;
    this.penetrationRecoveryState.progressIncidentId = null;
    this.penetrationRecoveryState.currentIncident = null;
    this.contactStabilizationState.invalidTerrainSubsteps = 0;
    this.contactStabilizationState.invalidTerrainDurationSeconds = 0;
    this.contactStabilizationState.localRollbackFailureCount = 0;
    this.contactStabilizationState.latest = null;
    this.activeImpact = null;
    this.takeoffContactState = {
      initialized: false,
      frontGrounded: false,
      rearGrounded: false,
      recentFrontSuspensionImpulse: [],
      recentRearSuspensionImpulse: [],
      recentUnderbodyContacts: [],
      activeTakeoff: null
    };
    // Render observation can lead the last completed fixed step by a tiny
    // fraction. Any input at or after the authoritative reset belongs to the
    // discarded pre-reset future; otherwise a 1.0 throttle sample at e.g.
    // 10.0000000002 interpolates through a reset stamped at 10.0 and wakes it.
    this.inputTimeline.discardAtOrAfter(resetTimeSeconds);
    this.inputTimeline.addSample(resetTimeSeconds, {
      requestedGear,
      assists: { autoShift: true }
    }, { returnSnapshot: false });
    const settledSnapshot = this.createStateSnapshot();
    if (finiteNumber(resetState.routeDistance) !== null) {
      settledSnapshot.routeDistance = Number(resetState.routeDistance);
    }
    const event = {
      sequence: ++this.authoritativeResetSequence,
      stepIndex: this.stepIndex + 1,
      timeSeconds: resetTimeSeconds,
      reason,
      parkUntilDrive: Boolean(parkUntilDrive),
      state: settledSnapshot
    };
    if (record) this.resetTimeline.push(event);
    return { state: clone(settledSnapshot), event: clone(event) };
  }

  applyStationaryResetHold(state = this.state) {
    const hold = this.stationaryResetHold;
    if (!hold) return state;
    state.position = clone(hold.position);
    state.orientation = clone(hold.orientation);
    state.velocity = { x: 0, y: 0, z: 0 };
    state.angularVelocityWorld = { x: 0, y: 0, z: 0 };
    state.speedMps = 0;
    state.groundSpeedMps = 0;
    state.bodyLongitudinalSpeedMps = 0;
    state.bodyLateralSpeedMps = 0;
    state.signedTravelSpeedMps = 0;
    state.yawRateRadps = 0;
    state.suspensionState ||= {};
    state.contactPatches ||= {};
    if (hold.routeDistance !== null) state.routeDistance = hold.routeDistance;
    const euler = eulerFromQuaternion(state.orientation, this.eulerScratch);
    state.yawRad = quantize(euler.yaw);
    state.pitchRad = quantize(euler.pitch);
    state.rollRad = quantize(euler.roll);
    for (const wheelId of RACE_WHEEL_IDS) {
      state.wheelAngularVelocityRadps[wheelId] = 0;
      state.wheelSlip[wheelId] = 0;
      const heldSuspension = hold.suspensionState?.[wheelId];
      if (heldSuspension) {
        const suspension = state.suspensionState[wheelId] || {};
        Object.assign(suspension, heldSuspension);
        suspension.unsprungVelocityMps = 0;
        suspension.compressionVelocityMps = 0;
        suspension.damperVelocityMps = 0;
        state.suspensionState[wheelId] = suspension;
      }
      const heldPatch = hold.contactPatches?.[wheelId];
      if (heldPatch) {
        const patch = state.contactPatches[wheelId] || {};
        Object.assign(patch, heldPatch);
        state.contactPatches[wheelId] = patch;
      }
    }
    return state;
  }

  queueCollisionImpulse({ impulseWorldNs = {}, pointWorld = null, source = 'collision' } = {}, {
    record = true,
    stepIndex = this.stepIndex + 1
  } = {}) {
    if (Math.hypot(
      Number(impulseWorldNs.x || 0),
      Number(impulseWorldNs.y || 0),
      Number(impulseWorldNs.z || 0)
    ) <= EPSILON) return false;
    const collision = {
      impulseWorldNs: clone(impulseWorldNs),
      pointWorld: clone(pointWorld || this.state.position),
      source
    };
    this.pendingCollisionImpulses.push(collision);
    if (record) this.collisionTimeline.push({ stepIndex, ...clone(collision) });
    return true;
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
    const integrationScratch = this.integrationResultScratch[
      this.integrationResultScratchCursor++ % this.integrationResultScratch.length
    ];
    const totalLinearImpulse = integrationScratch.totalLinearImpulse;
    totalLinearImpulse.x = (
      Number(tires.tireImpulseWorldNs?.x || 0)
      + Number(tires.suspensionImpulseWorldNs?.x || 0)
      + Number(tires.externalImpulseWorldNs?.x || 0)
    ) + Number(tires.bodyCollision?.linearImpulseWorldNs?.x || 0);
    totalLinearImpulse.y = (
      Number(tires.tireImpulseWorldNs?.y || 0)
      + Number(tires.suspensionImpulseWorldNs?.y || 0)
      + (-config.massKg * 9.81 * dt + Number(tires.externalImpulseWorldNs?.y || 0))
    ) + Number(tires.bodyCollision?.linearImpulseWorldNs?.y || 0);
    totalLinearImpulse.z = (
      Number(tires.tireImpulseWorldNs?.z || 0)
      + Number(tires.suspensionImpulseWorldNs?.z || 0)
      + Number(tires.externalImpulseWorldNs?.z || 0)
    ) + Number(tires.bodyCollision?.linearImpulseWorldNs?.z || 0);
    if (tires.targetVelocityWorld) {
      totalLinearImpulse.x = (
        Number(tires.targetVelocityWorld.x || 0) - Number(state.velocity.x || 0)
      ) * config.massKg;
      totalLinearImpulse.z = (
        Number(tires.targetVelocityWorld.z || 0) - Number(state.velocity.z || 0)
      ) * config.massKg;
    }
    const totalAngularImpulse = integrationScratch.totalAngularImpulse;
    totalAngularImpulse.x = (
      Number(tires.tireAngularImpulseWorldNms?.x || 0)
      + Number(tires.externalAngularImpulseWorldNms?.x || 0)
    ) + Number(tires.bodyCollision?.angularImpulseWorldNms?.x || 0);
    totalAngularImpulse.y = (
      Number(tires.tireAngularImpulseWorldNms?.y || 0)
      + Number(tires.externalAngularImpulseWorldNms?.y || 0)
    ) + Number(tires.bodyCollision?.angularImpulseWorldNms?.y || 0);
    totalAngularImpulse.z = (
      Number(tires.tireAngularImpulseWorldNms?.z || 0)
      + Number(tires.externalAngularImpulseWorldNms?.z || 0)
    ) + Number(tires.bodyCollision?.angularImpulseWorldNms?.z || 0);
    const postSubstepAngularImpulse = integrationScratch.postSubstepAngularImpulse;
    resetMutableVector3(postSubstepAngularImpulse);
    let supportedLoadN = 0;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      supportedLoadN += Math.max(
        0,
        Number(tires.wheelLoadsN?.[RACE_WHEEL_IDS[wheelIndex]] || 0)
      );
    }
    const supportScale = clamp(supportedLoadN / Math.max(1, config.massKg * 9.81), 0, 1);
    const angularVelocityBody = rotateVectorToBody(
      state.angularVelocityWorld, state.orientation
    );
    const supportImpulseWorld = rotateVectorByQuaternion({
      x: (
        -Number(state.pitchRad || 0) * config.pitchStiffnessNmPerRad
        - Number(angularVelocityBody.x || 0) * config.pitchDampingNmsPerRad
      ) * supportScale * dt,
      y: 0,
      z: (
        -Number(state.rollRad || 0) * config.rollStiffnessNmPerRad
        - Number(angularVelocityBody.z || 0) * config.rollDampingNmsPerRad
      ) * supportScale * dt
    }, state.orientation);
    totalAngularImpulse.x += supportImpulseWorld.x;
    totalAngularImpulse.y += supportImpulseWorld.y;
    totalAngularImpulse.z += supportImpulseWorld.z;
    postSubstepAngularImpulse.x += supportImpulseWorld.x;
    postSubstepAngularImpulse.y += supportImpulseWorld.y;
    postSubstepAngularImpulse.z += supportImpulseWorld.z;
    const assistInterventions = this.handlingAssist.calculatePhysicalInterventions({
      preset: config.handlingPreset, state, controls, config, supportScale
    });
    for (let assistIndex = 0; assistIndex < assistInterventions.length; assistIndex += 1) {
      const moment = assistInterventions[assistIndex].momentWorldNm || {};
      const impulseX = Number(moment.x || 0) * dt;
      const impulseY = Number(moment.y || 0) * dt;
      const impulseZ = Number(moment.z || 0) * dt;
      totalAngularImpulse.x += impulseX;
      totalAngularImpulse.y += impulseY;
      totalAngularImpulse.z += impulseZ;
      postSubstepAngularImpulse.x += impulseX;
      postSubstepAngularImpulse.y += impulseY;
      postSubstepAngularImpulse.z += impulseZ;
    }
    const canSleep = evaluatePhysicalSleepCondition({
      state, config, tires, totalLinearImpulse, totalAngularImpulse, dt,
      pendingCollisionCount: this.pendingCollisionImpulses.length
    });
    const collisionImpulses = this.pendingCollisionImpulses.length
      ? this.pendingCollisionImpulses.splice(0)
      : integrationScratch.emptyCollisionImpulses;
    for (let collisionIndex = 0; collisionIndex < collisionImpulses.length; collisionIndex += 1) {
      const collision = collisionImpulses[collisionIndex];
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
      totalAngularImpulse.x += collisionAngularImpulse.x;
      totalAngularImpulse.y += collisionAngularImpulse.y;
      totalAngularImpulse.z += collisionAngularImpulse.z;
      postSubstepAngularImpulse.x += collisionAngularImpulse.x;
      postSubstepAngularImpulse.y += collisionAngularImpulse.y;
      postSubstepAngularImpulse.z += collisionAngularImpulse.z;
    }
    const acceleration = integrationScratch.acceleration;
    const inverseMassDt = 1 / (config.massKg * dt);
    acceleration.x = totalLinearImpulse.x * inverseMassDt;
    acceleration.y = totalLinearImpulse.y * inverseMassDt;
    acceleration.z = totalLinearImpulse.z * inverseMassDt;
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
    }, this.bodyAngularMotionScratch);
    state.angularVelocityWorld = angularMotion.angularVelocityWorld;
    state.orientation = angularMotion.orientation;
    state.angularVelocityWorld.x = Math.abs(Number(state.angularVelocityWorld.x || 0)) < 1e-12
      ? 0 : state.angularVelocityWorld.x;
    state.angularVelocityWorld.y = Math.abs(Number(state.angularVelocityWorld.y || 0)) < 1e-12
      ? 0 : state.angularVelocityWorld.y;
    state.angularVelocityWorld.z = Math.abs(Number(state.angularVelocityWorld.z || 0)) < 1e-12
      ? 0 : state.angularVelocityWorld.z;
    if (canSleep) {
      resetMutableVector3(state.velocity);
      resetMutableVector3(state.angularVelocityWorld);
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const suspension = tires.suspensionState?.[RACE_WHEEL_IDS[wheelIndex]];
        if (!suspension) continue;
        suspension.unsprungVelocityMps = 0;
        suspension.compressionVelocityMps = 0;
        suspension.damperVelocityMps = 0;
      }
    }
    if (tires.targetVelocityWorld) {
      state.velocity.x = Number(tires.targetVelocityWorld.x || 0);
      state.velocity.z = Number(tires.targetVelocityWorld.z || 0);
    }
    const euler = eulerFromQuaternion(state.orientation, this.eulerScratch);
    state.yawRad = quantize(normalizeAngle(euler.yaw));
    state.pitchRad = quantize(euler.pitch);
    state.rollRad = quantize(euler.roll);
    state.yawRateRadps = quantize(state.angularVelocityWorld.y);
    const forwardX = Math.sin(state.yawRad);
    const forwardZ = Math.cos(state.yawRad);
    const rightX = forwardZ;
    const rightZ = -forwardX;
    const bodyLongitudinalSpeedMps = state.velocity.x * forwardX
      + state.velocity.z * forwardZ;
    const bodyLateralSpeedMps = state.velocity.x * rightX + state.velocity.z * rightZ;
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
    state.position.x = quantize(state.position.x);
    state.position.y = quantize(state.position.y);
    state.position.z = quantize(state.position.z);
    state.velocity.x = quantize(state.velocity.x);
    state.velocity.y = quantize(state.velocity.y);
    state.velocity.z = quantize(state.velocity.z);
    state.angularVelocityWorld.x = quantize(state.angularVelocityWorld.x);
    state.angularVelocityWorld.y = quantize(state.angularVelocityWorld.y);
    state.angularVelocityWorld.z = quantize(state.angularVelocityWorld.z);
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
    const validTreadContactByWheel = state.validTreadContactByWheel || {};
    const invalidContactReasonByWheel = state.invalidContactReasonByWheel || {};
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      validTreadContactByWheel[wheelId] = tires.validTreadContactByWheel?.[wheelId];
      invalidContactReasonByWheel[wheelId] = tires.invalidContactReasonByWheel?.[wheelId];
    }
    state.validTreadContactByWheel = validTreadContactByWheel;
    state.invalidContactReasonByWheel = invalidContactReasonByWheel;
    state.wheelLoadsN = tires.wheelLoadsN;
    state.wheelSlip = tires.wheelSlip;
    state.suspensionTravel = tires.suspensionTravel;
    state.tireForcesN = tires.tireForcesN;
    state.wheelAngularVelocityRadps = tires.wheelAngularVelocityRadps;
    state.steeringTelemetry = tires.steeringTelemetry || {};
    state.aeroState = tires.aeroState || {};
    const powertrainState = state.powertrainState || {};
    if (powertrainState !== authoritativePowertrain) {
      Object.assign(powertrainState, authoritativePowertrain);
    }
    powertrainState.engineRpm = state.engineRpm;
    powertrainState.gear = state.gear;
    powertrainState.telemetry = tires.powertrainTelemetry || {};
    state.powertrainState = powertrainState;
    state.suspensionState = tires.suspensionState;
    const tireStateByWheel = state.tireState || {};
    const contactPatchesByWheel = state.contactPatches || {};
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const patch = tires.contactPatches?.[wheelId] || {};
      const previous = tireStateByWheel[wheelId] || {};
      const thermal = advanceTireThermalState({
        previous,
        tire: patch.tireParameters || config.tireByWheel?.[wheelId] || {},
        patch,
        material: patch.material || {},
        ambientTemperatureC: Number(patch.ambientTemperatureC ?? 21),
        dt,
        target: this.tireThermalScratch[wheelId]
      });
      const slipWorkJ = Number(thermal.frictionHeatingWorkJ || 0) / 0.78;
      const wear = quantize(clamp(Number(previous.wear || 0) + slipWorkJ * 1e-9, 0, 1));
      const damage = quantize(clamp(
        Number(patch.tireParameters?.damage ?? previous.damage ?? 0),
        0,
        100
      ));
      Object.assign(previous, patch, thermal);
      previous.wear = wear;
      previous.damage = damage;
      tireStateByWheel[wheelId] = previous;
      const statePatch = contactPatchesByWheel[wheelId] || {};
      Object.assign(statePatch, patch);
      statePatch.frictionHeatingWorkJ = previous.frictionHeatingWorkJ;
      statePatch.carcassFlexHeatingWorkJ = previous.carcassFlexHeatingWorkJ;
      statePatch.loadHeatingWorkJ = previous.loadHeatingWorkJ;
      statePatch.treadTemperatureC = previous.treadTemperatureC;
      statePatch.carcassTemperatureC = previous.carcassTemperatureC;
      statePatch.internalAirTemperatureC = previous.internalAirTemperatureC;
      statePatch.effectivePressurePsi = previous.effectivePressurePsi;
      statePatch.temperatureF = previous.temperatureF;
      contactPatchesByWheel[wheelId] = statePatch;
    }
    state.tireState = tireStateByWheel;
    state.contactPatches = contactPatchesByWheel;
    const integration = integrationScratch.result;
    const inverseDt = 1 / dt;
    integration.totalForceWorldN.x = totalLinearImpulse.x * inverseDt;
    integration.totalForceWorldN.y = totalLinearImpulse.y * inverseDt;
    integration.totalForceWorldN.z = totalLinearImpulse.z * inverseDt;
    integration.totalMomentWorldNm.x = totalAngularImpulse.x * inverseDt;
    integration.totalMomentWorldNm.y = totalAngularImpulse.y * inverseDt;
    integration.totalMomentWorldNm.z = totalAngularImpulse.z * inverseDt;
    integration.linearImpulseWorldNs = totalLinearImpulse;
    integration.angularImpulseWorldNms = totalAngularImpulse;
    copyMutableVector3(integration.tireImpulseWorldNs, tires.tireImpulseWorldNs);
    copyMutableVector3(integration.suspensionImpulseWorldNs, tires.suspensionImpulseWorldNs);
    copyMutableVector3(
      integration.aerodynamicAndExternalImpulseWorldNs,
      tires.externalImpulseWorldNs
    );
    copyMutableVector3(
      integration.bodyCollisionImpulseWorldNs,
      tires.bodyCollision?.linearImpulseWorldNs
    );
    copyMutableVector3(
      integration.bodyCollisionAngularImpulseWorldNms,
      tires.bodyCollision?.angularImpulseWorldNms
    );
    integration.bodyCollision = tires.bodyCollision || {};
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      copyMutableVector3(
        integration.wheelAngularMomentumReactionImpulseWorldNms[wheelId],
        tires.wheelAngularMomentumReactionImpulseWorldNms?.[wheelId]
      );
    }
    const bodyContacts = tires.bodyCollision?.contacts || integrationScratch.emptyBodyContacts;
    integration.bodyContacts = bodyContacts.length
      ? bodyContacts
      : integrationScratch.emptyBodyContacts;
    resetMutableVector3(integration.collisionImpulseWorldNs);
    for (let collisionIndex = 0; collisionIndex < collisionImpulses.length; collisionIndex += 1) {
      accumulateScaledVector3(
        integration.collisionImpulseWorldNs,
        collisionImpulses[collisionIndex].impulseWorldNs,
        1
      );
    }
    integration.supportScale = quantize(supportScale);
    integration.groundConstraintImpulseNs = quantize(groundConstraintImpulseNs);
    integration.assistInterventions = assistInterventions;
    const rollover = integration.rollover;
    const rollAxisWorld = rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, state.orientation);
    const projectRoll = (moment = {}) => Number(moment.x || 0) * rollAxisWorld.x
      + Number(moment.y || 0) * rollAxisWorld.y + Number(moment.z || 0) * rollAxisWorld.z;
    for (const sourceName in rollover.sources) {
      const source = rollover.sources[sourceName];
      source.rollMomentNm = 0;
      source.rollAngularImpulseNms = 0;
    }
    rollover.effectiveSupportPolygon.length = 0;
    rollover.contactFeatures.length = 0;
    let leftLoadN = 0;
    let rightLoadN = 0;
    let totalTireLateralRollMomentNm = 0;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const patch = tires.contactPatches?.[wheelId] || {};
      const point = patch.contactPointWorld;
      const radius = point ? {
        x: Number(point.x || 0) - Number(state.position.x || 0),
        y: Number(point.y || 0) - Number(state.position.y || 0),
        z: Number(point.z || 0) - Number(state.position.z || 0)
      } : null;
      const momentFromForce = (force) => radius ? {
        x: radius.y * force.z - radius.z * force.y,
        y: radius.z * force.x - radius.x * force.z,
        z: radius.x * force.y - radius.y * force.x
      } : { x: 0, y: 0, z: 0 };
      const lateralAxis = patch.wheelLateralWorld || {};
      const lateralN = Number(patch.localForceN?.lateral ?? patch.lateralForceN ?? 0);
      const lateralMoment = projectRoll(momentFromForce({
        x: Number(lateralAxis.x || 0) * lateralN,
        y: Number(lateralAxis.y || 0) * lateralN,
        z: Number(lateralAxis.z || 0) * lateralN
      }));
      totalTireLateralRollMomentNm += lateralMoment;
      const sideSource = wheelId.endsWith('l')
        ? rollover.sources.leftTireLateral : rollover.sources.rightTireLateral;
      sideSource.rollMomentNm += lateralMoment;
      sideSource.rollAngularImpulseNms += lateralMoment * dt;
      const normal = patch.surfaceNormalWorld || { x: 0, y: 1, z: 0 };
      const addNormalSource = (source, forceN) => {
        const moment = projectRoll(momentFromForce({
          x: Number(normal.x || 0) * forceN,
          y: Number(normal.y || 0) * forceN,
          z: Number(normal.z || 0) * forceN
        }));
        source.rollMomentNm += moment;
        source.rollAngularImpulseNms += moment * dt;
      };
      const bumpN = Number(patch.bumpStopForceN || 0);
      const hardN = Number(patch.hardStopForceN || 0);
      const antiRollN = Number(patch.antiRollLoadTransferN || 0);
      addNormalSource(rollover.sources.bumpStops, bumpN);
      addNormalSource(rollover.sources.hardStops, hardN);
      addNormalSource(rollover.sources.antiRollLoadTransfer, antiRollN);
      addNormalSource(rollover.sources.suspensionNormal, Math.max(0,
        Number(patch.suspensionNormalLoadN || 0) - bumpN - hardN - antiRollN
      ));
      const load = Math.max(0, Number(tires.wheelLoadsN?.[wheelId] || 0));
      if (wheelId.endsWith('l')) leftLoadN += load;
      else rightLoadN += load;
      if (load > 1 && point) rollover.effectiveSupportPolygon.push(point);
      if (patch.terrainTriangleId !== null && patch.terrainTriangleId !== undefined) {
        rollover.contactFeatures.push({
          wheelId, triangleId: patch.terrainTriangleId,
          featureId: patch.contactFeatureId || patch.contactType || null
        });
      }
    }
    let bodyRollImpulse = 0;
    const aeroRollImpulse = projectRoll(tires.externalAngularImpulseWorldNms);
    rollover.sources.aerodynamicForce.rollAngularImpulseNms = aeroRollImpulse;
    rollover.sources.aerodynamicForce.rollMomentNm = aeroRollImpulse * inverseDt;
    let assistRollImpulse = 0;
    for (let assistIndex = 0; assistIndex < assistInterventions.length; assistIndex += 1) {
      assistRollImpulse += projectRoll(assistInterventions[assistIndex].momentWorldNm) * dt;
    }
    rollover.sources.handlingAssist.rollAngularImpulseNms = assistRollImpulse;
    rollover.sources.handlingAssist.rollMomentNm = assistRollImpulse * inverseDt;
    const bodyContactsForRoll = tires.bodyCollision?.contacts || [];
    for (let index = 0; index < bodyContactsForRoll.length; index += 1) {
      const contact = bodyContactsForRoll[index];
      const type = String(contact.contactType || contact.id || '');
      const normalImpulse = Number(contact.normalImpulseNs || 0);
      const impulse = {
        x: Number(contact.normal?.x || 0) * normalImpulse
          + Number(contact.tangentialImpulseWorldNs?.x || 0),
        y: Number(contact.normal?.y || 0) * normalImpulse
          + Number(contact.tangentialImpulseWorldNs?.y || 0),
        z: Number(contact.normal?.z || 0) * normalImpulse
          + Number(contact.tangentialImpulseWorldNs?.z || 0)
      };
      const arm = contact.arm || {};
      const contactRollImpulse = projectRoll({
        x: Number(arm.y || 0) * impulse.z - Number(arm.z || 0) * impulse.y,
        y: Number(arm.z || 0) * impulse.x - Number(arm.x || 0) * impulse.z,
        z: Number(arm.x || 0) * impulse.y - Number(arm.y || 0) * impulse.x
      });
      const source = type.includes('sidewall')
        ? rollover.sources.wheelSidewallCollision
        : type.includes('leading') || type.includes('wheel-')
          ? rollover.sources.wheelLeadingTreadCollision : null;
      if (source) {
        source.rollAngularImpulseNms += contactRollImpulse;
        source.rollMomentNm += contactRollImpulse * inverseDt;
      } else bodyRollImpulse += contactRollImpulse;
    }
    rollover.sources.bodyCollision.rollAngularImpulseNms = bodyRollImpulse;
    rollover.sources.bodyCollision.rollMomentNm = bodyRollImpulse * inverseDt;
    for (let index = 0; index < collisionImpulses.length; index += 1) {
      const collision = collisionImpulses[index];
      const impulse = collision.impulseWorldNs || {};
      const point = collision.pointWorld || state.position;
      const armX = Number(point.x || 0) - Number(state.position.x || 0);
      const armY = Number(point.y || 0) - Number(state.position.y || 0);
      const armZ = Number(point.z || 0) - Number(state.position.z || 0);
      const collisionRollImpulse = projectRoll({
        x: armY * Number(impulse.z || 0) - armZ * Number(impulse.y || 0),
        y: armZ * Number(impulse.x || 0) - armX * Number(impulse.z || 0),
        z: armX * Number(impulse.y || 0) - armY * Number(impulse.x || 0)
      });
      const collisionSource = String(collision.source || '');
      const source = collisionSource.includes('sidewall')
        ? rollover.sources.wheelSidewallCollision
        : collisionSource.includes('leading-tread')
          ? rollover.sources.wheelLeadingTreadCollision
          : rollover.sources.bodyCollision;
      source.rollAngularImpulseNms += collisionRollImpulse;
      source.rollMomentNm += collisionRollImpulse * inverseDt;
    }
    rollover.cgHeightM = config.cgHeightM;
    rollover.supportedWheelCount = Number(tires.supportedWheelCount || 0);
    const turningLeft = Number(state.lateralAccelerationMps2 || 0) > 0;
    rollover.insideWheelLoadN = turningLeft ? leftLoadN : rightLoadN;
    rollover.outsideWheelLoadN = turningLeft ? rightLoadN : leftLoadN;
    rollover.lateralAccelerationMps2 = Number(state.lateralAccelerationMps2 || 0);
    rollover.rollAngleRad = Number(state.rollRad || 0);
    rollover.rollVelocityRadps = Number(angularVelocityBody.z || 0);
    rollover.classification = Math.abs(rollover.rollAngleRad) < Math.PI / 4 ? null
      : Math.abs(rollover.sources.wheelSidewallCollision.rollAngularImpulseNms) > 0.01
        ? 'sidewall trip'
        : Math.abs(rollover.sources.wheelLeadingTreadCollision.rollAngularImpulseNms) > 0.01
          ? 'curb/step trip rollover'
          : Math.abs(rollover.sources.bodyCollision.rollAngularImpulseNms) > 0.01
            ? 'body-collider trip'
            : rollover.supportedWheelCount === 0
              ? 'landing rollover'
              : Math.abs(totalTireLateralRollMomentNm) > 0
                ? 'geometric traction rollover'
                : 'numerical/contact instability';
    integration.sleeping = canSleep;
    integration.collisionImpulses = collisionImpulses;
    return integration;
  }

  recordTakeoffSubstep({ timeSeconds, tireResult, bodyResult, state, environment, dt }) {
    const tracking = this.takeoffContactState;
    const currentEuler = eulerFromQuaternion(state.orientation, this.eulerScratch);
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
    const frontSample = this.takeoffFrontSuspensionSamplePool.pop() || {};
    frontSample.timeSeconds = timeSeconds;
    frontSample.impulseNs = quantize(axleImpulse(['fl', 'fr']));
    tracking.recentFrontSuspensionImpulse.push(frontSample);
    const rearSample = this.takeoffRearSuspensionSamplePool.pop() || {};
    rearSample.timeSeconds = timeSeconds;
    rearSample.impulseNs = quantize(axleImpulse(['rl', 'rr']));
    tracking.recentRearSuspensionImpulse.push(rearSample);
    pruneTimedSamples(
      tracking.recentFrontSuspensionImpulse,
      cutoffTimeSeconds,
      this.takeoffFrontSuspensionSamplePool
    );
    pruneTimedSamples(
      tracking.recentRearSuspensionImpulse,
      cutoffTimeSeconds,
      this.takeoffRearSuspensionSamplePool
    );
    const bodyContacts = bodyResult.contacts || [];
    for (let contactIndex = 0; contactIndex < bodyContacts.length; contactIndex += 1) {
      const contact = bodyContacts[contactIndex];
      if (!/underbody|underside|rocker/.test(String(contact.id || ''))) continue;
      const sample = this.takeoffUnderbodyContactPool.pop() || {};
      sample.timeSeconds = quantize(timeSeconds, 12);
      sample.id = contact.id;
      sample.penetrationM = quantize(contact.penetrationM || 0);
      tracking.recentUnderbodyContacts.push(sample);
    }
    pruneTimedSamples(
      tracking.recentUnderbodyContacts,
      timeSeconds - 0.1,
      this.takeoffUnderbodyContactPool
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
      const flightSample = this.takeoffFlightSamplePool.pop() || {};
      flightSample.timeSeconds = quantize(timeSeconds, 12);
      flightSample.pitchAngleRad = quantize(currentEuler.pitch || 0);
      flightSample.pitchAngularVelocityRadps = quantize(
        state.angularVelocityWorld?.x || 0
      );
      tracking.activeTakeoff.flightPitchSamples.push(flightSample);
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

  recordContactStabilization(outcome, {
    stepIndex,
    substepIndex,
    penetrationM = 0,
    rollbackFraction = null,
    routeDistanceBefore = null,
    routeDistanceAfter = null,
    normal = null,
    removedInwardSpeedMps = 0,
    recovery = null,
    reason = null
  } = {}) {
    const gameplayReset = outcome === 'catastrophic-historical-recovery'
      || outcome === 'catastrophic-route-recovery';
    const event = {
      sequence: ++this.contactStabilizationState.sequence,
      stepIndex,
      substepIndex,
      outcome,
      tier: outcome === 'ordinary-correction' ? 1
        : outcome === 'local-ccd-rollback' ? 2 : 3,
      gameplayReset,
      reason,
      penetrationM: quantize(Math.max(0, Number(penetrationM || 0))),
      rollbackFraction: rollbackFraction === null ? null : quantize(rollbackFraction, 12),
      routeDistanceBefore: finiteNumber(routeDistanceBefore),
      routeDistanceAfter: finiteNumber(routeDistanceAfter),
      normal: normal ? normalizeRecoveryNormal(normal) : null,
      removedInwardSpeedMps: quantize(removedInwardSpeedMps),
      recoverySequence: recovery?.sequence ?? null,
      recoveryMode: recovery?.recoveryMode ?? null
    };
    if (outcome === 'ordinary-correction') {
      this.contactStabilizationState.ordinaryCorrectionCount += 1;
    } else if (outcome === 'local-ccd-rollback') {
      this.contactStabilizationState.localCcdRollbackCount += 1;
    } else if (outcome === 'catastrophic-historical-recovery') {
      this.contactStabilizationState.catastrophicHistoricalRecoveryCount += 1;
    } else if (outcome === 'catastrophic-route-recovery') {
      this.contactStabilizationState.catastrophicRouteRecoveryCount += 1;
    }
    if (gameplayReset) this.contactStabilizationState.gameplayResetCount += 1;
    this.contactStabilizationState.latest = event;
    this.contactStabilizationState.history.push(event);
    if (this.contactStabilizationState.history.length > 256) {
      this.contactStabilizationState.history.shift();
    }
    return event;
  }

  createLocalCollisionFrame(state, tireResult, {
    stepIndex,
    substepIndex,
    routeDistanceM = null,
    supportNormal = null
  } = {}) {
    const frame = this.localCollisionFrameScratch[
      this.localCollisionFrameScratchCursor++ % this.localCollisionFrameScratch.length
    ];
    const position = state.position || {};
    frame.position.x = Number(position.x || 0);
    frame.position.y = Number(position.y || 0);
    frame.position.z = Number(position.z || 0);
    const orientation = state.orientation || {};
    frame.orientation.x = Number(orientation.x || 0);
    frame.orientation.y = Number(orientation.y || 0);
    frame.orientation.z = Number(orientation.z || 0);
    frame.orientation.w = Number(orientation.w ?? 1);
    const velocity = state.velocity || {};
    frame.velocity.x = Number(velocity.x || 0);
    frame.velocity.y = Number(velocity.y || 0);
    frame.velocity.z = Number(velocity.z || 0);
    const angularVelocity = state.angularVelocityWorld || {};
    frame.angularVelocityWorld.x = Number(angularVelocity.x || 0);
    frame.angularVelocityWorld.y = Number(angularVelocity.y || 0);
    frame.angularVelocityWorld.z = Number(angularVelocity.z || 0);
    const normal = normalizeRecoveryNormal(supportNormal || { x: 0, y: 1, z: 0 });
    frame.supportNormal.x = normal.x;
    frame.supportNormal.y = normal.y;
    frame.supportNormal.z = normal.z;
    frame.stepIndex = stepIndex;
    frame.substepIndex = substepIndex;
    // ContactPatchTireModel already owns these maps in an eight-entry step
    // scratch ring. Referencing the immutable completed result keeps this local
    // rollback frame exact and avoids serializing the full graph at 120/360 Hz.
    frame.suspensionState = tireResult.suspensionState || state.suspensionState || {};
    frame.tireState = tireResult.tireState || state.tireState || {};
    frame.wheelAngularVelocityRadps = tireResult.wheelAngularVelocityRadps
      || state.wheelAngularVelocityRadps || {};
    frame.wheelLoadsN = tireResult.wheelLoadsN || state.wheelLoadsN || {};
    frame.wheelSlip = tireResult.wheelSlip || state.wheelSlip || {};
    frame.contactPatches = tireResult.contactPatches || state.contactPatches || {};
    frame.powertrainState = tireResult.powertrainState || state.powertrainState || {};
    frame.routeDistance = finiteNumber(routeDistanceM ?? state.routeDistance);
    return frame;
  }

  restoreLocalCollisionFrame(substepState, frame, blockingNormal, stepIndex) {
    if (!frame || !isFiniteVehiclePose(frame)
      || stepIndex - Number(frame.stepIndex || 0)
        > this.config.localCcdRollbackMaximumAgeSteps) return null;
    const routeDistance = finiteNumber(substepState.routeDistance);
    const velocityResult = removeVelocityIntoNormal(
      substepState.velocity,
      blockingNormal || frame.supportNormal
    );
    substepState.position = clone(frame.position);
    substepState.orientation = clone(frame.orientation);
    substepState.velocity = velocityResult.velocity;
    substepState.angularVelocityWorld = clone(frame.angularVelocityWorld);
    substepState.suspensionState = clone(frame.suspensionState);
    substepState.tireState = clone(frame.tireState);
    substepState.wheelAngularVelocityRadps = clone(frame.wheelAngularVelocityRadps);
    substepState.wheelLoadsN = clone(frame.wheelLoadsN);
    substepState.wheelSlip = clone(frame.wheelSlip);
    substepState.contactPatches = clone(frame.contactPatches);
    substepState.powertrainState = clone(frame.powertrainState);
    if (routeDistance !== null) substepState.routeDistance = routeDistance;
    this.updateDerivedMotionState(substepState);
    return velocityResult;
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
      position: { ...state.position },
      orientation: { ...state.orientation },
      velocity: { ...state.velocity },
      angularVelocityWorld: { ...state.angularVelocityWorld },
      suspensionState: copyRecoverySuspensionState(
        tireResult.suspensionState || state.suspensionState || {}
      ),
      wheelState: {
        wheelAngularVelocityRadps: copyRecoveryWheelScalars(
          tireResult.wheelAngularVelocityRadps || state.wheelAngularVelocityRadps || {}
        ),
        wheelLoadsN: copyRecoveryWheelScalars(
          tireResult.wheelLoadsN || state.wheelLoadsN || {}
        ),
        wheelSlip: copyRecoveryWheelScalars(
          tireResult.wheelSlip || state.wheelSlip || {}
        ),
        contactPatches: copyRecoveryContactPatches(
          tireResult.contactPatches || state.contactPatches || {}
        )
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
    const captureIntervalSteps = Math.max(1, Math.round(this.config.chassisHz / 30));
    if (this.lastNonPenetratingState
      && simulationStep % captureIntervalSteps !== 0) return this.lastNonPenetratingState;
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
    if (this.config.surfaceConsistencySamplingEnabled !== true) {
      let pointCount = 2;
      const contacts = bodyResult?.contacts || [];
      for (let candidateIndex = 0;
        candidateIndex < this.bodyCollision.candidates.length;
        candidateIndex += 1) {
        const candidateId = this.bodyCollision.candidates[candidateIndex].id;
        for (let contactIndex = 0; contactIndex < contacts.length; contactIndex += 1) {
          if (contacts[contactIndex].id === candidateId) {
            pointCount += 2;
            break;
          }
        }
      }
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const wheelId = RACE_WHEEL_IDS[wheelIndex];
        if (previousState.contactPatches?.[wheelId]?.contactPointWorld) pointCount += 1;
        if (tireResult.contactPatches?.[wheelId]?.contactPointWorld) pointCount += 1;
      }
      const sampleCount = Math.min(this.config.surfaceConsistencySamplesPerCheck, pointCount);
      this.surfaceConsistencyCursor = pointCount
        ? (this.surfaceConsistencyCursor + sampleCount) % pointCount
        : 0;
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
    const euler = eulerFromQuaternion(state.orientation, this.eulerScratch);
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
      const suspension = tireResult.suspensionState?.[wheelId] || {};
      const suspensionTravelM = wheelId[0] === 'f'
        ? this.config.suspensionTravelFrontM : this.config.suspensionTravelRearM;
      const remainingBumpTravelM = Number(suspension.remainingBumpTravelM
        ?? (suspensionTravelM - Number(suspension.compressionM || 0)));
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
        invalidTreadContactReason: patch.invalidContactReason || null,
        bottomedOut: suspension.bottomedOut === true,
        remainingBumpTravelM,
        nearFullBump: suspension.bottomedOut === true || remainingBumpTravelM <= 0.005,
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

  runStep(legacySnapshot = null, {
    deferCostStepFinish = false,
    backlogSteps = 0
  } = {}) {
    const nextStepIndex = this.stepIndex + 1;
    const scheduledReset = this.scheduledReplayResets.get(nextStepIndex);
    if (scheduledReset) {
      this.resetAuthoritativeState(scheduledReset.state, {
        reason: scheduledReset.reason,
        record: false,
        rebuildContacts: true,
        parkUntilDrive: scheduledReset.parkUntilDrive === true
      });
    }
    const chassisStepStartedNonFinite = !isFiniteVehiclePose(this.state);
    const elapsedOnlyCostStep = this.physicsCostAccounting.stepHistoryMode === 'elapsed-ring';
    const beginCostMetadata = elapsedOnlyCostStep
      ? this.physicsStepBeginMetadataScratch
      : {
          stepIndex: nextStepIndex,
          tireHz: this.config.tireHz,
          chassisHz: this.config.chassisHz
        };
    beginCostMetadata.stepIndex = nextStepIndex;
    const ownsCostStep = this.physicsCostAccounting.beginStep(beginCostMetadata);
    this.physicsCostAccounting.count('backlogSteps', Math.max(0, Number(backlogSteps) || 0));
    const chassisStepPreImpactKineticEnergyJ = calculateKineticEnergyJ(this.state, this.config);
    const preImpactVerticalVelocityMps = Number(this.state.velocity?.y || 0);
    const scheduledReplayCollisions = this.scheduledReplayCollisions.get(nextStepIndex);
    for (let collisionIndex = 0;
      collisionIndex < (scheduledReplayCollisions?.length || 0);
      collisionIndex += 1) {
      const collision = scheduledReplayCollisions[collisionIndex];
      if (collision.contact) {
        this.queueCollisionContact(collision, { record: false, stepIndex: nextStepIndex });
      } else {
        this.queueCollisionImpulse(collision, { record: false, stepIndex: nextStepIndex });
      }
    }
    const stepTimeSeconds = nextStepIndex / this.config.chassisHz;
    const sampledControls = this.inputTimeline.sampleAt(
      stepTimeSeconds,
      this.sampledControlsScratch
    );
    if (this.stationaryResetHold
      && Number(sampledControls.throttle || 0) > STATIONARY_RESET_WAKE_THROTTLE) {
      this.stationaryResetHold = null;
    } else if (this.stationaryResetHold && this.pendingCollisionImpulses.length > 0) {
      this.stationaryResetHold = null;
    }
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
    const controls = sampledControls;
    controls.handbrake = authoritativeHandbrakeActive
      ? Math.max(1, Number(sampledControls.handbrake || 0)) : 0;
    handbrakeRemainingSeconds = directHandbrake
      ? handbrakeRemainingSeconds
      : Math.max(0, handbrakeRemainingSeconds - 1 / this.config.chassisHz);
    previousHandbrakeCommand.active = authoritativeHandbrakeActive;
    previousHandbrakeCommand.remainingSeconds = quantize(handbrakeRemainingSeconds, 12);
    previousHandbrakeCommand.consumedHoldSequence = Math.max(
      Math.trunc(Number(previousHandbrakeCommand.consumedHoldSequence || 0)), holdSequence
    );
    previousHandbrakeCommand.direct = directHandbrake;
    this.state.handbrakeCommandState = previousHandbrakeCommand;
    const tireResults = this.tireSubstepResultsScratch;
    const bodyCollisionResults = this.bodyCollisionResultsScratch;
    tireResults.length = 0;
    bodyCollisionResults.length = 0;
    const substepState = copyVehicleStateIntoSubstep(this.substepStateScratch, this.state);
    const tireSubstepDt = 1 / this.config.tireHz;
    const chassisStepDt = 1 / this.config.chassisHz;
    const initialNearBumpByWheel = this.initialNearBumpByWheelScratch;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const initialSuspension = substepState.suspensionState?.[wheelId] || {};
      initialNearBumpByWheel[wheelId] = initialSuspension.bottomedOut === true
        || Number(initialSuspension.remainingBumpTravelM ?? 1) < 0.012;
    }
    let refreshContactGeometry = false;
    for (let substepIndex = 0;
      substepIndex < this.config.tireSubstepsPerChassisStep;
      substepIndex += 1) {
      const substepScratch = this.tireSubstepIntegrationScratch[substepIndex];
      const substepStartState = copySubstepStartState(
        this.substepStartStateScratch[substepIndex],
        substepState
      );
      const substepTimeSeconds = (
        this.stepIndex * this.config.tireSubstepsPerChassisStep + substepIndex + 1
      ) / this.config.tireHz;
      const environmentTimer = this.physicsCostAccounting.start('environmentProvider');
      const reuseContactGeometry = substepIndex > 0 && !refreshContactGeometry;
      const environmentRequest = substepScratch.environmentRequest;
      environmentRequest.timeSeconds = substepTimeSeconds;
      environmentRequest.stepIndex = nextStepIndex;
      environmentRequest.substepIndex = substepIndex;
      environmentRequest.state = substepState;
      environmentRequest.previousState = substepStartState;
      environmentRequest.controls = controls;
      environmentRequest.tireSubstepDt = tireSubstepDt;
      environmentRequest.chassisStepDt = chassisStepDt;
      environmentRequest.reuseContactGeometry = reuseContactGeometry;
      environmentRequest.recoveryRecalculation = false;
      environmentRequest.physicsCostAccounting = this.physicsCostAccounting;
      let environment = this.environmentProvider(environmentRequest) || {};
      this.physicsCostAccounting.end(environmentTimer);
      if (reuseContactGeometry) {
        this.physicsCostAccounting.count('tireSubstepGeometryReuses');
      } else if (substepIndex > 0) {
        this.physicsCostAccounting.count('tireSubstepGeometryRefreshes');
      }
      refreshContactGeometry = false;
      environment.physicsCostAccounting ||= this.physicsCostAccounting;
      if (environment.physicsIncidentMetadata) {
        this.physicsIncidentRecorder.configureMetadata(environment.physicsIncidentMetadata);
      }
      this.performanceDiagnostics.environmentQueries += 1;
      this.physicsCostAccounting.count('environmentProviderCalls');
      if (Array.isArray(environment.wakeSources)) {
        const vehicleId = String(environment.vehicleId || 'vehicle');
        let hasExternalWakeSource = false;
        for (let sourceIndex = 0;
          sourceIndex < environment.wakeSources.length;
          sourceIndex += 1) {
          if (String(environment.wakeSources[sourceIndex]?.id) !== vehicleId) {
            hasExternalWakeSource = true;
            break;
          }
        }
        if (hasExternalWakeSource) {
          environment.wakeState = sampleWakeAtVehicle({
            vehicle: {
              id: vehicleId,
              position: substepState.position,
              yawRad: substepState.yawRad,
              speedMps: Math.abs(substepState.speedMps)
            },
            sources: environment.wakeSources,
            windWorldMps: environment.windWorldMps,
            stepIndex: nextStepIndex
          });
        } else {
          this.zeroWakeState.crosswindRisk = Number(clamp(
            Math.abs(Number(environment.windWorldMps?.x || 0)) / 30,
            0,
            1
          ).toFixed(6));
          environment.wakeState = this.zeroWakeState;
        }
      }
      const aeroRequest = substepScratch.aeroRequest;
      aeroRequest.state = substepState;
      aeroRequest.config = this.config;
      aeroRequest.environment = environment;
      const aeroState = this.aeroModel.calculateForces(aeroRequest);
      const tireStepRequest = substepScratch.tireStepRequest;
      tireStepRequest.state = substepState;
      tireStepRequest.controls = controls;
      tireStepRequest.config = this.config;
      tireStepRequest.environment = environment;
      tireStepRequest.dt = tireSubstepDt;
      tireStepRequest.stepIndex = nextStepIndex;
      tireStepRequest.substepIndex = substepIndex;
      tireStepRequest.timeSeconds = substepTimeSeconds;
      tireStepRequest.recoveryRecalculation = false;
      let tireResult = this.tireContactSubsystem.step(tireStepRequest);
      let tireTerrainPatchCount = 0;
      let tireTerrainValidityCount = 0;
      let invalidTireTerrainCount = 0;
      const tireTerrainPatches = tireResult.contactPatches || {};
      for (const wheelId in tireTerrainPatches) {
        const patch = tireTerrainPatches[wheelId];
        tireTerrainPatchCount += 1;
        if (typeof patch?.terrainSampleValid !== 'boolean') continue;
        tireTerrainValidityCount += 1;
        if (patch.terrainSampleValid === false) invalidTireTerrainCount += 1;
      }
      const tireSupportUnknown = environment.requireValidTerrainEnvelope === true
        && (tireTerrainPatchCount === 0 || (
          tireTerrainValidityCount === tireTerrainPatchCount
          && invalidTireTerrainCount === tireTerrainValidityCount
        ));
      if (tireSupportUnknown) {
        tireResult.worldForceN = { x: 0, y: 0, z: 0 };
        tireResult.suspensionForceWorldN = { x: 0, y: 0, z: 0 };
        tireResult.worldMomentNm = { x: 0, y: 0, z: 0 };
        tireResult.wheelLoadsN = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, 0]));
        tireResult.tireForcesN = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, {
          longitudinal: 0,
          lateral: 0
        }]));
        tireResult.supportedWheelCount = 0;
        tireResult.grounded = false;
        tireResult.wheelGrounded = false;
        tireResult.contactForceSuppressedForUnknownTerrain = true;
      }
      const externalForceWorldN = substepScratch.externalForceWorldN;
      externalForceWorldN.x = Number(environment.externalForceWorldN?.x || 0)
        + Number(aeroState.totalForceWorldN?.x || 0);
      externalForceWorldN.y = Number(environment.externalForceWorldN?.y || 0)
        + Number(aeroState.totalForceWorldN?.y || 0);
      externalForceWorldN.z = Number(environment.externalForceWorldN?.z || 0)
        + Number(aeroState.totalForceWorldN?.z || 0);
      tireResult.externalForceWorldN = externalForceWorldN;
      const externalMomentWorldNm = substepScratch.externalMomentWorldNm;
      externalMomentWorldNm.x = Number(environment.externalMomentWorldNm?.x || 0)
        + Number(aeroState.totalMomentWorldNm?.x || 0);
      externalMomentWorldNm.y = Number(environment.externalMomentWorldNm?.y || 0)
        + Number(aeroState.totalMomentWorldNm?.y || 0);
      externalMomentWorldNm.z = Number(environment.externalMomentWorldNm?.z || 0)
        + Number(aeroState.totalMomentWorldNm?.z || 0);
      tireResult.externalMomentWorldNm = externalMomentWorldNm;
      tireResult.aeroState = aeroState;
      tireResult.targetVelocityWorld = environment.targetVelocityWorld || null;
      tireResult.freeRevEngineRpm = environment.freeRevEngineRpm;
      const tireAndSuspensionLinearImpulse = substepScratch.tireAndSuspensionLinearImpulse;
      tireAndSuspensionLinearImpulse.x = (
        Number(tireResult.worldForceN?.x || 0)
        + Number(tireResult.suspensionForceWorldN?.x || 0)
      ) * tireSubstepDt;
      tireAndSuspensionLinearImpulse.y = (
        Number(tireResult.worldForceN?.y || 0)
        + Number(tireResult.suspensionForceWorldN?.y || 0)
      ) * tireSubstepDt;
      tireAndSuspensionLinearImpulse.z = (
        Number(tireResult.worldForceN?.z || 0)
        + Number(tireResult.suspensionForceWorldN?.z || 0)
      ) * tireSubstepDt;
      const aeroAndGravityLinearImpulse = substepScratch.aeroAndGravityLinearImpulse;
      aeroAndGravityLinearImpulse.x = Number(tireResult.externalForceWorldN?.x || 0)
        * tireSubstepDt;
      aeroAndGravityLinearImpulse.y = (
        Number(tireResult.externalForceWorldN?.y || 0) - this.config.massKg * 9.81
      ) * tireSubstepDt;
      aeroAndGravityLinearImpulse.z = Number(tireResult.externalForceWorldN?.z || 0)
        * tireSubstepDt;
      const tireAngularImpulse = substepScratch.tireAngularImpulse;
      tireAngularImpulse.x = Number(tireResult.worldMomentNm?.x || 0) * tireSubstepDt;
      tireAngularImpulse.y = Number(tireResult.worldMomentNm?.y || 0) * tireSubstepDt;
      tireAngularImpulse.z = Number(tireResult.worldMomentNm?.z || 0) * tireSubstepDt;
      const externalAngularImpulse = substepScratch.externalAngularImpulse;
      externalAngularImpulse.x = Number(tireResult.externalMomentWorldNm?.x || 0) * tireSubstepDt;
      externalAngularImpulse.y = Number(tireResult.externalMomentWorldNm?.y || 0) * tireSubstepDt;
      externalAngularImpulse.z = Number(tireResult.externalMomentWorldNm?.z || 0) * tireSubstepDt;
      const inverseMass = 1 / this.config.massKg;
      substepState.velocity.x = Number(substepState.velocity.x || 0)
        + tireAndSuspensionLinearImpulse.x * inverseMass;
      substepState.velocity.y = Number(substepState.velocity.y || 0)
        + tireAndSuspensionLinearImpulse.y * inverseMass;
      substepState.velocity.z = Number(substepState.velocity.z || 0)
        + tireAndSuspensionLinearImpulse.z * inverseMass;
      const angularMotionRequest = substepScratch.angularMotionRequest;
      angularMotionRequest.orientation = substepState.orientation;
      angularMotionRequest.angularVelocityWorld = substepState.angularVelocityWorld;
      angularMotionRequest.angularImpulseWorld = tireAngularImpulse;
      angularMotionRequest.inertiaTensorBody = this.config.inertiaTensorBodyKgM2;
      angularMotionRequest.dt = 0;
      let angularMotion = integrateBodyAngularMotion(
        angularMotionRequest,
        this.bodyAngularMotionScratch
      );
      substepState.angularVelocityWorld = angularMotion.angularVelocityWorld;
      substepState.velocity.x = Number(substepState.velocity.x || 0)
        + aeroAndGravityLinearImpulse.x * inverseMass;
      substepState.velocity.y = Number(substepState.velocity.y || 0)
        + aeroAndGravityLinearImpulse.y * inverseMass;
      substepState.velocity.z = Number(substepState.velocity.z || 0)
        + aeroAndGravityLinearImpulse.z * inverseMass;
      angularMotionRequest.orientation = substepState.orientation;
      angularMotionRequest.angularVelocityWorld = substepState.angularVelocityWorld;
      angularMotionRequest.angularImpulseWorld = externalAngularImpulse;
      angularMotion = integrateBodyAngularMotion(
        angularMotionRequest,
        this.bodyAngularMotionScratch
      );
      substepState.angularVelocityWorld = angularMotion.angularVelocityWorld;
      if (tireResult.targetVelocityWorld) {
        substepState.velocity.x = Number(tireResult.targetVelocityWorld.x || 0);
        substepState.velocity.z = Number(tireResult.targetVelocityWorld.z || 0);
      }
      angularMotionRequest.orientation = substepState.orientation;
      angularMotionRequest.angularVelocityWorld = substepState.angularVelocityWorld;
      angularMotionRequest.angularImpulseWorld = substepScratch.zeroAngularImpulse;
      angularMotionRequest.dt = tireSubstepDt;
      angularMotion = integrateBodyAngularMotion(
        angularMotionRequest,
        this.bodyAngularMotionScratch
      );
      substepState.angularVelocityWorld = angularMotion.angularVelocityWorld;
      substepState.orientation = angularMotion.orientation;
      substepState.position.x = Number(substepState.position.x || 0)
        + Number(substepState.velocity.x || 0) * tireSubstepDt;
      substepState.position.y = Number(substepState.position.y || 0)
        + Number(substepState.velocity.y || 0) * tireSubstepDt;
      substepState.position.z = Number(substepState.position.z || 0)
        + Number(substepState.velocity.z || 0) * tireSubstepDt;
      const euler = eulerFromQuaternion(substepState.orientation, this.eulerScratch);
      substepState.yawRad = normalizeAngle(euler.yaw);
      substepState.pitchRad = euler.pitch;
      substepState.rollRad = euler.roll;
      substepState.yawRateRadps = Number(substepState.angularVelocityWorld.y || 0);
      substepState.groundSpeedMps = Math.hypot(
        Number(substepState.velocity.x || 0), Number(substepState.velocity.z || 0)
      );
      const forwardX = Math.sin(substepState.yawRad);
      const forwardZ = Math.cos(substepState.yawRad);
      const rightX = forwardZ;
      const rightZ = -forwardX;
      substepState.bodyLongitudinalSpeedMps = Number(substepState.velocity.x || 0) * forwardX
        + Number(substepState.velocity.y || 0) * 0
        + Number(substepState.velocity.z || 0) * forwardZ;
      substepState.bodyLateralSpeedMps = Number(substepState.velocity.x || 0) * rightX
        + Number(substepState.velocity.y || 0) * 0
        + Number(substepState.velocity.z || 0) * rightZ;
      let supportedWheelCount = 0;
      let availableBumpTravelM = 0;
      let bottomedOutWheelCount = 0;
      let maximumOvertravelM = 0;
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const wheelId = RACE_WHEEL_IDS[wheelIndex];
        if (!(Number(tireResult.wheelLoadsN?.[wheelId] || 0) > 1)) continue;
        supportedWheelCount += 1;
        const suspension = tireResult.suspensionState?.[wheelId] || {};
        const travelM = wheelId[0] === 'f'
          ? this.config.suspensionTravelFrontM : this.config.suspensionTravelRearM;
        availableBumpTravelM = Math.max(
          availableBumpTravelM,
          Math.max(0, travelM - Number(suspension.compressionM || 0))
        );
        if (suspension.bottomedOut === true) bottomedOutWheelCount += 1;
        maximumOvertravelM = Math.max(
          maximumOvertravelM,
          Number(suspension.overtravelM || 0)
        );
      }
      const suspensionBodyContactSupport = substepScratch.suspensionBodyContactSupport;
      suspensionBodyContactSupport.supportedWheelCount = supportedWheelCount;
      suspensionBodyContactSupport.availableBumpTravelM = availableBumpTravelM;
      suspensionBodyContactSupport.bottomedOutWheelCount = bottomedOutWheelCount;
      suspensionBodyContactSupport.maximumOvertravelM = maximumOvertravelM;
      environment.suspensionBodyContactSupport = suspensionBodyContactSupport;
      const terrainCollisionDeferredByLod = (
        environment.staticColliderWorld instanceof PreparedStaticRaceColliderWorld
        && environment.terrainCollisionClassification === 'smooth-connected-surface'
        && environment.bodyCollisionPredicted !== true
        && maximumOvertravelM <= 0
      );
      if (terrainCollisionDeferredByLod) {
        environment.wheelCylinderSweeps = this.emptyWheelCylinderSweeps;
        environment.wheelCollisionSupportFeatures = this.emptyWheelCollisionSupportFeatures;
      } else {
        const wheelSweepRequest = substepScratch.wheelSweepRequest;
        wheelSweepRequest.tireResult = tireResult;
        wheelSweepRequest.previousState = substepStartState;
        wheelSweepRequest.proposedState = substepState;
        environment.wheelCylinderSweeps = this.createSweptWheelCylinders(wheelSweepRequest);
        environment.wheelCollisionSupportFeatures = createWheelCylinderSupportFeatures(
          environment.wheelCylinderSweeps, 1
        );
      }
      const bodyPreImpactKineticEnergyJ = calculateKineticEnergyJ(substepState, this.config);
      const bodyCollisionRequest = substepScratch.bodyCollisionRequest;
      bodyCollisionRequest.workingState = substepState;
      const atChassisCollisionBoundary = substepIndex
        === this.config.tireSubstepsPerChassisStep - 1;
      const deferBodyCollisionToChassisBoundary = !atChassisCollisionBoundary
        && this.config.tireSubstepsPerChassisStep > 1
        && Boolean(environment.physicsTerrainQueryFrame);
      if (deferBodyCollisionToChassisBoundary) {
        this.physicsCostAccounting.count('bodyCollisionDeferredTireSubsteps');
      }
      bodyCollisionRequest.previousWorkingState = atChassisCollisionBoundary
        ? this.substepStartStateScratch[0]
        : substepStartState;
      bodyCollisionRequest.config = this.config;
      bodyCollisionRequest.environment = environment;
      bodyCollisionRequest.dt = atChassisCollisionBoundary ? chassisStepDt : tireSubstepDt;
      bodyCollisionRequest.advanceState = false;
      let bodyResult = deferBodyCollisionToChassisBoundary
        ? substepScratch.deferredBodyCollisionResult
        : this.bodyCollision.step(bodyCollisionRequest);
      bodyResult.preImpactKineticEnergyJ = bodyPreImpactKineticEnergyJ;
      bodyResult.postImpactKineticEnergyJ = calculateKineticEnergyJ(substepState, this.config);
      bodyResult.constraintEnergyDeltaJ = quantize(
        bodyResult.postImpactKineticEnergyJ - bodyResult.preImpactKineticEnergyJ
      );
      if (substepIndex === this.config.tireSubstepsPerChassisStep - 1
        && this.stepIndex % this.config.surfaceConsistencySampleIntervalSteps === 0) {
        const consistencyRequest = substepScratch.surfaceConsistencyRequest;
        consistencyRequest.previousState = substepStartState;
        consistencyRequest.proposedState = substepState;
        consistencyRequest.tireResult = tireResult;
        consistencyRequest.bodyResult = bodyResult;
        consistencyRequest.environment = environment;
        bodyResult.surfaceConsistency = this.sampleSurfaceConsistency(consistencyRequest);
      } else {
        bodyResult.surfaceConsistency = substepScratch.emptySurfaceConsistency;
      }
      const hasBodyTerrainQuery = typeof environment.sampleTerrainAtWorldPoint === 'function'
        || typeof environment.sampleTerrainAtWorldPoints === 'function';
      const staticCollidersOwnBodyCollision = environment.staticCollidersOwnBodyCollision === true;
      const terrainCollisionDeferred = bodyResult.terrainCollisionDeferred === true;
      const latestStaticNormal = bodyResult.staticCollision?.contacts?.at(-1)?.normal || null;
      let penetrationSample;
      if (staticCollidersOwnBodyCollision) {
        penetrationSample = substepScratch.staticPenetrationSample;
        penetrationSample.maximumPenetrationM = Number(
          bodyResult.staticCollision?.residualPenetrationM || 0
        );
        penetrationSample.deepestNormal = latestStaticNormal;
      } else if (bodyResult.finalPenetrationSample) {
        penetrationSample = bodyResult.finalPenetrationSample;
      } else if (hasBodyTerrainQuery
        && !bodyResult.broadphaseRejected && !terrainCollisionDeferred) {
        penetrationSample = this.bodyCollision.samplePosePenetration(
          substepState,
          environment,
          this.config.bodyCollisionToleranceM
        );
      } else {
        penetrationSample = substepScratch.clearPenetrationSample;
      }
      bodyResult.maximumPenetrationAfterSolveM = penetrationSample.maximumPenetrationM;
      bodyResult.invalidTerrainSampleCount = penetrationSample.invalidTerrainSampleCount;
      bodyResult.allBodySamplesBelowTerrain = penetrationSample.allBodySamplesBelowTerrain;
      const currentPenetrationM = Math.max(0, Number(penetrationSample.maximumPenetrationM || 0));
      if (reuseContactGeometry && (environment.geometryRefreshRequested === true
        || tireSupportUnknown
        || bodyResult.swept === true
        || Number(bodyResult.maximumPenetrationM || 0) > this.config.bodyCollisionToleranceM)) {
        refreshContactGeometry = true;
      }
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const wheelId = RACE_WHEEL_IDS[wheelIndex];
        const suspension = tireResult.suspensionState?.[wheelId];
        if (!suspension) continue;
        if (reuseContactGeometry && ((!initialNearBumpByWheel[wheelId]
          && (suspension.bottomedOut === true
            || Number(suspension.remainingBumpTravelM ?? 1) < 0.012))
          || (tireResult.validTreadContactByWheel?.[wheelId] === false
            && tireResult.invalidContactReasonByWheel?.[wheelId] !== 'airborne'))) {
          refreshContactGeometry = true;
          break;
        }
      }
      const contactPenetrationM = Math.max(
        currentPenetrationM,
        Number(bodyResult.residualPenetrationM || 0),
        Number(bodyResult.maximumPenetrationM || 0),
        Number(bodyResult.initialUnsupportedMaximumPenetrationM || 0)
      );
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
      const rawCgTerrain = typeof environment.sampleTerrainAtWorldPoint === 'function'
        ? environment.sampleTerrainAtWorldPoint(substepState.position)
        : null;
      const rawCgNormal = rawCgTerrain?.normal || rawCgTerrain?.normalWorld;
      const cgTerrainAlreadyResolved = rawCgTerrain?.valid === true
        && Number.isFinite(Number(rawCgTerrain.heightM))
        && Number.isFinite(Number(rawCgNormal?.x))
        && Number.isFinite(Number(rawCgNormal?.y))
        && Number.isFinite(Number(rawCgNormal?.z));
      const cgTerrain = cgTerrainAlreadyResolved
        ? rawCgTerrain
        : createSurfaceSample(rawCgTerrain, {
            queryPosition: substepState.position,
            source: 'cg-terrain-envelope'
          });
      const cgTerrainHeightM = cgTerrain.valid ? cgTerrain.heightM : null;
      const allKnownWheelTerrainInvalid = tireTerrainValidityCount > 0
        && invalidTireTerrainCount === tireTerrainValidityCount;
      const authoritativeTerrainUnavailable = environment.requireValidTerrainEnvelope === true
        && penetrationSample.allTerrainSamplesInvalid === true
        && (tireTerrainValidityCount === 0 || allKnownWheelTerrainInvalid);
      if (authoritativeTerrainUnavailable) {
        if (this.contactStabilizationState.invalidTerrainSubsteps === 0) {
          this.contactStabilizationState.temporaryInvalidTerrainCount += 1;
        }
        this.contactStabilizationState.invalidTerrainSubsteps += 1;
        this.contactStabilizationState.invalidTerrainDurationSeconds = quantize(
          this.contactStabilizationState.invalidTerrainSubsteps / this.config.tireHz,
          12
        );
        const safeNormal = this.lastValidLocalCollisionFrame?.supportNormal
          || penetrationSample.deepestNormal
          || { x: 0, y: 1, z: 0 };
        const safeVelocity = removeVelocityIntoNormal(substepState.velocity, safeNormal);
        substepState.velocity = safeVelocity.velocity;
        this.updateDerivedMotionState(substepState);
        bodyResult.temporaryInvalidTerrain = {
          durationSeconds: this.contactStabilizationState.invalidTerrainDurationSeconds,
          removedInwardSpeedMps: safeVelocity.removedInwardSpeedMps,
          retainedLocalCollisionFrame: Boolean(this.lastValidLocalCollisionFrame)
        };
      } else {
        this.contactStabilizationState.invalidTerrainSubsteps = 0;
        this.contactStabilizationState.invalidTerrainDurationSeconds = 0;
      }

      const moderatePenetration = contactPenetrationM > this.config.shallowContactPenetrationM
        && contactPenetrationM <= this.config.localCcdRollbackMaximumPenetrationM;
      const contactClosingSpeedMps = maximumContactClosingSpeedMps(
        substepStartState,
        bodyResult.contacts || [],
        penetrationSample.deepestNormal
      );
      // A previous-frame rollback is a one-sided impact constraint. Reusing it
      // after the chassis has begun separating snaps the car back into the
      // hill every substep and can make an otherwise recoverable contact feel
      // welded in place. Current-substep CCD still owns actual crossings; an
      // artificial/no-manifold fixture retains the conservative fallback.
      const historicalRollbackRequired = bodyResult.swept === true
        || contactClosingSpeedMps > 1e-4
        || !(bodyResult.contacts?.length > 0);
      let localRollback = null;
      if (bodyResult.safePoseRollbackFraction !== null
        && bodyResult.safePoseRollbackFraction !== undefined) {
        localRollback = removeVelocityIntoNormal(
          substepState.velocity,
          penetrationSample.deepestNormal || { x: 0, y: 1, z: 0 }
        );
        substepState.velocity = localRollback.velocity;
        this.updateDerivedMotionState(substepState);
      } else if (moderatePenetration
        && historicalRollbackRequired
        && !authoritativeTerrainUnavailable) {
        localRollback = this.restoreLocalCollisionFrame(
          substepState,
          this.lastValidLocalCollisionFrame,
          penetrationSample.deepestNormal,
          nextStepIndex
        );
      }
      if (localRollback) {
        this.contactStabilizationState.localRollbackFailureCount = 0;
        const routeDistance = finiteNumber(substepState.routeDistance
          ?? environment.physicsIncidentDiagnostics?.routeDistanceM
          ?? environment.routeDistanceM);
        bodyResult.localCcdRollback = this.recordContactStabilization(
          'local-ccd-rollback',
          {
            stepIndex: nextStepIndex,
            substepIndex,
            penetrationM: contactPenetrationM,
            rollbackFraction: bodyResult.safePoseRollbackFraction,
            routeDistanceBefore: routeDistance,
            routeDistanceAfter: routeDistance,
            normal: localRollback.normal,
            removedInwardSpeedMps: localRollback.removedInwardSpeedMps,
            reason: bodyResult.safePoseRollbackFraction === null
              || bodyResult.safePoseRollbackFraction === undefined
              ? 'previous-local-frame' : 'current-substep-toi'
          }
        );
        const rollbackEnvironmentTimer = this.physicsCostAccounting.start('environmentProvider');
        const rollbackEnvironment = this.environmentProvider({
          timeSeconds: substepTimeSeconds,
          stepIndex: nextStepIndex,
          substepIndex,
          state: substepState,
          previousState: substepStartState,
          controls,
          tireSubstepDt,
          localCcdRollbackRecalculation: true,
          contactRebuildOnly: true,
          physicsCostAccounting: this.physicsCostAccounting
        }) || environment;
        this.physicsCostAccounting.end(rollbackEnvironmentTimer);
        rollbackEnvironment.physicsCostAccounting ||= this.physicsCostAccounting;
        this.performanceDiagnostics.environmentQueries += 1;
        this.physicsCostAccounting.count('environmentProviderCalls');
        const rebuiltTireContact = this.tireContactSubsystem.step({
          state: substepState,
          controls,
          config: this.config,
          environment: rollbackEnvironment,
          dt: 0,
          stepIndex: nextStepIndex,
          substepIndex,
          timeSeconds: substepTimeSeconds,
          localCcdRollbackRecalculation: true,
          contactRebuildOnly: true
        }) || {};
        for (const field of [
          'contactPatches',
          'suspensionState',
          'wheelLoadsN',
          'wheelSlip',
          'supportedWheelCount',
          'validTreadContactByWheel',
          'invalidContactReasonByWheel',
          'grounded',
          'wheelGrounded'
        ]) {
          if (rebuiltTireContact[field] !== undefined) tireResult[field] = rebuiltTireContact[field];
        }
        substepState.contactPatches = tireResult.contactPatches || {};
        substepState.suspensionState = tireResult.suspensionState || {};
        substepState.wheelLoadsN = tireResult.wheelLoadsN || {};
        substepState.wheelSlip = tireResult.wheelSlip || {};
        rollbackEnvironment.wheelCylinderSweeps = this.createSweptWheelCylinders({
          tireResult,
          previousState: substepState,
          proposedState: substepState
        });
        rollbackEnvironment.wheelCollisionSupportFeatures = createWheelCylinderSupportFeatures(
          rollbackEnvironment.wheelCylinderSweeps, 1
        );
        const rebuiltBodyState = {
          ...substepState,
          position: clone(substepState.position),
          orientation: clone(substepState.orientation),
          velocity: clone(substepState.velocity),
          angularVelocityWorld: clone(substepState.angularVelocityWorld)
        };
        const rebuiltBodyContacts = this.bodyCollision.step({
          workingState: rebuiltBodyState,
          previousWorkingState: null,
          config: this.config,
          environment: rollbackEnvironment,
          dt: tireSubstepDt,
          advanceState: false
        });
        bodyResult.contacts = clone(rebuiltBodyContacts.contacts || []);
        bodyResult.rebuiltAfterLocalCcdRollback = true;
        bodyResult.rebuiltMaximumPenetrationM = rebuiltBodyContacts.residualPenetrationM
          ?? rebuiltBodyContacts.maximumPenetrationM
          ?? null;
        environment = rollbackEnvironment;
      } else if (moderatePenetration) {
        this.contactStabilizationState.localRollbackFailureCount += 1;
      } else if (contactPenetrationM <= this.config.shallowContactPenetrationM) {
        this.contactStabilizationState.localRollbackFailureCount = 0;
      }

      const cgSubmersionM = cgTerrain.valid
        ? cgTerrainHeightM - Number(substepState.position.y || 0) : 0;
      const allLowerSupportDeeplySubmerged = (
        penetrationSample.allLowerBodySupportFeaturesBelowTerrain === true
          || penetrationSample.allBodySamplesBelowTerrain === true
      )
        && Number(
          penetrationSample.minimumLowerBodySupportPenetrationM
            ?? penetrationSample.minimumPenetrationM
            ?? 0
        )
          > this.config.catastrophicBodyPenetrationM;
      let recoveryReason = null;
      if (chassisStepStartedNonFinite || !isFiniteVehiclePose(substepState)) {
        recoveryReason = 'non-finite-vehicle-state';
      }
      else if (authoritativeTerrainUnavailable
        && this.contactStabilizationState.invalidTerrainDurationSeconds
          >= this.config.invalidTerrainRecoveryDelaySeconds) {
        recoveryReason = 'sustained-invalid-authoritative-terrain';
      }
      else if (currentPenetrationM > this.config.catastrophicBodyPenetrationM) {
        recoveryReason = 'catastrophic-body-penetration';
      }
      else if (cgSubmersionM > this.config.catastrophicCgSubmersionM) {
        recoveryReason = 'catastrophic-cg-submersion';
      }
      else if (allLowerSupportDeeplySubmerged) {
        recoveryReason = 'catastrophic-lower-body-submersion';
      }
      else if (penetrationCorrectionStalled
        && currentPenetrationM > this.config.catastrophicBodyPenetrationM
        && this.contactStabilizationState.localRollbackFailureCount
          >= this.config.localCcdRollbackFailureLimit) {
        recoveryReason = 'catastrophic-local-rollback-failure';
      }
      if (!recoveryReason && !localRollback && contactPenetrationM > resolvedToleranceM) {
        const stabilization = removeVelocityIntoNormal(
          substepState.velocity,
          penetrationSample.deepestNormal || { x: 0, y: 1, z: 0 }
        );
        substepState.velocity = stabilization.velocity;
        this.updateDerivedMotionState(substepState);
        bodyResult.ordinaryContactStabilization = this.recordContactStabilization(
          'ordinary-correction',
          {
            stepIndex: nextStepIndex,
            substepIndex,
            penetrationM: contactPenetrationM,
            routeDistanceBefore: substepState.routeDistance,
            routeDistanceAfter: substepState.routeDistance,
            normal: stabilization.normal,
            removedInwardSpeedMps: stabilization.removedInwardSpeedMps,
            reason: contactPenetrationM <= this.config.shallowContactPenetrationM
              ? 'shallow-manifold-settling' : 'bounded-contact-settling'
          }
        );
      }
      const activeIncident = this.penetrationRecoveryState.currentIncident;
      if (recoveryReason && activeIncident?.lastRecoveryStepIndex === nextStepIndex) {
        bodyResult.recoveryDeferredToNextChassisStep = true;
        recoveryReason = null;
      }
      let substepRecovery = null;
      if (recoveryReason) {
        const recoveryTimer = this.physicsCostAccounting.start('recoveryRebuilding');
        this.physicsCostAccounting.noteRecovery(recoveryReason);
        const routeDistanceBeforeRecovery = finiteNumber(
          substepState.routeDistance
            ?? environment.physicsIncidentDiagnostics?.routeDistanceM
            ?? environment.routeDistanceM
        );
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
        const catastrophicOutcome = recovery.recoveryMode === 'historical'
          ? 'catastrophic-historical-recovery'
          : recovery.recoveryMode === 'route' || recovery.usedRouteRecoveryPath
            ? 'catastrophic-route-recovery'
            : 'catastrophic-recovery-failed';
        const catastrophicRecoveryEvent = this.recordContactStabilization(
          catastrophicOutcome,
          {
            stepIndex: nextStepIndex,
            substepIndex,
            penetrationM: currentPenetrationM,
            routeDistanceBefore: routeDistanceBeforeRecovery,
            routeDistanceAfter: recovery.routeDistance,
            normal: recovery.blockingNormal,
            recovery,
            reason: recoveryReason
          }
        );
        // The failed manifold is transactionally discarded. Re-query the
        // environment and rebuild wheel, suspension, tread, body and sidewall
        // contacts from the restored pose; no impulse or correction produced
        // by the submerged pose survives this boundary.
        const recoveryEnvironmentTimer = this.physicsCostAccounting.start('environmentProvider');
        environmentRequest.recoveryRecalculation = true;
        environmentRequest.reuseContactGeometry = false;
        environment = this.environmentProvider(environmentRequest) || {};
        this.physicsCostAccounting.end(recoveryEnvironmentTimer);
        environment.physicsCostAccounting ||= this.physicsCostAccounting;
        this.performanceDiagnostics.environmentQueries += 1;
        this.physicsCostAccounting.count('environmentProviderCalls');
        this.physicsCostAccounting.count('recoveryRecalculations');
        tireStepRequest.environment = environment;
        tireStepRequest.recoveryRecalculation = true;
        tireResult = this.tireContactSubsystem.step(tireStepRequest);
        aeroRequest.environment = environment;
        const cleanAeroState = this.aeroModel.calculateForces(aeroRequest);
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
        let cleanSupportedWheelCount = 0;
        let cleanAvailableBumpTravelM = 0;
        let cleanBottomedOutWheelCount = 0;
        let cleanMaximumOvertravelM = 0;
        for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
          const wheelId = RACE_WHEEL_IDS[wheelIndex];
          if (!(Number(tireResult.wheelLoadsN?.[wheelId] || 0) > 1)) continue;
          cleanSupportedWheelCount += 1;
          const suspension = tireResult.suspensionState?.[wheelId] || {};
          const travelM = wheelId[0] === 'f'
            ? this.config.suspensionTravelFrontM : this.config.suspensionTravelRearM;
          cleanAvailableBumpTravelM = Math.max(
            cleanAvailableBumpTravelM,
            Math.max(0, travelM - Number(suspension.compressionM || 0))
          );
          if (suspension.bottomedOut === true) cleanBottomedOutWheelCount += 1;
          cleanMaximumOvertravelM = Math.max(
            cleanMaximumOvertravelM,
            Number(suspension.overtravelM || 0)
          );
        }
        environment.suspensionBodyContactSupport = {
          supportedWheelCount: cleanSupportedWheelCount,
          availableBumpTravelM: cleanAvailableBumpTravelM,
          bottomedOutWheelCount: cleanBottomedOutWheelCount,
          maximumOvertravelM: cleanMaximumOvertravelM
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
        bodyResult.catastrophicRecovery = catastrophicRecoveryEvent;
        bodyResult.emergencyRecovery = recovery;
        bodyResult.discardedFailedManifold = true;
        bodyResult.preImpactKineticEnergyJ = cleanBodyPreImpactKineticEnergyJ;
        bodyResult.postImpactKineticEnergyJ = calculateKineticEnergyJ(substepState, this.config);
        bodyResult.constraintEnergyDeltaJ = quantize(
          bodyResult.postImpactKineticEnergyJ - bodyResult.preImpactKineticEnergyJ
        );
        bodyResult.surfaceConsistency = { samples: [], discrepancies: [] };
        const cleanPenetration = this.bodyCollision.samplePosePenetration(
          substepState, environment, this.config.bodyCollisionToleranceM
        );
        bodyResult.maximumPenetrationAfterSolveM = cleanPenetration.maximumPenetrationM;
        this.physicsCostAccounting.end(recoveryTimer);
      } else if (hasBodyTerrainQuery) {
        if (currentPenetrationM <= resolvedToleranceM
          && !authoritativeTerrainUnavailable
          && isFiniteVehiclePose(substepState)) {
          const routeDistanceM = environment.physicsIncidentDiagnostics?.routeDistanceM
            ?? environment.routeDistanceM
            ?? substepState.routeDistance;
          this.lastValidLocalCollisionFrame = this.createLocalCollisionFrame(
            substepState,
            tireResult,
            {
              stepIndex: nextStepIndex,
              substepIndex,
              routeDistanceM,
              supportNormal: penetrationSample.deepestNormal
                || cgTerrain.normal
                || { x: 0, y: 1, z: 0 }
            }
          );
          if (finalTireSubstep) {
            this.recordNonPenetratingState(substepState, tireResult, nextStepIndex, {
              penetrationSample,
              bodyResult,
              environment,
              routeDistanceM
            });
          }
        }
        if (finalTireSubstep) {
          this.updatePenetrationIncidentClearState({
            state: substepState,
            penetrationSample,
            stepIndex: nextStepIndex
          });
        }
      }
      const bodyCorrection = bodyResult.positionalCorrectionWorldM || {};
      if (Math.hypot(
        Number(bodyCorrection.x || 0),
        Number(bodyCorrection.y || 0),
        Number(bodyCorrection.z || 0)
      ) > EPSILON) {
        for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
          const wheelId = RACE_WHEEL_IDS[wheelIndex];
          const suspension = tireResult.suspensionState?.[wheelId];
          if (!suspension || suspension.inContact !== true) continue;
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
        }
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
      if (this.stationaryResetHold) {
        if (substepRecovery) {
          // A terrain correction immediately after reset is not driver intent.
          // Adopt its verified pose and rebuilt contacts as the new parked
          // equilibrium; releasing here lets the recovered body fall back into
          // the hill and reactivates the crash oscillator forever.
          this.stationaryResetHold.position = clone(substepState.position);
          this.stationaryResetHold.orientation = clone(substepState.orientation);
          this.stationaryResetHold.routeDistance = finiteNumber(substepState.routeDistance);
          this.stationaryResetHold.suspensionState = clone(substepState.suspensionState);
          this.stationaryResetHold.contactPatches = clone(substepState.contactPatches);
        }
        this.applyStationaryResetHold(substepState);
      }
    }
    const tireAggregateScratch = this.tireAggregateScratch[
      this.tireAggregateScratchCursor++ % this.tireAggregateScratch.length
    ];
    const tires = aggregateTireResults(
      tireResults,
      1 / this.config.tireHz,
      tireAggregateScratch
    );
    const bodyCollisionAggregate = aggregateBodyCollisionResults(
      bodyCollisionResults,
      tireAggregateScratch
    );
    const bodyBroadphaseRejectedSubsteps = bodyCollisionAggregate.broadphaseRejectedSubsteps;
    this.performanceDiagnostics.bodyBroadphaseRejectedSubsteps += bodyBroadphaseRejectedSubsteps;
    this.performanceDiagnostics.bodyNarrowphaseSubsteps += bodyCollisionResults.length
      - bodyBroadphaseRejectedSubsteps;
    this.physicsCostAccounting.count('bodyCcdActivations', tireAggregateScratch.bodyCcdActivations);
    this.physicsCostAccounting.count(
      'wheelCcdActivations',
      tireAggregateScratch.wheelCcdActivations
    );
    this.state.position.x = substepState.position.x;
    this.state.position.y = substepState.position.y;
    this.state.position.z = substepState.position.z;
    this.state.velocity.x = substepState.velocity.x;
    this.state.velocity.y = substepState.velocity.y;
    this.state.velocity.z = substepState.velocity.z;
    this.state.orientation.x = substepState.orientation.x;
    this.state.orientation.y = substepState.orientation.y;
    this.state.orientation.z = substepState.orientation.z;
    this.state.orientation.w = substepState.orientation.w;
    this.state.angularVelocityWorld.x = Math.abs(Number(
      substepState.angularVelocityWorld.x || 0
    )) < 1e-12 ? 0 : substepState.angularVelocityWorld.x;
    this.state.angularVelocityWorld.y = Math.abs(Number(
      substepState.angularVelocityWorld.y || 0
    )) < 1e-12 ? 0 : substepState.angularVelocityWorld.y;
    this.state.angularVelocityWorld.z = Math.abs(Number(
      substepState.angularVelocityWorld.z || 0
    )) < 1e-12 ? 0 : substepState.angularVelocityWorld.z;
    this.state.yawRad = substepState.yawRad;
    this.state.pitchRad = substepState.pitchRad;
    this.state.rollRad = substepState.rollRad;
    this.state.penetrationRecovery = (
      tires.bodyCollision.emergencyRecoveries.at(-1)
        || this.penetrationRecoveryState.history.at(-1)
        || null
    );
    const publicContactStabilization = this.state.contactStabilization || {};
    publicContactStabilization.sequence = this.contactStabilizationState.sequence;
    publicContactStabilization.ordinaryCorrectionCount = (
      this.contactStabilizationState.ordinaryCorrectionCount
    );
    publicContactStabilization.localCcdRollbackCount = (
      this.contactStabilizationState.localCcdRollbackCount
    );
    publicContactStabilization.catastrophicHistoricalRecoveryCount = (
      this.contactStabilizationState.catastrophicHistoricalRecoveryCount
    );
    publicContactStabilization.catastrophicRouteRecoveryCount = (
      this.contactStabilizationState.catastrophicRouteRecoveryCount
    );
    publicContactStabilization.gameplayResetCount = this.contactStabilizationState.gameplayResetCount;
    publicContactStabilization.temporaryInvalidTerrainCount = (
      this.contactStabilizationState.temporaryInvalidTerrainCount
    );
    publicContactStabilization.invalidTerrainSubsteps = (
      this.contactStabilizationState.invalidTerrainSubsteps
    );
    publicContactStabilization.invalidTerrainDurationSeconds = (
      this.contactStabilizationState.invalidTerrainDurationSeconds
    );
    publicContactStabilization.localRollbackFailureCount = (
      this.contactStabilizationState.localRollbackFailureCount
    );
    publicContactStabilization.latest = this.contactStabilizationState.latest;
    this.state.contactStabilization = publicContactStabilization;
    const integrationControls = tires.powertrainState?.handbrakeEscSuppressed === true
      ? {
          ...controls,
          assists: { ...(controls.assists || {}), stabilityControlEnabled: false }
        }
      : controls;
    const integration = this.integrateChassis(
      integrationControls, tires, 1 / this.config.chassisHz, { preintegrated: true }
    );
    if (this.stationaryResetHold) this.applyStationaryResetHold(this.state);
    let maximumUnsprungSpeedMps = 0;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      maximumUnsprungSpeedMps = Math.max(maximumUnsprungSpeedMps, Math.abs(Number(
        this.state.suspensionState?.[RACE_WHEEL_IDS[wheelIndex]]?.unsprungVelocityMps || 0
      )));
    }
    const angularVelocityBody = rotateVectorToBody(
      this.state.angularVelocityWorld, this.state.orientation
    );
    const suspensionModesNearlySettled = !this.stationaryResetHold
      && Number(this.state.supportedWheelCount || 0) >= 3
      && !(tires.bodyCollision?.contacts?.length > 0)
      && Math.abs(Number(controls.steering || 0)) < 0.05
      && Math.abs(Number(controls.throttle || 0)) < 0.01
      && Math.abs(Number(this.state.groundSpeedMps || 0)) < 0.75
      && Math.abs(Number(this.state.velocity?.y || 0)) < 0.15
      && Math.hypot(
        Number(angularVelocityBody.x || 0), Number(angularVelocityBody.z || 0)
      ) < 0.1
      && maximumUnsprungSpeedMps < 0.3;
    this.suspensionModeSettleSteps = suspensionModesNearlySettled
      ? this.suspensionModeSettleSteps + 1 : 0;
    if (this.suspensionModeSettleSteps >= Math.ceil(this.config.chassisHz * 0.15)) {
      this.state.velocity.y = 0;
      angularVelocityBody.x = 0;
      angularVelocityBody.z = 0;
      this.state.angularVelocityWorld = rotateVectorByQuaternion(
        angularVelocityBody, this.state.orientation
      );
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const suspension = this.state.suspensionState?.[RACE_WHEEL_IDS[wheelIndex]];
        if (!suspension) continue;
        suspension.unsprungVelocityMps = 0;
        suspension.compressionVelocityMps = 0;
        suspension.damperVelocityMps = 0;
      }
    }
    const postImpactKineticEnergyJ = calculateKineticEnergyJ(this.state, this.config);
    const bodyNormalImpulseNs = Number(tires.bodyCollision.bodyNormalImpulseNs || 0);
    let tireVerticalImpulseNs = 0;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      tireVerticalImpulseNs += Number(
        tires.tireVerticalImpulseByWheelNs?.[RACE_WHEEL_IDS[wheelIndex]] || 0
      );
    }
    const impactStarted = bodyNormalImpulseNs > 1 || (
      preImpactVerticalVelocityMps < -0.25 && tireVerticalImpulseNs > 1
    );
    let physicalBodyImpactCount = 0;
    let preImpactKineticEnergyJ = chassisStepPreImpactKineticEnergyJ;
    let physicalImpactEnergyDeltaJ = 0;
    for (let resultIndex = 0; resultIndex < bodyCollisionResults.length; resultIndex += 1) {
      const result = bodyCollisionResults[resultIndex];
      if (!(Number(result.bodyNormalImpulseNs || 0) > 0)) continue;
      if (physicalBodyImpactCount === 0) {
        preImpactKineticEnergyJ = Number(result.preImpactKineticEnergyJ || 0);
      }
      physicalBodyImpactCount += 1;
      physicalImpactEnergyDeltaJ += Number(result.postImpactKineticEnergyJ || 0)
        - Number(result.preImpactKineticEnergyJ || 0);
    }
    const resolvedPostImpactKineticEnergyJ = physicalBodyImpactCount > 0
      ? preImpactKineticEnergyJ + physicalImpactEnergyDeltaJ
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
    // These sources are already owned by the runner. Retained telemetry deep
    // clones the complete integration record below; transient telemetry can
    // safely expose the current read-only view without cloning it every step.
    integration.impactEnergy = this.activeImpact || null;
    integration.takeoff = this.takeoffContactState.activeTakeoff
      || this.takeoffHistory.at(-1) || null;
    for (const wheelId of RACE_WHEEL_IDS) {
      this.renderWheelSpinAngles[wheelId] = quantize((
        Number(this.renderWheelSpinAngles[wheelId] || 0)
        + Number(this.state.wheelAngularVelocityRadps?.[wheelId] || 0) * chassisStepDt
      ) % (Math.PI * 2), 12);
    }
    this.stepIndex = nextStepIndex;
    this.diagnostics.completedSteps += 1;
    this.diagnostics.completedTireSubsteps += tireResults.length;
    this.physicsCostAccounting.count('completedSteps');
    this.physicsCostAccounting.count('completedTireSubsteps', tireResults.length);
    const telemetryTimer = this.physicsCostAccounting.start('telemetryConstruction');
    const retention = this.config.telemetryRetention;
    const retained = retention === 'history' || retention === 'latest';
    if (retained) this.performanceDiagnostics.retainedTelemetrySnapshots += 1;
    if (retention === 'transient') this.performanceDiagnostics.transientTelemetrySteps += 1;
    const state = retained ? this.createStateSnapshot() : this.state;
    let telemetry = null;
    if (retention !== 'none') {
      telemetry = retained ? { catchUp: {} } : this.transientTelemetryScratch;
      telemetry.stepIndex = this.stepIndex;
      telemetry.timeSeconds = this.simulationTimeSeconds;
      telemetry.controls = retained ? clone(controls) : controls;
      telemetry.subsystemOrder = retained
        ? [...VEHICLE_DYNAMICS_SUBSYSTEM_ORDER]
        : VEHICLE_DYNAMICS_SUBSYSTEM_ORDER;
      telemetry.tireSubstepCount = tireResults.length;
      telemetry.state = state;
      telemetry.forces = retained ? clone(integration) : integration;
      telemetry.assistInterventions = retained
        ? clone(integration.assistInterventions)
        : integration.assistInterventions;
      telemetry.catchUp.maxCatchUpSteps = this.config.maxCatchUpSteps;
      telemetry.catchUp.completedSteps = this.diagnostics.completedSteps;
      telemetry.catchUp.completedTireSubsteps = this.diagnostics.completedTireSubsteps;
      telemetry.catchUp.droppedTimeSeconds = this.diagnostics.droppedTimeSeconds;
      telemetry.catchUp.budgetWarning = this.diagnostics.lastCatchUpBudgetWarning;
      telemetry.legacyDifference = compareVehicleStates(
        legacySnapshot,
        state,
        retained ? null : this.legacyDifferenceScratch
      );
    }
    if (retention === 'history') {
      this.telemetry.push(telemetry);
      if (this.telemetry.length > this.config.telemetryLimit) {
        this.telemetry.splice(0, this.telemetry.length - this.config.telemetryLimit);
      }
    } else if (retention === 'latest') {
      this.telemetry[0] = telemetry;
      this.telemetry.length = 1;
    }
    this.physicsCostAccounting.end(telemetryTimer);
    if (ownsCostStep && !deferCostStepFinish) {
      const finishCostMetadata = elapsedOnlyCostStep
        ? this.physicsStepFinishMetadataScratch
        : { stepIndex: this.stepIndex, tireSubsteps: tireResults.length };
      finishCostMetadata.stepIndex = this.stepIndex;
      finishCostMetadata.tireSubsteps = tireResults.length;
      this.physicsCostAccounting.finishStep(finishCostMetadata);
    }
    return telemetry;
  }

  advance(deltaSeconds = 0, {
    input = null,
    inputTimeSeconds = null,
    legacySnapshot = null,
    onFixedStep = null
  } = {}) {
    const ownsCostFrame = this.physicsCostAccounting.beginFrame({
      source: 'VehicleDynamicsRunner',
      deltaSeconds: Number(deltaSeconds) || 0
    });
    const wallStartMs = typeof globalThis.performance?.now === 'function'
      ? globalThis.performance.now() : null;
    const delta = Math.max(0, Number(deltaSeconds) || 0);
    const nextObservedTime = quantize(
      inputTimeSeconds === null
        ? this.observedTimeSeconds + delta
        : Math.max(this.observedTimeSeconds, Number(inputTimeSeconds) || 0),
      12
    );
    if (input) this.addInputSample(nextObservedTime, input, { returnSnapshot: false });
    this.observedTimeSeconds = nextObservedTime;
    const targetStepIndex = Math.floor(
      (this.observedTimeSeconds + EPSILON) * this.config.chassisHz
    );
    const dueSteps = Math.max(0, targetStepIndex - this.stepIndex);
    const completedSteps = Math.min(dueSteps, this.config.maxCatchUpSteps);
    for (let index = 0; index < completedSteps; index += 1) {
      const telemetry = this.runStep(legacySnapshot, {
        deferCostStepFinish: true,
        backlogSteps: Math.max(0, dueSteps - index - 1)
      });
      // Fixed-step ownership hooks (for example deterministic Track State
      // mutation in the worker) must run even when telemetry construction is
      // disabled. The hook can read the runner's authoritative state.
      if (typeof onFixedStep === 'function') onFixedStep(telemetry);
      const finishCostMetadata = this.physicsCostAccounting.stepHistoryMode === 'elapsed-ring'
        ? this.physicsStepFinishMetadataScratch
        : {
            stepIndex: this.stepIndex,
            tireSubsteps: this.config.tireSubstepsPerChassisStep
          };
      finishCostMetadata.stepIndex = this.stepIndex;
      finishCostMetadata.tireSubsteps = this.config.tireSubstepsPerChassisStep;
      this.physicsCostAccounting.finishStep(finishCostMetadata);
    }
    const backlogSteps = Math.max(0, targetStepIndex - this.stepIndex);
    this.diagnostics.backlogSteps = backlogSteps;
    this.diagnostics.peakBacklogSteps = Math.max(
      this.diagnostics.peakBacklogSteps,
      backlogSteps
    );
    if (backlogSteps > 0) this.diagnostics.catchUpLimitedAdvances += 1;
    const catchUpBudgetWarning = dueSteps > this.config.maxCatchUpSteps
      ? {
          code: 'render-rate-below-fixed-step-catch-up-budget',
          renderDeltaSeconds: delta,
          estimatedRenderFps: delta > EPSILON ? 1 / delta : null,
          chassisHz: this.config.chassisHz,
          maxCatchUpSteps: this.config.maxCatchUpSteps,
          dueSteps,
          completedSteps,
          backlogSteps,
          minimumSustainableRenderFps: this.config.chassisHz / this.config.maxCatchUpSteps
        }
      : null;
    if (catchUpBudgetWarning) {
      this.diagnostics.catchUpBudgetWarnings += 1;
      this.diagnostics.lastCatchUpBudgetWarning = catchUpBudgetWarning;
      this.physicsCostAccounting.count('catchUpBudgetWarnings');
    }
    const advanceWallTimeMs = wallStartMs === null ? 0 : Math.max(
      0, globalThis.performance.now() - wallStartMs
    );
    this.performanceDiagnostics.lastAdvanceWallTimeMs = advanceWallTimeMs;
    this.performanceDiagnostics.peakAdvanceWallTimeMs = Math.max(
      Number(this.performanceDiagnostics.peakAdvanceWallTimeMs || 0),
      advanceWallTimeMs
    );
    this.physicsCostAccounting.setFrameCounter('backlogSteps', backlogSteps);
    const result = {
      completedSteps,
      completedTireSubsteps: completedSteps * this.config.tireSubstepsPerChassisStep,
      stepIndex: this.stepIndex,
      simulationTimeSeconds: this.simulationTimeSeconds,
      observedTimeSeconds: this.observedTimeSeconds,
      backlogSteps,
      advanceWallTimeMs,
      catchUpLimited: backlogSteps > 0,
      catchUpBudgetWarning,
      peakBacklogSteps: this.diagnostics.peakBacklogSteps,
      droppedTimeSeconds: this.diagnostics.droppedTimeSeconds
    };
    if (ownsCostFrame) this.physicsCostAccounting.finishFrame({
      completedSteps,
      completedTireSubsteps: result.completedTireSubsteps,
      backlogSteps,
      advanceWallTimeMs
    });
    return result;
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
      for (let index = 0; index < count; index += 1) {
        this.runStep(legacySnapshot, {
          deferCostStepFinish: true,
          backlogSteps: Math.max(0, targetStepIndex - this.stepIndex - 1)
        });
        const finishCostMetadata = this.physicsCostAccounting.stepHistoryMode === 'elapsed-ring'
          ? this.physicsStepFinishMetadataScratch
          : {
              stepIndex: this.stepIndex,
              tireSubsteps: this.config.tireSubstepsPerChassisStep
            };
        finishCostMetadata.stepIndex = this.stepIndex;
        finishCostMetadata.tireSubsteps = this.config.tireSubstepsPerChassisStep;
        this.physicsCostAccounting.finishStep(finishCostMetadata);
      }
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
      renderWheelSpinAngles: clone(this.renderWheelSpinAngles),
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
      resetTimeline: clone(this.resetTimeline),
      authoritativeResetSequence: this.authoritativeResetSequence,
      stationaryResetHold: clone(this.stationaryResetHold),
      suspensionModeSettleSteps: this.suspensionModeSettleSteps,
      lastNonPenetratingState: clone(this.lastNonPenetratingState),
      nonPenetratingStateHistory: clone(this.nonPenetratingStateHistory),
      penetrationRecoveryState: clone(this.penetrationRecoveryState),
      contactStabilizationState: clone(this.contactStabilizationState),
      lastValidLocalCollisionFrame: clone(this.lastValidLocalCollisionFrame),
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
    for (const wheelId of RACE_WHEEL_IDS) {
      this.renderWheelSpinAngles[wheelId] = Number(snapshot.renderWheelSpinAngles?.[wheelId] || 0);
    }
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
    this.resetTimeline = clone(snapshot.resetTimeline || []);
    this.authoritativeResetSequence = Math.max(0, Math.trunc(Number(
      snapshot.authoritativeResetSequence
        ?? this.resetTimeline.at(-1)?.sequence
        ?? 0
    )));
    this.stationaryResetHold = clone(snapshot.stationaryResetHold || null);
    this.suspensionModeSettleSteps = Math.max(0, Math.trunc(Number(
      snapshot.suspensionModeSettleSteps || 0
    )));
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
    this.contactStabilizationState = {
      sequence: 0,
      ordinaryCorrectionCount: 0,
      localCcdRollbackCount: 0,
      catastrophicHistoricalRecoveryCount: 0,
      catastrophicRouteRecoveryCount: 0,
      gameplayResetCount: 0,
      temporaryInvalidTerrainCount: 0,
      invalidTerrainSubsteps: 0,
      invalidTerrainDurationSeconds: 0,
      localRollbackFailureCount: 0,
      latest: null,
      history: [],
      ...clone(snapshot.contactStabilizationState || {})
    };
    this.lastValidLocalCollisionFrame = clone(snapshot.lastValidLocalCollisionFrame || null);
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
      contactStabilizationState: clone(this.contactStabilizationState),
      finalDiagnostics: clone(this.diagnostics),
      collisionTimeline: clone(this.collisionTimeline),
      resetTimeline: clone(this.resetTimeline)
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
    (record.resetTimeline || []).forEach((reset) => {
      const step = Math.max(1, Math.trunc(Number(reset.stepIndex) || 1));
      runner.scheduledReplayResets.set(step, clone(reset));
    });
    runner.advance(record.finalObservedTimeSeconds);
    runner.drainCatchUp();
    runner.collisionTimeline = clone(record.collisionTimeline || []);
    runner.resetTimeline = clone(record.resetTimeline || []);
    runner.authoritativeResetSequence = Math.max(0, Math.trunc(Number(
      runner.resetTimeline.at(-1)?.sequence || 0
    )));
    return runner;
  }
}
