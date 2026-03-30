import Player from './Player.js';

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
    this.routePlanCooldown = 0;
    this.routeStepTile = null;
    this.traceRecordCooldown = 0;
    this.playerTraceTiles = [];
    this.playerTraceMax = 120;
    this.traceOnlyFollow = true;
    this.traceTailDelay = 12;
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

  buildFollowStandCandidates(player, world) {
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
      playerTileX - 3,
      playerTileX + 4,
      playerTileX - 4,
      playerTileX + 5,
      playerTileX - 5
    ];
    const uniqueColumns = [];
    [...behindColumns, ...adjacentColumns].forEach((column) => {
      if (!uniqueColumns.includes(column)) uniqueColumns.push(column);
    });
    const prioritizedVertical = player.onGround ? [0, 1, -1, 2, -2] : verticalOffsets;
    const candidates = [];
    const seen = new Set();
    const pushCandidate = (x, y) => {
      const key = `${x},${y}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ x, y });
    };
    for (let stepIndex = 0; stepIndex < uniqueColumns.length; stepIndex += 1) {
      const candidateX = uniqueColumns[stepIndex];
      for (let i = 0; i < prioritizedVertical.length; i += 1) {
        const candidateY = playerTileY + prioritizedVertical[i];
        if (Math.abs(candidateY - playerTileY) > 3) continue;
        pushCandidate(candidateX, candidateY);
      }
      for (let i = 0; i < verticalOffsets.length; i += 1) {
        const candidateY = playerTileY + verticalOffsets[i];
        if (Math.abs(candidateY - playerTileY) > 3) continue;
        pushCandidate(candidateX, candidateY);
      }
      for (let i = 0; i < verticalOffsets.length; i += 1) {
        pushCandidate(candidateX, playerTileY + verticalOffsets[i] + 1);
      }
    }
    pushCandidate(playerTileX, playerTileY);
    return candidates;
  }

  findFollowStandTile(player, world, abilities) {
    const tileSize = world.tileSize;
    const candidates = this.buildFollowStandCandidates(player, world);
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (this.canStandOnTile(candidate.x, candidate.y, world, abilities)) return candidate;
    }
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = Math.floor((player.y + player.height / 2 - 1) / tileSize);
    return { x: playerTileX, y: playerTileY };
  }

  getFootStandTile(world) {
    const tileSize = world.tileSize;
    return {
      x: Math.floor(this.x / tileSize),
      y: Math.floor((this.y + this.height / 2 - 1) / tileSize)
    };
  }

  buildPathNeighbors(tile, world, abilities) {
    const neighbors = [];
    const seen = new Set();
    const isAirClear = (x, y) => !world.isSolid(x, y, abilities, { ignoreOneWay: true }) && !world.isHazard?.(x, y);
    const canTraverse = (from, to) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const samples = Math.max(Math.abs(dx), Math.abs(dy)) * 3;
      for (let i = 1; i <= samples; i += 1) {
        const t = i / samples;
        const x = Math.round(from.x + dx * t);
        const y = Math.round(from.y + dy * t);
        if (dy < 0 && x === to.x && y >= to.y + 1) continue;
        if (!isAirClear(x, y) || !isAirClear(x, y - 1)) return false;
      }
      return true;
    };
    const addNeighbor = (x, y) => {
      const key = `${x},${y}`;
      if (seen.has(key)) return;
      const target = { x, y };
      if (this.canStandOnTile(x, y, world, abilities) && canTraverse(tile, target)) {
        neighbors.push({ x, y });
        seen.add(key);
      }
    };
    const dirs = [-1, 1];
    dirs.forEach((dir) => {
      addNeighbor(tile.x + dir, tile.y);
      for (let jumpUp = 1; jumpUp <= 5; jumpUp += 1) {
        for (let run = 1; run <= 2; run += 1) {
          addNeighbor(tile.x + dir * run, tile.y - jumpUp);
        }
      }
      for (let dropDown = 1; dropDown <= 4; dropDown += 1) {
        for (let drift = 1; drift <= 2; drift += 1) {
          addNeighbor(tile.x + dir * drift, tile.y + dropDown);
        }
      }
    });
    for (let jumpUp = 1; jumpUp <= 5; jumpUp += 1) {
      addNeighbor(tile.x, tile.y - jumpUp);
    }
    for (let dropDown = 1; dropDown <= 4; dropDown += 1) {
      addNeighbor(tile.x, tile.y + dropDown);
    }
    return neighbors;
  }

  findRouteStepToward(goalTile, world, abilities) {
    const start = this.getFootStandTile(world);
    if (!this.canStandOnTile(start.x, start.y, world, abilities)) return null;
    if (start.x === goalTile.x && start.y === goalTile.y) return goalTile;
    const horizontalPadding = Math.max(16, Math.abs(goalTile.x - start.x) + 8);
    const verticalPadding = Math.max(14, Math.abs(goalTile.y - start.y) + 8);
    const keyOf = (tile) => `${tile.x},${tile.y}`;
    const startKey = keyOf(start);
    const heuristic = (tile) => {
      const dx = Math.abs(tile.x - goalTile.x);
      const dy = Math.abs(tile.y - goalTile.y);
      return Math.max(dx, Math.ceil(dy / 5));
    };

    const searchWindows = [
      {
        minX: Math.max(0, Math.min(start.x, goalTile.x) - horizontalPadding),
        maxX: Math.min(world.width - 1, Math.max(start.x, goalTile.x) + horizontalPadding),
        minY: Math.max(1, Math.min(start.y, goalTile.y) - verticalPadding),
        maxY: Math.min(world.height - 2, Math.max(start.y, goalTile.y) + verticalPadding),
        maxExpansions: 900
      },
      { minX: 0, maxX: world.width - 1, minY: 1, maxY: world.height - 2, maxExpansions: 1800 }
    ];

    for (let windowIndex = 0; windowIndex < searchWindows.length; windowIndex += 1) {
      const {
        minX, maxX, minY, maxY, maxExpansions
      } = searchWindows[windowIndex];
      const open = [start];
      const openSet = new Set([startKey]);
      const parents = new Map([[startKey, null]]);
      const gScore = new Map([[startKey, 0]]);
      const fScore = new Map([[startKey, heuristic(start)]]);
      let expansions = 0;
      while (open.length > 0 && expansions < maxExpansions) {
        expansions += 1;
        let bestIndex = 0;
        let bestKey = keyOf(open[0]);
        let bestF = fScore.get(bestKey) ?? Number.POSITIVE_INFINITY;
        for (let i = 1; i < open.length; i += 1) {
          const candidateKey = keyOf(open[i]);
          const candidateF = fScore.get(candidateKey) ?? Number.POSITIVE_INFINITY;
          if (candidateF < bestF) {
            bestF = candidateF;
            bestIndex = i;
            bestKey = candidateKey;
          }
        }
        const [current] = open.splice(bestIndex, 1);
        if (!current) break;
        const currentKey = keyOf(current);
        openSet.delete(currentKey);
        if (current.x === goalTile.x && current.y === goalTile.y) {
          let step = current;
          let parentKey = parents.get(currentKey);
          while (parentKey && parentKey !== startKey) {
            const [px, py] = parentKey.split(',').map((value) => Number(value));
            step = { x: px, y: py };
            parentKey = parents.get(parentKey);
          }
          return step;
        }
        const neighbors = this.buildPathNeighbors(current, world, abilities);
        neighbors.forEach((neighbor) => {
          if (neighbor.x < minX || neighbor.x > maxX || neighbor.y < minY || neighbor.y > maxY) return;
          const key = keyOf(neighbor);
          const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;
          if (tentative >= (gScore.get(key) ?? Number.POSITIVE_INFINITY)) return;
          parents.set(key, currentKey);
          gScore.set(key, tentative);
          fScore.set(key, tentative + heuristic(neighbor));
          if (!openSet.has(key)) {
            open.push(neighbor);
            openSet.add(key);
          }
        });
      }
    }
    return null;
  }

  buildFollowTarget(player, world, abilities) {
    const tileSize = world.tileSize;
    const standTile = this.findFollowStandTile(player, world, abilities);
    return {
      x: (standTile.x + 0.5) * tileSize,
      y: (standTile.y + 0.5) * tileSize
    };
  }

  buildAssistTarget(player, world, abilities) {
    if (!this.assistTarget) return this.buildFollowTarget(player, world, abilities);
    const dir = Math.sign(this.assistTarget.x - this.x) || this.facing || 1;
    return {
      x: this.assistTarget.x - dir * 20,
      y: this.assistTarget.y - 4
    };
  }

  findDropDirection(target, world, abilities) {
    const tileSize = world.tileSize;
    const footTileX = Math.floor(this.x / tileSize);
    const footTileY = Math.floor((this.y + this.height / 2 - 1) / tileSize);
    const preferredDir = Math.sign(target.x - this.x) || 1;
    const dirs = preferredDir > 0 ? [1, -1] : [-1, 1];
    for (let step = 1; step <= 4; step += 1) {
      for (let i = 0; i < dirs.length; i += 1) {
        const dir = dirs[i];
        const testX = footTileX + dir * step;
        const bodyClear = !world.isSolid(testX, footTileY, abilities, { ignoreOneWay: true });
        const headClear = !world.isSolid(testX, footTileY - 1, abilities, { ignoreOneWay: true });
        const supportBelow = world.isSolid(testX, footTileY + 1, abilities, { ignoreOneWay: false });
        if (bodyClear && headClear && !supportBelow) {
          return dir;
        }
      }
    }
    return 0;
  }

  findClimbWallDirection(target, world, abilities) {
    const tileSize = world.tileSize;
    const tileX = Math.floor(this.x / tileSize);
    const tileY = Math.floor(this.y / tileSize);
    const preferDir = Math.sign(target.x - this.x) || this.facing || 1;
    const dirs = preferDir > 0 ? [1, -1] : [-1, 1];
    for (let i = 0; i < dirs.length; i += 1) {
      const dir = dirs[i];
      const wallX = tileX + dir;
      const hasWall = world.isSolid(wallX, tileY, abilities, { ignoreOneWay: true })
        || world.isSolid(wallX, tileY - 1, abilities, { ignoreOneWay: true });
      if (!hasWall) continue;
      const headRoom = !world.isSolid(tileX, tileY - 2, abilities, { ignoreOneWay: true });
      if (headRoom) return dir;
    }
    return 0;
  }

  findDetourStandTile(goalTile, world, abilities) {
    const start = this.getFootStandTile(world);
    if (!this.canStandOnTile(start.x, start.y, world, abilities)) return null;
    const preferredDir = Math.sign(goalTile.x - start.x) || 1;
    const dirs = preferredDir > 0 ? [1, -1] : [-1, 1];
    const hasHeadroom = (x, y) => {
      for (let up = 1; up <= 4; up += 1) {
        if (world.isSolid(x, y - up, abilities, { ignoreOneWay: true })) return false;
      }
      return true;
    };
    for (let step = 1; step <= 8; step += 1) {
      for (let i = 0; i < dirs.length; i += 1) {
        const x = start.x + dirs[i] * step;
        const y = start.y;
        if (!this.canStandOnTile(x, y, world, abilities)) continue;
        if (!hasHeadroom(x, y)) continue;
        return { x, y };
      }
    }
    return null;
  }

  recordPlayerTraceTile(player, world, abilities, dt) {
    this.traceRecordCooldown = Math.max(0, this.traceRecordCooldown - dt);
    if (this.traceRecordCooldown > 0) return;
    const tileSize = world.tileSize;
    const tile = {
      x: Math.floor(player.x / tileSize),
      y: Math.floor((player.y + player.height / 2 - 1) / tileSize)
    };
    if (!this.canStandOnTile(tile.x, tile.y, world, abilities)) return;
    const last = this.playerTraceTiles[this.playerTraceTiles.length - 1];
    if (!last || last.x !== tile.x || last.y !== tile.y) {
      this.playerTraceTiles.push(tile);
      if (this.playerTraceTiles.length > this.playerTraceMax) {
        this.playerTraceTiles.splice(0, this.playerTraceTiles.length - this.playerTraceMax);
      }
    }
    this.traceRecordCooldown = 0.08;
  }

  findTraceRouteStep(world, abilities) {
    if (!this.playerTraceTiles.length) return null;
    const start = this.getFootStandTile(world);
    const lastIndex = this.playerTraceTiles.length - 1;
    let nearestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.playerTraceTiles.length; i += 1) {
      const node = this.playerTraceTiles[i];
      const dist = Math.abs(node.x - start.x) + Math.abs(node.y - start.y);
      if (dist < bestDistance) {
        bestDistance = dist;
        nearestIndex = i;
      }
    }

    const candidateIndices = [];
    const used = new Set();
    const pushIndex = (idx) => {
      const clamped = Math.max(0, Math.min(lastIndex, idx));
      if (used.has(clamped)) return;
      used.add(clamped);
      candidateIndices.push(clamped);
    };

    // Primary target: the next step after where the companion currently aligns on the trace.
    pushIndex(nearestIndex + 1);

    // Reverse-binary fallback from that point toward the newest trace.
    let probe = Math.max(nearestIndex + 1, 0);
    for (let i = 0; i < 6; i += 1) {
      probe = Math.floor((probe + lastIndex) / 2);
      pushIndex(probe);
      if (probe >= lastIndex) break;
    }

    pushIndex(lastIndex);

    for (let i = nearestIndex; i >= 0 && candidateIndices.length < 12; i -= 3) {
      pushIndex(i);
    }

    for (let i = 0; i < candidateIndices.length; i += 1) {
      const step = this.findRouteStepToward(this.playerTraceTiles[candidateIndices[i]], world, abilities);
      if (step) return step;
    }
    return null;
  }

  findNextTraceTile(world) {
    if (!this.playerTraceTiles.length) return null;
    const start = this.getFootStandTile(world);
    let nearestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.playerTraceTiles.length; i += 1) {
      const node = this.playerTraceTiles[i];
      const dist = Math.abs(node.x - start.x) + Math.abs(node.y - start.y);
      if (dist < bestDistance) {
        bestDistance = dist;
        nearestIndex = i;
      }
    }
    const nextIndex = Math.min(this.playerTraceTiles.length - 1, nearestIndex + 1);
    return this.playerTraceTiles[nextIndex];
  }

  findTailTraceTile() {
    if (!this.playerTraceTiles.length) return null;
    const index = Math.max(0, this.playerTraceTiles.length - 1 - this.traceTailDelay);
    return this.playerTraceTiles[index];
  }

  update(dt, world, abilities, context = {}) {
    const player = context.player;
    if (!player) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.jumpDecisionCooldown = Math.max(0, this.jumpDecisionCooldown - dt);
    this.assistHoldTimer = Math.max(0, this.assistHoldTimer - dt);
    this.jumpSuppressTimer = Math.max(0, this.jumpSuppressTimer - dt);
    this.routePlanCooldown = Math.max(0, this.routePlanCooldown - dt);
    if (this.onGround) {
      this.aiAirJumpUsed = false;
      this.jumpStallCounter = 0;
      this.jumpStallBestY = this.y;
    }
    this.recordPlayerTraceTile(player, world, abilities, dt);

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

    let target = this.assistTarget
      ? this.buildAssistTarget(player, world, abilities)
      : this.buildFollowTarget(player, world, abilities);
    if (!this.assistTarget) {
      if (this.traceOnlyFollow) {
        const traceTile = this.findTailTraceTile() || this.findNextTraceTile(world);
        if (traceTile) {
          target = {
            x: (traceTile.x + 0.5) * world.tileSize,
            y: (traceTile.y + 0.5) * world.tileSize
          };
          this.routeStepTile = traceTile;
          this.routePlanCooldown = 0.18;
        }
      }
      if (!this.traceOnlyFollow || !this.routeStepTile) {
      const followTile = this.findFollowStandTile(player, world, abilities);
      let failedRoutePlan = false;
      if (this.routePlanCooldown <= 0 || !this.routeStepTile) {
        const candidateTiles = this.buildFollowStandCandidates(player, world)
          .filter((tile) => this.canStandOnTile(tile.x, tile.y, world, abilities))
          .slice(0, 4);
        let plannedStep = null;
        for (let i = 0; i < candidateTiles.length; i += 1) {
          const step = this.findRouteStepToward(candidateTiles[i], world, abilities);
          if (step) {
            plannedStep = step;
            break;
          }
        }
        this.routeStepTile = plannedStep || this.findRouteStepToward(followTile, world, abilities);
        failedRoutePlan = !this.routeStepTile;
        this.routePlanCooldown = 0.28;
      }
      if (this.routeStepTile) {
        target = {
          x: (this.routeStepTile.x + 0.5) * world.tileSize,
          y: (this.routeStepTile.y + 0.5) * world.tileSize
        };
      } else if (failedRoutePlan) {
        const traceStep = this.findTraceRouteStep(world, abilities);
        if (traceStep) {
          target = {
            x: (traceStep.x + 0.5) * world.tileSize,
            y: (traceStep.y + 0.5) * world.tileSize
          };
        } else {
          const detourTile = this.findDetourStandTile(followTile, world, abilities);
          if (detourTile) {
            target = {
              x: (detourTile.x + 0.5) * world.tileSize,
              y: (detourTile.y + 0.5) * world.tileSize
            };
            this.jumpSuppressTimer = Math.max(this.jumpSuppressTimer, 0.35);
          }
        }
      }
      }
    }
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const nextInput = new Set();
    const flankX = player.x - (player.facing || 1) * world.tileSize * 2;
    if (this.jumpSuppressTimer > 0 && Math.abs(dx) < world.tileSize * 1.25) {
      if (flankX < this.x - 4) nextInput.add('left');
      if (flankX > this.x + 4) nextInput.add('right');
    }
    if (dx < -14) nextInput.add('left');
    if (dx > 14) nextInput.add('right');

    const wantsToDescend = dy > world.tileSize * 1.1;
    const onOneWay = this.onGround && world.isOneWay?.(
      Math.floor(this.x / world.tileSize),
      Math.floor((this.y + this.height / 2 - 1) / world.tileSize)
    );
    if (wantsToDescend && this.onGround && Math.abs(dx) < world.tileSize * 0.55) {
      if (dx < -4) nextInput.add('left');
      if (dx > 4) nextInput.add('right');
      const dropDir = this.findDropDirection(target, world, abilities);
      if (dropDir < 0) nextInput.add('left');
      if (dropDir > 0) nextInput.add('right');
      if (onOneWay && this.jumpDecisionCooldown <= 0 && Math.abs(dx) < world.tileSize * 0.4) {
        nextInput.add('down');
        nextInput.add('jump');
        this.jumpDecisionCooldown = 0.25;
      }
    }

    const canGroundJump = this.onGround || this.coyote > 0 || this.onWall !== 0;
    const canAirRecoverJump = !canGroundJump
      && this.jumpsRemaining > 0
      && !this.aiAirJumpUsed
      && dy < -70
      && Math.abs(dx) > 24
      && this.vy > -40;
    const shouldJump = this.jumpDecisionCooldown <= 0
      && (dy < -22 && canGroundJump || canAirRecoverJump);
    const climbDir = dy < -world.tileSize * 0.9 ? this.findClimbWallDirection(target, world, abilities) : 0;
    if (climbDir < 0) nextInput.add('left');
    if (climbDir > 0) nextInput.add('right');
    const wallClimbJump = dy < -18 && abilities.magboots && (this.onWall !== 0 || climbDir !== 0);
    if (wallClimbJump) {
      const wallDir = this.onWall || climbDir;
      if (wallDir > 0) nextInput.add('right');
      if (wallDir < 0) nextInput.add('left');
    }
    const flappingRisk = dy < -52 && Math.abs(dx) < 18 && this.onWall === 0 && climbDir === 0;
    if (shouldJump && this.jumpSuppressTimer <= 0 && !flappingRisk) {
      nextInput.add('jump');
      this.jumpDecisionCooldown = 0.2;
      if (!canGroundJump) {
        this.aiAirJumpUsed = true;
      }
      if (dy < -22) {
        if (this.y >= this.jumpStallBestY - 8) {
          this.jumpStallCounter += 1;
        } else {
          this.jumpStallCounter = 0;
          this.jumpStallBestY = this.y;
        }
      }
    } else if (wallClimbJump && this.jumpDecisionCooldown <= 0 && this.jumpSuppressTimer <= 0) {
      nextInput.add('jump');
      this.jumpDecisionCooldown = 0.16;
    } else if (flappingRisk) {
      this.jumpStallCounter += 1;
    }
    if (this.jumpStallCounter >= 3) {
      this.jumpSuppressTimer = 0.85;
      this.jumpStallCounter = 0;
    }
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
}
