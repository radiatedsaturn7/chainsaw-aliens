import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VehicleDynamicsRunner,
  createVehicleDynamicsConfigFromTuning
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {
  WRX_2022_SHARED_TUNING,
  WRX_2022_TRANSMISSIONS
} from '../../src/racing/raceData.js';

const WRX2_CONFIG = createVehicleDynamicsConfigFromTuning({
  ...WRX_2022_SHARED_TUNING,
  ...WRX_2022_TRANSMISSIONS.automatic
});
const FLAT = Object.freeze({ fl: 0, fr: 0, rl: 0, rr: 0 });
const CLASSIFICATIONS = new Set([
  null,
  'geometric traction rollover',
  'curb/step trip rollover',
  'sidewall trip',
  'body-collider trip',
  'landing rollover',
  'numerical/contact instability'
]);

const maneuvers = [
  { name: 'flat asphalt constant-radius skidpad', speed: 22,
    input: () => ({ steering: 0.72, throttle: 0.18 }), flat: true },
  { name: 'flat dirt skidpad', speed: 20,
    input: () => ({ steering: 0.78, throttle: 0.2 }), flat: true, dirt: true },
  { name: 'J-turn', speed: 24,
    input: (time) => ({ steering: time < 0.25 ? 0 : 0.9, throttle: 0.08 }) },
  { name: 'fishhook', speed: 25,
    input: (time) => ({ steering: time < 0.3 ? 0.8 : -0.9, throttle: 0.08 }) },
  { name: 'slalom', speed: 21,
    input: (time) => ({ steering: Math.sin(time * Math.PI * 3) * 0.72, throttle: 0.15 }) },
  { name: 'lift-throttle transition', speed: 23,
    input: (time) => ({ steering: 0.62, throttle: time < 0.45 ? 0.45 : 0 }) },
  { name: 'handbrake turn', speed: 20,
    input: (time) => ({ steering: 0.7, throttle: 0.1, handbrake: time > 0.3 ? 1 : 0 }) },
  { name: 'smooth bank transition', speed: 20,
    input: () => ({ steering: 0.3, throttle: 0.16 }), bank: true },
  { name: 'smooth hill', speed: 20,
    input: () => ({ throttle: 0.3 }), hill: true },
  { name: 'one-wheel curb strike', speed: 17,
    input: () => ({ steering: 0.08, throttle: 0.15 }), curbWheels: ['fl'] },
  { name: 'two-wheel curb strike', speed: 17,
    input: () => ({ throttle: 0.15 }), curbWheels: ['fl', 'fr'] },
  { name: 'sidewall strike', speed: 16,
    input: () => ({ steering: 0.2, throttle: 0.1 }), sidewallStrike: true },
  { name: 'jump landing', speed: 20,
    input: () => ({ steering: 0.18 }), jump: true }
];

function runManeuver(fixture) {
  const samples = {
    maximumSlip: 0,
    maximumRollRad: 0,
    wheelCcdActivations: 0,
    bodyCollisionRollImpulse: 0,
    sidewallRollImpulse: 0,
    leadingTreadRollImpulse: 0,
    unexplainedCollisionRollImpulse: 0,
    classifications: new Set()
  };
  const initialState = fixture.jump ? {
    position: { x: 0, y: 1.4, z: 0 },
    velocity: { x: 0, y: -2.5, z: fixture.speed },
    speedMps: fixture.speed,
    grounded: false
  } : {
    velocity: { x: 0, y: 0, z: fixture.speed }, speedMps: fixture.speed
  };
  const runner = new VehicleDynamicsRunner({
    config: { ...WRX2_CONFIG, telemetryRetention: 'transient' },
    initialState,
    inputTimeline: Array.from({ length: 181 }, (_unused, step) => ({
      timeSeconds: step / 120,
      input: { requestedGear: 3, assists: {
        absEnabled: true, tractionControlEnabled: true,
        stabilityControlEnabled: true, autoShift: false
      }, ...fixture.input(step / 120) }
    })),
    environmentProvider: ({ timeSeconds }) => {
      const heights = { ...FLAT };
      if (fixture.curbWheels && timeSeconds >= 0.3 && timeSeconds <= 0.7) {
        for (const wheelId of fixture.curbWheels) heights[wheelId] = 0.12;
      }
      const environment = { surfaceHeightByWheel: heights };
      if (fixture.dirt) environment.materialByWheel = Object.fromEntries(
        ['fl', 'fr', 'rl', 'rr'].map((wheelId) => [wheelId, { surface: 'dirt', friction: 0.62 }])
      );
      if (fixture.bank) environment.surfaceNormalByWheel = Object.fromEntries(
        ['fl', 'fr', 'rl', 'rr'].map((wheelId) => [wheelId, { x: 0.12, y: 0.992774, z: 0 }])
      );
      if (fixture.hill) environment.surfaceNormalByWheel = Object.fromEntries(
        ['fl', 'fr', 'rl', 'rr'].map((wheelId) => [wheelId, { x: 0, y: 0.995037, z: -0.099504 }])
      );
      return environment;
    }
  });
  for (let step = 0; step < 180; step += 1) {
    if (fixture.sidewallStrike && step === 45) runner.queueCollisionImpulse({
      impulseWorldNs: { x: 9000, y: 1800, z: -500 },
      pointWorld: { x: -0.9, y: -0.1, z: 0.7 },
      source: 'wheel-sidewall-collision'
    });
    runner.advance(1 / 120, { onFixedStep: (telemetry) => {
      const rollover = telemetry.forces.rollover;
      samples.maximumSlip = Math.max(samples.maximumSlip,
        ...Object.values(telemetry.state.wheelSlip || {}).map((value) => Math.abs(Number(value || 0))));
      samples.maximumRollRad = Math.max(samples.maximumRollRad, Math.abs(rollover.rollAngleRad));
      samples.wheelCcdActivations += Number(telemetry.forces.bodyCollision?.wheelCylinderSweeps?.length || 0);
      samples.bodyCollisionRollImpulse += Math.abs(
        Number(rollover.sources.bodyCollision.rollAngularImpulseNms || 0)
      );
      samples.sidewallRollImpulse += Math.abs(
        Number(rollover.sources.wheelSidewallCollision.rollAngularImpulseNms || 0)
      );
      samples.leadingTreadRollImpulse += Math.abs(
        Number(rollover.sources.wheelLeadingTreadCollision.rollAngularImpulseNms || 0)
      );
      if (rollover.classification) samples.classifications.add(rollover.classification);
      assert.equal(CLASSIFICATIONS.has(rollover.classification), true);
      assert.equal(rollover.cgHeightM, 0.54);
      assert.ok(Number.isFinite(rollover.rollVelocityRadps));
      assert.ok(Array.isArray(rollover.effectiveSupportPolygon));
      assert.ok(Array.isArray(rollover.contactFeatures));
    } });
  }
  return samples;
}

for (const fixture of maneuvers) {
  test(`WRX2 rollover forensics: ${fixture.name}`, () => {
    const result = runManeuver(fixture);
    if (fixture.flat) {
      assert.ok(result.maximumSlip > 0.05, `expected tire sliding, got slip ${result.maximumSlip}`);
      assert.ok(result.maximumRollRad < Math.PI / 4, `untripped rollover ${result.maximumRollRad}`);
      assert.equal(result.wheelCcdActivations, 0);
      assert.equal(result.bodyCollisionRollImpulse, 0);
      assert.equal(result.unexplainedCollisionRollImpulse, 0);
    }
    if (fixture.sidewallStrike) {
      assert.ok(result.sidewallRollImpulse > 0);
      assert.equal(result.bodyCollisionRollImpulse, 0);
    }
  });
}
