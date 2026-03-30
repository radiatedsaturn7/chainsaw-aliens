import test from 'node:test';
import assert from 'node:assert/strict';
import FriendlyCompanion from '../../src/entities/FriendlyCompanion.js';

function createWorld(width, height, solidCells = new Set()) {
  const keyOf = (x, y) => `${x},${y}`;
  return {
    width,
    height,
    tileSize: 32,
    isHazard: () => false,
    isSolid: (x, y, _abilities, opts = {}) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return true;
      if (opts.ignoreOneWay) return solidCells.has(keyOf(x, y));
      return solidCells.has(keyOf(x, y));
    }
  };
}

function buildCRoomWorld() {
  const solids = new Set();
  const add = (x, y) => solids.add(`${x},${y}`);

  // Floor.
  for (let x = 0; x < 20; x += 1) add(x, 10);

  // Single overhead blocker: direct vertical jump is impossible.
  add(10, 7);

  // Goal support ledge.
  add(11, 7);
  add(12, 7);

  return createWorld(20, 14, solids);
}

test('buildPathNeighbors returns de-duplicated neighbors with lateral options', () => {
  const world = buildCRoomWorld();
  const bot = new FriendlyCompanion(0, 0);
  const abilities = {};

  const from = { x: 10, y: 9 };
  const neighbors = bot.buildPathNeighbors(from, world, abilities);
  const keys = neighbors.map((n) => `${n.x},${n.y}`);
  const unique = new Set(keys);
  assert.equal(unique.size, neighbors.length, 'neighbors should be de-duplicated');
  assert.ok(neighbors.some((n) => n.x !== from.x), 'should include at least one lateral option');
});

test('findRouteStepToward chooses detour-friendly first step in C-room case', () => {
  const world = buildCRoomWorld();
  const bot = new FriendlyCompanion(0, 0);
  const abilities = {};

  bot.getFootStandTile = () => ({ x: 10, y: 9 });
  const goal = { x: 12, y: 6 };

  const step = bot.findRouteStepToward(goal, world, abilities);

  assert.ok(step, 'expected a route step to exist');
  assert.notEqual(step.x, 10, `expected first step to move laterally for detour, got (${step.x},${step.y})`);
});

test('detour fallback finds lateral stand tile with headroom', () => {
  const world = buildCRoomWorld();
  const bot = new FriendlyCompanion(0, 0);
  const abilities = {};

  bot.getFootStandTile = () => ({ x: 10, y: 9 });

  const detour = bot.findDetourStandTile({ x: 12, y: 6 }, world, abilities);
  assert.ok(detour, 'expected detour tile');
  assert.notEqual(detour.x, 10, 'detour should move laterally out from under ceiling');
});

test('trace fallback samples recent player tiles and returns first routable step', () => {
  const world = buildCRoomWorld();
  const bot = new FriendlyCompanion(0, 0);

  bot.playerTraceTiles = [{ x: 3, y: 9 }, { x: 5, y: 9 }, { x: 7, y: 9 }];
  bot.findRouteStepToward = (goal) => (goal.x === 7 ? { x: 9, y: 9 } : null);

  const step = bot.findTraceRouteStep(world, {});
  assert.deepEqual(step, { x: 9, y: 9 });
});

test('player trace recording is capped to configured history length', () => {
  const world = buildCRoomWorld();
  const bot = new FriendlyCompanion(0, 0);
  const abilities = {};
  const player = { x: 0, y: 0, width: 32, height: 32 };

  for (let i = 0; i < 220; i += 1) {
    player.x = ((i % 18) + 1) * world.tileSize;
    player.y = 9 * world.tileSize;
    bot.recordPlayerTraceTile(player, world, abilities, 0.1);
  }

  assert.ok(bot.playerTraceTiles.length <= bot.playerTraceMax);
  assert.equal(bot.playerTraceMax, 120);
});

test('trace routing probes next trace node first, then reverse-binary fallbacks', () => {
  const world = buildCRoomWorld();
  const bot = new FriendlyCompanion(0, 0);
  bot.playerTraceTiles = [
    { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 },
    { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 }
  ];
  bot.getFootStandTile = () => ({ x: 4, y: 9 }); // nearest index = 2, primary should be index 3.

  const attempted = [];
  bot.findRouteStepToward = (goal) => {
    attempted.push(goal.x);
    return null;
  };

  bot.findTraceRouteStep(world, {});
  assert.equal(attempted[0], 5);
  assert.equal(attempted[1], 7);
});
