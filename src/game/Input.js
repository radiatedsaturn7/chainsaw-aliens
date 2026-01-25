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
      return;
    }
    this.gamepadAvailable = true;
    this.gamepadConnected = true;

    const isButtonActive = (index, threshold = 0.5) => {
      const button = pad.buttons?.[index];
      if (!button) return false;
      return Boolean(button.pressed || button.value > threshold);
    };

    const axisX = pad.axes?.[0] ?? 0;
    const axisY = pad.axes?.[1] ?? 0;
    const axisRX = pad.axes?.[2] ?? 0;
    const axisRY = pad.axes?.[3] ?? 0;
    const leftTrigger = pad.buttons?.[6]?.value ?? 0;
    const rightTrigger = pad.buttons?.[7]?.value ?? 0;
    const leftStickLeft = axisX < -this.gamepadDeadzone;
    const leftStickRight = axisX > this.gamepadDeadzone;
    const leftStickUp = axisY < -this.gamepadDeadzone;
    const leftStickDown = axisY > this.gamepadDeadzone;

    const dpadUp = isButtonActive(12);
    const dpadDown = isButtonActive(13);
    const dpadLeft = isButtonActive(14);
    const dpadRight = isButtonActive(15);
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

  getGamepadActions() {
    return this.gamepadActions;
  }

  isGamepadConnected() {
    return this.gamepadConnected;
  }

  isGamepadDown(action) {
    return Boolean(this.gamepadActions[action]);
  }

  wasGamepadPressed(action) {
    return this.gamepadPressed.has(action);
  }

  getGamepadAxes() {
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

  clearVirtual() {
    this.virtualDown.clear();
    this.virtualPressed.clear();
    this.virtualReleased.clear();
  }

  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.released.clear();
    this.clearVirtual();
    this.gamepadActions = {};
  }

  flush() {
    this.pressed.clear();
    this.released.clear();
    this.virtualPressed.clear();
    this.virtualReleased.clear();
    this.gamepadPressed.clear();
    this.gamepadReleased.clear();
  }
}
