import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import DoodadEditor from '../../src/ui/DoodadEditor.js';

const doodadEditorSource = readFileSync(new URL('../../src/ui/DoodadEditor.js', import.meta.url), 'utf8');

function createMockContext() {
  const noop = () => {};
  return {
    save: noop,
    restore: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    drawImage: noop,
    arc: noop,
    moveTo: noop,
    lineTo: noop,
    rect: noop,
    clip: noop,
    roundRect: noop,
    setLineDash: noop,
    fillText: noop,
    measureText: (text = '') => ({ width: String(text).length * 7 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set lineWidth(value) { this._lineWidth = value; },
    get lineWidth() { return this._lineWidth; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
    set textAlign(value) { this._textAlign = value; },
    get textAlign() { return this._textAlign; },
    set textBaseline(value) { this._textBaseline = value; },
    get textBaseline() { return this._textBaseline; },
    set globalAlpha(value) { this._globalAlpha = value; },
    get globalAlpha() { return this._globalAlpha; }
  };
}

test('Doodad Editor portrait exposes shared thumbstick and bottom action rail', () => {
  let studioSprintPreviewDrawn = false;
  let studioSprintRequested = false;
  const editor = new DoodadEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    carEditor: {
      getCarEditorPreviewRace: () => { studioSprintRequested = true; },
      drawCarEditorStudioSprintPreviewRoad: () => { studioSprintPreviewDrawn = true; }
    }
  });

  editor.draw(createMockContext(), 390, 844);

  const ids = editor.buttons.map((button) => button.id);
  assert.equal(editor.activeViewportMode, 'portrait');
  assert.ok(editor.panJoystick.radius > 0);
  assert.equal(ids.includes('menu'), true);
  assert.equal(ids.includes('undo'), true);
  assert.equal(ids.includes('redo'), true);
  assert.equal(ids.includes('context'), true);
  assert.equal(ids.includes('hot-artwork'), true);
  assert.equal(ids.includes('hot-size'), true);
  assert.equal(ids.includes('hot-hitbox'), true);
  assert.equal(ids.includes('hot-collision'), true);
  assert.equal(studioSprintRequested, true);
  assert.equal(studioSprintPreviewDrawn, true);

  const menu = editor.buttons.find((button) => button.id === 'menu');
  editor.handlePointerDown({
    x: menu.bounds.x + menu.bounds.w / 2,
    y: menu.bounds.y + menu.bounds.h / 2,
    touchCount: 1
  });
  assert.equal(editor.mobileMenuOpen, true);

  editor.draw(createMockContext(), 390, 844);
  const menuIds = editor.buttons.map((button) => button.id);
  assert.equal(menuIds.includes('root-file'), true);
  assert.equal(menuIds.includes('root-artwork'), true);
  assert.equal(menuIds.includes('hot-artwork-menu'), false);
  assert.equal(menuIds.includes('hot-size-menu'), false);
  assert.equal(menuIds.includes('hot-hitbox-menu'), false);
  assert.equal(menuIds.includes('hot-collision-menu'), false);

  const fileRoot = editor.buttons.find((button) => button.id === 'root-file');
  editor.handlePointerDown({
    x: fileRoot.bounds.x + fileRoot.bounds.w / 2,
    y: fileRoot.bounds.y + fileRoot.bounds.h / 2,
    touchCount: 1
  });
  editor.draw(createMockContext(), 390, 844);
  const fileMenuIds = editor.buttons.map((button) => button.id);
  assert.equal(fileMenuIds.includes('export'), true);
  assert.equal(fileMenuIds.includes('import'), true);

  const artRoot = editor.buttons.find((button) => button.id === 'root-artwork');
  editor.handlePointerDown({
    x: artRoot.bounds.x + artRoot.bounds.w / 2,
    y: artRoot.bounds.y + artRoot.bounds.h / 2,
    touchCount: 1
  });
  assert.equal(editor.mobileMenuOpen, false);
  assert.equal(editor.portraitHotMenu, 'artwork');
});

test('Doodad Editor desktop uses shared top dropdowns and left settings panel', () => {
  const editor = new DoodadEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: { isGamepadConnected: () => false }
  });

  editor.draw(createMockContext(), 1280, 720);

  assert.equal(editor.activeViewportMode, 'desktop');
  assert.equal(editor.panJoystick.radius, 0);
  assert.ok(editor.buttons.some((button) => button.desktopRootId === 'file'));
  assert.ok(editor.buttons.some((button) => button.desktopRootId === 'size'));
  assert.ok(editor.sliderRegions.some((region) => region.id === 'doodad-width-slider'));
  assert.ok(editor.sliderRegions.some((region) => region.id === 'doodad-hitbox-width-slider'));
  assert.equal(doodadEditorSource.includes('drawSharedDesktopRibbon(ctx, ribbonBounds, {'), true);
  assert.equal(doodadEditorSource.includes('drawSharedDesktopTopMenu(ctx, shell.topMenu, {'), true);
  assert.equal(doodadEditorSource.includes('drawSharedDesktopContextPanel(ctx, panelBounds, {'), true);
  assert.equal(doodadEditorSource.includes('drawSharedDesktopDropdown(ctx, dropdownPlan, {'), true);
  assert.equal(doodadEditorSource.includes('drawSharedMenuButtonChrome(ctx, bounds, {'), true);
  assert.equal(doodadEditorSource.includes('drawSharedMenuButtonLabel(ctx, bounds, label, {'), true);
  assert.equal(doodadEditorSource.includes('buildSharedEditorFileMenu({'), true);
  assert.equal(doodadEditorSource.includes('contentRoles: getEditorDesktopLeftContextRoles(DOODAD_EDITOR_ID)'), true);
  assert.equal(doodadEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(doodadEditorSource.includes('applyDesktopDropdownWheelScrollState({'), true);
  assert.equal(doodadEditorSource.includes('createPendingDesktopDropdownHit(desktopDropdownHit, payload)'), true);
  assert.equal(doodadEditorSource.includes('resolvePendingDesktopDropdownHit(hit, payload)'), true);
  assert.equal(doodadEditorSource.includes('drawSharedPanel(ctx, shell.topMenu.bounds'), false);

  const fileRoot = editor.buttons.find((button) => button.desktopRootId === 'file');
  editor.handlePointerDown({
    x: fileRoot.bounds.x + fileRoot.bounds.w / 2,
    y: fileRoot.bounds.y + fileRoot.bounds.h / 2
  });
  assert.equal(editor.desktopDropdown.rootId, 'file');
  assert.equal(editor.openDesktopDropdownRootId, 'file');
  assert.equal(editor.closedDesktopDropdownRootId, null);
  assert.equal(Number.isFinite(editor.desktopDropdown.openedAtMs), true);

  assert.deepEqual(editor.getMenuItems('file').map((item) => item.id), [
    'new',
    'save',
    'save-as',
    'open',
    'export',
    'import',
    'exit-main'
  ]);

  editor.draw(createMockContext(), 1280, 720);
  const ids = editor.buttons.map((button) => button.id);
  assert.equal(ids.includes('desktop-action:new'), true);
  assert.equal(ids.includes('desktop-action:save'), true);
  assert.equal(ids.includes('desktop-action:export'), true);
  assert.equal(editor.buttons.find((button) => button.id === 'desktop-action:export').disabled, false);
  assert.equal(editor.buttons.find((button) => button.id === 'desktop-action:import').disabled, false);
  assert.equal(typeof editor.buttons.find((button) => button.id === 'desktop-action:export').onClick, 'function');
  assert.equal(typeof editor.buttons.find((button) => button.id === 'desktop-action:import').onClick, 'function');
  assert.ok(editor.desktopDropdownRegions.length > 0);

  const beforeScroll = editor.desktopDropdownScroll.file || 0;
  const scrollRegion = editor.desktopDropdownRegions[0].bounds || editor.desktopDropdownRegions[0];
  editor.desktopDropdown = {
    ...editor.desktopDropdown,
    panelBounds: scrollRegion,
    maxScroll: 3
  };
  editor.handleWheel({
    x: scrollRegion.x + scrollRegion.w / 2,
    y: scrollRegion.y + scrollRegion.h / 2,
    deltaY: 48
  });
  assert.notEqual(editor.desktopDropdownScroll.file || 0, beforeScroll);

  const sizeRoot = editor.buttons.find((button) => button.desktopRootId === 'size');
  editor.handlePointerMove({
    x: sizeRoot.bounds.x + sizeRoot.bounds.w / 2,
    y: sizeRoot.bounds.y + sizeRoot.bounds.h / 2
  });
  assert.equal(editor.openDesktopDropdownRootId, 'size');
  assert.equal(editor.closedDesktopDropdownRootId, null);

  editor.draw(createMockContext(), 1280, 720);
  assert.equal(editor.desktopDropdown.rootId, 'size');
  assert.equal(editor.buttons.some((button) => button.id === 'desktop-action:width-up'), true);

  editor.handlePointerDown({ x: 1220, y: 680 });
  assert.equal(editor.desktopDropdown, null);
  assert.equal(editor.openDesktopDropdownRootId, null);
  assert.equal(editor.closedDesktopDropdownRootId, 'size');

  editor.draw(createMockContext(), 1280, 720);
  assert.equal(editor.desktopDropdown, null);
  assert.equal(editor.buttons.some((button) => button.id === 'desktop-action:new'), false);

  editor.handlePointerDown({
    x: sizeRoot.bounds.x + sizeRoot.bounds.w / 2,
    y: sizeRoot.bounds.y + sizeRoot.bounds.h / 2
  });
  assert.equal(editor.desktopDropdown.rootId, 'size');
  assert.equal(editor.openDesktopDropdownRootId, 'size');
  assert.equal(editor.closedDesktopDropdownRootId, null);

  editor.draw(createMockContext(), 1280, 720);
  const widthUp = editor.buttons.find((button) => button.id === 'desktop-action:width-up');
  const previousWidth = editor.doodad.widthM;
  editor.handlePointerDown({
    x: widthUp.bounds.x + widthUp.bounds.w / 2,
    y: widthUp.bounds.y + widthUp.bounds.h / 2
  });
  assert.equal(editor.doodad.widthM, previousWidth);
  editor.handlePointerUp({
    x: widthUp.bounds.x + widthUp.bounds.w / 2,
    y: widthUp.bounds.y + widthUp.bounds.h / 2
  });
  assert.equal(editor.doodad.widthM, previousWidth + 0.5);
  assert.equal(editor.desktopDropdown, null);
  assert.equal(editor.closedDesktopDropdownRootId, 'size');
});

test('Doodad Editor gamepad slide-out rows expose shared focused state', () => {
  const editor = new DoodadEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => true }
  });

  editor.landscapeRootDrawerOpen = true;
  editor.gamepadFocusedItemId = 'size';
  editor.draw(createMockContext(), 844, 390);

  assert.equal(editor.activeViewportMode, 'gamepad');
  assert.equal(editor.panJoystick.radius, 0);
  const focusedRoot = editor.buttons.find((button) => button.id === 'size');
  assert.ok(focusedRoot);
  assert.equal(focusedRoot.focused, true);

  editor.landscapeRootDrawerOpen = false;
  editor.gamepadSubmenuOpen = true;
  editor.landscapeRootId = 'size';
  editor.gamepadFocusedItemId = 'width-up';
  editor.draw(createMockContext(), 844, 390);

  const focusedAction = [...editor.buttons].reverse().find((button) => button.id === 'width-up');
  assert.ok(focusedAction);
  assert.equal(focusedAction.focused, true);
  assert.equal(focusedAction.active, true);
});

test('Doodad Editor Studio Sprint preview uses embedded playtest render and restores race state', () => {
  const previewRace = {
    scenery: [{ id: 'existing-scenery', artRef: 'Existing' }]
  };
  let bindCalled = false;
  let playtestDrawn = false;
  const previewSource = {
    selectedRace: previewRace,
    buttons: [{ id: 'existing-button' }],
    playtestSession: { routeLength: 320, distance: 12 },
    bindCarEditorPreviewPlaytest(callback) {
      bindCalled = true;
      return callback();
    },
    drawRacePlaytestScreen() {
      playtestDrawn = true;
      assert.equal(previewRace.scenery.length, 5);
      const previewDoodad = previewRace.scenery.find((entry) => entry.id === 'doodad-preview-0');
      assert.ok(previewDoodad);
      assert.equal(previewDoodad.doodadRef, undefined);
      assert.equal(previewDoodad.widthM, 6.4);
      assert.equal(previewDoodad.heightM, 9.2);
      assert.equal(previewDoodad.groundOffsetM, 1.4);
      assert.equal(previewDoodad.hitboxWidthM, 2.2);
      assert.equal(previewDoodad.hitboxHeightM, 3.3);
      assert.equal(previewDoodad.previewHitbox, true);
      assert.equal(previewDoodad.previewDoodad.widthM, 6.4);
      assert.equal(previewDoodad.previewDoodad.heightM, 9.2);
      assert.equal(previewDoodad.previewDoodad.groundOffsetM, 1.4);
      assert.equal(previewDoodad.previewDoodad.hitboxWidthM, 2.2);
      assert.equal(previewDoodad.previewDoodad.hitboxHeightM, 3.3);
      assert.equal(previewDoodad.yaw, 0);
      assert.equal(typeof previewDoodad.trackDistance, 'number');
      assert.equal(typeof previewDoodad.trackLateral, 'number');
      this.buttons.push({ id: 'temporary-playtest-button' });
    },
    getRaceRouteLength: () => 320,
    getRaceWorldPoseAtDistance: (distance) => ({ x: 4, z: distance, yaw: 0 }),
    getRaceRightVector: () => ({ x: 1, z: 0 })
  };
  const editor = new DoodadEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    carEditor: previewSource
  });
  editor.doodad.artRef = 'Tree';
  editor.doodad.widthM = 6.4;
  editor.doodad.heightM = 9.2;
  editor.doodad.groundOffsetM = 1.4;
  editor.doodad.hitboxWidthM = 2.2;
  editor.doodad.hitboxHeightM = 3.3;
  editor.currentDocumentName = 'preview-tree';

  editor.drawStudioSprintPreview(createMockContext(), { x: 0, y: 0, w: 260, h: 180 });

  assert.equal(bindCalled, true);
  assert.equal(playtestDrawn, true);
  assert.deepEqual(previewRace.scenery, [{ id: 'existing-scenery', artRef: 'Existing' }]);
  assert.deepEqual(previewSource.buttons, [{ id: 'existing-button' }]);
});

test('Doodad Editor portrait hot menu switches size and collision panels', () => {
  const editor = new DoodadEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false }
  });

  editor.draw(createMockContext(), 390, 844);
  editor.handlePointerDown({
    x: editor.buttons.find((button) => button.id === 'hot-size').bounds.x + 4,
    y: editor.buttons.find((button) => button.id === 'hot-size').bounds.y + 4,
    touchCount: 1
  });
  assert.equal(editor.portraitHotMenu, 'size');

  editor.draw(createMockContext(), 390, 844);
  let ids = editor.buttons.map((button) => button.id);
  assert.equal(ids.includes('width-down'), false);
  assert.equal(editor.sliderRegions.some((region) => region.id === 'doodad-width-slider'), true);
  assert.equal(editor.sliderRegions.some((region) => region.id === 'doodad-ground-offset-slider'), true);
  const widthSlider = editor.sliderRegions.find((region) => region.id === 'doodad-width-slider');
  editor.handlePointerDown({
    x: widthSlider.track.x + widthSlider.track.w,
    y: widthSlider.bounds.y + widthSlider.bounds.h / 2,
    touchCount: 1,
    id: 'width'
  });
  assert.equal(editor.doodad.widthM, 80);
  editor.handlePointerUp({ id: 'width' });
  const plantSlider = editor.sliderRegions.find((region) => region.id === 'doodad-ground-offset-slider');
  editor.handlePointerDown({
    x: plantSlider.track.x + plantSlider.track.w,
    y: plantSlider.bounds.y + plantSlider.bounds.h / 2,
    touchCount: 1,
    id: 'plant'
  });
  assert.equal(editor.doodad.groundOffsetM, 20);
  editor.handlePointerUp({ id: 'plant' });

  editor.handlePointerDown({
    x: editor.buttons.find((button) => button.id === 'hot-hitbox').bounds.x + 4,
    y: editor.buttons.find((button) => button.id === 'hot-hitbox').bounds.y + 4,
    touchCount: 1
  });
  assert.equal(editor.portraitHotMenu, 'hitbox');

  editor.draw(createMockContext(), 390, 844);
  ids = editor.buttons.map((button) => button.id);
  assert.equal(editor.sliderRegions.some((region) => region.id === 'doodad-hitbox-width-slider'), true);
  assert.equal(editor.sliderRegions.some((region) => region.id === 'doodad-hitbox-height-slider'), true);

  const hitboxWidth = editor.sliderRegions.find((region) => region.id === 'doodad-hitbox-width-slider');
  editor.handlePointerDown({
    x: hitboxWidth.track.x,
    y: hitboxWidth.bounds.y + hitboxWidth.bounds.h / 2,
    touchCount: 1,
    id: 'hitbox-width'
  });
  assert.equal(editor.doodad.hitboxWidthM, 0.1);
  editor.handlePointerUp({ id: 'hitbox-width' });

  editor.handlePointerDown({
    x: editor.buttons.find((button) => button.id === 'hot-collision').bounds.x + 4,
    y: editor.buttons.find((button) => button.id === 'hot-collision').bounds.y + 4,
    touchCount: 1
  });
  assert.equal(editor.portraitHotMenu, 'collision');

  editor.draw(createMockContext(), 390, 844);
  ids = editor.buttons.map((button) => button.id);
  assert.equal(ids.includes('collision-default-flatten'), true);
  assert.equal(ids.includes('collision-threshold-1-fly-off'), true);
  assert.equal(editor.sliderRegions.some((region) => region.id === 'doodad-hitbox-width-slider'), false);
  assert.equal(editor.sliderRegions.some((region) => region.id === 'doodad-hitbox-height-slider'), false);
  assert.equal(editor.sliderRegions.some((region) => region.id === 'doodad-threshold-1-slider'), true);

  const flatten = editor.buttons.find((button) => button.id === 'collision-default-flatten');
  editor.handlePointerDown({
    x: flatten.bounds.x + 4,
    y: flatten.bounds.y + 4,
    touchCount: 1
  });
  assert.equal(editor.doodad.defaultRule.behavior, 'flatten');

  editor.draw(createMockContext(), 390, 844);
  const threshold = editor.sliderRegions.find((region) => region.id === 'doodad-threshold-1-slider');
  editor.handlePointerDown({
    x: threshold.track.x + threshold.track.w,
    y: threshold.bounds.y + threshold.bounds.h / 2,
    touchCount: 1,
    id: 'threshold'
  });
  assert.equal(editor.doodad.rules[0].minSpeedMph, editor.doodad.rules[1].minSpeedMph - 1);
  editor.handlePointerUp({ id: 'threshold' });
});
