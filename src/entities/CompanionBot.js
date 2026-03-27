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
    this.width = 22;
    this.height = 34;
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
    this.utilityTimer = 0;
    this.bootTimer = 1.3;
    this.wrongTargetTimer = 0;
    this.stutterTimer = 0;
    this.targetEnemy = null;
    this.targetSwitch = null;
    this.teleportDistanceTiles = 11;
    this.playerTrail = [];
    this.trailClock = 0;
    this.trailSampleTimer = 0;
    this.replayDelay = 0.42;
    this.replayActive = false;
    this.replayModeTimer = 0;
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
    // Keep a little more space so jumps/double-jumps do not cause nervous close tracking.
    this.followSlack = clamp(84 - (this.assistLevel - 1) * 6, 44, 92);
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
    this.utilityTimer = Math.max(0, this.utilityTimer - dt);
    this.behaviorTimer = Math.max(0, this.behaviorTimer - dt);
    this.hesitationTimer = Math.max(0, this.hesitationTimer - dt);
    this.wrongTargetTimer = Math.max(0, this.wrongTargetTimer - dt);
    this.stutterTimer = Math.max(0, this.stutterTimer - dt);
    this.replayModeTimer = Math.max(0, this.replayModeTimer - dt);
    this.recordPlayerTrail(player, dt);

    if (this.state === BOT_STATES.BOOTING) {
      this.bootTimer = Math.max(0, this.bootTimer - dt);
      if (this.bootTimer <= 0) {
        this.state = BOT_STATES.FOLLOW;
      }
    }

    const playerDistance = Math.hypot(player.x - this.x, player.y - this.y);
    const teleportDistance = this.teleportDistanceTiles * world.tileSize;
    if (playerDistance > teleportDistance) {
      if (!this.replayActive) {
        this.replayActive = true;
        this.replayModeTimer = 1.15;
      } else if (this.replayModeTimer <= 0 && playerDistance > teleportDistance) {
        this.snapNearPlayer(player, world);
        this.replayActive = false;
      }
    } else if (this.replayActive && playerDistance <= this.followSlack * 1.2) {
      this.replayActive = false;
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
    let replaySnapshot = this.getReplaySnapshot();
    if (this.replayActive && replaySnapshot) {
      target = { x: replaySnapshot.x, y: replaySnapshot.y };
    }
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
    this.applyMovement(dt, world, target, immobilized, replaySnapshot);

    if (!immobilized && this.state === BOT_STATES.ASSIST_SWITCH && this.targetSwitch && this.utilityTimer <= 0) {
      const range = Math.hypot(this.x - this.targetSwitch.x, this.y - this.targetSwitch.y);
      if (range < 18 && (!this.shouldFailAction() || this.assistLevel >= 4)) {
        const assisted = onAssistSwitch?.(this.targetSwitch.tileX, this.targetSwitch.tileY, this);
        this.utilityTimer = assisted ? 0.9 : 0.35;
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
    const verticalDelta = Math.abs(player.y - this.y);
    if (distance < this.followSlack * 0.78 && verticalDelta < 82) {
      return { x: this.x, y: this.y };
    }
    const side = this.pickFollowSide(player, distance);
    return {
      x: player.x - side * this.followSlack,
      y: player.y - 4
    };
  }

  recordPlayerTrail(player, dt) {
    this.trailClock += dt;
    this.trailSampleTimer = Math.max(0, this.trailSampleTimer - dt);
    if (this.trailSampleTimer > 0) return;
    this.trailSampleTimer = 0.05;
    this.playerTrail.push({
      time: this.trailClock,
      x: player.x,
      y: player.y,
      vy: player.vy,
      facing: player.facing
    });
    const maxEntries = 220;
    if (this.playerTrail.length > maxEntries) {
      this.playerTrail.splice(0, this.playerTrail.length - maxEntries);
    }
  }

  getReplaySnapshot() {
    if (!this.playerTrail.length) return null;
    const targetTime = this.trailClock - this.replayDelay;
    for (let index = this.playerTrail.length - 1; index >= 0; index -= 1) {
      const entry = this.playerTrail[index];
      if (entry.time <= targetTime) {
        return entry;
      }
    }
    return this.playerTrail[0];
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

  applyMovement(dt, world, target, immobilized, replaySnapshot = null) {
    const desiredDx = target.x - this.x;
    const desiredDy = target.y - this.y;
    const nearTarget = Math.abs(desiredDx) < 8 && Math.abs(desiredDy) < 12;
    if (nearTarget && this.onGround) {
      this.vx *= 0.75;
      this.vy = Math.min(this.vy, 0);
    }
    if (!immobilized) {
      const desiredVx = clamp(desiredDx * 3.2, -140, 140);
      this.vx += (desiredVx - this.vx) * clamp(dt * 7, 0, 1);
      if (Math.abs(desiredDx) > 8) {
        this.facing = Math.sign(desiredDx) || this.facing;
      }
      const replayJump = replaySnapshot && replaySnapshot.vy < -MOVEMENT_MODEL.baseJumpPower * 0.42;
      const shouldJump = this.onGround && (desiredDy < -26 || replayJump) && Math.abs(desiredDx) < 96;
      if (shouldJump) {
        this.vy = -MOVEMENT_MODEL.baseJumpPower;
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
      const currentRect = this.rect;
      const testX = nextX + signX * rect.w * 0.5;
      const topY = currentRect.y + 3;
      const bottomY = currentRect.y + currentRect.h - 3;
      if (checkSolid(testX, topY, true) || checkSolid(testX, bottomY, true)) {
        if (this.onGround && Math.abs(this.vx) > 40) {
          this.vy = Math.min(this.vy, -MOVEMENT_MODEL.baseJumpPower * 0.45);
        }
        this.vx = 0;
      } else {
        this.x = nextX;
      }
    } else {
      this.x = nextX;
    }

    const signY = Math.sign(this.vy);
    if (signY !== 0) {
      const currentRect = this.rect;
      const testY = nextY + signY * rect.h * 0.5;
      const ignoreOneWay = signY < 0;
      const leftX = currentRect.x + 3;
      const rightX = currentRect.x + currentRect.w - 3;
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
    const corrupted = this.state === BOT_STATES.CORRUPTED || broken;
    const bodyFill = broken ? '#b78795' : '#ff8fb4';
    const stroke = corrupted ? '#5f2f3b' : '#7a2e45';
    const eyeColor = corrupted ? '#ffd4df' : '#fff6fb';
    const accent = corrupted ? '#ff617f' : '#ffc1d5';
    const walkPhase = performance.now() * 0.012;
    const armSwing = Math.sin(walkPhase) * 2.4;
    const legSwing = Math.sin(walkPhase + Math.PI) * 2.8;
    const hipY = 10;
    const shoulderY = -8;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = booting ? 0.55 + Math.sin(performance.now() * 0.01) * 0.25 : 1;

    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = bodyFill;

    // Player-like silhouette with companion pink styling.
    ctx.beginPath();
    ctx.arc(0, -this.height / 2 + 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-6, shoulderY);
    ctx.lineTo(6, shoulderY);
    ctx.lineTo(8, hipY);
    ctx.lineTo(-8, hipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-10, shoulderY);
    ctx.lineTo(-14 - armSwing, shoulderY + 8);
    ctx.moveTo(10, shoulderY);
    ctx.lineTo(14 + armSwing, shoulderY + 8);
    ctx.moveTo(-6, hipY);
    ctx.lineTo(-7 - legSwing * 0.45, hipY + 12);
    ctx.moveTo(6, hipY);
    ctx.lineTo(7 + legSwing * 0.45, hipY + 12);
    ctx.stroke();

    ctx.fillStyle = eyeColor;
    ctx.fillRect(this.facing > 0 ? 1 : -4, -this.height / 2 + 7, 4, 2);
    ctx.fillStyle = accent;
    ctx.fillRect(-5, shoulderY + 7, 10, 2);

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
