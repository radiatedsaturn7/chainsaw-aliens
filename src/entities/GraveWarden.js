import BossBase from './BossBase.js';

export default class GraveWarden extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'gravewarden',
      sizeTiles: 26,
      health: 44,
      attackTimer: 2.6,
      deathDuration: 4.9
    });
    this.ringAngle = 0;
  }

  update(dt, player, context = {}) {
    this.animTime += dt;
    this.ringAngle += dt * 0.4;
    this.attackTimer -= dt;
    if (context.isVisible?.(this, 640) && this.attackTimer <= 0) {
      this.attackTimer = 2.8;
      const count = 12;
      const speed = 140;
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
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  draw(ctx) {
    const size = this.width * 0.29;
    const maw = Math.sin(this.animTime * 2) * size * 0.08;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.74);
    }
    ctx.strokeStyle = '#ff8f8f';
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.rect(-size * 1.1, -size * 0.7, size * 2.2, size * 1.4);
    ctx.stroke();
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
