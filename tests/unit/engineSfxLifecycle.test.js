import test from 'node:test';
import assert from 'node:assert/strict';
import AudioSystem from '../../src/game/Audio.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const previousWindow = globalThis.window;
globalThis.window = {};
const { default: Game } = await import('../../src/game/GameCore.js');
if (previousWindow === undefined) delete globalThis.window;
else globalThis.window = previousWindow;

function createHarness() {
  const audio = Object.create(AudioSystem.prototype);
  const sources = [];
  const decodes = [];
  const param = () => ({ value: 1, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; }, setTargetAtTime(value) { this.value = value; }, cancelScheduledValues() {} });
  audio.ensure = () => {};
  audio.activeSfxSources = new Map();
  audio.master = {};
  audio.ctx = {
    currentTime: 1,
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createBufferSource() {
      const source = { playbackRate: param(), connect() {}, disconnect() {}, starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; } };
      sources.push(source);
      return source;
    }
  };
  audio.decodeSfxLayer = () => new Promise((resolve, reject) => decodes.push({ resolve, reject }));
  const document = { settings: { baseVolume: 1 }, frames: [{ layers: [{ id: 'layer', wavDataUrl: 'test', volume: 1 }], loopStart: 0, loopEnd: 1 }] };
  const game = Object.create(Game.prototype);
  game.audio = audio;
  game.getSfxDocument = () => document;
  return { audio, game, sources, decodes, document };
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

for (const prepared of [false, true]) {
  for (const pending of [false, true]) {
    test(`car preview replaces inline-four with V8 (${prepared ? 'prepared' : 'synchronous'}, ${pending ? 'loading' : 'playing'})`, async () => {
      const { game, audio, sources, decodes } = createHarness();
      const editor = new RaceEditor(game, { mode: 'car' });
      editor.getNowMs = () => 0;
      const car = editor.selectedCar;
      const race = editor.selectedRace;
      // Keep the real preview replacement and audio paths; omit world simulation.
      editor.getCarEditorPreviewRace = () => race;
      editor.startPlaytest = () => {
        editor.playtestSession = { running: true, carId: car.id, engineSoundId: car.audio.engineSoundId };
        editor.raceInput = {};
      };
      const replace = () => prepared
        ? editor.installPreparedCarEditorPreview({ car, previewRace: race, worldBake: {} })
        : editor.ensureCarEditorPreviewPlaytestSession();
      car.audio.engineSoundId = 'Inline Four';
      const first = replace();
      game.playSfxById('Inline Four', { key: 'race-engine', loop: true });
      first.session.activeEngineSoundId = 'Inline Four';
      if (!pending) {
        decodes[0].resolve({ duration: 1 });
        await settle();
      }
      car.audio.engineSoundId = 'V8';
      const second = replace();
      assert.notEqual(second, first);
      game.playSfxById('V8', { key: 'race-engine', loop: true });
      decodes[1].resolve({ duration: 1 });
      if (pending) decodes[0].resolve({ duration: 1 });
      await settle();
      assert.deepEqual([...audio.activeSfxSources.keys()], ['V8:race-engine']);
      assert.equal(sources.filter((source) => source.starts && !source.stops).length, 1);
      assert.equal(sources.length, pending ? 1 : 2);
      if (!pending) assert.equal(sources[0].stops, 1);
      editor.stopCarEditorPreviewAudio();
    });
  }
}

test('engine loop has one pending start while frames update its volume and pitch', async () => {
  const { game, audio, sources, decodes } = createHarness();
  for (let frame = 0; frame < 60; frame++) {
    game.playSfxById('Engine A', { key: 'race-engine', loop: true, volume: frame === 0 ? 1 : 0.4, pitchCents: frame === 0 ? 0 : 1200 });
  }
  assert.equal(decodes.length, 1);
  assert.equal(audio.activeSfxSources.size, 1);
  decodes[0].resolve({ duration: 1 });
  await settle();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].starts, 1);
  assert.equal(sources[0].loop, true);
  assert.equal(audio.activeSfxSources.get('Engine A:race-engine').master.gain.value, 0.4);
  assert.equal(sources[0].playbackRate.value, 2);
});

test('preview reset cancels pending engine audio and a replacement loop starts normally', async () => {
  const { game, audio, sources, decodes } = createHarness();
  game.playSfxById('Engine A', { key: 'race-engine', loop: true });
  game.stopSfxById('', { key: 'race-engine' });
  game.playSfxById('Engine B', { key: 'race-engine', loop: true });
  decodes[1].resolve({ duration: 1 });
  await settle();
  decodes[0].resolve({ duration: 1 });
  await settle();
  assert.equal(sources.length, 1, 'cancelled decode must not create a source');
  assert.equal(sources[0].starts, 1);
  assert.deepEqual([...audio.activeSfxSources.keys()], ['Engine B:race-engine']);
  game.stopSfxById('', { key: 'race-engine' });
  assert.equal(sources[0].stops, 1);
  assert.equal(audio.activeSfxSources.size, 0);
});

test('restarting the same engine sound ignores a cancelled decode failure', async () => {
  const { game, audio, sources, decodes } = createHarness();
  game.playSfxById('Engine A', { key: 'race-engine', loop: true });
  game.stopSfxById('Engine A', { key: 'race-engine' });
  game.playSfxById('Engine A', { key: 'race-engine', loop: true });
  decodes[0].reject(new Error('old decode failed'));
  await settle();
  assert.equal(audio.activeSfxSources.size, 1);
  decodes[1].resolve({ duration: 1 });
  await settle();
  assert.equal(sources[0].starts, 1);
});

test('a failed decode releases its pending handle so the sound can be retried', async () => {
  const { audio, document, decodes } = createHarness();
  const playback = audio.playSfxDocument(document, { id: 'engine', loop: true });
  decodes[0].reject(new Error('decode failed'));
  await assert.rejects(playback, /decode failed/);
  assert.equal(audio.activeSfxSources.size, 0);
  const retry = audio.playSfxDocument(document, { id: 'engine', loop: true });
  decodes[1].resolve({ duration: 1 });
  assert.ok(await retry);
});
