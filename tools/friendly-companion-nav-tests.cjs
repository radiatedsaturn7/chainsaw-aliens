const assert = require('assert');

async function run() {
  const mod = await import('../src/entities/FriendlyCompanion.js');
  const FriendlyCompanion = mod.default;

  const tileSize = 32;
  const mkWorld = (tiles) => ({
    tileSize,
    width: tiles[0].length,
    height: tiles.length,
    elevatorPaths: [],
    elevators: [],
    getTile(x, y) {
      if (x < 0 || y < 0 || y >= tiles.length || x >= tiles[0].length) return '#';
      return tiles[y][x];
    },
    isOneWay(x, y) {
      return this.getTile(x, y) === '-';
    },
    isHazard() {
      return false;
    },
    isSolid(x, y, _abilities, options = {}) {
      const t = this.getTile(x, y);
      if (t === '#') return true;
      if (t === '-') return !options.ignoreOneWay;
      return false;
    }
  });

  // 1) companion can jump to adjacent higher platform
  const stepWorld = mkWorld([
    '........',
    '........',
    '........',
    '........',
    '........',
    '...#....',
    '########',
    '########'
  ]);
  const c1 = new FriendlyCompanion((2.5) * tileSize, (5.5) * tileSize);
  const jumpEdge = c1.validateMovementEdge({ x: 2, y: 5, align: 'center' }, { x: 3, y: 4, align: 'center' }, stepWorld, {});
  assert.ok(jumpEdge && jumpEdge.ok, 'expected adjacent upward jump edge to be valid');

  // 2) no oscillation between equivalent neighboring states (global key ignores align)
  const c2 = new FriendlyCompanion(0, 0);
  assert.strictEqual(c2.tileKey({ x: 4, y: 8, align: 'left' }), c2.tileKey({ x: 4, y: 8, align: 'right' }));

  // 3) jump execution should not restart for tiny target drift
  const c3 = new FriendlyCompanion(160, 160);
  c3.moveExecution = {
    active: true,
    profile: 'diagJump',
    phase: 'launch',
    elapsed: 0.03,
    hold: 0.2,
    lockDirection: 1,
    sourceNode: { x: 4, y: 5, align: 'center' },
    targetNode: { x: 6, y: 4, align: 'center' }
  };
  const restart = c3.shouldRestartExecution(
    c3.moveExecution,
    { x: 4, y: 5, align: 'center' },
    { nextTile: { x: 7, y: 4, align: 'center' } },
    'shortHopForward',
    false
  );
  assert.strictEqual(restart, false, 'tiny jump target drift should keep execution committed');

  // 4) direct follow still applies on same platform
  const flatWorld = mkWorld([
    '........',
    '........',
    '........',
    '........',
    '........',
    '########',
    '########'
  ]);
  const c4 = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  assert.strictEqual(c4.shouldUseDirectFollow({ x: 4, y: 4, align: 'center' }, flatWorld, {}), true);

  console.log('FriendlyCompanion nav tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
