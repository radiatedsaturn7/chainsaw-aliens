import EnemyBase from './EnemyBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class Bobber extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'bobber';
    this.health = 2;
    this.baseY = y;
    this.phase = Math.random() * Math.PI * 2;
    this.solid = false;
    this.gravity = false;
  }

  update(dt, player) {
    this.animTime = (this.animTime || 0) + dt;
    this.phase += dt * 2.2;
    this.y = this.baseY + Math.sin(this.phase) * 26;
    this.facing = Math.sign(player.x - this.x) || this.facing;
    this.stagger = Math.max(0, this.stagger - dt * 0.55);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    applyEnemyPalette(ctx, flash, alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-12, -10, 24, 20);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.moveTo(-6, -10);
    ctx.lineTo(0, -16);
    ctx.lineTo(6, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-4, 4, 2, 0, Math.PI * 2);
    ctx.arc(4, 4, 2, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_PALETTE.accent;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
