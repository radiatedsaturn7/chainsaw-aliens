import assert from 'node:assert/strict';

class FakeWindow {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler, options = {}) {
    const bucket = this.listeners.get(type) || new Set();
    bucket.add(handler);
    this.listeners.set(type, bucket);

    const signal = options?.signal;
    if (signal?.addEventListener) {
      signal.addEventListener('abort', () => {
        this.removeEventListener(type, handler);
      }, { once: true });
    }
  }

  removeEventListener(type, handler) {
    const bucket = this.listeners.get(type);
    if (!bucket) return;
    bucket.delete(handler);
    if (bucket.size === 0) {
      this.listeners.delete(type);
    }
  }

  dispatchEvent(event) {
    const bucket = this.listeners.get(event.type);
    if (!bucket) return;
    for (const handler of Array.from(bucket)) {
      handler(event);
    }
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

const fakeWindow = new FakeWindow();
globalThis.window = fakeWindow;
globalThis.document = { hidden: false };
globalThis.navigator = { getGamepads: () => [] };
globalThis.performance = { now: () => 0 };

const { default: Input } = await import('../src/game/Input.js');

// flow: bind -> destroy -> bind (listeners active exactly once)
const input = new Input();
assert.equal(fakeWindow.listenerCount('keydown'), 1, 'expected one keydown listener after ctor bind');

input.destroy();
assert.equal(fakeWindow.listenerCount('keydown'), 0, 'expected no keydown listeners after destroy');

input.bindListeners();
assert.equal(fakeWindow.listenerCount('keydown'), 1, 'expected one keydown listener after rebind');

fakeWindow.dispatchEvent({ type: 'keydown', code: 'KeyA' });
assert.equal(input.wasPressedCode('KeyA'), true, 'expected keydown to be observed after rebind');

// flow: double-destroy (no throw)
input.destroy();
assert.doesNotThrow(() => input.destroy(), 'double-destroy should be safe');

// flow: double-bind (no duplication)
input.bindListeners();
input.bindListeners();
assert.equal(fakeWindow.listenerCount('keydown'), 1, 'double bind should not duplicate keydown listeners');

console.log('Input listener lifecycle checks passed');
