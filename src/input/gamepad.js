const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const LEFT_STICK_DEADZONE = 0.35;
const STICK_NEUTRAL_DEADZONE = 0.08;
const PITCH_BEND_RANGE_SEMITONES = 2;

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
    this.octaveOffset = 0;
    this.scaleSteps = [0, 2, 4, 5, 7, 9, 11];
    this.key = 0;
    this.noteMode = false;
    this.instrument = 'keyboard';
    this.selectorActive = false;
    this.lastPitchBend = 8192;
    this.lastSustainValue = 0;
    this.rightStick = { x: 0, y: 0 };
    this.leftStick = { x: 0, y: 0 };
    this.pitchBendSemitones = 0;
    this.activeButtons = new Map();
    this.buttonPressed = new Set();
    this.buttonReleased = new Set();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  setScale({ key, steps }) {
    this.key = typeof key === 'number' ? key : 0;
    this.scaleSteps = Array.isArray(steps) && steps.length ? steps : this.scaleSteps;
  }

  setInstrument(instrument) {
    this.instrument = instrument || 'keyboard';
  }

  setSelectorActive(active) {
    this.selectorActive = Boolean(active);
  }

  wasButtonPressed(index) {
    return this.buttonPressed.has(index);
  }

  getLeftStick() {
    return { ...this.leftStick };
  }

  getRightStick() {
    return { ...this.rightStick };
  }

  getPitchBendSemitones() {
    return this.pitchBendSemitones;
  }

  getPitchForScaleStep(stepIndex) {
    const steps = this.scaleSteps;
    const octave = Math.floor(stepIndex / steps.length);
    const step = steps[((stepIndex % steps.length) + steps.length) % steps.length];
    return (4 + this.octaveOffset + octave) * 12 + this.key + step;
  }

  getChordPitches(rootDegree, options) {
    const {
      variant = 'triad',
      suspension = null
    } = options || {};
    const rootStep = rootDegree - 1;
    const chordSteps = [rootStep, rootStep + 2, rootStep + 4];
    if (variant === 'seventh' || variant === 'dominant' || variant === 'ninth') {
      chordSteps.push(rootStep + 6);
    } else if (variant === 'open') {
      chordSteps[1] += 7;
    } else if (variant === 'power') {
      chordSteps.length = 0;
      chordSteps.push(rootStep, rootStep + 4, rootStep + 7);
    }
    if (variant === 'ninth') {
      chordSteps.push(rootStep + 1 + this.scaleSteps.length);
    }
    if (suspension === 'sus2') {
      chordSteps[1] = rootStep + 1;
    } else if (suspension === 'sus4') {
      chordSteps[1] = rootStep + 3;
    }
    const diminishedThird = rootStep + 2;
    const diminishedFifth = rootStep + 4;
    const dominantSeventh = rootStep + 6;
    return chordSteps.map((stepIndex) => {
      let pitch = this.getPitchForScaleStep(stepIndex);
      if (variant === 'diminished') {
        if (stepIndex === diminishedThird || stepIndex === diminishedFifth) {
          pitch -= 1;
        }
      }
      if ((variant === 'dominant' || variant === 'ninth') && stepIndex === dominantSeventh) {
        pitch -= 1;
      }
      return pitch;
    });
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
    const currentButtons = pad.buttons.map((button) => Boolean(button.pressed || button.value > 0.5));
    const dpadUp = currentButtons[12];
    const dpadDown = currentButtons[13];
    const dpadLeft = currentButtons[14];
    const dpadRight = currentButtons[15];
    const lbPressed = currentButtons[4];
    const rbPressed = currentButtons[5];
    const isDrum = this.instrument === 'drums';

    this.leftStick = { x: axisLX, y: axisLY };
    this.rightStick = { x: axisRX, y: axisRY };
    const bendNormalized = Math.abs(axisRY) < STICK_NEUTRAL_DEADZONE ? 0 : clamp(-axisRY, -1, 1);
    this.pitchBendSemitones = bendNormalized * PITCH_BEND_RANGE_SEMITONES;

    if (Math.hypot(axisLX, axisLY) > LEFT_STICK_DEADZONE) {
      const direction = mapDirection(axisLX, axisLY);
      if (this.leftStickCandidate !== direction) {
        this.leftStickCandidate = direction;
        this.leftStickCandidateTime = now;
      } else if (now - this.leftStickCandidateTime >= 50) {
        this.leftStickStableDirection = direction;
      }
    } else {
      this.leftStickCandidate = null;
      this.leftStickCandidateTime = 0;
    }

    if (!isDrum) {
      if (dpadRight && !this.prevButtons[15]) {
        this.noteMode = !this.noteMode;
      }
      if (dpadUp && !this.prevButtons[12]) {
        this.octaveOffset = clamp(this.octaveOffset + 1, -2, 2);
      }
      if (dpadDown && !this.prevButtons[13]) {
        this.octaveOffset = clamp(this.octaveOffset - 1, -2, 2);
      }
      const sustainValue = clamp(Math.round(ltValue * 127), 0, 127);
      if (Math.abs(sustainValue - this.lastSustainValue) > 2) {
        this.bus.emit('cc', { controller: 64, value: sustainValue, source: 'gamepad' });
        this.lastSustainValue = sustainValue;
      }
    }

    this.buttonPressed.clear();
    this.buttonReleased.clear();
    currentButtons.forEach((pressed, index) => {
      const wasPressed = Boolean(this.prevButtons[index]);
      if (pressed && !wasPressed) {
        this.buttonPressed.add(index);
      }
      if (!pressed && wasPressed) {
        this.buttonReleased.add(index);
      }
    });

    if (isDrum) {
      const drumButtons = [
        { index: 6, pitch: 36 },
        { index: 5, pitch: 42 },
        { index: 7, pitch: 46 },
        { index: 0, pitch: 38 },
        { index: 2, pitch: 45 },
        { index: 3, pitch: 48 },
        { index: 1, pitch: 50 },
        { index: 12, pitch: 49 },
        { index: 13, pitch: 51 },
        { index: 14, pitch: 57 },
        { index: 15, pitch: 59 }
      ];
      drumButtons.forEach((button) => {
        const isPressed = Boolean(currentButtons[button.index]);
        const wasPressed = Boolean(this.prevButtons[button.index]);
        if (isPressed && !wasPressed) {
          const velocity = 110;
          const noteId = `pad-drum-${button.index}-${button.pitch}-${now}`;
          this.bus.emit('noteon', {
            id: noteId,
            pitch: button.pitch,
            velocity,
            instrument: 'drums',
            source: 'gamepad'
          });
          this.activeButtons.set(button.index, [noteId]);
        }
        if (!isPressed && wasPressed) {
          const noteIds = this.activeButtons.get(button.index) || [];
          noteIds.forEach((id) => this.bus.emit('noteoff', { id, source: 'gamepad' }));
          this.activeButtons.delete(button.index);
        }
      });
    } else {
      const rootDegree = this.leftStickStableDirection;
      const accidentalShift = dpadLeft ? 1 : 0;
      const degreeButtons = [
        { index: 0, base: 1, alt: 2 },
        { index: 2, base: 3, alt: 4 },
        { index: 3, base: 5, alt: 6 },
        { index: 1, base: 8, alt: 7 }
      ];
      degreeButtons.forEach((button) => {
        const isPressed = Boolean(currentButtons[button.index]);
        const wasPressed = Boolean(this.prevButtons[button.index]);
        if (isPressed && !wasPressed) {
          const degree = lbPressed ? button.alt : button.base;
          const degreeOffset = degree - 1;
          const targetDegree = rootDegree + degreeOffset;
          const velocity = clamp(Math.round((1 - rtValue) * 127), 1, 127);
          let pitches = [];
          if (this.noteMode) {
            pitches = [this.getPitchForScaleStep(targetDegree - 1)];
          } else {
            let variant = 'triad';
            let suspension = null;
            if (rbPressed && lbPressed) {
              variant = 'diminished';
            } else if (rbPressed) {
              if (button.index === 0) {
                suspension = 'sus2';
              } else if (button.index === 2) {
                suspension = 'sus4';
              } else if (button.index === 3) {
                variant = 'dominant';
              } else if (button.index === 1) {
                variant = 'ninth';
              }
            }
            pitches = this.getChordPitches(targetDegree, { variant, suspension });
          }
          if (accidentalShift) {
            pitches = pitches.map((pitch) => pitch + accidentalShift);
          }
          const noteIds = pitches.map((pitch, idx) => {
            const noteId = `pad-${button.index}-${pitch}-${now}-${idx}`;
            this.bus.emit('noteon', {
              id: noteId,
              pitch,
              previewPitch: pitch + this.pitchBendSemitones,
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
    }

    if (!this.selectorActive) {
      const pitchBend = Math.round(((clamp(bendNormalized, -1, 1) + 1) / 2) * 16383);
      if (Math.abs(pitchBend - this.lastPitchBend) > 80) {
        this.bus.emit('pitchbend', { value: pitchBend, source: 'gamepad' });
        this.lastPitchBend = pitchBend;
      }
    }

    this.prevButtons = currentButtons;
  }
}
