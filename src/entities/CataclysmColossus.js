import BossBase from './BossBase.js';

export default class CataclysmColossus extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'cataclysmcolossus',
      sizeTiles: 64,
      health: 80,
      attackTimer: 2.8,
      deathDuration: 6.2
    });
    this.stormTimer = 1.4;
    this.originX = x;
    this.originY = y;
  }

  update(dt, player, context = {}) {
    this.animTime += dt;
    this.x = this.originX + Math.sin(this.animTime * 0.2) * 120;
    this.y = this.originY + Math.cos(this.animTime * 0.18) * 90;
    this.attackTimer -= dt;
    this.stormTimer -= dt;

    if (context.isVisible?.(this, 900) && this.stormTimer <= 0) {
      this.stormTimer = 1.6;
      const count = 12;
      const spread = this.width * 0.4;
      for (let i = 0; i < count; i += 1) {
        const offset = -spread + (spread * 2 * i) / (count - 1);
        const vx = offset * 0.1 + (Math.random() - 0.5) * 40;
        const vy = 280 + Math.random() * 60;
        context.spawnProjectile?.(this.x + offset, this.y - this.height * 0.3, vx, vy, 1);
      }
    }

    if (context.canShoot?.(this, 900) && this.attackTimer <= 0) {
      this.attackTimer = 3.1;
      const rings = 10;
      const speed = 180;
      for (let i = 0; i < rings; i += 1) {
        const angle = (Math.PI * 2 * i) / rings + Math.sin(this.animTime) * 0.3;
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
    this.stagger = Math.max(0, this.stagger - dt * 0.1);
  }

  draw(ctx) {
    const size = this.width * 0.25;
    const pulse = Math.sin(this.animTime * 1.1) * size * 0.06;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.65);
    }
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = Math.max(4, this.width * 0.004);
    ctx.beginPath();
    ctx.arc(0, 0, size + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7 + pulse * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 1.1, -size * 0.2 - pulse);
    ctx.lineTo(-size * 0.6, -size * 0.8 - pulse);
    ctx.lineTo(0, -size * 0.5 - pulse);
    ctx.lineTo(size * 0.6, -size * 0.8 - pulse);
    ctx.lineTo(size * 1.1, -size * 0.2 - pulse);
    ctx.stroke();
    this.drawDeadEyes(ctx, size, -size * 0.1);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.4);
      ctx.restore();
    }
  }
}
