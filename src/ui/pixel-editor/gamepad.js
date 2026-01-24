export const GAMEPAD_HINTS = [
  'Left Stick: move cursor',
  'D-pad: nudge 1px',
  'A: draw',
  'B: erase (hold)',
  'X: eyedropper',
  'Y: select/move',
  'LB/RB: cycle palette',
  'LT/RT: zoom',
  'Start: menu / play',
  'Back: tiled preview / onion skin',
  'Click Right Stick: UI focus'
];

export const updateGamepadCursor = (cursor, axes, dt, speed = 280) => {
  const next = { ...cursor };
  next.x += axes.leftX * speed * dt;
  next.y += axes.leftY * speed * dt;
  return next;
};
