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

const hasFiniteNumber = (value) => Number.isFinite(Number(value));
const getNormalizedTuningValue = (tuning = {}, key = '', fallback = 0.5) => (
  clamp(hasFiniteNumber(tuning[key]) ? Number(tuning[key]) : fallback, 0.1, 1)
);
const getNormalizedScalar = (value = 0.5, fallback = 0.5) => (
  clamp(hasFiniteNumber(value) ? Number(value) : fallback, 0.1, 1)
);

export function getRaceNormalizedRideHeightM(value = 0.5) {
  const normalized = getNormalizedScalar(value, 0.5);
  return clamp(0.075 + normalized * 0.125, 0.085, 0.22);
}

export function getRaceNormalizedSuspensionTravelM(value = 0.5) {
  const normalized = getNormalizedScalar(value, 0.5);
  return clamp(0.055 + normalized * 0.19, 0.07, 0.26);
}

export function getRaceTireLoadSensitivityMultiplierForLoose(loadN = 1, referenceLoadN = loadN, looseSurfaceFactor = 0) {
  const load = Math.max(1, Number(loadN) || 1);
  const reference = Math.max(1, Number(referenceLoadN) || load);
  const loadRatio = clamp(load / reference, 0.18, 3.4);
  const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
  const exponent = 0.11 + loose * 0.12;
  return clamp(Math.pow(loadRatio, -exponent), 0.68 - loose * 0.05, 1.08 + loose * 0.02);
}

export function getRaceVehicleTireLoadSensitivityMultiplier(loadN = 1, referenceLoadN = loadN, friction = 1) {
  const loose = clamp((1 - Math.max(0.05, Number(friction) || 1)) / 0.62, 0, 1);
  return getRaceTireLoadSensitivityMultiplierForLoose(loadN, referenceLoadN, loose);
}

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
  const rideHeightM = (
    getRaceNormalizedRideHeightM(tuning.rideHeightFront)
    + getRaceNormalizedRideHeightM(tuning.rideHeightRear)
  ) * 0.5;
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
  const rideHeightM = (
    getRaceNormalizedRideHeightM(tuning.rideHeightFront)
    + getRaceNormalizedRideHeightM(tuning.rideHeightRear)
  ) * 0.5;
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
  const massKg = Math.max(450, Number(tuning.weightKg) || 1400);
  const bodyY = Number.isFinite(Number(session.bodyY)) ? Number(session.bodyY) : averageSurfaceY + rideHeightM;
  return {
    enabled: true,
    fixedStepSeconds: FIXED_STEP_SECONDS,
    accumulator: 0,
    sprungMassKg: massKg,
    position: {
      x: worldX,
      y: bodyY,
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
      const rates = getRaceVehicleSuspensionRates(tuning, massKg, wheelId, 0);
      const travelM = FRONT_WHEELS.has(wheelId)
        ? getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelFront)
        : getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelRear);
      const surfaceY = Number(wheelSamples[wheelId]?.elevation || 0) * elevationScaleM;
      const restLengthM = rideHeightM + travelM * 0.42;
      const suspensionTopY = bodyY + rotated.y;
      const compressionM = clamp(restLengthM - (suspensionTopY - surfaceY), 0, travelM);
      const normalLoadN = compressionM > 0 ? clamp(rates.springRateNpm * compressionM, 0, massKg * 9.81 * 1.8) : 0;
      const wheelRadiusM = Math.max(0.05, Number(tuning.wheelRadiusM) || 0.32);
      const rollingAngularSpeedRadps = speedMps / wheelRadiusM;
      return [wheelId, {
        id: wheelId,
        localAttachment: attachments[wheelId],
        inContact: compressionM > 0.0005,
        geometricContact: compressionM > 0.0005,
        loadBearing: normalLoadN > 1,
        compressionM,
        compressionRatio: clamp(compressionM / Math.max(0.001, travelM), 0, 1),
        normalLoadN,
        rawNormalLoadN: normalLoadN,
        filteredNormalLoadN: normalLoadN,
        normalLoadKnown: true,
        springRateNpm: rates.springRateNpm,
        damperRateNsM: rates.damperRateNsM,
        suspensionDampingMode: rates.dampingMode,
        antiRollNormalized: rates.antiRollNormalized,
        angularSpeedRadps: rollingAngularSpeedRadps,
        rollingAngularSpeedRadps,
        longitudinalSlipRatio: 0,
        slipLongitudinal: 0,
        slipLateral: 0,
        surface: wheelSamples[wheelId],
        contactPoint: {
          x: wheelX,
          y: surfaceY,
          z: wheelZ
        }
      }];
    })),
    averageSurfaceY,
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

export function getRaceVehicleSuspensionRates(tuning = {}, massKg = 1400, wheelId = 'fl', compressionVelocityMps = 0) {
  const mass = Math.max(450, Number(massKg) || 1400);
  const isFront = FRONT_WHEELS.has(wheelId);
  const axle = isFront ? 'Front' : 'Rear';
  const normalizedSpring = getNormalizedTuningValue(tuning, `spring${axle}`, 0.5);
  const normalizedBump = getNormalizedTuningValue(tuning, `bump${axle}`, getNormalizedTuningValue(tuning, `damping${axle}`, 0.5));
  const normalizedRebound = getNormalizedTuningValue(tuning, `rebound${axle}`, getNormalizedTuningValue(tuning, `damping${axle}`, 0.5));
  const normalizedAntiRoll = getNormalizedTuningValue(tuning, `antiRoll${axle}`, 0.5);
  const physicalSpringRate = Number(tuning[`springRate${axle}`]);
  const physicalBumpRate = Number(tuning[`dampingBump${axle}`]);
  const physicalReboundRate = Number(tuning[`dampingRebound${axle}`]);
  const useBump = Number(compressionVelocityMps || 0) >= 0;
  const normalizedDamper = useBump ? normalizedBump : normalizedRebound;
  const physicalDamperRate = useBump && hasFiniteNumber(physicalBumpRate)
    ? physicalBumpRate
    : physicalReboundRate;
  const springRateNpm = Math.max(12000, hasFiniteNumber(physicalSpringRate) && physicalSpringRate > 0
    ? physicalSpringRate
    : mass * (12 + normalizedSpring * 20));
  const damperRateNsM = Math.max(900, hasFiniteNumber(physicalDamperRate) && physicalDamperRate > 0
    ? physicalDamperRate
    : mass * (1.7 + normalizedDamper * 3.1));
  return {
    axle: isFront ? 'front' : 'rear',
    springRateNpm,
    damperRateNsM,
    springNormalized: normalizedSpring,
    bumpNormalized: normalizedBump,
    reboundNormalized: normalizedRebound,
    antiRollNormalized: normalizedAntiRoll,
    dampingMode: useBump ? 'bump' : 'rebound',
    physicalSpringRateUsed: hasFiniteNumber(physicalSpringRate) && physicalSpringRate > 0,
    physicalDamperRateUsed: hasFiniteNumber(physicalDamperRate) && physicalDamperRate > 0
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
  const frontTravelM = getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelFront);
  const rearTravelM = getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelRear);
  const rideHeightM = (
    getRaceNormalizedRideHeightM(tuning.rideHeightFront)
    + getRaceNormalizedRideHeightM(tuning.rideHeightRear)
  ) * 0.5;
  const wheelRadiusM = Math.max(0.05, Number(tuning.wheelRadiusM) || 0.32);
  const effectiveWheelInertiaKgM2 = Math.max(0.8, 0.9 + mass * 0.00055);
  const frontSuspensionRates = getRaceVehicleSuspensionRates(tuning, mass, 'fl', 0);
  const rearSuspensionRates = getRaceVehicleSuspensionRates(tuning, mass, 'rl', 0);
  const suspensionPitchCompliance = clamp(1.18 - ((frontSuspensionRates.springNormalized + rearSuspensionRates.springNormalized) * 0.5) * 0.36, 0.75, 1.15);
  const suspensionRollCompliance = clamp(1.22 - ((frontSuspensionRates.antiRollNormalized + rearSuspensionRates.antiRollNormalized) * 0.5) * 0.52, 0.66, 1.18);
  const sampleSurface = (x, z) => surfaceModel?.sampleWorld?.({ x, z }, 0) || { elevation: 0, normal: { x: 0, y: 1, z: 0 }, region: 'terrain', surfaceId: 'asphalt', friction: 1 };
  const targetVelocity = planarVelocity || state.linearVelocity || { x: 0, y: 0, z: 0 };
  const targetYaw = Number.isFinite(Number(yaw)) ? Number(yaw) : state.yaw;
  for (let step = 0; step < steps; step += 1) {
    const alpha = Math.min(1, fixedStep * 18);
    state.linearVelocity.x += (Number(targetVelocity.x || 0) - Number(state.linearVelocity.x || 0)) * alpha;
    state.linearVelocity.z += (Number(targetVelocity.z || 0) - Number(state.linearVelocity.z || 0)) * alpha;
    let totalSuspensionForce = 0;
    let frontCompression = 0;
    let rearCompression = 0;
    let leftCompression = 0;
    let rightCompression = 0;
    let contactCount = 0;
    const rawWheelStates = [];
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
      const suspensionRates = getRaceVehicleSuspensionRates(tuning, mass, wheelId, compressionVelocity);
      const normal = normalize3(surface.normal, { x: 0, y: 1, z: 0 });
      const springForce = suspensionRates.springRateNpm * compressionM;
      const damperForce = suspensionRates.damperRateNsM * compressionVelocity;
      const rawNormalLoadN = compressionM > 0 ? clamp(springForce + damperForce, 0, mass * 9.81 * 1.8) : 0;
      const geometricContact = compressionM > 0.0005;
      const previousFilteredLoad = Math.max(0, Number(state.wheels?.[wheelId]?.filteredNormalLoadN ?? state.wheels?.[wheelId]?.normalLoadN) || 0);
      const loadRate = rawNormalLoadN >= previousFilteredLoad ? 30 : 12;
      const loadAlpha = geometricContact ? clamp(1 - Math.exp(-loadRate * fixedStep), 0, 1) : 1;
      const filteredNormalLoadN = geometricContact
        ? previousFilteredLoad + (rawNormalLoadN - previousFilteredLoad) * loadAlpha
        : 0;
      rawWheelStates.push({
        wheelId,
        wheelPose,
        surface,
        surfaceY,
        travelM,
        compressionM,
        compressionRatio,
        suspensionRates,
        rawNormalLoadN,
        normalLoadN: filteredNormalLoadN,
        geometricContact,
        normal
      });
    });
    const applyAntiRollTransfer = (leftId, rightId, travelM) => {
      const left = rawWheelStates.find((wheel) => wheel.wheelId === leftId);
      const right = rawWheelStates.find((wheel) => wheel.wheelId === rightId);
      if (!left || !right) return;
      const averageAntiRoll = (
        Number(left.suspensionRates.antiRollNormalized || 0.5)
        + Number(right.suspensionRates.antiRollNormalized || 0.5)
      ) * 0.5;
      const compressionDeltaM = Number(left.compressionM || 0) - Number(right.compressionM || 0);
      const requestedTransferN = clamp(
        (compressionDeltaM / Math.max(0.05, travelM)) * mass * 9.81 * (0.035 + averageAntiRoll * 0.14),
        -mass * 9.81 * 0.22,
        mass * 9.81 * 0.22
      );
      const transferN = requestedTransferN >= 0
        ? Math.min(requestedTransferN, Number(right.normalLoadN || 0))
        : Math.max(requestedTransferN, -Number(left.normalLoadN || 0));
      if (Math.abs(transferN) <= 0.001) return;
      left.antiRollLoadTransferN = transferN;
      right.antiRollLoadTransferN = -transferN;
      left.normalLoadN = clamp(Number(left.normalLoadN || 0) + transferN, 0, mass * 9.81 * 1.8);
      right.normalLoadN = clamp(Number(right.normalLoadN || 0) - transferN, 0, mass * 9.81 * 1.8);
    };
    applyAntiRollTransfer('fl', 'fr', frontTravelM);
    applyAntiRollTransfer('rl', 'rr', rearTravelM);
    rawWheelStates.forEach((rawWheel) => {
      const {
        wheelId,
        wheelPose,
        surface,
        surfaceY,
        compressionM,
        compressionRatio,
        suspensionRates,
        normalLoadN,
        rawNormalLoadN,
        geometricContact,
        normal
      } = rawWheel;
      const friction = Math.max(0.05, Number(surface.friction || 1));
      const forward = {
        x: Math.sin(Number(targetYaw || 0)),
        z: Math.cos(Number(targetYaw || 0))
      };
      const groundLongitudinalSpeedMps = Number(targetVelocity.x || 0) * forward.x
        + Number(targetVelocity.z || 0) * forward.z;
      const rollingAngularSpeedRadps = groundLongitudinalSpeedMps / wheelRadiusM;
      const previousAngularSpeedRadps = Number.isFinite(Number(state.wheels?.[wheelId]?.angularSpeedRadps))
        ? Number(state.wheels[wheelId].angularSpeedRadps)
        : rollingAngularSpeedRadps;
      const driveCommandForceN = Number(
        controls.driveCommandForceByWheel?.[wheelId]
        ?? controls.driveForceByWheel?.[wheelId]
        ?? 0
      );
      const appliedDriveForceN = Number(controls.driveForceByWheel?.[wheelId] || 0);
      const excessDriveForceN = driveCommandForceN - appliedDriveForceN;
      let angularSpeedRadps = previousAngularSpeedRadps
        + (excessDriveForceN * wheelRadiusM / effectiveWheelInertiaKgM2) * fixedStep;
      const loadRatio = clamp(normalLoadN / Math.max(1, mass * 9.81 * 0.25), 0, 1.5);
      if (geometricContact && normalLoadN > 1) {
        const rollingCouplingAlpha = clamp(
          1 - Math.exp(-(5 + loadRatio * 12) * fixedStep),
          0,
          1
        );
        angularSpeedRadps += (rollingAngularSpeedRadps - angularSpeedRadps) * rollingCouplingAlpha;
      }
      const maxAngularSpeedRadps = Math.max(
        120,
        (Math.max(1000, Number(tuning.revLimitRpm) || 7000) * Math.PI * 2 / 60)
          / Math.max(0.1, Number(tuning.finalDrive || tuning.gearFinalDrive) || 1)
          * 1.5
      );
      angularSpeedRadps = clamp(angularSpeedRadps, -maxAngularSpeedRadps, maxAngularSpeedRadps);
      const longitudinalSlipRatio = geometricContact && normalLoadN > 1
        ? Math.abs(angularSpeedRadps * wheelRadiusM - groundLongitudinalSpeedMps)
          / Math.max(2.5, Math.abs(groundLongitudinalSpeedMps))
        : 0;
      const longitudinalSlip = clamp(longitudinalSlipRatio, 0, 1.8);
      const lateralSlip = clamp(Math.abs(Number(controls.lateralUsageByWheel?.[wheelId] || 0)), 0, 1.8);
      const combinedUsage = Math.hypot(longitudinalSlip, lateralSlip);
      const overLimitUsage = clamp((combinedUsage - 1) / 0.8, 0, 1);
      const postPeakForceScale = clamp(1 - overLimitUsage * 0.48, 0.42, 1);
      const referenceWheelLoadN = Math.max(1, mass * 9.81 * 0.25);
      const loadSensitivity = getRaceVehicleTireLoadSensitivityMultiplier(normalLoadN, referenceWheelLoadN, friction);
      const tireLimit = normalLoadN * friction * loadSensitivity * postPeakForceScale;
      const requestedLongitudinalForce = clamp(Number(controls.driveForceByWheel?.[wheelId] || 0) - Number(controls.brakeForceByWheel?.[wheelId] || 0), -tireLimit, tireLimit);
      const requestedLateralForce = clamp(Number(controls.lateralForceByWheel?.[wheelId] || 0), -tireLimit, tireLimit);
      const requestedPlanarForceMagnitude = Math.hypot(requestedLongitudinalForce, requestedLateralForce);
      const forceFrictionCircleScale = requestedPlanarForceMagnitude > tireLimit && tireLimit > 0
        ? tireLimit / requestedPlanarForceMagnitude
        : 1;
      const usageFrictionCircleScale = combinedUsage > 1
        ? clamp(1 / Math.max(1, combinedUsage), 0.35, 1)
        : 1;
      const frictionCircleScale = Math.min(forceFrictionCircleScale, usageFrictionCircleScale);
      const longitudinalForce = requestedLongitudinalForce * frictionCircleScale;
      const lateralForce = requestedLateralForce * frictionCircleScale;
      totalSuspensionForce += normalLoadN;
      if (geometricContact) contactCount += 1;
      if (FRONT_WHEELS.has(wheelId)) frontCompression += compressionRatio;
      else rearCompression += compressionRatio;
      if (RIGHT_WHEELS.has(wheelId)) rightCompression += compressionRatio;
      else leftCompression += compressionRatio;
      forces.push({ wheelId, normalLoadN, longitudinalForce, lateralForce, normal });
      state.wheels[wheelId] = {
        ...(state.wheels[wheelId] || {}),
        id: wheelId,
        localAttachment: state.wheelAttachments?.[wheelId],
        inContact: geometricContact,
        geometricContact,
        loadBearing: normalLoadN > 1,
        compressionM,
        compressionRatio,
        normalLoadN,
        rawNormalLoadN,
        filteredNormalLoadN: normalLoadN,
        normalLoadKnown: true,
        requestedLongitudinalForceN: requestedLongitudinalForce,
        requestedLateralForceN: requestedLateralForce,
        frictionCircleScale,
        springRateNpm: suspensionRates.springRateNpm,
        damperRateNsM: suspensionRates.damperRateNsM,
        suspensionDampingMode: suspensionRates.dampingMode,
        antiRollNormalized: suspensionRates.antiRollNormalized,
        antiRollLoadTransferN: Number(rawWheel.antiRollLoadTransferN || 0),
        angularSpeedRadps,
        rollingAngularSpeedRadps,
        longitudinalSlipRatio,
        slipLongitudinal: longitudinalSlip,
        slipLateral: lateralSlip,
        combinedUsage,
        postPeakForceScale,
        loadSensitivityMultiplier: loadSensitivity,
        tireLimitN: tireLimit,
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
    const averageSurfaceY = WHEEL_IDS.reduce((sum, wheelId) => sum + Number(state.wheels[wheelId]?.contactPoint?.y || 0), 0) / WHEEL_IDS.length;
    const previousAverageSurfaceY = Number.isFinite(Number(state.averageSurfaceY))
      ? Number(state.averageSurfaceY)
      : averageSurfaceY;
    const surfaceVerticalVelocityMps = (averageSurfaceY - previousAverageSurfaceY) / fixedStep;
    const suspensionAcceleration = (totalSuspensionForce - mass * 9.81) / mass;
    state.linearVelocity.y = clamp(Number(state.linearVelocity.y || 0) + suspensionAcceleration * fixedStep, -18, 18);
    if (contactCount > 0) {
      const contactRatio = clamp(contactCount / WHEEL_IDS.length, 0, 1);
      const verticalDamping = clamp(1 - fixedStep * (2.4 + contactRatio * 4.2), 0.86, 0.995);
      state.linearVelocity.y *= verticalDamping;
      if (surfaceVerticalVelocityMps > 0) {
        const averageCompressionRatio = (frontCompression + rearCompression) / Math.max(1, contactCount);
        const terrainFollow = surfaceVerticalVelocityMps
          * (0.24 + contactRatio * 0.2)
          * clamp(averageCompressionRatio / 0.42, 0, 1);
        state.linearVelocity.y = Math.max(state.linearVelocity.y, terrainFollow);
      }
    }
    state.position.y += state.linearVelocity.y * fixedStep;
    state.averageSurfaceY = averageSurfaceY;
    const minBodyY = averageSurfaceY + rideHeightM * 0.38;
    if (state.position.y < minBodyY && contactCount > 0) {
      state.position.y += (minBodyY - state.position.y) * Math.min(1, fixedStep * 30);
      state.linearVelocity.y = Math.max(0, Number(state.linearVelocity.y || 0) * 0.25);
    }
    const desiredPitch = clamp((rearCompression * 0.5 - frontCompression * 0.5) * 0.34 * suspensionPitchCompliance, -0.55, 0.55);
    const desiredRoll = clamp((leftCompression * 0.5 - rightCompression * 0.5) * 0.42 * suspensionRollCompliance, -0.65, 0.65);
    const longAccel = Number(controls.longitudinalAcceleration || 0);
    const latAccel = Number(controls.lateralAcceleration || 0);
    const pitchRollContactScale = clamp(contactCount / WHEEL_IDS.length, 0, 1);
    if (pitchRollContactScale > 0.001) {
      state.yaw = normalizeAngle(state.yaw + normalizeAngle(targetYaw - state.yaw) * alpha * pitchRollContactScale);
      state.angularVelocity.y = Number(controls.yawRate || state.angularVelocity.y || 0);
    } else {
      state.yaw = normalizeAngle(state.yaw + Number(state.angularVelocity.y || 0) * fixedStep);
    }
    if (pitchRollContactScale > 0.001) {
      state.angularVelocity.x += (
        desiredPitch + clamp(-longAccel / 9.81, -0.7, 0.7) * 0.12 - state.pitch
      ) * fixedStep * 9 * pitchRollContactScale;
      state.angularVelocity.z += (
        desiredRoll + clamp(latAccel / 9.81, -1.2, 1.2) * 0.18 - state.roll
      ) * fixedStep * 9 * pitchRollContactScale;
      state.angularVelocity.x *= Math.max(0, 1 - fixedStep * 7 * pitchRollContactScale);
      state.angularVelocity.z *= Math.max(0, 1 - fixedStep * 7 * pitchRollContactScale);
    }
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
