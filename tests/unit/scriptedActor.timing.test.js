import test from 'node:test';
import assert from 'node:assert/strict';

import ScriptedActor, {
  resolveActorArtFrameDurationMs,
  resolveActorArtFrameDurations,
  resolveAnimationFrames
} from '../../src/entities/ScriptedActor.js';
import { clearCachedProjectFilesForTests, upsertCachedProjectFile } from '../../src/ui/serverStorage.js';

function makeActor() {
  return new ScriptedActor(0, 0, {
    schemaVersion: 2,
    id: 'timer-test',
    name: 'Timer Test',
    gravity: false,
    bodyDamageEnabled: false,
    contactDamage: 0,
    invulnerable: false,
    destructible: true,
    health: 3,
    facingMode: 'face-right',
    size: { width: 24, height: 24 },
    collisionZones: [{ type: 'solid', x: 0, y: 0, width: 24, height: 24 }],
    loot: [],
    linkedParts: [],
    states: [
      {
        id: 'idle',
        name: 'Idle',
        animation: { frames: [], fps: 8 },
        movement: { type: 'none', params: {} },
        overrides: { bodyDamageEnabled: null, contactDamage: null, invulnerable: null },
        collisionZones: null,
        transitions: [{
          id: 'transition-1',
          conditionMode: 'all',
          conditions: [{ id: 'timer', type: 'timer-elapsed', params: { seconds: 0.5 } }],
          actions: [{ id: 'switch', type: 'switch-state', params: { stateId: 'done' } }]
        }]
      },
      {
        id: 'done',
        name: 'Done',
        animation: { frames: [], fps: 8 },
        movement: { type: 'none', params: {} },
        overrides: { bodyDamageEnabled: null, contactDamage: null, invulnerable: null },
        collisionZones: null,
        transitions: []
      }
    ],
    initialStateId: 'idle',
    advanced: { assetRefs: {}, notes: '' }
  });
}

function makeDeathActor({ destroyAfterDeath = true, collidableAfterDeath = false } = {}) {
  const actor = makeActor();
  actor.definition.deathStateId = 'done';
  actor.definition.destroyAfterDeath = destroyAfterDeath;
  actor.definition.collidableAfterDeath = collidableAfterDeath;
  actor.deathStateId = 'done';
  actor.destroyAfterDeath = destroyAfterDeath;
  actor.collidableAfterDeath = collidableAfterDeath;
  return actor;
}

function withCanvasDocument(fn) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            createImageData(width, height) {
              return { data: new Uint8ClampedArray(width * height * 4) };
            },
            putImageData() {}
          };
        },
        toDataURL() {
          return 'data:image/png;base64,actor-frame';
        }
      };
    }
  };
  try {
    return fn();
  } finally {
    globalThis.document = previousDocument;
  }
}

function cacheArtDocument(name, data, savedAt = 1234) {
  upsertCachedProjectFile('art', name, JSON.stringify({
    version: 1,
    folder: 'art',
    name,
    savedAt,
    data
  }));
}

test('scripted actor transition timers use real time while movement dt is slowed', () => {
  const actor = makeActor();
  const player = { x: 100, y: 0 };

  actor.update(0.125, player, { actorTimerDt: 0.5 });

  assert.equal(actor.stateId, 'done');
});

test('scripted actor art refs preserve baked per-frame durations', () => {
  clearCachedProjectFilesForTests();
  cacheArtDocument('actor-varied-timing-art', {
    kind: 'actor-state-animation',
    width: 1,
    height: 1,
    fps: 32,
    frames: [['#ff0000'], ['#00ff00'], ['#0000ff']],
    editor: {
      frames: [
        { durationMs: 31 },
        { durationMs: 114 },
        { durationMs: 360 }
      ]
    }
  });

  const frames = withCanvasDocument(() => resolveAnimationFrames({ artRef: 'actor-varied-timing-art', fps: 32 }));

  assert.deepEqual(frames.map((frame) => frame.durationMs), [31, 114, 360]);
});

test('scripted actor duration helpers expose single-frame and list APIs', () => {
  const artDoc = {
    data: {
      fps: 20,
      editor: {
        frames: [
          { durationMs: 40 },
          { durationMs: 80 }
        ]
      }
    }
  };

  assert.equal(resolveActorArtFrameDurationMs(artDoc, {}, 1), 80);
  assert.deepEqual(resolveActorArtFrameDurations(artDoc, {}, 3), [40, 80, 50]);
});

test('scripted actor art refs fall back to fps when no baked durations exist', () => {
  clearCachedProjectFilesForTests();
  cacheArtDocument('actor-fps-timing-art', {
    kind: 'actor-state-animation',
    width: 1,
    height: 1,
    fps: 10,
    frames: [['#ff0000'], ['#00ff00']]
  });

  const frames = withCanvasDocument(() => resolveAnimationFrames({ artRef: 'actor-fps-timing-art' }));

  assert.deepEqual(frames.map((frame) => frame.durationMs), [100, 100]);
});

test('scripted actor transition timers continue during hit pause', () => {
  const actor = makeActor();
  const player = { x: 100, y: 0 };

  actor.updateDuringHitPause(0.5, player, {});

  assert.equal(actor.stateId, 'done');
});

test('scripted actor enters death state before being destroyed', () => {
  const actor = makeDeathActor({ destroyAfterDeath: true });

  actor.damage(3);

  assert.equal(actor.dead, true);
  assert.equal(actor.stateId, 'done');
  assert.equal(actor.solid, false);
  assert.ok(actor.deathTimer > 0);

  actor.updateDeath(1);

  assert.equal(actor.deathTimer, 0);
});

test('scripted actor can remain drawn after death when destroy is disabled', () => {
  const actor = makeDeathActor({ destroyAfterDeath: false });

  actor.damage(3);
  actor.updateDeath(10);

  assert.equal(actor.dead, true);
  assert.equal(actor.stateId, 'done');
  assert.equal(actor.deathTimer, Number.POSITIVE_INFINITY);
});

test('scripted actor death state actions can transition to a corpse state', () => {
  const actor = makeDeathActor({ destroyAfterDeath: false });
  actor.definition.states.push({
    id: 'corpse',
    name: 'Corpse',
    animation: { frames: [], fps: 8 },
    movement: { type: 'none', params: {} },
    overrides: { bodyDamageEnabled: null, contactDamage: null, invulnerable: null },
    collisionZones: null,
    transitions: []
  });
  actor.definition.states[1].transitions = [{
    id: 'death-transition',
    conditionMode: 'all',
    conditions: [{ id: 'always', type: 'always', params: {} }],
    actions: [
      { id: 'burst', type: 'emit-particles', params: { cooldownMs: 100 } },
      { id: 'delay', type: 'delay', params: { ms: 1000 } },
      { id: 'switch', type: 'switch-state', params: { stateId: 'corpse' } }
    ]
  }];
  const emitted = [];

  actor.damage(3);
  for (let i = 0; i < 12; i += 1) {
    actor.updateDeath(0.1, { x: 10, y: 0 }, { emitParticles: (...args) => emitted.push(args) });
  }

  assert.equal(actor.dead, true);
  assert.equal(actor.deathTimer, Number.POSITIVE_INFINITY);
  assert.equal(actor.stateId, 'corpse');
  assert.ok(emitted.length >= 8);
});

test('scripted actor can remain collidable after entering death state', () => {
  const actor = makeDeathActor({ destroyAfterDeath: false, collidableAfterDeath: true });

  actor.damage(3);

  assert.equal(actor.dead, true);
  assert.equal(actor.solid, true);
  assert.equal(actor.isDeadCollidable(), true);
});

test('scripted actor state collision zones override actor zones when present', () => {
  const actor = makeActor();
  actor.definition.states[1].collisionZones = [{ type: 'solid', x: 8, y: 0, width: 8, height: 24 }];
  actor.stateId = 'done';

  const zones = actor.getCollisionZoneRects(['solid']);

  assert.equal(zones.length, 1);
  assert.equal(zones[0].w, 8);
});

test('scripted actor tracks room respawn preference from definition', () => {
  const actor = makeActor();
  actor.definition.respawnOnRoomEntry = false;
  const configured = new ScriptedActor(0, 0, actor.definition);

  assert.equal(configured.respawnOnRoomEntry, false);
});

test('scripted actor health tint scales with missing health', () => {
  const actor = makeActor();
  actor.definition.healthTint = { enabled: true, color: '#ff3333', maxIntensity: 0.6 };
  const configured = new ScriptedActor(0, 0, actor.definition);

  assert.equal(configured.getHealthTintAlpha(), 0);

  configured.health = configured.maxHealth / 2;

  assert.equal(configured.getHealthTintAlpha(), 0.3);
});

test('scripted actor health tint is hidden after death unless configured to persist', () => {
  const actor = makeDeathActor({ destroyAfterDeath: false });
  actor.definition.healthTint = { enabled: true, color: '#ff3333', maxIntensity: 0.1, keepAfterDeath: false };
  const configured = new ScriptedActor(0, 0, actor.definition);

  configured.damage(3);

  assert.equal(configured.getHealthTintAlpha(), 0);

  configured.healthTint.keepAfterDeath = true;

  assert.equal(configured.getHealthTintAlpha(), 0.1);
});

test('scripted actor state can disable health tint', () => {
  const actor = makeActor();
  actor.definition.healthTint = { enabled: true, color: '#ff3333', maxIntensity: 0.5 };
  actor.definition.states[0].disableHealthTint = true;
  const configured = new ScriptedActor(0, 0, actor.definition);
  configured.health = configured.maxHealth / 2;

  assert.equal(configured.getHealthTintAlpha(), 0);
});
