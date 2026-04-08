import test from 'node:test';
import assert from 'node:assert/strict';

import FriendlyCompanion from '../../src/entities/FriendlyCompanion.js';
import { MOVEMENT_MODEL } from '../../src/game/MovementModel.js';

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
  companion.speed = MOVEMENT_MODEL.baseSpeed;
  companion.jumpPower = MOVEMENT_MODEL.baseJumpPower;
  companion.jumpOffsetCache.clear();
  companion.maxAStarMs = 120;
  companion.maxAStarExpansions = 10000;
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

test('friendly companion has boosted base movement speed and jump power', () => {
  const companion = new FriendlyCompanion(0, 0);
  assert.ok(companion.speed > MOVEMENT_MODEL.baseSpeed);
  assert.ok(companion.jumpPower > MOVEMENT_MODEL.baseJumpPower);
});

test('A* traversal prefers flat walking over unnecessary jump arcs', () => {
  const companion = new FriendlyCompanion(0, 0);
  companion.maxAStarMs = 120;
  companion.maxAStarExpansions = 10000;
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
    if (resolver?.name?.includes('getTraversalNeighbors')) {
      if (startTile.x === 5 && startTile.y === 5 && goalTile.x === 4 && goalTile.y === 4) return null;
      return [{ x: 5, y: 5 }, { x: 6, y: 5 }];
    }
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

test('replay planning replans directly to airborne player when that path is shorter than going back to trace', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 8 * 32 + 16, y: 2 * 32 + 16, height: 32, onGround: false, vy: -40, facing: 1 };

  companion.onGround = true;
  companion.playerAirborneFrames = 5;
  companion.jumpReplayLocked = true;
  companion.jumpTraceTile = { x: 2, y: 5 };
  companion.getFootTile = () => ({ x: 6, y: 5 });
  companion.findNearestWalkableTile = (_origin, _world, _abilities, _context, radius) => {
    if (radius === 6) return { x: 8, y: 2 };
    return { x: 6, y: 5 };
  };
  companion.getPriorityTilesAroundPlayer = () => [{ x: 8, y: 2, priority: 1 }];
  companion.buildReplayJumpPath = () => [{ x: 2, y: 5 }, { x: 3, y: 4 }, { x: 4, y: 3 }];
  companion.getAStarPath = (startTile, goalTile, _world, _abilities, _ctx, resolver) => {
    if (resolver?.name?.includes('getWalkingNeighbors')) {
      return [startTile, { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, goalTile];
    }
    if (resolver?.name?.includes('getTraversalNeighbors')) {
      if (startTile.x === 6 && startTile.y === 5) return [startTile, { x: 7, y: 4 }, goalTile];
      return [startTile, goalTile];
    }
    return null;
  };

  companion.planPathToPlayer(player, world, abilities, context);

  assert.deepEqual(companion.currentGoalTile, { x: 8, y: 2 });
  assert.deepEqual(companion.currentPathTiles, [{ x: 6, y: 5 }, { x: 7, y: 4 }, { x: 8, y: 2 }]);
});

test('simulated jump offsets include long running-jump reach on level landing', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const offsets = companion.getSimulatedJumpOffsets(world);
  const hasLongFlatReach = offsets.some((offset) => Math.abs(offset.dx) >= 8 && Math.abs(offset.dy) <= 1);
  assert.equal(hasLongFlatReach, true);
});

test('jump neighbors reject arcs that intersect solid ceiling tiles', () => {
  const companion = new FriendlyCompanion(0, 0);
  const abilities = {};
  const context = {};
  const solids = new Set();
  for (let x = 0; x < 10; x += 1) solids.add(`${x},6`); // floor
  solids.add('3,4'); // low ceiling above start
  const world = {
    width: 10,
    height: 10,
    tileSize: 32,
    isSolid(x, y) {
      return solids.has(`${x},${y}`);
    }
  };

  const neighbors = companion.getJumpingNeighbors({ x: 3, y: 5 }, world, abilities, context);
  const straightUp = neighbors.find((tile) => tile.x === 3 && tile.y < 5);
  assert.equal(Boolean(straightUp), false);
});

test('airborne planning prefers straight-down drop landing as start tile over lateral nearest walkable', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 4 * 32 + 16, y: 5 * 32 + 16, height: 32, onGround: true, vy: 0, facing: 1 };

  companion.onGround = false;
  companion.getFootTile = () => ({ x: 3, y: 3 });
  companion.findNearestWalkableTile = () => ({ x: 1, y: 5 });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 4, y: 5, priority: 1 }];
  let observedStart = null;
  companion.getAStarPath = (startTile, goalTile) => {
    observedStart = startTile;
    return [startTile, goalTile];
  };

  companion.planPathToPlayer(player, world, abilities, context);
  assert.deepEqual(observedStart, { x: 3, y: 5 });
});

test('drop landing path must be vertically clear (no falling through solid tiles)', () => {
  const companion = new FriendlyCompanion(0, 0);
  const abilities = {};
  const context = {};
  const solids = new Set();
  for (let x = 0; x < 10; x += 1) solids.add(`${x},6`);
  solids.add('3,4'); // blocker in drop column
  const world = {
    width: 10,
    height: 10,
    tileSize: 32,
    isSolid(x, y) {
      return solids.has(`${x},${y}`);
    }
  };
  const landing = companion.findDropLandingTile({ x: 3, y: 3 }, world, abilities, context, 8);
  assert.equal(landing, null);
});

test('airborne start can choose lateral nearest landing when it is much closer to player', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 1 * 32 + 16, y: 5 * 32 + 16, height: 32, onGround: true, vy: 0, facing: 1 };

  companion.onGround = false;
  companion.getFootTile = () => ({ x: 3, y: 3 });
  companion.findDropLandingTile = () => ({ x: 3, y: 5 });
  companion.findNearestWalkableTile = () => ({ x: 1, y: 5 });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 1, y: 5, priority: 1 }];
  let observedStart = null;
  companion.getAStarPath = (startTile, goalTile) => {
    observedStart = startTile;
    return [startTile, goalTile];
  };

  companion.planPathToPlayer(player, world, abilities, context);
  assert.deepEqual(observedStart, { x: 1, y: 5 });
});

test('planner picks lower-cost candidate path instead of first valid candidate', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 5 * 32 + 16, y: 5 * 32 + 16, height: 32, onGround: true, vy: 0, facing: 1 };

  companion.onGround = true;
  companion.getFootTile = () => ({ x: 3, y: 5 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [
    { x: 8, y: 5, priority: 1 },
    { x: 4, y: 5, priority: 20 }
  ];
  companion.getAStarPath = (startTile, goalTile) => {
    const path = [{ ...startTile }];
    const step = startTile.x <= goalTile.x ? 1 : -1;
    for (let x = startTile.x + step; x !== goalTile.x + step; x += step) path.push({ x, y: startTile.y });
    return path;
  };

  companion.planPathToPlayer(player, world, abilities, context);
  assert.deepEqual(companion.currentGoalTile, { x: 4, y: 5 });
});

test('planner limits number of candidate A* evaluations per plan pass', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 5 * 32 + 16, y: 5 * 32 + 16, height: 32, onGround: true, vy: 0, facing: 1 };

  companion.maxPathCandidatesPerPlan = 3;
  companion.onGround = true;
  companion.getFootTile = () => ({ x: 3, y: 5 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [
    { x: 0, y: 5, priority: 1 },
    { x: 1, y: 5, priority: 2 },
    { x: 2, y: 5, priority: 3 },
    { x: 3, y: 5, priority: 4 },
    { x: 4, y: 5, priority: 5 },
    { x: 5, y: 5, priority: 6 },
    { x: 6, y: 5, priority: 7 }
  ];
  let calls = 0;
  companion.getAStarPath = () => {
    calls += 1;
    return null;
  };

  companion.planPathToPlayer(player, world, abilities, context);
  assert.equal(calls, 6); // 3 walking + 3 traversal
  assert.ok(companion.noPathStreak > 0);
});

test('planner keeps previous route when new replan has no completed path yet', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 5 * 32 + 16, y: 5 * 32 + 16, height: 32, onGround: true, vy: 0, facing: 1 };

  companion.currentPathTiles = [{ x: 3, y: 5 }, { x: 4, y: 5 }];
  companion.currentGoalTile = { x: 4, y: 5 };
  companion.walkingPathTiles = [{ x: 3, y: 5 }, { x: 4, y: 5 }];
  companion.onGround = true;
  companion.getFootTile = () => ({ x: 3, y: 5 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 5, y: 5, priority: 1 }];
  companion.getAStarPath = () => null;

  companion.planPathToPlayer(player, world, abilities, context);

  assert.deepEqual(companion.currentPathTiles, [{ x: 3, y: 5 }, { x: 4, y: 5 }]);
  assert.deepEqual(companion.currentGoalTile, { x: 4, y: 5 });
});

test('planner marks jump-containing path as jumping path for debug rendering', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 6 * 32 + 16, y: 5 * 32 + 16, height: 32, onGround: true, vy: 0, facing: 1 };

  companion.onGround = true;
  companion.getFootTile = () => ({ x: 3, y: 5 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 6, y: 5, priority: 1 }];
  companion.getAStarPath = () => [{ x: 3, y: 5 }, { x: 4, y: 3 }, { x: 6, y: 5 }];

  companion.planPathToPlayer(player, world, abilities, context);

  assert.deepEqual(companion.walkingPathTiles, []);
  assert.deepEqual(companion.jumpingPathTiles, [{ x: 3, y: 5 }, { x: 4, y: 3 }, { x: 6, y: 5 }]);
});

test('planner falls back to simple hazard-safe walking when repeated replans fail', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const player = { x: 6 * 32 + 16, y: 5 * 32 + 16, height: 32, onGround: true, vy: 0, facing: 1 };

  companion.noPathStreak = 2;
  companion.onGround = true;
  companion.getFootTile = () => ({ x: 3, y: 5 });
  companion.findNearestWalkableTile = (origin) => ({ ...origin });
  companion.getPriorityTilesAroundPlayer = () => [{ x: 6, y: 5, priority: 1 }];
  companion.getAStarPath = () => null;

  companion.planPathToPlayer(player, world, abilities, context);

  assert.ok(companion.currentPathTiles.length > 1);
  assert.deepEqual(companion.currentPathTiles[0], { x: 3, y: 5 });
  assert.deepEqual(companion.currentPathTiles.at(-1), { x: 4, y: 5 });
});

test('A* expands jump edges with intermediate arc tiles for movement steering', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  companion.speed = MOVEMENT_MODEL.baseSpeed;
  companion.jumpPower = MOVEMENT_MODEL.baseJumpPower;
  companion.jumpOffsetCache.clear();
  const expanded = companion.expandPathWithJumpIntermediates(
    [{ x: 5, y: 5 }, { x: 5, y: 3 }],
    world
  );
  assert.ok(expanded.length > 2);
  assert.ok(expanded.some((tile) => tile.y === 4));
});

test('findJumpLandingTileInPath picks first walkable landing from expanded jump path', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const landing = companion.findJumpLandingTileInPath(
    [{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 5 }],
    world,
    abilities,
    context
  );
  assert.deepEqual(landing, { x: 4, y: 5 });
});

test('pruneJumpIntermediateNodesTowardLanding skips non-walkable arc nodes before landing', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  companion.jumpCommitActive = true;
  companion.jumpCommitLandingTile = { x: 4, y: 5 };
  companion.currentPathTiles = [{ x: 3, y: 5 }, { x: 3, y: 4 }, { x: 4, y: 5 }];

  companion.pruneJumpIntermediateNodesTowardLanding(world, abilities, context);

  assert.deepEqual(companion.currentPathTiles, [{ x: 3, y: 5 }, { x: 4, y: 5 }]);
});

test('A* respects expansion budget limit and aborts expensive searches', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const start = { x: 1, y: 5 };
  const goal = { x: 8, y: 5 };

  companion.maxAStarExpansions = 1;
  const path = companion.getAStarPath(start, goal, world, abilities, context);
  assert.equal(path, null);
});

test('A* resumes from cached progress across calls when capped by frame budget', () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const context = {};
  const start = { x: 1, y: 5 };
  const goal = { x: 4, y: 5 };

  companion.maxAStarExpansions = 1;
  companion.maxAStarMs = 100;

  let path = null;
  for (let i = 0; i < 20; i += 1) {
    path = companion.getAStarPath(start, goal, world, abilities, context);
    if (path) break;
  }

  assert.ok(path);
  assert.deepEqual(path.at(-1), goal);
});

test('schedulePlanPathToPlayer runs asynchronously and coalesces to latest request', async () => {
  const companion = new FriendlyCompanion(0, 0);
  const world = createWorld();
  const abilities = {};
  const calls = [];
  companion.planPathToPlayer = (player, queuedWorld) => {
    calls.push({ x: player.x, world: queuedWorld });
  };

  companion.schedulePlanPathToPlayer({ x: 10, y: 0 }, world, abilities, {});
  companion.schedulePlanPathToPlayer({ x: 20, y: 0 }, world, abilities, {});
  assert.equal(calls.length, 0);

  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].x, 20);
  assert.equal(calls[0].world, world);
});
