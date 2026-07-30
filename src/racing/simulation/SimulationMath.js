export const RACE_WHEEL_IDS = Object.freeze(['fl', 'fr', 'rl', 'rr']);
export const MPH_TO_MPS = 0.44704;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
