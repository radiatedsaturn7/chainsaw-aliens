import assert from 'node:assert/strict';
import test from 'node:test';

import AudioSystem from '../../src/game/Audio.js';

function createAudioParam(value = 0) {
  return {
    value,
    events: [],
    setValueAtTime(next, at) {
      this.value = next;
      this.events.push(['set', next, at]);
    },
    linearRampToValueAtTime(next, at) {
      this.value = next;
      this.events.push(['linear', next, at]);
    },
    exponentialRampToValueAtTime(next, at) {
      this.value = next;
      this.events.push(['exponential', next, at]);
    },
    setTargetAtTime(next, at, constant) {
      this.value = next;
      this.events.push(['target', next, at, constant]);
    }
  };
}

function createNode(extra = {}) {
  return {
    connections: [],
    connect(target) {
      this.connections.push(target);
      return target;
    },
    disconnect() {},
    ...extra
  };
}

test('procedural race thunder creates a panned bounded noise crack and low rumble', async () => {
  const started = [];
  const stopped = [];
  const context = {
    sampleRate: 1000,
    currentTime: 4,
    createBuffer(_channels, length) {
      const data = new Float32Array(length);
      return {
        length,
        getChannelData() {
          return data;
        }
      };
    },
    createBufferSource() {
      return createNode({
        buffer: null,
        start(at) { started.push(['noise', at]); },
        stop(at) { stopped.push(['noise', at]); }
      });
    },
    createOscillator() {
      return createNode({
        type: 'sine',
        frequency: createAudioParam(),
        start(at) { started.push(['rumble', at]); },
        stop(at) { stopped.push(['rumble', at]); }
      });
    },
    createGain() {
      return createNode({ gain: createAudioParam() });
    },
    createBiquadFilter() {
      return createNode({
        type: 'lowpass',
        frequency: createAudioParam(),
        Q: createAudioParam()
      });
    },
    createStereoPanner() {
      return createNode({ pan: createAudioParam() });
    }
  };
  const audio = new AudioSystem();
  audio.ctx = context;
  audio.master = createNode();
  audio.ensure = () => {};

  const play = async event => {
    await audio.prepareWeatherThunder(event);
    const pending = audio.playWeatherThunder(event);
    assert.equal(pending.pending, true);
    await Promise.resolve(); // Prepared sound starts without a synthesis loop.
    return pending;
  };
  const result = await play({ intensity: 1, pan: 0.6 });

  assert.equal(result.played, false);
  assert.equal(result.durationSeconds >= 2.2 && result.durationSeconds <= 7.2, true);
  assert.equal(result.pan, 0.6);
  assert.equal(started.some(([kind]) => kind === 'noise'), true);
  assert.equal(started.some(([kind]) => kind === 'rumble'), true);
  assert.equal(stopped.length, 2);
  const near=await play({distanceM:100,seed:42});
  const far=await play({distanceM:6000,seed:99});
  assert.ok(far.durationSeconds>near.durationSeconds);
  for(let i=0;i<6;i++)await play({distanceM:100,seed:i});
  assert.ok(audio.weatherThunderVoices.length<=4);
  audio.stopWeatherThunder();assert.equal(audio.weatherThunderVoices.length,0);
  let resolve;
  audio.prepareWeatherThunder=()=>new Promise(done=>{resolve=done;});
  const before=started.length;
  audio.playWeatherThunder({});audio.stopWeatherThunder();
  resolve(new Float32Array(100));await Promise.resolve();
  assert.equal(started.length,before,'pause/exit cancels playback of late worker results');
});
