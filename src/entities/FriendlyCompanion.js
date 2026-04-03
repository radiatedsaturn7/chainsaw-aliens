import Player from './Player.js';
import { MOVEMENT_MODEL } from '../game/MovementModel.js';

class CompanionInput {
  constructor() {
    this.down = new Set();
    this.prevDown = new Set();
  }

  beginFrame(nextDown) {
    this.prevDown = this.down;
    this.down = new Set(nextDown);
  }

  isDown(action) {
    return this.down.has(action);
  }

  wasPressed(action) {
    return this.down.has(action) && !this.prevDown.has(action);
  }

  wasReleased(action) {
    return !this.down.has(action) && this.prevDown.has(action);
  }

  isGamepadDown() {
    return false;
  }

  wasGamepadPressed() {
    return false;
  }

  getGamepadAxes() {
    return { leftX: 0, leftY: 0 };
  }
}

class MinBinaryHeap {
  constructor() {
    this.items = [];
  }

  push(entry) {
    this.items.push(entry);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (!this.items.length) return null;
    const top = this.items[0];
    const tail = this.items.pop();
    if (this.items.length && tail) {
      this.items[0] = tail;
      this.bubbleDown(0);
    }
    return top;
  }

  bubbleUp(index) {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.items[parent].score <= this.items[i].score) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  bubbleDown(index) {
    let i = index;
    const n = this.items.length;
    while (true) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let best = i;
      if (left < n && this.items[left].score < this.items[best].score) best = left;
      if (right < n && this.items[right].score < this.items[best].score) best = right;
      if (best === i) break;
      [this.items[best], this.items[i]] = [this.items[i], this.items[best]];
      i = best;
    }
  }

  get size() {
    return this.items.length;
  }
}

export default class FriendlyCompanion extends Player {
  constructor(x, y) {
    super(x, y);
    this.type = 'friendly-companion';
    this.friendly = true;
    this.health = this.maxHealth;
    this.assistEnabled = true;
    this.aiInput = new CompanionInput();
    this.followOffsetX = -52;
    this.followOffsetY = -6;
    this.teleportDistance = 760;
    this.attackCooldown = 0;
    this.jumpDecisionCooldown = 0;
    this.aiAirJumpUsed = false;
    this.jumpStallCounter = 0;
    this.jumpStallBestY = Number.POSITIVE_INFINITY;
    this.jumpSuppressTimer = 0;
    this.assistTarget = null;
    this.assistHoldTimer = 0;
    this.navState = {
      mode: 'direct',
      path: [],
      nextNode: null,
      moveProfile: null,
      targetTile: null,
      commitTimer: 0,
      replanCooldown: 0,
      routeAge: 0,
      lastProgressTime: 0,
      lastProgressDistance: Infinity,
      stuckCounter: 0,
      jumpFailCounter: 0,
      noProgressTimer: 0,
      oscillationTimer: 0,
      jumpSpamCounter: 0,
      jumpSpamTime: 0,
      jumpLoopCounter: 0,
      lastJumpX: x,
      lastJumpY: y,
      lastPosX: x,
      lastPosY: y,
      activeReason: 'init',
      lastMoveSignature: null,
      localFailCount: 0,
      plannerFailCount: 0,
      pathVersion: 0,
      lastRouteFromCache: false,
      lastEdgePoisoned: false,
      pathCache: new Map(),
      edgeValidationCache: new Map(),
      poisonedEdges: new Map(),
      elevatorHintCache: null,
      surfaceGraphCache: null,
      routeTargetKey: null,
      lastPoisonReason: 'none',
      upwardPursuitTimer: 0,
      upwardPursuitReason: 'none',
      forcedClimbTriggered: false,
      settled: false,
      stableFollowTile: null,
      stableFollowScore: Infinity,
      stableFollowHold: 0,
      jumpCancelReason: 'none',
      restMode: false,
      restLockTimer: 0,
      restTile: null,
      oscillationDampTimer: 0,
      lastLateralDir: 0,
      lateralFlipCount: 0,
      forcedClimbJumpAllowed: false,
      jumpNoProgressStreak: 0,
      jumpSuppressionTimer: 0,
      lastRouteDistance: Infinity,
      jumpInFlight: false,
      jumpStartTile: null,
      jumpStartSurface: null,
      jumpLandingTile: null,
      jumpRouteDistanceBefore: Infinity,
      jumpRouteDistanceAfter: Infinity,
      jumpMeaningfulLast: true,
      jumpContextBlocks: new Map(),
      lastRouteEdges: []
    };
    this.moveExecution = {
      active: false,
      profile: 'direct',
      phase: 'idle',
      elapsed: 0,
      hold: 0,
      lockDirection: 0,
      sourceNode: null,
      targetNode: null
    };
    this.navDebug = {
      mode: 'direct',
      targetTile: null,
      nextPathNode: null,
      moveProfile: null,
      executionPhase: 'idle',
      alignmentBucket: 'center',
      stuckCounter: 0,
      replanReason: 'init',
      poisonedEdgeCount: 0,
      routeFromCache: false,
      executionSource: 'none',
      executionTarget: 'none',
      executionSignature: 'none',
      routeKeepReason: 'none',
      replanDeferred: false,
      edgePoisonedLastFrame: false,
      jumpSpamCounter: 0,
      stairTraversalChosen: false,
      jumpSpamFailureTriggered: false,
      escalatedForUpwardFailure: false,
      elevatorRoutingActive: false,
      currentSurfaceId: 'none',
      targetSurfaceId: 'none',
      routeKind: 'direct',
      transitionTakeoff: 'none',
      transitionLanding: 'none',
      transitionStage: 'idle',
      jumpFailureStage: 'none',
      poisonReason: 'none',
      upwardPursuitActive: false,
      upwardPursuitReason: 'none',
      obstacleForcedClimb: false,
      settledActive: false,
      stableFollowTile: 'none',
      arrivalDeadzoneActive: false,
      jumpCanceled: false,
      jumpCancelReason: 'none',
      restModeActive: false,
      oscillationSuppressed: false,
      routeEdges: [],
      selectedEdge: 'none',
      selectedProfileSignature: 'none',
      routeDistanceBeforeLastJump: null,
      routeDistanceAfterLastJump: null,
      lastJumpMeaningful: true,
      betterGroundedEdgeAvailable: false,
      routeExecutionMismatch: 'none'
    };
  }

  getDrawPalette(flash) {
    return {
      bodyFill: '#ff9ad7',
      accentStroke: flash ? '#ffd3ef' : '#7a2b65',
      chainStroke: '#5c1b4c',
      superGlow: 'rgba(255,120,220,0.85)',
      oilGlow: '#ff77cc'
    };
  }

  canRev() {
    return false;
  }

  takeDamage() {
    return false;
  }

  removeAssistTarget() {
    this.assistTarget = null;
    this.assistHoldTimer = 0;
  }

  acquireAssistTarget(player, enemies, boss) {
    if (!this.assistEnabled) return null;
    const candidates = [...(enemies || [])];
    if (boss && !boss.dead) candidates.push(boss);
    let best = null;
    let bestScore = Infinity;
    candidates.forEach((enemy) => {
      if (!enemy || enemy.dead || enemy.training) return;
      const nearPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (nearPlayer > 220) return;
      const nearSelf = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (nearSelf > 300) return;
      const score = nearPlayer * 0.65 + nearSelf * 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    });
    return best;
  }

  canStandOnTile(tileX, tileY, world, abilities) {
    if (tileX < 0 || tileX >= world.width || tileY < 1 || tileY >= world.height - 1) return false;
    if (world.isHazard?.(tileX, tileY) || world.isHazard?.(tileX, tileY + 1)) return false;
    const center = this.tileCenter({ x: tileX, y: tileY, align: 'center' }, world);
    if (this.collidesBodyAt(center.x, center.y, world, abilities, { ignoreOneWay: true })) return false;
    return this.hasGroundSupportAt(center.x, center.y, world, abilities);
  }

  isSlopeTile(tile) {
    return tile === '^' || tile === 'v';
  }

  isPointBlockedLikePlayer(x, y, world, abilities, options = {}) {
    const tileSize = world.tileSize;
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);
    const tile = world.getTile(tileX, tileY);
    if (this.isSlopeTile(tile)) {
      const localX = (x - tileX * tileSize) / tileSize;
      const localY = (y - tileY * tileSize) / tileSize;
      if (tile === '^') return localY >= 1 - localX;
      return localY >= localX;
    }
    const ignoreOneWay = options.ignoreOneWay || false;
    return world.isSolid(tileX, tileY, abilities, { ...options, ignoreOneWay });
  }

  getSlopeSurfaceY(tile, tileX, tileY, worldX, tileSize) {
    const localX = (worldX - tileX * tileSize) / tileSize;
    const offset = tile === '^' ? (1 - localX) : localX;
    return tileY * tileSize + offset * tileSize;
  }

  isSlopeAt(tileX, tileY, world) {
    return this.isSlopeTile(world.getTile(tileX, tileY));
  }

  collidesBodyAt(x, y, world, abilities, options = {}) {
    const points = [
      [x - this.width / 2 + 4, y - this.height / 2 + 4],
      [x + this.width / 2 - 4, y - this.height / 2 + 4],
      [x - this.width / 2 + 4, y + this.height / 2 - 4],
      [x + this.width / 2 - 4, y + this.height / 2 - 4]
    ];
    for (let i = 0; i < points.length; i += 1) {
      if (this.isPointBlockedLikePlayer(points[i][0], points[i][1], world, abilities, options)) return true;
    }
    return false;
  }

  hasGroundSupportAt(x, y, world, abilities) {
    const tileSize = world.tileSize;
    const footY = y + this.height / 2;
    const sampleXs = [x - this.width / 2 + 6, x + this.width / 2 - 6];
    for (let i = 0; i < sampleXs.length; i += 1) {
      const sampleX = sampleXs[i];
      if (this.isPointBlockedLikePlayer(sampleX, footY + 1, world, abilities, { ignoreOneWay: false })) return true;
      const tileX = Math.floor(sampleX / tileSize);
      const tileY = Math.floor(footY / tileSize);
      const tile = world.getTile(tileX, tileY);
      if (!this.isSlopeTile(tile)) continue;
      const surfaceY = this.getSlopeSurfaceY(tile, tileX, tileY, sampleX, tileSize);
      if (footY >= surfaceY - 6 && footY <= surfaceY + tileSize * 0.6) return true;
    }
    return false;
  }

  getBodyTile(world, x = this.x, y = this.y) {
    const tileSize = world.tileSize;
    return {
      x: Math.floor(x / tileSize),
      y: Math.floor((y + this.height / 2 - 1) / tileSize),
      align: this.getAlignmentBucket(world, x)
    };
  }

  getFootStandTile(world) {
    return this.getBodyTile(world, this.x, this.y);
  }

  tileCenter(tile, world) {
    const offset = tile.align === 'left' ? -world.tileSize * 0.2 : tile.align === 'right' ? world.tileSize * 0.2 : 0;
    return {
      x: (tile.x + 0.5) * world.tileSize + offset,
      y: (tile.y + 0.5) * world.tileSize
    };
  }

  getAlignmentBucket(world, x = this.x) {
    const tileSize = world.tileSize;
    const tileX = Math.floor(x / tileSize);
    const frac = (x - tileX * tileSize) / tileSize;
    if (frac < 0.34) return 'left';
    if (frac > 0.66) return 'right';
    return 'center';
  }

  withAlign(tile, align = 'center') {
    return { x: tile.x, y: tile.y, align };
  }

  tileKey(tile) {
    return `${tile.x},${tile.y}`;
  }

  routeTileDistance(a, b) {
    if (!a || !b) return Infinity;
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) * 1.4;
  }

  buildElevatorHints(world, abilities) {
    const cache = this.navState.elevatorHintCache;
    const cacheKey = `${world.elevatorPaths?.length || 0}:${world.elevators?.length || 0}`;
    if (cache?.key === cacheKey) return cache.data;
    const pathTiles = world.elevatorPaths || [];
    const pathSet = new Set(pathTiles.map((t) => `${t.x},${t.y}`));
    const visited = new Set();
    const components = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    pathTiles.forEach((tile) => {
      const key = `${tile.x},${tile.y}`;
      if (visited.has(key)) return;
      const queue = [tile];
      visited.add(key);
      const nodes = [];
      while (queue.length) {
        const n = queue.shift();
        if (!n) break;
        nodes.push(n);
        dirs.forEach(([dx, dy]) => {
          const nx = n.x + dx;
          const ny = n.y + dy;
          const nKey = `${nx},${ny}`;
          if (!pathSet.has(nKey) || visited.has(nKey)) return;
          visited.add(nKey);
          queue.push({ x: nx, y: ny });
        });
      }
      const boardTiles = [];
      nodes.forEach((node) => {
        [-1, 1].forEach((side) => {
          const stand = { x: node.x + side, y: node.y, align: side < 0 ? 'right' : 'left' };
          if (this.canStandOnTile(stand.x, stand.y, world, abilities)) boardTiles.push(stand);
        });
      });
      components.push({ nodes, boardTiles });
    });
    const data = { components, pathSet };
    this.navState.elevatorHintCache = { key: cacheKey, data };
    return data;
  }

  findNearbyElevatorComponent(tile, world, abilities) {
    const hints = this.buildElevatorHints(world, abilities);
    let best = null;
    let bestDist = Infinity;
    hints.components.forEach((component) => {
      component.boardTiles.forEach((board) => {
        const d = Math.abs(board.x - tile.x) + Math.abs(board.y - tile.y);
        if (d < bestDist) {
          bestDist = d;
          best = component;
        }
      });
    });
    return bestDist <= 4 ? best : null;
  }

  findFollowStandTile(player, world, abilities) {
    const tileSize = world.tileSize;
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = player.onGround
      ? Math.floor((player.y + player.height / 2 - 1) / tileSize)
      : Math.floor(player.y / tileSize);
    const facing = player.facing || 1;
    const verticalOffsets = [0, -1, 1, -2, 2];
    const behindColumns = [2, 1, 0].map((step) => playerTileX - facing * step);
    const adjacentColumns = [
      playerTileX - facing * 3,
      playerTileX + 1,
      playerTileX - 1,
      playerTileX + 2,
      playerTileX - 2,
      playerTileX + 3,
      playerTileX - 3
    ];
    const uniqueColumns = [];
    [...behindColumns, ...adjacentColumns].forEach((column) => {
      if (!uniqueColumns.includes(column)) uniqueColumns.push(column);
    });
    const playerStanding = Boolean(player.onGround);
    const playerAboveCompanion = player.y < this.y - tileSize * 0.6;
    const prioritizedVertical = playerAboveCompanion
      ? (playerStanding ? [0, -1, 1, -2, 2] : [0, -1, -2, 1, 2])
      : (playerStanding ? [0, 1, -1, 2, -2] : verticalOffsets);
    for (let stepIndex = 0; stepIndex < uniqueColumns.length; stepIndex += 1) {
      const candidateX = uniqueColumns[stepIndex];
      for (let i = 0; i < prioritizedVertical.length; i += 1) {
        const candidateY = playerTileY + prioritizedVertical[i];
        if (Math.abs(candidateY - playerTileY) > 2) continue;
        if (playerAboveCompanion && candidateY > playerTileY) continue;
        if (this.canStandOnTile(candidateX, candidateY, world, abilities)) {
          return { x: candidateX, y: candidateY, align: 'center' };
        }
      }
    }
    return { x: playerTileX, y: playerTileY, align: 'center' };
  }

  // Hybrid nav layer selection: keep direct movement as default and only escalate when repeated lack of progress is detected.
  chooseNavigationMode(targetTile, world, abilities) {
    const state = this.navState;
    const distToGoal = Math.hypot(targetTile.x * world.tileSize - this.x, targetTile.y * world.tileSize - this.y);
    const currentTile = this.getFootStandTile(world);
    const verticalGap = Math.abs(targetTile.y - currentTile.y);
    const elevatorNearby = Boolean(this.findNearbyElevatorComponent(currentTile, world, abilities));
    if (state.mode === 'recovery' && state.commitTimer > 0) return 'recovery';
    if (state.upwardPursuitTimer > 0 && targetTile.y < currentTile.y) return 'astar';
    if (this.shouldUseDirectFollow(targetTile, world, abilities)) return 'direct';
    if (verticalGap >= 4 || state.jumpSpamCounter >= 2 || state.jumpLoopCounter >= 1 || (elevatorNearby && verticalGap >= 2)) return 'astar';
    if (distToGoal < world.tileSize * 6 && state.stuckCounter < 2) return 'direct';
    return 'astar';
  }

  shouldUseDirectFollow(targetTile, world, abilities) {
    const state = this.navState;
    const currentTile = this.getFootStandTile(world);
    const dx = targetTile.x - currentTile.x;
    const dy = targetTile.y - currentTile.y;
    if (state.upwardPursuitTimer > 0 && dy < -1) return false;
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 1) return true;
    if (Math.abs(dx) <= 5 && Math.abs(dy) <= 1 && state.stuckCounter < 2) return true;
    if (state.mode === 'direct' && state.noProgressTimer < 0.5 && Math.abs(dy) <= 2) return true;
    return false;
  }

  shouldEscalateToPlanner(targetTile, world) {
    const state = this.navState;
    const current = this.getFootStandTile(world);
    const dist = Math.abs(targetTile.x - current.x) + Math.abs(targetTile.y - current.y);
    const verticalGap = Math.abs(targetTile.y - current.y);
    return state.stuckCounter >= 2
      || state.noProgressTimer > 0.65
      || dist > 8
      || verticalGap > 5
      || state.jumpSpamCounter >= 2
      || state.jumpLoopCounter >= 2;
  }

  shouldForceRouteBecauseVerticalMismatch(startTile, targetTile) {
    const dy = targetTile.y - startTile.y;
    return dy <= -2 || dy >= 3 || this.navState.jumpLoopCounter >= 1;
  }

  detectJumpSpamFailure() {
    const state = this.navState;
    return state.jumpLoopCounter >= 2 || state.jumpSpamCounter >= 4;
  }

  updateUpwardPursuitState(dt, player, startTile, targetTile) {
    const state = this.navState;
    state.upwardPursuitTimer = Math.max(0, state.upwardPursuitTimer - dt);
    state.forcedClimbTriggered = false;
    const playerRising = player.vy < -40 || player.justJumped || (!player.onGround && player.y < this.y - 14);
    const targetAbove = targetTile.y < startTile.y - 1;
    const meaningfulGap = (startTile.y - targetTile.y) >= 2;
    if ((playerRising && targetAbove) || meaningfulGap) {
      state.upwardPursuitTimer = Math.max(state.upwardPursuitTimer, meaningfulGap ? 0.9 : 0.65);
      state.upwardPursuitReason = playerRising ? 'player-ascent' : 'height-gap';
    }
    if (state.stuckCounter >= 1 && targetAbove) {
      state.upwardPursuitTimer = Math.max(state.upwardPursuitTimer, 0.85);
      state.upwardPursuitReason = 'stalled-below';
    }
  }

  isForwardBlocked(world, abilities, dir) {
    const step = Math.sign(dir || this.facing || 1);
    const probeX = this.x + step * (this.width * 0.55);
    return this.collidesBodyAt(probeX, this.y, world, abilities, { ignoreOneWay: true });
  }

  detectStuckState(dt, targetWorld) {
    const state = this.navState;
    const d = Math.hypot(targetWorld.x - this.x, targetWorld.y - this.y);
    const travel = Math.hypot(this.x - state.lastPosX, this.y - state.lastPosY);
    state.lastPosX = this.x;
    state.lastPosY = this.y;
    if (d < state.lastProgressDistance - 6) {
      state.lastProgressDistance = d;
      state.lastProgressTime = 0;
      state.noProgressTimer = 0;
      state.stuckCounter = Math.max(0, state.stuckCounter - 1);
      state.jumpFailCounter = Math.max(0, state.jumpFailCounter - 1);
      state.oscillationTimer = 0;
    } else {
      state.lastProgressTime += dt;
      state.noProgressTimer += dt;
      if (travel < 1.8 && Math.abs(this.vx) > 20) {
        state.oscillationTimer += dt;
      } else {
        state.oscillationTimer = Math.max(0, state.oscillationTimer - dt * 0.5);
      }
    }
    if (this.justJumped && Math.abs(this.vy) < 20 && !this.onGround) {
      state.jumpFailCounter += 1;
    }
    if (this.justJumped) {
      const jumpDx = Math.abs(this.x - state.lastJumpX);
      const jumpDy = Math.abs(this.y - state.lastJumpY);
      if (jumpDx < 10 && jumpDy < 12) {
        state.jumpSpamCounter += 1;
        state.jumpSpamTime = 0.45;
        if (state.noProgressTimer > 0.25) {
          state.jumpLoopCounter += 1;
        }
      } else {
        state.jumpSpamCounter = Math.max(0, state.jumpSpamCounter - 1);
        state.jumpLoopCounter = Math.max(0, state.jumpLoopCounter - 1);
      }
      state.lastJumpX = this.x;
      state.lastJumpY = this.y;
    }
    state.jumpSpamTime = Math.max(0, state.jumpSpamTime - dt);
    if (state.jumpSpamTime <= 0) state.jumpSpamCounter = Math.max(0, state.jumpSpamCounter - 1);
    if (this.moveExecution.profile.includes('Jump') && this.onGround && Math.abs(this.vy) < 5 && state.noProgressTimer > 0.25) {
      state.jumpFailCounter += 1;
    }
    if (state.noProgressTimer > 0.55 && Math.abs(this.vx) < 20 && Math.abs(this.vy) < 35) {
      state.stuckCounter += 1;
      state.noProgressTimer = 0;
    }
    if (state.jumpFailCounter >= 3 || state.oscillationTimer > 0.65) {
      state.stuckCounter += 1;
      state.jumpFailCounter = 0;
      state.oscillationTimer = 0;
    }
    if (state.jumpSpamCounter >= 4) {
      state.stuckCounter += 1;
      state.noProgressTimer = Math.max(state.noProgressTimer, 0.7);
      state.jumpLoopCounter += 1;
    }
    if (state.jumpLoopCounter >= 2) {
      state.stuckCounter += 1;
      state.jumpFailCounter = 0;
      state.jumpSpamCounter = Math.max(state.jumpSpamCounter, 3);
    }
  }

  updateRouteCommitment(dt, moveSignature) {
    const state = this.navState;
    state.commitTimer = Math.max(0, state.commitTimer - dt);
    if (moveSignature && state.lastMoveSignature !== moveSignature) {
      state.lastMoveSignature = moveSignature;
      state.commitTimer = 0.18;
    }
  }

  shouldReplan(targetTile, reason) {
    const state = this.navState;
    const key = this.tileKey(targetTile);
    if (!state.routeTargetKey || state.routeTargetKey !== key) return true;
    if (!state.path.length) return true;
    if (state.replanCooldown <= 0 && reason !== 'idle') return true;
    return false;
  }

  isPlayerMostlyStill(player) {
    return Math.abs(player?.vx || 0) < 10 && Math.abs(player?.vy || 0) < 18 && Boolean(player?.onGround);
  }

  chooseStickyFollowTile(candidateTile, player, world) {
    const state = this.navState;
    state.stableFollowHold = Math.max(0, state.stableFollowHold - 1);
    const playerStill = this.isPlayerMostlyStill(player);
    if (!state.stableFollowTile || !playerStill) {
      state.stableFollowTile = { ...candidateTile };
      state.stableFollowScore = Math.hypot(candidateTile.x - Math.floor(player.x / world.tileSize), candidateTile.y - Math.floor(player.y / world.tileSize));
      state.stableFollowHold = playerStill ? 18 : 0;
      return candidateTile;
    }
    const current = state.stableFollowTile;
    const currentScore = Math.hypot(current.x - Math.floor(player.x / world.tileSize), current.y - Math.floor(player.y / world.tileSize));
    const candidateScore = Math.hypot(candidateTile.x - Math.floor(player.x / world.tileSize), candidateTile.y - Math.floor(player.y / world.tileSize));
    const disruptionCost = Math.hypot(candidateTile.x - current.x, candidateTile.y - current.y) * 0.8;
    const candidateTotal = candidateScore + disruptionCost;
    const nearEquivalent = Math.abs(candidateScore - currentScore) < 0.9
      && Math.abs(candidateTile.x - current.x) <= 1
      && Math.abs(candidateTile.y - current.y) <= 1;
    if (nearEquivalent && state.stableFollowHold > 0) {
      return current;
    }
    const materiallyBetter = candidateTotal + 0.95 < currentScore;
    if (materiallyBetter || state.stableFollowHold <= 0) {
      state.stableFollowTile = { ...candidateTile };
      state.stableFollowScore = candidateScore;
      state.stableFollowHold = playerStill ? 18 : 0;
      return candidateTile;
    }
    return current;
  }

  shouldStayInRestMode(player, world, abilities) {
    const state = this.navState;
    if (!state.restMode || !state.restTile) return false;
    if (this.assistTarget) return false;
    if (!this.canStandOnTile(state.restTile.x, state.restTile.y, world, abilities)) return false;
    const playerMoved = Math.abs(player?.vx || 0) > 26 || Math.abs(player?.vy || 0) > 36;
    if (playerMoved) return false;
    const restCenter = this.tileCenter(state.restTile, world);
    const displaced = Math.hypot(this.x - restCenter.x, this.y - restCenter.y) > world.tileSize * 0.9;
    if (displaced) return false;
    return state.restLockTimer > 0 || this.isPlayerMostlyStill(player);
  }

  buildNavigationTarget(player, world, abilities) {
    if (this.assistTarget) {
      const dir = Math.sign(this.assistTarget.x - this.x) || this.facing || 1;
      return {
        tile: this.withAlign(this.getBodyTile(world, this.assistTarget.x - dir * 20, this.assistTarget.y), 'center'),
        world: { x: this.assistTarget.x - dir * 20, y: this.assistTarget.y - 4 }
      };
    }
    const candidateTile = this.findFollowStandTile(player, world, abilities);
    const tile = this.chooseStickyFollowTile(candidateTile, player, world);
    return { tile, world: this.tileCenter(tile, world) };
  }

  buildEdgeProfiles(from, to, world) {
    const dir = Math.sign(to.x - from.x);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const profiles = [];
    if (dx === 0 && dy === 0 && from.align !== to.align) return profiles;
    if (dy === 0 && Math.abs(dx) === 1) {
      if (this.isSlopeAt(from.x, from.y + 1, world) || this.isSlopeAt(to.x, to.y + 1, world)) {
        profiles.push({ type: 'slopeWalk', dir, hold: 0.16, cost: 0.78 });
      }
      profiles.push({ type: 'corridorAdvance', dir, hold: 0.16, cost: 0.85 });
      profiles.push({ type: 'walk', dir, hold: 0.18, cost: 1 });
    }
    if (dy === -1 && Math.abs(dx) === 1) {
      profiles.push({ type: 'stepUp', dir: dir || 1, hold: 0.15, cost: 1.2 });
      profiles.push({ type: 'shortHopForward', dir: dir || 1, hold: 0.16, cost: 1.5 });
    }
    if (dy <= 0 && Math.abs(dx) <= 4) {
      const jumpDirs = dx === 0 ? [-1, 1] : [dir || 1];
      const driftDelays = [0, 0.06, 0.12];
      jumpDirs.forEach((jumpDir) => {
        driftDelays.forEach((driftDelay) => {
          const ambition = Math.max(1, Math.abs(dx));
          const secondJumpOptions = Math.abs(dy) >= 2 ? [null, 0.18, 0.26] : [null];
          secondJumpOptions.forEach((secondJumpAt) => {
            const signature = `pj:${jumpDir}:${driftDelay.toFixed(2)}:${secondJumpAt == null ? 'none' : secondJumpAt.toFixed(2)}:${ambition}`;
            profiles.push({
              type: 'paramJump',
              signature,
              dir: jumpDir,
              hold: 0.2 + ambition * 0.01,
              driftDelay,
              secondJumpAt,
              cost: 2.8 + Math.abs(dy) * 0.65 + ambition * 0.22 + (secondJumpAt != null ? 0.2 : 0)
            });
          });
        });
      });
      profiles.push({ type: 'diagJump', dir: dir || 1, hold: 0.2, driftDelay: 0, cost: 3 + Math.abs(dy) });
      profiles.push({ type: 'upThenDrift', dir: dir || 1, hold: 0.24, driftDelay: 0.07, cost: 3.5 + Math.abs(dy) });
    }
    if (dy > 0 && Math.abs(dx) <= 2) {
      profiles.push({ type: 'drop', dir: dir || 0, hold: 0.18, cost: 2 + dy * 0.6 });
    }
    if (dy < 0 && dx === 0) {
      profiles.push({ type: 'verticalJump', dir: 0, hold: 0.22, cost: 3.2 + Math.abs(dy) });
      profiles.push({ type: 'upThenDrift', dir: 1, hold: 0.2, driftDelay: 0.09, cost: 3.8 + Math.abs(dy) });
      profiles.push({ type: 'upThenDrift', dir: -1, hold: 0.2, driftDelay: 0.09, cost: 3.8 + Math.abs(dy) });
    }
    if (Math.abs(dx) <= 1 && dy <= 0) {
      profiles.push({ type: 'lowCeilingStep', dir: dir || 1, hold: 0.14, cost: 1.4 + Math.abs(dy) * 0.5 });
    }
    return profiles;
  }

  validateMovementEdge(from, to, world, abilities) {
    if (!this.canStandOnTile(to.x, to.y, world, abilities)) return null;
    const state = this.navState;
    const cacheKey = `${this.tileKey(from)}->${this.tileKey(to)}`;
    const cached = state.edgeValidationCache.get(cacheKey);
    if (cached) return cached;
    const profiles = this.buildEdgeProfiles(from, to, world);
    if (to.viaElevator) {
      profiles.unshift({ type: 'elevatorRide', dir: 0, hold: 0.3, cost: 1.8 + Math.abs(to.y - from.y) * 0.18 });
    }
    let best = null;
    for (let i = 0; i < profiles.length; i += 1) {
      const profile = profiles[i];
      const profileKey = profile.signature || profile.type;
      if (this.isEdgePoisoned(from, to, profileKey)) continue;
      if (profile.type === 'elevatorRide') {
        const component = this.findNearbyElevatorComponent(from, world, abilities);
        const canBoard = Boolean(component?.boardTiles?.some((board) => board.x === to.x && board.y === to.y));
        if (!canBoard) continue;
        best = {
          ok: true,
          profile,
          cost: profile.cost,
          moveType: profile.type,
          needAlign: false
        };
        break;
      }
      const result = this.simulateMoveProfile(from, to, profile, world, abilities);
      if (!result.ok) continue;
      const progress = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      if (this.isJumpProfile(profile.type) && progress <= 1 && result.cost > 2.6) continue;
      if (this.isJumpProfile(profile.type)) {
        const horizontalGain = Math.abs(to.x - from.x);
        const verticalGain = from.y - to.y;
        const weakVertical = horizontalGain === 0 && verticalGain <= 2;
        if (weakVertical && result.cost > 2.2) continue;
      }
      if (!best || result.cost < best.cost) {
        best = {
          ok: true,
          profile,
          profileKey,
          cost: result.cost,
          moveType: profile.type,
          needAlign: result.needAlign
        };
      }
    }
    if (!best) {
      const dx = Math.abs(to.x - from.x);
      const dy = to.y - from.y;
      if (dy === -1 && dx <= 1) {
        const fromCenter = this.tileCenter(from, world);
        const toCenter = this.tileCenter(to, world);
        const fromClear = !this.collidesBodyAt(fromCenter.x, fromCenter.y - world.tileSize * 0.55, world, abilities, { ignoreOneWay: true });
        const toClear = !this.collidesBodyAt(toCenter.x, toCenter.y - world.tileSize * 0.35, world, abilities, { ignoreOneWay: true });
        if (fromClear && toClear) {
          best = {
            ok: true,
            profile: { type: 'stepUp', dir: Math.sign(to.x - from.x) || 1, hold: 0.16, cost: 1.5 },
            profileKey: 'stepUp',
            cost: 1.5,
            moveType: 'stepUp',
            needAlign: false
          };
        }
      }
    }
    const miss = { ok: false };
    state.edgeValidationCache.set(cacheKey, best || miss);
    if (state.edgeValidationCache.size > 1800) {
      const first = state.edgeValidationCache.keys().next().value;
      state.edgeValidationCache.delete(first);
    }
    return best || miss;
  }

  // Physics-aware edge check using a small coarse simulation pass, keeping launch alignment and one-way behavior in play.
  simulateMoveProfile(from, to, profile, world, abilities) {
    const tileSize = world.tileSize;
    const target = this.tileCenter(to, world);
    const launch = this.tileCenter(this.withAlign(from, from.align || 'center'), world);
    const dt = 1 / 30;
    const maxT = profile.type === 'drop' ? 0.85 : 0.9;
    let bestCost = Infinity;
    let found = false;
    let needAlign = from.align !== 'center';

    let x = launch.x;
    let y = launch.y;
    let vx = 0;
    let vy = 0;
    let coyote = MOVEMENT_MODEL.coyoteTime;
    let jumps = 2;
    let jumped = false;
    let secondJumped = false;
    let onGround = this.hasGroundSupportAt(x, y, world, abilities);
    let t = 0;
    let bonk = false;
    let wallBump = 0;
    let descentStarted = false;
    if ((profile.type === 'diagJump' || profile.type === 'verticalJump' || profile.type === 'upThenDrift')
      && this.collidesBodyAt(x, y - 6, world, abilities, { ignoreOneWay: true })) {
      return { ok: false };
    }
    while (t < maxT) {
      let move = 0;
      let jumpNow = false;
      if (profile.type === 'walk') {
        move = profile.dir;
      } else if (profile.type === 'slopeWalk') {
        move = profile.dir;
      } else if (profile.type === 'corridorAdvance') {
        move = profile.dir;
      } else if (profile.type === 'stepUp') {
        move = profile.dir;
        if (!jumped && t < 0.04) jumpNow = true;
      } else if (profile.type === 'shortHopForward') {
        move = profile.dir;
        if (!jumped && t < 0.05) jumpNow = true;
      } else if (profile.type === 'lowCeilingStep') {
        move = profile.dir;
        if (!jumped && t < 0.03 && !this.collidesBodyAt(x, y - 10, world, abilities, { ignoreOneWay: true })) jumpNow = true;
      } else if (profile.type === 'drop') {
        move = profile.dir;
      } else if (profile.type === 'verticalJump') {
        if (!jumped && t < 0.06) jumpNow = true;
      } else if (profile.type === 'diagJump') {
        move = profile.dir;
        if (!jumped && t < 0.05) jumpNow = true;
      } else if (profile.type === 'upThenDrift') {
        if (!jumped && t < 0.06) jumpNow = true;
        if (t >= (profile.driftDelay || 0.09)) move = profile.dir;
      } else if (profile.type === 'paramJump') {
        if (!jumped && t < 0.06) jumpNow = true;
        if (t >= (profile.driftDelay || 0)) move = profile.dir;
      } else if (profile.type === 'microAlignLeft') {
        move = -1;
      } else if (profile.type === 'microAlignRight') {
        move = 1;
      } else if (profile.type === 'settleCenter') {
        const frac = ((x / tileSize) % 1 + 1) % 1;
        move = frac < 0.48 ? 1 : frac > 0.52 ? -1 : 0;
      }

      vx = move * this.speed * 0.85;
      if (jumpNow && (coyote > 0 || jumps > 0)) {
        vy = -this.jumpPower;
        jumped = true;
        coyote = 0;
        jumps = Math.max(0, jumps - 1);
      }
      if (profile.type === 'paramJump' && profile.secondJumpAt != null && jumped && !secondJumped && t >= profile.secondJumpAt && jumps > 0) {
        vy = -this.jumpPower * 0.96;
        jumps = Math.max(0, jumps - 1);
        secondJumped = true;
      }

      vy += MOVEMENT_MODEL.gravity * dt;
      if (vy > 0) descentStarted = true;
      const nextX = x + vx * dt;
      const nextY = y + vy * dt;

      const hitWall = this.collidesBodyAt(nextX, y, world, abilities, { ignoreOneWay: true });
      if (!hitWall) {
        x = nextX;
      } else {
        let stepped = false;
        if (onGround && (profile.type === 'walk' || profile.type === 'slopeWalk' || profile.type === 'corridorAdvance' || profile.type === 'stepUp' || profile.type === 'lowCeilingStep')) {
          const signX = Math.sign(nextX - x) || profile.dir || 1;
          const canOccupyStep = (candidateX, candidateY) => {
            const rectLeft = candidateX - this.width / 2;
            const rectRight = candidateX + this.width / 2;
            const rectTop = candidateY - this.height / 2;
            const rectBottom = candidateY + this.height / 2;
            const edgeX = candidateX + signX * this.width / 2;
            return !this.isPointBlockedLikePlayer(rectLeft + 4, rectTop + 4, world, abilities, { ignoreOneWay: true })
              && !this.isPointBlockedLikePlayer(rectRight - 4, rectTop + 4, world, abilities, { ignoreOneWay: true })
              && !this.isPointBlockedLikePlayer(edgeX, rectBottom - 4, world, abilities, { ignoreOneWay: true });
          };
          const stepHeights = [tileSize, tileSize - 2, Math.floor(tileSize * 0.75), Math.floor(tileSize * 0.5), Math.floor(tileSize * 0.4), Math.floor(tileSize * 0.33)];
          for (let s = 0; s < stepHeights.length; s += 1) {
            const stepHeight = stepHeights[s];
            if (stepHeight <= 0) continue;
            if (!canOccupyStep(nextX, y - stepHeight)) continue;
            x = nextX;
            y -= stepHeight;
            onGround = true;
            vy = Math.min(vy, 0);
            stepped = true;
            break;
          }
        }
        if (!stepped) {
          wallBump += 1;
        }
      }
      const hitHeadOrFloor = this.collidesBodyAt(x, nextY, world, abilities, { ignoreOneWay: vy < 0 });
      if (!hitHeadOrFloor) {
        y = nextY;
      } else {
        if (vy < 0) bonk = true;
        vy = 0;
      }

      if (vy >= 0 || onGround) {
        const footY = y + this.height / 2;
        const sampleXs = [x - this.width / 2 + 6, x + this.width / 2 - 6];
        let bestSurface = null;
        for (let i = 0; i < sampleXs.length; i += 1) {
          const sampleX = sampleXs[i];
          const tileX = Math.floor(sampleX / tileSize);
          const tileY = Math.floor(footY / tileSize);
          const tile = world.getTile(tileX, tileY);
          if (!this.isSlopeTile(tile)) continue;
          const surfaceY = this.getSlopeSurfaceY(tile, tileX, tileY, sampleX, tileSize);
          if (footY >= surfaceY - 6 && footY <= surfaceY + tileSize * 0.6) {
            if (bestSurface === null || surfaceY < bestSurface) bestSurface = surfaceY;
          }
        }
        if (bestSurface !== null) {
          y = bestSurface - this.height / 2;
          onGround = true;
          vy = Math.min(vy, 0);
        }
      }

      onGround = this.hasGroundSupportAt(x, y, world, abilities);
      if (onGround) {
        coyote = MOVEMENT_MODEL.coyoteTime;
        jumps = 1;
      } else {
        coyote = Math.max(0, coyote - dt);
      }

      const nearTarget = Math.abs(x - target.x) < tileSize * 0.58 && Math.abs(y - target.y) < tileSize * 0.7;
      const stableLanding = onGround && (!jumped || descentStarted);
      const riskyLip = wallBump > 1 && jumped && Math.abs(y - target.y) < tileSize * 0.55;
      if (nearTarget && stableLanding && !bonk && !riskyLip) {
        const distPenalty = Math.hypot(x - target.x, y - target.y) * 0.02;
        const wobblePenalty = wallBump * 0.35;
        const cost = (profile.cost || 1) + t * 0.35 + distPenalty + wobblePenalty;
        if (cost < bestCost) {
          bestCost = cost;
          found = true;
        }
        break;
      }

      t += dt;
      if (wallBump > 2 && jumped) {
        bonk = true;
        break;
      }
    }

    if (!found) return { ok: false };
    return { ok: true, cost: bestCost, needAlign };
  }

  getNeighborCandidates(tile, world, abilities, goal) {
    const dirs = [-1, 1];
    const neighbors = [];
    dirs.forEach((dir) => {
      neighbors.push({ x: tile.x + dir, y: tile.y, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y - 1, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y - 2, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y - 3, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y - 4, align: 'center' });
      neighbors.push({ x: tile.x + dir * 2, y: tile.y - 1, align: 'center' });
      neighbors.push({ x: tile.x + dir * 2, y: tile.y - 2, align: 'center' });
      neighbors.push({ x: tile.x + dir * 3, y: tile.y - 1, align: 'center' });
      neighbors.push({ x: tile.x + dir * 2, y: tile.y - 3, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y + 1, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y + 2, align: 'center' });
      neighbors.push({ x: tile.x + dir * 2, y: tile.y, align: 'center' });
    });
    neighbors.push({ x: tile.x, y: tile.y - 1, align: 'center' });
    neighbors.push({ x: tile.x, y: tile.y - 2, align: 'center' });
    neighbors.push({ x: tile.x, y: tile.y - 3, align: 'center' });
    neighbors.push({ x: tile.x, y: tile.y - 4, align: 'center' });
    neighbors.push({ x: tile.x, y: tile.y + 1, align: 'center' });
    neighbors.push({ x: tile.x, y: tile.y + 2, align: 'center' });
    const nearElevator = this.findNearbyElevatorComponent(tile, world, abilities);
    if (nearElevator?.boardTiles?.length) {
      const sortedBoards = [...nearElevator.boardTiles]
        .sort((a, b) => Math.abs((goal?.y || tile.y) - a.y) - Math.abs((goal?.y || tile.y) - b.y))
        .slice(0, 6);
      sortedBoards.forEach((board) => {
        if (Math.abs(board.x - tile.x) + Math.abs(board.y - tile.y) <= 1) return;
        neighbors.push({ x: board.x, y: board.y, align: board.align || 'center', viaElevator: true });
      });
    }
    return neighbors;
  }

  getTraversalGraphCacheKey(start, goal, world) {
    return `${world.width}x${world.height}:${start.x},${start.y}->${goal.x},${goal.y}`;
  }

  classifySurfaceSegments(walkable) {
    const tileToSurface = new Map();
    const surfaces = [];
    const visited = new Set();
    const queue = [];
    const isConnectedSurfaceStep = (from, to) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
      if (dx === 0 && dy === 0) return false;
      // Same-height contiguous floor.
      if (dy === 0 && Math.abs(dx) === 1) return true;
      return false;
    };
    walkable.forEach((tile, key) => {
      if (visited.has(key)) return;
      const id = `surface-${surfaces.length}`;
      const tiles = [];
      visited.add(key);
      queue.push(tile);
      while (queue.length) {
        const current = queue.shift();
        if (!current) break;
        tiles.push(current);
        tileToSurface.set(`${current.x},${current.y}`, id);
        for (let nx = current.x - 1; nx <= current.x + 1; nx += 1) {
          for (let ny = current.y - 1; ny <= current.y + 1; ny += 1) {
            const nKey = `${nx},${ny}`;
            if (!walkable.has(nKey) || visited.has(nKey)) continue;
            const candidate = walkable.get(nKey);
            if (!candidate || !isConnectedSurfaceStep(current, candidate)) continue;
            visited.add(nKey);
            queue.push(candidate);
          }
        }
      }
      const sortedByX = [...tiles].sort((a, b) => (a.x - b.x) || (a.y - b.y));
      const sortedByY = [...tiles].sort((a, b) => (a.y - b.y) || (a.x - b.x));
      const anchor = sortedByX[Math.floor(sortedByX.length / 2)];
      surfaces.push({
        id,
        tiles,
        anchor,
        left: sortedByX[0],
        right: sortedByX[sortedByX.length - 1],
        top: sortedByY[0],
        bottom: sortedByY[sortedByY.length - 1]
      });
    });
    return { surfaces, tileToSurface };
  }

  classifyTraversalEdgeType(fromTile, toTile, world, abilities) {
    const dx = toTile.x - fromTile.x;
    const dy = toTile.y - fromTile.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const lowCeiling = this.collidesBodyAt(
      (fromTile.x + 0.5) * world.tileSize,
      (fromTile.y + 0.5) * world.tileSize - 8,
      world,
      abilities,
      { ignoreOneWay: true }
    );
    if (dy === 0 && absDx <= 2) return lowCeiling ? 'corridorAdvance' : 'walk';
    if (dy === -1 && absDx <= 1) return 'stepUp';
    if (dy === 1 && absDx <= 1) return 'drop';
    if (dy < -1 && absDx <= 2) return 'shortHop';
    if (dy > 1) return 'drop';
    if (absDy <= 1 && absDx <= 1) return 'slopeWalk';
    return 'jumpArc';
  }

  traversalEdgeCost(type, fromTile, toTile) {
    const dx = Math.abs(toTile.x - fromTile.x);
    const dy = toTile.y - fromTile.y;
    if (type === 'walk' || type === 'slopeWalk' || type === 'corridorAdvance') return 0.85 + dx * 0.18;
    if (type === 'stepUp') return 1.1 + dx * 0.18;
    if (type === 'shortHop') return 2.6 + Math.abs(dy) * 0.5 + (dx === 0 ? 1.1 : 0);
    if (type === 'drop') return 1.6 + Math.max(0, dy) * 0.3;
    if (type === 'jumpArc') return 3.6 + Math.abs(dy) * 0.55 + dx * 0.22 + (dx === 0 ? 2.6 : 0);
    return 1.5;
  }

  connectSurfaceTransitions(graph, world, abilities) {
    const { surfaces, tileToSurface } = graph;
    const nodeEdges = graph.nodeEdges;
    const addEdge = (from, edge) => {
      if (!nodeEdges.has(from)) nodeEdges.set(from, []);
      const existing = nodeEdges.get(from).some((candidate) => (
        candidate.to === edge.to
        && candidate.type === edge.type
        && candidate.targetTile?.x === edge.targetTile?.x
        && candidate.targetTile?.y === edge.targetTile?.y
      ));
      if (!existing) nodeEdges.get(from).push(edge);
    };
    surfaces.forEach((surface) => {
      surface.tiles.forEach((fromTile) => {
        for (let dx = -2; dx <= 2; dx += 1) {
          for (let dy = -3; dy <= 3; dy += 1) {
            if (dx === 0 && dy === 0) continue;
            const toTile = { x: fromTile.x + dx, y: fromTile.y + dy, align: 'center' };
            const toSurface = tileToSurface.get(`${toTile.x},${toTile.y}`);
            if (!toSurface || toSurface === surface.id) continue;
            if (!this.canStandOnTile(toTile.x, toTile.y, world, abilities)) continue;
            const type = this.classifyTraversalEdgeType(fromTile, toTile, world, abilities);
            const validation = this.validateMovementEdge(fromTile, toTile, world, abilities);
            if (!validation?.ok) continue;
            const cost = this.traversalEdgeCost(type, fromTile, toTile) + (validation.cost || 0);
            addEdge(surface.id, {
              from: surface.id,
              to: toSurface,
              type,
              cost,
              sourceTile: { x: fromTile.x, y: fromTile.y, align: fromTile.align || 'center' },
              targetTile: { x: toTile.x, y: toTile.y, align: toTile.align || 'center' },
              launchProfile: validation.profile?.type || null,
              needAlign: Boolean(validation.needAlign)
            });
          }
        }
      });
    });
  }

  connectElevatorRoutes(graph, world, abilities) {
    const elevatorHints = this.buildElevatorHints(world, abilities);
    const { tileToSurface, nodeEdges } = graph;
    const addEdge = (from, edge) => {
      if (!nodeEdges.has(from)) nodeEdges.set(from, []);
      nodeEdges.get(from).push(edge);
    };
    elevatorHints.components.forEach((component, index) => {
      const elevatorNode = `elevator-${index}`;
      if (!nodeEdges.has(elevatorNode)) nodeEdges.set(elevatorNode, []);
      const boardBySurface = new Map();
      component.boardTiles.forEach((board) => {
        const sid = tileToSurface.get(`${board.x},${board.y}`);
        if (!sid) return;
        if (!boardBySurface.has(sid)) boardBySurface.set(sid, board);
      });
      const surfaceIds = Array.from(boardBySurface.keys());
      surfaceIds.forEach((sid) => {
        const board = boardBySurface.get(sid);
        addEdge(sid, {
          from: sid,
          to: elevatorNode,
          type: 'elevatorBoard',
          cost: 1.1,
          targetTile: board
        });
        addEdge(elevatorNode, {
          from: elevatorNode,
          to: sid,
          type: 'elevatorExit',
          cost: 1.1,
          targetTile: board
        });
      });
      for (let i = 0; i < surfaceIds.length; i += 1) {
        for (let j = i + 1; j < surfaceIds.length; j += 1) {
          const a = surfaceIds[i];
          const b = surfaceIds[j];
          const boardA = boardBySurface.get(a);
          const boardB = boardBySurface.get(b);
          const rideCost = 1.6 + Math.abs(boardA.y - boardB.y) * 0.2;
          addEdge(a, {
            from: a,
            to: b,
            type: 'elevatorRide',
            cost: rideCost,
            targetTile: boardB
          });
          addEdge(b, {
            from: b,
            to: a,
            type: 'elevatorRide',
            cost: rideCost,
            targetTile: boardA
          });
        }
      }
    });
  }

  buildTraversalGraph(start, goal, world, abilities) {
    const state = this.navState;
    const cacheKey = this.getTraversalGraphCacheKey(start, goal, world);
    const cached = state.surfaceGraphCache;
    if (cached?.key === cacheKey && cached.age < 0.45) return cached.graph;

    const marginX = 26;
    const marginY = 16;
    const minX = Math.max(0, Math.min(start.x, goal.x) - marginX);
    const maxX = Math.min(world.width - 1, Math.max(start.x, goal.x) + marginX);
    const minY = Math.max(1, Math.min(start.y, goal.y) - marginY);
    const maxY = Math.min(world.height - 2, Math.max(start.y, goal.y) + marginY);

    const walkable = new Map();
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (!this.canStandOnTile(x, y, world, abilities)) continue;
        walkable.set(`${x},${y}`, { x, y, align: 'center' });
      }
    }

    const { surfaces, tileToSurface } = this.classifySurfaceSegments(walkable);
    const nodeEdges = new Map();
    surfaces.forEach((surface) => nodeEdges.set(surface.id, []));
    const graph = { surfaces, tileToSurface, nodeEdges };
    this.connectSurfaceTransitions(graph, world, abilities);
    this.connectElevatorRoutes(graph, world, abilities);
    state.surfaceGraphCache = { key: cacheKey, graph, age: 0 };
    return graph;
  }

  getSurfaceForTile(tile, graph) {
    return graph.tileToSurface.get(`${tile.x},${tile.y}`) || null;
  }

  heuristicSurfaceDistance(node, goalNode, graph) {
    if (node === goalNode) return 0;
    const sNode = graph.surfaces.find((surface) => surface.id === node);
    const sGoal = graph.surfaces.find((surface) => surface.id === goalNode);
    if (!sNode || !sGoal) return 2;
    return Math.abs(sNode.anchor.x - sGoal.anchor.x) + Math.abs(sNode.anchor.y - sGoal.anchor.y) * 1.2;
  }

  isJumpProfile(profile) {
    return profile === 'diagJump'
      || profile === 'verticalJump'
      || profile === 'upThenDrift'
      || profile === 'stepUp'
      || profile === 'shortHopForward'
      || profile === 'lowCeilingStep'
      || profile === 'paramJump';
  }

  isJumpTransitionEdge(edge) {
    const profile = edge?.profile?.type;
    return this.isJumpProfile(profile)
      || edge?.transitionType === 'jumpArc'
      || edge?.transitionType === 'shortHop';
  }

  isNearTile(tile, world, tolerance = 0.55) {
    if (!tile) return false;
    const center = this.tileCenter(tile, world);
    return Math.abs(this.x - center.x) <= world.tileSize * tolerance
      && Math.abs(this.y - center.y) <= world.tileSize * tolerance;
  }

  findTraversalRoute(startTile, goalTile, world, abilities) {
    const graph = this.buildTraversalGraph(startTile, goalTile, world, abilities);
    const startSurface = this.getSurfaceForTile(startTile, graph);
    const goalSurface = this.getSurfaceForTile(goalTile, graph);
    if (!startSurface || !goalSurface) {
      return { route: [], graph, startSurface, goalSurface };
    }
    if (startSurface === goalSurface) {
      return { route: [], graph, startSurface, goalSurface };
    }
    const open = new MinBinaryHeap();
    const gScore = new Map([[startSurface, 0]]);
    const parent = new Map([[startSurface, null]]);
    const viaEdge = new Map();
    open.push({ key: startSurface, score: 0 });
    let expanded = 0;
    const maxExpanded = 180;
    const goalIsAbove = goalTile.y < startTile.y;
    while (open.size && expanded < maxExpanded) {
      const current = open.pop()?.key;
      if (!current) break;
      expanded += 1;
      if (current === goalSurface) break;
      const edges = graph.nodeEdges.get(current) || [];
      const prevNode = parent.get(current);
      for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        const isBacktrack = prevNode && edge.to === prevNode;
        const backtrackPenalty = isBacktrack ? 1.25 : 0;
        const upwardBonus = goalIsAbove && (edge.type === 'stepUp' || edge.type === 'shortHop' || edge.type === 'elevatorRide') ? -0.35 : 0;
        const tentative = (gScore.get(current) ?? Infinity) + edge.cost + backtrackPenalty + upwardBonus;
        if (tentative >= (gScore.get(edge.to) ?? Infinity)) continue;
        gScore.set(edge.to, tentative);
        parent.set(edge.to, current);
        viaEdge.set(edge.to, edge);
        const h = this.heuristicSurfaceDistance(edge.to, goalSurface, graph);
        open.push({ key: edge.to, score: tentative + h });
      }
    }
    if (!parent.has(goalSurface)) {
      return { route: [], graph, startSurface, goalSurface };
    }
    const route = [];
    let cursor = goalSurface;
    while (cursor && cursor !== startSurface) {
      const edge = viaEdge.get(cursor);
      if (!edge) break;
      route.unshift(edge);
      cursor = parent.get(cursor);
    }
    return { route, graph, startSurface, goalSurface };
  }

  buildSegmentsFromTraversalRoute(route, goalTile) {
    if (!route.length) return [];
    return route.map((edge) => ({
      tile: edge.targetTile || goalTile,
      edge: {
        profile: {
          type: edge.launchProfile
            || (edge.type === 'jumpArc'
            ? 'diagJump'
            : edge.type === 'shortHop'
              ? 'shortHopForward'
              : edge.type)
        },
        sourceTile: edge.sourceTile || null,
        targetTile: edge.targetTile || goalTile,
        needAlign: Boolean(edge.needAlign),
        transitionType: edge.type
      }
    }));
  }

  buildDirectSurfaceSegment(startTile, targetTile) {
    const dx = targetTile.x - startTile.x;
    const dy = targetTile.y - startTile.y;
    let profile = 'walk';
    if (Math.abs(dy) <= 1 && Math.abs(dx) <= 2) {
      profile = dy < 0 ? 'stepUp' : 'corridorAdvance';
    } else if (Math.abs(dy) <= 1) {
      profile = 'slopeWalk';
    }
    return [{
      tile: targetTile,
      edge: { profile: { type: profile } }
    }];
  }

  planLocalRoute(start, goal, world, abilities) {
    const maxNodes = 80;
    const queue = [start];
    const parents = new Map([[this.tileKey(start), null]]);
    const meta = new Map();
    let seen = 0;
    while (queue.length && seen < maxNodes) {
      const current = queue.shift();
      if (!current) break;
      seen += 1;
      if (current.x === goal.x && current.y === goal.y) break;
      const candidates = this.getNeighborCandidates(current, world, abilities, goal);
      for (let i = 0; i < candidates.length; i += 1) {
        const next = candidates[i];
        if (Math.abs(next.x - start.x) > 8 || Math.abs(next.y - start.y) > 6) continue;
        const key = this.tileKey(next);
        if (parents.has(key)) continue;
        const edge = this.validateMovementEdge(current, next, world, abilities);
        if (!edge?.ok) continue;
        parents.set(key, this.tileKey(current));
        meta.set(key, edge);
        queue.push(next);
      }
    }
    return this.rebuildPath(parents, meta, start, goal);
  }

  planSmartRouteAStar(start, goal, world, abilities) {
    const state = this.navState;
    const cacheKey = `${this.tileKey(start)}=>${this.tileKey(goal)}`;
    const cached = state.pathCache.get(cacheKey);
    if (cached && cached.age < 1.3) {
      state.lastRouteFromCache = true;
      return cached.path;
    }
    state.lastRouteFromCache = false;

    const open = new MinBinaryHeap();
    const gScore = new Map();
    const parent = new Map([[this.tileKey(start), null]]);
    const meta = new Map();
    const startKey = this.tileKey(start);
    gScore.set(startKey, 0);
    open.push({ key: startKey, tile: start, score: 0 });
    const maxNodes = 280;
    let expanded = 0;

    while (open.size && expanded < maxNodes) {
      const currentNode = open.pop();
      if (!currentNode) break;
      const current = currentNode.tile;
      expanded += 1;
      if (current.x === goal.x && current.y === goal.y) {
        const result = this.rebuildPath(parent, meta, start, goal);
        if (result.length) state.pathCache.set(cacheKey, { path: result, age: 0 });
        return result;
      }
      const candidates = this.getNeighborCandidates(current, world, abilities, goal);
      for (let i = 0; i < candidates.length; i += 1) {
        const next = candidates[i];
        if (Math.abs(next.x - start.x) > 16 || Math.abs(next.y - start.y) > 12) continue;
        const edge = this.validateMovementEdge(current, next, world, abilities);
        if (!edge?.ok) continue;
        const nextKey = this.tileKey(next);
        const currentScore = gScore.get(this.tileKey(current)) ?? Infinity;
        const tentative = currentScore + edge.cost + Math.abs(next.y - current.y) * 0.2;
        if (tentative >= (gScore.get(nextKey) ?? Infinity)) continue;
        parent.set(nextKey, this.tileKey(current));
        meta.set(nextKey, edge);
        gScore.set(nextKey, tentative);
        const h = Math.abs(goal.x - next.x) + Math.abs(goal.y - next.y) * 1.35;
        const f = tentative + h;
        open.push({ key: nextKey, tile: next, score: f });
      }
    }
    return [];
  }

  rebuildPath(parents, meta, start, goal) {
    const goalKey = this.tileKey(goal);
    if (!parents.has(goalKey)) return [];
    const path = [];
    let key = goalKey;
    while (key && key !== this.tileKey(start)) {
      const [x, y] = key.split(',');
      path.unshift({ tile: { x: Number(x), y: Number(y), align: 'center' }, edge: meta.get(key) || null });
      key = parents.get(key);
    }
    return path;
  }

  ageNavigationCaches(dt) {
    const state = this.navState;
    if (state.surfaceGraphCache) {
      state.surfaceGraphCache.age += dt;
      if (state.surfaceGraphCache.age > 0.8) state.surfaceGraphCache = null;
    }
    state.pathCache.forEach((value, key) => {
      value.age += dt;
      if (value.age > 2.5) state.pathCache.delete(key);
    });
    state.poisonedEdges.forEach((value, key) => {
      value.ttl -= dt;
      if (value.ttl <= 0) state.poisonedEdges.delete(key);
    });
    state.jumpContextBlocks.forEach((value, key) => {
      value.ttl -= dt;
      if (value.ttl <= 0) state.jumpContextBlocks.delete(key);
    });
  }

  edgeAttemptKey(from, to, profile) {
    return `${this.tileKey(from)}>${this.tileKey(to)}:${profile}`;
  }

  getSegmentSourceNode(path, index, currentNode) {
    if (index <= 0) return currentNode;
    const prevSegment = path[index - 1];
    const prev = prevSegment?.edge?.targetTile || prevSegment?.tile;
    return prev || currentNode;
  }

  markEdgeFailure(from, to, profile) {
    const state = this.navState;
    const key = this.edgeAttemptKey(from, to, profile);
    const prev = state.poisonedEdges.get(key);
    const fails = (prev?.fails || 0) + 1;
    const jumpLike = this.isJumpProfile(profile);
    state.poisonedEdges.set(key, {
      fails,
      ttl: jumpLike
        ? Math.min(1.7, 0.7 + fails * 0.22)
        : Math.min(2.2, 0.9 + fails * 0.35)
    });
  }

  isEdgePoisoned(from, to, profile) {
    const state = this.navState;
    const key = this.edgeAttemptKey(from, to, profile);
    const data = state.poisonedEdges.get(key);
    const threshold = this.isJumpProfile(profile) ? 3 : 2;
    return Boolean(data && data.ttl > 0 && data.fails >= threshold);
  }

  isRouteStillValid(path, world, abilities) {
    if (!path.length) return false;
    const current = this.getFootStandTile(world);
    const firstSegment = path[0];
    const first = this.isJumpTransitionEdge(firstSegment?.edge) && firstSegment?.edge?.sourceTile
      ? firstSegment.edge.sourceTile
      : firstSegment?.tile;
    if (!first) return false;
    if (Math.abs(first.x - current.x) > 4 || Math.abs(first.y - current.y) > 3) return false;
    const lookahead = Math.min(3, path.length);
    for (let i = 0; i < lookahead; i += 1) {
      const segment = path[i];
      const source = this.getSegmentSourceNode(path, i, current);
      if (!segment?.tile || !this.canStandOnTile(segment.tile.x, segment.tile.y, world, abilities)) return false;
      if (segment.edge?.profile?.type && this.isEdgePoisoned(source, segment.tile, segment.edge.profile.type)) return false;
    }
    return true;
  }

  getJumpContextKey(source, target, profile) {
    const src = source ? this.tileKey(source) : 'none';
    const dst = target ? this.tileKey(target) : 'none';
    const family = profile?.startsWith('pj:') ? 'paramJump' : profile;
    return `${src}->${dst}:${family || 'jump'}`;
  }

  markJumpContextBlocked(source, target, profile, ttl = 1.1) {
    const key = this.getJumpContextKey(source, target, profile);
    this.navState.jumpContextBlocks.set(key, { ttl });
  }

  isJumpContextBlocked(source, target, profile) {
    const key = this.getJumpContextKey(source, target, profile);
    const data = this.navState.jumpContextBlocks.get(key);
    return Boolean(data && data.ttl > 0);
  }

  findBestGroundedProgressEdge(startTile, targetTile, world, abilities) {
    const candidates = this.getNeighborCandidates(startTile, world, abilities, targetTile);
    const startDist = this.routeTileDistance(startTile, targetTile);
    let best = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const next = candidates[i];
      if (Math.abs(next.y - startTile.y) > 1) continue;
      const edge = this.validateMovementEdge(startTile, next, world, abilities);
      if (!edge?.ok) continue;
      if (this.isJumpProfile(edge.profile?.type)) continue;
      const dist = this.routeTileDistance(next, targetTile);
      const gain = startDist - dist;
      if (gain < 0.35) continue;
      const score = dist + edge.cost * 0.35;
      if (!best || score < best.score) {
        best = { tile: next, edge, score, gain };
      }
    }
    return best;
  }

  chooseRecoveryAction(targetTile, world) {
    const dir = Math.sign(targetTile.x - this.getFootStandTile(world).x) || this.facing || 1;
    return {
      mode: 'recovery',
      moveProfile: dir > 0 ? 'recovery-right' : 'recovery-left',
      input: dir > 0 ? new Set(['right']) : new Set(['left']),
      commit: 0.16
    };
  }

  chooseMoveFromPath(path, world) {
    if (!path.length) return null;
    const segment = path[0];
    const edge = segment.edge || {};
    const takeoffTile = edge.sourceTile || null;
    const landingTile = edge.targetTile || segment.tile;
    const isJumpTransition = this.isJumpTransitionEdge(edge);
    const takeoffTolerance = isJumpTransition ? 0.72 : 0.45;
    const atTakeoff = !takeoffTile || this.isNearTile(takeoffTile, world, takeoffTolerance);
    const useTakeoffPrep = isJumpTransition && !atTakeoff;
    const activeTile = useTakeoffPrep ? takeoffTile : landingTile;
    const worldTarget = this.tileCenter(activeTile || segment.tile, world);
    return {
      target: worldTarget,
      nextTile: activeTile || segment.tile,
      edge: {
        ...edge,
        takeoffTile,
        landingTile,
        executionStage: useTakeoffPrep ? 'takeoff-prep' : (isJumpTransition ? 'launch' : 'travel')
      }
    };
  }

  getExecutionSignature(sourceNode, move, profile) {
    const src = sourceNode ? this.tileKey(sourceNode) : 'none';
    const dst = move?.nextTile ? this.tileKey(move.nextTile) : 'none';
    return `${profile}:${src}->${dst}`;
  }

  shouldRestartExecution(execution, sourceNode, move, profile, forceRestart = false) {
    if (forceRestart || !execution.active) return true;
    if (execution.profile !== profile) {
      const bothJumpLike = this.isJumpProfile(execution.profile) && this.isJumpProfile(profile);
      if (!bothJumpLike) return true;
    }
    if (!move?.nextTile || !execution.targetNode) return true;
    const sameTarget = this.tileKey(execution.targetNode) === this.tileKey(move.nextTile);
    if (!sameTarget) {
      const closeTile = execution.targetNode.x === move.nextTile.x && execution.targetNode.y === move.nextTile.y;
      const alignCompat = execution.targetNode.align === move.nextTile.align
        || execution.phase === 'travel'
        || profile === 'walk'
        || profile === 'direct';
      const tinyDrift = Math.abs(execution.targetNode.x - move.nextTile.x) <= 1 && Math.abs(execution.targetNode.y - move.nextTile.y) <= 1;
      if (!(closeTile && alignCompat) && !(tinyDrift && this.isJumpProfile(profile))) return true;
    }
    if (execution.phase === 'align' || execution.phase === 'launch') return false;
    if (execution.sourceNode && sourceNode) {
      const movedTooFar = Math.abs(execution.sourceNode.x - sourceNode.x) > 1 || Math.abs(execution.sourceNode.y - sourceNode.y) > 1;
      if (movedTooFar) return true;
    }
    return false;
  }

  beginMoveExecution(move, profile, world) {
    if (!move) return;
    const dir = Math.sign((move.target?.x || this.x) - this.x) || this.facing || 1;
    const transitionStage = move?.edge?.executionStage || null;
    this.moveExecution = {
      active: true,
      profile,
      phase: transitionStage === 'takeoff-prep'
        ? 'takeoff-prep'
        : profile === 'upThenDrift'
        ? 'align'
        : (profile.startsWith('microAlign') || profile === 'settleCenter')
          ? 'align'
          : (profile === 'stepUp' || profile === 'shortHopForward' || profile === 'lowCeilingStep')
            ? 'launch'
            : 'travel',
      elapsed: 0,
      hold: transitionStage === 'takeoff-prep' ? 0.24 : profile === 'upThenDrift' ? 0.22 : profile.startsWith('microAlign') ? 0.12 : 0.18,
      lockDirection: dir,
      sourceNode: this.getFootStandTile(world),
      targetNode: move.nextTile,
      takeoffTile: move?.edge?.takeoffTile || move?.edge?.sourceTile || null,
      landingTile: move?.edge?.landingTile || move?.edge?.targetTile || move.nextTile,
      transitionStage,
      profileSignature: move?.edge?.profile?.signature || profile
    };
  }

  buildExecutionIntent(execution, dx, dy, world, dt) {
    const input = new Set();
    const dir = execution.lockDirection || (dx < 0 ? -1 : 1);
    const profile = execution.profile;
    if (execution.phase === 'takeoff-prep') {
      if (dx < -8) input.add('left');
      if (dx > 8) input.add('right');
      const closeEnough = Math.abs(dx) <= world.tileSize * 0.28;
      if (closeEnough || execution.elapsed > execution.hold) {
        execution.phase = this.isJumpProfile(profile) ? 'launch' : 'travel';
      }
      return input;
    }
    if (execution.phase === 'align') {
      if (profile === 'microAlignLeft') input.add('left');
      else if (profile === 'microAlignRight') input.add('right');
      else if (profile === 'settleCenter') {
        const align = this.getAlignmentBucket(world);
        if (align === 'left') input.add('right');
        if (align === 'right') input.add('left');
      } else if (profile === 'upThenDrift') {
        if (Math.abs(dx) > world.tileSize * 0.2) input.add(dir < 0 ? 'left' : 'right');
      }
      if (execution.elapsed > execution.hold * 0.5 && (profile === 'upThenDrift' || profile === 'settleCenter')) {
        execution.phase = 'launch';
      }
      return input;
    }
    if (execution.phase === 'launch') {
      if (execution.takeoffTile && !this.isNearTile(execution.takeoffTile, world, 0.7) && this.onGround) {
        execution.phase = 'travel';
        this.navState.jumpCancelReason = 'invalid-takeoff';
        return input;
      }
      input.add('jump');
      if (profile === 'diagJump' || profile === 'stepUp' || profile === 'shortHopForward' || profile === 'lowCeilingStep' || profile === 'paramJump') {
        input.add(dir < 0 ? 'left' : 'right');
      }
      if (execution.elapsed > 0.08) {
        execution.phase = profile === 'upThenDrift' ? 'drift' : 'travel';
      }
      return input;
    }
    if (execution.phase === 'drift') {
      input.add(dir < 0 ? 'left' : 'right');
      if (execution.elapsed > execution.hold) execution.phase = 'travel';
      return input;
    }
    if (profile === 'elevatorRide') {
      if (Math.abs(dx) > 6) input.add(dx < 0 ? 'left' : 'right');
      return input;
    }
    if (dx < -10) input.add('left');
    if (dx > 10) input.add('right');
    if (profile === 'drop' && this.onGround && Math.abs(dx) < world.tileSize * 0.65 && dy > world.tileSize * 0.9) {
      input.add('down');
      input.add('jump');
    }
    if ((profile === 'diagJump' || profile === 'verticalJump' || profile === 'upThenDrift'
      || profile === 'paramJump'
      || profile === 'stepUp' || profile === 'shortHopForward' || profile === 'lowCeilingStep')
      && (this.onGround || this.coyote > 0) && this.jumpDecisionCooldown <= 0) {
      if (this.navState.jumpSuppressionTimer > 0 && profile !== 'stepUp' && profile !== 'shortHopForward') {
        this.navState.jumpCancelReason = 'anti-pogo-suppress';
        return input;
      }
      if (execution.takeoffTile && !this.isNearTile(execution.takeoffTile, world, 0.72)) {
        this.navState.jumpCancelReason = 'takeoff-drift';
        return input;
      }
      if (Math.abs(dx) < world.tileSize * 0.18 && this.navState.jumpLoopCounter >= 1) {
        this.navState.jumpCancelReason = 'useless-bounce';
        return input;
      }
      if (execution.landingTile) {
        const landing = this.tileCenter(execution.landingTile, world);
        const advance = Math.hypot(this.x - landing.x, this.y - landing.y);
        const targetAdvance = Math.hypot((this.x + (dir < 0 ? -world.tileSize : world.tileSize)) - landing.x, this.y - world.tileSize * 0.4 - landing.y);
        if (targetAdvance >= advance - 2) {
          this.navState.jumpCancelReason = 'no-route-advance';
          return input;
        }
      }
      input.add('jump');
      if (profile === 'diagJump' || (profile === 'upThenDrift' && execution.phase === 'drift')) {
        input.add(dir < 0 ? 'left' : 'right');
      }
      this.jumpDecisionCooldown = 0.18;
    }
    return input;
  }

  applyMoveIntent(move, targetWorld, world, abilities, dt) {
    const nextInput = new Set();
    const activeTarget = move?.target || targetWorld;
    const dx = activeTarget.x - this.x;
    const dy = activeTarget.y - this.y;
    const profile = move?.edge?.profile?.type || 'direct';
    const execution = this.moveExecution;
    const sourceNode = this.getFootStandTile(world);
    const nextPoisoned = move?.edge?.profile?.type
      ? this.isEdgePoisoned(sourceNode, move?.nextTile, move.edge.profile.type)
      : false;
    if (this.shouldRestartExecution(execution, sourceNode, move, profile, nextPoisoned)) {
      this.beginMoveExecution(move, profile, world);
    }
    if (this.isJumpProfile(profile)
      && this.isJumpContextBlocked(this.moveExecution.sourceNode, this.moveExecution.landingTile || this.moveExecution.targetNode, this.moveExecution.profileSignature || profile)) {
      this.moveExecution.active = false;
      this.moveExecution.phase = 'idle';
      this.navState.replanCooldown = 0;
      this.navState.jumpCancelReason = 'jump-context-blocked';
      return { input: new Set(), profile: 'replan' };
    }
    if (this.isJumpProfile(profile) && move?.edge?.takeoffTile && !this.isNearTile(move.edge.takeoffTile, world, 1.25) && this.navState.noProgressTimer > 0.25) {
      this.moveExecution.active = false;
      this.moveExecution.phase = 'idle';
      this.navState.replanCooldown = 0;
      this.navState.jumpCancelReason = 'stale-jump-context';
      return { input: new Set(), profile: 'replan' };
    }
    this.moveExecution.elapsed += dt;
    const phaseInput = this.buildExecutionIntent(this.moveExecution, dx, dy, world, dt);
    if (phaseInput.has('jump') && !this.navState.jumpInFlight) {
      this.navState.jumpInFlight = true;
      this.navState.jumpStartTile = sourceNode;
      this.navState.jumpLandingTile = this.moveExecution.landingTile || this.moveExecution.targetNode || move?.nextTile || null;
      this.navState.jumpRouteDistanceBefore = this.routeTileDistance(sourceNode, move?.nextTile || this.navState.targetTile);
    }
    phaseInput.forEach((key) => nextInput.add(key));

    // fallback direct drive to avoid any idle "thinking pauses" while planning updates.
    if (!nextInput.size) {
      const deadzone = world.tileSize * 0.4;
      if (Math.abs(dx) > deadzone) {
        if (dx < -10) nextInput.add('left');
        if (dx > 10) nextInput.add('right');
      }
    }

    return { input: nextInput, profile };
  }

  updateNavigation(dt, player, world, abilities) {
    const state = this.navState;
    state.replanCooldown = Math.max(0, state.replanCooldown - dt);
    state.restLockTimer = Math.max(0, state.restLockTimer - dt);
    state.oscillationDampTimer = Math.max(0, state.oscillationDampTimer - dt);
    state.jumpSuppressionTimer = Math.max(0, state.jumpSuppressionTimer - dt);
    this.jumpDecisionCooldown = Math.max(0, this.jumpDecisionCooldown - dt);
    this.jumpSuppressTimer = Math.max(0, this.jumpSuppressTimer - dt);
    this.ageNavigationCaches(dt);

    const navTarget = this.buildNavigationTarget(player, world, abilities);
    const targetTile = navTarget.tile;
    const targetWorld = navTarget.world;
    const startTile = this.getFootStandTile(world);
    const distToFollow = Math.hypot(targetWorld.x - this.x, targetWorld.y - this.y);
    const playerStill = this.isPlayerMostlyStill(player);
    const arrivalDeadzone = world.tileSize * 0.42;
    if (this.navState.jumpInFlight && this.justLanded) {
      const jumpStart = state.jumpStartTile || startTile;
      const landing = this.getFootStandTile(world);
      const before = Number.isFinite(state.jumpRouteDistanceBefore) ? state.jumpRouteDistanceBefore : this.routeTileDistance(jumpStart, targetTile);
      const after = this.routeTileDistance(landing, targetTile);
      state.jumpRouteDistanceAfter = after;
      const sameNeighborhood = Math.abs(landing.x - jumpStart.x) <= 1 && Math.abs(landing.y - jumpStart.y) <= 1;
      const meaningful = (before - after) > 1.2 && !sameNeighborhood;
      state.jumpMeaningfulLast = meaningful;
      if (!meaningful) {
        const prof = this.moveExecution.profileSignature || this.moveExecution.profile || 'jump';
        this.markJumpContextBlocked(state.jumpStartTile, state.jumpLandingTile || landing, prof, 1.25);
        this.markEdgeFailure(state.jumpStartTile || jumpStart, state.jumpLandingTile || landing, prof);
        state.jumpSuppressionTimer = Math.max(state.jumpSuppressionTimer, 0.75);
        state.replanCooldown = 0;
      }
      state.jumpInFlight = false;
      state.jumpStartTile = null;
      state.jumpLandingTile = null;
      state.jumpRouteDistanceBefore = Infinity;
    }
    if (this.justJumped) {
      const horizontalProgress = Math.abs(this.x - state.lastJumpX);
      const improvedRoute = distToFollow < state.lastRouteDistance - 6;
      if (horizontalProgress < 8 && !improvedRoute) {
        state.jumpNoProgressStreak += 1;
      } else {
        state.jumpNoProgressStreak = Math.max(0, state.jumpNoProgressStreak - 1);
      }
      if (state.jumpNoProgressStreak >= 2) {
        state.jumpSuppressionTimer = 0.65;
        state.jumpCancelReason = 'pogo-loop';
      }
    }
    state.lastRouteDistance = distToFollow;
    if (this.shouldStayInRestMode(player, world, abilities)) {
      state.restMode = true;
      state.settled = true;
      this.moveExecution.active = false;
      this.moveExecution.phase = 'idle';
      this.navDebug.arrivalDeadzoneActive = true;
      this.navDebug.settledActive = true;
      this.navDebug.restModeActive = true;
      return { mode: 'direct', input: new Set(), moveProfile: 'rest', targetTile: state.restTile };
    }
    if (playerStill && distToFollow <= arrivalDeadzone && Math.abs(this.vx) < 22 && Math.abs(this.vy) < 30) {
      state.settled = true;
      state.restMode = true;
      state.restTile = state.stableFollowTile ? { ...state.stableFollowTile } : { ...targetTile };
      state.restLockTimer = 0.55;
      state.mode = 'direct';
      state.path = [];
      state.targetTile = targetTile;
      state.nextNode = null;
      state.moveProfile = 'settled';
      this.moveExecution.active = false;
      this.moveExecution.phase = 'idle';
      this.navDebug.mode = state.mode;
      this.navDebug.targetTile = `${targetTile.x},${targetTile.y}`;
      this.navDebug.nextPathNode = 'none';
      this.navDebug.moveProfile = 'settled';
      this.navDebug.executionPhase = 'idle';
      this.navDebug.arrivalDeadzoneActive = true;
      this.navDebug.settledActive = true;
      this.navDebug.restModeActive = true;
      this.navDebug.stableFollowTile = state.stableFollowTile ? this.tileKey(state.stableFollowTile) : 'none';
      return { mode: 'direct', input: new Set(), moveProfile: 'settled', targetTile };
    }
    state.settled = false;
    state.restMode = false;

    this.updateUpwardPursuitState(dt, player, startTile, targetTile);
    this.detectStuckState(dt, targetWorld);
    const desiredMode = this.chooseNavigationMode(targetTile, world, abilities);
    const verticalToTarget = targetTile.y - startTile.y;
    const surfacePlan = this.findTraversalRoute(startTile, targetTile, world, abilities);
    const sameSurface = Boolean(surfacePlan.startSurface && surfacePlan.goalSurface && surfacePlan.startSurface === surfacePlan.goalSurface);
    const forceRoute = this.shouldForceRouteBecauseVerticalMismatch(startTile, targetTile)
      || this.detectJumpSpamFailure()
      || (state.upwardPursuitTimer > 0 && targetTile.y < startTile.y);

    let path = state.path;
    let reason = 'commit';
    let routeKeepReason = 'none';
    let replanDeferred = false;
    const inCommittedJump = this.moveExecution.phase === 'takeoff-prep'
      || (!this.onGround
        && (this.moveExecution.phase === 'launch' || this.moveExecution.phase === 'drift' || this.isJumpProfile(this.moveExecution.profile)));
    const targetChanged = !state.targetTile
      || Math.abs((state.targetTile.x || 0) - targetTile.x) > 1
      || Math.abs((state.targetTile.y || 0) - targetTile.y) > 1;
    const canKeepRoute = this.isRouteStillValid(path, world, abilities) && (!targetChanged || inCommittedJump);
    if (state.commitTimer <= 0 && (desiredMode !== state.mode || this.shouldEscalateToPlanner(targetTile, world))) {
      state.mode = desiredMode;
      reason = `mode:${desiredMode}`;
    }
    if (canKeepRoute && state.mode !== 'direct') {
      reason = 'route-commit';
      routeKeepReason = inCommittedJump ? 'jump-commit' : (targetChanged ? 'target-shift-small' : 'path-still-valid');
      replanDeferred = true;
      state.replanCooldown = Math.max(state.replanCooldown, 0.12);
    }

    const horizontalDir = Math.sign(targetWorld.x - this.x) || this.facing || 1;
    const blockedTowardTarget = this.isForwardBlocked(world, abilities, horizontalDir);
    const shouldForceClimb = state.upwardPursuitTimer > 0
      && targetTile.y < startTile.y
      && blockedTowardTarget
      && (this.onGround || this.coyote > 0);
    state.forcedClimbTriggered = shouldForceClimb;
    state.forcedClimbJumpAllowed = false;

    const elevatedDetourNeeded = targetTile.y < startTile.y - 1 && !this.isNearTile(path[0]?.edge?.sourceTile || targetTile, world, 0.75);
    if (sameSurface
      && !forceRoute
      && !blockedTowardTarget
      && !elevatedDetourNeeded
      && state.stuckCounter < 2
      && Math.abs(verticalToTarget) <= 2
      && state.upwardPursuitTimer <= 0) {
      state.mode = 'direct';
      path = this.buildDirectSurfaceSegment(startTile, targetTile);
      reason = 'surface-direct';
    } else if ((!canKeepRoute || state.mode !== 'direct') && !inCommittedJump && this.shouldReplan(targetTile, reason)) {
      path = this.buildSegmentsFromTraversalRoute(surfacePlan.route, targetTile);
      state.replanCooldown = 0.22;
      reason = path.length ? 'surface-route' : 'surface-route-fail';
    }
    if (shouldForceClimb && path.length) {
      const first = path[0];
      const jumpLikeFirst = this.isJumpProfile(first?.edge?.profile?.type);
      const nearTakeoff = !first?.edge?.sourceTile || this.isNearTile(first.edge.sourceTile, world, 0.9);
      const usefulJump = jumpLikeFirst && Math.abs((first.edge?.targetTile?.x || startTile.x) - (first.edge?.sourceTile?.x || startTile.x)) > 0;
      state.forcedClimbJumpAllowed = Boolean(usefulJump && nearTakeoff && targetTile.y < startTile.y);
      if (state.forcedClimbJumpAllowed) reason = 'obstacle-forced-climb';
    }

    if (!path.length && (state.stuckCounter >= 2 || this.detectJumpSpamFailure())) {
      const recovery = this.chooseRecoveryAction(targetTile, world);
      state.mode = recovery.mode;
      state.moveProfile = recovery.moveProfile;
      state.commitTimer = recovery.commit;
      state.replanCooldown = 0.18;
      state.path = [];
      state.activeReason = 'recovery';
      return recovery;
    }

    state.path = path;
    state.targetTile = targetTile;
    state.routeTargetKey = this.tileKey(targetTile);
    state.routeAge += dt;
    let nextMove = this.chooseMoveFromPath(path, world);
    const groundedAlt = this.findBestGroundedProgressEdge(startTile, targetTile, world, abilities);
    const selectedEdgeType = nextMove?.edge?.transitionType || nextMove?.edge?.profile?.type || 'direct';
    const selectedJumpLike = this.isJumpTransitionEdge(nextMove?.edge);
    if (selectedJumpLike && groundedAlt) {
      const jumpDist = this.routeTileDistance(nextMove?.edge?.landingTile || nextMove?.nextTile || startTile, targetTile);
      const groundDist = this.routeTileDistance(groundedAlt.tile, targetTile);
      const groundingClearlyBetter = groundDist + 0.35 < jumpDist;
      if (groundingClearlyBetter) {
        nextMove = {
          target: this.tileCenter(groundedAlt.tile, world),
          nextTile: groundedAlt.tile,
          edge: {
            profile: groundedAlt.edge.profile,
            sourceTile: startTile,
            targetTile: groundedAlt.tile,
            transitionType: 'grounded-reposition'
          }
        };
        reason = 'prefer-grounded-ascent';
      }
    }
    const intent = this.applyMoveIntent(nextMove, targetWorld, world, abilities, dt);
    const lateralDir = intent.input.has('left') ? -1 : intent.input.has('right') ? 1 : 0;
    const nearTargetForDamping = playerStill && distToFollow <= world.tileSize * 0.75;
    if (nearTargetForDamping && lateralDir !== 0 && state.lastLateralDir !== 0 && lateralDir !== state.lastLateralDir) {
      state.lateralFlipCount += 1;
    } else if (lateralDir !== 0) {
      state.lateralFlipCount = Math.max(0, state.lateralFlipCount - 1);
    }
    state.lastLateralDir = lateralDir || state.lastLateralDir;
    if (nearTargetForDamping && state.lateralFlipCount >= 2) {
      state.oscillationDampTimer = 0.22;
      state.lateralFlipCount = 0;
      this.moveExecution.active = false;
      this.moveExecution.phase = 'idle';
      intent.input.clear();
      state.jumpCancelReason = 'oscillation-damped';
    }
    if (state.oscillationDampTimer > 0) {
      intent.input.clear();
    }
    const activeExec = this.moveExecution;
    const failedEdgeProfile = activeExec?.profile && activeExec.profile !== 'direct'
      ? (activeExec.profileSignature || activeExec.profile)
      : (nextMove?.edge?.profile?.signature || nextMove?.edge?.profile?.type);
    const takeoffContextValid = !activeExec?.takeoffTile || this.isNearTile(activeExec.takeoffTile, world, 0.75);
    if (failedEdgeProfile && state.stuckCounter >= 2 && state.noProgressTimer > 0.25 && takeoffContextValid) {
      const failSource = activeExec?.sourceNode || startTile;
      const failTarget = activeExec?.targetNode || nextMove?.nextTile;
      if (failTarget) this.markEdgeFailure(failSource, failTarget, failedEdgeProfile);
      reason = 'edge-poisoned';
      state.replanCooldown = 0;
      state.lastEdgePoisoned = true;
      state.lastPoisonReason = activeExec?.phase === 'launch' || activeExec?.phase === 'drift'
        ? 'launch-failure'
        : 'takeoff-context';
    } else {
      state.lastEdgePoisoned = false;
      if (failedEdgeProfile && state.stuckCounter >= 2 && state.noProgressTimer > 0.25 && !takeoffContextValid) {
        state.lastPoisonReason = 'wrong-position';
      }
    }

    const moveSignature = `${state.mode}:${intent.profile}:${nextMove?.nextTile ? this.tileKey(nextMove.nextTile) : 'direct'}`;
    this.updateRouteCommitment(dt, moveSignature);

    state.nextNode = nextMove?.nextTile || null;
    state.moveProfile = intent.profile;
    state.activeReason = reason;

    this.navDebug.mode = state.mode;
    this.navDebug.targetTile = `${targetTile.x},${targetTile.y}`;
    this.navDebug.nextPathNode = state.nextNode ? `${state.nextNode.x},${state.nextNode.y}` : 'none';
    this.navDebug.moveProfile = state.moveProfile;
    this.navDebug.executionPhase = this.moveExecution.phase;
    this.navDebug.alignmentBucket = this.getAlignmentBucket(world);
    this.navDebug.stuckCounter = state.stuckCounter;
    this.navDebug.replanReason = reason;
    this.navDebug.poisonedEdgeCount = state.poisonedEdges.size;
    this.navDebug.routeFromCache = Boolean(state.lastRouteFromCache);
    this.navDebug.executionSource = this.moveExecution.sourceNode ? this.tileKey(this.moveExecution.sourceNode) : 'none';
    this.navDebug.executionTarget = this.moveExecution.targetNode ? this.tileKey(this.moveExecution.targetNode) : 'none';
    this.navDebug.executionSignature = this.getExecutionSignature(this.moveExecution.sourceNode, { nextTile: this.moveExecution.targetNode }, this.moveExecution.profile);
    this.navDebug.routeKeepReason = routeKeepReason;
    this.navDebug.replanDeferred = replanDeferred;
    this.navDebug.edgePoisonedLastFrame = Boolean(state.lastEdgePoisoned);
    this.navDebug.jumpSpamCounter = state.jumpSpamCounter;
    this.navDebug.stairTraversalChosen = ['stepUp', 'slopeWalk', 'corridorAdvance', 'lowCeilingStep'].includes(state.moveProfile);
    this.navDebug.jumpSpamFailureTriggered = state.jumpLoopCounter >= 2 || state.jumpSpamCounter >= 4;
    this.navDebug.escalatedForUpwardFailure = (desiredMode === 'astar' || forceRoute) && (verticalToTarget <= -2 || state.jumpLoopCounter >= 1);
    this.navDebug.elevatorRoutingActive = Boolean(path?.some((segment) => segment?.edge?.profile?.type === 'elevatorRide'));
    this.navDebug.currentSurfaceId = surfacePlan.startSurface || 'none';
    this.navDebug.targetSurfaceId = surfacePlan.goalSurface || 'none';
    this.navDebug.routeKind = state.mode === 'direct' ? 'direct' : 'surface-graph';
    this.navDebug.transitionTakeoff = this.moveExecution.takeoffTile ? this.tileKey(this.moveExecution.takeoffTile) : 'none';
    this.navDebug.transitionLanding = this.moveExecution.landingTile ? this.tileKey(this.moveExecution.landingTile) : 'none';
    this.navDebug.transitionStage = this.moveExecution.phase || 'idle';
    this.navDebug.poisonReason = state.lastPoisonReason || 'none';
    this.navDebug.jumpFailureStage = state.lastEdgePoisoned
      ? (this.moveExecution.phase === 'takeoff-prep'
        ? 'before-takeoff'
        : this.moveExecution.phase === 'launch'
          ? 'during-launch'
          : this.moveExecution.phase === 'drift'
            ? 'after-launch'
            : 'landing-miss')
      : 'none';
    this.navDebug.upwardPursuitActive = state.upwardPursuitTimer > 0;
    this.navDebug.upwardPursuitReason = state.upwardPursuitReason || 'none';
    this.navDebug.obstacleForcedClimb = Boolean(state.forcedClimbTriggered);
    this.navDebug.settledActive = Boolean(state.settled);
    this.navDebug.restModeActive = Boolean(state.restMode);
    this.navDebug.stableFollowTile = state.stableFollowTile ? this.tileKey(state.stableFollowTile) : 'none';
    this.navDebug.arrivalDeadzoneActive = this.isPlayerMostlyStill(player) && Math.hypot(targetWorld.x - this.x, targetWorld.y - this.y) <= world.tileSize * 0.42;
    this.navDebug.jumpCanceled = state.jumpCancelReason !== 'none';
    this.navDebug.jumpCancelReason = state.jumpCancelReason || 'none';
    this.navDebug.oscillationSuppressed = state.oscillationDampTimer > 0;
    this.navDebug.routeEdges = surfacePlan.route.slice(0, 6).map((edge) => ({
      type: edge.type,
      from: edge.from,
      to: edge.to,
      sourceTile: edge.sourceTile ? this.tileKey(edge.sourceTile) : 'none',
      targetTile: edge.targetTile ? this.tileKey(edge.targetTile) : 'none',
      launchProfile: edge.launchProfile || 'none'
    }));
    this.navDebug.selectedEdge = selectedEdgeType;
    this.navDebug.selectedProfileSignature = this.moveExecution.profileSignature || this.moveExecution.profile || 'none';
    this.navDebug.routeDistanceBeforeLastJump = Number.isFinite(state.jumpRouteDistanceBefore) ? state.jumpRouteDistanceBefore : null;
    this.navDebug.routeDistanceAfterLastJump = Number.isFinite(state.jumpRouteDistanceAfter) ? state.jumpRouteDistanceAfter : null;
    this.navDebug.lastJumpMeaningful = Boolean(state.jumpMeaningfulLast);
    this.navDebug.betterGroundedEdgeAvailable = Boolean(groundedAlt);
    this.navDebug.routeExecutionMismatch = selectedJumpLike && groundedAlt ? 'jump-when-grounded-available' : 'none';
    state.jumpCancelReason = 'none';

    return {
      mode: state.mode,
      input: intent.input,
      moveProfile: intent.profile,
      targetTile
    };
  }

  buildFollowTarget(player, world, abilities) {
    const tile = this.findFollowStandTile(player, world, abilities);
    return this.tileCenter(tile, world);
  }

  update(dt, world, abilities, context = {}) {
    const player = context.player;
    if (!player) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.assistHoldTimer = Math.max(0, this.assistHoldTimer - dt);
    if (this.onGround) {
      this.aiAirJumpUsed = false;
      this.jumpStallCounter = 0;
      this.jumpStallBestY = this.y;
    }

    const playerRoom = world.roomAtTile?.(
      Math.floor(player.x / world.tileSize),
      Math.floor(player.y / world.tileSize)
    );
    const myRoom = world.roomAtTile?.(
      Math.floor(this.x / world.tileSize),
      Math.floor(this.y / world.tileSize)
    );
    const tooFar = Math.hypot(player.x - this.x, player.y - this.y) > this.teleportDistance;
    if (tooFar || (playerRoom != null && myRoom != null && playerRoom !== myRoom)) {
      this.x = player.x + (player.facing || 1) * -26;
      this.y = player.y - 6;
      this.vx = 0;
      this.vy = 0;
      this.removeAssistTarget();
      this.navState.path = [];
      this.navState.mode = 'direct';
      this.navState.replanCooldown = 0;
    }

    if (this.assistTarget?.dead) {
      this.removeAssistTarget();
    }
    if (!this.assistTarget && this.attackCooldown <= 0) {
      this.assistTarget = this.acquireAssistTarget(player, context.enemies, context.boss);
      if (this.assistTarget) {
        this.assistHoldTimer = 1.2;
      }
    }
    if (this.assistTarget) {
      const nearPlayer = Math.hypot(this.assistTarget.x - player.x, this.assistTarget.y - player.y);
      if (nearPlayer > 280 || this.assistHoldTimer <= 0) {
        this.removeAssistTarget();
      }
    }

    const nav = this.updateNavigation(dt, player, world, abilities);
    const nextInput = nav?.input || new Set();
    this.aiInput.beginFrame(nextInput);

    super.update(dt, this.aiInput, world, abilities);
    this.revving = false;
    this.flameMode = false;

    if (this.assistTarget && this.attackCooldown <= 0) {
      const enemy = this.assistTarget;
      const attackDx = enemy.x - this.x;
      const attackDy = Math.abs(enemy.y - this.y);
      if (Math.abs(attackDx) < world.tileSize * 1.8 && attackDy < 42) {
        this.facing = Math.sign(attackDx) || this.facing;
        this.startLunge(enemy.x, { speed: 280, duration: 0.1 });
        this.attackTimer = Math.max(this.attackTimer, 0.2);
        enemy.damage?.(1);
        context.onAssistHit?.(enemy);
        if (enemy.dead) {
          context.onAssistKill?.(enemy);
          this.removeAssistTarget();
        }
        this.attackCooldown = 0.45;
      }
    }
  }

  getNavigationDebugSnapshot() {
    return { ...this.navDebug };
  }

  getNavigationDebugScenarios() {
    return [
      'same-platform follow',
      'stair / slope walk',
      'corridor advance',
      'jump with headroom',
      'vertical jump then drift',
      'drop to lower platform',
      'elevator traverse',
      'detour around block',
      'narrow lip / ceiling approach',
      'moving target while committed route'
    ];
  }
}
