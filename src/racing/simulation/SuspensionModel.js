import {
  getRaceNormalizedRideHeightM,
  getRaceNormalizedSuspensionTravelM,
  getRaceVehicleSuspensionRates
} from '../RaceVehiclePhysics.js';
import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';

export class SuspensionModel {
  getNormalizedRideHeightM(value = 0.5) {
    return getRaceNormalizedRideHeightM(value);
  }

  getNormalizedTravelM(value = 0.5) {
    return getRaceNormalizedSuspensionTravelM(value);
  }

  getRates(tuning = {}, massKg = 1400, wheelId = 'fl', compressionRatio = 0) {
    return getRaceVehicleSuspensionRates(tuning, massKg, wheelId, compressionRatio);
  }

  getSegmentBumpiness(segment = null, snowConditionBumpiness = 0) {
    if (!segment) return 0;
    const surface = String(segment.surface || '').toLowerCase();
    const surfaceBumpiness = {
      dirt: 0.16,
      gravel: 0.22,
      mud: 0.34,
      'wet-gravel': 0.28,
      snow: 0.18,
      slush: 0.26
    }[surface] || 0;
    const snowBumpiness = surface === 'snow' || surface === 'slush'
      ? Number(snowConditionBumpiness || 0)
      : 0;
    return clamp(Number(segment.bumpiness || 0) + surfaceBumpiness * 0.55 + snowBumpiness * 0.65, 0, 1);
  }

  getBumpNormalLoadScales({
    segment = null,
    bumpiness = 0,
    distance = 0,
    speedMps = 0
  } = {}) {
    const surface = String(segment?.surface || '').toLowerCase();
    const looseSurface = ['dirt', 'gravel', 'mud', 'wet-gravel', 'snow', 'slush'].includes(surface);
    const speed = Math.abs(Number(speedMps) || 0);
    const speedFactor = looseSurface && speed > 3
      ? Math.max(0.18, clamp((speed - 2) / 30, 0, 1))
      : clamp((speed - 5) / 34, 0, 1);
    const intensity = clamp(Number(bumpiness) || 0, 0, 1) * speedFactor;
    if (intensity <= 0.0001) {
      return { fl: 1, fr: 1, rl: 1, rr: 1, bumpiness, intensity: 0 };
    }
    const basePhase = Number(distance || 0) * (0.72 + bumpiness * 1.35);
    const offsets = { fl: 0.15, fr: 1.95, rl: 3.35, rr: 5.1 };
    const scales = {};
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const offset = offsets[wheelId] || 0;
      const primary = Math.sin(basePhase + offset);
      const secondary = Math.sin(basePhase * 2.37 + offset * 1.61);
      scales[wheelId] = clamp(
        1 + intensity * (primary * 0.42 + secondary * 0.24 - 0.08),
        0.38,
        1.62
      );
    });
    const averageScale = RACE_WHEEL_IDS.reduce((sum, wheelId) => sum + Number(scales[wheelId] || 1), 0)
      / RACE_WHEEL_IDS.length;
    if (averageScale > 1) {
      RACE_WHEEL_IDS.forEach((wheelId) => {
        scales[wheelId] = clamp(Number(scales[wheelId] || 1) / averageScale, 0.38, 1.62);
      });
    }
    return { ...scales, bumpiness, intensity };
  }

  applyBumpNormalLoadScales(normalLoads = {}, bumpScales = null) {
    if (!normalLoads || !bumpScales) return normalLoads;
    RACE_WHEEL_IDS.forEach((wheelId) => {
      normalLoads[wheelId] = Math.max(
        0,
        Number(normalLoads[wheelId] || 0) * Number(bumpScales[wheelId] || 1)
      );
    });
    return normalLoads;
  }
}
