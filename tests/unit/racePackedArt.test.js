import test from 'node:test';
import assert from 'node:assert/strict';

const {
  createPackedRaceArtTextureSampler,
  getPackedRaceArtTransferables,
  packRaceArtDocumentForRuntime
} = await import('../../src/racing/RacePackedArt.js');
const { getRaceArtSpriteCanvasShared } = await import('../../src/ui/shared/raceArtSpriteCanvas.js');

test('race artwork packs frames and texture mips into transferable RGBA arrays', () => {
  const packed = packRaceArtDocumentForRuntime({
    width: 2,
    height: 2,
    frames: [[
      '#ff0000ff',
      '#00ff00ff',
      '#0000ffff',
      '#ffffff80'
    ]]
  }, {
    artRef: 'ground',
    savedAt: 42,
    buildTexture: true
  });

  assert.equal(packed.artRef, 'ground');
  assert.equal(packed.frames.length, 1);
  assert.deepEqual(Array.from(packed.frames[0].pixels.slice(0, 8)), [
    255, 0, 0, 255,
    0, 255, 0, 255
  ]);
  assert.equal(packed.texture.mipLevels.length, 2);
  assert.equal(packed.texture.terrainMipLevels.length, 2);

  const transferables = getPackedRaceArtTransferables([packed]);
  const transferred = structuredClone(packed, { transfer: transferables });
  assert.equal(packed.frames[0].pixels.byteLength, 0);
  assert.equal(transferred.frames[0].pixels.byteLength, 16);
});

test('packed artwork texture samplers read transferred color and terrain data', () => {
  const packed = packRaceArtDocumentForRuntime({
    width: 2,
    height: 2,
    frames: [[
      '#ff0000ff',
      '#00ff00ff',
      '#0000ffff',
      '#ffffffff'
    ]]
  }, {
    artRef: 'ground',
    buildTexture: true
  });
  const sampler = createPackedRaceArtTextureSampler(packed.texture, {
    width: packed.width,
    height: packed.height,
    baseWorldM: 1
  });

  assert.equal(sampler.width, 2);
  assert.equal(sampler.height, 2);
  assert.equal(sampler.worldWidthM, 1);
  assert.equal(sampler.readTerrainColor(0.25, 0.25).a, 1);
  assert.match(sampler.sample(0.25, 0.25), /^rgba\(/);
});

test('prepared race frames bypass synchronous project-file loading', () => {
  const canvas = { width: 4, height: 4 };
  const preparedFrames = new Map([['cold-art:frame:0', canvas]]);

  assert.equal(getRaceArtSpriteCanvasShared('cold-art', {
    frameIndex: 0,
    preparedFrames,
    allowStorageLoad: false,
    documentRef: {}
  }), canvas);
  assert.equal(getRaceArtSpriteCanvasShared('missing-art', {
    preparedFrames,
    allowStorageLoad: false,
    documentRef: {}
  }), null);
});
