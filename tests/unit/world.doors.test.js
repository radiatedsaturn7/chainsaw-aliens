import test from 'node:test';
import assert from 'node:assert/strict';

import World from '../../src/world/World.js';

test('normalizes oversized vertical door columns into two doors with a wall span between them', () => {
  const world = new World();
  const width = 24;
  const height = 24;
  const rows = Array.from({ length: height }, () => '#'.repeat(width).split(''));

  for (let y = 2; y < 22; y += 1) {
    for (let x = 2; x < 8; x += 1) rows[y][x] = '.';
    for (let x = 16; x < 22; x += 1) rows[y][x] = '.';
  }
  for (let y = 4; y < 20; y += 1) {
    for (let x = 10; x < 14; x += 1) rows[y][x] = 'D';
  }

  world.applyData({
    schemaVersion: 1,
    tileSize: 32,
    width,
    height,
    spawn: { x: 5, y: 12 },
    tiles: rows.map((row) => row.join('')),
    regions: []
  });

  for (let y = 4; y <= 5; y += 1) {
    for (let x = 10; x <= 13; x += 1) assert.equal(world.getTile(x, y), 'D');
  }
  for (let y = 6; y <= 17; y += 1) {
    for (let x = 10; x <= 13; x += 1) assert.equal(world.getTile(x, y), '#');
  }
  for (let y = 18; y <= 19; y += 1) {
    for (let x = 10; x <= 13; x += 1) assert.equal(world.getTile(x, y), 'D');
  }
});
