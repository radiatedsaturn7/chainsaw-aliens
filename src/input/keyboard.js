const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const KEY_TO_SEMITONE = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16
};

export default class KeyboardInput {
  constructor(bus) {
    this.bus = bus;
    this.enabled = false;
    this.baseOctave = 4;
    this.velocity = 100;
    this.activeKeys = new Map();
    this.sustain = false;
    this.pendingSustain = new Map();
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  setBaseOctave(octave) {
    this.baseOctave = clamp(octave, 1, 7);
  }

  setVelocity(velocity) {
    this.velocity = clamp(Math.round(velocity), 20, 127);
  }

  getPitchForKey(code) {
    if (!(code in KEY_TO_SEMITONE)) return null;
    const semitone = KEY_TO_SEMITONE[code];
    return this.baseOctave * 12 + semitone + 12;
  }

  handleKeyDown(event) {
    if (!this.enabled) return;
    if (event.repeat) return;
    if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;

    if (event.code === 'KeyZ') {
      this.setBaseOctave(this.baseOctave - 1);
      return;
    }
    if (event.code === 'KeyX') {
      this.setBaseOctave(this.baseOctave + 1);
      return;
    }
    if (event.code === 'KeyC') {
      this.setVelocity(this.velocity - 8);
      return;
    }
    if (event.code === 'KeyV') {
      this.setVelocity(this.velocity + 8);
      return;
    }
    if (event.code === 'Space') {
      this.sustain = true;
      return;
    }
    const pitch = this.getPitchForKey(event.code);
    if (pitch === null) return;
    const noteId = `kbd-${event.code}-${Date.now()}`;
    this.activeKeys.set(event.code, noteId);
    this.bus.emit('noteon', {
      id: noteId,
      pitch,
      velocity: this.velocity,
      source: 'keyboard'
    });
  }

  handleKeyUp(event) {
    if (!this.enabled) return;
    if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if (event.code === 'Space') {
      this.sustain = false;
      this.pendingSustain.forEach((noteId) => {
        this.bus.emit('noteoff', { id: noteId, source: 'keyboard' });
      });
      this.pendingSustain.clear();
      return;
    }

    const noteId = this.activeKeys.get(event.code);
    if (!noteId) return;
    if (this.sustain) {
      this.pendingSustain.set(event.code, noteId);
    } else {
      this.bus.emit('noteoff', { id: noteId, source: 'keyboard' });
    }
    this.activeKeys.delete(event.code);
  }
}
