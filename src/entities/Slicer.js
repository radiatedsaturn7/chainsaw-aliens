import EnemyBase from './EnemyBase.js';

export default class Slicer extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'slicer';
    this.health = 3;
    this.parryWindow = 0;
  }

  update(dt, player) {
    const dist = player.x - this.x;
    this.facing = Math.sign(dist) || this.facing;
    if (Math.abs(dist) < 140) {
      this.parryWindow = 0.4;
    }
    this.parryWindow = Math.max(0, this.parryWindow - dt);
    this.stagger = Math.max(0, this.stagger - dt * 0.6);
  }

  canParry() {
    return this.parryWindow > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(0, -14);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
