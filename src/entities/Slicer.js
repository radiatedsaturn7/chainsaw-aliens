import EnemyBase from './EnemyBase.js';

export default class Slicer extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'slicer';
    this.health = 3;
    this.parryWindow = 0;
  }

  update(dt, player) {
    this.animTime = (this.animTime || 0) + dt;
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
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    ctx.strokeStyle = `rgba(255,255,255,${glow})`;
    ctx.lineWidth = 2;
    const spin = Math.sin(this.animTime * 6) * 2;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(0, -14 - spin);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 14 + spin);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-10, -6);
    ctx.moveTo(18, 0);
    ctx.lineTo(10, -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -2, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
