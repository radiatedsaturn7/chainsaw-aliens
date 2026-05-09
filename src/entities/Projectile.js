export default class Projectile {
  constructor(x, y, vx, vy, damage = 1, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.life = 3;
    this.radius = 4;
    this.dead = false;
    this.artRef = String(options?.artRef || '');
    this.frames = Array.isArray(options?.frames) ? options.frames : null;
    this.frameDuration = Math.max(16, Number(options?.frameDurationMs || 120));
    this.time = 0;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.time += dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.frames?.length) {
      if (this.frames?.length) {
        const frameIndex = Math.floor((this.time * 1000) / this.frameDuration) % this.frames.length;
        const frame = this.frames[frameIndex];
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(frame, this.x - frame.width / 2, this.y - frame.height / 2);
        ctx.restore();
        return;
      }
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
