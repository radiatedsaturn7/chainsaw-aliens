import EnemyBase from './EnemyBase.js';

export default class Floater extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'floater';
    this.baseY = y;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt, player) {
    this.phase += dt * 2;
    this.y = this.baseY + Math.sin(this.phase) * 20;
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.5);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.moveTo(-6, -6);
    ctx.lineTo(6, 6);
    ctx.stroke();
    ctx.restore();
  }
}
