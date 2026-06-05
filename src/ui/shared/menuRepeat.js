export function createMenuRepeatState() {
  return {
    direction: null,
    holdTime: 0,
    repeatTime: 0
  };
}

export function resetMenuRepeatState(state) {
  if (!state) return;
  state.direction = null;
  state.holdTime = 0;
  state.repeatTime = 0;
}

export function getMenuRepeatDirection(state, heldDirections = {}, dt = 0, {
  initialDelay = 0.28,
  repeatInterval = 0.12
} = {}) {
  const direction = ['up', 'down', 'left', 'right'].find((key) => heldDirections[key]) || null;
  if (!direction) {
    resetMenuRepeatState(state);
    return null;
  }

  if (state.direction !== direction) {
    state.direction = direction;
    state.holdTime = 0;
    state.repeatTime = 0;
    return direction;
  }

  const previousHoldTime = state.holdTime;
  state.holdTime += Math.max(0, Number(dt) || 0);
  if (previousHoldTime < initialDelay && state.holdTime >= initialDelay) {
    state.repeatTime = 0;
    return direction;
  }

  if (state.holdTime < initialDelay) return null;
  state.repeatTime += Math.max(0, Number(dt) || 0);
  if (state.repeatTime >= repeatInterval) {
    state.repeatTime = 0;
    return direction;
  }

  return null;
}
