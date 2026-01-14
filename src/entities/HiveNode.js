import EnemyBase from './EnemyBase.js';

export default class HiveNode extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'hivenode';
    this.health = 6;
    this.spawnTimer = 2.5;
  }

  update(dt, player, spawnMinion) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.5;
      spawnMinion(this.x + (Math.random() - 0.5) * 80, this.y - 20);
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.rect(-18, -18, 36, 36);
    ctx.moveTo(-18, -18);
    ctx.lineTo(18, 18);
    ctx.stroke();
    ctx.restore();
  }
}
