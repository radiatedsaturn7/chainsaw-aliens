import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class BroodTitan extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'broodtitan',
      sizeTiles: 20,
      health: 36,
      attackTimer: 2.8,
      deathDuration: 4.8
    });
    this.spawnTimer = 2.4;
    this.spitTimer = 1.8;
    this.originX = x;
    this.originY = y;
  }

  update(dt, player, context = {}) {
    this.animTime += dt;
    this.x = this.originX + Math.sin(this.animTime * 0.3) * 30;
    this.y = this.originY + Math.cos(this.animTime * 0.35) * 20;
    this.spawnTimer -= dt;
    this.spitTimer -= dt;

    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.2;
      const offset = this.width * 0.2;
      context.spawnMinion?.(this.x - offset, this.y + offset * 0.2);
      context.spawnMinion?.(this.x + offset, this.y - offset * 0.1);
    }

    if (context.canShoot?.(this, 520) && this.spitTimer <= 0) {
      this.spitTimer = 2.1;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 210;
      context.spawnProjectile?.(
        this.x,
        this.y - this.height * 0.1,
        (dx / dist) * speed,
        (dy / dist) * speed,
        1
      );
    }

    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.25);
  }

  draw(ctx) {
    const size = this.width * 0.3;
    const pulse = Math.sin(this.animTime * 2.4) * size * 0.05;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.75);
    }
    applyEnemyPalette(ctx, false);
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.7 + pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-size * 0.55, -size * 0.1, size * 0.25, 0, Math.PI * 2);
    ctx.arc(size * 0.55, -size * 0.1, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.9, size * 0.2);
    ctx.lineTo(-size * 1.2, size * 0.6 + pulse);
    ctx.moveTo(size * 0.9, size * 0.2);
    ctx.lineTo(size * 1.2, size * 0.6 + pulse);
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, -size * 0.05);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.12);
      ctx.restore();
    }
  }
}
