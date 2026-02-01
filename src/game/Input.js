const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  drop: [],
  jump: ['ArrowUp', 'KeyW', 'Space'],
  dash: ['ShiftLeft', 'ShiftRight'],
  attack: ['KeyJ'],
  rev: ['KeyK'],
  flame: ['KeyF'],
  throw: ['KeyL'],
  pause: ['Escape'],
  cancel: ['Backspace'],
  interact: ['Space', 'Enter', 'NumpadEnter'],
  endless: ['KeyN'],
  test: ['KeyT'],
  validator: ['KeyV'],
  coverage: ['KeyC'],
  encounter: ['KeyE'],
  legend: ['F1'],
  editor: ['F2'],
  debug: ['F3'],
  golden: ['KeyG']
};

export default class Input {
  constructor() {
    this.keys = new Map();
    this.pressed = new Set();
    this.released = new Set();
    this.virtualDown = new Map();
    this.virtualPressed = new Set();
    this.virtualReleased = new Set();
    this.virtualGamepadActions = {};
    this.virtualGamepadPressed = new Set();
    this.virtualGamepadReleased = new Set();
    this.virtualGamepadActive = false;
    this.virtualGamepadAxes = {
      leftX: 0,
      leftY: 0,
      rightX: 0,
      rightY: 0,
      leftTrigger: 0,
      rightTrigger: 0
    };
    this.gamepadIndex = null;
    this.gamepadActions = {};
    this.gamepadDeadzone = 0.3;
    this.gamepadConnected = false;
    this.gamepadPressed = new Set();
    this.gamepadReleased = new Set();
    this.gamepadPrevActions = {};
    this.gamepadAvailable = false;
    this.gamepadScanIntervalMs = 250;
    this.lastGamepadScanTime = 0;
    this.gamepadAxisMode = null;
    this.gamepadAxes = {
      leftX: 0,
      leftY: 0,
      rightX: 0,
      rightY: 0,
      leftTrigger: 0,
      rightTrigger: 0
    };
    window.addEventListener('keydown', (e) => {
      if (!this.keys.get(e.code)) {
        this.pressed.add(e.code);
      }
      this.keys.set(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => this.reset());
    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.reset();
      }
    });
    window.addEventListener('gamepadconnected', (event) => {
      if (this.gamepadIndex === null) {
        this.gamepadIndex = event.gamepad.index;
      }
    });
    window.addEventListener('gamepaddisconnected', (event) => {
      if (this.gamepadIndex === event.gamepad.index) {
        this.gamepadIndex = null;
        this.gamepadAxisMode = null;
      }
    });
  }

  isDown(action) {
    return KEYMAP[action].some((code) => this.keys.get(code)) || this.virtualDown.get(action);
  }

  wasPressed(action) {
    return KEYMAP[action].some((code) => this.pressed.has(code)) || this.virtualPressed.has(action);
  }

  wasReleased(action) {
    return KEYMAP[action].some((code) => this.released.has(code)) || this.virtualReleased.has(action);
  }

  wasPressedCode(code) {
    return this.pressed.has(code);
  }

  isDownCode(code) {
    return this.keys.get(code);
  }

  isShiftDown() {
    return this.keys.get('ShiftLeft') || this.keys.get('ShiftRight');
  }

  updateGamepad() {
    this.gamepadActions = {};
    this.gamepadConnected = false;
    this.gamepadPressed.clear();
    this.gamepadReleased.clear();
    this.gamepadAxes = {
      leftX: 0,
      leftY: 0,
      rightX: 0,
      rightY: 0,
      leftTrigger: 0,
      rightTrigger: 0
    };
    const now = performance.now();
    if (!this.gamepadAvailable && this.gamepadIndex === null) {
      if (now - this.lastGamepadScanTime < this.gamepadScanIntervalMs) {
        return;
      }
    }
    this.lastGamepadScanTime = now;
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    if (!pads) return;
    let pad = null;
    if (this.gamepadIndex !== null && pads[this.gamepadIndex]?.connected) {
      pad = pads[this.gamepadIndex];
    } else {
      pad = Array.from(pads).find((candidate) => candidate?.connected) || null;
      if (pad) {
        this.gamepadIndex = pad.index;
      }
    }
    if (!pad) {
      this.gamepadPrevActions = {};
      this.gamepadAvailable = false;
      this.gamepadAxisMode = null;
      return;
    }
    this.gamepadAvailable = true;
    this.gamepadConnected = true;

    const isButtonActive = (index, threshold = 0.5) => {
      const button = pad.buttons?.[index];
      if (!button) return false;
      return Boolean(button.pressed || button.value > threshold);
    };

    const axisData = this.resolveGamepadAxes(pad);
    const axisX = axisData.leftX;
    const axisY = axisData.leftY;
    const axisRX = axisData.rightX;
    const axisRY = axisData.rightY;
    const triggerData = this.resolveGamepadTriggers(pad);
    const leftTrigger = triggerData.leftTrigger;
    const rightTrigger = triggerData.rightTrigger;
    const leftStickLeft = axisX < -this.gamepadDeadzone;
    const leftStickRight = axisX > this.gamepadDeadzone;
    const leftStickUp = axisY < -this.gamepadDeadzone;
    const leftStickDown = axisY > this.gamepadDeadzone;

    const dpadAxisX = pad.axes?.[6] ?? 0;
    const dpadAxisY = pad.axes?.[7] ?? 0;
    const dpadUp = isButtonActive(12) || dpadAxisY < -0.5;
    const dpadDown = isButtonActive(13) || dpadAxisY > 0.5;
    const dpadLeft = isButtonActive(14) || dpadAxisX < -0.5;
    const dpadRight = isButtonActive(15) || dpadAxisX > 0.5;
    const aimUp = isButtonActive(4);
    const aimDown = isButtonActive(5);

    const nextActions = {
      left: leftStickLeft,
      right: leftStickRight,
      up: leftStickUp,
      down: leftStickDown,
      jump: isButtonActive(0),
      dash: isButtonActive(1),
      attack: isButtonActive(7, 0.2),
      throw: isButtonActive(3),
      flame: isButtonActive(10),
      rev: isButtonActive(2),
      pause: isButtonActive(9),
      cancel: isButtonActive(8),
      interact: isButtonActive(0),
      aimMode: isButtonActive(6, 0.2),
      dpadUp,
      dpadDown,
      dpadLeft,
      dpadRight,
      aimUp,
      aimDown,
      l3: isButtonActive(10),
      r3: isButtonActive(11)
    };
    Object.keys(nextActions).forEach((action) => {
      const prev = Boolean(this.gamepadPrevActions[action]);
      const next = Boolean(nextActions[action]);
      if (next && !prev) {
        this.gamepadPressed.add(action);
      }
      if (!next && prev) {
        this.gamepadReleased.add(action);
      }
    });
    this.gamepadPrevActions = nextActions;
    this.gamepadActions = nextActions;
    this.gamepadAxes = {
      leftX: axisX,
      leftY: axisY,
      rightX: axisRX,
      rightY: axisRY,
      leftTrigger,
      rightTrigger
    };
  }

  resolveGamepadAxes(pad) {
    const axes = pad.axes || [];
    let leftX = axes[0] ?? 0;
    let leftY = axes[1] ?? 0;
    let rightX = axes[2] ?? 0;
    let rightY = axes[3] ?? 0;
    if (pad.mapping !== 'standard') {
      const leftMag = Math.hypot(leftX, leftY);
      const rightMag = Math.hypot(rightX, rightY);
      const swapThreshold = 0.2;
      if (!this.gamepadAxisMode) {
        if (leftMag > swapThreshold && rightMag <= swapThreshold) {
          this.gamepadAxisMode = 'standard';
        } else if (rightMag > swapThreshold && leftMag <= swapThreshold) {
          this.gamepadAxisMode = 'swapped';
        }
      }
      if (this.gamepadAxisMode === 'swapped') {
        [leftX, leftY, rightX, rightY] = [rightX, rightY, leftX, leftY];
      }
    }
    return { leftX, leftY, rightX, rightY };
  }

  resolveGamepadTriggers(pad) {
    let leftTrigger = pad.buttons?.[6]?.value ?? 0;
    let rightTrigger = pad.buttons?.[7]?.value ?? 0;
    const axisLeft = pad.axes?.[4];
    const axisRight = pad.axes?.[5];
    if (typeof axisLeft === 'number' && typeof axisRight === 'number') {
      const axisLeftValue = clamp((axisLeft + 1) / 2, 0, 1);
      const axisRightValue = clamp((axisRight + 1) / 2, 0, 1);
      const buttonsIdle = leftTrigger <= 0.01 && rightTrigger <= 0.01;
      const buttonsStuck = leftTrigger >= 0.99 && rightTrigger >= 0.99;
      const axisActive = Math.abs(axisLeft) > 0.05 || Math.abs(axisRight) > 0.05;
      if ((buttonsIdle && axisActive) || (buttonsStuck && (axisLeftValue < 0.98 || axisRightValue < 0.98))) {
        leftTrigger = axisLeftValue;
        rightTrigger = axisRightValue;
      }
    }
    return { leftTrigger, rightTrigger };
  }

  getGamepadActions() {
    return this.gamepadActions;
  }

  isGamepadConnected() {
    return this.gamepadConnected;
  }

  isGamepadDown(action) {
    return Boolean(this.gamepadActions[action] || this.virtualGamepadActions[action]);
  }

  wasGamepadPressed(action) {
    return this.gamepadPressed.has(action) || this.virtualGamepadPressed.has(action);
  }

  getGamepadAxes() {
    if (this.virtualGamepadActive) {
      return this.virtualGamepadAxes;
    }
    return this.gamepadAxes;
  }

  combineActions(...sources) {
    const combined = {};
    Object.keys(KEYMAP).forEach((action) => {
      combined[action] = sources.some((source) => Boolean(source?.[action]));
    });
    return combined;
  }

  setVirtual(actions = {}) {
    Object.keys(KEYMAP).forEach((action) => {
      const prev = this.virtualDown.get(action) || false;
      const next = Boolean(actions[action]);
      if (next && !prev) {
        this.virtualPressed.add(action);
      }
      if (!next && prev) {
        this.virtualReleased.add(action);
      }
      this.virtualDown.set(action, next);
    });
  }

  setVirtualGamepad({ actions = {}, axes = {} } = {}) {
    const allActions = new Set([
      ...Object.keys(this.virtualGamepadActions),
      ...Object.keys(actions)
    ]);
    allActions.forEach((action) => {
      const prev = Boolean(this.virtualGamepadActions[action]);
      const next = Boolean(actions[action]);
      if (next && !prev) {
        this.virtualGamepadPressed.add(action);
      }
      if (!next && prev) {
        this.virtualGamepadReleased.add(action);
      }
      this.virtualGamepadActions[action] = next;
    });
    this.virtualGamepadAxes = {
      leftX: axes.leftX ?? 0,
      leftY: axes.leftY ?? 0,
      rightX: axes.rightX ?? 0,
      rightY: axes.rightY ?? 0,
      leftTrigger: axes.leftTrigger ?? 0,
      rightTrigger: axes.rightTrigger ?? 0
    };
    this.virtualGamepadActive = true;
  }

  clearVirtual() {
    this.virtualDown.clear();
    this.virtualPressed.clear();
    this.virtualReleased.clear();
  }

  clearVirtualGamepad() {
    this.virtualGamepadActions = {};
    this.virtualGamepadPressed.clear();
    this.virtualGamepadReleased.clear();
    this.virtualGamepadActive = false;
    this.virtualGamepadAxes = {
      leftX: 0,
      leftY: 0,
      rightX: 0,
      rightY: 0,
      leftTrigger: 0,
      rightTrigger: 0
    };
  }

  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.released.clear();
    this.clearVirtual();
    this.clearVirtualGamepad();
    this.gamepadActions = {};
  }

  flush() {
    this.pressed.clear();
    this.released.clear();
    this.virtualPressed.clear();
    this.virtualReleased.clear();
    this.gamepadPressed.clear();
    this.gamepadReleased.clear();
    this.virtualGamepadPressed.clear();
    this.virtualGamepadReleased.clear();
  }
}
