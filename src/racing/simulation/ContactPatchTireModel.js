import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';
import { PowertrainModel } from './PowertrainModel.js';
import { rotateVectorByQuaternion } from './RigidBodyMath.js';
import { solveSuspensionGeometry } from './SuspensionGeometry.js';
import { resolveContactFootprint } from './ContactFootprint.js';
import { resolveCompoundSurfaceGrip } from './SurfaceConditionGrip.js';

const powertrainModel = new PowertrainModel();

const EPSILON = 1e-9;
const q = (value, precision = 6) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(precision)) : 0;
};
const vector = (value = {}, fallback = {}) => ({
  x: Number(value.x ?? fallback.x ?? 0),
  y: Number(value.y ?? fallback.y ?? 0),
  z: Number(value.z ?? fallback.z ?? 0)
});
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, amount) => ({ x: a.x * amount, y: a.y * amount, z: a.z * amount });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const normalize = (value, fallback = { x: 0, y: 1, z: 0 }) => {
  const length = Math.hypot(value.x, value.y, value.z);
  return length > EPSILON ? scale(value, 1 / length) : { ...fallback };
};
const projectOnPlane = (value, normal) => add(value, scale(normal, -dot(value, normal)));
const cleanVector = (value) => ({ x: q(value.x), y: q(value.y), z: q(value.z) });

export function getAckermannSteeringAngles({
  steeringAngleRad = 0,
  wheelbaseM = 2.65,
  frontTrackWidthM = 1.58,
  ackermannRatio = 1,
  steeringRackRatio = 1
} = {}) {
  const center = Number(steeringAngleRad || 0) * Math.max(0.01, Number(steeringRackRatio) || 1);
  if (Math.abs(center) < EPSILON) return { fl: 0, fr: 0, rl: 0, rr: 0 };
  const sign = Math.sign(center);
  const radius = Math.max(frontTrackWidthM * 0.51, wheelbaseM / Math.max(EPSILON, Math.tan(Math.abs(center))));
  const inner = Math.atan(wheelbaseM / Math.max(0.01, radius - frontTrackWidthM * 0.5));
  const outer = Math.atan(wheelbaseM / (radius + frontTrackWidthM * 0.5));
  const ratio = clamp(Number(ackermannRatio) || 0, 0, 1.5);
  const blend = (angle) => center + (sign * angle - center) * ratio;
  return sign > 0
    ? { fl: q(blend(outer)), fr: q(blend(inner)), rl: 0, rr: 0 }
    : { fl: q(blend(inner)), fr: q(blend(outer)), rl: 0, rr: 0 };
}

export function calculateAuthoritativeSteeringEnvelope(state = {}, config = {}) {
  const front = ['fl', 'fr'].map((wheelId) => state.contactPatches?.[wheelId]).filter((patch) => (
    Number(patch?.normalLoadN || 0) > 1
  ));
  const maximumAngleRad = Math.max(0.05, Number(config.maxSteerAngleRad) || 0.52);
  const speedMps = Math.max(0, Number(state.groundSpeedMps
    ?? Math.hypot(Number(state.velocity?.x || 0), Number(state.velocity?.z || 0))) || 0);
  if (!front.length || speedMps < 1) return maximumAngleRad;
  let supportedLoadN = 0;
  let weightedGrip = 0;
  front.forEach((patch) => {
    const loadN = Math.max(0, Number(patch.normalLoadN || 0));
    const suspensionLoadN = Math.max(loadN, Number(patch.suspensionNormalLoadN || loadN));
    const aquaplaningSupport = clamp(loadN / Math.max(1, suspensionLoadN), 0, 1);
    const utilizationReserve = Math.sqrt(Math.max(0.04, 1 - clamp(Number(patch.utilization || 0), 0, 1) ** 2));
    const grip = Math.max(0.025, Number(patch.gripCoefficient
      ?? patch.material?.effectiveGrip ?? 1));
    supportedLoadN += loadN;
    weightedGrip += loadN * grip * aquaplaningSupport * utilizationReserve;
  });
  const effectiveMu = weightedGrip / Math.max(1, supportedLoadN);
  const contactScale = front.length / 2;
  const frontReferenceLoadN = Math.max(1, Number(config.massKg || 1450) * 9.81
    * clamp(Number(config.frontWeightDistribution ?? 0.55), 0.3, 0.75));
  const loadSupportScale = clamp(supportedLoadN / frontReferenceLoadN, 0.12, 1);
  const lateralAccelerationMps2 = 9.81 * effectiveMu * contactScale * loadSupportScale;
  const gripAngle = Math.atan(
    lateralAccelerationMps2 * Math.max(0.5, Number(config.wheelbaseM || 2.65))
    / Math.max(1, speedMps * speedMps)
  );
  return clamp(gripAngle, 0.002, maximumAngleRad);
}

export function resolvePhysicalCenterSteeringAngle(controls = {}, config = {}, state = {}) {
  const maximumAngleRad = Math.max(0.05, Number(config.maxSteerAngleRad) || 0.52);
  const direct = String(config.handlingPreset || 'sport').toLowerCase() === 'simulation'
    || controls.steeringInputMode === 'simulation-wheel';
  if (direct) {
    return typeof controls.centerSteeringAngleRad === 'number'
      && Number.isFinite(controls.centerSteeringAngleRad)
      ? clamp(controls.centerSteeringAngleRad, -maximumAngleRad, maximumAngleRad)
      : clamp(Number(controls.steering) || 0, -1, 1) * maximumAngleRad;
  }
  if (!config.handlingPreset && !controls.steeringInputMode
    && typeof controls.centerSteeringAngleRad === 'number'
    && Number.isFinite(controls.centerSteeringAngleRad)) {
    return clamp(controls.centerSteeringAngleRad, -maximumAngleRad, maximumAngleRad);
  }
  const envelope = calculateAuthoritativeSteeringEnvelope(state, config)
    * (String(config.handlingPreset || 'sport').toLowerCase() === 'accessible' ? 1.08 : 1);
  return clamp(Number(controls.steering) || 0, -1, 1) * Math.min(maximumAngleRad, envelope);
}

export function getContactPatchMaterialGrip(material = {}) {
  if (Number.isFinite(Number(material.surfaceGripScale))) {
    return clamp(Number(material.surfaceGripScale), 0.025, 2);
  }
  if (material.trackStateConditionApplied === true) {
    return clamp(Number(
      material.effectiveGripMultiplier
      ?? material.effectiveGrip
      ?? material.grip
      ?? material.baseGrip
      ?? 1
    ), 0.025, 2);
  }
  const moisture = Math.max(0, Number(material.moistureDepthMm || 0));
  const snow = Math.max(0, Number(material.snowDepthMm || 0));
  const ice = Math.max(0, Number(material.iceDepthMm || 0));
  const marbles = clamp(Number(material.looseMarbles || 0), 0, 1);
  const dirt = clamp(Number(material.dirt || 0), 0, 1);
  const mud = clamp(Number(material.mud || 0), 0, 1);
  const oil = clamp(Number(material.oil || 0), 0, 1);
  const roughness = clamp(Number(material.roughness || 0), 0, 1);
  const rubber = clamp(Number(material.rubber || 0), 0, 1);
  const baseGrip = Math.max(0.03, Number(material.grip ?? material.baseGrip ?? 1));
  // Standing water is handled by the load-supporting aquaplaning model below.
  // Only the bonded damp film belongs in the surface friction coefficient.
  const contamination = (1 - clamp(moisture / 3, 0, 0.18))
    * (1 - clamp(snow / 45, 0, 0.72))
    * (1 - clamp(ice / 3, 0, 0.9))
    * (1 - marbles * 0.38)
    * (1 - dirt * 0.16)
    * (1 - mud * 0.48)
    * (1 - oil * 0.72);
  return clamp(baseGrip * contamination * (1 + rubber * 0.1) * (1 - roughness * 0.08), 0.025, 2);
}

export function calculateVelocitySensitiveDamperForce({
  relativeVelocityMps = 0,
  bumpDamperNsM = 0,
  reboundDamperNsM = 0,
  highSpeedThresholdMps = 0.25,
  highSpeedScale = 1
} = {}) {
  const velocityMps = Number(relativeVelocityMps) || 0;
  const speedMps = Math.abs(velocityMps);
  if (speedMps <= EPSILON) return 0;
  const lowSpeedDamperNsM = Math.max(0, velocityMps >= 0
    ? Number(bumpDamperNsM) || 0
    : Number(reboundDamperNsM) || 0);
  const thresholdMps = Math.max(EPSILON, Number(highSpeedThresholdMps) || 0.25);
  const highSpeedDamperNsM = lowSpeedDamperNsM * Math.max(0, Number(highSpeedScale) || 0);
  const lowSpeedVelocityMps = Math.min(speedMps, thresholdMps);
  const highSpeedVelocityMps = Math.max(0, speedMps - thresholdMps);
  const forceN = lowSpeedDamperNsM * lowSpeedVelocityMps
    + highSpeedDamperNsM * highSpeedVelocityMps;
  return q(Math.sign(velocityMps) * forceN);
}

export function calculateAquaplaningState({
  kinematics = {},
  normalLoadN = 0,
  tire = {},
  material = {}
} = {}) {
  const loadN = Math.max(0, Number(normalLoadN) || 0);
  const waterDepthMm = Math.max(0, Number(
    material.standingWaterDepthMm ?? material.waterDepthMm ?? 0
  ));
  const widthM = clamp(Number(tire.widthMm ?? 245) / 1000, 0.12, 0.45);
  const pressurePsi = clamp(Number(tire.effectivePressurePsi ?? tire.pressurePsi ?? 32), 12, 70);
  const wear = clamp(Number(tire.wear || 0), 0, 1);
  const unwornTreadDepthMm = Number(tire.treadDepthMm ?? tire.compound?.treadDepthMm ?? 8);
  const treadDepthMm = clamp(unwornTreadDepthMm * (1 - wear * 0.8), 0.4, 14);
  const wetCharacteristic = clamp(Number(
    tire.wetEvacuationFactor
      ?? tire.compound?.wetEvacuationFactor
      ?? (/wet|rain/.test(String(tire.compound?.id || '')) ? 1.28 : 1)
  ), 0.45, 1.7);
  const longitudinalSpeedMps = Math.abs(Number(kinematics.longitudinalVelocityMps || 0));
  const rollingSpeedMps = Math.abs(Number(kinematics.wheelAngularVelocityRadps || 0)
    * Number(kinematics.effectiveRollingRadiusM || 0));
  const speedMps = Math.max(longitudinalSpeedMps, rollingSpeedMps);
  const signedSlipRatio = Number(kinematics.slipRatio || 0);
  const patchAreaM2 = loadN > 0 ? loadN / (pressurePsi * 6894.757) : 0;
  const patchLengthM = patchAreaM2 / widthM;
  const waterDemandM3ps = waterDepthMm / 1000 * widthM * speedMps
    * (1 + Math.min(2, Math.abs(signedSlipRatio)) * 0.3);
  const loadFactor = clamp(Math.sqrt(loadN / 3500), 0.35, 1.5);
  const pressureFactor = clamp(Math.sqrt(pressurePsi / 32), 0.62, 1.5);
  const evacuationCapacityM3ps = widthM * treadDepthMm / 1000
    * (2.2 + 0.42 * speedMps) * wetCharacteristic * loadFactor * pressureFactor;
  const demandRatio = waterDemandM3ps / Math.max(0.000001, evacuationCapacityM3ps);
  const immersion = clamp((waterDepthMm - 0.15) / 5.85, 0, 1);
  const onset = clamp((demandRatio - 0.72) / 1.5, 0, 1);
  const liftFraction = clamp(immersion * onset * onset * (3 - 2 * onset), 0, 0.94);
  const supportedNormalLoadN = loadN * (1 - liftFraction);
  const filmShear = 1 - liftFraction;
  const longitudinalForceScale = clamp(filmShear ** 1.1, 0.04, 1);
  const lateralForceScale = clamp(filmShear ** 1.35, 0.025, 1);
  const aligningTorqueScale = clamp(filmShear ** 1.7, 0.01, 1);
  const displacedWaterVolumeM3 = Math.min(waterDemandM3ps, evacuationCapacityM3ps)
    + Math.max(0, waterDemandM3ps - evacuationCapacityM3ps) * (1 - liftFraction) * 0.25;
  return {
    waterDepthMm: q(waterDepthMm),
    contactPatchAreaM2: q(patchAreaM2, 9),
    contactPatchLengthM: q(patchLengthM),
    waterDemandM3ps: q(waterDemandM3ps, 9),
    evacuationCapacityM3ps: q(evacuationCapacityM3ps, 9),
    aquaplaningRatio: q(demandRatio),
    liftFraction: q(liftFraction),
    supportedNormalLoadN: q(supportedNormalLoadN),
    longitudinalForceScale: q(longitudinalForceScale),
    lateralForceScale: q(lateralForceScale),
    aligningTorqueScale: q(aligningTorqueScale),
    displacedWaterVolumeM3ps: q(displacedWaterVolumeM3, 9)
  };
}

export function calculateWheelContactKinematics({ state, config, controls, environment, wheelId }) {
  const front = wheelId[0] === 'f';
  const left = wheelId[1] === 'l';
  const track = front ? config.frontTrackWidthM : config.rearTrackWidthM;
  const suspensionTravelM = front ? config.suspensionTravelFrontM : config.suspensionTravelRearM;
  const staticSagRatio = front ? config.staticSagRatioFront : config.staticSagRatioRear;
  const staticSagTargetM = suspensionTravelM * staticSagRatio;
  const droopTravelM = staticSagTargetM;
  const bumpTravelM = suspensionTravelM - staticSagTargetM;
  const definition = front ? config.suspensionDefinitionFront : config.suspensionDefinitionRear;
  const suspensionAxisLocal = normalize(vector(definition?.suspensionAxis, { x: 0, y: -1, z: 0 }), { x: 0, y: -1, z: 0 });
  const suspension = environment.suspensionStateByWheel?.[wheelId]
    || state.suspensionState?.[wheelId]
    || {};
  const compressionM = clamp(Number(suspension.compressionM ?? staticSagTargetM), 0, suspensionTravelM);
  const compressionVelocityMps = Number(suspension.compressionVelocityMps
    ?? suspension.unsprungVelocityMps
    ?? 0);
  const yaw = Number(state.yawRad || 0);
  const orientation = state.orientation || {
    x: 0,
    y: Math.sin(yaw * 0.5),
    z: 0,
    w: Math.cos(yaw * 0.5)
  };
  const staticHubOffset = {
    x: (left ? -0.5 : 0.5) * track,
    y: -config.cgHeightM + config.wheelRadiusM,
    z: front ? config.frontAxleDistanceFromCgM : -config.rearAxleDistanceFromCgM
  };
  const localOffset = add(staticHubOffset, scale(suspensionAxisLocal, staticSagTargetM - compressionM));
  const suspensionRestLengthM = front ? config.suspensionRestLengthFrontM : config.suspensionRestLengthRearM;
  const fullDroopHubOffset = add(staticHubOffset, scale(suspensionAxisLocal, staticSagTargetM));
  const suspensionMountOffset = add(fullDroopHubOffset, scale(suspensionAxisLocal, -suspensionRestLengthM));
  const chassisForward = normalize(rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, orientation), { x: 0, y: 0, z: 1 });
  const chassisRight = normalize(rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, orientation), { x: 1, y: 0, z: 0 });
  const centerRadius = rotateVectorByQuaternion(localOffset, orientation);
  const center = add(vector(state.position), centerRadius);
  const mountRadius = rotateVectorByQuaternion(suspensionMountOffset, orientation);
  const mountPosition = add(vector(state.position), mountRadius);
  const suspensionAxisWorld = normalize(
    rotateVectorByQuaternion(suspensionAxisLocal, orientation),
    { x: 0, y: -1, z: 0 }
  );
  const normal = normalize(vector(environment.surfaceNormalByWheel?.[wheelId], { x: 0, y: 1, z: 0 }));
  const centerSteeringAngleRad = resolvePhysicalCenterSteeringAngle(controls, config, state);
  const steeringAngles = getAckermannSteeringAngles({
    steeringAngleRad: centerSteeringAngleRad,
    wheelbaseM: config.wheelbaseM,
    frontTrackWidthM: config.frontTrackWidthM,
    ackermannRatio: config.ackermannRatio,
    // centerSteeringAngleRad is already the physical post-rack center angle.
    steeringRackRatio: 1
  });
  const steeringAngleRad = steeringAngles[wheelId] + Number(environment.toeByWheel?.[wheelId] || 0);
  const rawForward = add(scale(chassisForward, Math.cos(steeringAngleRad)), scale(chassisRight, Math.sin(steeringAngleRad)));
  const wheelForward = normalize(projectOnPlane(rawForward, normal), chassisForward);
  const wheelLateral = normalize(cross(normal, wheelForward), chassisRight);
  const contactPoint = add(center, scale(normal, -config.wheelRadiusM));
  const radius = add(contactPoint, scale(vector(state.position), -1));
  const angularVelocity = vector(state.angularVelocityWorld, {
    x: 0,
    y: Number(state.yawRateRadps || 0),
    z: 0
  });
  const hubRelativeVelocity = scale(suspensionAxisWorld, -compressionVelocityMps);
  const hubVelocity = add(
    add(vector(state.velocity), cross(angularVelocity, centerRadius)),
    hubRelativeVelocity
  );
  const mountVelocity = add(vector(state.velocity), cross(angularVelocity, mountRadius));
  const contactVelocity = add(
    hubVelocity,
    cross(angularVelocity, add(radius, scale(centerRadius, -1)))
  );
  const longitudinalVelocityMps = dot(contactVelocity, wheelForward);
  const lateralVelocityMps = dot(contactVelocity, wheelLateral);
  const effectiveRollingRadiusM = config.wheelRadiusM * clamp(Number(environment.effectiveRadiusScaleByWheel?.[wheelId] ?? 1), 0.82, 1.05);
  const wheelAngularVelocityRadps = Number(state.wheelAngularVelocityRadps?.[wheelId] ?? longitudinalVelocityMps / effectiveRollingRadiusM);
  const rollingSpeedMps = wheelAngularVelocityRadps * effectiveRollingRadiusM;
  const slipRatio = (rollingSpeedMps - longitudinalVelocityMps)
    / Math.max(0.5, Math.abs(longitudinalVelocityMps), Math.abs(rollingSpeedMps) * 0.12);
  const slipAngleRad = Math.atan2(lateralVelocityMps, Math.max(0.35, Math.abs(longitudinalVelocityMps)));
  const camberAngleRad = Number(environment.camberByWheel?.[wheelId]
    ?? (front ? config.camberFrontRad : config.camberRearRad));
  return {
    wheelId,
    wheelCenterWorld: cleanVector(center),
    hubPositionWorld: cleanVector(center),
    hubVelocityWorld: cleanVector(hubVelocity),
    suspensionMountPositionWorld: cleanVector(mountPosition),
    suspensionMountVelocityWorld: cleanVector(mountVelocity),
    suspensionAxisLocal: cleanVector(suspensionAxisLocal),
    suspensionAxisWorld: cleanVector(suspensionAxisWorld),
    suspensionCompressionM: q(compressionM),
    suspensionCompressionVelocityMps: q(compressionVelocityMps),
    suspensionRestLengthM: q(suspensionRestLengthM),
    suspensionDroopTravelM: q(droopTravelM),
    suspensionBumpTravelM: q(bumpTravelM),
    staticSagTargetM: q(staticSagTargetM),
    contactPointWorld: cleanVector(contactPoint),
    steeringAngleRad: q(steeringAngleRad),
    wheelForwardWorld: cleanVector(wheelForward),
    wheelLateralWorld: cleanVector(wheelLateral),
    surfaceNormalWorld: cleanVector(normal),
    surfaceTangentForwardWorld: cleanVector(wheelForward),
    surfaceTangentLateralWorld: cleanVector(wheelLateral),
    contactVelocityWorld: cleanVector(contactVelocity),
    longitudinalVelocityMps: q(longitudinalVelocityMps),
    lateralVelocityMps: q(lateralVelocityMps),
    slipRatio: q(slipRatio),
    slipAngleRad: q(slipAngleRad),
    camberAngleRad: q(camberAngleRad),
    wheelAngularVelocityRadps: q(wheelAngularVelocityRadps),
    effectiveRollingRadiusM: q(effectiveRollingRadiusM)
  };
}

function getTireGrip(tire, material, loadN, referenceLoadN) {
  const compound = tire.compound || {};
  const compoundGrip = Number(tire.compoundGrip ?? resolveCompoundSurfaceGrip(compound, material));
  const pressureDelta = Math.abs(Number(tire.effectivePressurePsi ?? tire.pressurePsi ?? 32)
    - Number(tire.targetPressurePsi ?? 32));
  const pressureScale = clamp(1 - pressureDelta * 0.009, 0.72, 1.05);
  const temperatureF = Number.isFinite(Number(tire.treadTemperatureC))
    ? Number(tire.treadTemperatureC) * 9 / 5 + 32
    : Number(tire.temperatureF ?? 180);
  const temperatureScale = temperatureF < 70 ? clamp(0.72 + temperatureF / 250, 0.72, 1) : temperatureF > 280 ? clamp(1 - (temperatureF - 280) / 300, 0.55, 1) : 1;
  const wearScale = clamp(1 - Number(tire.wear ?? 0) * 0.42, 0.5, 1);
  const damageScale = clamp(1 - Number(tire.damage ?? 0) / 150, 0.25, 1);
  const widthScale = clamp(Math.sqrt(Number(tire.widthMm ?? 245) / 245), 0.82, 1.18);
  const loadSensitivity = clamp(Math.pow(referenceLoadN / Math.max(1, loadN), Number(tire.loadSensitivityExponent ?? 0.08)), 0.72, 1.22);
  return clamp(compoundGrip * pressureScale * temperatureScale * wearScale * damageScale * widthScale
    * loadSensitivity * getContactPatchMaterialGrip(material), 0.02, 2.2);
}

export function calculateBrushTireForce({ kinematics, normalLoadN, tire = {}, material = {} }) {
  const load = Math.max(0, Number(normalLoadN || 0));
  if (load <= 0.01) return {
    longitudinalForceN: 0, lateralForceN: 0, combinedSlipLimitN: 0,
    selfAligningMomentNm: 0, pneumaticTrailM: 0, rollingResistanceN: 0,
    postPeakSlidingForceN: 0, utilization: 0, gripCoefficient: 0
  };
  const referenceLoad = Math.max(1, Number(tire.referenceLoadN || load));
  const camberContactScale = clamp(
    1 - Math.abs(Number(kinematics.camberAngleRad || 0)) * 1.45,
    0.82,
    1
  );
  const mu = getTireGrip(tire, material, load, referenceLoad) * camberContactScale;
  const limit = mu * load;
  const widthScale = clamp(Number(tire.widthMm ?? 245) / 245, 0.7, 1.4);
  const pressureScale = clamp(32 / Math.max(18, Number(tire.effectivePressurePsi
    ?? tire.pressurePsi ?? 32)), 0.7, 1.35);
  const longitudinalStiffness = Math.max(1000, Number(tire.longitudinalStiffnessN || referenceLoad * 18) * widthScale);
  const corneringStiffness = Math.max(1000, Number(tire.corneringStiffnessNPerRad || referenceLoad * 17) * widthScale * pressureScale);
  const camberStiffness = Math.max(0, Number(tire.camberStiffnessNPerRad || referenceLoad * 0.65));
  const contactMotionMps = Math.max(
    Math.abs(Number(kinematics.longitudinalVelocityMps || 0)),
    Math.abs(Number(kinematics.lateralVelocityMps || 0)),
    Math.abs(Number(kinematics.wheelAngularVelocityRadps || 0) * Number(kinematics.effectiveRollingRadiusM || 0))
  );
  const camberActivation = contactMotionMps
    / Math.sqrt(contactMotionMps * contactMotionMps + 0.25 * 0.25);
  const rawDemandX = longitudinalStiffness * Number(kinematics.slipRatio || 0);
  const rawDemandY = -corneringStiffness * Math.tan(Number(kinematics.slipAngleRad || 0))
    + camberStiffness * Number(kinematics.camberAngleRad || 0) * camberActivation;
  const naturalPeakSlip = 3 * limit / longitudinalStiffness;
  const configuredPeakSlip = Number(tire.peakSlip);
  const peakSlipScale = Number.isFinite(configuredPeakSlip) && configuredPeakSlip > EPSILON
    ? naturalPeakSlip / configuredPeakSlip
    : 1;
  const demandX = rawDemandX * peakSlipScale;
  const demandY = rawDemandY * peakSlipScale;
  const demand = Math.hypot(demandX, demandY);
  const slidingFrictionRatio = clamp(Number(tire.slidingFrictionRatio ?? 0.66), 0.35, 1);
  const postPeakFalloff = clamp(Number(tire.postPeakFalloff ?? 1.8), 0.1, 8);
  const transition = Math.max(EPSILON, 3 * limit);
  let magnitude;
  let postPeakSlidingForceN = limit;
  if (demand <= transition) {
    const ratio = demand / transition;
    magnitude = demand * (1 - ratio + ratio * ratio / 3);
  } else {
    const excess = (demand - transition) / transition;
    // The squared exponent leaves both value and first derivative continuous
    // at the brush/sliding boundary: F(0)=limit and dF/d(excess)(0)=0.
    postPeakSlidingForceN = limit * (
      slidingFrictionRatio
      + (1 - slidingFrictionRatio) * Math.exp(-postPeakFalloff * excess * excess)
    );
    magnitude = postPeakSlidingForceN;
  }
  const directionScale = demand > EPSILON ? magnitude / demand : 0;
  const longitudinalForceN = demandX * directionScale;
  const lateralForceN = demandY * directionScale;
  const utilization = limit > EPSILON ? Math.hypot(longitudinalForceN, lateralForceN) / limit : 0;
  const contactLengthM = clamp(Number(tire.contactPatchLengthM || 0.16) * Math.sqrt(load / referenceLoad), 0.06, 0.3);
  const pneumaticTrailM = contactLengthM / 3 * Math.max(0, 1 - Math.min(1, utilization) ** 1.7);
  const selfAligningMomentNm = -lateralForceN * pneumaticTrailM;
  const rollingCoefficient = Math.max(0, Number(tire.rollingResistanceCoefficient ?? 0.012))
    * (1 + Number(material.roughness || 0) * 0.7 + Number(material.mud || 0) * 1.2);
  const rollingResistanceN = load * rollingCoefficient;
  return {
    longitudinalForceN: q(longitudinalForceN),
    lateralForceN: q(lateralForceN),
    combinedSlipLimitN: q(limit),
    selfAligningMomentNm: q(selfAligningMomentNm),
    pneumaticTrailM: q(pneumaticTrailM),
    rollingResistanceN: q(rollingResistanceN),
    postPeakSlidingForceN: q(postPeakSlidingForceN),
    utilization: q(utilization),
    gripCoefficient: q(mu)
  };
}

export class ContactPatchTireModel {
  step({ state, controls, config, environment = {}, dt = 0 }) {
    const driven = new Set(config.drivenWheelIds);
    const centerSteeringAngleRad = resolvePhysicalCenterSteeringAngle(controls, config, state);
    const outputs = {};
    const wheelLoadsN = {};
    const wheelSlip = {};
    const suspensionTravel = {};
    const tireForcesN = {};
    const wheelAngularVelocityRadps = {};
    const suspensionState = {};
    let worldForce = { x: 0, y: 0, z: 0 };
    let worldMoment = { x: 0, y: 0, z: 0 };
    let suspensionForce = { x: 0, y: 0, z: 0 };
    const sampledSurfaceHeights = RACE_WHEEL_IDS
      .map((wheelId) => Number(environment.surfaceHeightByWheel?.[wheelId]))
      .filter(Number.isFinite);
    const wheelInputs = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
      const front = wheelId[0] === 'f';
      const staticLoad = config.massKg * 9.81
        * (front ? config.frontWeightDistribution : 1 - config.frontWeightDistribution) / 2;
      const springRateNpm = front
        ? config.suspensionSpringRateFrontNpm
        : config.suspensionSpringRateRearNpm;
      const suspensionTravelM = front
        ? config.suspensionTravelFrontM
        : config.suspensionTravelRearM;
      const staticSagRatio = front ? config.staticSagRatioFront : config.staticSagRatioRear;
      const staticSagTargetM = suspensionTravelM * staticSagRatio;
      const droopTravelM = staticSagTargetM;
      const bumpTravelM = suspensionTravelM - staticSagTargetM;
      const footprint = resolveContactFootprint(environment.contactSamplesByWheel?.[wheelId] || [], {
        maxGapM: config.contactFootprintMaxGapM,
        minimumSamples: 4
      });
      const resolvedEnvironment = footprint.heightM === null ? environment : {
        ...environment,
        surfaceHeightByWheel: { ...environment.surfaceHeightByWheel, [wheelId]: footprint.heightM },
        surfaceNormalByWheel: { ...environment.surfaceNormalByWheel, [wheelId]: footprint.normal },
        contactScaleByWheel: { ...environment.contactScaleByWheel, [wheelId]: footprint.supportedFraction }
      };
      let kinematics = calculateWheelContactKinematics({ state, config, controls, environment: resolvedEnvironment, wheelId });
      const hasSurfaceHeight = Number.isFinite(Number(resolvedEnvironment.surfaceHeightByWheel?.[wheelId]));
      const contactScale = clamp(Number(resolvedEnvironment.contactScaleByWheel?.[wheelId]
        ?? (environment.grounded === false ? 0 : 1)), 0, 1);
      const surfaceHeightM = Number(resolvedEnvironment.surfaceHeightByWheel?.[wheelId] || 0);
      const penetrationM = hasSurfaceHeight
        ? surfaceHeightM - Number(kinematics.contactPointWorld.y || 0)
        : 0;
      const contactVelocityNormalMps = dot(kinematics.contactVelocityWorld, kinematics.surfaceNormalWorld);
      const compressionVelocityMps = -contactVelocityNormalMps;
      const baseGeometry = solveSuspensionGeometry({
        definition: front ? config.suspensionDefinitionFront : config.suspensionDefinitionRear,
        compressionM: 0,
        springRateNpm
      });
      const staticCompressionM = staticSagTargetM;
      const previousSuspension = state.suspensionState?.[wheelId] || {};
      const hasPreviousSuspensionState = Number.isFinite(Number(previousSuspension.compressionM));
      const previousCompressionM = clamp(
        Number(previousSuspension.compressionM ?? staticCompressionM),
        0,
        suspensionTravelM
      );
      const targetCompressionM = hasSurfaceHeight
        ? clamp(previousCompressionM + penetrationM, 0, suspensionTravelM)
        : null;
      let unsprungVelocityMps = Number(previousSuspension.unsprungVelocityMps || 0);
      let compressionM = previousCompressionM;
      if (hasSurfaceHeight) {
        if (!hasPreviousSuspensionState) {
          compressionM = Number(targetCompressionM);
          unsprungVelocityMps = 0;
        } else {
          const tireErrorM = Number(targetCompressionM) - compressionM;
          const tireForceN = tireErrorM * config.tireVerticalStiffnessNpm
            - unsprungVelocityMps * config.tireVerticalDampingNsM;
          const unsprungMassKg = Number(config.unsprungMassByWheelKg?.[wheelId] || config.unsprungMassKg);
          unsprungVelocityMps += tireForceN / unsprungMassKg * dt;
          compressionM = clamp(compressionM + unsprungVelocityMps * dt, 0, suspensionTravelM);
          if (compressionM === 0 || compressionM === suspensionTravelM) unsprungVelocityMps *= 0.35;
        }
      } else {
        unsprungVelocityMps -= 9.81 * dt;
        compressionM = Math.max(0, compressionM + unsprungVelocityMps * dt);
        if (compressionM === 0) unsprungVelocityMps = 0;
      }
      const geometry = solveSuspensionGeometry({
        definition: front ? config.suspensionDefinitionFront : config.suspensionDefinitionRear,
        compressionM: compressionM - staticCompressionM,
        steeringAngleRad: resolvePhysicalCenterSteeringAngle(controls, config, state),
        staticCamberRad: front ? config.camberFrontRad : config.camberRearRad,
        staticToeRad: front ? config.toeFrontRad : config.toeRearRad,
        springRateNpm
      });
      kinematics = calculateWheelContactKinematics({ state, config, controls, environment: {
        ...resolvedEnvironment,
        suspensionStateByWheel: {
          ...resolvedEnvironment.suspensionStateByWheel,
          [wheelId]: { compressionM, compressionVelocityMps: unsprungVelocityMps }
        },
        camberByWheel: { ...resolvedEnvironment.camberByWheel, [wheelId]: geometry.camberRad },
        toeByWheel: { ...resolvedEnvironment.toeByWheel, [wheelId]: geometry.toeRad }
      }, wheelId });
      const geometricContact = hasSurfaceHeight && Number(targetCompressionM) > EPSILON;
      const compressionRatio = compressionM / suspensionTravelM;
      const bumpTravelRatio = clamp(
        Math.max(0, compressionM - staticCompressionM) / Math.max(EPSILON, bumpTravelM),
        0,
        1
      );
      const progressiveRate = geometry.wheelRateNpm * (1 + config.progressiveSpringRate * bumpTravelRatio ** 2);
      const bumpStopStartM = staticCompressionM
        + bumpTravelM * config.bumpStopStartRatio;
      const bumpStopCompressionM = Math.max(0, compressionM - bumpStopStartM);
      const bumpStopRangeM = Math.max(EPSILON, suspensionTravelM - bumpStopStartM);
      const bumpStopForceN = compressionM > bumpStopStartM
        ? config.bumpStopRateNpm * bumpStopCompressionM
          * (1 + 2 * bumpStopCompressionM / bumpStopRangeM)
        : 0;
      const relativeHubVelocityWorld = add(
        vector(kinematics.hubVelocityWorld),
        scale(vector(kinematics.suspensionMountVelocityWorld), -1)
      );
      const suspensionRelativeVelocityMps = -dot(
        relativeHubVelocityWorld,
        vector(kinematics.suspensionAxisWorld, { x: 0, y: -1, z: 0 })
      );
      const damperRateNsM = front
        ? (suspensionRelativeVelocityMps >= 0
          ? config.suspensionBumpDamperFrontNsM
          : config.suspensionReboundDamperFrontNsM)
        : (suspensionRelativeVelocityMps >= 0
          ? config.suspensionBumpDamperRearNsM
          : config.suspensionReboundDamperRearNsM);
      const damperForceN = calculateVelocitySensitiveDamperForce({
        relativeVelocityMps: suspensionRelativeVelocityMps,
        bumpDamperNsM: front
          ? config.suspensionBumpDamperFrontNsM
          : config.suspensionBumpDamperRearNsM,
        reboundDamperNsM: front
          ? config.suspensionReboundDamperFrontNsM
          : config.suspensionReboundDamperRearNsM,
        highSpeedThresholdMps: config.damperHighSpeedThresholdMps,
        highSpeedScale: config.damperHighSpeedScale
      });
      const springDisplacementFromSagM = compressionM - staticCompressionM;
      const baseSuspensionLoadN = geometricContact
        ? staticLoad + progressiveRate * springDisplacementFromSagM
          + damperForceN
          + bumpStopForceN
        : hasSurfaceHeight ? 0 : null;
      const geometryPitchSupport = front
        ? geometry.antiDive * Number(controls.brake || 0)
          * clamp(Math.abs(kinematics.longitudinalVelocityMps) / 2, 0, 1) * 0.12
        : geometry.antiSquat * Number(controls.throttle || 0)
          * clamp(1 - Number(controls.clutch || 0), 0, 1)
          * clamp(Math.abs(kinematics.longitudinalVelocityMps) / 2, 0, 1) * 0.1;
      const suspensionLoadN = baseSuspensionLoadN === null
        ? null
        : baseSuspensionLoadN * (1 + geometryPitchSupport);
      const fallbackLoadN = environment.normalLoadByWheel?.[wheelId]
        ?? staticLoad * Number(environment.normalLoadScaleByWheel?.[wheelId] ?? 1);
      const maxNormalLoadN = staticLoad * config.maxSuspensionLoadFactor;
      const normalLoadN = clamp(
        Number(suspensionLoadN ?? fallbackLoadN),
        0,
        maxNormalLoadN
      ) * contactScale;
      const material = environment.trackStateByWheel?.[wheelId] || environment.materialByWheel?.[wheelId] || {
        grip: environment.gripByWheel?.[wheelId] ?? 1
      };
      const authoredTire = {
        ...(config.tireByWheel?.[wheelId] || {}),
        ...(environment.tireByWheel?.[wheelId] || {})
      };
      const tireState = state.tireState?.[wheelId] || {};
      const tire = {
        ...authoredTire,
        treadTemperatureC: tireState.treadTemperatureC ?? authoredTire.treadTemperatureC,
        carcassTemperatureC: tireState.carcassTemperatureC ?? authoredTire.carcassTemperatureC,
        internalAirTemperatureC: tireState.internalAirTemperatureC
          ?? authoredTire.internalAirTemperatureC,
        effectivePressurePsi: tireState.effectivePressurePsi ?? authoredTire.effectivePressurePsi,
        temperatureF: tireState.temperatureF ?? authoredTire.temperatureF,
        wear: tireState.wear ?? authoredTire.wear,
        damage: authoredTire.damage ?? tireState.damage
      };
      return [wheelId, {
        kinematics,
        normalLoadN,
        staticLoadN: staticLoad,
        springRateNpm,
        damperRateNsM,
        suspensionTravelM,
        staticSagTargetM,
        droopTravelM,
        bumpTravelM,
        material,
        tire,
        hasSurfaceHeight,
        geometricContact,
        compressionM,
        penetrationM,
        contactVelocityNormalMps,
        compressionVelocityMps: suspensionRelativeVelocityMps,
        unsprungVelocityMps,
        geometry,
        footprint,
        progressiveRate,
        bumpStopForceN,
        damperForceN
      }];
    }));
    const applyAntiRollTransfer = (leftId, rightId, antiRollNormalized, physicalStiffnessNpm) => {
      const left = wheelInputs[leftId];
      const right = wheelInputs[rightId];
      if (!left || !right) return;
      const travelM = (left.suspensionTravelM + right.suspensionTravelM) * 0.5;
      const compressionDeltaM = Number(left.compressionM || 0) - Number(right.compressionM || 0);
      const authoredRollScale = clamp(config.rollStiffnessNormalized / 0.76, 0.5, 1.75);
      const requestedTransferN = clamp(
        physicalStiffnessNpm > 0
          ? compressionDeltaM * physicalStiffnessNpm
          : (compressionDeltaM / Math.max(0.05, travelM)) * config.massKg * 9.81
            * (0.065 + antiRollNormalized * 0.26) * authoredRollScale,
        -config.massKg * 9.81 * 0.22,
        config.massKg * 9.81 * 0.22
      );
      const transferN = requestedTransferN >= 0
        ? Math.min(requestedTransferN, Number(right.normalLoadN || 0))
        : Math.max(requestedTransferN, -Number(left.normalLoadN || 0));
      left.antiRollLoadTransferN = transferN;
      right.antiRollLoadTransferN = -transferN;
      left.normalLoadN = Math.max(0, Number(left.normalLoadN || 0) + transferN);
      right.normalLoadN = Math.max(0, Number(right.normalLoadN || 0) - transferN);
    };
    applyAntiRollTransfer('fl', 'fr', config.antiRollFront, config.antiRollStiffnessFrontNpm);
    applyAntiRollTransfer('rl', 'rr', config.antiRollRear, config.antiRollStiffnessRearNpm);
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const input = wheelInputs[wheelId];
      const rawKinematics = input.kinematics;
      const previousPatch = state.contactPatches?.[wheelId] || {};
      // Profiles can opt into a longer physical relaxation length. Keep the
      // compatibility default short so vehicles without authored tire data do
      // not acquire an unintended large transient lag.
      const relaxationLengthM = clamp(Number(input.tire.relaxationLengthM ?? 0.03), 0.03, 3);
      const peakSlip = clamp(Number(input.tire.peakSlip ?? 0.16), 0.03, 1.5);
      const breakawayHysteresis = clamp(Number(input.tire.breakawayHysteresis ?? 0.025), 0, 0.3);
      const recoveryHysteresis = clamp(Number(input.tire.recoveryHysteresis ?? 0.04), 0, 0.3);
      const rawCombinedSlip = Math.hypot(
        Number(rawKinematics.slipRatio || 0),
        Math.tan(Number(rawKinematics.slipAngleRad || 0))
      );
      const wasBrokenAway = previousPatch.breakawayActive === true;
      const breakawayActive = wasBrokenAway
        ? rawCombinedSlip > Math.max(0, peakSlip - recoveryHysteresis)
        : rawCombinedSlip > peakSlip + breakawayHysteresis;
      const contactTravelM = Math.max(
        0.5,
        Math.abs(Number(rawKinematics.longitudinalVelocityMps || 0)),
        Math.abs(Number(rawKinematics.wheelAngularVelocityRadps || 0)
          * Number(rawKinematics.effectiveRollingRadiusM || 0))
      ) * dt;
      const baseRelaxationAlpha = 1 - Math.exp(-contactTravelM / relaxationLengthM);
      const relaxationAlpha = clamp(
        baseRelaxationAlpha * (breakawayActive ? 1 : 1 - recoveryHysteresis * 1.5),
        0,
        1
      );
      input.kinematics = {
        ...rawKinematics,
        slipRatio: Number(previousPatch.relaxedSlipRatio ?? rawKinematics.slipRatio)
          + (Number(rawKinematics.slipRatio || 0)
            - Number(previousPatch.relaxedSlipRatio ?? rawKinematics.slipRatio)) * relaxationAlpha,
        slipAngleRad: Number(previousPatch.relaxedSlipAngleRad ?? rawKinematics.slipAngleRad)
          + (Number(rawKinematics.slipAngleRad || 0)
            - Number(previousPatch.relaxedSlipAngleRad ?? rawKinematics.slipAngleRad)) * relaxationAlpha
      };
      input.tireTransition = {
        rawSlipRatio: q(rawKinematics.slipRatio),
        rawSlipAngleRad: q(rawKinematics.slipAngleRad),
        relaxedSlipRatio: q(input.kinematics.slipRatio),
        relaxedSlipAngleRad: q(input.kinematics.slipAngleRad),
        relaxationLengthM: q(relaxationLengthM),
        breakawayHysteresis: q(breakawayHysteresis),
        recoveryHysteresis: q(recoveryHysteresis),
        breakawayActive
      };
      input.aquaplaning = calculateAquaplaningState({
        kinematics: input.kinematics,
        normalLoadN: input.normalLoadN,
        tire: input.tire,
        material: input.material
      });
      const brushForce = calculateBrushTireForce({
        kinematics: input.kinematics,
        normalLoadN: input.aquaplaning.supportedNormalLoadN,
        tire: { referenceLoadN: input.staticLoadN, ...input.tire },
        material: input.material
      });
      input.force = {
        ...brushForce,
        longitudinalForceN: q(brushForce.longitudinalForceN * input.aquaplaning.longitudinalForceScale),
        lateralForceN: q(brushForce.lateralForceN * input.aquaplaning.lateralForceScale),
        selfAligningMomentNm: q(brushForce.selfAligningMomentNm * input.aquaplaning.aligningTorqueScale),
        combinedSlipLimitN: q(brushForce.combinedSlipLimitN
          * Math.max(input.aquaplaning.longitudinalForceScale, input.aquaplaning.lateralForceScale)),
        aquaplaning: input.aquaplaning
      };
    });
    const capacityByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      wheelInputs[wheelId].aquaplaning.supportedNormalLoadN
        * Math.max(0.1, Number(wheelInputs[wheelId].force.gripCoefficient || 1))
    ]));
    const powertrainTuning = {
      torqueLbFt: Number(config.powertrainTuning?.torqueLbFt)
        || Number(config.enginePeakTorqueNm || 0) / 1.35582,
      idleRpm: config.idleRpm,
      revLimitRpm: config.maxRpm,
      torquePeakStartRpm: config.idleRpm + (config.maxRpm - config.idleRpm) * 0.35,
      torquePeakEndRpm: config.idleRpm + (config.maxRpm - config.idleRpm) * 0.68,
      torqueFalloffRpm: config.maxRpm,
      ...(config.powertrainTuning || {})
    };
    const mode = controls.throttle > 0.001 ? 'accel' : 'decel';
    const drivetrainCapacity = powertrainModel.resolveDrivetrainCapacity({
      tuning: powertrainTuning,
      drivenWheelIds: config.drivenWheelIds,
      capacityByWheel,
      mode
    });
    const driveShareByWheel = drivetrainCapacity.forceShareByWheel;
    const powertrainStep = powertrainModel.stepAuthoritativeWheelTorques({
      tuning: powertrainTuning,
      config,
      controls: { ...controls, centerSteeringAngleRad },
      previous: state.powertrainState || {},
      kinematicsByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
        wheelId, wheelInputs[wheelId].kinematics
      ])),
      capacityByWheel,
      driveShareByWheel,
      state,
      damage: environment.damage || {
        engine: environment.engineDamage,
        transmission: environment.transmissionDamage,
        brakes: environment.brakeDamageByWheel
      },
      dt
    });
    const powertrainGear = Math.trunc(Number(powertrainStep.state.gear || 0));
    const selectedGearRatio = powertrainGear < 0
      ? Math.abs(Number(powertrainTuning.reverseRatio || 0))
      : powertrainGear > 0
        ? Math.abs(Number(powertrainTuning.gearRatios?.[powertrainGear - 1] || 0))
        : 0;
    const finalDriveRatio = Math.abs(Number(
      powertrainTuning.gearFinalDrive || powertrainTuning.finalDrive || 1
    ));
    const overallDriveRatio = selectedGearRatio * finalDriveRatio;
    const maximumPoweredWheelOmegaRadps = overallDriveRatio > EPSILON
      ? (config.maxRpm * Math.PI * 2 / 60) / overallDriveRatio
        * (1 + clamp(Number(powertrainTuning.torqueConverterSlip || 0), 0, 0.25))
      : null;
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const {
        kinematics, normalLoadN, force, hasSurfaceHeight, geometricContact,
        compressionM, contactVelocityNormalMps, suspensionTravelM,
        springRateNpm, damperRateNsM, antiRollLoadTransferN = 0
      } = wheelInputs[wheelId];
      const rollingVelocity = Number(kinematics.longitudinalVelocityMps || 0);
      const rollingSign = rollingVelocity / Math.sqrt(rollingVelocity * rollingVelocity + 0.25 * 0.25);
      let localLongitudinal = force.longitudinalForceN - force.rollingResistanceN * rollingSign;
      if (Number(controls.throttle || 0) <= 0.001
        && localLongitudinal * rollingVelocity > 0) {
        localLongitudinal = 0;
      }
      const forceWorld = add(
        scale(kinematics.wheelForwardWorld, localLongitudinal),
        scale(kinematics.wheelLateralWorld, force.lateralForceN)
      );
      const radius = add(kinematics.contactPointWorld, scale(vector(state.position), -1));
      const moment = cross(radius, forceWorld);
      const normalForceWorld = scale(kinematics.surfaceNormalWorld, normalLoadN);
      const suspensionMoment = cross(radius, normalForceWorld);
      worldMoment = add(
        worldMoment,
        add(add(moment, suspensionMoment), scale(kinematics.surfaceNormalWorld, force.selfAligningMomentNm))
      );
      suspensionForce = add(suspensionForce, normalForceWorld);
      worldForce = add(worldForce, forceWorld);
      const driveTorque = Number(powertrainStep.wheelDriveTorqueNm[wheelId] || 0);
      const brakeTorqueMagnitude = Math.max(0, Number(
        powertrainStep.wheelBrakeTorqueNm[wheelId] || 0
      ));
      const angularReference = Math.abs(kinematics.wheelAngularVelocityRadps) > 0.05
        ? kinematics.wheelAngularVelocityRadps
        : Math.abs(kinematics.longitudinalVelocityMps) > 0.05
          ? kinematics.longitudinalVelocityMps / Math.max(EPSILON, kinematics.effectiveRollingRadiusM)
          : 0;
      const angularSign = Math.sign(angularReference);
      const reactionTorque = force.longitudinalForceN * kinematics.effectiveRollingRadiusM;
      const appliedWheelTorque = driveTorque - brakeTorqueMagnitude * angularSign;
      let nextAngular = kinematics.wheelAngularVelocityRadps
        + (appliedWheelTorque - reactionTorque) / config.wheelInertiaKgM2 * dt;
      const rollingAngularVelocityRadps = kinematics.longitudinalVelocityMps
        / Math.max(EPSILON, kinematics.effectiveRollingRadiusM);
      const currentRollingError = kinematics.wheelAngularVelocityRadps - rollingAngularVelocityRadps;
      const nextRollingError = nextAngular - rollingAngularVelocityRadps;
      const crossedRollingSpeed = currentRollingError * nextRollingError < 0;
      const crossedAgainstAppliedTorque = Math.abs(appliedWheelTorque) <= EPSILON
        || Math.sign(nextRollingError) !== Math.sign(appliedWheelTorque);
      if (crossedRollingSpeed && crossedAgainstAppliedTorque) {
        nextAngular = rollingAngularVelocityRadps;
      }
      const rollingRadiusM = Math.max(EPSILON, kinematics.effectiveRollingRadiusM);
      const staticTorqueCapacityNm = Math.max(0, Number(capacityByWheel[wheelId] || 0)) * rollingRadiusM;
      const tire = wheelInputs[wheelId].tire || {};
      const peakSlip = clamp(Number(tire.peakSlip ?? 0.16), 0.03, 1.5);
      const recoveryHysteresis = clamp(Number(tire.recoveryHysteresis ?? 0.04), 0, 0.3);
      const widthScale = clamp(Number(tire.widthMm ?? 245) / 245, 0.7, 1.4);
      const longitudinalStiffnessN = Math.max(
        1000,
        Number(tire.longitudinalStiffnessN || wheelInputs[wheelId].staticLoadN * 18) * widthScale
      );
      const equilibriumSlipDemand = Math.abs(
        (appliedWheelTorque / rollingRadiusM) / longitudinalStiffnessN
      );
      const withinStaticSlipRange = Math.abs(Number(
        wheelInputs[wheelId].tireTransition?.rawSlipRatio ?? kinematics.slipRatio ?? 0
      )) <= Math.max(0.03, peakSlip - recoveryHysteresis);
      const atRollingSpeed = Math.abs(currentRollingError) < 0.05 || crossedRollingSpeed;
      const staticTorqueRatio = Math.abs(appliedWheelTorque) / Math.max(EPSILON, staticTorqueCapacityNm);
      // Keep substep reaction torque from ratcheting a low-demand wheel out of
      // static adhesion. Higher launch demand still has to re-enter through the
      // rolling-speed crossing so genuine breakaway and wheelspin remain free.
      const nearRollingConstraint = (atRollingSpeed && staticTorqueRatio <= 0.72)
        || (withinStaticSlipRange
          && ((Number(controls.throttle || 0) > 0.5 && staticTorqueRatio <= 0.55)
            || (Number(controls.throttle || 0) <= 0.5
              && appliedWheelTorque > 0
              && equilibriumSlipDemand <= Math.min(0.005, peakSlip * 0.05))));
      if (geometricContact
        && nearRollingConstraint) {
        const equilibriumSlipRatio = clamp(
          (appliedWheelTorque / rollingRadiusM) / longitudinalStiffnessN,
          -0.08,
          0.08
        );
        const slipReferenceSpeedMps = Math.max(
          0.5,
          Math.abs(kinematics.longitudinalVelocityMps)
        );
        nextAngular = (kinematics.longitudinalVelocityMps
          + equilibriumSlipRatio * slipReferenceSpeedMps) / rollingRadiusM;
      }
      if (driven.has(wheelId)
        && powertrainStep.state.clutchCoupling > 0.001
        && Number.isFinite(maximumPoweredWheelOmegaRadps)) {
        const rollingOmega = Math.abs(
          kinematics.longitudinalVelocityMps / Math.max(EPSILON, kinematics.effectiveRollingRadiusM)
        );
        const coupledLimit = Math.max(
          maximumPoweredWheelOmegaRadps * 1.04,
          rollingOmega * 1.08 + 2
        );
        nextAngular = clamp(nextAngular, -coupledLimit, coupledLimit);
      }
      wheelAngularVelocityRadps[wheelId] = q(nextAngular);
      wheelLoadsN[wheelId] = q(wheelInputs[wheelId].aquaplaning.supportedNormalLoadN);
      wheelSlip[wheelId] = q(Math.hypot(kinematics.slipRatio, Math.tan(kinematics.slipAngleRad)));
      suspensionTravel[wheelId] = q(clamp(Number(environment.suspensionTravelByWheel?.[wheelId]
        ?? (hasSurfaceHeight ? compressionM / suspensionTravelM : (normalLoadN / Math.max(1, wheelInputs[wheelId].staticLoadN) - 0.7) / 0.6)), 0, 1));
      suspensionState[wheelId] = {
        compressionM: q(hasSurfaceHeight ? compressionM : clamp(
          suspensionTravelM * suspensionTravel[wheelId],
          0,
          suspensionTravelM
        )),
        compressionRatio: suspensionTravel[wheelId],
        compressionVelocityMps: q(wheelInputs[wheelId].compressionVelocityMps),
        suspensionAxisLocal: kinematics.suspensionAxisLocal,
        suspensionAxisWorld: kinematics.suspensionAxisWorld,
        restLengthM: kinematics.suspensionRestLengthM,
        droopTravelM: q(wheelInputs[wheelId].droopTravelM),
        bumpTravelM: q(wheelInputs[wheelId].bumpTravelM),
        staticSagTargetM: q(wheelInputs[wheelId].staticSagTargetM),
        bumpStopClearanceM: q(Math.max(0, wheelInputs[wheelId].staticSagTargetM
          + wheelInputs[wheelId].bumpTravelM * config.bumpStopStartRatio - compressionM)),
        hubPositionWorld: kinematics.hubPositionWorld,
        hubVelocityWorld: kinematics.hubVelocityWorld,
        suspensionMountPositionWorld: kinematics.suspensionMountPositionWorld,
        suspensionMountVelocityWorld: kinematics.suspensionMountVelocityWorld,
        springForceN: q(Math.max(0, normalLoadN)),
        springRateNpm: q(springRateNpm),
        damperRateNsM: q(damperRateNsM),
        damperVelocityMps: q(wheelInputs[wheelId].compressionVelocityMps),
        damperForceN: q(wheelInputs[wheelId].damperForceN),
        antiRollLoadTransferN: q(antiRollLoadTransferN),
        unsprungVelocityMps: q(wheelInputs[wheelId].unsprungVelocityMps),
        unsprungMassKg: q(config.unsprungMassByWheelKg?.[wheelId] || config.unsprungMassKg),
        tireVerticalStiffnessNpm: q(config.tireVerticalStiffnessNpm),
        bumpStopForceN: q(wheelInputs[wheelId].bumpStopForceN),
        geometry: wheelInputs[wheelId].geometry,
        footprint: wheelInputs[wheelId].footprint,
        geometricContact: hasSurfaceHeight ? geometricContact : normalLoadN > 1,
        inContact: normalLoadN > 1
      };
      tireForcesN[wheelId] = { longitudinal: q(localLongitudinal), lateral: force.lateralForceN };
      const rollingSurfaceSpeedMps = kinematics.wheelAngularVelocityRadps
        * kinematics.effectiveRollingRadiusM;
      const longitudinalSlipSpeedMps = rollingSurfaceSpeedMps - kinematics.longitudinalVelocityMps;
      const contactSpeedMps = Math.hypot(
        kinematics.longitudinalVelocityMps,
        kinematics.lateralVelocityMps
      );
      const treadTemperatureC = Number(wheelInputs[wheelId].tire.treadTemperatureC
        ?? ((Number(wheelInputs[wheelId].tire.temperatureF ?? 70) - 32) * 5 / 9));
      const surfaceTemperatureC = Number(wheelInputs[wheelId].material.surfaceTemperatureC
        ?? environment.ambientTemperatureC ?? 21);
      const standingWaterDepthMm = Math.max(0, Number(
        wheelInputs[wheelId].material.standingWaterDepthMm || 0
      ));
      const surfaceConductanceWPerC = normalLoadN > 1
        ? 32 + Math.min(90, normalLoadN / 55)
        : 0;
      const waterCoolingWPerC = normalLoadN > 1
        ? clamp(standingWaterDepthMm / 2.5, 0, 1) * (45 + contactSpeedMps * 5)
        : 0;
      const tireEnergyWork = {
        longitudinalFrictionWorkJ: q(Math.abs(force.longitudinalForceN * longitudinalSlipSpeedMps) * dt),
        lateralFrictionWorkJ: q(Math.abs(force.lateralForceN * kinematics.lateralVelocityMps) * dt),
        carcassFlexWorkJ: q(normalLoadN * (
          Math.abs(kinematics.slipRatio) * 0.34
          + Math.abs(kinematics.slipAngleRad) * 0.42
        ) * dt),
        loadHeatingWorkJ: q(normalLoadN * contactSpeedMps * 0.0028 * dt),
        surfaceConductionWorkJ: q((surfaceTemperatureC - treadTemperatureC)
          * surfaceConductanceWPerC * dt),
        waterCoolingWorkJ: q(Math.max(0, treadTemperatureC - Number(environment.ambientTemperatureC ?? 21))
          * waterCoolingWPerC * dt)
      };
      outputs[wheelId] = {
        ...kinematics,
        ...wheelInputs[wheelId].tireTransition,
        normalLoadN: q(wheelInputs[wheelId].aquaplaning.supportedNormalLoadN),
        suspensionNormalLoadN: q(normalLoadN),
        ...force,
        localForceN: { longitudinal: q(localLongitudinal), lateral: force.lateralForceN, normal: 0 },
        worldForceN: cleanVector(forceWorld),
        forceApplicationPointWorld: kinematics.contactPointWorld,
        momentApplicationPointWorld: kinematics.contactPointWorld,
        aligningMomentAxisWorld: kinematics.surfaceNormalWorld,
        tireEnergyWork,
        driveTorqueNm: q(driveTorque),
        brakeTorqueNm: q(brakeTorqueMagnitude),
        absModulation: q(powertrainStep.state.absModulationByWheel?.[wheelId] ?? 1),
        tireParameters: {
          pressurePsi: q(wheelInputs[wheelId].tire.pressurePsi ?? 32),
          coldPressurePsi: q(wheelInputs[wheelId].tire.coldPressurePsi
            ?? wheelInputs[wheelId].tire.pressurePsi ?? 32),
          treadThermalMassKg: q(wheelInputs[wheelId].tire.treadThermalMassKg ?? 3.4),
          carcassThermalMassKg: q(wheelInputs[wheelId].tire.carcassThermalMassKg ?? 6.8),
          damage: q(wheelInputs[wheelId].tire.damage ?? 0)
        },
        material: {
          baseSurfaceId: String(wheelInputs[wheelId].material.baseSurfaceId || 'unknown'),
          surfaceId: String(wheelInputs[wheelId].material.surfaceId
            || wheelInputs[wheelId].material.baseSurfaceId || 'unknown'),
          effectiveGrip: q(wheelInputs[wheelId].material.effectiveGrip ?? 1),
          effectiveGripMultiplier: q(
            wheelInputs[wheelId].material.effectiveGripMultiplier ?? 1
          ),
          surfaceGripScale: q(wheelInputs[wheelId].material.surfaceGripScale ?? 1),
          trackStateConditionApplied: wheelInputs[wheelId].material.trackStateConditionApplied === true,
          surfaceTemperatureC: q(wheelInputs[wheelId].material.surfaceTemperatureC ?? 21),
          moistureDepthMm: q(wheelInputs[wheelId].material.moistureDepthMm || 0),
          standingWaterDepthMm: q(wheelInputs[wheelId].material.standingWaterDepthMm || 0),
          snowDepthMm: q(wheelInputs[wheelId].material.snowDepthMm || 0),
          iceDepthMm: q(wheelInputs[wheelId].material.iceDepthMm || 0),
          looseMarbles: q(wheelInputs[wheelId].material.looseMarbles || 0),
          dirt: q(wheelInputs[wheelId].material.dirt || 0),
          mud: q(wheelInputs[wheelId].material.mud || 0),
          oil: q(wheelInputs[wheelId].material.oil || 0),
          roughness: q(wheelInputs[wheelId].material.roughness || 0),
          debris: q(wheelInputs[wheelId].material.debris || 0)
        },
        ambientTemperatureC: q(environment.ambientTemperatureC ?? 21)
      };
    });
    return {
      dt: q(dt, 12),
      longitudinalForceN: q(dot(worldForce, { x: Math.sin(state.yawRad), y: 0, z: Math.cos(state.yawRad) })),
      lateralForceN: q(dot(worldForce, { x: Math.cos(state.yawRad), y: 0, z: -Math.sin(state.yawRad) })),
      worldForceN: cleanVector(worldForce),
      worldMomentNm: cleanVector(worldMoment),
      yawMomentNm: q(worldMoment.y),
      suspensionForceWorldN: cleanVector(suspensionForce),
      verticalAccelerationMps2: q(Number(environment.verticalAccelerationMps2 || 0)),
      groundHeightM: Number.isFinite(Number(environment.groundHeightM))
        ? q(environment.groundHeightM)
        : sampledSurfaceHeights.length
          ? q(sampledSurfaceHeights.reduce((sum, height) => sum + height, 0) / sampledSurfaceHeights.length)
          : null,
      grounded: RACE_WHEEL_IDS.some((wheelId) => wheelLoadsN[wheelId] > 0),
      driveForceShareByWheel: { ...driveShareByWheel },
      powertrainState: powertrainStep.state,
      powertrainTelemetry: powertrainStep.telemetry,
      wheelLoadsN, wheelSlip, suspensionTravel, suspensionState, tireForcesN, wheelAngularVelocityRadps,
      contactPatches: outputs
    };
  }
}
