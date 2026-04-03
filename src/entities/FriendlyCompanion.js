import Player from './Player.js';

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

  getAStarPath(startTile, goalTile, world, abilities, context) {
    const nodeCost = (tile) => {
      let cost = 1;
      if (this.isHazardTile(tile.x, tile.y, world)) cost += 18;
      return cost;
    };
    const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const withinBounds = (tile) => tile.x >= 0 && tile.x < world.width && tile.y >= 1 && tile.y < world.height - 1;
    const maxRadius = 18;
    const minX = Math.max(0, Math.min(startTile.x, goalTile.x) - maxRadius);
    const maxX = Math.min(world.width - 1, Math.max(startTile.x, goalTile.x) + maxRadius);
    const minY = Math.max(1, Math.min(startTile.y, goalTile.y) - maxRadius);
    const maxY = Math.min(world.height - 2, Math.max(startTile.y, goalTile.y) + maxRadius);

    const open = [startTile];
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
      if (current.x === goalTile.x && current.y === goalTile.y) {
        const path = [current];
        let key = this.tileKey(current);
        while (cameFrom.has(key)) {
          const prev = cameFrom.get(key);
          path.push(prev);
          key = this.tileKey(prev);
        }
        path.reverse();
        return path;
      }

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 }
      ];

      for (let i = 0; i < neighbors.length; i += 1) {
        const neighbor = neighbors[i];
        if (!withinBounds(neighbor)) continue;
        if (neighbor.x < minX || neighbor.x > maxX || neighbor.y < minY || neighbor.y > maxY) continue;
        if (!this.isWalkableTile(neighbor.x, neighbor.y, world, abilities, context)) continue;

        const currentKey = this.tileKey(current);
        const neighborKey = this.tileKey(neighbor);
        const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + nodeCost(neighbor);

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

  planPathToPlayer(player, world, abilities, context) {
    const rawStart = this.getFootTile(world);
    const startTile = this.findNearestWalkableTile(rawStart, world, abilities, context, 8);
    const candidates = this.getPriorityTilesAroundPlayer(player, world);
    const debugCandidates = candidates.map((candidate) => ({ ...candidate, status: 'unchecked' }));
    if (!startTile) {
      this.currentPathTiles = [];
      this.currentGoalTile = null;
      this.debugPenalizedTiles = [];
      this.debugStandableTiles = [];
      this.debugCandidateTiles = debugCandidates.map((candidate) => ({ ...candidate, status: 'no-path' }));
      return;
    }

    const penalized = [];
    const standable = [];
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
        candidate.status = 'hazard';
      }
      const path = this.getAStarPath(startTile, candidate, world, abilities, context);
      if (!path || path.length < 2) {
        candidate.status = 'no-path';
        continue;
      }
      if (candidate.status !== 'hazard') candidate.status = 'valid';
      this.currentPathTiles = path;
      this.currentGoalTile = { x: candidate.x, y: candidate.y };
      this.debugPenalizedTiles = penalized;
      this.debugStandableTiles = standable;
      this.debugCandidateTiles = debugCandidates;
      return;
    }

    this.currentPathTiles = [];
    this.currentGoalTile = null;
    this.debugPenalizedTiles = penalized;
    this.debugStandableTiles = standable;
    this.debugCandidateTiles = debugCandidates;
  }

  findNearestWalkableTile(origin, world, abilities, context, maxRadius = 8) {
    if (this.isWalkableTile(origin.x, origin.y, world, abilities, context)) return { ...origin };
    for (let radius = 1; radius <= maxRadius; radius += 1) {
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

    this.pathReplanTimer = Math.max(0, this.pathReplanTimer - dt);
    if (this.pathReplanTimer <= 0 || !this.currentPathTiles.length) {
      this.planPathToPlayer(player, world, abilities, context);
      this.pathReplanTimer = 0.2;
    }

    this.aiInput.beginFrame(new Set());
    this.vx = 0;
    this.vy = 0;
    this.revving = false;
    this.flameMode = false;
    this.onGround = true;
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

    if (this.currentPathTiles.length > 1) {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(70, 235, 120, 0.98)';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      this.currentPathTiles.forEach((tile) => {
        const x = (tile.x + 0.5) * tileSize;
        const y = (tile.y + 0.5) * tileSize;
        ctx.lineTo(x, y);
      });
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

  }
}
