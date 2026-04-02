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
      routeTargetKey: null
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
      routeKind: 'direct'
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
    return `${tile.x},${tile.y},${tile.align || 'center'}`;
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
    const playerTileY = Math.floor((player.y + player.height / 2 - 1) / tileSize);
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
    const prioritizedVertical = playerStanding ? [0, 1, -1, 2, -2] : verticalOffsets;
    for (let stepIndex = 0; stepIndex < uniqueColumns.length; stepIndex += 1) {
      const candidateX = uniqueColumns[stepIndex];
      for (let i = 0; i < prioritizedVertical.length; i += 1) {
        const candidateY = playerTileY + prioritizedVertical[i];
        if (Math.abs(candidateY - playerTileY) > 2) continue;
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

  buildNavigationTarget(player, world, abilities) {
    if (this.assistTarget) {
      const dir = Math.sign(this.assistTarget.x - this.x) || this.facing || 1;
      return {
        tile: this.withAlign(this.getBodyTile(world, this.assistTarget.x - dir * 20, this.assistTarget.y), 'center'),
        world: { x: this.assistTarget.x - dir * 20, y: this.assistTarget.y - 4 }
      };
    }
    const tile = this.findFollowStandTile(player, world, abilities);
    return { tile, world: this.tileCenter(tile, world) };
  }

  buildEdgeProfiles(from, to, world) {
    const dir = Math.sign(to.x - from.x);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const profiles = [];
    if (dx === 0 && dy === 0 && from.align !== to.align) {
      if (to.align === 'left') profiles.push({ type: 'microAlignLeft', dir: -1, hold: 0.08, cost: 0.45 });
      if (to.align === 'right') profiles.push({ type: 'microAlignRight', dir: 1, hold: 0.08, cost: 0.45 });
      if (to.align === 'center') profiles.push({ type: 'settleCenter', dir: 0, hold: 0.1, cost: 0.55 });
      return profiles;
    }
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
    if (dy <= 0 && Math.abs(dx) <= 2) {
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
      if (this.isEdgePoisoned(from, to, profile.type)) continue;
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
      if (!best || result.cost < best.cost) {
        best = {
          ok: true,
          profile,
          cost: result.cost,
          moveType: profile.type,
          needAlign: result.needAlign
        };
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
    const maxT = profile.type === 'drop' ? 0.8 : 0.72;
    let bestCost = Infinity;
    let found = false;
    let needAlign = from.align !== 'center';

    let x = launch.x;
    let y = launch.y;
    let vx = 0;
    let vy = 0;
    let coyote = MOVEMENT_MODEL.coyoteTime;
    let jumps = 1;
    let jumped = false;
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

      vy += MOVEMENT_MODEL.gravity * dt;
      if (vy > 0) descentStarted = true;
      const nextX = x + vx * dt;
      const nextY = y + vy * dt;

      const hitWall = this.collidesBodyAt(nextX, y, world, abilities, { ignoreOneWay: true });
      if (!hitWall) {
        x = nextX;
      } else {
        const stepHeight = onGround ? tileSize - 2 : 0;
        const canStepUp = stepHeight > 0
          && !this.collidesBodyAt(nextX, y - stepHeight, world, abilities, { ignoreOneWay: true });
        if (canStepUp && (profile.type === 'walk' || profile.type === 'slopeWalk' || profile.type === 'corridorAdvance' || profile.type === 'stepUp' || profile.type === 'lowCeilingStep')) {
          x = nextX;
          y -= stepHeight;
          onGround = true;
          vy = Math.min(vy, 0);
        } else {
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

      const nearTarget = Math.abs(x - target.x) < tileSize * 0.4 && Math.abs(y - target.y) < tileSize * 0.5;
      const stableLanding = onGround && (!jumped || descentStarted);
      const riskyLip = wallBump > 0 && jumped && Math.abs(y - target.y) < tileSize * 0.8;
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
    const aligns = ['left', 'center', 'right'];
    aligns.forEach((align) => {
      if (align !== (tile.align || 'center')) neighbors.push({ x: tile.x, y: tile.y, align });
    });
    dirs.forEach((dir) => {
      neighbors.push({ x: tile.x + dir, y: tile.y, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y, align: dir > 0 ? 'left' : 'right' });
      neighbors.push({ x: tile.x + dir, y: tile.y - 1, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y - 2, align: 'center' });
      neighbors.push({ x: tile.x + dir * 2, y: tile.y - 1, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y + 1, align: 'center' });
      neighbors.push({ x: tile.x + dir, y: tile.y + 2, align: 'center' });
      neighbors.push({ x: tile.x + dir * 2, y: tile.y, align: 'center' });
    });
    neighbors.push({ x: tile.x, y: tile.y - 1, align: 'center' });
    neighbors.push({ x: tile.x, y: tile.y - 2, align: 'center' });
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

  getSurfaceGraphCacheKey(start, goal, world) {
    return `${world.width}x${world.height}:${start.x},${start.y}->${goal.x},${goal.y}`;
  }

  buildSurfaceGraph(start, goal, world, abilities) {
    const state = this.navState;
    const cacheKey = this.getSurfaceGraphCacheKey(start, goal, world);
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

    const tileToSurface = new Map();
    const surfaces = [];
    const visited = new Set();
    const queue = [];
    const neighbors = [
      [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]
    ];

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
        for (let i = 0; i < neighbors.length; i += 1) {
          const nx = current.x + neighbors[i][0];
          const ny = current.y + neighbors[i][1];
          const nKey = `${nx},${ny}`;
          if (!walkable.has(nKey) || visited.has(nKey)) continue;
          visited.add(nKey);
          queue.push(walkable.get(nKey));
        }
      }
      tiles.sort((a, b) => (a.x - b.x) || (a.y - b.y));
      const mid = tiles[Math.floor(tiles.length / 2)];
      surfaces.push({
        id,
        tiles,
        anchor: mid,
        left: tiles[0],
        right: tiles[tiles.length - 1]
      });
    });

    const nodeEdges = new Map();
    surfaces.forEach((surface) => nodeEdges.set(surface.id, []));
    const addEdge = (from, to, edge) => {
      if (!nodeEdges.has(from)) nodeEdges.set(from, []);
      nodeEdges.get(from).push(edge);
    };

    surfaces.forEach((surface) => {
      const boundary = [
        surface.left,
        surface.anchor,
        surface.right
      ];
      for (let i = 0; i < boundary.length; i += 1) {
        const fromTile = boundary[i];
        for (let dx = -2; dx <= 2; dx += 1) {
          for (let dy = -3; dy <= 3; dy += 1) {
            if (dx === 0 && dy === 0) continue;
            const tx = fromTile.x + dx;
            const ty = fromTile.y + dy;
            const targetSurface = tileToSurface.get(`${tx},${ty}`);
            if (!targetSurface || targetSurface === surface.id) continue;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            let type = 'jumpArc';
            let cost = 2.6 + absDy * 0.6 + absDx * 0.35;
            if (absDy <= 1 && absDx <= 1) {
              type = dy < 0 ? 'stepUp' : 'corridorAdvance';
              cost = 1.2 + absDy * 0.2;
            } else if (dy > 0) {
              type = 'drop';
              cost = 1.6 + absDy * 0.35;
            } else if (dy === 0 && absDx <= 2) {
              type = 'walk';
              cost = 1.1 + absDx * 0.2;
            }
            addEdge(surface.id, targetSurface, {
              from: surface.id,
              to: targetSurface,
              type,
              cost,
              targetTile: { x: tx, y: ty, align: 'center' }
            });
          }
        }
      }
    });

    const elevatorHints = this.buildElevatorHints(world, abilities);
    elevatorHints.components.forEach((component, index) => {
      const elevatorNode = `elevator-${index}`;
      nodeEdges.set(elevatorNode, []);
      const boardBySurface = new Map();
      component.boardTiles.forEach((board) => {
        const sid = tileToSurface.get(`${board.x},${board.y}`);
        if (!sid) return;
        if (!boardBySurface.has(sid)) boardBySurface.set(sid, board);
      });
      boardBySurface.forEach((board, sid) => {
        addEdge(sid, elevatorNode, {
          from: sid,
          to: elevatorNode,
          type: 'elevatorBoard',
          cost: 1.1,
          targetTile: board
        });
        addEdge(elevatorNode, sid, {
          from: elevatorNode,
          to: sid,
          type: 'elevatorExit',
          cost: 1.1,
          targetTile: board
        });
      });
      const surfacesForElevator = Array.from(boardBySurface.keys());
      for (let i = 0; i < surfacesForElevator.length; i += 1) {
        for (let j = i + 1; j < surfacesForElevator.length; j += 1) {
          const a = surfacesForElevator[i];
          const b = surfacesForElevator[j];
          const boardA = boardBySurface.get(a);
          const boardB = boardBySurface.get(b);
          const rideCost = 1.8 + Math.abs(boardA.y - boardB.y) * 0.2;
          addEdge(a, b, {
            from: a,
            to: b,
            type: 'elevatorRide',
            cost: rideCost,
            targetTile: boardB
          });
          addEdge(b, a, {
            from: b,
            to: a,
            type: 'elevatorRide',
            cost: rideCost,
            targetTile: boardA
          });
        }
      }
    });

    const graph = { surfaces, tileToSurface, nodeEdges };
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

  findSurfaceRoute(startTile, goalTile, world, abilities) {
    const graph = this.buildSurfaceGraph(startTile, goalTile, world, abilities);
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
    while (open.size && expanded < maxExpanded) {
      const current = open.pop()?.key;
      if (!current) break;
      expanded += 1;
      if (current === goalSurface) break;
      const edges = graph.nodeEdges.get(current) || [];
      for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        const tentative = (gScore.get(current) || Infinity) + edge.cost;
        if (tentative >= (gScore.get(edge.to) || Infinity)) continue;
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

  buildSegmentsFromSurfaceRoute(route, goalTile) {
    if (!route.length) return [];
    return route.map((edge) => ({
      tile: edge.targetTile || goalTile,
      edge: {
        profile: {
          type: edge.type === 'jumpArc' ? 'diagJump' : edge.type
        }
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
      const [x, y, align] = key.split(',');
      path.unshift({ tile: { x: Number(x), y: Number(y), align: align || 'center' }, edge: meta.get(key) || null });
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
  }

  edgeAttemptKey(from, to, profile) {
    return `${this.tileKey(from)}>${this.tileKey(to)}:${profile}`;
  }

  getSegmentSourceNode(path, index, currentNode) {
    if (index <= 0) return currentNode;
    const prev = path[index - 1]?.tile;
    return prev || currentNode;
  }

  markEdgeFailure(from, to, profile) {
    const state = this.navState;
    const key = this.edgeAttemptKey(from, to, profile);
    const prev = state.poisonedEdges.get(key);
    const fails = (prev?.fails || 0) + 1;
    state.poisonedEdges.set(key, {
      fails,
      ttl: Math.min(2.2, 0.9 + fails * 0.35)
    });
  }

  isEdgePoisoned(from, to, profile) {
    const state = this.navState;
    const key = this.edgeAttemptKey(from, to, profile);
    const data = state.poisonedEdges.get(key);
    return Boolean(data && data.ttl > 0 && data.fails >= 2);
  }

  isRouteStillValid(path, world, abilities) {
    if (!path.length) return false;
    const current = this.getFootStandTile(world);
    const first = path[0]?.tile;
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
    const worldTarget = this.tileCenter(segment.tile, world);
    return {
      target: worldTarget,
      nextTile: segment.tile,
      edge: segment.edge
    };
  }

  getExecutionSignature(sourceNode, move, profile) {
    const src = sourceNode ? this.tileKey(sourceNode) : 'none';
    const dst = move?.nextTile ? this.tileKey(move.nextTile) : 'none';
    return `${profile}:${src}->${dst}`;
  }

  shouldRestartExecution(execution, sourceNode, move, profile, forceRestart = false) {
    if (forceRestart || !execution.active) return true;
    if (execution.profile !== profile) return true;
    if (!move?.nextTile || !execution.targetNode) return true;
    const sameTarget = this.tileKey(execution.targetNode) === this.tileKey(move.nextTile);
    if (!sameTarget) {
      const closeTile = execution.targetNode.x === move.nextTile.x && execution.targetNode.y === move.nextTile.y;
      const alignCompat = execution.targetNode.align === move.nextTile.align
        || execution.phase === 'travel'
        || profile === 'walk'
        || profile === 'direct';
      if (!(closeTile && alignCompat)) return true;
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
    this.moveExecution = {
      active: true,
      profile,
      phase: profile === 'upThenDrift'
        ? 'align'
        : (profile.startsWith('microAlign') || profile === 'settleCenter')
          ? 'align'
          : (profile === 'stepUp' || profile === 'shortHopForward' || profile === 'lowCeilingStep')
            ? 'launch'
            : 'travel',
      elapsed: 0,
      hold: profile === 'upThenDrift' ? 0.22 : profile.startsWith('microAlign') ? 0.12 : 0.18,
      lockDirection: dir,
      sourceNode: this.getFootStandTile(world),
      targetNode: move.nextTile
    };
  }

  buildExecutionIntent(execution, dx, dy, world, dt) {
    const input = new Set();
    const dir = execution.lockDirection || (dx < 0 ? -1 : 1);
    const profile = execution.profile;
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
      input.add('jump');
      if (profile === 'diagJump' || profile === 'stepUp' || profile === 'shortHopForward' || profile === 'lowCeilingStep') {
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
      || profile === 'stepUp' || profile === 'shortHopForward' || profile === 'lowCeilingStep')
      && (this.onGround || this.coyote > 0) && this.jumpDecisionCooldown <= 0) {
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
    this.moveExecution.elapsed += dt;
    const phaseInput = this.buildExecutionIntent(this.moveExecution, dx, dy, world, dt);
    phaseInput.forEach((key) => nextInput.add(key));

    // fallback direct drive to avoid any idle "thinking pauses" while planning updates.
    if (!nextInput.size) {
      if (dx < -10) nextInput.add('left');
      if (dx > 10) nextInput.add('right');
    }

    return { input: nextInput, profile };
  }

  updateNavigation(dt, player, world, abilities) {
    const state = this.navState;
    state.replanCooldown = Math.max(0, state.replanCooldown - dt);
    this.jumpDecisionCooldown = Math.max(0, this.jumpDecisionCooldown - dt);
    this.jumpSuppressTimer = Math.max(0, this.jumpSuppressTimer - dt);
    this.ageNavigationCaches(dt);

    const navTarget = this.buildNavigationTarget(player, world, abilities);
    const targetTile = navTarget.tile;
    const targetWorld = navTarget.world;
    const startTile = this.getFootStandTile(world);

    this.detectStuckState(dt, targetWorld);
    const desiredMode = this.chooseNavigationMode(targetTile, world, abilities);
    const verticalToTarget = targetTile.y - startTile.y;
    const surfacePlan = this.findSurfaceRoute(startTile, targetTile, world, abilities);
    const sameSurface = Boolean(surfacePlan.startSurface && surfacePlan.goalSurface && surfacePlan.startSurface === surfacePlan.goalSurface);
    const forceRoute = this.shouldForceRouteBecauseVerticalMismatch(startTile, targetTile) || this.detectJumpSpamFailure();

    let path = state.path;
    let reason = 'commit';
    let routeKeepReason = 'none';
    let replanDeferred = false;
    const targetChanged = !state.targetTile
      || Math.abs((state.targetTile.x || 0) - targetTile.x) > 1
      || Math.abs((state.targetTile.y || 0) - targetTile.y) > 1;
    const canKeepRoute = this.isRouteStillValid(path, world, abilities) && !targetChanged;
    if (state.commitTimer <= 0 && (desiredMode !== state.mode || this.shouldEscalateToPlanner(targetTile, world))) {
      state.mode = desiredMode;
      reason = `mode:${desiredMode}`;
    }
    if (canKeepRoute && state.mode !== 'direct') {
      reason = 'route-commit';
      routeKeepReason = targetChanged ? 'target-shift-small' : 'path-still-valid';
      replanDeferred = true;
      state.replanCooldown = Math.max(state.replanCooldown, 0.12);
    }

    if (sameSurface && !forceRoute && state.stuckCounter < 2 && Math.abs(verticalToTarget) <= 2) {
      state.mode = 'direct';
      path = this.buildDirectSurfaceSegment(startTile, targetTile);
      reason = 'surface-direct';
    } else if ((!canKeepRoute || state.mode !== 'direct') && this.shouldReplan(targetTile, reason)) {
      path = this.buildSegmentsFromSurfaceRoute(surfacePlan.route, targetTile);
      state.replanCooldown = 0.22;
      reason = path.length ? 'surface-route' : 'surface-route-fail';
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
    const nextMove = this.chooseMoveFromPath(path, world);
    const intent = this.applyMoveIntent(nextMove, targetWorld, world, abilities, dt);
    const activeExec = this.moveExecution;
    const failedEdgeProfile = activeExec?.profile && activeExec.profile !== 'direct' ? activeExec.profile : nextMove?.edge?.profile?.type;
    if (failedEdgeProfile && state.stuckCounter >= 2 && state.noProgressTimer > 0.25) {
      const failSource = activeExec?.sourceNode || startTile;
      const failTarget = activeExec?.targetNode || nextMove?.nextTile;
      if (failTarget) this.markEdgeFailure(failSource, failTarget, failedEdgeProfile);
      reason = 'edge-poisoned';
      state.replanCooldown = 0;
      state.lastEdgePoisoned = true;
    } else {
      state.lastEdgePoisoned = false;
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
