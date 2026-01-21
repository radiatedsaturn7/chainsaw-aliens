import EnemyBase from './EnemyBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class FinalBoss extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'finalboss';
    this.phase = 0;
    this.phaseHealth = 8;
    this.health = this.phaseHealth;
    this.maxHealth = this.health;
    this.coreExposed = false;
    this.attackTimer = 1.2;
    this.completed = false;
    this.simMode = false;
    this.gravity = false;
    this.originX = x;
    this.originY = y;
    this.moveTime = 0;
    this.volleyTimer = 1.4;
    this.surgeTimer = 2.8;
  }

  update(dt, player, spawnProjectile) {
    if (this.completed) return;
    this.animTime = (this.animTime || 0) + dt;
    this.moveTime += dt * (0.25 + this.phase * 0.08);
    if (this.simMode) {
      this.facing = Math.sign(player.x - this.x) || this.facing;
      this.stagger = Math.max(0, this.stagger - dt * 0.2);
      return;
    }
    const aggression = 1 + this.phase * 0.25;
    const driftX = Math.sin(this.moveTime * 0.55) * 32 * (10 + this.phase * 2);
    const driftY = Math.cos(this.moveTime * 0.45) * 32 * (7 + this.phase * 2);
    this.x = this.originX + driftX;
    this.y = this.originY + driftY;
    this.attackTimer -= dt * aggression;
    this.volleyTimer -= dt * aggression;
    this.surgeTimer -= dt * aggression;
    if (this.attackTimer <= 0) {
      this.attackTimer = 1.6 / aggression;
      const dir = Math.sign(player.x - this.x) || 1;
      const spread = this.phase >= 2 ? 80 : 40;
      const count = this.phase >= 2 ? 3 : 1;
      for (let i = 0; i < count; i += 1) {
        const offset = (i - (count - 1) / 2) * spread;
        spawnProjectile(
          this.x,
          this.y - 10,
          dir * 240,
          -80 + Math.random() * 160 + offset,
          1
        );
      }
    }
    if (this.phase >= 1 && this.volleyTimer <= 0) {
      this.volleyTimer = 2.1 / aggression;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 220 + this.phase * 30;
      spawnProjectile(this.x, this.y, (dx / dist) * speed, (dy / dist) * speed, 1);
      spawnProjectile(this.x, this.y, (dx / dist) * speed * 0.7, (dy / dist) * speed * 0.7, 1);
    }
    if (this.phase >= 2 && this.surgeTimer <= 0) {
      this.surgeTimer = 3.4 / aggression;
      const count = 10 + this.phase * 2;
      const speed = 160 + this.phase * 20;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.sin(this.animTime) * 0.2;
        spawnProjectile(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1);
      }
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
        this.maxHealth = this.health;
        this.coreExposed = false;
      }
    }
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.coreExposed ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    const tintAmount = this.maxHealth > 0 ? Math.min(0.85, 1 - this.health / this.maxHealth) : 0;
    applyEnemyPalette(ctx, flash, alpha, { color: '#ff7ad6', amount: tintAmount });
    ctx.lineWidth = 2;
    const pulse = Math.sin(this.animTime * 2) * 4;
    ctx.beginPath();
    ctx.rect(-32, -28, 64, 56);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.arc(0, 0, this.coreExposed ? 14 : 8, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_PALETTE.accent;
    ctx.fill();
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
