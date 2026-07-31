import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';
import { PowertrainModel } from './PowertrainModel.js';

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
  const water = Math.max(0, Number(material.standingWaterDepthMm ?? material.waterDepthMm ?? 0));
  const snow = Math.max(0, Number(material.snowDepthMm || 0));
  const ice = Math.max(0, Number(material.iceDepthMm || 0));
  const marbles = clamp(Number(material.looseMarbles || 0), 0, 1);
  const dirt = clamp(Number(material.dirt || 0), 0, 1);
  const mud = clamp(Number(material.mud || 0), 0, 1);
  const oil = clamp(Number(material.oil || 0), 0, 1);
  const roughness = clamp(Number(material.roughness || 0), 0, 1);
  const rubber = clamp(Number(material.rubber || 0), 0, 1);
  const baseGrip = Math.max(0.03, Number(material.grip ?? material.baseGrip ?? 1));
  const contamination = (1 - clamp(water / 8, 0, 0.62))
    * (1 - clamp(snow / 45, 0, 0.72))
    * (1 - clamp(ice / 3, 0, 0.9))
    * (1 - marbles * 0.38)
    * (1 - dirt * 0.16)
    * (1 - mud * 0.48)
    * (1 - oil * 0.72);
  return clamp(baseGrip * contamination * (1 + rubber * 0.1) * (1 - roughness * 0.08), 0.025, 2);
}

export function calculateWheelContactKinematics({ state, config, controls, environment, wheelId }) {
  const front = wheelId[0] === 'f';
  const left = wheelId[1] === 'l';
  const track = front ? config.frontTrackWidthM : config.rearTrackWidthM;
  const localOffset = {
    forward: (front ? 0.5 : -0.5) * config.wheelbaseM,
    right: (left ? -0.5 : 0.5) * track,
    up: -config.cgHeightM + config.wheelRadiusM
  };
  const yaw = Number(state.yawRad || 0);
  const chassisForward = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  const chassisRight = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const chassisUp = { x: 0, y: 1, z: 0 };
  const centerRadius = add(add(scale(chassisForward, localOffset.forward), scale(chassisRight, localOffset.right)), scale(chassisUp, localOffset.up));
  const center = add(vector(state.position), centerRadius);
  const normal = normalize(vector(environment.surfaceNormalByWheel?.[wheelId], { x: 0, y: 1, z: 0 }));
  const steeringAngles = getAckermannSteeringAngles({
    steeringAngleRad: controls.steering * config.maxSteerAngleRad,
    wheelbaseM: config.wheelbaseM,
    frontTrackWidthM: config.frontTrackWidthM,
    ackermannRatio: config.ackermannRatio,
    steeringRackRatio: config.steeringRackRatio
  });
  const steeringAngleRad = steeringAngles[wheelId];
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
  const pressureDelta = Math.abs(Number(tire.pressurePsi ?? 32) - Number(tire.targetPressurePsi ?? 32));
  const pressureScale = clamp(1 - pressureDelta * 0.009, 0.72, 1.05);
  const temperatureF = Number(tire.temperatureF ?? 180);
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
  const mu = getTireGrip(tire, material, load, referenceLoad);
  const limit = mu * load;
  const widthScale = clamp(Number(tire.widthMm ?? 245) / 245, 0.7, 1.4);
  const pressureScale = clamp(32 / Math.max(18, Number(tire.pressurePsi ?? 32)), 0.7, 1.35);
  const longitudinalStiffness = Math.max(1000, Number(tire.longitudinalStiffnessN || referenceLoad * 18) * widthScale);
  const corneringStiffness = Math.max(1000, Number(tire.corneringStiffnessNPerRad || referenceLoad * 16) * widthScale * pressureScale);
  const camberStiffness = Math.max(0, Number(tire.camberStiffnessNPerRad || referenceLoad * 0.65));
  const demandX = longitudinalStiffness * Number(kinematics.slipRatio || 0);
  const demandY = -corneringStiffness * Math.tan(Number(kinematics.slipAngleRad || 0))
    + camberStiffness * Number(kinematics.camberAngleRad || 0);
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
    const staticLoad = config.massKg * 9.81 / 4;
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
    const wheelInputs = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
      const kinematics = calculateWheelContactKinematics({ state, config, controls, environment, wheelId });
      const hasSurfaceHeight = Number.isFinite(Number(environment.surfaceHeightByWheel?.[wheelId]));
      const contactScale = clamp(Number(environment.contactScaleByWheel?.[wheelId]
        ?? (environment.grounded === false ? 0 : 1)), 0, 1);
      const surfaceHeightM = Number(environment.surfaceHeightByWheel?.[wheelId] || 0);
      const penetrationM = hasSurfaceHeight
        ? surfaceHeightM - Number(kinematics.contactPointWorld.y || 0)
        : 0;
      const contactVelocityNormalMps = dot(kinematics.contactVelocityWorld, kinematics.surfaceNormalWorld);
      const suspensionLoadN = hasSurfaceHeight && penetrationM >= -0.05
        ? staticLoad
          + penetrationM * config.suspensionSpringRateNpm
          - contactVelocityNormalMps * config.suspensionDamperRateNsM
        : null;
      const normalLoadN = Math.max(0, Number(suspensionLoadN
        ?? environment.normalLoadByWheel?.[wheelId]
        ?? staticLoad * Number(environment.normalLoadScaleByWheel?.[wheelId] ?? 1))) * contactScale;
      const material = environment.trackStateByWheel?.[wheelId] || environment.materialByWheel?.[wheelId] || {
        grip: environment.gripByWheel?.[wheelId] ?? 1
      };
      const tire = environment.tireByWheel?.[wheelId] || config.tireByWheel?.[wheelId] || {};
      const force = calculateBrushTireForce({ kinematics, normalLoadN, tire: { referenceLoadN: staticLoad, ...tire }, material });
      return [wheelId, { kinematics, normalLoadN, material, tire, force, hasSurfaceHeight, penetrationM, contactVelocityNormalMps }];
    }));
    const capacityByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      wheelInputs[wheelId].normalLoadN * Math.max(0.1, Number(wheelInputs[wheelId].force.gripCoefficient || 1))
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
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const {
        kinematics, normalLoadN, force, hasSurfaceHeight, penetrationM, contactVelocityNormalMps
      } = wheelInputs[wheelId];
      const rollingVelocity = Number(kinematics.longitudinalVelocityMps || 0);
      const rollingSign = rollingVelocity / Math.sqrt(rollingVelocity * rollingVelocity + 0.25 * 0.25);
      const localLongitudinal = force.longitudinalForceN - force.rollingResistanceN * rollingSign;
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
        ? config.engineForceN * controls.throttle * Number(driveShareByWheel[wheelId] || 0)
          * kinematics.effectiveRollingRadiusM * direction
        : 0;
      const brakeTorqueMagnitude = config.brakeForceN * controls.brake / 4 * kinematics.effectiveRollingRadiusM
        + ((wheelId === 'rl' || wheelId === 'rr') ? config.handbrakeForceN * controls.handbrake * 0.5 * kinematics.effectiveRollingRadiusM : 0)
        + (driven.has(wheelId) && controls.requestedGear !== 0
          ? config.engineBrakeForceN * (1 - controls.throttle) * Number(driveShareByWheel[wheelId] || 0)
            * kinematics.effectiveRollingRadiusM
          : 0);
      const angularSign = Math.sign(kinematics.wheelAngularVelocityRadps || kinematics.longitudinalVelocityMps || direction);
      const reactionTorque = force.longitudinalForceN * kinematics.effectiveRollingRadiusM;
      const nextAngular = kinematics.wheelAngularVelocityRadps
        + (driveTorque - brakeTorqueMagnitude * angularSign - reactionTorque) / config.wheelInertiaKgM2 * dt;
      wheelAngularVelocityRadps[wheelId] = q(nextAngular);
      wheelLoadsN[wheelId] = q(normalLoadN);
      wheelSlip[wheelId] = q(Math.hypot(kinematics.slipRatio, Math.tan(kinematics.slipAngleRad)));
      suspensionTravel[wheelId] = q(clamp(Number(environment.suspensionTravelByWheel?.[wheelId]
        ?? (hasSurfaceHeight ? 0.5 + penetrationM / config.suspensionTravelM : (normalLoadN / Math.max(1, staticLoad) - 0.7) / 0.6)), 0, 1));
      suspensionState[wheelId] = {
        compressionM: q(clamp(penetrationM + config.suspensionTravelM * 0.5, 0, config.suspensionTravelM)),
        compressionRatio: suspensionTravel[wheelId],
        compressionVelocityMps: q(-contactVelocityNormalMps),
        springForceN: q(Math.max(0, normalLoadN)),
        inContact: normalLoadN > 1
      };
      tireForcesN[wheelId] = { longitudinal: q(localLongitudinal), lateral: force.lateralForceN };
      outputs[wheelId] = {
        ...kinematics,
        normalLoadN: q(normalLoadN),
        ...force,
        localForceN: { longitudinal: q(localLongitudinal), lateral: force.lateralForceN, normal: 0 },
        worldForceN: cleanVector(forceWorld),
        forceApplicationPointWorld: kinematics.contactPointWorld,
        momentApplicationPointWorld: kinematics.contactPointWorld,
        aligningMomentAxisWorld: kinematics.surfaceNormalWorld
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
      groundHeightM: Number.isFinite(Number(environment.groundHeightM)) ? q(environment.groundHeightM) : null,
      grounded: RACE_WHEEL_IDS.some((wheelId) => wheelLoadsN[wheelId] > 0),
      driveForceShareByWheel: { ...driveShareByWheel },
      wheelLoadsN, wheelSlip, suspensionTravel, suspensionState, tireForcesN, wheelAngularVelocityRadps,
      contactPatches: outputs
    };
  }
}
