export const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['ArrowUp', 'KeyW', 'Space'],
  dash: ['ShiftLeft', 'ShiftRight'],
  attack: ['KeyJ'],
  rev: ['KeyK'],
  pause: ['Escape'],
  interact: ['Space']
};

export default class Input {
  constructor() {
    this.keys = new Map();
    this.pressed = new Set();
    this.released = new Set();
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
  }

  isDown(action) {
    return KEYMAP[action].some((code) => this.keys.get(code));
  }

  wasPressed(action) {
    return KEYMAP[action].some((code) => this.pressed.has(code));
  }

  wasReleased(action) {
    return KEYMAP[action].some((code) => this.released.has(code));
  }

  flush() {
    this.pressed.clear();
    this.released.clear();
  }
}
