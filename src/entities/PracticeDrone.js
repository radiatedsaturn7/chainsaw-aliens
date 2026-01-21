import EnemyBase from './EnemyBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class PracticeDrone extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'practice';
    this.health = 6;
    this.maxHealth = this.health;
    this.lootValue = 3;
    this.pulse = 0;
    this.attackTimer = 1.4;
    this.volleyTimer = 0.6;
    this.originX = x;
    this.originY = y;
    this.gravity = false;
  }

  update(dt, player, context = {}) {
    this.pulse += dt * 2;
    this.attackTimer -= dt;
    this.volleyTimer -= dt;
    const driftX = Math.sin(this.pulse * 0.6) * 60;
    const driftY = Math.cos(this.pulse * 0.8) * 40;
    this.x = this.originX + driftX;
    this.y = this.originY + driftY;
    if (context.canShoot?.(this, 360) && this.attackTimer <= 0) {
      this.attackTimer = 1.6;
      this.volleyTimer = 0.4;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const baseAngle = Math.atan2(dy, dx);
      const speed = 200;
      for (let i = -1; i <= 1; i += 1) {
        const angle = baseAngle + i * 0.25;
        context.spawnProjectile?.(
          this.x,
          this.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          1
        );
      }
    } else if (context.isVisible?.(this, 280) && this.volleyTimer <= 0 && this.attackTimer <= 1.1) {
      this.volleyTimer = 0.35;
      const dir = Math.sign(player.x - this.x) || 1;
      context.spawnProjectile?.(this.x, this.y, dir * 220, -40 + Math.random() * 80, 1);
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.3);
  }

  damage(amount) {
    this.stagger = Math.min(1, this.stagger + 0.4);
    this.health -= amount;
    this.hurtTimer = 0.25;
    this.shakePhase = 0;
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + Math.sin(this.pulse) * 4 + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    applyEnemyPalette(ctx, flash, alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-18, -12, 36, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.arc(-8, -6, 4, 0, Math.PI * 2);
    ctx.arc(8, -6, 4, 0, Math.PI * 2);
    ctx.fill();
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
