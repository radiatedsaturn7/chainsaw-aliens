const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const DEADZONE = 0.5;

const DIRECTION_MAP = [
  { id: 1, angle: 270 },
  { id: 2, angle: 315 },
  { id: 3, angle: 0 },
  { id: 4, angle: 45 },
  { id: 5, angle: 90 },
  { id: 6, angle: 135 },
  { id: 7, angle: 180 },
  { id: 8, angle: 225 }
];

const mapDirection = (x, y) => {
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  const normalized = (angle + 360) % 360;
  const entry = DIRECTION_MAP.reduce((closest, candidate) => {
    const diff = Math.min(
      Math.abs(candidate.angle - normalized),
      360 - Math.abs(candidate.angle - normalized)
    );
    return diff < closest.diff ? { diff, id: candidate.id } : closest;
  }, { diff: Infinity, id: 1 });
  return entry.id;
};

export default class GamepadInput {
  constructor(bus) {
    this.bus = bus;
    this.connected = false;
    this.enabled = true;
    this.activeIndex = null;
    this.prevButtons = [];
    this.leftStickCandidate = null;
    this.leftStickCandidateTime = 0;
    this.leftStickStableDirection = 1;
    this.latchRoot = false;
    this.latchedDegree = 1;
    this.octaveOffset = 0;
    this.scaleSteps = [0, 2, 4, 5, 7, 9, 11];
    this.key = 0;
    this.noteMode = false;
    this.spiceMode = 'add9';
    this.modTarget = 'cc1';
    this.lastPitchBend = 8192;
    this.lastModValue = 0;
    this.activeButtons = new Map();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  setScale({ key, steps }) {
    this.key = typeof key === 'number' ? key : 0;
    this.scaleSteps = Array.isArray(steps) && steps.length ? steps : this.scaleSteps;
  }

  setModTarget(target) {
    this.modTarget = target === 'cc74' ? 'cc74' : 'cc1';
  }

  getPitchForScaleStep(stepIndex) {
    const steps = this.scaleSteps;
    const octave = Math.floor(stepIndex / steps.length);
    const step = steps[((stepIndex % steps.length) + steps.length) % steps.length];
    return (4 + this.octaveOffset + octave) * 12 + this.key + step;
  }

  getChordPitches(rootDegree, options) {
    const { minor, spice, variant } = options;
    const rootStep = rootDegree - 1;
    const chordSteps = [rootStep, rootStep + 2, rootStep + 4];
    if (variant === 'seventh') {
      chordSteps.push(rootStep + 6);
    } else if (variant === 'open') {
      chordSteps[1] += 7;
    } else if (variant === 'power') {
      chordSteps.length = 0;
      chordSteps.push(rootStep, rootStep + 4, rootStep + 7);
    }
    const pitches = chordSteps.map((stepIndex, index) => {
      let pitch = this.getPitchForScaleStep(stepIndex);
      if (minor && index === 1 && variant !== 'power') {
        pitch -= 1;
      }
      return pitch;
    });
    if (spice) {
      if (this.spiceMode === 'sus2') {
        pitches[1] = this.getPitchForScaleStep(rootStep + 1);
      } else if (this.spiceMode === 'sus4') {
        pitches[1] = this.getPitchForScaleStep(rootStep + 3);
      } else {
        pitches.push(this.getPitchForScaleStep(rootStep + 1) + 12);
      }
    }
    return pitches;
  }

  update() {
    if (!this.enabled) return;
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    if (!pads) return;
    let pad = null;
    if (this.activeIndex !== null && pads[this.activeIndex]?.connected) {
      pad = pads[this.activeIndex];
    } else {
      pad = Array.from(pads).find((candidate) => candidate?.connected) || null;
      this.activeIndex = pad ? pad.index : null;
    }
    this.connected = Boolean(pad);
    if (!pad) return;

    const now = performance.now();
    const axisLX = pad.axes?.[0] ?? 0;
    const axisLY = pad.axes?.[1] ?? 0;
    const axisRX = pad.axes?.[2] ?? 0;
    const axisRY = pad.axes?.[3] ?? 0;
    const ltValue = pad.buttons?.[6]?.value ?? 0;
    const rtValue = pad.buttons?.[7]?.value ?? 0;
    const l3Pressed = pad.buttons?.[10]?.pressed;
    const dpadUp = pad.buttons?.[12]?.pressed;
    const dpadDown = pad.buttons?.[13]?.pressed;

    this.noteMode = ltValue > 0.5;

    if (Math.hypot(axisLX, axisLY) > DEADZONE) {
      const direction = mapDirection(axisLX, axisLY);
      if (this.leftStickCandidate !== direction) {
        this.leftStickCandidate = direction;
        this.leftStickCandidateTime = now;
      } else if (now - this.leftStickCandidateTime >= 50) {
        if (!this.latchRoot) {
          this.leftStickStableDirection = direction;
        }
      }
    } else {
      this.leftStickCandidate = null;
      this.leftStickCandidateTime = 0;
    }

    if (l3Pressed && !this.prevButtons[10]) {
      this.latchRoot = !this.latchRoot;
      if (this.latchRoot) {
        this.latchedDegree = this.leftStickStableDirection;
      }
    }

    if (dpadUp && !this.prevButtons[12]) {
      this.octaveOffset = clamp(this.octaveOffset + 1, -2, 2);
    }
    if (dpadDown && !this.prevButtons[13]) {
      this.octaveOffset = clamp(this.octaveOffset - 1, -2, 2);
    }

    const baseDegree = this.latchRoot ? this.latchedDegree : this.leftStickStableDirection;
    const minor = Boolean(pad.buttons?.[4]?.pressed);
    const spice = Boolean(pad.buttons?.[5]?.pressed);

    const chordButtons = [
      { index: 0, variant: 'triad' },
      { index: 2, variant: 'open' },
      { index: 3, variant: 'seventh' },
      { index: 1, variant: 'power' }
    ];
    const noteButtons = [
      { index: 0, offset: 0 },
      { index: 2, offset: 1 },
      { index: 3, offset: 2 },
      { index: 1, offset: 3 }
    ];

    const buttonConfig = this.noteMode ? noteButtons : chordButtons;
    buttonConfig.forEach((button) => {
      const isPressed = Boolean(pad.buttons?.[button.index]?.pressed);
      const wasPressed = Boolean(this.prevButtons[button.index]);
      if (isPressed && !wasPressed) {
        const velocity = clamp(Math.round(rtValue * 127), 20, 127);
        const pitches = this.noteMode
          ? [this.getPitchForScaleStep(baseDegree - 1 + button.offset)]
          : this.getChordPitches(baseDegree, { minor, spice, variant: button.variant });
        const noteIds = pitches.map((pitch, idx) => {
          const noteId = `pad-${button.index}-${pitch}-${now}-${idx}`;
          this.bus.emit('noteon', {
            id: noteId,
            pitch,
            velocity,
            source: 'gamepad'
          });
          return noteId;
        });
        this.activeButtons.set(button.index, noteIds);
      }
      if (!isPressed && wasPressed) {
        const noteIds = this.activeButtons.get(button.index) || [];
        noteIds.forEach((id) => this.bus.emit('noteoff', { id, source: 'gamepad' }));
        this.activeButtons.delete(button.index);
      }
    });

    const pitchBend = Math.round(((clamp(axisRX, -1, 1) + 1) / 2) * 16383);
    if (Math.abs(pitchBend - this.lastPitchBend) > 80) {
      this.bus.emit('pitchbend', { value: pitchBend, source: 'gamepad' });
      this.lastPitchBend = pitchBend;
    }
    const modValue = Math.round((clamp(-axisRY, -1, 1) + 1) * 63.5);
    if (Math.abs(modValue - this.lastModValue) > 2) {
      const controller = this.modTarget === 'cc74' ? 74 : 1;
      this.bus.emit('cc', { controller, value: modValue, source: 'gamepad' });
      this.lastModValue = modValue;
    }

    this.prevButtons = pad.buttons.map((button) => button.pressed);
  }
}
