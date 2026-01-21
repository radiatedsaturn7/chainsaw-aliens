import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class ObsidianCrown extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'obsidiancrown',
      sizeTiles: 32,
      health: 88,
      attackTimer: 3.2,
      deathDuration: 5.2
    });
    this.barrageTimer = 1.2;
    this.originX = x;
    this.originY = y;
    this.moveTime = 0;
    this.spearTimer = 2.6;
  }

  update(dt, player, context = {}) {
    this.updateVulnerability(dt);
    const aggression = this.aggression;
    const phase = this.phase;
    this.animTime += dt * aggression;
    this.moveTime += dt * (0.18 + aggression * 0.15);
    this.attackTimer -= dt * aggression;
    this.barrageTimer -= dt * aggression;
    this.spearTimer -= dt * aggression;
    this.x = this.originX + Math.sin(this.moveTime * 0.32) * this.tileSize * (phase === 2 ? 20 : 16);
    this.y = this.originY + Math.cos(this.moveTime * 0.42) * this.tileSize * (phase === 2 ? 14 : 10);

    if (context.isVisible?.(this, 720) && this.barrageTimer <= 0) {
      this.barrageTimer = 1.8 / aggression;
      const columns = 6 + phase * 2;
      const spread = this.width * 0.35 + phase * 20;
      for (let i = 0; i < columns; i += 1) {
        const offset = -spread + (spread * 2 * i) / (columns - 1);
        context.spawnProjectile?.(
          this.x + offset,
          this.y - this.height * 0.2,
          offset * 0.18,
          260 + phase * 30,
          1
        );
      }
    }

    if (context.canShoot?.(this, 720) && this.attackTimer <= 0) {
      this.attackTimer = 3.2 / aggression;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 200 + phase * 30;
      context.spawnProjectile?.(
        this.x,
        this.y,
        (dx / dist) * speed,
        (dy / dist) * speed,
        1
      );
    }
    if (phase >= 1 && context.isVisible?.(this, 760) && this.spearTimer <= 0) {
      this.spearTimer = 3.6 / aggression;
      this.triggerVulnerability(1);
      const count = 4 + phase;
      const speed = 230 + phase * 30;
      for (let i = 0; i < count; i += 1) {
        const angle = (-Math.PI / 2) + (Math.PI * 2 * i) / count;
        context.spawnProjectile?.(
          this.x + Math.cos(angle) * this.width * 0.3,
          this.y + Math.sin(angle) * this.height * 0.1,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          1
        );
      }
    }

    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.15);
  }

  draw(ctx) {
    const size = this.width * 0.28;
    const pulse = Math.sin(this.animTime * 1.4) * size * 0.05;
    ctx.save();
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.7);
    }
    applyEnemyPalette(ctx, flash, ctx.globalAlpha, { color: '#ff7ad6', amount: this.getTintAmount() });
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.moveTo(-size, size * 0.6 + pulse);
    ctx.lineTo(-size * 0.8, -size * 0.4 - pulse);
    ctx.lineTo(-size * 0.4, -size - pulse);
    ctx.lineTo(0, -size * 0.6 - pulse);
    ctx.lineTo(size * 0.4, -size - pulse);
    ctx.lineTo(size * 0.8, -size * 0.4 - pulse);
    ctx.lineTo(size, size * 0.6 + pulse);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.arc(0, size * 0.1, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, -size * 0.05);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.25);
      ctx.restore();
    }
  }
}
