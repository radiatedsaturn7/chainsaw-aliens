import EnemyBase from './EnemyBase.js';

export default class FinalBoss extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'finalboss';
    this.phase = 0;
    this.phaseHealth = 6;
    this.health = this.phaseHealth;
    this.coreExposed = false;
    this.attackTimer = 1.2;
    this.completed = false;
  }

  update(dt, player, spawnProjectile) {
    if (this.completed) return;
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = 1.6;
      const dir = Math.sign(player.x - this.x) || 1;
      spawnProjectile(this.x, this.y - 10, dir * 240, -80 + Math.random() * 160, 1);
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  triggerExposure() {
    this.coreExposed = true;
  }

  damage(amount) {
    if (!this.coreExposed) return;
    super.damage(amount);
    if (this.health <= 0) {
      this.phase += 1;
      if (this.phase >= 4) {
        this.completed = true;
        this.dead = true;
      } else {
        this.health = this.phaseHealth + this.phase * 2;
        this.coreExposed = false;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-28, -28, 56, 56);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, this.coreExposed ? 12 : 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
