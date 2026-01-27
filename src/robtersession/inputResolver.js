import { DRUM_LANES, ROOT_LABELS } from './constants.js';

const BUTTON_DEGREES = {
  A: { base: 1, passing: 2 },
  X: { base: 3, passing: 4 },
  Y: { base: 5, passing: 6 },
  B: { base: 8, passing: 7 }
};

const DRUM_PITCHES = [36, 38, 42, 49];

export const formatPitchLabel = (pitch) => {
  const normalized = Math.round(pitch ?? 0);
  const label = ROOT_LABELS[((normalized % 12) + 12) % 12];
  const octave = Math.floor(normalized / 12) - 1;
  return `${label}${octave}`;
};

const applyInversion = (pitches, inversion) => {
  if (!inversion) return pitches;
  const sorted = [...pitches].sort((a, b) => a - b);
  for (let i = 0; i < inversion; i += 1) {
    const shifted = sorted.shift();
    sorted.push((shifted ?? 0) + 12);
    sorted.sort((a, b) => a - b);
  }
  return sorted;
};

const resolveChordSettings = (chordType) => {
  let variant = 'triad';
  let suspension = null;
  let inversion = 0;
  if (chordType === 'power') {
    variant = 'power';
  } else if (chordType === 'triad-inv1') {
    inversion = 1;
  } else if (chordType === 'triad-inv2') {
    inversion = 2;
  } else if (chordType === 'sus2') {
    suspension = 'sus2';
  } else if (chordType === 'sus4') {
    suspension = 'sus4';
  } else if (chordType === 'seventh') {
    variant = 'seventh';
  } else if (chordType === 'add9') {
    variant = 'add9';
  } else if (chordType === 'dim') {
    variant = 'diminished';
  } else if (chordType === 'half-dim') {
    variant = 'half-diminished';
  } else if (chordType === 'aug') {
    variant = 'augmented';
  } else if (chordType === 'altered-dom') {
    variant = 'altered-dominant';
  } else if (chordType === 'minor6') {
    variant = 'minor6';
  } else if (chordType === 'dim7') {
    variant = 'diminished7';
  } else if (chordType === 'augMaj7') {
    variant = 'augmented-major7';
  } else if (chordType === 'minor9b5') {
    variant = 'minor9b5';
  }
  return { variant, suspension, inversion };
};

const getChordSuffix = ({ variant, suspension }) => {
  if (variant === 'power') return '5';
  if (variant === 'diminished') return 'dim';
  if (variant === 'half-diminished') return 'm7♭5';
  if (variant === 'augmented') return 'aug';
  if (variant === 'diminished7') return 'dim7';
  if (variant === 'augmented-major7') return 'aug maj7';
  if (variant === 'minor9b5') return 'm9♭5';
  if (variant === 'altered-dominant') return '7alt';
  if (variant === 'seventh') return '7';
  if (variant === 'add9') return 'add9';
  if (variant === 'minor6') return 'm6';
  if (suspension) return suspension;
  return '';
};

const resolveNotePitch = (robterspiel, rootDegree, { button, lb, dleft, octaveUp }) => {
  const entry = BUTTON_DEGREES[button] || BUTTON_DEGREES.A;
  const degree = lb ? entry.passing : entry.base;
  const targetDegree = (rootDegree || 1) + degree - 1;
  let pitch = robterspiel.getPitchForScaleStep(targetDegree - 1);
  if (dleft) {
    pitch += 1;
  }
  if (octaveUp) {
    pitch += 12;
  }
  return pitch;
};

const resolveChordPitches = (robterspiel, degree, chordType) => {
  const { variant, suspension, inversion } = resolveChordSettings(chordType);
  let pitches = robterspiel.getChordPitches(degree || 1, { variant, suspension });
  pitches = applyInversion(pitches, inversion);
  return { pitches, variant, suspension, inversion };
};

const resolveChordLabel = (robterspiel, degree, chordType) => {
  const { pitches, variant, suspension } = resolveChordPitches(robterspiel, degree, chordType);
  const rootPitch = pitches[0] ?? robterspiel.getPitchForScaleStep((degree || 1) - 1);
  const rootLabel = formatPitchLabel(rootPitch);
  const suffix = getChordSuffix({ variant, suspension });
  return suffix ? `${rootLabel} ${suffix}` : rootLabel;
};

export const resolveRequiredInputToMusicalAction = ({ robterspiel, instrument }, requiredInput) => {
  if (!requiredInput) return null;
  if (instrument === 'drums' || requiredInput.mode === 'drum') {
    const lane = requiredInput.lane ?? 0;
    return {
      kind: 'drum',
      pitches: [DRUM_PITCHES[lane] ?? 38],
      label: DRUM_LANES[lane] || 'Drum',
      debug: { lane }
    };
  }

  if (requiredInput.mode === 'note') {
    const pitch = resolveNotePitch(robterspiel, requiredInput.degree || 1, {
      button: requiredInput.button,
      lb: requiredInput.modifiers?.lb,
      dleft: requiredInput.modifiers?.dleft,
      octaveUp: requiredInput.octaveUp
    });
    return {
      kind: 'note',
      pitches: [pitch],
      label: formatPitchLabel(pitch),
      debug: {
        degree: requiredInput.degree || 1,
        button: requiredInput.button,
        modifiers: {
          lb: requiredInput.modifiers?.lb,
          dleft: requiredInput.modifiers?.dleft,
          rb: requiredInput.octaveUp
        }
      }
    };
  }

  const chordType = requiredInput.chordType || 'triad';
  const label = resolveChordLabel(robterspiel, requiredInput.degree || 1, chordType);
  const { pitches } = resolveChordPitches(robterspiel, requiredInput.degree || 1, chordType);
  return {
    kind: 'chord',
    pitches,
    label,
    debug: {
      degree: requiredInput.degree || 1,
      chordType
    }
  };
};

export const resolveInputToMusicalAction = ({ robterspiel, instrument, mode, degree, stickDir }, inputEvent) => {
  if (!inputEvent?.button) return null;
  if (instrument === 'drums') {
    const laneMap = { A: 0, X: 1, Y: 2, B: 3 };
    const lane = laneMap[inputEvent.button] ?? 0;
    return {
      kind: 'drum',
      pitches: [DRUM_PITCHES[lane] ?? 38],
      label: DRUM_LANES[lane] || 'Drum',
      debug: {
        lane,
        buttonsPressed: inputEvent.buttonsPressed || [inputEvent.button]
      }
    };
  }

  if (mode === 'note') {
    const pitch = resolveNotePitch(robterspiel, degree || 1, inputEvent);
    return {
      kind: 'note',
      pitches: [pitch],
      label: formatPitchLabel(pitch),
      debug: {
        degree: degree || 1,
        stickDir,
        modifiers: {
          lb: inputEvent.lb,
          dleft: inputEvent.dleft,
          rb: inputEvent.octaveUp
        },
        buttonsPressed: inputEvent.buttonsPressed || [inputEvent.button]
      }
    };
  }

  const chordType = inputEvent.chordType || 'triad';
  const label = resolveChordLabel(robterspiel, degree || 1, chordType);
  const { pitches } = resolveChordPitches(robterspiel, degree || 1, chordType);
  return {
    kind: 'chord',
    pitches,
    label,
    debug: {
      degree: degree || 1,
      stickDir,
      modifiers: {
        lb: inputEvent.lb,
        dleft: inputEvent.dleft,
        rb: inputEvent.octaveUp
      },
      buttonsPressed: inputEvent.buttonsPressed || [inputEvent.button]
    }
  };
};

export const describeInputDebug = ({ debug, button } = {}) => {
  if (!debug) return '';
  const stick = debug.stickDir || debug.degree;
  const mods = [];
  if (debug.modifiers?.lb) mods.push('LB');
  if (debug.modifiers?.dleft) mods.push('D-Left');
  if (debug.modifiers?.rb) mods.push('RB');
  const buttons = debug.buttonsPressed?.length ? debug.buttonsPressed.join('+') : button;
  const modifiers = mods.length ? mods.join('+') : 'None';
  return `LStick=${stick} Modifiers=${modifiers} Button=${buttons}`;
};
