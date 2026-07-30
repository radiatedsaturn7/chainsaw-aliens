import { RaceSurfaceModel as RaceSurfaceSampler } from '../RaceSurfaceModel.js';
import {
  getRaceWheelContactState,
  getRaceWheelSurfaceState
} from '../RaceVehicleSurfaceContact.js';
import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';
import { getSurfaceById } from '../raceData.js';
import {
  createRaceTrackState,
  createRaceTrackStateWeatherForcing,
  evaluateRaceAiTrackStateCandidates,
  queueRaceTrackStateCrashEvents,
  queueRaceTrackStateTireEvents
} from '../trackState/TrackStateIntegration.js';

export class SurfaceModel {
  createSampler(options = {}) {
    return new RaceSurfaceSampler(options);
  }

  getWheelContactState(options = {}) {
    return getRaceWheelContactState(options);
  }

  getWheelSurfaceState(options = {}) {
    return getRaceWheelSurfaceState(options);
  }

  createTrackState(options = {}) {
    return createRaceTrackState(options);
  }

  createTrackStateWeatherForcing(options = {}) {
    return createRaceTrackStateWeatherForcing(options);
  }

  queueTrackStateTireEvents(trackState, options = {}) {
    return queueRaceTrackStateTireEvents(trackState, options);
  }

  queueTrackStateCrashEvents(trackState, session = {}) {
    return queueRaceTrackStateCrashEvents(trackState, session);
  }

  evaluateTrackStateAiCandidates(options = {}) {
    return evaluateRaceAiTrackStateCandidates(options);
  }

  getLooseSurfaceFactor(wheelSurfaceState = {}) {
    const looseBySurface = {
      dirt: 0.62,
      gravel: 0.72,
      mud: 0.92,
      'wet-gravel': 0.88,
      snow: 1,
      slush: 0.96
    };
    const surfaces = wheelSurfaceState.surfaceByWheel || {};
    const terrains = wheelSurfaceState.terrainByWheel || {};
    const values = RACE_WHEEL_IDS.map((wheelId) => {
      const surface = String(surfaces[wheelId] || '').toLowerCase();
      const terrain = String(terrains[wheelId] || 'road').toLowerCase();
      const terrainLoose = terrain !== 'road' && terrain !== 'margin' ? 0.45 : 0;
      return Math.max(Number(looseBySurface[surface] || 0), terrainLoose);
    });
    return clamp(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length), 0, 1);
  }

  getSnowResistanceMultiplier(snowDepthInches = 0) {
    const depth = clamp(Number(snowDepthInches) || 0, 0, 6);
    if (depth <= 1) return depth * 0.08;
    if (depth <= 3) return 0.08 + (depth - 1) * 0.36;
    return 0.8 + (depth - 3) * 1.07;
  }

  getEffectiveSurfaceId(baseSurfaceId = 'asphalt', weatherState = {}) {
    const base = getSurfaceById(baseSurfaceId).id;
    const amount = clamp(Number(weatherState?.effectiveIntensity) || 0, 0, 1);
    if (!weatherState || weatherState.id === 'clear' || amount < 0.08) return base;
    if (weatherState.id === 'snow') {
      if (amount < 0.34) {
        if (base === 'asphalt') return 'wet-asphalt';
        if (base === 'dirt') return 'mud';
        if (base === 'gravel') return 'wet-gravel';
        if (base === 'snow') return 'slush';
        return base;
      }
      if (amount < 0.64 && base === 'snow') return 'slush';
      return 'snow';
    }
    if (weatherState.id === 'rain' || weatherState.id === 'storm') {
      if (base === 'asphalt') return 'wet-asphalt';
      if (base === 'dirt') return 'mud';
      if (base === 'gravel') return 'wet-gravel';
      if (base === 'snow') return 'slush';
    }
    return base;
  }

  getWeatherGripMultiplier(weatherState = {}) {
    const amount = clamp(Number(weatherState.effectiveIntensity) || 0, 0, 1);
    const maxPenalty = weatherState.id === 'storm'
      ? 0.14
      : weatherState.id === 'snow'
        ? 0.18
        : weatherState.id === 'rain'
          ? 0.08
          : 0;
    return clamp(1 - amount * maxPenalty, 0.78, 1);
  }

  getSegmentSurfaceDetailGrip(segment = null, snowConditionGrip = 1) {
    if (!segment) return 1;
    const bumpPenalty = clamp(Number(segment.bumpiness) || 0, 0, 1) * 0.12;
    const snowMultiplier = segment.surface === 'snow'
      ? Number(snowConditionGrip ?? 1)
      : 1;
    return clamp(snowMultiplier - bumpPenalty, 0.32, 1.05);
  }
}
