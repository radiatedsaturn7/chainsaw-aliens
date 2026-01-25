export const GAMEPAD_HINTS = [
  'Back: UI/CANVAS mode',
  'D-pad: menu focus',
  'Left Stick: grid cursor',
  'Right Stick: pan / scrub timeline',
  'A: draw / use tool',
  'B: undo',
  'X: eraser',
  'Y: redo',
  'LB/RB: switch panels',
  'LT: deselect area',
  'RT: select area',
  'L3: color wheel',
  'R3: tool wheel',
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
