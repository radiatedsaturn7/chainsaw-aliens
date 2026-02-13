const assert = require('assert');

(async () => {
  const { generateSongData } = await import('../src/robtersession/songGenerator.js');
  const { matchesRequiredInput } = await import('../src/robtersession/inputNormalizer.js');

  const seedName = 'Signal Flare';
  const songA = generateSongData({ name: seedName, tier: 3, instrument: 'guitar', allowModeChange: false });
  const songB = generateSongData({ name: seedName, tier: 3, instrument: 'guitar', allowModeChange: false });

  assert.strictEqual(songA.root, songB.root, 'Root should be deterministic');
  assert.strictEqual(songA.mode.name, songB.mode.name, 'Mode should be deterministic');
  assert.strictEqual(songA.bpm, songB.bpm, 'Tempo should be deterministic');

  const eventsA = songA.events.slice(0, 16).map((event) => ({
    timeBeat: event.timeBeat,
    lane: event.lane,
    type: event.type,
    requiredInput: event.requiredInput
  }));
  const eventsB = songB.events.slice(0, 16).map((event) => ({
    timeBeat: event.timeBeat,
    lane: event.lane,
    type: event.type,
    requiredInput: event.requiredInput
  }));

  assert.deepStrictEqual(eventsA, eventsB, 'First 16 events should be deterministic');

  const firstEvent = songA.events.find((event) => event.requiredInput?.mode !== 'drum');
  assert.ok(firstEvent, 'Expected at least one non-drum event');

  const normalized = {
    degree: firstEvent.requiredInput.degree,
    button: firstEvent.requiredInput.button,
    lb: firstEvent.requiredInput.modifiers?.lb ?? false,
    dleft: firstEvent.requiredInput.modifiers?.dleft ?? false,
    octaveUp: firstEvent.requiredInput.octaveUp ?? false,
    chordType: firstEvent.requiredInput.chordType ?? null
  };

  assert.ok(matchesRequiredInput({
    required: firstEvent.requiredInput,
    normalized,
    mode: firstEvent.requiredInput.mode
  }), 'Input matching should accept exact descriptor');

  console.log('RobterSESSION tests passed');
})();
