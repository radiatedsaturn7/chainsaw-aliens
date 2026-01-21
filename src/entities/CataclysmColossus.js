import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class CataclysmColossus extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'cataclysmcolossus',
      sizeTiles: 64,
      health: 140,
      attackTimer: 2.8,
      deathDuration: 6.2
    });
    this.stormTimer = 1.4;
    this.originX = x;
    this.originY = y;
    this.moveTime = 0;
    this.pulseTimer = 2.8;
  }

  update(dt, player, context = {}) {
    this.updateVulnerability(dt);
    const aggression = this.aggression;
    const phase = this.phase;
    this.animTime += dt * aggression;
    this.moveTime += dt * (0.14 + aggression * 0.12);
    this.x = this.originX + Math.sin(this.moveTime * 0.24) * this.tileSize * (phase === 2 ? 26 : 20);
    this.y = this.originY + Math.cos(this.moveTime * 0.2) * this.tileSize * (phase === 2 ? 20 : 15);
    this.attackTimer -= dt * aggression;
    this.stormTimer -= dt * aggression;
    this.pulseTimer -= dt * aggression;

    if (context.isVisible?.(this, 900) && this.stormTimer <= 0) {
      this.stormTimer = 1.6 / aggression;
      const count = 12 + phase * 3;
      const spread = this.width * (0.4 + phase * 0.05);
      for (let i = 0; i < count; i += 1) {
        const offset = -spread + (spread * 2 * i) / (count - 1);
        const vx = offset * 0.1 + (Math.random() - 0.5) * 40;
        const vy = 280 + Math.random() * 60 + phase * 20;
        context.spawnProjectile?.(this.x + offset, this.y - this.height * 0.3, vx, vy, 1);
      }
    }

    if (context.canShoot?.(this, 900) && this.attackTimer <= 0) {
      this.attackTimer = 3.1 / aggression;
      const rings = 10 + phase * 2;
      const speed = 180 + phase * 20;
      for (let i = 0; i < rings; i += 1) {
        const angle = (Math.PI * 2 * i) / rings + Math.sin(this.animTime) * 0.3;
        context.spawnProjectile?.(
          this.x,
          this.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          1
        );
      }
    }
    if (phase >= 1 && context.isVisible?.(this, 960) && this.pulseTimer <= 0) {
      this.pulseTimer = 4.2 / aggression;
      this.triggerVulnerability(1.2);
      const waveCount = 6 + phase * 2;
      const speed = 200 + phase * 30;
      for (let i = 0; i < waveCount; i += 1) {
        const angle = (Math.PI * 2 * i) / waveCount;
        context.spawnProjectile?.(
          this.x,
          this.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          1
        );
      }
    }

    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.1);
  }

  draw(ctx) {
    const size = this.width * 0.25;
    const pulse = Math.sin(this.animTime * 1.1) * size * 0.06;
    ctx.save();
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.65);
    }
    applyEnemyPalette(ctx, flash, ctx.globalAlpha, { color: '#ff7ad6', amount: this.getTintAmount() });
    ctx.lineWidth = Math.max(4, this.width * 0.004);
    ctx.beginPath();
    ctx.arc(0, 0, size + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7 + pulse * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 1.1, -size * 0.2 - pulse);
    ctx.lineTo(-size * 0.6, -size * 0.8 - pulse);
    ctx.lineTo(0, -size * 0.5 - pulse);
    ctx.lineTo(size * 0.6, -size * 0.8 - pulse);
    ctx.lineTo(size * 1.1, -size * 0.2 - pulse);
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, -size * 0.1);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.4);
      ctx.restore();
    }
  }
}
