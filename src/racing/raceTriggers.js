export const RACE_TRIGGER_ACTION_TYPES = Object.freeze([
  'play-sprite',
  'play-animation',
  'create-doodad',
  'change-weather'
]);

const WEATHER_IDS = new Set(['clear', 'rain', 'storm', 'snow']);

export function normalizeRaceTriggerAction(action = {}) {
  const type = RACE_TRIGGER_ACTION_TYPES.includes(action?.type) ? action.type : 'play-sprite';
  const params = action?.params && typeof action.params === 'object' ? action.params : {};
  return {
    type,
    params: {
      artRef: String(params.artRef || ''),
      doodadRef: String(params.doodadRef || ''),
      weather: WEATHER_IDS.has(String(params.weather || '')) ? String(params.weather) : 'clear',
      durationMs: Math.max(100, Math.min(60000, Number(params.durationMs) || 1800)),
      widthM: Math.max(0.1, Number(params.widthM) || 3),
      heightM: Math.max(0.1, Number(params.heightM) || 3),
      offsetX: Number(params.offsetX) || 0,
      offsetZ: Number(params.offsetZ) || 0
    }
  };
}

export function normalizeRaceTrigger(trigger = {}, index = 0) {
  return {
    id: String(trigger.id || `race-trigger-${index}`),
    x: Number(trigger.x) || 0,
    z: Number(trigger.z) || 0,
    radiusM: Math.max(0.5, Math.min(100, Number(trigger.radiusM) || 6)),
    fireOnce: trigger.fireOnce !== false,
    enabled: trigger.enabled !== false,
    action: normalizeRaceTriggerAction(trigger.action)
  };
}

export function normalizeRaceTriggers(triggers = []) {
  return Array.isArray(triggers) ? triggers.map(normalizeRaceTrigger) : [];
}

export function getEnteredRaceTriggers(triggers = [], position = {}, firedIds = new Set(), previousInsideIds = new Set()) {
  const x = Number(position.x) || 0;
  const z = Number(position.z) || 0;
  return normalizeRaceTriggers(triggers).filter((trigger) => {
    if (!trigger.enabled || previousInsideIds.has(trigger.id) || (trigger.fireOnce && firedIds.has(trigger.id))) return false;
    return Math.hypot(x - trigger.x, z - trigger.z) <= trigger.radiusM;
  });
}
