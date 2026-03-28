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
      for (let i = 0; i < verticalOffsets.length; i += 1) {
        const candidateY = playerTileY + verticalOffsets[i];
        if (Math.abs(candidateY - playerTileY) > 2) continue;
        if (this.canStandOnTile(candidateX, candidateY, world, abilities)) {
          return { x: candidateX, y: candidateY };
        }
      }
    }
    for (let stepIndex = 0; stepIndex < uniqueColumns.length; stepIndex += 1) {
      const candidateX = uniqueColumns[stepIndex];
      for (let i = 0; i < verticalOffsets.length; i += 1) {
        const candidateY = playerTileY + verticalOffsets[i] + 1;
        if (this.canStandOnTile(candidateX, candidateY, world, abilities)) {
          return { x: candidateX, y: candidateY };
        }
      }
    }
    return { x: playerTileX, y: playerTileY };
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

  update(dt, world, abilities, context = {}) {
    const player = context.player;
    if (!player) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.jumpDecisionCooldown = Math.max(0, this.jumpDecisionCooldown - dt);
    this.assistHoldTimer = Math.max(0, this.assistHoldTimer - dt);
    this.jumpSuppressTimer = Math.max(0, this.jumpSuppressTimer - dt);
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

    const target = this.assistTarget
      ? this.buildAssistTarget(player, world, abilities)
      : this.buildFollowTarget(player, world, abilities);
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

    const canGroundJump = this.onGround || this.coyote > 0 || this.onWall !== 0;
    const canAirRecoverJump = !canGroundJump
      && this.jumpsRemaining > 0
      && !this.aiAirJumpUsed
      && dy < -70
      && Math.abs(dx) > 24
      && this.vy > -40;
    const shouldJump = this.jumpDecisionCooldown <= 0
      && (dy < -22 && canGroundJump || canAirRecoverJump);
    const flappingRisk = dy < -52 && Math.abs(dx) < 18 && this.onWall === 0;
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
