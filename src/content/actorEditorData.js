export const ACTOR_ATTACK_TARGETS = [
  { id: 'none', label: 'None' },
  { id: 'player', label: 'Player' },
  { id: 'friendly', label: 'Friendly actors' },
  { id: 'enemy', label: 'Enemy actors' },
  { id: 'impartial', label: 'Impartial actors' }
];

export const MOVEMENT_BEHAVIORS = [
  { id: 'none', label: 'None', description: 'Hold position.' },
  { id: 'patrol-platform', label: 'Patrol platform', description: 'Walk left/right and turn on walls or edges.', params: ['speed', 'turnOnWall', 'edgeHandling'] },
  { id: 'random-walk-pause', label: 'Random walk then pause', description: 'Alternate short walks and idle pauses.', params: ['speed', 'walkDuration', 'pauseDuration'] },
  { id: 'avoid-player', label: 'Avoid player', description: 'Back away when the player gets too close.', params: ['speed', 'fleeDistance'] },
  { id: 'approach-player', label: 'Approach player', description: 'Move toward the player inside aggro range.', params: ['speed', 'aggroRange'] },
  { id: 'pause-bounce', label: 'Pause and bounce', description: 'Pause, then spring forward / upward.', params: ['speed', 'pauseDuration', 'jumpSpeed'] },
  { id: 'maintain-distance', label: 'Maintain distance', description: 'Try to keep a preferred range.', params: ['speed', 'preferredDistance', 'tolerance'] },
  { id: 'float', label: 'Float', description: 'Oscillate in the air.', params: ['amplitude', 'floatSpeed', 'drift'] },
  { id: 'custom', label: 'Custom / advanced', description: 'Expose low-level data in advanced mode.', params: [] }
];

export const MOVEMENT_PRESET_TEMPLATES = {
  'patrol-platform': { speed: 110, turnOnWall: true, edgeHandling: 'turn' },
  'random-walk-pause': { speed: 80, walkDuration: 1.2, pauseDuration: 0.9 },
  'avoid-player': { speed: 160, fleeDistance: 240 },
  'approach-player': { speed: 120, aggroRange: 220 },
  'pause-bounce': { speed: 90, pauseDuration: 0.35, jumpSpeed: 260 },
  'maintain-distance': { speed: 120, preferredDistance: 180, tolerance: 40 },
  'float': { amplitude: 20, floatSpeed: 2, drift: 18 },
  custom: {}
};

export const CONDITION_TYPES = [
  'always', 'timer-elapsed', 'actor-health-below', 'player-health-below', 'can-see-player', 'cannot-see-player',
  'player-within', 'player-farther-than', 'player-has-item', 'player-presses-action', 'touched-wall', 'touched-floor',
  'touched-ceiling', 'took-damage', 'random-chance', 'cooldown-ready', 'linked-part-destroyed', 'root-entered-state', 'child-entered-state'
];

export const ACTION_TYPES = [
  'switch-state', 'reverse-direction', 'set-velocity', 'jump', 'stop-moving', 'emit-damage', 'spawn-bullets', 'spawn-actor',
  'delete-actor', 'play-sound', 'play-fx', 'become-invulnerable', 'become-vulnerable', 'enable-body-damage', 'disable-body-damage',
  'drop-loot', 'face-player', 'signal-root', 'signal-children', 'destroy-linked-part', 'open-weak-point', 'close-weak-point'
];

export const LOOT_ITEM_OPTIONS = [
  { id: 'loot', label: 'Loot shard' },
  { id: 'health', label: 'Health drop' },
  { id: 'anchor', label: 'Chainsaw rig' },
  { id: 'flame', label: 'Flame-Saw' },
  { id: 'magboots', label: 'Mag Boots' },
  { id: 'resonance', label: 'Resonance Core' },
  { id: 'ignitir', label: 'Ignitir' },
  { id: 'flamethrower', label: 'Flamethrower' },
  { id: 'vitality-core', label: 'Health Core' },
  { id: 'map', label: 'Map Cache' }
];

const slugify = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'actor';

export function createDefaultState(name = 'Idle') {
  return {
    id: slugify(name),
    name,
    animation: { imageDataUrl: '', updatedAt: 0 },
    movement: { type: 'none', params: {} },
    overrides: { bodyDamageEnabled: null, contactDamage: null, invulnerable: null },
    conditions: [{ id: 'always', type: 'always', params: {} }],
    conditionMode: 'all',
    actions: []
  };
}

export function createDefaultActor(name = 'New Actor') {
  const idle = createDefaultState('Idle');
  const slug = slugify(name);
  return {
    schemaVersion: 2,
    id: slug,
    name,
    attackTarget: 'none',
    gravity: true,
    bodyDamageEnabled: false,
    contactDamage: 1,
    invulnerable: false,
    destructible: true,
    isRoot: true,
    tags: [],
    health: 3,
    size: { width: 24, height: 24 },
    loot: [],
    linkedParts: [],
    states: [idle],
    initialStateId: idle.id,
    advanced: { assetRefs: {}, notes: '' }
  };
}

export function ensureActorDefinition(actor) {
  const base = createDefaultActor(actor?.name || 'New Actor');
  const merged = {
    ...base,
    ...(actor || {}),
    size: { ...base.size, ...(actor?.size || {}) },
    advanced: { ...base.advanced, ...(actor?.advanced || {}) }
  };
  merged.id = slugify(merged.name || merged.id);
  merged.states = Array.isArray(actor?.states) && actor.states.length
    ? actor.states.map((state, index) => ({
      ...createDefaultState(state?.name || `State ${index + 1}`),
      ...(state || {}),
      animation: { imageDataUrl: state?.animation?.imageDataUrl || '', updatedAt: Number(state?.animation?.updatedAt || 0) },
      movement: {
        type: state?.movement?.type || 'none',
        params: { ...(MOVEMENT_PRESET_TEMPLATES[state?.movement?.type || 'none'] || {}), ...(state?.movement?.params || {}) }
      },
      overrides: { bodyDamageEnabled: null, contactDamage: null, invulnerable: null, ...(state?.overrides || {}) },
      conditions: Array.isArray(state?.conditions) && state.conditions.length ? state.conditions : [{ id: 'always', type: 'always', params: {} }],
      actions: Array.isArray(state?.actions) ? state.actions : []
    }))
    : [createDefaultState('Idle')];
  if (!merged.states.some((state) => state.id === merged.initialStateId)) {
    merged.initialStateId = merged.states[0].id;
  }
  return merged;
}

export function getBehaviorPresetCatalog() {
  return [
    { id: 'approach-player', label: 'Approach player', derivedFrom: ['Skitter'], notes: 'Simple chase used by Skitter.' },
    { id: 'maintain-distance', label: 'Maintain distance', derivedFrom: ['Spitter', 'Ranger'], notes: 'Back away when close, approach when far, fire at range.' },
    { id: 'avoid-player', label: 'Avoid player', derivedFrom: ['Coward'], notes: 'Flee when the player approaches.' },
    { id: 'float', label: 'Float', derivedFrom: ['Floater', 'Drifter', 'Bobber'], notes: 'Sinusoidal hover / bob motion.' },
    { id: 'pause-bounce', label: 'Pause and bounce', derivedFrom: ['Pouncer', 'Bouncer'], notes: 'Wind up, then lunge or bounce.' },
    { id: 'patrol-platform', label: 'Patrol platform', derivedFrom: ['Bulwark'], notes: 'Ground patrol with optional wall turning.' },
    { id: 'custom', label: 'Custom advanced', derivedFrom: ['Hive Node', 'Sentinel Elite', bosses], notes: 'Spawner / barrage bosses still need advanced state logic.' }
  ];
}
