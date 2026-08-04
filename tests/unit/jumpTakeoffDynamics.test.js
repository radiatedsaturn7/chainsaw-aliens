import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VehicleDynamicsRunner,
  createVehicleDynamicsConfig
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { quaternionFromEuler } from '../../src/racing/simulation/RigidBodyMath.js';

const MPH_TO_MPS = 0.44704;
const RENDER_FPS = [30, 60, 90, 120, 144];

// A compact analytical copy of the authored Studio Sprint 2 crest scale:
// blended 0.08 grade, 0.80 m crest height, and a 13 m landing gap. Keeping this
// fixture in metres exercises the same wheelbase/clearance geometry without
// depending on mutable local editor storage.
function sampleStudioSprint2Ramp(z) {
  if (z < 0) return { heightM: 0, slope: 0 };
  if (z <= 2) {
    const t = z / 2;
    const blend = t * t * (3 - 2 * t);
    const blendDerivative = (6 * t - 6 * t * t) / 2;
    return {
      heightM: 0.08 * z * blend,
      slope: 0.08 * blend + 0.08 * z * blendDerivative
    };
  }
  if (z <= 10) return { heightM: z * 0.08, slope: 0.08 };
  if (z < 23) return null;
  return { heightM: 0.8, slope: 0 };
}

function normalForSlope(slope = 0) {
  const magnitude = Math.hypot(1, slope);
  return { x: 0, y: 1 / magnitude, z: -slope / magnitude };
}

function createRampEnvironment(config, state) {
  const wheelZ = {
    fl: state.position.z + config.frontAxleDistanceFromCgM,
    fr: state.position.z + config.frontAxleDistanceFromCgM,
    rl: state.position.z - config.rearAxleDistanceFromCgM,
    rr: state.position.z - config.rearAxleDistanceFromCgM
  };
  const samples = Object.fromEntries(Object.entries(wheelZ).map(([wheelId, z]) => [
    wheelId,
    sampleStudioSprint2Ramp(z)
  ]));
  const supported = Object.values(samples).some(Boolean);
  return {
    authoredRampId: 'studio-sprint-2-crest',
    airDensityKgM3: 0,
    grounded: supported,
    surfaceHeightByWheel: Object.fromEntries(Object.entries(samples).map(([wheelId, sample]) => [
      wheelId,
      sample ? sample.heightM : Number.NaN
    ])),
    surfaceNormalByWheel: Object.fromEntries(Object.entries(samples).map(([wheelId, sample]) => [
      wheelId,
      normalForSlope(sample?.slope || 0)
    ])),
    sampleTerrainAtWorldPoint(point) {
      const sample = sampleStudioSprint2Ramp(point.z);
      return sample
        ? { heightM: sample.heightM, normal: normalForSlope(sample.slope), friction: 1 }
        : { heightM: Number.NaN, normal: { x: 0, y: 1, z: 0 }, friction: 1 };
    }
  };
}

function runStudioSprint2Jump({ mph, fps, input = {} }) {
  const config = createVehicleDynamicsConfig({
    chassisHz: 120,
    tireHz: 360,
    handlingPreset: 'simulation',
    telemetryRetention: 'latest',
    drivenWheelIds: ['fl', 'fr', 'rl', 'rr'],
    powertrainTuning: {
      drivetrain: 'awd',
      gearRatios: [3.45, 1.95, 1.3, 0.98, 0.78, 0.65],
      finalDrive: 4.1,
      drivetrainEfficiency: 0.88
    }
  });
  const speedMps = mph * MPH_TO_MPS;
  const engineRpm = speedMps / config.wheelRadiusM * 1.3 * 4.1 * 60 / (Math.PI * 2);
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: {
      position: { x: 0, y: config.cgHeightM, z: -8 },
      velocity: { x: 0, y: 0, z: speedMps },
      speedMps,
      groundSpeedMps: speedMps,
      bodyLongitudinalSpeedMps: speedMps,
      signedTravelSpeedMps: speedMps,
      engineRpm,
      gear: 3,
      wheelAngularVelocityRadps: Object.fromEntries(
        ['fl', 'fr', 'rl', 'rr'].map((wheelId) => [wheelId, speedMps / config.wheelRadiusM])
      )
    },
    inputTimeline: [{
      timeSeconds: 0,
      input: { requestedGear: 3, assists: { autoShift: false }, ...input }
    }],
    environmentProvider: ({ state }) => createRampEnvironment(config, state)
  });
  const durationSeconds = 2;
  for (let frame = 0; frame < durationSeconds * fps; frame += 1) runner.advance(1 / fps);
  runner.drainCatchUp();
  return runner;
}

test('Studio Sprint 2 takeoff telemetry is exact across render rates at 40, 60, and 80 mph', () => {
  for (const mph of [40, 60, 80]) {
    const baseline = runStudioSprint2Jump({ mph, fps: RENDER_FPS[0] });
    assert.equal(baseline.takeoffHistory.length > 0, true, `${mph} mph takeoff`);
    const takeoff = baseline.takeoffHistory[0];
    assert.equal(takeoff.rampId, 'studio-sprint-2-crest');
    assert.equal(Number.isFinite(takeoff.frontWheelReleaseTimeSeconds), true);
    assert.equal(Number.isFinite(takeoff.rearWheelReleaseTimeSeconds), true);
    assert.equal(takeoff.frontSuspensionImpulseBeforeReleaseNs > 0, true);
    assert.equal(takeoff.rearSuspensionImpulseBeforeReleaseNs > 0, true);
    assert.deepEqual(takeoff.underbodyContactsNearCrest, [],
      'wheel geometry should clear the authored crest without an underbody strike');
    assert.equal(Number.isFinite(takeoff.pitchAngularVelocityAtFinalContactRadps), true);
    assert.equal(takeoff.flightPitchSamples.length > 2, true);
    assert.equal(Number.isFinite(takeoff.landingOrientation?.pitchRad), true);
    const replay = VehicleDynamicsRunner.replay(baseline.createReplayRecord(), {
      environmentProvider: ({ state }) => createRampEnvironment(baseline.config, state)
    });
    assert.deepEqual(replay.takeoffHistory, baseline.takeoffHistory, `${mph} mph replay telemetry`);
    assert.deepEqual(replay.createStateSnapshot(), baseline.createStateSnapshot(),
      `${mph} mph replay state`);

    for (const fps of RENDER_FPS.slice(1)) {
      const candidate = runStudioSprint2Jump({ mph, fps });
      assert.deepEqual(candidate.takeoffHistory, baseline.takeoffHistory, `${mph} mph at ${fps} FPS`);
      assert.deepEqual(candidate.createStateSnapshot(), baseline.createStateSnapshot(),
        `${mph} mph final state at ${fps} FPS`);
    }
  }
});

test('torque-free airborne pitch remains constant without auto-leveling or unsupported yaw', () => {
  const config = createVehicleDynamicsConfig({
    chassisHz: 120,
    tireHz: 360,
    handlingPreset: 'simulation',
    telemetryRetention: 'history'
  });
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: {
      position: { x: 0, y: 20, z: 0 },
      orientation: quaternionFromEuler({ pitch: 0.18 }),
      velocity: { x: 0, y: 0, z: 20 },
      speedMps: 20,
      grounded: false
    },
    inputTimeline: [{ timeSeconds: 0, input: { steering: 1, requestedGear: 0 } }],
    environmentProvider: () => ({ airDensityKgM3: 0, grounded: false })
  });
  runner.advance(0.5);
  runner.drainCatchUp();

  assert.ok(Math.abs(runner.state.pitchRad - 0.18) < 1e-6);
  assert.equal(runner.state.yawRateRadps, 0);
  assert.equal(runner.state.angularVelocityWorld.x, 0);
  assert.equal(runner.state.angularVelocityWorld.y, 0);

  const rotating = new VehicleDynamicsRunner({
    config,
    initialState: {
      position: { x: 0, y: 20, z: 0 },
      orientation: quaternionFromEuler({ pitch: 0.18 }),
      angularVelocityWorld: { x: 0.25, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 20 },
      speedMps: 20,
      grounded: false
    },
    inputTimeline: [{ timeSeconds: 0, input: { requestedGear: 0 } }],
    environmentProvider: () => ({ airDensityKgM3: 0, grounded: false })
  });
  rotating.advance(0.5);
  rotating.drainCatchUp();
  assert.ok(Math.abs(rotating.state.angularVelocityWorld.x - 0.25) < 1e-6,
    'torque-free pitch angular velocity must be conserved');
  assert.ok(rotating.state.pitchRad > 0.18,
    'conserved angular momentum must rotate the body instead of auto-leveling it');
});

test('airborne throttle and braking change chassis pitch only through wheel momentum reaction', () => {
  const coast = runStudioSprint2Jump({ mph: 60, fps: 120 });
  const throttle = runStudioSprint2Jump({ mph: 60, fps: 120, input: { throttle: 1 } });
  const brake = runStudioSprint2Jump({ mph: 60, fps: 120, input: { brake: 1 } });
  const coastTakeoff = coast.takeoffHistory[0];
  const airborneSample = (runner) => runner.takeoffHistory[0].flightPitchSamples.at(-2);

  assert.ok(coastTakeoff);
  assert.notEqual(airborneSample(throttle).pitchAngularVelocityRadps,
    airborneSample(coast).pitchAngularVelocityRadps);
  assert.notEqual(airborneSample(brake).pitchAngularVelocityRadps,
    airborneSample(coast).pitchAngularVelocityRadps);
  assert.notEqual(throttle.state.wheelAngularVelocityRadps.fl,
    brake.state.wheelAngularVelocityRadps.fl);
});
