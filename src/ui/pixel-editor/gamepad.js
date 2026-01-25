export const GAMEPAD_HINTS = [
  'Back: UI/CANVAS mode',
  'D-pad: UI focus / 1px nudge',
  'Left Stick: cursor',
  'Right Stick: pan / scrub timeline',
  'A: confirm / draw',
  'B: back / cancel',
  'X: eyedropper (hold)',
  'Y: draw ↔ select',
  'LB: temp erase',
  'RB + D-pad ←/→: undo/redo',
  'LT/RT: zoom',
  'Start: menu / play'
];

export const updateGamepadCursor = (cursor, axes, dt, speed = 280) => {
  const next = { ...cursor };
  const magnitude = Math.hypot(axes.leftX, axes.leftY);
  const accel = 0.65 + Math.min(1, magnitude) * 1.35;
  next.x += axes.leftX * speed * accel * dt;
  next.y += axes.leftY * speed * accel * dt;
  return next;
};
