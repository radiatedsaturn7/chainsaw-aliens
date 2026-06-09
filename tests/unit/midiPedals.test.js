import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getGmSustainProfile } from '../../src/game/Audio.js';
import { PEDAL_DEFINITION_BY_TYPE } from '../../src/ui/midi/pedals/pedalDefinitions.js';
import { createDefaultPedal } from '../../src/ui/midi/pedals/pedalDefaults.js';
import { PEDAL_SIGNAL_CHAIN_ORDER, normalizeMidiPedals, sortMidiPedalsBySignalChain } from '../../src/ui/midi/pedals/normalizeMidiPedals.js';

const audioSource = readFileSync(new URL('../../src/game/Audio.js', import.meta.url), 'utf8');
const midiComposerSource = readFileSync(new URL('../../src/ui/MidiComposerCore.js', import.meta.url), 'utf8');
const robterSessionSource = readFileSync(new URL('../../src/robtersession/RobterSession.js', import.meta.url), 'utf8');

test('board-ready MIDI pedals are available with safe defaults', () => {
  for (const type of ['studioEq', 'tape', 'limiter']) {
    assert.ok(PEDAL_DEFINITION_BY_TYPE[type], `${type} definition exists`);
    const pedal = createDefaultPedal(type);
    assert.equal(pedal.type, type);
    assert.equal(pedal.enabled, true);
    assert.ok(Object.keys(pedal.knobs).length >= 3);
  }

  assert.equal(createDefaultPedal('reverb').knobs.mix <= 0.34, true);
  assert.equal(createDefaultPedal('echo').knobs.feedback <= 0.24, true);
  assert.equal(createDefaultPedal('wah').knobs.mix <= 0.48, true);
  assert.equal(createDefaultPedal('overdrive').knobs.drive <= 0.42, true);
});

test('MIDI pedal signal chain puts polish before space and limiter last', () => {
  assert.equal(PEDAL_SIGNAL_CHAIN_ORDER.at(-1), 'limiter');
  assert.ok(PEDAL_SIGNAL_CHAIN_ORDER.indexOf('studioEq') < PEDAL_SIGNAL_CHAIN_ORDER.indexOf('wah'));
  assert.ok(PEDAL_SIGNAL_CHAIN_ORDER.indexOf('tape') < PEDAL_SIGNAL_CHAIN_ORDER.indexOf('echo'));
  assert.ok(PEDAL_SIGNAL_CHAIN_ORDER.indexOf('echo') < PEDAL_SIGNAL_CHAIN_ORDER.indexOf('reverb'));

  const sorted = sortMidiPedalsBySignalChain([
    createDefaultPedal('limiter'),
    createDefaultPedal('echo'),
    createDefaultPedal('studioEq'),
    createDefaultPedal('tape')
  ]).filter(Boolean);
  assert.deepEqual(sorted.map((pedal) => pedal.type), ['tape', 'studioEq', 'echo', 'limiter']);
});

test('existing saved pedal arrays normalize without migration', () => {
  const normalized = normalizeMidiPedals([
    { type: 'reverb', id: 'old', knobs: { mix: 0.8 } },
    { type: 'missing-pedal', knobs: { mix: 1 } },
    null,
    { type: 'limiter', knobs: { ceiling: 0.6 } }
  ]);

  assert.equal(normalized.length, 4);
  assert.equal(normalized[0].type, 'reverb');
  assert.equal(normalized[0].id, 'old');
  assert.equal(normalized[0].knobs.mix, 0.8);
  assert.equal(normalized[1], null);
  assert.equal(normalized[3].type, 'limiter');
  assert.equal(normalized[3].knobs.ceiling, 0.6);
});

test('live and WAV pedal chains support the same board-ready pedals', () => {
  for (const type of ['studioEq', 'tape', 'limiter']) {
    assert.equal(audioSource.includes(`pedal.type === '${type}'`), true, `live chain supports ${type}`);
    assert.equal(midiComposerSource.includes(`pedal.type === '${type}'`), true, `WAV chain supports ${type}`);
  }

  assert.equal(audioSource.includes('outputTrim.gain.value = enabled.length ? 0.76 : 1'), true);
  assert.equal(midiComposerSource.includes('outputTrim.gain.value = 0.76'), true);
  assert.equal(audioSource.includes('const clampedVolume = clamp(volume ?? 1, 0, hasPedals ? 0.78 : 1)'), true);
  assert.equal(audioSource.includes("toneHigh.type = 'highpass';"), true);
  assert.equal(audioSource.includes("wetLowpass.type = 'lowpass';"), true);
});

test('GM sustain profiles distinguish held, decaying, and one-shot instruments', () => {
  const synth = getGmSustainProfile({ program: 88, channel: 0 });
  const guitar = getGmSustainProfile({ program: 27, channel: 0 });
  const drum = getGmSustainProfile({ program: 0, channel: 9 });

  assert.equal(synth.mode, 'sustain');
  assert.equal(synth.maxDuration, Infinity);
  assert.equal(synth.loopSample, true);
  assert.equal(guitar.mode, 'decay');
  assert.equal(guitar.loopSample, true);
  assert.ok(guitar.tail < guitar.sustain);
  assert.equal(drum.mode, 'oneshot');
  assert.equal(drum.loopSample, false);
  assert.ok(drum.maxDuration < 1);
});

test('held MIDI notes use sustained live path even when pedals are enabled', () => {
  const previewBodyStart = midiComposerSource.indexOf('  playLivePreviewNote(');
  const previewBodyEnd = midiComposerSource.indexOf('  stopLivePreviewNote(', previewBodyStart);
  const previewBody = midiComposerSource.slice(previewBodyStart, previewBodyEnd);
  assert.equal(previewBody.includes('startLiveGmNote'), true);
  assert.equal(previewBody.includes('pedals'), true);
  assert.equal(previewBody.includes('!hasPedals'), false);

  const inputBodyStart = robterSessionSource.indexOf("    this.inputBus.on('noteon'");
  const inputBodyEnd = robterSessionSource.indexOf("    this.inputBus.on('noteoff'", inputBodyStart);
  const inputBody = robterSessionSource.slice(inputBodyStart, inputBodyEnd);
  assert.equal(inputBody.includes('startLiveGmNote'), true);
  assert.equal(inputBody.includes('duration: 8'), true);
  assert.equal(inputBody.includes('pedals'), true);
  assert.equal(inputBody.includes('duration: 0.45'), false);
});

test('live, soundfont, fallback, and WAV playback share GM sustain envelopes', () => {
  assert.equal(audioSource.includes('export const getGmSustainProfile'), true);
  assert.equal(audioSource.includes('scheduleGmSustainEnvelope'), true);
  assert.equal(audioSource.includes('configureSampleSustainLoop'), true);
  assert.equal(audioSource.includes('liveNoteId'), true);
  assert.equal(audioSource.includes('entry.release'), true);
  assert.equal(midiComposerSource.includes("import { getGmSustainProfile } from '../game/Audio.js';"), true);
  assert.equal(midiComposerSource.includes('const profile = getGmSustainProfile'), true);
});
