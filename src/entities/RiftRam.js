import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class RiftRam extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'riftram',
      sizeTiles: 18,
      health: 68,
      attackTimer: 2.2,
      deathDuration: 4.6
    });
    this.chargeCooldown = 1.6;
    this.chargeTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.originX = x;
    this.originY = y;
    this.moveTime = 0;
    this.volleyTimer = 1.1;
  }

  update(dt, player, context = {}) {
    this.updateVulnerability(dt);
    const aggression = this.aggression;
    const phase = this.phase;
    this.animTime += dt * aggression;
    this.moveTime += dt * (0.35 + aggression * 0.2);
    if (this.chargeTimer > 0) {
      this.chargeTimer = Math.max(0, this.chargeTimer - dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.chargeTimer === 0) {
        this.vx = 0;
        this.vy = 0;
        this.triggerVulnerability(0.9);
      }
      return;
    }

    const driftX = Math.sin(this.moveTime * 0.6) * this.tileSize * (phase === 2 ? 16 : 12);
    const driftY = Math.cos(this.moveTime * 0.45) * this.tileSize * (phase === 2 ? 10 : 7);
    this.x = this.originX + driftX;
    this.y = this.originY + driftY;

    this.chargeCooldown -= dt * aggression;
    this.volleyTimer -= dt;
    if (this.chargeCooldown <= 0) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 320 + phase * 60;
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed * 0.6;
      this.chargeTimer = 0.8 + phase * 0.1;
      this.chargeCooldown = 2.8 / aggression;
      const burstAngle = Math.atan2(dy, dx);
      for (let i = -2 - phase; i <= 2 + phase; i += 1) {
        const angle = burstAngle + i * 0.18;
        context.spawnProjectile?.(
          this.x + Math.cos(angle) * this.width * 0.2,
          this.y + Math.sin(angle) * this.height * 0.2,
          Math.cos(angle) * 220,
          Math.sin(angle) * 220,
          1
        );
      }
    } else if (context.canShoot?.(this, 620) && this.attackTimer <= 0) {
      this.attackTimer = 2.2 / aggression;
      const dir = Math.sign(player.x - this.x) || 1;
      context.spawnProjectile?.(this.x, this.y - this.height * 0.1, dir * 280, -50, 1);
    }
    if (phase >= 1 && context.canShoot?.(this, 640) && this.volleyTimer <= 0) {
      this.volleyTimer = 1.4 / aggression;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 240 + phase * 40;
      context.spawnProjectile?.(this.x, this.y, (dx / dist) * speed, (dy / dist) * speed, 1);
      if (phase === 2) {
        context.spawnMinion?.(this.x + this.width * 0.1, this.y + this.height * 0.1);
      }
    }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  draw(ctx) {
    const size = this.width * 0.32;
    const tilt = Math.sin(this.animTime * 2.2) * size * 0.05;
    ctx.save();
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.8);
    }
    applyEnemyPalette(ctx, flash, ctx.globalAlpha, { color: '#ff7ad6', amount: this.getTintAmount() });
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.rect(-size, -size * 0.7 + tilt, size * 2, size * 1.4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 1.1, -size * 0.6 + tilt);
    ctx.lineTo(-size * 1.6, -size * 0.9 + tilt);
    ctx.moveTo(size * 1.1, -size * 0.6 + tilt);
    ctx.lineTo(size * 1.6, -size * 0.9 + tilt);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 1.1, size * 0.6 + tilt);
    ctx.lineTo(-size * 1.6, size * 0.9 + tilt);
    ctx.moveTo(size * 1.1, size * 0.6 + tilt);
    ctx.lineTo(size * 1.6, size * 0.9 + tilt);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0 + tilt * 0.3, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, tilt * 0.2);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.1);
      ctx.restore();
    }
  }
}
