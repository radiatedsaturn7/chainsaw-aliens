import { loadProjectFile } from '../ui/projectFiles.js';

const ART_FRAME_CACHE = new Map();
const MAX_ART_FRAME_CACHE_ENTRIES = 96;

function rememberArtFrames(cacheKey, frames) {
  ART_FRAME_CACHE.set(cacheKey, frames);
  while (ART_FRAME_CACHE.size > MAX_ART_FRAME_CACHE_ENTRIES) {
    ART_FRAME_CACHE.delete(ART_FRAME_CACHE.keys().next().value);
  }
  return frames;
}

function normalizeFramePixels(frame) {
  if (Array.isArray(frame) && frame.some((value) => typeof value === 'string')) return frame;
  if (Array.isArray(frame) && Array.isArray(frame[0]) && frame[0].some((value) => typeof value === 'string')) return frame[0];
  if (frame && typeof frame === 'object') {
    if (Array.isArray(frame.pixels) && frame.pixels.some((value) => typeof value === 'string')) return frame.pixels;
    if (Array.isArray(frame.data) && frame.data.some((value) => typeof value === 'string')) return frame.data;
  }
  return null;
}

function buildFramesFromArtRef(artRef) {
  if (typeof document === 'undefined') return null;
  const ref = String(artRef || '').trim();
  if (!ref) return null;
  const doc = loadProjectFile('art', ref);
  const frames = Array.isArray(doc?.data?.frames) ? doc.data.frames : [];
  if (!frames.length) return null;
  const width = Math.max(1, Number(doc?.data?.width || doc?.data?.size || 16));
  const height = Math.max(1, Number(doc?.data?.height || doc?.data?.size || width));
  const cacheKey = `${ref}:${Number(doc?.savedAt || doc?.data?.updatedAt || 0)}:${width}x${height}:${frames.length}`;
  if (ART_FRAME_CACHE.has(cacheKey)) return ART_FRAME_CACHE.get(cacheKey);
  const converted = [];
  for (const frame of frames) {
    const pixels = normalizeFramePixels(frame);
    if (!pixels?.length) continue;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i += 1) {
      const color = pixels[i];
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
  return rememberArtFrames(cacheKey, converted.length ? converted : null);
}

function normalizeAngle(angle) {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

export default class HomingMissile {
  constructor(x, y, angle, options = {}) {
    const initialSpeed = Math.max(0, Number(options.initialSpeed || 80));
    this.x = x;
    this.y = y;
    this.angle = Number.isFinite(angle) ? angle : 0;
    this.vx = Math.cos(this.angle) * initialSpeed;
    this.vy = Math.sin(this.angle) * initialSpeed;
    this.acceleration = Math.max(0, Number(options.acceleration || 260));
    this.maxSpeed = Math.max(1, Number(options.maxSpeed || 260));
    this.turnSpeed = Math.max(0, Number(options.turnSpeed || Math.PI));
    this.life = Math.max(0.1, Number(options.duration || 4));
    this.damage = Math.max(0, Number(options.damage || 1));
    this.targetPlayer = options.targetPlayer !== false;
    this.targetOffsetX = Number(options.targetOffsetX || 0);
    this.targetOffsetY = Number(options.targetOffsetY || 0);
    this.radius = Math.max(4, Number(options.radius || 10));
    this.dead = false;
    this.exploding = false;
    this.explosionTimer = 0;
    this.explosionDuration = Math.max(0.05, Number(options.explosionDuration || 0.35));
    this.time = 0;
    this.trailTimer = 0;
    this.trail = [];
    this.missileFrames = buildFramesFromArtRef(options.missileArtRef);
    this.explosionFrames = buildFramesFromArtRef(options.explosionArtRef);
    this.smokeFrames = buildFramesFromArtRef(options.smokeArtRef);
    this.frameDuration = Math.max(16, Number(options.frameDurationMs || 120));
  }

  explode(player = null) {
    if (this.exploding) return;
    this.exploding = true;
    this.explosionTimer = this.explosionDuration;
    this.vx = 0;
    this.vy = 0;
    if (player && this.damage > 0 && Math.hypot(player.x - this.x, player.y - this.y) <= this.radius + 16) {
      player.takeDamage?.(this.damage);
    }
  }

  update(dt, world, player, abilities = {}) {
    this.time += dt;
    if (this.exploding) {
      this.explosionTimer -= dt;
      if (this.explosionTimer <= 0) this.dead = true;
      return;
    }
    this.life -= dt;
    if (this.life <= 0) {
      this.explode();
      return;
    }
    if (this.targetPlayer && player) {
      const targetAngle = Math.atan2((player.y + this.targetOffsetY) - this.y, (player.x + this.targetOffsetX) - this.x);
      const diff = normalizeAngle(targetAngle - this.angle);
      const maxTurn = this.turnSpeed * dt;
      this.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }
    this.vx += Math.cos(this.angle) * this.acceleration * dt;
    this.vy += Math.sin(this.angle) * this.acceleration * dt;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed;
      this.vy = (this.vy / speed) * this.maxSpeed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.hypot(this.vx, this.vy) > 1) this.angle = Math.atan2(this.vy, this.vx);
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.045;
      this.trail.push({ x: this.x - Math.cos(this.angle) * this.radius, y: this.y - Math.sin(this.angle) * this.radius, age: 0 });
      if (this.trail.length > 18) this.trail.shift();
    }
    this.trail.forEach((entry) => { entry.age += dt; });
    this.trail = this.trail.filter((entry) => entry.age < 0.7);
    const tileSize = Math.max(1, Number(world?.tileSize || 16));
    const tileX = Math.floor(this.x / tileSize);
    const tileY = Math.floor(this.y / tileSize);
    if (world?.isSolid?.(tileX, tileY, abilities)) {
      this.explode();
      return;
    }
    if (player && Math.hypot(player.x - this.x, player.y - this.y) <= this.radius + 12) {
      this.explode(player);
    }
  }

  getFrame(frames) {
    if (!frames?.length) return null;
    const index = Math.floor((this.time * 1000) / this.frameDuration) % frames.length;
    return frames[index];
  }

  drawFrame(ctx, frame, x, y, angle = 0, alpha = 1) {
    if (!frame) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, -frame.width / 2, -frame.height / 2);
    ctx.restore();
  }

  draw(ctx) {
    if (this.exploding) {
      const frame = this.getFrame(this.explosionFrames);
      if (frame) this.drawFrame(ctx, frame, this.x, this.y);
      else {
        ctx.save();
        ctx.fillStyle = '#ff9f2e';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    const smoke = this.getFrame(this.smokeFrames);
    this.trail.forEach((entry) => {
      const alpha = Math.max(0, 1 - entry.age / 0.7);
      this.drawFrame(ctx, smoke, entry.x, entry.y, 0, alpha);
    });
    const missile = this.getFrame(this.missileFrames);
    if (missile) {
      this.drawFrame(ctx, missile, this.x, this.y, this.angle);
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#dfe7ff';
    ctx.beginPath();
    ctx.moveTo(this.radius, 0);
    ctx.lineTo(-this.radius, -this.radius * 0.55);
    ctx.lineTo(-this.radius * 0.65, 0);
    ctx.lineTo(-this.radius, this.radius * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
