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

  const staircaseWorld = mkWorld([
    '...............',
    '...............',
    '...............',
    '.....#.........',
    '......#...##...',
    '.......#.......',
    '###############',
    '###############'
  ]);

  const upperRouteWorld = mkWorld([
    '..........',
    '..........',
    '....###...',
    '...#......',
    '..#.......',
    '.#........',
    '##########',
    '##########'
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
  assert.ok(Math.abs(dirA) + Math.abs(dirB) + Math.abs(dirC) <= 1, 'expected minimal correction near rest');

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

  // 3) Launch tolerance band: near takeoff should launch instead of endless micro-correct.
  const launchBandCompanion = new FriendlyCompanion((4.9) * tileSize, (4.5) * tileSize);
  const launchMove = launchBandCompanion.chooseMoveFromPath([{
    tile: { x: 7, y: 3, align: 'center' },
    edge: {
      profile: { type: 'paramJump', signature: 'pj:test' },
      sourceTile: { x: 5, y: 4, align: 'center' },
      targetTile: { x: 7, y: 3, align: 'center' },
      transitionType: 'jumpArc'
    }
  }], flatWorld);
  assert.strictEqual(launchMove.edge.executionStage, 'launch', 'expected launch when inside takeoff tolerance band');

  // 4) Invalid jump suppression: stale takeoff context cancels jump profile.
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

  // 5) Stair/walk ascent should beat useless vertical jump via route cost model.
  const costCompanion = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  const walkCost = costCompanion.traversalEdgeCost('walk', { x: 2, y: 5 }, { x: 3, y: 5 });
  const verticalJumpCost = costCompanion.traversalEdgeCost('jumpArc', { x: 2, y: 5 }, { x: 2, y: 4 });
  assert.ok(walkCost < verticalJumpCost, 'expected grounded stair/walk progress to be preferred over vertical hop');

  // 6) Broader jump-family generation includes param variants and double-jump timing options.
  const familyCompanion = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  const families = familyCompanion.buildEdgeProfiles({ x: 2, y: 5, align: 'center' }, { x: 6, y: 2, align: 'center' }, flatWorld);
  const paramFamilies = families.filter((p) => p.type === 'paramJump');
  assert.ok(paramFamilies.length >= 4, 'expected multiple parameterized jump variants');
  assert.ok(paramFamilies.some((p) => p.secondJumpAt != null), 'expected second-jump timing variants for tall climbs');

  // 7) Penalize useless jump families after repeated no-progress failures.
  familyCompanion.markEdgeFailure({ x: 2, y: 5, align: 'center' }, { x: 6, y: 2, align: 'center' }, 'pj:test-family');
  familyCompanion.markEdgeFailure({ x: 2, y: 5, align: 'center' }, { x: 6, y: 2, align: 'center' }, 'pj:test-family');
  familyCompanion.markEdgeFailure({ x: 2, y: 5, align: 'center' }, { x: 6, y: 2, align: 'center' }, 'pj:test-family');
  assert.strictEqual(
    familyCompanion.isEdgePoisoned({ x: 2, y: 5, align: 'center' }, { x: 6, y: 2, align: 'center' }, 'pj:test-family'),
    true,
    'expected repeated useless jump family to be suppressed'
  );

  // 8) No useless bounce: jump guard blocks meaningless bounce under elevated target when takeoff invalid.
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

  // 9) Forced climb flag alone must not cause blind hopping.
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

  // 10) Same-surface follow still works at moderate distance.
  const followCompanion = new FriendlyCompanion((2.5) * tileSize, (4.5) * tileSize);
  assert.strictEqual(followCompanion.shouldUseDirectFollow({ x: 6, y: 4, align: 'center' }, flatWorld, {}), true);

  // 11) Teleport fallback still works when truly far away.
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

  // 12) Integration: staircase lateral ascent should beat local pogo under elevated target.
  const stairCompanion = new FriendlyCompanion(10.5 * tileSize, 5.5 * tileSize);
  const stairPlayer = {
    x: 5.5 * tileSize,
    y: 2.5 * tileSize,
    vx: 0,
    vy: 0,
    justJumped: false,
    onGround: true,
    height: 34,
    facing: -1
  };
  let jumpFrames = 0;
  for (let i = 0; i < 70; i += 1) {
    stairCompanion.update(1 / 60, staircaseWorld, {}, { player: stairPlayer, enemies: [], boss: null });
    if (stairCompanion.aiInput.isDown('jump')) jumpFrames += 1;
  }
  assert.ok(jumpFrames < 24, 'expected staircase pursuit to avoid prolonged pogo jump looping');

  // 13) No second jump after useless first jump: grounded recovery lock suppresses immediate jump reuse.
  const noSecondJumpCompanion = new FriendlyCompanion(8.5 * tileSize, 5.5 * tileSize);
  const noSecondPlayer = { ...idlePlayer, x: 11.5 * tileSize, y: 3.5 * tileSize, facing: 1 };
  noSecondJumpCompanion.navState.jumpInFlight = true;
  noSecondJumpCompanion.navState.jumpStartTile = noSecondJumpCompanion.getFootStandTile(flatWorld);
  noSecondJumpCompanion.navState.jumpLandingTile = noSecondJumpCompanion.getFootStandTile(flatWorld);
  noSecondJumpCompanion.navState.jumpRouteDistanceBefore = 4.5;
  noSecondJumpCompanion.moveExecution.profile = 'verticalJump';
  noSecondJumpCompanion.justLanded = true;
  noSecondJumpCompanion.updateNavigation(0.016, noSecondPlayer, flatWorld, {});
  const recoveryNav = noSecondJumpCompanion.updateNavigation(0.016, noSecondPlayer, flatWorld, {});
  assert.strictEqual(recoveryNav.input.has('jump'), false, 'expected grounded recovery to suppress immediate second jump');
  assert.ok(noSecondJumpCompanion.navDebug.groundedRecoveryActive, 'expected grounded recovery mode after useless jump');

  // 14) Integration: no second jump after no-progress landing context.
  const pogoCompanion = new FriendlyCompanion(8.5 * tileSize, 5.5 * tileSize);
  const sourceTile = pogoCompanion.getFootStandTile(flatWorld);
  const landingTile = { x: sourceTile.x, y: sourceTile.y - 1, align: 'center' };
  pogoCompanion.markJumpContextBlocked(sourceTile, landingTile, 'verticalJump', 0.9);
  const blockedMove = {
    target: pogoCompanion.tileCenter(landingTile, flatWorld),
    nextTile: landingTile,
    edge: { profile: { type: 'verticalJump' }, takeoffTile: sourceTile, landingTile }
  };
  const blockedResult = pogoCompanion.applyMoveIntent(blockedMove, blockedMove.target, flatWorld, {}, 0.016);
  assert.strictEqual(blockedResult.profile, 'replan', 'expected blocked no-progress jump context to prevent immediate second jump');

  // 15) Route/execution fidelity: selected jump edge should preserve takeoff metadata.
  const fidelityCompanion = new FriendlyCompanion(9.5 * tileSize, 5.5 * tileSize);
  const fidelityStart = { x: 9, y: 5, align: 'center' };
  const fidelityGoal = { x: 6, y: 3, align: 'center' };
  const fidelityPlan = fidelityCompanion.findTraversalRoute(fidelityStart, fidelityGoal, staircaseWorld, {});
  if (fidelityPlan.route.length) {
    const fidelitySegments = fidelityCompanion.buildSegmentsFromTraversalRoute(fidelityPlan.route, fidelityGoal);
    const nextMove = fidelityCompanion.chooseMoveFromPath(fidelitySegments, staircaseWorld);
    if (fidelityCompanion.isJumpTransitionEdge(nextMove?.edge)) {
      assert.ok(nextMove.edge.takeoffTile, 'expected jump transition to retain takeoff tile');
      assert.ok(nextMove.edge.landingTile, 'expected jump transition to retain landing tile');
    }
  }

  // 16) Grounded ascent preference: when a grounded option exists, it is discovered and favored.
  const preferGroundCompanion = new FriendlyCompanion(10.5 * tileSize, 5.5 * tileSize);
  const groundedAlt = preferGroundCompanion.findBestGroundedProgressEdge(
    { x: 10, y: 5, align: 'center' },
    { x: 5, y: 3, align: 'center' },
    staircaseWorld,
    {}
  );
  assert.ok(groundedAlt, 'expected grounded ascent alternative to be detected in staircase scenario');

  // 17) Grounded lookahead discovery should find short-horizon ascent path beyond immediate tile.
  const lookahead = preferGroundCompanion.findGroundedRecoveryPlan(
    { x: 10, y: 5, align: 'center' },
    { x: 5, y: 3, align: 'center' },
    staircaseWorld,
    {},
    4
  );
  assert.ok(lookahead, 'expected short-horizon grounded lookahead to discover ascent route');
  assert.ok(lookahead.depth >= 2, 'expected grounded lookahead to evaluate multi-step route');

  // 18) Airborne salvage drift: while falling below target, lateral drift should be applied.
  const airborneCompanion = new FriendlyCompanion(6.5 * tileSize, 3.5 * tileSize);
  airborneCompanion.onGround = false;
  airborneCompanion.vy = 120;
  airborneCompanion.moveExecution = {
    active: true,
    profile: 'diagJump',
    phase: 'travel',
    elapsed: 0.12,
    hold: 0.2,
    lockDirection: 1,
    sourceNode: { x: 6, y: 3, align: 'center' },
    targetNode: { x: 8, y: 2, align: 'center' },
    landingTile: { x: 8, y: 2, align: 'center' },
    profileSignature: 'diagJump'
  };
  const airborneIntent = airborneCompanion.applyMoveIntent(
    {
      target: { x: 8.5 * tileSize, y: 2.5 * tileSize },
      nextTile: { x: 8, y: 2, align: 'center' },
      edge: { profile: { type: 'diagJump' } }
    },
    { x: 8.5 * tileSize, y: 2.5 * tileSize },
    flatWorld,
    {},
    0.016
  );
  assert.strictEqual(airborneIntent.input.has('right'), true, 'expected airborne salvage drift toward route side');
  assert.strictEqual(airborneCompanion.navState.airborneSalvageActive, true);

  // 19) Existing sane jump case still works.
  const saneJumpCompanion = new FriendlyCompanion(5.45 * tileSize, 4.5 * tileSize);
  const saneJumpMove = saneJumpCompanion.chooseMoveFromPath([{
    tile: { x: 7, y: 3, align: 'center' },
    edge: {
      profile: { type: 'diagJump', signature: 'diagJump' },
      sourceTile: { x: 5, y: 4, align: 'center' },
      targetTile: { x: 7, y: 3, align: 'center' },
      transitionType: 'jumpArc'
    }
  }], flatWorld);
  assert.strictEqual(saneJumpMove.edge.executionStage, 'launch', 'expected valid nearby jump launch to remain available');

  // 20) Reachable upper-platform goal beats lower under-player tile.
  const goalCompanion = new FriendlyCompanion(2.5 * tileSize, 2.5 * tileSize);
  const goalPlayer = {
    x: 4.5 * tileSize,
    y: 1.1 * tileSize,
    vx: 0,
    vy: 0,
    justJumped: false,
    onGround: true,
    height: 34,
    facing: 1
  };
  const goalTarget = goalCompanion.buildNavigationTarget(goalPlayer, upperRouteWorld, {});
  assert.ok(goalTarget.tile.y <= 2, 'expected route-aware follow goal near the upper player platform');

  // 21) Candidate selection uses route score (best scored candidate wins), not first-match scan order.
  goalCompanion.updateNavigation(0.016, goalPlayer, upperRouteWorld, {});
  const goalDebug = goalCompanion.getNavigationDebugSnapshot();
  assert.ok(goalDebug.goalCandidates.length > 1, 'expected multiple candidate goals to be evaluated');
  const sortedCandidates = [...goalDebug.goalCandidates].sort((a, b) => a.score - b.score);
  assert.strictEqual(goalDebug.targetTile, sortedCandidates[0].tile, 'expected chosen goal to match best route-scored candidate');

  // 22) Goal stability: tiny player jitter should not flap chosen goal every frame.
  const stableGoalCompanion = new FriendlyCompanion(2.5 * tileSize, 2.5 * tileSize);
  const stableP1 = stableGoalCompanion.buildNavigationTarget(goalPlayer, upperRouteWorld, {}).tile;
  const stableP2 = stableGoalCompanion.buildNavigationTarget({ ...goalPlayer, x: goalPlayer.x + 4 }, upperRouteWorld, {}).tile;
  const stableP3 = stableGoalCompanion.buildNavigationTarget({ ...goalPlayer, x: goalPlayer.x - 4 }, upperRouteWorld, {}).tile;
  assert.strictEqual(`${stableP1.x},${stableP1.y}`, `${stableP2.x},${stableP2.y}`);
  assert.strictEqual(`${stableP2.x},${stableP2.y}`, `${stableP3.x},${stableP3.y}`);

  console.log('FriendlyCompanion nav tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
