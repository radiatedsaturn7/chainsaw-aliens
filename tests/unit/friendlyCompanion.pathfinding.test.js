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
