import EnemyBase from './EnemyBase.js';

export default class BossBase extends EnemyBase {
  constructor(x, y, options) {
    super(x, y);
    this.type = options.type;
    this.tileSize = 32;
    this.sizeTiles = options.sizeTiles;
    this.width = this.sizeTiles * this.tileSize;
    this.height = this.sizeTiles * this.tileSize;
    this.health = options.health ?? 32;
    this.lootValue = options.lootValue ?? 12;
    this.attackTimer = options.attackTimer ?? 2.4;
    this.gravity = false;
    this.solid = false;
    this.deathDuration = options.deathDuration ?? 4.2;
    this.deathTimer = 0;
    this.deathTime = 0;
    this.animTime = 0;
  }

  damage(amount) {
    if (this.dead) return;
    super.damage(amount);
    if (this.dead && this.deathTimer <= 0) {
      this.deathTimer = this.deathDuration;
      this.deathTime = 0;
      this.deathSpin = Math.random() * Math.PI * 2;
    }
  }

  updateDeath(dt) {
    if (this.deathTimer <= 0) return;
    this.deathTimer = Math.max(0, this.deathTimer - dt);
    this.deathTime += dt;
  }

  get deathProgress() {
    if (this.deathDuration <= 0) return 1;
    return 1 - this.deathTimer / this.deathDuration;
  }

  drawDeadEyes(ctx, size, offsetY = 0) {
    const eyeOffset = size * 0.22;
    const eyeSize = size * 0.08;
    const eyeY = -size * 0.05 + offsetY;
    ctx.beginPath();
    ctx.moveTo(-eyeOffset - eyeSize, eyeY - eyeSize);
    ctx.lineTo(-eyeOffset + eyeSize, eyeY + eyeSize);
    ctx.moveTo(-eyeOffset + eyeSize, eyeY - eyeSize);
    ctx.lineTo(-eyeOffset - eyeSize, eyeY + eyeSize);
    ctx.moveTo(eyeOffset - eyeSize, eyeY - eyeSize);
    ctx.lineTo(eyeOffset + eyeSize, eyeY + eyeSize);
    ctx.moveTo(eyeOffset + eyeSize, eyeY - eyeSize);
    ctx.lineTo(eyeOffset - eyeSize, eyeY + eyeSize);
    ctx.stroke();
  }

  drawDeath(ctx, scale = 1) {
    const t = this.deathProgress;
    const base = (this.width / 2) * scale;
    const ring = base * (0.35 + t * 0.7);
    const glow = Math.max(0, 1 - t);
    const lineWidth = Math.max(2, this.width * 0.002);
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.strokeStyle = `rgba(255, 150, 150, ${0.9 - t * 0.7})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(0, 0, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, ring * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, ring * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    const spikeCount = 12 + Math.floor(this.sizeTiles / 2);
    for (let i = 0; i < spikeCount; i += 1) {
      const angle = this.deathSpin + (Math.PI * 2 * i) / spikeCount;
      const inner = ring * (0.4 + Math.sin(this.deathTime * 3 + i) * 0.08);
      const outer = ring * (1.3 + t * 0.5);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255, 220, 220, ${0.7 - t * 0.6})`;
    ctx.lineWidth = lineWidth * 0.7;
    for (let i = 0; i < 8; i += 1) {
      const crackAngle = this.deathSpin + (Math.PI * 2 * i) / 8 + Math.sin(this.deathTime * 2) * 0.2;
      const crackLength = ring * (0.5 + t * 0.8);
      ctx.beginPath();
      ctx.moveTo(Math.cos(crackAngle) * ring * 0.2, Math.sin(crackAngle) * ring * 0.2);
      ctx.lineTo(Math.cos(crackAngle) * crackLength, Math.sin(crackAngle) * crackLength);
      ctx.stroke();
    }
    ctx.restore();
  }
}
