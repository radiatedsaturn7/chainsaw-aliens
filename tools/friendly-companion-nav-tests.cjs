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

  // A) Reachable upper platform requiring lateral detour.
  const detourWorld = mkWorld([
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '........###..',
    '#############',
    '.............',
    '#############'
  ]);
  const detourCompanion = new FriendlyCompanion((2.5) * tileSize, (5.5) * tileSize);
  const detourRoute = detourCompanion.findTraversalRoute(
    { x: 2, y: 5, align: 'center' },
    { x: 9, y: 4, align: 'center' },
    detourWorld,
    {}
  );
  assert.ok(detourRoute.route.length > 0, 'expected non-empty route to upper platform');
  const upwardEdge = detourRoute.route.find((edge) => edge.targetTile?.y < edge.sourceTile?.y);
  assert.ok(upwardEdge, 'expected route with explicit upward transition');
  assert.ok(upwardEdge.sourceTile.x >= 6, 'expected lateral approach before jump takeoff');

  // B) Distinct surfaces must not be merged by diagonal corner touching.
  const diagonalWorld = mkWorld([
    '......',
    '......',
    '..#...',
    '...#..',
    '......',
    '######'
  ]);
  const diagonalCompanion = new FriendlyCompanion((2.5) * tileSize, (1.5) * tileSize);
  const diagonalRoute = diagonalCompanion.findTraversalRoute(
    { x: 2, y: 1, align: 'center' },
    { x: 3, y: 2, align: 'center' },
    diagonalWorld,
    {}
  );
  assert.notStrictEqual(diagonalRoute.startSurface, diagonalRoute.goalSurface, 'diagonal corner tiles should not be same surface');

  // C) No direct-follow downgrade during elevated detour pursuit.
  const climbingCompanion = new FriendlyCompanion((2.5) * tileSize, (5.5) * tileSize);
  const elevatedPlayer = {
    x: 9.5 * tileSize,
    y: 4.5 * tileSize,
    vy: -180,
    justJumped: true,
    onGround: false,
    height: 34,
    facing: 1
  };
  const nav = climbingCompanion.updateNavigation(0.016, elevatedPlayer, detourWorld, {});
  assert.notStrictEqual(nav.mode, 'direct', 'should stay routed/climb mode when elevated detour is needed');

  // D) Avoid pacing directly underneath a reachable elevated player.
  const routeAttempted = climbingCompanion.navDebug.routeKind === 'surface-graph' || climbingCompanion.navState.mode === 'astar';
  assert.ok(routeAttempted, 'expected routing mode rather than trivial pacing mode');
  assert.ok(
    climbingCompanion.navDebug.upwardPursuitActive || climbingCompanion.navDebug.obstacleForcedClimb || climbingCompanion.navState.path.length > 0,
    'expected meaningful climb pursuit signal instead of flat direct pacing'
  );

  // E) Same-surface follow still behaves reasonably.
  const flatWorld = mkWorld([
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '#############',
    '#############'
  ]);
  const sameSurfaceCompanion = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  assert.strictEqual(sameSurfaceCompanion.shouldUseDirectFollow({ x: 4, y: 4, align: 'center' }, flatWorld, {}), true);

  // F) Teleport fallback still works when truly far away.
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
  teleportCompanion.update(0.016, flatWorld, {}, { player: farPlayer, enemies: [], boss: null });
  assert.ok(Math.abs(teleportCompanion.x - (farPlayer.x - 26)) < tileSize, 'expected companion to teleport near far player');

  console.log('FriendlyCompanion nav tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
