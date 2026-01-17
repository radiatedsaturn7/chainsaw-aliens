import EnemyBase from './EnemyBase.js';

export default class Coward extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'coward';
    this.health = 2;
    this.speed = 170;
  }

  update(dt, player) {
    this.animTime = (this.animTime || 0) + dt;
    const dist = player.x - this.x;
    const absDist = Math.abs(dist);
    if (absDist < 240) {
      const dir = dist === 0 ? -this.facing : -Math.sign(dist);
      this.facing = dir;
      this.vx = dir * this.speed;
    } else {
      this.vx = 0;
    }
    this.x += this.vx * dt;
    this.stagger = Math.max(0, this.stagger - dt * 0.7);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    ctx.strokeStyle = `rgba(255, 90, 90,${alpha})`;
    ctx.lineWidth = 2;
    const quiver = Math.sin(this.animTime * 10) * 2;
    ctx.beginPath();
    ctx.rect(-12, -10, 24, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.lineTo(0, -16 - quiver);
    ctx.lineTo(12, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, 6);
    ctx.lineTo(0, 12);
    ctx.lineTo(8, 6);
    ctx.stroke();
    ctx.restore();
  }
}
