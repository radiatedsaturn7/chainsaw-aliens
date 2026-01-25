export const INPUT_ACTIONS = {
  NAV_UP: 'NAV_UP',
  NAV_DOWN: 'NAV_DOWN',
  NAV_LEFT: 'NAV_LEFT',
  NAV_RIGHT: 'NAV_RIGHT',
  CONFIRM: 'CONFIRM',
  CANCEL: 'CANCEL',
  DRAW_PRESS: 'DRAW_PRESS',
  DRAW_RELEASE: 'DRAW_RELEASE',
  TEMP_ERASE: 'TEMP_ERASE',
  TEMP_EYEDROPPER: 'TEMP_EYEDROPPER',
  ZOOM_IN: 'ZOOM_IN',
  ZOOM_OUT: 'ZOOM_OUT',
  PAN_XY: 'PAN_XY',
  UNDO: 'UNDO',
  REDO: 'REDO',
  TOGGLE_UI_MODE: 'TOGGLE_UI_MODE',
  TOGGLE_MODE: 'TOGGLE_MODE',
  MENU: 'MENU'
};

const NAV_REPEAT_DELAY = 0.18;
const TRIGGER_THRESHOLD = 0.6;
const TRIGGER_REPEAT = 0.12;
const X_HOLD_DELAY = 0.18;

export default class InputManager {
  constructor() {
    this.mode = 'canvas';
    this.prevButtons = {
      a: false,
      b: false,
      x: false,
      y: false,
      lb: false,
      rb: false
    };
    this.triggerTimers = { in: 0, out: 0 };
    this.navTimers = { up: 0, down: 0, left: 0, right: 0 };
    this.xHoldTime = 0;
    this.xTempActive = false;
  }

  setMode(mode) {
    this.mode = mode === 'ui' ? 'ui' : 'canvas';
  }

  updateGamepad(input, dt, context = {}) {
    const actions = [];
    const axes = input.getGamepadAxes?.() || {
      leftX: 0,
      leftY: 0,
      rightX: 0,
      rightY: 0,
      leftTrigger: 0,
      rightTrigger: 0
    };
    const connected = input.isGamepadConnected?.() || false;
    if (!connected) {
      this.xHoldTime = 0;
      this.xTempActive = false;
      this.triggerTimers = { in: 0, out: 0 };
      return { actions, axes, connected, aDown: false, bDown: false, xDown: false, yDown: false, lbDown: false, rbDown: false };
    }

    const gamepadActions = input.getGamepadActions?.() || {};
    const aDown = Boolean(gamepadActions.jump);
    const bDown = Boolean(gamepadActions.dash);
    const xDown = Boolean(gamepadActions.rev);
    const yDown = Boolean(gamepadActions.throw);
    const lbDown = Boolean(gamepadActions.aimUp);
    const rbDown = Boolean(gamepadActions.aimDown);

    const startPressed = input.wasGamepadPressed?.('pause');
    const backPressed = input.wasGamepadPressed?.('cancel');
    const dpadLeftPressed = input.wasGamepadPressed?.('dpadLeft');
    const dpadRightPressed = input.wasGamepadPressed?.('dpadRight');
    const dpadUpPressed = input.wasGamepadPressed?.('dpadUp');
    const dpadDownPressed = input.wasGamepadPressed?.('dpadDown');
    const dpadLeftDown = input.isGamepadDown?.('dpadLeft');
    const dpadRightDown = input.isGamepadDown?.('dpadRight');
    const dpadUpDown = input.isGamepadDown?.('dpadUp');
    const dpadDownDown = input.isGamepadDown?.('dpadDown');

    if (rbDown && dpadLeftPressed) actions.push({ type: INPUT_ACTIONS.UNDO });
    if (rbDown && dpadRightPressed) actions.push({ type: INPUT_ACTIONS.REDO });

    if (backPressed) actions.push({ type: INPUT_ACTIONS.TOGGLE_UI_MODE });
    if (startPressed) actions.push({ type: INPUT_ACTIONS.MENU });

    const blockHorizontalNav = rbDown && (dpadLeftPressed || dpadRightPressed);
    if (dpadUpPressed || dpadDownPressed || dpadLeftPressed || dpadRightPressed) {
      const navCandidates = [
        { down: dpadUpPressed, dir: 'up' },
        { down: dpadDownPressed, dir: 'down' },
        { down: dpadLeftPressed && !blockHorizontalNav, dir: 'left' },
        { down: dpadRightPressed && !blockHorizontalNav, dir: 'right' }
      ];
      navCandidates.forEach((entry) => {
        if (entry.down) {
          actions.push({
            type: INPUT_ACTIONS[`NAV_${entry.dir.toUpperCase()}`]
          });
        }
      });
    }

    const navHeld = [
      { down: dpadUpDown, dir: 'up' },
      { down: dpadDownDown, dir: 'down' },
      { down: dpadLeftDown && !blockHorizontalNav, dir: 'left' },
      { down: dpadRightDown && !blockHorizontalNav, dir: 'right' }
    ];
    navHeld.forEach((entry) => {
      if (entry.down) {
        this.navTimers[entry.dir] += dt;
        if (this.navTimers[entry.dir] >= NAV_REPEAT_DELAY) {
          this.navTimers[entry.dir] = 0;
          actions.push({
            type: INPUT_ACTIONS[`NAV_${entry.dir.toUpperCase()}`],
            repeat: true
          });
        }
      } else {
        this.navTimers[entry.dir] = 0;
      }
    });

    if (aDown && !this.prevButtons.a) {
      actions.push({ type: INPUT_ACTIONS.DRAW_PRESS });
      actions.push({ type: INPUT_ACTIONS.CONFIRM });
    }
    if (!aDown && this.prevButtons.a) {
      actions.push({ type: INPUT_ACTIONS.DRAW_RELEASE });
    }

    if (bDown && !this.prevButtons.b) actions.push({ type: INPUT_ACTIONS.CANCEL });
    if (yDown && !this.prevButtons.y) actions.push({ type: INPUT_ACTIONS.TOGGLE_MODE });

    if (lbDown && !this.prevButtons.lb) actions.push({ type: INPUT_ACTIONS.TEMP_ERASE, active: true });
    if (!lbDown && this.prevButtons.lb) actions.push({ type: INPUT_ACTIONS.TEMP_ERASE, active: false });

    if (xDown) {
      this.xHoldTime += dt;
      if (!this.xTempActive && this.xHoldTime >= X_HOLD_DELAY) {
        this.xTempActive = true;
        actions.push({ type: INPUT_ACTIONS.TEMP_EYEDROPPER, active: true });
      }
    }
    if (!xDown && this.prevButtons.x) {
      if (this.xTempActive) {
        actions.push({ type: INPUT_ACTIONS.TEMP_EYEDROPPER, active: false });
      } else {
        actions.push({ type: INPUT_ACTIONS.TOGGLE_MODE, tool: 'eyedropper' });
      }
      this.xHoldTime = 0;
      this.xTempActive = false;
    }

    const triggerZoom = (value, key, actionType) => {
      const isActive = value > TRIGGER_THRESHOLD;
      if (isActive) {
        this.triggerTimers[key] += dt;
        if (this.triggerTimers[key] === dt) {
          actions.push({ type: actionType, step: 1 });
        } else if (this.triggerTimers[key] >= TRIGGER_REPEAT) {
          this.triggerTimers[key] = 0;
          actions.push({ type: actionType, step: 1, repeat: true });
        }
      } else {
        this.triggerTimers[key] = 0;
      }
    };

    triggerZoom(axes.leftTrigger, 'out', INPUT_ACTIONS.ZOOM_OUT);
    triggerZoom(axes.rightTrigger, 'in', INPUT_ACTIONS.ZOOM_IN);

    const panActive = Math.hypot(axes.rightX, axes.rightY) > 0.12;
    if (panActive) {
      actions.push({
        type: INPUT_ACTIONS.PAN_XY,
        dx: axes.rightX,
        dy: axes.rightY,
        context
      });
    }

    this.prevButtons = { a: aDown, b: bDown, x: xDown, y: yDown, lb: lbDown, rb: rbDown };

    return {
      actions,
      axes,
      connected,
      aDown,
      bDown,
      xDown,
      yDown,
      lbDown,
      rbDown
    };
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
