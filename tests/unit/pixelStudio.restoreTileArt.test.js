import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { loadProjectFile, resetProjectFilesForTests, saveProjectFile } from '../../src/ui/projectFiles.js';

const restoreStoredTileArtIfNeeded = PixelStudio.prototype.restoreStoredTileArtIfNeeded;
const hasLoadedPixelArtData = PixelStudio.prototype.hasLoadedPixelArtData;
const hydrateTileArtRefs = PixelStudio.prototype.hydrateTileArtRefs;
const hydrateTileArtRef = PixelStudio.prototype.hydrateTileArtRef;
const persistTileArtAutosave = PixelStudio.prototype.persistTileArtAutosave;
const syncTileData = PixelStudio.prototype.syncTileData;
const setTilePickerMode = PixelStudio.prototype.setTilePickerMode;
const isTileArtDocument = PixelStudio.prototype.isTileArtDocument;
const isTileArtEntry = PixelStudio.prototype.isTileArtEntry;
const findLatestTileArtDocument = PixelStudio.prototype.findLatestTileArtDocument;
const normalizeLoadedArtDocument = PixelStudio.prototype.normalizeLoadedArtDocument;

function createEditor(world = {}) {
  return {
    game: { world, pixelStudioReturnState: 'editor' },
    currentDocumentRef: null,
    tilePickerMode: false,
    hasLoadedPixelArtData,
    hydrateTileArtRef,
    hydrateTileArtRefs,
    isTileArtDocument,
    isTileArtEntry,
    findLatestTileArtDocument,
    normalizeLoadedArtDocument,
    restoreStoredTileArtIfNeeded
  };
}

test.beforeEach(() => {
  resetProjectFilesForTests();
});

test.afterEach(() => {
  resetProjectFilesForTests();
});

test('restores autosave tile art even when not returning from title', () => {
  saveProjectFile('art', 'Tile Art Autosave', {
    tiles: {
      '#': { frames: [['#ff69ff']] }
    }
  });

  const editor = createEditor({});
  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt?.tiles?.['#']?.frames?.[0]?.[0], '#ff69ff');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'art', name: 'Tile Art Autosave' });
});

test('does not overwrite already loaded art document data', () => {
  saveProjectFile('art', 'Tile Art Autosave', {
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
  editor.currentDocumentRef = { folder: 'art', name: 'existing-art-doc' };

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#ff0000');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'art', name: 'existing-art-doc' });
});

test('tile picker mode can restore autosave even with an existing art currentDocumentRef', () => {
  saveProjectFile('art', 'Tile Art Autosave', {
    tiles: {
      '#': { frames: [['#55aaff']], editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] } }
    }
  });

  const editor = createEditor({
    pixelArt: {
      tiles: {
        '#': { frames: [['#ff0000']], editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] } }
      }
    }
  });
  editor.tilePickerMode = true;
  editor.currentDocumentRef = { folder: 'art', name: 'old-art-doc' };

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#55aaff');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'art', name: 'Tile Art Autosave' });
});

test('restores autosave over plain frame-only in-memory tile data', () => {
  saveProjectFile('art', 'Tile Art Autosave', {
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
  saveProjectFile('art', 'Tile Art 23', {
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
  saveProjectFile('art', 'Tile Art Autosave', {
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

test('prefers tile autosave over loaded non-art world data', () => {
  saveProjectFile('art', 'Tile Art Autosave', {
    tiles: {
      '#': { frames: [['#a000ff']], editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] } }
    }
  });
  const editor = createEditor({
    pixelArt: {
      tiles: {
        '#': { frames: [['#ff0000']], editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] } }
      }
    }
  });
  editor.currentDocumentRef = { folder: 'levels', name: 'Level Editor Autosave' };

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#a000ff');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'art', name: 'Tile Art Autosave' });
});

test('falls back to level autosave pixel art when tile autosave is absent', () => {
  saveProjectFile('levels', 'Level Editor Autosave', {
    pixelArt: {
      tiles: {
        '#': { frames: [['#44ccff']], editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] } }
      }
    }
  });
  const editor = createEditor({});

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#44ccff');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'levels', name: 'Level Editor Autosave' });
});

test('fallback latest art ignores newer actor animation documents', async () => {
  saveProjectFile('art', 'Tile Art 23', {
    size: 1,
    frames: [['#123456']],
    editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] }
  });
  await new Promise((resolve) => setTimeout(resolve, 2));
  saveProjectFile('art', 'head-idle-art', {
    kind: 'actor-state-animation',
    width: 1,
    height: 1,
    frames: [['#ff0000']]
  });
  const editor = createEditor({});

  restoreStoredTileArtIfNeeded.call(editor);

  assert.equal(editor.game.world.pixelArt.tiles['#'].frames[0][0], '#123456');
  assert.deepEqual(editor.currentDocumentRef, { folder: 'art', name: 'Tile Art 23' });
});

test('actor animation art is never normalized into solid tile art', () => {
  const normalized = normalizeLoadedArtDocument.call({
    isTileArtDocument,
    isTileArtEntry,
    activeTile: { char: '#' },
    tileLibrary: [{ char: '#' }]
  }, {
    kind: 'actor-state-animation',
    width: 1,
    height: 1,
    frames: [['#ff0000']]
  });

  assert.deepEqual(normalized, { tiles: {} });
});

test('actor-sized tile autosave entries are rejected for map tile rendering', () => {
  saveProjectFile('art', 'Tile Art 23', {
    size: 512,
    frames: [Array.from({ length: 512 * 512 }, (_, index) => (index % 100 === 0 ? '#ff0000' : null))]
  });
  saveProjectFile('art', 'Tile Art Autosave', {
    tiles: {
      '#': { ref: 'Tile Art 23' }
    }
  });
  const editor = createEditor({});

  restoreStoredTileArtIfNeeded.call(editor);

  assert.deepEqual(editor.game.world.pixelArt, { tiles: {} });
  assert.equal(editor.currentDocumentRef, null);
});

test('already-hydrated actor-sized tile entries do not count as loaded tile art', () => {
  const editor = createEditor({
    pixelArt: {
      tiles: {
        '#': {
          size: 512,
          frames: [Array.from({ length: 512 * 512 }, (_, index) => (index % 100 === 0 ? '#ff0000' : null))]
        }
      }
    }
  });

  assert.equal(hasLoadedPixelArtData.call(editor, editor.game.world.pixelArt), false);
});

test('does not overwrite existing tile autosave with an empty store', () => {
  saveProjectFile('art', 'Tile Art Autosave', {
    tiles: {
      '#': { ref: 'Tile Art 23' }
    }
  });
  const before = loadProjectFile('art', 'Tile Art Autosave');
  const editor = {
    game: { world: { pixelArt: { tiles: {} } } },
    lastTileArtAutosaveAt: 0,
    getTileArtDocName() {
      return 'Tile Art 00';
    },
    currentDocumentRef: null
  };

  persistTileArtAutosave.call(editor, true);

  const after = loadProjectFile('art', 'Tile Art Autosave');
  assert.deepEqual(after, before);
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
  assert.equal(loadProjectFile('art', 'Tile Art 23'), null);
  assert.equal(loadProjectFile('art', 'Tile Art Autosave'), null);
});

test('hydrateTileArtRef hydrates a single ref-only tile for preview use', () => {
  saveProjectFile('art', 'Tile Art 23', {
    size: 1,
    frames: [['#ff00ff']],
    editor: { width: 1, height: 1, frames: [{ durationMs: 33, layers: [] }] }
  });
  const store = { tiles: { '#': { ref: 'Tile Art 23' } } };
  const editor = {
    game: { world: { pixelArt: store } },
    isTileArtEntry
  };

  const hydrated = hydrateTileArtRef.call(editor, '#', store.tiles['#']);

  assert.equal(hydrated.frames[0][0], '#ff00ff');
  assert.equal(store.tiles['#'].frames[0][0], '#ff00ff');
});

test('setTilePickerMode(true) triggers restore/hydration for preview rendering', () => {
  let restoreCalls = 0;
  let hydrateCalls = 0;
  const editor = {
    tilePickerMode: false,
    restoreStoredTileArtIfNeeded() {
      restoreCalls += 1;
    },
    hydrateTileArtRefs() {
      hydrateCalls += 1;
    }
  };

  setTilePickerMode.call(editor, true);

  assert.equal(editor.tilePickerMode, true);
  assert.equal(restoreCalls, 1);
  assert.equal(hydrateCalls, 1);
});
