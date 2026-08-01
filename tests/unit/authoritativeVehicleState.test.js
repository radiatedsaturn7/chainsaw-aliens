import assert from 'node:assert/strict';
import test from 'node:test';
import { HandlingAssist } from '../../src/racing/simulation/HandlingAssist.js';
import {
  eulerFromQuaternion,
  integrateQuaternion,
  quaternionFromEuler
} from '../../src/racing/simulation/RigidBodyMath.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { syncVehicleDynamicsCompatibilityOutputs } from '../../src/racing/simulation/VehicleState.js';

test('quaternion integration owns yaw, pitch, and roll compatibility outputs', () => {
  let orientation = quaternionFromEuler({ yaw: 0.4, pitch: -0.1, roll: 0.15 });
  const initial = eulerFromQuaternion(orientation);
  assert.ok(Math.abs(initial.yaw - 0.4) < 1e-9);
  assert.ok(Math.abs(initial.pitch + 0.1) < 1e-9);
  assert.ok(Math.abs(initial.roll - 0.15) < 1e-9);
  orientation = integrateQuaternion(orientation, { x: 0.1, y: 0.2, z: -0.05 }, 1 / 120);
  assert.ok(Math.abs(Math.hypot(orientation.x, orientation.y, orientation.z, orientation.w) - 1) < 1e-12);
});

test('Simulation has no hidden stabilization while other presets report physical interventions', () => {
  const assist = new HandlingAssist();
  const context = {
    state: { speedMps: 24, angularVelocityWorld: { x: 0, y: 1.2, z: 0.4 } },
    controls: { steering: 0.1, handbrake: 1 },
    config: { yawInertiaKgM2: 2200 }
  };
  assert.deepEqual(assist.calculatePhysicalInterventions({ ...context, preset: 'simulation' }), []);
  for (const preset of ['sport', 'accessible']) {
    const interventions = assist.calculatePhysicalInterventions({ ...context, preset });
    assert.ok(interventions.length >= 2);
    assert.ok(interventions.some((entry) => entry.trigger === 'handbrake-rotation'));
    interventions.forEach((entry) => {
      assert.equal(entry.source, 'handling-assist');
      assert.ok(entry.trigger);
      assert.ok(Number.isFinite(entry.requestedValue));
      assert.ok(Number.isFinite(entry.appliedValue));
      assert.ok(entry.physicalEffect.startsWith('body-moment-'));
    });
  }
});

test('airborne support suppresses applied handling-assist moments without hiding requests', () => {
  const assist = new HandlingAssist();
  const interventions = assist.calculatePhysicalInterventions({
    preset: 'sport',
    state: { speedMps: 24, angularVelocityWorld: { x: 0, y: 1.2, z: 0.4 } },
    controls: { steering: 0.1, handbrake: 1 },
    config: { yawInertiaKgM2: 2200 },
    supportScale: 0
  });
  assert.ok(interventions.length >= 2);
  interventions.forEach((entry) => {
    assert.equal(entry.appliedValue, 0);
    assert.equal(entry.supportScale, 0);
    assert.equal(entry.suppressionReason, 'airborne-contact');
    assert.deepEqual(entry.momentWorldNm, { x: 0, y: 0, z: 0 });
  });
});

test('collision impulses change authoritative velocity and angular velocity at their application point', () => {
  const runner = new VehicleDynamicsRunner({
    config: { massKg: 1000, handlingPreset: 'simulation' },
    initialState: { position: { x: 0, y: 0, z: 0 } },
    inputTimeline: [{ timeSeconds: 0, input: {} }]
  });
  runner.queueCollisionImpulse({ impulseWorldNs: { x: 1000, y: 0, z: 0 }, pointWorld: { x: 0, y: 0, z: 1 } });
  runner.advance(1 / 120);
  assert.ok(runner.state.velocity.x > 0.9);
  assert.notEqual(runner.state.angularVelocityWorld.y, 0);
  assert.equal(runner.telemetry[0].forces.collisionImpulses.length, 1);
});

test('legacy pose fields are derived from the runner state in one synchronization boundary', () => {
  const runner = new VehicleDynamicsRunner({
    initialState: {
      position: { x: 3, y: 1.2, z: -4 },
      velocity: { x: 2, y: 0.5, z: 5 },
      yawRad: 0.3,
      pitchRad: 0.1,
      rollRad: -0.2,
      engineRpm: 4200,
      gear: 3
    }
  });
  const session = {};
  syncVehicleDynamicsCompatibilityOutputs(runner, session);
  assert.equal(session.worldX, 3);
  assert.equal(session.worldY, 1.2);
  assert.equal(session.worldZ, -4);
  assert.equal(session.carYaw, 0.3);
  assert.equal(session.engineRpm, 4200);
  assert.equal(session.vehicleDynamicsRunner, runner);
});
