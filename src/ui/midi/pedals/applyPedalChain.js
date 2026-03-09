import { applyPedalProcessor } from './pedalProcessors.js';
import { normalizeMidiPedals } from './normalizeMidiPedals.js';

export const applyPedalChain = ({ notes = [], cc = [], pedals = [], track = null, songSettings = null }) => {
  const normalized = normalizeMidiPedals(pedals);
  let outNotes = notes.map((note) => ({ ...note }));
  let outCc = cc.map((event) => ({ ...event }));
  const applied = [];
  normalized.forEach((pedal) => {
    if (!pedal || pedal.enabled === false) return;
    const result = applyPedalProcessor({
      type: pedal.type,
      notes: outNotes,
      cc: outCc,
      pedal,
      track,
      songSettings
    });
    outNotes = (result.notes || outNotes).map((note) => ({ ...note }));
    outCc = (result.cc || outCc).map((event) => ({ ...event }));
    applied.push(pedal.type);
  });
  return {
    notes: outNotes.sort((a, b) => (a.startTick - b.startTick) || (a.pitch - b.pitch)),
    cc: outCc.sort((a, b) => (a.tick - b.tick) || (a.controller - b.controller)),
    metadata: { appliedPedals: applied }
  };
};
