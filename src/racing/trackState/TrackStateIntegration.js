import { clamp, hashTrackStateValue, quantizeTrackStateNumber } from './TrackStateMath.js';
import { TrackState } from './TrackState.js';

function getAuthoredBaseSurface(sample = {}) {
  const region = String(sample.region || 'terrain');
  if (region !== 'terrain') {
    return String(sample.segment?.surface || sample.baseSurfaceId || sample.surfaceId || 'asphalt');
  }
  const material = String(sample.materialId || sample.tile?.tileId || sample.baseSurfaceId || '').toLowerCase();
  if (/snow|ice/.test(material)) return 'snow';
  if (/slush/.test(material)) return 'slush';
  if (/mud/.test(material)) return 'mud';
  if (/wet.*gravel|gravel.*wet/.test(material)) return 'wet-gravel';
  if (/rock|gravel/.test(material)) return 'gravel';
  if (/water|wet/.test(material)) return 'wet-asphalt';
  if (/dirt|sand|grass/.test(material)) return 'dirt';
  if (/metal|asphalt|road|tarmac|pavement|concrete/.test(material)) return 'asphalt';
  return String(sample.baseSurfaceId || sample.surfaceId || 'asphalt');
}

export function createRaceTrackStateSeed(value = 'race') {
  return Number.parseInt(hashTrackStateValue(String(value)), 16) >>> 0;
}

export function createRaceTrackState({
  seed = 1,
  surfaceModel = null,
  elevationScaleM = 1,
  snapshot = null,
  ...options
} = {}) {
  return new TrackState({
    seed,
    snapshot,
    sampleBaseSurface(point) {
      const sample = surfaceModel?.sampleWorld?.(point, 0, {
        fallbackSurfaceId: 'asphalt'
      }) || {};
      const baseSurfaceId = getAuthoredBaseSurface(sample);
      const baseSurface = surfaceModel?.getSurfaceById?.(baseSurfaceId) || {};
      const materialId = sample.region === 'terrain'
        ? sample.materialId || sample.tile?.tileId || baseSurfaceId
        : baseSurfaceId;
      return {
        baseSurfaceId,
        materialId,
        region: sample.region || 'terrain',
        elevationM: Number(sample.elevationM ?? sample.elevation ?? 0) * Number(elevationScaleM || 1),
        normal: sample.normal || { x: 0, y: 1, z: 0 },
        friction: Number(baseSurface.grip || sample.friction || 1)
          * Number(sample.terrainGripScale || 1),
        drainageRateMmPerS: sample.drainageRateMmPerS,
        sunExposure: sample.sunExposure,
        windExposure: sample.windExposure,
        roughness: sample.roughness
      };
    },
    ...options
  });
}

export function createRaceTrackStateWeatherForcing({
  weatherState = {},
  race = {},
  windDirectionRad = 0
} = {}) {
  const type = String(weatherState.id || race.weather || 'clear');
  const intensity = clamp(Number(weatherState.effectiveIntensity ?? weatherState.targetIntensity ?? 0), 0, 1);
  const night = String(race.timeOfDay || 'day') === 'night';
  const precipitationScale = type === 'storm'
    ? 0.9
    : type === 'rain'
      ? 0.55
      : type === 'snow'
        ? 0.6
        : 0;
  return {
    type,
    precipitationRateMmPerS: quantizeTrackStateNumber(intensity * precipitationScale),
    ambientTemperatureC: type === 'snow' ? -4 : type === 'storm' ? 13 : type === 'rain' ? 16 : night ? 14 : 22,
    sunIntensity: night ? 0 : type === 'clear' ? 0.9 : type === 'snow' ? 0.18 : 0.12,
    windIntensity: type === 'storm' ? 0.9 : type === 'rain' ? 0.48 : type === 'snow' ? 0.35 : 0.18,
    windDirectionRad: quantizeTrackStateNumber(windDirectionRad),
    humidity: type === 'storm' ? 0.96 : type === 'rain' ? 0.9 : type === 'snow' ? 0.82 : 0.42
  };
}

export function queueRaceTrackStateTireEvents(trackState, {
  vehicleId = 'player',
  normalLoads = {},
  tireSlipByWheel = {},
  wheelContactScaleByWheel = {},
  wheelSurfaceState = {},
  previousPositions = {},
  speedMps = 0,
  tireCompoundByWheel = {},
  tireTemperatures = {},
  brakeState = {},
  wheelSpinByWheel = {},
  direction = null
} = {}) {
  if (!trackState) return [];
  const current = wheelSurfaceState.positions || {};
  const wheelIds = [...new Set([...Object.keys(current), ...Object.keys(wheelContactScaleByWheel)])].sort();
  const events = [];
  wheelIds.forEach((wheelId) => {
    const position = current[wheelId];
    const contactScale = Number(wheelContactScaleByWheel[wheelId] ?? 0);
    if (!position || contactScale <= 0.001) return;
    const previousPosition = previousPositions[wheelId] || position;
    const dx = Number(position.x || 0) - Number(previousPosition.x || 0);
    const dz = Number(position.z || 0) - Number(previousPosition.z || 0);
    const distanceM = Math.hypot(dx, dz);
    const slipEnergy = Math.max(
      Number(tireSlipByWheel[wheelId] || 0),
      Number(brakeState.lockByWheel?.[wheelId] || 0),
      Number(wheelSpinByWheel[wheelId] || 0)
    );
    if (distanceM < 0.002 && slipEnergy <= 0.001) return;
    const fallbackDirection = Math.hypot(dx, dz) > 0.0001
      ? { x: dx / Math.hypot(dx, dz), z: dz / Math.hypot(dx, dz) }
      : { x: Number(direction?.x || 1), z: Number(direction?.z || 0) };
    events.push(...trackState.queueTireContact({
      vehicleId,
      wheelId,
      position,
      previousPosition,
      grounded: true,
      contactScale,
      normalLoadN: normalLoads[wheelId],
      speedMps,
      distanceM,
      directionX: fallbackDirection.x,
      directionZ: fallbackDirection.z,
      slipEnergy,
      brakeLock: brakeState.lockByWheel?.[wheelId],
      wheelSpin: wheelSpinByWheel[wheelId],
      compoundId: tireCompoundByWheel[wheelId] || 'tarmac',
      tireTemperatureF: tireTemperatures[wheelId]
    }));
  });
  return events;
}

export function queueRaceTrackStateCrashEvents(trackState, session = {}) {
  if (!trackState) return [];
  const log = Array.isArray(session.damageLog) ? session.damageLog : [];
  const cursor = Math.max(0, Math.trunc(Number(session.trackStateDamageLogCursor) || 0));
  const pending = log
    .map((entry, index) => ({
      entry,
      sequence: Math.max(1, Math.trunc(Number(entry.sequence) || index + 1))
    }))
    .filter(({ sequence }) => sequence > cursor)
    .sort((left, right) => left.sequence - right.sequence);
  const events = pending.map(({ entry }) => {
    const amount = Math.max(0, Number(entry.amount) || 0);
    return trackState.queueCrashContamination({
      vehicleId: session.carId || 'player',
      x: Number(entry.worldX ?? session.worldX ?? 0),
      z: Number(entry.worldZ ?? session.worldZ ?? 0),
      debris: clamp(amount / 140, 0.005, 0.45),
      oil: entry.part === 'engine' ? clamp(amount / 180, 0.005, 0.4) : 0,
      dirt: /terrain|scenery|landing/.test(String(entry.source || '')) ? clamp(amount / 300, 0, 0.2) : 0
    });
  }).filter(Boolean);
  if (pending.length) session.trackStateDamageLogCursor = pending.at(-1).sequence;
  return events;
}

export function evaluateRaceAiTrackStateCandidates({
  trackState,
  getWorldPoint,
  distance = 0,
  currentOffset = 0,
  candidateOffsets = [-0.5, 0, 0.5],
  lookaheadDistances = [12, 24, 40],
  stepIndex = trackState?.stepIndex || 0,
  nextSwitchStep = 0,
  hysteresis = 0.03,
  switchCooldownSteps = 10
} = {}) {
  const offsets = [...new Set(candidateOffsets.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!offsets.includes(Number(currentOffset))) offsets.push(Number(currentOffset));
  offsets.sort((a, b) => a - b);
  const candidates = offsets.map((offset) => {
    const observations = lookaheadDistances.map((ahead) => {
      const point = getWorldPoint(Number(distance) + Number(ahead), offset);
      return trackState.sample(point);
    });
    const average = (field) => observations.reduce((sum, observation) => sum + Number(observation[field] || 0), 0)
      / Math.max(1, observations.length);
    const grip = average('effectiveGrip');
    const surfaceRisk = average('risk');
    const changeRisk = Math.abs(offset - Number(currentOffset)) * 0.02;
    const risk = clamp(surfaceRisk + changeRisk, 0, 1);
    return {
      offset: quantizeTrackStateNumber(offset),
      score: quantizeTrackStateNumber(grip - risk * 0.52),
      grip: quantizeTrackStateNumber(grip),
      risk: quantizeTrackStateNumber(risk),
      observations: observations.map((observation) => ({
        cellKey: observation.cellKey,
        effectiveGrip: observation.effectiveGrip,
        risk: observation.risk
      }))
    };
  });
  const current = candidates.find((candidate) => candidate.offset === Number(currentOffset))
    || candidates.reduce((closest, candidate) => (
      Math.abs(candidate.offset - Number(currentOffset)) < Math.abs(closest.offset - Number(currentOffset)) ? candidate : closest
    ), candidates[0]);
  const best = candidates.reduce((winner, candidate) => (
    candidate.score > winner.score + 1e-9 ? candidate : winner
  ), candidates[0]);
  const canSwitch = Number(stepIndex) >= Number(nextSwitchStep || 0);
  const switched = canSwitch && best.offset !== current.offset && best.score > current.score + Number(hysteresis || 0);
  const chosen = switched ? best : current;
  return {
    chosenOffset: chosen.offset,
    switched,
    score: chosen.score,
    gripScale: quantizeTrackStateNumber(clamp(chosen.grip, 0.08, 1.2)),
    risk: chosen.risk,
    candidates,
    nextSwitchStep: switched
      ? Number(stepIndex) + Math.max(1, Math.trunc(Number(switchCooldownSteps) || 10))
      : Math.max(Number(nextSwitchStep || 0), Number(stepIndex))
  };
}
