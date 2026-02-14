export const EDITOR_INPUT_ACTIONS = {
  NAV_UP: 'NAV_UP',
  NAV_DOWN: 'NAV_DOWN',
  NAV_LEFT: 'NAV_LEFT',
  NAV_RIGHT: 'NAV_RIGHT',
  UNDO: 'UNDO',
  REDO: 'REDO',
  CONFIRM: 'CONFIRM',
  CANCEL: 'CANCEL',
  TOGGLE_MODE: 'TOGGLE_MODE',
  MENU: 'MENU',
  PANEL_PREV: 'PANEL_PREV',
  PANEL_NEXT: 'PANEL_NEXT',
  PAN: 'PAN',
  ZOOM: 'ZOOM'
};

const DEFAULT_AXES = {
  leftX: 0,
  leftY: 0,
  rightX: 0,
  rightY: 0,
  leftTrigger: 0,
  rightTrigger: 0
};

const DPAD_TO_ACTION = {
  up: EDITOR_INPUT_ACTIONS.NAV_UP,
  down: EDITOR_INPUT_ACTIONS.NAV_DOWN,
  left: EDITOR_INPUT_ACTIONS.NAV_LEFT,
  right: EDITOR_INPUT_ACTIONS.NAV_RIGHT
};

const DEFAULT_DPAD_BINDINGS = {
  up: 'dpadUp',
  down: 'dpadDown',
  left: 'dpadLeft',
  right: 'dpadRight'
};

export class EditorInputActionNormalizer {
  constructor({ dpadRepeatDelay = 0.18, triggerThreshold = 0.6, panDeadzone = 0.12 } = {}) {
    this.dpadRepeatDelay = dpadRepeatDelay;
    this.triggerThreshold = triggerThreshold;
    this.panDeadzone = panDeadzone;
    this.buttonState = new Map();
    this.dpadTimers = { up: 0, down: 0, left: 0, right: 0 };
    this.triggerState = { leftHeld: false, rightHeld: false };
  }

  reset() {
    this.buttonState.clear();
    this.dpadTimers = { up: 0, down: 0, left: 0, right: 0 };
    this.triggerState = { leftHeld: false, rightHeld: false };
  }

  updateGamepad(input, dt, config = {}) {
    const connected = input?.isGamepadConnected?.() || false;
    const axes = connected ? { ...DEFAULT_AXES, ...(input?.getGamepadAxes?.() || {}) } : { ...DEFAULT_AXES };
    const actions = [];
    const pressed = {};
    const released = {};
    const down = {};
    const gamepadActions = input?.getGamepadActions?.() || {};
    const semanticBindings = config.semanticBindings || {};
    const dpadBindings = { ...DEFAULT_DPAD_BINDINGS, ...(config.dpadBindings || {}) };

    if (!connected) {
      this.reset();
      return this.buildResult({ connected, axes, actions, pressed, released, down });
    }

    const trackRawAction = (rawAction) => {
      if (!rawAction) return;
      const isDown = this.isRawActionDown(input, gamepadActions, rawAction);
      down[rawAction] = isDown;
      const wasDown = this.buttonState.get(rawAction) || false;
      pressed[rawAction] = isDown && !wasDown;
      released[rawAction] = !isDown && wasDown;
      this.buttonState.set(rawAction, isDown);
    };

    Object.values(semanticBindings).forEach(trackRawAction);
    Object.values(dpadBindings).forEach(trackRawAction);

    Object.entries(semanticBindings).forEach(([semanticType, rawAction]) => {
      if (pressed[rawAction]) {
        actions.push({ type: semanticType, source: 'gamepad' });
      }
    });

    Object.entries(dpadBindings).forEach(([dir, rawAction]) => {
      if (pressed[rawAction]) {
        actions.push({ type: DPAD_TO_ACTION[dir], source: 'gamepad' });
      }
      if (down[rawAction]) {
        this.dpadTimers[dir] += dt;
        if (this.dpadTimers[dir] >= (config.dpadRepeatDelay || this.dpadRepeatDelay)) {
          this.dpadTimers[dir] = 0;
          actions.push({ type: DPAD_TO_ACTION[dir], source: 'gamepad', repeat: true });
        }
      } else {
        this.dpadTimers[dir] = 0;
      }
    });

    if (config.includePanIntent) {
      const panX = Math.abs(axes.rightX) > this.panDeadzone ? axes.rightX : 0;
      const panY = Math.abs(axes.rightY) > this.panDeadzone ? axes.rightY : 0;
      if (panX || panY) {
        actions.push({ type: EDITOR_INPUT_ACTIONS.PAN, source: 'gamepad', dx: panX, dy: panY });
      }
    }

    if (config.includeZoomIntent) {
      const zoomDelta = axes.rightTrigger - axes.leftTrigger;
      if (Math.abs(zoomDelta) > 0.0001) {
        actions.push({ type: EDITOR_INPUT_ACTIONS.ZOOM, source: 'gamepad', value: zoomDelta });
      }
    }

    return this.buildResult({ connected, axes, actions, pressed, released, down });
  }

  buildResult({ connected, axes, actions, pressed, released, down }) {
    const ltHeld = axes.leftTrigger > this.triggerThreshold;
    const rtHeld = axes.rightTrigger > this.triggerThreshold;
    const ltPressed = ltHeld && !this.triggerState.leftHeld;
    const rtPressed = rtHeld && !this.triggerState.rightHeld;
    const ltReleased = !ltHeld && this.triggerState.leftHeld;
    const rtReleased = !rtHeld && this.triggerState.rightHeld;
    this.triggerState = { leftHeld: ltHeld, rightHeld: rtHeld };

    return {
      connected,
      axes,
      actions,
      pressed,
      down,
      released,
      triggers: {
        ltHeld,
        rtHeld,
        ltPressed,
        rtPressed,
        ltReleased,
        rtReleased
      }
    };
  }

  isRawActionDown(input, gamepadActions, rawAction) {
    if (Object.hasOwn(gamepadActions, rawAction)) {
      return Boolean(gamepadActions[rawAction]);
    }
    return Boolean(input?.isGamepadDown?.(rawAction));
  }
}

export const normalizeKeyboardEvent = (event, keyboardBindings = {}) => {
  const actions = [];
  if (!event) return actions;
  const cmd = Boolean(event.ctrlKey || event.metaKey);
  const shift = Boolean(event.shiftKey);
  Object.entries(keyboardBindings).forEach(([semanticType, binding]) => {
    const bindings = Array.isArray(binding) ? binding : [binding];
    const matched = bindings.some((entry) => {
      if (!entry) return false;
      if (entry.repeat === false && event.repeat) return false;
      if (entry.code && entry.code !== event.code) return false;
      if (entry.key && entry.key !== event.key) return false;
      if (Boolean(entry.cmd) !== cmd) return false;
      if (typeof entry.shift === 'boolean' && entry.shift !== shift) return false;
      return true;
    });
    if (matched) actions.push({ type: semanticType, source: 'keyboard' });
  });
  return actions;
};
