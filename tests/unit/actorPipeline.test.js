import test from 'node:test';
import assert from 'node:assert/strict';

import World from '../../src/world/World.js';
import { createDefaultActorDefinition, normalizeActorInstance, validateActorDefinition } from '../../src/actors/definitions.js';
import { spawnActorEntities } from '../../src/actors/runtime.js';

const registry = (...defs) => ({ get: (id) => defs.find((entry) => entry.id === id) || null });

test('world keeps actor placements compatible with legacy npc storage', () => {
  const world = new World();
  world.applyData({ schemaVersion: 1, tileSize: 32, width: 4, height: 4, spawn: { x: 1, y: 1 }, tiles: ['....', '....', '....', '....'], regions: [], enemies: [], npcs: [{ actorId: 'actor-rift-scavenger', npcId: 'actor-rift-scavenger', x: 2, y: 2, enabled: true }] });
  assert.equal(world.npcAt(2, 2)?.actorId, 'actor-rift-scavenger');
});

test('actor definitions validate visual/state/attack/loot structure', () => {
  const { actor, errors, warnings } = validateActorDefinition(createDefaultActorDefinition({
    id: 'actor-sample',
    name: 'Actor Sample',
    actorType: 'turret',
    alignment: 'enemy',
    visuals: { assetType: 'vfs-art', artDocument: 'actor-sample', artTile: '01' },
    clips: [{ id: 'idle', name: 'Idle', startFrame: 0, endFrame: 1, fps: 8, loop: true }],
    states: [{ id: 'idle', name: 'Idle', clipId: 'idle', movementMode: 'turret', behaviorMode: 'stationaryTurret', canAttack: true, canMove: false, canSpawn: false, canInteract: false, invulnerable: false, transitions: [] }],
    attacks: [{ id: 'shot', name: 'Shot', type: 'projectile', startup: 0.1, active: 0.1, recovery: 0.2, cooldown: 1, range: 120, damage: 1, knockback: 100, hitbox: { shape: 'box', w: 8, h: 8, offsetX: 0, offsetY: 0 }, projectile: { actorId: 'bullet', count: 1, spread: 0, angle: 0, speed: 180, gravity: 0, homing: false, target: 'player', variance: 0 }, spawn: { actorId: '', count: 1, offsetX: 0, offsetY: 0, interval: 1 }, telegraph: { duration: 0, fx: '', sound: '' } }],
    lootTable: [{ id: 'loot-1', itemId: 'scrap', probability: 0.5, minQuantity: 1, maxQuantity: 2, guaranteed: false, condition: '' }]
  }));
  assert.equal(errors.length, 0);
  assert.equal(actor.actorType, 'turret');
  assert.equal(actor.states[0].behaviorMode, 'stationaryTurret');
  assert.equal(actor.attacks[0].type, 'projectile');
  assert.ok(warnings.length >= 0);
});

test('runtime resolves actorId definitions into actor entities', () => {
  const def = createDefaultActorDefinition({ id: 'actor-rift-scavenger', name: 'Rift Scavenger', actorType: 'enemy', alignment: 'enemy' });
  const entities = spawnActorEntities({ world: { npcs: [normalizeActorInstance({ actorId: 'actor-rift-scavenger', x: 3, y: 1, enabled: true })] }, registry: registry(def), tileSize: 32 });
  assert.equal(entities.length, 1);
  assert.equal(entities[0].definition.id, 'actor-rift-scavenger');
});
