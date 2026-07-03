export const DEFAULT_TILE_TYPES = [
  { id: 'spawn', label: 'Spawn Point', char: null, special: 'spawn' },
  { id: 'solid', label: 'Solid Block', char: '#', solid: true },
  { id: 'empty', label: 'Empty Block', char: '.' },
  { id: 'door', label: 'Door', char: 'D', door: true },
  { id: 'oneway', label: 'Platform Run', char: '=', oneWay: true },
  { id: 'ice', label: 'Ice Block', char: 'I', solid: true, slipperiness: 1 },
  { id: 'snow', label: 'Snow Block', char: 'N', solid: true, slipperiness: 0.25 },
  { id: 'wood', label: 'Wood Barricade', char: 'W', solid: true, destructible: true },
  { id: 'elevator-platform', label: 'Elevator', char: null, special: 'elevator-platform', elevatorRole: 'platform' },
  { id: 'elevator-path', label: 'Elevator Path', char: null, special: 'elevator-path', elevatorRole: 'path' },
  { id: 'conveyor-left', label: 'Conveyor Left', char: '<', solid: true, conveyor: { direction: -1, speed: 80 } },
  { id: 'conveyor-right', label: 'Conveyor Right', char: '>', solid: true, conveyor: { direction: 1, speed: 80 } },
  { id: 'spikes', label: 'Spike', char: '*', hazardDamage: 1 },
  { id: 'electric', label: 'Electric Current', char: 'e', hazardDamage: 1 },
  { id: 'acid', label: 'Acid', char: 'A', hazardDamage: 1 },
  { id: 'water', label: 'Water', char: '~', liquid: 'water' },
  { id: 'lava', label: 'Lava', char: 'L', hazardDamage: 1, liquid: 'lava' },
  { id: 'hidden-path', label: 'Hidden Path Block', char: 'Z' },
  { id: 'ice-solid', label: 'Icy Solid Block', char: 'F', solid: true, slipperiness: 1 },
  { id: 'rock-solid', label: 'Rock Solid Block', char: 'R', solid: true },
  { id: 'sand-solid', label: 'Sand Block', char: 'E', solid: true, slipperiness: 0.15 },
  { id: 'purple-solid', label: 'Purple Solid Block', char: 'Q', solid: true },
  { id: 'crystal-blue', label: 'Blue Crystal Block', char: 'J', solid: true },
  { id: 'crystal-green', label: 'Green Crystal Block', char: 'G', solid: true },
  { id: 'crystal-purple', label: 'Purple Crystal Block', char: 'V', solid: true },
  { id: 'triangle', label: 'Triangle Block', char: '^', solid: true },
  { id: 'triangle-flip', label: 'Triangle Block (Flipped)', char: 'v', solid: true },
  { id: 'sand-platform', label: 'Sand Platform', char: 's', oneWay: true, slipperiness: 0.15 },
  { id: 'crystal-spikes', label: 'Crystal Spikes', char: '!', hazardDamage: 1 },
  { id: 'anchor', label: 'Anchor Socket', char: 'a' },
  { id: 'brittle', label: 'Brittle Wall', char: 'C', solid: true, destructible: true },
  { id: 'metal', label: 'Welded Metal Plate', char: 'X', solid: true },
  { id: 'debris', label: 'Heavy Debris', char: 'U', solid: true },
  { id: 'lead', label: 'Lead Block', char: 'P', solid: true },
  { id: 'box', label: 'Pull Box', char: 'K' },
  { id: 'switch', label: 'Counterweight Switch', char: 'T' },
  { id: 'bossGate', label: 'Rift Seal', char: 'B', solid: true },
  { id: 'checkpoint', label: 'Checkpoint', char: 'S' },
  { id: 'shop', label: 'Shop', char: '$' },
  { id: 'objective', label: 'Objective', char: 'O' }
];

export const TILE_LIBRARY = [
  ...DEFAULT_TILE_TYPES.filter((tile) => tile.char),
  { id: 'abilityG', label: 'Tools: Chainsaw Throw', char: 'g' },
  { id: 'abilityP', label: 'Tools: Flame-Saw', char: 'p' },
  { id: 'abilityM', label: 'Ability: Mag Boots', char: 'm' },
  { id: 'abilityR', label: 'Ability: Resonance', char: 'r' },
  { id: 'abilityI', label: 'Weapon: Ignitir', char: 'i' },
  { id: 'abilityF', label: 'Weapon: Flamethrower', char: 'f' },
  { id: 'health', label: 'Vitality Core', char: 'H' }
];

const cloneValue = (value) => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
};

export function normalizeTileProperties(properties = {}) {
  const next = { ...properties };
  next.solid = Boolean(next.solid);
  next.oneWay = Boolean(next.oneWay);
  next.destructible = Boolean(next.destructible);
  next.slipperiness = Math.max(0, Math.min(1, Number(next.slipperiness) || 0));
  next.hazardDamage = Math.max(0, Number(next.hazardDamage) || 0);
  if (next.conveyor && typeof next.conveyor === 'object') {
    const direction = Math.sign(Number(next.conveyor.direction) || 0);
    const speed = Math.max(0, Number(next.conveyor.speed) || 0);
    next.conveyor = direction && speed ? { direction, speed } : null;
  } else {
    next.conveyor = null;
  }
  if (!['platform', 'path'].includes(next.elevatorRole)) next.elevatorRole = null;
  if (!['water', 'lava', 'acid'].includes(next.liquid)) next.liquid = null;
  return next;
}

export function normalizeTileDefinition(tile = {}) {
  return normalizeTileProperties({
    ...cloneValue(tile),
    id: tile.id || '',
    label: tile.label || tile.id || 'Tile',
    char: tile.char ?? null,
    special: tile.special || null,
    door: Boolean(tile.door)
  });
}

export function buildTileDefinitions(overrides = {}) {
  const byId = new Map();
  const byChar = new Map();
  DEFAULT_TILE_TYPES.forEach((tile) => {
    const base = normalizeTileDefinition(tile);
    const override = overrides?.[base.id] || (base.char ? overrides?.[base.char] : null) || {};
    const merged = normalizeTileDefinition({ ...base, ...cloneValue(override), id: base.id, char: base.char, label: override.label || base.label });
    byId.set(merged.id, merged);
    if (merged.char) byChar.set(merged.char, merged);
  });
  return { byId, byChar, all: Array.from(byId.values()) };
}

export function serializeTileProperties(properties = {}) {
  const normalized = normalizeTileProperties(properties);
  return {
    solid: normalized.solid,
    oneWay: normalized.oneWay,
    destructible: normalized.destructible,
    slipperiness: normalized.slipperiness,
    hazardDamage: normalized.hazardDamage,
    conveyor: normalized.conveyor,
    elevatorRole: normalized.elevatorRole,
    liquid: normalized.liquid
  };
}
