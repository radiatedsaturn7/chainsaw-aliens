export default class RobterSessionState {
  constructor(game) {
    this.game = game;
  }

  update(dt) { this.game._updateByState(dt); }
  draw() { this.game._drawByState(); }
  handleClick(x, y) { this.game._handleClickByState(x, y); }
  handlePointerDown(payload) { this.game._handlePointerDownByState(payload); }
  handlePointerMove(payload) { this.game._handlePointerMoveByState(payload); }
  handlePointerUp(payload) { this.game._handlePointerUpByState(payload); }
}
