const assert = require('assert');

(async () => {
  const { detectKey, transcribeMidiStem } = await import('../src/transcribe/robterTranscriber.js');

  const buildNote = (midi, tStartSec = 0, tEndSec = 1) => ({ midi, tStartSec, tEndSec, vel: 0.8, channel: 0 });

  const keyNotes = [
    buildNote(60, 0, 1), // C4
    buildNote(64, 1, 2), // E4
    buildNote(67, 2, 3)  // G4
  ];

  const key = detectKey({ keySignature: null, notes: keyNotes });
  assert.strictEqual(key.tonicPitchClass, 0, 'Expected tonic C pitch class');
  assert.strictEqual(key.mode, 'major', 'Expected major mode');

  const chordNotes = [
    buildNote(60, 0, 1),
    buildNote(64, 0, 1),
    buildNote(67, 0, 1)
  ];
  const transcribed = transcribeMidiStem({ notes: chordNotes, bpm: 120, keySignature: null, isDrumStem: false });
  assert.ok(transcribed.events.length > 0, 'Expected events for chord');
  assert.strictEqual(transcribed.events[0].requiredInput.chordType, 'triad', 'Expected triad chord mapping');

  const powerNotes = [
    buildNote(60, 0, 1),
    buildNote(67, 0, 1)
  ];
  const power = transcribeMidiStem({ notes: powerNotes, bpm: 120, keySignature: null, isDrumStem: false });
  assert.strictEqual(power.events[0].requiredInput.chordType, 'power', 'Expected power chord mapping');

  const arpeggioNotes = [
    buildNote(60, 0, 0.4),
    buildNote(64, 0.08, 0.48),
    buildNote(67, 0.16, 0.6)
  ];
  const arpeggio = transcribeMidiStem({ notes: arpeggioNotes, bpm: 120, keySignature: null, isDrumStem: false });
  assert.strictEqual(arpeggio.events.length, 3, 'Expected arpeggio notes to preserve rhythm');
  assert.ok(arpeggio.events.every((event) => event.type === 'NOTE'), 'Expected arpeggio notes to be notes');

  const unsupportedNotes = [
    buildNote(60, 0, 1),
    buildNote(61, 0, 1)
  ];
  const unsupported = transcribeMidiStem({ notes: unsupportedNotes, bpm: 120, keySignature: null, isDrumStem: false });
  assert.strictEqual(unsupported.events[0].type, 'NOTE', 'Expected unsupported chord to fall back to a note');
  assert.strictEqual(unsupported.events[0].approxLevel, 'root-fallback', 'Expected root note fallback for unsupported chord');

  console.log('RobterSESSION MIDI tests passed');
})();
