import { getRaceTireLoadSensitivityMultiplierForLoose } from '../RaceVehiclePhysics.js';
import { RACE_WHEEL_IDS, clamp, normalizeAngle } from './SimulationMath.js';
import { getSurfaceById } from '../raceData.js';

export class TireModel {
  getPressureTargetPsi({ compoundId = 'tarmac', surfaceId = 'asphalt' } = {}) {
    const compound = String(compoundId || 'tarmac');
    const surface = getSurfaceById(surfaceId).id;
    const base = {
      tarmac: 32,
      rain: 31,
      dirt: 28,
      offroad: 25,
      drift: 34,
      snow: 23
    }[compound] || 32;
    const surfaceAdjust = {
      asphalt: 0,
      'wet-asphalt': -1,
      dirt: -3,
      gravel: -3,
      mud: -5,
      'wet-gravel': -4,
      snow: -7,
      slush: -6
    }[surface] || 0;
    return clamp(base + surfaceAdjust, 18, 42);
  }

  getSizeGripMultiplier({ tireSize = {}, surfaceId = 'asphalt' } = {}) {
    const widthRatio = clamp((Number(tireSize.widthMm || 245) - 245) / 120, -1, 1.35);
    const sidewallRatio = clamp((Number(tireSize.aspectRatio || 40) - 40) / 25, -1, 1.4);
    const surface = getSurfaceById(surfaceId).id;
    if (surface === 'asphalt') {
      return clamp(1 + widthRatio * 0.065 - Math.max(0, sidewallRatio) * 0.018, 0.9, 1.09);
    }
    if (surface === 'wet-asphalt') {
      return clamp(1 + widthRatio * 0.028 - Math.max(0, widthRatio) * 0.022 + sidewallRatio * 0.01, 0.9, 1.05);
    }
    if (['dirt', 'gravel', 'wet-gravel', 'mud'].includes(surface)) {
      return clamp(1 - Math.max(0, widthRatio) * 0.035 + Math.max(0, sidewallRatio) * 0.045, 0.88, 1.08);
    }
    if (['snow', 'slush'].includes(surface)) {
      return clamp(1 - Math.max(0, widthRatio) * 0.075 + Math.max(0, sidewallRatio) * 0.038, 0.82, 1.06);
    }
    return 1;
  }

  getPressureDynamics({
    pressurePsi = 32,
    compoundId = 'tarmac',
    surfaceId = 'asphalt',
    tireSize = {},
    temperatureF = 70
  } = {}) {
    const coldPressure = clamp(Number(pressurePsi) || 32, 18, 52);
    const temp = Number(temperatureF);
    const temperaturePressureRisePsi = Number.isFinite(temp)
      ? clamp((temp - 70) * 0.055, -2.2, 13.5)
      : 0;
    const pressure = clamp(coldPressure + temperaturePressureRisePsi, 16, 58);
    const targetPsi = this.getPressureTargetPsi({ compoundId, surfaceId });
    const delta = pressure - targetPsi;
    const over = Math.max(0, delta);
    const under = Math.max(0, -delta);
    const coldDelta = coldPressure - targetPsi;
    const coldOver = Math.max(0, coldDelta);
    const coldUnder = Math.max(0, -coldDelta);
    const surface = getSurfaceById(surfaceId).id;
    const loose = ['dirt', 'gravel', 'wet-gravel', 'mud', 'snow', 'slush'].includes(surface) ? 1 : 0;
    const overGripPenalty = Math.min(0.22, over * (loose ? 0.006 : 0.009));
    const underGripPenalty = Math.min(0.2, under * (loose ? 0.007 : 0.006));
    const coldOverGripPenalty = Math.min(0.22, coldOver * (loose ? 0.006 : 0.009));
    const coldUnderGripPenalty = Math.min(0.2, coldUnder * (loose ? 0.007 : 0.006));
    const sizeGrip = this.getSizeGripMultiplier({ tireSize, surfaceId: surface });
    const coldGripMultiplier = clamp(
      (1 - coldOverGripPenalty - coldUnderGripPenalty) * sizeGrip,
      0.72,
      1.12
    );
    const heatMultiplier = clamp(1 + under * 0.032 + over * 0.012 + loose * under * 0.01, 0.92, 1.75);
    const wearMultiplier = clamp(1 + under * 0.018 + over * 0.011, 0.95, 1.55);
    const rollingMultiplier = clamp(1 + under * 0.03 - Math.min(0.08, over * 0.004), 0.9, 1.48);
    return {
      pressurePsi: pressure,
      coldPressurePsi: coldPressure,
      temperaturePressureRisePsi,
      targetPsi,
      gripMultiplier: clamp((1 - overGripPenalty - underGripPenalty) * sizeGrip, 0.72, 1.12),
      coldGripMultiplier,
      heatMultiplier,
      wearMultiplier,
      rollingMultiplier,
      sizeGripMultiplier: sizeGrip
    };
  }

  getSetupGripMultiplier({
    setup = {},
    compoundByWheel = {},
    surfaceId = 'asphalt',
    weather = 'clear'
  } = {}) {
    const surface = getSurfaceById(surfaceId).id;
    const grip = RACE_WHEEL_IDS.map((wheelId) => {
      const compound = compoundByWheel[wheelId] || {};
      const pressureDynamics = this.getPressureDynamics({
        pressurePsi: setup.tirePressurePsi?.[wheelId],
        compoundId: compound.id,
        surfaceId: surface,
        tireSize: setup.tireSize
      });
      return (compound.surfaceGrip?.[surface] || 0.7)
        * (compound.weatherGrip?.[weather] || 1)
        * pressureDynamics.gripMultiplier;
    });
    return clamp(grip.reduce((sum, value) => sum + value, 0) / Math.max(1, grip.length), 0.25, 1.2);
  }

  getWheelGripForSurface({
    wheelId = 'fl',
    setup = {},
    compound = {},
    surfaceId = 'asphalt',
    baseSurfaceId = surfaceId,
    snowDepthInches = 0,
    weather = 'clear',
    damage = {},
    terrainGripScale = 1,
    temperatureF = null
  } = {}) {
    const surface = getSurfaceById(surfaceId).id;
    const baseSurface = getSurfaceById(baseSurfaceId).id;
    const hasTemperature = temperatureF !== null
      && temperatureF !== undefined
      && Number.isFinite(Number(temperatureF));
    const tireTemperatureF = hasTemperature ? Number(temperatureF) : 70;
    const pressureDynamics = this.getPressureDynamics({
      pressurePsi: setup.tirePressurePsi?.[wheelId],
      compoundId: compound.id,
      surfaceId: surface,
      tireSize: setup.tireSize,
      temperatureF: tireTemperatureF
    });
    const temperatureGrip = hasTemperature
      ? this.getTemperatureGripMultiplier(tireTemperatureF)
      : 1;
    const tireHealth = 1 - clamp(Number(damage.tires?.[wheelId] || 0) / 125, 0, 0.74);
    const suspensionHealth = 1 - clamp(Number(damage.suspension?.[wheelId] || 0) / 145, 0, 0.58);
    const snowDepth = clamp(Number(snowDepthInches) || 0, 0, 6);
    const snowCoverage = snowDepth / 6;
    const baseCompoundGrip = compound.surfaceGrip?.[baseSurface]
      || compound.surfaceGrip?.[surface]
      || 0.7;
    const snowTargetSurface = surface === 'slush' && baseSurface === 'snow' ? 'slush' : 'snow';
    const snowCompoundGrip = compound.surfaceGrip?.[snowTargetSurface]
      || compound.surfaceGrip?.snow
      || 0.7;
    const compoundGrip = snowDepth > 0
      ? baseCompoundGrip + (snowCompoundGrip - baseCompoundGrip) * snowCoverage
      : (compound.surfaceGrip?.[surface] || 0.7) * (compound.weatherGrip?.[weather] || 1);
    return clamp(
      compoundGrip
        * pressureDynamics.gripMultiplier
        * temperatureGrip
        * tireHealth
        * suspensionHealth
        * clamp(Number(terrainGripScale) || 1, 0.22, 1.12),
      0.08,
      1.28
    );
  }

  getTemperatureGripMultiplier(tempF = 70) {
    const temp = Number(tempF);
    if (!Number.isFinite(temp)) return 1;
    if (temp < 35) return 0.72;
    if (temp < 70) return 0.84 + (temp - 35) / 35 * 0.16;
    if (temp < 145) return 1 + (temp - 70) / 75 * 0.02;
    if (temp < 210) return 1.02 + (temp - 145) / 65 * 0.06;
    if (temp < 245) return 1.08 - (temp - 210) / 35 * 0.05;
    if (temp < 295) return 1.03 - (temp - 245) / 50 * 0.26;
    if (temp < 360) return 0.77 - (temp - 295) / 65 * 0.24;
    return 0.48;
  }

  getTemperatureGripMultipliers(temperatures = {}) {
    return Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      this.getTemperatureGripMultiplier(temperatures?.[wheelId])
    ]));
  }

  getTemperatureWearMultiplier(tempF = 70) {
    const temp = Number(tempF);
    if (!Number.isFinite(temp)) return 1;
    if (temp < 210) return 1;
    if (temp < 260) return 1 + (temp - 210) / 50 * 0.45;
    if (temp < 330) return 1.45 + (temp - 260) / 70 * 1.15;
    return 2.6 + Math.min(1.4, (temp - 330) / 90);
  }

  getTemperatureWearMultipliers(temperatures = {}) {
    return Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      this.getTemperatureWearMultiplier(temperatures?.[wheelId])
    ]));
  }

  getSurfaceWearMultiplier(compoundId = 'tarmac', terrain = 'road', surfaceId = 'asphalt') {
    const compound = String(compoundId || 'tarmac');
    const surface = String(surfaceId || '').toLowerCase();
    const region = String(terrain || '').toLowerCase();
    const offRoad = region !== 'road'
      || ['dirt', 'gravel', 'mud', 'wet-gravel', 'snow', 'slush'].includes(surface);
    if (!offRoad) return compound === 'offroad' || compound === 'dirt' || compound === 'snow' ? 1.18 : 1;
    if (compound === 'tarmac') return surface === 'snow' || surface === 'slush' ? 2.1 : 1.72;
    if (compound === 'rain') return surface === 'snow' || surface === 'slush' ? 1.85 : 1.44;
    if (compound === 'dirt') return surface === 'snow' || surface === 'slush' ? 1.38 : 1.08;
    if (compound === 'offroad') return surface === 'snow' || surface === 'slush' ? 1.22 : 0.94;
    if (compound === 'snow') return surface === 'snow' || surface === 'slush' ? 0.96 : 1.5;
    return 1.25;
  }

  getWearMultiplier(compoundByWheel = {}) {
    const wear = RACE_WHEEL_IDS.map((wheelId) => (
      Number(compoundByWheel?.[wheelId]?.wearRate) || 1
    ));
    return clamp(
      wear.reduce((sum, value) => sum + value, 0) / Math.max(1, wear.length),
      0.7,
      1.6
    );
  }

  getSurfaceHeatScale(surfaceId = 'asphalt', terrain = 'road') {
    const material = String(surfaceId || 'asphalt').toLowerCase();
    const contactTerrain = String(terrain || 'road').toLowerCase();
    let materialScale = 1;
    if (/snow|slush|ice/.test(material)) materialScale = 0.18;
    else if (/dirt|mud|grass|sand/.test(material)) materialScale = 0.35;
    else if (/gravel/.test(material)) materialScale = 0.45;
    else if (/wet|water/.test(material)) materialScale = 0.75;
    const terrainScale = contactTerrain === 'off-road' || contactTerrain === 'terrain'
      ? 0.72
      : contactTerrain === 'transition'
        ? 0.8
        : contactTerrain === 'shoulder'
          ? 0.85
          : 1;
    return materialScale * terrainScale;
  }

  getUpdatedTemperature({
    previousTemperatureF = 70,
    seconds = 0,
    speedMps = 0,
    loadRatio = 1,
    slip = 0,
    pressureDynamics = {},
    handbrake = 0,
    wheelId = 'fl',
    contactLoadScale = 1,
    surfaceId = 'asphalt',
    terrain = 'road',
    frictionHeatScale = null
  } = {}) {
    const previous = Number.isFinite(Number(previousTemperatureF)) ? Number(previousTemperatureF) : 70;
    const dt = Math.max(0, Number(seconds) || 0);
    const speedMph = Math.abs(Number(speedMps || 0)) * 2.23694;
    const wheelSlip = Math.max(0, Number(slip || 0));
    const contact = clamp(Number(contactLoadScale) || 0, 0, 1);
    const contactSlip = wheelSlip * contact;
    const heatMultiplier = clamp(Number(pressureDynamics.heatMultiplier || 1), 0.8, 2);
    const surfaceHeatScale = frictionHeatScale !== null && Number.isFinite(Number(frictionHeatScale))
      ? clamp(Number(frictionHeatScale), 0, 1.2)
      : this.getSurfaceHeatScale(surfaceId, terrain);
    const frictionHeat = (
      contactSlip * 210
      + (Number(handbrake || 0) && (wheelId === 'rl' || wheelId === 'rr') ? 70 * contact : 0)
    ) * heatMultiplier * surfaceHeatScale;
    const tireFlexHeat = (
      Math.max(0, Number(loadRatio || 0) - 1) * 36 * contact
      + speedMph * 0.055 * contact
    ) * heatMultiplier;
    const heatTarget = 70 + frictionHeat + tireFlexHeat;
    const coolRate = speedMph > 5 ? 0.55 : 0.24;
    const heatRate = contactSlip > 0.08 ? 3.2 + contactSlip * 2.8 : coolRate;
    return previous + (heatTarget - previous) * Math.min(1, dt * heatRate);
  }

  getLoadSensitivityMultiplier(loadN = 1, referenceLoadN = loadN, looseSurfaceFactor = 0) {
    return getRaceTireLoadSensitivityMultiplierForLoose(loadN, referenceLoadN, looseSurfaceFactor);
  }

  getLoadSensitiveWheelLimit({
    wheelId = 'fl',
    normalLoads = {},
    referenceNormalLoads = null,
    grip = 1,
    gripFactor = 1,
    looseSurfaceFactor = 0,
    normalLoadScale = 1
  } = {}) {
    const load = Math.max(0, Number(normalLoads?.[wheelId] || 0) * Math.max(0, Number(normalLoadScale) || 0));
    const reference = referenceNormalLoads?.[wheelId] ?? load;
    const sensitivity = this.getLoadSensitivityMultiplier(load, reference, looseSurfaceFactor);
    if (load <= 0.001) return 0;
    return Math.max(0, load
      * Math.max(0.04, Number(grip) || 0)
      * Math.max(0.04, Number(gripFactor) || 0)
      * sensitivity);
  }

  getAxleLoadSensitivity(normalLoads = {}, referenceNormalLoads = {}, axle = 'front', looseSurfaceFactor = 0) {
    const ids = axle === 'rear' ? ['rl', 'rr'] : ['fl', 'fr'];
    const totalLoad = ids.reduce((sum, wheelId) => sum + Math.max(0, Number(normalLoads?.[wheelId] || 0)), 0);
    if (totalLoad <= 0) return 1;
    return ids.reduce((sum, wheelId) => {
      const load = Math.max(0, Number(normalLoads?.[wheelId] || 0));
      const share = load / totalLoad;
      return sum + this.getLoadSensitivityMultiplier(
        load,
        referenceNormalLoads?.[wheelId] ?? load,
        looseSurfaceFactor
      ) * share;
    }, 0);
  }

  getWheelRemainingLateralLimit({
    wheelId = 'fl',
    normalLoads = {},
    referenceNormalLoads = null,
    gripByWheel = {},
    gripFactor = 1,
    looseSurfaceFactor = 0,
    normalLoadScale = 1,
    longitudinalUsage = 0,
    axleGripModifier = 1
  } = {}) {
    const wheelLimit = this.getLoadSensitiveWheelLimit({
      wheelId,
      normalLoads,
      referenceNormalLoads,
      grip: gripByWheel?.[wheelId],
      gripFactor,
      looseSurfaceFactor,
      normalLoadScale
    });
    if (wheelLimit <= 0.001) return 0;
    const usage = Math.max(0, Number(longitudinalUsage) || 0);
    const residual = 0.08 + clamp(Number(looseSurfaceFactor) || 0, 0, 1) * 0.04;
    return wheelLimit
      * Math.sqrt(Math.max(residual, 1 - usage * usage))
      * Math.max(0.1, Number(axleGripModifier) || 1);
  }

  getPostPeakEfficiency(combinedUsage = 0, looseSurfaceFactor = 0) {
    const usage = Math.max(0, Number(combinedUsage) || 0);
    const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
    const peakUsage = 0.98 - loose * 0.18;
    const falloffWidth = Math.max(0.18, 0.56 - loose * 0.26);
    const excess = clamp((usage - peakUsage) / falloffWidth, 0, 1);
    const hardOverload = clamp((usage - (1.28 - loose * 0.12)) / Math.max(0.2, 0.62 - loose * 0.24), 0, 1);
    const drop = excess * (0.18 + loose * 0.44) + hardOverload * (0.08 + loose * 0.22);
    return clamp(1 - drop, 0.62 - loose * 0.32, 1);
  }

  getLongitudinalSlipTarget(looseSurfaceFactor = 0) {
    return 0.1 + clamp(Number(looseSurfaceFactor) || 0, 0, 1) * 0.1;
  }

  getDrivenPostPeakTractionEfficiency(excessDriveSlip = 0, looseSurfaceFactor = 0) {
    const excess = clamp(Number(excessDriveSlip) || 0, 0, 1);
    const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
    const residualFloor = 0.82 - loose * 0.14;
    return clamp(1 - excess * (0.18 + loose * 0.14), residualFloor, 1);
  }

  getCombinedLongitudinalEfficiency(
    wheelFrictionUsage = {},
    wheelLongitudinalUsage = {},
    looseSurfaceFactor = 0,
    tireContactScale = 1
  ) {
    const contact = clamp(Number(tireContactScale) || 0, 0, 1);
    if (contact <= 0.001) return 1;
    const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
    const activeWheels = RACE_WHEEL_IDS
      .map((wheelId) => ({
        friction: Math.max(0, Number(wheelFrictionUsage?.[wheelId]) || 0),
        longitudinal: Math.max(0, Number(wheelLongitudinalUsage?.[wheelId]) || 0)
      }))
      .map((wheel) => ({
        ...wheel,
        lateral: Math.sqrt(Math.max(0, wheel.friction * wheel.friction - wheel.longitudinal * wheel.longitudinal))
      }))
      .filter((wheel) => wheel.longitudinal > 0.025 && wheel.lateral > 0.04);
    if (!activeWheels.length) return 1;
    const peakUsage = 0.98 - loose * 0.14;
    const weightedOveruse = activeWheels.reduce((sum, wheel) => {
      const weight = clamp(wheel.longitudinal, 0.05, 1.6);
      const overuse = clamp((wheel.friction - peakUsage) / Math.max(0.18, 0.54 - loose * 0.24), 0, 1.8);
      return sum + overuse * weight;
    }, 0) / activeWheels.reduce((sum, wheel) => sum + clamp(wheel.longitudinal, 0.05, 1.6), 0);
    const hardOveruse = activeWheels.reduce((sum, wheel) => (
      sum + clamp((wheel.friction - (1.28 - loose * 0.1)) / Math.max(0.18, 0.52 - loose * 0.22), 0, 1)
    ), 0) / activeWheels.length;
    const lateralSeverity = activeWheels.reduce((sum, wheel) => (
      sum + clamp((wheel.lateral - 0.06) / Math.max(0.16, 0.48 - loose * 0.1), 0, 1)
    ), 0) / activeWheels.length;
    const severeLooseOveruse = clamp((weightedOveruse - 0.78) / 0.72, 0, 1) * loose;
    const drop = (
      weightedOveruse * (0.18 + loose * 0.42)
      + hardOveruse * (0.1 + loose * 0.22)
      + severeLooseOveruse * (0.08 + loose * 0.16)
    ) * clamp(lateralSeverity * 1.35, 0, 1);
    return clamp(1 - drop, 0.34 - loose * 0.16, 1);
  }

  getSlipRelaxationRates({ speedMps = 0, looseSurfaceFactor = 0, tireContactScale = 1 } = {}) {
    const speed = Math.max(2.5, Math.abs(Number(speedMps) || 0));
    const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
    const contact = clamp(Number(tireContactScale) || 0, 0, 1);
    const looseLengthScale = 1 + loose * 1.35;
    return {
      front: Math.max(4.5 * (1 - loose * 0.2), speed / (5.2 * looseLengthScale)) * contact,
      rear: Math.max(4 * (1 - loose * 0.2), speed / (6.4 * looseLengthScale)) * contact
    };
  }

  getRelaxedSlipAngles({
    targetFrontSlipAngle = 0,
    targetRearSlipAngle = 0,
    previous = {},
    speedMps = 0,
    looseSurfaceFactor = 0,
    tireContactScale = 1,
    seconds = 0,
    reset = false
  } = {}) {
    const rates = this.getSlipRelaxationRates({ speedMps, looseSurfaceFactor, tireContactScale });
    const relaxAngle = (previousAngle, targetAngle, rate) => {
      if (reset || rate <= 0 || seconds <= 0) return Number(targetAngle || 0);
      const alpha = clamp(1 - Math.exp(-Math.max(0, Number(rate) || 0) * Math.max(0, Number(seconds) || 0)), 0, 1);
      return Number(previousAngle || 0)
        + normalizeAngle(Number(targetAngle || 0) - Number(previousAngle || 0)) * alpha;
    };
    return {
      front: relaxAngle(previous.front, targetFrontSlipAngle, rates.front),
      rear: relaxAngle(previous.rear, targetRearSlipAngle, rates.rear),
      targetFront: Number(targetFrontSlipAngle || 0),
      targetRear: Number(targetRearSlipAngle || 0),
      rates
    };
  }

  getRelaxedLongitudinalSlipRatio({
    targetSlipRatio = 0,
    previousSlipRatio = 0,
    speedMps = 0,
    looseSurfaceFactor = 0,
    tireContactScale = 1,
    seconds = 0,
    reset = false
  } = {}) {
    const target = clamp(Number(targetSlipRatio) || 0, 0, 1.8);
    if (reset || seconds <= 0 || tireContactScale <= 0.001) return target;
    const previous = clamp(Number(previousSlipRatio || 0), 0, 1.8);
    const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
    const contact = clamp(Number(tireContactScale) || 0, 0, 1);
    const speed = Math.max(1, Math.abs(Number(speedMps) || 0));
    const riseRate = (10.5 + clamp(speed / 18, 0, 1) * 5.5) * contact;
    const fallRate = (3.6 + clamp(speed / 42, 0, 1) * 3.2) * (1 - loose * 0.46) * contact;
    const alpha = clamp(
      1 - Math.exp(-(target > previous ? riseRate : fallRate) * Math.max(0, Number(seconds) || 0)),
      0,
      1
    );
    return previous + (target - previous) * alpha;
  }
}
