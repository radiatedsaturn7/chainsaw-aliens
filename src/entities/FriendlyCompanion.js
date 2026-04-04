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
    this.jumpReplayLocked = false;
    this.companionReplayAirborneSeen = false;
    this.companionAirTicks = 0;
    this.companionUsedJumpTriggerFrames = new Set();
    this.debugPenalizedTiles = [];
    this.debugStandableTiles = [];
    this.debugCandidateTiles = [];
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

  getFootTile(world) {
    const tileSize = world.tileSize;
    return {
      x: Math.floor(this.x / tileSize),
      y: Math.floor((this.y + this.height / 2 - 1) / tileSize)
    };
  }

  tileKey(tile) {
    return `${tile.x},${tile.y}`;
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

    const open = [startTile];
    const closed = new Set();
    const cameFrom = new Map();
    const gScore = new Map([[this.tileKey(startTile), 0]]);
    const fScore = new Map([[this.tileKey(startTile), heuristic(startTile, goalTile)]]);

    const popBest = () => {
      let bestIndex = 0;
      let bestScore = fScore.get(this.tileKey(open[0])) ?? Number.POSITIVE_INFINITY;
      for (let i = 1; i < open.length; i += 1) {
        const score = fScore.get(this.tileKey(open[i])) ?? Number.POSITIVE_INFINITY;
        if (score < bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      return open.splice(bestIndex, 1)[0];
    };

    while (open.length > 0) {
      const current = popBest();
      const currentKey = this.tileKey(current);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      if (current.x === goalTile.x && current.y === goalTile.y) {
        const path = [current];
        let key = currentKey;
        while (cameFrom.has(key)) {
          const prev = cameFrom.get(key);
          path.push(prev);
          key = this.tileKey(prev);
        }
        path.reverse();
        return path;
      }

      const neighbors = (neighborResolver || this.getTraversalNeighbors.bind(this))(current, world, abilities, context);

      for (let i = 0; i < neighbors.length; i += 1) {
        const neighbor = neighbors[i];
        if (!withinBounds(neighbor)) continue;
        if (!this.isWalkableTile(neighbor.x, neighbor.y, world, abilities, context)) continue;

        const neighborKey = this.tileKey(neighbor);
        if (closed.has(neighborKey)) continue;
        const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + traversalCost(current, neighbor);

        if (tentative < (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentative);
          fScore.set(neighborKey, tentative + heuristic(neighbor, goalTile));
          if (!open.some((node) => node.x === neighbor.x && node.y === neighbor.y)) {
            open.push(neighbor);
          }
        }
      }
    }

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
    const jumpHeightTiles = Math.max(2, Math.floor((this.jumpPower ** 2) / (2 * MOVEMENT_MODEL.gravity * world.tileSize)));
    const doubleJumpHeightTiles = Math.max(jumpHeightTiles + 1, jumpHeightTiles * 2 - 1);
    const dirs = [-1, 1];
    // Jump straight up.
    for (let jumpUp = 1; jumpUp <= jumpHeightTiles; jumpUp += 1) {
      const jump = { x: tile.x, y: tile.y - jumpUp };
      if (this.isWalkableTile(jump.x, jump.y, world, abilities, context)) pushNeighbor(jump);
    }
    // Jump straight up twice (double jump).
    for (let jumpUp = jumpHeightTiles + 1; jumpUp <= doubleJumpHeightTiles; jumpUp += 1) {
      const jump = { x: tile.x, y: tile.y - jumpUp };
      if (this.isWalkableTile(jump.x, jump.y, world, abilities, context)) pushNeighbor(jump);
    }
    // Jump up and left/right.
    dirs.forEach((dir) => {
      for (let lateral = 1; lateral <= 3; lateral += 1) {
        for (let jumpUp = 1; jumpUp <= jumpHeightTiles; jumpUp += 1) {
          const jump = { x: tile.x + dir * lateral, y: tile.y - jumpUp };
          if (this.isWalkableTile(jump.x, jump.y, world, abilities, context)) pushNeighbor(jump);
        }
      }
    });
    // Jump up until max height, then move left/right.
    dirs.forEach((dir) => {
      for (let lateral = 1; lateral <= 4; lateral += 1) {
        const singleApexShift = { x: tile.x + dir * lateral, y: tile.y - jumpHeightTiles };
        if (this.isWalkableTile(singleApexShift.x, singleApexShift.y, world, abilities, context)) pushNeighbor(singleApexShift);
        const doubleApexShift = { x: tile.x + dir * lateral, y: tile.y - doubleJumpHeightTiles };
        if (this.isWalkableTile(doubleApexShift.x, doubleApexShift.y, world, abilities, context)) pushNeighbor(doubleApexShift);
      }
    });
    return neighbors;
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

  planPathToPlayer(player, world, abilities, context) {
    const rawStart = this.getFootTile(world);
    const startTile = this.findNearestWalkableTile(rawStart, world, abilities, context);
    const candidates = this.getPriorityTilesAroundPlayer(player, world);
    const tileSize = world.tileSize;
    const playerTile = {
      x: Math.floor(player.x / tileSize),
      y: Math.floor((player.y + player.height / 2 - 1) / tileSize)
    };
    const playerAirborne = !player.onGround;
    const replayActive = playerAirborne || this.jumpReplayLocked;
    if (replayActive && this.jumpTraceTile && startTile) {
      const pathToTrace = this.getAStarPath(startTile, this.jumpTraceTile, world, abilities, context, this.getWalkingNeighbors.bind(this));
      const replayPath = this.buildReplayJumpPath(world);
      let pathToPlayer = replayPath;
      if (!playerAirborne || !pathToPlayer?.length) {
        const jumpGoalTile = this.findNearestWalkableTile(playerTile, world, abilities, context, 6) || playerTile;
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
      this.walkingPathTiles = pathToTrace || [];
      this.jumpingPathTiles = pathToPlayer || [this.jumpTraceTile];
      this.jumpTargetTile = playerAirborne
        ? playerTile
        : this.jumpingPathTiles[this.jumpingPathTiles.length - 1] || this.jumpTraceTile;
      this.currentPathTiles = mergedPath;
      this.currentGoalTile = this.jumpTraceTile;
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
        if (!bestPath) {
          bestPath = path;
          bestGoal = { x: candidate.x, y: candidate.y };
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

  update(dt, world, abilities, context = {}) {
    const player = context.player;
    if (!player) return;
    if (this.prevPlayerOnGround && !player.onGround) {
      const tileSize = world.tileSize;
      this.jumpTraceTile = {
        x: Math.floor(player.x / tileSize),
        y: Math.floor((player.y + player.height / 2 - 1) / tileSize)
      };
      this.playerJumpStart = { x: player.x, y: player.y };
      this.playerJumpSamples = [{ x: player.x, y: player.y, vx: player.vx, vy: player.vy }];
      this.playerJumpTriggerFrames = [0];
      this.jumpReplayLocked = false;
    } else if (!player.onGround && !this.jumpReplayLocked) {
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
        this.jumpReplayLocked = false;
        this.companionReplayAirborneSeen = false;
        this.jumpTraceTile = null;
        this.playerJumpStart = null;
        this.playerJumpSamples = [];
        this.playerJumpTriggerFrames = [];
      }
      this.companionAirTicks = 0;
      this.companionUsedJumpTriggerFrames.clear();
    }

    this.pathReplanTimer = Math.max(0, this.pathReplanTimer - dt);
    if (this.pathReplanTimer <= 0 || !this.currentPathTiles.length) {
      this.planPathToPlayer(player, world, abilities, context);
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
