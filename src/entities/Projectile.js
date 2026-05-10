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
    this.frames = Array.isArray(options?.frames) ? options.frames : null;
    this.frameDuration = Math.max(16, Number(options?.frameDurationMs || 120));
    this.time = 0;
    if ((!this.frames || !this.frames.length) && this.artRef) {
      this.frames = this.buildFramesFromArtRef(this.artRef);
    }
  }

  buildFramesFromArtRef(artRef) {
    if (typeof document === 'undefined') return null;
    const doc = vfsLoad('art', artRef);
    const frames = Array.isArray(doc?.data?.frames) ? doc.data.frames : [];
    if (!frames.length) return null;
    const width = Math.max(1, Number(doc?.data?.width || doc?.data?.size || 16));
    const height = Math.max(1, Number(doc?.data?.height || doc?.data?.size || width));
    const converted = [];
    for (const frame of frames) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      const imageData = ctx.createImageData(width, height);
      for (let i = 0; i < width * height; i += 1) {
        const color = frame?.[i];
        const base = i * 4;
        if (typeof color !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(color)) {
          imageData.data[base + 3] = 0;
          continue;
        }
        const hex = color.startsWith('#') ? color.slice(1) : color;
        imageData.data[base] = parseInt(hex.slice(0, 2), 16);
        imageData.data[base + 1] = parseInt(hex.slice(2, 4), 16);
        imageData.data[base + 2] = parseInt(hex.slice(4, 6), 16);
        imageData.data[base + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
      converted.push(canvas);
    }
    return converted.length ? converted : null;
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
      const frameIndex = Math.floor((this.time * 1000) / this.frameDuration) % this.frames.length;
      const frame = this.frames[frameIndex];
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frame, this.x - frame.width / 2, this.y - frame.height / 2);
      ctx.restore();
      return;
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
