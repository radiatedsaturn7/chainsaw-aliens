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
    this.simMode = false;
  }

  update(dt, player, spawnProjectile) {
    if (this.completed) return;
    this.animTime = (this.animTime || 0) + dt;
    if (this.simMode) {
      this.facing = Math.sign(player.x - this.x) || this.facing;
      this.stagger = Math.max(0, this.stagger - dt * 0.2);
      return;
    }
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
    const glow = this.coreExposed ? 1 : 0.8;
    ctx.strokeStyle = `rgba(255,255,255,${glow})`;
    ctx.lineWidth = 2;
    const pulse = Math.sin(this.animTime * 2) * 4;
    ctx.beginPath();
    ctx.rect(-32, -28, 64, 56);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, this.coreExposed ? 14 : 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-28, -24);
    ctx.lineTo(-40, -36 - pulse);
    ctx.moveTo(28, -24);
    ctx.lineTo(40, -36 - pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-20, 20);
    ctx.lineTo(-30, 34 + pulse);
    ctx.moveTo(20, 20);
    ctx.lineTo(30, 34 + pulse);
    ctx.stroke();
    ctx.restore();
  }
}
