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
