export default class StateManager {
  constructor(initialState = null) {
    this.states = new Map();
    this.currentKey = initialState;
    this.currentState = null;
  }

  register(key, state) {
    this.states.set(key, state);
    if (this.currentKey === key) {
      this.currentState = state;
    }
  }

  transition(nextState) {
    if (!nextState || this.currentKey === nextState) return;
    const previousKey = this.currentKey;
    const previousState = this.currentState;
    const next = this.states.get(nextState) || null;

    if (previousState?.exit) {
      previousState.exit({ from: previousKey, to: nextState });
    }

    this.currentKey = nextState;
    this.currentState = next;

    if (this.currentState?.enter) {
      this.currentState.enter({ from: previousKey, to: nextState });
    }
  }

  update(dt) {
    this.currentState?.update?.(dt);
  }

  draw() {
    this.currentState?.draw?.();
  }

  handleClick(x, y) {
    this.currentState?.handleClick?.(x, y);
  }

  handlePointerDown(payload) {
    this.currentState?.handlePointerDown?.(payload);
  }

  handlePointerMove(payload) {
    this.currentState?.handlePointerMove?.(payload);
  }

  handlePointerUp(payload) {
    this.currentState?.handlePointerUp?.(payload);
  }

  handleWheel(payload) {
    this.currentState?.handleWheel?.(payload);
  }

  handleGestureStart(payload) {
    this.currentState?.handleGestureStart?.(payload);
  }

  handleGestureMove(payload) {
    this.currentState?.handleGestureMove?.(payload);
  }

  handleGestureEnd() {
    this.currentState?.handleGestureEnd?.();
  }

  shouldHandleGestureStart(payload) {
    return this.currentState?.shouldHandleGestureStart?.(payload) ?? true;
  }
}
