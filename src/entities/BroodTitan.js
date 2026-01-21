import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class BroodTitan extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'broodtitan',
      sizeTiles: 20,
      health: 70,
      attackTimer: 2.8,
      deathDuration: 4.8
    });
    this.spawnTimer = 2.4;
    this.spitTimer = 1.8;
    this.originX = x;
    this.originY = y;
    this.burstTimer = 1.6;
    this.moveTime = 0;
  }

  update(dt, player, context = {}) {
    this.updateVulnerability(dt);
    const aggression = this.aggression;
    const phase = this.phase;
    this.animTime += dt * aggression;
    this.moveTime += dt * (0.25 + aggression * 0.2);
    this.x = this.originX + Math.sin(this.moveTime * 0.4) * this.tileSize * (phase === 2 ? 14 : 10);
    this.y = this.originY + Math.cos(this.moveTime * 0.5) * this.tileSize * (phase === 2 ? 11 : 7);
    this.spawnTimer -= dt * aggression;
    this.spitTimer -= dt * aggression;
    this.burstTimer -= dt * aggression;

    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.2;
      const offset = this.width * 0.2;
      context.spawnMinion?.(this.x - offset, this.y + offset * 0.2);
      context.spawnMinion?.(this.x + offset, this.y - offset * 0.1);
      if (phase >= 1) {
        context.spawnMinion?.(this.x, this.y + offset * 0.3);
      }
      if (phase === 2) {
        this.triggerVulnerability(1.1);
      }
    }

    if (context.canShoot?.(this, 520) && this.spitTimer <= 0) {
      this.spitTimer = 2.1 / aggression;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 210 + phase * 40;
      context.spawnProjectile?.(
        this.x,
        this.y - this.height * 0.1,
        (dx / dist) * speed,
        (dy / dist) * speed,
        1
      );
    }
    if (phase >= 1 && context.isVisible?.(this, 560) && this.burstTimer <= 0) {
      this.burstTimer = 2.4 / aggression;
      const count = 6 + phase * 2;
      const speed = 160 + phase * 30;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.sin(this.animTime) * 0.2;
        context.spawnProjectile?.(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1);
      }
    }

    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.25);
  }

  draw(ctx) {
    const size = this.width * 0.3;
    const pulse = Math.sin(this.animTime * 2.4) * size * 0.05;
    ctx.save();
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.75);
    }
    applyEnemyPalette(ctx, flash, ctx.globalAlpha, { color: '#ff7ad6', amount: this.getTintAmount() });
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.7 + pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-size * 0.55, -size * 0.1, size * 0.25, 0, Math.PI * 2);
    ctx.arc(size * 0.55, -size * 0.1, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.9, size * 0.2);
    ctx.lineTo(-size * 1.2, size * 0.6 + pulse);
    ctx.moveTo(size * 0.9, size * 0.2);
    ctx.lineTo(size * 1.2, size * 0.6 + pulse);
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, -size * 0.05);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.12);
      ctx.restore();
    }
  }
}
