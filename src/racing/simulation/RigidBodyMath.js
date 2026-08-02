const EPSILON = 1e-12;

export const addVector3 = (a = {}, b = {}) => ({
  x: Number(a.x || 0) + Number(b.x || 0),
  y: Number(a.y || 0) + Number(b.y || 0),
  z: Number(a.z || 0) + Number(b.z || 0)
});

export const scaleVector3 = (value = {}, scale = 1) => ({
  x: Number(value.x || 0) * scale,
  y: Number(value.y || 0) * scale,
  z: Number(value.z || 0) * scale
});

export const crossVector3 = (a = {}, b = {}) => ({
  x: Number(a.y || 0) * Number(b.z || 0) - Number(a.z || 0) * Number(b.y || 0),
  y: Number(a.z || 0) * Number(b.x || 0) - Number(a.x || 0) * Number(b.z || 0),
  z: Number(a.x || 0) * Number(b.y || 0) - Number(a.y || 0) * Number(b.x || 0)
});

export function normalizeQuaternion(value = {}) {
  const x = Number(value.x || 0);
  const y = Number(value.y || 0);
  const z = Number(value.z || 0);
  const w = Number(value.w ?? 1);
  const length = Math.hypot(x, y, z, w);
  if (length < EPSILON) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: x / length, y: y / length, z: z / length, w: w / length };
}

export function rotateVectorByQuaternion(value = {}, orientation = {}) {
  const q = normalizeQuaternion(orientation);
  const vector = {
    x: Number(value.x || 0),
    y: Number(value.y || 0),
    z: Number(value.z || 0)
  };
  const quaternionVector = { x: q.x, y: q.y, z: q.z };
  const twiceCross = scaleVector3(crossVector3(quaternionVector, vector), 2);
  return addVector3(
    vector,
    addVector3(
      scaleVector3(twiceCross, q.w),
      crossVector3(quaternionVector, twiceCross)
    )
  );
}

export function rotateVectorToBody(value = {}, orientation = {}) {
  const q = normalizeQuaternion(orientation);
  return rotateVectorByQuaternion(value, { x: -q.x, y: -q.y, z: -q.z, w: q.w });
}

export function normalizeBodyInertiaTensor(tensor = {}, fallback = {}) {
  return Object.freeze({
    xx: Math.max(EPSILON, Number(tensor.xx ?? fallback.xx ?? 1)),
    xy: Number(tensor.xy ?? fallback.xy ?? 0) || 0,
    xz: Number(tensor.xz ?? fallback.xz ?? 0) || 0,
    yy: Math.max(EPSILON, Number(tensor.yy ?? fallback.yy ?? 1)),
    yz: Number(tensor.yz ?? fallback.yz ?? 0) || 0,
    zz: Math.max(EPSILON, Number(tensor.zz ?? fallback.zz ?? 1))
  });
}

export function multiplyBodyInertia(tensor = {}, value = {}) {
  const x = Number(value.x || 0);
  const y = Number(value.y || 0);
  const z = Number(value.z || 0);
  return {
    x: tensor.xx * x + tensor.xy * y + tensor.xz * z,
    y: tensor.xy * x + tensor.yy * y + tensor.yz * z,
    z: tensor.xz * x + tensor.yz * y + tensor.zz * z
  };
}

export function inverseBodyInertiaMultiply(tensor = {}, value = {}) {
  const a = Number(tensor.xx || 0);
  const b = Number(tensor.xy || 0);
  const c = Number(tensor.xz || 0);
  const d = Number(tensor.yy || 0);
  const e = Number(tensor.yz || 0);
  const f = Number(tensor.zz || 0);
  const cofactor00 = d * f - e * e;
  const cofactor01 = c * e - b * f;
  const cofactor02 = b * e - c * d;
  const cofactor11 = a * f - c * c;
  const cofactor12 = b * c - a * e;
  const cofactor22 = a * d - b * b;
  const determinant = a * cofactor00 + b * cofactor01 + c * cofactor02;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }
  const inverseDeterminant = 1 / determinant;
  const x = Number(value.x || 0);
  const y = Number(value.y || 0);
  const z = Number(value.z || 0);
  return {
    x: (cofactor00 * x + cofactor01 * y + cofactor02 * z) * inverseDeterminant,
    y: (cofactor01 * x + cofactor11 * y + cofactor12 * z) * inverseDeterminant,
    z: (cofactor02 * x + cofactor12 * y + cofactor22 * z) * inverseDeterminant
  };
}

export function inverseInertiaWorldMultiply(value = {}, orientation = {}, tensor = {}) {
  const bodyValue = rotateVectorToBody(value, orientation);
  return rotateVectorByQuaternion(inverseBodyInertiaMultiply(tensor, bodyValue), orientation);
}

export function integrateBodyAngularMotion({
  orientation = {},
  angularVelocityWorld = {},
  angularImpulseWorld = {},
  inertiaTensorBody = {},
  dt = 0
} = {}) {
  const normalizedOrientation = normalizeQuaternion(orientation);
  const omegaBody = rotateVectorToBody(angularVelocityWorld, normalizedOrientation);
  const angularMomentumBody = multiplyBodyInertia(inertiaTensorBody, omegaBody);
  const gyroscopicTorqueBody = crossVector3(omegaBody, angularMomentumBody);
  const appliedImpulseBody = rotateVectorToBody(angularImpulseWorld, normalizedOrientation);
  const netImpulseBody = addVector3(
    appliedImpulseBody,
    scaleVector3(gyroscopicTorqueBody, -Math.max(0, Number(dt) || 0))
  );
  const nextOmegaBody = addVector3(
    omegaBody,
    inverseBodyInertiaMultiply(inertiaTensorBody, netImpulseBody)
  );
  const omegaWorldForOrientation = rotateVectorByQuaternion(nextOmegaBody, normalizedOrientation);
  const nextOrientation = integrateQuaternion(normalizedOrientation, omegaWorldForOrientation, dt);
  return {
    orientation: nextOrientation,
    angularVelocityBody: nextOmegaBody,
    angularVelocityWorld: rotateVectorByQuaternion(nextOmegaBody, nextOrientation),
    angularMomentumBody,
    gyroscopicTorqueBody
  };
}

export function quaternionFromEuler({ yaw = 0, pitch = 0, roll = 0 } = {}) {
  const multiply = (a, b) => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  });
  const yawQ = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
  const pitchQ = { x: Math.sin(pitch / 2), y: 0, z: 0, w: Math.cos(pitch / 2) };
  const rollQ = { x: 0, y: 0, z: Math.sin(roll / 2), w: Math.cos(roll / 2) };
  return normalizeQuaternion(multiply(multiply(yawQ, pitchQ), rollQ));
}

export function integrateQuaternion(orientation = {}, angularVelocity = {}, dt = 0) {
  const q = normalizeQuaternion(orientation);
  const wx = Number(angularVelocity.x || 0);
  const wy = Number(angularVelocity.y || 0);
  const wz = Number(angularVelocity.z || 0);
  const halfDt = dt * 0.5;
  return normalizeQuaternion({
    x: q.x + halfDt * (wx * q.w + wy * q.z - wz * q.y),
    y: q.y + halfDt * (-wx * q.z + wy * q.w + wz * q.x),
    z: q.z + halfDt * (wx * q.y - wy * q.x + wz * q.w),
    w: q.w + halfDt * (-wx * q.x - wy * q.y - wz * q.z)
  });
}

export function eulerFromQuaternion(value = {}) {
  const q = normalizeQuaternion(value);
  const yaw = Math.atan2(
    2 * (q.x * q.z + q.y * q.w),
    1 - 2 * (q.x * q.x + q.y * q.y)
  );
  const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (q.x * q.w - q.y * q.z))));
  const roll = Math.atan2(
    2 * (q.x * q.y + q.z * q.w),
    1 - 2 * (q.x * q.x + q.z * q.z)
  );
  return { yaw, pitch, roll };
}
