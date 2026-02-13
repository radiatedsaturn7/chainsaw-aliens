export const parseNoteOctave = (noteLabel) => {
  const match = String(noteLabel || '').match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const octave = Number(match[3]);
  return Number.isFinite(octave) ? octave : null;
};

export const trimOverlappingMidiNotes = (notes) => {
  const sorted = notes
    .map((note) => ({ ...note }))
    .sort((a, b) => a.tStartSec - b.tStartSec);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const samePitch = next.midi === current.midi
      && (next.channel ?? null) === (current.channel ?? null)
      && (next.program ?? null) === (current.program ?? null);
    if (samePitch && next.tStartSec < current.tEndSec) {
      current.tEndSec = Math.max(current.tStartSec, next.tStartSec);
    }
  }
  return sorted;
};
