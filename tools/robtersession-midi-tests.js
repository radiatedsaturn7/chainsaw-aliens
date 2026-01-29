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

  console.log('RobterSESSION MIDI tests passed');
})();
