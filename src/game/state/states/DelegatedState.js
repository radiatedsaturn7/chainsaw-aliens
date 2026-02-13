const resolveDelegate = (game, target) => {
  if (typeof target === 'string') {
    return game[target] ?? null;
  }
  return target ?? null;
};

export default class DelegatedState {
  constructor(game, target) {
    this.game = game;
    this.target = target;
  }

  get delegate() {
    return resolveDelegate(this.game, this.target);
  }

  update(dt) { this.game._updateByState(dt, this.delegate); }
  draw() { this.game._drawByState(this.delegate); }
  handleClick(x, y) { this.game._handleClickByState(x, y); }
  handlePointerDown(payload) { this.game._handlePointerDownByState(payload, this.delegate); }
  handlePointerMove(payload) { this.game._handlePointerMoveByState(payload, this.delegate); }
  handlePointerUp(payload) { this.game._handlePointerUpByState(payload, this.delegate); }
  handleWheel(payload) { this.game._handleWheelByState(payload, this.delegate); }
  handleGestureStart(payload) { this.game._handleGestureStartByState(payload, this.delegate); }
  handleGestureMove(payload) { this.game._handleGestureMoveByState(payload, this.delegate); }
  handleGestureEnd() { this.game._handleGestureEndByState(this.delegate); }
  shouldHandleGestureStart(payload) { return this.game._shouldHandleGestureStartByState(payload, this.delegate); }
}

export const createDelegatedState = (game, target) => new DelegatedState(game, target);
