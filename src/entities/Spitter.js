import EnemyBase from './EnemyBase.js';

export default class Spitter extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'spitter';
    this.health = 3;
    this.cooldown = 1.4;
  }

  update(dt, player, spawnProjectile) {
    this.animTime = (this.animTime || 0) + dt;
    const dist = player.x - this.x;
    this.facing = Math.sign(dist) || this.facing;
    this.cooldown -= dt;
    if (Math.abs(dist) < 320 && this.cooldown <= 0) {
      this.cooldown = 1.6;
      spawnProjectile(this.x, this.y, this.facing * 220, 0, 1);
    }
    this.stagger = Math.max(0, this.stagger - dt * 0.4);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 2;
    const pulse = Math.sin(this.animTime * 6) * 2;
    ctx.beginPath();
    ctx.rect(-14, -12 - pulse, 28, 24 + pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -4, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(12, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-6, -6, 2, 0, Math.PI * 2);
    ctx.arc(6, -6, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16, -10);
    ctx.lineTo(-20, -16);
    ctx.moveTo(16, -10);
    ctx.lineTo(20, -16);
    ctx.stroke();
    ctx.restore();
  }
}
