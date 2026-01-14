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
    this.animTime = (this.animTime || 0) + dt;
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
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    ctx.strokeStyle = `rgba(255,255,255,${glow})`;
    ctx.lineWidth = 2;
    const sway = Math.sin(this.animTime * 2) * 2;
    ctx.beginPath();
    ctx.rect(-16, -16 + sway, 32, 32);
    ctx.stroke();
    ctx.beginPath();
    if (this.isOpen()) {
      ctx.moveTo(-16, 0);
      ctx.lineTo(16, 0);
      ctx.moveTo(-6, -8);
      ctx.lineTo(6, -8);
    } else {
      ctx.moveTo(-18, -18);
      ctx.lineTo(18, 18);
      ctx.moveTo(18, -18);
      ctx.lineTo(-18, 18);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-8, -2, 16, 10);
    ctx.stroke();
    ctx.restore();
  }
}
