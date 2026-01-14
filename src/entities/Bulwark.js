import EnemyBase from './EnemyBase.js';

export default class Bulwark extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'bulwark';
    this.health = 5;
    this.armored = true;
    this.openTimer = 0;
  }

  update(dt, player) {
    const dist = player.x - this.x;
    this.facing = Math.sign(dist) || this.facing;
    if (Math.abs(dist) < 120) {
      this.openTimer = 0.6;
    }
    this.openTimer = Math.max(0, this.openTimer - dt);
    this.stagger = Math.max(0, this.stagger - dt * 0.3);
  }

  isOpen() {
    return this.openTimer > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-14, -14, 28, 28);
    ctx.stroke();
    ctx.beginPath();
    if (this.isOpen()) {
      ctx.moveTo(-14, 0);
      ctx.lineTo(14, 0);
    } else {
      ctx.moveTo(-16, -16);
      ctx.lineTo(16, 16);
      ctx.moveTo(16, -16);
      ctx.lineTo(-16, 16);
    }
    ctx.stroke();
    ctx.restore();
  }
}
