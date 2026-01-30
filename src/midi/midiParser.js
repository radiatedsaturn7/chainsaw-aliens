const DEFAULT_INGESTION_OPTIONS = {
  gridDivisions: 16,
  minNoteBeats: 1 / 32,
  mergeGapBeats: 1 / 32,
  normalizeVelocity: true,
  velocityValue: 0.8,
  preserveFeel: false
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const quantizeTime = (time, stepSeconds, preserveFeel) => {
  if (preserveFeel || !stepSeconds) return Math.max(0, time);
  return Math.max(0, Math.round(time / stepSeconds) * stepSeconds);
};

const normalizeMidiNotes = (notes, { bpm, timeSignature, ...options } = {}) => {
  const config = { ...DEFAULT_INGESTION_OPTIONS, ...options };
  const secondsPerBeat = 60 / (bpm || 120);
  const beatsPerBar = timeSignature?.beats || 4;
  const gridDivisions = Math.max(1, Number(config.gridDivisions) || DEFAULT_INGESTION_OPTIONS.gridDivisions);
  const stepSeconds = secondsPerBeat * (beatsPerBar / gridDivisions);
  const minNoteSeconds = Math.max(secondsPerBeat * config.minNoteBeats, 0.02);
  const mergeGapSeconds = Math.max(secondsPerBeat * config.mergeGapBeats, 0);

  const quantized = notes.map((note) => {
    const start = quantizeTime(note.tStartSec, stepSeconds, config.preserveFeel);
    const end = quantizeTime(note.tEndSec, stepSeconds, config.preserveFeel);
    const safeEnd = end <= start && !config.preserveFeel ? start + stepSeconds : Math.max(end, start);
    return {
      ...note,
      tStartSec: start,
      tEndSec: safeEnd,
      vel: config.normalizeVelocity ? clamp(config.velocityValue, 0.05, 1) : clamp(note.vel, 0, 1)
    };
  });

  const sorted = quantized.sort((a, b) => a.tStartSec - b.tStartSec);
  const filtered = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const note = { ...sorted[i] };
    const duration = Math.max(0, note.tEndSec - note.tStartSec);
    const isMicro = duration < minNoteSeconds;
    if (isMicro) {
      const prev = filtered[filtered.length - 1];
      if (prev
        && prev.midi === note.midi
        && prev.channel === note.channel
        && prev.program === note.program
        && note.tStartSec - prev.tEndSec <= mergeGapSeconds) {
        prev.tEndSec = Math.max(prev.tEndSec, note.tEndSec);
        continue;
      }
      const next = sorted[i + 1];
      if (next
        && next.midi === note.midi
        && next.channel === note.channel
        && next.program === note.program
        && next.tStartSec - note.tEndSec <= mergeGapSeconds) {
        next.tStartSec = Math.min(note.tStartSec, next.tStartSec);
        continue;
      }
      continue;
    }
    if (note.tEndSec <= note.tStartSec) {
      note.tEndSec = note.tStartSec + Math.max(stepSeconds || minNoteSeconds, minNoteSeconds);
    }
    filtered.push(note);
  }
  return filtered;
};

const getMidiClass = () => {
  const globalMidi = window?.Midi;
  if (!globalMidi) {
    throw new Error('Tonejs MIDI parser is not available. Ensure vendor/midi.min.js is loaded.');
  }
  return globalMidi.Midi || globalMidi;
};

export const buildMidiBytes = ({
  notes = [],
  bpm = 120,
  timeSignature = null,
  keySignature = null,
  program = null,
  channel = 0
} = {}) => {
  const MidiClass = getMidiClass();
  const midi = new MidiClass();
  if (Number.isFinite(bpm)) {
    midi.header.setTempo(bpm);
  }
  if (timeSignature?.beats && timeSignature?.unit) {
    midi.header.timeSignatures.push({
      ticks: 0,
      timeSignature: [timeSignature.beats, timeSignature.unit]
    });
  }
  if (keySignature?.key) {
    midi.header.keySignatures.push({
      ticks: 0,
      key: keySignature.key,
      scale: keySignature.scale || 'major'
    });
  }
  const track = midi.addTrack();
  track.channel = Number.isFinite(channel) ? channel : 0;
  if (Number.isFinite(program)) {
    track.instrument.number = program;
  }
  notes.forEach((note) => {
    const start = Math.max(0, note.tStartSec ?? note.time ?? 0);
    const duration = Math.max(0.05, (note.tEndSec ?? start) - start);
    track.addNote({
      midi: note.midi,
      time: start,
      duration,
      velocity: clamp(Number.isFinite(note.vel) ? note.vel : 0.8, 0.05, 1)
    });
  });
  return midi.toArray();
};

export const parseMidi = (bytes, options = {}) => {
  const MidiClass = getMidiClass();
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const midi = new MidiClass(data);
  const tempos = midi.header.tempos?.length
    ? midi.header.tempos.map((entry) => ({ bpm: entry.bpm, time: entry.time, ticks: entry.ticks }))
    : [{ bpm: 120, time: 0, ticks: 0 }];
  const timeSignatureEntry = midi.header.timeSignatures?.[0] || null;
  const timeSignature = timeSignatureEntry
    ? { beats: timeSignatureEntry.timeSignature[0], unit: timeSignatureEntry.timeSignature[1] }
    : { beats: 4, unit: 4 };
  const keySignature = midi.header.keySignatures?.[0] || null;
  const notes = [];
  midi.tracks.forEach((track) => {
    const channel = Number.isFinite(track.channel) ? track.channel : 0;
    const program = track.instrument?.number ?? null;
    track.notes.forEach((note) => {
      notes.push({
        tStartSec: note.time,
        tEndSec: note.time + note.duration,
        midi: note.midi,
        vel: note.velocity,
        channel: note.channel ?? channel,
        program
      });
    });
  });
  const normalizedNotes = normalizeMidiNotes(notes, {
    bpm: tempos[0]?.bpm ?? 120,
    timeSignature,
    ...options
  });
  return {
    notes: normalizedNotes.sort((a, b) => a.tStartSec - b.tStartSec),
    tempos,
    timeSignature,
    keySignature: keySignature
      ? { key: keySignature.key, scale: keySignature.scale, ticks: keySignature.ticks }
      : null,
    bpm: tempos[0]?.bpm ?? 120
  };
};
