import EnemyBase from './EnemyBase.js';

export default class PracticeDrone extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'practice';
    this.health = 999;
    this.lootValue = 0;
    this.pulse = 0;
    this.training = true;
  }

  update(dt, player) {
    this.pulse += dt * 2;
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.25);
  }

  damage(amount) {
    this.stagger = Math.min(1, this.stagger + 0.4);
    this.health = Math.max(1, this.health - amount);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.pulse) * 4);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    ctx.strokeStyle = `rgba(255,255,255,${glow})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-18, -12, 36, 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-8, -6, 4, 0, Math.PI * 2);
    ctx.arc(8, -6, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, 10);
    ctx.lineTo(0, 16);
    ctx.lineTo(12, 10);
    ctx.stroke();
    ctx.restore();
  }
}
