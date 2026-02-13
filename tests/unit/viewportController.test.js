import test from 'node:test';
import assert from 'node:assert/strict';

import { createViewportController, screenToWorld, worldToScreen } from '../../src/ui/shared/viewportController.js';

test('clamps zoom to min/max bounds', () => {
  const viewport = createViewportController({ minZoom: 0.25, maxZoom: 3 });
  assert.equal(viewport.clampZoom(10), 3);
  assert.equal(viewport.clampZoom(0.01), 0.25);
});

test('gesture interruption resets prior pinch state', () => {
  const viewport = createViewportController();
  viewport.beginPinch({ x: 10, y: 10, distance: 100 }, { tag: 'first' });
  viewport.beginPinch({ x: 20, y: 20, distance: 50 }, { tag: 'second' });
  const pinch = viewport.updatePinch({ x: 25, y: 20, distance: 100 });
  assert.equal(pinch.context.tag, 'second');
  assert.equal(Math.round(pinch.scale * 100), 200);
});

test('touch-to-mouse transition clears pan gesture state', () => {
  const viewport = createViewportController();
  viewport.beginPan({ x: 10, y: 5 }, { x: 100, y: 200 }, { source: 'touch' });
  const moved = viewport.updatePan({ x: 15, y: 20 });
  assert.deepEqual(moved, { x: 105, y: 215, source: 'touch' });
  viewport.cancelInteractions();
  assert.equal(viewport.updatePan({ x: 30, y: 30 }), null);
});

test('coordinate conversion helpers are inverse operations', () => {
  const viewport = { x: 12, y: -6, zoom: 2.5 };
  const world = { x: 30, y: 14 };
  const screen = worldToScreen(world, viewport);
  const nextWorld = screenToWorld(screen, viewport);
  assert.equal(nextWorld.x, world.x);
  assert.equal(nextWorld.y, world.y);
});
