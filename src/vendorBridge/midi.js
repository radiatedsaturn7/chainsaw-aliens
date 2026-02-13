const MIDI_SCRIPT_PATH = 'vendor/midi.min.js';

export const getMidiNamespace = () => {
  const midiNamespace = globalThis?.Midi;
  if (!midiNamespace) {
    throw new Error(
      `MIDI parser is unavailable. Expected script "${MIDI_SCRIPT_PATH}" to be loaded before using MIDI features.`
    );
  }
  return midiNamespace;
};

export const getMidiClass = () => {
  const midiNamespace = getMidiNamespace();
  const MidiClass = midiNamespace.Midi || midiNamespace;
  if (typeof MidiClass !== 'function') {
    throw new Error(
      `MIDI parser is invalid. Expected "${MIDI_SCRIPT_PATH}" to expose Midi constructor at window.Midi or window.Midi.Midi.`
    );
  }
  return MidiClass;
};
