import EnemyBase from './EnemyBase.js';

export default class SentinelElite extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'sentinel';
    this.health = 10;
    this.phase = 0;
  }

  update(dt, player, spawnProjectile) {
    this.animTime = (this.animTime || 0) + dt;
    this.phase += dt;
    const dir = Math.sign(player.x - this.x) || this.facing;
    this.facing = dir;
    this.x += Math.sin(this.phase * 2) * 40 * dt;
    if (Math.sin(this.phase * 1.5) > 0.8) {
      spawnProjectile(this.x, this.y, dir * 260, -60, 1);
    }
    this.stagger = Math.max(0, this.stagger - dt * 0.4);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    ctx.strokeStyle = `rgba(255,255,255,${glow})`;
    ctx.lineWidth = 2;
    const wobble = Math.sin(this.animTime * 3) * 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + wobble, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(22, 0);
    ctx.moveTo(0, -22);
    ctx.lineTo(0, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.lineTo(-18, -26);
    ctx.moveTo(10, -16);
    ctx.lineTo(18, -26);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-6, -2, 2, 0, Math.PI * 2);
    ctx.arc(6, -2, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
