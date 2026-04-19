import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { ensureActorDefinition } from '../../src/content/actorEditorData.js';

const serializeCurrentAnimationAsArtDocument = PixelStudio.prototype.serializeCurrentAnimationAsArtDocument;

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
