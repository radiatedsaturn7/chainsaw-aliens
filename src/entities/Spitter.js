import EnemyBase from './EnemyBase.js';

export default class Spitter extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'spitter';
    this.health = 3;
    this.cooldown = 1.4;
  }

  update(dt, player, spawnProjectile) {
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
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.rect(-10, -10, 20, 20);
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.restore();
  }
}
