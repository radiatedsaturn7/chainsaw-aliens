import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeGif } from '../../src/ui/pixel-editor/gifImport.js';
import { colorToAlpha } from '../../src/ui/pixel-editor/filters.js';
import { createFrame, exportAnimatedGif } from '../../src/ui/pixel-editor/animation.js';
import { createLayer } from '../../src/ui/pixel-editor/layers.js';
import PixelStudio, { buildPixelPortraitCanvasActions, buildPixelPortraitCanvasActionGroups } from '../../src/ui/PixelStudio.js';

const white = 0xffffffff, red = 0xff0000ff, black = 0xff000000;
function fixture(frames, width = 2, height = 1) {
  const bytes = [...Buffer.from('GIF89a'), width, 0, height, 0, 0x81, 0, 0, 255,255,255, 255,0,0, 0,0,0, 0,0,255];
  for (const { indices, left = 0, top = 0, w = width, h = height, disposal = 1, transparent = -1, interlace = false, local = false } of frames) {
    bytes.push(0x21,0xf9,4,(disposal << 2) | (transparent >= 0 ? 1 : 0),7,0,Math.max(0, transparent),0);
    bytes.push(0x2c,left,0,top,0,w,0,h,0,(interlace ? 64 : 0) | (local ? 0x81 : 0));
    if (local) bytes.push(255,255,255, 0,255,0, 0,0,0, 0,0,255);
    // Independent literal encoder: clear before each pixel keeps codes at 3 bits.
    const codes = indices.flatMap(i => [4, i]).concat(5), packed = [];
    let bit = 0;
    for (const code of codes) for (let j = 0; j < 3; j++, bit++) packed[bit >> 3] = (packed[bit >> 3] || 0) | (((code >> j) & 1) << (bit & 7));
    bytes.push(2, packed.length, ...packed, 0);
  }
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}

test('GIF partial frames composite, restore previous/background, local palettes and delays', () => {
  const result = decodeGif(fixture([
    { indices: [1, 0] },
    { indices: [2], left: 1, w: 1, disposal: 3 },
    { indices: [0], w: 1, transparent: 0 },
    { indices: [1], w: 1, disposal: 2, local: true },
    { indices: [2], left: 1, w: 1 }
  ]));
  assert.deepEqual(result.frames.map(f => [...f.pixels]), [[red,white],[red,black],[red,white],[0xff00ff00,white],[white,black]]);
  assert.deepEqual(result.frames.map(f => f.durationMs), [70,70,70,70,70]);
});

test('GIF transparent disposal, interlace and nearest-neighbor resizing', () => {
  const transparent = decodeGif(fixture([{ indices: [1,0], transparent: 0, disposal: 2 }, { indices: [2], w: 1, transparent: 0 }]));
  assert.deepEqual([...transparent.frames[1].pixels], [black,0]);
  const gif = fixture([{indices: [0,2,1,3], interlace: true}], 1, 4);
  assert.deepEqual([...decodeGif(gif).frames[0].pixels], [white,red,black,0xffff0000]);
  assert.equal(decodeGif(gif,{maxDimension:2}).height,2);
});

test('GIF exported animation round-trips pixels and duration through dictionary growth', async () => {
  const layer = createLayer(64,64,'Image');
  for (let i = 0; i < layer.pixels.length; i++) layer.pixels[i] = [white,red,black,0][(i * 13 + (i >> 5)) % 4];
  const frames = [createFrame([layer],70),createFrame([layer],230)];
  const gif = await exportAnimatedGif(frames,64,64).arrayBuffer();
  const decoded = decodeGif(gif);
  assert.equal(decoded.frames.length,2);
  assert.deepEqual(decoded.frames.map(f=>f.durationMs),[70,230]);
  assert.deepEqual(decoded.frames[0].pixels,layer.pixels);
});

test('GIF rejects truncated or excessive frames before document replacement', () => {
  const gif = fixture([{ indices: [1,0] }]);
  assert.throws(()=>decodeGif(gif.subarray(0,20)),/Truncated/);
  assert.throws(()=>decodeGif(gif,{maxPixels:1}),/too many/);
});

test('color to alpha removes matte, recovers soft edges and respects original transparency', () => {
  const pixels = Uint32Array.from([white,red,0xff8080ff,0x808080ff,0]);
  colorToAlpha(pixels,white);
  assert.deepEqual([...pixels],[0,red,0x7f0000ff,0x400000ff,0]);
  const dark = Uint32Array.from([black,white]);
  colorToAlpha(dark,black);
  assert.deepEqual([...dark],[0,white]);
});

test('filter edits all frames in a single undoable operation; current scope is isolated', () => {
  const studio = Object.create(PixelStudio.prototype);
  const layer = createLayer(2,1,'Image');layer.pixels.set([white,red]);
  studio.animation = {frames:[createFrame([layer],70),createFrame([layer],230)],currentFrameIndex:0};
  studio.canvasState = {layers:studio.currentFrame.layers};
  studio.invalidateBoneDerivedCaches = studio.syncTileData = studio.ensureBoneNodeSelection = () => {};
  studio.setFrameLayers = layers => {studio.canvasState.layers=layers;};
  let history;
  studio.runtime={commitHistory:e=>{history=e;}};
  studio.applyColorToAlpha(white);
  assert.ok(studio.animation.frames.every(f=>f.layers[0].pixels[0]===0));
  studio.applyHistoryEntry(history,'undo');
  assert.ok(studio.animation.frames.every(f=>f.layers[0].pixels[0]===white));
  studio.applyHistoryEntry(history,'redo');
  assert.ok(studio.animation.frames.every(f=>f.layers[0].pixels[0]===0));
  studio.applyHistoryEntry(history,'undo');
  studio.applyColorToAlpha(white,'current');
  assert.equal(studio.animation.frames[1].layers[0].pixels[0],white);
  assert.ok(buildPixelPortraitCanvasActions().some(a=>a.id==='canvas-filters'));
  assert.equal(buildPixelPortraitCanvasActionGroups()['canvas-filters'].actions[0].id,'color-to-alpha');
});

test('file import replaces the document with editable GIF frames and preserves it on decode failure', async () => {
  const studio = Object.create(PixelStudio.prototype);
  studio.animation = {frames:[],currentFrameIndex:0,playing:true};
  studio.canvasState = {};
  studio.artSizeDraft = {};
  studio.setFrameLayers = layers => { studio.canvasState.layers = layers; };
  studio.clearSelection = studio.zoomToFitCanvas = () => {};
  const file = new File([fixture([{indices:[1,0]},{indices:[2,1]}])], 'Example.gif', {type:'image/gif'});
  await studio.importImageFromFile(file);
  assert.equal(studio.animation.frames.length,2);
  assert.equal(studio.animation.playing,false);
  assert.equal(studio.canvasState.width,2);
  assert.deepEqual(studio.animation.frames.map(f=>[...f.layers[0].pixels]),[[red,white],[black,red]]);
  assert.equal(studio.currentDocumentRef.name,'Example');
  const previous = studio.animation.frames;
  await assert.rejects(()=>studio.importImageFromFile(new File(['GIF89a'],'broken.gif')),/Truncated/);
  assert.equal(studio.animation.frames,previous);
});

test('GIF LZW accepts dictionary references including the next-code special case', () => {
  const gif = [...fixture([{indices:[1,1,1]}],3,1)];
  // clear(4), red(1), next dictionary entry(6), end(5), all 3-bit codes.
  const imageOffset = gif.indexOf(0x2c, 25);
  gif.splice(imageOffset+10, gif.length-imageOffset-10, 2,2,0x8c,0x0b,0,0x3b);
  assert.deepEqual([...decodeGif(Uint8Array.from(gif)).frames[0].pixels],[red,red,red]);
});
