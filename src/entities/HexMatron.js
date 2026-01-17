import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class HexMatron extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'hexmatron',
      sizeTiles: 24,
      health: 40,
      attackTimer: 1.9,
      deathDuration: 4.8
    });
    this.originX = x;
    this.originY = y;
  }

  update(dt, player, context = {}) {
    this.animTime += dt;
    this.x = this.originX + Math.cos(this.animTime * 0.35) * 80;
    this.y = this.originY + Math.sin(this.animTime * 0.5) * 70;
    this.attackTimer -= dt;
    if (context.canShoot?.(this, 620) && this.attackTimer <= 0) {
      this.attackTimer = 2.1;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const baseAngle = Math.atan2(dy, dx);
      const speed = 240;
      for (let i = -1; i <= 1; i += 1) {
        const angle = baseAngle + i * 0.18;
        context.spawnProjectile?.(
          this.x + Math.cos(angle) * this.width * 0.15,
          this.y + Math.sin(angle) * this.height * 0.15,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          1
        );
      }
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  draw(ctx) {
    const size = this.width * 0.3;
    const sway = Math.sin(this.animTime * 2.2) * size * 0.05;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.76);
    }
    applyEnemyPalette(ctx, false);
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.arc(0, 0, size, Math.PI * 0.1, Math.PI * 0.9);
    ctx.arc(0, 0, size * 0.7, Math.PI * 0.9, Math.PI * 0.1, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.8, -size * 0.1 + sway);
    ctx.lineTo(-size * 1.1, -size * 0.5 + sway);
    ctx.moveTo(size * 0.8, -size * 0.1 + sway);
    ctx.lineTo(size * 1.1, -size * 0.5 + sway);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.6, size * 0.4 + sway);
    ctx.lineTo(size * 0.6, size * 0.4 + sway);
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, sway * 0.2);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.15);
      ctx.restore();
    }
  }
}
