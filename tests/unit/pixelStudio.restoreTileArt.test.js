import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { vfsSave } from '../../src/ui/vfs.js';

const restoreStoredTileArtIfNeeded = PixelStudio.prototype.restoreStoredTileArtIfNeeded;
const hasLoadedPixelArtData = PixelStudio.prototype.hasLoadedPixelArtData;
const hydrateTileArtRefs = PixelStudio.prototype.hydrateTileArtRefs;

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

function createEditor(world = {}) {
  return {
    game: { world, pixelStudioReturnState: 'editor' },
    currentDocumentRef: null,
    hasLoadedPixelArtData,
    hydrateTileArtRefs,
    restoreStoredTileArtIfNeeded
  };
}

test.beforeEach(() => {
  global.window = { localStorage: new MemoryStorage() };
});

test.afterEach(() => {
  delete global.window;
});

test('restores autosave tile art even when not returning from title', () => {
  vfsSave('art', 'Tile Art Autosave', {
    tiles: {
      '#': { frames: [['#ff69ff']] }
    }
  });

  const editor = createEditor({});
  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt?.tiles?.['#']?.frames?.[0]?.[0], '#ff69ff');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'art', name: 'Tile Art Autosave' });
});

test('does not overwrite already loaded in-memory tile art data', () => {
  vfsSave('art', 'Tile Art Autosave', {
    tiles: {
      '#': { frames: [['#00ff00']] }
    }
  });

  const editor = createEditor({
    pixelArt: {
      tiles: {
        '#': { frames: [['#ff0000']] }
      }
    }
  });

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#ff0000');
  assert.equal(editor.currentDocumentRef, null);
});

test('hydrates ref-only in-memory tiles before attempting fallback restore', () => {
  vfsSave('art', 'Tile Art 23', {
    frames: [['#123456']],
    editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] }
  });

  const editor = createEditor({
    pixelArt: {
      tiles: {
        '#': { ref: 'Tile Art 23' }
      }
    }
  });

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#123456');
  assert.equal(editor.currentDocumentRef, null);
});
