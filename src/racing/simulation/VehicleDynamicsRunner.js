import { RACE_WHEEL_IDS, clamp, normalizeAngle } from './SimulationMath.js';
import { ContactPatchTireModel } from './ContactPatchTireModel.js';
import { HandlingAssist } from './HandlingAssist.js';
import { advanceTireThermalState } from './TireThermalModel.js';
import { normalizeSuspensionDefinition } from './SuspensionGeometry.js';
import { AeroModel } from './AeroModel.js';
import { sampleWakeAtVehicle } from './WakeModel.js';
import {
  getRaceNormalizedSuspensionTravelM,
  getRaceVehicleSuspensionRates
} from '../RaceVehiclePhysics.js';
import {
  addVector3,
  crossVector3,
  eulerFromQuaternion,
  integrateQuaternion,
  quaternionFromEuler,
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
const CONTINUOUS_CONTROL_FIELDS = Object.freeze([
  'steering',
  'throttle',
  'brake',
  'clutch',
  'handbrake'
]);

function quantize(value, precision = 6) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(precision)) : 0;
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
  return {
    steering: quantize(clamp(Number(input.steering ?? input.steeringWheel ?? 0), -1, 1)),
    throttle: quantize(clamp(Number(input.throttle ?? input.throttleAxis ?? 0), 0, 1)),
    brake: quantize(clamp(Number(input.brake ?? input.brakeAxis ?? 0), 0, 1)),
    clutch: quantize(clamp(Number(input.clutch ?? input.clutchAxis ?? 0), 0, 1)),
    handbrake: quantize(clamp(Number(input.handbrake || 0), 0, 1)),
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
      assists: clone(left.input.assists)
    };
    CONTINUOUS_CONTROL_FIELDS.forEach((field) => {
      sampled[field] = quantize(
        Number(left.input[field] || 0)
          + (Number(right.input[field] || 0) - Number(left.input[field] || 0)) * ratio,
        4
      );
    });
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
    yawRad: quantize(initialYaw),
    yawRateRadps: quantize(initial.yawRateRadps ?? initial.yawVelocityRadps ?? 0),
    angularVelocityWorld: {
      x: quantize(initial.angularVelocityWorld?.x ?? initial.rollRateRadps ?? 0),
      y: quantize(initial.angularVelocityWorld?.y ?? initial.yawRateRadps ?? initial.yawVelocityRadps ?? 0),
      z: quantize(initial.angularVelocityWorld?.z ?? initial.pitchRateRadps ?? 0)
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
    powertrainState: clone(initial.powertrainState || { engineRpm: initial.engineRpm ?? initial.rpm ?? 800, gear: initial.gear || 0 }),
    suspensionState: clone(initial.suspensionState || {}),
    tireState: clone(initial.tireState || {}),
    grounded: initial.grounded !== false,
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
    aeroState: clone(initial.aeroState || {})
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
  const explicitPitchStiffness = Number(config.pitchStiffnessNmPerRad);
  const explicitRollStiffness = Number(config.rollStiffnessNmPerRad);
  const explicitPitchDamping = Number(config.pitchDampingNmsPerRad);
  const explicitRollDamping = Number(config.rollDampingNmsPerRad);
  return Object.freeze({
    chassisHz,
    tireHz,
    tireSubstepsPerChassisStep: tireHz / chassisHz,
    maxCatchUpSteps: Math.max(1, Math.trunc(Number(config.maxCatchUpSteps) || 30)),
    telemetryLimit: Math.max(1, Math.trunc(Number(config.telemetryLimit) || 4096)),
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
    wheelInertiaKgM2: Math.max(0.05, Number(config.wheelInertiaKgM2) || 1.35),
    yawInertiaKgM2: Math.max(100, Number(config.yawInertiaKgM2) || massKg * 1.65),
    pitchInertiaKgM2: Math.max(100, Number(config.pitchInertiaKgM2) || massKg * 1.4),
    rollInertiaKgM2: Math.max(100, Number(config.rollInertiaKgM2) || massKg * 0.65),
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
    antiRollFront: clamp(Number(config.antiRollFront) || 0.5, 0.1, 1),
    antiRollRear: clamp(Number(config.antiRollRear) || 0.5, 0.1, 1),
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
    tireVerticalStiffnessNpm: clamp(Number(config.tireVerticalStiffnessNpm) || 210000, 50000, 600000),
    tireVerticalDampingNsM: clamp(Number(config.tireVerticalDampingNsM) || 1800, 100, 12000),
    progressiveSpringRate: clamp(Number(config.progressiveSpringRate ?? 0.35), 0, 4),
    bumpStopStartRatio: clamp(Number(config.bumpStopStartRatio) || 0.95, 0.5, 0.98),
    bumpStopRateNpm: clamp(Number(config.bumpStopRateNpm) || 120000, 10000, 2000000),
    damperHighSpeedThresholdMps: clamp(Number(config.damperHighSpeedThresholdMps) || 0.25, 0.05, 2),
    damperHighSpeedScale: clamp(Number(config.damperHighSpeedScale ?? 0.35), 0, 3),
    contactFootprintSamples: clamp(Math.trunc(Number(config.contactFootprintSamples) || 6), 4, 8),
    contactFootprintMaxGapM: clamp(Number(config.contactFootprintMaxGapM) || 0.22, 0.03, 0.6),
    maxSteerAngleRad: clamp(Number(config.maxSteerAngleRad) || 0.52, 0.05, 1.2),
    powerHp: Math.max(0, Number(config.powerHp) || 0),
    enginePeakTorqueNm: Math.max(0, Number(config.enginePeakTorqueNm) || 0),
    drivetrainEfficiency: clamp(Number(config.drivetrainEfficiency) || 0.85, 0.35, 1),
    engineForceN: Math.max(0, Number(config.engineForceN) || 7200),
    engineBrakeForceN: Math.max(0, Number(config.engineBrakeForceN) || 1600),
    brakeForceN: Math.max(0, Number(config.brakeForceN) || 14500),
    handbrakeForceN: Math.max(0, Number(config.handbrakeForceN) || 7200),
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
  inputTimelineLimit = 0
} = {}) {
  const powerW = Math.max(0, Number(tuning.powerHp || 0) * 745.7);
  const massKg = Math.max(100, Number(tuning.weightKg) || 1450);
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
  return createVehicleDynamicsConfig({
    chassisHz,
    tireHz,
    maxCatchUpSteps,
    telemetryLimit,
    inputTimelineLimit,
    massKg,
    wheelbaseM: tuning.wheelbaseM,
    frontWeightDistribution: tuning.frontWeightDistribution,
    trackWidthM: tuning.trackWidthM,
    frontTrackWidthM: tuning.trackFrontM || tuning.trackWidthM,
    rearTrackWidthM: tuning.trackRearM || tuning.trackWidthM,
    wheelRadiusM: tuning.wheelRadiusM,
    cgHeightM: tuning.cgHeightM,
    wheelInertiaKgM2: tuning.wheelInertiaKgM2,
    yawInertiaKgM2: tuning.yawInertiaKgM2,
    ackermannRatio: tuning.ackermannRatio,
    steeringRackRatio: tuning.steeringRackRatio,
    camberFrontRad: Number(tuning.camberFront || 0) * Math.PI / 180,
    camberRearRad: Number(tuning.camberRear || 0) * Math.PI / 180,
    toeFrontRad: Number(tuning.toeFront || 0) * Math.PI / 180,
    toeRearRad: Number(tuning.toeRear || 0) * Math.PI / 180,
    casterFrontRad: Number(tuning.casterFront || 0) * Math.PI / 180,
    suspensionDefinitionFront: tuning.suspensionDefinitionFront || tuning.suspensionGeometry?.front,
    suspensionDefinitionRear: tuning.suspensionDefinitionRear || tuning.suspensionGeometry?.rear,
    unsprungMassKg: tuning.unsprungMassKg,
    tireVerticalStiffnessNpm: tuning.tireVerticalStiffnessNpm,
    tireVerticalDampingNsM: tuning.tireVerticalDampingNsM,
    progressiveSpringRate: tuning.progressiveSpringRate,
    bumpStopStartRatio: tuning.bumpStopStartRatio,
    bumpStopRateNpm: tuning.bumpStopRateNpm,
    damperHighSpeedThresholdMps: tuning.damperHighSpeedThresholdMps,
    damperHighSpeedScale: tuning.damperHighSpeedScale,
    contactFootprintSamples: tuning.contactFootprintSamples,
    contactFootprintMaxGapM: tuning.contactFootprintMaxGapM,
    powerHp: tuning.powerHp,
    enginePeakTorqueNm: Math.max(authoredTorqueNm, powerDerivedTorqueNm) * extremePowerTorqueScale,
    drivetrainEfficiency: tuning.drivetrainEfficiency,
    suspensionSpringRateNpm: tuning.springRateNpm,
    suspensionDamperRateNsM: tuning.damperRateNsM,
    suspensionSpringRateFrontNpm: frontBump.springRateNpm,
    suspensionSpringRateRearNpm: rearBump.springRateNpm,
    suspensionBumpDamperFrontNsM: frontBump.damperRateNsM,
    suspensionReboundDamperFrontNsM: frontRebound.damperRateNsM,
    suspensionBumpDamperRearNsM: rearBump.damperRateNsM,
    suspensionReboundDamperRearNsM: rearRebound.damperRateNsM,
    suspensionTravelFrontM: getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelFront),
    suspensionTravelRearM: getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelRear),
    antiRollFront: frontBump.antiRollNormalized,
    antiRollRear: rearBump.antiRollNormalized,
    rollStiffnessNormalized: tuning.rollStiffness,
    engineForceN: clamp(18000 + Math.max(0, powerW - 300000) / 45, 18000, 30000),
    engineBrakeForceN: Math.max(900, Number(tuning.weightKg || 1450) * 1.15),
    brakeForceN: Math.max(9000, Number(tuning.weightKg || 1450) * 10),
    rollingResistanceN: Math.max(100, Number(tuning.weightKg || 1450) * 0.12),
    dragCoefficient: tuning.dragCoefficient,
    frontalAreaM2: tuning.frontalAreaM2
      || Math.max(1.55, Number(tuning.widthM || 1.8) * Number(tuning.lengthM || 4.5) * 0.26),
    frontDownforceCoefficient: clamp(Number(tuning.aeroFront) || 0, 0, 1) * 0.6,
    rearDownforceCoefficient: clamp(Number(tuning.aeroRear) || 0, 0, 1) * 0.6,
    frontRideHeightM: tuning.frontRideHeightM
      ?? (0.11 + clamp(Number(tuning.rideHeightFront ?? 0.5), 0, 1) * 0.1),
    rearRideHeightM: tuning.rearRideHeightM
      ?? (0.11 + clamp(Number(tuning.rideHeightRear ?? 0.5), 0, 1) * 0.1),
    groundEffectGain: tuning.groundEffectGain,
    groundEffectReferenceHeightM: tuning.groundEffectReferenceHeightM,
    floorStallHeightM: tuning.floorStallHeightM,
    diffuserRakeSensitivity: tuning.diffuserRakeSensitivity,
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
    const steerAngle = controls.steering * config.maxSteerAngleRad;
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

function averageTireResults(results = []) {
  const count = Math.max(1, results.length);
  const average = (field) => quantize(
    results.reduce((sum, result) => sum + Number(result[field] || 0), 0) / count
  );
  const latest = results.at(-1) || {};
  return {
    longitudinalForceN: average('longitudinalForceN'),
    lateralForceN: average('lateralForceN'),
    yawMomentNm: average('yawMomentNm'),
    worldForceN: clone(latest.worldForceN || {}),
    worldMomentNm: clone(latest.worldMomentNm || {}),
    suspensionForceWorldN: clone(latest.suspensionForceWorldN || {}),
    externalForceWorldN: clone(latest.externalForceWorldN || {}),
    externalMomentWorldNm: clone(latest.externalMomentWorldNm || {}),
    targetVelocityWorld: clone(latest.targetVelocityWorld || null),
    freeRevEngineRpm: latest.freeRevEngineRpm,
    verticalAccelerationMps2: average('verticalAccelerationMps2'),
    groundHeightM: latest.groundHeightM ?? null,
    grounded: results.some((result) => result.grounded !== false),
    wheelLoadsN: clone(latest.wheelLoadsN || {}),
    wheelSlip: clone(latest.wheelSlip || {}),
    suspensionTravel: clone(latest.suspensionTravel || {}),
    suspensionState: clone(latest.suspensionState || {}),
    tireForcesN: clone(latest.tireForcesN || {}),
    wheelAngularVelocityRadps: clone(latest.wheelAngularVelocityRadps || {}),
    contactPatches: clone(latest.contactPatches || {}),
    aeroState: clone(latest.aeroState || {})
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
    handlingAssist = null
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
    this.pendingCollisionImpulses = [];
    this.collisionTimeline = [];
    this.scheduledReplayCollisions = new Map();
    this.stepIndex = 0;
    this.observedTimeSeconds = 0;
    this.telemetry = [];
    this.diagnostics = {
      completedSteps: 0,
      completedTireSubsteps: 0,
      catchUpLimitedAdvances: 0,
      backlogSteps: 0,
      peakBacklogSteps: 0,
      droppedTimeSeconds: 0
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

  integrateChassis(controls, tires, dt) {
    const state = this.state;
    const config = this.config;
    const restSnapshot = {
      position: clone(state.position),
      velocity: clone(state.velocity),
      orientation: clone(state.orientation),
      angularVelocityWorld: clone(state.angularVelocityWorld)
    };
    let totalForce = addVector3(
      addVector3(tires.worldForceN, tires.suspensionForceWorldN),
      addVector3({ x: 0, y: -config.massKg * 9.81, z: 0 }, tires.externalForceWorldN)
    );
    if (tires.targetVelocityWorld) {
      const velocityError = addVector3(tires.targetVelocityWorld, scaleVector3(state.velocity, -1));
      const targetForceScale = config.massKg / Math.max(dt, EPSILON);
      totalForce.x = velocityError.x * targetForceScale;
      totalForce.z = velocityError.z * targetForceScale;
    }
    let totalMoment = addVector3(tires.worldMomentNm, tires.externalMomentWorldNm);
    const supportedLoadN = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
      sum + Math.max(0, Number(tires.wheelLoadsN?.[wheelId] || 0))
    ), 0);
    const supportScale = clamp(supportedLoadN / Math.max(1, config.massKg * 9.81), 0, 1);
    const restingContact = tires.grounded
      && this.pendingCollisionImpulses.length === 0
      && Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) < 0.02
      && Math.hypot(
        state.angularVelocityWorld.x,
        state.angularVelocityWorld.y,
        state.angularVelocityWorld.z
      ) < 0.02
      && Number(controls.throttle || 0) * (1 - Number(controls.clutch || 0)) < 0.001
      && Math.abs(supportedLoadN - config.massKg * 9.81) < config.massKg * 9.81 * 0.01;
    totalMoment.x += (
      -Number(state.pitchRad || 0) * config.pitchStiffnessNmPerRad
      - Number(state.angularVelocityWorld.x || 0) * config.pitchDampingNmsPerRad
    ) * supportScale;
    totalMoment.z += (
      -Number(state.rollRad || 0) * config.rollStiffnessNmPerRad
      - Number(state.angularVelocityWorld.z || 0) * config.rollDampingNmsPerRad
    ) * supportScale;
    const assistInterventions = this.handlingAssist.calculatePhysicalInterventions({
      preset: config.handlingPreset, state, controls, config, supportScale
    });
    assistInterventions.forEach((intervention) => {
      totalMoment = addVector3(totalMoment, intervention.momentWorldNm);
    });
    const collisionImpulses = this.pendingCollisionImpulses.splice(0);
    collisionImpulses.forEach(({ impulseWorldNs, pointWorld }) => {
      state.velocity = addVector3(state.velocity, scaleVector3(impulseWorldNs, 1 / config.massKg));
      const arm = addVector3(pointWorld, scaleVector3(state.position, -1));
      const angularImpulse = crossVector3(arm, impulseWorldNs);
      state.angularVelocityWorld.x += angularImpulse.x / config.pitchInertiaKgM2;
      state.angularVelocityWorld.y += angularImpulse.y / config.yawInertiaKgM2;
      state.angularVelocityWorld.z += angularImpulse.z / config.rollInertiaKgM2;
    });
    const acceleration = scaleVector3(totalForce, 1 / config.massKg);
    state.velocity = addVector3(state.velocity, scaleVector3(acceleration, dt));
    state.position = addVector3(state.position, scaleVector3(state.velocity, dt));
    let groundConstraintImpulseNs = 0;
    if (tires.grounded
      && Number.isFinite(Number(tires.groundHeightM))
      && Math.abs(Number(state.pitchRad || 0)) < 0.65
      && Math.abs(Number(state.rollRad || 0)) < 0.65) {
      const frontStaticCompressionM = clamp(
        (config.massKg * 9.81 * config.frontWeightDistribution / 2)
          / config.suspensionSpringRateFrontNpm,
        0,
        config.suspensionTravelFrontM
      );
      const rearStaticCompressionM = clamp(
        (config.massKg * 9.81 * (1 - config.frontWeightDistribution) / 2)
          / config.suspensionSpringRateRearNpm,
        0,
        config.suspensionTravelRearM
      );
      const maximumBumpM = Math.min(
        Math.max(0, config.suspensionTravelFrontM - frontStaticCompressionM),
        Math.max(0, config.suspensionTravelRearM - rearStaticCompressionM)
      );
      const minimumChassisHeightM = Number(tires.groundHeightM)
        + config.cgHeightM
        - maximumBumpM;
      if (state.position.y < minimumChassisHeightM) {
        state.position.y = minimumChassisHeightM;
        if (state.velocity.y < 0) {
          groundConstraintImpulseNs = -state.velocity.y * config.massKg;
          state.velocity.y = 0;
        }
      }
    }
    state.angularVelocityWorld.x += totalMoment.x / config.pitchInertiaKgM2 * dt;
    state.angularVelocityWorld.y += totalMoment.y / config.yawInertiaKgM2 * dt;
    state.angularVelocityWorld.z += totalMoment.z / config.rollInertiaKgM2 * dt;
    state.orientation = integrateQuaternion(state.orientation, state.angularVelocityWorld, dt);
    if (restingContact) {
      state.position = restSnapshot.position;
      state.velocity = restSnapshot.velocity;
      state.orientation = restSnapshot.orientation;
      state.angularVelocityWorld = restSnapshot.angularVelocityWorld;
    }
    const euler = eulerFromQuaternion(state.orientation);
    state.yawRad = quantize(normalizeAngle(euler.yaw));
    state.pitchRad = quantize(euler.pitch);
    state.rollRad = quantize(euler.roll);
    state.yawRateRadps = quantize(state.angularVelocityWorld.y);
    const forward = { x: Math.sin(state.yawRad), y: 0, z: Math.cos(state.yawRad) };
    state.speedMps = quantize(state.velocity.x * forward.x + state.velocity.z * forward.z);
    state.lateralAccelerationMps2 = quantize(acceleration.x * Math.cos(state.yawRad) - acceleration.z * Math.sin(state.yawRad));
    Object.keys(state.position).forEach((axis) => { state.position[axis] = quantize(state.position[axis]); });
    Object.keys(state.velocity).forEach((axis) => { state.velocity[axis] = quantize(state.velocity[axis]); });
    Object.keys(state.angularVelocityWorld).forEach((axis) => { state.angularVelocityWorld[axis] = quantize(state.angularVelocityWorld[axis]); });
    state.gear = controls.requestedGear;
    const powertrainTuning = config.powertrainTuning || {};
    const requestedGear = Math.trunc(Number(controls.requestedGear || 0));
    const selectedGearRatio = requestedGear < 0
      ? Math.abs(Number(powertrainTuning.reverseRatio || 0))
      : requestedGear > 0
        ? Math.abs(Number(powertrainTuning.gearRatios?.[requestedGear - 1] || 0))
        : 0;
    const finalDriveRatio = Math.abs(Number(
      powertrainTuning.gearFinalDrive || powertrainTuning.finalDrive || 1
    ));
    const overallDriveRatio = selectedGearRatio * finalDriveRatio;
    const drivenWheelOmegaRadps = config.drivenWheelIds.length
      ? config.drivenWheelIds.reduce((sum, wheelId) => (
        sum + Math.abs(Number(tires.wheelAngularVelocityRadps?.[wheelId] || 0))
      ), 0) / config.drivenWheelIds.length
      : 0;
    const mechanicallyCoupledRpm = overallDriveRatio > EPSILON
      ? drivenWheelOmegaRadps * overallDriveRatio * 60 / (Math.PI * 2)
      : config.idleRpm;
    const launchRpm = Math.max(config.idleRpm, Number(powertrainTuning.launchRpm) || config.idleRpm);
    const launchSlipScale = clamp(1 - Math.abs(state.speedMps) / 5, 0, 1);
    const launchRpmFloor = config.idleRpm
      + (launchRpm - config.idleRpm) * controls.throttle * launchSlipScale;
    const wheelCoupledRpm = clamp(
      Math.max(config.idleRpm, mechanicallyCoupledRpm, launchRpmFloor),
      config.idleRpm,
      config.maxRpm
    );
    let freeRpm = config.idleRpm + (config.maxRpm - config.idleRpm) * controls.throttle;
    const clutchCoupling = clamp(1 - Number(controls.clutch || 0), 0, 1);
    const freeRevActive = Boolean(tires.targetVelocityWorld) || clutchCoupling < 0.999;
    const limiterActive = freeRevActive
      && controls.throttle > 0.95
      && state.engineRpm >= config.maxRpm - config.revLimiterDropRpm * 0.35;
    if (limiterActive && Math.floor(this.stepIndex / 4) % 2 === 0) {
      freeRpm = config.maxRpm - config.revLimiterDropRpm;
    }
    const rpmTarget = tires.targetVelocityWorld
      ? freeRpm
      : wheelCoupledRpm * clutchCoupling + freeRpm * (1 - clutchCoupling);
    const rpmResponse = limiterActive ? 16 : freeRevActive ? 7.6 : 12;
    state.engineRpm = quantize(clamp(
      state.engineRpm + (rpmTarget - state.engineRpm) * Math.min(1, dt * rpmResponse),
      config.idleRpm,
      config.maxRpm
    ));
    state.grounded = tires.grounded;
    state.wheelLoadsN = clone(tires.wheelLoadsN);
    state.wheelSlip = clone(tires.wheelSlip);
    state.suspensionTravel = clone(tires.suspensionTravel);
    state.tireForcesN = clone(tires.tireForcesN);
    state.wheelAngularVelocityRadps = clone(tires.wheelAngularVelocityRadps);
    state.contactPatches = clone(tires.contactPatches);
    state.aeroState = clone(tires.aeroState || {});
    state.powertrainState = {
      engineRpm: state.engineRpm,
      gear: state.gear,
      revLimiterActive: limiterActive,
      clutchCoupling: quantize(clutchCoupling),
      freeRevActive
    };
    state.suspensionState = clone(tires.suspensionState);
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
        ...clone(patch),
        ...thermal,
        wear: quantize(clamp(Number(previous.wear || 0) + slipWorkJ * 1e-9, 0, 1)),
        damage: quantize(clamp(Number(previous.damage || 0), 0, 100))
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
      totalForceWorldN: totalForce,
      totalMomentWorldNm: totalMoment,
      supportScale: quantize(supportScale),
      groundConstraintImpulseNs: quantize(groundConstraintImpulseNs),
      assistInterventions,
      collisionImpulses
    };
  }

  runStep(legacySnapshot = null) {
    const nextStepIndex = this.stepIndex + 1;
    (this.scheduledReplayCollisions.get(nextStepIndex) || []).forEach((collision) => {
      this.queueCollisionImpulse(collision, { record: false, stepIndex: nextStepIndex });
    });
    const stepTimeSeconds = nextStepIndex / this.config.chassisHz;
    const controls = this.inputTimeline.sampleAt(stepTimeSeconds);
    const tireResults = [];
    let substepState = this.createStateSnapshot();
    for (let substepIndex = 0;
      substepIndex < this.config.tireSubstepsPerChassisStep;
      substepIndex += 1) {
      const substepTimeSeconds = (
        this.stepIndex * this.config.tireSubstepsPerChassisStep + substepIndex + 1
      ) / this.config.tireHz;
      const environment = this.environmentProvider({
        timeSeconds: substepTimeSeconds,
        stepIndex: nextStepIndex,
        substepIndex,
        state: clone(substepState),
        controls: clone(controls)
      }) || {};
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
      const tireResult = this.tireContactSubsystem.step({
        state: clone(substepState),
        controls: clone(controls),
        config: this.config,
        environment,
        dt: 1 / this.config.tireHz,
        stepIndex: nextStepIndex,
        substepIndex,
        timeSeconds: substepTimeSeconds
      });
      tireResult.externalForceWorldN = addVector3(
        clone(environment.externalForceWorldN || {}),
        aeroState.totalForceWorldN
      );
      tireResult.externalMomentWorldNm = addVector3(
        clone(environment.externalMomentWorldNm || {}),
        aeroState.totalMomentWorldNm
      );
      tireResult.aeroState = clone(aeroState);
      tireResult.targetVelocityWorld = clone(environment.targetVelocityWorld || null);
      tireResult.freeRevEngineRpm = environment.freeRevEngineRpm;
      tireResults.push(tireResult);
      substepState.wheelAngularVelocityRadps = clone(tireResult.wheelAngularVelocityRadps || substepState.wheelAngularVelocityRadps);
      substepState.suspensionState = clone(tireResult.suspensionState || substepState.suspensionState);
    }
    const tires = averageTireResults(tireResults);
    const integration = this.integrateChassis(controls, tires, 1 / this.config.chassisHz);
    this.stepIndex = nextStepIndex;
    this.diagnostics.completedSteps += 1;
    this.diagnostics.completedTireSubsteps += tireResults.length;
    const state = this.createStateSnapshot();
    const telemetry = {
      stepIndex: this.stepIndex,
      timeSeconds: this.simulationTimeSeconds,
      controls: clone(controls),
      subsystemOrder: [...VEHICLE_DYNAMICS_SUBSYSTEM_ORDER],
      tireSubstepCount: tireResults.length,
      state,
      forces: clone(integration),
      assistInterventions: clone(integration.assistInterventions),
      catchUp: {
        maxCatchUpSteps: this.config.maxCatchUpSteps,
        completedSteps: this.diagnostics.completedSteps,
        completedTireSubsteps: this.diagnostics.completedTireSubsteps,
        droppedTimeSeconds: this.diagnostics.droppedTimeSeconds
      },
      legacyDifference: compareVehicleStates(legacySnapshot, state)
    };
    this.telemetry.push(telemetry);
    if (this.telemetry.length > this.config.telemetryLimit) {
      this.telemetry.splice(0, this.telemetry.length - this.config.telemetryLimit);
    }
    return telemetry;
  }

  advance(deltaSeconds = 0, {
    input = null,
    inputTimeSeconds = null,
    legacySnapshot = null,
    onFixedStep = null
  } = {}) {
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
      if (typeof onFixedStep === 'function') onFixedStep(telemetry);
    }
    const backlogSteps = Math.max(0, targetStepIndex - this.stepIndex);
    this.diagnostics.backlogSteps = backlogSteps;
    this.diagnostics.peakBacklogSteps = Math.max(
      this.diagnostics.peakBacklogSteps,
      backlogSteps
    );
    if (backlogSteps > 0) this.diagnostics.catchUpLimitedAdvances += 1;
    return {
      completedSteps,
      completedTireSubsteps: completedSteps * this.config.tireSubstepsPerChassisStep,
      stepIndex: this.stepIndex,
      simulationTimeSeconds: this.simulationTimeSeconds,
      observedTimeSeconds: this.observedTimeSeconds,
      backlogSteps,
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
      diagnostics: clone(this.diagnostics),
      pendingCollisionImpulses: clone(this.pendingCollisionImpulses),
      collisionTimeline: clone(this.collisionTimeline)
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
    this.diagnostics = clone(snapshot.diagnostics || this.diagnostics);
    this.pendingCollisionImpulses = clone(snapshot.pendingCollisionImpulses || []);
    this.collisionTimeline = clone(snapshot.collisionTimeline || []);
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
    return runner;
  }
}
