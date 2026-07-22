const WHEEL_IDS = ['fl', 'fr', 'rl', 'rr'];
const FRONT_WHEELS = new Set(['fl', 'fr']);
const RIGHT_WHEELS = new Set(['fr', 'rr']);
const DEFAULT_ELEVATION_SCALE_M = 12;
const FIXED_STEP_SECONDS = 1 / 120;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const hypot3 = (x = 0, y = 0, z = 0) => Math.hypot(Number(x) || 0, Number(y) || 0, Number(z) || 0);

const normalize3 = (vector = {}, fallback = { x: 0, y: 1, z: 0 }) => {
  const x = Number(vector.x || 0);
  const y = Number(vector.y ?? 0);
  const z = Number(vector.z || 0);
  const length = hypot3(x, y, z);
  if (length <= 0.000001) return { ...fallback };
  return { x: x / length, y: y / length, z: z / length };
};

const dot3 = (a = {}, b = {}) => (
  Number(a.x || 0) * Number(b.x || 0)
  + Number(a.y || 0) * Number(b.y ?? 0)
  + Number(a.z || 0) * Number(b.z || 0)
);

const cross3 = (a = {}, b = {}) => ({
  x: Number(a.y || 0) * Number(b.z || 0) - Number(a.z || 0) * Number(b.y ?? 0),
  y: Number(a.z || 0) * Number(b.x || 0) - Number(a.x || 0) * Number(b.z || 0),
  z: Number(a.x || 0) * Number(b.y ?? 0) - Number(a.y || 0) * Number(b.x || 0)
});

const addScaled3 = (target = {}, vector = {}, scale = 1) => ({
  x: Number(target.x || 0) + Number(vector.x || 0) * scale,
  y: Number(target.y || 0) + Number(vector.y ?? 0) * scale,
  z: Number(target.z || 0) + Number(vector.z || 0) * scale
});

const rotateLocalToWorld = (local = {}, pose = {}) => {
  const yaw = Number(pose.yaw || 0);
  const pitch = Number(pose.pitch || 0);
  const roll = Number(pose.roll || 0);
  const sx = Math.sin(pitch);
  const cx = Math.cos(pitch);
  const sz = Math.sin(roll);
  const cz = Math.cos(roll);
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const x0 = Number(local.x || 0);
  const y0 = Number(local.y ?? 0);
  const z0 = Number(local.z || 0);
  const x1 = x0;
  const y1 = y0 * cx - z0 * sx;
  const z1 = y0 * sx + z0 * cx;
  const x2 = x1 * cz - y1 * sz;
  const y2 = x1 * sz + y1 * cz;
  const z2 = z1;
  return {
    x: x2 * cy + z2 * sy,
    y: y2,
    z: -x2 * sy + z2 * cy
  };
};

const makeWheelAttachmentPoints = ({ wheelbaseM = 2.7, trackFrontM = 1.55, trackRearM = 1.55, rideHeightM = 0.28 } = {}) => ({
  fl: { x: trackFrontM * 0.5, y: -rideHeightM * 0.15, z: wheelbaseM * 0.5 },
  fr: { x: -trackFrontM * 0.5, y: -rideHeightM * 0.15, z: wheelbaseM * 0.5 },
  rl: { x: trackRearM * 0.5, y: -rideHeightM * 0.15, z: -wheelbaseM * 0.5 },
  rr: { x: -trackRearM * 0.5, y: -rideHeightM * 0.15, z: -wheelbaseM * 0.5 }
});

export function getRaceVehicleWheelAttachments(tuning = {}, carDimensions = {}) {
  const wheelbaseM = Math.max(2.1, Number(tuning.wheelbaseM) || Number(carDimensions.wheelbaseM) || 2.7);
  const trackFrontM = Math.max(1.2, Number(tuning.trackFrontM) || Number(carDimensions.trackFrontM) || Number(tuning.trackWidthM) || Number(carDimensions.trackWidthM) || 1.55);
  const trackRearM = Math.max(1.2, Number(tuning.trackRearM) || Number(carDimensions.trackRearM) || Number(tuning.trackWidthM) || Number(carDimensions.trackWidthM) || 1.55);
  const rideHeightM = clamp(((Number(tuning.rideHeightFront) || 0.18) + (Number(tuning.rideHeightRear) || 0.18)) * 0.5, 0.1, 0.65);
  return makeWheelAttachmentPoints({ wheelbaseM, trackFrontM, trackRearM, rideHeightM });
}

export function createRaceVehiclePhysicsState({
  session = {},
  tuning = {},
  carDimensions = {},
  surfaceModel = null,
  elevationScaleM = DEFAULT_ELEVATION_SCALE_M
} = {}) {
  const yaw = Number(session.carYaw ?? session.velocityYaw ?? 0);
  const speedMps = Number(session.speedMps || 0);
  const velocityYaw = Number(session.velocityYaw ?? yaw);
  const attachments = getRaceVehicleWheelAttachments(tuning, carDimensions);
  const rideHeightM = clamp(((Number(tuning.rideHeightFront) || 0.18) + (Number(tuning.rideHeightRear) || 0.18)) * 0.5, 0.1, 0.65);
  const worldX = Number(session.worldX || 0);
  const worldZ = Number(session.worldZ || 0);
  const sampleSurface = (x, z) => surfaceModel?.sampleWorld?.({ x, z }, 0) || { elevation: 0, normal: { x: 0, y: 1, z: 0 }, region: 'terrain', surfaceId: 'asphalt', friction: 1 };
  const wheelSamples = Object.fromEntries(WHEEL_IDS.map((wheelId) => {
    const local = attachments[wheelId];
    const rotated = rotateLocalToWorld(local, { yaw, pitch: 0, roll: 0 });
    const world = { x: worldX + rotated.x, z: worldZ + rotated.z };
    return [wheelId, sampleSurface(world.x, world.z)];
  }));
  const averageSurfaceY = WHEEL_IDS.reduce((sum, wheelId) => sum + Number(wheelSamples[wheelId]?.elevation || 0) * elevationScaleM, 0) / WHEEL_IDS.length;
  return {
    enabled: true,
    fixedStepSeconds: FIXED_STEP_SECONDS,
    accumulator: 0,
    sprungMassKg: Math.max(450, Number(tuning.weightKg) || 1400),
    position: {
      x: worldX,
      y: Number.isFinite(Number(session.bodyY)) ? Number(session.bodyY) : averageSurfaceY + rideHeightM,
      z: worldZ
    },
    linearVelocity: {
      x: Math.sin(velocityYaw) * speedMps,
      y: Number(session.verticalVelocityMps || 0),
      z: Math.cos(velocityYaw) * speedMps
    },
    yaw,
    pitch: Number(session.pitchRad || 0),
    roll: Number(session.rollRad || 0),
    angularVelocity: {
      x: Number(session.pitchRate || 0),
      y: Number(session.yawVelocityRadps || 0),
      z: Number(session.rollRate || 0)
    },
    wheelAttachments: attachments,
    wheels: Object.fromEntries(WHEEL_IDS.map((wheelId) => {
      const local = attachments[wheelId];
      const rotated = rotateLocalToWorld(local, { yaw, pitch: 0, roll: 0 });
      const wheelX = worldX + rotated.x;
      const wheelZ = worldZ + rotated.z;
      return [wheelId, {
        id: wheelId,
        localAttachment: attachments[wheelId],
        inContact: true,
        compressionM: 0,
        compressionRatio: 0,
        normalLoadN: 0,
        slipLongitudinal: 0,
        slipLateral: 0,
        surface: wheelSamples[wheelId],
        contactPoint: {
          x: wheelX,
          y: Number(wheelSamples[wheelId]?.elevation || 0) * elevationScaleM,
          z: wheelZ
        }
      }];
    })),
    lastForces: [],
    deterministicStepCount: 0
  };
}

export function getRaceVehicleWheelWorldPose(state = {}, wheelId = 'fl') {
  const local = state.wheelAttachments?.[wheelId] || state.wheels?.[wheelId]?.localAttachment || { x: 0, y: 0, z: 0 };
  const rotated = rotateLocalToWorld(local, state);
  return {
    x: Number(state.position?.x || 0) + rotated.x,
    y: Number(state.position?.y || 0) + rotated.y,
    z: Number(state.position?.z || 0) + rotated.z,
    local,
    relative: rotated
  };
}

export function stepRaceVehiclePhysics(state = null, {
  dt = 0,
  tuning = {},
  carDimensions = {},
  surfaceModel = null,
  elevationScaleM = DEFAULT_ELEVATION_SCALE_M,
  controls = {},
  planarVelocity = null,
  yaw = null
} = {}) {
  if (!state) return state;
  state.accumulator = clamp(Number(state.accumulator || 0) + Math.max(0, Number(dt) || 0), 0, FIXED_STEP_SECONDS * 8);
  const fixedStep = Number(state.fixedStepSeconds || FIXED_STEP_SECONDS);
  const steps = Math.min(8, Math.floor(state.accumulator / fixedStep + 0.000001));
  if (steps <= 0) return state;
  state.accumulator -= steps * fixedStep;
  const mass = Math.max(450, Number(state.sprungMassKg || tuning.weightKg) || 1400);
  const wheelbaseM = Math.max(2.1, Number(tuning.wheelbaseM) || Number(carDimensions.wheelbaseM) || 2.7);
  const trackM = Math.max(1.2, Number(tuning.trackWidthM) || Number(carDimensions.trackWidthM) || 1.55);
  const frontTravelM = clamp(Number(tuning.suspensionTravelFront) || 0.5, 0.1, 1.2);
  const rearTravelM = clamp(Number(tuning.suspensionTravelRear) || 0.5, 0.1, 1.2);
  const rideHeightM = clamp(((Number(tuning.rideHeightFront) || 0.18) + (Number(tuning.rideHeightRear) || 0.18)) * 0.5, 0.1, 0.65);
  const springRateBase = Math.max(12000, Number(tuning.springRateFront || tuning.springRateRear || 0) || mass * 22);
  const damperBase = Math.max(900, Number(tuning.dampingReboundFront || tuning.dampingReboundRear || 0) || mass * 3.25);
  const sampleSurface = (x, z) => surfaceModel?.sampleWorld?.({ x, z }, 0) || { elevation: 0, normal: { x: 0, y: 1, z: 0 }, region: 'terrain', surfaceId: 'asphalt', friction: 1 };
  const targetVelocity = planarVelocity || state.linearVelocity || { x: 0, y: 0, z: 0 };
  const targetYaw = Number.isFinite(Number(yaw)) ? Number(yaw) : state.yaw;
  for (let step = 0; step < steps; step += 1) {
    const alpha = Math.min(1, fixedStep * 18);
    state.linearVelocity.x += (Number(targetVelocity.x || 0) - Number(state.linearVelocity.x || 0)) * alpha;
    state.linearVelocity.z += (Number(targetVelocity.z || 0) - Number(state.linearVelocity.z || 0)) * alpha;
    state.yaw = normalizeAngle(state.yaw + normalizeAngle(targetYaw - state.yaw) * alpha);
    state.angularVelocity.y = Number(controls.yawRate || state.angularVelocity.y || 0);
    let totalSuspensionForce = 0;
    let frontCompression = 0;
    let rearCompression = 0;
    let leftCompression = 0;
    let rightCompression = 0;
    let contactCount = 0;
    const forces = [];
    WHEEL_IDS.forEach((wheelId) => {
      const wheelPose = getRaceVehicleWheelWorldPose(state, wheelId);
      const surface = sampleSurface(wheelPose.x, wheelPose.z);
      const surfaceY = Number(surface.elevation || 0) * elevationScaleM;
      const travelM = FRONT_WHEELS.has(wheelId) ? frontTravelM : rearTravelM;
      const suspensionTopY = Number(state.position.y || 0) + Number(wheelPose.relative.y || 0);
      const restLengthM = rideHeightM + travelM * 0.42;
      const extensionM = suspensionTopY - surfaceY;
      const compressionM = clamp(restLengthM - extensionM, 0, travelM);
      const compressionRatio = clamp(compressionM / Math.max(0.001, travelM), 0, 1);
      const previousCompression = Number(state.wheels?.[wheelId]?.compressionM || 0);
      const compressionVelocity = (compressionM - previousCompression) / fixedStep;
      const normal = normalize3(surface.normal, { x: 0, y: 1, z: 0 });
      const springForce = springRateBase * compressionM;
      const damperForce = damperBase * compressionVelocity;
      const normalLoadN = compressionM > 0 ? clamp(springForce + damperForce, 0, mass * 9.81 * 1.8) : 0;
      const friction = Math.max(0.05, Number(surface.friction || 1));
      const longitudinalSlip = clamp(Math.abs(Number(controls.longitudinalUsageByWheel?.[wheelId] || 0)), 0, 1.8);
      const lateralSlip = clamp(Math.abs(Number(controls.lateralUsageByWheel?.[wheelId] || 0)), 0, 1.8);
      const tireLimit = normalLoadN * friction;
      const longitudinalForce = clamp(Number(controls.driveForceByWheel?.[wheelId] || 0) - Number(controls.brakeForceByWheel?.[wheelId] || 0), -tireLimit, tireLimit);
      const lateralForce = clamp(Number(controls.lateralForceByWheel?.[wheelId] || 0), -tireLimit, tireLimit);
      totalSuspensionForce += normalLoadN;
      if (normalLoadN > 1) contactCount += 1;
      if (FRONT_WHEELS.has(wheelId)) frontCompression += compressionRatio;
      else rearCompression += compressionRatio;
      if (RIGHT_WHEELS.has(wheelId)) rightCompression += compressionRatio;
      else leftCompression += compressionRatio;
      forces.push({ wheelId, normalLoadN, longitudinalForce, lateralForce, normal });
      state.wheels[wheelId] = {
        ...(state.wheels[wheelId] || {}),
        id: wheelId,
        localAttachment: state.wheelAttachments?.[wheelId],
        inContact: normalLoadN > 1,
        compressionM,
        compressionRatio,
        normalLoadN,
        slipLongitudinal: longitudinalSlip,
        slipLateral: lateralSlip,
        surface,
        region: surface.region,
        surfaceId: surface.surfaceId,
        friction,
        normal,
        contactPoint: {
          x: wheelPose.x,
          y: surfaceY,
          z: wheelPose.z
        }
      };
    });
    const suspensionAcceleration = (totalSuspensionForce - mass * 9.81) / mass;
    state.linearVelocity.y = clamp(Number(state.linearVelocity.y || 0) + suspensionAcceleration * fixedStep, -18, 18);
    if (contactCount > 0) {
      const contactRatio = clamp(contactCount / WHEEL_IDS.length, 0, 1);
      const verticalDamping = clamp(1 - fixedStep * (2.4 + contactRatio * 4.2), 0.86, 0.995);
      state.linearVelocity.y *= verticalDamping;
    }
    state.position.y += state.linearVelocity.y * fixedStep;
    const averageSurfaceY = WHEEL_IDS.reduce((sum, wheelId) => sum + Number(state.wheels[wheelId]?.contactPoint?.y || 0), 0) / WHEEL_IDS.length;
    const minBodyY = averageSurfaceY + rideHeightM * 0.38;
    if (state.position.y < minBodyY && contactCount > 0) {
      state.position.y += (minBodyY - state.position.y) * Math.min(1, fixedStep * 18);
      state.linearVelocity.y = Math.max(0, Number(state.linearVelocity.y || 0) * 0.25);
    }
    const desiredPitch = clamp((rearCompression * 0.5 - frontCompression * 0.5) * 0.34, -0.55, 0.55);
    const desiredRoll = clamp((leftCompression * 0.5 - rightCompression * 0.5) * 0.42, -0.65, 0.65);
    const longAccel = Number(controls.longitudinalAcceleration || 0);
    const latAccel = Number(controls.lateralAcceleration || 0);
    state.angularVelocity.x += (desiredPitch + clamp(-longAccel / 9.81, -0.7, 0.7) * 0.12 - state.pitch) * fixedStep * 9;
    state.angularVelocity.z += (desiredRoll + clamp(latAccel / 9.81, -1.2, 1.2) * 0.18 - state.roll) * fixedStep * 9;
    state.angularVelocity.x *= Math.max(0, 1 - fixedStep * 7);
    state.angularVelocity.z *= Math.max(0, 1 - fixedStep * 7);
    state.pitch = clamp(state.pitch + state.angularVelocity.x * fixedStep, -0.8, 0.8);
    state.roll = clamp(state.roll + state.angularVelocity.z * fixedStep, -1.1, 1.1);
    state.position.x += Number(state.linearVelocity.x || 0) * fixedStep;
    state.position.z += Number(state.linearVelocity.z || 0) * fixedStep;
    state.lastForces = forces;
    state.deterministicStepCount = Number(state.deterministicStepCount || 0) + 1;
  }
  return state;
}

export function syncRaceVehiclePhysicsToSession(state = null, session = null, { preservePlanarPosition = true } = {}) {
  if (!state || !session) return session;
  if (!preservePlanarPosition) {
    session.worldX = Number(state.position.x || 0);
    session.worldZ = Number(state.position.z || 0);
  } else {
    state.position.x = Number(session.worldX || state.position.x || 0);
    state.position.z = Number(session.worldZ || state.position.z || 0);
  }
  session.bodyX = Number(state.position.x || 0);
  session.bodyY = Number(state.position.y || 0);
  session.bodyZ = Number(state.position.z || 0);
  session.velocityX = Number(state.linearVelocity.x || 0);
  session.velocityY = Number(state.linearVelocity.y || 0);
  session.velocityZ = Number(state.linearVelocity.z || 0);
  session.angularVelocityX = Number(state.angularVelocity.x || 0);
  session.angularVelocityY = Number(state.angularVelocity.y || 0);
  session.angularVelocityZ = Number(state.angularVelocity.z || 0);
  session.pitchRate = session.angularVelocityX;
  session.yawVelocityRadps = session.angularVelocityY;
  session.rollRate = session.angularVelocityZ;
  session.pitchRad = Number(state.pitch || 0);
  session.rollRad = Number(state.roll || 0);
  session.heightM = Number(state.position.y || 0);
  session.verticalVelocityMps = Number(state.linearVelocity.y || 0);
  session.grounded = WHEEL_IDS.some((wheelId) => state.wheels?.[wheelId]?.inContact);
  session.airborne = !session.grounded;
  session.wheelContacts3d = state.wheels;
  session.suspensionTravel = Object.fromEntries(WHEEL_IDS.map((wheelId) => [
    wheelId,
    clamp(Number(state.wheels?.[wheelId]?.compressionRatio || 0), 0, 1)
  ]));
  return session;
}

export function cloneRaceVehiclePhysicsState(state = null) {
  return state ? JSON.parse(JSON.stringify(state)) : null;
}

export const RACE_VEHICLE_PHYSICS_WHEEL_IDS = WHEEL_IDS;
