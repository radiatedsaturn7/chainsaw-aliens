import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class GraveWarden extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'gravewarden',
      sizeTiles: 26,
      health: 74,
      attackTimer: 2.6,
      deathDuration: 4.9
    });
    this.ringAngle = 0;
    this.originX = x;
    this.originY = y;
    this.moveTime = 0;
    this.volleyTimer = 1.8;
  }

  update(dt, player, context = {}) {
    this.updateVulnerability(dt);
    const aggression = this.aggression;
    const phase = this.phase;
    this.animTime += dt * aggression;
    this.moveTime += dt * (0.2 + aggression * 0.15);
    this.ringAngle += dt * (0.4 + aggression * 0.25);
    this.attackTimer -= dt * aggression;
    this.volleyTimer -= dt * aggression;
    this.x = this.originX + Math.sin(this.moveTime * 0.35) * this.tileSize * (phase === 2 ? 14 : 10);
    this.y = this.originY + Math.cos(this.moveTime * 0.55) * this.tileSize * (phase === 2 ? 12 : 8);
    if (context.isVisible?.(this, 740) && this.attackTimer <= 0) {
      this.attackTimer = 2.8 / aggression;
      const count = 12 + phase * 2;
      const speed = 140 + phase * 25;
      for (let i = 0; i < count; i += 1) {
        const angle = this.ringAngle + (Math.PI * 2 * i) / count;
        context.spawnProjectile?.(
          this.x,
          this.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          1
        );
      }
    }
    if (phase >= 1 && context.canShoot?.(this, 760) && this.volleyTimer <= 0) {
      this.volleyTimer = 2.6 / aggression;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const baseAngle = Math.atan2(dy, dx);
      const speed = 210 + phase * 30;
      context.spawnProjectile?.(this.x, this.y, Math.cos(baseAngle) * speed, Math.sin(baseAngle) * speed, 1);
      context.spawnProjectile?.(this.x, this.y, Math.cos(baseAngle + 0.4) * speed, Math.sin(baseAngle + 0.4) * speed, 1);
      if (phase === 2) {
        this.triggerVulnerability(1.1);
        context.spawnMinion?.(this.x, this.y + this.height * 0.2);
      }
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  draw(ctx) {
    const size = this.width * 0.29;
    const maw = Math.sin(this.animTime * 2) * size * 0.08;
    ctx.save();
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.74);
    }
    applyEnemyPalette(ctx, flash, ctx.globalAlpha, { color: '#ff7ad6', amount: this.getTintAmount() });
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.rect(-size * 1.1, -size * 0.7, size * 2.2, size * 1.4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.9, size * 0.1 + maw);
    ctx.lineTo(-size * 0.4, size * 0.5 + maw);
    ctx.moveTo(size * 0.9, size * 0.1 + maw);
    ctx.lineTo(size * 0.4, size * 0.5 + maw);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.6, size * 0.3 + maw);
    ctx.lineTo(size * 0.6, size * 0.3 + maw);
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, -size * 0.08);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.2);
      ctx.restore();
    }
  }
}
