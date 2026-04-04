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
