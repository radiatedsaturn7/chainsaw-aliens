import EnemyBase from './EnemyBase.js';

export default class Bouncer extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'bouncer';
    this.health = 3;
    this.speed = 150;
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.bounceOnWalls = true;
  }

  update(dt, player) {
    this.animTime = (this.animTime || 0) + dt;
    this.vx = this.facing * this.speed;
    this.x += this.vx * dt;
    if (Math.abs(player.x - this.x) < 200) {
      this.facing = Math.sign(player.x - this.x) || this.facing;
    }
    this.stagger = Math.max(0, this.stagger - dt * 0.6);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    ctx.strokeStyle = `rgba(255, 90, 90,${alpha})`;
    ctx.lineWidth = 2;
    const roll = Math.sin(this.animTime * 6) * 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, roll);
    ctx.lineTo(12, -roll);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
