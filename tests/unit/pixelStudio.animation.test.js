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

const makePixelStudioCropHarness = (width, height, layer) => {
  const editor = Object.create(PixelStudio.prototype);
  editor.canvasState = {
    width,
    height,
    layers: [layer],
    activeLayerIndex: 0
  };
  editor.animation = {
    frames: [createFrame([layer], 120)],
    currentFrameIndex: 0
  };
  editor.artSizeDraft = { width, height };
  editor.selection = { active: false, bounds: null };
  editor.syncTileData = () => {};
  return editor;
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

test('Pixel Studio crop defaults to visible opaque bounds and supports uneven edges', () => {
  const layer = createLayer(6, 5, 'Layer');
  layer.pixels[2 + 1 * 6] = 0xff0000ff;
  layer.pixels[4 + 3 * 6] = 0xff00ff00;
  const editor = makePixelStudioCropHarness(6, 5, layer);

  assert.deepEqual(editor.getDefaultCropEdges(), { left: 2, top: 1, right: 1, bottom: 1 });

  editor.cropCanvasEdges(editor.getDefaultCropEdges());

  assert.equal(editor.canvasState.width, 3);
  assert.equal(editor.canvasState.height, 3);
  assert.equal(editor.animation.frames[0].layers[0].pixels[0], 0xff0000ff);
  assert.equal(editor.animation.frames[0].layers[0].pixels[2 + 2 * 3], 0xff00ff00);
});

test('Pixel Studio crop defaults to active selection bounds when selected', () => {
  const layer = createLayer(8, 6, 'Layer');
  layer.pixels[1 + 1 * 8] = 0xff0000ff;
  layer.pixels[6 + 5 * 8] = 0xff00ff00;
  const editor = makePixelStudioCropHarness(8, 6, layer);
  editor.selection.active = true;
  editor.selection.bounds = { x: 2, y: 1, w: 4, h: 3 };

  assert.deepEqual(editor.getDefaultCropEdges(), { left: 2, top: 1, right: 2, bottom: 2 });
});

test('Pixel Studio selection crop discards pixels outside the selected canvas area', () => {
  const editor = makePixelStudioCropHarness(6, 5, createLayer(6, 5, 'Layer'));
  const layer = editor.animation.frames[0].layers[0];
  layer.pixels[2 + 1 * 6] = 0xff0000ff;
  layer.pixels[4 + 3 * 6] = 0xff00ff00;
  layer.pixels[1 + 4 * 6] = 0xff000000;
  const mask = new Uint8Array(6 * 5);
  mask[2 + 1 * 6] = 1;
  mask[4 + 3 * 6] = 1;
  editor.selection.active = true;
  editor.selection.mask = mask;
  editor.selection.bounds = { x: 2, y: 1, w: 3, h: 3 };

  editor.cropCanvasEdges(editor.getDefaultCropEdges());

  const cropped = editor.animation.frames[0].layers[0].pixels;
  assert.equal(editor.canvasState.width, 3);
  assert.equal(editor.canvasState.height, 3);
  assert.equal(cropped[0], 0xff0000ff);
  assert.equal(cropped[2 + 2 * 3], 0xff00ff00);
  assert.equal(Array.from(cropped).includes(0xff000000), false);
});

test('Pixel Studio art serialization clamps layer pixels to current canvas bounds', () => {
  const layer = createLayer(3, 3, 'Layer');
  layer.pixels = { 0: 0xff0000ff, 20: 0xff00ff00 };
  const editor = makePixelStudioCropHarness(3, 3, layer);

  const doc = editor.serializeCurrentAnimationAsArtDocument();

  assert.equal(doc.width, 3);
  assert.equal(doc.height, 3);
  assert.equal(doc.frames[0].length, 9);
  assert.equal(doc.editor.frames[0].layers[0].pixels.length, 9);
  assert.equal(doc.frames[0].includes('#00ff00'), false);
});

test('Pixel Studio art serialization preserves low-alpha pixels', () => {
  const layer = createLayer(2, 1, 'Layer');
  layer.pixels[0] = 0x20000000;
  layer.pixels[1] = 0xff336699;
  const editor = makePixelStudioCropHarness(2, 1, layer);

  const doc = editor.serializeCurrentAnimationAsArtDocument();

  assert.equal(doc.frames[0][0], '#00000020');
  assert.equal(doc.frames[0][1], '#996633');
});

test('Pixel Studio art loading restores 8-digit alpha pixels', () => {
  const editor = makePixelStudioCropHarness(1, 1, createLayer(1, 1, 'Layer'));
  editor.tileEditSession = false;
  editor.forceArtDocumentSave = true;
  editor.boneEditor = {};
  editor.resetLoadedBoneEditorState = () => {};
  editor.ensureBoneNodeSelection = () => {};
  editor.zoomToFitCanvas = () => {};
  editor.clearSelection = () => {};

  editor.loadAnimationArtDocument({
    kind: 'actor-state-animation',
    width: 1,
    height: 1,
    frames: [['#01020304']],
    fps: 8
  });

  assert.equal(editor.animation.frames[0].layers[0].pixels[0], 0x04030201);
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
