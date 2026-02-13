export default class MidiEditorState {
  constructor(game) {
    this.game = game;
  }

  update(dt) { this.game._updateByState(dt); }
  draw() { this.game._drawByState(); }
  handleClick(x, y) { this.game._handleClickByState(x, y); }
  handlePointerDown(payload) { this.game._handlePointerDownByState(payload); }
  handlePointerMove(payload) { this.game._handlePointerMoveByState(payload); }
  handlePointerUp(payload) { this.game._handlePointerUpByState(payload); }
  handleWheel(payload) { this.game._handleWheelByState(payload); }
  handleGestureStart(payload) { this.game._handleGestureStartByState(payload); }
  handleGestureMove(payload) { this.game._handleGestureMoveByState(payload); }
  handleGestureEnd() { this.game._handleGestureEndByState(); }
  shouldHandleGestureStart(payload) { return this.game._shouldHandleGestureStartByState(payload); }
}
