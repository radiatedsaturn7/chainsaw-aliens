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
const TWO_PI = Math.PI * 2;
const WHEELS = Object.freeze(['fl', 'fr', 'rl', 'rr']);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const CASE_DURATION_SECONDS = Object.freeze({
  'zero-to-30': 8, 'zero-to-60': 12, 'quarter-mile': 18, 'top-speed': 90,
  'coast-down-100-60': 20, 'braking-70-0': 8, 'constant-radius-skidpad': 8,
  'step-steer': 5, 'understeer-gradient': 10, slalom: 8,
  'emergency-lane-change': 7, 'lift-throttle': 7, 'split-friction-braking': 8,
  'standing-wet-launch': 8, 'curb-traversal': 6, 'high-speed-bank-transition': 7
});

const REQUIRED_METRICS_BY_CASE = Object.freeze({
  'zero-to-30': ['zeroTo30Sec'],
  'zero-to-60': ['zeroTo60Sec'],
  'quarter-mile': ['quarterMileSec', 'quarterMileTrapMph'],
  'top-speed': ['topSpeedMph'],
  'coast-down-100-60': ['coastDown100To60Sec'],
  'braking-70-0': ['braking70To0Ft'],
  'constant-radius-skidpad': ['skidpadLateralG']
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
  editor.selectedRace.road.segments = [{
    length: trackLengthM, curve: banked ? 0.12 : 0, elevation: banked ? 0.08 : 0,
    banking: banked ? 0.32 : 0, surface: 'asphalt', turn: 'smooth', hazardIds: []
  }];
  if (curb) {
    editor.selectedRace.margin = {
      ...(editor.selectedRace.margin || {}), enabled: true, marginMode: 'on',
      widthM: 0.22, collisionEdge: 'none', collisionEffect: 'collide'
    };
  }
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

function chooseRoadSpeedGear(tuning, wheelOmegaRadps) {
  const ratios = Array.isArray(tuning.gearRatios) && tuning.gearRatios.length
    ? tuning.gearRatios : [1];
  const finalDrive = Math.max(0.1, Math.abs(finite(tuning.gearFinalDrive ?? tuning.finalDrive, 1)));
  const idleRpm = Math.max(500, finite(tuning.idleRpm, 800));
  const redlineRpm = Math.max(idleRpm + 500, finite(tuning.revLimitRpm ?? tuning.redlineRpm, 7000));
  let selected = ratios.length;
  for (let index = 0; index < ratios.length; index += 1) {
    const rpm = Math.abs(wheelOmegaRadps) * Math.abs(finite(ratios[index], 1))
      * finalDrive * 60 / TWO_PI;
    if (rpm >= idleRpm * 1.15 && rpm <= redlineRpm * 0.72) {
      selected = index + 1;
      break;
    }
  }
  const overallRatio = Math.abs(finite(ratios[selected - 1], 1)) * finalDrive;
  return {
    gear: selected,
    overallRatio,
    engineRpm: Math.max(idleRpm, Math.abs(wheelOmegaRadps) * overallRatio * 60 / TWO_PI)
  };
}

function wheelMap(factory) {
  return Object.fromEntries(WHEELS.map((wheelId) => [wheelId, factory(wheelId)]));
}

/**
 * Installs a complete validation starting state through the same static reset
 * and authoritative replacement boundaries used by runtime recovery. The
 * settled contact state and moving powertrain state are committed as one reset
 * generation; no dynamic solver step can observe a half-initialized vehicle.
 */
export function installVehicleValidationInitialState({ runner, tuning, speedMps = 0 } = {}) {
  if (!runner || !tuning) throw new Error('Validation initial state requires runner and tuning');
  const before = runner.createStateSnapshot();
  const reset = runner.resetAuthoritativeState(before, {
    reason: 'vehicle-validation-initial-state', record: false,
    rebuildContacts: true, parkUntilDrive: false
  });
  const settled = reset.state;
  const radiusSamples = WHEELS.map((wheelId) => {
    const deflectionM = Math.max(0, finite(settled.contactPatches?.[wheelId]?.verticalDeflectionM));
    return Math.max(0.1, finite(runner.config.wheelRadiusM, 0.33) - deflectionM);
  });
  const effectiveRollingRadiusM = radiusSamples.reduce((sum, value) => sum + value, 0)
    / radiusSamples.length;
  const wheelOmegaRadps = speedMps / effectiveRollingRadiusM;
  const selected = speedMps > 0
    ? chooseRoadSpeedGear(tuning, wheelOmegaRadps)
    : { gear: 1, overallRatio: Math.abs(finite(tuning.gearRatios?.[0], 1)
      * finite(tuning.gearFinalDrive ?? tuning.finalDrive, 1)), engineRpm: finite(tuning.idleRpm, 800) };
  const yaw = finite(settled.yawRad);
  const velocity = { x: Math.sin(yaw) * speedMps, y: 0, z: Math.cos(yaw) * speedMps };
  const shaftOutputRadps = wheelOmegaRadps * Math.max(0.1,
    Math.abs(finite(tuning.gearFinalDrive ?? tuning.finalDrive, 1)));
  const powertrainState = {
    ...(settled.powertrainState || {}),
    engineRpm: selected.engineRpm,
    gear: selected.gear,
    targetGear: selected.gear,
    requestedGear: selected.gear,
    inputShaftSpeedRadps: selected.engineRpm * TWO_PI / 60,
    outputShaftSpeedRadps: shaftOutputRadps,
    differentialSpeedRadps: wheelOmegaRadps,
    shiftTimeRemainingSeconds: 0,
    shiftRecoveryTimeRemainingSeconds: 0,
    shiftTorqueScale: 1,
    clutchCoupling: 1,
    rpmCoupling: 1,
    torqueConverterState: finite(tuning.torqueConverterSlip) > 0 ? 'coupled' : 'not-equipped',
    differentialState: 'road-speed-synchronized'
  };
  const tireState = wheelMap((wheelId) => {
    const previous = settled.tireState?.[wheelId] || {};
    return {
      ...previous,
      treadTemperatureC: finite(previous.treadTemperatureC, 20),
      carcassTemperatureC: finite(previous.carcassTemperatureC, 20),
      effectivePressurePsi: finite(previous.effectivePressurePsi ?? previous.pressurePsi, 32)
    };
  });
  const installed = runner.replaceAuthoritativeState({
    ...settled,
    velocity,
    angularVelocityWorld: { x: 0, y: 0, z: 0 },
    speedMps,
    groundSpeedMps: speedMps,
    bodyLongitudinalSpeedMps: speedMps,
    bodyLateralSpeedMps: 0,
    signedTravelSpeedMps: speedMps,
    yawRateRadps: 0,
    engineRpm: selected.engineRpm,
    gear: selected.gear,
    wheelAngularVelocityRadps: wheelMap(() => wheelOmegaRadps),
    wheelSlip: wheelMap(() => 0),
    powertrainState,
    tireState,
    vehicleResetGeneration: reset.resetGeneration
  });
  runner.inputTimeline.discardAtOrAfter(runner.simulationTimeSeconds);
  runner.addInputSample(runner.simulationTimeSeconds, {
    requestedGear: selected.gear,
    assists: { autoShift: false }
  }, { returnSnapshot: false });
  const maximumInitialSlipRatio = Math.max(...WHEELS.map((wheelId) => Math.abs(finite(
    installed.contactPatches?.[wheelId]?.rawSlipRatio ?? installed.wheelSlip?.[wheelId]
  ))));
  const generations = new Set([
    installed.vehicleResetGeneration,
    ...WHEELS.map(() => installed.vehicleResetGeneration)
  ]);
  const validation = {
    maximumInitialSlipRatio,
    noPendingShift: powertrainState.shiftTimeRemainingSeconds === 0
      && powertrainState.targetGear === selected.gear,
    noCollisionOrRecovery: runner.pendingCollisionImpulses.length === 0
      && runner.penetrationRecoveryState.currentIncident === null,
    noGrowingBacklog: runner.diagnostics.backlogSteps === 0,
    coherentGeneration: generations.size === 1,
    effectiveRollingRadiusM,
    gear: selected.gear,
    engineRpm: selected.engineRpm
  };
  if (maximumInitialSlipRatio >= 0.03 || !validation.noPendingShift
    || !validation.noCollisionOrRecovery || !validation.noGrowingBacklog
    || !validation.coherentGeneration) {
    throw new Error(`Incoherent vehicle validation initial state: ${JSON.stringify(validation)}`);
  }
  return { state: installed, reset, validation };
}

export class ManualShiftDriver {
  constructor({ initialGear = 1, redlineRpm = 7000 } = {}) {
    this.requestedGear = initialGear;
    this.redlineRpm = redlineRpm;
    this.armed = true;
    this.pending = null;
    this.events = [];
  }

  update(state, timeSeconds, throttle) {
    const powertrain = state.powertrainState || {};
    const actualGear = Math.trunc(finite(powertrain.gear ?? state.gear, this.requestedGear));
    const targetGear = Math.trunc(finite(powertrain.targetGear, actualGear));
    const shifting = finite(powertrain.shiftTimeRemainingSeconds) > 0 || targetGear !== actualGear;
    if (this.pending && !shifting && actualGear === this.pending.to) {
      this.pending.completedAtSeconds = timeSeconds;
      this.pending.durationSeconds = timeSeconds - this.pending.requestedAtSeconds;
      this.events.push(this.pending);
      this.pending = null;
    }
    const rpm = finite(powertrain.engineRpm ?? state.engineRpm);
    if (!this.armed && rpm < this.redlineRpm * 0.86) this.armed = true;
    if (!this.pending && !shifting && this.armed && throttle > 0.05
      && rpm >= this.redlineRpm * 0.94) {
      this.requestedGear = actualGear + 1;
      this.pending = {
        from: actualGear, to: this.requestedGear, requestedAtSeconds: timeSeconds,
        clutchCouplingAtRequest: finite(powertrain.clutchCoupling, 1),
        torqueCutAtRequest: 1 - finite(powertrain.shiftTorqueScale, 1)
      };
      this.armed = false;
    }
    return this.requestedGear;
  }
}

function controlsForCase(caseName, maneuverTime, aidsEnabled, context = {}) {
  let throttle = 0;
  let brake = 0;
  let steering = 0;
  if (['zero-to-30', 'zero-to-60', 'quarter-mile', 'top-speed', 'standing-wet-launch']
    .includes(caseName)) throttle = 1;
  if (caseName === 'constant-radius-skidpad') {
    throttle = 0.35;
    const position = context.state?.position || {};
    const centreX = 30;
    const radiusM = 30;
    const dx = finite(position.x) - centreX;
    const dz = finite(position.z);
    const radiusError = Math.hypot(dx, dz) - radiusM;
    const desiredYaw = Math.atan2(-dz, dx) + Math.PI / 2;
    const yawError = Math.atan2(Math.sin(desiredYaw - finite(context.state?.yawRad)),
      Math.cos(desiredYaw - finite(context.state?.yawRad)));
    steering = Math.max(-0.8, Math.min(0.8, 0.34 + radiusError * 0.025 + yawError * 0.18));
  }
  if (caseName === 'step-steer') { throttle = 0.18; steering = maneuverTime >= 1 ? 0.55 : 0; }
  if (caseName === 'understeer-gradient') { throttle = 0.25; steering = Math.min(0.7, maneuverTime / 10 * 0.7); }
  if (caseName === 'slalom') { throttle = 0.3; steering = Math.sin(maneuverTime * Math.PI * 1.2) * 0.55; }
  if (caseName === 'emergency-lane-change') {
    throttle = 0.15;
    steering = maneuverTime < 1 ? 0 : maneuverTime < 2 ? 0.72
      : maneuverTime < 3 ? -0.72 : maneuverTime < 4 ? 0.35 : 0;
  }
  if (caseName === 'lift-throttle') { throttle = maneuverTime < 3 ? 0.45 : 0; steering = 0.42; }
  if (['braking-70-0', 'split-friction-braking'].includes(caseName)) brake = 1;
  if (caseName === 'curb-traversal') { throttle = 0.25; steering = maneuverTime < 2 ? 0.2 : -0.1; }
  if (caseName === 'high-speed-bank-transition') { throttle = 0.35; steering = 0.18; }
  return { throttle, brake, steering, aidsEnabled };
}

function installProductionControls(editor, controls, requestedGear, automatic) {
  Object.assign(editor.raceInput, {
    rawThrottleAxis: controls.throttle,
    throttleAxis: controls.throttle,
    analogThrottleActive: controls.throttle > 0,
    rawBrakeAxis: controls.brake,
    brakeAxis: controls.brake,
    analogBrakeActive: controls.brake > 0,
    analogSteeringActive: Math.abs(controls.steering) > 1e-6,
    analogSteeringIntent: controls.steering,
    syntheticAnalogSteering: true,
    steeringTarget: controls.steering,
    lastSteeringInputMode: Math.abs(controls.steering) > 1e-6 ? 'analog' : null,
    controllerSteeringMode: 'gamepad',
    gear: requestedGear,
    autoShift: automatic,
    absEnabled: controls.aidsEnabled,
    tractionControlEnabled: controls.aidsEnabled,
    stabilityControlEnabled: controls.aidsEnabled
  });
  editor.playtestSession.absEnabled = controls.aidsEnabled;
  editor.playtestSession.tractionControlEnabled = controls.aidsEnabled;
  editor.playtestSession.stabilityControlEnabled = controls.aidsEnabled;
  editor.playtestSession.stabilityControlExplicitlyEnabled = controls.aidsEnabled;
}

function deriveAccelerations(state, previousState, dt) {
  if (!previousState || dt <= 0) return { longitudinal: 0, lateral: 0 };
  const yaw = finite(state.yawRad);
  const dvx = (finite(state.velocity?.x) - finite(previousState.velocity?.x)) / dt;
  const dvz = (finite(state.velocity?.z) - finite(previousState.velocity?.z)) / dt;
  return {
    longitudinal: dvx * Math.sin(yaw) + dvz * Math.cos(yaw),
    lateral: dvx * Math.cos(yaw) - dvz * Math.sin(yaw)
  };
}

function traceSample(runner, controls, timeSeconds, phase, previousState, sampleDt) {
  const state = runner.state;
  const patches = state.contactPatches || {};
  const powertrain = state.powertrainState || {};
  const accelerations = deriveAccelerations(state, previousState, sampleDt);
  const assistTelemetry = powertrain.telemetry || {};
  const authoritativeControls = runner.inputTimeline.sampleAt(runner.simulationTimeSeconds);
  return {
    timeSeconds: Number(timeSeconds.toFixed(6)),
    phase,
    speedMps: finite(state.groundSpeedMps),
    engineRpm: finite(powertrain.engineRpm ?? state.engineRpm),
    gear: finite(powertrain.gear ?? state.gear),
    requestedGear: finite(controls.requestedGear),
    shiftState: {
      targetGear: finite(powertrain.targetGear ?? state.gear),
      shiftTimeRemainingSeconds: finite(powertrain.shiftTimeRemainingSeconds),
      clutchCoupling: finite(powertrain.clutchCoupling, 1),
      torqueCut: 1 - finite(powertrain.shiftTorqueScale, 1)
    },
    longitudinalAccelerationMps2: accelerations.longitudinal,
    lateralAccelerationMps2: accelerations.lateral,
    yawRateRadps: finite(state.angularVelocityWorld?.y ?? state.yawRateRadps),
    bodySlipRad: Math.atan2(finite(state.bodyLateralSpeedMps),
      Math.max(0.01, Math.abs(finite(state.bodyLongitudinalSpeedMps)))),
    steeringAngleRad: finite(patches.fl?.steeringAngleRad),
    physicalRackAngleRad: finite((finite(patches.fl?.steeringAngleRad)
      + finite(patches.fr?.steeringAngleRad)) * 0.5),
    wheelSteeringAnglesRad: wheelMap((wheelId) => finite(patches[wheelId]?.steeringAngleRad)),
    assistState: {
      configured: controls.aidsEnabled,
      authoritative: {
        absEnabled: authoritativeControls.assists?.absEnabled === true,
        tractionControlEnabled: authoritativeControls.assists?.tractionControlEnabled === true,
        stabilityControlEnabled: authoritativeControls.assists?.stabilityControlEnabled === true
      },
      tractionControlActive: assistTelemetry.tractionControlActive === true,
      tractionTorqueScale: finite(assistTelemetry.tractionTorqueScale, 1),
      absInterventionByWheel: wheelMap((wheelId) => finite(
        assistTelemetry.absInterventionByWheel?.[wheelId]
      )),
      stabilityClassification: assistTelemetry.stabilityClassification || 'inactive'
    },
    wheelLoadsN: wheelMap((wheelId) => finite(state.wheelLoadsN?.[wheelId])),
    slipRatioByWheel: wheelMap((wheelId) => finite(patches[wheelId]?.rawSlipRatio)),
    slipAngleByWheel: wheelMap((wheelId) => finite(patches[wheelId]?.rawSlipAngleRad)),
    suspensionCompressionM: wheelMap((wheelId) => finite(state.suspensionState?.[wheelId]?.compressionM)),
    brakePressure: finite(controls.brake),
    tireTemperatureC: wheelMap((wheelId) => finite(state.tireState?.[wheelId]?.treadTemperatureC)),
    tirePressurePsi: wheelMap((wheelId) => finite(state.tireState?.[wheelId]?.effectivePressurePsi, NaN))
  };
}

function metricStatus(value, acceptance, { required = false } = {}) {
  if (!Number.isFinite(value)) return { status: required ? 'fail' : 'non-blocking', acceptance };
  if (!acceptance) return { status: required ? 'pass' : 'non-blocking', acceptance };
  return { status: value >= acceptance.range[0] && value <= acceptance.range[1] ? 'pass' : 'fail', acceptance };
}

export class VehicleValidationHarness {
  constructor({ renderFps = 60, traceHz = 20, maximumDurationSeconds = Infinity,
    trackLengthM = 3000, settleSeconds = 0.25 } = {}) {
    this.renderFps = renderFps;
    this.traceHz = traceHz;
    this.maximumDurationSeconds = maximumDurationSeconds;
    this.trackLengthM = trackLengthM;
    this.settleSeconds = settleSeconds;
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
    const tuning = editor.getRaceCarTuning(car, { transmissionType: vehicle.transmission });
    const initialization = installVehicleValidationInitialState({
      runner, tuning, speedMps: initialSpeedMps(caseName)
    });
    Object.assign(session, {
      speedMps: initialSpeedMps(caseName),
      groundSpeedMps: initialSpeedMps(caseName),
      worldX: initialization.state.position.x,
      worldZ: initialization.state.position.z,
      bodyY: initialization.state.position.y,
      carYaw: initialization.state.yawRad,
      velocityYaw: initialization.state.yawRad
    });
    editor.raceInput.gear = initialization.validation.gear;
    session.gear = initialization.validation.gear;
    const manualShift = new ManualShiftDriver({
      initialGear: initialization.validation.gear,
      redlineRpm: finite(tuning.revLimitRpm ?? tuning.redlineRpm, 7000)
    });
    // A render observation normally delivers its input at the end of the
    // render interval. Seed the validation timeline at the exact maneuver
    // boundary as the gamepad sampler would, so 30/60/144 FPS partitions do
    // not move the first physical command by one render frame.
    if (initialSpeedMps(caseName) === 0) {
      const boundaryControls = controlsForCase(caseName, 0, aidsEnabled, { state: runner.state });
      installProductionControls(editor, boundaryControls, initialization.validation.gear,
        vehicle.transmission === 'automatic');
      runner.addInputSample(runner.simulationTimeSeconds, {
        steering: 0, driverSteeringIntent: 0, steeringTarget: 0,
        controllerFilterOutput: 0, centerSteeringAngleRad: 0,
        steeringInputMode: 'gamepad',
        throttle: boundaryControls.throttle, brake: boundaryControls.brake,
        clutch: 0, handbrake: 0,
        requestedGear: initialization.validation.gear,
        assists: {
          absEnabled: aidsEnabled, tractionControlEnabled: aidsEnabled,
          stabilityControlEnabled: aidsEnabled,
          autoShift: vehicle.transmission === 'automatic'
        }
      }, { returnSnapshot: false });
    }
    const trace = [];
    const dt = 1 / this.renderFps;
    const traceEvery = Math.max(1, Math.round(this.renderFps / this.traceHz));
    const requestedDuration = CASE_DURATION_SECONDS[caseName];
    const duration = Math.min(requestedDuration, this.maximumDurationSeconds);
    const settleSeconds = ['braking-70-0', 'split-friction-braking'].includes(caseName)
      ? 0
      : initialSpeedMps(caseName) > 0 ? Math.min(this.settleSeconds, duration * 0.25) : 0;
    let measurementStart = null;
    let measurementStartPosition = null;
    let previousTraceState = runner.createStateSnapshot();
    let previousTraceTime = 0;
    let previousStepState = runner.createStateSnapshot();
    let driveTorqueOnsetSeconds = null;
    let zeroTo30Sec = null;
    let zeroTo60Sec = null;
    let quarterMileSec = null;
    let quarterMileTrapMph = null;
    let brakingDistanceM = null;
    let coastDownSec = null;
    let maximumSpeedMps = initialSpeedMps(caseName);
    let maximumLateralG = 0;
    let physicalRackMaximumRad = 0;
    const steeringSigns = new Set();
    let topSpeedStableSeconds = 0;
    let topSpeedComplete = false;
    const phases = ['settle'];
    const totalFrames = Math.ceil(duration * this.renderFps);
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const elapsedBefore = frame * dt;
      const phase = elapsedBefore < settleSeconds ? 'settle' : 'measurement';
      if (phases.at(-1) !== phase) phases.push(phase);
      const maneuverTime = Math.max(0, elapsedBefore - settleSeconds);
      const controls = phase === 'settle'
        ? { throttle: 0, brake: 0, steering: 0, aidsEnabled }
        : controlsForCase(caseName, maneuverTime, aidsEnabled, { state: runner.state });
      const requestedGear = vehicle.transmission === 'manual'
        ? manualShift.update(runner.state, elapsedBefore, controls.throttle)
        : Math.trunc(finite(editor.raceInput.gear, initialization.validation.gear));
      controls.requestedGear = requestedGear;
      if (phase === 'measurement' && measurementStart === null) {
        measurementStart = elapsedBefore;
        measurementStartPosition = { ...runner.state.position };
      }
      installProductionControls(editor, controls, requestedGear,
        vehicle.transmission === 'automatic');
      if (caseName === 'split-friction-braking') {
        session.trackStateByWheel = { fl: { gripScale: 0.35 }, rl: { gripScale: 0.35 } };
      }
      if (!editor.updatePlaytestSafely(dt)) throw new Error(`${vehicleKey}/${caseName} left playtest`);
      const elapsed = elapsedBefore + dt;
      const state = runner.state;
      const speed = finite(state.groundSpeedMps);
      const stepAcceleration = deriveAccelerations(state, previousStepState, dt);
      previousStepState = runner.createStateSnapshot();
      maximumSpeedMps = Math.max(maximumSpeedMps, speed);
      maximumLateralG = Math.max(maximumLateralG, Math.abs(stepAcceleration.lateral) / 9.80665);
      const rack = (finite(state.contactPatches?.fl?.steeringAngleRad)
        + finite(state.contactPatches?.fr?.steeringAngleRad)) * 0.5;
      physicalRackMaximumRad = Math.max(physicalRackMaximumRad, Math.abs(rack));
      if (Math.abs(rack) > 1e-4) steeringSigns.add(Math.sign(rack));
      const measurementElapsed = measurementStart === null ? 0 : elapsed - measurementStart;
      const driveTorqueApplied = controls.throttle > 0
        && Object.values(state.powertrainState?.telemetry?.wheelDriveTorqueNm || {})
          .some((value) => Math.abs(finite(value)) > 1);
      if (driveTorqueOnsetSeconds === null && driveTorqueApplied) driveTorqueOnsetSeconds = elapsed;
      const accelerationElapsed = driveTorqueOnsetSeconds === null ? null
        : elapsed - driveTorqueOnsetSeconds;
      if (accelerationElapsed !== null && zeroTo30Sec === null && speed >= 30 * MPH_TO_MPS) {
        zeroTo30Sec = accelerationElapsed;
      }
      if (accelerationElapsed !== null && zeroTo60Sec === null && speed >= 60 * MPH_TO_MPS) {
        zeroTo60Sec = accelerationElapsed;
      }
      if (measurementStartPosition) {
        const distance = Math.hypot(
          finite(state.position.x) - finite(measurementStartPosition.x),
          finite(state.position.z) - finite(measurementStartPosition.z)
        );
        if (quarterMileSec === null && distance >= 402.336) {
          quarterMileSec = measurementElapsed;
          quarterMileTrapMph = speed / MPH_TO_MPS;
        }
        if (caseName === 'braking-70-0' && brakingDistanceM === null
          && controls.brake > 0 && speed <= 0.5) brakingDistanceM = distance;
      }
      if (caseName === 'coast-down-100-60' && coastDownSec === null
        && speed <= 60 * MPH_TO_MPS) coastDownSec = measurementElapsed;
      if (caseName === 'top-speed' && phase === 'measurement') {
        topSpeedStableSeconds = Math.abs(stepAcceleration.longitudinal) < 0.05
          ? topSpeedStableSeconds + dt : 0;
        topSpeedComplete = topSpeedStableSeconds >= 5
          || state.powertrainState?.revLimiterActive === true;
      }
      if (frame % traceEvery === 0) {
        trace.push(traceSample(runner, controls, elapsed, phase, previousTraceState,
          elapsed - previousTraceTime));
        previousTraceState = runner.createStateSnapshot();
        previousTraceTime = elapsed;
      }
      if (topSpeedComplete || (brakingDistanceM !== null && caseName === 'braking-70-0')) break;
    }
    phases.push('complete');
    const targets = resolveVehicleAcceptanceTargets(vehicle.carId, vehicle.transmission);
    const values = {
      zeroTo30Sec,
      zeroTo60Sec,
      quarterMileSec,
      quarterMileTrapMph,
      topSpeedMph: caseName === 'top-speed' && !topSpeedComplete ? null : maximumSpeedMps / MPH_TO_MPS,
      coastDown100To60Sec: coastDownSec,
      braking70To0Ft: brakingDistanceM === null ? null : brakingDistanceM * M_TO_FT,
      skidpadLateralG: caseName === 'constant-radius-skidpad' && physicalRackMaximumRad <= 1e-4
        ? null : maximumLateralG
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
    const requiredMetrics = new Set(REQUIRED_METRICS_BY_CASE[caseName] || []);
    const checks = Object.fromEntries(Object.entries(values).map(([name, value]) => [
      name, metricStatus(value, acceptanceByMetric[name], { required: requiredMetrics.has(name) })
    ]));
    const noSkippedManualGears = manualShift.events.every((event) => event.to === event.from + 1)
      && (!manualShift.pending || manualShift.pending.to === manualShift.pending.from + 1);
    const configuredAssistStateReached = trace.every((sample) => {
      const configured = sample.assistState.authoritative;
      return sample.assistState.configured === aidsEnabled
        && configured.absEnabled === aidsEnabled
        && configured.tractionControlEnabled === aidsEnabled
        && configured.stabilityControlEnabled === aidsEnabled;
    });
    const aidsOffInterventionCount = trace.reduce((count, sample) => count
      + (sample.assistState.tractionControlActive ? 1 : 0)
      + (sample.assistState.stabilityClassification !== 'inactive' ? 1 : 0)
      + Object.values(sample.assistState.absInterventionByWheel).filter((value) => value > 1e-6).length, 0);
    return {
      calibrationVersion: VEHICLE_VALIDATION_VERSION,
      vehicleKey, vehicle, caseName, aidsEnabled,
      authority: 'RaceEditor/RaceSimulation/VehicleDynamicsRunner',
      productionPaths: ['PhysicsTerrainQueryFrame', 'ContactPatchTireModel', 'powertrain', 'compound-body-collision'],
      initialStateValidation: initialization.validation,
      controlValidation: {
        path: 'RaceEditor.raceInput -> updateRaceSimulation -> VehicleDynamicsRunner input timeline',
        noSkippedManualGears,
        physicalRackMaximumRad,
        steeringSigns: [...steeringSigns],
        configuredAssistStateReached,
        aidsOffInterventionCount,
        manualShiftEvents: manualShift.events,
        pendingManualShift: manualShift.pending
      },
      measurement: {
        phases,
        measurementStartSeconds: measurementStart,
        measurementStartPosition,
        driveTorqueOnsetSeconds,
        topSpeedComplete
      },
      values, checks, traceFields: VEHICLE_TRACE_FIELDS, traceTolerance: TRACE_ENVELOPE_TOLERANCES,
      traceChecksum: hash(trace), trace,
      determinismChecksum: hash(runner.createStateSnapshot()),
      recoveryCount: runner.penetrationRecoveryState.history.length,
      backlogSteps: runner.diagnostics.backlogSteps
    };
  }
}

export default VehicleValidationHarness;
