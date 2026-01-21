import BossBase from './BossBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class NullAegis extends BossBase {
  constructor(x, y) {
    super(x, y, {
      type: 'nullaegis',
      sizeTiles: 22,
      health: 64,
      attackTimer: 2.0,
      deathDuration: 4.6
    });
    this.patternFlip = false;
    this.originX = x;
    this.originY = y;
    this.pulseTimer = 1.6;
    this.moveTime = 0;
  }

  update(dt, player, context = {}) {
    this.updateVulnerability(dt);
    const aggression = this.aggression;
    const phase = this.phase;
    this.animTime += dt * aggression;
    this.moveTime += dt * (0.3 + aggression * 0.2);
    this.attackTimer -= dt * aggression;
    this.pulseTimer -= dt * aggression;
    this.x = this.originX + Math.cos(this.moveTime * 0.35) * this.tileSize * (phase === 2 ? 16 : 12);
    this.y = this.originY + Math.sin(this.moveTime * 0.45) * this.tileSize * (phase === 2 ? 12 : 8);
    if (context.isVisible?.(this, 640) && this.attackTimer <= 0) {
      this.attackTimer = 2.2 / aggression;
      this.patternFlip = !this.patternFlip;
      const count = 4 + phase;
      const baseAngle = this.patternFlip ? Math.PI / 4 : 0;
      for (let i = 0; i < count; i += 1) {
        const angle = baseAngle + (Math.PI / 2) * i;
        context.spawnProjectile?.(
          this.x,
          this.y,
          Math.cos(angle) * 240,
          Math.sin(angle) * 240,
          1
        );
      }
    }
    if (phase >= 1 && context.canShoot?.(this, 660) && this.pulseTimer <= 0) {
      this.pulseTimer = 2.6 / aggression;
      const ringCount = 10 + phase * 2;
      const speed = 180 + phase * 20;
      for (let i = 0; i < ringCount; i += 1) {
        const angle = (Math.PI * 2 * i) / ringCount + Math.sin(this.animTime) * 0.3;
        context.spawnProjectile?.(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1);
      }
      if (phase === 2) {
        this.triggerVulnerability(1.1);
      }
    }
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.18);
  }

  draw(ctx) {
    const size = this.width * 0.31;
    const pulse = Math.sin(this.animTime * 1.6) * size * 0.04;
    ctx.save();
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    if (this.dead && this.deathTimer > 0) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathProgress * 0.78);
    }
    applyEnemyPalette(ctx, flash, ctx.globalAlpha, { color: '#ff7ad6', amount: this.getTintAmount() });
    ctx.lineWidth = Math.max(3, this.width * 0.004);
    ctx.beginPath();
    ctx.moveTo(-size * 1.1, -size * 0.2 - pulse);
    ctx.lineTo(0, -size - pulse);
    ctx.lineTo(size * 1.1, -size * 0.2 - pulse);
    ctx.lineTo(size * 0.9, size * 0.7 + pulse);
    ctx.lineTo(-size * 0.9, size * 0.7 + pulse);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.6, 0);
    ctx.lineTo(size * 0.6, 0);
    ctx.moveTo(0, -size * 0.6);
    ctx.lineTo(0, size * 0.6);
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    this.drawDeadEyes(ctx, size, -size * 0.05);
    ctx.restore();
    if (this.dead && this.deathTimer > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.drawDeath(ctx, 1.08);
      ctx.restore();
    }
  }
}
