import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEditorMenuLayoutPlan,
  getEditorMenuPlacement,
  getMenuScrollPolicy,
  resolveEditorLayoutMode
} from '../../src/ui/shared/editorMenuLayout.js';
import { EDITOR_LAYOUT_MODES } from '../../src/ui/shared/editorMenuSpec.js';

test('layout mode resolver distinguishes portrait, landscape, desktop, and gamepad', () => {
  assert.equal(resolveEditorLayoutMode({ isMobile: true, viewportWidth: 390, viewportHeight: 844 }), EDITOR_LAYOUT_MODES.PORTRAIT);
  assert.equal(resolveEditorLayoutMode({ isMobile: true, viewportWidth: 844, viewportHeight: 390 }), EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH);
  assert.equal(resolveEditorLayoutMode({ isMobile: false, viewportWidth: 1280, viewportHeight: 800 }), EDITOR_LAYOUT_MODES.DESKTOP);
  assert.equal(resolveEditorLayoutMode({ isMobile: true, viewportWidth: 844, viewportHeight: 390, gamepadConnected: true }), EDITOR_LAYOUT_MODES.GAMEPAD);
});

test('layout placements match the RTG Studio editor UI contract', () => {
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.PORTRAIT), {
    root: 'bottom-rail',
    submenu: 'bottom-sheet',
    settings: 'top-context'
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH), {
    root: 'left-rail',
    submenu: 'right-drawer',
    settings: 'right-drawer'
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.DESKTOP), {
    root: 'top-menu',
    submenu: 'dropdown',
    settings: 'left-panel'
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.GAMEPAD), {
    root: 'left-slide-rail',
    submenu: 'slide-out-drawer',
    settings: 'slide-out-drawer'
  });
});

test('editor menu layout plan exposes mode-specific behavior flags', () => {
  const desktop = buildEditorMenuLayoutPlan('pixel', { isMobile: false, viewportWidth: 1280, viewportHeight: 800 });
  assert.equal(desktop.mode, EDITOR_LAYOUT_MODES.DESKTOP);
  assert.equal(desktop.desktop.usesTopMenu, true);
  assert.equal(desktop.desktop.showPersistentLeftOptions, true);
  assert.equal(desktop.touch.usesBottomMenus, false);
  assert.ok(desktop.rootIds.includes('layers'));

  const gamepad = buildEditorMenuLayoutPlan('level', { isMobile: true, viewportWidth: 844, viewportHeight: 390, gamepadConnected: true });
  assert.equal(gamepad.mode, EDITOR_LAYOUT_MODES.GAMEPAD);
  assert.equal(gamepad.gamepad.rootCollapsesAfterSelect, true);
  assert.equal(gamepad.gamepad.confirm, 'A');
  assert.equal(gamepad.gamepad.back, 'B');
  assert.equal(gamepad.touch.usesSideRails, false);
});

test('menu scroll policy always reserves pinch zoom for work surfaces', () => {
  const touch = getMenuScrollPolicy({ pointerType: 'touch', mode: EDITOR_LAYOUT_MODES.PORTRAIT });
  assert.equal(touch.enabled, true);
  assert.equal(touch.thresholdPx, 8);
  assert.equal(touch.suppressClickAfterDrag, true);
  assert.equal(touch.pinchZoomReservedForWorkSurface, true);
  assert.equal(touch.wheelRoutesToHoveredPanel, false);

  const desktop = getMenuScrollPolicy({ pointerType: 'mouse', mode: EDITOR_LAYOUT_MODES.DESKTOP });
  assert.equal(desktop.wheelRoutesToHoveredPanel, true);
});
