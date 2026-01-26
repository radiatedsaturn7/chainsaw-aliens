import PixelEditorGamepadInput from './gamepadInput.js';

export const INPUT_ACTIONS = {
  NAV_UP: 'NAV_UP',
  NAV_DOWN: 'NAV_DOWN',
  NAV_LEFT: 'NAV_LEFT',
  NAV_RIGHT: 'NAV_RIGHT',
  CONFIRM: 'CONFIRM',
  CANCEL: 'CANCEL',
  DRAW_PRESS: 'DRAW_PRESS',
  DRAW_RELEASE: 'DRAW_RELEASE',
  SET_TOOL: 'SET_TOOL',
  PAN_XY: 'PAN_XY',
  UNDO: 'UNDO',
  REDO: 'REDO',
  PANEL_PREV: 'PANEL_PREV',
  PANEL_NEXT: 'PANEL_NEXT',
  QUICK_COLOR: 'QUICK_COLOR',
  QUICK_TOOL: 'QUICK_TOOL',
  TOGGLE_UI_MODE: 'TOGGLE_UI_MODE',
  TOGGLE_MODE: 'TOGGLE_MODE',
  ERASE_PRESS: 'ERASE_PRESS',
  ERASE_RELEASE: 'ERASE_RELEASE',
  MENU: 'MENU'
};

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
