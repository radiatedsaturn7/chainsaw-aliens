import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import RaceEditor from '../../src/ui/RaceEditor.js';

const raceEditorSource = readFileSync(new URL('../../src/ui/RaceEditor.js', import.meta.url), 'utf8');

function createMockContext() {
  const calls = [];
  const noop = () => {};
  return {
    calls,
    save: noop,
    restore: noop,
    fillRect: (x, y, w, h) => calls.push({ type: 'fillRect', x, y, w, h }),
    strokeRect: noop,
    beginPath: () => calls.push({ type: 'beginPath' }),
    closePath: noop,
    moveTo: (x, y) => calls.push({ type: 'moveTo', x, y }),
    lineTo: (x, y) => calls.push({ type: 'lineTo', x, y }),
    translate: noop,
    rotate: noop,
    arc: (x, y, r, start, end) => calls.push({ type: 'arc', x, y, r, start, end }),
    fill: () => calls.push({ type: 'fill' }),
    stroke: noop,
    fillText: (value, x, y) => calls.push({ type: 'text', value, x, y }),
    measureText: (value) => ({ width: String(value || '').length * 7 }),
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
    set textAlign(value) { this._textAlign = value; },
    get textAlign() { return this._textAlign; },
    set textBaseline(value) { this._textBaseline = value; },
    get textBaseline() { return this._textBaseline; },
    set globalAlpha(value) { this._globalAlpha = value; },
    get globalAlpha() { return this._globalAlpha; },
    set shadowColor(value) { this._shadowColor = value; },
    get shadowColor() { return this._shadowColor; },
    set shadowBlur(value) { this._shadowBlur = value; },
    get shadowBlur() { return this._shadowBlur; },
    set shadowOffsetY(value) { this._shadowOffsetY = value; },
    get shadowOffsetY() { return this._shadowOffsetY; }
  };
}

function openLandscapeRoot(editor, rootId, width = 844, height = 390) {
  const ctx = createMockContext();
  editor.draw(ctx, width, height);
  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  assert.ok(menuButton);
  editor.handlePointerDown({
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2
  });

  editor.draw(ctx, width, height);
  const rootButton = editor.buttons.find((button) => button.id === rootId);
  assert.ok(rootButton);
  editor.handlePointerDown({
    x: rootButton.bounds.x + rootButton.bounds.w / 2,
    y: rootButton.bounds.y + rootButton.bounds.h / 2
  });

  editor.draw(ctx, width, height);
  return ctx;
}

function simulateRaceAcceleration(editor, { seconds = 90, manual = false } = {}) {
  let zeroToSixty = null;
  let maxMph = 0;
  editor.raceInput.throttle = true;
  editor.raceInput.activeThrottlePointerId = 'sim';
  for (let frame = 0; frame < seconds * 30; frame += 1) {
    if (manual) {
      const tuning = editor.getRaceCarTuning(editor.selectedCar);
      if (editor.raceInput.gear === 0 && editor.playtestSession.shiftCooldownMs <= 0) {
        editor.shiftRaceGear(1);
      }
      if (editor.playtestSession.engineRpm > tuning.redlineRpm * 0.94 && editor.playtestSession.shiftCooldownMs <= 0) {
        editor.shiftRaceGear(1);
      }
    }
    editor.update(null, 1 / 30);
    const mph = editor.playtestSession.speedMps * 2.23694;
    maxMph = Math.max(maxMph, mph);
    if (zeroToSixty === null && mph >= 60) zeroToSixty = frame / 30;
  }
  return { zeroToSixty, maxMph };
}

test('Race Editor portrait uses shared bottom menu actions', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.draw(createMockContext(), 390, 844);

  const ids = editor.buttons.map((button) => button.id);
  assert.deepEqual(ids.slice(0, 4), ['menu', 'undo', 'redo', 'test-drive']);
  assert.ok(editor.buttons.some((button) => button.bounds.y > 730 && button.onClick));
  assert.equal(raceEditorSource.includes('drawSharedPortraitActionRail(ctx, layout.actionRail, null, actions, {'), true);
  assert.equal(raceEditorSource.includes('reserveThumbstick: false'), true);
});

test('Race Editor starts on race-building controls and exposes Generate in portrait', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 390, 844);

  assert.equal(editor.activeRootId, 'race');
  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  assert.ok(menuButton);
  editor.handlePointerDown({
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2
  });
  editor.draw(ctx, 390, 844);

  assert.ok(editor.buttons.some((button) => button.id === 'generate-random-race'));
});

test('Race Editor touch work surface exposes direct route creation and edit controls', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();
  editor.draw(ctx, 844, 390);

  const expectedControls = [
    'generate-random-race',
    'draw-road',
    'segment-prev',
    'segment-next',
    'curve',
    'elevation',
    'cycle-surface',
    'test-drive'
  ];
  expectedControls.forEach((id) => {
    assert.ok(editor.buttons.some((button) => button.id === id), id);
  });

  const startingSurface = editor.selectedSegment.surface;
  editor.buttons.find((button) => button.id === 'cycle-surface').onClick();
  assert.notEqual(editor.selectedSegment.surface, startingSurface);
});

test('Race Editor authoring surface uses a top-down height-map track editor', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();

  editor.draw(ctx, 1280, 800);

  assert.ok(editor.raceMapBounds);
  assert.equal(raceEditorSource.includes('drawRaceTopDownEditor(ctx, previewBounds)'), true);
  assert.equal(raceEditorSource.includes('getRaceMapPoints(bounds)'), true);
  assert.equal(raceEditorSource.includes('top-down track editor'), true);
  assert.equal(raceEditorSource.includes('this.drawRacePlaytestScreen(ctx, previewBounds);'), true);

  const before = editor.selectedSegmentIndex;
  const bounds = editor.raceMapBounds;
  const points = editor.getRaceMapPoints(bounds);
  const target = points[2] || points[1];
  editor.handlePointerDown({ x: target.screenX, y: target.screenY, button: 0 });

  assert.notEqual(editor.selectedSegmentIndex, before);
  assert.equal(editor.status.includes('Selected track node'), true);
});

test('Race Editor track nodes drag into real segment shape data', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 1280, 800);

  const points = editor.getRaceMapPoints(editor.raceMapBounds);
  const target = points[2] || points[1];
  const before = { ...editor.selectedRace.road.segments[target.segmentIndex] };
  editor.handlePointerDown({ id: 'drag-node', x: target.screenX, y: target.screenY, button: 0 });
  editor.handlePointerMove({ id: 'drag-node', x: target.screenX + 150, y: target.screenY - 74, button: 0 });
  editor.handlePointerUp({ id: 'drag-node', x: target.screenX + 150, y: target.screenY - 74, button: 0 });

  const after = editor.selectedRace.road.segments[target.segmentIndex];
  assert.ok(Array.isArray(editor.selectedRace.road.nodes));
  assert.equal(editor.selectedRace.road.nodes.length, editor.selectedRace.road.segments.length + 1);
  assert.notEqual(editor.selectedRace.road.nodes[target.segmentIndex + 1].x, Math.round(target.x));
  assert.notEqual(after.length, before.length);
  assert.notEqual(after.curve, before.curve);
  assert.notEqual(after.elevation, before.elevation);
  assert.equal(editor.raceNodeDrag, null);
});

test('Race Editor paints tile-backed ground patches and segment edge tiles', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.draw(createMockContext(), 1280, 800);

  const snowTile = editor.buttons.find((button) => button.id === 'race-tile-snow');
  assert.ok(snowTile);
  editor.handlePointerDown({
    id: 'select-snow',
    x: snowTile.bounds.x + snowTile.bounds.w / 2,
    y: snowTile.bounds.y + snowTile.bounds.h / 2,
    button: 0
  });
  const selectedTile = editor.getSelectedGroundTileId();
  assert.equal(selectedTile, 'snow');
  editor.handleMenuAction('paint-ground');
  const point = {
    id: 'paint',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.35,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.55,
    button: 0
  };
  editor.handlePointerDown(point);
  editor.handlePointerMove({ ...point, x: point.x + 18 });
  editor.handlePointerUp({ ...point, x: point.x + 18 });

  const road = editor.selectedRace.road;
  assert.ok(road.groundTiles.length >= 1);
  assert.equal(road.groundTiles.at(-1).tileId, selectedTile);
  assert.equal(road.groundTiles.at(-1).source, 'tile-editor');
  assert.equal(road.groundTiles.at(-1).tileLabel, 'Snow Block');
  assert.equal(typeof road.groundTiles.at(-1).elevation, 'number');

  editor.handleMenuAction('edge-tile');
  const points = editor.getRaceMapPoints(editor.raceMapBounds);
  const segmentPoint = {
    id: 'edge',
    x: (points[1].screenX + points[2].screenX) / 2,
    y: (points[1].screenY + points[2].screenY) / 2,
    button: 0
  };
  editor.handlePointerDown(segmentPoint);
  assert.equal(editor.selectedSegment.edgeTileId, selectedTile);
  assert.equal(raceEditorSource.includes('getRaceGroundTilePalette'), true);
  assert.equal(raceEditorSource.includes('paintRaceGroundAtPoint'), true);
  assert.equal(raceEditorSource.includes('getRaceTerrainSampleAtPoint'), true);
  assert.equal(raceEditorSource.includes('getRaceGroundElevationAtWorldPoint'), true);
  assert.equal(raceEditorSource.includes('registerRaceTileButton'), true);
});

test('Race Editor playtest sampling follows dragged nodes and painted terrain tiles', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.draw(createMockContext(), 1280, 800);

  const points = editor.getRaceMapPoints(editor.raceMapBounds);
  const target = points[2] || points[1];
  editor.handlePointerDown({ id: 'drag-node', x: target.screenX, y: target.screenY, button: 0 });
  editor.handlePointerMove({ id: 'drag-node', x: target.screenX + 180, y: target.screenY + 50, button: 0 });
  editor.handlePointerUp({ id: 'drag-node', x: target.screenX + 180, y: target.screenY + 50, button: 0 });

  const nodes = editor.selectedRace.road.nodes;
  const pose = editor.getRaceWorldPoseAtDistance(editor.getRaceRouteLength() * 0.32);
  assert.ok(nodes.length > 2);
  assert.ok(Number.isFinite(pose.x));
  assert.ok(Number.isFinite(pose.z));

  editor.setSelectedGroundTileId('snow');
  editor.handleMenuAction('paint-ground');
  const paintPoint = {
    id: 'paint',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.5,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.5,
    button: 0
  };
  editor.handlePointerDown(paintPoint);
  const patch = editor.selectedRace.road.groundTiles.at(-1);
  const rawPoints = editor.getRaceRawMapPoints();
  const minX = Math.min(...rawPoints.map((point) => point.x));
  const maxX = Math.max(...rawPoints.map((point) => point.x));
  const minY = Math.min(...rawPoints.map((point) => point.y));
  const maxY = Math.max(...rawPoints.map((point) => point.y));
  const palette = editor.getRaceGroundPaletteForSegment(editor.selectedSegment, {
    x: minX + (maxX - minX) * patch.x,
    z: minY + (maxY - minY) * patch.y
  });

  assert.equal(palette.label, 'Snow');
  assert.equal(raceEditorSource.includes('getRaceGroundPaintAtWorldPoint'), true);
});

test('Race Editor exposes Move/Paint/Edge authoring modes and runtime Tile Editor choices', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    world: {
      tileDefinitions: {
        all: [
          { id: 'custom-mud', label: 'Custom Mud' }
        ]
      }
    },
    exitRaceEditor() {}
  });
  editor.draw(createMockContext(), 1280, 800);

  assert.ok(editor.buttons.some((button) => button.id === 'race-move-mode'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-paint-mode'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-edge-mode'));
  assert.ok(editor.getRaceGroundTileChoices().some((choice) => choice.id === 'custom-mud'));
  assert.equal(editor.getRaceGroundTilePalette('asphalt').groundA, '#23282b');

  editor.handleMenuAction('paint-ground');
  const moveButton = editor.buttons.find((button) => button.id === 'race-move-mode');
  moveButton.onClick();
  assert.equal(editor.activeAction, 'move-node');

  const points = editor.getRaceMapPoints(editor.raceMapBounds);
  const target = points[1];
  const before = { ...editor.selectedRace.road.segments[target.segmentIndex] };
  editor.handlePointerDown({ id: 'move-mode-drag', x: target.screenX, y: target.screenY, button: 0 });
  editor.handlePointerMove({ id: 'move-mode-drag', x: target.screenX + 90, y: target.screenY - 45, button: 0 });
  editor.handlePointerUp({ id: 'move-mode-drag', x: target.screenX + 90, y: target.screenY - 45, button: 0 });
  const after = editor.selectedRace.road.segments[target.segmentIndex];
  assert.notEqual(after.length, before.length);
  assert.equal(raceEditorSource.includes('getRaceGroundPaletteForSegment'), true);
  assert.equal(raceEditorSource.includes("action === 'move-node'"), true);
});

test('Race Editor Draw Road mode appends draggable map nodes', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.draw(createMockContext(), 1280, 800);

  const startingSegments = editor.selectedRace.road.segments.length;
  editor.handleMenuAction('draw-road');
  const afterMenuSegments = editor.selectedRace.road.segments.length;
  assert.equal(afterMenuSegments, startingSegments + 1);

  const point = {
    id: 'draw-node',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.78,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.28,
    button: 0
  };
  editor.handlePointerDown(point);
  assert.equal(editor.selectedRace.road.segments.length, afterMenuSegments + 1);
  assert.ok(editor.raceNodeDrag);
  editor.handlePointerMove({ ...point, x: point.x + 44, y: point.y + 36 });
  editor.handlePointerUp({ ...point, x: point.x + 44, y: point.y + 36 });

  const nodes = editor.selectedRace.road.nodes;
  const selected = editor.selectedRace.road.segments.at(-1);
  assert.equal(nodes.length, editor.selectedRace.road.segments.length + 1);
  assert.equal(editor.raceNodeDrag, null);
  assert.ok(selected.length >= 35);
  assert.equal(Number.isFinite(selected.curve), true);
  assert.equal(raceEditorSource.includes('appendRaceNodeAtPoint'), true);
  assert.equal(raceEditorSource.includes('syncRaceSegmentFromNodePair'), true);
});

test('Race and Car desktop work surfaces do not duplicate top drawer commands', () => {
  const race = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const car = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });

  race.draw(createMockContext(), 1280, 800);
  car.draw(createMockContext(), 1280, 800);

  ['generate-random-race', 'draw-road', 'segment-prev', 'segment-next', 'curve', 'elevation', 'cycle-surface', 'test-drive'].forEach((id) => {
    assert.equal(race.buttons.some((button) => (
      button.id === id
      && !button.contextPanelCommand
      && !button.desktopRootId
      && !button.desktopDropdownItem
    )), false, id);
  });
  assert.equal(car.buttons.some((button) => button.id === 'test-drive' && !button.desktopRootId && !button.desktopDropdownItem), false);
  assert.equal(raceEditorSource.includes('this.drawRaceBuilderOverlay(ctx, {\n      x: shell.workSurface.x + 18'), false);
});

test('Car Editor portrait uses the same shared bottom action rail as Race', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }, { mode: 'car' });
  editor.draw(createMockContext(), 390, 844);

  const ids = editor.buttons.map((button) => button.id);
  assert.deepEqual(ids.slice(0, 4), ['menu', 'undo', 'redo', 'test-drive']);
  assert.ok(editor.buttons.every((button, index) => index >= 4 || button.bounds.y > 730));
  ['undo', 'redo'].forEach((id) => {
    const button = editor.buttons.find((candidate) => candidate.id === id);
    assert.equal(button.disabled, true, id);
    assert.equal(button.onClick, null, id);
  });
  assert.equal(raceEditorSource.includes("this.getRailAction('undo', 'Undo'"), true);
  assert.equal(raceEditorSource.includes("this.getRailAction('redo', 'Redo'"), true);
  ['generate-random-race', 'draw-road', 'curve', 'elevation', 'cycle-surface'].forEach((id) => {
    assert.equal(editor.buttons.some((button) => button.id === id), false, id);
  });
});

test('Car Editor landscape keeps Race builder controls out of the work surface', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    exitRaceEditor() {}
  }, { mode: 'car' });
  editor.draw(createMockContext(), 844, 390);

  assert.ok(editor.buttons.some((button) => button.id === 'test-drive'));
  ['generate-random-race', 'draw-road', 'curve', 'elevation', 'cycle-surface'].forEach((id) => {
    assert.equal(editor.buttons.some((button) => button.id === id && !button.desktopRootId && !button.desktopDropdownItem), false, id);
  });
  assert.equal(raceEditorSource.includes("if (this.mode === 'race') {\n      this.drawRaceBuilderOverlay(ctx, {"), true);
});

test('Race Editor landscape uses left rail and submenu actions', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    exitRaceEditor() {}
  });
  editor.draw(createMockContext(), 844, 390);

  assert.ok(editor.buttons.some((button) => button.bounds.x < 90));
  assert.ok(editor.buttons.some((button) => button.bounds.x > 600));
});

test('Race Editor landscape exposes race creation shortcuts before opening menus', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    exitRaceEditor() {}
  });
  editor.draw(createMockContext(), 844, 390);

  assert.ok(editor.buttons.some((button) => button.id === 'generate-random-race'));
  assert.ok(editor.buttons.some((button) => button.id === 'draw-road'));
});

test('Race and Car direct rails disable unavailable history commands', () => {
  const cases = [
    new RaceEditor({ deviceIsMobile: true, isMobile: true, input: { isGamepadConnected: () => false }, exitRaceEditor() {} }),
    new RaceEditor({ deviceIsMobile: true, isMobile: true, input: { isGamepadConnected: () => false }, exitRaceEditor() {} }, { mode: 'car' })
  ];

  cases.forEach((editor) => {
    editor.draw(createMockContext(), 844, 390);
    ['undo', 'redo'].forEach((id) => {
      const button = editor.buttons.find((candidate) => candidate.id === id);
      assert.ok(button, `${editor.mode}:${id}`);
      assert.equal(button.disabled, true, `${editor.mode}:${id}`);
      assert.equal(button.onClick, null, `${editor.mode}:${id}`);
    });
  });
});

test('Race and Car landscape root drawers use the shared all-visible grid', () => {
  const cases = [
    { mode: 'race', roots: ['file', 'edit', 'view', 'road', 'surfaces', 'scenery', 'weather', 'race', 'drive'] },
    { mode: 'car', roots: ['file', 'edit', 'view', 'art', 'drivetrain', 'tuning', 'aero', 'suspension', 'drive'] }
  ];
  cases.forEach(({ mode, roots }) => {
    const editor = new RaceEditor({
      deviceIsMobile: true,
      isMobile: true,
      input: { isGamepadConnected: () => false },
      exitRaceEditor() {}
    }, { mode });
    const ctx = createMockContext();

    editor.draw(ctx, 844, 390);
    const menuButton = editor.buttons.find((button) => button.id === 'menu');
    assert.ok(menuButton);
    editor.handlePointerDown({
      x: menuButton.bounds.x + menuButton.bounds.w / 2,
      y: menuButton.bounds.y + menuButton.bounds.h / 2
    });
    editor.draw(ctx, 844, 390);

    roots.forEach((id) => {
      assert.ok(editor.buttons.some((button) => button.id === id), `${mode}:${id}`);
    });
    assert.equal(editor.menuScrollRegions.some((region) => region.menuId === `${mode}:landscape-root`), false);
  });
  assert.equal(raceEditorSource.includes('buildLandscapeRootDrawerGridLayout({'), true);
  assert.equal(raceEditorSource.includes('buildScrolledLandscapeRootDrawerItems(grid'), true);
});

test('Race Editor touch landscape keeps root drawer on the left while submenu updates on the right', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    exitRaceEditor() {}
  });
  openLandscapeRoot(editor, 'road');

  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.gamepadSubmenuOpen, false);
  assert.equal(editor.activeRootId, 'road');
  assert.ok(editor.buttons.some((button) => button.id === 'road' && button.bounds.x < 240));
  assert.ok(editor.buttons.some((button) => button.id === 'draw-road' && button.bounds.x > 600));
  assert.equal(editor.buttons.filter((button) => button.id === 'draw-road').length, 1);
  assert.ok(editor.buttons.some((button) => button.id === 'test-drive' && button.bounds.y > 300));
});

test('Car Editor touch landscape keeps root drawer, right submenu, and bottom Drive rail split', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    exitRaceEditor() {}
  }, { mode: 'car' });

  openLandscapeRoot(editor, 'art');

  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.gamepadSubmenuOpen, false);
  assert.equal(editor.activeRootId, 'art');
  assert.ok(editor.buttons.some((button) => button.id === 'art' && button.bounds.x < 240));
  assert.ok(editor.buttons.some((button) => button.id === 'edit-shell' && button.bounds.x > 600));
  assert.equal(editor.buttons.filter((button) => button.id === 'edit-shell').length, 1);
  assert.ok(editor.buttons.some((button) => button.id === 'test-drive' && button.bounds.y > 300));
});

test('Race and Car gamepad mode helpers match the shared desktop versus mobile contract', () => {
  const connectedInput = { isGamepadConnected: () => true };
  const desktopRace = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: connectedInput,
    exitRaceEditor() {}
  });
  const mobileCar = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: connectedInput,
    exitRaceEditor() {}
  }, { mode: 'car' });

  assert.equal(desktopRace.getGamepadMenuState(1280, 720).isLandscapeMenuMode, false);
  assert.equal(desktopRace.shouldDrawGamepadSubmenuOnLeft(1280, 720), false);
  assert.equal(desktopRace.shouldDrawControllerOverlay(1280, 720), false);

  mobileCar.mobileRootOpen = true;
  assert.equal(mobileCar.getGamepadMenuState(844, 390).isLandscapeMenuMode, true);
  assert.equal(mobileCar.shouldDrawGamepadSubmenuOnLeft(844, 390), false);
  assert.equal(mobileCar.shouldDrawControllerOverlay(844, 390), false);

  mobileCar.mobileRootOpen = false;
  mobileCar.gamepadSubmenuOpen = true;
  mobileCar.activeRootId = 'art';
  assert.equal(mobileCar.shouldDrawGamepadSubmenuOnLeft(844, 390), true);
  assert.equal(mobileCar.shouldDrawControllerOverlay(844, 390), false);
  assert.equal(raceEditorSource.includes('const gamepadMenuState = this.getGamepadMenuState(width, height);'), true);
  assert.equal(raceEditorSource.includes('const gamepad = gamepadMenuState.isLandscapeMenuMode;'), true);
  assert.equal(raceEditorSource.includes('reserveRightRail: !gamepadMenuState.isLandscapeMenuMode'), true);
  assert.equal(raceEditorSource.includes('if (gamepadMenuState.isLandscapeMenuMode) {'), true);
  assert.equal(raceEditorSource.includes('reserveRightRail: !gamepad,'), false);
  assert.equal(raceEditorSource.includes('drawSharedGamepadHintBar(ctx, bounds, contextLabel, SHARED_EDITOR_GAMEPAD_HINTS);'), true);
  assert.equal(raceEditorSource.includes("this.drawGamepadHintBar(ctx, {\n        x: shell.surfaces.workSurface.x + 12,"), true);
});

test('Race Editor gamepad landscape replaces left root rail with submenu after selecting a root', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => true },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.draw(ctx, 844, 390);
  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  assert.ok(menuButton);
  editor.handlePointerDown({
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2
  });

  editor.draw(ctx, 844, 390);
  const roadRoot = editor.buttons.find((button) => button.id === 'road');
  assert.ok(roadRoot);
  editor.handlePointerDown({
    x: roadRoot.bounds.x + roadRoot.bounds.w / 2,
    y: roadRoot.bounds.y + roadRoot.bounds.h / 2
  });

  editor.draw(ctx, 844, 390);
  assert.equal(editor.mobileRootOpen, false);
  assert.equal(editor.gamepadSubmenuOpen, true);
  assert.ok(editor.buttons.some((button) => button.id === 'draw-road' && button.bounds.x < 380));
  assert.equal(editor.buttons.some((button) => button.id === 'draw-road' && button.bounds.x > 600), false);
});

test('Car Editor gamepad landscape uses shared controller roots and left submenu replacement', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => true },
    exitRaceEditor() {}
  }, { mode: 'car' });
  const ctx = createMockContext();

  editor.draw(ctx, 844, 390);
  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  assert.ok(menuButton);
  editor.handlePointerDown({
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2
  });

  editor.draw(ctx, 844, 390);
  const drivetrainRoot = editor.buttons.find((button) => button.id === 'drivetrain');
  assert.ok(drivetrainRoot);
  editor.handlePointerDown({
    x: drivetrainRoot.bounds.x + drivetrainRoot.bounds.w / 2,
    y: drivetrainRoot.bounds.y + drivetrainRoot.bounds.h / 2
  });

  editor.draw(ctx, 844, 390);
  assert.equal(editor.mobileRootOpen, false);
  assert.equal(editor.gamepadSubmenuOpen, true);
  assert.ok(editor.buttons.some((button) => button.id === 'drivetrain-rwd' && button.bounds.x < 380));
  assert.equal(editor.buttons.some((button) => button.id === 'drivetrain-rwd' && button.bounds.x > 600), false);
});

test('Race and Car gamepad submenus render from the shared slide-out plan items', () => {
  const drawLandscapeIndex = raceEditorSource.indexOf('  drawLandscape(ctx, width, height)');
  const drawLandscapeBody = raceEditorSource.slice(
    drawLandscapeIndex,
    raceEditorSource.indexOf('  drawRaceHandheldShell(ctx, layout)', drawLandscapeIndex)
  );

  assert.ok(drawLandscapeIndex > 0);
  assert.equal(drawLandscapeBody.includes('const menuPlan = buildGamepadSlideOutMenuPlan(this.editorId,'), true);
  assert.equal(drawLandscapeBody.includes('headerHint: menuPlan.headerHint'), true);
  assert.equal(drawLandscapeBody.includes("title: menuPlan.submenu?.title || 'Menu'"), true);
  assert.equal(drawLandscapeBody.includes('items: menuPlan.submenu?.items'), true);
  assert.equal(drawLandscapeBody.includes('scrollKey: `${this.editorId}:gamepad-sub:${menuPlan.activeRootId || this.activeRootId}`'), true);
});

test('Race and Car gamepad root drawer uses the shared slide-out header chrome', () => {
  const rootDrawerIndex = raceEditorSource.indexOf('  drawLandscapeRootDrawer(ctx, bounds, { gamepad = false, rootEntries = null, headerHint = null } = {})');
  const rootDrawerBody = raceEditorSource.slice(
    rootDrawerIndex,
    raceEditorSource.indexOf('  drawLandscapeSubmenu(ctx, bounds', rootDrawerIndex)
  );

  assert.ok(rootDrawerIndex > 0);
  assert.equal(rootDrawerBody.includes("drawSharedGamepadSlideOutHeader(ctx, bounds, 'Menu', { hint: headerHint || undefined })"), true);
  assert.equal(rootDrawerBody.includes("const title = gamepad ? 'A Select  B Back' : 'Menu';"), false);
  assert.equal(rootDrawerBody.includes('headerHeight: gamepad ? 50 : 30'), true);
});

test('Race and Car gamepad submenu reserves the shared slide-out header before action rows', () => {
  const submenuIndex = raceEditorSource.indexOf("  drawLandscapeSubmenu(ctx, bounds, { items = null, scrollKey = null, gamepad = false, title = 'Menu', headerHint = null } = {})");
  const submenuBody = raceEditorSource.slice(
    submenuIndex,
    raceEditorSource.indexOf('  drawLandscapeToolOptions(ctx, bounds)', submenuIndex)
  );

  assert.ok(submenuIndex > 0);
  assert.equal(submenuBody.includes('const listBounds = gamepad'), true);
  assert.equal(submenuBody.includes('y: bounds.y + 50'), true);
  assert.equal(submenuBody.includes('drawSharedGamepadSlideOutHeader(ctx, bounds, title, { hint: headerHint || undefined })'), true);
  assert.equal(submenuBody.includes('this.drawActionRows(ctx, listBounds,'), true);
});

test('Race Editor gamepad cancel backs from submenu to root before exiting', () => {
  let exited = false;
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => true },
    exitRaceEditor() { exited = true; }
  });
  editor.gamepadSubmenuOpen = true;
  editor.mobileRootOpen = false;

  editor.update({ wasPressed: (id) => id === 'cancel' }, 0);
  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.gamepadSubmenuOpen, true);
  assert.equal(exited, false);

  editor.update({ wasPressed: (id) => id === 'cancel' }, 0);
  assert.equal(editor.mobileRootOpen, false);
  assert.equal(editor.gamepadSubmenuOpen, false);
  assert.equal(exited, false);
});

test('Race and Car collapse gamepad-only menus when the controller disconnects', () => {
  const cases = ['race', 'car'];
  cases.forEach((mode) => {
    let connected = true;
    const editor = new RaceEditor({
      deviceIsMobile: true,
      isMobile: true,
      input: { isGamepadConnected: () => connected },
      exitRaceEditor() {}
    }, { mode });

    editor.mobileRootOpen = false;
    editor.gamepadSubmenuOpen = true;
    editor.activeRootId = mode === 'race' ? 'road' : 'art';
    connected = false;
    editor.update({ wasPressed: () => false }, 0);
    editor.draw(createMockContext(), 844, 390);

    assert.equal(editor.mobileRootOpen, false, mode);
    assert.equal(editor.gamepadSubmenuOpen, false, mode);
    assert.equal(editor.shouldDrawGamepadSubmenuOnLeft(844, 390), false, mode);
  });
});

test('Car Editor desktop uses shared top menu buttons', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  editor.draw(createMockContext(), 1280, 800);

  const rootIds = editor.buttons.filter((button) => button.desktopRootId).map((button) => button.desktopRootId);
  assert.deepEqual(rootIds.slice(0, 3), ['file', 'edit', 'view']);
  assert.equal(rootIds.includes('drivetrain'), true);
  assert.equal(editor.desktopDropdown, null);
});

test('Race Editor desktop dropdown opens from top menu and closes on click-away', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 1280, 800);

  const fileButton = editor.buttons.find((button) => button.desktopRootId === 'file');
  assert.ok(fileButton);
  editor.handlePointerDown({
    x: fileButton.bounds.x + fileButton.bounds.w / 2,
    y: fileButton.bounds.y + fileButton.bounds.h / 2
  });

  editor.draw(ctx, 1280, 800);
  assert.equal(editor.desktopDropdown?.rootId, 'file');
  assert.equal(editor.openDesktopDropdownRootId, 'file');

  editor.handlePointerDown({ x: 1270, y: 790 });
  editor.draw(ctx, 1280, 800);

  assert.equal(editor.desktopDropdown, null);
  assert.equal(editor.openDesktopDropdownRootId, null);
  assert.equal(editor.closedDesktopDropdownRootId, 'file');
});

test('Race and Car desktop dropdowns switch roots on hover after opening a drawer', () => {
  const cases = [
    { mode: 'race', from: 'file', to: 'road', expectedAction: 'draw-road' },
    { mode: 'car', from: 'file', to: 'drivetrain', expectedAction: 'drivetrain-rwd' }
  ];

  cases.forEach(({ mode, from, to, expectedAction }) => {
    const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode });
    const ctx = createMockContext();
    editor.draw(ctx, 1280, 800);

    const fromButton = editor.buttons.find((button) => button.desktopRootId === from);
    assert.ok(fromButton, `${mode}:${from}`);
    editor.handlePointerDown({
      x: fromButton.bounds.x + fromButton.bounds.w / 2,
      y: fromButton.bounds.y + fromButton.bounds.h / 2
    });
    editor.draw(ctx, 1280, 800);
    assert.equal(editor.desktopDropdown?.rootId, from);

    const toButton = editor.buttons.find((button) => button.desktopRootId === to);
    assert.ok(toButton, `${mode}:${to}`);
    editor.handlePointerMove({
      x: toButton.bounds.x + toButton.bounds.w / 2,
      y: toButton.bounds.y + toButton.bounds.h / 2
    });
    editor.draw(ctx, 1280, 800);

    assert.equal(editor.desktopDropdown?.rootId, to);
    assert.equal(editor.openDesktopDropdownRootId, to);
    assert.ok(editor.buttons.some((button) => button.desktopDropdownItem && button.id === expectedAction), `${mode}:${expectedAction}`);
  });
});

test('Race and Car desktop draw resolves dropdown state through the shared helper', () => {
  const drawDesktopIndex = raceEditorSource.indexOf('  drawDesktop(ctx, width, height)');
  const drawDesktopBody = raceEditorSource.slice(
    drawDesktopIndex,
    raceEditorSource.indexOf('  drawDesktopContext(ctx, bounds)', drawDesktopIndex)
  );

  assert.ok(drawDesktopIndex > 0);
  assert.equal(drawDesktopBody.includes('this.desktopDropdown = resolveDesktopDropdownState({'), true);
  assert.equal(drawDesktopBody.includes('isDesktop: true'), true);
  assert.equal(drawDesktopBody.includes('this.desktopDropdown = shell.dropdown\n      ?'), false);
});

test('Race Editor desktop dropdown commands only fire on release', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 1280, 800);

  const fileButton = editor.buttons.find((button) => button.desktopRootId === 'file');
  assert.ok(fileButton);
  editor.handlePointerDown({
    x: fileButton.bounds.x + fileButton.bounds.w / 2,
    y: fileButton.bounds.y + fileButton.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);

  const newRow = editor.buttons.find((button) => button.desktopDropdownItem && button.id === 'new');
  assert.ok(newRow);
  editor.status = 'Ready';
  editor.handlePointerDown({
    x: newRow.bounds.x + newRow.bounds.w / 2,
    y: newRow.bounds.y + newRow.bounds.h / 2
  });
  assert.equal(editor.status, 'Ready');
  assert.ok(editor.pendingDesktopDropdownHit);

  editor.handlePointerUp({
    x: newRow.bounds.x + newRow.bounds.w / 2,
    y: newRow.bounds.y + newRow.bounds.h / 2
  });
  assert.equal(editor.status, 'New Race Editor project');
  assert.equal(editor.desktopDropdown, null);
  assert.equal(editor.openDesktopDropdownRootId, null);

  editor.draw(ctx, 1280, 800);
  const reopenedFile = editor.buttons.find((button) => button.desktopRootId === 'file');
  editor.handlePointerDown({
    x: reopenedFile.bounds.x + reopenedFile.bounds.w / 2,
    y: reopenedFile.bounds.y + reopenedFile.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);
  const movedNewRow = editor.buttons.find((button) => button.desktopDropdownItem && button.id === 'new');
  editor.status = 'Ready';
  editor.handlePointerDown({
    x: movedNewRow.bounds.x + movedNewRow.bounds.w / 2,
    y: movedNewRow.bounds.y + movedNewRow.bounds.h / 2
  });
  editor.handlePointerMove({
    x: movedNewRow.bounds.x + movedNewRow.bounds.w + 40,
    y: movedNewRow.bounds.y + movedNewRow.bounds.h + 40
  });
  editor.handlePointerUp({
    x: movedNewRow.bounds.x + movedNewRow.bounds.w + 40,
    y: movedNewRow.bounds.y + movedNewRow.bounds.h + 40
  });
  assert.equal(editor.status, 'Ready');
});

test('Race desktop playtest keeps dropdown commands on release activation', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 1280, 800);

  const fileButton = editor.buttons.find((button) => button.desktopRootId === 'file');
  assert.ok(fileButton);
  editor.handlePointerDown({
    x: fileButton.bounds.x + fileButton.bounds.w / 2,
    y: fileButton.bounds.y + fileButton.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);

  const newRow = editor.buttons.find((button) => button.desktopDropdownItem && button.id === 'new');
  assert.ok(newRow);
  assert.ok(editor.playtestSession);
  editor.status = 'Driving';
  editor.handlePointerDown({
    x: newRow.bounds.x + newRow.bounds.w / 2,
    y: newRow.bounds.y + newRow.bounds.h / 2
  });

  assert.equal(editor.status, 'Driving');
  assert.ok(editor.pendingDesktopDropdownHit);
  assert.ok(editor.playtestSession);

  editor.handlePointerUp({
    x: newRow.bounds.x + newRow.bounds.w / 2,
    y: newRow.bounds.y + newRow.bounds.h / 2
  });

  assert.equal(editor.status, 'New Race Editor project');
  assert.equal(editor.playtestSession, null);
  assert.equal(editor.desktopDropdown, null);
});

test('Race and Car desktop left context panels keep commands out of the work surface', () => {
  const contextIndex = raceEditorSource.indexOf('  drawDesktopContext(ctx, bounds)');
  const contextBody = raceEditorSource.slice(contextIndex, raceEditorSource.indexOf('  drawPortrait(ctx, width, height)', contextIndex));

  assert.ok(contextIndex > 0);
  assert.equal(contextBody.includes('drawSharedDesktopContextPanel(ctx, bounds,'), true);
  assert.equal(contextBody.includes('this.drawActionRows('), false);
  assert.equal(contextBody.includes('getRaceQuickActions()'), false);
  assert.equal(contextBody.includes('race:desktop-quick'), false);
  assert.equal(contextBody.includes("id: 'end-playtest'"), false);
  assert.equal(contextBody.includes('drawDesktopRaceBuilderPanel'), false);
  assert.equal(contextBody.includes('contextPanelCommand'), false);
  assert.equal(contextBody.includes('Surface: ${getSurfaceById(this.selectedSegment?.surface).label}'), true);
  assert.equal(contextBody.includes('Final drive: ${car.tuning.gearFinalDrive}'), true);
  assert.equal(raceEditorSource.includes('drawCompact(ctx, width, height)'), false);
  assert.equal(raceEditorSource.includes("this.drawButton(ctx, back, 'Back');"), false);
});

test('Race desktop keeps builder commands in top drawers instead of the left context panel', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 1280, 800);

  const generate = editor.buttons.find((button) => button.id === 'generate-random-race' && button.contextPanelCommand);
  assert.equal(generate, undefined);
  assert.equal(editor.buttons.some((button) => button.contextPanelCommand), false);

  const raceRoot = editor.buttons.find((button) => button.desktopRootId === 'race');
  assert.ok(raceRoot);
  editor.handlePointerDown({
    x: raceRoot.bounds.x + raceRoot.bounds.w / 2,
    y: raceRoot.bounds.y + raceRoot.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);

  const drawerGenerate = editor.buttons.find((button) => button.id === 'generate-random-race' && button.desktopDropdownItem);
  assert.ok(drawerGenerate);
  assert.ok(drawerGenerate.bounds.y < editor.editorBounds.y);
  assert.equal(editor.buttons.some((button) => (
    button.id === 'generate-random-race'
    && !button.contextPanelCommand
    && !button.desktopRootId
    && !button.desktopDropdownItem
  )), false);
});

test('Race desktop playtest keeps End Drive in the Drive drawer instead of the left context panel', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 1280, 800);

  assert.equal(editor.buttons.some((button) => button.id === 'end-playtest'), false);
  const driveRoot = editor.buttons.find((button) => button.desktopRootId === 'drive');
  assert.ok(driveRoot);
  editor.handlePointerDown({
    x: driveRoot.bounds.x + driveRoot.bounds.w / 2,
    y: driveRoot.bounds.y + driveRoot.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);

  const endButton = editor.buttons.find((button) => button.id === 'end-playtest' && button.desktopDropdownItem);
  assert.ok(endButton);
  assert.ok(endButton.bounds.y < editor.editorBounds.y);
  assert.equal(editor.getMenuItems('drive')[0].id, 'end-playtest');
  assert.equal(raceEditorSource.includes('x: previewBounds.x + previewBounds.w - 106'), false);
});

test('Race desktop drawer End Drive activates on release only', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 1280, 800);
  const driveRoot = editor.buttons.find((button) => button.desktopRootId === 'drive');
  assert.ok(driveRoot);
  editor.handlePointerDown({
    x: driveRoot.bounds.x + driveRoot.bounds.w / 2,
    y: driveRoot.bounds.y + driveRoot.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);
  const endButton = editor.buttons.find((button) => button.id === 'end-playtest' && button.desktopDropdownItem);
  assert.ok(endButton);

  editor.handlePointerDown({
    x: endButton.bounds.x + endButton.bounds.w / 2,
    y: endButton.bounds.y + endButton.bounds.h / 2
  });
  assert.ok(editor.playtestSession);
  assert.ok(editor.pendingDesktopDropdownHit);

  editor.handlePointerUp({
    x: endButton.bounds.x + endButton.bounds.w / 2,
    y: endButton.bounds.y + endButton.bounds.h / 2
  });
  assert.equal(editor.playtestSession, null);

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 1280, 800);
  const secondDriveRoot = editor.buttons.find((button) => button.desktopRootId === 'drive');
  assert.ok(secondDriveRoot);
  editor.handlePointerDown({
    x: secondDriveRoot.bounds.x + secondDriveRoot.bounds.w / 2,
    y: secondDriveRoot.bounds.y + secondDriveRoot.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);
  const secondEndButton = editor.buttons.find((button) => button.id === 'end-playtest' && button.desktopDropdownItem);
  assert.ok(secondEndButton);
  editor.handlePointerDown({
    x: secondEndButton.bounds.x + secondEndButton.bounds.w / 2,
    y: secondEndButton.bounds.y + secondEndButton.bounds.h / 2
  });
  editor.handlePointerMove({
    x: secondEndButton.bounds.x + secondEndButton.bounds.w + 30,
    y: secondEndButton.bounds.y + secondEndButton.bounds.h + 30
  });
  editor.handlePointerUp({
    x: secondEndButton.bounds.x + secondEndButton.bounds.w + 30,
    y: secondEndButton.bounds.y + secondEndButton.bounds.h + 30
  });
  assert.ok(editor.playtestSession);
});

test('Race and Car desktop preview drag uses shared pointer policy', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 1280, 720);

  const before = editor.previewOffset;
  const point = {
    x: editor.editorBounds.x + editor.editorBounds.w / 2,
    y: editor.editorBounds.y + editor.editorBounds.h / 2,
    button: 2,
    id: 'mouse'
  };
  editor.handlePointerDown(point);
  assert.ok(editor.desktopPreviewDrag);
  editor.handlePointerMove({ ...point, y: point.y + 40 });
  assert.notEqual(editor.previewOffset, before);
  editor.handlePointerUp({ ...point, y: point.y + 40 });
  assert.equal(editor.desktopPreviewDrag, null);
  assert.equal(raceEditorSource.includes('getEditorPointerInteractionPolicy(this.editorId'), true);
  assert.equal(raceEditorSource.includes('pointerPolicy.workSurfaceGestures.rightDragPan'), true);
});

test('Race Editor file menu keeps unavailable scaffold rows disabled', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const fileItems = editor.getMenuItems('file');

  assert.equal(fileItems.find((item) => item.id === 'new')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'export')?.disabled, true);
  assert.equal(fileItems.find((item) => item.id === 'import')?.disabled, true);
  assert.equal(fileItems.find((item) => item.id === 'save')?.disabled, true);
});

test('Race Editor disabled touch menu rows draw but do not fire actions', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { isGamepadConnected: () => false },
    exitRaceEditor() {}
  });
  editor.activeRootId = 'file';
  editor.mobileRootOpen = false;
  editor.draw(createMockContext(), 844, 390);

  const saveButton = editor.buttons.find((button) => button.id === 'save');
  assert.ok(saveButton);
  assert.equal(saveButton.disabled, true);
  assert.equal(saveButton.onClick, null);
});

test('Race Editor action rows expose wheel-scrollable overflow regions', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  const actions = Array.from({ length: 6 }, (_, index) => ({
    id: `action-${index}`,
    label: `Action ${index}`,
    onClick() {}
  }));

  editor.drawActionRows(ctx, { x: 0, y: 0, w: 160, h: 100 }, actions, 1, { scrollKey: 'test-scroll' });
  assert.ok(editor.menuScrollRegions.some((region) => region.menuId === 'test-scroll'));
  assert.deepEqual(editor.buttons.map((button) => button.id), ['action-0', 'action-1']);

  editor.handleWheel({ x: 20, y: 20, deltaY: 120 });
  assert.equal(editor.menuScrollState['test-scroll'], 1);

  editor.buttons = [];
  editor.menuScrollRegions = [];
  editor.drawActionRows(ctx, { x: 0, y: 0, w: 160, h: 100 }, actions, 1, { scrollKey: 'test-scroll' });
  assert.deepEqual(editor.buttons.map((button) => button.id), ['action-1', 'action-2']);
});

test('Race Editor scrollable action rows activate on tap-release but suppress drag activation', () => {
  let taps = 0;
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  const actions = Array.from({ length: 6 }, (_, index) => ({
    id: `row-${index}`,
    label: `Row ${index}`,
    onClick: () => { taps += 1; }
  }));

  editor.drawActionRows(ctx, { x: 0, y: 0, w: 160, h: 100 }, actions, 1, { scrollKey: 'drag-scroll' });
  editor.handlePointerDown({ x: 20, y: 20 });
  editor.handlePointerUp();
  assert.equal(taps, 1);

  editor.handlePointerDown({ x: 20, y: 66 });
  editor.handlePointerMove({ x: 20, y: 12 });
  editor.handlePointerUp();
  assert.equal(taps, 1);
  assert.equal(editor.menuScrollState['drag-scroll'] > 0, true);
});

test('Race Editor implemented scaffold commands mutate project state', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });

  editor.handleMenuAction('drivetrain-awd');
  assert.equal(editor.selectedCar.tuning.drivetrain, 'awd');

  editor.handleMenuAction('weather-rain');
  assert.equal(editor.selectedRace.weather, 'rain');

  editor.project.selectedRaceId = 'missing';
  editor.handleMenuAction('new');
  assert.equal(editor.project.selectedRaceId, 'test-loop');
  assert.equal(editor.status, 'New Car Editor project');
});

test('Race playtest starts in first gear and G launches without manual shifting', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');

  assert.equal(editor.raceInput.gear, 1);
  assert.equal(editor.formatRaceGear(), '1');
  assert.equal(editor.playtestSession.carYaw, editor.getRaceRoadYawAtDistance(0));
  assert.equal(editor.playtestSession.cameraYaw, editor.getRaceRoadYawAtDistance(0));

  editor.raceInput.activeThrottlePointerId = 0;
  editor.updatePlaytest(0.25);

  assert.equal(editor.raceInput.throttle, true);
  assert.equal(editor.raceInput.gear, 1);
  assert.ok(editor.playtestSession.rpm > 0.2);
  assert.ok(editor.playtestSession.speedMps > 0);
});

test('Race playtest keeps road and car scale in a believable range', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');

  assert.equal(editor.selectedRace.road.width, 9);
  assert.equal(editor.getRaceRoadHalfWidthWorld() <= 4.9, true);
  assert.equal(editor.getRaceRoadHalfWidthWorld() >= 4.4, true);
  assert.equal(editor.getRaceThirdPersonCarWidth({ w: 390, h: 240 }) >= 62, true);
  assert.equal(editor.getRaceThirdPersonCarWidth({ w: 390, h: 240 }) <= 92, true);
});

test('Race playtest projection keeps high-speed road scale ahead of the car', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 60;
  editor.playtestSession.elapsedMs = 2000;
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const travel = editor.playtestSession.distance;
  const camera = editor.getRaceWorldPoseAtDistance(travel);
  camera.horizonRatio = 0.25;
  camera.roadDepthRatio = 0.56;
  camera.focalScale = 1.08;
  camera.roadWidthScale = 1.8;
  const near = editor.getRaceRoadCrossSectionAtDistance(travel + 40);
  const projectedLeft = editor.projectRaceWorldPointToCamera(near.left, camera, editor.playtestSession.cameraYaw, bounds);
  const projectedRight = editor.projectRaceWorldPointToCamera(near.right, camera, editor.playtestSession.cameraYaw, bounds);
  const roadWidth = Math.abs(projectedRight.screenX - projectedLeft.screenX);
  const carWidth = editor.getRaceThirdPersonCarWidth(bounds);

  assert.equal(roadWidth < bounds.w * 0.34, true);
  assert.equal(carWidth / roadWidth > 0.52, true);
  assert.equal(carWidth / roadWidth < 0.82, true);
});

test('Race playtest launch holds road-aligned yaw before steering takes over', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.raceInput.binarySteer = 1;
  editor.raceInput.activeThrottlePointerId = 0;
  editor.updatePlaytest(0.12);

  assert.equal(editor.raceInput.gear, 1);
  assert.equal(Math.abs(editor.playtestSession.heading) < 0.001, true);
  assert.equal(editor.playtestSession.cameraYaw, editor.getRaceRoadYawAtDistance(editor.playtestSession.distance));
});

test('Race playtest renders a start-line checker stripe near launch', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  const ctx = createMockContext();
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const camera = editor.getRaceWorldPoseAtDistance(0);
  camera.horizonRatio = 0.31;
  camera.roadDepthRatio = 0.66;
  camera.focalScale = 1.04;

  editor.drawRaceStartCheckerStripe(ctx, bounds, {
    camera,
    cameraYaw: editor.playtestSession.cameraYaw,
    travel: editor.playtestSession.distance,
    routeLength: editor.playtestSession.routeLength
  });

  assert.equal(ctx.calls.filter((call) => call.type === 'fill').length >= 10, true);
});

test('Race playtest supports reverse, neutral, and forward gear states', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');

  editor.shiftRaceGear(-1);
  assert.equal(editor.raceInput.gear, 0);
  assert.equal(editor.formatRaceGear(), 'N');

  editor.playtestSession.shiftCooldownMs = 0;
  editor.shiftRaceGear(-1);
  assert.equal(editor.raceInput.gear, -1);
  assert.equal(editor.formatRaceGear(), 'R');

  editor.playtestSession.shiftCooldownMs = 0;
  editor.shiftRaceGear(1);
  assert.equal(editor.raceInput.gear, 0);
  editor.playtestSession.shiftCooldownMs = 0;
  editor.shiftRaceGear(1);
  assert.equal(editor.raceInput.gear, 1);
  assert.equal(editor.formatRaceGear(), '1');
});

test('Race d-pad separates steering diagonals from vertical gear shifts', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  const dpad = { x: 0, y: 0, w: 100, h: 100 };

  editor.handleRaceDpadPoint(dpad, { x: 86, y: 12 });
  assert.equal(editor.raceInput.gear, 1);
  assert.equal(editor.raceInput.binarySteer, 1);

  editor.handleRaceDpadPoint(dpad, { x: 50, y: 8 });
  assert.equal(editor.raceInput.gear, 2);
  assert.equal(editor.raceInput.binarySteer, 0);
});

test('Race playtest renderer projects a world-space road path through camera yaw', () => {
  assert.equal(raceEditorSource.includes('const steeringCamera ='), false);
  assert.equal(raceEditorSource.includes('this.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud });'), true);
  assert.equal(raceEditorSource.includes('getRacePathSamples({ step = 18 } = {})'), true);
  assert.equal(raceEditorSource.includes('getRaceWorldPoseAtDistance(distance = 0)'), true);
  assert.equal(raceEditorSource.includes('getRaceRoadCrossSectionAtDistance(distance = 0)'), true);
  assert.equal(raceEditorSource.includes('projectRaceWorldPointToCamera(point = {}, camera = {}, cameraYaw = 0, bounds = {})'), true);
  assert.equal(raceEditorSource.includes('const rightX = Math.cos(cameraYaw);'), true);
  assert.equal(raceEditorSource.includes('const forwardX = Math.sin(cameraYaw);'), true);
  assert.equal(raceEditorSource.includes('const launchAligning = Number(this.playtestSession.elapsedMs || 0) < 380 && absSpeed < 2.2;'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.carYaw = launchAligning'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.cameraYaw = this.playtestSession.carYaw;'), true);
  assert.equal(raceEditorSource.includes('const cameraYaw = Number(session?.cameraYaw ?? camera.yaw);'), true);
  assert.equal(raceEditorSource.includes('const crossSections = [];'), true);
  assert.equal(raceEditorSource.includes('ctx.moveTo(far.left.screenX, far.left.screenY);'), true);
  assert.equal(raceEditorSource.includes('drawRaceTrackMinimap(ctx'), true);
});

test('Race playtest camera yaw follows the car instead of auto-following road yaw', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.segments = [
    { length: 120, curve: 1, elevation: 0, surface: 'asphalt', turn: 'square', hazardIds: [] },
    { length: 120, curve: 1, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest(editor.selectedCar.id);
  editor.raceInput.gear = 2;
  editor.playtestSession.speedMps = 24;
  editor.raceInput.steeringTarget = 1;
  editor.raceInput.steeringWheel = 1;

  editor.updatePlaytest(0.25);

  const roadYaw = editor.getRaceRoadYawAtDistance(editor.playtestSession.distance);
  assert.notEqual(editor.playtestSession.cameraYaw, roadYaw);
  assert.equal(editor.playtestSession.cameraYaw, editor.playtestSession.carYaw);
  assert.equal(Math.abs(editor.playtestSession.heading) > 0.01, true);
});

test('Race route projection supports full 360-degree turns', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.type = 'circuit';
  editor.selectedRace.road.segments = [
    { length: 90, curve: 1, elevation: 0, surface: 'asphalt', turn: 'square', hazardIds: [] },
    { length: 90, curve: 1, elevation: 0, surface: 'asphalt', turn: 'square', hazardIds: [] },
    { length: 90, curve: 1, elevation: 0, surface: 'asphalt', turn: 'square', hazardIds: [] },
    { length: 90, curve: 1, elevation: 0, surface: 'asphalt', turn: 'square', hazardIds: [] }
  ];

  const endPose = editor.getRaceWorldPoseAtDistance(editor.getRaceRouteLength() - 1);
  assert.equal(Math.abs(endPose.yaw) > Math.PI * 1.2, true);

  const camera = editor.getRaceWorldPoseAtDistance(0);
  const quarterTurn = editor.getRaceWorldPoseAtDistance(110);
  const projected = editor.projectRaceWorldPointToCamera(quarterTurn, camera, camera.yaw, {
    x: 0,
    y: 0,
    w: 400,
    h: 240
  });

  assert.equal(Math.abs(projected.cameraX) > 35, true);
  assert.equal(projected.visible, true);

  const section = editor.getRaceRoadCrossSectionAtDistance(110);
  const left = editor.projectRaceWorldPointToCamera(section.left, camera, camera.yaw, {
    x: 0,
    y: 0,
    w: 400,
    h: 240
  });
  const right = editor.projectRaceWorldPointToCamera(section.right, camera, camera.yaw, {
    x: 0,
    y: 0,
    w: 400,
    h: 240
  });

  assert.equal(Math.abs(left.screenX - right.screenX) > 20, true);
});

test('Race playtest destination routes finish instead of wrapping', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.segments = [
    { length: 100, curve: 0.8, elevation: 0, surface: 'asphalt', turn: 'square', hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.distance = 99;
  editor.playtestSession.speedMps = 30;
  editor.raceInput.gear = 1;
  editor.raceInput.throttle = true;

  editor.update(null, 1);

  assert.equal(editor.playtestSession.distance, editor.playtestSession.routeLength);
  assert.equal(editor.playtestSession.running, false);
  assert.equal(editor.playtestSession.finished, true);
  assert.match(editor.status, /Finished/);
  assert.equal(editor.getRaceSegmentAtDistance(999).index, 0);
});

test('Race Editor road and surface commands mutate the selected segment', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const startingCount = editor.selectedRace.road.segments.length;

  editor.handleMenuAction('draw-road');
  assert.equal(editor.selectedRace.road.segments.length, startingCount + 1);
  assert.equal(editor.selectedSegmentIndex, 1);

  editor.handleMenuAction('segment-length');
  assert.equal(editor.selectedSegment.length, 180);

  editor.handleMenuAction('curve');
  assert.equal(editor.selectedSegment.curve, 0.25);

  editor.handleMenuAction('elevation');
  assert.equal(editor.selectedSegment.elevation, 0.08);

  editor.handleMenuAction('square-turn');
  assert.equal(editor.selectedSegment.turn, 'square');

  editor.handleMenuAction('road-width');
  assert.equal(editor.selectedRace.road.width, 10);

  editor.handleMenuAction('surface-snow');
  assert.equal(editor.selectedSegment.surface, 'snow');
});

test('Race Editor generates a random point-to-point race that can be playtested', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const originalRandom = Math.random;
  const values = [0.1, 0.55, 0.82, 0.33, 0.74, 0.18, 0.92, 0.41];
  let index = 0;
  Math.random = () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
  try {
    editor.handleMenuAction('generate-random-race');
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(editor.selectedRace.type, 'destination');
  assert.equal(editor.selectedRace.laps, 1);
  assert.equal(editor.selectedRace.road.segments.length >= 14, true);
  assert.equal(editor.selectedRace.codriver.calls.length, editor.selectedRace.road.segments.length);
  assert.equal(editor.selectedRace.road.segments.some((segment) => Math.abs(segment.curve) >= 0.5), true);
  assert.equal(editor.selectedRace.road.segments.some((segment) => Math.abs(segment.elevation) > 0.15), true);
  assert.match(editor.status, /Generated/);

  editor.startPlaytest('starter-rwd');
  assert.equal(editor.playtestSession.routeLength > 1000, true);
});

test('Race Editor Playtest opens car picker and starts a structured drive session', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  editor.project.cars.push({
    ...editor.selectedCar,
    id: 'awd-test',
    name: 'AWD Test',
    tuning: { ...editor.selectedCar.tuning, drivetrain: 'awd', powerHp: 420 }
  });
  editor.project.races[0].competition.aiDrivers[0].enabled = true;

  editor.handleMenuAction('test-drive');
  editor.draw(createMockContext(), 1280, 800);

  assert.equal(editor.playtestPickerOpen, true);
  assert.ok(editor.buttons.some((button) => button.id === 'playtest-car-awd-test'));

  editor.startPlaytest('awd-test');

  assert.equal(editor.playtestPickerOpen, false);
  assert.equal(editor.playtestSession.carId, 'awd-test');
  assert.equal(editor.playtestSession.raceId, 'test-loop');
  assert.equal(editor.playtestSession.aiDrivers.length, 1);
  assert.equal(editor.playtestSession.hazards.length > 0, true);
  assert.equal(editor.playtestSession.codriverCalls.length > 0, true);
  assert.equal(editor.playtestSession.running, true);
  assert.equal(editor.playtestSession.routeLength > 0, true);
  assert.deepEqual(editor.playtestSession.eventLog, [
    '1 AI racers enabled',
    '3 race hazards loaded',
    '3 co-driver calls queued'
  ]);
});

test('Race Editor playtest advances, exposes route cues, and can end from the HUD', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.shiftRaceGear(1);
  editor.raceInput.activeThrottlePointerId = 1;
  editor.update(null, 1);

  assert.equal(editor.playtestSession.distance > 0, true);
  assert.equal(editor.playtestSession.speedMps > 0, true);
  assert.equal(editor.getNextCoDriverCall()?.id, 'medium-right');
  assert.equal(editor.getUpcomingHazard()?.id, 'zombie-pack-1');

  editor.draw(ctx, 1280, 800);
  const driveRoot = editor.buttons.find((button) => button.desktopRootId === 'drive');
  assert.ok(driveRoot);
  editor.handlePointerDown({
    x: driveRoot.bounds.x + driveRoot.bounds.w / 2,
    y: driveRoot.bounds.y + driveRoot.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);
  const endButton = editor.buttons.find((button) => button.id === 'end-playtest' && button.desktopDropdownItem);
  assert.ok(endButton);
  editor.handlePointerDown({
    x: endButton.bounds.x + endButton.bounds.w / 2,
    y: endButton.bounds.y + endButton.bounds.h / 2
  });
  editor.handlePointerUp({
    x: endButton.bounds.x + endButton.bounds.w / 2,
    y: endButton.bounds.y + endButton.bounds.h / 2
  });

  assert.equal(editor.playtestSession, null);
  assert.match(editor.status, /Ended playtest/);
});

test('Race Editor mobile playtest uses shared handheld shell and race controls instead of editor chrome', () => {
  let portraitShell = 0;
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    drawPortraitHandheldShell() { portraitShell += 1; },
    exitRaceEditor() {}
  });
  editor.startPlaytest('starter-rwd');
  editor.draw(createMockContext(), 390, 844);

  const ids = editor.buttons.map((button) => button.id);
  assert.ok(ids.includes('race-dpad'));
  assert.ok(ids.includes('race-go'));
  assert.ok(ids.includes('race-brake'));
  assert.ok(ids.includes('race-start'));
  assert.ok(ids.includes('race-select'));
  assert.equal(ids.includes('menu'), false);
  assert.equal(portraitShell, 1);
});

test('Race Editor mobile playtest maps G, R, d-pad, and Select camera controls', () => {
  let landscapeShell = 0;
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    drawLandscapeHandheldShell() { landscapeShell += 1; },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 844, 390);

  const go = editor.buttons.find((button) => button.id === 'race-go');
  const brake = editor.buttons.find((button) => button.id === 'race-brake');
  const dpad = editor.buttons.find((button) => button.id === 'race-dpad');
  const start = editor.buttons.find((button) => button.id === 'race-start');
  assert.ok(go);
  assert.ok(brake);
  assert.ok(dpad);
  assert.ok(start);
  assert.equal(landscapeShell, 1);

  editor.handlePointerDown({ id: 'g', x: go.bounds.x + go.bounds.w / 2, y: go.bounds.y + go.bounds.h / 2 });
  editor.handlePointerDown({ id: 'dpad', x: dpad.bounds.x + dpad.bounds.w * 0.9, y: dpad.bounds.y + dpad.bounds.h / 2 });
  editor.updatePlaytest(0.25);
  assert.equal(editor.playtestSession.steeringWheel > 0, true);

  editor.handleRaceDpadPoint(dpad.bounds, { x: dpad.bounds.x + dpad.bounds.w / 2, y: dpad.bounds.y + dpad.bounds.h * 0.1 });
  editor.update(null, 1);

  assert.equal(editor.raceInput.throttle, true);
  assert.equal(editor.raceInput.gear >= 1, true);
  assert.equal(editor.playtestSession.speedMps > 0, true);
  assert.equal(editor.raceInput.binarySteer, 0);

  editor.handlePointerUp({ id: 'g', x: go.bounds.x + go.bounds.w / 2, y: go.bounds.y + go.bounds.h / 2 });
  assert.equal(editor.raceInput.throttle, false);

  editor.handlePointerDown({ id: 'r1', x: brake.bounds.x + brake.bounds.w / 2, y: brake.bounds.y + brake.bounds.h / 2 });
  editor.handlePointerUp({ id: 'r1', x: brake.bounds.x + brake.bounds.w / 2, y: brake.bounds.y + brake.bounds.h / 2 });
  editor.handlePointerDown({ id: 'r2', x: brake.bounds.x + brake.bounds.w / 2, y: brake.bounds.y + brake.bounds.h / 2 });
  assert.equal(editor.raceInput.handbrake, true);

  editor.handlePointerDown({ id: 'start', x: start.bounds.x + start.bounds.w / 2, y: start.bounds.y + start.bounds.h / 2 });
  assert.equal(editor.raceInput.paused, true);
  editor.draw(ctx, 844, 390);
  assert.equal(editor.buttons.some((button) => button.id === 'race-camera-toggle'), false);
  const select = editor.buttons.find((button) => button.id === 'race-select');
  assert.ok(select);
  select.onClick();
  assert.equal(editor.raceInput.cameraView, 'first-person');
});

test('Race Editor playtest steering recenters and sweeps the road more than it strafes the car', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 1 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.gear = 1;
  editor.raceInput.binarySteer = 1;
  editor.raceInput.throttle = true;
  editor.raceInput.activeDpadPointerId = null;
  editor.playtestSession.speedMps = 36;
  editor.updatePlaytest(0.5);

  assert.equal(editor.raceInput.steeringTarget < 1, true);
  assert.equal(Math.abs(editor.playtestSession.lateral) > 0, true);
  assert.equal(Math.abs(editor.playtestSession.lateral) <= 0.42, true);
  assert.equal(Math.abs(editor.playtestSession.roadViewOffset) > 0, true);
});

test('Race Editor playtest damage and wear affect grip, power, shifting, and steering pull', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 1 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.applyRaceDamage('tires', 40);
  editor.applyRaceDamage('engine', 50);
  editor.applyRaceDamage('transmission', 85);
  editor.applyRaceDamage('suspension', 45, { pull: 0.2 });

  const effects = editor.getRaceDamageEffects();
  assert.equal(effects.grip < 1, true);
  assert.equal(effects.enginePower < 1, true);
  assert.equal(effects.shiftDelayMs > 0, true);
  assert.equal(effects.suspensionPull > 0, true);

  editor.raceInput.gear = 4;
  editor.shiftRaceGear(1);
  assert.equal(editor.raceInput.gear, 4);
  assert.deepEqual(editor.playtestSession.damagedGears, [5]);
});

test('Race Editor playtest HUD draws tach, time/lap, and car status panels', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.raceInput.gear = 1;
  editor.playtestSession.elapsedMs = 62100;
  editor.playtestSession.speedMps = 24;
  editor.playtestSession.rpm = 0.82;
  editor.applyRaceDamage('panels', 30);
  editor.applyRaceDamage('tires', 15, { keys: ['fl', 'rr'] });
  editor.draw(ctx, 390, 844);

  const text = ctx.calls.filter((call) => call.type === 'text');
  assert.equal(text.some((call) => call.value === '1'), true);
  assert.equal(text.some((call) => call.value === '1:02.1'), true);
  assert.equal(text.some((call) => call.value === 'RED'), true);
  assert.equal(text.some((call) => call.value === 'DMG'), true);
  assert.equal(text.some((call) => call.value === 'ENG'), true);
  assert.equal(text.some((call) => call.value === 'TRN'), true);
  assert.equal(text.some((call) => call.value === 'FL'), true);
  assert.equal(text.some((call) => call.value === 'FR'), true);
  assert.equal(text.some((call) => call.value === 'RL'), true);
  assert.equal(text.some((call) => call.value === 'RR'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'arc'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'lineTo'), true);
});

test('Race Editor destination HUD shows percent instead of lap text', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.selectedRace.type = 'destination';
  editor.selectedRace.laps = 3;
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.distance = editor.playtestSession.routeLength * 0.52;
  editor.drawRaceTimePanel(ctx, { x: 0, y: 0, w: 390, h: 240 });

  const text = ctx.calls.filter((call) => call.type === 'text').map((call) => call.value);
  assert.equal(text.includes('52%'), true);
  assert.equal(text.some((value) => String(value).includes('Lap')), false);
  assert.equal(text.some((value) => String(value).includes('Point')), false);
});

test('Race Editor high-speed road projection raises the horizon for longer road perspective', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };

  editor.startPlaytest('starter-rwd');
  const stoppedCtx = createMockContext();
  editor.playtestSession.speedMps = 0;
  editor.drawRaceProjectedRoadPath(stoppedCtx, bounds, { showPlaytestHud: false });
  const stoppedSky = stoppedCtx.calls.filter((call) => call.type === 'fillRect')[1];

  const fastCtx = createMockContext();
  editor.playtestSession.speedMps = 60;
  editor.drawRaceProjectedRoadPath(fastCtx, bounds, { showPlaytestHud: false });
  const fastSky = fastCtx.calls.filter((call) => call.type === 'fillRect')[1];

  assert.ok(stoppedSky);
  assert.ok(fastSky);
  assert.equal(fastSky.h < stoppedSky.h - 8, true);
  assert.equal(fastSky.h <= bounds.h * 0.27, true);
  assert.ok(editor.getRaceRoadHalfWidthWorld() < 22);
  assert.equal(raceEditorSource.includes('drawRaceStartCheckerStripe'), true);
  assert.equal(raceEditorSource.includes("ctx.fillStyle = index % 2 === 0 ? '#f1f4ef' : '#050807';"), true);
});

test('Race Editor mobile playtest suppresses editor scaffold text and big preview HUD', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 390, 844);

  const text = ctx.calls.filter((call) => call.type === 'text').map((call) => call.value);
  assert.equal(text.includes('Playtest'), false);
  assert.equal(text.some((value) => String(value).includes('preview scaffold')), false);
});

test('Race Editor analog steering reduces available steering at speed', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 1, leftTrigger: 0, rightTrigger: 1 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 70;
  editor.update(null, 0.16);

  assert.equal(editor.raceInput.throttle, true);
  assert.equal(editor.raceInput.steeringTarget <= 0.28, true);
});

test('Race Editor binary steering returns the wheel to center after release', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 12;
  editor.raceInput.binarySteer = 1;
  editor.updatePlaytest(0.18);
  assert.equal(editor.raceInput.steeringWheel > 0.05, true);

  editor.raceInput.binarySteer = 0;
  for (let i = 0; i < 24; i += 1) editor.updatePlaytest(0.016);

  assert.equal(editor.raceInput.steeringWheel, 0);
  assert.equal(editor.raceInput.steeringTarget, 0);
});

test('Race Editor binary steering has full lock at rest and damped lock at speed', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.binarySteer = 1;
  editor.playtestSession.speedMps = 0;
  for (let i = 0; i < 14; i += 1) editor.updatePlaytest(0.016);
  const restTarget = editor.raceInput.steeringTarget;
  const restWheel = editor.raceInput.steeringWheel;

  editor.raceInput.steeringTarget = 0;
  editor.raceInput.steeringWheel = 0;
  editor.playtestSession.speedMps = 70;
  for (let i = 0; i < 14; i += 1) editor.updatePlaytest(0.016);

  assert.equal(restTarget > 0.75, true);
  assert.equal(restWheel > 0.75, true);
  assert.equal(editor.raceInput.steeringTarget <= 0.28, true);
  assert.equal(editor.raceInput.steeringWheel <= 0.28, true);
  assert.equal(editor.raceInput.steeringTarget < restTarget, true);
});

test('Race Editor touch d-pad steering is not cleared by input polling', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  const idleInput = {
    isDown: () => false,
    isDownCode: () => false,
    wasPressed: () => false,
    wasPressedCode: () => false
  };

  editor.startPlaytest('starter-rwd');
  editor.raceInput.activeDpadPointerId = 0;
  editor.raceInput.binarySteer = 1;
  editor.updateRaceKeyboardInput(idleInput);
  editor.updatePlaytest(0.18);

  assert.equal(editor.raceInput.binarySteer, 1);
  assert.equal(editor.raceInput.steeringTarget > 0.65, true);

  editor.raceInput.activeDpadPointerId = null;
  editor.updateRaceKeyboardInput(idleInput);
  assert.equal(editor.raceInput.binarySteer, 0);
});

test('Race Editor supports Forza-style gamepad trigger and face-button fallbacks', () => {
  const gameInput = {
    gamepadActions: { dpadRight: true, jump: true, dash: true },
    gamepadPressed: new Set(['throw'])
  };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.updateRaceKeyboardInput({
    isDown: () => false,
    isDownCode: () => false,
    wasPressed: () => false,
    wasPressedCode: () => false
  });

  assert.equal(editor.raceInput.keyboardThrottle, true);
  assert.equal(editor.raceInput.keyboardBrake, true);
  assert.equal(editor.raceInput.binarySteer, 1);
  assert.equal(editor.raceInput.gear, 2);

  gameInput.gamepadActions = { dpadLeft: true };
  gameInput.gamepadPressed = new Set();
  editor.updateRaceKeyboardInput({
    isDown: () => false,
    isDownCode: () => false,
    wasPressed: () => false,
    wasPressedCode: () => false
  });
  assert.equal(editor.raceInput.binarySteer, -1);
});

test('Race Editor desktop keyboard controls drive the playtest throttle and gear', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const input = {
    isDown(action) {
      return action === 'right';
    },
    isDownCode(code) {
      return code === 'KeyG';
    },
    wasPressed(action) {
      return action === 'up';
    },
    wasPressedCode() {
      return false;
    }
  };

  editor.startPlaytest('starter-rwd');
  editor.update(input, 1 / 30);

  assert.equal(editor.raceInput.throttle, true);
  assert.equal(editor.raceInput.gear, 2);
  assert.ok(editor.raceInput.steeringTarget > 0);
  assert.ok(editor.playtestSession.speedMps > 0);
});

test('Race Editor first-gear throttle revs before road speed catches up', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.activeThrottlePointerId = 1;
  editor.update(null, 0.35);

  assert.equal(editor.raceInput.gear, 1);
  assert.ok(editor.playtestSession.rpm > 0.2);
  assert.ok(editor.playtestSession.speedMps > 0);
  assert.equal(editor.playtestSession.speedMps < 5, true);
});

test('Race Editor simulates 2022 WRX manual and automatic drivetrain calibration', () => {
  const manual = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  manual.startPlaytest('starter-rwd');

  assert.equal(manual.selectedCar.name, '2022 Subaru WRX 6MT');
  assert.equal(manual.selectedCar.tuning.drivetrain, 'awd');
  assert.equal(manual.selectedCar.tuning.powerHp, 271);
  assert.equal(manual.selectedCar.tuning.torqueLbFt, 258);
  assert.equal(manual.raceInput.autoShift, false);
  assert.equal(manual.raceInput.gear, 1);

  const manualRun = simulateRaceAcceleration(manual, { manual: true });
  assert.equal(manualRun.zeroToSixty >= 5, true);
  assert.equal(manualRun.zeroToSixty <= 6.2, true);
  assert.equal(manualRun.maxMph >= 132, true);
  assert.equal(manualRun.maxMph <= 137, true);

  const automatic = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  automatic.startPlaytest('wrx-2022-automatic');

  assert.equal(automatic.selectedCar.name, '2022 Subaru WRX SPT');
  assert.equal(automatic.raceInput.autoShift, true);
  assert.equal(automatic.raceInput.gear, 1);

  const automaticRun = simulateRaceAcceleration(automatic);
  assert.equal(automaticRun.zeroToSixty >= 5, true);
  assert.equal(automaticRun.zeroToSixty <= 6.3, true);
  assert.equal(automaticRun.maxMph >= 132, true);
  assert.equal(automaticRun.maxMph <= 137, true);
  assert.equal(automatic.raceInput.gear > 1, true);
});

test('Race Editor rev limits the WRX engine in neutral', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.gear = 0;
  editor.playtestSession.gear = 0;
  editor.raceInput.activeThrottlePointerId = 1;
  editor.update(null, 2);

  const tuning = editor.getRaceCarTuning(editor.selectedCar);
  assert.equal(editor.raceInput.gear, 0);
  assert.equal(editor.playtestSession.engineRpm <= tuning.revLimitRpm + 120, true);
  assert.equal(editor.playtestSession.rpm <= 1.08, true);
});

test('Race Editor surface and weather grip hooks support rain and snow tuning', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });

  assert.equal(editor.getRaceWeatherGripMultiplier('rain') < editor.getRaceWeatherGripMultiplier('clear'), true);
  assert.equal(editor.getRaceWeatherGripMultiplier('snow') < editor.getRaceWeatherGripMultiplier('rain'), true);
});
