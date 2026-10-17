import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRaceWaterRegions, calculateRaceWaterForces, raceWaterMeshes } from '../../src/racing/simulation/RaceWater.js';
import { DamageModel } from '../../src/racing/simulation/DamageModel.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { createVehicleRenderSnapshotFromRunner } from '../../src/racing/simulation/VehicleDynamicsWorkerAuthority.js';
import { createVehicleRenderSnapshotBuffer, writeVehicleRenderSnapshot, readVehicleRenderSnapshot } from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';

const config = { massKg: 1400, cgHeightM: 0.55, trackWidthM: 1.6 };
const region = levelM => normalizeRaceWaterRegions([{ x: 0, z: 0, widthM: 30, lengthM: 30, levelM, bottomM: -2 }]);
const state = (y = 0.55, speed = 10) => ({ position: { x: 0, y, z: 0 }, velocity: { x: 0, y: 0, z: speed } });

test('shallow water slows the car without damaging the engine or creating propulsive force', () => {
  const result = calculateRaceWaterForces({ state: state(), config, regions: region(0.2), dt: 1 / 240 });
  assert.equal(result.engineDamage, 0); assert.ok(Math.abs(result.depthM - 0.2) < 1e-9);
  assert.ok(result.forceWorldN.z < 0); assert.equal(result.forceWorldN.x, 0);
  const reverse = calculateRaceWaterForces({ state: state(0.55, -10), config, regions: region(0.2), dt: 1 / 240 });
  assert.ok(reverse.forceWorldN.z > 0);
});

test('deep water destroys the engine and leaving the volume does not repair it', () => {
  const flooded = calculateRaceWaterForces({ state: state(), config, regions: region(1), dt: 1 / 240 });
  assert.equal(flooded.engineDamage, 100);
  const outside = state(); outside.position.x = 100;
  const dry = calculateRaceWaterForces({ state: outside, config, regions: region(1), dt: 1 / 240, previousEngineDamage: flooded.engineDamage });
  assert.equal(dry.depthM, 0); assert.equal(dry.engineDamage, 100);
  assert.equal(new DamageModel().getEffects({ engine: dry.engineDamage }).enginePower, 0);
});

test('water does not affect a car above it on a bridge or beneath its bed in a tunnel', () => {
  for (const y of [6.55, -5]) {
    const result = calculateRaceWaterForces({ state: state(y), config, regions: region(1), dt: 1 / 240 });
    assert.equal(result.depthM, 0); assert.equal(result.engineDamage, 0);
    assert.deepEqual(result.forceWorldN, { x: 0, y: 0, z: 0 });
  }
});

test('water drag cannot reverse velocity even at extreme speed or a long fixed step', () => {
  const result = calculateRaceWaterForces({ state: state(0.55, 200), config, regions: region(3), dt: 0.1 });
  assert.ok(200 + result.forceWorldN.z / config.massKg * 0.1 > 0);
  const regions = region(0.2), meshes = raceWaterMeshes(regions);
  assert.ok(meshes[0].points.every(p => p.elevation === 0.2 / 12));
  assert.deepEqual(normalizeRaceWaterRegions(JSON.parse(JSON.stringify(regions))), regions);
});

test('fixed physics steps latch flooding and carry 100% engine damage through worker snapshots', () => {
  const runner = new VehicleDynamicsRunner({ config: { ...config, telemetryRetention: 'none' }, initialState: state(),
    environmentProvider: () => ({ waterRegions: region(1), surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 } }) });
  runner.advance(1 / 60);
  assert.equal(runner.state.waterEngineDamage, 100);
  assert.ok(runner.state.waterDepthM > 0);
  const snapshot = createVehicleRenderSnapshotFromRunner(runner), buffer = createVehicleRenderSnapshotBuffer();
  writeVehicleRenderSnapshot(buffer, snapshot);
  assert.equal(readVehicleRenderSnapshot(buffer).waterEngineDamage, 100);
  assert.ok(readVehicleRenderSnapshot(buffer).waterDepthM > 0);
  runner.environmentProvider = () => ({ surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 } });
  runner.advance(1 / 60);
  assert.equal(runner.state.waterEngineDamage, 100);
});

test('leaving shallow water clears depth without requiring engine damage', () => {
  const runner = new VehicleDynamicsRunner({ config: { ...config, telemetryRetention: 'none' }, initialState: state(),
    environmentProvider: () => ({ waterRegions: region(0.2), surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 } }) });
  runner.advance(1 / 60);
  assert.ok(runner.state.waterDepthM > 0);
  assert.equal(runner.state.waterEngineDamage, 0);
  runner.environmentProvider = () => ({ surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 } });
  runner.advance(1 / 60);
  assert.equal(runner.state.waterDepthM, 0);
});
