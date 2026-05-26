import { loadProjectFile } from '../ui/projectFiles.js';

const DEFAULT_FRAME_DURATION_MS = 120;
const MAX_REPEAT_SEGMENTS = 160;
const MAX_AFTERIMAGES = 24;
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

function clampAngle(angle, minAngle, maxAngle) {
  const value = normalizeAngle(angle);
  const min = normalizeAngle(minAngle);
  const max = normalizeAngle(maxAngle);
  if (min <= max) return Math.max(min, Math.min(max, value));
  return value >= min || value <= max
    ? value
    : (Math.abs(normalizeAngle(value - min)) < Math.abs(normalizeAngle(value - max)) ? min : max);
}

function applyUprightTrajectoryTransform(ctx, angle = 0) {
  if (Math.cos(angle) < 0) {
    ctx.rotate(angle + Math.PI);
    ctx.scale(-1, 1);
    return;
  }
  ctx.rotate(angle);
}

function actorLocalAngleToWorld(localAngle, facing = 1) {
  return normalizeAngle(facing < 0 ? Math.PI - localAngle : localAngle);
}

function worldAngleToActorLocal(worldAngle, facing = 1) {
  return normalizeAngle(facing < 0 ? Math.PI - worldAngle : worldAngle);
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const x = ax + dx * t;
  const y = ay + dy * t;
  return Math.hypot(px - x, py - y);
}

export default class Beam {
  constructor(x, y, angle, options = {}) {
    this.x = x;
    this.y = y;
    this.facing = Number(options.facing || 1) < 0 ? -1 : 1;
    this.minAngle = Number.isFinite(Number(options.minAngle)) ? Number(options.minAngle) : -Math.PI;
    this.maxAngle = Number.isFinite(Number(options.maxAngle)) ? Number(options.maxAngle) : Math.PI;
    const localAngle = clampAngle(worldAngleToActorLocal(Number.isFinite(angle) ? angle : 0, this.facing), this.minAngle, this.maxAngle);
    this.angle = actorLocalAngleToWorld(localAngle, this.facing);
    this.life = Math.max(0.05, Number(options.duration || 1));
    this.maxDistance = Math.max(16, Number(options.maxDistance || 640));
    this.damage = Math.max(0, Number(options.damage || 1));
    this.width = Math.max(2, Number(options.width || 10));
    this.rotationSpeed = Math.max(0, Number(options.rotationSpeed || 0));
    this.trailLife = Math.max(0, Number(options.trailLife || 0));
    this.trailSampleTimer = 0;
    this.afterimages = [];
    this.currentDistance = this.maxDistance;
    this.destinationReached = false;
    this.targetPlayer = options.targetPlayer !== false;
    this.targetOffsetX = Number(options.targetOffsetX || 0);
    this.targetOffsetY = Number(options.targetOffsetY || 0);
    this.hitCooldown = 0;
    this.time = 0;
    this.dead = false;
    this.endX = x + Math.cos(this.angle) * this.currentDistance;
    this.endY = y + Math.sin(this.angle) * this.currentDistance;
    this.startFrames = buildFramesFromArtRef(options.startArtRef);
    this.repeatFrames = buildFramesFromArtRef(options.repeatArtRef);
    this.impactFrames = buildFramesFromArtRef(options.impactArtRef);
    this.frameDuration = Math.max(16, Number(options.frameDurationMs || DEFAULT_FRAME_DURATION_MS));
  }

  update(dt, world, player, abilities = {}) {
    this.life -= dt;
    this.time += dt;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    if (!this.destinationReached && this.targetPlayer && player) {
      const targetX = player.x + this.targetOffsetX;
      const targetY = player.y + this.targetOffsetY;
      const targetWorldAngle = Math.atan2(targetY - this.y, targetX - this.x);
      const targetLocalAngle = clampAngle(worldAngleToActorLocal(targetWorldAngle, this.facing), this.minAngle, this.maxAngle);
      const targetAngle = actorLocalAngleToWorld(targetLocalAngle, this.facing);
      const diff = normalizeAngle(targetAngle - this.angle);
      const maxTurn = this.rotationSpeed * dt;
      this.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }
    if (!this.destinationReached) this.captureAfterimage(dt);
    this.afterimages.forEach((entry) => { entry.age += dt; });
    this.afterimages = this.afterimages.filter((entry) => entry.age < this.trailLife);
    this.updateEndpoint(world, player, abilities);
    this.applyPlayerHit(player);
  }

  captureAfterimage(dt) {
    if (this.trailLife <= 0 || this.currentDistance <= 0) return;
    this.trailSampleTimer -= dt;
    if (this.trailSampleTimer > 0) return;
    this.trailSampleTimer = 0.04;
    this.afterimages.push({
      x1: this.x,
      y1: this.y,
      x2: this.endX,
      y2: this.endY,
      age: 0
    });
    if (this.afterimages.length > MAX_AFTERIMAGES) this.afterimages.shift();
  }

  updateEndpoint(world, player = null, abilities = {}) {
    if (this.destinationReached) {
      this.endX = this.x + Math.cos(this.angle) * this.currentDistance;
      this.endY = this.y + Math.sin(this.angle) * this.currentDistance;
      return;
    }
    const step = Math.max(4, Number(world?.tileSize || 16) / 3);
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    let distance = this.maxDistance;
    for (let d = step; d <= this.maxDistance; d += step) {
      const x = this.x + cos * d;
      const y = this.y + sin * d;
      const tileX = Math.floor(x / Math.max(1, Number(world?.tileSize || 16)));
      const tileY = Math.floor(y / Math.max(1, Number(world?.tileSize || 16)));
      if (world?.isSolid?.(tileX, tileY, abilities)) {
        distance = d;
        break;
      }
    }
    this.currentDistance = distance;
    this.endX = this.x + cos * distance;
    this.endY = this.y + sin * distance;
    if (!player) return;
    const targetX = player.x + this.targetOffsetX;
    const targetY = player.y + this.targetOffsetY;
    const hitRadius = Math.max(10, this.width * 0.5 + 8);
    const distanceToBeam = distancePointToSegment(targetX, targetY, this.x, this.y, this.endX, this.endY);
    const distanceFromOrigin = Math.hypot(targetX - this.x, targetY - this.y);
    if (distanceToBeam <= hitRadius && distanceFromOrigin <= distance + hitRadius) {
      this.destinationReached = true;
      this.currentDistance = distanceFromOrigin;
      this.angle = Math.atan2(targetY - this.y, targetX - this.x);
      this.endX = targetX;
      this.endY = targetY;
    }
  }

  applyPlayerHit(player) {
    if (!player || this.damage <= 0 || this.hitCooldown > 0) return;
    const hitRadius = Math.max(10, this.width * 0.5 + 8);
    const distance = distancePointToSegment(player.x, player.y, this.x, this.y, this.endX, this.endY);
    if (distance > hitRadius) return;
    if (player.takeDamage?.(this.damage)) {
      this.hitCooldown = 0.25;
    }
  }

  getFrame(frames) {
    if (!frames?.length) return null;
    const index = Math.floor((this.time * 1000) / this.frameDuration) % frames.length;
    return frames[index];
  }

  drawFrame(ctx, frame, x, y, angle = 0) {
    if (!frame) return;
    ctx.save();
    ctx.translate(x, y);
    applyUprightTrajectoryTransform(ctx, angle);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, -frame.width / 2, -frame.height / 2);
    ctx.restore();
  }

  draw(ctx) {
    const repeat = this.getFrame(this.repeatFrames);
    const start = this.getFrame(this.startFrames);
    const impact = this.getFrame(this.impactFrames);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const dx = this.endX - this.x;
    const dy = this.endY - this.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    this.afterimages.forEach((entry) => {
      const alpha = Math.max(0, 1 - entry.age / Math.max(0.001, this.trailLife));
      ctx.save();
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = '#ff5f2e';
      ctx.lineWidth = Math.max(1, this.width * 0.35);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(entry.x1, entry.y1);
      ctx.lineTo(entry.x2, entry.y2);
      ctx.stroke();
      ctx.restore();
    });
    const visibleStart = 0;
    const visibleLength = Math.max(0, length - visibleStart);
    const startX = this.x + Math.cos(angle) * visibleStart;
    const startY = this.y + Math.sin(angle) * visibleStart;
    if (visibleLength > 0) {
      ctx.strokeStyle = 'rgba(255, 95, 46, 0.65)';
      ctx.lineWidth = Math.max(2, this.width * 0.45);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(this.endX, this.endY);
      ctx.stroke();
    }
    if (repeat) {
      const spacing = Math.max(1, repeat.width, visibleLength / MAX_REPEAT_SEGMENTS);
      for (let d = visibleStart + spacing / 2; d < length; d += spacing) {
        this.drawFrame(ctx, repeat, this.x + Math.cos(angle) * d, this.y + Math.sin(angle) * d, angle);
      }
    } else if (visibleLength > 0) {
      ctx.strokeStyle = '#ff5f2e';
      ctx.lineWidth = this.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(this.endX, this.endY);
      ctx.stroke();
    }
    this.drawFrame(ctx, start, this.x, this.y, angle);
    this.drawFrame(ctx, impact, this.endX, this.endY, angle);
    ctx.restore();
  }
}
