import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { ensureActorDefinition } from '../../src/content/actorEditorData.js';

const serializeCurrentAnimationAsArtDocument = PixelStudio.prototype.serializeCurrentAnimationAsArtDocument;
const shouldLoadArtAsAnimationDocument = PixelStudio.prototype.shouldLoadArtAsAnimationDocument;
const loadAnimationArtDocument = PixelStudio.prototype.loadAnimationArtDocument;
const buildActorStateArtDocName = PixelStudio.prototype.buildActorStateArtDocName;
const saveArtDocument = PixelStudio.prototype.saveArtDocument;
const commitActorStateArtRef = PixelStudio.prototype.commitActorStateArtRef;

test('serializeCurrentAnimationAsArtDocument exports composited frames for actor-state saves', () => {
  const editor = {
    canvasState: { width: 1, height: 1, activeLayerIndex: 0 },
    animation: {
      frames: [{
        durationMs: 125,
        layers: [{
          name: 'Layer 1',
          visible: true,
          locked: false,
          opacity: 1,
          pixels: new Uint32Array([0xff0000ff >>> 0])
        }]
      }]
    }
  };

  const payload = serializeCurrentAnimationAsArtDocument.call(editor);

  assert.equal(payload.kind, 'actor-state-animation');
  assert.equal(payload.width, 1);
  assert.equal(payload.height, 1);
  assert.equal(payload.size, 1);
  assert.equal(payload.fps, 8);
  assert.deepEqual(payload.frames, [['#ff0000']]);
  assert.equal(payload.editor.activeLayerIndex, 0);
});

test('ensureActorDefinition preserves animation artRef metadata', () => {
  const actor = ensureActorDefinition({
    name: 'Test Bot',
    states: [{
      id: 'idle',
      name: 'Idle',
      animation: {
        imageDataUrl: 'data:image/png;base64,abc',
        fps: 6,
        updatedAt: 1,
        artRef: 'test-bot-idle-art'
      }
    }]
  });

  assert.equal(actor.states[0].animation.artRef, 'test-bot-idle-art');
});

test('buildActorStateArtDocName creates a stable art filename', () => {
  const name = buildActorStateArtDocName.call({}, 'Boss Prime', 'Idle / Loop');
  assert.equal(name, 'boss-prime-idle-loop-art');
});

test('actor-state art payloads load as animation documents, not tile art', () => {
  const payload = {
    kind: 'actor-state-animation',
    width: 2,
    height: 1,
    fps: 10,
    frames: [['#ff0000', null]]
  };

  assert.equal(shouldLoadArtAsAnimationDocument.call({
    decalEditSession: { type: 'actor-state' },
    tileEditSession: true,
    forceArtDocumentSave: false
  }, payload), true);

  const editor = {
    tileEditSession: true,
    tilePickerMode: true,
    forceArtDocumentSave: false,
    canvasState: {},
    animation: {},
    artSizeDraft: {},
    setFrameLayers(layers) {
      this.canvasState.layers = layers;
    },
    clearSelection() {},
    zoomToFitCanvas() {}
  };

  loadAnimationArtDocument.call(editor, payload);

  assert.equal(editor.tileEditSession, false);
  assert.equal(editor.tilePickerMode, false);
  assert.equal(editor.forceArtDocumentSave, true);
  assert.equal(editor.canvasState.width, 4);
  assert.equal(editor.canvasState.height, 4);
  assert.equal(editor.animation.frames.length, 1);
  assert.equal(editor.animation.frames[0].layers[0].pixels[0], 0xff0000ff >>> 0);
});

test('tile documents still load through the tile-art path during tile editing', () => {
  const payload = {
    size: 1,
    fps: 8,
    frames: [['#ff00ff']]
  };

  assert.equal(shouldLoadArtAsAnimationDocument.call({
    decalEditSession: null,
    tileEditSession: true,
    forceArtDocumentSave: false
  }, payload), false);
});

test('saveArtDocument does not rewrite tile autosave during actor-state saves', async () => {
  let persisted = false;
  let committed = null;
  const editor = {
    currentDocumentRef: { folder: 'art', name: 'boss-idle-art' },
    animation: { frames: [{ durationMs: 125 }] },
    decalEditSession: { type: 'actor-state', onCommit: (animation) => { committed = animation; } },
    runtime: {
      async saveAsOrCurrent() {
        return { name: 'boss-idle-art' };
      }
    },
    commitActorStateArtRef,
    persistTileArtAutosave() {
      persisted = true;
    }
  };
  const result = await saveArtDocument.call(editor);
  assert.equal(result?.name, 'boss-idle-art');
  assert.equal(persisted, false);
  assert.equal(committed?.artRef, 'boss-idle-art');
  assert.equal(committed?.fps, 8);
  assert.equal(editor.decalEditSession?.type, 'actor-state');
});

test('commitActorStateArtRef can clear actor-state edit sessions after saving and returning', () => {
  let committed = null;
  const editor = {
    currentDocumentRef: { folder: 'art', name: 'player-idle-art' },
    animation: { frames: [{ durationMs: 250 }] },
    decalEditSession: { type: 'actor-state', onCommit: (animation) => { committed = animation; } }
  };

  const result = commitActorStateArtRef.call(editor, { clearSession: true });

  assert.equal(result.artRef, 'player-idle-art');
  assert.equal(result.fps, 4);
  assert.equal(committed.artRef, 'player-idle-art');
  assert.equal(editor.decalEditSession, null);
});
