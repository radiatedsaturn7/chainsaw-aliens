import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { buildTransformHandleMeta, hitTestTransformHandles } from '../../src/ui/shared/transformHandles.js';

const pixelStudioSource = readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8');

test('selection action buttons are priority UI hits', () => {
  const editor = Object.create(PixelStudio.prototype);
  let clicks = 0;
  editor.uiButtons = [{
    bounds: { x: 10, y: 20, w: 80, h: 30 },
    group: 'selection-actions',
    onClick: () => { clicks += 1; }
  }];
  editor.pointerDownOnUi = false;

  const handled = PixelStudio.prototype.handlePriorityUiDragHit.call(editor, { x: 30, y: 35, id: 1 });

  assert.equal(handled, true);
  assert.equal(clicks, 1);
  assert.equal(editor.pointerDownOnUi, true);
});

test('selection actions clear stale context menu state before running', () => {
  const editor = Object.create(PixelStudio.prototype);
  editor.selectionContextMenu = { x: 1, y: 2 };
  let ran = false;

  PixelStudio.prototype.runSelectionAction.call(editor, () => { ran = true; });

  assert.equal(ran, true);
  assert.equal(editor.selectionContextMenu, null);
});

test('desktop right-click opens selection menu before fallback canvas pan', () => {
  const pointerDownIndex = pixelStudioSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = pixelStudioSource.slice(pointerDownIndex, pixelStudioSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const contextIndex = pointerDownBody.indexOf('this.isDesktopSelectionContextClick(payload)');
  const panIndex = pointerDownBody.indexOf('this.viewportController.beginPan(payload');

  assert.ok(contextIndex > 0);
  assert.ok(panIndex > contextIndex);
});

test('desktop selection context clicks only target active selected pixels', () => {
  const editor = Object.create(PixelStudio.prototype);
  editor.isMobileLayout = () => false;
  editor.canvasBounds = { x: 10, y: 20, w: 40, h: 40, cellSize: 10 };
  editor.canvasState = { width: 4, height: 4 };
  editor.toolOptions = { wrapDraw: false };
  editor.selection = {
    active: true,
    bounds: { x: 1, y: 1, w: 2, h: 2 },
    mask: Uint8Array.from([
      0, 0, 0, 0,
      0, 1, 1, 0,
      0, 1, 1, 0,
      0, 0, 0, 0
    ])
  };

  assert.equal(PixelStudio.prototype.isDesktopSelectionContextClick.call(editor, { x: 25, y: 35, button: 2 }), true);
  assert.equal(PixelStudio.prototype.isDesktopSelectionContextClick.call(editor, { x: 15, y: 25, button: 2 }), false);
  assert.equal(PixelStudio.prototype.isDesktopSelectionContextClick.call(editor, { x: 25, y: 35, button: 0 }), false);
});

test('transform handle hit testing can prefer rotate over overlapping scale handles', () => {
  const meta = buildTransformHandleMeta({ x: 0, y: 0, w: 10, h: 10, orbOffset: 1 });
  const point = { ...meta.rotateOrb };

  const defaultHit = hitTestTransformHandles({ point, meta, radius: 2 });
  const rotateFirstHit = hitTestTransformHandles({ point, meta, radius: 2, rotateFirst: true });

  assert.equal(defaultHit.type, 'scale');
  assert.equal(defaultHit.handle.key, 'n');
  assert.equal(rotateFirstHit.type, 'rotate');
});

test('PixelStudio selection transform metadata keeps rotate orb away from north scale handle', () => {
  const editor = Object.create(PixelStudio.prototype);
  editor.selection = {
    bounds: { x: 3, y: 4, w: 8, h: 6 }
  };

  const meta = PixelStudio.prototype.getSelectionTransformMeta.call(editor, 0);
  const north = meta.handles.find((handle) => handle.key === 'n');

  assert.ok(north);
  assert.equal(Math.hypot(meta.rotateOrb.x - north.x, meta.rotateOrb.y - north.y), 7);
});
