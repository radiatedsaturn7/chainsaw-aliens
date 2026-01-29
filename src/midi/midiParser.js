const getMidiClass = () => {
  const globalMidi = window?.Midi;
  if (!globalMidi) {
    throw new Error('Tonejs MIDI parser is not available. Ensure vendor/midi.min.js is loaded.');
  }
  return globalMidi.Midi || globalMidi;
};

export const parseMidi = (bytes) => {
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
  return {
    notes: notes.sort((a, b) => a.tStartSec - b.tStartSec),
    tempos,
    timeSignature,
    keySignature: keySignature
      ? { key: keySignature.key, scale: keySignature.scale, ticks: keySignature.ticks }
      : null,
    bpm: tempos[0]?.bpm ?? 120
  };
};
