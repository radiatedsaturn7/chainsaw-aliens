import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class SunderBehemoth extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'sunderbehemoth',
      sizeTiles: 15,
      health: 28,
      attackTimer: 1.4,
      deathDuration: 4.4
    });
    this.spinAngle = 0;
    this.originX = x;
    this.originY = y;
  }

  update(dt, player, context = {}) {
    this.animTime += dt;
    this.spinAngle += dt * 0.8;
    const drift = Math.sin(this.animTime * 0.5) * 40;
    this.x = this.originX + drift;
    this.y = this.originY + Math.cos(this.animTime * 0.4) * 24;
    this.attackTimer -= dt;
    if (context.isVisible?.(this, 600) && this.attackTimer <= 0) {
      this.attackTimer = 1.2;
      const count = 8;
      const speed = 220;
      for (let i = 0; i < count; i += 1) {
        const angle = this.spinAngle + (Math.PI * 2 * i) / count;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        context.spawnProjectile?.(
          this.x + Math.cos(angle) * this.width * 0.18,
          this.y + Math.sin(angle) * this.height * 0.18,
          vx,
          vy,
          1
        );
      }
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  draw(ctx) {
    const size = this.width * 0.34;
    const pulse = Math.sin(this.animTime * 2) * size * 0.06;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.8);
    }
    applyEnemyPalette(ctx, false);
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.moveTo(0, -size - pulse);
    ctx.lineTo(size * 0.9, 0);
    ctx.lineTo(0, size + pulse);
    ctx.lineTo(-size * 0.9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.45 + pulse * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.rotate(this.spinAngle);
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.7, -size * 0.2);
    ctx.lineTo(-size * 1.1, -size * 0.6);
    ctx.moveTo(size * 0.7, -size * 0.2);
    ctx.lineTo(size * 1.1, -size * 0.6);
    ctx.moveTo(-size * 0.7, size * 0.2);
    ctx.lineTo(-size * 1.1, size * 0.6);
    ctx.moveTo(size * 0.7, size * 0.2);
    ctx.lineTo(size * 1.1, size * 0.6);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, pulse * 0.2);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.05);
      ctx.restore();
    }
  }
}
