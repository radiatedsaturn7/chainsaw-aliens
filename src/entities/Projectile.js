import { vfsLoad } from '../ui/vfs.js';

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
    this.frames = null;
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
    if (this.artRef) {
      if (!this.frames) {
        const doc = vfsLoad('art', this.artRef);
        const srcFrames = Array.isArray(doc?.data?.frames) ? doc.data.frames : [];
        const w = Math.max(1, Number(doc?.data?.width || doc?.data?.size || 8));
        const h = Math.max(1, Number(doc?.data?.height || doc?.data?.size || w));
        this.frames = srcFrames.map((frame) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const c = canvas.getContext('2d');
          if (!c) return null;
          const imageData = c.createImageData(w, h);
          for (let i = 0; i < w * h; i += 1) {
            const color = frame?.[i];
            const base = i * 4;
            if (!color || typeof color !== 'string') continue;
            const hex = color.startsWith('#') ? color.slice(1) : color;
            if (hex.length !== 6) continue;
            imageData.data[base] = parseInt(hex.slice(0, 2), 16);
            imageData.data[base + 1] = parseInt(hex.slice(2, 4), 16);
            imageData.data[base + 2] = parseInt(hex.slice(4, 6), 16);
            imageData.data[base + 3] = 255;
          }
          c.putImageData(imageData, 0, 0);
          return canvas;
        }).filter(Boolean);
      }
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
