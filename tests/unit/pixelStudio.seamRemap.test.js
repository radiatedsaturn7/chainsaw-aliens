import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';

const mapSeamEditsToDecalPixels = PixelStudio.prototype.mapSeamEditsToDecalPixels;

test('maps changed seam pixels to contiguous decal pixels without holes', () => {
  const seamWidth = 4;
  const seamHeight = 4;
  const seamBasePixels = new Uint32Array(seamWidth * seamHeight);
  const seamPixels = new Uint32Array(seamBasePixels);
  const paint = 0xff00ffff;

  // paint a 2x2 block in the seam-space center
  seamPixels[1 * seamWidth + 1] = paint;
  seamPixels[1 * seamWidth + 2] = paint;
  seamPixels[2 * seamWidth + 1] = paint;
  seamPixels[2 * seamWidth + 2] = paint;

  const decalWidth = 8;
  const decalHeight = 8;
  const decalPixels = new Uint32Array(decalWidth * decalHeight);

  const changed = mapSeamEditsToDecalPixels.call({}, {
    entry: { canvasX: 0, canvasY: 0, canvasW: seamWidth, canvasH: seamHeight },
    seamPixels,
    seamBasePixels,
    seamWidth,
    seamHeight,
    decalPixels,
    decalWidth,
    decalHeight
  });

  assert.equal(changed, true);

  // The painted seam block should map to a filled 4x4 area in decal space.
  for (let row = 0; row < decalHeight; row += 1) {
    for (let col = 0; col < decalWidth; col += 1) {
      const index = row * decalWidth + col;
      const inside = row >= 2 && row <= 5 && col >= 2 && col <= 5;
      assert.equal(Boolean(decalPixels[index]), inside);
    }
  }
});

test('returns false when seam has no changes', () => {
  const seamWidth = 5;
  const seamHeight = 5;
  const seamBasePixels = new Uint32Array(seamWidth * seamHeight);
  const seamPixels = new Uint32Array(seamBasePixels);
  const decalPixels = new Uint32Array(10 * 10);

  const changed = mapSeamEditsToDecalPixels.call({}, {
    entry: { canvasX: 0, canvasY: 0, canvasW: seamWidth, canvasH: seamHeight },
    seamPixels,
    seamBasePixels,
    seamWidth,
    seamHeight,
    decalPixels,
    decalWidth: 10,
    decalHeight: 10
  });

  assert.equal(changed, false);
});
