import test from 'node:test';
import assert from 'node:assert/strict';

import World from '../../src/world/World.js';
import { createDefaultNpcDefinition, normalizeNpcInstance, validateNpcDefinition } from '../../src/npc/definitions.js';
import { isHostileToPlayer, shouldAttackPlayer, shouldIgnorePlayer, canPeacefullyInteract } from '../../src/npc/alignment.js';
import { spawnNpcEntities } from '../../src/npc/runtime.js';

const createRegistryStub = (...definitions) => ({
  get(id) {
    return definitions.find((entry) => entry.id === id) || null;
  }
});

test('world serializes and exposes NPC instances separately from enemies', () => {
  const world = new World();
  world.applyData({
    schemaVersion: 1,
    tileSize: 32,
    width: 4,
    height: 4,
    spawn: { x: 1, y: 1 },
    tiles: ['....', '....', '....', '....'],
    regions: [],
    enemies: [{ x: 2, y: 2, type: 'skitter' }],
    npcs: [{ npcId: 'npc-camp-mechanic', x: 1, y: 2, facing: 1, enabled: true }]
  });

  assert.equal(world.enemyAt(2, 2)?.type, 'skitter');
  assert.equal(world.npcAt(1, 2)?.npcId, 'npc-camp-mechanic');

  world.setNpc({ npcId: 'npc-rift-scavenger', x: 3, y: 1, facing: -1, enabled: true });
  assert.equal(world.npcAt(3, 1)?.npcId, 'npc-rift-scavenger');
  world.removeNpc(1, 2);
  assert.equal(world.npcAt(1, 2), null);
});

test('NPC definitions validate role mappings and keep shared asset references', () => {
  const definition = createDefaultNpcDefinition({
    id: 'npc-sample',
    name: 'Sample NPC',
    alignment: 'friendly',
    animationSet: {
      image: '/assets/npc.png',
      metadata: '/assets/npc.json',
      clips: {
        idle: { type: 'indices', frames: [0], fps: 8 },
        walk: { type: 'range', start: 1, end: 3, fps: 10 }
      },
      roles: {
        idle: 'idle',
        walk: 'walk',
        talk: 'idle'
      }
    }
  });

  const { npc, errors, warnings } = validateNpcDefinition(definition);
  assert.equal(errors.length, 0);
  assert.equal(npc.animationSet.image, '/assets/npc.png');
  assert.equal(npc.animationSet.metadata, '/assets/npc.json');
  assert.equal(npc.animationSet.roles.walk, 'walk');
  assert.ok(warnings.some((entry) => entry.includes('run')) === false);
});

test('runtime resolves npcId into reusable NPC entities with alignment behavior flags', () => {
  const definition = createDefaultNpcDefinition({
    id: 'npc-rift-scavenger',
    name: 'Rift Scavenger',
    alignment: 'enemy',
    behavior: { archetype: 'meleeAttack', parameters: { detectionRange: 120, attackRange: 24, attackCooldown: 1 } }
  });
  const instances = spawnNpcEntities({
    world: { npcs: [normalizeNpcInstance({ npcId: 'npc-rift-scavenger', x: 4, y: 5, facing: -1, enabled: true })] },
    registry: createRegistryStub(definition),
    tileSize: 32
  });

  assert.equal(instances.length, 1);
  assert.equal(instances[0].definition.id, 'npc-rift-scavenger');
  assert.equal(instances[0].attackPlayer, true);
  assert.equal(instances[0].peacefulInteraction, false);
});

test('alignment helpers establish ecosystem baseline queries', () => {
  assert.equal(isHostileToPlayer('enemy'), true);
  assert.equal(shouldAttackPlayer('enemy', { interaction: {} }), true);
  assert.equal(shouldIgnorePlayer('impartial'), true);
  assert.equal(canPeacefullyInteract('friendly'), true);
  assert.equal(canPeacefullyInteract('enemy'), false);
});
