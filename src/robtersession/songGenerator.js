import { DIFFICULTY_WINDOWS, INSTRUMENTS, MODE_LIBRARY, ROOT_LABELS } from './constants.js';
import { hashString, mulberry32, pickRandom, rangeRandom } from './rng.js';

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_MODE = MODE_LIBRARY.find((mode) => mode.name === 'Ionian') || MODE_LIBRARY[0];
const MINOR_MODE = MODE_LIBRARY.find((mode) => mode.name === 'Aeolian') || MODE_LIBRARY[0];

const NOTE_TO_PC = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11
};

const PC_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const DURATION_TOKENS = { w: 4, h: 2, q: 1, e: 0.5 };
const DEFAULT_PATTERN_LIBRARY = {
  patterns_version: 1,
  duration_tokens: DURATION_TOKENS,
  basslines: [
    { id: 'BL_ROOT_8', tokens: ['1e', '1e', '1e', '1e', '1e', '1e', '1e', '1e'] },
    { id: 'BL_ROOT_Q', tokens: ['1q', '1q', '1q', '1q'] },
    { id: 'BL_ROOT_HH', tokens: ['1h', '1h'] },
    { id: 'BL_ROOT_W', tokens: ['1w'] },
    { id: 'BL_ROOT_16_LAST', tokens: ['1e', '1e', '1e', '1e', '1e', '1e', '1e', '7e'] },
    { id: 'BL_R5_Q', tokens: ['1q', '5q', '1q', '5q'] },
    { id: 'BL_R8_Q', tokens: ['1q', '8q', '1q', '8q'] },
    { id: 'BL_R58_8', tokens: ['1e', '1e', '5e', '5e', '8e', '8e', '5e', '5e'] },
    { id: 'BL_R5_8_LASTQ', tokens: ['1e', '1e', '1e', '1e', '1e', '1e', '5q'] },
    { id: 'BL_R58_ALT', tokens: ['1e', '5e', '1e', '5e', '1e', '5e', '8e', '5e'] },
    { id: 'BL_R235_8', tokens: ['1e', '2e', '3e', '5e', '6e', '5e', '3e', '2e'] },
    { id: 'BL_R24578_8', tokens: ['1e', '2e', '4e', '5e', '7e', '8e', '7e', '5e'] },
    { id: 'BL_R75311', tokens: ['1e', '7e', '5e', '3e', '1e', '1e', '3e', '1e'] },
    { id: 'BL_OCT_DROP', tokens: ['8e', '5e', '1e', '1e', '1e', '1e', '1e', '1e'] },
    { id: 'BL_FILL_END', tokens: ['1e', '1e', '1e', '1e', '5e', '6e', '7e', '8e'] },
    { id: 'BL_FILL_DOWN', tokens: ['8e', '7e', '6e', '5e', '4e', '3e', '2e', '1e'] },
    { id: 'BL_FILL_PUSH', tokens: ['1q', '1e', '1e', '5q', '6e', '6e'] },
    { id: 'BL_FILL_HOOK', tokens: ['1e', '1e', '5e', '8e', '1e', '1e', '5e', '8e'] }
  ],
  arpeggios: [
    { id: 'ARP_135_8', tokens: ['1e', '3e', '5e', '3e', '1e', '3e', '5e', '3e'] },
    { id: 'ARP_153_8', tokens: ['1e', '5e', '3e', '5e', '1e', '5e', '3e', '5e'] },
    { id: 'ARP_1358', tokens: ['1e', '3e', '5e', '8e', '5e', '3e', '1e', '3e'] },
    { id: 'ARP_1515', tokens: ['1e', '5e', '1e', '5e', '1e', '5e', '1e', '5e'] },
    { id: 'ARP_PEDAL_R', tokens: ['1e', '1e', '5e', '1e', '3e', '1e', '5e', '1e'] },
    { id: 'ARP_PEDAL_3', tokens: ['3e', '1e', '5e', '1e', '3e', '1e', '5e', '1e'] },
    { id: 'ARP_ADD9', tokens: ['1e', '3e', '5e', '9e', '5e', '3e', '9e', '5e'] },
    { id: 'ARP_DOM7', tokens: ['1e', '3e', '5e', '7e', '5e', '3e', '7e', '5e'] },
    { id: 'ARP_SUS2', tokens: ['1e', '2e', '5e', '2e', '1e', '2e', '5e', '2e'] },
    { id: 'ARP_SUS4', tokens: ['1e', '4e', '5e', '4e', '1e', '4e', '5e', '4e'] },
    { id: 'ARP_M7', tokens: ['1e', '3e', '5e', '7e', '8e', '7e', '5e', '3e'] },
    { id: 'ARP_SYNC_A', tokens: ['1q', '3e', '5e', '3q', '5e', '3e'] },
    { id: 'ARP_SYNC_B', tokens: ['1e', '3e', '5q', '3e', '5e', '3q'] },
    { id: 'ARP_SWELL', tokens: ['1h', '3e', '5e', '7e', '5e'] }
  ]
};
const DURATION_TEMPLATES = [
  ['w'],
  ['h', 'h'],
  ['q', 'q', 'h'],
  ['q', 'h', 'q'],
  ['q', 'q', 'q', 'q'],
  ['q', 'e', 'e', 'q', 'q'],
  ['e', 'e', 'e', 'e', 'e', 'e', 'e', 'e']
];

const SECTION_LETTERS = {
  I: 'intro',
  V: 'verse',
  P: 'prechorus',
  C: 'chorus',
  B: 'bridge',
  S: 'solo',
  O: 'outro'
};

const ARRANGEMENT_PRESETS = [
  'bass_roots_gtr_chords_pno_arps',
  'bass_roots_gtr_arps_pno_chords',
  'bass_arps_gtr_roots_pno_chords',
  'bass_roots_gtr_chords_pno_chords_split'
];

const DEFAULT_SOUND_PROGRAMS = {
  guitar: 27,
  bass: 33,
  piano: 0,
  drums: 0
};

const STRUCTURE_PATTERNS = {
  beginner: [
    'IVVCCVVCCO',
    'IVVCCVVCCCO',
    'IVVCCVVCCO',
    'IVVCCVVCcO',
    'IVVCCVVCCSO'
  ],
  easy: [
    'IVVCCVVCCBCCO',
    'IVVCCVVCCbCCO',
    'IVVCCVVCCO',
    'IVVPCVVCCBSO',
    'IVVCCVVCCSCO'
  ],
  mid: [
    'IVVPCCVVPCcBCCO',
    'IVVPCcVVPCcBCCO',
    'IVVCCVVCCBCCO',
    'IVVPCcVVCCBSCCO',
    'IVVCCVVPCcBSCO'
  ],
  hard: [
    'IVVPCcVVPCcBSCCO',
    'IVVCCVVCCBSCCO',
    'IVVPCcVVPCcBSCCO',
    'IVVPCcVVCCBSCCSO',
    'IVVPCcVVPCcBSCCOO'
  ],
  expert: [
    'IVVPCCVVPCcBSCCO',
    'IVVPCCVVPCcBSCCO',
    'IVVPCCVVPCcBSCCO',
    'IVVPCCVVPCcBSCCSO',
    'IVVPCCVVPCcBSCCOOB'
  ]
};

const STYLE_PRESETS = {
  punk: {
    tempo: [120, 150],
    tags: ['punk', 'garage']
  },
  indie: {
    tempo: [96, 120],
    tags: ['indie', 'rock']
  },
  alt: {
    tempo: [100, 132],
    tags: ['alt-rock']
  },
  rock: {
    tempo: [100, 130],
    tags: ['rock']
  },
  anthem: {
    tempo: [90, 118],
    tags: ['anthem-rock']
  }
};

const PROGRESSION_POOLS = {
  beginner: [
    { degrees: [1, 5, 4, 5], tags: ['punk', 'rock'], weight: 1.2 },
    { degrees: [1, 4, 5, 1], tags: ['anthem'], weight: 1.1 },
    { degrees: [1, 4, 1, 5], tags: ['indie'], weight: 1.0 },
    { degrees: [1, 5, 6, 4], tags: ['alt', 'rock'], weight: 1.0 },
    { degrees: [1, 4, 5, 'b7'], tags: ['alt'], weight: 0.9 },
    { degrees: [1, 5, 4, 1, 1, 5, 4, 5], tags: ['anthem'], weight: 0.8 }
  ],
  easy: [
    { degrees: [1, 5, 6, 4], tags: ['anthem', 'rock'], weight: 1.2 },
    { degrees: [1, 6, 4, 5], tags: ['punk'], weight: 1.0 },
    { degrees: [1, 4, 6, 5], tags: ['indie'], weight: 1.0 },
    { degrees: [1, 'b7', 4, 1], tags: ['alt'], weight: 0.9 },
    { degrees: [1, 5, 4, 5, 1, 6, 4, 5], tags: ['anthem'], weight: 0.9 },
    { degrees: [1, 5, 6, 'b7', 4, 1, 5, 4], tags: ['alt', 'rock'], weight: 0.8 }
  ],
  mid: [
    { degrees: [1, 5, 6, 4], tags: ['rock'], weight: 1.0 },
    { degrees: [1, 4, 2, 5], tags: ['anthem'], weight: 1.0 },
    { degrees: [6, 4, 1, 5], tags: ['punk'], weight: 1.0 },
    { degrees: [1, 'b7', 4, 1], tags: ['alt'], weight: 0.9 },
    { degrees: [1, 5, 4, 'b6'], tags: ['alt', 'indie'], weight: 0.8 },
    { degrees: [1, 5, 6, 4, 2, 5, 1, 5], tags: ['anthem'], weight: 0.9 },
    { degrees: [6, 4, 1, 5, 6, 'b7', 4, 1], tags: ['alt'], weight: 0.8 }
  ],
  hard: [
    { degrees: [1, 4, 2, 5], tags: ['rock'], weight: 1.0 },
    { degrees: [6, 4, 1, 5], tags: ['punk'], weight: 1.0 },
    { degrees: [1, 5, 6, 4], tags: ['anthem'], weight: 1.0 },
    { degrees: [1, 'b7', 'b6', 4], tags: ['alt'], weight: 0.9 },
    { degrees: [1, 5, 4, 'b7'], tags: ['alt', 'indie'], weight: 0.9 },
    { degrees: [1, 5, 6, 4, 1, 4, 2, 5], tags: ['anthem'], weight: 0.9 },
    { degrees: [1, 'b7', 4, 1, 6, 4, 1, 5], tags: ['alt'], weight: 0.8 }
  ],
  expert: [
    { degrees: [1, 4, 2, 5], tags: ['rock'], weight: 1.0 },
    { degrees: [6, 4, 1, 5], tags: ['punk'], weight: 1.0 },
    { degrees: [1, 5, 6, 4], tags: ['anthem'], weight: 1.0 },
    { degrees: [1, 'b7', 'b6', 4], tags: ['alt'], weight: 0.9 },
    { degrees: [1, 4, 'b7', 5], tags: ['alt', 'indie'], weight: 0.9 },
    { degrees: [1, 5, 6, 4, 2, 5, 1, 5], tags: ['anthem'], weight: 0.9 },
    { degrees: [6, 4, 1, 5, 1, 'b7', 4, 1], tags: ['alt'], weight: 0.8 }
  ]
};

const PRECHORUS_POOL = [
  [2, 4, 5],
  [6, 4, 5],
  [2, 5, 5],
  [4, 5, 1, 5],
  [2, 5, 6, 5]
];

const BRIDGE_BORROW_POOL = [
  ['b7', 'b6'],
  ['b6', 'b7'],
  ['b3', 'b7'],
  ['b7', 4, 1],
  ['b6', 4, 5]
];

const SECTION_MOTIF_POOLS = {
  intro: [
    { id: 'motif_intro_pulse', type: 'rhythm', tokens: ['q', 'q', 'e', 'e', 'q'] },
    { id: 'motif_intro_rise', type: 'riff', tokens: ['1e', '2e', '3e', '5e', '6e', '5e'] }
  ],
  verse: [
    { id: 'motif_verse_chug', type: 'rhythm', tokens: ['q', 'q', 'q', 'q'] },
    { id: 'motif_verse_hook', type: 'riff', tokens: ['1e', '1e', '5e', '6e', '5e', '3e'] },
    { id: 'motif_verse_sync', type: 'rhythm', tokens: ['q', 'e', 'e', 'q', 'q'] }
  ],
  prechorus: [
    { id: 'motif_pre_swell', type: 'riff', tokens: ['1e', '2e', '4e', '5e', '6e', '5e'] },
    { id: 'motif_pre_push', type: 'rhythm', tokens: ['q', 'q', 'e', 'e', 'q'] }
  ],
  chorus: [
    { id: 'motif_chorus_anthem', type: 'riff', tokens: ['1e', '5e', '6e', '5e', '4e', '5e'] },
    { id: 'motif_chorus_drive', type: 'rhythm', tokens: ['q', 'q', 'q', 'q'] },
    { id: 'motif_chorus_lift', type: 'riff', tokens: ['1e', '3e', '5e', '6e', '8e', '6e'] }
  ],
  bridge: [
    { id: 'motif_bridge_shift', type: 'riff', tokens: ['1e', 'b7e', '6e', '5e', '4e'] },
    { id: 'motif_bridge_stop', type: 'rhythm', tokens: ['h', 'q', 'q'] }
  ],
  solo: [
    { id: 'motif_solo_run', type: 'riff', tokens: ['1e', '2e', '3e', '5e', '6e', '8e'] },
    { id: 'motif_solo_skip', type: 'riff', tokens: ['1e', '5e', '3e', '6e', '4e', '8e'] }
  ],
  outro: [
    { id: 'motif_outro_fade', type: 'rhythm', tokens: ['q', 'q', 'h'] },
    { id: 'motif_outro_hit', type: 'riff', tokens: ['1e', '5e', '1q'] }
  ]
};

const CHORD_COLORS = ['sus2', 'sus4', '7', 'add9', 'm7', 'maj7'];
const NOTE_LANES = ['X', 'Y', 'A', 'B'];

const NOTE_INPUTS = [
  { button: 'A', base: 1, passing: 2 },
  { button: 'X', base: 3, passing: 4 },
  { button: 'Y', base: 5, passing: 6 },
  { button: 'B', base: 8, passing: 7 }
];

const mapPatternDegreeToInput = (patternDegree) => {
  const degree = Number(patternDegree) || 1;
  const octaveUp = degree > 8;
  const baseDegree = degree > 8 ? ((degree - 1) % 7) + 1 : degree;
  const entry = NOTE_INPUTS.find((item) => item.base === baseDegree || item.passing === baseDegree) || NOTE_INPUTS[0];
  const modifiers = { lb: entry.passing === baseDegree, dleft: false };
  return {
    button: entry.button,
    modifiers,
    octaveUp
  };
};
const CHORD_INPUTS = {
  power: { button: 'B', modifiers: { lb: false, dleft: false } },
  triad: { button: 'A', modifiers: { lb: false, dleft: false } },
  'triad-inv1': { button: 'X', modifiers: { lb: false, dleft: false } },
  'triad-inv2': { button: 'Y', modifiers: { lb: false, dleft: false } },
  sus2: { button: 'A', modifiers: { lb: true, dleft: false } },
  sus4: { button: 'X', modifiers: { lb: true, dleft: false } },
  seventh: { button: 'Y', modifiers: { lb: true, dleft: false } },
  add9: { button: 'B', modifiers: { lb: true, dleft: false } },
  dim: { button: 'A', modifiers: { lb: false, dleft: true } },
  aug: { button: 'Y', modifiers: { lb: false, dleft: true } }
};

const createTempoMap = (bpm) => ({ bpm, secondsPerBeat: 60 / bpm });

const getTimingWindows = (tier) => DIFFICULTY_WINDOWS.find((entry) => entry.tier === tier) || DIFFICULTY_WINDOWS[0];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SECTION_VELOCITY_BIAS = {
  intro: -6,
  verse: 0,
  prechorus: 6,
  chorus: 12,
  bridge: -12,
  solo: 4,
  outro: -6
};

const SECTION_ACCENT_MAP = {
  intro: [0],
  verse: [0, 2],
  prechorus: [0, 2],
  chorus: [0, 2],
  bridge: [0],
  solo: [0, 2],
  outro: [0]
};

const SECTION_DENSITY_MULTIPLIER = {
  bridge: 0.88
};

const getBeatAccentBias = (timeBeat) => {
  const beatInBar = ((timeBeat % 4) + 4) % 4;
  const snapped = Math.round(beatInBar * 2) / 2;
  if (snapped === 0) return 16;
  if (snapped === 2) return 10;
  if (snapped === 1 || snapped === 3) return 6;
  if (snapped % 1 !== 0) return -4;
  return 0;
};

const getSectionAccentBonus = (sectionName, timeBeat) => {
  const accents = SECTION_ACCENT_MAP[sectionName] || SECTION_ACCENT_MAP.verse;
  const beatInBar = ((timeBeat % 4) + 4) % 4;
  const snapped = Math.round(beatInBar * 2) / 2;
  return accents.includes(snapped) ? 8 : 0;
};

const computeEventVelocity = ({ timeBeat, sectionName, baseVelocity }) => {
  const sectionBias = SECTION_VELOCITY_BIAS[sectionName] ?? 0;
  const densityMultiplier = SECTION_DENSITY_MULTIPLIER[sectionName] ?? 1;
  const velocity = (baseVelocity + getBeatAccentBias(timeBeat) + getSectionAccentBonus(sectionName, timeBeat) + sectionBias)
    * densityMultiplier;
  return Math.round(clamp(velocity, 30, 127));
};

const DEFAULT_REGISTERS = {
  bass: { transpose_semitones: -20, min_note: 'E2' },
  guitar: { transpose_semitones: 0, center_note: 'C3' },
  piano: { transpose_semitones: 12, center_note: 'C4' }
};

const resolveTierLabel = (difficulty) => {
  if (difficulty <= 3) return 'beginner';
  if (difficulty <= 5) return 'easy';
  if (difficulty <= 7) return 'mid';
  if (difficulty <= 8) return 'hard';
  return 'expert';
};

const selectArrangementPreset = (difficulty, rng) => {
  if (difficulty <= 3) return 'bass_roots_gtr_chords_pno_arps';
  if (difficulty <= 5) return 'bass_roots_gtr_arps_pno_chords';
  if (difficulty <= 7) return 'bass_roots_gtr_chords_pno_chords_split';
  if (rng && rng() < 0.5) return 'bass_arps_gtr_roots_pno_chords';
  return 'bass_roots_gtr_chords_pno_chords_split';
};

const selectArpPattern = (difficulty, rng) => {
  if (difficulty <= 3) return 'ARP_135_8';
  if (difficulty <= 5) return rng && rng() < 0.4 ? 'ARP_1515' : 'ARP_153_8';
  if (difficulty <= 7) return rng && rng() < 0.4 ? 'ARP_ADD9' : 'ARP_1358';
  return rng && rng() < 0.4 ? 'ARP_DOM7' : 'ARP_M7';
};

const selectBassPatterns = (difficulty, preset, rng) => {
  if (preset === 'bass_arps_gtr_roots_pno_chords') {
    const base = difficulty >= 8 ? 'BL_R24578_8' : 'BL_R235_8';
    return {
      default_pattern: base,
      section_overrides: {
        verse: base,
        chorus: rng && rng() < 0.4 ? 'BL_R58_ALT' : 'BL_R58_8',
        bridge: 'BL_FILL_HOOK',
        outro: 'BL_FILL_END'
      }
    };
  }
  if (difficulty <= 3) {
    return {
      default_pattern: 'BL_ROOT_Q',
      section_overrides: {
        chorus: 'BL_R5_Q',
        bridge: 'BL_ROOT_HH',
        outro: 'BL_ROOT_W'
      }
    };
  }
  if (difficulty <= 5) {
    return {
      default_pattern: 'BL_R5_Q',
      section_overrides: {
        verse: 'BL_R5_Q',
        chorus: 'BL_R58_8',
        bridge: 'BL_FILL_END',
        outro: 'BL_FILL_DOWN'
      }
    };
  }
  if (difficulty <= 7) {
    return {
      default_pattern: 'BL_R58_8',
      section_overrides: {
        verse: 'BL_R58_8',
        chorus: 'BL_R58_ALT',
        bridge: 'BL_FILL_END',
        outro: 'BL_FILL_PUSH'
      }
    };
  }
  return {
    default_pattern: 'BL_R235_8',
    section_overrides: {
      verse: 'BL_R235_8',
      chorus: 'BL_R58_ALT',
      bridge: 'BL_FILL_END',
      outro: 'BL_FILL_HOOK'
    }
  };
};

export const mapDifficultyToTierNumber = (difficulty) => {
  if (difficulty <= 2) return 1;
  if (difficulty <= 4) return 2;
  if (difficulty <= 5) return 3;
  if (difficulty <= 6) return 4;
  if (difficulty <= 7) return 5;
  if (difficulty <= 8) return 6;
  return 7;
};

export const mapTierToDifficulty = (tier) => {
  if (tier <= 1) return 2;
  if (tier === 2) return 4;
  if (tier === 3) return 5;
  if (tier === 4) return 6;
  if (tier === 5) return 7;
  if (tier === 6) return 8;
  return 10;
};

const parseKeySignature = (key) => {
  const match = key.match(/^([A-Ga-g])([#b]?)[\s-]*(major|minor)$/i);
  if (!match) return { root: 'C', mode: 'major' };
  const root = `${match[1].toUpperCase()}${match[2] || ''}`;
  return { root, mode: match[3].toLowerCase() };
};

const normalizeChordText = (chord) => chord.replace(/\(([^)]+)\)/g, '$1');

const resolvePatternLibrary = (schema) => schema?.patternsLibrary || DEFAULT_PATTERN_LIBRARY;

const findPatternById = (library, collection, id) => (
  library?.[collection]?.find((pattern) => pattern.id === id) || null
);

const parsePatternToken = (token) => {
  const match = String(token).match(/^(\d+)(w|h|q|e)$/);
  if (!match) return null;
  return { degree: Number(match[1]), duration: match[2] };
};

const getChordQualityFromSymbol = (symbol) => {
  if (/dim/.test(symbol)) return 'dim';
  if (/m(?!aj)/.test(symbol)) return 'minor';
  return 'major';
};

const getChordSeventhQuality = (symbol) => {
  if (/maj7/.test(symbol)) return 'maj7';
  if (/m7/.test(symbol)) return 'm7';
  if (/7/.test(symbol)) return '7';
  return null;
};

const getPatternInterval = ({ degree, chordQuality, seventhQuality, chordType }) => {
  if (degree === 1) return 0;
  if (degree === 2) return 2;
  if (degree === 3) {
    if (chordType === 'sus2') return 2;
    if (chordType === 'sus4') return 5;
    return chordQuality === 'minor' || chordQuality === 'dim' ? 3 : 4;
  }
  if (degree === 4) return 5;
  if (degree === 5) return 7;
  if (degree === 6) return 9;
  if (degree === 7) {
    if (seventhQuality === 'maj7') return 11;
    if (seventhQuality === 'm7' || seventhQuality === '7') return 10;
    return chordQuality === 'minor' ? 10 : 11;
  }
  if (degree === 8) return 12;
  if (degree === 9) return 14;
  return (degree - 1) * 2;
};

const resolvePatternTokensToEvents = ({ tokens, chordEvent, tempo, register }) => {
  const parsed = tokens.map((token) => parsePatternToken(token)).filter(Boolean);
  if (!parsed.length) return [];
  const events = [];
  const endBeat = chordEvent.startBeat + chordEvent.duration;
  let beatCursor = chordEvent.startBeat;
  parsed.forEach((entry) => {
    const remaining = endBeat - beatCursor;
    if (remaining <= 0) return;
    const baseDuration = DURATION_TOKENS[entry.duration] || 1;
    const duration = Math.min(baseDuration, remaining);
    const inputMap = mapPatternDegreeToInput(entry.degree);
    const lane = NOTE_LANES.indexOf(inputMap.button);
    const event = {
      timeBeat: beatCursor,
      timeSec: beatCursor * tempo.secondsPerBeat,
      lane: lane >= 0 ? lane : 0,
      type: 'NOTE',
      section: chordEvent.section,
      requiredInput: {
        mode: 'pattern',
        degree: chordEvent.degree,
        patternDegree: entry.degree,
        chordType: chordEvent.chordType,
        chordQuality: chordEvent.chordQuality,
        seventhQuality: chordEvent.seventhQuality,
        button: inputMap.button,
        modifiers: inputMap.modifiers,
        octaveUp: inputMap.octaveUp,
        transpose: register?.transpose_semitones ?? 0,
        minNote: register?.min_note ?? null
      },
      sustain: duration,
      starPhrase: chordEvent.isPhrase
    };
    events.push(event);
    beatCursor += duration;
  });
  return events;
};

const buildStructure = (rng, tierLabel, difficulty) => {
  const patterns = STRUCTURE_PATTERNS[tierLabel] || STRUCTURE_PATTERNS.easy;
  const base = pickRandom(rng, patterns);
  const letters = base.split('');
  const arpeggioChance = difficulty >= 9 ? 0.55 : difficulty >= 7 ? 0.35 : difficulty >= 5 ? 0.2 : 0.1;
  return letters
    .map((letter) => {
      const lowerable = ['B', 'S', 'O', 'C', 'P'].includes(letter);
      if (lowerable && rng() < arpeggioChance) return letter.toLowerCase();
      return letter;
    })
    .join('');
};

const selectDurationTemplate = (rng, difficulty, sectionName) => {
  const dense = ['bridge', 'solo', 'outro'].includes(sectionName);
  const pool = DURATION_TEMPLATES.filter((template) => {
    if (difficulty <= 3) return template.length <= 3;
    if (difficulty <= 6) return template.length <= 4;
    if (dense && difficulty >= 9) return template.length >= 4;
    return true;
  });
  return pickRandom(rng, pool.length ? pool : DURATION_TEMPLATES);
};

const degreeToPitchClass = (rootPc, steps, degree) => {
  const degreeIndex = ((degree - 1) % steps.length + steps.length) % steps.length;
  return (rootPc + steps[degreeIndex]) % 12;
};

const resolveBorrowedDegree = (degree) => {
  if (typeof degree === 'number') return { degree, accidental: 0 };
  const normalized = String(degree).trim();
  const match = normalized.match(/^(b|#)?(\d|i{1,3}|iv|v|vi{0,2}|vii)$/i);
  if (!match) return { degree: 1, accidental: 0 };
  const accidental = match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0;
  const value = match[2];
  if (/^\d$/.test(value)) {
    return { degree: Number(value), accidental };
  }
  const roman = value.toUpperCase();
  const romanMap = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7
  };
  return { degree: romanMap[roman] || 1, accidental };
};

const buildChordSymbol = ({ root, quality, color, power, inversion, lowerCase }) => {
  let symbol = root;
  if (power) {
    symbol += '5';
  } else if (quality === 'minor') {
    symbol += 'm';
  } else if (quality === 'dim') {
    symbol += 'dim';
  }
  if (color) {
    if (color === 'add9') {
      symbol += '(add9)';
    } else if (color === 'sus2' || color === 'sus4') {
      symbol = `${root}${color}`;
    } else if (color === 'm7') {
      symbol = `${root}m7`;
    } else if (color === 'maj7') {
      symbol = `${root}maj7`;
    } else if (color === '7') {
      symbol = `${root}7`;
    } else {
      symbol += color;
    }
  }
  if (inversion) {
    symbol += `/${inversion}`;
  }
  if (lowerCase) {
    symbol = symbol.replace(/^[A-G]/, (match) => match.toLowerCase());
    symbol = symbol.replace(/\/(.+)$/, (match, bass) => `/${bass.toLowerCase()}`);
  }
  return symbol;
};

const getChordQuality = (mode, degree) => {
  if (mode === 'major') {
    if ([2, 3, 6].includes(degree)) return 'minor';
    if (degree === 7) return 'dim';
    return 'major';
  }
  if ([1, 4, 5].includes(degree)) return 'minor';
  if (degree === 2) return 'dim';
  return 'major';
};

const pickChordColor = (rng, difficulty, quality) => {
  if (difficulty < 6) return null;
  if (quality === 'dim') return null;
  const chance = difficulty >= 9 ? 0.7 : 0.4;
  if (rng() >= chance) return null;
  if (quality === 'minor') {
    return pickRandom(rng, ['add9', 'm7']);
  }
  return pickRandom(rng, CHORD_COLORS);
};

const buildChordForDegree = ({
  rng,
  degree,
  rootPc,
  mode,
  difficulty,
  lowerCase,
  allowColor,
  allowPower,
  allowInversion
}) => {
  const { degree: baseDegree, accidental } = resolveBorrowedDegree(degree);
  const steps = mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  const pc = (degreeToPitchClass(rootPc, steps, baseDegree) + accidental + 12) % 12;
  const root = PC_TO_NOTE[pc];
  const quality = getChordQuality(mode, baseDegree);
  const power = allowPower && difficulty <= 3;
  const color = allowColor ? pickChordColor(rng, difficulty, quality) : null;
  let inversion = null;
  if (allowInversion && difficulty >= 6 && rng() < 0.25 && !power) {
    const thirdPc = (pc + (quality === 'minor' ? 3 : 4)) % 12;
    inversion = PC_TO_NOTE[thirdPc];
  }
  const chordSymbol = buildChordSymbol({
    root,
    quality,
    color,
    power,
    inversion,
    lowerCase
  });
  return { chordSymbol, root, color };
};

const buildSectionBars = ({
  rng,
  sectionName,
  bars,
  progression,
  rootPc,
  mode,
  difficulty,
  lowerCase,
  allowPower,
  allowColor,
  allowInversion
}) => {
  const sectionBars = [];
  let progressionIndex = 0;
  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const template = selectDurationTemplate(rng, difficulty, sectionName);
    const bar = template.map((token) => {
      const degree = progression[progressionIndex % progression.length];
      progressionIndex += 1;
      const chord = buildChordForDegree({
        rng,
        degree,
        rootPc,
        mode,
        difficulty,
        lowerCase,
        allowPower,
        allowColor,
        allowInversion
      });
      return `${chord.chordSymbol}(${token})`;
    });
    sectionBars.push(bar);
  }
  return sectionBars;
};

const ensureChordDiversity = ({ song, rootPc, mode, rng }) => {
  const verse = song.sections.verse || [];
  const chorus = song.sections.chorus || [];
  const collectRoots = (bars) => bars.flat().map((entry) => normalizeChordText(entry).split('/')[0]);
  const roots = new Set([...collectRoots(verse), ...collectRoots(chorus)]);
  if (roots.size >= 3) return;
  const steps = mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  const extraDegrees = [2, 6, 4];
  const pickDegree = extraDegrees[Math.floor(rng() * extraDegrees.length)];
  const pc = degreeToPitchClass(rootPc, steps, pickDegree);
  const note = PC_TO_NOTE[pc];
  if (song.sections.verse?.[0]?.length) {
    song.sections.verse[0][0] = `${note}(q)`;
  }
};

const ensureChordColorPresence = ({ song, difficulty }) => {
  if (difficulty < 6) return;
  const hasColor = Object.values(song.sections).some((bars) => (
    bars.some((bar) => bar.some((entry) => /sus2|sus4|add9|maj7|m7|7/.test(entry)))
  ));
  if (hasColor) return;
  const targetSection = song.sections.chorus || song.sections.verse || [];
  if (!targetSection.length) return;
  const bar = targetSection[0];
  if (!bar?.length) return;
  const entry = bar[0];
  const base = entry.replace(/\((w|h|q|e)\)\s*$/, '');
  const duration = entry.match(/\((w|h|q|e)\)\s*$/)?.[1] || 'q';
  bar[0] = `${base}(add9)(${duration})`;
};

const pickWeightedEntry = (rng, entries) => {
  if (!entries.length) return null;
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return entries[0];
  let roll = rng() * totalWeight;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
};

const selectProgressionByStyle = (rng, pool, styleTags = []) => {
  const normalizedTags = styleTags.map((tag) => String(tag).toLowerCase());
  const weightedPool = pool.map((entry) => {
    if (Array.isArray(entry)) {
      return { degrees: entry, weight: 1, tags: [] };
    }
    const tags = (entry.tags || []).map((tag) => String(tag).toLowerCase());
    const matches = tags.filter((tag) => normalizedTags.includes(tag)).length;
    const baseWeight = entry.weight ?? 1;
    const weightBoost = matches > 0 ? 1 + matches * 0.35 : 1;
    return {
      ...entry,
      degrees: entry.degrees || entry.progression || [],
      weight: baseWeight * weightBoost,
      tags
    };
  });
  const selection = pickWeightedEntry(rng, weightedPool) || weightedPool[0];
  return selection?.degrees?.length ? selection.degrees : pool[0] || [];
};

const buildSectionMotifs = ({ rng, structure }) => {
  const motifs = {};
  const letters = structure.split('');
  letters.forEach((letter) => {
    const sectionName = SECTION_LETTERS[letter.toUpperCase()];
    if (!sectionName || motifs[sectionName]) return;
    const pool = SECTION_MOTIF_POOLS[sectionName] || SECTION_MOTIF_POOLS.verse;
    motifs[sectionName] = pickRandom(rng, pool);
  });
  return motifs;
};

const buildSongSections = ({
  rng,
  structure,
  rootPc,
  mode,
  difficulty,
  tierLabel,
  styleTags
}) => {
  const sections = {};
  const allowPower = difficulty <= 3;
  const allowColor = difficulty >= 4;
  const allowInversion = difficulty >= 6;
  const progressionPool = PROGRESSION_POOLS[tierLabel] || PROGRESSION_POOLS.easy;
  const verseProgression = selectProgressionByStyle(rng, progressionPool, styleTags);
  const chorusProgression = selectProgressionByStyle(rng, progressionPool, styleTags);
  const prechorusProgression = pickRandom(rng, PRECHORUS_POOL);
  const bridgeProgression = difficulty >= 8
    ? pickRandom(rng, BRIDGE_BORROW_POOL)
    : selectProgressionByStyle(rng, progressionPool, styleTags);
  const sectionBarCounts = {
    intro: difficulty >= 7 ? 2 : 1,
    verse: 2,
    prechorus: difficulty >= 7 ? 2 : 1,
    chorus: 2,
    bridge: difficulty >= 8 ? 2 : 1,
    solo: 1,
    outro: 1
  };
  const buildSection = (name, progression, lowerCase) => {
    sections[name] = buildSectionBars({
      rng,
      sectionName: name,
      bars: sectionBarCounts[name] || 1,
      progression,
      rootPc,
      mode,
      difficulty,
      lowerCase,
      allowPower,
      allowColor,
      allowInversion
    });
  };
  const letters = structure.split('');
  letters.forEach((letter) => {
    const sectionName = SECTION_LETTERS[letter.toUpperCase()];
    if (!sectionName || sections[sectionName]) return;
    const lowerCase = letter === letter.toLowerCase();
    if (sectionName === 'verse') buildSection(sectionName, verseProgression, lowerCase);
    else if (sectionName === 'chorus') buildSection(sectionName, chorusProgression, lowerCase);
    else if (sectionName === 'prechorus') buildSection(sectionName, prechorusProgression, lowerCase);
    else if (sectionName === 'bridge') buildSection(sectionName, bridgeProgression, lowerCase);
    else buildSection(sectionName, verseProgression, lowerCase);
  });
  return sections;
};

const buildSectionTimelineFromSchema = (schema) => {
  const timeline = [];
  let beatCursor = 0;
  schema.structure.split('').forEach((letter) => {
    const sectionName = SECTION_LETTERS[letter.toUpperCase()];
    const bars = schema.sections?.[sectionName]?.length || 0;
    const beats = bars * 4;
    if (!sectionName || beats === 0) return;
    timeline.push({
      name: sectionName,
      bars,
      startBeat: beatCursor,
      endBeat: beatCursor + beats,
      articulation: letter === letter.toLowerCase() ? 'arpeggio' : 'strum'
    });
    beatCursor += beats;
  });
  return timeline;
};

const buildChordTimelineFromSchema = ({ schema, tempo }) => {
  const timeline = [];
  const sections = buildSectionTimelineFromSchema(schema);
  const keyInfo = parseKeySignature(schema.key);
  const rootPc = NOTE_TO_PC[keyInfo.root] ?? 0;
  const steps = keyInfo.mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS;
  const starPhraseBars = createStarPhraseMap(sections.reduce((sum, section) => sum + section.bars, 0));
  sections.forEach((section) => {
    const bars = schema.sections?.[section.name] || [];
    bars.forEach((bar, barIndex) => {
      const barStartBeat = section.startBeat + barIndex * 4;
      let beatOffset = 0;
      const globalBar = Math.floor(barStartBeat / 4);
      const isPhrase = starPhraseBars.has(globalBar);
      bar.forEach((entry) => {
        const durationToken = entry.match(/\((w|h|q|e)\)\s*$/)?.[1] || 'q';
        const duration = DURATION_TOKENS[durationToken] || 1;
        const clean = normalizeChordText(entry.replace(/\((w|h|q|e)\)\s*$/, ''));
        const [symbolRoot, inversion] = clean.split('/');
        const rootMatch = symbolRoot.match(/^([A-Ga-g])([#b]?)/);
        const noteLabel = rootMatch ? `${rootMatch[1].toUpperCase()}${rootMatch[2] || ''}` : 'C';
        const chordPc = NOTE_TO_PC[noteLabel] ?? 0;
        const pcOffset = (chordPc - rootPc + 12) % 12;
        let degreeIndex = steps.indexOf(pcOffset);
        if (degreeIndex === -1) {
          degreeIndex = steps.reduce((closest, step, index) => {
            const diff = Math.abs(step - pcOffset);
            return diff < closest.diff ? { diff, index } : closest;
          }, { diff: Infinity, index: 0 }).index;
        }
        const degree = degreeIndex + 1;
        const chordType = (() => {
          if (symbolRoot.includes('5')) return 'power';
          if (symbolRoot.includes('sus2')) return 'sus2';
          if (symbolRoot.includes('sus4')) return 'sus4';
          if (symbolRoot.includes('add9')) return 'add9';
          if (symbolRoot.includes('dim')) return 'dim';
          if (symbolRoot.includes('aug')) return 'aug';
          if (symbolRoot.includes('7')) return 'seventh';
          if (inversion) return 'triad-inv1';
          return 'triad';
        })();
        const timeBeat = barStartBeat + beatOffset;
        timeline.push({
          timeBeat,
          timeSec: timeBeat * tempo.secondsPerBeat,
          section: section.name,
          degree,
          duration,
          chordType,
          chordQuality: getChordQualityFromSymbol(symbolRoot),
          seventhQuality: getChordSeventhQuality(symbolRoot),
          isPhrase
        });
        beatOffset += duration;
      });
    });
  });
  return { timeline, sections };
};

const buildChordEventsFromSchema = ({ schema, tempo, instrument, register }) => {
  const events = [];
  const { timeline, sections } = buildChordTimelineFromSchema({ schema, tempo });
  timeline.forEach((entry) => {
    const inputMap = CHORD_INPUTS[entry.chordType] || CHORD_INPUTS.triad;
    const lane = NOTE_LANES.indexOf(inputMap.button);
    const velocity = computeEventVelocity({
      timeBeat: entry.timeBeat,
      sectionName: entry.section,
      baseVelocity: 92
    });
    events.push({
      timeBeat: entry.timeBeat,
      timeSec: entry.timeSec,
      lane: lane >= 0 ? lane : 0,
      type: 'CHORD',
      section: entry.section,
      velocity,
      requiredInput: {
        mode: instrument === 'drums' ? 'drum' : 'chord',
        degree: entry.degree,
        button: inputMap.button,
        modifiers: inputMap.modifiers,
        chordType: entry.chordType,
        transpose: register?.transpose_semitones ?? 0,
        minNote: register?.min_note ?? null
      },
      sustain: entry.duration,
      starPhrase: entry.isPhrase
    });
  });
  return { events, sections, timeline };
};

const createStarPhraseMap = (totalBars) => {
  const phraseBars = new Set();
  for (let bar = 4; bar < totalBars; bar += 8) {
    phraseBars.add(bar);
  }
  return phraseBars;
};

const buildDrumPattern = ({ rng, tier, sectionName, isSectionStart, isSectionEnd }) => {
  const density = tier <= 2 ? 'simple' : tier <= 4 ? 'medium' : 'dense';
  let kick = [0];
  let snare = [1];
  let hat = [0.5, 1.5, 2.5, 3.5];
  let cymbal = [];
  if (density === 'medium') {
    kick = [0, 2.5];
    snare = [1, 3];
    hat = [0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  }
  if (density === 'dense') {
    kick = [0, 1.5, 2.5];
    snare = [1, 3];
    hat = [0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  }
  if (sectionName === 'bridge') {
    kick = kick.concat([2.75]);
  }
  if (sectionName === 'chorus') {
    cymbal = [0];
  }
  if (isSectionStart && rng() < 0.4) {
    cymbal = [...new Set([...cymbal, 0])];
  }
  if (isSectionEnd) {
    cymbal = [...new Set([...cymbal, 3.5])];
  }
  return { kick, snare, hat, cymbal };
};

const buildDrumEvents = ({ rng, tier, tempo, sections }) => {
  const events = [];
  const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);
  const starPhraseBars = createStarPhraseMap(totalBars);
  sections.forEach((section, sectionIndex) => {
    for (let bar = 0; bar < section.bars; bar += 1) {
      const barStartBeat = section.startBeat + bar * 4;
      const globalBar = Math.floor(barStartBeat / 4);
      const isPhrase = starPhraseBars.has(globalBar);
      const drumPattern = buildDrumPattern({
        rng,
        tier,
        sectionName: section.name,
        isSectionStart: bar === 0,
        isSectionEnd: bar === section.bars - 1 && sectionIndex < sections.length - 1
      });
      const laneMap = [
        { lane: 0, offsets: drumPattern.kick, baseVelocity: 104 },
        { lane: 1, offsets: drumPattern.snare, baseVelocity: 100 },
        { lane: 2, offsets: drumPattern.hat, baseVelocity: 76 },
        { lane: 3, offsets: drumPattern.cymbal, baseVelocity: 94 }
      ];
      laneMap.forEach((laneDef) => {
        laneDef.offsets.forEach((offset) => {
          const timeBeat = barStartBeat + offset;
          const velocity = computeEventVelocity({
            timeBeat,
            sectionName: section.name,
            baseVelocity: laneDef.baseVelocity
          });
          events.push({
            timeBeat,
            timeSec: timeBeat * tempo.secondsPerBeat,
            lane: laneDef.lane,
            type: 'NOTE',
            section: section.name,
            velocity,
            requiredInput: {
              mode: 'drum',
              lane: laneDef.lane,
              degree: 1
            },
            starPhrase: isPhrase
          });
        });
      });
    }
  });
  return events;
};

export const buildRandomName = (seed) => {
  const rng = mulberry32(seed);
  const adjectives = ['Neon', 'Crimson', 'Velvet', 'Chrome', 'Solar', 'Quiet', 'Rift', 'Arc', 'Midnight', 'Golden'];
  const nouns = ['Echo', 'Signal', 'Orbit', 'Pulse', 'Engine', 'Voyager', 'Frequency', 'Vista', 'Machine', 'Nova'];
  const suffixes = ['Run', 'Drive', 'Call', 'Glow', 'Loop', 'Shift', 'Bloom', 'Line', 'Drop', 'Rise'];
  return `${pickRandom(rng, adjectives)} ${pickRandom(rng, nouns)} ${pickRandom(rng, suffixes)}`;
};

export const generateStructuredSong = ({ difficulty = 1, seed, stylePreset } = {}) => {
  const normalizedDifficulty = clamp(Math.round(difficulty), 1, 10);
  const rng = mulberry32(typeof seed === 'number' ? seed : hashString(String(seed ?? Date.now())));
  const tierLabel = resolveTierLabel(normalizedDifficulty);
  const style = STYLE_PRESETS[stylePreset] || pickRandom(rng, Object.values(STYLE_PRESETS));
  const root = pickRandom(rng, ['C', 'D', 'E', 'G', 'A']);
  const mode = rng() < 0.35 ? 'minor' : 'major';
  const key = `${root} ${mode}`;
  const tempoRange = style?.tempo || [96, 124];
  const tempo = Math.round(rangeRandom(rng, tempoRange[0], tempoRange[1]));
  const structure = buildStructure(rng, tierLabel, normalizedDifficulty);
  const rootPc = NOTE_TO_PC[root] ?? 0;
  const sections = buildSongSections({
    rng,
    structure,
    rootPc,
    mode,
    difficulty: normalizedDifficulty,
    tierLabel,
    styleTags: style?.tags || []
  });
  const sectionMotifs = buildSectionMotifs({ rng, structure });
  const preset = selectArrangementPreset(normalizedDifficulty, rng);
  const bassPart = selectBassPatterns(normalizedDifficulty, preset, rng);
  const guitarRole = preset.includes('gtr_chords') ? 'chords' : preset.includes('gtr_arps') ? 'arpeggio' : 'roots';
  const pianoRole = preset.includes('pno_arps') ? 'arpeggio' : 'chords';
  const song = {
    id: `rnd-${seed ?? Date.now()}`,
    title: buildRandomName(typeof seed === 'number' ? seed : hashString(String(seed ?? Date.now()))),
    band: 'RobterSESSION',
    difficulty: normalizedDifficulty,
    tier: tierLabel,
    tempo_bpm: tempo,
    time_signature: '4/4',
    key,
    style_tags: style?.tags || ['rock'],
    structure,
    arrangement: {
      preset,
      registers: DEFAULT_REGISTERS,
      sound: {
        programs: { ...DEFAULT_SOUND_PROGRAMS },
        drum_kit: 'standard'
      }
    },
    parts: {
      bass: bassPart,
      guitar: {
        role: guitarRole,
        ...(guitarRole === 'arpeggio' ? { arp_pattern: selectArpPattern(normalizedDifficulty, rng) } : {})
      },
      piano: {
        role: pianoRole,
        ...(pianoRole === 'arpeggio' ? { arp_pattern: selectArpPattern(normalizedDifficulty, rng) } : {})
      }
    },
    sections,
    section_motifs: sectionMotifs
  };
  ensureChordDiversity({ song, rootPc, mode, rng });
  ensureChordColorPresence({ song, difficulty: normalizedDifficulty });
  return song;
};

export const validateBarDurations = (song) => {
  const errors = [];
  Object.entries(song.sections || {}).forEach(([sectionName, bars]) => {
    bars.forEach((bar, barIndex) => {
      const total = bar.reduce((sum, entry) => {
        const match = entry.match(/\((w|h|q|e)\)\s*$/);
        if (!match) {
          errors.push(`Missing duration token in ${song.id || song.title} ${sectionName} bar ${barIndex + 1}.`);
          return sum;
        }
        return sum + DURATION_TOKENS[match[1]];
      }, 0);
      if (Math.abs(total - 4) > 0.001) {
        errors.push(`Bar duration mismatch in ${song.id || song.title} ${sectionName} bar ${barIndex + 1}: ${total}.`);
      }
    });
  });
  if (errors.length) {
    console.warn(errors.join('\n'));
  }
  return errors;
};

export const validateStructureSectionsPresent = (song, sectionMap = SECTION_LETTERS) => {
  const errors = [];
  const letters = song.structure?.split('') || [];
  letters.forEach((letter) => {
    const name = sectionMap[letter.toUpperCase()];
    if (!name) return;
    if (!song.sections?.[name]) {
      errors.push(`Missing section ${name} for structure ${song.structure} in ${song.id || song.title}.`);
    }
  });
  if (errors.length) {
    console.warn(errors.join('\n'));
  }
  return errors;
};

export const validateChordSymbolFormat = (song) => {
  const errors = [];
  const rootPattern = '[A-Ga-g](?:#|b{1,2})?';
  const qualityPattern = '(?:madd9|m7|maj7|sus2|sus4|add9|dim7|dim|aug|7|5|m)?';
  const chordRegex = new RegExp(`^${rootPattern}${qualityPattern}(?:/${rootPattern})?$`);
  Object.entries(song.sections || {}).forEach(([sectionName, bars]) => {
    bars.forEach((bar, barIndex) => {
      bar.forEach((entry) => {
        const base = normalizeChordText(entry.replace(/\((w|h|q|e)\)\s*$/, ''));
        if (!chordRegex.test(base)) {
          errors.push(`Invalid chord symbol ${entry} in ${song.id || song.title} ${sectionName} bar ${barIndex + 1}.`);
        }
      });
    });
  });
  if (errors.length) {
    console.warn(errors.join('\n'));
  }
  return errors;
};

export const validatePatternLibrary = (library) => {
  const errors = [];
  const collections = ['basslines', 'arpeggios'];
  collections.forEach((collection) => {
    (library?.[collection] || []).forEach((pattern) => {
      const total = (pattern.tokens || []).reduce((sum, token) => {
        const parsed = parsePatternToken(token);
        if (!parsed) {
          errors.push(`Invalid token ${token} in ${pattern.id}.`);
          return sum;
        }
        return sum + (DURATION_TOKENS[parsed.duration] || 0);
      }, 0);
      if (Math.abs(total - 4) > 0.001) {
        errors.push(`Pattern ${pattern.id} sums to ${total} beats.`);
      }
    });
  });
  if (errors.length) {
    console.warn(errors.join('\n'));
  }
  return errors;
};

export const validatePatternReferences = (song, library) => {
  const errors = [];
  const bassPattern = song.parts?.bass?.default_pattern;
  if (bassPattern && !findPatternById(library, 'basslines', bassPattern)) {
    errors.push(`Missing bass pattern ${bassPattern} in ${song.id || song.title}.`);
  }
  Object.entries(song.parts?.bass?.section_overrides || {}).forEach(([section, patternId]) => {
    if (!findPatternById(library, 'basslines', patternId)) {
      errors.push(`Missing bass pattern ${patternId} for ${section} in ${song.id || song.title}.`);
    }
  });
  const guitarArp = song.parts?.guitar?.arp_pattern;
  if (guitarArp && !findPatternById(library, 'arpeggios', guitarArp)) {
    errors.push(`Missing guitar arp ${guitarArp} in ${song.id || song.title}.`);
  }
  const pianoArp = song.parts?.piano?.arp_pattern;
  if (pianoArp && !findPatternById(library, 'arpeggios', pianoArp)) {
    errors.push(`Missing piano arp ${pianoArp} in ${song.id || song.title}.`);
  }
  if (errors.length) {
    console.warn(errors.join('\n'));
  }
  return errors;
};

export const validateRegisterRules = (song) => {
  const errors = [];
  const registers = song.arrangement?.registers;
  if (!registers) return errors;
  const toMidi = (note) => {
    const match = String(note || '').match(/^([A-Ga-g])([#b]?)(-?\\d+)$/);
    if (!match) return null;
    const label = `${match[1].toUpperCase()}${match[2] || ''}`;
    const octave = Number(match[3]);
    return (octave + 1) * 12 + (NOTE_TO_PC[label] ?? 0);
  };
  const bassCenter = toMidi(registers.bass?.min_note) ?? 0;
  const guitarCenter = toMidi(registers.guitar?.center_note) ?? bassCenter + 12;
  const pianoCenter = toMidi(registers.piano?.center_note) ?? guitarCenter + 12;
  if (bassCenter > guitarCenter || guitarCenter > pianoCenter) {
    errors.push(`Register order violation in ${song.id || song.title}.`);
  }
  if (errors.length) {
    console.warn(errors.join('\n'));
  }
  return errors;
};

export const validateRequiredChordTypes = (setlist) => {
  const required = setlist?.definitions?.required_chord_types || [];
  if (!required.length) return [];
  const present = new Set();
  setlist?.songs?.forEach((song) => {
    Object.values(song.sections || {}).forEach((bars) => {
      bars.forEach((bar) => {
        bar.forEach((entry) => {
          const chord = normalizeChordText(entry.replace(/\((w|h|q|e)\)\s*$/, ''));
          required.forEach((type) => {
            if (chord.includes(type)) present.add(type);
          });
        });
      });
    });
  });
  const missing = required.filter((type) => !present.has(type));
  if (missing.length) {
    console.warn(`Missing required chord types: ${missing.join(', ')}`);
  }
  return missing;
};

const buildPatternTrack = ({
  schema,
  tempo,
  timeline,
  patternId,
  register,
  collection
}) => {
  const library = resolvePatternLibrary(schema);
  const pattern = findPatternById(library, collection, patternId);
  if (!pattern) return [];
  const events = [];
  timeline.forEach((chordEvent) => {
    const patternEvents = resolvePatternTokensToEvents({
      tokens: pattern.tokens || [],
      chordEvent: {
        ...chordEvent,
        startBeat: chordEvent.timeBeat
      },
      tempo,
      register
    });
    patternEvents.forEach((event) => {
      const velocity = computeEventVelocity({
        timeBeat: event.timeBeat,
        sectionName: event.section,
        baseVelocity: 88
      });
      events.push({ ...event, velocity });
    });
  });
  return events;
};

const buildTracksFromSchema = ({ rng, tier, instrument, schema }) => {
  const tempo = createTempoMap(schema.tempo_bpm);
  const arrangement = schema.arrangement || {};
  const registers = arrangement.registers || DEFAULT_REGISTERS;
  const { events, sections, timeline } = buildChordEventsFromSchema({
    schema,
    tempo,
    instrument,
    register: registers[instrument]
  });
  const tracks = {};
  INSTRUMENTS.forEach((trackInstrument) => {
    if (trackInstrument === 'drums') {
      tracks[trackInstrument] = buildDrumEvents({ rng, tier, tempo, sections });
      return;
    }
    const part = schema.parts?.[trackInstrument] || {};
    const register = registers[trackInstrument];
    if (trackInstrument === 'bass') {
      const defaultPattern = part.default_pattern || 'BL_ROOT_8';
      const sectionOverrides = part.section_overrides || {};
      const trackEvents = [];
      const library = resolvePatternLibrary(schema);
      timeline.forEach((chordEvent) => {
        const patternId = sectionOverrides[chordEvent.section] || defaultPattern;
        const pattern = findPatternById(library, 'basslines', patternId);
        if (!pattern) return;
        const patternEvents = resolvePatternTokensToEvents({
          tokens: pattern.tokens || [],
          chordEvent: {
            ...chordEvent,
            startBeat: chordEvent.timeBeat
          },
          tempo,
          register
        });
        patternEvents.forEach((event) => {
          const velocity = computeEventVelocity({
            timeBeat: event.timeBeat,
            sectionName: event.section,
            baseVelocity: 88
          });
          trackEvents.push({ ...event, velocity });
        });
      });
      tracks[trackInstrument] = trackEvents;
      return;
    }
    const role = part.role || 'chords';
    if (role === 'arpeggio') {
      const arpPattern = part.arp_pattern || 'ARP_135_8';
      tracks[trackInstrument] = buildPatternTrack({
        schema,
        tempo,
        timeline,
        patternId: arpPattern,
        register,
        collection: 'arpeggios'
      });
      return;
    }
    if (role === 'roots') {
      tracks[trackInstrument] = buildPatternTrack({
        schema,
        tempo,
        timeline,
        patternId: 'BL_ROOT_Q',
        register,
        collection: 'basslines'
      });
      return;
    }
    tracks[trackInstrument] = buildChordEventsFromSchema({
      schema,
      tempo,
      instrument: trackInstrument,
      register
    }).events;
  });
  return { tracks, events, sections, tempo };
};

export const generateSongData = ({
  name,
  tier,
  instrument,
  allowModeChange = false,
  seed,
  stylePreset,
  difficulty,
  schema
}) => {
  const resolvedSeed = typeof seed === 'number' ? seed : hashString(name ?? 'random');
  const rng = mulberry32(resolvedSeed);
  const resolvedDifficulty = clamp(difficulty ?? mapTierToDifficulty(tier ?? 1), 1, 10);
  const songSchema = schema || generateStructuredSong({ difficulty: resolvedDifficulty, seed: resolvedSeed, stylePreset });
  const keyInfo = parseKeySignature(songSchema.key);
  const mode = keyInfo.mode === 'minor' ? MINOR_MODE : MAJOR_MODE;
  const rootIndex = ROOT_LABELS.indexOf(keyInfo.root);
  const tempoMin = songSchema.tempo_bpm - 4;
  const tempoMax = songSchema.tempo_bpm + 6;
  const { tracks, events, sections, tempo } = buildTracksFromSchema({
    rng,
    tier: mapDifficultyToTierNumber(resolvedDifficulty),
    instrument,
    schema: songSchema
  });
  const timing = getTimingWindows(mapDifficultyToTierNumber(resolvedDifficulty));
  const progression = songSchema.sections?.verse?.[0] || [];
  return {
    name: name || songSchema.title,
    seed: resolvedSeed,
    tier: mapDifficultyToTierNumber(resolvedDifficulty),
    instrument,
    root: rootIndex >= 0 ? rootIndex : 0,
    mode,
    tempo,
    progression,
    sections,
    bpm: songSchema.tempo_bpm,
    difficulty: resolvedDifficulty,
    timing,
    events: tracks[instrument] || events,
    tracks,
    modeChange: allowModeChange ? null : null,
    tempoRange: { min: tempoMin, max: tempoMax },
    schema: songSchema
  };
};
