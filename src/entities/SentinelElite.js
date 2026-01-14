import EnemyBase from './EnemyBase.js';

export default class SentinelElite extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'sentinel';
    this.health = 10;
    this.phase = 0;
  }

  update(dt, player, spawnProjectile) {
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
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();
  }
}
