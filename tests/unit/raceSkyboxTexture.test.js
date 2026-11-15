import test from 'node:test';
import assert from 'node:assert/strict';
import {blendSkyboxEdges, prepareSkyboxTexture} from '../../src/racing/RaceSkyboxTexture.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('panorama join matches on every row while central scenery stays unchanged', () => {
  const width = 100, height = 3;
  const pixels = Uint8ClampedArray.from({length: width * height * 4}, (_, i) => (i * 37) % 256);
  const original = pixels.slice();
  blendSkyboxEdges(pixels, width, height);
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    assert.deepEqual(pixels.slice(row, row + 4), pixels.slice(row + 396, row + 400));
    assert.deepEqual(pixels.slice(row + 16, row + 384), original.slice(row + 16, row + 384));
  }
});

test('cached texture copies opposite edges into one-pixel wrap gutters', () => {
  const draws = [];
  const padded = {getContext: () => ({drawImage: (...args) => draws.push(args)})};
  const canvas = {width: 100, height: 50, ownerDocument: {createElement: () => padded},
    getContext: () => ({getImageData: () => ({data: new Uint8ClampedArray(20000)}), putImageData() {}})};
  assert.equal(prepareSkyboxTexture(canvas), padded);
  assert.equal(padded.width, 102);
  assert.equal(padded.skyboxGutter, 1);
  assert.deepEqual(draws[1].slice(1), [99, 0, 1, 50, 0, 0, 1, 50]);
  assert.deepEqual(draws[2].slice(1), [0, 0, 1, 50, 101, 0, 1, 50]);
});

test('fractional skybox wraps overlap gutters without changing panorama scale', () => {
  const e = new RaceEditor({});
  e.getRaceSkyboxSettings = () => ({artRef: 'sky', scaleX: .25, scaleY: 1});
  e.getRaceSkyboxRenderCanvas = () => ({width: 102, height: 50, skyboxGutter: 1});
  const images = [];
  const ctx = {save(){}, restore(){}, beginPath(){}, clip(){}, rect(){}, drawImage: (...args) => images.push(args)};
  e.drawRaceSkyboxArt(ctx, {x: 0, y: 0, w: 600, h: 400}, {horizon: 200, normalizedCameraYaw: .123});
  const tiles = images.filter(args => args.length === 5);
  assert.ok(tiles.length > 2);
  const period = 288;
  for (let i = 1; i < tiles.length; i++) {
    assert.ok(Math.abs(tiles[i][1] - tiles[i - 1][1] - period) < 1e-9);
    assert.ok(tiles[i - 1][1] + tiles[i - 1][3] > tiles[i][1]);
  }
});
