import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { vfsSave } from '../../src/ui/vfs.js';

const restoreStoredTileArtIfNeeded = PixelStudio.prototype.restoreStoredTileArtIfNeeded;
const hasLoadedPixelArtData = PixelStudio.prototype.hasLoadedPixelArtData;
const hydrateTileArtRefs = PixelStudio.prototype.hydrateTileArtRefs;
const persistTileArtAutosave = PixelStudio.prototype.persistTileArtAutosave;
const syncTileData = PixelStudio.prototype.syncTileData;

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
        '#': {
          frames: [['#ff0000']],
          editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] }
        }
      }
    }
  });

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#ff0000');
  assert.equal(editor.currentDocumentRef, null);
});

test('restores autosave over plain frame-only in-memory tile data', () => {
  vfsSave('art', 'Tile Art Autosave', {
    tiles: {
      '#': { frames: [['#00ff00']], editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] } }
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

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#00ff00');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'art', name: 'Tile Art Autosave' });
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

test('restores autosave even when current document ref points at a level doc', () => {
  vfsSave('art', 'Tile Art Autosave', {
    tiles: {
      '#': { frames: [['#aa00ff']], editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] } }
    }
  });

  const editor = createEditor({});
  editor.currentDocumentRef = { folder: 'levels', name: 'Level Editor Autosave' };

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#aa00ff');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'art', name: 'Tile Art Autosave' });
});

test('does not overwrite existing tile autosave with an empty store', () => {
  vfsSave('art', 'Tile Art Autosave', {
    tiles: {
      '#': { ref: 'Tile Art 23' }
    }
  });
  const before = window.localStorage.getItem('robter:vfs:art:Tile Art Autosave');
  const editor = {
    game: { world: { pixelArt: { tiles: {} } } },
    lastTileArtAutosaveAt: 0,
    getTileArtDocName() {
      return 'Tile Art 00';
    },
    currentDocumentRef: null
  };

  persistTileArtAutosave.call(editor, true);

  const after = window.localStorage.getItem('robter:vfs:art:Tile Art Autosave');
  assert.equal(after, before);
});

test('syncTileData updates in-memory tile state without persisting when persist=false', () => {
  const editor = {
    decalEditSession: null,
    activeTile: { char: '#' },
    game: { world: { pixelArt: { tiles: { '#': { frames: [[]], size: 1, fps: 6 } } } } },
    canvasState: { width: 1, height: 1, activeLayerIndex: 0 },
    animation: {
      frames: [{
        durationMs: 120,
        layers: [{
          name: 'Layer 1',
          visible: true,
          locked: false,
          opacity: 1,
          pixels: new Uint32Array([0xff00ffff >>> 0])
        }]
      }]
    },
    persistTileArtAutosave() {
      throw new Error('should not persist autosave when persist=false');
    },
    getTileArtDocName() {
      return 'Tile Art 23';
    }
  };

  syncTileData.call(editor, { persist: false });

  const tile = editor.game.world.pixelArt.tiles['#'];
  assert.equal(tile.frames[0][0], '#ffff00');
  assert.equal(window.localStorage.getItem('robter:vfs:art:Tile Art 23'), null);
  assert.equal(window.localStorage.getItem('robter:vfs:art:Tile Art Autosave'), null);
});
