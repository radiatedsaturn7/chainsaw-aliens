import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import RaceEditor from '../../src/ui/RaceEditor.js';

const raceEditorSource = readFileSync(new URL('../../src/ui/RaceEditor.js', import.meta.url), 'utf8');
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

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

function seedEditableRaceRoute(editor) {
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 180, elevation: 0 },
    { x: 105, y: 245, elevation: 0.08 },
    { x: 215, y: 155, elevation: -0.04 }
  ];
  editor.selectedRace.road.segments = [
    { length: 180, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] },
    { length: 120, curve: 0.55, elevation: 0.08, surface: 'asphalt', codriver: 'medium-right' },
    { length: 150, curve: -0.35, elevation: -0.04, surface: 'dirt', hazardIds: ['zombie-pack-1'] }
  ];
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
  assert.deepEqual(ids.slice(0, 4), ['menu', 'undo', 'redo', 'draw-road']);
  assert.ok(editor.buttons.some((button) => button.bounds.y > 730 && button.onClick));
  assert.ok(editor.portraitThumbstick.radius > 0);
  assert.equal(raceEditorSource.includes("if (canRenderEditorSurface(this.activeViewportMode, 'bottom-action-rail')) {\n      drawSharedPortraitActionRail(ctx, layout.actionRail, this.portraitThumbstick, actions, {"), true);
  assert.equal(raceEditorSource.includes("reserveThumbstick: canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')"), true);
});

test('Race Editor starts on race-building controls and exposes Generate in portrait', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 390, 844);

  assert.equal(editor.activeRootId, 'race');
  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  assert.ok(menuButton);
  const menuPoint = {
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2
  };
  editor.handlePointerDown(menuPoint);
  editor.handlePointerUp(menuPoint);
  editor.draw(ctx, 390, 844);

  assert.ok(editor.buttons.some((button) => button.id === 'generate-random-race'));
});

test('Race Editor portrait bottom menu exposes authoring roots and Drive playtest', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 390, 844);

  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  assert.ok(menuButton);
  editor.handlePointerDown({
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2
  });
  editor.draw(ctx, 390, 844);

  ['file', 'race', 'ground', 'elevation', 'sprites', 'settings', 'drive'].forEach((id) => {
    assert.ok(editor.buttons.some((button) => button.id === id), id);
  });
  const driveButton = editor.buttons.find((button) => button.id === 'drive');
  assert.ok(driveButton);
  const drivePoint = {
    x: driveButton.bounds.x + driveButton.bounds.w / 2,
    y: driveButton.bounds.y + driveButton.bounds.h / 2
  };
  editor.handlePointerDown(drivePoint);
  editor.handlePointerUp(drivePoint);
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'test-drive'), 'test-drive');

  const fileButton = editor.buttons.find((button) => button.id === 'file');
  assert.ok(fileButton);
  const filePoint = {
    x: fileButton.bounds.x + fileButton.bounds.w / 2,
    y: fileButton.bounds.y + fileButton.bounds.h / 2
  };
  editor.handlePointerDown(filePoint);
  editor.handlePointerUp(filePoint);
  editor.draw(ctx, 390, 844);
  ['new', 'save', 'save-as'].forEach((id) => {
    const button = editor.buttons.find((candidate) => candidate.id === id);
    assert.ok(button, id);
    assert.equal(button.disabled, false, id);
  });
});

test('Race Editor portrait thumbstick pans the map and zoom slider changes map zoom', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 390, 844);

  assert.ok(editor.buttons.some((button) => button.id === 'race-map-zoom'));
  const beforeZoom = editor.raceMapZoom;
  const zoom = editor.buttons.find((button) => button.id === 'race-map-zoom');
  editor.handlePointerDown({ id: 'zoom', x: zoom.bounds.x + zoom.bounds.w, y: zoom.bounds.y + zoom.bounds.h / 2 });
  editor.handlePointerMove({ id: 'zoom', x: zoom.bounds.x + zoom.bounds.w, y: zoom.bounds.y + zoom.bounds.h / 2 });
  editor.handlePointerUp({ id: 'zoom', x: zoom.bounds.x + zoom.bounds.w, y: zoom.bounds.y + zoom.bounds.h / 2 });
  assert.equal(editor.raceMapZoom > beforeZoom, true);

  const beforePan = { ...editor.raceMapPan };
  const center = editor.portraitThumbstick.center;
  editor.handlePointerDown({ id: 'stick', x: center.x, y: center.y });
  editor.handlePointerMove({ id: 'stick', x: center.x + 22, y: center.y - 18 });
  editor.update({}, 0.16);
  const firstPan = { ...editor.raceMapPan };
  editor.update({}, 0.16);
  const secondPan = { ...editor.raceMapPan };
  editor.handlePointerUp({ id: 'stick', x: center.x + 22, y: center.y - 18 });
  assert.notDeepEqual(editor.raceMapPan, beforePan);
  assert.notDeepEqual(firstPan, beforePan);
  assert.notDeepEqual(secondPan, firstPan);
  assert.equal(firstPan.x < beforePan.x, true);
  assert.equal(firstPan.y > beforePan.y, true);
  assert.equal(editor.portraitThumbstick.active, false);
  editor.update({}, 0.16);
  assert.deepEqual(editor.raceMapPan, secondPan);
});

test('Race Editor portrait uses bottom menu roots and contextual node or edge hot actions', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.draw(ctx, 390, 844);

  ['portrait-mode-race', 'portrait-mode-ground', 'portrait-mode-elevation'].forEach((id) => {
    assert.equal(editor.buttons.some((button) => button.id === id), false, id);
  });
  assert.ok(editor.buttons.some((button) => button.id === 'cycle-surface'));
  assert.ok(editor.buttons.some((button) => button.id === 'segment-width'));
  assert.ok(editor.buttons.some((button) => button.id === 'segment-bumpiness'));
  assert.ok(editor.buttons.some((button) => button.id === 'insert-node'));
  assert.ok(editor.buttons.some((button) => button.id === 'remove-edge'));

  editor.raceSelectionType = 'node';
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'move-node'));
  assert.ok(editor.buttons.some((button) => button.id === 'snap-node'));
  assert.ok(editor.buttons.some((button) => button.id === 'remove-node'));
  assert.ok(editor.buttons.some((button) => button.id === 'draw-road'));

  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  editor.handlePointerDown({
    id: 'menu-button',
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2,
    button: 0
  });
  editor.draw(ctx, 390, 844);
  const groundButton = editor.buttons.find((button) => button.id === 'ground');
  assert.ok(groundButton);
  editor.handlePointerDown({
    id: 'ground-root',
    x: groundButton.bounds.x + groundButton.bounds.w / 2,
    y: groundButton.bounds.y + groundButton.bounds.h / 2,
    button: 0
  });
  editor.handlePointerUp({
    id: 'ground-root-up',
    x: groundButton.bounds.x + groundButton.bounds.w / 2,
    y: groundButton.bounds.y + groundButton.bounds.h / 2,
    button: 0
  });
  assert.equal(editor.racePortraitMode, 'ground');
  assert.equal(editor.activeAction, 'paint-ground');
  editor.activeRootId = null;
  editor.menuScrollRegions = [];

  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'ground-tile-next'));
  assert.ok(editor.buttons.some((button) => button.id === 'paint-ground'));

  const beforePatches = editor.selectedRace.road.groundTiles.length;
  editor.handlePointerDown({
    id: 'paint-ground',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.52,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.42,
    button: 0
  });
  assert.equal(editor.selectedRace.road.groundTiles.length > beforePatches, true);

  editor.setRacePortraitMode('elevation');
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'elevation-up'));
  assert.ok(editor.buttons.some((button) => button.id === 'elevation-down'));
  assert.ok(editor.buttons.some((button) => button.id === 'elevation-brush-size'));
  const beforeElevationPatches = editor.selectedRace.road.groundTiles.length;
  editor.handlePointerDown({
    id: 'paint-elevation',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.68,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.52,
    button: 0
  });
  const patch = editor.selectedRace.road.groundTiles.at(-1);
  assert.equal(editor.selectedRace.road.groundTiles.length >= beforeElevationPatches, true);
  assert.equal(typeof patch.elevation, 'number');
  assert.equal(patch.source, 'height-brush');
});

test('Race Editor keeps a locked start tile and infers circuits by snapping destination to start', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  assert.deepEqual(editor.selectedRace.road.nodes, [{ x: 0, y: 0, elevation: 0, role: 'start', locked: true }]);
  assert.deepEqual(editor.getRaceEditableNodes(), [{ x: 0, y: 0, elevation: 0, role: 'start', locked: true }]);

  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 150, y: 0, elevation: 0 },
    { x: 150, y: 120, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 150, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] },
    { length: 120, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] }
  ];
  const nodes = editor.getRaceEditableNodes();
  assert.equal(nodes[0].role, 'start');
  assert.equal(nodes[0].locked, true);

  editor.selectedSegmentIndex = -1;
  assert.equal(editor.removeSelectedRaceNode(), true);
  assert.equal(editor.selectedRace.road.nodes[0].role, 'start');
  assert.equal(editor.selectedRace.road.nodes[0].locked, true);

  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 150, y: 0, elevation: 0 },
    { x: 20, y: 5, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 150, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] },
    { length: 148, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] }
  ];
  assert.equal(editor.getSelectedRaceRuntimeType(), 'destination');
  assert.equal(editor.maybeSnapRaceNodeToStart(2), true);
  assert.equal(editor.getSelectedRaceRuntimeType(), 'circuit');
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
  seedEditableRaceRoute(editor);
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

test('Race Editor keeps road cross-sections planar over painted ground elevation', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  seedEditableRaceRoute(editor);
  const centerPose = editor.getRaceWorldPoseAtDistance(80);
  const rawPoints = editor.getRaceRawMapPoints();
  const minX = Math.min(...rawPoints.map((point) => point.x));
  const maxX = Math.max(...rawPoints.map((point) => point.x));
  const minY = Math.min(...rawPoints.map((point) => point.y));
  const maxY = Math.max(...rawPoints.map((point) => point.y));
  editor.selectedRace.road.groundTiles = [{
    x: (centerPose.x - minX) / Math.max(1, maxX - minX),
    y: (centerPose.z - minY) / Math.max(1, maxY - minY),
    radius: 1,
    tileId: 'snow',
    elevation: 0.42
  }];

  const section = editor.getRaceRoadCrossSectionAtDistance(80);

  assert.equal(editor.getRaceGroundElevationAtWorldPoint(section.left, 0), 0.42);
  assert.equal(section.left.elevation, section.center.elevation);
  assert.equal(section.right.elevation, section.center.elevation);
});

test('Race Editor edits selected edge width, bumpiness, and snow condition', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const segment = editor.selectedSegment;

  assert.equal(editor.getRaceRoadWidthMForSegment(segment), 11);
  editor.handleMenuAction('segment-width');
  assert.equal(segment.roadWidthM, 13);
  editor.handleMenuAction('segment-bumpiness');
  assert.equal(segment.bumpiness, 0.15);
  editor.handleMenuAction('snow-condition');
  assert.equal(segment.surface, 'snow');
  assert.equal(segment.snowCondition, 'dusting');
  assert.equal(editor.getRaceSegmentSurfaceDetailGrip(segment) < 1, true);

  const defaultHalfWidth = editor.getRaceRoadHalfWidthWorld({ roadWidthM: 11 });
  const daytonaHalfWidth = editor.getRaceRoadHalfWidthWorld({ roadWidthM: 24 });
  const rallyHalfWidth = editor.getRaceRoadHalfWidthWorld({ roadWidthM: 6 });
  assert.equal(daytonaHalfWidth > defaultHalfWidth, true);
  assert.equal(rallyHalfWidth < defaultHalfWidth, true);

  const beforeSegments = editor.selectedRace.road.segments.length;
  const beforeNodes = editor.ensureRaceSegmentNodes().length;
  editor.raceSelectionType = 'edge';
  editor.handleMenuAction('insert-node');
  assert.equal(editor.selectedRace.road.segments.length, beforeSegments + 1);
  assert.equal(editor.getRaceEditableNodes().length, beforeNodes + 1);
  assert.equal(editor.raceSelectionType, 'node');
});

test('Race Editor playtest sampling follows dragged nodes and painted terrain tiles', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  seedEditableRaceRoute(editor);
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

test('Race Editor smooths sparse node-authored routes with bounded curve vertices', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 260, elevation: 0.02 },
    { x: 260, y: 260, elevation: 0.04 },
    { x: 260, y: 520, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 260, curve: 0, elevation: 0.02, surface: 'asphalt', hazardIds: [] },
    { length: 260, curve: 0, elevation: 0.04, surface: 'asphalt', hazardIds: [] },
    { length: 260, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] }
  ];

  const samples = editor.getRacePathSamples({ step: 34 });
  const interiorCurveSamples = samples.filter((sample) => (
    sample.x > 1
    && sample.x < 250
    && sample.z > 170
    && sample.z < 260
    && sample.yaw > 0.1
    && sample.yaw < 1.45
  ));

  assert.equal(interiorCurveSamples.length >= 3, true);
  assert.equal(samples.every((sample) => sample.x >= -0.001 && sample.x <= 260.001), true);
  assert.equal(samples.every((sample) => sample.z >= -0.001 && sample.z <= 520.001), true);
  assert.equal(editor.getRaceRouteLength() < 780, true);
  assert.equal(editor.getRaceRouteLength() > 680, true);
  assert.equal(raceEditorSource.includes('getRaceNodeCornerPlan(nodes = [], nodeIndex = 0'), true);
  assert.equal(raceEditorSource.includes('appendCurve(corner.entry, corner.control, corner.exit'), true);
});

test('Race Editor rounds explicit square node corners while preserving their semantic turn type', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 0, y: 220, elevation: 0 },
    { x: 220, y: 220, elevation: 0 }
  ];
  const smoothSegments = [
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt' },
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt' }
  ];
  const sharpSegments = [
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt', turn: 'square' },
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt' }
  ];

  const smoothCorner = editor.getRaceNodeCornerPlan(nodes, 1, { step: 18, segments: smoothSegments });
  const sharpCorner = editor.getRaceNodeCornerPlan(nodes, 1, { step: 18, segments: sharpSegments });
  const smoothDistance = Math.hypot(smoothCorner.control.x - smoothCorner.entry.x, smoothCorner.control.z - smoothCorner.entry.z);
  const sharpDistance = Math.hypot(sharpCorner.control.x - sharpCorner.entry.x, sharpCorner.control.z - sharpCorner.entry.z);

  assert.equal(smoothCorner.sharp, false);
  assert.equal(sharpCorner.sharp, true);
  assert.equal(sharpDistance > smoothDistance * 0.75, true);
  assert.equal(sharpCorner.minPieces >= 16, true);
});

test('Race Editor auto-rounds sparse tight node turns with enough samples to read the apex', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 260, elevation: 0 },
    { x: 110, y: 350, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 260, curve: 0, elevation: 0, surface: 'asphalt' },
    { length: 142, curve: 0, elevation: 0, surface: 'asphalt' }
  ];

  const corner = editor.getRaceNodeCornerPlan(editor.selectedRace.road.nodes, 1, { step: 30, segments: editor.selectedRace.road.segments });
  const samples = editor.getRacePathSamples({ step: 30 });
  const cornerSamples = samples.filter((sample) => sample.x > 1 && sample.x < 105 && sample.z > 205 && sample.z < 340);

  assert.equal(corner.autoRound, true);
  assert.equal(corner.minPieces >= 10, true);
  assert.equal(cornerSamples.length >= 8, true);
});

test('Race Editor auto-rounds shallow node turns under ninety degrees', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 260, elevation: 0 },
    { x: 58, y: 450, elevation: 0.02 }
  ];
  editor.selectedRace.road.segments = [
    { length: 260, curve: 0, elevation: 0, surface: 'asphalt' },
    { length: 199, curve: 0, elevation: 0.02, surface: 'asphalt' }
  ];

  const corner = editor.getRaceNodeCornerPlan(editor.selectedRace.road.nodes, 1, { step: 28, segments: editor.selectedRace.road.segments });
  const samples = editor.getRacePathSamples({ step: 28 });
  const curvedSamples = samples.filter((sample) => sample.x > 0.5 && sample.x < 55 && sample.z > 215 && sample.z < 430);
  let maxYawJump = 0;
  for (let index = 1; index < curvedSamples.length; index += 1) {
    maxYawJump = Math.max(maxYawJump, Math.abs(normalizeAngle(curvedSamples[index].yaw - curvedSamples[index - 1].yaw)));
  }

  assert.equal(corner.autoRound, true);
  assert.equal(corner.bend < Math.PI / 2, true);
  assert.equal(curvedSamples.length >= 7, true);
  assert.equal(maxYawJump < 0.22, true);
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
  seedEditableRaceRoute(editor);
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
    { mode: 'race', roots: ['file', 'edit', 'view', 'race', 'ground', 'elevation', 'sprites', 'settings', 'drive'] },
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
  openLandscapeRoot(editor, 'race');

  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.gamepadSubmenuOpen, false);
  assert.equal(editor.activeRootId, 'race');
  assert.ok(editor.buttons.some((button) => button.id === 'race' && button.bounds.x < 240));
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
  assert.equal(raceEditorSource.includes('  resolveRaceViewportMode(width = this.game?.canvas?.width || 0, height = this.game?.canvas?.height || 0) {'), true);
  assert.equal(raceEditorSource.includes('const viewportMode = this.resolveRaceViewportMode(width, height);'), true);
  assert.equal(raceEditorSource.includes('isMobile: viewportMode.isMobileViewport,'), true);
  assert.equal(raceEditorSource.includes('isMobile: Boolean(this.game?.deviceIsMobile || this.game?.isMobile),\n      menuActive:'), false);
  assert.equal(raceEditorSource.includes('const gamepadMenuState = this.getGamepadMenuState(width, height);'), true);
  assert.equal(raceEditorSource.includes('const gamepad = gamepadMenuState.isLandscapeMenuMode;'), true);
  assert.equal(raceEditorSource.includes('reserveRightRail: !gamepadMenuState.isLandscapeMenuMode'), true);
  assert.equal(raceEditorSource.includes('if (gamepadMenuState.isLandscapeMenuMode) {'), true);
  assert.equal(raceEditorSource.includes("const canRenderLandscapeBottomRail = canRenderEditorPlanSurface(shell, 'bottom-tool-rail');"), true);
  assert.equal(raceEditorSource.includes("const canRenderLandscapeRightSubmenu = canRenderEditorPlanSurface(shell, 'right-drawer')"), true);
  assert.equal(raceEditorSource.includes("&& canRenderEditorPlanSurface(shell, 'landscape-right-submenu');"), true);
  assert.equal(raceEditorSource.includes('const landscapeToolOptionsSurface = canRenderLandscapeBottomRail ? shell.surfaces.toolOptions : null;'), true);
  assert.equal(raceEditorSource.includes('const landscapeSubmenuSurface = canRenderLandscapeRightSubmenu ? shell.surfaces.submenu : null;'), true);
  assert.equal(raceEditorSource.includes('if (landscapeToolOptionsSurface) {'), true);
  assert.equal(raceEditorSource.includes('reserveRightRail: !gamepad,'), false);
  assert.equal(raceEditorSource.includes('drawSharedGamepadHintBar(ctx, bounds, contextLabel, SHARED_EDITOR_GAMEPAD_HINTS);'), true);
  assert.equal(raceEditorSource.includes("if (gamepadMenuState.isLandscapeMenuMode && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {\n      this.drawGamepadHintBar(ctx, {\n        x: shell.surfaces.workSurface.x + 12,"), true);
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
  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.gamepadSubmenuOpen, false);

  editor.draw(ctx, 844, 390);
  const raceRoot = editor.buttons.find((button) => button.id === 'race');
  assert.ok(raceRoot);
  editor.handlePointerDown({
    x: raceRoot.bounds.x + raceRoot.bounds.w / 2,
    y: raceRoot.bounds.y + raceRoot.bounds.h / 2
  });

  editor.draw(ctx, 844, 390);
  assert.equal(editor.mobileRootOpen, false);
  assert.equal(editor.gamepadSubmenuOpen, true);
  assert.ok(editor.buttons.some((button) => button.id === 'draw-road' && button.bounds.x < 380));
  assert.equal(editor.buttons.some((button) => button.id === 'draw-road' && button.bounds.x > 600), false);
  assert.equal(editor.buttons.some((button) => button.id === 'menu' && button.bounds.x < 120), false);
  assert.equal(editor.buttons.some((button) => button.id === 'file' && button.bounds.x < 120), false);
  assert.ok(editor.buttons.some((button) => button.id === 'generate-random-race' && button.bounds.x < 380));
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
  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.gamepadSubmenuOpen, false);

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
  assert.equal(editor.buttons.some((button) => button.id === 'menu' && button.bounds.x < 120), false);
  assert.equal(editor.buttons.some((button) => button.id === 'test-drive' && button.bounds.x < 120), false);
});

test('Race and Car gamepad submenus render from the shared slide-out plan items', () => {
  const drawLandscapeIndex = raceEditorSource.indexOf('  drawLandscape(ctx, width, height)');
  const drawLandscapeBody = raceEditorSource.slice(
    drawLandscapeIndex,
    raceEditorSource.indexOf('  drawRaceHandheldShell(ctx, layout)', drawLandscapeIndex)
  );

  assert.ok(drawLandscapeIndex > 0);
  assert.equal(drawLandscapeBody.includes('const menuPlan = buildGamepadSlideOutMenuPlan(this.editorId,'), true);
  assert.equal(drawLandscapeBody.includes('focusedItemId: this.gamepadFocusedItemId || null'), true);
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
  assert.equal(submenuBody.includes('focused: gamepad && item.id === this.gamepadFocusedItemId'), true);
  assert.equal(submenuBody.includes('if (gamepad) this.gamepadFocusedItemId = item.id;'), true);
  assert.equal(submenuBody.includes('y: bounds.y + 50'), true);
  assert.equal(submenuBody.includes('drawSharedGamepadSlideOutHeader(ctx, bounds, title, { hint: headerHint || undefined })'), true);
  assert.equal(submenuBody.includes('this.drawActionRows(ctx, listBounds,'), true);
});

test('Race and Car gamepad rows forward focused state into shared button chrome', () => {
  const drawButtonIndex = raceEditorSource.indexOf('  drawButton(ctx, bounds, label, active = false, disabled = false, options = {})');
  const drawButtonBody = raceEditorSource.slice(
    drawButtonIndex,
    raceEditorSource.indexOf('  draw(ctx, width, height)', drawButtonIndex)
  );
  const registerIndex = raceEditorSource.indexOf('  registerDrawnButton(ctx, bounds, action)');
  const registerBody = raceEditorSource.slice(
    registerIndex,
    raceEditorSource.indexOf('  registerRaceTileButton(ctx, bounds, action)', registerIndex)
  );

  assert.ok(drawButtonIndex > 0);
  assert.equal(drawButtonBody.includes('focused: Boolean(options.focused)'), true);
  assert.equal(registerBody.includes('focused: Boolean(action.focused)'), true);
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
  assert.equal(editor.gamepadSubmenuOpen, false);
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
    { mode: 'race', from: 'file', to: 'race', expectedAction: 'draw-road' },
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
  assert.equal(raceEditorSource.includes('if (this.isDesktopMode() && !payload.touchCount) {\n      const hover = resolveDesktopDropdownHoverSwitch({'), true);
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

test('Race desktop playtest HUD controls activate on release only', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 1280, 800);
  const pause = editor.buttons.find((button) => button.id === 'race-pause-return-editor');
  assert.ok(pause);
  editor.handlePointerDown({
    x: pause.bounds.x + pause.bounds.w / 2,
    y: pause.bounds.y + pause.bounds.h / 2
  });
  assert.ok(editor.playtestSession);
  assert.ok(editor.pendingDesktopCommandHit);
  editor.handlePointerUp({
    x: pause.bounds.x + pause.bounds.w / 2,
    y: pause.bounds.y + pause.bounds.h / 2
  });
  assert.equal(editor.playtestSession, null);

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 1280, 800);
  const secondPause = editor.buttons.find((button) => button.id === 'race-pause-return-editor');
  assert.ok(secondPause);
  editor.handlePointerDown({
    x: secondPause.bounds.x + secondPause.bounds.w / 2,
    y: secondPause.bounds.y + secondPause.bounds.h / 2
  });
  editor.handlePointerMove({
    x: secondPause.bounds.x + secondPause.bounds.w + 30,
    y: secondPause.bounds.y + secondPause.bounds.h + 30
  });
  editor.handlePointerUp({
    x: secondPause.bounds.x + secondPause.bounds.w + 30,
    y: secondPause.bounds.y + secondPause.bounds.h + 30
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
  assert.equal(raceEditorSource.includes("return this.activeViewportMode === 'desktop';"), true);
  assert.equal(raceEditorSource.includes('if (this.isDesktopMode() && this.desktopDropdown && shouldCloseDesktopDropdownOnPointerDown({'), true);
});

test('Race Editor file menu keeps unavailable scaffold rows disabled', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const carEditor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  const fileItems = editor.getMenuItems('file');
  const carFileItems = carEditor.getMenuItems('file');

  assert.equal(raceEditorSource.includes('buildSharedEditorFileMenu'), true);
  assert.equal(raceEditorSource.includes("footer: {\n          onExit: () => this.exitToMainMenu()\n        }"), true);
  assert.deepEqual(fileItems.slice(0, 6).map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import']);
  assert.deepEqual(carFileItems.map((item) => item.id), fileItems.map((item) => item.id));
  assert.equal(fileItems.find((item) => item.id === 'new')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'save')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'save-as')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'open')?.disabled, true);
  assert.equal(fileItems.find((item) => item.id === 'export')?.disabled, true);
  assert.equal(fileItems.find((item) => item.id === 'import')?.disabled, true);
  assert.equal(fileItems.at(-1)?.id, 'exit-main');
  assert.equal(fileItems.at(-1)?.label, 'Exit to Main Menu');
  assert.equal(fileItems.find((item) => item.id === 'exit-main')?.disabled, false);
  assert.equal(typeof fileItems.find((item) => item.id === 'exit-main')?.onSelect, 'function');
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

  const openButton = editor.buttons.find((button) => button.id === 'open');
  assert.ok(openButton);
  assert.equal(openButton.disabled, true);
  assert.equal(openButton.onClick, null);
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

test('Race Editor fitting action rows still register drag-safe menu regions', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  const actions = [
    { id: 'fit-a', label: 'Fit A', onClick() {} },
    { id: 'fit-b', label: 'Fit B', onClick() {} }
  ];

  editor.drawActionRows(ctx, { x: 0, y: 0, w: 180, h: 110 }, actions, 1, { scrollKey: 'fit-scroll' });
  const region = editor.menuScrollRegions.find((entry) => entry.menuId === 'fit-scroll');
  assert.ok(region);
  assert.equal(region.maxScroll, 0);
});

test('Race Editor implemented scaffold commands mutate project state', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });

  editor.handleMenuAction('drivetrain-awd');
  assert.equal(editor.selectedCar.tuning.drivetrain, 'awd');

  editor.handleMenuAction('engine-sound-next');
  assert.equal(editor.selectedCar.audio.engineProfile, 'brz-flat-four-manual');
  assert.equal(editor.status, 'Engine sound: BRZ Manual');

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

  assert.equal(editor.selectedRace.road.width, 11);
  assert.equal(editor.getRaceRoadHalfWidthWorld() <= 34.5, true);
  assert.equal(editor.getRaceRoadHalfWidthWorld() >= 33.2, true);
  assert.equal(editor.getRaceThirdPersonCarWidth({ w: 390, h: 240 }) >= 28, true);
  assert.equal(editor.getRaceThirdPersonCarWidth({ w: 390, h: 240 }) <= 44, true);
  assert.equal(editor.getRaceCarWorldWidth() > 1.7, true);
  const marker = editor.getRaceLaneMarkerDimensionsWorld();
  assert.equal(Math.abs(marker.dashLength / marker.interval - 0.25) < 0.001, true);
  assert.equal(marker.dashWidth < editor.getRaceCarWorldWidth() * 0.08, true);
});

test('Race playtest projection keeps near lane scale close to car width', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 60;
  editor.playtestSession.elapsedMs = 2000;
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const travel = editor.playtestSession.distance;
  const camera = editor.getRaceWorldPoseAtDistance(travel);
  camera.x = editor.playtestSession.worldX;
  camera.z = editor.playtestSession.worldZ;
  camera.yaw = editor.playtestSession.carYaw;
  camera.horizonRatio = 0.25;
  camera.roadDepthRatio = 0.56;
  camera.focalScale = 1.08;
  camera.roadWidthScale = 2.82;
  const near = editor.getRaceRoadCrossSectionAtDistance(travel + 12);
  const projectedLeft = editor.projectRaceWorldPointToCamera(near.left, camera, editor.playtestSession.cameraYaw, bounds);
  const projectedRight = editor.projectRaceWorldPointToCamera(near.right, camera, editor.playtestSession.cameraYaw, bounds);
  const roadWidth = Math.abs(projectedRight.screenX - projectedLeft.screenX);
  const carWidth = editor.getRaceThirdPersonCarWidth(bounds);
  const laneWidth = roadWidth / 2;

  assert.equal(roadWidth < bounds.w * 2.72, true);
  assert.equal(roadWidth > carWidth * 3.2, true);
  assert.equal(carWidth / laneWidth > 0.055, true);
  assert.equal(carWidth / laneWidth < 0.5, true);
});

test('Race playtest widens roads and damps high-speed steering', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');

  assert.equal(editor.getRaceRoadHalfWidthWorld() >= 27.5, true);
  assert.equal(editor.getRaceMaxSteerForSpeed(0), 1);
  assert.equal(editor.getRaceMaxSteerForSpeed(70) >= 0.25, true);
  assert.equal(editor.getRaceMaxSteerForSpeed(70) <= 0.27, true);
  assert.equal(editor.getRaceBinarySteerAssist(70).steeringAuthority <= 0.27, true);
  assert.equal(editor.getRaceBinarySteerAssist(70).response >= 84, true);
  assert.equal(editor.getRaceBinarySteerAssist(70).response < 96, true);
  assert.equal(editor.getRaceBinarySteerAssist(0).response > editor.getRaceBinarySteerAssist(70).response, true);
  assert.equal(editor.getRaceAnalogSteerResponse(0) > editor.getRaceAnalogSteerResponse(70), true);
  assert.equal(editor.getRaceTireSteerAngleForSpeed(0) > 0.5, true);
  assert.equal(editor.getRaceTireSteerAngleForSpeed(70) < 0.07, true);
  assert.equal(editor.getRaceTireSteerAngleForSpeed(70) < editor.getRaceTireSteerAngleForSpeed(20), true);
});

test('Race playtest steering is substantially damped at highway speed but full at launch', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });

  assert.equal(editor.getRaceMaxSteerForSpeed(0), 1);
  assert.equal(editor.getRaceBinarySteerAssist(0).maxSteer, 1);
  assert.equal(editor.getRaceBinarySteerAssist(45).maxSteer, 1);
  assert.equal(editor.getRaceMaxSteerForSpeed(27) > 0.6, true);
  assert.equal(editor.getRaceMaxSteerForSpeed(45) > 0.34, true);
  assert.equal(editor.getRaceMaxSteerForSpeed(45) < editor.getRaceMaxSteerForSpeed(27), true);
  assert.equal(editor.getRaceBinarySteerAssist(27).response > 54, true);
});

test('Race playtest sends tire screech audio only for physical tire slip', () => {
  const tireCalls = [];
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    audio: {
      setTireScreech(active, payload) {
        tireCalls.push({ active, payload });
      }
    },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.updateRaceTireAudio({ slip: editor.getRaceAudibleTireSlip({ slipAngle: 0.02, speedMps: 24 }), surface: 'asphalt', speedMps: 24 });
  editor.updateRaceTireAudio({ slip: editor.getRaceAudibleTireSlip({ slipAngle: 0.42, scrub: 0.4, speedMps: 24 }), surface: 'asphalt', speedMps: 24 });
  editor.updateRaceTireAudio({ slip: 0.7, surface: 'dirt', speedMps: 24 });

  assert.equal(tireCalls[0].active, false);
  assert.equal(tireCalls[1].active, true);
  assert.equal(tireCalls[1].payload.material, 'pavement');
  assert.equal(tireCalls[2].active, true);
  assert.equal(tireCalls[2].payload.material, 'dirt');
  assert.equal(raceEditorSource.includes('amount <= 0.02'), true);
  assert.equal(raceEditorSource.includes('getRaceAudibleTireSlip'), true);
});

test('Race playtest sends engine RPM to the audio rev model', () => {
  const revCalls = [];
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    audio: {
      setEngineRev(active, payload) {
        revCalls.push({ active, payload });
      }
    },
    exitRaceEditor() {}
  });
  editor.selectedCar.audio.engineProfile = 'race-v8';
  editor.startPlaytest('starter-rwd');
  editor.raceInput.activeThrottlePointerId = 1;
  editor.update(null, 0.25);

  const activeCall = revCalls.find((call) => call.active);
  assert.ok(activeCall);
  assert.equal(activeCall.payload.profile, 'race-v8');
  assert.equal(activeCall.payload.redlineRpm >= 6100, true);
  assert.equal(activeCall.payload.rpm > 850, true);
  assert.equal(activeCall.payload.throttle, 1);

  editor.endPlaytest();
  assert.equal(revCalls.at(-1).active, false);
});

test('Race playtest launch holds road-aligned yaw before steering takes over', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  const startPose = editor.getRaceWorldPoseAtDistance(0);
  assert.equal(editor.playtestSession.carYaw, startPose.yaw);
  assert.equal(editor.playtestSession.cameraYaw, startPose.yaw);
  editor.raceInput.binarySteer = 1;
  editor.raceInput.activeThrottlePointerId = 0;
  editor.updatePlaytest(0.12);

  assert.equal(editor.raceInput.gear, 1);
  assert.equal(Math.abs(editor.playtestSession.heading) < 0.001, true);
  assert.equal(editor.playtestSession.cameraYaw, editor.getRaceRoadYawAtDistance(editor.playtestSession.distance));
});

test('Race playtest starts on the first node facing the first route direction', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.nodes = [
    { x: 30, y: 40, elevation: 0 },
    { x: 90, y: 100, elevation: 0 },
    { x: 130, y: 100, elevation: 0 }
  ];
  editor.startPlaytest('starter-rwd');
  const startPose = editor.getRaceWorldPoseAtDistance(0);
  assert.equal(Math.abs(startPose.yaw - Math.atan2(60, 60)) < 0.001, true);
  const forwardX = Math.sin(startPose.yaw);
  const forwardZ = Math.cos(startPose.yaw);

  assert.equal(editor.playtestSession.carYaw, startPose.yaw);
  assert.equal(editor.playtestSession.cameraYaw, startPose.yaw);
  assert.equal(Math.abs(editor.playtestSession.worldX - startPose.x) < 0.001, true);
  assert.equal(Math.abs(editor.playtestSession.worldZ - startPose.z) < 0.001, true);
  assert.equal(editor.playtestSession.startBackDistance, 0);

  const beforeX = editor.playtestSession.worldX;
  const beforeZ = editor.playtestSession.worldZ;
  editor.raceInput.activeThrottlePointerId = 0;
  editor.updatePlaytest(0.25);
  const movedForward = (editor.playtestSession.worldX - beforeX) * forwardX
    + (editor.playtestSession.worldZ - beforeZ) * forwardZ;
  assert.equal(movedForward > 0, true);
});

test('Race playtest infers looped versus point-to-point routes from endpoint connection', () => {
  const loop = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  loop.selectedRace.type = 'destination';
  loop.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 120, y: 0, elevation: 0 },
    { x: 120, y: 90, elevation: 0 },
    { x: 0, y: 0, elevation: 0 }
  ];
  assert.equal(loop.getSelectedRaceRuntimeType(), 'circuit');
  loop.startPlaytest('starter-rwd');
  assert.equal(loop.playtestSession.routeRuntimeType, 'circuit');

  const destination = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  destination.selectedRace.type = 'circuit';
  destination.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 180, y: 30, elevation: 0 }
  ];
  assert.equal(destination.getSelectedRaceRuntimeType(), 'destination');
  destination.startPlaytest('starter-rwd');
  assert.equal(destination.playtestSession.routeRuntimeType, 'destination');

  const nearMiss = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  nearMiss.selectedRace.type = 'circuit';
  nearMiss.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 120, y: 0, elevation: 0 },
    { x: 120, y: 90, elevation: 0 },
    { x: 8, y: 0, elevation: 0 }
  ];
  assert.equal(nearMiss.getSelectedRaceRuntimeType(), 'destination');
});

test('Race playtest checkpoints advance in order from route nodes', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 160, elevation: 0 },
    { x: 90, y: 260, elevation: 0 },
    { x: 160, y: 360, elevation: 0, role: 'finish' }
  ];
  editor.startPlaytest('starter-rwd');

  const firstCheckpoint = editor.playtestSession.checkpointDistances[editor.playtestSession.checkpointIndex];
  editor.updateRaceCheckpointProgress({
    previousDistance: Math.max(0, firstCheckpoint - 5),
    nextDistance: firstCheckpoint + 5,
    routeAdvance: 10
  });

  assert.equal(editor.playtestSession.checkpointIndex > 1, true);
  assert.equal(editor.playtestSession.passedCheckpoints.length >= 1, true);
});

test('Race playtest circuit laps require all checkpoints before start wrap', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.type = 'circuit';
  editor.selectedRace.laps = 2;
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 160, elevation: 0 },
    { x: 120, y: 160, elevation: 0 },
    { x: 0, y: 0, elevation: 0, role: 'finish' }
  ];
  editor.startPlaytest('starter-rwd');
  const routeLength = editor.playtestSession.routeLength;

  editor.playtestSession.checkpointIndex = 1;
  editor.updateRaceCheckpointProgress({
    previousDistance: routeLength - 8,
    nextDistance: 5,
    routeAdvance: 13
  });
  assert.equal(editor.playtestSession.checkpointIndex < editor.playtestSession.checkpointCount, true);

  editor.playtestSession.checkpointIndex = editor.playtestSession.checkpointCount - 1;
  editor.updateRaceCheckpointProgress({
    previousDistance: routeLength - 8,
    nextDistance: 5,
    routeAdvance: 13
  });
  assert.equal(editor.playtestSession.checkpointIndex, editor.playtestSession.checkpointCount);
});

test('Race playtest HUD exposes one top pause return button and pause overlay menu', () => {
  let exited = false;
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() { exited = true; }
  });
  const ctx = createMockContext();
  editor.startPlaytest('starter-rwd');
  editor.drawRacePlaytestScreen(ctx, { x: 0, y: 0, w: 390, h: 260 });

  const pause = editor.buttons.find((button) => button.id === 'race-pause-return-editor');
  const returnButton = editor.buttons.find((button) => button.id === 'race-return-editor');
  const mainMenu = editor.buttons.find((button) => button.id === 'race-exit-main');
  assert.ok(pause);
  assert.equal(Boolean(returnButton), false);
  assert.equal(Boolean(mainMenu), false);
  assert.equal(pause.bounds.y <= 8, true);

  pause.onClick();
  assert.equal(editor.playtestSession, null);

  editor.startPlaytest('starter-rwd');
  editor.toggleRacePause();
  editor.drawRacePlaytestScreen(ctx, { x: 0, y: 0, w: 390, h: 260 });
  const resume = editor.buttons.find((button) => button.id === 'race-resume');
  const exit = editor.buttons.find((button) => button.id === 'race-exit-main');
  assert.ok(resume);
  assert.ok(exit);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === 'Return to Game'), true);
  exit.onClick();
  assert.equal(exited, true);
});

test('Race playtest minimap renders a directional car shape instead of a dot', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.startPlaytest('starter-rwd');

  editor.drawRaceTrackMinimap(ctx, { x: 0, y: 0, w: 96, h: 96 });

  assert.equal(raceEditorSource.includes('drawRaceMinimapCar(ctx, player, Number(session.carYaw || 0), scale);'), true);
  assert.equal(raceEditorSource.includes('const nose = { x: player.x + forward.x * size * 1.02'), true);
  assert.equal(raceEditorSource.includes('forward.x * size * 1.36'), true);
  assert.equal(raceEditorSource.includes('frontLeft.x, y: frontLeft.y'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'lineTo'), true);
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

  editor.drawRaceStartFinishCheckerStripes(ctx, bounds, {
    camera,
    cameraYaw: editor.playtestSession.cameraYaw,
    travel: editor.playtestSession.distance,
    routeLength: editor.playtestSession.routeLength
  });

  assert.equal(ctx.calls.filter((call) => call.type === 'fill').length >= 10, true);
});

test('Race playtest renders a finish-line checker stripe for destination routes', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 0, y: 260, elevation: 0 },
    { x: 80, y: 420, elevation: 0 }
  ];
  editor.startPlaytest('starter-rwd');
  const ctx = createMockContext();
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const routeLength = editor.playtestSession.routeLength;
  editor.playtestSession.distance = Math.max(0, routeLength - 80);
  const camera = editor.getRaceWorldPoseAtDistance(editor.playtestSession.distance);
  camera.horizonRatio = 0.31;
  camera.roadDepthRatio = 0.66;
  camera.focalScale = 1.04;
  camera.roadWidthScale = 2.06;

  editor.drawRaceStartFinishCheckerStripes(ctx, bounds, {
    camera,
    cameraYaw: camera.yaw,
    travel: editor.playtestSession.distance,
    routeLength
  });

  assert.equal(ctx.calls.filter((call) => call.type === 'fill').length >= 10, true);
  assert.equal(raceEditorSource.includes('visualWidthMultiplier: visualRoadWidthMultiplier'), true);
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

test('Race playtest renderer projects a continuous world-space road path through camera yaw', () => {
  assert.equal(raceEditorSource.includes('const steeringCamera ='), false);
  assert.equal(raceEditorSource.includes('this.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud });'), true);
  assert.equal(raceEditorSource.includes('getRacePathSamples({ step = 18 } = {})'), true);
  assert.equal(raceEditorSource.includes('getRaceWorldPoseAtDistance(distance = 0, {'), true);
  assert.equal(raceEditorSource.includes('samples: providedSamples = null,'), true);
  assert.equal(raceEditorSource.includes('getRaceRoadCrossSectionAtDistance(distance = 0, {'), true);
  assert.equal(raceEditorSource.includes('visualWidthMultiplier = 1,'), true);
  assert.equal(raceEditorSource.includes('projectRaceWorldPointToCamera(point = {}, camera = {}, cameraYaw = 0, bounds = {})'), true);
  assert.equal(raceEditorSource.includes('const rightX = Math.cos(cameraYaw);'), true);
  assert.equal(raceEditorSource.includes('const forwardX = Math.sin(cameraYaw);'), true);
  assert.equal(raceEditorSource.includes('const launchAligning = launchLockActive || (Number(this.playtestSession.elapsedMs || 0) <= 120 && absSpeed < 0.8);'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.carYaw = launchAligning'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.worldX = Number(this.playtestSession.worldX || 0)'), true);
  assert.equal(raceEditorSource.includes('x: Number.isFinite(session?.worldX) ? session.worldX : routeCamera.x,'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.cameraYaw = this.playtestSession.carYaw;'), true);
  assert.equal(raceEditorSource.includes('const cameraYaw = Number(session?.cameraYaw ?? camera.yaw);'), true);
  assert.equal(raceEditorSource.includes('getRaceRenderSampleDistances({'), true);
  assert.equal(raceEditorSource.includes('const sampleDistances = this.getRaceRenderSampleDistances({'), false);
  assert.equal(raceEditorSource.includes('getRaceMode7DepthSlices({'), true);
  assert.equal(raceEditorSource.includes('const mode7Slices = this.getRaceMode7DepthSlices({'), true);
  assert.equal(raceEditorSource.includes('Math.pow(t, 1.46)'), true);
  assert.equal(raceEditorSource.includes('point.distance = rawDistance;'), true);
  assert.equal(raceEditorSource.includes('drawRaceParallaxBackground(ctx, bounds'), true);
  assert.equal(raceEditorSource.includes('const sampleDirection = this.getRaceCameraRouteSampleDirection'), false);
  assert.equal(raceEditorSource.includes('getRaceProjectedRoadQuads(crossSections = [])'), true);
  assert.equal(raceEditorSource.includes('const crossSections = [];'), false);
  assert.equal(raceEditorSource.includes('const roadQuads = this.getRaceProjectedRoadQuads(crossSections);'), false);
  assert.equal(raceEditorSource.includes('const mode7Bands = this.getRaceMode7RoadBands(mode7Slices);'), true);
  assert.equal(raceEditorSource.includes('shoulderLeft: this.projectRaceWorldPointToCamera(section.shoulderLeft'), true);
  assert.equal(raceEditorSource.includes('ctx.moveTo(far.left.screenX, far.left.screenY);'), true);
  assert.equal(raceEditorSource.includes('drawRaceTrackMinimap(ctx'), true);
});

test('Race playtest depth-sorts continuous road bands before drawing road over terrain', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const makeSection = (cameraZ, distance, visible = true) => ({
    center: { visible, cameraZ, distance },
    left: { visible, cameraZ, screenX: 80 - cameraZ, screenY: 200 - cameraZ },
    right: { visible, cameraZ, screenX: 180 + cameraZ, screenY: 200 - cameraZ }
  });

  const quads = editor.getRaceProjectedRoadQuads([
    makeSection(8, 10),
    makeSection(32, 30),
    makeSection(14, 50),
    makeSection(1, 70),
    makeSection(42, 90, false)
  ]);

  assert.deepEqual(quads.map((quad) => quad.index), [1, 0]);
  assert.equal(quads.every((quad) => quad.minZ > 2), true);
  assert.equal(quads[0].avgZ > quads[1].avgZ, true);

  const firstGroundPass = raceEditorSource.indexOf('const mode7Bands = this.getRaceMode7RoadBands(mode7Slices);');
  const roadPass = raceEditorSource.indexOf('for (const quad of mode7Bands) {\n      const { near, far } = quad;');
  const markerCall = raceEditorSource.indexOf('this.drawRaceContinuousDistanceMarkers(ctx, bounds, {');
  assert.equal(firstGroundPass >= 0, true);
  assert.equal(roadPass > firstGroundPass, true);
  assert.equal(markerCall > roadPass, true);
});

test('Race playtest rejects invalid projected road bands before drawing', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const section = (cameraZ, leftX, rightX, y) => ({
    center: { visible: true, cameraZ, distance: cameraZ },
    left: { visible: true, cameraZ, screenX: leftX, screenY: y },
    right: { visible: true, cameraZ, screenX: rightX, screenY: y }
  });

  const valid = editor.getRaceProjectedRoadQuads([
    section(8, 80, 180, 210),
    section(26, 110, 150, 130)
  ]);
  const invalid = editor.getRaceProjectedRoadQuads([
    section(8, 130, 130.5, 210),
    section(26, 130, 130.5, 130)
  ]);

  assert.equal(valid.length, 1);
  assert.equal(invalid.length, 0);
  assert.equal(raceEditorSource.includes('getRaceProjectedQuadArea(quad = null)'), true);
  assert.equal(raceEditorSource.includes('Math.sin(travel * 0.055)'), false);
});

test('Race Mode 7 playtest depth slices keep unrounded continuous distance phase', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.segments = [
    { length: 900, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    ...editor.getRaceWorldPoseAtDistance(120),
    horizonRatio: 0.32,
    roadElevation: 0,
    eyeHeight: editor.getRaceCameraEyeHeight('third-person'),
    elevation: editor.getRaceCameraEyeHeight('third-person'),
    nearPlane: 0.85,
    roadDepthRatio: 0.62,
    focalScale: 1,
    roadWidthScale: 4.8,
    roadMaxWidthRatio: 0.52,
    distance: 120
  };

  const slices = editor.getRaceMode7DepthSlices({
    bounds,
    camera,
    cameraYaw: camera.yaw,
    visualTravel: 120.37,
    routeLength: 900,
    routeRuntimeType: 'destination',
    nearDistance: 3.4,
    viewDistance: 580,
    visualRoadWidthMultiplier: 0.58,
    sliceCount: 80
  });

  assert.equal(slices.length > 50, true);
  assert.equal(slices.every((slice, index) => index === 0 || slice.center.distance > slices[index - 1].center.distance), true);
  assert.equal(slices.some((slice) => Math.abs(slice.center.distance - Math.round(slice.center.distance)) > 0.001), true);
  assert.equal(slices.every((slice) => Number.isFinite(slice.center.routeDistance)), true);
  assert.equal(editor.getRaceMode7DepthSlices({
    bounds,
    camera,
    cameraYaw: camera.yaw,
    visualTravel: 120.37,
    routeLength: 900,
    routeRuntimeType: 'destination',
    nearDistance: 3.4,
    viewDistance: 580,
    visualRoadWidthMultiplier: 0.58
  }).length > 120, true);
  assert.equal(raceEditorSource.includes('return bands.sort((a, b) => b.avgZ - a.avgZ || b.maxZ - a.maxZ || b.index - a.index);'), true);
});

test('Race Mode 7 markers interpolate smoothly between projected depth slices', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const slices = [
    {
      center: { distance: 100, screenX: 200, screenY: 210, segment: { surface: 'asphalt' } },
      left: { screenX: 120, screenY: 210 },
      right: { screenX: 280, screenY: 210 }
    },
    {
      center: { distance: 112.192, screenX: 202, screenY: 180, segment: { surface: 'asphalt' } },
      left: { screenX: 145, screenY: 180 },
      right: { screenX: 259, screenY: 180 }
    }
  ];

  const first = editor.getRaceInterpolatedMarkerSlice(slices, 104);
  const second = editor.getRaceInterpolatedMarkerSlice(slices, 104.4);

  assert.equal(first.center.screenY > second.center.screenY, true);
  assert.equal(Math.abs(first.center.screenY - second.center.screenY) < 2, true);
  assert.equal(raceEditorSource.includes('drawRaceContinuousDistanceMarkers(ctx, bounds'), true);
});

test('Race Mode 7 markers draw road-aligned lane dash quads', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();
  const slices = [
    {
      center: { distance: 100, screenX: 200, screenY: 210, segment: { surface: 'asphalt' } },
      left: { screenX: 120, screenY: 210 },
      right: { screenX: 280, screenY: 210 }
    },
    {
      center: { distance: 112.192, screenX: 212, screenY: 178, segment: { surface: 'asphalt' } },
      left: { screenX: 155, screenY: 184 },
      right: { screenX: 269, screenY: 172 }
    },
    {
      center: { distance: 124.384, screenX: 226, screenY: 152, segment: { surface: 'asphalt' } },
      left: { screenX: 188, screenY: 158 },
      right: { screenX: 264, screenY: 146 }
    }
  ];

  editor.drawRaceContinuousDistanceMarkers(ctx, { x: 0, y: 0, w: 390, h: 240 }, { slices });

  assert.equal(ctx.calls.some((call) => call.type === 'beginPath'), true);
  assert.equal(ctx.calls.filter((call) => call.type === 'lineTo').length >= 3, true);
  assert.equal(raceEditorSource.includes('drawRaceProjectedLaneDash(ctx, startMarker, endMarker, markerW);'), true);
  assert.equal(raceEditorSource.includes('fillRect(marker.center.screenX - markerW / 2'), false);
});

test('Race Mode 7 renderer reuses sampled route geometry across depth slices', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  seedEditableRaceRoute(editor);
  const originalGetRacePathSamples = editor.getRacePathSamples.bind(editor);
  let sampleCalls = 0;
  editor.getRacePathSamples = (options) => {
    sampleCalls += 1;
    return originalGetRacePathSamples(options);
  };
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    ...editor.getRaceWorldPoseAtDistance(10),
    horizonRatio: 0.32,
    roadElevation: 0,
    eyeHeight: editor.getRaceCameraEyeHeight('third-person'),
    elevation: editor.getRaceCameraEyeHeight('third-person'),
    nearPlane: 1.2,
    roadDepthRatio: 0.62,
    focalScale: 1,
    roadWidthScale: 4.8,
    roadMaxWidthRatio: 0.52,
    distance: 10
  };
  sampleCalls = 0;

  const slices = editor.getRaceMode7DepthSlices({
    bounds,
    camera,
    cameraYaw: camera.yaw,
    visualTravel: 10,
    routeLength: editor.getRaceRouteLength(),
    routeRuntimeType: 'destination',
    nearDistance: 3,
    viewDistance: 520,
    visualRoadWidthMultiplier: 0.58,
    sliceCount: 120
  });

  assert.equal(slices.length > 40, true);
  assert.equal(sampleCalls <= 2, true);
  assert.equal(raceEditorSource.includes('getRacePathSamplesCached({ step: 10 })'), true);
  assert.equal(raceEditorSource.includes('getRaceSampleSpanAtDistance(samples, target)'), true);
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
  assert.equal(Math.abs(editor.playtestSession.heading) > 0.001, true);
});

test('Race playtest car position is free-moving instead of snapped to route progress', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.segments = [
    { length: 300, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest(editor.selectedCar.id);
  editor.playtestSession.speedMps = 18;
  editor.playtestSession.carYaw = Math.PI / 2;
  editor.playtestSession.velocityYaw = Math.PI / 2;
  editor.playtestSession.cameraYaw = Math.PI / 2;
  editor.raceInput.steeringTarget = 0;
  editor.raceInput.steeringWheel = 0;

  editor.updatePlaytest(0.4);

  const routePose = editor.getRaceWorldPoseAtDistance(editor.playtestSession.distance);
  assert.equal(Math.abs(editor.playtestSession.worldX - routePose.x) > 2, true);
  assert.equal(editor.playtestSession.cameraYaw, editor.playtestSession.carYaw);
});

test('Race playtest route progress advances from car heading instead of nearest-point snap', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.segments = [
    { length: 300, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest(editor.selectedCar.id);
  editor.playtestSession.speedMps = 20;
  editor.playtestSession.carYaw = Math.PI / 2;
  editor.playtestSession.velocityYaw = Math.PI / 2;
  editor.playtestSession.cameraYaw = Math.PI / 2;
  editor.raceInput.steeringTarget = 0;
  editor.raceInput.steeringWheel = 0;

  editor.updatePlaytest(0.5);

  assert.equal(editor.playtestSession.worldX > 8, true);
  assert.equal(editor.playtestSession.projectedDistance < 2, true);
  assert.equal(editor.playtestSession.distance < 2, true);
  assert.equal(raceEditorSource.includes('const progressHeading = normalizeAngle(this.playtestSession.velocityYaw - progressRoadYaw);'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.distance = clamp(integratedDistance, 0, routeLength);'), true);
});

test('Race playtest high-speed steering preserves momentum and scrubs speed instead of spinning 180 degrees', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.segments = [
    { length: 1200, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 90 * 0.44704;
  editor.playtestSession.carYaw = 0;
  editor.playtestSession.velocityYaw = 0;
  editor.playtestSession.cameraYaw = 0;
  editor.playtestSession.worldX = 0;
  editor.playtestSession.worldZ = 0;
  editor.raceInput.binarySteer = 1;

  for (let frame = 0; frame < 120; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(Math.abs(editor.playtestSession.carYaw) < Math.PI * 0.65, true);
  assert.equal(Math.abs(editor.playtestSession.velocityYaw) < Math.abs(editor.playtestSession.carYaw), true);
  assert.equal(editor.playtestSession.speedMps < 90 * 0.44704 - 2, true);
  assert.equal(Math.abs(editor.playtestSession.worldX) > 6, true);
  assert.equal(editor.playtestSession.worldZ > 35, true);
  assert.equal(editor.playtestSession.tireSlip.scrub > 0, true);
  assert.equal(editor.playtestSession.tireSlip.slipAngle > 0.05, true);
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

  const routeSamples = editor.getRacePathSamples({ step: 10 });
  assert.equal(Math.max(...routeSamples.map((sample) => Math.abs(sample.yaw))) > Math.PI * 1.2, true);

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

test('Race playtest route sampler keeps local road samples behind and ahead of travel', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  const destinationSamples = editor.getRaceRenderSampleDistances({
    visualTravel: 300,
    routeLength: 900,
    routeRuntimeType: 'destination',
    nearDistance: 3,
    viewDistance: 620
  });

  assert.equal(destinationSamples.some((distance) => distance < 300), true);
  assert.equal(destinationSamples.some((distance) => distance > 300), true);
  assert.equal(destinationSamples.every((distance) => distance >= 0 && distance <= 900), true);

  const circuitSamples = editor.getRaceRenderSampleDistances({
    visualTravel: 20,
    routeLength: 900,
    routeRuntimeType: 'circuit',
    nearDistance: 3,
    viewDistance: 620
  });

  assert.equal(circuitSamples.some((distance) => distance > 780), true);
  assert.equal(circuitSamples.some((distance) => distance < 80), true);
});

test('Race road cross sections include projected shoulder terrain outside the road', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const section = editor.getRaceRoadCrossSectionAtDistance(80);
  const roadHalfWidth = Math.hypot(
    Number(section.left.x || 0) - Number(section.center.x || 0),
    Number(section.left.z || 0) - Number(section.center.z || 0)
  );
  const shoulderHalfWidth = Math.hypot(
    Number(section.shoulderLeft.x || 0) - Number(section.center.x || 0),
    Number(section.shoulderLeft.z || 0) - Number(section.center.z || 0)
  );

  assert.equal(shoulderHalfWidth > roadHalfWidth + 50, true);
  assert.equal(Number.isFinite(section.shoulderLeft.elevation), true);
  assert.equal(Number.isFinite(section.shoulderRight.elevation), true);
});

test('Race playtest destination routes finish instead of wrapping', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.segments = [
    { length: 100, curve: 0.8, elevation: 0, surface: 'asphalt', turn: 'square', hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');
  const nearFinish = editor.getRaceWorldPoseAtDistance(99);
  editor.playtestSession.distance = 99;
  editor.playtestSession.worldX = nearFinish.x;
  editor.playtestSession.worldZ = nearFinish.z;
  editor.playtestSession.carYaw = nearFinish.yaw;
  editor.playtestSession.cameraYaw = nearFinish.yaw;
  editor.playtestSession.speedMps = 30;
  editor.raceInput.gear = 1;
  editor.raceInput.throttle = true;

  for (let i = 0; i < 5; i += 1) editor.update(null, 0.5);

  assert.equal(editor.playtestSession, null);
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
  assert.equal(editor.selectedRace.road.width, 12);

  editor.handleMenuAction('surface-snow');
  assert.equal(editor.selectedSegment.surface, 'snow');
});

test('Race Editor generates a random point-to-point race that can be playtested', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const originalRandom = Math.random;
  const values = [0.55, 0.1, 0.82, 0.33, 0.74, 0.18, 0.92, 0.41];
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
  assert.equal(editor.selectedRace.road.nodes.length >= editor.selectedRace.road.segments.length + 1, true);
  assert.match(editor.status, /Generated/);

  editor.startPlaytest('starter-rwd');
  assert.equal(editor.playtestSession.routeLength > 1000, true);
});

test('Race Editor segment elevation samples continuously instead of resetting per segment', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [];
  editor.selectedRace.road.segments = [
    { length: 120, curve: 0, elevation: 0.3, surface: 'asphalt' },
    { length: 120, curve: 0, elevation: 0.28, surface: 'gravel' },
    { length: 120, curve: 0, elevation: -0.18, surface: 'snow' }
  ];

  const samples = editor.getRacePathSamples({ step: 12 });
  for (let index = 1; index < samples.length; index += 1) {
    const jump = Math.abs(Number(samples[index].elevation || 0) - Number(samples[index - 1].elevation || 0));
    assert.equal(jump < 0.06, true);
  }
  const secondStart = samples.find((sample) => sample.index === 1 && sample.progress < 0.12);
  assert.ok(secondStart);
  assert.equal(secondStart.elevation > 0.16, true);
});

test('Race Editor smooths crest and bump samples before hard turns', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [];
  editor.selectedRace.road.segments = [
    { length: 90, curve: 0.2, elevation: 0.32, surface: 'asphalt', bumpiness: 0.35 },
    { length: 85, curve: 1, elevation: 0.08, surface: 'asphalt', turn: 'square', bumpiness: 0.72 },
    { length: 105, curve: -0.45, elevation: -0.22, surface: 'gravel', bumpiness: 0.5 }
  ];

  const samples = editor.getRacePathSamples({ step: 18 });
  let maxElevationJump = 0;
  let maxYawJump = 0;
  for (let index = 1; index < samples.length; index += 1) {
    maxElevationJump = Math.max(maxElevationJump, Math.abs(Number(samples[index].elevation || 0) - Number(samples[index - 1].elevation || 0)));
    maxYawJump = Math.max(maxYawJump, Math.abs(normalizeAngle(samples[index].yaw - samples[index - 1].yaw)));
  }

  assert.equal(samples.length >= 42, true);
  assert.equal(maxElevationJump < 0.045, true);
  assert.equal(maxYawJump < 0.2, true);
  assert.equal(raceEditorSource.includes('smoothRacePathSamples(samples = [], { passes = 2 } = {})'), true);
});

test('Race Editor explicit turn kinds map to readable route angles', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  assert.equal(Math.abs(editor.getRaceSegmentYawDelta({ curve: 1, turn: 'square' }) - Math.PI / 2) < 0.0001, true);
  assert.equal(Math.abs(editor.getRaceSegmentYawDelta({ curve: -1, turn: 'junction' }) + Math.PI / 2) < 0.0001, true);
  assert.equal(Math.abs(editor.getRaceSegmentYawDelta({ curve: 0.7, turn: 'angled' }) - Math.PI / 4) < 0.0001, true);
  assert.equal(Math.abs(editor.getRaceSegmentYawDelta({ curve: 1 }) - 0.78) < 0.0001, true);
});

test('Race Editor random generator can create inferred closed ovals and severe rally stages', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const originalRandom = Math.random;

  let values = [0.01, 0.3, 0.15, 0.44, 0.62, 0.22, 0.51, 0.18];
  let index = 0;
  Math.random = () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
  try {
    editor.handleMenuAction('generate-random-race');
    assert.equal(editor.getSelectedRaceRuntimeType(), 'circuit');
    assert.equal(editor.isSelectedRaceLoopClosed(), true);
    assert.equal(editor.selectedRace.road.width >= 20, true);
    assert.equal(editor.selectedRace.road.segments.every((segment) => segment.surface === 'asphalt'), true);

    values = [0.99, 0.9, 0.74, 0.31, 0.93, 0.66, 0.81, 0.24, 0.57];
    index = 0;
    editor.handleMenuAction('generate-random-race');
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(editor.getSelectedRaceRuntimeType(), 'destination');
  assert.equal(editor.selectedRace.road.width <= 8, true);
  assert.equal(['rain', 'storm', 'snow'].includes(editor.selectedRace.weather), true);
  assert.equal(editor.selectedRace.road.segments.some((segment) => ['snow', 'gravel', 'dirt'].includes(segment.surface)), true);
  assert.equal(editor.selectedRace.road.segments.some((segment) => Number(segment.bumpiness || 0) >= 0.28), true);
  assert.equal(editor.selectedRace.road.nodes.length >= editor.selectedRace.road.segments.length + 1, true);
  assert.equal(editor.selectedRace.road.segments.some((segment) => ['square', 'angled', 'junction'].includes(segment.turn)), true);
  assert.equal(raceEditorSource.includes("segment.turn === 'junction'"), true);
  assert.equal(raceEditorSource.includes("segment.turn === 'angled'"), true);
});

test('Race Editor generator checks generated routes for self-intersection', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const crossingNodes = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
    { x: 20, y: -20 }
  ];
  const cleanNodes = [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 0 }
  ];

  assert.equal(editor.doRaceRouteSegmentsIntersect({ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }), true);
  assert.equal(editor.doesRaceRouteSelfIntersect(crossingNodes), true);
  assert.equal(editor.doesRaceRouteSelfIntersect(cleanNodes), false);
  assert.equal(raceEditorSource.includes('for (let attempt = 0; attempt < 5 && this.doesRaceRouteSelfIntersect(generatedNodes); attempt += 1)'), true);
  assert.equal(raceEditorSource.includes('width: 7.6'), true);
  assert.equal(raceEditorSource.includes('width: 7.4'), true);
});

test('Race Editor generate keeps authoring menus reachable after rebuilding a route', () => {
  const portrait = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  portrait.draw(createMockContext(), 390, 844);
  portrait.handleMenuAction('generate-random-race');

  assert.equal(portrait.activeRootId, 'race');
  assert.equal(portrait.racePortraitMode, 'race');
  assert.equal(portrait.raceSelectionType, 'edge');
  assert.equal(portrait.mobileRootOpen, true);
  assert.equal(portrait.gamepadSubmenuOpen, false);

  const gamepad = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: {
      isGamepadConnected: () => true,
      gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 }
    },
    exitRaceEditor() {}
  });
  gamepad.draw(createMockContext(), 844, 390);
  gamepad.handleMenuAction('generate-random-race');

  assert.equal(gamepad.activeRootId, 'race');
  assert.equal(gamepad.mobileRootOpen, false);
  assert.equal(gamepad.gamepadSubmenuOpen, true);
});

test('Race Editor Race menu loads built-in test tracks', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const raceMenuIds = editor.getMenuItems('race').map((item) => item.id);

  assert.deepEqual(raceMenuIds.slice(6, 11), [
    'load-weathertech-raceway',
    'load-nurburgring-nordschleife',
    'load-col-de-turini',
    'load-ouninpohja',
    'load-daytona-tri-oval'
  ]);

  editor.project.races = editor.project.races.slice(0, 1);
  editor.project.selectedRaceId = 'test-loop';
  editor.handleMenuAction('load-col-de-turini');

  assert.equal(editor.project.selectedRaceId, 'col-de-turini');
  assert.equal(editor.selectedRace.name, 'Col de Turini');
  assert.equal(editor.selectedRace.weather, 'snow');
  assert.equal(editor.selectedRace.road.segments.some((segment) => segment.surface === 'snow'), true);
  assert.equal(editor.selectedRace.road.segments.length >= 30, true);
  assert.equal(Math.max(...editor.selectedRace.road.segments.map((segment) => segment.length)) < 1700, true);
  assert.equal(editor.selectedRace.road.segments.filter((segment) => segment.turn === 'square').length >= 24, true);
  assert.match(editor.status, /Loaded Col de Turini/);

  const countAfterInsert = editor.project.races.length;
  editor.handleMenuAction('load-col-de-turini');
  assert.equal(editor.project.races.length, countAfterInsert);

  editor.handleMenuAction('load-daytona-tri-oval');
  assert.equal(editor.project.selectedRaceId, 'daytona-tri-oval');
  assert.equal(editor.selectedRace.road.width, 24);
  assert.equal(editor.selectedRace.road.segments.some((segment) => segment.banking === 31), true);
});

test('Race Editor rally test tracks use dense route sections instead of oversized straight chunks', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  editor.handleMenuAction('load-col-de-turini');
  const turini = editor.selectedRace;
  assert.equal(turini.road.segments.length, 35);
  assert.equal(turini.road.segments.filter((segment) => Math.abs(segment.curve) >= 0.7).length >= 20, true);
  assert.equal(Math.max(...turini.road.segments.map((segment) => segment.length)) < 1700, true);
  assert.equal(turini.road.segments.some((segment) => segment.snowCondition === 'ice'), true);

  editor.handleMenuAction('load-ouninpohja');
  const ouninpohja = editor.selectedRace;
  assert.equal(ouninpohja.road.segments.length, 34);
  assert.equal(ouninpohja.road.segments.filter((segment) => Math.abs(segment.curve) >= 0.28).length >= 20, true);
  assert.equal(Math.max(...ouninpohja.road.segments.map((segment) => segment.length)) < 1700, true);
  assert.equal(ouninpohja.road.segments.filter((segment) => Number(segment.bumpiness) >= 0.28).length >= 8, true);
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
  assert.equal(editor.playtestSession.codriverCalls.length, 0);
  assert.equal(editor.playtestSession.running, true);
  assert.equal(editor.playtestSession.routeLength > 0, true);
  assert.deepEqual(editor.playtestSession.eventLog, [
    '1 AI racers enabled',
    '3 race hazards loaded',
    'Co-driver disabled'
  ]);
});

test('Race Editor restores Race authoring menus after Drive picker and playtest exits', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.draw(createMockContext(), 390, 844);
  editor.handleMenuAction('test-drive');
  assert.equal(editor.playtestPickerOpen, true);
  assert.equal(editor.activeRootId, 'drive');

  editor.cancelPlaytestPicker();
  assert.equal(editor.playtestPickerOpen, false);
  assert.equal(editor.activeRootId, 'race');
  assert.equal(editor.racePortraitMode, 'race');
  assert.equal(editor.raceSelectionType, 'edge');
  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.getMenuItems('race').some((item) => item.id === 'generate-random-race'), true);

  editor.startPlaytest('starter-rwd');
  assert.ok(editor.playtestSession);
  editor.endPlaytest();
  assert.equal(editor.playtestSession, null);
  assert.equal(editor.activeRootId, 'race');
  assert.equal(editor.mobileRootOpen, true);

  editor.startPlaytest('starter-rwd');
  editor.finishPlaytest();
  assert.equal(editor.playtestSession, null);
  assert.equal(editor.activeRootId, 'race');
  assert.equal(editor.mobileRootOpen, true);
});

test('Race Editor pre-race picker selects cars, opens tuning, and adjusts per-wheel tires', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.handleMenuAction('test-drive');
  editor.draw(ctx, 1280, 800);

  const brzButton = editor.buttons.find((button) => button.id === 'playtest-car-subaru-brz-2022');
  assert.ok(brzButton);
  brzButton.onClick();
  assert.equal(editor.project.selectedCarId, 'subaru-brz-2022');
  assert.equal(editor.buttons.some((button) => button.id === 'playtest-tuning'), true);
  assert.equal(editor.buttons.some((button) => button.id === 'playtest-start'), true);

  editor.buttons.find((button) => button.id === 'playtest-tuning').onClick();
  editor.buttons = [];
  editor.draw(createMockContext(), 1280, 800);

  assert.equal(editor.preRaceTuningOpen, true);
  assert.equal(editor.buttons.some((button) => button.id === 'tire-fl'), true);
  assert.equal(editor.buttons.some((button) => button.id === 'tune-pressure-fl-up'), true);
  assert.equal(editor.buttons.some((button) => button.id === 'tune-gearFinalDrive-down'), true);

  const beforeCompound = editor.selectedCar.setup.tireCompoundByWheel.fl;
  editor.buttons.find((button) => button.id === 'tire-fl').onClick();
  assert.notEqual(editor.selectedCar.setup.tireCompoundByWheel.fl, beforeCompound);
  const beforePressure = editor.selectedCar.setup.tirePressurePsi.fl;
  editor.buttons.find((button) => button.id === 'tune-pressure-fl-up').onClick();
  assert.equal(editor.selectedCar.setup.tirePressurePsi.fl, beforePressure + 1);

  editor.buttons.find((button) => button.id === 'pre-race-start').onClick();
  assert.equal(editor.playtestSession.carId, 'subaru-brz-2022');
});

test('Race Editor tire compounds alter grip by surface and weather', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const car = editor.selectedCar;
  const setup = editor.getRaceCarSetup(car);

  setup.tireCompoundByWheel = { fl: 'tarmac', fr: 'tarmac', rl: 'tarmac', rr: 'tarmac' };
  const tarmacOnAsphalt = editor.getRaceTireSetupGripMultiplier(car, 'asphalt', 'clear');
  setup.tireCompoundByWheel = { fl: 'dirt', fr: 'dirt', rl: 'dirt', rr: 'dirt' };
  const dirtOnGravel = editor.getRaceTireSetupGripMultiplier(car, 'gravel', 'clear');
  const dirtInSnow = editor.getRaceTireSetupGripMultiplier(car, 'snow', 'snow');
  setup.tireCompoundByWheel = { fl: 'snow', fr: 'snow', rl: 'snow', rr: 'snow' };
  const snowInSnow = editor.getRaceTireSetupGripMultiplier(car, 'snow', 'snow');

  assert.equal(tarmacOnAsphalt > 1, true);
  assert.equal(dirtOnGravel > 0.95, true);
  assert.equal(snowInSnow > dirtInSnow, true);
});

test('Race Editor playtest advances, exposes hazards, and can end from the desktop Drive drawer', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.shiftRaceGear(1);
  editor.raceInput.activeThrottlePointerId = 1;
  for (let i = 0; i < 5; i += 1) editor.update(null, 0.5);

  assert.equal(editor.playtestSession.distance > 0, true);
  assert.equal(editor.playtestSession.speedMps > 0, true);
  assert.equal(editor.getNextCoDriverCall(), null);
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

  assert.equal(editor.raceInput.steeringTarget, 1);
  assert.equal(editor.getRaceBinarySteerAssist(editor.playtestSession.speedMps).steeringAuthority > 0.42, true);
  assert.equal(editor.getRaceBinarySteerAssist(editor.playtestSession.speedMps).steeringAuthority < 0.72, true);
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
  assert.equal(text.some((call) => ['DMG', 'ENG', 'TRN', 'FL', 'FR', 'RL', 'RR'].includes(call.value)), false);
  assert.equal(ctx.calls.some((call) => call.type === 'arc'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'lineTo'), true);
});

test('Race playtest HUD exposes top quit controls and directional minimap car marker', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.carYaw = Math.PI / 2;
  editor.drawRacePlaytestHud(ctx, { x: 0, y: 0, w: 390, h: 260 });

  const ids = editor.buttons.map((button) => button.id);
  assert.equal(ids.includes('race-pause-return-editor'), true);
  assert.equal(ids.includes('race-return-editor'), false);
  assert.equal(ids.includes('race-exit-main'), false);
  assert.equal(ctx.calls.filter((call) => call.type === 'lineTo').length >= 4, true);
  assert.equal(raceEditorSource.includes("ctx.fillStyle = '#58d6ff';"), true);
  assert.equal(raceEditorSource.includes('player.x + forward.x * size * 1.36'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === 'Main Menu'), false);
});

test('Race Editor destination HUD shows percent instead of lap text', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.selectedRace.laps = 3;
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 0, y: 280, elevation: 0 },
    { x: 90, y: 460, elevation: 0 }
  ];
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
  assert.ok(editor.getRaceRoadHalfWidthWorld() >= 27.5);
  assert.equal(raceEditorSource.includes('drawRaceStartFinishCheckerStripes'), true);
  assert.equal(raceEditorSource.includes("ctx.fillStyle = index % 2 === 0 ? '#f1f4ef' : '#050807';"), true);
  assert.equal(raceEditorSource.includes('getRaceCameraPitchProfile({'), true);
  assert.equal(raceEditorSource.includes('camera.nearPlane = Math.max(1.2, 1.35 + pitchProfile.nearPlaneBoost * 2.4 + Math.max(0, hillPitch) * 1.8);'), true);
  assert.equal(raceEditorSource.includes('pitchProfile.nearPlaneBoost * 3.1'), true);
});

test('Race playtest horizon reacts differently to uphill and downhill travel', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  editor.selectedRace.road.nodes = [];
  editor.selectedRace.road.segments = [
    { length: 260, curve: 0, elevation: 0.34, surface: 'asphalt', hazardIds: [] },
    { length: 260, curve: 0, elevation: -0.32, surface: 'asphalt', hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');

  const uphill = editor.getRaceCameraPitchProfile({
    visualTravel: 60,
    routeRuntimeType: 'destination',
    speedMps: 24,
    session: editor.playtestSession
  });
  const downhill = editor.getRaceCameraPitchProfile({
    visualTravel: 310,
    routeRuntimeType: 'destination',
    speedMps: 24,
    session: editor.playtestSession
  });

  assert.equal(uphill.hillPitch > 0, true);
  assert.equal(downhill.hillPitch < 0, true);
  assert.equal(uphill.horizonRatio < downhill.horizonRatio, true);
});

test('Race playtest projection clips road points before the adaptive near plane', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 0,
    elevation: 0.1,
    horizonRatio: 0.31,
    roadDepthRatio: 0.7,
    focalScale: 1.04,
    roadWidthScale: 2.2,
    roadMaxWidthRatio: 0.72,
    nearPlane: 2.8
  };

  const clipped = editor.projectRaceWorldPointToCamera({ x: 0, z: 2.1, elevation: 0 }, camera, 0, bounds);
  const visible = editor.projectRaceWorldPointToCamera({ x: 0, z: 3.2, elevation: 0 }, camera, 0, bounds);

  assert.equal(clipped.visible, false);
  assert.equal(visible.visible, true);
});

test('Race playtest projection keeps horizon stable across elapsed time at the same road position', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };

  editor.selectedRace.road.nodes = [];
  editor.selectedRace.road.segments = [
    { length: 180, curve: 0.35, elevation: 0.24, surface: 'gravel', bumpiness: 0.62 },
    { length: 160, curve: -0.42, elevation: 0.3, surface: 'snow', bumpiness: 0.7 }
  ];
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.distance = 90;
  editor.playtestSession.worldX = editor.getRaceWorldPoseAtDistance(90).x;
  editor.playtestSession.worldZ = editor.getRaceWorldPoseAtDistance(90).z;
  editor.playtestSession.carYaw = editor.getRaceWorldPoseAtDistance(90).yaw;
  editor.playtestSession.cameraYaw = editor.playtestSession.carYaw;
  editor.playtestSession.speedMps = 34;

  const firstCtx = createMockContext();
  editor.playtestSession.elapsedMs = 0;
  editor.drawRaceProjectedRoadPath(firstCtx, bounds, { showPlaytestHud: false });
  const firstSky = firstCtx.calls.filter((call) => call.type === 'fillRect')[1];

  const secondCtx = createMockContext();
  editor.playtestSession.elapsedMs = 9500;
  editor.drawRaceProjectedRoadPath(secondCtx, bounds, { showPlaytestHud: false });
  const secondSky = secondCtx.calls.filter((call) => call.type === 'fillRect')[1];

  assert.ok(firstSky);
  assert.ok(secondSky);
  assert.equal(secondSky.h, firstSky.h);
  assert.equal(raceEditorSource.includes('camera.eyeHeight = this.getRaceCameraEyeHeight(cameraView);'), true);
});

test('Race playtest road fills the near viewport and unpainted ground defaults green', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };

  editor.startPlaytest('starter-rwd');
  const camera = {
    ...editor.getRaceWorldPoseAtDistance(0),
    roadDepthRatio: 0.76,
    horizonRatio: 0.31,
    focalScale: 1.1,
    roadWidthScale: 10.15
  };
  const nearSection = editor.getRaceRoadCrossSectionAtDistance(0.45);
  const projectedNear = editor.projectRaceWorldPointToCamera(nearSection.center, camera, camera.yaw, bounds);
  assert.equal(projectedNear.screenY >= bounds.y + bounds.h - 3, true);

  const asphaltSegment = { surface: 'asphalt' };
  assert.equal(editor.getRaceGroundPaletteForSegment(asphaltSegment, { x: 9999, z: 9999 }).shoulderA, '#315734');
  assert.equal(editor.getRaceGroundPaletteForSegment(asphaltSegment, { x: 9999, z: 9999 }).shoulderB, '#244629');
});

test('Race playtest camera view changes road scale while renderer samples route order', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.selectedRace.type = 'circuit';
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.distance = 120;
  editor.playtestSession.projectedDistance = 120;
  const routeYaw = editor.getRaceRoadYawAtDistance(editor.playtestSession.distance);

  const samples = editor.getRaceRenderSampleDistances({
    visualTravel: editor.playtestSession.distance,
    routeLength: editor.playtestSession.routeLength,
    routeRuntimeType: 'circuit',
    nearDistance: 3,
    viewDistance: 520
  });
  assert.equal(samples.length > 12, true);
  assert.equal(samples.some((distance) => distance < editor.playtestSession.distance), true);
  assert.equal(samples.some((distance) => distance > editor.playtestSession.distance), true);

  const camera = {
    ...editor.getRaceWorldPoseAtDistance(editor.playtestSession.distance),
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ,
    horizonRatio: 0.31
  };
  const firstProfile = editor.getRaceCameraProjectionProfile('first-person', 0);
  const thirdProfile = editor.getRaceCameraProjectionProfile('third-person', 0);
  const firstSection = editor.getRaceRoadCrossSectionAtDistance(editor.playtestSession.distance + 12, { visualWidthMultiplier: 1.18 });
  const thirdSection = editor.getRaceRoadCrossSectionAtDistance(editor.playtestSession.distance + 12, { visualWidthMultiplier: 0.58 });
  Object.assign(camera, firstProfile);
  const firstWidth = Math.abs(
    editor.projectRaceWorldPointToCamera(firstSection.right, camera, routeYaw, bounds).screenX
    - editor.projectRaceWorldPointToCamera(firstSection.left, camera, routeYaw, bounds).screenX
  );
  Object.assign(camera, thirdProfile);
  const thirdWidth = Math.abs(
    editor.projectRaceWorldPointToCamera(thirdSection.right, camera, routeYaw, bounds).screenX
    - editor.projectRaceWorldPointToCamera(thirdSection.left, camera, routeYaw, bounds).screenX
  );

  assert.equal(firstWidth > thirdWidth * 1.6, true);
});

test('Race Editor uses real highway dash spacing and displays route length in km', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const marker = editor.getRaceLaneMarkerDimensionsWorld();

  assert.equal(Math.abs(marker.dashLength - 3.048) < 0.001, true);
  assert.equal(Math.abs(marker.gapLength - 9.144) < 0.001, true);
  assert.equal(Math.abs(marker.interval - 12.192) < 0.001, true);
  assert.equal(editor.formatRaceRouteLengthKm(1234), '1.23 km');
  assert.equal(editor.formatRaceMapDistanceLabel(850), '850 m');
  assert.equal(editor.formatRaceMapDistanceLabel(1050), '1.05 km');

  const ctx = createMockContext();
  editor.drawRacePanel(ctx, { x: 0, y: 0, w: 320, h: 420 });
  const text = ctx.calls.filter((call) => call.type === 'text').map((call) => String(call.value));
  assert.equal(text.some((value) => value.startsWith('Road length: ') && value.endsWith(' km')), true);

  seedEditableRaceRoute(editor);
  editor.selectedRace.road.segments[0].length = 1050;
  editor.selectedRace.road.segments[1].length = 500;
  const mapCtx = createMockContext();
  editor.drawRaceTopDownEditor(mapCtx, { x: 0, y: 0, w: 640, h: 420 });
  const mapText = mapCtx.calls.filter((call) => call.type === 'text').map((call) => String(call.value));
  assert.equal(mapText.includes('1.05 km'), true);
  assert.equal(mapText.includes('500 m'), true);
  assert.equal(mapText.some((value) => /^\d+(\.\d+)? km$|^\d+ m$/.test(value)), true);
  const scaleBar = editor.getRaceMapScaleBar(editor.raceMapBounds);
  assert.ok(scaleBar);
  assert.equal(mapText.includes(scaleBar.label), true);
  assert.equal(scaleBar.width >= 42, true);
  assert.equal(scaleBar.width <= Math.min(160, editor.raceMapBounds.w * 0.32), true);

  mapCtx.font = '700 11px sans-serif';
  const labelLayout = editor.getRaceSegmentLengthLabelLayout(
    mapCtx,
    editor.raceMapBounds,
    editor.getRaceMapPoints(editor.raceMapBounds),
    editor.selectedRace.road.segments,
    20
  );
  assert.equal(labelLayout.some((label) => label.label === '1.05 km' && label.side === 'right'), true);
  assert.equal(labelLayout.some((label) => label.label === '500 m' && label.side === 'left'), true);
  assert.equal(labelLayout.every((label) => label.x >= editor.raceMapBounds.x && label.x <= editor.raceMapBounds.x + editor.raceMapBounds.w), true);
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
  assert.equal(editor.raceInput.steeringTarget, 1);
  assert.equal(editor.raceInput.steeringWheel > 0.12, true);
  assert.equal(editor.raceInput.steeringWheel < 0.14, true);
  assert.equal(editor.getRaceMaxSteerForSpeed(editor.playtestSession.speedMps) <= 0.27, true);
});

test('Race Editor stores physical tire and steering wheel angles from the same steering rack', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 1, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 32;
  editor.update(null, 0.16);

  const expectedTireAngle = editor.getRacePhysicalTireAngleForSteering(
    editor.raceInput.steeringWheel,
    Math.abs(editor.playtestSession.speedMps)
  );
  const expectedWheelRotation = editor.getRaceSteeringWheelRotationForTireAngle(expectedTireAngle);

  assert.equal(Math.abs(editor.playtestSession.tireSlip.frontTireAngle - expectedTireAngle) < 0.001, true);
  assert.equal(Math.abs(editor.playtestSession.steeringWheelRotation - expectedWheelRotation) < 0.001, true);
  assert.equal(raceEditorSource.includes('drawWheel(centerX - carW * 0.38, y - carH * 0.24, frontTireAngle);'), true);
});

test('Race Editor visible steering wheel rotation follows tire angle and steering ratio', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const lowSpeedTireAngle = editor.getRacePhysicalTireAngleForSteering(1, 0);
  const highwayTireAngle = editor.getRacePhysicalTireAngleForSteering(1, 100 * 0.44704);
  const lowSpeedWheel = editor.getRaceVisibleSteeringWheelRotationRad(1, 0);
  const highwayWheel = editor.getRaceVisibleSteeringWheelRotationRad(1, 100 * 0.44704);

  assert.equal(Math.abs(lowSpeedWheel - editor.getRaceSteeringWheelRotationForTireAngle(lowSpeedTireAngle)) < 0.001, true);
  assert.equal(Math.abs(highwayWheel - editor.getRaceSteeringWheelRotationForTireAngle(highwayTireAngle)) < 0.001, true);
  assert.equal(Math.abs(lowSpeedWheel) > Math.abs(highwayWheel), true);
  assert.equal(Math.abs(highwayWheel) < 1.2, true);
  assert.equal(editor.getRaceSteeringRatio(), 14.5);
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
  assert.equal(editor.playtestSession.tireSlip.audibleSlip, 0);

  editor.raceInput.binarySteer = 0;
  for (let i = 0; i < 24; i += 1) editor.updatePlaytest(0.016);

  assert.equal(editor.raceInput.steeringWheel, 0);
  assert.equal(editor.raceInput.steeringTarget, 0);
});

test('Race Editor binary steering uses full virtual stick input with speed-damped tire authority', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.binarySteer = 1;
  editor.playtestSession.speedMps = 0;
  editor.updatePlaytest(0.016);
  assert.equal(editor.raceInput.steeringTarget > 0.02, true);
  assert.equal(editor.raceInput.steeringTarget < 0.05, true);
  assert.equal(editor.raceInput.steeringWheel > 0.003, true);
  assert.equal(editor.raceInput.steeringWheel < 0.006, true);
  assert.equal(editor.playtestSession.tireSlip.audibleSlip, 0);
  for (let i = 0; i < 14; i += 1) editor.updatePlaytest(0.016);
  const restTarget = editor.raceInput.steeringTarget;
  const restWheel = editor.raceInput.steeringWheel;

  editor.raceInput.steeringTarget = 0;
  editor.raceInput.steeringWheel = 0;
  editor.playtestSession.speedMps = 70;
  editor.updatePlaytest(0.016);

  assert.equal(restTarget > 0.55, true);
  assert.equal(restWheel > 0.32, true);
  assert.equal(editor.raceInput.steeringTarget > 0.04, true);
  assert.equal(editor.raceInput.steeringTarget < 0.07, true);
  assert.equal(editor.raceInput.steeringWheel > 0.005, true);
  assert.equal(editor.raceInput.steeringWheel < 0.009, true);
  assert.equal(editor.raceInput.steeringWheel < 1, true);
  assert.equal(editor.getRaceBinarySteerAssist(70).steeringAuthority <= 0.27, true);
  assert.equal(raceEditorSource.includes('activeTurnResponseScale: 0.125'), true);
});

test('Race Editor D-pad steering moves toward full-stick lock without snapping instantly', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 70;
  editor.raceInput.binarySteer = 1;
  editor.updatePlaytest(1 / 120);

  assert.equal(editor.raceInput.steeringTarget > 0.01, true);
  assert.equal(editor.raceInput.steeringTarget < 0.02, true);
  assert.equal(editor.raceInput.steeringWheel > 0.001, true);
  assert.equal(editor.raceInput.steeringWheel < 0.003, true);
  assert.equal(editor.getRaceBinarySteerAssist(70).maxSteer, 1);
  assert.equal(editor.getRaceMaxSteerForSpeed(70) < 0.67, true);

  editor.raceInput.binarySteer = 0;
  for (let i = 0; i < 10; i += 1) editor.updatePlaytest(1 / 60);
  assert.equal(Math.abs(editor.raceInput.steeringWheel) < 0.16, true);
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
  assert.equal(editor.raceInput.steeringTarget > 0.48, true);

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

test('Race Editor digital pedals ramp like virtual throttle and brake axes', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.activeThrottlePointerId = 'go';
  editor.raceInput.activeBrakePointerId = 'brake';
  editor.updatePlaytest(1 / 60);

  assert.equal(editor.raceInput.rawThrottleAxis, 1);
  assert.equal(editor.raceInput.rawBrakeAxis, 1);
  assert.equal(editor.raceInput.throttleAxis > 0.08 && editor.raceInput.throttleAxis < 0.1, true);
  assert.equal(editor.raceInput.brakeAxis > 0.13 && editor.raceInput.brakeAxis < 0.16, true);

  editor.raceInput.activeThrottlePointerId = null;
  editor.raceInput.activeBrakePointerId = null;
  editor.updatePlaytest(1 / 60);

  assert.equal(editor.raceInput.throttleAxis < 0.03, true);
  assert.equal(editor.raceInput.brakeAxis, 0);
  assert.equal(raceEditorSource.includes('digitalBrakePressRate: 8.5'), true);
});

test('Race Editor analog triggers preserve proportional pedal pressure', () => {
  const gameInput = { gamepadAxes: { leftX: 0, leftTrigger: 0.42, rightTrigger: 0.35 } };
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: gameInput,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.update(null, 1 / 30);

  assert.equal(Math.abs(editor.raceInput.rawThrottleAxis - 0.35) < 0.001, true);
  assert.equal(Math.abs(editor.raceInput.rawBrakeAxis - 0.42) < 0.001, true);
  assert.equal(editor.raceInput.throttleAxis > 0.3 && editor.raceInput.throttleAxis < 0.36, true);
  assert.equal(editor.raceInput.brakeAxis > 0.39 && editor.raceInput.brakeAxis < 0.43, true);
  assert.equal(editor.raceInput.throttle, true);
  assert.equal(editor.raceInput.brake, true);
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

test('Race Editor simulates 2022 WRX with runtime manual and automatic transmission modes', () => {
  const manual = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  manual.raceInput.transmissionMode = 'manual';
  manual.startPlaytest('starter-rwd');

  assert.equal(manual.selectedCar.name, '2022 Subaru WRX');
  assert.equal(manual.selectedCar.tuning.drivetrain, 'awd');
  assert.equal(manual.selectedCar.tuning.powerHp, 271);
  assert.equal(manual.selectedCar.tuning.torqueLbFt, 258);
  assert.equal(manual.playtestSession.transmissionType, 'manual');
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
  automatic.startPlaytest('starter-rwd');

  assert.equal(automatic.selectedCar.name, '2022 Subaru WRX');
  assert.equal(automatic.playtestSession.transmissionType, 'automatic');
  assert.equal(automatic.raceInput.autoShift, true);
  assert.equal(automatic.raceInput.gear, 1);

  const automaticRun = simulateRaceAcceleration(automatic);
  assert.equal(automaticRun.zeroToSixty >= 5, true);
  assert.equal(automaticRun.zeroToSixty <= 6.3, true);
  assert.equal(automaticRun.maxMph >= 132, true);
  assert.equal(automaticRun.maxMph <= 137, true);
  assert.equal(automatic.raceInput.gear > 1, true);
});

test('Race Editor automatic transmission downshifts while braking or coasting', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.gear = 5;
  editor.playtestSession.gear = 5;
  editor.playtestSession.shiftCooldownMs = 0;
  editor.playtestSession.speedMps = 18;
  editor.playtestSession.engineRpm = 1600;
  editor.raceInput.activeBrakePointerId = 'brake';
  editor.updatePlaytest(1 / 30);

  assert.equal(editor.raceInput.gear, 4);
});

test('Race Editor automatic transmission skips downshift that would over-rev the engine', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.gear = 4;
  editor.playtestSession.gear = 4;
  editor.playtestSession.shiftCooldownMs = 0;
  editor.playtestSession.speedMps = 30;
  editor.playtestSession.engineRpm = 1500;
  editor.raceInput.activeBrakePointerId = 'brake';
  editor.updatePlaytest(1 / 30);

  assert.equal(editor.raceInput.gear, 4);
  assert.equal(editor.canRaceAutomaticDownshift(editor.getRaceCarTuning(editor.selectedCar), 30, 3), false);
  assert.equal(editor.canRaceAutomaticDownshift(editor.getRaceCarTuning(editor.selectedCar), 30, 4), true);
});

test('Race Editor automatic brake reverses from a stop and throttle returns to first', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 0.2;
  editor.raceInput.activeBrakePointerId = 'brake';
  editor.updatePlaytest(0.2);

  assert.equal(editor.raceInput.gear, -1);
  assert.equal(editor.playtestSession.speedMps < 0, true);

  editor.playtestSession.speedMps = -0.2;
  editor.raceInput.activeBrakePointerId = null;
  editor.raceInput.activeThrottlePointerId = 'throttle';
  editor.updatePlaytest(0.05);

  assert.equal(editor.raceInput.gear, 1);
});

test('Race Editor automatic throttle while rolling backward slows reverse before driving forward', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.gear = -1;
  editor.playtestSession.gear = -1;
  editor.playtestSession.speedMps = -4;
  editor.raceInput.activeThrottlePointerId = 'throttle';
  editor.updatePlaytest(0.25);

  assert.equal(editor.raceInput.gear, 1);
  assert.equal(editor.playtestSession.speedMps > -4, true);
});

test('Race Editor low-speed steering corrections do not create tire skid', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 1 * 0.44704;
  editor.raceInput.binarySteer = 1;
  editor.updatePlaytest(0.18);

  assert.equal(editor.playtestSession.tireSlip.audibleSlip, 0);
  assert.equal(editor.playtestSession.tireSlip.slipAngle, 0);
  assert.equal(editor.playtestSession.tireSlip.scrub, 0);
});

test('Race Editor skid state recovers after controls settle', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 38;
  editor.playtestSession.carYaw = 0.65;
  editor.playtestSession.velocityYaw = 0;
  editor.updatePlaytest(0.1);
  assert.equal(editor.playtestSession.tireSlip.slipAngle > 0.1, true);

  editor.raceInput.binarySteer = 0;
  editor.raceInput.steeringTarget = 0;
  editor.raceInput.steeringWheel = 0;
  for (let frame = 0; frame < 90; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.playtestSession.tireSlip.slipAngle < 0.08, true);
  assert.equal(editor.playtestSession.tireSlip.audibleSlip < 0.08, true);
});

test('Race Editor coasts without aggressive off-throttle speed decay', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 2.5;
  for (let frame = 0; frame < 240; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(Math.abs(editor.playtestSession.speedMps) > 1.9, true);
  assert.equal(Math.abs(editor.playtestSession.speedMps) < 2.5, true);
});

test('Race Editor tire traction imbalance visibly pulls the car yaw', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 30;
  editor.playtestSession.carYaw = 0;
  editor.playtestSession.cameraYaw = 0;
  editor.applyRaceDamage('tires', 80, { keys: ['fl', 'rl'] });
  editor.updatePlaytest(0.1);

  assert.equal(editor.playtestSession.tireSlip.left > editor.playtestSession.tireSlip.right, true);
  assert.equal(editor.playtestSession.tireSlip.pull < 0, true);
  assert.equal(editor.playtestSession.carYaw < 0, true);
});

test('Race Editor playtest uses tire-limited braking instead of arcade brake force', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 26.8;
  editor.raceInput.activeBrakePointerId = 'brake';
  editor.updatePlaytest(0.1);

  assert.equal(editor.playtestSession.speedMps > 24, true);
  assert.equal(editor.playtestSession.speedMps < 26.8, true);
  assert.equal(editor.playtestSession.tireSlip.brakeLock < 0.2, true);
});

test('Race Editor smoothed full brake has high-speed bite while remaining tire limited', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 44;
  editor.raceInput.activeBrakePointerId = 'brake';
  for (let frame = 0; frame < 12; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.raceInput.brakeAxis > 0.95, true);
  assert.equal(editor.playtestSession.speedMps < 42.4, true);
  assert.equal(editor.playtestSession.speedMps > 40.5, true);
  assert.equal(editor.playtestSession.tireSlip.brakeLock < 0.2, true);
});

test('Race Editor aggressive pedals create physical wheelspin or brake-lock slip', () => {
  const throttleEditor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  throttleEditor.startPlaytest('starter-rwd');
  throttleEditor.selectedRace.weather = 'snow';
  throttleEditor.selectedRace.road.segments[0].surface = 'snow';
  throttleEditor.playtestSession.launchLockMs = 0;
  throttleEditor.playtestSession.elapsedMs = 1000;
  throttleEditor.raceInput.activeThrottlePointerId = 'go';
  for (let frame = 0; frame < 18; frame += 1) throttleEditor.updatePlaytest(1 / 60);

  assert.equal(throttleEditor.raceInput.throttleAxis > 0.95, true);
  assert.equal(throttleEditor.playtestSession.tireSlip.wheelSpin > 0, true);

  const brakeEditor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  brakeEditor.startPlaytest('starter-rwd');
  brakeEditor.selectedRace.weather = 'snow';
  brakeEditor.selectedRace.road.segments[0].surface = 'snow';
  brakeEditor.playtestSession.launchLockMs = 0;
  brakeEditor.playtestSession.elapsedMs = 1000;
  brakeEditor.playtestSession.speedMps = 24;
  brakeEditor.raceInput.activeBrakePointerId = 'brake';
  for (let frame = 0; frame < 12; frame += 1) brakeEditor.updatePlaytest(1 / 60);

  assert.equal(brakeEditor.raceInput.brakeAxis > 0.95, true);
  assert.equal(brakeEditor.playtestSession.tireSlip.brakeLock > 0, true);
  assert.equal(brakeEditor.playtestSession.tireSlip.audibleSlip > 0, true);
});

test('Race Editor records wheel-level spin and brake lock from physical tire limits', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 18;
  editor.raceInput.activeBrakePointerId = 'brake';
  editor.raceInput.handbrake = true;
  editor.updatePlaytest(0.1);

  assert.equal(editor.playtestSession.tireSlip.brakeLock > 0, true);
  assert.equal(editor.playtestSession.tireSlip.brakeLockByWheel.rl > 0, true);
  assert.equal(editor.playtestSession.tireSlip.brakeLockByWheel.rr > 0, true);
  assert.equal(editor.playtestSession.tireSlip.audibleSlip > 0, true);
});

test('Race Editor playtest simulates gravity state and rollover threshold', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 34;
  editor.playtestSession.grounded = true;
  editor.updateRaceVerticalAndRollState({
    seconds: 0.1,
    tuning: editor.getRaceCarTuning(editor.selectedCar),
    roadPose: { elevation: -1 },
    previousRoadPose: { elevation: 0 },
    lateralAcceleration: 0
  });

  assert.equal(editor.playtestSession.airborne, true);

  editor.updateRaceVerticalAndRollState({
    seconds: 0.1,
    tuning: editor.getRaceCarTuning(editor.selectedCar),
    roadPose: { elevation: -1 },
    previousRoadPose: { elevation: -1 },
    lateralAcceleration: 19
  });

  assert.equal(editor.playtestSession.rolledOver, true);
  assert.equal(editor.status, 'Rolled over');
});

test('Race Editor includes BRZ and Civic test cars with runtime transmission toggles', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const carIds = editor.project.cars.map((car) => car.id);
  assert.deepEqual(carIds, ['starter-rwd', 'subaru-brz-2022', 'honda-civic-si-2022']);

  const brz = editor.project.cars.find((car) => car.id === 'subaru-brz-2022');
  const civic = editor.project.cars.find((car) => car.id === 'honda-civic-si-2022');
  assert.equal(brz.tuning.powerHp, 228);
  assert.equal(brz.tuning.torqueLbFt, 184);
  assert.equal(brz.tuning.drivetrain, 'rwd');
  assert.equal(civic.tuning.powerHp, 200);
  assert.equal(civic.tuning.torqueLbFt, 192);
  assert.equal(civic.tuning.drivetrain, 'fwd');

  editor.startPlaytest('subaru-brz-2022');
  assert.equal(editor.playtestSession.transmissionType, 'automatic');
  assert.equal(editor.raceInput.autoShift, true);
  editor.toggleRacePause();
  editor.toggleRaceTransmissionMode();
  assert.equal(editor.playtestSession.transmissionType, 'manual');
  assert.equal(editor.raceInput.autoShift, false);
  assert.equal(editor.playtestSession.engineSoundProfile, 'brz-flat-four-manual');
});

test('Race Editor rev limits the WRX engine in neutral', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.raceInput.transmissionMode = 'manual';
  editor.playtestSession.transmissionType = 'manual';
  editor.raceInput.autoShift = false;
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
