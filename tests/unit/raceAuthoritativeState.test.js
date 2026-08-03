import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAuthoritativeRouteAdvance } from '../../src/racing/RaceSimulation.js';
import { deterministicUnitFloat } from '../../src/racing/simulation/SimulationMath.js';

test('route progress follows authoritative world motion through arbitrary body slip', () => {
  const dt = 0.5;
  assert.equal(calculateAuthoritativeRouteAdvance({
    velocityWorld: { x: 0, z: 20 }, roadYaw: 0, seconds: dt
  }), 10);
  assert.equal(calculateAuthoritativeRouteAdvance({
    velocityWorld: { x: 0, z: -8 }, roadYaw: 0, seconds: dt
  }), -4);
  assert.ok(Math.abs(calculateAuthoritativeRouteAdvance({
    velocityWorld: { x: 10, z: 10 }, roadYaw: 0, seconds: dt
  }) - 5) < 1e-12);
  // Body yaw is intentionally absent: a 90-degree body slip travelling along
  // the road advances exactly like an aligned car.
  assert.equal(calculateAuthoritativeRouteAdvance({
    velocityWorld: { x: 0, z: 20 }, roadYaw: 0, seconds: dt
  }), 10);
  assert.ok(Math.abs(calculateAuthoritativeRouteAdvance({
    velocityWorld: { x: 12, z: 0 }, roadYaw: 0, seconds: dt
  })) < 1e-12);
  assert.ok(calculateAuthoritativeRouteAdvance({
    velocityWorld: { x: -5, z: 18 }, roadYaw: 0, seconds: dt
  }) > 0);
});

test('hazard damage variation is deterministic by race, vehicle, hazard, and sequence', () => {
  const first = deterministicUnitFloat('race-seed', 'wrx2', 'wall-4', 7);
  assert.equal(deterministicUnitFloat('race-seed', 'wrx2', 'wall-4', 7), first);
  assert.notEqual(deterministicUnitFloat('race-seed', 'wrx2', 'wall-4', 8), first);
  assert.notEqual(deterministicUnitFloat('race-seed', 'wrx2', 'wall-5', 7), first);
});
