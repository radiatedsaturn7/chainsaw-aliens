import { createHash } from 'node:crypto';

import RaceEditor from '../../src/ui/RaceEditor.js';
import {
  TRACE_ENVELOPE_TOLERANCES,
  resolveVehicleAcceptanceTargets,
  VEHICLE_TRACE_FIELDS,
  VEHICLE_VALIDATION_CASES,
  VEHICLE_VALIDATION_VERSION,
  VEHICLE_VALIDATION_VEHICLES
} from './validationCatalog.mjs';

const MPH_TO_MPS = 0.44704;
const M_TO_FT = 3.280839895;
const WHEELS = ['fl', 'fr', 'rl', 'rr'];
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const CASE_DURATION_SECONDS = Object.freeze({
  'zero-to-30': 8, 'zero-to-60': 12, 'quarter-mile': 18, 'top-speed': 45,
  'coast-down-100-60': 20, 'braking-70-0': 8, 'constant-radius-skidpad': 8,
  'step-steer': 5, 'understeer-gradient': 10, slalom: 8,
  'emergency-lane-change': 7, 'lift-throttle': 7, 'split-friction-braking': 8,
  'standing-wet-launch': 8, 'curb-traversal': 6, 'high-speed-bank-transition': 7
});

function configureValidationTrack(editor, caseName, trackLengthM = 3000) {
  const banked = caseName === 'high-speed-bank-transition';
  const curb = caseName === 'curb-traversal';
  editor.selectedRace.type = 'destination';
  editor.selectedRace.laps = 1;
  editor.selectedRace.hazards = [];
  editor.selectedRace.weather = caseName === 'standing-wet-launch' ? 'rain' : 'clear';
  editor.selectedRace.road.width = 11;
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: trackLengthM, elevation: banked ? 0.08 : 0, role: 'finish' }
  ];
  editor.selectedRace.road.segments = [
    {
      length: trackLengthM, curve: banked ? 0.12 : 0, elevation: banked ? 0.08 : 0,
      banking: banked ? 0.32 : 0, surface: 'asphalt', turn: 'smooth', hazardIds: []
    }
  ];
  if (curb) {
    editor.selectedRace.margin = {
      ...(editor.selectedRace.margin || {}), enabled: true, marginMode: 'on',
      widthM: 0.22, collisionEdge: 'none', collisionEffect: 'collide'
    };
  }
}

function controlForCase(caseName, time, aidsEnabled) {
  let throttle = 0;
  let brake = 0;
  let steering = 0;
  if (['zero-to-30', 'zero-to-60', 'quarter-mile', 'top-speed', 'standing-wet-launch']
    .includes(caseName)) throttle = 1;
  if (caseName === 'constant-radius-skidpad') { throttle = 0.35; steering = 0.42; }
  if (caseName === 'step-steer') { throttle = 0.18; steering = time >= 1 ? 0.55 : 0; }
  if (caseName === 'understeer-gradient') { throttle = 0.25; steering = Math.min(0.7, time / 10 * 0.7); }
  if (caseName === 'slalom') { throttle = 0.3; steering = Math.sin(time * Math.PI * 1.2) * 0.55; }
  if (caseName === 'emergency-lane-change') {
    throttle = 0.15;
    steering = time < 1 ? 0 : time < 2 ? 0.72 : time < 3 ? -0.72 : time < 4 ? 0.35 : 0;
  }
  if (caseName === 'lift-throttle') { throttle = time < 3 ? 0.45 : 0; steering = 0.42; }
  if (['braking-70-0', 'split-friction-braking'].includes(caseName)) brake = time >= 0.5 ? 1 : 0;
  if (caseName === 'curb-traversal') { throttle = 0.25; steering = time < 2 ? 0.2 : -0.1; }
  if (caseName === 'high-speed-bank-transition') { throttle = 0.35; steering = 0.18; }
  return {
    throttle, brake, steering,
    assists: {
      absEnabled: aidsEnabled,
      tractionControlEnabled: aidsEnabled,
      stabilityControlEnabled: aidsEnabled,
      autoShift: false
    }
  };
}

function initialSpeedMps(caseName) {
  if (caseName === 'coast-down-100-60') return 100 * MPH_TO_MPS;
  if (caseName === 'braking-70-0' || caseName === 'split-friction-braking') return 70 * MPH_TO_MPS;
  if (['constant-radius-skidpad', 'step-steer', 'understeer-gradient', 'slalom',
    'emergency-lane-change', 'lift-throttle'].includes(caseName)) return 18;
  if (caseName === 'curb-traversal') return 14;
  if (caseName === 'high-speed-bank-transition') return 32;
  return 0;
}

function traceSample(runner, controls, timeSeconds) {
  const patches = runner.state.contactPatches || {};
  return {
    timeSeconds: Number(timeSeconds.toFixed(6)),
    speedMps: finite(runner.state.groundSpeedMps),
    engineRpm: finite(runner.state.engineRpm),
    gear: finite(runner.state.gear),
    longitudinalAccelerationMps2: finite(runner.state.longitudinalAccelerationMps2),
    lateralAccelerationMps2: finite(runner.state.lateralAccelerationMps2),
    yawRateRadps: finite(runner.state.yawRateRadps),
    bodySlipRad: Math.atan2(finite(runner.state.bodyLateralSpeedMps),
      Math.max(0.01, Math.abs(finite(runner.state.bodyLongitudinalSpeedMps)))),
    steeringAngleRad: finite(patches.fl?.physicalSteeringAngleRad),
    wheelLoadsN: Object.fromEntries(WHEELS.map((wheel) => [wheel, finite(runner.state.wheelLoadsN?.[wheel])])),
    slipRatioByWheel: Object.fromEntries(WHEELS.map((wheel) => [wheel, finite(patches[wheel]?.rawSlipRatio)])),
    slipAngleByWheel: Object.fromEntries(WHEELS.map((wheel) => [wheel, finite(patches[wheel]?.rawSlipAngleRad)])),
    suspensionCompressionM: Object.fromEntries(WHEELS.map((wheel) => [wheel, finite(runner.state.suspensionState?.[wheel]?.compressionM)])),
    brakePressure: finite(controls.brake),
    tireTemperatureC: Object.fromEntries(WHEELS.map((wheel) => [wheel, finite(runner.state.tireState?.[wheel]?.treadTemperatureC)])),
    tirePressurePsi: Object.fromEntries(WHEELS.map((wheel) => [wheel, finite(runner.state.tireState?.[wheel]?.pressurePsi)]))
  };
}

function metricStatus(value, acceptance) {
  if (!acceptance || !Number.isFinite(value)) return { status: 'baseline-only', acceptance };
  return { status: value >= acceptance.range[0] && value <= acceptance.range[1] ? 'pass' : 'fail', acceptance };
}

export class VehicleValidationHarness {
  constructor({ renderFps = 60, traceHz = 20, maximumDurationSeconds = Infinity,
    trackLengthM = 3000 } = {}) {
    this.renderFps = renderFps;
    this.traceHz = traceHz;
    this.maximumDurationSeconds = maximumDurationSeconds;
    this.trackLengthM = trackLengthM;
  }

  async runCase({ vehicleKey, caseName, aidsEnabled = true } = {}) {
    const vehicle = VEHICLE_VALIDATION_VEHICLES[vehicleKey];
    if (!vehicle) throw new Error(`Unknown validation vehicle ${vehicleKey}`);
    if (!VEHICLE_VALIDATION_CASES.includes(caseName)) throw new Error(`Unknown validation case ${caseName}`);
    const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
    configureValidationTrack(editor, caseName, this.trackLengthM);
    const car = editor.project.cars.find((candidate) => candidate.id === vehicle.carId);
    if (!car) throw new Error(`Missing production car ${vehicle.carId}`);
    editor.raceInput.transmissionMode = vehicle.transmission;
    editor.project.selectedCarId = car.id;
    editor.startPlaytest(car.id, { hydrateCars: false });
    const session = editor.playtestSession;
    session.countdownRemainingMs = 0;
    session.startupFramePending = false;
    session.launchLockMs = 0;
    editor.updatePlaytestSafely(0);
    const runner = session.vehicleDynamicsRunner;
    const startSpeed = initialSpeedMps(caseName);
    if (startSpeed > 0) {
      const state = runner.createStateSnapshot();
      const yaw = finite(state.yawRad);
      runner.replaceAuthoritativeState({
        ...state,
        velocity: { x: Math.sin(yaw) * startSpeed, y: 0, z: Math.cos(yaw) * startSpeed },
        speedMps: startSpeed, groundSpeedMps: startSpeed,
        bodyLongitudinalSpeedMps: startSpeed, signedTravelSpeedMps: startSpeed,
        gear: Math.max(1, Math.min(6, Math.ceil(startSpeed / 10)))
      });
    }
    const start = { ...runner.state.position };
    const trace = [];
    const dt = 1 / this.renderFps;
    const traceEvery = Math.max(1, Math.round(this.renderFps / this.traceHz));
    const duration = Math.min(CASE_DURATION_SECONDS[caseName], this.maximumDurationSeconds);
    let zeroTo30Sec = null;
    let zeroTo60Sec = null;
    let quarterMileSec = null;
    let quarterMileTrapMph = null;
    let brakingDistanceM = null;
    let coastDownSec = null;
    let maximumSpeedMps = startSpeed;
    let maximumLateralG = 0;
    let stopPosition = null;
    for (let frame = 0; frame < Math.ceil(duration * this.renderFps); frame += 1) {
      const time = frame * dt;
      const controls = controlForCase(caseName, time, aidsEnabled);
      const rpm = finite(runner.state.engineRpm);
      if (vehicle.transmission === 'manual' && controls.throttle > 0
        && rpm > finite(runner.config.redlineRpm || 6500) * 0.96) {
        editor.raceInput.gear = Math.min(6, finite(editor.raceInput.gear || 1) + 1);
      }
      Object.assign(editor.raceInput, {
        rawThrottleAxis: controls.throttle, throttleAxis: controls.throttle,
        analogThrottleActive: controls.throttle > 0, rawBrakeAxis: controls.brake,
        brakeAxis: controls.brake, steeringWheel: controls.steering,
        autoShift: vehicle.transmission === 'automatic',
        absEnabled: aidsEnabled, tractionControlEnabled: aidsEnabled,
        stabilityControlEnabled: aidsEnabled
      });
      if (caseName === 'split-friction-braking') {
        session.trackStateByWheel = { fl: { gripScale: 0.35 }, rl: { gripScale: 0.35 } };
      }
      if (!editor.updatePlaytestSafely(dt)) throw new Error(`${vehicleKey}/${caseName} left playtest`);
      const speed = finite(runner.state.groundSpeedMps);
      maximumSpeedMps = Math.max(maximumSpeedMps, speed);
      maximumLateralG = Math.max(maximumLateralG,
        Math.abs(finite(runner.state.lateralAccelerationMps2)) / 9.80665);
      const elapsed = time + dt;
      if (zeroTo30Sec === null && speed >= 30 * MPH_TO_MPS) zeroTo30Sec = elapsed;
      if (zeroTo60Sec === null && speed >= 60 * MPH_TO_MPS) zeroTo60Sec = elapsed;
      const distance = Math.hypot(
        finite(runner.state.position.x) - finite(start.x),
        finite(runner.state.position.z) - finite(start.z)
      );
      if (quarterMileSec === null && distance >= 402.336) {
        quarterMileSec = elapsed;
        quarterMileTrapMph = speed / MPH_TO_MPS;
      }
      if (caseName === 'coast-down-100-60' && coastDownSec === null && speed <= 60 * MPH_TO_MPS) {
        coastDownSec = elapsed;
      }
      if (caseName === 'braking-70-0' && brakingDistanceM === null && speed <= 0.5) {
        stopPosition = { ...runner.state.position };
        brakingDistanceM = Math.hypot(
          finite(stopPosition.x) - finite(start.x), finite(stopPosition.z) - finite(start.z)
        );
      }
      if (frame % traceEvery === 0) trace.push(traceSample(runner, controls, elapsed));
    }
    const targets = resolveVehicleAcceptanceTargets(vehicle.carId, vehicle.transmission);
    const values = {
      zeroTo30Sec,
      zeroTo60Sec,
      quarterMileSec,
      quarterMileTrapMph,
      topSpeedMph: maximumSpeedMps / MPH_TO_MPS,
      coastDown100To60Sec: coastDownSec,
      braking70To0Ft: brakingDistanceM === null ? null : brakingDistanceM * M_TO_FT,
      skidpadLateralG: maximumLateralG
    };
    const acceptanceByMetric = caseName === 'zero-to-60' ? { zeroTo60Sec: targets.zeroTo60Sec }
      : caseName === 'quarter-mile' ? {
        quarterMileSec: targets.quarterMileSec,
        quarterMileTrapMph: targets.quarterMileTrapMph
      }
        : caseName === 'top-speed' ? { topSpeedMph: targets.topSpeedMph }
          : caseName === 'braking-70-0' ? { braking70To0Ft: targets.braking70To0Ft }
            : caseName === 'constant-radius-skidpad' ? { skidpadLateralG: targets.lateralG }
              : {};
    const checks = Object.fromEntries(Object.entries(values).map(([name, value]) => [
      name, metricStatus(value, acceptanceByMetric[name])
    ]));
    return {
      calibrationVersion: VEHICLE_VALIDATION_VERSION,
      vehicleKey, vehicle, caseName, aidsEnabled,
      authority: 'RaceEditor/RaceSimulation/VehicleDynamicsRunner',
      productionPaths: ['PhysicsTerrainQueryFrame', 'ContactPatchTireModel', 'powertrain', 'compound-body-collision'],
      values, checks, traceFields: VEHICLE_TRACE_FIELDS, traceTolerance: TRACE_ENVELOPE_TOLERANCES,
      traceChecksum: hash(trace), trace,
      determinismChecksum: hash(runner.createStateSnapshot()),
      recoveryCount: runner.penetrationRecoveryState.history.length,
      backlogSteps: runner.diagnostics.backlogSteps
    };
  }
}

export default VehicleValidationHarness;
