import BossBase from './BossBase.js';

export default class ObsidianCrown extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'obsidiancrown',
      sizeTiles: 32,
      health: 52,
      attackTimer: 3.2,
      deathDuration: 5.2
    });
    this.barrageTimer = 1.2;
  }

  update(dt, player, context = {}) {
    this.animTime += dt;
    this.attackTimer -= dt;
    this.barrageTimer -= dt;

    if (context.isVisible?.(this, 720) && this.barrageTimer <= 0) {
      this.barrageTimer = 1.8;
      const columns = 6;
      const spread = this.width * 0.35;
      for (let i = 0; i < columns; i += 1) {
        const offset = -spread + (spread * 2 * i) / (columns - 1);
        context.spawnProjectile?.(
          this.x + offset,
          this.y - this.height * 0.2,
          offset * 0.15,
          260,
          1
        );
      }
    }

    if (context.canShoot?.(this, 720) && this.attackTimer <= 0) {
      this.attackTimer = 3.4;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 200;
      context.spawnProjectile?.(
        this.x,
        this.y,
        (dx / dist) * speed,
        (dy / dist) * speed,
        1
      );
    }

    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.15);
  }

  draw(ctx) {
    const size = this.width * 0.28;
    const pulse = Math.sin(this.animTime * 1.4) * size * 0.05;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.7);
    }
    ctx.strokeStyle = '#ff6f92';
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.moveTo(-size, size * 0.6 + pulse);
    ctx.lineTo(-size * 0.8, -size * 0.4 - pulse);
    ctx.lineTo(-size * 0.4, -size - pulse);
    ctx.lineTo(0, -size * 0.6 - pulse);
    ctx.lineTo(size * 0.4, -size - pulse);
    ctx.lineTo(size * 0.8, -size * 0.4 - pulse);
    ctx.lineTo(size, size * 0.6 + pulse);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, size * 0.1, size * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    this.drawDeadEyes(ctx, size, -size * 0.05);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.25);
      ctx.restore();
    }
  }
}
