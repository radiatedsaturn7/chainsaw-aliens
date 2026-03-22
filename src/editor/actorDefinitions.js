export const ACTOR_ATTACK_TARGETS = [
  { id: 'none', label: 'None' },
  { id: 'player', label: 'Player' },
  { id: 'friendly', label: 'Friendly actors' },
  { id: 'enemy', label: 'Enemy actors' },
  { id: 'impartial', label: 'Impartial actors' }
];

export const MOVEMENT_PRESETS = [
  { id: 'none', label: 'None', description: 'Hold position.' },
  { id: 'patrol-platform', label: 'Patrol Platform', description: 'Walk and turn when blocked or near an edge.' },
  { id: 'random-walk-pause', label: 'Random Walk Then Pause', description: 'Wander for a bit, pause, then choose again.' },
  { id: 'avoid-player', label: 'Avoid Player', description: 'Back away while the player is close.' },
  { id: 'approach-player', label: 'Approach Player', description: 'Move toward the player inside aggro range.' },
  { id: 'pause-bounce', label: 'Pause And Bounce', description: 'Pause, then spring upward.' },
  { id: 'maintain-distance', label: 'Maintain Distance At X', description: 'Keep the player within a preferred range band.' },
  { id: 'float', label: 'Float', description: 'Hover with sine-wave drift.' },
  { id: 'custom', label: 'Custom / Advanced', description: 'Keep low-level fields in Advanced.' }
];

export const MOVEMENT_PARAM_CONFIG = {
  'patrol-platform': [
    { key: 'speed', label: 'Speed', min: 20, max: 260, step: 10, default: 90 },
    { key: 'turnOnWall', label: 'Turn On Wall', type: 'boolean', default: true },
    { key: 'edgeTurn', label: 'Turn At Edge', type: 'boolean', default: true }
  ],
  'random-walk-pause': [
    { key: 'speed', label: 'Speed', min: 20, max: 240, step: 10, default: 70 },
    { key: 'walkDuration', label: 'Walk Duration', min: 0.2, max: 4, step: 0.1, default: 1.2 },
    { key: 'pauseDuration', label: 'Pause Duration', min: 0.1, max: 4, step: 0.1, default: 0.8 }
  ],
  'avoid-player': [
    { key: 'speed', label: 'Speed', min: 20, max: 260, step: 10, default: 120 },
    { key: 'fleeDistance', label: 'Flee Distance', min: 32, max: 400, step: 8, default: 180 }
  ],
  'approach-player': [
    { key: 'speed', label: 'Speed', min: 20, max: 260, step: 10, default: 120 },
    { key: 'aggroRange', label: 'Aggro Range', min: 32, max: 480, step: 8, default: 220 }
  ],
  'pause-bounce': [
    { key: 'speed', label: 'Speed', min: 0, max: 240, step: 10, default: 70 },
    { key: 'pauseDuration', label: 'Pause Duration', min: 0.1, max: 4, step: 0.1, default: 0.7 },
    { key: 'jumpSpeed', label: 'Jump Speed', min: 80, max: 420, step: 10, default: 240 }
  ],
  'maintain-distance': [
    { key: 'speed', label: 'Speed', min: 20, max: 260, step: 10, default: 110 },
    { key: 'preferredDistance', label: 'Preferred Distance', min: 32, max: 420, step: 8, default: 160 },
    { key: 'tolerance', label: 'Tolerance', min: 8, max: 140, step: 4, default: 30 }
  ],
  float: [
    { key: 'amplitude', label: 'Amplitude', min: 4, max: 80, step: 2, default: 18 },
    { key: 'speed', label: 'Speed', min: 0.2, max: 4, step: 0.1, default: 1.4 },
    { key: 'drift', label: 'Drift', min: 0, max: 120, step: 2, default: 16 }
  ],
  custom: []
};

export const CONDITION_TYPES = [
  { id: 'always', label: 'Always' },
  { id: 'timer-elapsed', label: 'Timer Elapsed' },
  { id: 'actor-health-less-than', label: 'Actor Health < X%' },
  { id: 'player-health-less-than', label: 'Player Health < X%' },
  { id: 'can-see-player', label: 'Can See Player' },
  { id: 'cannot-see-player', label: 'Cannot See Player' },
  { id: 'player-within', label: 'Player Within X Tiles' },
  { id: 'player-farther-than', label: 'Player Farther Than X Tiles' },
  { id: 'touched-wall', label: 'Touched Wall' },
  { id: 'touched-floor', label: 'Touched Floor' },
  { id: 'took-damage', label: 'Took Damage' },
  { id: 'random-chance', label: 'Random Chance' },
  { id: 'cooldown-ready', label: 'Cooldown Ready' },
  { id: 'linked-part-destroyed', label: 'Linked Part Destroyed' },
  { id: 'root-state-is', label: 'Root Actor Entered State' },
  { id: 'child-state-is', label: 'Child Actor Entered State' }
];

export const ACTION_TYPES = [
  { id: 'switch-state', label: 'Switch To State' },
  { id: 'reverse-direction', label: 'Reverse Direction' },
  { id: 'set-velocity', label: 'Set Velocity' },
  { id: 'jump', label: 'Jump' },
  { id: 'stop-moving', label: 'Stop Moving' },
  { id: 'spawn-bullets', label: 'Spawn Bullet(s)' },
  { id: 'spawn-actor', label: 'Spawn Actor' },
  { id: 'delete-actor', label: 'Delete Actor' },
  { id: 'play-sound', label: 'Play Sound' },
  { id: 'play-fx', label: 'Play FX' },
  { id: 'become-invulnerable', label: 'Become Invulnerable' },
  { id: 'become-vulnerable', label: 'Become Vulnerable' },
  { id: 'enable-body-damage', label: 'Enable Body Damage' },
  { id: 'disable-body-damage', label: 'Disable Body Damage' },
  { id: 'drop-loot', label: 'Drop Loot' },
  { id: 'face-player', label: 'Face Player' }
];

export const LOOT_ITEM_OPTIONS = [
  { id: 'loot', label: 'Oil / Scrap' },
  { id: 'health', label: 'Health' },
  { id: 'health-core', label: 'Health Core' },
  { id: 'chainsaw-rig', label: 'Chainsaw Rig' },
  { id: 'flamethrower', label: 'Flamethrower' },
  { id: 'ignitir', label: 'Ignitir' },
  { id: 'magboots', label: 'Mag Boots' },
  { id: 'resonance', label: 'Resonance' },
  { id: 'map-cache', label: 'Map Cache' }
];

export const BEHAVIOR_PRESET_SUMMARY = {
  skitter: 'approach-player',
  slicer: 'approach-player',
  bouncer: 'patrol-platform',
  coward: 'avoid-player',
  ranger: 'maintain-distance',
  spitter: 'random-walk-pause',
  pouncer: 'pause-bounce',
  floater: 'float',
  bobber: 'float',
  drifter: 'float',
  harrier: 'approach-player',
  bulwark: 'approach-player',
  hivenode: 'none',
  practice: 'float',
  finalboss: 'float'
};

export function slugifyActorName(name = '') {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `actor-${Date.now()}`;
}

export function actorStateArtKey(actorId, stateId) {
  return `actor:${actorId}:${stateId}`;
}

export function createDefaultCondition(type = 'always') {
  return { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, params: {} };
}

export function createDefaultAction(type = 'switch-state') {
  return { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, params: {} };
}

export function createDefaultLootEntry() {
  return {
    id: `loot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: 'health',
    probability: 0.35,
    min: 1,
    max: 1,
    guaranteed: false
  };
}

export function createDefaultLinkedPart() {
  return {
    id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actorId: '',
    role: 'part',
    attachPoint: 'center',
    offsetX: 0,
    offsetY: 0,
    syncFacing: true,
    syncState: false
  };
}

export function createDefaultState(actorId, name = 'Idle') {
  const stateId = slugifyActorName(name);
  return {
    id: stateId,
    name,
    artKey: actorStateArtKey(actorId, stateId),
    movement: { type: name.toLowerCase() === 'idle' ? 'none' : 'approach-player', params: {} },
    overrideInvulnerable: null,
    overrideBodyDamage: null,
    overrideContactDamageAmount: null,
    conditionMode: 'all',
    conditions: [createDefaultCondition('always')],
    actions: []
  };
}

export function createActorDefinition(name = 'New Actor') {
  const id = slugifyActorName(name);
  return {
    id,
    name,
    attackTarget: 'none',
    gravity: true,
    bodyContactDamage: false,
    contactDamageAmount: 1,
    invulnerableByDefault: false,
    destructible: true,
    rootPlaceable: true,
    maxHealth: 3,
    tags: [],
    advanced: {},
    loot: [],
    linkedParts: [],
    states: [createDefaultState(id, 'Idle')]
  };
}

export function ensureActorLibrary(world) {
  if (!Array.isArray(world.actorLibrary)) world.actorLibrary = [];
  return world.actorLibrary;
}

export function ensureActorDefinitionShape(raw) {
  const base = createActorDefinition(raw?.name || 'New Actor');
  const next = {
    ...base,
    ...raw,
    id: raw?.id || slugifyActorName(raw?.name || base.name),
    states: Array.isArray(raw?.states) && raw.states.length ? raw.states.map((state, index) => ({
      ...createDefaultState(raw?.id || base.id, state?.name || `State ${index + 1}`),
      ...state,
      id: state?.id || slugifyActorName(state?.name || `state-${index + 1}`),
      movement: {
        type: state?.movement?.type || 'none',
        params: { ...(state?.movement?.params || {}) }
      },
      conditions: Array.isArray(state?.conditions) && state.conditions.length
        ? state.conditions.map((condition) => ({ ...createDefaultCondition(condition?.type || 'always'), ...condition, params: { ...(condition?.params || {}) } }))
        : [createDefaultCondition('always')],
      actions: Array.isArray(state?.actions)
        ? state.actions.map((action) => ({ ...createDefaultAction(action?.type || 'switch-state'), ...action, params: { ...(action?.params || {}) } }))
        : []
    })) : [createDefaultState(raw?.id || base.id, 'Idle')],
    loot: Array.isArray(raw?.loot) ? raw.loot.map((entry) => ({ ...createDefaultLootEntry(), ...entry })) : [],
    linkedParts: Array.isArray(raw?.linkedParts) ? raw.linkedParts.map((entry) => ({ ...createDefaultLinkedPart(), ...entry })) : []
  };
  next.states = next.states.map((state) => ({ ...state, artKey: state.artKey || actorStateArtKey(next.id, state.id) }));
  return next;
}
