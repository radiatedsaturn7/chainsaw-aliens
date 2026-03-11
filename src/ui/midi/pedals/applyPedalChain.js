import { normalizeMidiPedals } from './normalizeMidiPedals.js';

export const applyPedalChain = ({ notes = [], cc = [], pedals = [], track = null, songSettings = null }) => {
  const normalized = normalizeMidiPedals(pedals)
    .filter((pedal) => pedal && pedal.enabled !== false)
    .map((pedal) => ({ ...pedal, knobs: { ...(pedal.knobs || {}) } }));
  return {
    notes: notes.map((note) => ({ ...note })).sort((a, b) => (a.startTick - b.startTick) || (a.pitch - b.pitch)),
    cc: cc.map((event) => ({ ...event })).sort((a, b) => (a.tick - b.tick) || (a.controller - b.controller)),
    metadata: {
      appliedPedals: normalized.map((pedal) => pedal.type),
      dspPedals: normalized,
      track,
      songSettings
    }
  };
};
