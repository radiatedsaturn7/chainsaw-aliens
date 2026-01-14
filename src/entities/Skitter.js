import EnemyBase from './EnemyBase.js';

export default class Skitter extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'skitter';
    this.health = 2;
    this.speed = 160;
  }

  update(dt, player) {
    const dir = Math.sign(player.x - this.x);
    this.facing = dir || this.facing;
    this.vx = dir * this.speed;
    this.x += this.vx * dt;
    this.stagger = Math.max(0, this.stagger - dt * 0.6);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-12, 12);
    ctx.lineTo(0, -12);
    ctx.lineTo(12, 12);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
