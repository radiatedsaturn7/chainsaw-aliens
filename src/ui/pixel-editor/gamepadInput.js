import { INPUT_ACTIONS, NAV_REPEAT_DELAY, TRIGGER_THRESHOLD } from './inputBindings.js';
import { EDITOR_INPUT_ACTIONS, EditorInputActionNormalizer } from '../shared/input/editorInputActions.js';

const PIXEL_GAMEPAD_BINDINGS = {
  [EDITOR_INPUT_ACTIONS.UNDO]: 'dash',
  [EDITOR_INPUT_ACTIONS.REDO]: 'throw',
  [EDITOR_INPUT_ACTIONS.CONFIRM]: 'jump',
  [EDITOR_INPUT_ACTIONS.CANCEL]: 'cancel',
  [EDITOR_INPUT_ACTIONS.TOGGLE_MODE]: 'cancel',
  [EDITOR_INPUT_ACTIONS.MENU]: 'pause',
  [EDITOR_INPUT_ACTIONS.PANEL_PREV]: 'aimUp',
  [EDITOR_INPUT_ACTIONS.PANEL_NEXT]: 'aimDown'
};

const PIXEL_DIRECT_BINDINGS = {
  draw: 'jump',
  erase: 'rev',
  quickColor: 'l3',
  quickTool: 'r3'
};

export default class PixelEditorGamepadInput {
  constructor() {
    this.normalizer = new EditorInputActionNormalizer({
      dpadRepeatDelay: NAV_REPEAT_DELAY,
      triggerThreshold: TRIGGER_THRESHOLD
    });
  }

  update(input, dt, context = {}) {
    const normalized = this.normalizer.updateGamepad(input, dt, {
      semanticBindings: { ...PIXEL_GAMEPAD_BINDINGS, draw: PIXEL_DIRECT_BINDINGS.draw, erase: PIXEL_DIRECT_BINDINGS.erase, quickColor: PIXEL_DIRECT_BINDINGS.quickColor, quickTool: PIXEL_DIRECT_BINDINGS.quickTool },
      includePanIntent: true
    });
    const { actions: semanticActions, axes, connected, pressed, released, down, triggers } = normalized;
    const actions = [];

    if (!connected) {
      return {
        actions,
        axes,
        connected,
        aDown: false,
        bDown: false,
        xDown: false,
        yDown: false,
        lbDown: false,
        rbDown: false,
        ltHeld: false,
        rtHeld: false,
        ltPressed: false,
        rtPressed: false,
        ltReleased: false,
        rtReleased: false
      };
    }

    const aDown = Boolean(down.jump);
    const bDown = Boolean(down.dash);
    const xDown = Boolean(down.rev);
    const yDown = Boolean(down.throw);
    const lbDown = Boolean(down.aimUp);
    const rbDown = Boolean(down.aimDown);

    semanticActions.forEach((action) => {
      if (action.type === EDITOR_INPUT_ACTIONS.UNDO) actions.push({ type: INPUT_ACTIONS.UNDO });
      if (action.type === EDITOR_INPUT_ACTIONS.REDO) actions.push({ type: INPUT_ACTIONS.REDO });
      if (action.type === EDITOR_INPUT_ACTIONS.MENU) actions.push({ type: INPUT_ACTIONS.MENU });
      if (action.type === EDITOR_INPUT_ACTIONS.TOGGLE_MODE) actions.push({ type: INPUT_ACTIONS.TOGGLE_UI_MODE });
      if (action.type === EDITOR_INPUT_ACTIONS.PANEL_PREV) actions.push({ type: INPUT_ACTIONS.PANEL_PREV });
      if (action.type === EDITOR_INPUT_ACTIONS.PANEL_NEXT) actions.push({ type: INPUT_ACTIONS.PANEL_NEXT });
      if (action.type === EDITOR_INPUT_ACTIONS.NAV_UP) actions.push({ type: INPUT_ACTIONS.NAV_UP, repeat: Boolean(action.repeat) });
      if (action.type === EDITOR_INPUT_ACTIONS.NAV_DOWN) actions.push({ type: INPUT_ACTIONS.NAV_DOWN, repeat: Boolean(action.repeat) });
      if (action.type === EDITOR_INPUT_ACTIONS.NAV_LEFT) actions.push({ type: INPUT_ACTIONS.NAV_LEFT, repeat: Boolean(action.repeat) });
      if (action.type === EDITOR_INPUT_ACTIONS.NAV_RIGHT) actions.push({ type: INPUT_ACTIONS.NAV_RIGHT, repeat: Boolean(action.repeat) });
      if (action.type === EDITOR_INPUT_ACTIONS.PAN) {
        actions.push({ type: INPUT_ACTIONS.PAN_XY, dx: action.dx, dy: action.dy, context });
      }
    });

    if (pressed.jump) {
      actions.push({ type: INPUT_ACTIONS.DRAW_PRESS });
      actions.push({ type: INPUT_ACTIONS.CONFIRM });
    }
    if (released.jump) actions.push({ type: INPUT_ACTIONS.DRAW_RELEASE });

    if (pressed.rev) actions.push({ type: INPUT_ACTIONS.ERASE_PRESS });
    if (released.rev) actions.push({ type: INPUT_ACTIONS.ERASE_RELEASE });
    if (pressed.l3) actions.push({ type: INPUT_ACTIONS.QUICK_COLOR });
    if (pressed.r3) actions.push({ type: INPUT_ACTIONS.QUICK_TOOL });

    return {
      actions,
      axes,
      connected,
      aDown,
      bDown,
      xDown,
      yDown,
      lbDown,
      rbDown,
      ltHeld: triggers.ltHeld,
      rtHeld: triggers.rtHeld,
      ltPressed: triggers.ltPressed,
      rtPressed: triggers.rtPressed,
      ltReleased: triggers.ltReleased,
      rtReleased: triggers.rtReleased
    };
  }
}
