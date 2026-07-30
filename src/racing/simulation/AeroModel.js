import { MPH_TO_MPS, clamp } from './SimulationMath.js';

export class AeroModel {
  getDownforceByAxle(tuning = {}, speedMps = 0) {
    const speedRatio = Math.abs(Number(speedMps) || 0) / Math.max(1, 120 * MPH_TO_MPS);
    const speedSquared = clamp(speedRatio * speedRatio, 0, 3.2);
    const lbfToNewtons = 4.4482216153;
    return {
      front: clamp(Number(tuning?.aeroFront) || 0, 0, 1) * 520 * lbfToNewtons * speedSquared,
      rear: clamp(Number(tuning?.aeroRear) || 0, 0, 1) * 520 * lbfToNewtons * speedSquared
    };
  }

  getLoadEffectiveness(looseSurfaceFactor = 0) {
    const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
    return clamp(1 - loose * 0.64, 0.36, 1);
  }

  getEffectiveDownforceByAxle(tuning = {}, speedMps = 0, looseSurfaceFactor = 0) {
    const aero = this.getDownforceByAxle(tuning, speedMps);
    const effectiveness = this.getLoadEffectiveness(looseSurfaceFactor);
    return {
      front: Number(aero.front || 0) * effectiveness,
      rear: Number(aero.rear || 0) * effectiveness,
      effectiveness,
      physicalFront: Number(aero.front || 0),
      physicalRear: Number(aero.rear || 0)
    };
  }

  getLongitudinalResistance({
    tuning = {},
    speedMps = 0,
    setupModifiers = {},
    terrainResistance = null,
    tirePressureRollingMultiplier = 1,
    looseSurfaceFactor = 0,
    tireContactScale = 1,
    panelDrag = 1
  } = {}) {
    const speed = Math.abs(Number(speedMps) || 0);
    const frontalAreaM2 = Math.max(1.55, Number(tuning.widthM || 1.8) * Number(tuning.lengthM || 4.5) * 0.26);
    const dragCoefficient = clamp(Number(tuning.dragCoefficient) || 0.42, 0.08, 0.78)
      * Number(setupModifiers?.aeroDrag || 1)
      * Math.max(0.25, Number(panelDrag) || 1);
    const aeroDragN = 0.5 * 1.225 * dragCoefficient * frontalAreaM2 * speed * speed;
    const mass = Math.max(450, Number(tuning.weightKg) || 1400);
    const rollingCoefficient = 0.0115 + clamp(speed / 90, 0, 1.4) * 0.0025;
    const rollingBaseN = mass * 9.81 * rollingCoefficient;
    const hasExplicitTerrainResistance = terrainResistance !== null
      && terrainResistance !== undefined
      && Number.isFinite(Number(terrainResistance));
    const resolvedTerrainResistance = hasExplicitTerrainResistance
      ? Math.max(0.35, Number(terrainResistance))
      : 1 + clamp(Number(looseSurfaceFactor) || 0, 0, 1) * 0.32;
    const rollingResistanceN = rollingBaseN
      * resolvedTerrainResistance
      * Math.max(0.35, Number(tirePressureRollingMultiplier) || 1)
      * clamp(Number(tireContactScale) || 0, 0, 1);
    return {
      aeroDragN,
      rollingResistanceN,
      totalN: aeroDragN + rollingResistanceN,
      frontalAreaM2,
      dragCoefficient,
      terrainResistance: resolvedTerrainResistance
    };
  }

  getGradeGravityRatio(roadGrade = 0) {
    const grade = clamp(Number(roadGrade) || 0, -0.75, 0.75);
    return grade / Math.sqrt(1 + grade * grade);
  }
}
