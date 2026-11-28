import assert from 'node:assert/strict';
import test from 'node:test';
import { ContactPatchTireModel } from '../../src/racing/simulation/ContactPatchTireModel.js';
import { VehicleDynamicsRunner, createVehicleDynamicsConfig } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const wheels = ['fl', 'fr', 'rl', 'rr'];
const input = { throttle: 0, brake: 0, requestedGear: 0 };
const controls = { ...input, clutch: 1, steering: 0 };
const sample = () => ({ valid: true, heightM: 0, normal: { x: 0, y: 1, z: 0 },
  region: 'road', source: 'bottom-out-regression', triangleId: 1 });
const environment = { sampleTerrainAtWorldPoint: sample,
  sampleTerrainAtWorldPoints: points => points.map(sample), requireValidTerrainEnvelope: true };

function fixture(tireHz = 120) {
  // Short-travel road car matching the important dimensions of the recorded
  // Forgetmenot incident; no dependency on mutable saved car/capture files.
  const config = createVehicleDynamicsConfig({ massKg: 1488, cgHeightM: 0.51,
    wheelbaseM: 2.54, frontWeightDistribution: 0.59, wheelRadiusM: 0.31715,
    suspensionTravelFrontM: 0.0873, suspensionTravelRearM: 0.0873,
    suspensionSpringRateFrontNpm: 36740, suspensionSpringRateRearNpm: 36128,
    suspensionBumpDamperFrontNsM: 4952, suspensionBumpDamperRearNsM: 4949,
    suspensionReboundDamperFrontNsM: 5330, suspensionReboundDamperRearNsM: 5327,
    tireHz, chassisHz: 120, telemetryRetention: 'latest' });
  const runner = new VehicleDynamicsRunner({ config,
    initialState: { position: { x: 0, y: config.cgHeightM, z: 0 } },
    environmentProvider: () => environment });
  for (let i = 0; i < 120; i++) runner.advance(1 / 120, { input });
  return { config, base: runner.createStateSnapshot() };
}

function displaced(base, depth) {
  const state = structuredClone(base);
  state.position.y -= depth;
  state.velocity.y = -0.1;
  for (const wheel of wheels) state.suspensionState[wheel].verticalCoupledActive = true;
  return state;
}

test('moving bottomed-out tires develop increasing support with ground penetration', () => {
  const { config, base } = fixture();
  const loads = [];
  for (const depth of [0.06, 0.10, 0.15]) {
    const state = displaced(base, depth);
    const model = new ContactPatchTireModel();
    let result;
    // Fixed chassis pose isolates the contact force response from body motion.
    for (let i = 0; i < 120; i++) {
      result = model.step({ state, controls, config, environment, dt: 1 / 120 });
      state.suspensionState = structuredClone(result.suspensionState);
      state.contactPatches = structuredClone(result.contactPatches);
    }
    loads.push(result.contactPatches.fl.chassisSupportLoadN);
    assert.ok(result.contactPatches.fl.overtravelM > 0);
  }
  assert.ok(loads[1] > loads[0] * 1.3, JSON.stringify(loads));
  assert.ok(loads[2] > loads[1] * 1.3, JSON.stringify(loads));
});

test('collision contact rebuild preserves restoring force beyond suspension travel', () => {
  const { config, base } = fixture();
  const loads = [0.08, 0.12].map(depth => {
    const state = displaced(base, depth);
    for (const wheel of wheels) state.suspensionState[wheel].compressionM = 0.04;
    const before = structuredClone(state.suspensionState);
    const result = new ContactPatchTireModel().step({ state, controls, config, environment,
      dt: 1 / 120, collisionContactRebuild: true });
    for (const wheel of wheels) {
      assert.equal(result.suspensionState[wheel].compressionM, before[wheel].compressionM);
      assert.equal(result.suspensionState[wheel].unsprungVelocityMps, before[wheel].unsprungVelocityMps);
    }
    return result.contactPatches.fl.chassisSupportLoadN;
  });
  assert.ok(loads[1] > loads[0] * 1.2, JSON.stringify(loads));
});

test('short-travel car recovers ride height and settles after bottoming at multiple tire rates', () => {
  for (const tireHz of [120, 240, 360]) {
    const { config, base } = fixture(tireHz);
    const runner = new VehicleDynamicsRunner({ config, initialState: displaced(base, 0.10),
      environmentProvider: () => environment });
    const tail = [];
    for (let i = 0; i < 120 * 8; i++) {
      runner.advance(1 / 120, { input });
      if (i >= 120 * 6) tail.push({ y: runner.state.position.y, pitch: runner.state.pitchRad });
    }
    const state = runner.state;
    assert.ok(state.position.y > config.cgHeightM - 0.04, `${tireHz} Hz height ${state.position.y}`);
    for (const wheel of wheels) assert.ok(state.contactPatches[wheel].overtravelM < 0.005);
    assert.ok(Math.max(...tail.map(s => s.y)) - Math.min(...tail.map(s => s.y)) < 0.01);
    assert.ok(Math.max(...tail.map(s => s.pitch)) - Math.min(...tail.map(s => s.pitch)) < 0.01);
    assert.equal(state.contactStabilization?.gameplayResetCount || 0, 0);
  }
});
