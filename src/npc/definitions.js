export const NPC_ALIGNMENT_OPTIONS = ['friendly', 'enemy', 'impartial'];
export const NPC_ANIMATION_ROLES = ['idle', 'walk', 'run', 'attack', 'hurt', 'death', 'interact', 'talk'];
export const NPC_BEHAVIOR_ARCHETYPES = ['idle', 'stationary', 'wander', 'patrol', 'chase', 'meleeAttack', 'talk'];

export const DEFAULT_NPC_DIMENSIONS = Object.freeze({
  width: 24,
  height: 24,
  collision: { x: -12, y: -12, w: 24, h: 24 },
  hurtbox: null,
  hitbox: null
});

export const createDefaultNpcDefinition = (overrides = {}) => ({
  schemaVersion: 1,
  id: 'npc-new',
  name: 'New NPC',
  alignment: 'impartial',
  description: '',
  tags: [],
  spriteSource: {
    image: '',
    metadata: '',
    documentName: ''
  },
  animationSet: {
    sourceType: 'sprite-sheet-json',
    image: '',
    metadata: '',
    clips: {},
    roles: {
      idle: 'idle',
      walk: 'walk',
      run: 'run',
      attack: 'attack',
      hurt: 'hurt',
      death: 'death',
      interact: 'interact',
      talk: 'talk'
    }
  },
  stats: {
    maxHealth: 3,
    moveSpeed: 52,
    aggroRange: 96,
    contactDamage: 1,
    knockback: 120
  },
  dimensions: JSON.parse(JSON.stringify(DEFAULT_NPC_DIMENSIONS)),
  behavior: {
    archetype: 'stationary',
    parameters: {
      wanderRadius: 48,
      patrolPoints: [],
      detectionRange: 96,
      attackRange: 28,
      attackCooldown: 1,
      moveSpeedMultiplier: 1,
      returnHome: true,
      targetAlignments: ['enemy'],
      interactionRange: 52
    }
  },
  interaction: {
    dialogueId: '',
    interactType: 'talk',
    shopId: '',
    scriptHook: ''
  },
  loot: {
    tableId: '',
    credits: 0,
    drops: []
  },
  editorPreview: {
    color: '#8ecae6',
    glyph: 'NP',
    preferredAnimationRole: 'idle'
  },
  ...overrides
});

const numberOr = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const objectOr = (value, fallback) => (value && typeof value === 'object' && !Array.isArray(value) ? value : fallback);
const arrayOr = (value, fallback = []) => (Array.isArray(value) ? value : fallback);

export const normalizeNpcDefinition = (input = {}) => {
  const base = createDefaultNpcDefinition();
  const dimensions = objectOr(input.dimensions, {});
  const behavior = objectOr(input.behavior, {});
  const stats = objectOr(input.stats, {});
  const interaction = objectOr(input.interaction, {});
  const loot = objectOr(input.loot, {});
  const animationSet = objectOr(input.animationSet, {});
  const spriteSource = objectOr(input.spriteSource, {});
  const editorPreview = objectOr(input.editorPreview, {});

  const normalized = createDefaultNpcDefinition({
    ...base,
    ...input,
    id: String(input.id || base.id).trim(),
    name: String(input.name || base.name).trim(),
    alignment: NPC_ALIGNMENT_OPTIONS.includes(input.alignment) ? input.alignment : base.alignment,
    description: String(input.description || ''),
    tags: arrayOr(input.tags).map((tag) => String(tag).trim()).filter(Boolean),
    spriteSource: {
      ...base.spriteSource,
      ...spriteSource,
      image: String(spriteSource.image || ''),
      metadata: String(spriteSource.metadata || ''),
      documentName: String(spriteSource.documentName || '')
    },
    animationSet: {
      ...base.animationSet,
      ...animationSet,
      image: String(animationSet.image || spriteSource.image || ''),
      metadata: String(animationSet.metadata || spriteSource.metadata || ''),
      clips: objectOr(animationSet.clips, {}),
      roles: { ...base.animationSet.roles, ...objectOr(animationSet.roles, {}) }
    },
    stats: {
      maxHealth: numberOr(stats.maxHealth, base.stats.maxHealth),
      moveSpeed: numberOr(stats.moveSpeed, base.stats.moveSpeed),
      aggroRange: numberOr(stats.aggroRange, base.stats.aggroRange),
      contactDamage: numberOr(stats.contactDamage, base.stats.contactDamage),
      knockback: numberOr(stats.knockback, base.stats.knockback)
    },
    dimensions: {
      width: numberOr(dimensions.width, base.dimensions.width),
      height: numberOr(dimensions.height, base.dimensions.height),
      collision: {
        ...base.dimensions.collision,
        ...objectOr(dimensions.collision, {})
      },
      hurtbox: dimensions.hurtbox ?? base.dimensions.hurtbox,
      hitbox: dimensions.hitbox ?? base.dimensions.hitbox
    },
    behavior: {
      archetype: NPC_BEHAVIOR_ARCHETYPES.includes(behavior.archetype) ? behavior.archetype : base.behavior.archetype,
      parameters: { ...base.behavior.parameters, ...objectOr(behavior.parameters, {}) }
    },
    interaction: {
      ...base.interaction,
      ...interaction
    },
    loot: {
      ...base.loot,
      ...loot,
      drops: arrayOr(loot.drops)
    },
    editorPreview: {
      ...base.editorPreview,
      ...editorPreview,
      glyph: String(editorPreview.glyph || base.editorPreview.glyph).slice(0, 2).toUpperCase()
    }
  });

  return normalized;
};

export const validateNpcDefinition = (input = {}) => {
  const npc = normalizeNpcDefinition(input);
  const warnings = [];
  const errors = [];

  if (!npc.id) errors.push('NPC id is required.');
  if (!npc.name) errors.push('NPC name is required.');
  if (!NPC_ALIGNMENT_OPTIONS.includes(npc.alignment)) errors.push(`Invalid alignment: ${npc.alignment}`);
  if (!npc.animationSet.metadata) warnings.push('Missing sprite sheet metadata reference.');
  if (!npc.animationSet.image) warnings.push('Missing sprite sheet image reference.');
  if (!npc.animationSet.roles.idle) warnings.push('Missing idle animation role mapping.');
  if (!npc.animationSet.roles.walk) warnings.push('Missing walk animation role mapping.');

  return { npc, warnings, errors };
};

export const createNpcInstance = (overrides = {}) => ({
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
  behaviorOverrides: {},
  ...overrides
});

export const normalizeNpcInstance = (input = {}) => ({
  ...createNpcInstance(),
  ...input,
  npcId: String(input.npcId || ''),
  x: numberOr(input.x, 0),
  y: numberOr(input.y, 0),
  facing: numberOr(input.facing, 1) >= 0 ? 1 : -1,
  patrolPoints: arrayOr(input.patrolPoints).map((point) => ({ x: numberOr(point?.x, 0), y: numberOr(point?.y, 0) })),
  patrolRadius: input.patrolRadius == null ? null : numberOr(input.patrolRadius, null),
  enabled: input.enabled !== false,
  customName: String(input.customName || ''),
  dialogueOverride: String(input.dialogueOverride || ''),
  startState: String(input.startState || ''),
  spawnCondition: String(input.spawnCondition || ''),
  roomFlag: String(input.roomFlag || ''),
  behaviorOverrides: objectOr(input.behaviorOverrides, {})
});
