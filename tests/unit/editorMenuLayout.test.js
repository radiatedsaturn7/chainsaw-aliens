import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDesktopEditorShellPlan,
  buildDesktopDropdownPlan,
  buildDesktopTopMenuPlan,
  buildEditorMenuLayoutPlan,
  buildGamepadSlideOutMenuPlan,
  getEditorPointerInteractionPolicy,
  getEditorMenuPlacement,
  getMenuScrollPolicy,
  resolveEditorLayoutMode
} from '../../src/ui/shared/editorMenuLayout.js';
import { EDITOR_LAYOUT_MODES, getEditorMenuSection } from '../../src/ui/shared/editorMenuSpec.js';

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
  assert.ok(plan.buttons.every((button) => button.bounds.x + button.bounds.w <= plan.bounds.x + plan.bounds.w - plan.bounds.padding));
  assert.equal(plan.buttons.find((button) => button.id === 'pixels')?.active, true);
  assert.equal(plan.dropdown.rootId, 'pixels');
  assert.equal(plan.dropdown.specId, 'tile-art');
  assert.equal(plan.dropdown.title, 'Tile Art');
  assert.ok(plan.dropdown.bounds.y >= 42);
  assert.ok(plan.dropdown.bounds.x + plan.dropdown.bounds.w <= plan.bounds.x + plan.bounds.w - plan.bounds.padding);
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

test('desktop dropdown plan clamps to container bounds when supplied', () => {
  const dropdown = buildDesktopDropdownPlan('level', 'playtest', {
    anchor: { x: 700, y: 4, w: 52, h: 38 },
    containerBounds: { x: 10, y: 4, w: 760, h: 38, padding: 8 }
  });

  assert.equal(dropdown.rootId, 'playtest');
  assert.equal(dropdown.bounds.w, 220);
  assert.equal(dropdown.bounds.x + dropdown.bounds.w <= 10 + 760 - 8, true);
  assert.equal(dropdown.bounds.y, 42);
});

test('shared file menu specs include the actions used by editor surfaces', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'file').actions, ['new', 'save', 'save-as', 'open', 'import', 'export', 'copy-image', 'paste-image', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('level', 'file').actions, ['new', 'save', 'save-as', 'open', 'import', 'export', 'undo', 'redo', 'playtest', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('midi', 'file').actions, ['new', 'save', 'save-as', 'open', 'import', 'export', 'nav-grid', 'nav-instruments', 'nav-virtual-instruments', 'nav-pedals', 'nav-settings', 'rescue-save', 'export-midi', 'export-midi-zip', 'export-wav', 'save-paint', 'play-robtersession', 'theme', 'sample', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('sfx', 'file').actions, ['new', 'save', 'save-as', 'open', 'import', 'export', 'undo', 'redo', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'file').actions, ['new', 'save', 'save-as', 'open', 'import', 'export', 'undo', 'redo', 'exit-main']);

  const pixelDropdown = buildDesktopDropdownPlan('pixel', 'file');
  assert.deepEqual(pixelDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'import', 'export', 'copy-image', 'paste-image', 'exit-main']);

  const levelDropdown = buildDesktopDropdownPlan('level', 'file');
  assert.deepEqual(levelDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'import', 'export', 'undo', 'redo', 'playtest', 'exit-main']);
});

test('desktop editor shell plan reserves top menus and left ribbon/options', () => {
  const plan = buildDesktopEditorShellPlan('sfx', {
    viewportWidth: 1280,
    viewportHeight: 720,
    activeRootId: 'generate',
    leftPanelWidth: 312,
    leftRibbonHeight: 56
  });

  assert.equal(plan.mode, EDITOR_LAYOUT_MODES.DESKTOP);
  assert.deepEqual(plan.topMenu.bounds, { x: 0, y: 0, w: 1280, h: 40, itemMinWidth: 72, itemMaxWidth: 132, gap: 4, padding: 8 });
  assert.equal(plan.topMenu.buttons.find((button) => button.id === 'generate')?.active, true);
  assert.equal(plan.dropdown.rootId, 'generate');
  assert.deepEqual(plan.leftRibbon, { x: 8, y: 48, w: 304, h: 56 });
  assert.deepEqual(plan.leftOptions, { x: 8, y: 112, w: 304, h: 600 });
  assert.deepEqual(plan.workSurface, { x: 320, y: 48, w: 952, h: 664 });
  assert.equal(Object.hasOwn(plan, 'bottomBar'), false);
  assert.equal(plan.scroll.leftOptions.suppressClickAfterDrag, true);
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

test('pointer interaction policy separates desktop mouse from touch gestures', () => {
  const desktopPixel = getEditorPointerInteractionPolicy('pixel', {
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    pointerType: 'mouse'
  });

  assert.equal(desktopPixel.workSurface, 'canvas');
  assert.equal(desktopPixel.workSurfaceGestures.wheelZoom, true);
  assert.equal(desktopPixel.workSurfaceGestures.rightDragPan, true);
  assert.equal(desktopPixel.rightClick.opensContextMenu, true);
  assert.equal(desktopPixel.rightClick.suppressBrowserMenu, true);
  assert.equal(desktopPixel.thumbstick.allowed, false);

  const landscapeSfx = getEditorPointerInteractionPolicy('sfx', {
    mode: EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH,
    pointerType: 'touch'
  });
  assert.equal(landscapeSfx.workSurface, 'timeline');
  assert.equal(landscapeSfx.workSurfaceGestures.pinchZoom, true);
  assert.equal(landscapeSfx.menuScroll.suppressClickAfterDrag, true);
  assert.equal(landscapeSfx.thumbstick.showForMenus, false);
  assert.equal(landscapeSfx.thumbstick.avoidMenuOverlap, true);
});

test('gamepad pointer policy enables work surface pan without changing menu controls', () => {
  const gamepadLevel = getEditorPointerInteractionPolicy('level', {
    mode: EDITOR_LAYOUT_MODES.GAMEPAD,
    pointerType: 'gamepad',
    gamepadConnected: true
  });

  assert.equal(gamepadLevel.workSurfaceGestures.dragPan, true);
  assert.equal(gamepadLevel.thumbstick.allowed, true);
  assert.equal(gamepadLevel.thumbstick.showForWorkSurface, true);
  assert.equal(gamepadLevel.thumbstick.showForMenus, false);
  assert.equal(gamepadLevel.rightClick.opensContextMenu, false);
});
