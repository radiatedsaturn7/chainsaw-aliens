import { DIFFICULTY_WINDOWS, MODE_LIBRARY, ROOT_LABELS } from './constants.js';
import { hashString, mulberry32, pickRandom, rangeRandom } from './rng.js';

const PROGRESSIONS = [
  [1, 4, 5, 1],
  [1, 6, 4, 5],
  [1, 5, 6, 4],
  [6, 4, 1, 5],
  [2, 5, 1, 1],
  [1, 4, 6, 5],
  [1, 3, 4, 5]
];

const SECTION_PATTERNS = [
  ['Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus'],
  ['Verse', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Solo', 'Chorus'],
  ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Solo', 'Chorus']
];

const RHYTHM_PATTERNS = {
  simple: [
    [0, 2],
    [0, 1, 2, 3],
    [0, 2.5]
  ],
  medium: [
    [0, 1.5, 2.5],
    [0, 1, 2, 3.5],
    [0, 1.5, 2, 3]
  ],
  dense: [
    [0, 0.75, 1.5, 2.25, 3],
    [0, 1, 1.75, 2.5, 3.25],
    [0, 0.5, 1.5, 2.5, 3.5]
  ]
};

const BASS_RHYTHM_PATTERNS = {
  simple: [
    [0, 2],
    [0, 1, 2.5],
    [0, 2.75]
  ],
  medium: [
    [0, 1.5, 2.5, 3.25],
    [0, 0.75, 1.5, 2.75, 3.5],
    [0, 1.25, 2, 2.75]
  ],
  dense: [
    [0, 0.5, 1.25, 2, 2.75, 3.5],
    [0, 0.75, 1.5, 2.25, 3, 3.75],
    [0, 1, 1.75, 2.5, 3.25, 3.75]
  ]
};

const CHORD_TYPES = {
  power: { button: 'B', lb: false, dleft: false, type: 'power' },
  triad: { button: 'A', lb: false, dleft: false, type: 'triad' },
  triadInv1: { button: 'X', lb: false, dleft: false, type: 'triad-inv1' },
  triadInv2: { button: 'Y', lb: false, dleft: false, type: 'triad-inv2' },
  sus2: { button: 'A', lb: true, dleft: false, type: 'sus2' },
  sus4: { button: 'X', lb: true, dleft: false, type: 'sus4' },
  seventh: { button: 'Y', lb: true, dleft: false, type: 'seventh' },
  add9: { button: 'B', lb: true, dleft: false, type: 'add9' },
  dim: { button: 'A', lb: false, dleft: true, type: 'dim' },
  halfDim: { button: 'X', lb: false, dleft: true, type: 'half-dim' },
  aug: { button: 'Y', lb: false, dleft: true, type: 'aug' },
  altered: { button: 'B', lb: false, dleft: true, type: 'altered-dom' },
  minor6: { button: 'A', lb: true, dleft: true, type: 'minor6' },
  dim7: { button: 'X', lb: true, dleft: true, type: 'dim7' },
  augMaj7: { button: 'Y', lb: true, dleft: true, type: 'augMaj7' },
  minor9b5: { button: 'B', lb: true, dleft: true, type: 'minor9b5' }
};

const NOTE_BUTTONS = ['A', 'X', 'Y', 'B'];

const createTempoMap = (bpm) => ({ bpm, secondsPerBeat: 60 / bpm });

const getTimingWindows = (tier) => DIFFICULTY_WINDOWS.find((entry) => entry.tier === tier) || DIFFICULTY_WINDOWS[0];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildSections = (rng, tier) => {
  const structure = pickRandom(rng, SECTION_PATTERNS);
  const baseBars = tier < 4 ? 4 : tier < 6 ? 6 : 8;
  return structure.map((name, index) => ({
    name,
    bars: baseBars + (index % 2 === 0 ? 0 : 2)
  }));
};

const selectChordType = (rng, tier) => {
  if (tier === 1) return CHORD_TYPES.power;
  if (tier === 2) return rng() < 0.7 ? CHORD_TYPES.power : pickRandom(rng, [CHORD_TYPES.triad, CHORD_TYPES.triadInv1, CHORD_TYPES.triadInv2]);
  if (tier === 3) return rng() < 0.5 ? CHORD_TYPES.power : pickRandom(rng, [CHORD_TYPES.triad, CHORD_TYPES.triadInv1, CHORD_TYPES.triadInv2]);
  if (tier === 4) return pickRandom(rng, [CHORD_TYPES.triad, CHORD_TYPES.triadInv1, CHORD_TYPES.triadInv2, CHORD_TYPES.sus2, CHORD_TYPES.sus4, CHORD_TYPES.seventh, CHORD_TYPES.add9]);
  if (tier === 5) return pickRandom(rng, [CHORD_TYPES.sus2, CHORD_TYPES.sus4, CHORD_TYPES.seventh, CHORD_TYPES.add9, CHORD_TYPES.dim, CHORD_TYPES.halfDim, CHORD_TYPES.aug, CHORD_TYPES.altered]);
  if (tier === 6) return pickRandom(rng, [CHORD_TYPES.sus2, CHORD_TYPES.sus4, CHORD_TYPES.seventh, CHORD_TYPES.add9, CHORD_TYPES.dim, CHORD_TYPES.halfDim, CHORD_TYPES.aug, CHORD_TYPES.altered, CHORD_TYPES.minor6, CHORD_TYPES.dim7, CHORD_TYPES.augMaj7, CHORD_TYPES.minor9b5]);
  return pickRandom(rng, Object.values(CHORD_TYPES));
};

const selectRhythm = (rng, tier) => {
  if (tier <= 2) return pickRandom(rng, RHYTHM_PATTERNS.simple);
  if (tier <= 4) return pickRandom(rng, RHYTHM_PATTERNS.medium);
  return pickRandom(rng, RHYTHM_PATTERNS.dense);
};

const selectBassRhythm = (rng, tier) => {
  if (tier <= 2) return pickRandom(rng, BASS_RHYTHM_PATTERNS.simple);
  if (tier <= 4) return pickRandom(rng, BASS_RHYTHM_PATTERNS.medium);
  return pickRandom(rng, BASS_RHYTHM_PATTERNS.dense);
};

const shouldUseNoteMode = (rng, tier) => {
  if (tier < 3) return false;
  if (tier === 3) return rng() < 0.45;
  if (tier === 4) return rng() < 0.4;
  return rng() < 0.5;
};

const shouldUseBassNoteMode = (rng, tier) => {
  if (tier < 3) return false;
  if (tier === 3) return rng() < 0.55;
  if (tier === 4) return rng() < 0.65;
  return rng() < 0.75;
};

const createStarPhraseMap = (totalBars) => {
  const phraseBars = new Set();
  for (let bar = 4; bar < totalBars; bar += 8) {
    phraseBars.add(bar);
  }
  return phraseBars;
};

const generateEvents = ({
  rng,
  tier,
  tempo,
  sections,
  progression,
  instrument,
  modeChange
}) => {
  const events = [];
  let beatCursor = 0;
  const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);
  const starPhraseBars = createStarPhraseMap(totalBars);
  const degreePool = progression.length ? progression : [1, 4, 5, 1];
  const drumPattern = [
    { lane: 0, offsets: [0, 2] },
    { lane: 1, offsets: [1, 3] },
    { lane: 2, offsets: [0.5, 1.5, 2.5, 3.5] },
    { lane: 3, offsets: [2.75] }
  ];
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    for (let bar = 0; bar < section.bars; bar += 1) {
      const globalBar = Math.floor(beatCursor / 4);
      const rhythm = selectRhythm(rng, tier);
      const degree = degreePool[(globalBar + bar) % degreePool.length];
      const isPhrase = starPhraseBars.has(globalBar);
      if (instrument === 'drums') {
        drumPattern.forEach((laneDef) => {
          laneDef.offsets.forEach((offset) => {
            if (tier < 4 && laneDef.lane === 3 && rng() < 0.6) return;
            if (tier < 3 && laneDef.lane === 2 && rng() < 0.4) return;
            const timeBeat = beatCursor + offset;
            events.push({
              timeBeat,
              timeSec: timeBeat * tempo.secondsPerBeat,
              lane: laneDef.lane,
              type: 'NOTE',
              requiredInput: {
                mode: 'drum',
                lane: laneDef.lane,
                degree
              },
              starPhrase: isPhrase
            });
          });
        });
      } else {
        const bassSyncopation = instrument === 'bass'
          ? selectBassRhythm(rng, tier)
          : rhythm;
        bassSyncopation.forEach((offset) => {
          const timeBeat = beatCursor + offset;
          if (instrument === 'bass' && rng() < (tier >= 5 ? 0.08 : 0.18)) return;
          let useNoteMode = instrument === 'bass'
            ? shouldUseBassNoteMode(rng, tier)
            : shouldUseNoteMode(rng, tier);
          if (instrument === 'piano') {
            useNoteMode = useNoteMode && rng() < 0.4;
          }
          if (useNoteMode) {
            const button = pickRandom(rng, NOTE_BUTTONS);
            const lb = tier >= 3 && rng() < 0.2;
            const dleft = tier >= 5 && rng() < 0.15;
            const octaveUp = tier >= 3 && rng() < 0.18;
            events.push({
              timeBeat,
              timeSec: timeBeat * tempo.secondsPerBeat,
              lane: NOTE_BUTTONS.indexOf(button),
              type: 'NOTE',
              requiredInput: {
                mode: 'note',
                degree,
                button,
                modifiers: { lb, dleft },
                octaveUp
              },
              starPhrase: isPhrase
            });
          } else {
            const chordType = selectChordType(rng, tier);
            const sustain = tier >= 4 && rng() < 0.18 ? 1 + rng() * 1.5 : 0;
            events.push({
              timeBeat,
              timeSec: timeBeat * tempo.secondsPerBeat,
              lane: NOTE_BUTTONS.indexOf(chordType.button),
              type: 'CHORD',
              requiredInput: {
                mode: 'chord',
                degree,
                button: chordType.button,
                modifiers: { lb: chordType.lb, dleft: chordType.dleft },
                chordType: chordType.type
              },
              sustain,
              starPhrase: isPhrase
            });
          }
        });
      }
      beatCursor += 4;
    }
  }
  return events;
};

export const generateSongData = ({ name, tier, instrument, allowModeChange = false }) => {
  const seed = hashString(name);
  const rng = mulberry32(seed);
  const mode = pickRandom(rng, MODE_LIBRARY);
  const root = Math.floor(rng() * ROOT_LABELS.length);
  const tempoMin = 90 + tier * 6;
  const tempoMax = 120 + tier * 8;
  const bpm = Math.round(rangeRandom(rng, tempoMin, tempoMax));
  const tempo = createTempoMap(bpm);
  const sections = buildSections(rng, tier);
  const progression = pickRandom(rng, PROGRESSIONS);
  const difficulty = clamp(Math.round(1 + tier + rng() * 2), 1, 10);
  const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);
  const modeChange = allowModeChange && rng() < 0.5
    ? {
      beat: Math.floor(totalBars * 4 * 0.6),
      root: Math.floor(rng() * ROOT_LABELS.length),
      mode: pickRandom(rng, MODE_LIBRARY)
    }
    : null;
  const events = generateEvents({
    rng,
    tier,
    tempo,
    sections,
    progression,
    instrument,
    modeChange
  });
  const timing = getTimingWindows(tier);
  return {
    name,
    seed,
    tier,
    instrument,
    root,
    mode,
    tempo,
    progression,
    sections,
    bpm,
    difficulty,
    timing,
    events,
    modeChange,
    tempoRange: { min: tempoMin, max: tempoMax }
  };
};

export const buildRandomName = (seed) => {
  const rng = mulberry32(seed);
  const adjectives = ['Neon', 'Crimson', 'Velvet', 'Chrome', 'Solar', 'Quiet', 'Rift', 'Arc', 'Midnight', 'Golden'];
  const nouns = ['Echo', 'Signal', 'Orbit', 'Pulse', 'Engine', 'Voyager', 'Frequency', 'Vista', 'Machine', 'Nova'];
  const suffixes = ['Run', 'Drive', 'Call', 'Glow', 'Loop', 'Shift', 'Bloom', 'Line', 'Drop', 'Rise'];
  return `${pickRandom(rng, adjectives)} ${pickRandom(rng, nouns)} ${pickRandom(rng, suffixes)}`;
};
