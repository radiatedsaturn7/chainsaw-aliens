import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';
import { PowertrainModel } from './PowertrainModel.js';
import { rotateVectorByQuaternion } from './RigidBodyMath.js';
import { solveSuspensionGeometry } from './SuspensionGeometry.js';
import { resolveContactFootprint } from './ContactFootprint.js';

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

export function getContactPatchMaterialGrip(material = {}) {
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
  const yaw = Number(state.yawRad || 0);
  const orientation = state.orientation || {
    x: 0,
    y: Math.sin(yaw * 0.5),
    z: 0,
    w: Math.cos(yaw * 0.5)
  };
  const localOffset = {
    x: (left ? -0.5 : 0.5) * track,
    y: -config.cgHeightM + config.wheelRadiusM,
    z: front ? config.frontAxleDistanceFromCgM : -config.rearAxleDistanceFromCgM
  };
  const chassisForward = normalize(rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, orientation), { x: 0, y: 0, z: 1 });
  const chassisRight = normalize(rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, orientation), { x: 1, y: 0, z: 0 });
  const centerRadius = rotateVectorByQuaternion(localOffset, orientation);
  const center = add(vector(state.position), centerRadius);
  const normal = normalize(vector(environment.surfaceNormalByWheel?.[wheelId], { x: 0, y: 1, z: 0 }));
  const steeringAngles = getAckermannSteeringAngles({
    steeringAngleRad: controls.steering * config.maxSteerAngleRad,
    wheelbaseM: config.wheelbaseM,
    frontTrackWidthM: config.frontTrackWidthM,
    ackermannRatio: config.ackermannRatio,
    steeringRackRatio: config.steeringRackRatio
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
  const contactVelocity = add(vector(state.velocity), cross(angularVelocity, radius));
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
  const compoundGrip = Number(tire.compoundGrip ?? compound.grip ?? compound.surfaceGrip?.[material.surfaceId] ?? 1);
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
  const demandX = longitudinalStiffness * Number(kinematics.slipRatio || 0);
  const demandY = -corneringStiffness * Math.tan(Number(kinematics.slipAngleRad || 0))
    + camberStiffness * Number(kinematics.camberAngleRad || 0) * camberActivation;
  const demand = Math.hypot(demandX, demandY);
  const transition = Math.max(EPSILON, 3 * limit);
  let magnitude;
  let postPeakSlidingForceN = limit;
  if (demand <= transition) {
    const ratio = demand / transition;
    magnitude = demand * (1 - ratio + ratio * ratio / 3);
  } else {
    const excess = (demand - transition) / transition;
    postPeakSlidingForceN = limit * (0.66 + 0.22 * Math.exp(-1.8 * excess));
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
      const damperRateNsM = front
        ? (compressionVelocityMps >= 0
          ? config.suspensionBumpDamperFrontNsM
          : config.suspensionReboundDamperFrontNsM)
        : (compressionVelocityMps >= 0
          ? config.suspensionBumpDamperRearNsM
          : config.suspensionReboundDamperRearNsM);
      const baseGeometry = solveSuspensionGeometry({
        definition: front ? config.suspensionDefinitionFront : config.suspensionDefinitionRear,
        compressionM: 0,
        springRateNpm
      });
      const staticCompressionM = clamp(
        staticLoad / Math.max(1, baseGeometry.wheelRateNpm),
        0,
        suspensionTravelM
      );
      const targetCompressionM = hasSurfaceHeight
        ? clamp(staticCompressionM + penetrationM, 0, suspensionTravelM)
        : null;
      const previousSuspension = state.suspensionState?.[wheelId] || {};
      let unsprungVelocityMps = Number(previousSuspension.unsprungVelocityMps || 0);
      let compressionM = Number(previousSuspension.compressionM ?? targetCompressionM ?? 0);
      if (hasSurfaceHeight) {
        const tireErrorM = Number(targetCompressionM) - compressionM;
        const tireForceN = tireErrorM * config.tireVerticalStiffnessNpm
          - unsprungVelocityMps * config.tireVerticalDampingNsM;
        unsprungVelocityMps += tireForceN / config.unsprungMassKg * dt;
        compressionM = clamp(compressionM + unsprungVelocityMps * dt, 0, suspensionTravelM);
        if (compressionM === 0 || compressionM === suspensionTravelM) unsprungVelocityMps *= 0.35;
      } else {
        unsprungVelocityMps -= 9.81 * dt;
        compressionM = Math.max(0, compressionM + unsprungVelocityMps * dt);
        if (compressionM === 0) unsprungVelocityMps = 0;
      }
      const geometry = solveSuspensionGeometry({
        definition: front ? config.suspensionDefinitionFront : config.suspensionDefinitionRear,
        compressionM: compressionM - staticCompressionM,
        steeringAngleRad: controls.steering * config.maxSteerAngleRad,
        staticCamberRad: front ? config.camberFrontRad : config.camberRearRad,
        staticToeRad: front ? config.toeFrontRad : config.toeRearRad,
        springRateNpm
      });
      kinematics = calculateWheelContactKinematics({ state, config, controls, environment: {
        ...resolvedEnvironment,
        camberByWheel: { ...resolvedEnvironment.camberByWheel, [wheelId]: geometry.camberRad },
        toeByWheel: { ...resolvedEnvironment.toeByWheel, [wheelId]: geometry.toeRad }
      }, wheelId });
      const geometricContact = hasSurfaceHeight && compressionM > EPSILON;
      const compressionRatio = compressionM / suspensionTravelM;
      const bumpTravelRatio = Math.max(0, compressionM - staticCompressionM) / suspensionTravelM;
      const progressiveRate = geometry.wheelRateNpm * (1 + config.progressiveSpringRate * bumpTravelRatio ** 2);
      const bumpStopStartM = staticCompressionM
        + (suspensionTravelM - staticCompressionM) * config.bumpStopStartRatio;
      const bumpStopCompressionM = Math.max(0, compressionM - bumpStopStartM);
      const bumpStopRangeM = Math.max(EPSILON, suspensionTravelM - bumpStopStartM);
      const bumpStopForceN = compressionM > bumpStopStartM
        ? config.bumpStopRateNpm * bumpStopCompressionM
          * (1 + 2 * bumpStopCompressionM / bumpStopRangeM)
        : 0;
      const velocityRatio = Math.abs(unsprungVelocityMps) / config.damperHighSpeedThresholdMps;
      const velocityDamperScale = 1 + Math.max(0, velocityRatio - 1) * config.damperHighSpeedScale;
      const suspensionRelativeVelocityMps = unsprungVelocityMps;
      const baseSuspensionLoadN = geometricContact
        ? progressiveRate * compressionM + suspensionRelativeVelocityMps * damperRateNsM * velocityDamperScale + bumpStopForceN
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
      const tire = environment.tireByWheel?.[wheelId] || config.tireByWheel?.[wheelId] || {};
      return [wheelId, {
        kinematics,
        normalLoadN,
        staticLoadN: staticLoad,
        springRateNpm,
        damperRateNsM,
        suspensionTravelM,
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
        bumpStopForceN
      }];
    }));
    const applyAntiRollTransfer = (leftId, rightId, antiRollNormalized) => {
      const left = wheelInputs[leftId];
      const right = wheelInputs[rightId];
      if (!left || !right) return;
      const travelM = (left.suspensionTravelM + right.suspensionTravelM) * 0.5;
      const compressionDeltaM = Number(left.compressionM || 0) - Number(right.compressionM || 0);
      const authoredRollScale = clamp(config.rollStiffnessNormalized / 0.76, 0.5, 1.75);
      const requestedTransferN = clamp(
        (compressionDeltaM / Math.max(0.05, travelM)) * config.massKg * 9.81
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
    applyAntiRollTransfer('fl', 'fr', config.antiRollFront);
    applyAntiRollTransfer('rl', 'rr', config.antiRollRear);
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const input = wheelInputs[wheelId];
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
    const powertrainTuning = config.powertrainTuning || {};
    const mode = controls.throttle > 0.001 ? 'accel' : 'decel';
    const drivetrainCapacity = powertrainModel.resolveDrivetrainCapacity({
      tuning: powertrainTuning,
      drivenWheelIds: config.drivenWheelIds,
      capacityByWheel,
      mode
    });
    const driveShareByWheel = drivetrainCapacity.forceShareByWheel;
    const clutchCoupling = clamp(1 - Number(controls.clutch || 0), 0, 1);
    const requestedGear = Math.trunc(Number(controls.requestedGear || 0));
    const selectedGearRatio = requestedGear < 0
      ? Math.abs(Number(powertrainTuning.reverseRatio || 0))
      : requestedGear > 0
        ? Math.abs(Number(powertrainTuning.gearRatios?.[requestedGear - 1] || 0))
        : 0;
    const finalDriveRatio = Math.abs(Number(
      powertrainTuning.gearFinalDrive || powertrainTuning.finalDrive || 1
    ));
    const overallDriveRatio = selectedGearRatio * finalDriveRatio;
    const transmittedEngineTorqueNm = config.enginePeakTorqueNm > 0 && overallDriveRatio > EPSILON
      ? config.enginePeakTorqueNm * overallDriveRatio * config.drivetrainEfficiency
        * controls.throttle * clutchCoupling
      : null;
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
      const direction = controls.requestedGear < 0 ? -1 : 1;
      const driveTorque = driven.has(wheelId)
        ? Number(driveShareByWheel[wheelId] || 0) * direction
          * (transmittedEngineTorqueNm ?? (
            config.engineForceN * controls.throttle * kinematics.effectiveRollingRadiusM * clutchCoupling
          ))
        : 0;
      const brakeTorqueMagnitude = config.brakeForceN * controls.brake / 4 * kinematics.effectiveRollingRadiusM
        + ((wheelId === 'rl' || wheelId === 'rr') ? config.handbrakeForceN * controls.handbrake * 0.5 * kinematics.effectiveRollingRadiusM : 0)
        + (driven.has(wheelId) && controls.requestedGear !== 0
          ? config.engineBrakeForceN * (1 - controls.throttle) * Number(driveShareByWheel[wheelId] || 0)
            * kinematics.effectiveRollingRadiusM * clutchCoupling
          : 0);
      const angularReference = Math.abs(kinematics.wheelAngularVelocityRadps) > 0.05
        ? kinematics.wheelAngularVelocityRadps
        : Math.abs(kinematics.longitudinalVelocityMps) > 0.05
          ? kinematics.longitudinalVelocityMps / Math.max(EPSILON, kinematics.effectiveRollingRadiusM)
          : 0;
      const angularSign = Math.sign(angularReference);
      const reactionTorque = force.longitudinalForceN * kinematics.effectiveRollingRadiusM;
      let nextAngular = kinematics.wheelAngularVelocityRadps
        + (driveTorque - brakeTorqueMagnitude * angularSign - reactionTorque) / config.wheelInertiaKgM2 * dt;
      const rollingAngularVelocityRadps = kinematics.longitudinalVelocityMps
        / Math.max(EPSILON, kinematics.effectiveRollingRadiusM);
      const currentRollingError = kinematics.wheelAngularVelocityRadps - rollingAngularVelocityRadps;
      const nextRollingError = nextAngular - rollingAngularVelocityRadps;
      if (Math.abs(driveTorque) <= EPSILON
        && brakeTorqueMagnitude <= EPSILON
        && currentRollingError * nextRollingError <= 0) {
        nextAngular = rollingAngularVelocityRadps;
      }
      if (driven.has(wheelId)
        && clutchCoupling > 0.001
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
        springForceN: q(Math.max(0, normalLoadN)),
        springRateNpm: q(springRateNpm),
        damperRateNsM: q(damperRateNsM),
        antiRollLoadTransferN: q(antiRollLoadTransferN),
        unsprungVelocityMps: q(wheelInputs[wheelId].unsprungVelocityMps),
        unsprungMassKg: q(config.unsprungMassKg),
        tireVerticalStiffnessNpm: q(config.tireVerticalStiffnessNpm),
        bumpStopForceN: q(wheelInputs[wheelId].bumpStopForceN),
        geometry: wheelInputs[wheelId].geometry,
        footprint: wheelInputs[wheelId].footprint,
        geometricContact: hasSurfaceHeight ? geometricContact : normalLoadN > 1,
        inContact: normalLoadN > 1
      };
      tireForcesN[wheelId] = { longitudinal: q(localLongitudinal), lateral: force.lateralForceN };
      outputs[wheelId] = {
        ...kinematics,
        normalLoadN: q(wheelInputs[wheelId].aquaplaning.supportedNormalLoadN),
        suspensionNormalLoadN: q(normalLoadN),
        ...force,
        localForceN: { longitudinal: q(localLongitudinal), lateral: force.lateralForceN, normal: 0 },
        worldForceN: cleanVector(forceWorld),
        forceApplicationPointWorld: kinematics.contactPointWorld,
        momentApplicationPointWorld: kinematics.contactPointWorld,
        aligningMomentAxisWorld: kinematics.surfaceNormalWorld,
        tireParameters: {
          pressurePsi: q(wheelInputs[wheelId].tire.pressurePsi ?? 32),
          coldPressurePsi: q(wheelInputs[wheelId].tire.coldPressurePsi
            ?? wheelInputs[wheelId].tire.pressurePsi ?? 32),
          treadThermalMassKg: q(wheelInputs[wheelId].tire.treadThermalMassKg ?? 3.4),
          carcassThermalMassKg: q(wheelInputs[wheelId].tire.carcassThermalMassKg ?? 6.8)
        },
        material: {
          surfaceTemperatureC: q(wheelInputs[wheelId].material.surfaceTemperatureC ?? 21),
          moistureDepthMm: q(wheelInputs[wheelId].material.moistureDepthMm || 0),
          standingWaterDepthMm: q(wheelInputs[wheelId].material.standingWaterDepthMm || 0),
          snowDepthMm: q(wheelInputs[wheelId].material.snowDepthMm || 0),
          iceDepthMm: q(wheelInputs[wheelId].material.iceDepthMm || 0)
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
      wheelLoadsN, wheelSlip, suspensionTravel, suspensionState, tireForcesN, wheelAngularVelocityRadps,
      contactPatches: outputs
    };
  }
}
