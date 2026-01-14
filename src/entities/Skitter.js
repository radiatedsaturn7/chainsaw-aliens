import EnemyBase from './EnemyBase.js';

export default class Skitter extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'skitter';
    this.health = 2;
    this.speed = 160;
  }

  update(dt, player) {
    this.animTime = (this.animTime || 0) + dt;
    const dir = Math.sign(player.x - this.x);
    this.facing = dir || this.facing;
    this.vx = dir * this.speed;
    this.x += this.vx * dt;
    this.stagger = Math.max(0, this.stagger - dt * 0.6);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    ctx.strokeStyle = `rgba(255,255,255,${glow})`;
    ctx.lineWidth = 2;
    const step = Math.sin(this.animTime * 10) * 2;
    // Body
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-6, -8);
    ctx.lineTo(6, -8);
    ctx.lineTo(14, 6);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.stroke();
    // Head
    ctx.beginPath();
    ctx.arc(0, -10, 4, 0, Math.PI * 2);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(-14, 16 + step);
    ctx.moveTo(-4, 10);
    ctx.lineTo(-6, 16 - step);
    ctx.moveTo(4, 10);
    ctx.lineTo(6, 16 + step);
    ctx.moveTo(10, 10);
    ctx.lineTo(14, 16 - step);
    ctx.stroke();
    // Stripe marking
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.restore();
  }
}
