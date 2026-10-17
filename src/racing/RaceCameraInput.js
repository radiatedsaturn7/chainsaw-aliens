import { clamp, normalizeAngle } from './simulation/SimulationMath.js';

export function getRaceStickLook(x = 0, y = 0) {
  x = clamp(Number(x) || 0, -1, 1);
  y = clamp(Number(y) || 0, -1, 1);
  const active = Math.hypot(x, y) > 0.12;
  // Gamepad Y is negative upward. The renderer right vector is (-cos, sin),
  // so looking right requires negative yaw and puts the camera to the left.
  return { active, angle: active ? Math.atan2(-x, -y) : 0 };
}

export function stepRaceLookAngle(current, target, seconds, active) {
  const rate = active ? 7.5 : 4.2;
  const alpha = 1 - Math.exp(-rate * Math.max(0, Number(seconds) || 0));
  return normalizeAngle(current + normalizeAngle(target - current) * alpha);
}
