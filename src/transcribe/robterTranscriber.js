import { quantizeNotes, buildTiming, buildSectionsFromDuration, estimateDifficulty } from '../gameplay/eventTrack.js';

const NOTE_LANES = ['X', 'Y', 'A', 'B'];
const NOTE_INPUTS = [
  { button: 'A', base: 1, passing: 2 },
  { button: 'X', base: 3, passing: 4 },
  { button: 'Y', base: 5, passing: 6 },
  { button: 'B', base: 8, passing: 7 }
];

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

// Preferred base fingering per root pitch class (grouped to keep the root stable).
const ROOT_BASE_FINGERING = {
  0: 'A',
  1: 'A',
  2: 'A',
  3: 'X',
  4: 'X',
  5: 'X',
  6: 'Y',
  7: 'Y',
  8: 'Y',
  9: 'B',
  10: 'B',
  11: 'B'
};

// Combo table for alternate voicings; each entry includes a compact fret-span proxy.
// The selection heuristic prefers spans within MAX_FRET_SPAN and keeps the root on
// the preferred base fingering when multiple voicings are viable.
const MAX_FRET_SPAN = 7;
const CHORD_COMBOS = {
  triad: [
    { inputKey: 'triad', intervals: [0, 4, 7], rootPosition: true },
    { inputKey: 'triad-inv1', intervals: [0, 3, 8], rootPosition: false },
    { inputKey: 'triad-inv2', intervals: [0, 5, 9], rootPosition: false }
  ],
  sus2: [{ inputKey: 'sus2', intervals: [0, 2, 7], rootPosition: true }],
  sus4: [{ inputKey: 'sus4', intervals: [0, 5, 7], rootPosition: true }],
  seventh: [{ inputKey: 'seventh', intervals: [0, 4, 7, 10], rootPosition: true }],
  add9: [{ inputKey: 'add9', intervals: [0, 2, 4, 7], rootPosition: true }],
  dim: [{ inputKey: 'dim', intervals: [0, 3, 6], rootPosition: true }],
  aug: [{ inputKey: 'aug', intervals: [0, 4, 8], rootPosition: true }],
  power: [
    { inputKey: 'power', intervals: [0, 7], rootPosition: true },
    { inputKey: 'power', intervals: [0, 5], rootPosition: false }
  ]
};

const CHORD_TEMPLATES = [
  { chordType: 'triad', templates: [[0, 4, 7], [0, 3, 7]] },
  { chordType: 'sus2', templates: [[0, 2, 7]] },
  { chordType: 'sus4', templates: [[0, 5, 7]] },
  { chordType: 'seventh', templates: [[0, 4, 7, 10], [0, 3, 7, 10], [0, 4, 7, 11]] },
  { chordType: 'add9', templates: [[0, 2, 4, 7], [0, 2, 3, 7]] },
  { chordType: 'dim', templates: [[0, 3, 6]] },
  { chordType: 'aug', templates: [[0, 4, 8]] },
  { chordType: 'power', templates: [[0, 7], [0, 5]] }
];

const SCALE_STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10]
};

const PITCH_CLASS_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pitchClassFromLabel = (label) => {
  const normalized = String(label || '').replace(/\s+/g, '');
  if (!normalized) return 0;
  const match = normalized.match(/^([A-Ga-g])([#b]?)/);
  if (!match) return 0;
  const baseMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const base = baseMap[match[1].toUpperCase()] ?? 0;
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (base + accidental + 12) % 12;
};

const detectKeyFromHistogram = (histogram) => {
  const scoreFor = (profile, tonic) => {
    return profile.reduce((sum, value, index) => {
      const pc = (index + tonic) % 12;
      return sum + value * (histogram[pc] || 0);
    }, 0);
  };
  let best = { tonic: 0, mode: 'major', score: -Infinity };
  for (let tonic = 0; tonic < 12; tonic += 1) {
    const majorScore = scoreFor(MAJOR_PROFILE, tonic);
    if (majorScore > best.score) {
      best = { tonic, mode: 'major', score: majorScore };
    }
    const minorScore = scoreFor(MINOR_PROFILE, tonic);
    if (minorScore > best.score) {
      best = { tonic, mode: 'minor', score: minorScore };
    }
  }
  return { tonicPitchClass: best.tonic, mode: best.mode };
};

export const detectKey = ({ keySignature, notes }) => {
  if (keySignature?.key) {
    const tonicPitchClass = pitchClassFromLabel(keySignature.key);
    const mode = keySignature.scale || 'major';
    return { tonicPitchClass, mode };
  }
  const histogram = Array(12).fill(0);
  notes.forEach((note) => {
    const pc = ((note.midi % 12) + 12) % 12;
    const duration = Math.max(0.05, note.tEndSec - note.tStartSec);
    histogram[pc] += duration;
  });
  return detectKeyFromHistogram(histogram);
};

const getScalePitchClasses = (tonicPitchClass, mode) => {
  const steps = SCALE_STEPS[mode] || SCALE_STEPS.major;
  return steps.map((step) => (tonicPitchClass + step) % 12);
};

const mapPitchToScaleDegree = (pitchClass, key) => {
  const scalePcs = getScalePitchClasses(key.tonicPitchClass, key.mode);
  const exactIndex = scalePcs.indexOf(pitchClass);
  if (exactIndex >= 0) {
    return { degree: exactIndex + 1, chromatic: false, dleft: false, approxLevel: 'exact' };
  }
  let best = { degree: 1, diff: Infinity, dleft: false };
  scalePcs.forEach((pc, index) => {
    const diff = (pitchClass - pc + 12) % 12;
    const distance = diff <= 6 ? diff : 12 - diff;
    if (distance < best.diff) {
      best = { degree: index + 1, diff: distance, dleft: diff === 1 };
    }
  });
  return {
    degree: best.degree,
    chromatic: true,
    dleft: best.dleft,
    approxLevel: best.dleft ? 'chromatic-shift' : 'diatonic-snap'
  };
};

const mapDegreeToNoteInput = (degree) => {
  const baseDegree = degree > 8 ? ((degree - 1) % 7) + 1 : degree;
  const entry = NOTE_INPUTS.find((item) => item.base === baseDegree || item.passing === baseDegree) || NOTE_INPUTS[0];
  const modifiers = { lb: entry.passing === baseDegree, dleft: false };
  return { button: entry.button, modifiers };
};

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const resolveInitialOctaveOffset = ({ notes, key, timing, timeSignature }) => {
  if (!notes?.length) return 0;
  const beatsPerBar = timeSignature?.beats || 4;
  const windowEnd = (timing?.secondsPerBeat || 0.5) * beatsPerBar;
  const windowNotes = notes.filter((note) => note.tStartSec < windowEnd);
  const sample = windowNotes.length ? windowNotes : notes;
  if (!sample.length) return 0;
  const steps = SCALE_STEPS[key.mode] || SCALE_STEPS.major;
  const diffs = sample.map((note) => {
    const pc = ((note.midi % 12) + 12) % 12;
    const degreeInfo = mapPitchToScaleDegree(pc, key);
    const step = steps[degreeInfo.degree - 1] ?? steps[0];
    const basePitch = 48 + key.tonicPitchClass + step;
    return Math.round((note.midi - basePitch) / 12);
  });
  return clamp(Math.round(median(diffs)), -2, 2);
};

const resolveOctaveModifier = ({ midi, degree, key, baseOctaveOffset = 0 }) => {
  const steps = SCALE_STEPS[key.mode] || SCALE_STEPS.major;
  const step = steps[degree - 1] ?? steps[0];
  const basePitch = 48 + key.tonicPitchClass + step + baseOctaveOffset * 12;
  const octaveDiff = Math.round((midi - basePitch) / 12);
  const clamped = clamp(octaveDiff, -1, 1);
  return {
    octaveUp: clamped > 0,
    approxLevel: clamped !== octaveDiff ? 'octave-folded' : 'exact'
  };
};

const scoreFingering = ({ inputMap, lastFingering, timeSec }) => {
  const buttonIndex = NOTE_LANES.indexOf(inputMap.button);
  const centerIndex = (NOTE_LANES.length - 1) / 2;
  const stretchCost = Math.abs(buttonIndex - centerIndex);
  const modifierCost = (inputMap.modifiers?.lb ? 0.4 : 0) + (inputMap.modifiers?.dleft ? 0.4 : 0);
  let shiftCost = 0;
  let rapidAlternationCost = 0;
  if (lastFingering) {
    shiftCost = Math.abs(buttonIndex - lastFingering.buttonIndex) * 0.6;
    shiftCost += lastFingering.modifiers?.lb !== inputMap.modifiers?.lb ? 0.3 : 0;
    shiftCost += lastFingering.modifiers?.dleft !== inputMap.modifiers?.dleft ? 0.3 : 0;
    const timeDelta = Math.max(0, timeSec - lastFingering.timeSec);
    if (timeDelta > 0 && timeDelta < 0.4 && lastFingering.buttonIndex !== buttonIndex) {
      rapidAlternationCost = 0.6;
    }
  }
  return stretchCost + modifierCost + shiftCost + rapidAlternationCost;
};

const buildChordCandidates = ({ intervals }) => {
  const intervalSet = new Set(intervals);
  const candidates = [];
  CHORD_TEMPLATES.forEach((entry) => {
    entry.templates.forEach((template) => {
      if (template.length !== intervals.length) return;
      const matches = template.every((interval) => intervalSet.has(interval));
      if (!matches) return;
      const inputMap = CHORD_INPUTS[entry.chordType];
      if (inputMap) {
        candidates.push({ chordType: entry.chordType, inputMap, template });
      }
      if (entry.chordType === 'triad') {
        ['triad-inv1', 'triad-inv2'].forEach((variant) => {
          const variantMap = CHORD_INPUTS[variant];
          if (variantMap) {
            candidates.push({ chordType: variant, inputMap: variantMap, template });
          }
        });
      }
    });
  });
  return candidates;
};

const groupNotes = (notes, { clusterWindow = 0.03, arpeggioWindow = 0.2 } = {}) => {
  const clusters = [];
  let index = 0;
  while (index < notes.length) {
    const anchor = notes[index];
    const cluster = [anchor];
    let nextIndex = index + 1;
    while (nextIndex < notes.length && notes[nextIndex].tStartSec - anchor.tStartSec <= clusterWindow) {
      cluster.push(notes[nextIndex]);
      nextIndex += 1;
    }
    if (cluster.length === 1) {
      const arpeggio = [anchor];
      let lookahead = nextIndex;
      while (lookahead < notes.length && notes[lookahead].tStartSec - anchor.tStartSec <= arpeggioWindow) {
        arpeggio.push(notes[lookahead]);
        lookahead += 1;
      }
      if (arpeggio.length >= 3) {
        clusters.push({ notes: arpeggio, arpeggio: true });
        index = lookahead;
        continue;
      }
    }
    clusters.push({ notes: cluster, arpeggio: false });
    index = nextIndex;
  }
  return clusters;
};

const trimOverlappingNotes = (notes) => {
  const sorted = notes
    .map((note) => ({ ...note }))
    .sort((a, b) => a.tStartSec - b.tStartSec);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (next.tStartSec < current.tEndSec) {
      current.tEndSec = Math.max(current.tStartSec, next.tStartSec);
    }
  }
  return sorted;
};

const detectChordType = (pcs) => {
  if (!pcs.length) return null;
  const intervals = Array.from(new Set(pcs.map((pc) => (pc - pcs[0] + 12) % 12))).sort((a, b) => a - b);
  const intervalSet = new Set(intervals);
  let best = null;
  CHORD_TEMPLATES.forEach((entry) => {
    entry.templates.forEach((template) => {
      const templateSet = new Set(template);
      const matches = template.filter((interval) => intervalSet.has(interval)).length;
      const union = new Set([...intervals, ...template]).size;
      const score = union ? matches / union : 0;
      if (!best
        || score > best.score
        || (score === best.score && matches > best.matches)
        || (score === best.score && matches === best.matches && template.length > best.templateLength)) {
        best = {
          chordType: entry.chordType,
          score,
          matches,
          templateLength: template.length,
          template
        };
      }
    });
  });
  if (!best || best.score < 0.5) return null;
  const exact = best.score === 1 && intervals.length === best.templateLength;
  const approx = exact ? 'exact' : (best.chordType === 'power' ? 'power-chord-fallback' : 'simplified');
  return {
    chordType: best.chordType,
    approx,
    score: best.score,
    template: best.template
  };
};

const mapDrumPitchToLane = (midi) => {
  if (midi <= 36) return 0; // kick
  if (midi <= 40) return 1; // snare
  if (midi <= 46) return 2; // hats
  return 3; // cymbals
};

const analyzeChord = (notes) => {
  const sorted = [...notes].sort((a, b) => a.midi - b.midi);
  const pitchClasses = Array.from(new Set(sorted.map((note) => ((note.midi % 12) + 12) % 12)));
  if (!pitchClasses.length) return null;
  const bassPc = ((sorted[0].midi % 12) + 12) % 12;
  let best = null;
  pitchClasses.forEach((candidatePc) => {
    const pcsForRoot = [candidatePc, ...pitchClasses.filter((pc) => pc !== candidatePc)];
    const chordInfo = detectChordType(pcsForRoot);
    if (!chordInfo) return;
    const score = chordInfo.score ?? 0;
    const isBass = candidatePc === bassPc;
    if (!best
      || score > best.score
      || (score === best.score && isBass && !best.isBass)) {
      best = {
        rootPc: candidatePc,
        chordInfo,
        score,
        isBass
      };
    }
  });
  if (!best) {
    return { rootPc: bassPc, chordInfo: null };
  }
  return { rootPc: best.rootPc, chordInfo: best.chordInfo };
};

const selectChordInput = ({ rootPc, chordInfo }) => {
  const preferredButton = ROOT_BASE_FINGERING[rootPc] || CHORD_INPUTS[chordInfo.chordType]?.button || 'A';
  const baseCombos = CHORD_COMBOS[chordInfo.chordType] || [
    { inputKey: chordInfo.chordType, intervals: chordInfo.template || [0] }
  ];
  const combos = baseCombos.map((combo) => {
    const span = Math.max(...combo.intervals) - Math.min(...combo.intervals);
    const button = CHORD_INPUTS[combo.inputKey]?.button || preferredButton;
    return { ...combo, span, button };
  });
  const viable = combos.filter((combo) => combo.span <= MAX_FRET_SPAN);
  const candidates = viable.length ? viable : combos;
  let best = candidates[0];
  candidates.forEach((combo) => {
    const rootStable = combo.button === preferredButton;
    const bestRootStable = best.button === preferredButton;
    if (rootStable && !bestRootStable) {
      best = combo;
      return;
    }
    if (rootStable === bestRootStable) {
      if (combo.rootPosition && !best.rootPosition) {
        best = combo;
        return;
      }
      if (combo.rootPosition === best.rootPosition && combo.span < best.span) {
        best = combo;
      }
    }
  });
  const inputKey = best?.inputKey || chordInfo.chordType;
  const inputMap = CHORD_INPUTS[inputKey] || CHORD_INPUTS.triad;
  return { inputKey, inputMap };
};

export const transcribeMidiStem = ({
  notes,
  bpm,
  keySignature,
  timeSignature,
  isDrumStem = false,
  options = {}
}) => {
  const key = detectKey({ keySignature, notes });
  const timing = buildTiming(bpm || 120);
  const quantized = quantizeNotes(notes, bpm || 120, options.quantize);
  const processedNotes = options.trimOverlaps ? trimOverlappingNotes(quantized) : quantized;
  const octaveOffset = resolveInitialOctaveOffset({
    notes: processedNotes,
    key,
    timing,
    timeSignature
  });
  const clusters = groupNotes(processedNotes, options.grouping);
  const events = [];
  let lastChordFingering = null;
  let approxCounts = {
    exact: 0,
    'diatonic-snap': 0,
    'chromatic-shift': 0,
    'power-chord-fallback': 0,
    'octave-folded': 0,
    simplified: 0,
    'root-fallback': 0
  };

  const pushNoteEvent = (note, { approxOverride = null } = {}) => {
    const startSec = note.tStartSec;
    const endSec = note.tEndSec;
    const duration = Math.max(0.05, endSec - startSec);
    const timeBeat = startSec / timing.secondsPerBeat;
    const pc = ((note.midi % 12) + 12) % 12;
    const degreeInfo = mapPitchToScaleDegree(pc, key);
    const octaveInfo = resolveOctaveModifier({
      midi: note.midi,
      degree: degreeInfo.degree,
      key,
      baseOctaveOffset: octaveOffset
    });
    const inputMap = mapDegreeToNoteInput(degreeInfo.degree);
    const derivedApprox = [degreeInfo.approxLevel, octaveInfo.approxLevel].find((entry) => entry !== 'exact') || 'exact';
    const approxLevel = approxOverride || derivedApprox;
    approxCounts[approxLevel] = (approxCounts[approxLevel] || 0) + 1;
    events.push({
      timeBeat,
      timeSec: startSec,
      lane: NOTE_LANES.indexOf(inputMap.button),
      type: 'NOTE',
      section: 'song',
      requiredInput: {
        mode: 'note',
        degree: 1,
        button: inputMap.button,
        modifiers: { ...inputMap.modifiers, dleft: degreeInfo.dleft },
        octaveUp: octaveInfo.octaveUp
      },
      sustain: duration / timing.secondsPerBeat,
      originalNotes: [note.midi],
      approxLevel,
      recommendedMode: 'note'
    });
  };

  clusters.forEach((cluster) => {
    const startSec = cluster.notes[0].tStartSec;
    const endSec = Math.max(...cluster.notes.map((n) => n.tEndSec));
    const duration = Math.max(0.05, endSec - startSec);
    const timeBeat = startSec / timing.secondsPerBeat;
    if (isDrumStem) {
      const lane = mapDrumPitchToLane(cluster.notes[0].midi);
      events.push({
        timeBeat,
        timeSec: startSec,
        lane,
        type: 'DRUM',
        section: 'song',
        requiredInput: { mode: 'drum', lane },
        sustain: duration / timing.secondsPerBeat,
        originalNotes: cluster.notes.map((note) => note.midi),
        approxLevel: 'exact',
        recommendedMode: 'drum'
      });
      approxCounts.exact += 1;
      return;
    }

    if (cluster.arpeggio) {
      cluster.notes.forEach((note) => pushNoteEvent(note));
      return;
    }

    if (options.forceNoteMode) {
      cluster.notes.forEach((note) => pushNoteEvent(note));
      return;
    }

    if (cluster.notes.length >= 2) {
      const analysis = analyzeChord(cluster.notes);
      const rootPc = analysis?.rootPc ?? ((cluster.notes[0].midi % 12) + 12) % 12;
      const chordInfo = analysis?.chordInfo;
      if (!chordInfo) {
        const sorted = [...cluster.notes].sort((a, b) => a.midi - b.midi);
        pushNoteEvent(sorted[0], { approxOverride: 'root-fallback' });
        return;
      }
      const degreeInfo = mapPitchToScaleDegree(rootPc, key);
      const { inputKey, inputMap } = selectChordInput({ rootPc, chordInfo });
      const chordType = inputKey || chordInfo.chordType;
      const approxLevel = degreeInfo.approxLevel !== 'exact'
        ? degreeInfo.approxLevel
        : chordInfo.approx;
      const sorted = [...cluster.notes].sort((a, b) => a.midi - b.midi);
      const chordRootPc = ((sorted[0].midi % 12) + 12) % 12;
      const pcs = Array.from(new Set(sorted.map((note) => ((note.midi % 12) + 12) % 12)))
        .sort((a, b) => (a - chordRootPc + 12) % 12 - (b - chordRootPc + 12) % 12);
      const intervals = pcs.map((pc) => (pc - chordRootPc + 12) % 12).sort((a, b) => a - b);
      const chordCandidates = buildChordCandidates({ intervals });
      if (!chordCandidates.length) {
        const chordInfo = detectChordType([chordRootPc, ...pcs.filter((pc) => pc !== chordRootPc)]);
        if (!chordInfo) {
          pushNoteEvent(sorted[0], { approxOverride: 'root-fallback' });
          return;
        }
        const degreeInfo = mapPitchToScaleDegree(chordRootPc, key);
        const chordType = chordInfo.chordType;
        const inputMap = CHORD_INPUTS[chordType] || CHORD_INPUTS.triad;
        const approxLevel = degreeInfo.approxLevel !== 'exact'
          ? degreeInfo.approxLevel
          : chordInfo.approx;
        approxCounts[approxLevel] = (approxCounts[approxLevel] || 0) + 1;
        events.push({
          timeBeat,
          timeSec: startSec,
          lane: NOTE_LANES.indexOf(inputMap.button),
          type: 'CHORD',
          section: 'song',
          requiredInput: {
            mode: 'chord',
            degree: degreeInfo.degree,
            button: inputMap.button,
            modifiers: inputMap.modifiers,
            chordType
          },
          sustain: duration / timing.secondsPerBeat,
          originalNotes: cluster.notes.map((note) => note.midi),
          approxLevel,
          recommendedMode: 'chord'
        });
        lastChordFingering = {
          buttonIndex: NOTE_LANES.indexOf(inputMap.button),
          modifiers: inputMap.modifiers,
          timeSec: startSec
        };
        return;
      }
      const degreeInfo = mapPitchToScaleDegree(rootPc, key);
      const scoredCandidates = chordCandidates.map((candidate) => {
        return {
          ...candidate,
          score: scoreFingering({
            inputMap: candidate.inputMap,
            lastFingering: lastChordFingering,
            timeSec: startSec
          })
        };
      });
      scoredCandidates.sort((a, b) => a.score - b.score);
      const chosen = scoredCandidates[0];
      const approxLevel = degreeInfo.approxLevel !== 'exact' ? degreeInfo.approxLevel : 'exact';
      approxCounts[approxLevel] = (approxCounts[approxLevel] || 0) + 1;
      console.debug('robter chord fingering', {
        intervals,
        chordType: chosen.chordType,
        button: chosen.inputMap.button,
        modifiers: chosen.inputMap.modifiers,
        score: chosen.score,
        candidates: scoredCandidates.map((candidate) => ({
          chordType: candidate.chordType,
          button: candidate.inputMap.button,
          modifiers: candidate.inputMap.modifiers,
          score: candidate.score
        }))
      });
      events.push({
        timeBeat,
        timeSec: startSec,
        lane: NOTE_LANES.indexOf(chosen.inputMap.button),
        type: 'CHORD',
        section: 'song',
        requiredInput: {
          mode: 'chord',
          degree: degreeInfo.degree,
          button: chosen.inputMap.button,
          modifiers: chosen.inputMap.modifiers,
          chordType: chosen.chordType
        },
        sustain: duration / timing.secondsPerBeat,
        originalNotes: cluster.notes.map((note) => note.midi),
        approxLevel,
        recommendedMode: 'chord'
      });
      lastChordFingering = {
        buttonIndex: NOTE_LANES.indexOf(chosen.inputMap.button),
        modifiers: chosen.inputMap.modifiers,
        timeSec: startSec
      };
      return;
    }

    pushNoteEvent(cluster.notes[0]);
  });

  const orderedEvents = events.sort((a, b) => a.timeSec - b.timeSec);
  const chordEvents = orderedEvents.filter((event) => event.type === 'CHORD').length;
  const noteEvents = orderedEvents.length - chordEvents;
  const difficulty = estimateDifficulty({ bpm, events: orderedEvents, chordEvents, noteEvents });
  const totalDuration = orderedEvents.length ? orderedEvents[orderedEvents.length - 1].timeSec : 0;
  return {
    events: orderedEvents,
    key,
    timing,
    recommendedOctaveOffset: octaveOffset,
    stats: {
      total: orderedEvents.length,
      chordEvents,
      noteEvents,
      approxCounts,
      difficulty
    },
    sections: buildSectionsFromDuration(totalDuration, bpm)
  };
};

export const formatKeyLabel = ({ tonicPitchClass, mode }) => {
  const label = PITCH_CLASS_LABELS[tonicPitchClass] || 'C';
  return `${label} ${mode === 'minor' ? 'Minor' : 'Major'}`;
};
