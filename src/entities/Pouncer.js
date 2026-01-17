import EnemyBase from './EnemyBase.js';
import { applyEnemyPalette, ENEMY_PALETTE } from './enemyPalette.js';

export default class Pouncer extends EnemyBase {
  constructor(x, y) {
    super(x, y);
    this.type = 'pouncer';
    this.health = 3;
    this.walkSpeed = 90;
    this.jumpSpeed = 260;
    this.pauseDuration = 0.35;
    this.jumpCooldown = 0;
    this.pauseTimer = 0;
    this.state = 'approach';
  }

  update(dt, player) {
    this.animTime = (this.animTime || 0) + dt;
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    const dir = Math.sign(player.x - this.x) || this.facing;
    this.facing = dir;
    const dist = Math.abs(player.x - this.x);

    if (this.state === 'approach') {
      this.vx = dir * this.walkSpeed;
      this.x += this.vx * dt;
      if (dist < 140 && this.jumpCooldown <= 0) {
        this.state = 'pause';
        this.pauseTimer = this.pauseDuration;
        this.vx = 0;
      }
    } else if (this.state === 'pause') {
      this.vx = 0;
      this.pauseTimer = Math.max(0, this.pauseTimer - dt);
      if (this.pauseTimer <= 0) {
        this.state = 'jump';
        this.vx = dir * this.walkSpeed * 1.1;
        this.vy = -this.jumpSpeed;
        this.jumpCooldown = 1.1;
      }
    } else if (this.state === 'jump') {
      this.vx = dir * this.walkSpeed * 0.9;
      this.x += this.vx * dt;
      if (this.vy === 0) {
        this.state = 'approach';
      }
    }

    this.stagger = Math.max(0, this.stagger - dt * 0.6);
  }

  draw(ctx) {
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    const glow = this.stagger > 0.6 ? 1 : 0.8;
    const alpha = flash ? 1 : glow;
    applyEnemyPalette(ctx, flash, alpha);
    ctx.lineWidth = 2;
    const crouch = this.state === 'pause' ? 3 : 0;
    ctx.beginPath();
    ctx.rect(-12, -12 + crouch, 24, 22 - crouch);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = ENEMY_PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(-10, 8);
    ctx.lineTo(-14, 14);
    ctx.moveTo(10, 8);
    ctx.lineTo(14, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-4, -2 + crouch, 2, 0, Math.PI * 2);
    ctx.arc(4, -2 + crouch, 2, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_PALETTE.accent;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
