const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const quantizeTime = (timeSec, bpm, division = 16, toleranceMs = 15) => {
  const secondsPerBeat = 60 / (bpm || 120);
  const grid = secondsPerBeat / (division / 4);
  const snapped = Math.round(timeSec / grid) * grid;
  const diffMs = Math.abs(snapped - timeSec) * 1000;
  if (diffMs <= toleranceMs) {
    return timeSec;
  }
  return snapped;
};

export const quantizeNotes = (notes, bpm, options = {}) => {
  const division = options.division ?? 16;
  const toleranceMs = options.toleranceMs ?? 15;
  return notes.map((note) => {
    const tStartSec = quantizeTime(note.tStartSec, bpm, division, toleranceMs);
    const tEndSec = Math.max(tStartSec + 0.05, quantizeTime(note.tEndSec, bpm, division, toleranceMs));
    return { ...note, tStartSec, tEndSec };
  });
};

export const buildTiming = (bpm) => ({ bpm, secondsPerBeat: 60 / (bpm || 120) });

export const buildSectionsFromDuration = (totalSeconds, bpm) => {
  const secondsPerBeat = 60 / (bpm || 120);
  const totalBeats = totalSeconds / secondsPerBeat;
  const bars = Math.max(1, Math.ceil(totalBeats / 4));
  return [{
    name: 'song',
    startBeat: 0,
    endBeat: totalBeats,
    bars
  }];
};

export const estimateDifficulty = ({ bpm, events, chordEvents, noteEvents }) => {
  if (!events?.length) return { rating: 1, label: 'Easy' };
  const duration = Math.max(1, events[events.length - 1].timeSec);
  const notesPerMinute = (events.length / duration) * 60;
  const chordiness = chordEvents / events.length;
  const tempoScore = clamp((bpm || 120) / 180, 0, 2);
  const densityScore = clamp(notesPerMinute / 120, 0, 2);
  const chordScore = clamp(chordiness * 2, 0, 2);
  const raw = densityScore * 1.2 + chordScore * 1.1 + tempoScore * 0.8;
  const rating = clamp(Math.ceil(raw * 1.4), 1, 5);
  const label = rating <= 2 ? 'Easy' : rating <= 3 ? 'Medium' : rating <= 4 ? 'Hard' : 'Expert';
  return { rating, label };
};
