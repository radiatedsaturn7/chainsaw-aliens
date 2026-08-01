import { MPH_TO_MPS, clamp } from './SimulationMath.js';
import { addVector3, crossVector3, rotateVectorByQuaternion, scaleVector3 } from './RigidBodyMath.js';

const EPSILON = 1e-9;
const q = (value) => Number((Number(value) || 0).toFixed(6));
const vector = (value = {}) => ({ x: Number(value.x || 0), y: Number(value.y || 0), z: Number(value.z || 0) });
const magnitude = (value) => Math.hypot(value.x, value.y, value.z);
const normalize = (value, fallback = { x: 0, y: 0, z: 1 }) => {
  const length = magnitude(value);
  return length > EPSILON ? scaleVector3(value, 1 / length) : { ...fallback };
};

function sampleAeroMap(map = {}, inputs = {}, fallback = {}) {
  const samples = Array.isArray(map.samples) ? map.samples : [];
  if (!samples.length) return { ...fallback };
  const scales = {
    speedMps: 60, yawRad: 0.5, pitchRad: 0.25, rollRad: 0.4,
    frontRideHeightM: 0.2, rearRideHeightM: 0.2, rakeRad: 0.12,
    activeAeroState: 1, bodyDamage: 1
  };
  const ranked = samples.map((sample, index) => {
    const distance = Object.keys(scales).reduce((sum, key) => {
      if (!Number.isFinite(Number(sample[key]))) return sum;
      const delta = (Number(inputs[key] || 0) - Number(sample[key])) / scales[key];
      return sum + delta * delta;
    }, 0);
    return { sample, index, distance };
  }).sort((left, right) => left.distance - right.distance || left.index - right.index).slice(0, 4);
  if (ranked[0]?.distance <= EPSILON) return { ...fallback, ...ranked[0].sample };
  const weights = ranked.map((entry) => 1 / Math.max(0.0001, entry.distance));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const result = { ...fallback };
  ['dragCoefficient', 'frontLiftCoefficient', 'rearLiftCoefficient', 'centerOfPressureM'].forEach((key) => {
    const contributors = ranked.filter((entry) => Number.isFinite(Number(entry.sample[key])));
    if (!contributors.length) return;
    result[key] = ranked.reduce((sum, entry, index) => (
      sum + Number(entry.sample[key] ?? fallback[key] ?? 0) * weights[index]
    ), 0) / totalWeight;
  });
  return result;
}

export function getAirDensityAtElevation(elevationM = 0, ambientTemperatureC = 15) {
  const altitude = clamp(Number(elevationM) || 0, -500, 6000);
  const temperatureK = clamp(Number(ambientTemperatureC) + 273.15, 220, 330);
  return q(1.225 * Math.exp(-altitude / 8500) * (288.15 / temperatureK));
}

export function calculateRelativeAirflow({ state = {}, windWorldMps = {}, gustWorldMps = {} } = {}) {
  const airVelocity = addVector3(vector(windWorldMps), vector(gustWorldMps));
  const relativeVelocity = addVector3(vector(state.velocity), scaleVector3(airVelocity, -1));
  const speedMps = magnitude(relativeVelocity);
  const directionWorld = normalize(relativeVelocity);
  const bodyForward = rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, state.orientation || {});
  const bodyRight = rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, state.orientation || {});
  const longitudinalMps = relativeVelocity.x * bodyForward.x + relativeVelocity.y * bodyForward.y + relativeVelocity.z * bodyForward.z;
  const lateralMps = relativeVelocity.x * bodyRight.x + relativeVelocity.y * bodyRight.y + relativeVelocity.z * bodyRight.z;
  return {
    airVelocityWorldMps: vector(airVelocity),
    relativeVelocityWorldMps: vector(relativeVelocity),
    directionWorld,
    speedMps: q(speedMps),
    longitudinalMps: q(longitudinalMps),
    lateralMps: q(lateralMps),
    yawRad: q(Math.atan2(lateralMps, Math.max(0.1, Math.abs(longitudinalMps))))
  };
}

export class AeroModel {
  calculateForces({ state = {}, config = {}, environment = {} } = {}) {
    const airflow = calculateRelativeAirflow({
      state,
      windWorldMps: environment.windWorldMps,
      gustWorldMps: environment.gustWorldMps
    });
    const wake = environment.wakeState || {};
    const frontTravel = Number(state.suspensionTravel?.fl ?? 0.5) + Number(state.suspensionTravel?.fr ?? 0.5);
    const rearTravel = Number(state.suspensionTravel?.rl ?? 0.5) + Number(state.suspensionTravel?.rr ?? 0.5);
    const frontRideHeightM = clamp(config.frontRideHeightM - frontTravel * 0.5 * config.suspensionTravelFrontM, 0.015, 0.5);
    const rearRideHeightM = clamp(config.rearRideHeightM - rearTravel * 0.5 * config.suspensionTravelRearM, 0.015, 0.5);
    const rakeRad = Math.atan2(rearRideHeightM - frontRideHeightM, Math.max(0.5, config.wheelbaseM));
    const bodyDamage = clamp(Number(environment.bodyDamage ?? state.bodyDamage ?? 0) / 100, 0, 1);
    const activeAeroState = clamp(Number(environment.activeAeroState || 0), 0, 1);
    const mapInputs = {
      speedMps: airflow.speedMps, yawRad: airflow.yawRad,
      pitchRad: Number(state.pitchRad || 0), rollRad: Number(state.rollRad || 0),
      frontRideHeightM, rearRideHeightM, rakeRad, activeAeroState, bodyDamage
    };
    const mapped = sampleAeroMap(config.aeroMap, mapInputs, {
      dragCoefficient: config.dragCoefficient,
      frontLiftCoefficient: -config.frontDownforceCoefficient,
      rearLiftCoefficient: -config.rearDownforceCoefficient,
      centerOfPressureM: 0
    });
    const yawMagnitude = Math.abs(airflow.yawRad);
    const groundClearance = (frontRideHeightM + rearRideHeightM) * 0.5;
    const groundEffect = 1 + config.groundEffectGain
      * Math.exp(-Math.max(0, groundClearance - config.groundEffectReferenceHeightM) / 0.08);
    const floorStall = clamp(
      (config.floorStallHeightM - groundClearance) / Math.max(0.005, config.floorStallHeightM * 0.45),
      0,
      1
    );
    const diffuserRakeScale = clamp(1 + rakeRad * config.diffuserRakeSensitivity, 0.45, 1.45);
    const extremeYawLift = clamp((yawMagnitude - 0.55) / 0.7, 0, 1);
    const attitudeScale = clamp(1 - Math.abs(Number(state.rollRad || 0)) * 0.35
      - Math.abs(Number(state.pitchRad || 0)) * 0.22, 0.45, 1.1);
    const dynamicPressure = 0.5 * getAirDensityAtElevation(
      Number(state.position?.y || 0), environment.ambientTemperatureC
    ) * airflow.speedMps * airflow.speedMps;
    const frontDamageScale = clamp(1 - Number(environment.frontAeroDamage ?? bodyDamage) * 0.75, 0.15, 1);
    const rearDamageScale = clamp(1 - Number(environment.rearAeroDamage ?? bodyDamage) * 0.75, 0.15, 1);
    const baseFloorScale = groundEffect * (1 - floorStall * 0.78) * diffuserRakeScale * attitudeScale;
    const frontDownforceN = dynamicPressure * config.frontalAreaM2
      * Math.max(-0.25, -Number(mapped.frontLiftCoefficient || 0))
      * baseFloorScale * frontDamageScale
      * (1 - clamp(Number(wake.frontDownforceLoss || 0), 0, 0.75));
    const rearDownforceN = dynamicPressure * config.frontalAreaM2
      * Math.max(-0.25, -Number(mapped.rearLiftCoefficient || 0))
      * baseFloorScale * rearDamageScale
      * (1 + clamp(Number(wake.rearDownforceChange || 0), -0.55, 0.25));
    const liftN = dynamicPressure * config.frontalAreaM2 * extremeYawLift * config.extremeYawLiftCoefficient;
    const dragCoefficient = Math.max(0.04, Number(mapped.dragCoefficient || config.dragCoefficient))
      * (1 + yawMagnitude * config.yawDragSensitivity + bodyDamage * config.damageDragGain)
      * (1 - clamp(Number(wake.dragReduction || 0), 0, 0.55));
    const dragForce = scaleVector3(airflow.directionWorld, -dynamicPressure * config.frontalAreaM2 * dragCoefficient);
    const bodyUp = normalize(rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, state.orientation || {}), { x: 0, y: 1, z: 0 });
    const bodyRight = normalize(rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, state.orientation || {}), { x: 1, y: 0, z: 0 });
    const turbulentSideForce = scaleVector3(bodyRight,
      dynamicPressure * config.frontalAreaM2 * 0.12 * Number(wake.lateralTurbulence || 0));
    const frontForce = addVector3(addVector3(dragForce, turbulentSideForce),
      scaleVector3(bodyUp, -frontDownforceN + liftN * 0.55));
    const rearForce = scaleVector3(bodyUp, -rearDownforceN + liftN * 0.45);
    const frontPoint = addVector3(vector(state.position), scaleVector3(
      normalize(rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, state.orientation || {})),
      config.frontAxleDistanceFromCgM + Number(mapped.centerOfPressureM || 0)
    ));
    const rearPoint = addVector3(vector(state.position), scaleVector3(
      normalize(rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, state.orientation || {})),
      -config.rearAxleDistanceFromCgM + Number(mapped.centerOfPressureM || 0)
    ));
    const frontArm = addVector3(frontPoint, scaleVector3(vector(state.position), -1));
    const rearArm = addVector3(rearPoint, scaleVector3(vector(state.position), -1));
    const totalForceWorldN = addVector3(frontForce, rearForce);
    const totalMomentWorldNm = addVector3(crossVector3(frontArm, frontForce), crossVector3(rearArm, rearForce));
    return {
      totalForceWorldN, totalMomentWorldNm, airflow,
      airDensityKgM3: getAirDensityAtElevation(Number(state.position?.y || 0), environment.ambientTemperatureC),
      dynamicPressurePa: q(dynamicPressure), dragCoefficient: q(dragCoefficient),
      dragForceN: q(magnitude(dragForce)), frontDownforceN: q(frontDownforceN),
      rearDownforceN: q(rearDownforceN), liftN: q(liftN), frontPoint, rearPoint,
      turbulentSideForceN: q(magnitude(turbulentSideForce)),
      frontRideHeightM: q(frontRideHeightM), rearRideHeightM: q(rearRideHeightM), rakeRad: q(rakeRad),
      groundEffectScale: q(groundEffect), floorStall: q(floorStall),
      diffuserRakeScale: q(diffuserRakeScale), wake: { ...wake }
    };
  }

  getDownforceByAxle(tuning = {}, speedMps = 0) {
    const speedRatio = Math.abs(Number(speedMps) || 0) / Math.max(1, 120 * MPH_TO_MPS);
    const speedSquared = clamp(speedRatio * speedRatio, 0, 3.2);
    const lbfToNewtons = 4.4482216153;
    return { front: clamp(Number(tuning?.aeroFront) || 0, 0, 1) * 520 * lbfToNewtons * speedSquared,
      rear: clamp(Number(tuning?.aeroRear) || 0, 0, 1) * 520 * lbfToNewtons * speedSquared };
  }

  getLoadEffectiveness(looseSurfaceFactor = 0) { return clamp(1 - clamp(Number(looseSurfaceFactor) || 0, 0, 1) * 0.64, 0.36, 1); }
  getEffectiveDownforceByAxle(tuning = {}, speedMps = 0, looseSurfaceFactor = 0) {
    const aero = this.getDownforceByAxle(tuning, speedMps); const effectiveness = this.getLoadEffectiveness(looseSurfaceFactor);
    return { front: aero.front * effectiveness, rear: aero.rear * effectiveness, effectiveness,
      physicalFront: aero.front, physicalRear: aero.rear };
  }
  getLongitudinalResistance({ tuning = {}, speedMps = 0, setupModifiers = {}, terrainResistance = null,
    tirePressureRollingMultiplier = 1, looseSurfaceFactor = 0, tireContactScale = 1, panelDrag = 1 } = {}) {
    const speed = Math.abs(Number(speedMps) || 0);
    const frontalAreaM2 = Math.max(1.55, Number(tuning.widthM || 1.8) * Number(tuning.lengthM || 4.5) * 0.26);
    const dragCoefficient = clamp(Number(tuning.dragCoefficient) || 0.42, 0.08, 0.78)
      * Number(setupModifiers?.aeroDrag || 1) * Math.max(0.25, Number(panelDrag) || 1);
    const aeroDragN = 0.5 * 1.225 * dragCoefficient * frontalAreaM2 * speed * speed;
    const mass = Math.max(450, Number(tuning.weightKg) || 1400);
    const rollingCoefficient = 0.0115 + clamp(speed / 90, 0, 1.4) * 0.0025;
    const rollingBaseN = mass * 9.81 * rollingCoefficient;
    const resolvedTerrainResistance = terrainResistance !== null && Number.isFinite(Number(terrainResistance))
      ? Math.max(0.35, Number(terrainResistance)) : 1 + clamp(Number(looseSurfaceFactor) || 0, 0, 1) * 0.32;
    const rollingResistanceN = rollingBaseN * resolvedTerrainResistance
      * Math.max(0.35, Number(tirePressureRollingMultiplier) || 1) * clamp(Number(tireContactScale) || 0, 0, 1);
    return { aeroDragN, rollingResistanceN, totalN: aeroDragN + rollingResistanceN,
      frontalAreaM2, dragCoefficient, terrainResistance: resolvedTerrainResistance };
  }
  getGradeGravityRatio(roadGrade = 0) { const grade = clamp(Number(roadGrade) || 0, -0.75, 0.75); return grade / Math.sqrt(1 + grade * grade); }
}
