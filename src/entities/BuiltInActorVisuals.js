import { mergeBuiltInActorOverride } from '../content/builtinActorOverrides.js';
import { loadProjectFile } from '../ui/projectFiles.js';
import { getSharedFrameImageEntry, resolveAnimationFrames } from './ScriptedActor.js';

const visualCache = new Map();

function getActorName(actorId = '') {
  return String(actorId || '').toLowerCase() === 'companion' ? 'Companion' : 'Player';
}

function getBuiltInActorDefinition(actorId = 'player') {
  const id = String(actorId || 'player').toLowerCase() === 'companion' ? 'companion' : 'player';
  const cached = visualCache.get(id);
  if (cached) return cached;
  const name = getActorName(id);
  const payload = loadProjectFile('actors', name);
  const definition = mergeBuiltInActorOverride(name, payload?.data || null);
  visualCache.set(id, definition);
  return definition;
}

export function invalidateBuiltInActorVisualCache(actorId = null) {
  if (actorId) {
    visualCache.delete(String(actorId).toLowerCase());
    return;
  }
  visualCache.clear();
}

function getEntityStateId(entity, states = []) {
  if (entity?.dead) return 'dead';
  if (Number(entity?.hurtTimer || 0) > 0) return 'hurt';
  if (Number(entity?.attackTimer || 0) > 0 || entity?.revving || entity?.chainsawHeld) return 'attack';
  if (entity?.ducking && states.some((entry) => entry?.id === 'crouch')) return 'crouch';
  return entity?.state || 'idle';
}

function getCurrentFrame(state, timeSeconds = 0) {
  const frames = resolveAnimationFrames(state?.animation || {});
  if (!frames.length) return null;
  const totalDurationMs = frames.reduce((sum, frame) => sum + Math.max(16, Number(frame?.durationMs || 120)), 0);
  let cursor = ((Math.max(0, Number(timeSeconds || 0)) * 1000) % totalDurationMs + totalDurationMs) % totalDurationMs;
  for (const frame of frames) {
    const durationMs = Math.max(16, Number(frame?.durationMs || 120));
    if (cursor <= durationMs) return frame;
    cursor -= durationMs;
  }
  return frames[frames.length - 1];
}

function getDrawSize(definition, image, entity) {
  const size = definition?.size || {};
  const width = Math.max(1, Number(size.width || entity?.width || image?.naturalWidth || image?.width || 1));
  const height = Math.max(1, Number(size.height || entity?.height || image?.naturalHeight || image?.height || 1));
  return { width, height };
}

export function drawBuiltInActorOverride(ctx, entity, actorId = 'player') {
  if (!ctx || !entity || typeof window === 'undefined') return false;
  const definition = getBuiltInActorDefinition(actorId);
  const states = Array.isArray(definition?.states) ? definition.states : [];
  const stateId = getEntityStateId(entity, states);
  const state = states.find((entry) => entry?.id === stateId)
    || states.find((entry) => entry?.id === definition?.initialStateId)
    || states.find((entry) => entry?.animation?.imageDataUrl || entry?.animation?.artRef || entry?.animation?.frames?.length);
  const frame = getCurrentFrame(state, entity.animTime);
  const imageEntry = getSharedFrameImageEntry(frame?.imageDataUrl || '');
  if (!imageEntry?.ready || !imageEntry.image) return false;
  const image = imageEntry.image;
  const { width, height } = getDrawSize(definition, image, entity);
  const hurtShake = Number(entity.hurtTimer || 0) > 0 ? 1 : 0;
  const shakeX = hurtShake ? Math.sin(Number(entity.animTime || 0) * 50) * 2 : 0;
  const shakeY = hurtShake ? Math.cos(Number(entity.animTime || 0) * 60) * 2 : 0;
  ctx.save();
  ctx.translate(Number(entity.x || 0) + shakeX, Number(entity.y || 0) + shakeY);
  ctx.imageSmoothingEnabled = false;
  if (Number(entity.facing || 1) < 0) ctx.scale(-1, 1);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
}
