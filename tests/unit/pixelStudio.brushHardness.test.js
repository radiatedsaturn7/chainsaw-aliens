import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { uint32ToRgba } from '../../src/ui/pixel-editor/palette.js';

const createBrushStamp = PixelStudio.prototype.createBrushStamp;
const doesBrushShapeIncludeOffset = PixelStudio.prototype.doesBrushShapeIncludeOffset;
const getBrushShapeEdgeT = PixelStudio.prototype.getBrushShapeEdgeT;
const applyBrush = PixelStudio.prototype.applyBrush;
const getStrokeFalloffWeight = PixelStudio.prototype.getStrokeFalloffWeight;
const blendPixel = PixelStudio.prototype.blendPixel;

const buildStampContext = (hardness) => ({
  toolOptions: {
    brushSize: 9,
    brushShape: 'circle',
    brushHardness: hardness
  },
  doesBrushShapeIncludeOffset,
  getBrushShapeEdgeT
});

test('hardness=1 keeps edge weight hard while hardness=0 fades at edge', () => {
  const center = { row: 0, col: 0 };

  const hardStamp = createBrushStamp.call(buildStampContext(1), center);
  const softStamp = createBrushStamp.call(buildStampContext(0), center);

  const keyFor = (pt) => `${pt.row},${pt.col}`;
  const hardMap = new Map(hardStamp.map((pt) => [keyFor(pt), pt.weight]));
  const softMap = new Map(softStamp.map((pt) => [keyFor(pt), pt.weight]));

  const centerKey = keyFor(center);
  const edgeKey = keyFor({ row: 0, col: 4 });

  assert.equal(hardMap.get(centerKey), 1);
  assert.equal(softMap.get(centerKey), 1);

  assert.ok((hardMap.get(edgeKey) ?? 0) > 0.99);
  assert.ok((softMap.get(edgeKey) ?? 1) < 0.01);
});

const paintOnceWithHardness = (hardness) => {
  const width = 13;
  const height = 13;
  const pixels = new Uint32Array(width * height);
  const ctx = {
    canvasState: { width, height },
    toolOptions: {
      brushSize: 9,
      brushShape: 'circle',
      brushHardness: hardness,
      brushOpacity: 1,
      brushFalloff: 0,
      symmetry: { horizontal: false, vertical: false }
    },
    activeLayer: { pixels },
    selection: { active: false, mask: null },
    strokeState: null,
    wrapCoord(v, max) {
      return v < 0 || v >= max ? -1 : v;
    },
    createBrushStamp,
    doesBrushShapeIncludeOffset,
    getBrushShapeEdgeT,
    getStrokeFalloffWeight,
    getActiveColorValue() {
      return 0xffffffff;
    },
    shouldApplyDither() {
      return true;
    },
    blendPixel
  };

  applyBrush.call(ctx, { row: 6, col: 6 }, 0);

  const center = uint32ToRgba(pixels[6 * width + 6]);
  const edge = uint32ToRgba(pixels[6 * width + 10]);
  return { center, edge };
};

test('painting respects hardness at brush edge alpha', () => {
  const hard = paintOnceWithHardness(1);
  const soft = paintOnceWithHardness(0);

  assert.equal(hard.center.a, 255);
  assert.equal(soft.center.a, 255);
  assert.equal(hard.edge.a, 255);
  assert.equal(soft.edge.a, 0);
});
