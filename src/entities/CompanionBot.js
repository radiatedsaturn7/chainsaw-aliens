import { MOVEMENT_MODEL } from '../game/MovementModel.js';

const BOT_STATES = {
  INACTIVE: 'inactive',
  BOOTING: 'booting',
  FOLLOW: 'follow',
  ASSIST_SWITCH: 'assist-switch',
  ASSIST_COMBAT: 'assist-combat',
  CORRUPTED: 'corrupted',
  FAILING: 'failing',
  REMOVED: 'removed'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class CompanionBot {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = 18;
    this.height = 18;
    this.onGround = false;
    this.facing = 1;
    this.state = BOT_STATES.BOOTING;

    this.assistLevel = 1;
    this.reactionDelay = 0.45;
    this.attackCooldown = 1.6;
    this.followSlack = 56;

    this.corruption = 0;
    this.failChance = 0;
    this.hesitationTimer = 0;

    this.behaviorTimer = 0;
    this.attackTimer = 0;
    this.bootTimer = 1.3;
    this.wrongTargetTimer = 0;
    this.stutterTimer = 0;
    this.targetEnemy = null;
    this.targetSwitch = null;
  }

  get rect() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height
    };
  }

  isActive() {
    return this.state !== BOT_STATES.INACTIVE && this.state !== BOT_STATES.REMOVED;
  }

  setState(next) {
    this.state = next;
  }

  setAssistLevel(level) {
    this.assistLevel = Math.max(1, Math.floor(level));
    this.reactionDelay = clamp(0.5 - (this.assistLevel - 1) * 0.07, 0.15, 0.55);
    this.attackCooldown = clamp(1.8 - (this.assistLevel - 1) * 0.22, 0.45, 2);
    this.followSlack = clamp(64 - (this.assistLevel - 1) * 5, 28, 70);
  }

  addAssistLevels(amount = 1) {
    this.setAssistLevel(this.assistLevel + amount);
  }

  beginCorruption(amount = 0.2) {
    this.corruption = clamp(this.corruption + Math.max(0, amount), 0, 1);
    this.failChance = clamp(this.corruption * 0.65, 0, 0.8);
    if (this.corruption >= 0.35 && this.state !== BOT_STATES.FAILING) {
      this.state = BOT_STATES.CORRUPTED;
    }
    if (this.corruption >= 0.75) {
      this.state = BOT_STATES.FAILING;
    }
  }

  remove() {
    this.state = BOT_STATES.REMOVED;
    this.vx = 0;
    this.vy = 0;
  }

  snapNearPlayer(player, world) {
    const side = player.facing || this.facing || 1;
    const offsetX = side * (this.followSlack + 14);
    this.x = player.x - offsetX;
    this.y = player.y - 4;
    if (this.isPointBlocked(this.x, this.y, world, true)) {
      this.x = player.x + offsetX;
      this.y = player.y - 8;
    }
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  update(dt, context = {}) {
    const { player, world, enemies = [], onAssistAttack, onAssistSwitch } = context;
    if (!player || !world) return;
    if (this.state === BOT_STATES.INACTIVE || this.state === BOT_STATES.REMOVED) return;

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.behaviorTimer = Math.max(0, this.behaviorTimer - dt);
    this.hesitationTimer = Math.max(0, this.hesitationTimer - dt);
    this.wrongTargetTimer = Math.max(0, this.wrongTargetTimer - dt);
    this.stutterTimer = Math.max(0, this.stutterTimer - dt);

    if (this.state === BOT_STATES.BOOTING) {
      this.bootTimer = Math.max(0, this.bootTimer - dt);
      if (this.bootTimer <= 0) {
        this.state = BOT_STATES.FOLLOW;
      }
    }

    const playerDistance = Math.hypot(player.x - this.x, player.y - this.y);
    if (playerDistance > 560) {
      this.snapNearPlayer(player, world);
    }

    if (this.state === BOT_STATES.CORRUPTED || this.state === BOT_STATES.FAILING) {
      this.applyCorruptionDrift(dt);
    }

    if (this.hesitationTimer <= 0 && this.shouldHesitate()) {
      this.hesitationTimer = 0.08 + Math.random() * 0.34;
    }

    if (this.stutterTimer <= 0 && this.shouldStutter()) {
      this.stutterTimer = 0.12 + Math.random() * 0.26;
    }

    let target = this.computeFollowTarget(player);
    let desiredState = this.state;

    if (this.state !== BOT_STATES.BOOTING) {
      const switchTarget = this.findSwitchAssistTarget(player, world);
      const combatTarget = this.findCombatTarget(player, enemies);
      if (switchTarget) {
        this.targetSwitch = switchTarget;
        target = switchTarget;
        desiredState = BOT_STATES.ASSIST_SWITCH;
      } else if (combatTarget) {
        this.targetEnemy = combatTarget.enemy;
        target = combatTarget;
        desiredState = BOT_STATES.ASSIST_COMBAT;
      } else {
        this.targetEnemy = null;
        this.targetSwitch = null;
        if (this.state !== BOT_STATES.CORRUPTED && this.state !== BOT_STATES.FAILING) {
          desiredState = BOT_STATES.FOLLOW;
        }
      }
    }

    if (this.state !== BOT_STATES.BOOTING && this.state !== BOT_STATES.CORRUPTED && this.state !== BOT_STATES.FAILING) {
      this.state = desiredState;
    }

    const immobilized = this.hesitationTimer > 0 || this.stutterTimer > 0;
    this.applyMovement(dt, world, target, immobilized);

    if (!immobilized && this.state === BOT_STATES.ASSIST_SWITCH && this.targetSwitch) {
      const range = Math.hypot(this.x - this.targetSwitch.x, this.y - this.targetSwitch.y);
      if (range < 18 && (!this.shouldFailAction() || this.assistLevel >= 4)) {
        onAssistSwitch?.(this.targetSwitch.tileX, this.targetSwitch.tileY, this);
      }
    }

    if (!immobilized && this.state === BOT_STATES.ASSIST_COMBAT && this.targetEnemy && this.attackTimer <= 0) {
      const range = Math.hypot(this.x - this.targetEnemy.x, this.y - this.targetEnemy.y);
      if (range < 92 && (!this.shouldFailAction() || this.assistLevel >= 5)) {
        const damage = 1 + Math.floor((this.assistLevel - 1) / 2);
        onAssistAttack?.(this.targetEnemy, damage, this);
        this.attackTimer = this.attackCooldown;
      } else if (range < 92) {
        this.attackTimer = this.attackCooldown * 0.65;
      }
    }
  }

  applyCorruptionDrift(dt) {
    if (this.corruption <= 0) return;
    const jitter = this.corruption * 28;
    this.vx += (Math.random() - 0.5) * jitter * dt;
    if (this.corruption >= 0.75 && Math.random() < 0.2 * dt) {
      this.vx *= 0.2;
    }
  }

  shouldFailAction() {
    return this.failChance > 0 && Math.random() < this.failChance;
  }

  shouldHesitate() {
    return this.failChance > 0 && Math.random() < this.failChance * 0.7;
  }

  shouldStutter() {
    return this.failChance > 0.2 && Math.random() < this.failChance * 0.65;
  }

  computeFollowTarget(player) {
    const distance = Math.hypot(player.x - this.x, player.y - this.y);
    const side = this.pickFollowSide(player, distance);
    return {
      x: player.x - side * this.followSlack,
      y: player.y - 4
    };
  }

  pickFollowSide(player, distance) {
    if (distance > this.followSlack * 1.8) {
      return Math.sign(player.x - this.x) || player.facing || 1;
    }
    if (Math.abs(player.vx) > 30) {
      return Math.sign(player.vx);
    }
    return player.facing || this.facing || 1;
  }

  findSwitchAssistTarget(player, world) {
    const tileSize = world.tileSize;
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = Math.floor(player.y / tileSize);
    const radius = 3 + Math.min(this.assistLevel, 4);
    let best = null;
    for (let y = playerTileY - radius; y <= playerTileY + radius; y += 1) {
      for (let x = playerTileX - radius; x <= playerTileX + radius; x += 1) {
        if (world.getTile(x, y) !== 'T') continue;
        const centerX = (x + 0.5) * tileSize;
        const centerY = (y + 0.5) * tileSize;
        const distToPlayer = Math.hypot(player.x - centerX, player.y - centerY);
        if (distToPlayer > 220) continue;
        const score = distToPlayer + Math.hypot(this.x - centerX, this.y - centerY) * 0.35;
        if (!best || score < best.score) {
          best = { x: centerX, y: centerY, tileX: x, tileY: y, score };
        }
      }
    }
    return best;
  }

  findCombatTarget(player, enemies) {
    const nearby = enemies.filter((enemy) => !enemy.dead && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 180);
    if (!nearby.length) return null;
    if (this.corruption >= 0.45 && this.wrongTargetTimer <= 0 && Math.random() < this.failChance * 0.5) {
      this.wrongTargetTimer = 1.4;
      const odd = enemies.filter((enemy) => !enemy.dead && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 300);
      if (odd.length) {
        const pick = odd[Math.floor(Math.random() * odd.length)];
        return { x: pick.x, y: pick.y - 4, enemy: pick };
      }
    }
    const target = nearby.reduce((best, enemy) => {
      const score = Math.hypot(enemy.x - player.x, enemy.y - player.y) + Math.hypot(enemy.x - this.x, enemy.y - this.y) * 0.4;
      if (!best || score < best.score) {
        return { enemy, score };
      }
      return best;
    }, null)?.enemy;
    if (!target) return null;
    return { x: target.x, y: target.y - 4, enemy: target };
  }

  applyMovement(dt, world, target, immobilized) {
    const desiredDx = target.x - this.x;
    const desiredDy = target.y - this.y;
    if (!immobilized) {
      const desiredVx = clamp(desiredDx * 3.2, -140, 140);
      this.vx += (desiredVx - this.vx) * clamp(dt * 7, 0, 1);
      if (Math.abs(desiredDx) > 8) {
        this.facing = Math.sign(desiredDx) || this.facing;
      }
      const shouldJump = this.onGround && desiredDy < -26 && Math.abs(desiredDx) < 84;
      if (shouldJump) {
        this.vy = -MOVEMENT_MODEL.baseJumpPower * 0.78;
        this.onGround = false;
      }
    } else {
      this.vx *= 0.86;
    }

    this.vy += MOVEMENT_MODEL.gravity * dt * 0.92;
    this.moveAndCollide(dt, world);

    if (Math.abs(desiredDx) < 14 && this.onGround) {
      this.vx *= 0.72;
    }
  }

  moveAndCollide(dt, world) {
    const tileSize = world.tileSize;
    const rect = this.rect;
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;
    const checkSolid = (worldX, worldY, ignoreOneWay = false) => {
      const tileX = Math.floor(worldX / tileSize);
      const tileY = Math.floor(worldY / tileSize);
      return world.isSolid(tileX, tileY, {}, { ignoreOneWay });
    };

    this.onGround = false;

    const signX = Math.sign(this.vx);
    if (signX !== 0) {
      const testX = nextX + signX * rect.w * 0.5;
      const topY = rect.y + 3;
      const bottomY = rect.y + rect.h - 3;
      if (checkSolid(testX, topY, true) || checkSolid(testX, bottomY, true)) {
        this.vx = 0;
      } else {
        this.x = nextX;
      }
    } else {
      this.x = nextX;
    }

    const signY = Math.sign(this.vy);
    if (signY !== 0) {
      const testY = nextY + signY * rect.h * 0.5;
      const ignoreOneWay = signY < 0;
      const leftX = rect.x + 3;
      const rightX = rect.x + rect.w - 3;
      if (checkSolid(leftX, testY, ignoreOneWay) || checkSolid(rightX, testY, ignoreOneWay)) {
        if (signY > 0) {
          this.onGround = true;
        }
        this.vy = 0;
      } else {
        this.y = nextY;
      }
    } else {
      this.y = nextY;
    }
  }

  isPointBlocked(x, y, world, ignoreOneWay = true) {
    const rect = {
      x: x - this.width / 2,
      y: y - this.height / 2,
      w: this.width,
      h: this.height
    };
    const points = [
      { x: rect.x + 2, y: rect.y + 2 },
      { x: rect.x + rect.w - 2, y: rect.y + 2 },
      { x: rect.x + 2, y: rect.y + rect.h - 2 },
      { x: rect.x + rect.w - 2, y: rect.y + rect.h - 2 }
    ];
    return points.some((point) => world.isSolid(
      Math.floor(point.x / world.tileSize),
      Math.floor(point.y / world.tileSize),
      {},
      { ignoreOneWay }
    ));
  }

  draw(ctx) {
    if (!this.isActive()) return;
    const booting = this.state === BOT_STATES.BOOTING;
    const broken = this.state === BOT_STATES.FAILING;
    const core = this.state === BOT_STATES.CORRUPTED || broken
      ? '#ff8ca1'
      : '#9be9ff';

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = booting ? 0.55 + Math.sin(performance.now() * 0.01) * 0.25 : 1;

    ctx.fillStyle = broken ? '#5f6774' : '#8a93a6';
    ctx.fillRect(-8, -9, 16, 18);
    ctx.fillStyle = '#293040';
    ctx.fillRect(-6, -7, 12, 14);

    ctx.fillStyle = core;
    ctx.fillRect(2 * this.facing - 3, -2, 6, 4);
    ctx.fillStyle = '#1a202b';
    ctx.fillRect(-7, 9, 14, 2);

    if (this.corruption > 0) {
      ctx.strokeStyle = `rgba(255, 122, 148, ${0.25 + this.corruption * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(-9, -3);
      ctx.lineTo(9, 3);
      ctx.moveTo(-9, 3);
      ctx.lineTo(9, -3);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export { BOT_STATES };
