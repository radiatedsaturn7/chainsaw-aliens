import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  VEHICLE_DYNAMICS_SUBSYSTEM_ORDER,
  VehicleControlInputTimeline,
  VehicleDynamicsRunner,
  normalizeVehicleControlInput
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const RENDER_FPS = [30, 60, 90, 120, 144];
const DURATION_SECONDS = 2;

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
    initialState: { speedMps: 20 },
    controls: () => ({ throttle: 0.15 }),
    environment: (time) => {
      if (time < 0.6) return { grounded: true, groundHeightM: 0 };
      if (time < 1.45) return { grounded: false, verticalAccelerationMps2: -9.81 };
      return { grounded: true, verticalAccelerationMps2: -9.81, groundHeightM: 0 };
    }
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
    config: { chassisHz: 120, tireHz: 360, maxCatchUpSteps: 18, telemetryLimit: 1000 },
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

test('authoritative runner core has no rendering dependencies or secondary gameplay integrator', async () => {
  const source = await readFile(
    new URL('../../src/racing/simulation/VehicleDynamicsRunner.js', import.meta.url),
    'utf8'
  );
  for (const forbidden of ['RaceEditor', 'camera', 'lapProgress', 'audio', 'requestAnimationFrame']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
