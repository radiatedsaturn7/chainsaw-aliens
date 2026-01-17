export const MOVEMENT_MODEL = {
  gravity: 1500,
  baseSpeed: 240,
  baseJumpPower: 520,
  dashSpeed: 620,
  dashDuration: 0.12,
  coyoteTime: 0.1,
  jumpBuffer: 0.12
};

export function getJumpHeight(jumpPower = MOVEMENT_MODEL.baseJumpPower) {
  return (jumpPower ** 2) / (2 * MOVEMENT_MODEL.gravity);
}

export function getDashDistance() {
  return MOVEMENT_MODEL.dashSpeed * MOVEMENT_MODEL.dashDuration;
}
