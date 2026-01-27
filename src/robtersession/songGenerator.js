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

const STRUCTURE_PATTERNS = {
  beginner: ['VVCC', 'IVVCC', 'VVCCO'],
  easy: ['VVCCB', 'IVVCCO', 'VVCCbO'],
  mid: ['IVVPCcB', 'VVPCcB', 'IVVCCB'],
  hard: ['IVVPCcBS', 'VVCCBS', 'IVVCCBS'],
  expert: ['IVVPCCbSO', 'IVVPCCbS', 'IVVPCcBO']
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
    [1, 5, 4, 5],
    [1, 4, 5, 1],
    [1, 4, 1, 5]
  ],
  easy: [
    [1, 5, 6, 4],
    [1, 6, 4, 5],
    [1, 4, 6, 5]
  ],
  mid: [
    [1, 5, 6, 4],
    [1, 4, 2, 5],
    [6, 4, 1, 5]
  ],
  hard: [
    [1, 4, 2, 5],
    [6, 4, 1, 5],
    [1, 5, 6, 4]
  ],
  expert: [
    [1, 4, 2, 5],
    [6, 4, 1, 5],
    [1, 5, 6, 4]
  ]
};

const PRECHORUS_POOL = [
  [2, 4, 5],
  [6, 4, 5],
  [2, 5, 5]
];

const BRIDGE_BORROW_POOL = [
  ['bVII', 'bVI'],
  ['bVI', 'bVII'],
  ['bIII', 'bVII']
];

const CHORD_COLORS = ['sus2', 'sus4', '7', 'add9', 'm7', 'maj7'];
const NOTE_LANES = ['A', 'X', 'Y', 'B'];
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

const resolveTierLabel = (difficulty) => {
  if (difficulty <= 3) return 'beginner';
  if (difficulty <= 5) return 'easy';
  if (difficulty <= 7) return 'mid';
  if (difficulty <= 8) return 'hard';
  return 'expert';
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
  const match = String(degree).match(/^(b|#)?(\d)$/);
  if (!match) return { degree: 1, accidental: 0 };
  const accidental = match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0;
  return { degree: Number(match[2]), accidental };
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

const buildSongSections = ({
  rng,
  structure,
  rootPc,
  mode,
  difficulty,
  tierLabel
}) => {
  const sections = {};
  const allowPower = difficulty <= 3;
  const allowColor = difficulty >= 4;
  const allowInversion = difficulty >= 6;
  const progressionPool = PROGRESSION_POOLS[tierLabel] || PROGRESSION_POOLS.easy;
  const verseProgression = pickRandom(rng, progressionPool);
  const chorusProgression = pickRandom(rng, progressionPool);
  const prechorusProgression = pickRandom(rng, PRECHORUS_POOL);
  const bridgeProgression = difficulty >= 8 ? pickRandom(rng, BRIDGE_BORROW_POOL) : pickRandom(rng, progressionPool);
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

const buildChordEventsFromSchema = ({ schema, tempo, instrument }) => {
  const events = [];
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
        const inputMap = CHORD_INPUTS[chordType] || CHORD_INPUTS.triad;
        const lane = NOTE_LANES.indexOf(inputMap.button);
        const timeBeat = barStartBeat + beatOffset;
        events.push({
          timeBeat,
          timeSec: timeBeat * tempo.secondsPerBeat,
          lane: lane >= 0 ? lane : 0,
          type: 'CHORD',
          section: section.name,
          requiredInput: {
            mode: instrument === 'drums' ? 'drum' : 'chord',
            degree,
            button: inputMap.button,
            modifiers: inputMap.modifiers,
            chordType
          },
          sustain: duration,
          starPhrase: isPhrase
        });
        beatOffset += duration;
      });
    });
  });
  return { events, sections };
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
        { lane: 0, offsets: drumPattern.kick },
        { lane: 1, offsets: drumPattern.snare },
        { lane: 2, offsets: drumPattern.hat },
        { lane: 3, offsets: drumPattern.cymbal }
      ];
      laneMap.forEach((laneDef) => {
        laneDef.offsets.forEach((offset) => {
          const timeBeat = barStartBeat + offset;
          events.push({
            timeBeat,
            timeSec: timeBeat * tempo.secondsPerBeat,
            lane: laneDef.lane,
            type: 'NOTE',
            section: section.name,
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
    tierLabel
  });
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
    sections
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

const buildTracksFromSchema = ({ rng, tier, instrument, schema }) => {
  const tempo = createTempoMap(schema.tempo_bpm);
  const { events, sections } = buildChordEventsFromSchema({ schema, tempo, instrument });
  const tracks = {};
  INSTRUMENTS.forEach((trackInstrument) => {
    if (trackInstrument === 'drums') {
      tracks[trackInstrument] = buildDrumEvents({ rng, tier, tempo, sections });
    } else {
      tracks[trackInstrument] = buildChordEventsFromSchema({ schema, tempo, instrument: trackInstrument }).events;
    }
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
