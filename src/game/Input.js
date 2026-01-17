export const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['ArrowUp', 'KeyW', 'Space'],
  dash: ['ShiftLeft', 'ShiftRight'],
  attack: ['KeyJ'],
  rev: ['KeyK'],
  flame: ['KeyF'],
  throw: ['KeyL'],
  pause: ['Escape'],
  cancel: ['Backspace'],
  interact: ['Space'],
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
  }

  flush() {
    this.pressed.clear();
    this.released.clear();
    this.virtualPressed.clear();
    this.virtualReleased.clear();
  }
}
