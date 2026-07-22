export const RACE_DOODAD_SCHEMA_VERSION = 1;

export const RACE_DOODAD_BEHAVIORS = ['collide', 'flatten', 'fly-off'];

export const DEFAULT_RACE_DOODAD = {
  id: 'new-doodad',
  name: 'New Doodad',
  artRef: '',
  widthM: 1.5,
  heightM: 2,
  groundOffsetM: 0,
  hitboxWidthM: 1.5,
  hitboxHeightM: 2,
  weightKg: 35,
  defaultRule: {
    behavior: 'collide',
    speedDrainPercent: 45,
    damage: { panels: 14, suspension: 6, engine: 3.5 }
  },
  rules: [
    {
      minSpeedMph: 30,
      behavior: 'flatten',
      speedDrainPercent: 18,
      damage: { panels: 2.5, suspension: 0, engine: 0 }
    },
    {
      minSpeedMph: 120,
      behavior: 'fly-off',
      speedDrainPercent: 16,
      damage: { panels: 4.5, suspension: 0, engine: 0 }
    }
  ]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function normalizeDoodadBehavior(value = 'collide') {
  const behavior = String(value || '').trim();
  if (behavior === 'indestructible') return 'collide';
  if (RACE_DOODAD_BEHAVIORS.includes(behavior)) return behavior;
  return 'collide';
}

export function normalizeDoodadDamage(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    panels: clamp(Number(source.panels) || 0, 0, 100),
    suspension: clamp(Number(source.suspension) || 0, 0, 100),
    engine: clamp(Number(source.engine) || 0, 0, 100)
  };
}

export function normalizeDoodadRule(value = {}, fallback = DEFAULT_RACE_DOODAD.defaultRule) {
  const source = value && typeof value === 'object' ? value : {};
  const fallbackRule = fallback && typeof fallback === 'object' ? fallback : DEFAULT_RACE_DOODAD.defaultRule;
  return {
    minSpeedMph: Math.max(0, Math.round(Number(source.minSpeedMph ?? fallbackRule.minSpeedMph ?? 0) || 0)),
    behavior: normalizeDoodadBehavior(source.behavior || fallbackRule.behavior),
    speedDrainPercent: clamp(Number(source.speedDrainPercent ?? fallbackRule.speedDrainPercent) || 0, 0, 100),
    damage: normalizeDoodadDamage(source.damage || fallbackRule.damage)
  };
}

export function normalizeRaceDoodadDocument(data = {}, fallbackName = '') {
  const source = data?.kind === 'race-doodad'
    ? data.doodad
    : data?.doodad && typeof data.doodad === 'object'
      ? data.doodad
      : data;
  const doodad = source && typeof source === 'object' ? source : {};
  const fallback = DEFAULT_RACE_DOODAD;
  const cleanName = String(fallbackName || doodad.name || doodad.id || fallback.name || '').trim();
  const idSource = String(doodad.id || cleanName || fallback.id || '').trim();
  const id = idSource
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback.id;
  const defaultRule = normalizeDoodadRule(doodad.defaultRule || {
    behavior: doodad.behavior,
    speedDrainPercent: doodad.speedDrainPercent,
    damage: doodad.damage
  }, fallback.defaultRule);
  const rules = (Array.isArray(doodad.rules) ? doodad.rules : fallback.rules)
    .map((rule) => normalizeDoodadRule(rule, defaultRule))
    .sort((a, b) => a.minSpeedMph - b.minSpeedMph);
  return {
    id,
    name: String(doodad.name || cleanName || fallback.name),
    artRef: String(doodad.artRef || '').trim(),
    widthM: clamp(Number(doodad.widthM) || fallback.widthM, 0.1, 80),
    heightM: clamp(Number(doodad.heightM) || fallback.heightM, 0.1, 120),
    groundOffsetM: clamp(Number(doodad.groundOffsetM) || 0, -20, 20),
    hitboxWidthM: clamp(Number(doodad.hitboxWidthM ?? doodad.widthM) || fallback.hitboxWidthM || fallback.widthM, 0.1, 80),
    hitboxHeightM: clamp(Number(doodad.hitboxHeightM ?? doodad.heightM) || fallback.hitboxHeightM || fallback.heightM, 0.1, 120),
    weightKg: clamp(Number(doodad.weightKg) || fallback.weightKg, 0.1, 100000),
    defaultRule,
    rules
  };
}

export function serializeRaceDoodadDocument(doodad = DEFAULT_RACE_DOODAD) {
  const normalized = normalizeRaceDoodadDocument(doodad);
  return {
    schemaVersion: RACE_DOODAD_SCHEMA_VERSION,
    kind: 'race-doodad',
    savedAt: Date.now(),
    selectedDoodadId: normalized.id,
    doodad: normalized
  };
}

export function getDoodadRuleForSpeed(doodad = DEFAULT_RACE_DOODAD, speedMph = 0) {
  const normalized = normalizeRaceDoodadDocument(doodad);
  const speed = Math.max(0, Number(speedMph) || 0);
  return normalized.rules.reduce((match, rule) => (
    speed >= Number(rule.minSpeedMph || 0) ? rule : match
  ), normalized.defaultRule);
}

export function createRaceDoodadFromLegacyScenery(definition = {}, fallback = {}) {
  const source = definition && typeof definition === 'object' ? definition : {};
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {};
  const behavior = normalizeDoodadBehavior(source.behavior || fallbackSource.behavior);
  const artRef = String(source.artRef || fallbackSource.artRef || '').trim();
  const name = String(source.label || source.name || artRef || fallbackSource.label || fallbackSource.name || 'Doodad');
  const baseRule = behavior === 'flatten'
    ? { behavior: 'flatten', speedDrainPercent: 18, damage: { panels: 2.5, suspension: 0, engine: 0 } }
    : behavior === 'fly-off'
      ? { behavior: 'fly-off', speedDrainPercent: 16, damage: { panels: 4.5, suspension: 0, engine: 0 } }
      : { behavior: 'collide', speedDrainPercent: 45, damage: { panels: 14, suspension: 6, engine: 3.5 } };
  return normalizeRaceDoodadDocument({
    id: source.id || fallbackSource.id || name,
    name,
    artRef,
    widthM: Number(source.widthM ?? fallbackSource.widthM) || DEFAULT_RACE_DOODAD.widthM,
    heightM: Number(source.heightM ?? fallbackSource.heightM) || DEFAULT_RACE_DOODAD.heightM,
    groundOffsetM: Number(source.groundOffsetM ?? fallbackSource.groundOffsetM) || 0,
    hitboxWidthM: Number(source.hitboxWidthM ?? fallbackSource.hitboxWidthM ?? source.widthM ?? fallbackSource.widthM) || DEFAULT_RACE_DOODAD.hitboxWidthM,
    hitboxHeightM: Number(source.hitboxHeightM ?? fallbackSource.hitboxHeightM ?? source.heightM ?? fallbackSource.heightM) || DEFAULT_RACE_DOODAD.hitboxHeightM,
    weightKg: Number(source.weightKg ?? fallbackSource.weightKg) || DEFAULT_RACE_DOODAD.weightKg,
    defaultRule: baseRule,
    rules: DEFAULT_RACE_DOODAD.rules
  }, name);
}
