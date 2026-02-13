import assert from 'node:assert/strict';
import {
  clampZoom,
  startPan,
  movePan,
  endPan,
  startPinch,
  movePinch,
  endPinch,
  screenToWorld,
  worldToScreen
} from '../src/ui/shared/viewportController.js';

// min/max zoom clamp
assert.equal(clampZoom(0.01, { minZoom: 0.25, maxZoom: 3 }), 0.25);
assert.equal(clampZoom(99, { minZoom: 0.25, maxZoom: 3 }), 3);

// gesture interruption should safely reset and ignore moves
let pinch = startPinch({ x: 100, y: 100, distance: 50, zoom: 1, offsetX: 0, offsetY: 0 });
assert.ok(pinch);
pinch = endPinch();
assert.equal(pinch, null);
assert.equal(movePinch(pinch, { x: 120, y: 120, distance: 80 }, { minZoom: 0.5, maxZoom: 2 }), null);

// touch-to-mouse transition: end touch pan, then start mouse pan cleanly
let touchPan = startPan({ x: 10, y: 20, offsetX: 100, offsetY: 200 });
let moved = movePan(touchPan, { x: 20, y: 30 }, { scaleWithZoom: false });
assert.deepEqual(moved, { offsetX: 90, offsetY: 190 });
touchPan = endPan();
assert.equal(touchPan, null);
const mousePan = startPan({ x: 5, y: 5, offsetX: moved.offsetX, offsetY: moved.offsetY });
const movedMouse = movePan(mousePan, { x: 7, y: 9 }, { scaleWithZoom: false });
assert.deepEqual(movedMouse, { offsetX: 88, offsetY: 186 });

// coordinate conversion helpers round-trip
const viewport = { zoom: 2, offsetX: 50, offsetY: 75 };
const screen = worldToScreen(60, 80, viewport);
const world = screenToWorld(screen.x, screen.y, viewport);
assert.equal(world.x, 60);
assert.equal(world.y, 80);

console.log('viewport controller regressions passed');
