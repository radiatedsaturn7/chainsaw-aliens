import PixelEditorGamepadInput from './gamepadInput.js';
import { INPUT_ACTIONS } from './inputBindings.js';

export { INPUT_ACTIONS } from './inputBindings.js';

export default class InputManager {
  constructor() {
    this.mode = 'canvas';
    this.gamepadInput = new PixelEditorGamepadInput();
  }

  setMode(mode) {
    this.mode = mode === 'ui' ? 'ui' : 'canvas';
  }

  updateGamepad(input, dt, context = {}) {
    return this.gamepadInput.update(input, dt, context);
  }

  mapKeyboardEvent(event) {
    const actions = [];
    if (event.repeat) return actions;
    if (event.key === 'Enter') actions.push({ type: INPUT_ACTIONS.CONFIRM });
    if (event.key === 'Escape') actions.push({ type: INPUT_ACTIONS.CANCEL });
    if (event.key === 'Tab') actions.push({ type: INPUT_ACTIONS.TOGGLE_UI_MODE });
    return actions;
  }
}
