import test from 'node:test';
import assert from 'node:assert/strict';

import LevelEditorCore from '../../src/ui/LevelEditorCore.js';

function createGameStub() {
  const world = new Proxy({
    width: 64,
    height: 64,
    tileSize: 32,
    rooms: [],
    enemies: [],
    powerups: [],
    decals: [],
    triggers: [],
    musicZones: [],
    getTile: () => '.',
    setTile: () => {},
    getRoomAt: () => null,
    getRoomKey: () => '0,0',
    ensureRoom: () => ({}),
    serialize: () => ({})
  }, {
    get: (target, prop) => (prop in target ? target[prop] : (() => null))
  });
  const game = {
    world,
    canvas: { width: 1280, height: 720 },
    input: { isGamepadConnected: () => false },
    camera: { x: 0, y: 0 },
    drawWorld: () => {},
    showSystemToast: () => {},
    audio: { playSfx: () => {}, playMusic: () => {}, stopMusic: () => {} }
  };
  return new Proxy(game, {
    get: (target, prop) => (prop in target ? target[prop] : (() => null))
  });
}

function createCanvasContextStub(canvas) {
  return new Proxy({ canvas }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (text) => ({ width: String(text || '').length * 7 });
      if (prop === 'getImageData') return () => ({ data: [0, 0, 0, 255] });
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

test('Level Editor draw does not throw in desktop, portrait, or landscape layout', () => {
  const game = createGameStub();
  const ctx = createCanvasContextStub(game.canvas);
  const editor = new LevelEditorCore(game);
  editor.active = true;

  [
    { label: 'desktop', width: 1280, height: 720, mobile: false },
    { label: 'portrait', width: 390, height: 844, mobile: true },
    { label: 'landscape', width: 844, height: 390, mobile: true }
  ].forEach(({ label, width, height, mobile }) => {
    game.canvas.width = width;
    game.canvas.height = height;
    editor.isMobileLayout = () => mobile;
    assert.doesNotThrow(() => editor.draw(ctx, width, height), label);
  });
});
