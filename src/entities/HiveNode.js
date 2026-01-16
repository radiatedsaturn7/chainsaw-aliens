import EnemyBase from './EnemyBase.js';

export default class HiveNode extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'hivenode';
    this.health = 6;
    this.spawnTimer = 2.5;
  }

  update(dt, player, spawnMinion) {
    this.animTime = (this.animTime || 0) + dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.5;
      spawnMinion(this.x + (Math.random() - 0.5) * 80, this.y - 20);
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 2;
    const pulse = Math.sin(this.animTime * 4) * 3;
    ctx.beginPath();
    ctx.rect(-20, -18, 40, 36);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 8 + pulse * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, -14);
    ctx.lineTo(18, -6);
    ctx.moveTo(-18, 14);
    ctx.lineTo(18, 6);
    ctx.stroke();
    ctx.restore();
  }
}
