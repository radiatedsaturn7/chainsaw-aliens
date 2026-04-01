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
      activeReason: 'init',
      lastMoveSignature: null,
      localFailCount: 0,
      plannerFailCount: 0,
      pathVersion: 0,
      pathCache: new Map(),
      edgeValidationCache: new Map(),
      routeTargetKey: null
    };
    this.navDebug = {
      mode: 'direct',
      targetTile: null,
      nextPathNode: null,
      moveProfile: null,
      stuckCounter: 0,
      replanReason: 'init'
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
    const bodyClear = !world.isSolid(tileX, tileY, abilities, { ignoreOneWay: true });
    const headClear = !world.isSolid(tileX, tileY - 1, abilities, { ignoreOneWay: true });
    if (!bodyClear || !headClear) return false;
    return world.isSolid(tileX, tileY + 1, abilities, { ignoreOneWay: false });
  }

  getBodyTile(world, x = this.x, y = this.y) {
    const tileSize = world.tileSize;
    return {
      x: Math.floor(x / tileSize),
      y: Math.floor((y + this.height / 2 - 1) / tileSize)
    };
  }

  getFootStandTile(world) {
    return this.getBodyTile(world, this.x, this.y);
  }

  tileCenter(tile, world) {
    return {
      x: (tile.x + 0.5) * world.tileSize,
      y: (tile.y + 0.5) * world.tileSize
    };
  }

  tileKey(tile) {
    return `${tile.x},${tile.y}`;
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
          return { x: candidateX, y: candidateY };
        }
      }
    }
    return { x: playerTileX, y: playerTileY };
  }

  // Hybrid nav layer selection: keep direct movement as default and only escalate when repeated lack of progress is detected.
  chooseNavigationMode(targetTile, world, abilities) {
    const state = this.navState;
    const distToGoal = Math.hypot(targetTile.x * world.tileSize - this.x, targetTile.y * world.tileSize - this.y);
    if (state.mode === 'recovery' && state.commitTimer > 0) return 'recovery';
    if (this.shouldUseDirectFollow(targetTile, world, abilities)) return 'direct';
    if (distToGoal < world.tileSize * 8 && state.localFailCount < 2) return 'local';
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
    return state.stuckCounter >= 2 || state.noProgressTimer > 0.65 || dist > 8;
  }

  detectStuckState(dt, targetWorld) {
    const state = this.navState;
    const d = Math.hypot(targetWorld.x - this.x, targetWorld.y - this.y);
    if (d < state.lastProgressDistance - 6) {
      state.lastProgressDistance = d;
      state.lastProgressTime = 0;
      state.noProgressTimer = 0;
      state.stuckCounter = Math.max(0, state.stuckCounter - 1);
      state.jumpFailCounter = Math.max(0, state.jumpFailCounter - 1);
    } else {
      state.lastProgressTime += dt;
      state.noProgressTimer += dt;
    }
    if (this.justJumped && Math.abs(this.vy) < 20 && !this.onGround) {
      state.jumpFailCounter += 1;
    }
    if (state.noProgressTimer > 0.55 && Math.abs(this.vx) < 20 && Math.abs(this.vy) < 35) {
      state.stuckCounter += 1;
      state.noProgressTimer = 0;
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
        tile: this.getBodyTile(world, this.assistTarget.x - dir * 20, this.assistTarget.y),
        world: { x: this.assistTarget.x - dir * 20, y: this.assistTarget.y - 4 }
      };
    }
    const tile = this.findFollowStandTile(player, world, abilities);
    return { tile, world: this.tileCenter(tile, world) };
  }

  buildEdgeProfiles(from, to) {
    const dir = Math.sign(to.x - from.x);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const profiles = [];
    if (dy === 0 && Math.abs(dx) === 1) {
      profiles.push({ type: 'walk', dir, hold: 0.18, cost: 1 });
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
    return profiles;
  }

  validateMovementEdge(from, to, world, abilities) {
    if (!this.canStandOnTile(to.x, to.y, world, abilities)) return null;
    const state = this.navState;
    const alignmentBucket = Math.round(((this.x / world.tileSize) % 1) * 4);
    const cacheKey = `${from.x},${from.y}->${to.x},${to.y}|${alignmentBucket}`;
    const cached = state.edgeValidationCache.get(cacheKey);
    if (cached) return cached;
    const profiles = this.buildEdgeProfiles(from, to);
    let best = null;
    for (let i = 0; i < profiles.length; i += 1) {
      const profile = profiles[i];
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
    const launch = this.tileCenter(from, world);
    const alignmentOffsets = [0, -tileSize * 0.22, tileSize * 0.22];
    const dt = 1 / 30;
    const maxT = profile.type === 'drop' ? 0.75 : 0.65;
    let bestCost = Infinity;
    let found = false;
    let needAlign = false;

    const collides = (x, y, ignoreOneWay = false) => {
      const left = x - this.width / 2 + 4;
      const right = x + this.width / 2 - 4;
      const top = y - this.height / 2 + 4;
      const bottom = y + this.height / 2 - 4;
      const points = [
        [left, top], [right, top], [left, bottom], [right, bottom]
      ];
      for (let i = 0; i < points.length; i += 1) {
        const [px, py] = points[i];
        const tx = Math.floor(px / tileSize);
        const ty = Math.floor(py / tileSize);
        if (world.isSolid(tx, ty, abilities, { ignoreOneWay })) return true;
      }
      return false;
    };

    for (let offsetIndex = 0; offsetIndex < alignmentOffsets.length; offsetIndex += 1) {
      let x = launch.x + alignmentOffsets[offsetIndex];
      let y = launch.y;
      let vx = 0;
      let vy = 0;
      let coyote = MOVEMENT_MODEL.coyoteTime;
      let jumps = 1;
      let jumped = false;
      let t = 0;
      let bonk = false;
      while (t < maxT) {
        let move = 0;
        let jumpNow = false;
        if (profile.type === 'walk') {
          move = profile.dir;
        } else if (profile.type === 'drop') {
          move = profile.dir;
        } else if (profile.type === 'verticalJump') {
          if (!jumped && t < 0.06) jumpNow = true;
        } else if (profile.type === 'diagJump') {
          move = profile.dir;
          if (!jumped && t < 0.06) jumpNow = true;
        } else if (profile.type === 'upThenDrift') {
          if (!jumped && t < 0.06) jumpNow = true;
          if (t >= (profile.driftDelay || 0.08)) move = profile.dir;
        }

        vx = move * this.speed;
        if (jumpNow && (coyote > 0 || jumps > 0)) {
          vy = -this.jumpPower;
          jumped = true;
          coyote = 0;
          jumps = Math.max(0, jumps - 1);
        }

        vy += MOVEMENT_MODEL.gravity * dt;
        const nextX = x + vx * dt;
        const nextY = y + vy * dt;

        const hitWall = collides(nextX, y, true);
        if (!hitWall) {
          x = nextX;
        }
        const hitHeadOrFloor = collides(x, nextY, vy < 0);
        if (!hitHeadOrFloor) {
          y = nextY;
        } else {
          if (vy < 0) bonk = true;
          vy = 0;
        }

        const onGround = collides(x, y + this.height / 2 + 2, false);
        if (onGround) {
          coyote = MOVEMENT_MODEL.coyoteTime;
          jumps = 1;
        } else {
          coyote = Math.max(0, coyote - dt);
        }

        const nearTarget = Math.abs(x - target.x) < tileSize * 0.42 && Math.abs(y - target.y) < tileSize * 0.52;
        if (nearTarget && onGround && !bonk) {
          const distPenalty = Math.hypot(x - target.x, y - target.y) * 0.01;
          const cost = (profile.cost || 1) + t * 0.3 + distPenalty;
          if (cost < bestCost) {
            bestCost = cost;
            found = true;
            needAlign = offsetIndex !== 0;
          }
          break;
        }

        t += dt;
      }
    }

    if (!found) return { ok: false };
    return { ok: true, cost: bestCost, needAlign };
  }

  getNeighborCandidates(tile, world) {
    const dirs = [-1, 1];
    const neighbors = [];
    dirs.forEach((dir) => {
      neighbors.push({ x: tile.x + dir, y: tile.y });
      neighbors.push({ x: tile.x + dir, y: tile.y - 1 });
      neighbors.push({ x: tile.x + dir, y: tile.y - 2 });
      neighbors.push({ x: tile.x + dir * 2, y: tile.y - 1 });
      neighbors.push({ x: tile.x + dir, y: tile.y + 1 });
      neighbors.push({ x: tile.x + dir, y: tile.y + 2 });
    });
    neighbors.push({ x: tile.x, y: tile.y - 1 });
    neighbors.push({ x: tile.x, y: tile.y - 2 });
    neighbors.push({ x: tile.x, y: tile.y + 1 });
    neighbors.push({ x: tile.x, y: tile.y + 2 });
    return neighbors;
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
      const candidates = this.getNeighborCandidates(current, world);
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
    if (cached && cached.age < 1.3) return cached.path;

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
      const candidates = this.getNeighborCandidates(current, world);
      for (let i = 0; i < candidates.length; i += 1) {
        const next = candidates[i];
        if (Math.abs(next.x - start.x) > 16 || Math.abs(next.y - start.y) > 12) continue;
        const edge = this.validateMovementEdge(current, next, world, abilities);
        if (!edge?.ok) continue;
        const nextKey = this.tileKey(next);
        const currentScore = gScore.get(this.tileKey(current)) || Infinity;
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
      const [x, y] = key.split(',').map((n) => Number(n));
      path.unshift({ tile: { x, y }, edge: meta.get(key) || null });
      key = parents.get(key);
    }
    return path;
  }

  ageNavigationCaches(dt) {
    const state = this.navState;
    state.pathCache.forEach((value, key) => {
      value.age += dt;
      if (value.age > 2.5) state.pathCache.delete(key);
    });
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

  applyMoveIntent(move, targetWorld, world, abilities) {
    const nextInput = new Set();
    const activeTarget = move?.target || targetWorld;
    const dx = activeTarget.x - this.x;
    const dy = activeTarget.y - this.y;
    const profile = move?.edge?.profile?.type || 'direct';

    if (dx < -10) nextInput.add('left');
    if (dx > 10) nextInput.add('right');

    const wantsDrop = dy > world.tileSize * 1.1;
    const onOneWay = this.onGround && world.isOneWay?.(
      Math.floor(this.x / world.tileSize),
      Math.floor((this.y + this.height / 2 - 1) / world.tileSize)
    );
    if (wantsDrop && this.onGround && Math.abs(dx) < world.tileSize * 0.65 && onOneWay) {
      nextInput.add('down');
      nextInput.add('jump');
    }

    const canGroundJump = this.onGround || this.coyote > 0 || this.onWall !== 0;
    const shouldJump = this.jumpDecisionCooldown <= 0
      && (profile === 'diagJump' || profile === 'verticalJump' || profile === 'upThenDrift'
        || (dy < -24 && canGroundJump));

    if (profile === 'upThenDrift' && Math.abs(dx) < world.tileSize * 0.15 && this.onGround) {
      // Explicit straight-up jump profile for low-ceiling/lip routes where diagonal bonks.
      nextInput.delete('left');
      nextInput.delete('right');
      nextInput.add('jump');
      this.jumpDecisionCooldown = 0.18;
    } else if (shouldJump && this.jumpSuppressTimer <= 0) {
      nextInput.add('jump');
      this.jumpDecisionCooldown = 0.2;
    }

    if (profile === 'drop' && this.onGround && Math.abs(dx) > 8) {
      nextInput.add(dx < 0 ? 'left' : 'right');
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

    let path = state.path;
    let reason = 'commit';
    if (state.commitTimer <= 0 && (desiredMode !== state.mode || this.shouldEscalateToPlanner(targetTile, world))) {
      state.mode = desiredMode;
      reason = `mode:${desiredMode}`;
    }

    if (state.mode === 'local' && this.shouldReplan(targetTile, reason)) {
      path = this.planLocalRoute(startTile, targetTile, world, abilities);
      state.localFailCount = path.length ? 0 : state.localFailCount + 1;
      state.replanCooldown = 0.2;
      reason = path.length ? 'local-route' : 'local-fail';
    } else if (state.mode === 'astar' && this.shouldReplan(targetTile, reason)) {
      path = this.planSmartRouteAStar(startTile, targetTile, world, abilities);
      state.plannerFailCount = path.length ? 0 : state.plannerFailCount + 1;
      state.replanCooldown = 0.35;
      reason = path.length ? 'astar-route' : 'astar-fail';
    } else if (state.mode === 'direct') {
      path = [];
    }

    if ((state.mode === 'local' || state.mode === 'astar') && !path.length && state.stuckCounter >= 3) {
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
    const intent = this.applyMoveIntent(nextMove, targetWorld, world, abilities);

    const moveSignature = `${state.mode}:${intent.profile}:${nextMove?.nextTile ? this.tileKey(nextMove.nextTile) : 'direct'}`;
    this.updateRouteCommitment(dt, moveSignature);

    state.nextNode = nextMove?.nextTile || null;
    state.moveProfile = intent.profile;
    state.activeReason = reason;

    this.navDebug.mode = state.mode;
    this.navDebug.targetTile = `${targetTile.x},${targetTile.y}`;
    this.navDebug.nextPathNode = state.nextNode ? `${state.nextNode.x},${state.nextNode.y}` : 'none';
    this.navDebug.moveProfile = state.moveProfile;
    this.navDebug.stuckCounter = state.stuckCounter;
    this.navDebug.replanReason = reason;

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
      'jump with headroom',
      'vertical jump then drift',
      'drop to lower platform',
      'detour around block',
      'narrow lip / ceiling approach',
      'moving target while committed route'
    ];
  }
}
