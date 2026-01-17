import EnemyBase from './EnemyBase.js';

export default class Floater extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'floater';
    this.baseY = y;
    this.phase = Math.random() * Math.PI * 2;
    this.solid = false;
    this.gravity = false;
  }

  update(dt, player) {
    this.phase += dt * 2;
    this.y = this.baseY + Math.sin(this.phase) * 20;
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.5);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    ctx.strokeStyle = `rgba(255, 90, 90,${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(0, -10);
    ctx.lineTo(10, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-4, 2, 2, 0, Math.PI * 2);
    ctx.arc(4, 2, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, 22);
    ctx.stroke();
    ctx.restore();
  }
}
