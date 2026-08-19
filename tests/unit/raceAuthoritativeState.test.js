import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyRaceVehicleImpactEvents,
  calculateAuthoritativeRouteAdvance
} from '../../src/racing/RaceSimulation.js';
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

test('terrain impact damage applies once per matching reset generation', () => {
  const damage = [];
  const editor = {
    applyRaceDamage(part, amount, details) {
      damage.push({ part, amount, details });
    }
  };
  const session = {
    vehicleRenderState: { resetGeneration: 7 },
    vehicleDynamicsRunner: { config: { massKg: 1450 } },
    carYaw: 0
  };
  const impact = {
    sequence: 4,
    stepIndex: 120,
    resetGeneration: 7,
    terrainImpact: true,
    normalImpulseNs: 14500,
    preImpactNormalSpeedMps: 12,
    normalWorld: { x: 0.1, y: 0.4, z: -0.91 },
    pointWorld: { x: 2, y: 0.3, z: 10 },
    vehicleYawRad: 0
  };

  assert.equal(applyRaceVehicleImpactEvents(editor, session, [impact]), 1);
  assert.equal(applyRaceVehicleImpactEvents(editor, session, [impact]), 0);
  assert.equal(applyRaceVehicleImpactEvents(editor, session, [{
    ...impact, sequence: 5, resetGeneration: 6
  }]), 0);
  assert.equal(applyRaceVehicleImpactEvents(editor, session, [{
    ...impact,
    sequence: 5,
    normalImpulseNs: 553.5,
    preImpactNormalSpeedMps: 1.65,
    recoveredCoupledCorrection: true
  }]), 1);
  assert.equal(damage.length, 2);
  assert.equal(damage[0].part, 'panels');
  assert.deepEqual(damage[0].details.keys, ['front']);
  assert.equal(damage[0].details.source, 'terrain-impact');
  assert.equal(session.latestVehicleImpactEvent.sequence, 5);
  assert.equal(session.latestVehicleImpactEvent.recoveredCoupledCorrection, true);
});
