export const GAMEPAD_HINTS = [
  'Back: UI/CANVAS mode',
  'D-pad: fine cursor move',
  'Left Stick: fast cursor move',
  'Right Stick: pan / scrub timeline',
  'A: draw / use tool',
  'B: draw mode / undo',
  'X: eraser',
  'Y: redo',
  'LB/RB: switch panels',
  'LT: deselect area',
  'RT: select area',
  'L3: color pages',
  'R3: tool pages',
  'Start: tools tab'
];

export const updateGamepadCursor = (cursor, axes, dt, speed = 280) => {
  const next = { ...cursor };
  const magnitude = Math.hypot(axes.leftX, axes.leftY);
  const accel = 0.65 + Math.min(1, magnitude) * 1.35;
  next.x += axes.leftX * speed * accel * dt;
  next.y += axes.leftY * speed * accel * dt;
  return next;
};
