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

  const flatWorld = mkWorld([
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '#############',
    '#############'
  ]);

  // 1) same-surface follow remains direct
  const sameSurfaceCompanion = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  assert.strictEqual(sameSurfaceCompanion.shouldUseDirectFollow({ x: 4, y: 4, align: 'center' }, flatWorld, {}), true);

  // 2) route to one-platform higher ledge: takeoff then launch
  const ledgeCompanion = new FriendlyCompanion((1.5) * tileSize, (5.5) * tileSize);
  const jumpPath = [{
    tile: { x: 3, y: 4, align: 'center' },
    edge: {
      profile: { type: 'shortHopForward' },
      sourceTile: { x: 2, y: 5, align: 'center' },
      targetTile: { x: 3, y: 4, align: 'center' },
      transitionType: 'shortHop'
    }
  }];
  const prepMove = ledgeCompanion.chooseMoveFromPath(jumpPath, flatWorld);
  assert.strictEqual(prepMove.edge.executionStage, 'takeoff-prep');
  assert.deepStrictEqual(prepMove.nextTile, { x: 2, y: 5, align: 'center' });
  ledgeCompanion.x = (2.5) * tileSize;
  ledgeCompanion.y = (5.5) * tileSize;
  const launchMove = ledgeCompanion.chooseMoveFromPath(jumpPath, flatWorld);
  assert.strictEqual(launchMove.edge.executionStage, 'launch');

  // 3) upward pursuit toggles on player ascent nearby
  const pursuitCompanion = new FriendlyCompanion((5.5) * tileSize, (5.5) * tileSize);
  const risingPlayer = { x: 6.5 * tileSize, y: 3.8 * tileSize, vy: -220, justJumped: true, onGround: false, height: 34, facing: 1 };
  pursuitCompanion.updateUpwardPursuitState(0.016, risingPlayer, { x: 5, y: 5, align: 'center' }, { x: 6, y: 3, align: 'center' });
  assert.ok(pursuitCompanion.navState.upwardPursuitTimer > 0.5, 'expected upward pursuit timer to activate');

  // 4) short obstacle/ledge requiring jump gets a valid upward edge
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
  const obstacleCompanion = new FriendlyCompanion((2.5) * tileSize, (5.5) * tileSize);
  const jumpEdge = obstacleCompanion.validateMovementEdge({ x: 2, y: 5, align: 'center' }, { x: 3, y: 4, align: 'center' }, stepWorld, {});
  assert.ok(jumpEdge && jumpEdge.ok, 'expected jump edge over obstacle to be valid');

  // 5) jump route commitment survives tiny drift
  const driftCompanion = new FriendlyCompanion(160, 160);
  driftCompanion.moveExecution = {
    active: true,
    profile: 'shortHopForward',
    phase: 'takeoff-prep',
    elapsed: 0.04,
    hold: 0.2,
    lockDirection: 1,
    sourceNode: { x: 4, y: 5, align: 'center' },
    targetNode: { x: 5, y: 5, align: 'center' }
  };
  const restart = driftCompanion.shouldRestartExecution(
    driftCompanion.moveExecution,
    { x: 4, y: 5, align: 'center' },
    { nextTile: { x: 6, y: 4, align: 'center' } },
    'diagJump',
    false
  );
  assert.strictEqual(restart, false, 'jump commitment should survive tiny drift/profile shift');

  // 6) no pacing-state explosion by align variants in global key
  assert.strictEqual(obstacleCompanion.tileKey({ x: 5, y: 5, align: 'left' }), obstacleCompanion.tileKey({ x: 5, y: 5, align: 'right' }));

  // 7) teleport fallback still works at true long distance
  const teleportWorld = mkWorld([
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '#############',
    '#############'
  ]);
  const teleportCompanion = new FriendlyCompanion((1.5) * tileSize, (5.5) * tileSize);
  const farPlayer = {
    x: 50 * tileSize,
    y: 5 * tileSize,
    vy: 0,
    justJumped: false,
    onGround: true,
    height: 34,
    facing: 1
  };
  teleportCompanion.update(0.016, teleportWorld, {}, { player: farPlayer, enemies: [], boss: null });
  assert.ok(Math.abs(teleportCompanion.x - (farPlayer.x - 26)) < tileSize, 'expected companion to teleport near far player');

  console.log('FriendlyCompanion nav tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
