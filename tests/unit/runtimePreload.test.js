import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import AudioSystem from '../../src/game/Audio.js';
import { preloadActorDefinitionAssets } from '../../src/entities/ScriptedActor.js';

test('audio song preload collector includes melodic programs, drum kits, notes, and pedals', () => {
  const song = {
    tracks: [
      {
        id: 'lead',
        channel: 2,
        program: 80,
        bankMSB: 0,
        bankLSB: 0,
        midiPedals: [{ type: 'reverb', enabled: true }],
        patterns: [{ notes: [{ pitch: 60, startTick: 0, durationTicks: 4 }] }]
      },
      {
        id: 'kit',
        channel: 9,
        instrument: 'drums',
        program: 12,
        patterns: [{ notes: [{ pitch: 36 }, { pitch: 38 }, { pitch: 36 }] }]
      }
    ]
  };

  const requests = AudioSystem.prototype.collectSongResourceRequests.call({}, song);
  assert.deepEqual(
    requests.programs.map((program) => [program.channel, program.program, program.bankMSB, program.bankLSB]),
    [
      [2, 80, 0, 0],
      [9, 12, 128, 0]
    ]
  );
  assert.equal(requests.pedals.length, 1);
  assert.deepEqual(Array.from(requests.drumNotesByPreset.get('12')).sort((a, b) => a - b), [36, 38]);
});

test('game music startup preloads before creating a MIDI player and guards stale completions', () => {
  const source = readFileSync(new URL('../../src/game/GameCore.js', import.meta.url), 'utf8');
  const start = source.indexOf('\n  setActiveMusicTrack(trackId');
  const end = source.indexOf('\n  playActorMidi(trackId', start);
  const body = source.slice(start, end);
  assert.equal(body.includes('++this.musicPreloadToken'), true);
  assert.equal(body.includes('this.audio?.preloadSongResources?.(libraryEntry.song)'), true);
  assert.equal(body.includes('if (preloadToken !== this.musicPreloadToken) return;'), true);
  assert.ok(body.indexOf('preloadSongResources') < body.indexOf('new MidiSongPlayer(this.audio)'));
});

test('actor asset preload accepts full state animation definitions without runtime draw', async () => {
  const result = await preloadActorDefinitionAssets({
    id: 'preload-test',
    states: [
      {
        id: 'idle',
        animation: {
          fps: 8,
          frames: [{ imageDataUrl: 'data:image/png;base64,stub' }]
        }
      },
      {
        id: 'attack',
        animation: {
          imageDataUrl: 'data:image/png;base64,stub2'
        }
      }
    ]
  });
  assert.deepEqual(result, []);
});
