import EnemyBase from './EnemyBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class Ranger extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'ranger';
    this.health = 3;
    this.speed = 140;
    this.cooldown = 1.4;
  }

  update(dt, player, context = {}) {
    this.animTime = (this.animTime || 0) + dt;
    const dx = player.x - this.x;
    const absDist = Math.abs(dx);
    this.facing = Math.sign(dx) || this.facing;
    if (absDist < 120) {
      this.vx = -this.facing * this.speed;
    } else if (absDist > 220) {
      this.vx = this.facing * this.speed;
    } else {
      this.vx = 0;
    }
    this.x += this.vx * dt;

    this.cooldown -= dt;
    if (context.canShoot?.(this, 300) && this.cooldown <= 0) {
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 220;
      this.cooldown = 1.8;
      context.spawnProjectile?.(this.x, this.y - 6, (dx / dist) * speed, (dy / dist) * speed, 1);
    }

    this.stagger = Math.max(0, this.stagger - dt * 0.5);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    applyEnemyPalette(ctx, flash, alpha);
    ctx.lineWidth = 2;
    const pulse = Math.sin(this.animTime * 5) * 2;
    ctx.beginPath();
    ctx.rect(-14, -12, 28, 24);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(10, -4);
    ctx.lineTo(10 + pulse, 6);
    ctx.lineTo(-10 - pulse, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-4, -4, 2, 0, Math.PI * 2);
    ctx.arc(4, -4, 2, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_PALETTE.accent;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
