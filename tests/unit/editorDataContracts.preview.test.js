import test from 'node:test';
import assert from 'node:assert/strict';

import { ensurePixelPreviewFrame } from '../../src/editor/adapters/editorDataContracts.js';

test('ensurePixelPreviewFrame prefers editor composite over stale frames', () => {
  const pixelData = {
    size: 1,
    frames: [['#ff0000']],
    editor: {
      width: 1,
      height: 1,
      frames: [{
        layers: [{ visible: true, pixels: new Uint32Array([0xffff00ff >>> 0]) }]
      }]
    }
  };

  const preview = ensurePixelPreviewFrame(pixelData, 0);

  assert.equal(preview[0], '#ff00ff');
  assert.equal(pixelData.frames[0][0], '#ff00ff');
});
