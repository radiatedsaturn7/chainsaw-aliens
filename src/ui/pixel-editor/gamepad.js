export { SHARED_EDITOR_GAMEPAD_HINTS as GAMEPAD_HINTS } from '../shared/input/editorInputActions.js';

export const updateGamepadCursor = (cursor, axes, dt, speed = 280) => {
  const next = { ...cursor };
  const magnitude = Math.hypot(axes.leftX, axes.leftY);
  const accel = 0.65 + Math.min(1, magnitude) * 1.35;
  next.x += axes.leftX * speed * accel * dt;
  next.y += axes.leftY * speed * accel * dt;
  return next;
};
