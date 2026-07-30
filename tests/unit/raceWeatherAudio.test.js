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

test('procedural race thunder creates a panned bounded noise crack and low rumble', () => {
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

  const result = audio.playWeatherThunder({ intensity: 1, pan: 0.6 });

  assert.equal(result.played, true);
  assert.equal(result.durationSeconds >= 1.4 && result.durationSeconds <= 2.4, true);
  assert.equal(result.pan, 0.6);
  assert.equal(started.some(([kind]) => kind === 'noise'), true);
  assert.equal(started.some(([kind]) => kind === 'rumble'), true);
  assert.equal(stopped.length, 2);
});
