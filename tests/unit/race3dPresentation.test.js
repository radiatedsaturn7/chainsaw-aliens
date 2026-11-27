import assert from 'node:assert/strict';
import test from 'node:test';
import {compositeRace3dWorld, race3dTargetSize, readRace3dPresentationOptions} from '../../src/racing/Race3dPresentation.js';

const transform = (a, d = a) => ({getTransform: () => ({a, b: 0, c: 0, d})});
const bounds = {x: 202, y: 119, w: 536, h: 302};

test('3D resolution and compositing filtering are independent opt-ins', () => {
  assert.deepEqual(readRace3dPresentationOptions(), {displayDensity: false, linearFilter: false});
  assert.deepEqual(readRace3dPresentationOptions('?race3dResolution=display'), {displayDensity: true, linearFilter: false});
  assert.deepEqual(readRace3dPresentationOptions('?race3dFilter=linear'), {displayDensity: false, linearFilter: true});
  assert.deepEqual(race3dTargetSize(bounds, 1, transform(2), {}), {width: 536, height: 302, density: 1});
  assert.deepEqual(race3dTargetSize(bounds, 0.75, transform(2), {}), {width: 402, height: 227, density: 1});
});

test('display density uses the compositing transform, preserves authored scale and bounds added work', () => {
  const opts = {displayDensity: true};
  assert.deepEqual(race3dTargetSize(bounds, 1, transform(2), opts), {width: 804, height: 453, density: 1.5});
  assert.deepEqual(race3dTargetSize(bounds, 1, transform(0.75), opts), {width: 536, height: 302, density: 1});
  assert.deepEqual(race3dTargetSize(bounds, 0.5, transform(2), opts), {width: 402, height: 226, density: 1.5});
  const large = race3dTargetSize({w: 1100, h: 650}, 1, transform(3), opts);
  assert(large.width * large.height <= 1280 * 720);
  assert.deepEqual(race3dTargetSize({w: 1100, h: 650}, 2, transform(3), opts), {width: 2200, height: 1300, density: 1});
  assert.deepEqual(race3dTargetSize({w: 13000, h: 7000}, 4, transform(3), opts), {width: 32768, height: 18432, density: 1});
});

test('filtering affects only the world blit and restores original sampling even if the draw fails', () => {
  const canvas = {};
  const ctx = {
    imageSmoothingEnabled: false,
    drawImage(...args) {
      assert.equal(this.imageSmoothingEnabled, true);
      assert.deepEqual(args, [canvas, 202, 119, 536, 302]);
    }
  };
  compositeRace3dWorld(ctx, canvas, bounds, {linearFilter: true});
  assert.equal(ctx.imageSmoothingEnabled, false);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage = function () {
    assert.equal(this.imageSmoothingEnabled, false);
    throw new Error('draw error');
  };
  assert.throws(() => compositeRace3dWorld(ctx, canvas, bounds), /draw error/);
  assert.equal(ctx.imageSmoothingEnabled, true);
});
