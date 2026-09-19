import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import {
  buildArtPreviewPixels,
  parseArtPixelRgba
} from '../../src/ui/shared/artDocumentPixels.js';
import { createArtPreviewDataUrl } from '../../src/ui/ProjectBrowserModal.js';
import { getRaceArtSpriteCanvasShared } from '../../src/ui/shared/raceArtSpriteCanvas.js';
import { resetProjectFilesForTests } from '../../src/ui/projectFiles.js';
import { upsertCachedProjectFile } from '../../src/ui/serverStorage.js';

function readCommittedArt(name) {
  const envelope = JSON.parse(readFileSync(
    new URL(`../../data/server-storage/files/art/${name}/document.json`, import.meta.url),
    'utf8'
  ));
  return envelope?.encoding === 'json-gzip-base64'
    ? JSON.parse(gunzipSync(Buffer.from(envelope.data, 'base64')).toString('utf8'))
    : envelope;
}

function createCanvasDocument(onPixels = () => {}) {
  return {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            createImageData(width, height) {
              return { data: new Uint8ClampedArray(width * height * 4) };
            },
            putImageData(imageData) {
              onPixels(imageData.data);
            }
          };
        },
        toDataURL() {
          return 'data:image/png;base64,preview';
        }
      };
    }
  };
}

test('shared art pixels preserve RGB, RGBA, numeric, and transparent values', () => {
  assert.deepEqual(parseArtPixelRgba('#123456'), { r: 18, g: 52, b: 86, a: 255 });
  assert.deepEqual(parseArtPixelRgba('#12345678'), { r: 18, g: 52, b: 86, a: 120 });
  assert.deepEqual(parseArtPixelRgba(0x44332211), { r: 17, g: 34, b: 51, a: 68 });
  assert.equal(parseArtPixelRgba(null), null);
});

for (const artName of ['tree', '1000014256']) {
  test(`committed ${artName} compact art produces a visible alpha-aware preview`, () => {
    const document = readCommittedArt(artName);
    const preview = buildArtPreviewPixels(document, { maxDimension: 64 });

    assert.ok(preview);
    assert.ok(preview.width <= 64);
    assert.ok(preview.height <= 64);
    assert.ok(preview.visiblePixelCount > 0);
    assert.equal(preview.rgba.some((value, index) => index % 4 === 3 && value > 0 && value < 255), true);
  });
}

test('Project Browser and doodad canvas share eight-digit pixel behavior', () => {
  const art = { width: 2, height: 1, frames: [['#ff000080', null]] };
  let previewPixels = null;
  const previewUrl = createArtPreviewDataUrl(art, createCanvasDocument((pixels) => {
    previewPixels = [...pixels];
  }));
  assert.equal(previewUrl, 'data:image/png;base64,preview');
  assert.deepEqual(previewPixels, [255, 0, 0, 128, 0, 0, 0, 0]);

  resetProjectFilesForTests();
  try {
    upsertCachedProjectFile('art', 'alpha-art', JSON.stringify({
      version: 1,
      folder: 'art',
      name: 'alpha-art',
      savedAt: 1,
      data: art
    }));
    let doodadPixels = null;
    const canvas = getRaceArtSpriteCanvasShared('alpha-art', {
      documentRef: createCanvasDocument((pixels) => {
        doodadPixels = [...pixels];
      })
    });
    assert.ok(canvas);
    assert.deepEqual(doodadPixels, previewPixels);
  } finally {
    resetProjectFilesForTests();
  }
});
