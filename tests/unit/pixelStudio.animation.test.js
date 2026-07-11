import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { createFrame, exportAnimatedGif, exportAnimationGif } from '../../src/ui/pixel-editor/animation.js';
import { createLayer } from '../../src/ui/pixel-editor/layers.js';

const bytesFromBlob = async (blob) => new Uint8Array(await blob.arrayBuffer());

const readAscii = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));

const collectGifDelays = (bytes) => {
  const delays = [];
  for (let index = 0; index < bytes.length - 7; index += 1) {
    if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) {
      delays.push(bytes[index + 4] | (bytes[index + 5] << 8));
    }
  }
  return delays;
};

const countByte = (bytes, value) => bytes.reduce((count, byte) => count + (byte === value ? 1 : 0), 0);

const includesAscii = (bytes, text) => {
  const needle = Array.from(text, (char) => char.charCodeAt(0));
  return bytes.some((_, index) => needle.every((charCode, offset) => bytes[index + offset] === charCode));
};

const collectGifImageDescriptors = (bytes) => {
  const descriptors = [];
  for (let index = 0; index < bytes.length - 10; index += 1) {
    if (bytes[index] !== 0x2c) continue;
    descriptors.push({
      left: bytes[index + 1] | (bytes[index + 2] << 8),
      top: bytes[index + 3] | (bytes[index + 4] << 8),
      width: bytes[index + 5] | (bytes[index + 6] << 8),
      height: bytes[index + 7] | (bytes[index + 8] << 8)
    });
  }
  return descriptors;
};

const makeFrame = (pixels, durationMs) => {
  const layer = createLayer(2, 1, 'Frame');
  pixels.forEach((pixel, index) => {
    layer.pixels[index] = pixel;
  });
  return createFrame([layer], durationMs);
};

test('animated GIF export writes multiple frames with frame delays', async () => {
  const frames = [
    makeFrame([0xff0000ff, 0x00000000], 120),
    makeFrame([0xff00ff00, 0xffff0000], 250)
  ];

  const bytes = await bytesFromBlob(exportAnimatedGif(frames, 2, 1));

  assert.equal(readAscii(bytes, 0, 6), 'GIF89a');
  assert.equal(includesAscii(bytes, 'NETSCAPE2.0'), true);
  assert.equal(countByte(bytes, 0x2c), 2);
  assert.deepEqual(collectGifDelays(bytes), [12, 25]);
  assert.equal(bytes[bytes.length - 1], 0x3b);
});

test('animated GIF export keeps renamed compatibility alias', () => {
  assert.equal(exportAnimationGif, exportAnimatedGif);
});

test('animated GIF export writes a valid single frame GIF', async () => {
  const bytes = await bytesFromBlob(exportAnimatedGif([
    makeFrame([0xff0000ff, 0xffffffff], 20)
  ], 2, 1));

  assert.equal(readAscii(bytes, 0, 6), 'GIF89a');
  assert.equal(countByte(bytes, 0x2c), 1);
  assert.deepEqual(collectGifDelays(bytes), [2]);
  assert.equal(bytes[bytes.length - 1], 0x3b);
});

test('animated GIF export writes full-size large frames', async () => {
  const layer = createLayer(64, 64, 'Large Frame');
  for (let y = 4; y < 60; y += 1) {
    for (let x = 5; x < 55; x += 1) {
      if ((x + y) % 3 !== 0) layer.pixels[y * 64 + x] = 0xff0000ff;
    }
  }

  const bytes = await bytesFromBlob(exportAnimatedGif([createFrame([layer], 31)], 64, 64));

  assert.deepEqual(collectGifImageDescriptors(bytes), [{ left: 0, top: 0, width: 64, height: 64 }]);
  assert.equal(bytes[bytes.length - 1], 0x3b);
});

test('pixel animation frame panel displays frame delay in milliseconds', () => {
  const labels = [];
  const frame = makeFrame([0xff0000ff, 0xffffffff], 200);
  const fakeEditor = {
    game: { canvas: { width: 800, height: 600 } },
    animation: { frames: [frame], currentFrameIndex: 0, playing: false },
    canvasState: { width: 2, height: 1 },
    pixelPortraitSubpanel: null,
    uiButtons: [],
    frameBounds: [],
    focusGroupMeta: {},
    focusScroll: {},
    controllerMenu: {
      isMenuActive() { return false; },
      isFocusedItem() { return false; }
    },
    drawButton() {},
    drawPixelPreviewPixels() {},
    drawFittedText(_ctx, text) {
      labels.push(text);
    },
    registerFocusable() {},
    setFrameLayers() {}
  };
  const ctx = {
    fillStyle: '#fff',
    font: '',
    fillText() {}
  };

  PixelStudio.prototype.drawFramesPanel.call(fakeEditor, ctx, 0, 0, 220, 100, { isMobile: false, controls: false });

  assert.equal(labels.includes('F1 200ms'), true);
  assert.equal(labels.some((label) => label.includes('fps')), false);
});

test('pixel animation transport helpers clamp and toggle playback state', () => {
  const editor = Object.create(PixelStudio.prototype);
  const frames = [
    createFrame([createLayer(1, 1, 'A')], 100),
    createFrame([createLayer(1, 1, 'B')], 100),
    createFrame([createLayer(1, 1, 'C')], 100)
  ];
  const layerSets = [];
  editor.animation = { frames, currentFrameIndex: 1, playing: true, loop: false };
  editor.canvasState = { layers: frames[1].layers };
  editor.setFrameLayers = (layers) => {
    editor.canvasState.layers = layers;
    layerSets.push(layers);
  };

  editor.rewindAnimationFrames();
  assert.equal(editor.animation.currentFrameIndex, 0);
  assert.equal(editor.animation.playing, false);

  editor.previousAnimationFrame();
  assert.equal(editor.animation.currentFrameIndex, 0);

  editor.stepAnimationFrame();
  assert.equal(editor.animation.currentFrameIndex, 1);

  editor.goToLastAnimationFrame();
  assert.equal(editor.animation.currentFrameIndex, 2);

  editor.stepAnimationFrame();
  assert.equal(editor.animation.currentFrameIndex, 2);
  assert.ok(layerSets.length >= 5);
});
