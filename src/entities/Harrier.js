import EnemyBase from './EnemyBase.js';

export default class Harrier extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'harrier';
    this.health = 4;
    this.speed = 140;
    this.cooldown = 1.3;
    this.solid = false;
    this.gravity = false;
  }

  update(dt, player, context = {}) {
    this.animTime = (this.animTime || 0) + dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const targetVx = (dx / dist) * this.speed;
    const targetVy = (dy / dist) * this.speed;
    this.vx += (targetVx - this.vx) * Math.min(1, dt * 3);
    this.vy += (targetVy - this.vy) * Math.min(1, dt * 3);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.facing = Math.sign(dx) || this.facing;

    this.cooldown -= dt;
    if (context.canShoot?.(this, 320) && this.cooldown <= 0) {
      const speed = 240;
      this.cooldown = 1.6;
      context.spawnProjectile?.(this.x, this.y, (dx / dist) * speed, (dy / dist) * speed, 1);
    }

    this.stagger = Math.max(0, this.stagger - dt * 0.45);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    ctx.strokeStyle = `rgba(255, 90, 90,${alpha})`;
    ctx.lineWidth = 2;
    const flap = Math.sin(this.animTime * 8) * 4;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(0, -8 - flap);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 8 + flap);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
