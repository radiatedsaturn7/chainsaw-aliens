import assert from 'node:assert/strict';
import test from 'node:test';

import {
  integrateBodyAngularMotion,
  multiplyBodyInertia,
  quaternionFromEuler,
  rotateVectorByQuaternion,
  rotateVectorToBody
} from '../../src/racing/simulation/RigidBodyMath.js';

const TENSOR = Object.freeze({ xx: 2280, xy: 0, xz: -18, yy: 2640, yz: 0, zz: 690 });
const DT = 1 / 360;
const magnitude = (value) => Math.hypot(value.x, value.y, value.z);
const quaternionLength = (value) => Math.hypot(value.x, value.y, value.z, value.w);

function tumble(orientation, angularVelocityWorld, steps = 3600) {
  let state = { orientation, angularVelocityWorld };
  let minimumEnergy = Infinity;
  let maximumEnergy = 0;
  for (let index = 0; index < steps; index += 1) {
    state = integrateBodyAngularMotion({
      ...state,
      angularImpulseWorld: { x: 0, y: 0, z: 0 },
      inertiaTensorBody: TENSOR,
      dt: DT
    });
    const omegaBody = rotateVectorToBody(state.angularVelocityWorld, state.orientation);
    const momentum = multiplyBodyInertia(TENSOR, omegaBody);
    const energy = 0.5 * (
      omegaBody.x * momentum.x + omegaBody.y * momentum.y + omegaBody.z * momentum.z
    );
    minimumEnergy = Math.min(minimumEnergy, energy);
    maximumEnergy = Math.max(maximumEnergy, energy);
    assert.ok(Object.values(state.orientation).every(Number.isFinite));
    assert.ok(Object.values(state.angularVelocityWorld).every(Number.isFinite));
    assert.ok(Math.abs(quaternionLength(state.orientation) - 1) < 1e-10);
  }
  return { ...state, minimumEnergy, maximumEnergy };
}

test('asymmetric torque-free tumbling remains finite in arbitrary orientations', () => {
  for (const euler of [
    { yaw: 0, pitch: 0, roll: 0 },
    { yaw: 1.1, pitch: -0.7, roll: 0.45 },
    { yaw: -2.2, pitch: 1.2, roll: -1.4 }
  ]) {
    const orientation = quaternionFromEuler(euler);
    const angularVelocityWorld = rotateVectorByQuaternion({ x: 0.8, y: 1.3, z: 2.1 }, orientation);
    const result = tumble(orientation, angularVelocityWorld);
    assert.ok(result.maximumEnergy / result.minimumEnergy < 1.08);
    assert.ok(magnitude(result.angularVelocityWorld) < 5);
  }
});

test('off-principal-axis rotation includes gyroscopic coupling', () => {
  const initial = { x: 0.8, y: 1.3, z: 2.1 };
  const result = integrateBodyAngularMotion({
    orientation: quaternionFromEuler({}),
    angularVelocityWorld: initial,
    angularImpulseWorld: {},
    inertiaTensorBody: TENSOR,
    dt: 1 / 120
  });
  assert.notEqual(result.angularVelocityBody.x, initial.x);
  assert.notEqual(result.angularVelocityBody.y, initial.y);
  assert.notEqual(result.angularVelocityBody.z, initial.z);
});

test('rotating body, torque, and angular velocity together rotates the response', () => {
  const frame = quaternionFromEuler({ yaw: 0.9, pitch: -0.35, roll: 0.6 });
  const baseOmega = { x: 0.4, y: -0.7, z: 0.9 };
  const baseImpulse = { x: 12, y: 5, z: -8 };
  const base = integrateBodyAngularMotion({
    orientation: quaternionFromEuler({}),
    angularVelocityWorld: baseOmega,
    angularImpulseWorld: baseImpulse,
    inertiaTensorBody: TENSOR,
    dt: 1 / 120
  });
  const rotated = integrateBodyAngularMotion({
    orientation: frame,
    angularVelocityWorld: rotateVectorByQuaternion(baseOmega, frame),
    angularImpulseWorld: rotateVectorByQuaternion(baseImpulse, frame),
    inertiaTensorBody: TENSOR,
    dt: 1 / 120
  });
  const expected = rotateVectorByQuaternion(base.angularVelocityWorld, frame);
  assert.ok(magnitude({
    x: rotated.angularVelocityWorld.x - expected.x,
    y: rotated.angularVelocityWorld.y - expected.y,
    z: rotated.angularVelocityWorld.z - expected.z
  }) < 1e-9);
});
