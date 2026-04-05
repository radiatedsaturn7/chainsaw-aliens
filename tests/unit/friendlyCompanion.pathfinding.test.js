import test from 'node:test';
import assert from 'node:assert/strict';

import FriendlyCompanion from '../../src/entities/FriendlyCompanion.js';

function createWorld() {
  const solid = new Set();
  const setSolid = (x, y) => solid.add(`${x},${y}`);
  for (let x = 0; x < 10; x += 1) setSolid(x, 6);
  setSolid(5, 5);
  setSolid(5, 4);
  return {
    width: 10,
    height: 10,
    tileSize: 32,
    isSolid(x, y) {
      return solid.has(`${x},${y}`);
    }
  };
}

test('A* traversal can use jump neighbors to reach elevated goals', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const start = { x: 2, y: 5 };
  const goal = { x: 5, y: 3 };

  const walkingOnlyPath = companion.getAStarPath(
    start,
    goal,
    world,
    abilities,
    context,
    companion.getWalkingNeighbors.bind(companion)
  );
  assert.equal(walkingOnlyPath, null);

  const traversalPath = companion.getAStarPath(start, goal, world, abilities, context);
  assert.ok(traversalPath);
  assert.deepEqual(traversalPath.at(-1), goal);
});

test('A* traversal prefers flat walking over unnecessary jump arcs', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const start = { x: 1, y: 5 };
  const goal = { x: 4, y: 5 };

  const traversalPath = companion.getAStarPath(start, goal, world, abilities, context);
  assert.ok(traversalPath);
  assert.equal(traversalPath[0].y, 5);
  assert.equal(traversalPath.at(-1).y, 5);
  assert.ok(traversalPath.every((tile) => tile.y === 5));
});

test('planPathToPlayer evaluates walking paths before traversal paths', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 64, y: 160, height: 32, onGround: true, facing: 1 };

  companion.getFootTile = () => ({ x: 1, y: 5 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 2, y: 5, priority: 1 }];

  let traversalCalled = false;
  companion.getAStarPath = (startTile, goalTile, _world, _abilities, _ctx, resolver) => {
    if (resolver?.name?.includes('getWalkingNeighbors')) return [startTile, goalTile];
    if (resolver?.name?.includes('getTraversalNeighbors')) {
      traversalCalled = true;
      return [startTile, goalTile];
    }
    return null;
  };

  companion.planPathToPlayer(player, world, abilities, context);

  assert.equal(traversalCalled, false);
  assert.deepEqual(
    companion.currentPathTiles.map((tile) => ({ x: tile.x, y: tile.y })),
    [{ x: 1, y: 5 }, { x: 2, y: 5 }]
  );
});

test('buildReplayJumpPath keeps straight-up jumps centered despite tiny horizontal drift', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  companion.jumpTraceTile = { x: 5, y: 5 };
  companion.playerJumpStart = { x: 176, y: 176 };
  companion.playerJumpSamples = [
    { x: 176, y: 176 },
    { x: 179, y: 170 },
    { x: 178, y: 164 }
  ];

  const replayPath = companion.buildReplayJumpPath(world);
  assert.ok(replayPath.length > 0);
  assert.ok(replayPath.every((tile) => tile.x === 5));
});

test('airborne replay prefers sampled replay path before traversal A* path', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 128, y: 130, height: 32, onGround: false, facing: 1 };

  companion.onGround = true;
  companion.playerAirborneFrames = 3;
  companion.jumpTraceTile = { x: 5, y: 5 };
  companion.getFootTile = () => ({ x: 5, y: 5 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 5, y: 5, priority: 1 }];
  companion.buildReplayJumpPath = () => [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }];

  companion.getAStarPath = (startTile, goalTile, _world, _abilities, _ctx, resolver) => {
    if (resolver?.name?.includes('getWalkingNeighbors')) return [startTile, goalTile];
    if (resolver?.name?.includes('getTraversalNeighbors')) return [{ x: 5, y: 5 }, { x: 6, y: 5 }];
    return null;
  };

  companion.planPathToPlayer(player, world, abilities, context);
  assert.deepEqual(companion.jumpingPathTiles, [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }]);
});

test('planner treats supported non-descending player as grounded even if onGround is false', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = {
    width: 10,
    height: 10,
    tileSize: 32,
    isSolid(x, y) {
      return x === 3 && y === 5;
    }
  };
  const abilities = {};
  const context = {};
  const player = { x: 95, y: 160, width: 22, height: 34, onGround: false, vy: 8, facing: 1 };

  companion.playerAirborneFrames = 10;
  companion.jumpTraceTile = { x: 5, y: 5 };
  companion.getFootTile = () => ({ x: 3, y: 4 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 3, y: 4, priority: 1 }];
  companion.getAStarPath = () => [{ x: 3, y: 4 }];

  companion.planPathToPlayer(player, world, abilities, context);

  assert.deepEqual(companion.jumpingPathTiles, []);
  assert.deepEqual(
    companion.currentPathTiles.map((tile) => ({ x: tile.x, y: tile.y })),
    [{ x: 3, y: 4 }]
  );
});

test('clearJumpReplayState resets replay lock and sampled jump traces', () => {
  const companion = new FriendlyCompanion(0, 0);
  companion.jumpReplayLocked = true;
  companion.jumpReplayLockTimer = 1.2;
  companion.companionReplayAirborneSeen = true;
  companion.jumpTraceTile = { x: 4, y: 6 };
  companion.playerJumpStart = { x: 100, y: 120 };
  companion.playerJumpSamples = [{ x: 1, y: 2 }];
  companion.playerJumpTriggerFrames = [0, 3];

  companion.clearJumpReplayState();

  assert.equal(companion.jumpReplayLocked, false);
  assert.equal(companion.jumpReplayLockTimer, 0);
  assert.equal(companion.companionReplayAirborneSeen, false);
  assert.equal(companion.jumpTraceTile, null);
  assert.equal(companion.playerJumpStart, null);
  assert.deepEqual(companion.playerJumpSamples, []);
  assert.deepEqual(companion.playerJumpTriggerFrames, []);
});

test('airborne companion targets player mid-air directly instead of returning to jump trace', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 8 * 32 + 16, y: 2 * 32 + 16, height: 32, onGround: false, vy: -20, facing: 1 };

  companion.onGround = false;
  companion.playerAirborneFrames = 5;
  companion.jumpTraceTile = { x: 5, y: 5 };
  companion.getFootTile = () => ({ x: 6, y: 3 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 8, y: 2, priority: 1 }];

  companion.planPathToPlayer(player, world, abilities, context);

  assert.deepEqual(companion.currentGoalTile, { x: 8, y: 2 });
  assert.deepEqual(companion.currentPathTiles, [{ x: 6, y: 3 }, { x: 8, y: 2 }]);
  assert.deepEqual(companion.jumpingPathTiles, [{ x: 6, y: 3 }, { x: 8, y: 2 }]);
});
