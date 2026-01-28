const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const LEFT_STICK_DEADZONE = 0.35;
const STICK_NEUTRAL_DEADZONE = 0.08;
const PITCH_BEND_RANGE_SEMITONES = 2;
const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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

const formatPitchLabel = (pitch) => {
  const normalized = Math.round(pitch ?? 0);
  const label = NOTE_LABELS[((normalized % 12) + 12) % 12];
  const octave = Math.floor(normalized / 12) - 1;
  return `${label}${octave}`;
};

export default class RobterspielInput {
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
    this.noteMode = true;
    this.instrument = 'keyboard';
    this.selectorActive = false;
    this.lastPitchBend = 8192;
    this.lastSustainValue = 0;
    this.lastVolumeValue = 127;
    this.sustainActive = false;
    this.sustainedNotes = new Set();
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
    return this.getPitchForScaleStepWithOffset(stepIndex, this.octaveOffset);
  }

  getPitchForScaleStepWithOffset(stepIndex, octaveOffset = 0) {
    const steps = this.scaleSteps;
    const octave = Math.floor(stepIndex / steps.length);
    const step = steps[((stepIndex % steps.length) + steps.length) % steps.length];
    return (4 + octaveOffset + octave) * 12 + this.key + step;
  }

  getChordPitches(rootDegree, options) {
    return this.getChordPitchesWithOffset(rootDegree, options, this.octaveOffset);
  }

  getChordPitchesWithOffset(rootDegree, options, octaveOffset = 0) {
    const {
      variant = 'triad',
      suspension = null,
      alteredNinth = null
    } = options || {};
    const rootStep = rootDegree - 1;
    const chordSteps = [rootStep, rootStep + 2, rootStep + 4];
    const addsSeventh = [
      'seventh',
      'dominant',
      'minor7',
      'major7',
      'half-diminished',
      'altered-dominant',
      'diminished7',
      'augmented-major7',
      'minor9b5'
    ].includes(variant);
    if (addsSeventh) {
      chordSteps.push(rootStep + 6);
    } else if (variant === 'open') {
      chordSteps[1] += 7;
    } else if (variant === 'power') {
      chordSteps.length = 0;
      chordSteps.push(rootStep, rootStep + 4, rootStep + 7);
    }
    if (variant === 'sixth' || variant === 'minor6') {
      chordSteps.push(rootStep + 5);
    }
    if (variant === 'add9' || variant === 'minor9b5') {
      chordSteps.push(rootStep + 1 + this.scaleSteps.length);
    }
    if (variant === 'altered-dominant') {
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
    const majorThird = rootStep + 2;
    const majorFifth = rootStep + 4;
    const minorSeventh = rootStep + 6;
    const majorSeventh = rootStep + 6;
    const majorSixth = rootStep + 5;
    const alteredNinthStep = rootStep + 1 + this.scaleSteps.length;
    const rootPitch = this.getPitchForScaleStepWithOffset(rootStep, octaveOffset);
    return chordSteps.map((stepIndex) => {
      let pitch = this.getPitchForScaleStepWithOffset(stepIndex, octaveOffset);
      const interval = pitch - rootPitch;
      if (variant === 'diminished') {
        if (stepIndex === diminishedThird || stepIndex === diminishedFifth) {
          pitch -= 1;
        }
      }
      if (variant === 'augmented' && stepIndex === majorFifth) {
        pitch += 1;
      }
      if (variant === 'dominant' && stepIndex === dominantSeventh) {
        pitch -= 1;
      }
      if (variant === 'minor' || variant === 'minor7' || variant === 'minor6' || variant === 'minor9b5') {
        if (stepIndex === majorThird && interval === 4) {
          pitch -= 1;
        }
        if (stepIndex === majorFifth && interval === 6 && variant !== 'minor9b5') {
          pitch += 1;
        }
        if ((variant === 'minor7' || variant === 'minor9b5') && stepIndex === minorSeventh && interval === 11) {
          pitch -= 1;
        }
        if (variant === 'minor9b5' && stepIndex === majorFifth && interval === 7) {
          pitch -= 1;
        }
      }
      if (variant === 'major7' || variant === 'sixth' || variant === 'altered-dominant' || variant === 'augmented-major7') {
        if (stepIndex === majorThird && interval === 3) {
          pitch += 1;
        }
        if (stepIndex === majorFifth && interval === 6) {
          pitch += 1;
        }
        if (stepIndex === majorFifth && interval === 8 && variant !== 'augmented-major7') {
          pitch -= 1;
        }
      }
      if ((variant === 'major7' || variant === 'augmented-major7') && stepIndex === majorSeventh && interval === 10) {
        pitch += 1;
      }
      if ((variant === 'sixth' || variant === 'minor6') && stepIndex === majorSixth && interval === 8) {
        pitch += 1;
      }
      if (variant === 'half-diminished') {
        if (stepIndex === diminishedThird && interval === 4) {
          pitch -= 1;
        }
        if (stepIndex === diminishedFifth) {
          pitch -= 1;
        }
        if (stepIndex === minorSeventh && interval === 11) {
          pitch -= 1;
        }
      }
      if (variant === 'diminished7') {
        if (stepIndex === diminishedThird && interval === 4) {
          pitch -= 1;
        }
        if (stepIndex === diminishedFifth) {
          pitch -= 1;
        }
        if (stepIndex === minorSeventh && interval >= 10) {
          pitch -= interval - 9;
        }
      }
      if (variant === 'augmented-major7') {
        if (stepIndex === majorFifth && interval === 7) {
          pitch += 1;
        }
      }
      if (variant === 'altered-dominant') {
        if (stepIndex === dominantSeventh && interval === 11) {
          pitch -= 1;
        }
        if (stepIndex === alteredNinthStep) {
          if (alteredNinth === 'sharp') {
            pitch += 1;
          } else if (alteredNinth === 'flat') {
            pitch -= 1;
          }
        }
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
    const volumeValue = clamp(Math.round((1 - rtValue) * 127), 0, 127);
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

    if (!this.selectorActive) {
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
      const sustainOn = sustainValue >= 64;
      if (sustainOn !== this.sustainActive) {
        this.sustainActive = sustainOn;
        if (!sustainOn && this.sustainedNotes.size) {
          Array.from(this.sustainedNotes).forEach((id) => {
            this.bus.emit('noteoff', { id, source: 'gamepad' });
          });
          this.sustainedNotes.clear();
        }
      }
      if (Math.abs(sustainValue - this.lastSustainValue) > 2) {
        this.bus.emit('cc', { controller: 64, value: sustainValue, source: 'gamepad' });
        this.lastSustainValue = sustainValue;
      }
    }

    if (Math.abs(volumeValue - this.lastVolumeValue) > 1) {
      this.bus.emit('cc', { controller: 7, value: volumeValue, source: 'gamepad' });
      this.lastVolumeValue = volumeValue;
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
          const velocity = clamp(volumeValue, 1, 127);
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
      const liveDirection = Math.hypot(axisLX, axisLY) > LEFT_STICK_DEADZONE
        ? mapDirection(axisLX, axisLY)
        : this.leftStickStableDirection;
      const rootDegree = liveDirection;
      const isChordMode = !this.noteMode;
      const applyInversion = (pitches, inversion) => {
        if (!inversion) return pitches;
        const sorted = [...pitches].sort((a, b) => a - b);
        for (let i = 0; i < inversion; i += 1) {
          const shifted = sorted.shift();
          sorted.push(shifted + 12);
          sorted.sort((a, b) => a - b);
        }
        return sorted;
      };
      const degreeButtons = [
        { index: 0, base: 1, passing: 2 },
        { index: 2, base: 3, passing: 4 },
        { index: 3, base: 5, passing: 6 },
        { index: 1, base: 8, passing: 7 }
      ];
      degreeButtons.forEach((button) => {
        const isPressed = Boolean(currentButtons[button.index]);
        const wasPressed = Boolean(this.prevButtons[button.index]);
        if (isPressed && !wasPressed) {
          if (this.sustainActive && this.sustainedNotes.size) {
            Array.from(this.sustainedNotes).forEach((id) => {
              this.bus.emit('noteoff', { id, source: 'gamepad' });
            });
            this.sustainedNotes.clear();
          }
          let pitches = [];
          const velocity = clamp(volumeValue, 1, 127);
          let displayLabel = '';
          let displayDetail = '';
          let displayType = isChordMode ? 'chord' : 'note';
          let displayRootPitch = null;
          let chordSuffix = '';
          if (!isChordMode) {
            const degree = lbPressed ? button.passing : button.base;
            const degreeOffset = degree - 1;
            const targetDegree = rootDegree + degreeOffset;
            let pitch = this.getPitchForScaleStep(targetDegree - 1);
            if (dpadLeft) {
              pitch += 1;
            }
            pitches = [pitch];
            displayLabel = formatPitchLabel(pitch);
            displayDetail = `Degree ${targetDegree}`;
          } else {
            let variant = 'triad';
            let suspension = null;
            let inversion = 0;
            const targetDegree = rootDegree;
            let alteredNinth = null;
            const harmonyModifierCount = Number(lbPressed) + Number(dpadLeft);
            const harmonyModifier = harmonyModifierCount === 1
              ? (lbPressed ? 'lb' : 'dpad-left')
              : harmonyModifierCount === 2
                ? 'lb-dpad-left'
                : null;
            if (harmonyModifier === 'lb') {
              if (button.index === 0) {
                suspension = 'sus2';
              } else if (button.index === 2) {
                suspension = 'sus4';
              } else if (button.index === 3) {
                variant = 'seventh';
              } else if (button.index === 1) {
                variant = 'add9';
              }
            } else if (harmonyModifier === 'dpad-left') {
              if (button.index === 0) {
                variant = 'diminished';
              } else if (button.index === 2) {
                variant = 'half-diminished';
              } else if (button.index === 3) {
                variant = 'augmented';
              } else if (button.index === 1) {
                variant = 'altered-dominant';
                const rootStep = targetDegree - 1;
                const rootPitch = this.getPitchForScaleStep(rootStep);
                const secondPitch = this.getPitchForScaleStep(rootStep + 1);
                const secondInterval = secondPitch - rootPitch;
                alteredNinth = secondInterval <= 1 ? 'sharp' : 'flat';
              }
            } else if (harmonyModifier === 'lb-dpad-left') {
              if (button.index === 0) {
                variant = 'minor6';
              } else if (button.index === 2) {
                variant = 'diminished7';
              } else if (button.index === 3) {
                variant = 'augmented-major7';
              } else if (button.index === 1) {
                variant = 'minor9b5';
              }
            } else if (harmonyModifierCount === 0) {
              if (button.index === 2) {
                inversion = 1;
              } else if (button.index === 3) {
                inversion = 2;
              } else if (button.index === 1) {
                variant = 'power';
              }
            }
            pitches = this.getChordPitches(targetDegree, { variant, suspension, alteredNinth });
            pitches = applyInversion(pitches, inversion);
            displayRootPitch = this.getPitchForScaleStep(targetDegree - 1);
            const rootLabel = formatPitchLabel(displayRootPitch);
            const suffixParts = [];
            if (variant === 'diminished') {
              suffixParts.push('dim');
            } else if (variant === 'half-diminished') {
              suffixParts.push('m7♭5');
            } else if (variant === 'augmented') {
              suffixParts.push('aug');
            } else if (variant === 'diminished7') {
              suffixParts.push('dim7');
            } else if (variant === 'augmented-major7') {
              suffixParts.push('aug maj7');
            } else if (variant === 'minor9b5') {
              suffixParts.push('m9♭5');
            } else if (variant === 'altered-dominant') {
              suffixParts.push(alteredNinth === 'sharp' ? '7♯9' : '7♭9');
            } else if (variant === 'seventh') {
              suffixParts.push('7');
            } else if (variant === 'minor') {
              suffixParts.push('m');
            } else if (variant === 'minor7') {
              suffixParts.push('m7');
            } else if (variant === 'major7') {
              suffixParts.push('maj7');
            } else if (variant === 'sixth') {
              suffixParts.push('6');
            } else if (variant === 'minor6') {
              suffixParts.push('m6');
            } else if (variant === 'power') {
              suffixParts.push('5');
            } else if (variant === 'open') {
              suffixParts.push('open');
            } else if (variant === 'add9') {
              suffixParts.push('add9');
            }
            if (suspension) {
              suffixParts.push(suspension);
            }
            chordSuffix = suffixParts.length ? ` ${suffixParts.join(' ')}` : '';
            displayLabel = `${rootLabel}${chordSuffix}`;
            displayDetail = pitches.map((pitch) => formatPitchLabel(pitch)).join(' ');
          }
          if (rbPressed) {
            pitches = pitches.map((pitch) => pitch + 12);
            if (displayType === 'note') {
              displayLabel = formatPitchLabel(pitches[0]);
            } else if (displayRootPitch !== null) {
              displayRootPitch += 12;
              const rootLabel = formatPitchLabel(displayRootPitch);
              displayLabel = `${rootLabel}${chordSuffix}`;
              displayDetail = pitches.map((pitch) => formatPitchLabel(pitch)).join(' ');
            }
          }
          const noteIds = pitches.map((pitch, idx) => {
            const noteId = `pad-${button.index}-${pitch}-${now}-${idx}`;
            this.bus.emit('noteon', {
              id: noteId,
              pitch,
              previewPitch: pitch,
              velocity,
              source: 'gamepad',
              displayLabel,
              displayDetail,
              displayType,
              displayRootPitch
            });
            return noteId;
          });
          this.activeButtons.set(button.index, noteIds);
        }
        if (!isPressed && wasPressed) {
          const noteIds = this.activeButtons.get(button.index) || [];
          if (this.sustainActive) {
            noteIds.forEach((id) => this.sustainedNotes.add(id));
          } else {
            noteIds.forEach((id) => this.bus.emit('noteoff', { id, source: 'gamepad' }));
          }
          this.activeButtons.delete(button.index);
        }
      });
    }

    if (!this.selectorActive) {
      const pitchBend = Math.round(((clamp(bendNormalized, -1, 1) + 1) / 2) * 16383);
      if (Math.abs(pitchBend - this.lastPitchBend) > 24) {
        this.bus.emit('pitchbend', { value: pitchBend, source: 'gamepad' });
        this.lastPitchBend = pitchBend;
      }
    }

    this.prevButtons = currentButtons;
  }
}
