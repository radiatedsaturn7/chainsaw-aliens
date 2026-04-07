import Player from './Player.js';
import { MOVEMENT_MODEL } from '../game/MovementModel.js';

const TARGET_PRIORITY_FACING_RIGHT = [
  [8, 15, 21, 19, 17],
  [3, 5, 23, 13, 11],
  [1, 2, 25, 9, 10],
  [4, 6, 24, 14, 12],
  [7, 15, 22, 20, 18]
];

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

export default class FriendlyCompanion extends Player {
  constructor(x, y) {
    super(x, y);
    this.type = 'friendly-companion';
    this.friendly = true;
    this.health = this.maxHealth;
    this.assistEnabled = false;
    this.aiInput = new CompanionInput();
    this.pathReplanTimer = 0;
    this.currentPathTiles = [];
    this.currentGoalTile = null;
    this.walkingPathTiles = [];
    this.jumpingPathTiles = [];
    this.jumpTargetTile = null;
    this.jumpTraceTile = null;
    this.prevPlayerOnGround = true;
    this.playerJumpStart = null;
    this.playerJumpSamples = [];
    this.playerJumpTriggerFrames = [];
    this.playerAirborneFrames = 0;
    this.jumpReplayLocked = false;
    this.jumpReplayLockTimer = 0;
    this.companionReplayAirborneSeen = false;
    this.companionAirTicks = 0;
    this.companionUsedJumpTriggerFrames = new Set();
    this.debugPenalizedTiles = [];
    this.debugStandableTiles = [];
    this.debugCandidateTiles = [];
    this.jumpOffsetCache = new Map();
    this.maxAStarExpansions = 600;
    this.maxAStarMs = 4;
    this.pathPlanQueued = false;
    this.pathPlanRequest = null;
    this.aStarSearchCache = new Map();
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

  clearJumpReplayState() {
    this.jumpReplayLocked = false;
    this.jumpReplayLockTimer = 0;
    this.companionReplayAirborneSeen = false;
    this.jumpTraceTile = null;
    this.playerJumpStart = null;
    this.playerJumpSamples = [];
    this.playerJumpTriggerFrames = [];
  }

  getFootTile(world) {
    const tileSize = world.tileSize;
    return {
      x: Math.floor(this.x / tileSize),
      y: Math.floor((this.y + this.height / 2 - 1) / tileSize)
    };
  }

  isPlayerGroundSupported(player, world, abilities, context) {
    const tileSize = world.tileSize;
    const footTileY = Math.floor((player.y + player.height / 2 + 1) / tileSize);
    const footXs = [
      player.x - player.width / 2 + 6,
      player.x + player.width / 2 - 6,
      player.x
    ];
    for (let i = 0; i < footXs.length; i += 1) {
      const tileX = Math.floor(footXs[i] / tileSize);
      if (this.isCollidable(tileX, footTileY, world, abilities, context)) return true;
    }
    return false;
  }

  tileKey(tile) {
    return `${tile.x},${tile.y}`;
  }

  getNowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
  }

  isHazardTile(tileX, tileY, world) {
    return Boolean(world.isHazard?.(tileX, tileY) || world.isHazard?.(tileX, tileY - 1) || world.isHazard?.(tileX, tileY + 1));
  }

  isElevatorSupportTile(tileX, tileY, world, context) {
    if (world.hasElevatorPlatform?.(tileX, tileY)) return true;
    const platforms = context?.elevatorPlatforms || [];
    if (!platforms.length) return false;
    const tileSize = world.tileSize;
    for (let i = 0; i < platforms.length; i += 1) {
      const platform = platforms[i];
      const tiles = platform.tiles || [{ dx: 0, dy: 0 }];
      for (let t = 0; t < tiles.length; t += 1) {
        const node = tiles[t];
        const px = Math.floor((platform.x + node.dx * tileSize) / tileSize);
        const py = Math.floor((platform.y + node.dy * tileSize) / tileSize);
        if (px === tileX && py === tileY) return true;
      }
    }
    return false;
  }

  isCollidable(tileX, tileY, world, abilities, context) {
    if (world.isSolid(tileX, tileY, abilities, { ignoreOneWay: false })) return true;
    return this.isElevatorSupportTile(tileX, tileY, world, context);
  }

  isWalkableTile(tileX, tileY, world, abilities, context) {
    if (tileX < 0 || tileX >= world.width || tileY < 1 || tileY >= world.height - 1) return false;
    const support = this.isCollidable(tileX, tileY + 1, world, abilities, context);
    if (!support) return false;
    const bodyBlocked = this.isCollidable(tileX, tileY, world, abilities, context);
    const headBlocked = this.isCollidable(tileX, tileY - 1, world, abilities, context);
    return !bodyBlocked && !headBlocked;
  }

  getPriorityTilesAroundPlayer(player, world) {
    const tileSize = world.tileSize;
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = Math.floor((player.y + player.height / 2 - 1) / tileSize);
    const facingRight = (player.facing || 1) >= 0;
    const ranked = [];
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const offsetX = facingRight ? col - 2 : 2 - col;
        const offsetY = row - 2;
        ranked.push({
          x: playerTileX + offsetX,
          y: playerTileY + offsetY,
          priority: TARGET_PRIORITY_FACING_RIGHT[row][col]
        });
      }
    }
    ranked.sort((a, b) => a.priority - b.priority);
    return ranked;
  }

  getAStarPath(startTile, goalTile, world, abilities, context, neighborResolver = null) {
    const nodeCost = (tile) => {
      let cost = 1;
      if (this.isHazardTile(tile.x, tile.y, world)) cost += 18;
      return cost;
    };
    const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const traversalCost = (from, to) => {
      const dx = Math.abs(to.x - from.x);
      const dy = to.y - from.y;
      const tileDistance = dx + Math.abs(dy);
      const jumpMove = dy < -1 || dx > 1;
      const jumpPenalty = jumpMove ? 3 : 0;
      return nodeCost(to) + tileDistance + jumpPenalty;
    };
    const withinBounds = (tile) => tile.x >= 0 && tile.x < world.width && tile.y >= 1 && tile.y < world.height - 1;

    const resolverTag = neighborResolver?.name || 'default';
    const searchKey = `${this.tileKey(startTile)}|${this.tileKey(goalTile)}|${resolverTag}`;
    const now = this.getNowMs();
    for (const [key, search] of this.aStarSearchCache.entries()) {
      if (now - search.lastTouchedMs > 1500) this.aStarSearchCache.delete(key);
    }
    let search = this.aStarSearchCache.get(searchKey);
    if (!search) {
      const startKey = this.tileKey(startTile);
      search = {
        open: [startTile],
        closed: new Set(),
        cameFrom: new Map(),
        gScore: new Map([[startKey, 0]]),
        fScore: new Map([[startKey, heuristic(startTile, goalTile)]]),
        tileByKey: new Map([[startKey, { ...startTile }]]),
        lastTouchedMs: now
      };
      this.aStarSearchCache.set(searchKey, search);
    }

    const popBest = () => {
      let bestIndex = 0;
      let bestScore = search.fScore.get(this.tileKey(search.open[0])) ?? Number.POSITIVE_INFINITY;
      for (let i = 1; i < search.open.length; i += 1) {
        const score = search.fScore.get(this.tileKey(search.open[i])) ?? Number.POSITIVE_INFINITY;
        if (score < bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      return search.open.splice(bestIndex, 1)[0];
    };

    const deadline = now + this.maxAStarMs;
    let expansions = 0;
    while (search.open.length > 0) {
      if (expansions >= this.maxAStarExpansions || this.getNowMs() > deadline) {
        search.lastTouchedMs = this.getNowMs();
        return null;
      }
      const current = popBest();
      const currentKey = this.tileKey(current);
      if (search.closed.has(currentKey)) continue;
      search.closed.add(currentKey);
      if (current.x === goalTile.x && current.y === goalTile.y) {
        const path = [current];
        let key = currentKey;
        while (search.cameFrom.has(key)) {
          const prevKey = search.cameFrom.get(key);
          const prev = search.tileByKey.get(prevKey);
          if (!prev) break;
          path.push(prev);
          key = prevKey;
        }
        path.reverse();
        this.aStarSearchCache.delete(searchKey);
        return path;
      }

      const neighbors = (neighborResolver || this.getTraversalNeighbors.bind(this))(current, world, abilities, context);
      expansions += 1;

      for (let i = 0; i < neighbors.length; i += 1) {
        const neighbor = neighbors[i];
        if (!withinBounds(neighbor)) continue;
        if (!this.isWalkableTile(neighbor.x, neighbor.y, world, abilities, context)) continue;

        const neighborKey = this.tileKey(neighbor);
        if (search.closed.has(neighborKey)) continue;
        const tentative = (search.gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + traversalCost(current, neighbor);

        if (tentative < (search.gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
          search.cameFrom.set(neighborKey, currentKey);
          search.gScore.set(neighborKey, tentative);
          search.fScore.set(neighborKey, tentative + heuristic(neighbor, goalTile));
          search.tileByKey.set(neighborKey, { x: neighbor.x, y: neighbor.y });
          if (!search.open.some((node) => node.x === neighbor.x && node.y === neighbor.y)) {
            search.open.push({ x: neighbor.x, y: neighbor.y });
          }
        }
      }
    }

    this.aStarSearchCache.delete(searchKey);
    return null;
  }

  getWalkingNeighbors(tile, world, abilities, context) {
    const neighbors = [];
    const neighborSet = new Set();
    const pushNeighbor = (candidate) => {
      if (!candidate) return;
      const key = this.tileKey(candidate);
      if (neighborSet.has(key)) return;
      neighborSet.add(key);
      neighbors.push(candidate);
    };
    const dirs = [-1, 1];
    dirs.forEach((dir) => {
      const walk = { x: tile.x + dir, y: tile.y };
      if (this.isWalkableTile(walk.x, walk.y, world, abilities, context)) pushNeighbor(walk);
      const stepUp = { x: tile.x + dir, y: tile.y - 1 };
      if (this.isWalkableTile(stepUp.x, stepUp.y, world, abilities, context)) pushNeighbor(stepUp);
      for (let dropDown = 1; dropDown <= 8; dropDown += 1) {
        const drop = { x: tile.x + dir, y: tile.y + dropDown };
        if (this.isWalkableTile(drop.x, drop.y, world, abilities, context)) pushNeighbor(drop);
      }
    });
    for (let dropDown = 1; dropDown <= 12; dropDown += 1) {
      const drop = { x: tile.x, y: tile.y + dropDown };
      if (this.isWalkableTile(drop.x, drop.y, world, abilities, context)) pushNeighbor(drop);
    }
    return neighbors;
  }

  getJumpingNeighbors(tile, world, abilities, context) {
    const neighbors = [];
    const neighborSet = new Set();
    const pushNeighbor = (candidate) => {
      if (!candidate) return;
      const key = this.tileKey(candidate);
      if (neighborSet.has(key)) return;
      neighborSet.add(key);
      neighbors.push(candidate);
    };
    const offsets = this.getSimulatedJumpOffsets(world);
    offsets.forEach((offset) => {
      const jump = { x: tile.x + offset.dx, y: tile.y + offset.dy };
      if (!this.isWalkableTile(jump.x, jump.y, world, abilities, context)) return;
      if (!this.isJumpTrajectoryClear(tile, offset.samples, world, abilities, context)) return;
      pushNeighbor(jump);
    });
    return neighbors;
  }

  isJumpTrajectoryClear(startTile, samples, world, abilities, context) {
    if (!Array.isArray(samples) || samples.length === 0) return false;
    const tileSize = world.tileSize;
    const startWorldX = (startTile.x + 0.5) * tileSize;
    const startWorldY = (startTile.y + 0.5) * tileSize;
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i];
      const worldX = startWorldX + sample.x;
      const worldY = startWorldY + sample.y;
      const tileX = Math.floor(worldX / tileSize);
      const tileY = Math.floor(worldY / tileSize);
      if (tileX < 0 || tileX >= world.width || tileY < 1 || tileY >= world.height - 1) return false;
      if (this.isCollidable(tileX, tileY, world, abilities, context)) return false;
      if (this.isCollidable(tileX, tileY - 1, world, abilities, context)) return false;
    }
    return true;
  }

  getSimulatedJumpOffsets(world) {
    const tileSize = world.tileSize;
    const cacheKey = `${tileSize}|${this.jumpPower}|${this.speed}`;
    if (this.jumpOffsetCache.has(cacheKey)) return this.jumpOffsetCache.get(cacheKey);

    const offsetMap = new Map();
    const dt = 1 / 60;
    const gravity = MOVEMENT_MODEL.gravity;
    const speed = this.speed;
    const jumpPower = this.jumpPower;
    const maxFrames = 120;
    const addOffset = (x, y, trajectory) => {
      const dx = Math.floor((x + tileSize * 0.5) / tileSize);
      const dy = Math.floor((y + tileSize * 0.5) / tileSize);
      if (dx === 0 && dy === 0) return;
      if (Math.abs(dx) > 10 || dy > 2 || dy < -10) return;
      const key = `${dx},${dy}`;
      const entry = { dx, dy, samples: trajectory.map((sample) => ({ ...sample })) };
      const existing = offsetMap.get(key);
      if (!existing || entry.samples.length < existing.samples.length) {
        offsetMap.set(key, entry);
      }
    };
    const simulateArc = (initialDir, holdDir, secondJumpFrame = null) => {
      let x = 0;
      let y = 0;
      let vx = initialDir * speed;
      let vy = -jumpPower;
      let jumpsUsed = 1;
      const trajectory = [];
      for (let frame = 0; frame < maxFrames; frame += 1) {
        const moveInput = holdDir;
        const targetVx = moveInput * speed;
        const accel = moveInput !== 0 ? 0.12 : 0.04;
        vx += (targetVx - vx) * accel;
        if (moveInput === 0) vx *= 0.98;
        if (secondJumpFrame !== null && jumpsUsed < 2 && frame >= secondJumpFrame && vy > -jumpPower * 0.45) {
          vy = -jumpPower;
          jumpsUsed += 1;
        }
        vy += gravity * dt;
        x += vx * dt;
        y += vy * dt;
        trajectory.push({ x, y });
        addOffset(x, y, trajectory);
        if (frame > 6 && y > tileSize * 2.5) break;
      }
    };

    const movementPatterns = [
      { initialDir: 0, holdDir: 0 },
      { initialDir: -1, holdDir: -1 },
      { initialDir: 1, holdDir: 1 },
      { initialDir: -1, holdDir: 0 },
      { initialDir: 1, holdDir: 0 },
      { initialDir: -1, holdDir: 1 },
      { initialDir: 1, holdDir: -1 }
    ];
    const doubleJumpFrames = [null, 8, 12, 16, 20, 24];
    movementPatterns.forEach((pattern) => {
      doubleJumpFrames.forEach((frame) => {
        simulateArc(pattern.initialDir, pattern.holdDir, frame);
      });
    });

    const parsed = Array.from(offsetMap.values());
    parsed.sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)));
    this.jumpOffsetCache.set(cacheKey, parsed);
    return parsed;
  }

  getTraversalNeighbors(tile, world, abilities, context) {
    const neighbors = [];
    const neighborSet = new Set();
    const pushUnique = (candidate) => {
      if (!candidate) return;
      const key = this.tileKey(candidate);
      if (neighborSet.has(key)) return;
      neighborSet.add(key);
      neighbors.push(candidate);
    };
    this.getWalkingNeighbors(tile, world, abilities, context).forEach(pushUnique);
    this.getJumpingNeighbors(tile, world, abilities, context).forEach(pushUnique);
    return neighbors;
  }

  estimatePathDistance(path) {
    if (!Array.isArray(path) || path.length < 2) return Number.POSITIVE_INFINITY;
    let distance = 0;
    for (let i = 1; i < path.length; i += 1) {
      const prev = path[i - 1];
      const current = path[i];
      distance += Math.abs(current.x - prev.x) + Math.abs(current.y - prev.y);
    }
    return distance;
  }

  schedulePlanPathToPlayer(player, world, abilities, context) {
    this.pathPlanRequest = { player, world, abilities, context };
    if (this.pathPlanQueued) return;
    this.pathPlanQueued = true;
    const schedule = typeof queueMicrotask === 'function'
      ? queueMicrotask
      : (fn) => Promise.resolve().then(fn);
    schedule(() => {
      this.pathPlanQueued = false;
      const request = this.pathPlanRequest;
      this.pathPlanRequest = null;
      if (!request?.player || !request?.world) return;
      this.planPathToPlayer(request.player, request.world, request.abilities, request.context);
    });
  }

  planPathToPlayer(player, world, abilities, context) {
    const rawStart = this.getFootTile(world);
    const tileSize = world.tileSize;
    const playerTile = {
      x: Math.floor(player.x / tileSize),
      y: Math.floor((player.y + player.height / 2 - 1) / tileSize)
    };
    const startTile = (() => {
      if (this.onGround) return this.findNearestWalkableTile(rawStart, world, abilities, context);
      const dropTile = this.findDropLandingTile(rawStart, world, abilities, context, 16);
      const nearestTile = this.findNearestWalkableTile(rawStart, world, abilities, context);
      if (!dropTile) return nearestTile;
      if (!nearestTile) return dropTile;
      const dropDx = Math.abs(dropTile.x - playerTile.x);
      const nearestDx = Math.abs(nearestTile.x - playerTile.x);
      return nearestDx + 1 < dropDx ? nearestTile : dropTile;
    })();
    const candidates = this.getPriorityTilesAroundPlayer(player, world);
    const playerSupported = this.isPlayerGroundSupported(player, world, abilities, context);
    const playerMovingDown = (player.vy || 0) > 24;
    const groundedBySupport = playerSupported && !playerMovingDown;
    const playerAirborne = !player.onGround
      && !groundedBySupport
      && (this.playerAirborneFrames >= 3 || Math.abs(player.vy || 0) > 25);
    const replayActive = playerAirborne || this.jumpReplayLocked;
    if (replayActive && this.jumpTraceTile && startTile) {
      if (playerAirborne && !this.onGround) {
        this.walkingPathTiles = [];
        this.jumpingPathTiles = [rawStart, playerTile];
        this.jumpTargetTile = playerTile;
        this.currentPathTiles = [rawStart, playerTile];
        this.currentGoalTile = playerTile;
        this.debugCandidateTiles = candidates.map((candidate) => ({ ...candidate, status: 'unchecked' }));
        this.debugStandableTiles = [];
        this.debugPenalizedTiles = [];
        return;
      }
      const pathToTrace = this.getAStarPath(startTile, this.jumpTraceTile, world, abilities, context, this.getWalkingNeighbors.bind(this));
      const replayPath = this.buildReplayJumpPath(world);
      const jumpGoalTile = this.findNearestWalkableTile(playerTile, world, abilities, context, 6) || playerTile;
      const directToPlayerPath = this.getAStarPath(
        startTile,
        jumpGoalTile,
        world,
        abilities,
        context,
        this.getTraversalNeighbors.bind(this)
      );
      let pathToPlayer = replayPath;
      if (!playerAirborne || !pathToPlayer?.length) {
        const jumpAStarPath = this.getAStarPath(
          this.jumpTraceTile,
          jumpGoalTile,
          world,
          abilities,
          context,
          this.getTraversalNeighbors.bind(this)
        );
        pathToPlayer = jumpAStarPath || replayPath;
      }
      const mergedPath = pathToTrace
        ? [...pathToTrace, ...(pathToPlayer ? pathToPlayer.slice(1) : [])]
        : [];

      let selectedPath = mergedPath;
      let selectedWalkingPath = pathToTrace || [];
      let selectedJumpingPath = pathToPlayer || [this.jumpTraceTile];
      let selectedGoal = this.jumpTraceTile;

      // While the player is still airborne, continuously re-plan toward their current tile.
      // This avoids stale "return to jump origin" behavior after failed jump attempts.
      if (playerAirborne && directToPlayerPath?.length) {
        const directDistance = this.estimatePathDistance(directToPlayerPath);
        const mergedDistance = this.estimatePathDistance(mergedPath);
        if (!mergedPath.length || directDistance <= mergedDistance + 1) {
          selectedPath = directToPlayerPath;
          selectedWalkingPath = [];
          selectedJumpingPath = directToPlayerPath;
          selectedGoal = jumpGoalTile;
        } else {
          selectedGoal = jumpGoalTile;
        }
      }

      this.walkingPathTiles = selectedWalkingPath;
      this.jumpingPathTiles = selectedJumpingPath;
      this.jumpTargetTile = playerAirborne
        ? playerTile
        : this.jumpingPathTiles[this.jumpingPathTiles.length - 1] || this.jumpTraceTile;
      this.currentPathTiles = selectedPath;
      this.currentGoalTile = selectedGoal;
      this.debugCandidateTiles = candidates.map((candidate) => ({ ...candidate, status: 'unchecked' }));
      this.debugStandableTiles = [];
      this.debugPenalizedTiles = [];
      return;
    }
    const debugCandidates = candidates.map((candidate) => ({ ...candidate, status: 'unchecked', hazard: false }));
    const penalized = [];
    const standable = [];
    const pathableCandidates = [];
    let bestPath = null;
    let bestGoal = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < debugCandidates.length; i += 1) {
      const candidate = debugCandidates[i];
      const hasSupport = this.isCollidable(candidate.x, candidate.y + 1, world, abilities, context);
      if (!hasSupport) {
        candidate.status = 'no-support';
        continue;
      }
      const bodyBlocked = this.isCollidable(candidate.x, candidate.y, world, abilities, context);
      const headBlocked = this.isCollidable(candidate.x, candidate.y - 1, world, abilities, context);
      if (bodyBlocked || headBlocked) {
        candidate.status = 'blocked';
        continue;
      }
      standable.push({ x: candidate.x, y: candidate.y });
      if (this.isHazardTile(candidate.x, candidate.y, world)) {
        penalized.push({ x: candidate.x, y: candidate.y });
        candidate.hazard = true;
        candidate.status = 'hazard';
      }
      if (!startTile) {
        candidate.status = 'no-path';
        continue;
      }
      pathableCandidates.push(candidate);
    }

    const tryResolver = (neighborResolver) => {
      for (let i = 0; i < pathableCandidates.length; i += 1) {
        const candidate = pathableCandidates[i];
        const path = this.getAStarPath(startTile, candidate, world, abilities, context, neighborResolver);
        if (!path || path.length < 1) continue;
        const pathDistance = path.reduce((sum, node, idx) => {
          if (idx === 0) return 0;
          const prev = path[idx - 1];
          return sum + Math.abs(node.x - prev.x) + Math.abs(node.y - prev.y);
        }, 0);
        const score = pathDistance + candidate.priority * 0.1 + (candidate.hazard ? 30 : 0);
        if (!bestPath || score < bestScore) {
          bestPath = path;
          bestGoal = { x: candidate.x, y: candidate.y };
          bestScore = score;
        }
        if (!candidate.hazard) candidate.status = 'valid';
      }
    };

    if (startTile) {
      // Evaluate walking-only routes first to avoid unnecessary jump plans on flat terrain.
      tryResolver(this.getWalkingNeighbors.bind(this));
      // Only consider jump-capable traversal if no walking path exists.
      if (!bestPath) {
        tryResolver(this.getTraversalNeighbors.bind(this));
      }
    }
    if (!bestPath) {
      pathableCandidates.forEach((candidate) => {
        if (candidate.status !== 'hazard') candidate.status = 'no-path';
      });
    }

    const fallbackPlayerTile = {
      x: Math.floor(player.x / tileSize),
      y: Math.floor((player.y + player.height / 2 - 1) / tileSize)
    };
    this.currentPathTiles = bestPath || [];
    this.currentGoalTile = bestGoal || (standable.length === 0 ? fallbackPlayerTile : null);
    this.walkingPathTiles = this.currentPathTiles.slice();
    this.jumpingPathTiles = [];
    this.jumpTargetTile = null;
    this.debugPenalizedTiles = penalized;
    this.debugStandableTiles = standable;
    this.debugCandidateTiles = debugCandidates;
  }

  findNearestWalkableTile(origin, world, abilities, context, maxRadius = null) {
    const effectiveRadius = Number.isFinite(maxRadius)
      ? Math.max(0, Math.floor(maxRadius))
      : Math.max(world.width, world.height);
    if (this.isWalkableTile(origin.x, origin.y, world, abilities, context)) return { ...origin };
    for (let radius = 1; radius <= effectiveRadius; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const tile = { x: origin.x + dx, y: origin.y + dy };
          if (this.isWalkableTile(tile.x, tile.y, world, abilities, context)) return tile;
        }
      }
    }
    return null;
  }

  findDropLandingTile(origin, world, abilities, context, maxDrop = 16) {
    const dropLimit = Math.max(1, Math.floor(maxDrop));
    for (let drop = 1; drop <= dropLimit; drop += 1) {
      const tile = { x: origin.x, y: origin.y + drop };
      if (!this.isWalkableTile(tile.x, tile.y, world, abilities, context)) continue;
      if (!this.isDropPathClear(origin, tile, world, abilities, context)) continue;
      return tile;
    }
    return null;
  }

  isDropPathClear(origin, destination, world, abilities, context) {
    if (destination.x !== origin.x || destination.y <= origin.y) return false;
    for (let y = origin.y + 1; y <= destination.y; y += 1) {
      if (this.isCollidable(origin.x, y, world, abilities, context)) return false;
      if (this.isCollidable(origin.x, y - 1, world, abilities, context)) return false;
    }
    return true;
  }

  update(dt, world, abilities, context = {}) {
    const player = context.player;
    if (!player) return;
    const tileSize = world.tileSize;
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = Math.floor((player.y + player.height / 2 - 1) / tileSize);
    const playerSupported = this.isPlayerGroundSupported(player, world, abilities, context);
    const playerMovingDown = (player.vy || 0) > 24;
    const groundedBySupport = playerSupported && !playerMovingDown;
    this.playerAirborneFrames = player.onGround ? 0 : this.playerAirborneFrames + 1;
    const stablePlayerAirborne = !player.onGround
      && !groundedBySupport
      && (this.playerAirborneFrames >= 3 || Math.abs(player.vy || 0) > 25);
    if (this.prevPlayerOnGround && stablePlayerAirborne) {
      this.jumpTraceTile = {
        x: Math.floor(player.x / tileSize),
        y: Math.floor((player.y + player.height / 2 - 1) / tileSize)
      };
      this.playerJumpStart = { x: player.x, y: player.y };
      this.playerJumpSamples = [{ x: player.x, y: player.y, vx: player.vx, vy: player.vy }];
      this.playerJumpTriggerFrames = [0];
      this.jumpReplayLocked = false;
    } else if (stablePlayerAirborne && !this.jumpReplayLocked) {
      const prevSample = this.playerJumpSamples[this.playerJumpSamples.length - 1] || null;
      this.playerJumpSamples.push({ x: player.x, y: player.y, vx: player.vx, vy: player.vy });
      if (prevSample && player.vy < prevSample.vy - 180) {
        this.playerJumpTriggerFrames.push(this.playerJumpSamples.length - 1);
      }
      if (this.playerJumpSamples.length > 120) this.playerJumpSamples.shift();
    }
    if (player.onGround) {
      if (!this.prevPlayerOnGround && this.playerJumpSamples.length > 0) {
        this.jumpReplayLocked = true;
        this.jumpReplayLockTimer = 0;
        this.companionReplayAirborneSeen = false;
      } else if (!this.jumpReplayLocked) {
        this.jumpTraceTile = null;
        this.playerJumpStart = null;
        this.playerJumpSamples = [];
        this.playerJumpTriggerFrames = [];
      }
    }
    this.prevPlayerOnGround = Boolean(player.onGround);
    if (!this.onGround) {
      this.companionAirTicks += 1;
      if (this.jumpReplayLocked) this.companionReplayAirborneSeen = true;
    } else {
      if (this.jumpReplayLocked && this.companionReplayAirborneSeen) {
        this.clearJumpReplayState();
      }
      this.companionAirTicks = 0;
      this.companionUsedJumpTriggerFrames.clear();
    }
    if (this.jumpReplayLocked) {
      this.jumpReplayLockTimer += dt;
      // If the companion never actually entered replay-airborne mode, don't stay locked indefinitely.
      if (this.onGround && !this.companionReplayAirborneSeen && this.jumpReplayLockTimer > 0.4) {
        this.clearJumpReplayState();
      }
    } else {
      this.jumpReplayLockTimer = 0;
    }

    this.pathReplanTimer = Math.max(0, this.pathReplanTimer - dt);
    if (this.pathReplanTimer <= 0 || !this.currentPathTiles.length) {
      this.schedulePlanPathToPlayer(player, world, abilities, context);
      this.pathReplanTimer = 0.2;
    }

    const nextInput = new Set();
    const nextTile = this.currentPathTiles.length > 1 ? this.currentPathTiles[1] : this.currentPathTiles[0] || null;
    if (nextTile) {
      const tileSize = world.tileSize;
      const targetX = (nextTile.x + 0.5) * tileSize;
      const targetY = (nextTile.y + 0.5) * tileSize;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      if (dx < -6) nextInput.add('left');
      if (dx > 6) nextInput.add('right');
      const canGroundJump = this.onGround || this.coyote > 0 || this.onWall !== 0;
      const canAirJump = !canGroundJump && this.jumpsRemaining > 0 && dy < -16 && this.vy > -90;
      if ((dy < -14 && canGroundJump) || canAirJump) {
        nextInput.add('jump');
      }
      if (!this.onGround && this.jumpsRemaining > 0 && this.playerJumpTriggerFrames.length > 1) {
        for (let i = 1; i < this.playerJumpTriggerFrames.length; i += 1) {
          const triggerFrame = this.playerJumpTriggerFrames[i];
          if (this.companionUsedJumpTriggerFrames.has(triggerFrame)) continue;
          if (Math.abs(this.companionAirTicks - triggerFrame) <= 1) {
            nextInput.add('jump');
            this.companionUsedJumpTriggerFrames.add(triggerFrame);
            break;
          }
        }
      }
      const closeEnough = Math.abs(dx) < 9 && Math.abs(dy) < tileSize * 0.6;
      if (closeEnough && this.currentPathTiles.length > 1) {
        this.currentPathTiles.shift();
      }
      const onOneWay = this.onGround && world.isOneWay?.(
        Math.floor(this.x / tileSize),
        Math.floor((this.y + this.height / 2 - 1) / tileSize)
      );
      if (dy > tileSize * 0.9 && onOneWay && this.onGround) {
        nextInput.add('down');
        nextInput.add('jump');
      }
    }

    this.aiInput.beginFrame(nextInput);
    super.update(dt, this.aiInput, world, abilities);
    this.revving = false;
    this.flameMode = false;
  }

  buildReplayJumpPath(world) {
    if (!this.jumpTraceTile || !this.playerJumpStart || this.playerJumpSamples.length < 1) return [];
    const tileSize = world.tileSize;
    const startWorldX = (this.jumpTraceTile.x + 0.5) * tileSize;
    const startWorldY = (this.jumpTraceTile.y + 0.5) * tileSize;
    const lateralDeadzone = tileSize * 0.35;
    const tiles = [];
    const seen = new Set();
    this.playerJumpSamples.forEach((sample) => {
      const rawDeltaX = sample.x - this.playerJumpStart.x;
      const mappedDeltaX = Math.abs(rawDeltaX) < lateralDeadzone ? 0 : rawDeltaX;
      const mappedX = startWorldX + mappedDeltaX;
      const mappedY = startWorldY + (sample.y - this.playerJumpStart.y);
      const tile = {
        x: Math.floor(mappedX / tileSize),
        y: Math.floor(mappedY / tileSize)
      };
      const key = this.tileKey(tile);
      if (seen.has(key)) return;
      seen.add(key);
      tiles.push(tile);
    });
    return tiles;
  }

  drawPathDebug(ctx, world) {
    const tileSize = world.tileSize;
    const colorByStatus = {
      'no-support': 'rgba(60, 60, 60, 0.95)',
      hazard: 'rgba(255, 80, 80, 0.95)',
      'no-path': 'rgba(255, 167, 48, 0.95)',
      blocked: 'rgba(110, 120, 170, 0.9)',
      valid: 'rgba(241, 223, 83, 0.95)',
      unchecked: 'rgba(140, 140, 140, 0.6)'
    };
    if (this.debugCandidateTiles.length) {
      ctx.save();
      this.debugCandidateTiles.forEach((tile) => {
        const color = colorByStatus[tile.status] || colorByStatus.unchecked;
        ctx.fillStyle = color.replace('0.95', '0.25').replace('0.9', '0.22').replace('0.6', '0.18');
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillRect(tile.x * tileSize + 2, tile.y * tileSize + 2, tileSize - 4, tileSize - 4);
        ctx.strokeRect(tile.x * tileSize + 2, tile.y * tileSize + 2, tileSize - 4, tileSize - 4);
      });
      ctx.restore();
    }

    if (this.walkingPathTiles.length > 1) {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(70, 235, 120, 0.98)';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      this.walkingPathTiles.forEach((tile) => {
        const x = (tile.x + 0.5) * tileSize;
        const y = (tile.y + 0.5) * tileSize;
        ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }
    if (this.jumpingPathTiles.length > 0) {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(95, 150, 255, 0.98)';
      ctx.beginPath();
      const first = this.jumpingPathTiles[0];
      ctx.moveTo((first.x + 0.5) * tileSize, (first.y + 0.5) * tileSize);
      this.jumpingPathTiles.forEach((tile) => {
        const x = (tile.x + 0.5) * tileSize;
        const y = (tile.y + 0.5) * tileSize;
        ctx.lineTo(x, y);
      });
      if (this.jumpTargetTile) {
        ctx.lineTo((this.jumpTargetTile.x + 0.5) * tileSize, (this.jumpTargetTile.y + 0.5) * tileSize);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (this.currentGoalTile) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3eff6d';
      ctx.strokeRect(
        this.currentGoalTile.x * tileSize + 1,
        this.currentGoalTile.y * tileSize + 1,
        tileSize - 2,
        tileSize - 2
      );
      ctx.restore();
    }
    if (this.jumpTargetTile) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6aa4ff';
      ctx.strokeRect(
        this.jumpTargetTile.x * tileSize + 3,
        this.jumpTargetTile.y * tileSize + 3,
        tileSize - 6,
        tileSize - 6
      );
      ctx.restore();
    }

  }
}
