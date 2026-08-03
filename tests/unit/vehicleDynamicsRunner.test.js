import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  VEHICLE_DYNAMICS_SUBSYSTEM_ORDER,
  VehicleControlInputTimeline,
  VehicleDynamicsRunner,
  createVehicleDynamicsState,
  createVehicleDynamicsConfigFromTuning,
  normalizeVehicleControlInput
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {
  DEFAULT_CAR_TUNING,
  RACE_CAR_DIMENSIONS,
  WRX2_PHYSICAL_PROFILE,
  WRX_2022_SHARED_TUNING,
  WRX_2022_TRANSMISSIONS
} from '../../src/racing/raceData.js';

const RENDER_FPS = [30, 60, 90, 120, 144];
const DURATION_SECONDS = 2;
const FLAT_SURFACE_HEIGHTS = Object.freeze({ fl: 0, fr: 0, rl: 0, rr: 0 });
const WRX_GT_TUNING = Object.freeze({
  ...DEFAULT_CAR_TUNING,
  ...WRX_2022_TRANSMISSIONS.automatic,
  ...RACE_CAR_DIMENSIONS['wrx-2022'],
  rollStiffness: 0.76
});
const WRX_GT_CONFIG = createVehicleDynamicsConfigFromTuning(WRX_GT_TUNING);

test('named angular-rate fallbacks map to the authoritative world axes', () => {
  const state = createVehicleDynamicsState({
    pitchRateRadps: 1.25,
    yawRateRadps: -0.5,
    rollRateRadps: 0.75
  });
  assert.deepEqual(state.angularVelocityWorld, { x: 1.25, y: -0.5, z: 0.75 });
});

test('WRX legacy brakeBalance maps unchanged into authoritative configuration', () => {
  const config = createVehicleDynamicsConfigFromTuning({
    ...WRX_2022_SHARED_TUNING,
    ...WRX_2022_TRANSMISSIONS.automatic
  });
  assert.equal(config.frontBrakeBias, 0.56);
});

test('authoritative velocity state separates ground, body, lateral, and signed travel speed', () => {
  const state = createVehicleDynamicsState({
    yawRad: 0,
    velocity: { x: 20, y: 0, z: 0 },
    speedMps: 0
  });
  assert.equal(state.groundSpeedMps, 20);
  assert.equal(state.bodyLongitudinalSpeedMps, 0);
  assert.equal(state.bodyLateralSpeedMps, 0);

  const runner = new VehicleDynamicsRunner({
    config: { handlingPreset: 'simulation', tireHz: 120 },
    initialState: state,
    inputTimeline: [{ timeSeconds: 0, input: { requestedGear: 1 } }],
    tireContactSubsystem: {
      step() {
        return {
          worldForceN: {}, worldMomentNm: {}, suspensionForceWorldN: {},
          wheelLoadsN: {}, wheelSlip: {}, suspensionTravel: {}, tireForcesN: {},
          wheelAngularVelocityRadps: {}, contactPatches: {}, suspensionState: {}, grounded: false
        };
      }
    },
    environmentProvider: () => ({ airDensityKgM3: 0 })
  });
  runner.advance(1 / 120);
  assert.ok(runner.state.groundSpeedMps > 19.9);
  assert.ok(Math.abs(runner.state.bodyLongitudinalSpeedMps) < 0.01);
  assert.ok(runner.state.bodyLateralSpeedMps > 19.9);
  assert.ok(runner.state.signedTravelSpeedMps > 19.9);
});

function piecewise(time, points) {
  if (time <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const [rightTime, rightValue] = points[index];
    const [leftTime, leftValue] = points[index - 1];
    if (time <= rightTime) {
      const ratio = (time - leftTime) / (rightTime - leftTime);
      return leftValue + (rightValue - leftValue) * ratio;
    }
  }
  return points.at(-1)[1];
}

function controlsAt(time, scenario) {
  const controls = {
    steering: 0,
    throttle: 0,
    brake: 0,
    clutch: 0,
    handbrake: 0,
    requestedGear: scenario.reverse ? -1 : 1,
    assists: {
      absEnabled: scenario.absEnabled !== false,
      tractionControlEnabled: true,
      stabilityControlEnabled: true,
      autoShift: false
    }
  };
  if (scenario.controls) Object.assign(controls, scenario.controls(time));
  return controls;
}

const scenarios = [
  {
    name: 'wrx gt physical suspension launch',
    config: WRX_GT_CONFIG,
    initialState: { heightM: WRX_GT_CONFIG.cgHeightM },
    controls: (time) => ({ throttle: piecewise(time, [[0, 0], [0.5, 1], [2, 1]]) }),
    environment: () => ({ surfaceHeightByWheel: FLAT_SURFACE_HEIGHTS })
  },
  {
    name: 'straight-line acceleration',
    controls: (time) => ({ throttle: piecewise(time, [[0, 0], [0.5, 1], [2, 1]]) })
  },
  {
    name: 'coast-down',
    initialState: { speedMps: 28 }
  },
  {
    name: 'constant-speed cruising',
    initialState: { speedMps: 18 },
    controls: () => ({ throttle: 0.04 })
  },
  {
    name: 'skidpad constant-radius steering',
    initialState: { speedMps: 16 },
    controls: () => ({ steering: 0.32, throttle: 0.04 })
  },
  {
    name: 'step steer',
    initialState: { speedMps: 20 },
    breakpoints: [0.5],
    controls: (time) => ({ steering: time < 0.5 ? 0 : 0.7, throttle: 0.05 })
  },
  {
    name: 'emergency braking',
    initialState: { speedMps: 30 },
    breakpoints: [0.5],
    controls: (time) => ({ brake: time < 0.5 ? 0 : 1 })
  },
  {
    name: 'split-grip acceleration',
    controls: () => ({ throttle: 1 }),
    environment: () => ({ gripByWheel: { fl: 0.25, rl: 0.25, fr: 1, rr: 1 } })
  },
  {
    name: 'split-grip braking',
    initialState: { speedMps: 27 },
    controls: () => ({ brake: 1 }),
    environment: () => ({ gripByWheel: { fl: 0.22, rl: 0.22, fr: 1, rr: 1 } })
  },
  {
    name: 'curb strike',
    initialState: { speedMps: 14 },
    controls: () => ({ steering: 0.12, throttle: 0.1 }),
    environment: (time) => ({
      surfaceHeightByWheel: {
        fl: time >= 0.75 && time <= 1.25 ? 0.12 : 0,
        fr: 0,
        rl: 0,
        rr: 0
      }
    })
  },
  {
    name: 'airborne motion and landing',
    initialState: {
      position: { x: 0, y: 2.55, z: 0 },
      velocity: { x: 0, y: 2, z: 20 },
      speedMps: 20,
      grounded: false
    },
    controls: () => ({ steering: 0.8, throttle: 0.8, brake: 0.7, handbrake: 1 }),
    environment: () => ({ surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 } })
  },
  {
    name: 'reverse driving',
    reverse: true,
    controls: () => ({ throttle: 0.65, requestedGear: -1 })
  },
  {
    name: 'render hitch recovery',
    hitch: true,
    controls: (time) => ({
      steering: piecewise(time, [[0, 0], [1, 0.45], [2, -0.2]]),
      throttle: piecewise(time, [[0, 0.2], [0.75, 1], [2, 0.35]]),
      brake: piecewise(time, [[0, 0], [1.5, 0], [2, 0.6]])
    })
  },
  {
    name: 'collision impulse',
    initialState: { speedMps: 18 },
    controls: () => ({ throttle: 0.05 }),
    collisionStep: 90
  },
  {
    name: 'rollover',
    initialState: {
      speedMps: 12,
      rollRad: 0.72,
      angularVelocityWorld: { x: 0, y: 0.15, z: 1.8 }
    },
    controls: () => ({ steering: 0.3 })
  },
  {
    name: 'countersteer recovery',
    initialState: {
      speedMps: 22,
      yawVelocityRadps: 0.7,
      angularVelocityWorld: { x: 0, y: 0.7, z: 0 }
    },
    breakpoints: [0.6],
    controls: (time) => ({ steering: time < 0.6 ? 0.65 : -0.55, throttle: 0.18 })
  }
];

function frameDurations(fps, scenario) {
  const durations = [];
  const breakpoints = [...(scenario.breakpoints || [])];
  if (scenario.hitch) breakpoints.push(0.75, 1);
  let time = 0;
  while (time < DURATION_SECONDS - 1e-10) {
    let duration = 1 / fps;
    const boundary = breakpoints.find((point) => point > time + 1e-10 && point < time + duration - 1e-10);
    if (boundary !== undefined) duration = boundary - time;
    if (scenario.hitch && Math.abs(time - 0.75) < 1e-9) duration = 0.25;
    duration = Math.min(duration, DURATION_SECONDS - time);
    durations.push(duration);
    time = Number((time + duration).toFixed(12));
  }
  return durations;
}

function runScenario(scenario, fps) {
  const inputTimeline = Array.from({ length: 241 }, (_unused, stepIndex) => ({
    timeSeconds: stepIndex / 120,
    input: controlsAt(stepIndex / 120, scenario)
  }));
  const runner = new VehicleDynamicsRunner({
    config: {
      chassisHz: 120,
      tireHz: 360,
      maxCatchUpSteps: 18,
      telemetryLimit: 1000,
      ...(scenario.config || {})
    },
    initialState: scenario.initialState,
    inputTimeline,
    environmentProvider: ({ timeSeconds }) => scenario.environment?.(timeSeconds) || {}
  });
  let time = 0;
  let sawCatchUpLimit = false;
  for (const duration of frameDurations(fps, scenario)) {
    time = Number((time + duration).toFixed(12));
    const result = runner.advance(duration, {
      inputTimeSeconds: time,
      onFixedStep: scenario.collisionStep ? (telemetry) => {
        if (telemetry.stepIndex !== scenario.collisionStep) return;
        runner.queueCollisionImpulse({
          impulseWorldNs: { x: 4200, y: 900, z: -7800 },
          pointWorld: { x: 0.8, y: 0.1, z: 0.6 },
          source: 'fixture-collision'
        });
      } : null
    });
    sawCatchUpLimit ||= result.catchUpLimited;
  }
  runner.drainCatchUp();
  return { runner, sawCatchUpLimit };
}

test('all authoritative fixed-step fixtures are exact across rendering frame partitions', () => {
  for (const scenario of scenarios) {
    const baseline = runScenario(scenario, RENDER_FPS[0]);
    assert.equal(baseline.runner.stepIndex, 240, scenario.name);
    assert.equal(baseline.runner.diagnostics.completedTireSubsteps, 720, scenario.name);
    for (const fps of RENDER_FPS.slice(1)) {
      const candidate = runScenario(scenario, fps);
      assert.deepEqual(candidate.runner.createStateSnapshot(), baseline.runner.createStateSnapshot(),
        `${scenario.name} state at ${fps} FPS`);
      assert.deepEqual(candidate.runner.telemetry, baseline.runner.telemetry,
        `${scenario.name} telemetry at ${fps} FPS`);
      assert.deepEqual(candidate.runner.diagnostics, baseline.runner.diagnostics,
        `${scenario.name} diagnostics at ${fps} FPS`);
    }
    if (scenario.hitch) assert.equal(baseline.sawCatchUpLimit, true);
  }
});

test('airborne controls cannot redirect the chassis and landing settles without gaining energy', () => {
  const heights = { fl: 0, fr: 0, rl: 0, rr: 0 };
  const initialState = {
    position: { x: 0, y: 4.55, z: 0 },
    velocity: { x: 0, y: 2, z: 20 },
    speedMps: 20,
    yawVelocityRadps: 0.4,
    grounded: false
  };
  const makeRunner = (input) => new VehicleDynamicsRunner({
    config: { chassisHz: 120, tireHz: 360, handlingPreset: 'sport' },
    initialState,
    inputTimeline: [{ timeSeconds: 0, input }],
    environmentProvider: () => ({
      surfaceHeightByWheel: heights,
      sampleTerrainAtWorldPoint: () => ({
        heightM: 0,
        normal: { x: 0, y: 1, z: 0 },
        friction: 0.62
      })
    })
  });
  const neutral = makeRunner({ requestedGear: 1 });
  const controlled = makeRunner({
    steering: 1,
    throttle: 1,
    brake: 1,
    handbrake: 1,
    requestedGear: 1
  });
  neutral.advance(0.5);
  controlled.advance(0.5);
  assert.deepEqual(controlled.state.position, neutral.state.position);
  assert.deepEqual(controlled.state.velocity, neutral.state.velocity);
  assert.deepEqual(controlled.state.angularVelocityWorld, neutral.state.angularVelocityWorld);
  assert.ok(controlled.telemetry.every((entry) => entry.forces.supportScale === 0));
  assert.ok(controlled.telemetry.flatMap((entry) => entry.assistInterventions)
    .every((entry) => entry.appliedValue === 0));

  for (let index = 0; index < 420; index += 1) controlled.advance(1 / 120);
  const staticCompressionM = (controlled.config.massKg * 9.81 / 4)
    / controlled.config.suspensionSpringRateNpm;
  const floorHeightM = controlled.config.cgHeightM
    - (controlled.config.suspensionTravelM - staticCompressionM);
  const minimumBodyHeightM = Math.min(...controlled.telemetry.map((entry) => entry.state.position.y));
  assert.ok(
    minimumBodyHeightM >= floorHeightM - controlled.config.bodyCollisionToleranceM - 0.002,
    `landing penetration ${minimumBodyHeightM} below ${floorHeightM}`
  );
  assert.ok(controlled.telemetry.some((entry) => entry.forces.groundConstraintImpulseNs > 0));
  assert.equal(controlled.state.grounded, true);
  assert.ok(Math.abs(controlled.state.position.y - controlled.config.cgHeightM) < 0.01);
  assert.ok(Math.abs(controlled.state.velocity.y) < 0.02);
  assert.ok(Object.values(controlled.state.wheelLoadsN).every((load) => (
    load <= controlled.config.massKg * 9.81 / 4 * controlled.config.maxSuspensionLoadFactor
  )));
});

test('WRX GT tuning maps to physical per-axle suspension and CG geometry', () => {
  assert.equal(WRX_GT_CONFIG.massKg, 1603);
  assert.equal(WRX_GT_CONFIG.frontWeightDistribution, 0.58);
  assert.equal(WRX_GT_CONFIG.frontTrackWidthM, 1.56);
  assert.equal(WRX_GT_CONFIG.rearTrackWidthM, 1.57);
  assert.ok(Math.abs(WRX_GT_CONFIG.frontAxleDistanceFromCgM - 1.1214) < 1e-9);
  assert.ok(Math.abs(WRX_GT_CONFIG.rearAxleDistanceFromCgM - 1.5486) < 1e-9);
  assert.equal(WRX_GT_CONFIG.suspensionSpringRateFrontNpm, WRX2_PHYSICAL_PROFILE.suspensionSpringRateFrontNpm);
  assert.equal(WRX_GT_CONFIG.suspensionSpringRateRearNpm, WRX2_PHYSICAL_PROFILE.suspensionSpringRateRearNpm);
  assert.equal(WRX_GT_CONFIG.suspensionBumpDamperFrontNsM, WRX2_PHYSICAL_PROFILE.suspensionBumpDamperFrontNsM);
  assert.equal(WRX_GT_CONFIG.suspensionReboundDamperFrontNsM, WRX2_PHYSICAL_PROFILE.suspensionReboundDamperFrontNsM);
  assert.equal(WRX_GT_CONFIG.suspensionTravelFrontM, 0.15);
  assert.equal(WRX_GT_CONFIG.suspensionTravelRearM, 0.15);
  assert.equal(WRX_GT_CONFIG.pitchStiffnessNmPerRad, 0);
  assert.equal(WRX_GT_CONFIG.rollStiffnessNmPerRad, 0);
});

test('WRX GT free rev and stationary engine braking cannot move or pitch the chassis', () => {
  const runStationary = (input) => {
    const runner = new VehicleDynamicsRunner({
      config: WRX_GT_CONFIG,
      initialState: { heightM: WRX_GT_CONFIG.cgHeightM },
      inputTimeline: [{ timeSeconds: 0, input }],
      environmentProvider: () => ({ surfaceHeightByWheel: FLAT_SURFACE_HEIGHTS })
    });
    for (let index = 0; index < 240; index += 1) runner.advance(1 / 120);
    return runner;
  };
  const freeRev = runStationary({ throttle: 1, clutch: 1, requestedGear: 1 });
  assert.deepEqual(freeRev.state.position, { x: 0, y: WRX_GT_CONFIG.cgHeightM, z: 0 });
  assert.deepEqual(freeRev.state.velocity, { x: 0, y: 0, z: 0 });
  assert.equal(freeRev.state.pitchRad, 0);
  assert.equal(freeRev.state.rollRad, 0);
  assert.ok(freeRev.state.engineRpm > WRX_GT_CONFIG.idleRpm);
  assert.ok(Object.values(freeRev.state.tireForcesN).every((force) => (
    force.longitudinal === 0 && force.lateral === 0
  )));

  const engineBraking = runStationary({ throttle: 0, clutch: 0, requestedGear: 1 });
  assert.deepEqual(engineBraking.state.position, freeRev.state.position);
  assert.deepEqual(engineBraking.state.velocity, freeRev.state.velocity);
  assert.equal(engineBraking.state.pitchRad, 0);
  assert.equal(engineBraking.state.rollRad, 0);
});

test('WRX GT launch, braking, and skidpad attitude stays physically bounded', () => {
  const run = ({ input, initialState = {}, steps = 360 }) => {
    const runner = new VehicleDynamicsRunner({
      config: WRX_GT_CONFIG,
      initialState: { heightM: WRX_GT_CONFIG.cgHeightM, ...initialState },
      inputTimeline: [{ timeSeconds: 0, input }],
      environmentProvider: () => ({ surfaceHeightByWheel: FLAT_SURFACE_HEIGHTS })
    });
    let maxPitchRad = 0;
    let maxRollRad = 0;
    let maxLateralAccelerationMps2 = 0;
    for (let index = 0; index < steps; index += 1) {
      runner.advance(1 / 120);
      maxPitchRad = Math.max(maxPitchRad, Math.abs(runner.state.pitchRad));
      maxRollRad = Math.max(maxRollRad, Math.abs(runner.state.rollRad));
      maxLateralAccelerationMps2 = Math.max(
        maxLateralAccelerationMps2,
        Math.abs(runner.state.lateralAccelerationMps2)
      );
    }
    return { runner, maxPitchRad, maxRollRad, maxLateralAccelerationMps2 };
  };
  const launch = run({ input: { throttle: 1, requestedGear: 1 } });
  assert.ok(launch.runner.state.pitchRad < 0, 'acceleration must produce physical nose rise');
  assert.ok(launch.maxPitchRad * 180 / Math.PI > 0.5);
  assert.ok(launch.maxPitchRad * 180 / Math.PI < 5);

  const braking = run({
    input: { brake: 1, requestedGear: 1 },
    initialState: { speedMps: 28, velocity: { x: 0, y: 0, z: 28 } },
    steps: 180
  });
  assert.ok(braking.runner.state.pitchRad > 0, 'braking must produce physical nose dive');
  assert.ok(braking.maxPitchRad * 180 / Math.PI < 5);

  const skidpad = run({
    input: { steering: 0.45, throttle: 0.15, requestedGear: 1 },
    initialState: { speedMps: 18, velocity: { x: 0, y: 0, z: 18 } }
  });
  const maxRollDeg = skidpad.maxRollRad * 180 / Math.PI;
  assert.ok(skidpad.maxLateralAccelerationMps2 > 7.5,
    `expected skidpad lateral acceleration above 7.5 m/s², got ${skidpad.maxLateralAccelerationMps2}`);
  assert.ok(maxRollDeg > 2.2, `expected skidpad roll above 2.2°, got ${maxRollDeg}°`);
  assert.ok(maxRollDeg < 6, `expected skidpad roll below 6°, got ${maxRollDeg}°`);
  assert.ok(skidpad.runner.state.suspensionState.fl.antiRollLoadTransferN
    !== skidpad.runner.state.suspensionState.fr.antiRollLoadTransferN);
});

test('authoritative traction control and ABS flags change physical wheel outcomes', () => {
  const run = ({ input, initialState = {}, material, steps = 180 }) => {
    const runner = new VehicleDynamicsRunner({
      config: { ...WRX_GT_CONFIG, tireHz: 120 },
      initialState: { heightM: WRX_GT_CONFIG.cgHeightM, ...initialState },
      inputTimeline: [{ timeSeconds: 0, input }],
      environmentProvider: () => ({
        surfaceHeightByWheel: FLAT_SURFACE_HEIGHTS,
        materialByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr']
          .map((wheelId) => [wheelId, material]))
      })
    });
    let maximumDrivenSlip = 0;
    let maximumBrakeSlip = 0;
    for (let index = 0; index < steps; index += 1) {
      runner.advance(1 / 120);
      maximumDrivenSlip = Math.max(maximumDrivenSlip,
        ...['fl', 'fr', 'rl', 'rr'].map((wheelId) => Math.max(0,
          Number(runner.state.contactPatches[wheelId]?.rawSlipRatio || 0))));
      maximumBrakeSlip = Math.max(maximumBrakeSlip,
        ...['fl', 'fr', 'rl', 'rr'].map((wheelId) => Math.max(0,
          -Number(runner.state.contactPatches[wheelId]?.rawSlipRatio || 0))));
    }
    return { runner, maximumDrivenSlip, maximumBrakeSlip };
  };
  const looseMaterial = { baseSurfaceId: 'gravel', surfaceId: 'gravel', grip: 0.48 };
  const tcOn = run({
    input: { throttle: 1, requestedGear: 1, assists: { tractionControlEnabled: true } },
    material: looseMaterial
  });
  const tcOff = run({
    input: { throttle: 1, requestedGear: 1, assists: { tractionControlEnabled: false } },
    material: looseMaterial
  });
  assert.ok(tcOn.maximumDrivenSlip < tcOff.maximumDrivenSlip,
    `TC slip ${tcOn.maximumDrivenSlip} should be below disabled slip ${tcOff.maximumDrivenSlip}`);

  const wetMaterial = {
    baseSurfaceId: 'asphalt', surfaceId: 'asphalt', grip: 0.58,
    standingWaterDepthMm: 2.5
  };
  const wetTcOn = run({
    input: { throttle: 1, requestedGear: 1, assists: { tractionControlEnabled: true } },
    material: wetMaterial,
    steps: 120
  });
  const wetTcOff = run({
    input: { throttle: 1, requestedGear: 1, assists: { tractionControlEnabled: false } },
    material: wetMaterial,
    steps: 120
  });
  assert.ok(wetTcOn.maximumDrivenSlip < wetTcOff.maximumDrivenSlip,
    `wet TC slip ${wetTcOn.maximumDrivenSlip} should be below disabled slip ${wetTcOff.maximumDrivenSlip}`);
  const brakingState = { speedMps: 28, velocity: { x: 0, y: 0, z: 28 } };
  const absOn = run({
    input: { brake: 1, requestedGear: 3, assists: { absEnabled: true } },
    initialState: brakingState,
    material: wetMaterial,
    steps: 120
  });
  const absOff = run({
    input: { brake: 1, requestedGear: 3, assists: { absEnabled: false } },
    initialState: brakingState,
    material: wetMaterial,
    steps: 120
  });
  assert.ok(absOn.maximumBrakeSlip < absOff.maximumBrakeSlip,
    `ABS slip ${absOn.maximumBrakeSlip} should be below disabled slip ${absOff.maximumBrakeSlip}`);
  assert.ok(absOn.runner.state.groundSpeedMps < absOff.runner.state.groundSpeedMps,
    'ABS must improve authoritative wet stopping outcome');
});

test('WRX GT free rev on an uphill grade follows the surface without nose dive', () => {
  const slope = 0.1;
  const normalScale = 1 / Math.sqrt(1 + slope * slope);
  const surfaceNormal = { x: 0, y: normalScale, z: -slope * normalScale };
  const frontHeight = slope * WRX_GT_CONFIG.frontAxleDistanceFromCgM;
  const rearHeight = -slope * WRX_GT_CONFIG.rearAxleDistanceFromCgM;
  const runner = new VehicleDynamicsRunner({
    config: WRX_GT_CONFIG,
    initialState: { heightM: WRX_GT_CONFIG.cgHeightM },
    inputTimeline: [{
      timeSeconds: 0,
      input: { throttle: 1, clutch: 1, requestedGear: 1 }
    }],
    environmentProvider: () => ({
      surfaceHeightByWheel: { fl: frontHeight, fr: frontHeight, rl: rearHeight, rr: rearHeight },
      surfaceNormalByWheel: {
        fl: surfaceNormal, fr: surfaceNormal, rl: surfaceNormal, rr: surfaceNormal
      },
      targetVelocityWorld: { x: 0, y: 0, z: 0 }
    })
  });
  for (let index = 0; index < 360; index += 1) runner.advance(1 / 120);
  assert.ok(runner.state.pitchRad < 0, 'uphill chassis pitch must raise the nose');
  assert.ok(Math.abs(runner.state.pitchRad + Math.atan(slope)) < 0.01,
    `expected ${-Math.atan(slope)} rad grade pitch, got ${runner.state.pitchRad}`);
  assert.equal(runner.state.position.x, 0);
  assert.equal(runner.state.position.z, 0);
  assert.ok(runner.state.engineRpm > WRX_GT_CONFIG.idleRpm);
});

test('WRX GT cannot discharge impossible wheelspin into self-acceleration near 45 mph', () => {
  const runner = new VehicleDynamicsRunner({
    config: WRX_GT_CONFIG,
    initialState: { heightM: WRX_GT_CONFIG.cgHeightM },
    inputTimeline: [
      { timeSeconds: 0, input: { throttle: 1, requestedGear: 2 } },
      { timeSeconds: 5, input: { throttle: 1, requestedGear: 2 } },
      { timeSeconds: 5.001, input: { throttle: 0, requestedGear: 2 } },
      { timeSeconds: 8, input: { throttle: 0, requestedGear: 2 } }
    ],
    environmentProvider: () => ({ surfaceHeightByWheel: FLAT_SURFACE_HEIGHTS })
  });
  for (let index = 0; index < 600; index += 1) runner.advance(1 / 120);
  const releaseSpeedMps = runner.state.speedMps;
  assert.ok(releaseSpeedMps > 20 && releaseSpeedMps < 25);
  assert.ok(Math.max(...Object.values(runner.state.wheelAngularVelocityRadps)) < 100);
  assert.ok(Math.max(...Object.values(runner.state.wheelSlip)) < 0.1);
  for (let index = 0; index < 360; index += 1) {
    runner.advance(1 / 120);
    assert.ok(runner.state.speedMps <= releaseSpeedMps + 0.000001,
      `coast speed ${runner.state.speedMps} exceeded release speed ${releaseSpeedMps} at step ${index}`);
  }
  assert.ok(runner.state.speedMps < releaseSpeedMps - 3,
    `expected at least 3 m/s coast-down from ${releaseSpeedMps}, got ${runner.state.speedMps}`);
});

test('recorded input playback reproduces state and telemetry exactly', () => {
  for (const scenario of scenarios) {
    const original = runScenario(scenario, 90).runner;
    const replay = VehicleDynamicsRunner.replay(original.createReplayRecord(), {
      environmentProvider: ({ timeSeconds }) => scenario.environment?.(timeSeconds) || {}
    });
    assert.deepEqual(replay.createStateSnapshot(), original.createStateSnapshot(), scenario.name);
    assert.deepEqual(replay.telemetry, original.telemetry, scenario.name);
  }
});

test('control timeline interpolates axes and holds discrete controls deterministically', () => {
  const timeline = new VehicleControlInputTimeline([
    { timeSeconds: 0, input: { steering: -1, throttle: 0, requestedGear: 1, assists: { abs: true } } },
    { timeSeconds: 1, input: { steering: 1, throttle: 1, requestedGear: 3, assists: { abs: false } } }
  ]);
  assert.deepEqual(timeline.sampleAt(0.5), {
    steering: 0,
    centerSteeringAngleRad: null,
    steeringInputMode: 'normalized',
    throttle: 0.5,
    brake: 0,
    clutch: 0,
    handbrake: 0,
    requestedGear: 1,
    assists: { abs: true }
  });
  assert.equal(timeline.sampleAt(1).requestedGear, 3);

  const held = { steering: 0.25, throttle: 0.6, requestedGear: 2 };
  timeline.addSample(2, held);
  timeline.addSample(3, held);
  timeline.addSample(4, held);
  assert.equal(timeline.samples.length, 4);
  assert.deepEqual(timeline.sampleAt(3.5), normalizeVehicleControlInput(held));
});

test('runner enforces deterministic ordering, tire rate, and catch-up budget', () => {
  assert.throws(
    () => new VehicleDynamicsRunner({ config: { chassisHz: 120, tireHz: 240.5 } }),
    /integer multiple/
  );
  const runner = new VehicleDynamicsRunner({
    config: { chassisHz: 120, tireHz: 360, maxCatchUpSteps: 5 },
    inputTimeline: [{ timeSeconds: 0, input: { throttle: 1, requestedGear: 1 } }]
  });
  const hitch = runner.advance(0.25, { input: { throttle: 1, requestedGear: 1 } });
  assert.equal(hitch.completedSteps, 5);
  assert.equal(hitch.completedTireSubsteps, 15);
  assert.equal(hitch.catchUpLimited, true);
  assert.equal(hitch.backlogSteps, 25);
  assert.deepEqual(runner.telemetry[0].subsystemOrder, VEHICLE_DYNAMICS_SUBSYSTEM_ORDER);
  assert.equal(runner.drainCatchUp(), 25);

  const bounded = new VehicleDynamicsRunner({
    config: { inputTimelineLimit: 3 },
    inputTimeline: [{ timeSeconds: 0, input: {} }]
  });
  for (let index = 1; index <= 5; index += 1) {
    bounded.addInputSample(index, { steering: index / 10 });
  }
  assert.equal(bounded.inputTimeline.samples.length, 3);
  assert.equal(bounded.inputTimeline.sampleAt(5).steering, 0.5);
});

test('snapshots restore exactly and tire/contact implementations are replaceable', () => {
  let tireCalls = 0;
  const tireContactSubsystem = {
    step() {
      tireCalls += 1;
      return {
        longitudinalForceN: 1200,
        lateralForceN: 0,
        wheelLoadsN: { fl: 1, fr: 1, rl: 1, rr: 1 },
        wheelSlip: { fl: 0, fr: 0, rl: 0, rr: 0 },
        suspensionTravel: { fl: 0.5, fr: 0.5, rl: 0.5, rr: 0.5 },
        tireForcesN: {},
        grounded: true,
        groundHeightM: 0
      };
    }
  };
  const runner = new VehicleDynamicsRunner({
    config: { chassisHz: 120, tireHz: 240 },
    inputTimeline: [{ timeSeconds: 0, input: { throttle: 1, requestedGear: 1 } }],
    tireContactSubsystem
  });
  runner.advance(0.1);
  const snapshot = runner.createSnapshot();
  runner.advance(0.1);
  runner.restoreSnapshot(snapshot);
  assert.deepEqual(runner.createSnapshot(), snapshot);
  assert.equal(tireCalls, 48);
});

function runSubstepImpulseFixture({ tireHz, eventPhase, scenario }) {
  const substepCount = tireHz / 120;
  const tireContactSubsystem = {
    step({ dt, substepIndex }) {
      const eventActive = substepIndex === eventPhase;
      const eventForce = (impulse = {}) => Object.fromEntries(
        Object.entries(impulse).map(([axis, value]) => [axis, eventActive ? value / dt : 0])
      );
      return {
        longitudinalForceN: 0,
        lateralForceN: 0,
        worldForceN: scenario.continuousForceWorldN || eventForce(scenario.tireImpulseWorldNs),
        worldMomentNm: eventForce(scenario.tireAngularImpulseWorldNms),
        suspensionForceWorldN: eventForce(scenario.suspensionImpulseWorldNs),
        wheelLoadsN: { fl: 0, fr: 0, rl: 0, rr: 0 },
        wheelSlip: { fl: 0, fr: 0, rl: 0, rr: 0 },
        suspensionTravel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        tireForcesN: {},
        wheelAngularVelocityRadps: {},
        contactPatches: {},
        suspensionState: {},
        grounded: false,
        groundHeightM: null
      };
    }
  };
  const runner = new VehicleDynamicsRunner({
    config: {
      chassisHz: 120,
      tireHz,
      massKg: 1000,
      pitchInertiaKgM2: 1000,
      yawInertiaKgM2: 1000,
      rollInertiaKgM2: 1000,
      handlingPreset: 'simulation'
    },
    initialState: { position: { x: 0, y: 10, z: 0 }, grounded: false },
    inputTimeline: [{ timeSeconds: 0, input: {} }],
    tireContactSubsystem,
    environmentProvider: ({ substepIndex }) => ({
      externalForceWorldN: substepIndex === eventPhase
        ? Object.fromEntries(Object.entries(scenario.externalImpulseWorldNs || {})
          .map(([axis, value]) => [axis, value * tireHz]))
        : {},
      externalMomentWorldNm: substepIndex === eventPhase
        ? Object.fromEntries(Object.entries(scenario.externalAngularImpulseWorldNms || {})
          .map(([axis, value]) => [axis, value * tireHz]))
        : {},
      airDensityKgM3: 0
    })
  });
  runner.advance(1 / 120);
  assert.equal(runner.telemetry[0].tireSubstepCount, substepCount);
  return runner;
}

test('120, 240, and 360 Hz contact phases transfer every force impulse exactly once', () => {
  const fixtures = {
    'flat driving': { continuousForceWorldN: { x: 0, y: 0, z: 1200 } },
    'curb impact': {
      tireImpulseWorldNs: { x: 7, y: 48, z: -3 },
      tireAngularImpulseWorldNms: { x: 11, y: -5, z: 8 }
    },
    'one-wheel bump': {
      suspensionImpulseWorldNs: { x: 2, y: 36, z: 0 },
      tireAngularImpulseWorldNms: { x: 9, y: 0, z: -14 }
    },
    landing: { suspensionImpulseWorldNs: { x: 0, y: 80, z: 0 } },
    'bank transition': {
      tireImpulseWorldNs: { x: 18, y: 22, z: 0 },
      tireAngularImpulseWorldNms: { x: 0, y: 4, z: 12 }
    },
    'wheel unloading': { tireImpulseWorldNs: { x: -6, y: 0, z: 9 } }
  };

  for (const [name, scenario] of Object.entries(fixtures)) {
    let reference = null;
    for (const tireHz of [120, 240, 360]) {
      for (let phase = 0; phase < tireHz / 120; phase += 1) {
        const runner = runSubstepImpulseFixture({ tireHz, eventPhase: phase, scenario });
        const outcome = {
          velocity: runner.state.velocity,
          angularVelocityWorld: runner.state.angularVelocityWorld
        };
        reference ||= outcome;
        assert.deepEqual(outcome, reference, `${name} at ${tireHz} Hz phase ${phase}`);
      }
    }
  }
});

test('120, 240, and 360 Hz accumulate identical tire-energy work at the chassis boundary', () => {
  const energyRates = {
    longitudinalFrictionWorkJ: 900,
    lateralFrictionWorkJ: 420,
    carcassFlexWorkJ: 180,
    loadHeatingWorkJ: 75,
    surfaceConductionWorkJ: -35,
    waterCoolingWorkJ: 55
  };
  let reference = null;
  for (const tireHz of [120, 240, 360]) {
    const runner = new VehicleDynamicsRunner({
      config: { chassisHz: 120, tireHz, handlingPreset: 'simulation' },
      initialState: { position: { x: 0, y: 10, z: 0 }, grounded: false },
      inputTimeline: [{ timeSeconds: 0, input: {} }],
      tireContactSubsystem: {
        step({ dt }) {
          const tireEnergyWork = Object.fromEntries(Object.entries(energyRates)
            .map(([field, rate]) => [field, rate * dt]));
          const patch = { tireEnergyWork };
          return {
            worldForceN: {}, worldMomentNm: {}, suspensionForceWorldN: {},
            wheelLoadsN: {}, wheelSlip: {}, suspensionTravel: {}, tireForcesN: {},
            wheelAngularVelocityRadps: {}, suspensionState: {}, grounded: false,
            contactPatches: { fl: patch, fr: patch, rl: patch, rr: patch }
          };
        }
      },
      environmentProvider: () => ({ airDensityKgM3: 0 })
    });
    runner.advance(1 / 120);
    const outcome = {
      accumulated: runner.telemetry[0].state.contactPatches.fl.tireEnergyWork,
      thermalAndWear: runner.state.tireState.fl
    };
    reference ||= outcome;
    assert.deepEqual(outcome, reference, `${tireHz} Hz tire energy, thermal state, and wear`);
  }
});

test('suspension, aerodynamic, and contact moments accumulate without a final-sample spike', () => {
  const scenario = {
    tireImpulseWorldNs: { x: 6, y: 9, z: 12 },
    suspensionImpulseWorldNs: { x: 3, y: 15, z: -3 },
    externalImpulseWorldNs: { x: -2, y: 1, z: -4 },
    tireAngularImpulseWorldNms: { x: 5, y: 7, z: 11 },
    externalAngularImpulseWorldNms: { x: -1, y: 2, z: 3 }
  };
  const runner = runSubstepImpulseFixture({ tireHz: 360, eventPhase: 2, scenario });
  const forces = runner.telemetry[0].forces;

  assert.deepEqual(forces.tireImpulseWorldNs, scenario.tireImpulseWorldNs);
  assert.deepEqual(forces.suspensionImpulseWorldNs, scenario.suspensionImpulseWorldNs);
  assert.deepEqual(forces.aerodynamicAndExternalImpulseWorldNs, scenario.externalImpulseWorldNs);
  assert.deepEqual(forces.angularImpulseWorldNms, { x: 4, y: 9, z: 14 });
  assert.equal(runner.state.velocity.z, 0.005);
});

test('authoritative runner core has no rendering dependencies or secondary gameplay integrator', async () => {
  const source = await readFile(
    new URL('../../src/racing/simulation/VehicleDynamicsRunner.js', import.meta.url),
    'utf8'
  );
  for (const forbidden of ['RaceEditor', 'camera', 'lapProgress', 'audio', 'requestAnimationFrame']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
