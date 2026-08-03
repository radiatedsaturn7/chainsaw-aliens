export const RACE_WHEEL_IDS = Object.freeze(['fl', 'fr', 'rl', 'rr']);

export function deterministicUnitFloat(...parts) {
  const text = parts.map((part) => String(part ?? '')).join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}
export const MPH_TO_MPS = 0.44704;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
