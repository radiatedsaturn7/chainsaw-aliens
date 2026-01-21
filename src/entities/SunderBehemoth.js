import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class SunderBehemoth extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'sunderbehemoth',
      sizeTiles: 15,
      health: 72,
      attackTimer: 1.4,
      deathDuration: 4.4
    });
    this.spinAngle = 0;
    this.originX = x;
    this.originY = y;
    this.volleyTimer = 0.8;
    this.patternTimer = 3.4;
    this.moveTime = 0;
  }

  update(dt, player, context = {}) {
    this.updateVulnerability(dt);
    const aggression = this.aggression;
    const phase = this.phase;
    this.animTime += dt * aggression;
    this.moveTime += dt * (0.35 + aggression * 0.15);
    this.spinAngle += dt * (0.8 + aggression * 0.4);
    const driftX = Math.sin(this.moveTime * 0.6) * this.tileSize * (phase === 2 ? 18 : 14);
    const driftY = Math.cos(this.moveTime * 0.45) * this.tileSize * (phase === 2 ? 12 : 9);
    this.x = this.originX + driftX;
    this.y = this.originY + driftY;
    this.attackTimer -= dt;
    this.volleyTimer -= dt;
    this.patternTimer -= dt;
    if (context.isVisible?.(this, 700) && this.attackTimer <= 0) {
      this.attackTimer = 1.2 / aggression;
      const count = 8 + phase * 2;
      const speed = 220 + phase * 40;
      for (let i = 0; i < count; i += 1) {
        const angle = this.spinAngle + (Math.PI * 2 * i) / count;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        context.spawnProjectile?.(
          this.x + Math.cos(angle) * this.width * 0.18,
          this.y + Math.sin(angle) * this.height * 0.18,
          vx,
          vy,
          1
        );
      }
    }
    if (phase >= 1 && context.canShoot?.(this, 720) && this.volleyTimer <= 0) {
      this.volleyTimer = 1.6 / aggression;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const baseAngle = Math.atan2(dy, dx);
      const speed = 260 + phase * 30;
      for (let i = -1; i <= 1; i += 1) {
        const angle = baseAngle + i * 0.2;
        context.spawnProjectile?.(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1);
      }
    }
    if (phase === 2 && this.patternTimer <= 0) {
      this.patternTimer = 4.2 / aggression;
      this.triggerVulnerability(1.2);
      context.spawnMinion?.(this.x - this.width * 0.2, this.y + this.height * 0.2);
      context.spawnMinion?.(this.x + this.width * 0.2, this.y - this.height * 0.1);
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.2);
  }

  draw(ctx) {
    const size = this.width * 0.34;
    const pulse = Math.sin(this.animTime * 2) * size * 0.06;
    ctx.save();
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.8);
    }
    applyEnemyPalette(ctx, flash, ctx.globalAlpha, { color: '#ff7ad6', amount: this.getTintAmount() });
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.moveTo(0, -size - pulse);
    ctx.lineTo(size * 0.9, 0);
    ctx.lineTo(0, size + pulse);
    ctx.lineTo(-size * 0.9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.45 + pulse * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.rotate(this.spinAngle);
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.7, -size * 0.2);
    ctx.lineTo(-size * 1.1, -size * 0.6);
    ctx.moveTo(size * 0.7, -size * 0.2);
    ctx.lineTo(size * 1.1, -size * 0.6);
    ctx.moveTo(-size * 0.7, size * 0.2);
    ctx.lineTo(-size * 1.1, size * 0.6);
    ctx.moveTo(size * 0.7, size * 0.2);
    ctx.lineTo(size * 1.1, size * 0.6);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, pulse * 0.2);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.05);
      ctx.restore();
    }
  }
}
