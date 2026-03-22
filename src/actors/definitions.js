export const ACTOR_TYPES = ['npc', 'enemy', 'boss', 'spawner', 'turret', 'ambient'];
export const ACTOR_ALIGNMENTS = ['friendly', 'enemy', 'impartial'];
export const ACTOR_STATE_MOVEMENT_MODES = ['idle', 'walk', 'fly', 'hover', 'stationary', 'patrol', 'turret'];
export const ACTOR_BEHAVIOR_MODES = ['idle', 'wander', 'patrol', 'chase', 'flee', 'talk', 'shopkeeper', 'stationaryTurret', 'spawner', 'bossController', 'meleeAttacker', 'rangedAttacker'];
export const ACTOR_ATTACK_TYPES = ['melee', 'projectile', 'burstProjectile', 'beam', 'areaBlast', 'contactAura', 'spawnActor', 'dropHazard'];
export const TRANSITION_CONDITIONS = ['timerElapsed', 'playerInRange', 'healthBelow', 'attackFinished', 'projectileBurstComplete', 'childPartDestroyed', 'randomChance', 'customFlag'];
export const ACTOR_ART_TILE_SLOTS = Array.from({ length: 16 }, (_, index) => ({
  id: `actor-art-${String(index + 1).padStart(2, '0')}`,
  label: `Actor Art ${index + 1}`,
  char: String(index + 1).padStart(2, '0')
}));
export const ACTOR_EDITOR_PRESETS = ['friendlyNpc', 'basicEnemy', 'turret', 'spawner', 'boss', 'blankAdvanced'];

const clone = (value) => JSON.parse(JSON.stringify(value));
const obj = (value, fallback = {}) => (value && typeof value === 'object' && !Array.isArray(value) ? value : fallback);
const arr = (value, fallback = []) => (Array.isArray(value) ? value : fallback);
const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const str = (value, fallback = '') => String(value ?? fallback);
export const slugifyActorId = (value, fallback = 'actor-new') => {
  const slug = str(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
};

const createClip = (id, name, { startFrame = 0, endFrame = 0, fps = 8, loop = true } = {}) => ({ id, name, startFrame, endFrame, fps, loop });
const createState = (id, name, clipId, overrides = {}) => ({
  id,
  name,
  clipId,
  movementMode: 'idle',
  behaviorMode: 'idle',
  canAttack: false,
  canMove: true,
  canSpawn: false,
  canInteract: true,
  invulnerable: false,
  transitions: [],
  ...overrides
});

export const createDefaultActorDefinition = (overrides = {}) => ({
  schemaVersion: 2,
  id: 'actor-new',
  name: 'New Actor',
  actorType: 'npc',
  alignment: 'impartial',
  description: '',
  tags: [],
  stats: {
    maxHealth: 3,
    moveSpeed: 52,
    aggroRange: 96,
    leashRange: 128,
    contactDamage: 1,
    knockback: 120
  },
  dimensions: {
    width: 24,
    height: 24,
    collision: { x: -12, y: -12, w: 24, h: 24 },
    hurtbox: null,
    hitbox: null,
    physics: 'dynamic',
    noContact: false
  },
  visuals: {
    assetType: 'vfs-art',
    artDocument: '',
    artTile: ACTOR_ART_TILE_SLOTS[0].char,
    fallbackImage: '',
    fallbackMetadata: ''
  },
  clips: [
    { id: 'idle', name: 'Idle', startFrame: 0, endFrame: 0, fps: 8, loop: true },
    { id: 'walk', name: 'Walk', startFrame: 0, endFrame: 0, fps: 10, loop: true }
  ],
  states: [
    {
      id: 'idle',
      name: 'Idle',
      clipId: 'idle',
      movementMode: 'idle',
      behaviorMode: 'idle',
      canAttack: false,
      canMove: true,
      canSpawn: false,
      canInteract: true,
      invulnerable: false,
      transitions: []
    }
  ],
  behavior: {
    mode: 'idle',
    movementSpeed: 52,
    aggroRange: 96,
    leashRange: 128,
    patrolRadius: 48,
    patrolPoints: [],
    wanderRadius: 64,
    lineOfSightRequired: false,
    preferredAttackRange: 32,
    cooldown: 1,
    retreatDistance: 24,
    targetPlayer: true,
    targetAlignments: ['enemy'],
    ignorePlayerUnlessAttacked: false,
    activateOnlyOnTrigger: false
  },
  attacks: [],
  lootTable: [],
  spawnRules: {
    enabled: true,
    maxChildren: 0,
    spawnActorId: '',
    spawnInterval: 2,
    spawnCount: 1,
    formation: 'point'
  },
  vulnerabilities: {
    destructible: true,
    invulnerableByDefault: false,
    weakPointsOnly: false,
    weakPointPartIds: []
  },
  interaction: {
    dialogueId: '',
    interactType: 'talk',
    shopId: '',
    scriptHook: ''
  },
  parts: [],
  editor: {
    color: '#8ecae6',
    glyph: 'AC',
    category: 'actors'
  },
  ...overrides
});

export const createActorPresetDefinition = (presetId = 'blankAdvanced', overrides = {}) => {
  const base = createDefaultActorDefinition();
  const presets = {
    friendlyNpc: createDefaultActorDefinition({
      id: 'friendly-npc',
      name: 'Friendly NPC',
      actorType: 'npc',
      alignment: 'friendly',
      description: 'A friendly character that can talk to the player.',
      stats: { ...base.stats, maxHealth: 5, moveSpeed: 36, contactDamage: 0 },
      clips: [
        createClip('idle', 'Idle', { fps: 6 }),
        createClip('talk', 'Talk', { fps: 8 })
      ],
      states: [
        createState('idle', 'Idle', 'idle', { behaviorMode: 'talk', canAttack: false, canInteract: true }),
        createState('talk', 'Talk', 'talk', { behaviorMode: 'talk', canAttack: false, canInteract: true, canMove: false })
      ],
      behavior: { ...base.behavior, mode: 'talk', movementSpeed: 0, targetPlayer: false, targetAlignments: [] },
      vulnerabilities: { ...base.vulnerabilities, destructible: false },
      interaction: { ...base.interaction, interactType: 'talk' },
      editor: { color: '#67d5b5', glyph: 'NP', category: 'actors' }
    }),
    basicEnemy: createDefaultActorDefinition({
      id: 'basic-enemy',
      name: 'Basic Enemy',
      actorType: 'enemy',
      alignment: 'enemy',
      description: 'A simple ground enemy that walks back and forth and damages on contact.',
      stats: { ...base.stats, maxHealth: 3, moveSpeed: 48, aggroRange: 96, leashRange: 160, contactDamage: 1, knockback: 120 },
      clips: [
        createClip('idle', 'Idle', { fps: 6 }),
        createClip('move', 'Move', { fps: 10 }),
        createClip('hurt', 'Hurt', { fps: 8, loop: false }),
        createClip('death', 'Death', { fps: 10, loop: false })
      ],
      states: [
        createState('idle', 'Idle', 'idle', { movementMode: 'idle', behaviorMode: 'patrol', canAttack: true, canInteract: false }),
        createState('move', 'Move', 'move', { movementMode: 'walk', behaviorMode: 'patrol', canAttack: true, canInteract: false }),
        createState('hurt', 'Hurt', 'hurt', { movementMode: 'idle', behaviorMode: 'idle', canAttack: false, canInteract: false }),
        createState('death', 'Death', 'death', { movementMode: 'idle', behaviorMode: 'idle', canAttack: false, canMove: false, canInteract: false })
      ],
      behavior: {
        ...base.behavior,
        mode: 'patrol',
        movementSpeed: 48,
        gravityEnabled: true,
        wallResponse: 'bounce',
        edgeResponse: 'turn',
        patrolStyle: 'wallBounce',
        targetAlignments: ['friendly', 'impartial']
      },
      lootTable: [{ id: 'loot-1', itemId: 'health-small', probability: 0.2, minQuantity: 1, maxQuantity: 1, guaranteed: false, condition: '' }],
      editor: { color: '#ff6b6b', glyph: 'EN', category: 'actors' }
    }),
    turret: createDefaultActorDefinition({
      id: 'turret',
      name: 'Turret',
      actorType: 'turret',
      alignment: 'enemy',
      description: 'A stationary actor that attacks from a fixed position.',
      stats: { ...base.stats, maxHealth: 4, moveSpeed: 0, contactDamage: 1 },
      dimensions: { ...base.dimensions, physics: 'static' },
      clips: [
        createClip('idle', 'Idle', { fps: 4 }),
        createClip('attack', 'Attack', { fps: 8, loop: false }),
        createClip('destroyed', 'Destroyed', { fps: 8, loop: false })
      ],
      states: [
        createState('idle', 'Idle', 'idle', { movementMode: 'stationary', behaviorMode: 'stationaryTurret', canAttack: true, canMove: false, canInteract: false }),
        createState('attack', 'Attack', 'attack', { movementMode: 'stationary', behaviorMode: 'stationaryTurret', canAttack: true, canMove: false, canInteract: false }),
        createState('destroyed', 'Destroyed', 'destroyed', { movementMode: 'stationary', behaviorMode: 'idle', canAttack: false, canMove: false, canInteract: false })
      ],
      behavior: { ...base.behavior, mode: 'stationaryTurret', movementSpeed: 0, gravityEnabled: false, targetAlignments: ['friendly', 'impartial'] },
      editor: { color: '#f4a261', glyph: 'TU', category: 'actors' }
    }),
    spawner: createDefaultActorDefinition({
      id: 'spawner',
      name: 'Spawner',
      actorType: 'spawner',
      alignment: 'enemy',
      description: 'A utility actor that periodically creates other actors.',
      stats: { ...base.stats, maxHealth: 6, moveSpeed: 0, contactDamage: 0 },
      clips: [
        createClip('idle', 'Idle', { fps: 4 }),
        createClip('spawn', 'Spawn', { fps: 8, loop: false }),
        createClip('destroyed', 'Destroyed', { fps: 8, loop: false })
      ],
      states: [
        createState('idle', 'Idle', 'idle', { movementMode: 'stationary', behaviorMode: 'spawner', canAttack: false, canSpawn: true, canMove: false, canInteract: false }),
        createState('spawn', 'Spawn', 'spawn', { movementMode: 'stationary', behaviorMode: 'spawner', canAttack: false, canSpawn: true, canMove: false, canInteract: false }),
        createState('destroyed', 'Destroyed', 'destroyed', { movementMode: 'stationary', behaviorMode: 'idle', canAttack: false, canSpawn: false, canMove: false, canInteract: false })
      ],
      behavior: { ...base.behavior, mode: 'spawner', movementSpeed: 0, gravityEnabled: false, targetPlayer: false, targetAlignments: [] },
      spawnRules: { ...base.spawnRules, enabled: true, spawnInterval: 3, spawnCount: 1 },
      editor: { color: '#c77dff', glyph: 'SP', category: 'actors' }
    }),
    boss: createDefaultActorDefinition({
      id: 'boss',
      name: 'Boss',
      actorType: 'boss',
      alignment: 'enemy',
      description: 'A boss base actor with room for custom states, attacks, and parts.',
      stats: { ...base.stats, maxHealth: 24, moveSpeed: 42, contactDamage: 2, knockback: 180 },
      clips: [
        createClip('idle', 'Idle', { fps: 6 }),
        createClip('move', 'Move', { fps: 8 }),
        createClip('hurt', 'Hurt', { fps: 8, loop: false }),
        createClip('death', 'Death', { fps: 10, loop: false })
      ],
      states: [
        createState('idle', 'Idle', 'idle', { movementMode: 'idle', behaviorMode: 'bossController', canAttack: true, canInteract: false }),
        createState('move', 'Move', 'move', { movementMode: 'walk', behaviorMode: 'bossController', canAttack: true, canInteract: false }),
        createState('hurt', 'Hurt', 'hurt', { movementMode: 'idle', behaviorMode: 'bossController', canAttack: false, canInteract: false }),
        createState('death', 'Death', 'death', { movementMode: 'idle', behaviorMode: 'idle', canAttack: false, canMove: false, canInteract: false })
      ],
      behavior: { ...base.behavior, mode: 'bossController', movementSpeed: 42, gravityEnabled: true, targetAlignments: ['friendly', 'impartial'] },
      editor: { color: '#ef476f', glyph: 'BS', category: 'actors' }
    }),
    blankAdvanced: createDefaultActorDefinition({
      id: 'actor-new',
      name: 'New Actor',
      actorType: 'npc',
      alignment: 'impartial',
      description: '',
      editor: { color: '#8ecae6', glyph: 'AC', category: 'actors' }
    })
  };
  return cloneActorDefinition({ ...(presets[presetId] || presets.blankAdvanced), ...overrides });
};

export const normalizeActorDefinition = (input = {}) => {
  const legacyVisuals = obj(input.visuals);
  const legacySpriteSource = obj(input.spriteSource);
  const legacyAnimationSet = obj(input.animationSet);
  const legacyBehavior = obj(input.behavior);
  const base = createDefaultActorDefinition();
  const actorType = ACTOR_TYPES.includes(input.actorType)
    ? input.actorType
    : (input.alignment === 'enemy' ? 'enemy' : 'npc');
  const alignment = ACTOR_ALIGNMENTS.includes(input.alignment) ? input.alignment : base.alignment;
  const clips = arr(input.clips).length
    ? arr(input.clips)
    : Object.entries(obj(legacyAnimationSet.clips)).map(([id, clip]) => ({
      id,
      name: id,
      startFrame: num(clip.start, arr(clip.frames)[0] ?? 0),
      endFrame: num(clip.end, arr(clip.frames).slice(-1)[0] ?? num(clip.start, 0)),
      fps: num(clip.fps, 8),
      loop: clip.loop !== false
    }));
  const clipList = clips.length ? clips : base.clips;
  const states = arr(input.states).length
    ? arr(input.states)
    : [{
      id: 'idle',
      name: 'Idle',
      clipId: obj(legacyAnimationSet.roles).idle || clipList[0]?.id || 'idle',
      movementMode: 'idle',
      behaviorMode: ACTOR_BEHAVIOR_MODES.includes(legacyBehavior.archetype) ? legacyBehavior.archetype : base.behavior.mode,
      canAttack: actorType === 'enemy' || actorType === 'boss' || actorType === 'turret',
      canMove: actorType !== 'turret',
      canSpawn: actorType === 'spawner',
      canInteract: alignment !== 'enemy',
      invulnerable: false,
      transitions: []
    }];
  return createDefaultActorDefinition({
    ...input,
    id: str(input.id || base.id).trim(),
    name: str(input.name || base.name),
    actorType,
    alignment,
    description: str(input.description),
    tags: arr(input.tags).map((tag) => str(tag).trim()).filter(Boolean),
    stats: { ...base.stats, ...obj(input.stats) },
    dimensions: {
      ...base.dimensions,
      ...obj(input.dimensions),
      collision: { ...base.dimensions.collision, ...obj(obj(input.dimensions).collision) }
    },
    visuals: {
      ...base.visuals,
      ...legacyVisuals,
      artDocument: str(legacyVisuals.artDocument || legacySpriteSource.documentName || ''),
      artTile: str(legacyVisuals.artTile || base.visuals.artTile),
      fallbackImage: str(legacyVisuals.fallbackImage || legacyAnimationSet.image || legacySpriteSource.image || ''),
      fallbackMetadata: str(legacyVisuals.fallbackMetadata || legacyAnimationSet.metadata || legacySpriteSource.metadata || '')
    },
    clips: clipList.map((clip, index) => ({
      id: str(clip.id || `clip-${index + 1}`).trim(),
      name: str(clip.name || clip.id || `Clip ${index + 1}`),
      startFrame: num(clip.startFrame, 0),
      endFrame: num(clip.endFrame, num(clip.startFrame, 0)),
      fps: num(clip.fps, 8),
      loop: clip.loop !== false
    })),
    states: states.map((state, index) => ({
      id: str(state.id || `state-${index + 1}`).trim(),
      name: str(state.name || state.id || `State ${index + 1}`),
      clipId: str(state.clipId || clipList[0]?.id || 'idle').trim(),
      movementMode: ACTOR_STATE_MOVEMENT_MODES.includes(state.movementMode) ? state.movementMode : 'idle',
      behaviorMode: ACTOR_BEHAVIOR_MODES.includes(state.behaviorMode) ? state.behaviorMode : base.behavior.mode,
      canAttack: state.canAttack === true,
      canMove: state.canMove !== false,
      canSpawn: state.canSpawn === true,
      canInteract: state.canInteract !== false,
      invulnerable: state.invulnerable === true,
      transitions: arr(state.transitions).map((transition, tIndex) => ({
        id: str(transition.id || `transition-${tIndex + 1}`),
        targetStateId: str(transition.targetStateId || ''),
        condition: TRANSITION_CONDITIONS.includes(transition.condition) ? transition.condition : 'timerElapsed',
        value: num(transition.value, 0),
        chance: num(transition.chance, 1),
        flag: str(transition.flag || '')
      }))
    })),
    behavior: { ...base.behavior, ...obj(input.behavior), mode: ACTOR_BEHAVIOR_MODES.includes(input.behavior?.mode) ? input.behavior.mode : (ACTOR_BEHAVIOR_MODES.includes(legacyBehavior.archetype) ? legacyBehavior.archetype : base.behavior.mode) },
    attacks: arr(input.attacks).map((attack, index) => ({
      id: str(attack.id || `attack-${index + 1}`),
      name: str(attack.name || `Attack ${index + 1}`),
      type: ACTOR_ATTACK_TYPES.includes(attack.type) ? attack.type : 'melee',
      startup: num(attack.startup, 0.15),
      active: num(attack.active, 0.1),
      recovery: num(attack.recovery, 0.2),
      cooldown: num(attack.cooldown, 1),
      range: num(attack.range, 24),
      damage: num(attack.damage, 1),
      knockback: num(attack.knockback, 120),
      hitbox: { shape: str(attack.hitbox?.shape || 'box'), w: num(attack.hitbox?.w, 16), h: num(attack.hitbox?.h, 16), offsetX: num(attack.hitbox?.offsetX, 0), offsetY: num(attack.hitbox?.offsetY, 0) },
      projectile: { actorId: str(attack.projectile?.actorId || ''), count: num(attack.projectile?.count, 1), spread: num(attack.projectile?.spread, 0), angle: num(attack.projectile?.angle, 0), speed: num(attack.projectile?.speed, 120), gravity: num(attack.projectile?.gravity, 0), homing: attack.projectile?.homing === true, target: str(attack.projectile?.target || 'player'), variance: num(attack.projectile?.variance, 0) },
      spawn: { actorId: str(attack.spawn?.actorId || ''), count: num(attack.spawn?.count, 1), offsetX: num(attack.spawn?.offsetX, 0), offsetY: num(attack.spawn?.offsetY, 0), interval: num(attack.spawn?.interval, 1) },
      telegraph: { duration: num(attack.telegraph?.duration, 0), fx: str(attack.telegraph?.fx || ''), sound: str(attack.telegraph?.sound || '') }
    })),
    lootTable: arr(input.lootTable || input.loot?.drops).map((entry, index) => ({
      id: str(entry.id || `loot-${index + 1}`),
      itemId: str(entry.itemId || entry.type || ''),
      probability: num(entry.probability, 1),
      minQuantity: num(entry.minQuantity, 1),
      maxQuantity: num(entry.maxQuantity, entry.minQuantity ?? 1),
      guaranteed: entry.guaranteed === true,
      condition: str(entry.condition || '')
    })),
    spawnRules: { ...base.spawnRules, ...obj(input.spawnRules) },
    vulnerabilities: { ...base.vulnerabilities, ...obj(input.vulnerabilities) },
    interaction: { ...base.interaction, ...obj(input.interaction) },
    parts: arr(input.parts).map((part, index) => ({
      id: str(part.id || `part-${index + 1}`),
      name: str(part.name || `Part ${index + 1}`),
      actorId: str(part.actorId || ''),
      offsetX: num(part.offsetX, 0),
      offsetY: num(part.offsetY, 0),
      attachTo: str(part.attachTo || 'root'),
      role: str(part.role || 'weak-point'),
      syncState: part.syncState !== false
    })),
    editor: { ...base.editor, ...obj(input.editor), color: str(input.editor?.color || input.editorPreview?.color || base.editor.color), glyph: str(input.editor?.glyph || input.editorPreview?.glyph || base.editor.glyph).slice(0, 2).toUpperCase() }
  });
};

export const validateActorDefinition = (input = {}) => {
  const actor = normalizeActorDefinition(input);
  const errors = [];
  const warnings = [];
  if (!actor.id) errors.push('Actor id is required.');
  if (!actor.name) errors.push('Actor name is required.');
  if (!ACTOR_TYPES.includes(actor.actorType)) errors.push(`Invalid actor type: ${actor.actorType}`);
  if (!ACTOR_ALIGNMENTS.includes(actor.alignment)) errors.push(`Invalid alignment: ${actor.alignment}`);
  if (!actor.states.length) errors.push('At least one state is required.');
  const clipIds = new Set(actor.clips.map((clip) => clip.id));
  actor.states.forEach((state) => {
    if (!clipIds.has(state.clipId)) warnings.push(`State ${state.id} references missing clip ${state.clipId}.`);
    state.transitions.forEach((transition) => {
      if (transition.targetStateId && !actor.states.some((entry) => entry.id === transition.targetStateId)) {
        warnings.push(`State ${state.id} has transition to missing state ${transition.targetStateId}.`);
      }
    });
  });
  actor.attacks.forEach((attack) => {
    if ((attack.type === 'projectile' || attack.type === 'burstProjectile') && attack.projectile.speed <= 0) {
      warnings.push(`Attack ${attack.name} has invalid projectile speed.`);
    }
  });
  const probabilitySum = actor.lootTable.filter((entry) => !entry.guaranteed).reduce((sum, entry) => sum + entry.probability, 0);
  if (probabilitySum > 1.001) warnings.push('Loot probabilities exceed 1.0 total.');
  actor.parts.forEach((part) => {
    if (part.actorId && part.actorId === actor.id) warnings.push(`Part ${part.id} self-references the parent actor.`);
  });
  if (!actor.visuals.artDocument && !actor.visuals.fallbackImage) warnings.push('No linked art document or fallback sprite sheet configured.');
  return { actor, errors, warnings };
};

export const createActorInstance = (overrides = {}) => ({
  actorId: '',
  npcId: '',
  x: 0,
  y: 0,
  facing: 1,
  patrolPoints: [],
  patrolRadius: null,
  startState: '',
  dialogueOverride: '',
  enabled: true,
  customName: '',
  spawnCondition: '',
  roomFlag: '',
  lootOverride: '',
  triggerFlag: '',
  ...overrides
});

export const normalizeActorInstance = (input = {}) => ({
  ...createActorInstance(),
  ...input,
  actorId: str(input.actorId || input.npcId || ''),
  npcId: str(input.npcId || input.actorId || ''),
  x: num(input.x, 0),
  y: num(input.y, 0),
  facing: num(input.facing, 1) >= 0 ? 1 : -1,
  patrolPoints: arr(input.patrolPoints).map((point) => ({ x: num(point?.x, 0), y: num(point?.y, 0) })),
  patrolRadius: input.patrolRadius == null ? null : num(input.patrolRadius, null),
  startState: str(input.startState || ''),
  dialogueOverride: str(input.dialogueOverride || ''),
  enabled: input.enabled !== false,
  customName: str(input.customName || ''),
  spawnCondition: str(input.spawnCondition || ''),
  roomFlag: str(input.roomFlag || ''),
  lootOverride: str(input.lootOverride || ''),
  triggerFlag: str(input.triggerFlag || '')
});

export const cloneActorDefinition = (actor) => clone(normalizeActorDefinition(actor));
