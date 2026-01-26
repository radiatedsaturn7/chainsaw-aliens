import { INPUT_ACTIONS } from './inputManager.js';

const NAV_REPEAT_DELAY = 0.18;
const TRIGGER_THRESHOLD = 0.6;

export default class PixelEditorGamepadInput {
  constructor() {
    this.prevButtons = {
      a: false,
      b: false,
      x: false,
      y: false,
      lb: false,
      rb: false,
      l3: false,
      r3: false
    };
    this.navTimers = { up: 0, down: 0, left: 0, right: 0 };
    this.triggerState = {
      leftHeld: false,
      rightHeld: false
    };
  }

  update(input, dt, context = {}) {
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
      this.triggerState = { leftHeld: false, rightHeld: false };
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

    const gamepadActions = input.getGamepadActions?.() || {};
    const aDown = Boolean(gamepadActions.jump);
    const bDown = Boolean(gamepadActions.dash);
    const xDown = Boolean(gamepadActions.rev);
    const yDown = Boolean(gamepadActions.throw);
    const lbDown = Boolean(gamepadActions.aimUp);
    const rbDown = Boolean(gamepadActions.aimDown);
    const l3Down = Boolean(gamepadActions.l3);
    const r3Down = Boolean(gamepadActions.r3);

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

    if (bDown && !this.prevButtons.b) actions.push({ type: INPUT_ACTIONS.UNDO });
    if (yDown && !this.prevButtons.y) actions.push({ type: INPUT_ACTIONS.REDO });

    if (backPressed) actions.push({ type: INPUT_ACTIONS.TOGGLE_UI_MODE });
    if (startPressed) actions.push({ type: INPUT_ACTIONS.MENU });

    const blockHorizontalNav = false;
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

    if (xDown && !this.prevButtons.x) actions.push({ type: INPUT_ACTIONS.ERASE_PRESS });
    if (!xDown && this.prevButtons.x) actions.push({ type: INPUT_ACTIONS.ERASE_RELEASE });
    if (lbDown && !this.prevButtons.lb) actions.push({ type: INPUT_ACTIONS.PANEL_PREV });
    if (rbDown && !this.prevButtons.rb) actions.push({ type: INPUT_ACTIONS.PANEL_NEXT });
    if (l3Down && !this.prevButtons.l3) actions.push({ type: INPUT_ACTIONS.QUICK_COLOR });
    if (r3Down && !this.prevButtons.r3) actions.push({ type: INPUT_ACTIONS.QUICK_TOOL });

    const panActive = Math.hypot(axes.rightX, axes.rightY) > 0.12;
    if (panActive) {
      actions.push({
        type: INPUT_ACTIONS.PAN_XY,
        dx: axes.rightX,
        dy: axes.rightY,
        context
      });
    }

    const ltHeld = axes.leftTrigger > TRIGGER_THRESHOLD;
    const rtHeld = axes.rightTrigger > TRIGGER_THRESHOLD;
    const ltPressed = ltHeld && !this.triggerState.leftHeld;
    const rtPressed = rtHeld && !this.triggerState.rightHeld;
    const ltReleased = !ltHeld && this.triggerState.leftHeld;
    const rtReleased = !rtHeld && this.triggerState.rightHeld;

    this.triggerState = { leftHeld: ltHeld, rightHeld: rtHeld };
    this.prevButtons = { a: aDown, b: bDown, x: xDown, y: yDown, lb: lbDown, rb: rbDown, l3: l3Down, r3: r3Down };

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
      ltHeld,
      rtHeld,
      ltPressed,
      rtPressed,
      ltReleased,
      rtReleased
    };
  }
}
