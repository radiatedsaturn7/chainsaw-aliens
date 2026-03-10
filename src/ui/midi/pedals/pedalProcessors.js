import { clamp, pushCcCurve } from './ccUtils.js';

const cloneNote = (note) => ({ ...note });
const randomish = (seed) => {
  const x = Math.sin(seed * 9991.17) * 43758.5453;
  return x - Math.floor(x);
};

const processors = {
  octave: ({ notes, pedal }) => {
    const out = notes.map(cloneNote);
    const up = Math.round(clamp(pedal.knobs.up ?? 0, 0, 2));
    const down = Math.round(clamp(pedal.knobs.down ?? 0, 0, 2));
    const mix = clamp(pedal.knobs.mix ?? 0.75, 0, 1);
    notes.forEach((note, idx) => {
      const nudge = ((idx % 2 === 0 ? -1 : 1) * 2);
      if (up > 0) out.push({ ...note, id: `${note.id || idx}-up`, pitch: note.pitch + up * 12, startTick: Math.max(0, note.startTick + nudge), velocity: clamp((note.velocity ?? 0.8) * mix, 0.05, 1) });
      if (down > 0) out.push({ ...note, id: `${note.id || idx}-down`, pitch: note.pitch - down * 12, startTick: Math.max(0, note.startTick - nudge), velocity: clamp((note.velocity ?? 0.8) * mix, 0.05, 1) });
    });
    return { notes: out };
  },
  compressor: ({ notes, pedal }) => ({ notes: notes.map((note, idx) => {
    const threshold = clamp(pedal.knobs.threshold ?? 0.5, 0, 1);
    const ratio = clamp(pedal.knobs.ratio ?? 0.5, 0, 1);
    const makeup = clamp(pedal.knobs.makeup ?? 0.2, 0, 1);
    const v = clamp(note.velocity ?? 0.8, 0.05, 1);
    const over = Math.max(0, v - threshold);
    const under = Math.max(0, threshold - v);
    const compressed = threshold + over * (1 - ratio * 0.9) + under * ratio * 0.55;
    const accent = idx % 4 === 0 ? 0.08 : 0;
    return { ...note, velocity: clamp(compressed + makeup * 0.35 + accent, 0.05, 1) };
  }) }),
  wah: ({ notes, cc, pedal, songSettings }) => {
    const maxTick = Math.max(0, ...notes.map((n) => (n.startTick || 0) + (n.durationTicks || 1)));
    const rate = clamp(pedal.knobs.rate ?? 0.5, 0, 1);
    const sweep = clamp(pedal.knobs.sweep ?? 0.5, 0, 1);
    const mix = clamp(pedal.knobs.mix ?? 0.5, 0, 1);
    const beats = Math.max(1, Math.round(2 + (1 - rate) * 6));
    const beatTicks = songSettings?.ticksPerBeat || 4;
    for (let tick = 0; tick < maxTick + beatTicks; tick += beatTicks * beats) {
      pushCcCurve({ cc, controller: 74, startTick: tick, endTick: tick + beatTicks * beats, steps: 12, fn: (t) => 0.5 + Math.sin(t * Math.PI * 2) * sweep * 0.62 * mix });
    }
    return { notes, cc };
  },
  chorus: ({ notes, pedal }) => {
    const out = notes.map(cloneNote);
    const depth = clamp(pedal.knobs.depth ?? 0.4, 0, 1);
    const spread = clamp(pedal.knobs.spread ?? 0.3, 0, 1);
    const mix = clamp(pedal.knobs.mix ?? 0.6, 0, 1);
    notes.forEach((note, idx) => {
      if (idx % 2 !== 0) return;
      const driftSeed = randomish(idx + (note.pitch || 0));
      out.push({ ...note, id: `${note.id || idx}-ch`, pitch: note.pitch + (idx % 4 === 0 ? 1 : 0), startTick: Math.max(0, note.startTick + Math.round((driftSeed - 0.5) * 10 * depth)), velocity: clamp((note.velocity ?? 0.8) * (0.62 + mix * 0.45 + spread * 0.18), 0.05, 1) });
    });
    return { notes: out };
  },
  eq: ({ notes, cc, pedal }) => {
    const high = clamp(pedal.knobs.high ?? 0.5, 0, 1);
    const presence = clamp(pedal.knobs.presence ?? 0.5, 0, 1);
    const low = clamp(pedal.knobs.low ?? 0.5, 0, 1);
    const mid = clamp(pedal.knobs.mid ?? 0.5, 0, 1);
    const velocityBias = (high - low) * 0.2 + (presence - 0.5) * 0.12;
    const notesOut = notes.map((note) => ({ ...note, velocity: clamp((note.velocity ?? 0.8) + velocityBias + ((note.pitch > 72 ? high : low) - 0.5) * 0.08, 0.05, 1) }));
    cc.push({ tick: 0, controller: 74, value: Math.round(clamp(0.5 + (high - 0.5) * 0.5 + (presence - 0.5) * 0.25 - (mid - 0.5) * 0.15, 0, 1) * 127) });
    return { notes: notesOut, cc };
  },
  overdrive: ({ notes, cc, pedal }) => {
    const drive = clamp(pedal.knobs.drive ?? 0.5, 0, 1);
    const bite = clamp(pedal.knobs.bite ?? 0.5, 0, 1);
    const tone = clamp(pedal.knobs.tone ?? 0.5, 0, 1);
    const notesOut = notes.map((note, idx) => ({ ...note, velocity: clamp((note.velocity ?? 0.8) * (1 + drive * 0.82) + (idx % 3 === 0 ? bite * 0.2 : 0), 0.05, 1), durationTicks: Math.max(1, Math.round((note.durationTicks ?? 1) * (1 - bite * 0.3))) }));
    cc.push({ tick: 0, controller: 74, value: Math.round(clamp(0.35 + tone * 0.62, 0, 1) * 127) });
    return { notes: notesOut, cc };
  },
  reverb: ({ notes, cc, pedal }) => {
    const room = clamp(pedal.knobs.room ?? 0.4, 0, 1);
    const decay = clamp(pedal.knobs.decay ?? 0.5, 0, 1);
    const mix = clamp(pedal.knobs.mix ?? 0.5, 0, 1);
    cc.push({ tick: 0, controller: 91, value: Math.round(clamp(room * 0.6 + decay * 0.3 + mix * 0.35, 0, 1) * 127) });
    cc.push({ tick: 0, controller: 71, value: Math.round(clamp(0.5 + decay * 0.3, 0, 1) * 127) });
    return { notes, cc };
  },
  phaser: ({ notes, cc, pedal, songSettings }) => {
    const maxTick = Math.max(0, ...notes.map((n) => (n.startTick || 0) + (n.durationTicks || 1)));
    const rate = clamp(pedal.knobs.rate ?? 0.5, 0, 1);
    const depth = clamp(pedal.knobs.depth ?? 0.5, 0, 1);
    const mix = clamp(pedal.knobs.mix ?? 0.5, 0, 1);
    const beatTicks = songSettings?.ticksPerBeat || 4;
    const cycle = Math.max(beatTicks, Math.round((1.5 - rate) * beatTicks * 2));
    for (let tick = 0; tick < maxTick + cycle; tick += cycle) {
      pushCcCurve({ cc, controller: 1, startTick: tick, endTick: tick + cycle, steps: 10, fn: (t) => 0.5 + Math.sin(t * Math.PI * 2) * 0.62 * depth * mix });
    }
    return { notes, cc };
  },
  pitchPhaser: ({ notes, pedal, songSettings }) => {
    const beatTicks = songSettings?.ticksPerBeat || 4;
    const phaseSpan = Math.max(beatTicks * 4, Math.round((pedal.knobs.phase ?? 0.5) * beatTicks * 16));
    const up = clamp(pedal.knobs.up ?? 0.6, 0, 1);
    const down = clamp(pedal.knobs.down ?? 0.6, 0, 1);
    const out = notes.map((note) => {
      const phase = Math.sin((note.startTick / phaseSpan) * Math.PI * 2);
      const shift = phase >= 0 ? Math.round(up) : -Math.round(down);
      return { ...note, pitch: note.pitch + shift };
    });
    return { notes: out };
  },
  volumePhaser: ({ notes, pedal, songSettings }) => {
    const beatTicks = songSettings?.ticksPerBeat || 4;
    const phaseSpan = Math.max(beatTicks * 4, Math.round((pedal.knobs.phase ?? 0.5) * beatTicks * 16));
    const minV = clamp(pedal.knobs.down ?? 0.35, 0.05, 1);
    const maxV = clamp(pedal.knobs.up ?? 0.95, 0.05, 1);
    const out = notes.map((note) => {
      const phase = (Math.sin((note.startTick / phaseSpan) * Math.PI * 2) + 1) / 2;
      const v = minV + phase * (maxV - minV);
      return { ...note, velocity: clamp((note.velocity ?? 0.8) * (0.5 + v), 0.05, 1) };
    });
    return { notes: out };
  },
  panPhaser: ({ notes, cc, pedal, songSettings }) => {
    const maxTick = Math.max(0, ...notes.map((n) => (n.startTick || 0) + (n.durationTicks || 1)));
    const beatTicks = songSettings?.ticksPerBeat || 4;
    const phase = clamp(pedal.knobs.phase ?? 0.5, 0, 1);
    const maxL = clamp(pedal.knobs.left ?? 0.85, 0, 1);
    const maxR = clamp(pedal.knobs.right ?? 0.85, 0, 1);
    const cycle = Math.max(beatTicks * 2, Math.round((1.2 - phase) * beatTicks * 6));
    for (let tick = 0; tick < maxTick + cycle; tick += cycle) {
      pushCcCurve({
        cc,
        controller: 10,
        startTick: tick,
        endTick: tick + cycle,
        steps: 12,
        fn: (t) => clamp(0.5 + Math.sin(t * Math.PI * 2) * (t < 0.5 ? maxR : maxL) * 0.48, 0, 1)
      });
    }
    return { notes, cc };
  },
  echo: ({ notes, pedal }) => {
    const out = notes.map(cloneNote);
    const time = clamp(pedal.knobs.time ?? 0.45, 0, 1);
    const feedback = clamp(pedal.knobs.feedback ?? 0.35, 0, 1);
    const mix = clamp(pedal.knobs.mix ?? 0.65, 0, 1);
    const repeats = Math.max(1, Math.round(1 + feedback * 3));
    const delayTicks = Math.max(1, Math.round(2 + time * 12));
    notes.forEach((note, idx) => {
      for (let i = 1; i <= repeats; i += 1) {
        out.push({
          ...note,
          id: `${note.id || idx}-echo-${i}`,
          startTick: note.startTick + delayTicks * i,
          velocity: clamp((note.velocity ?? 0.8) * (mix * (1 - i / (repeats + 1))), 0.05, 1)
        });
      }
    });
    return { notes: out };
  }
};

export const applyPedalProcessor = ({ type, notes, cc, pedal, track, songSettings }) => {
  const proc = processors[type];
  if (!proc) return { notes, cc };
  return proc({ notes, cc, pedal, track, songSettings });
};
