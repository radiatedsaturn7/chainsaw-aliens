import PixelEditorGamepadInput from './gamepadInput.js';
import { INPUT_ACTIONS } from './inputBindings.js';
import { EDITOR_INPUT_ACTIONS, normalizeKeyboardEvent } from '../shared/input/editorInputActions.js';

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
    const semanticActions = normalizeKeyboardEvent(event, {
      [EDITOR_INPUT_ACTIONS.CONFIRM]: { key: 'Enter', repeat: false },
      [EDITOR_INPUT_ACTIONS.CANCEL]: { key: 'Escape', repeat: false },
      [EDITOR_INPUT_ACTIONS.TOGGLE_MODE]: { key: 'Tab', repeat: false }
    });
    return semanticActions.map((action) => {
      if (action.type === EDITOR_INPUT_ACTIONS.CONFIRM) return { type: INPUT_ACTIONS.CONFIRM };
      if (action.type === EDITOR_INPUT_ACTIONS.CANCEL) return { type: INPUT_ACTIONS.CANCEL };
      if (action.type === EDITOR_INPUT_ACTIONS.TOGGLE_MODE) return { type: INPUT_ACTIONS.TOGGLE_UI_MODE };
      return null;
    }).filter(Boolean);
  }
}
