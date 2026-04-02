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
    roomAtTile() {
      return 0;
    },
    isSolid(x, y, _abilities, options = {}) {
      const t = this.getTile(x, y);
      if (t === '#') return true;
      if (t === '-') return !options.ignoreOneWay;
      return false;
    }
  });

  // 1) same-platform follow still works
  const flatWorld = mkWorld([
    '........',
    '........',
    '........',
    '........',
    '........',
    '########',
    '########'
  ]);
  const c1 = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  assert.strictEqual(c1.shouldUseDirectFollow({ x: 4, y: 4, align: 'center' }, flatWorld, {}), true);

  // 2) route chooses takeoff first, then launch toward landing
  const c2 = new FriendlyCompanion((1.5) * tileSize, (5.5) * tileSize);
  const jumpPath = [{
    tile: { x: 3, y: 4, align: 'center' },
    edge: {
      profile: { type: 'shortHopForward' },
      sourceTile: { x: 2, y: 5, align: 'center' },
      targetTile: { x: 3, y: 4, align: 'center' },
      transitionType: 'shortHop'
    }
  }];
  const prepMove = c2.chooseMoveFromPath(jumpPath, flatWorld);
  assert.strictEqual(prepMove.edge.executionStage, 'takeoff-prep');
  assert.deepStrictEqual(prepMove.nextTile, { x: 2, y: 5, align: 'center' });
  c2.x = (2.5) * tileSize;
  c2.y = (5.5) * tileSize;
  const launchMove = c2.chooseMoveFromPath(jumpPath, flatWorld);
  assert.strictEqual(launchMove.edge.executionStage, 'launch');
  assert.deepStrictEqual(launchMove.nextTile, { x: 3, y: 4, align: 'center' });

  // 3) validated jump edge remains valid and is not keyed by align variants
  const c3 = new FriendlyCompanion((2.5) * tileSize, (5.5) * tileSize);
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
  const jumpEdge = c3.validateMovementEdge({ x: 2, y: 5, align: 'left' }, { x: 3, y: 4, align: 'right' }, stepWorld, {});
  assert.ok(jumpEdge && jumpEdge.ok, 'expected adjacent upward jump edge to be valid');
  assert.strictEqual(c3.tileKey({ x: 2, y: 5, align: 'left' }), c3.tileKey({ x: 2, y: 5, align: 'right' }));

  // 4) jump execution is not canceled by tiny drift during takeoff/launch
  const c4 = new FriendlyCompanion(160, 160);
  c4.moveExecution = {
    active: true,
    profile: 'shortHopForward',
    phase: 'takeoff-prep',
    elapsed: 0.04,
    hold: 0.2,
    lockDirection: 1,
    sourceNode: { x: 4, y: 5, align: 'center' },
    targetNode: { x: 5, y: 5, align: 'center' }
  };
  const restart = c4.shouldRestartExecution(
    c4.moveExecution,
    { x: 4, y: 5, align: 'center' },
    { nextTile: { x: 6, y: 4, align: 'center' } },
    'diagJump',
    false
  );
  assert.strictEqual(restart, false, 'jump commitment should survive tiny drift/profile shift');

  // 5) a single bad attempt should not poison an otherwise valid jump edge
  const c5 = new FriendlyCompanion(0, 0);
  const from = { x: 2, y: 5, align: 'center' };
  const to = { x: 3, y: 4, align: 'center' };
  c5.markEdgeFailure(from, to, 'diagJump');
  assert.strictEqual(c5.isEdgePoisoned(from, to, 'diagJump'), false, 'single jump failure should not poison edge');

  console.log('FriendlyCompanion nav tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
