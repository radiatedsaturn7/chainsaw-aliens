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

  // 1) Settled near-player behavior: no left-right oscillation when already close.
  const settledCompanion = new FriendlyCompanion((5.5) * tileSize, (4.5) * tileSize);
  const idlePlayer = {
    x: 5.5 * tileSize,
    y: 4.5 * tileSize,
    vx: 0,
    vy: 0,
    justJumped: false,
    onGround: true,
    height: 34,
    facing: 1
  };
  const settleTarget = settledCompanion.buildNavigationTarget(idlePlayer, flatWorld, {});
  settledCompanion.x = settleTarget.world.x;
  settledCompanion.y = settleTarget.world.y;
  const navA = settledCompanion.updateNavigation(0.016, idlePlayer, flatWorld, {});
  const navB = settledCompanion.updateNavigation(0.016, idlePlayer, flatWorld, {});
  const navC = settledCompanion.updateNavigation(0.016, idlePlayer, flatWorld, {});
  const dirA = navA.input.has('left') ? -1 : navA.input.has('right') ? 1 : 0;
  const dirB = navB.input.has('left') ? -1 : navB.input.has('right') ? 1 : 0;
  const dirC = navC.input.has('left') ? -1 : navC.input.has('right') ? 1 : 0;
  assert.ok(!(dirA === -dirB && dirA !== 0), 'expected no immediate left/right oscillation near rest');
  assert.ok(!(dirB === -dirC && dirB !== 0), 'expected no persistent oscillation while anchored');
  assert.ok(settledCompanion.navDebug.restModeActive || settledCompanion.navDebug.settledActive, 'expected anchored rest mode near player');

  // 2) Sticky follow target: tiny player jitter should not flap follow tile every frame.
  const stickyCompanion = new FriendlyCompanion((3.5) * tileSize, (4.5) * tileSize);
  const basePlayer = {
    x: 6.5 * tileSize,
    y: 4.5 * tileSize,
    vx: 0,
    vy: 0,
    justJumped: false,
    onGround: true,
    height: 34,
    facing: 1
  };
  const t1 = stickyCompanion.buildNavigationTarget(basePlayer, flatWorld, {}).tile;
  const t2 = stickyCompanion.buildNavigationTarget({ ...basePlayer, x: basePlayer.x + 3 }, flatWorld, {}).tile;
  const t3 = stickyCompanion.buildNavigationTarget({ ...basePlayer, x: basePlayer.x - 3 }, flatWorld, {}).tile;
  assert.strictEqual(`${t1.x},${t1.y}`, `${t2.x},${t2.y}`);
  assert.strictEqual(`${t2.x},${t2.y}`, `${t3.x},${t3.y}`);

  // 3) Invalid jump suppression: stale takeoff context cancels jump profile.
  const staleJumpCompanion = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  staleJumpCompanion.navState.noProgressTimer = 0.4;
  const staleMove = {
    target: { x: 9.5 * tileSize, y: 3.5 * tileSize },
    nextTile: { x: 9, y: 3, align: 'center' },
    edge: {
      profile: { type: 'diagJump' },
      takeoffTile: { x: 9, y: 4, align: 'center' },
      landingTile: { x: 9, y: 3, align: 'center' }
    }
  };
  const staleResult = staleJumpCompanion.applyMoveIntent(staleMove, staleMove.target, flatWorld, {}, 0.016);
  assert.strictEqual(staleResult.profile, 'replan', 'expected stale jump context to be canceled and replanned');

  // 4) No useless bounce: jump guard blocks meaningless bounce under elevated target when takeoff invalid.
  const bounceCompanion = new FriendlyCompanion((5.5) * tileSize, (4.5) * tileSize);
  bounceCompanion.navState.jumpLoopCounter = 2;
  const bounceExecution = {
    profile: 'diagJump',
    phase: 'travel',
    lockDirection: 1,
    elapsed: 0,
    hold: 0,
    takeoffTile: { x: 8, y: 4, align: 'center' }
  };
  const bounceInput = bounceCompanion.buildExecutionIntent(bounceExecution, 1, -40, flatWorld, 0.016);
  assert.strictEqual(bounceInput.has('jump'), false, 'expected jump suppression for useless bounce context');

  // 5) Forced climb flag alone must not cause blind hopping.
  const forcedClimbCompanion = new FriendlyCompanion((4.5) * tileSize, (4.5) * tileSize);
  forcedClimbCompanion.navState.forcedClimbTriggered = true;
  forcedClimbCompanion.navState.forcedClimbJumpAllowed = false;
  const noBlindHop = forcedClimbCompanion.buildExecutionIntent(
    { profile: 'walk', phase: 'travel', lockDirection: 1, elapsed: 0, hold: 0 },
    18,
    -12,
    flatWorld,
    0.016
  );
  assert.strictEqual(noBlindHop.has('jump'), false, 'forced climb without route evidence must not inject jump');

  // 6) Same-surface follow still works at moderate distance.
  const followCompanion = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  assert.strictEqual(followCompanion.shouldUseDirectFollow({ x: 6, y: 4, align: 'center' }, flatWorld, {}), true);

  // 7) Teleport fallback still works when truly far away.
  const teleportCompanion = new FriendlyCompanion((1.5) * tileSize, (4.5) * tileSize);
  const farPlayer = {
    x: 50 * tileSize,
    y: 5 * tileSize,
    vx: 0,
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
