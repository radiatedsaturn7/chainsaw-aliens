import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDesktopDropdownPlan,
  buildDesktopTopMenuPlan,
  buildEditorMenuLayoutPlan,
  buildGamepadSlideOutMenuPlan,
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

test('desktop top menu plan creates bounded root buttons and active dropdown', () => {
  const plan = buildDesktopTopMenuPlan('level', {
    bounds: { x: 10, y: 4, w: 760, h: 38 },
    activeRootId: 'pixels',
    labelOverrides: { file: 'Menu' }
  });

  assert.equal(plan.mode, EDITOR_LAYOUT_MODES.DESKTOP);
  assert.equal(plan.buttons[0].id, 'file');
  assert.equal(plan.buttons[0].label, 'Menu');
  assert.ok(plan.buttons.every((button) => button.bounds.y === 4));
  assert.equal(plan.buttons.find((button) => button.id === 'pixels')?.active, true);
  assert.equal(plan.dropdown.rootId, 'pixels');
  assert.equal(plan.dropdown.specId, 'tile-art');
  assert.equal(plan.dropdown.title, 'Tile Art');
  assert.ok(plan.dropdown.bounds.y >= 42);
});

test('desktop dropdown plan resolves section actions through runtime aliases', () => {
  const dropdown = buildDesktopDropdownPlan('midi', 'instruments', {
    anchor: { x: 120, y: 8, w: 96, h: 32 }
  });

  assert.equal(dropdown.rootId, 'instruments');
  assert.equal(dropdown.specId, 'tracks');
  assert.equal(dropdown.title, 'Tracks / Mixer');
  assert.deepEqual(dropdown.items.map((item) => item.id), ['track-list', 'instrument', 'volume', 'pan', 'mute', 'solo']);
  assert.deepEqual(dropdown.bounds, { x: 120, y: 40, w: 220, h: 204 });
});

test('gamepad slide-out plan keeps root open until a submenu is selected', () => {
  const root = buildGamepadSlideOutMenuPlan('sfx', {
    rootOpen: true,
    activeRootId: 'timeline'
  });

  assert.equal(root.mode, EDITOR_LAYOUT_MODES.GAMEPAD);
  assert.equal(root.rootCollapsed, false);
  assert.equal(root.submenu, null);
  assert.equal(root.controls.confirm, 'A');
  assert.equal(root.controls.back, 'B');

  const submenu = buildGamepadSlideOutMenuPlan('sfx', {
    rootOpen: false,
    activeRootId: 'timeline',
    focusedItemId: 'play'
  });
  assert.equal(submenu.rootCollapsed, true);
  assert.equal(submenu.activeRootId, 'timeline');
  assert.equal(submenu.activeSpecId, 'timeline');
  assert.equal(submenu.focusedItemId, 'play');
  assert.deepEqual(submenu.submenu.items.map((item) => item.id), ['play', 'stop', 'scrub', 'start', 'end']);
  assert.equal(submenu.scroll.submenu.thresholdPx, 8);
});
