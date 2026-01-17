import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class NullAegis extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'nullaegis',
      sizeTiles: 22,
      health: 38,
      attackTimer: 2.0,
      deathDuration: 4.6
    });
    this.patternFlip = false;
  }

  update(dt, player, context = {}) {
    this.animTime += dt;
    this.attackTimer -= dt;
    if (context.isVisible?.(this, 560) && this.attackTimer <= 0) {
      this.attackTimer = 2.2;
      this.patternFlip = !this.patternFlip;
      const count = 4;
      const baseAngle = this.patternFlip ? Math.PI / 4 : 0;
      for (let i = 0; i < count; i += 1) {
        const angle = baseAngle + (Math.PI / 2) * i;
        context.spawnProjectile?.(
          this.x,
          this.y,
          Math.cos(angle) * 240,
          Math.sin(angle) * 240,
          1
        );
      }
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.18);
  }

  draw(ctx) {
    const size = this.width * 0.31;
    const pulse = Math.sin(this.animTime * 1.6) * size * 0.04;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.78);
    }
    applyEnemyPalette(ctx, false);
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.moveTo(-size * 1.1, -size * 0.2 - pulse);
    ctx.lineTo(0, -size - pulse);
    ctx.lineTo(size * 1.1, -size * 0.2 - pulse);
    ctx.lineTo(size * 0.9, size * 0.7 + pulse);
    ctx.lineTo(-size * 0.9, size * 0.7 + pulse);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.6, 0);
    ctx.lineTo(size * 0.6, 0);
    ctx.moveTo(0, -size * 0.6);
    ctx.lineTo(0, size * 0.6);
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, -size * 0.05);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.08);
      ctx.restore();
    }
  }
}
