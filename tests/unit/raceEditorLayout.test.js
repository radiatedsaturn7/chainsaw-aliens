import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { RACE_STOCK_PERFORMANCE_TARGETS } from '../../src/racing/raceData.js';
import { RaceSurfaceModel } from '../../src/racing/RaceSurfaceModel.js';
import { cloneRaceVehiclePhysicsState, createRaceVehiclePhysicsState, stepRaceVehiclePhysics, syncRaceVehiclePhysicsToSession } from '../../src/racing/RaceVehiclePhysics.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { loadProjectFile, resetProjectFilesForTests } from '../../src/ui/projectFiles.js';
import { clearCachedProjectFilesForTests, upsertCachedProjectFile } from '../../src/ui/serverStorage.js';

const raceEditorSource = readFileSync(new URL('../../src/ui/RaceEditor.js', import.meta.url), 'utf8');
const raceMaterialBatchingSource = readFileSync(new URL('../../src/racing/RaceMaterialBatching.js', import.meta.url), 'utf8');
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

test('Race surface model exposes canonical road margin shoulder transition order', () => {
  const model = new RaceSurfaceModel({
    flatJoinWidthM: 0.5,
    slopeBlendWidthM: 4,
    getRouteLength: () => 100,
    getRoadHalfWidth: () => 3,
    getMarginWidth: () => 0.5,
    getShoulderWidth: () => 1,
    getBlendWidth: () => 4.5,
    sampleTerrain: () => 0,
    sampleRawTerrain: () => 0,
    getSurfaceById: (id) => ({ id, grip: 1 }),
    getEffectiveSurfaceId: (id) => id,
    sampleRoadbedProfileAtDistance: () => ({
      x: 0,
      z: 0,
      yaw: Math.PI / 2,
      elevation: 1,
      grade: 0,
      roadHalfWidth: 3,
      marginWidth: 0.5,
      shoulderWidth: 1,
      blendWidth: 4.5,
      segment: { surface: 'asphalt' }
    })
  });

  const metrics = model.getCorridorMetrics(model.sampleDeckAtDistance(0));

  assert.equal(metrics.roadEnd, 3);
  assert.equal(metrics.marginEnd, 3.5);
  assert.equal(metrics.shoulderEnd, 4.5);
  assert.equal(metrics.flatJoinEnd, 5);
  assert.equal(metrics.transitionEnd, 9);
  assert.equal(model.sampleTrack(0, 2.95).region, 'road');
  assert.equal(model.sampleTrack(0, 3.25).region, 'margin');
  assert.equal(model.sampleTrack(0, 4.25).region, 'shoulder');
  assert.equal(model.sampleTrack(0, 4.75).region, 'transition');
  assert.equal(model.sampleTrack(0, 9.25).region, 'terrain');
});

test('Race surface model widens transition by cut and fill side slope', () => {
  const model = new RaceSurfaceModel({
    flatJoinWidthM: 0.5,
    slopeBlendWidthM: 2,
    maxCutSideSlope: 0.5,
    maxFillSideSlope: 0.25,
    getRouteLength: () => 100,
    getRoadHalfWidth: () => 3,
    getMarginWidth: () => 0,
    getShoulderWidth: () => 1,
    getBlendWidth: () => 2.5,
    sampleTerrain: () => 0,
    sampleRawTerrain: () => 0,
    getSurfaceById: (id) => ({ id, grip: 1 }),
    getEffectiveSurfaceId: (id) => id,
    sampleRoadbedProfileAtDistance: () => ({
      x: 0,
      z: 0,
      yaw: Math.PI / 2,
      elevation: 1,
      leftTerrainElevation: 3,
      rightTerrainElevation: -1,
      grade: 0,
      roadHalfWidth: 3,
      marginWidth: 0,
      shoulderWidth: 1,
      blendWidth: 2.5,
      segment: { surface: 'asphalt' }
    })
  });

  const metrics = model.getCorridorMetrics(model.sampleDeckAtDistance(0));

  assert.equal(metrics.leftTransitionWidth >= 4, true);
  assert.equal(metrics.rightTransitionWidth >= 8, true);
  assert.equal(metrics.rightTransitionEnd > metrics.leftTransitionEnd, true);
  assert.equal(model.sampleTrack(0, -metrics.shoulderEnd - 0.1).region, 'transition');
  assert.equal(model.sampleTrack(0, metrics.rightTransitionEnd + 0.1).region, 'terrain');
});

test('Race surface classifier handles every margin and shoulder enabled combination', () => {
  const createModel = ({ marginWidth = 0, shoulderWidth = 0 } = {}) => new RaceSurfaceModel({
    flatJoinWidthM: 0.5,
    slopeBlendWidthM: 4,
    getRouteLength: () => 100,
    getRoadHalfWidth: () => 4,
    getMarginWidth: () => marginWidth,
    getShoulderWidth: () => shoulderWidth,
    getBlendWidth: () => 4,
    sampleTerrain: () => 0,
    sampleRawTerrain: () => 0,
    getGroundSurfaceForWorldPoint: () => 'dirt',
    getSurfaceById: (id) => ({ id, grip: id === 'asphalt' ? 1 : 0.9 }),
    getEffectiveSurfaceId: (id) => id,
    sampleRoadbedProfileAtDistance: () => ({
      x: 0,
      z: 0,
      yaw: Math.PI / 2,
      elevation: 1,
      grade: 0,
      roadHalfWidth: 4,
      marginWidth,
      shoulderWidth,
      blendWidth: 4,
      segment: { surface: 'asphalt' }
    })
  });
  const cases = [
    { marginWidth: 0, shoulderWidth: 0, expected: ['road', 'transition', 'transition'] },
    { marginWidth: 1, shoulderWidth: 0, expected: ['road', 'margin', 'transition'] },
    { marginWidth: 0, shoulderWidth: 2, expected: ['road', 'shoulder', 'shoulder'] },
    { marginWidth: 1, shoulderWidth: 2, expected: ['road', 'margin', 'shoulder'] }
  ];

  cases.forEach(({ marginWidth, shoulderWidth, expected }) => {
    const model = createModel({ marginWidth, shoulderWidth });
    assert.equal(model.sampleTrack(0, 3.9).region, expected[0]);
    assert.equal(model.sampleTrack(0, 4.5).region, expected[1]);
    assert.equal(model.sampleTrack(0, 5.5).region, expected[2]);
    const metrics = model.getCorridorMetrics(model.sampleDeckAtDistance(0));
    assert.equal(metrics.transitionEnd, metrics.shoulderEnd + metrics.transitionWidth);
    assert.equal(model.sampleTrack(0, metrics.shoulderEnd + 0.01).region, 'transition');
  });
});

test('Race roadbed deck uses robust center support instead of full corridor maximum', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.getRaceRouteLength = () => 20;
  editor.getActiveRaceRuntimeType = () => 'destination';
  editor.getRacePathSampleCacheSignature = () => 'path';
  editor.ensureRaceTileMap = () => ({ revision: 1, cellSizeM: 5 });
  editor.getRaceWorldPoseAtDistance = (distance) => ({
    distance,
    x: 0,
    z: Number(distance) || 0,
    y: Number(distance) || 0,
    yaw: 0,
    elevation: 0,
    segment: { surface: 'asphalt' }
  });
  editor.getRaceRightVector = () => ({ x: 1, z: 0 });
  editor.getRaceRoadHalfWidthWorld = () => 4;
  editor.getRaceVisibleMarginWidthWorld = () => 0;
  editor.getRaceShoulderWidthWorld = () => 12;
  editor.getRaceRoadTerrainBlendWidthWorld = () => 10;
  editor.getRaceGroundElevationAtWorldPoint = (point) => (Number(point?.x || 0) > 6 ? 10 : 0);
  editor.getRaceRawGroundElevationAtWorldPoint = editor.getRaceGroundElevationAtWorldPoint;

  const profile = editor.getRaceRoadbedProfile({ routeLength: 20, runtimeType: 'destination', step: 5 });
  const middle = editor.sampleRaceRoadbedProfileAtDistance(10, profile);

  assert.equal(middle.elevation < 0.001, true);
  assert.equal(middle.stampedHalfWidth > 15, true);
});

test('Race surface geometry key changes when margin and shoulder inputs change', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.getRaceRouteLength = () => 20;
  const margin = editor.ensureRaceMarginSettings();
  margin.marginMode = 'on';
  margin.widthM = 0.2;
  margin.shoulderMode = 'on';
  margin.shoulderWidthM = 12;
  const initial = editor.getRaceSurfaceGeometryRevisionKey({ runtimeType: 'destination' });

  margin.marginMode = 'off';
  const marginChanged = editor.getRaceSurfaceGeometryRevisionKey({ runtimeType: 'destination' });
  margin.marginMode = 'on';
  margin.shoulderWidthM = 18;
  const shoulderChanged = editor.getRaceSurfaceGeometryRevisionKey({ runtimeType: 'destination' });

  assert.notEqual(initial, marginChanged);
  assert.notEqual(initial, shoulderChanged);
});

test('Race renderer surface and wheel contact use the same deck elevation', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const segment = { surface: 'asphalt' };
  editor.getRaceRouteLength = () => 100;
  editor.getActiveRaceRuntimeType = () => 'destination';
  editor.getRacePathSampleCacheSignature = () => 'path';
  editor.ensureRaceTileMap = () => ({ revision: 1, cellSizeM: 5 });
  editor.getRaceWorldPoseAtDistance = (distance) => ({
    distance,
    x: 0,
    z: Number(distance) || 0,
    y: Number(distance) || 0,
    yaw: 0,
    elevation: 2,
    segment
  });
  editor.getRaceRouteProjectionForWorldPoint = (point) => ({
    distance: Number(point?.z || 0),
    lateral: Number(point?.x || 0),
    yaw: 0,
    segment
  });
  editor.getRaceRightVector = () => ({ x: 1, z: 0 });
  editor.getRaceForwardVector = () => ({ x: 0, z: 1 });
  editor.getRaceRoadHalfWidthWorld = () => 4;
  editor.getRaceVisibleMarginWidthWorld = () => 0.5;
  editor.getRaceShoulderWidthWorld = () => 1;
  editor.getRaceRoadTerrainBlendWidthWorld = () => 4.5;
  editor.getRaceGroundElevationAtWorldPoint = () => 0;
  editor.getRaceRawGroundElevationAtWorldPoint = () => 0;
  const roadPoint = { x: 1, z: 10 };
  const shoulderPoint = { x: 4.8, z: 10 };
  const roadSample = editor.getRaceSurfaceModel().sampleWorld(roadPoint, 0);
  const shoulderSample = editor.getRaceSurfaceModel().sampleWorld(shoulderPoint, 0);
  const roadRenderElevation = editor.getRaceStitchedTerrainElevationAtWorldPoint(roadPoint, 0);
  const shoulderRenderElevation = editor.getRaceStitchedTerrainElevationAtWorldPoint(shoulderPoint, 0);
  const contacts = editor.getRaceWheelContactState({
    car: { dimensions: { wheelbaseM: 2.6, trackFrontM: 1.5, trackRearM: 1.5 } },
    tuning: { wheelbaseM: 2.6, trackFrontM: 1.5, trackRearM: 1.5, trackWidthM: 1.5 },
    session: { worldX: 0, worldZ: 10, carYaw: 0, routeRuntimeType: 'destination' }
  });

  assert.equal(Math.abs(roadSample.elevation - roadRenderElevation) < 0.0001, true);
  assert.equal(Math.abs(shoulderSample.elevation - shoulderRenderElevation) < 0.0001, true);
  Object.values(contacts.contacts).forEach((contact) => {
    assert.equal(Math.abs(contact.elevation - roadSample.elevation) < 0.0001, true);
  });
});

test('Race wheel state classifies visible apron and shoulder from canonical surface regions', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const segment = { surface: 'asphalt' };
  editor.getRaceRouteLength = () => 100;
  editor.getActiveRaceRuntimeType = () => 'destination';
  editor.getRacePathSampleCacheSignature = () => 'path';
  editor.ensureRaceTileMap = () => ({ revision: 1, cellSizeM: 5, defaultTileId: 'grass' });
  editor.getRaceWorldPoseAtDistance = (distance) => ({
    distance,
    x: 0,
    z: Number(distance) || 0,
    y: Number(distance) || 0,
    yaw: 0,
    elevation: 2,
    segment,
    roadHalfWidth: 4,
    marginWidth: 1,
    shoulderWidth: 2,
    blendWidth: 4
  });
  editor.getRaceRouteProjectionForWorldPoint = (point) => ({
    distance: Number(point?.z || 0),
    lateral: Number(point?.x || 0),
    yaw: 0,
    segment
  });
  editor.getRaceRightVector = () => ({ x: 1, z: 0 });
  editor.getRaceForwardVector = () => ({ x: 0, z: 1 });
  editor.getRaceRoadHalfWidthWorld = () => 4;
  editor.getRaceVisibleMarginWidthWorld = () => 1;
  editor.getRaceShoulderWidthWorld = () => 2;
  editor.getRaceRoadTerrainBlendWidthWorld = () => 4;
  editor.getRaceGroundElevationAtWorldPoint = () => 0;
  editor.getRaceRawGroundElevationAtWorldPoint = () => 0;
  editor.getRaceGroundSurfaceForWorldPoint = () => 'dirt';
  const tuning = { wheelbaseM: 2.1, trackFrontM: 1.2, trackRearM: 1.2, trackWidthM: 1.2 };
  const car = { setup: {}, dimensions: { wheelbaseM: 2.1, trackFrontM: 1.2, trackRearM: 1.2, trackWidthM: 1.2 } };
  const marginState = editor.getRaceWheelSurfaceState({
    car,
    tuning,
    session: { worldX: 4.2, worldZ: 10, carYaw: 0 }
  });
  const shoulderState = editor.getRaceWheelSurfaceState({
    car,
    tuning,
    session: { worldX: 5.2, worldZ: 10, carYaw: 0 }
  });

  assert.equal(marginState.regionByWheel.fr, 'margin');
  assert.equal(marginState.terrainByWheel.fr, 'margin');
  assert.equal(marginState.surfaceByWheel.fr, 'asphalt');
  assert.equal(shoulderState.regionByWheel.fr, 'shoulder');
  assert.equal(shoulderState.terrainByWheel.fr, 'shoulder');
  assert.equal(shoulderState.surfaceByWheel.fr, 'dirt');
});

test('Race shoulder meshes use adjacent terrain texture and stay level with road deck', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.margin = { marginMode: 'on', shoulderMode: 'on', widthM: 0.3, shoulderWidthM: 2 };
  editor.ensureRaceTileMap = () => ({ revision: 1, cellSizeM: 5, defaultTileId: 'grass' });
  editor.getRaceTileMapCellAtWorldPoint = () => ({
    tileId: 'grass',
    artRef: 'LocalGrass',
    tileWeights: { grass: 1 }
  });
  const section = {
    center: { x: 0, z: 0, y: 0, yaw: 0, elevation: 2, segment: { surface: 'asphalt' } },
    left: { x: -4, z: 0, y: 0, elevation: 2 },
    right: { x: 4, z: 0, y: 0, elevation: 2 },
    marginLeft: { x: -5, z: 0, y: 0, elevation: 2 },
    marginRight: { x: 5, z: 0, y: 0, elevation: 2 },
    shoulderLeft: { x: -7, z: 0, y: 0, elevation: 2 },
    shoulderRight: { x: 7, z: 0, y: 0, elevation: 2 },
    transitionLeft: { x: -11, z: 0, y: 0, elevation: 1.5 },
    transitionRight: { x: 11, z: 0, y: 0, elevation: 1.5 }
  };
  const far = JSON.parse(JSON.stringify(section));
  far.center.z = 10;
  far.center.y = 10;
  ['left', 'right', 'marginLeft', 'marginRight', 'shoulderLeft', 'shoulderRight', 'transitionLeft', 'transitionRight'].forEach((key) => {
    far[key].z = 10;
    far[key].y = 10;
  });
  const meshes = editor.getRaceShoulderSurfaceMeshesForBand({ near: section, far }, {
    fallbackArtRef: '',
    texturesEnabled: true,
    textureWorldM: 1,
    useSunShading: false
  });
  const left = meshes.find((mesh) => mesh.source === 'shoulder-left');

  assert.ok(left);
  assert.equal(left.artRef, 'LocalGrass');
  assert.equal(left.textured, true);
  assert.equal(left.textureWorldM, 1);
  left.points.forEach((point) => {
    assert.equal(point.elevation, 2);
  });
});

test('Race tire FX treats apron as paved margin and shoulder as terrain', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  assert.equal(editor.getRaceTireFxSlotForWheel({
    surfaceId: 'asphalt',
    terrain: 'margin',
    slip: 0.1,
    speedMps: 12
  }), '');
  assert.equal(editor.getRaceTireFxSlotForWheel({
    surfaceId: 'asphalt',
    terrain: 'shoulder',
    slip: 0.1,
    speedMps: 12
  }), 'grassDust');
});

test('Race terrain clipping removes corridor interiors and retains seam-split exterior triangles', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const segment = { surface: 'asphalt' };
  editor.getRaceRouteLength = () => 100;
  editor.getActiveRaceRuntimeType = () => 'destination';
  editor.getRacePathSampleCacheSignature = () => 'path';
  editor.ensureRaceTileMap = () => ({ revision: 1, cellSizeM: 5, defaultTileId: 'grass' });
  editor.getRaceWorldPoseAtDistance = (distance) => ({
    distance,
    x: 0,
    z: Number(distance) || 0,
    y: Number(distance) || 0,
    yaw: 0,
    elevation: 0,
    segment
  });
  editor.getRaceRouteProjectionForWorldPoint = (point) => ({
    distance: Math.max(0, Math.min(100, Number(point?.z || 0))),
    lateral: Number(point?.x || 0),
    yaw: 0,
    segment
  });
  editor.getRaceRightVector = () => ({ x: 1, z: 0 });
  editor.getRaceForwardVector = () => ({ x: 0, z: 1 });
  editor.getRaceRoadHalfWidthWorld = () => 4;
  editor.getRaceVisibleMarginWidthWorld = () => 0.5;
  editor.getRaceShoulderWidthWorld = () => 1;
  editor.getRaceRoadTerrainBlendWidthWorld = () => 4.5;
  editor.getRaceGroundElevationAtWorldPoint = () => 0;
  editor.getRaceRawGroundElevationAtWorldPoint = () => 0;
  const inside = editor.getRaceTerrainTrianglesOutsideTrackCorridor([
    { x: -1, z: 10, elevation: 0 },
    { x: 1, z: 10, elevation: 0 },
    { x: 0, z: 12, elevation: 0 }
  ], { runtimeType: 'destination', routeLength: 100 });
  const crossing = editor.getRaceTerrainTrianglesOutsideTrackCorridor([
    { x: 8, z: 10, elevation: 0 },
    { x: 12, z: 10, elevation: 0 },
    { x: 12, z: 14, elevation: 0 }
  ], { runtimeType: 'destination', routeLength: 100 });

  assert.equal(inside.length, 0);
  assert.equal(crossing.length > 0, true);
  crossing.forEach((triangle) => {
    assert.equal(editor.getRaceTerrainTriangleArea(triangle) > 0.000001, true);
    triangle.forEach((point) => {
      assert.equal(Number(point.x || 0) >= 9.9999, true);
    });
  });
  assert.equal(crossing.some((triangle) => triangle.some((point) => point.trackSeam === true)), true);
});

function createMockContext() {
  const calls = [];
  const noop = () => {};
  return {
    calls,
    save: noop,
    restore: noop,
    fillRect(x, y, w, h) { calls.push({ type: 'fillRect', x, y, w, h, style: this._fillStyle }); },
    strokeRect: noop,
    rect: noop,
    clip: noop,
    beginPath: () => calls.push({ type: 'beginPath' }),
    closePath: noop,
    moveTo: (x, y) => calls.push({ type: 'moveTo', x, y }),
    lineTo: (x, y) => calls.push({ type: 'lineTo', x, y }),
    translate: noop,
    rotate: noop,
    arc: (x, y, r, start, end) => calls.push({ type: 'arc', x, y, r, start, end }),
    fill() { calls.push({ type: 'fill', style: this._fillStyle }); },
    stroke: noop,
    setLineDash: noop,
    drawImage(...args) { calls.push({ type: 'drawImage', args }); },
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

function createFastMockContext() {
  const noop = () => {};
  return {
    save: noop,
    restore: noop,
    fillRect: noop,
    strokeRect: noop,
    rect: noop,
    clip: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    translate: noop,
    rotate: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    setLineDash: noop,
    drawImage: noop,
    fillText: noop,
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
  const ctx = createFastMockContext();
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

function simulateRaceAcceleration(editor, { seconds = 90, manual = false, fps = 30 } = {}) {
  let zeroToSixty = null;
  let zeroToHundred = null;
  let quarterMile = null;
  let quarterMileTrapMph = null;
  let maxMph = 0;
  editor.raceInput.throttle = true;
  editor.raceInput.activeThrottlePointerId = 'sim';
  for (let frame = 0; frame < seconds * fps; frame += 1) {
    if (manual) {
      const tuning = editor.getRaceCarTuning(editor.selectedCar);
      if (editor.raceInput.gear === 0 && editor.playtestSession.shiftCooldownMs <= 0) {
        editor.shiftRaceGear(1);
      }
      if (editor.playtestSession.engineRpm > tuning.redlineRpm * 0.94 && editor.playtestSession.shiftCooldownMs <= 0) {
        editor.shiftRaceGear(1);
      }
    }
    editor.update(null, 1 / fps);
    const mph = editor.playtestSession.speedMps * 2.23694;
    maxMph = Math.max(maxMph, mph);
    if (zeroToSixty === null && mph >= 60) zeroToSixty = frame / fps;
    if (zeroToHundred === null && mph >= 100) zeroToHundred = frame / fps;
    if (quarterMile === null && Number(editor.playtestSession.distance || 0) >= 402.336) {
      quarterMile = frame / fps;
      quarterMileTrapMph = mph;
    }
  }
  return { zeroToSixty, zeroToHundred, quarterMile, quarterMileTrapMph, maxMph };
}

function simulateRaceBrakingDistance(editor, { startMph = 60, surface = 'asphalt', weather = 'clear', seconds = 12 } = {}) {
  editor.startPlaytest('starter-rwd');
  editor.selectedRace.weather = weather;
  editor.selectedRace.hazards = [];
  editor.selectedRace.road.segments.forEach((segment) => {
    segment.surface = surface;
    segment.hazardIds = [];
  });
  editor.playtestSession.hazards = [];
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = startMph * 0.44704;
  editor.playtestSession.previousDistance = editor.playtestSession.distance;
  editor.raceInput.activeBrakePointerId = 'brake';
  const startDistance = Number(editor.playtestSession.distance || 0);
  for (let frame = 0; frame < seconds * 60; frame += 1) {
    editor.updatePlaytest(1 / 60);
    if (Math.abs(editor.playtestSession.speedMps) < 0.5) break;
  }
  return Math.abs(Number(editor.playtestSession.distance || 0) - startDistance);
}

function seedLongStraightRace(editor) {
  editor.selectedRace.type = 'destination';
  editor.selectedRace.laps = 1;
  editor.selectedRace.road.width = 11;
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 20000, elevation: 0, role: 'finish' }
  ];
  editor.selectedRace.road.segments = [
    { length: 20000, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
}

function seedStockPerformanceStraight(editor) {
  editor.selectedRace.type = 'destination';
  editor.selectedRace.laps = 1;
  editor.selectedRace.hazards = [];
  editor.selectedRace.weather = 'clear';
  editor.selectedRace.road.width = 11;
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 100000, elevation: 0, role: 'finish' }
  ];
  editor.selectedRace.road.segments = [
    { length: 100000, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
}

function assertWithinRange(value, range, label) {
  assert.equal(Number.isFinite(value), true, label);
  assert.equal(value >= range[0] && value <= range[1], true, `${label}: ${value} not in ${range[0]}-${range[1]}`);
}

function getRaceTuningEffectSignature(editor, car = editor.selectedCar) {
  const tuning = editor.getRaceCarTuning(car);
  const stats = editor.getRaceTuningPerformanceStats(car);
  const modifiers = editor.getRaceSetupPhysicsModifiers(tuning, 26.8);
  const brake = editor.getRaceBrakeForceForInput({
    tuning,
    brake: 1,
    normalLoads: { fl: 3600, fr: 3600, rl: 2600, rr: 2600 },
    gripByWheel: { fl: 2, fr: 2, rl: 2, rr: 2 },
    speedMps: 30
  });
  return JSON.stringify({
    z60: Number(stats.zeroToSixty.toFixed(4)),
    z100: Number(stats.zeroToHundred.toFixed(4)),
    top: Number(stats.topSpeed.toFixed(4)),
    b60: Number(stats.braking60.toFixed(4)),
    lat60: Number(stats.lateralG60.toFixed(4)),
    pi: stats.piScore,
    redline1: Number(editor.getRaceRedlineSpeedMps(tuning, 1).toFixed(4)),
    redlines: tuning.gearRatios.map((_, index) => Number(editor.getRaceRedlineSpeedMps(tuning, index + 1).toFixed(4))),
    brake: Number(brake.force.toFixed(4)),
    brakeSplit: Object.fromEntries(Object.entries(brake.appliedByWheel).map(([key, value]) => [key, Number(value.toFixed(4))])),
    modifiers: Object.fromEntries(Object.entries(modifiers).map(([key, value]) => [key, Number(value.toFixed(4))]))
  });
}

test('Race Editor portrait uses shared bottom menu actions', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.draw(createMockContext(), 390, 844);

  const ids = editor.buttons.map((button) => button.id);
  assert.deepEqual(ids.slice(0, 4), ['menu', 'undo', 'redo', 'track-context']);
  assert.ok(editor.buttons.some((button) => button.bounds.y > 730 && button.onClick));
  assert.ok(editor.portraitThumbstick.radius > 0);
  assert.equal(raceEditorSource.includes("if (canRenderEditorSurface(this.activeViewportMode, 'bottom-action-rail')) {\n      drawSharedPortraitActionRail(ctx, layout.actionRail, this.portraitThumbstick, actions, {"), true);
  assert.equal(raceEditorSource.includes("reserveThumbstick: canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')"), true);
});

test('Race Editor starts on race-building controls and exposes Ground in portrait', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createFastMockContext();
  editor.draw(ctx, 390, 844);

  assert.equal(editor.activeRootId, 'track');
  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  assert.ok(menuButton);
  const menuPoint = {
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2
  };
  editor.handlePointerDown(menuPoint);
  editor.handlePointerUp(menuPoint);
  editor.draw(ctx, 390, 844);

  assert.ok(editor.buttons.some((button) => button.id === 'ground'));
});

test('Race Editor portrait bottom menu exposes authoring roots and top Play control', () => {
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

  ['file', 'track', 'ground', 'sprites', 'settings'].forEach((id) => {
    assert.ok(editor.buttons.some((button) => button.id === id), id);
  });
  assert.equal(editor.buttons.some((button) => button.id === 'drive'), false);
  assert.ok(editor.buttons.some((button) => button.id === 'test-drive' && button.bounds.y < 80), 'test-drive');

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
  assert.ok(editor.buttons.some((button) => button.id === 'hot-menu-surface'));
  assert.ok(editor.buttons.some((button) => button.id === 'hot-menu-width'));
  assert.ok(editor.buttons.some((button) => button.id === 'hot-menu-edit'));
  assert.equal(editor.buttons.some((button) => button.id === 'cycle-surface'), false);
  assert.equal(editor.buttons.some((button) => button.id === 'insert-node'), false);

  editor.buttons.find((button) => button.id === 'hot-menu-surface').onClick();
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'surface-asphalt'));
  assert.ok(editor.buttons.some((button) => button.id === 'surface-dirt'));
  assert.ok(editor.buttons.some((button) => button.id === 'segment-bumpiness'));

  editor.buttons.find((button) => button.id === 'hot-menu-back').onClick();
  editor.draw(ctx, 390, 844);
  editor.buttons.find((button) => button.id === 'hot-menu-width').onClick();
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'segment-width-3-6'));
  assert.ok(editor.buttons.some((button) => button.id === 'segment-width-24'));

  editor.buttons.find((button) => button.id === 'hot-menu-back').onClick();
  editor.draw(ctx, 390, 844);
  editor.buttons.find((button) => button.id === 'hot-menu-edit').onClick();
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'insert-node'));
  assert.ok(editor.buttons.some((button) => button.id === 'remove-edge'));

  editor.raceSelectionType = 'node';
  editor.racePortraitHotMenu = null;
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'hot-menu-edit'));
  assert.equal(editor.buttons.some((button) => button.id === 'move-node'), false);
  assert.equal(editor.buttons.some((button) => button.id === 'draw-road'), false);

  editor.buttons.find((button) => button.id === 'hot-menu-edit').onClick();
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'snap-node'));
  assert.ok(editor.buttons.some((button) => button.id === 'remove-node'));
  assert.equal(editor.buttons.some((button) => button.id === 'insert-node'), false);

  const menuButton = editor.buttons.find((button) => button.id === 'menu');
  editor.handlePointerDown({
    id: 'menu-button',
    x: menuButton.bounds.x + menuButton.bounds.w / 2,
    y: menuButton.bounds.y + menuButton.bounds.h / 2,
    button: 0
  });
  editor.draw(ctx, 390, 844);
  const trackButton = editor.buttons.find((button) => button.id === 'track');
  assert.ok(trackButton);
  assert.equal(editor.mobileRootOpen, true);
  editor.handlePointerDown({
    id: 'track-root',
    x: trackButton.bounds.x + trackButton.bounds.w / 2,
    y: trackButton.bounds.y + trackButton.bounds.h / 2,
    button: 0
  });
  editor.handlePointerUp({
    id: 'track-root-up',
    x: trackButton.bounds.x + trackButton.bounds.w / 2,
    y: trackButton.bounds.y + trackButton.bounds.h / 2,
    button: 0
  });
  assert.equal(editor.mobileRootOpen, false);
  assert.equal(editor.racePortraitMode, 'race');

  editor.handleMenuAction('paint-ground');
  assert.equal(editor.racePortraitMode, 'ground');
  assert.equal(editor.activeAction, 'paint-ground');
  editor.activeRootId = null;
  editor.menuScrollRegions = [];

  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-mode'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-paint'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-intensity'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-brush'));
  assert.equal(editor.buttons.some((button) => button.id === 'paint-ground'), false);
  assert.equal(editor.raceGroundBrushShape, 'round');
  assert.equal(editor.raceGroundBrushCells, 31);
  assert.equal(editor.raceGroundBrushHardness, 0.5);

  editor.buttons.find((button) => button.id === 'race-ground-mode').onClick();
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-mode-ground'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-mode-elevation'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-mode-sprites'));
  editor.buttons.find((button) => button.id === 'race-ground-mode-ground').onClick();

  editor.draw(ctx, 390, 844);
  editor.buttons.find((button) => button.id === 'race-ground-paint').onClick();
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'ground-tile-grass'));
  assert.ok(editor.buttons.some((button) => button.id === 'ground-tile-snow'));
  editor.buttons.find((button) => button.id === 'ground-tile-snow').onClick();
  assert.equal(editor.getSelectedGroundTileId(), 'snow');
  assert.equal(editor.activeAction, 'paint-ground');

  editor.handleMenuAction('race-ground-brush');
  editor.draw(ctx, 390, 844);
  assert.ok(editor.raceGroundBrushSliderRegions.some((region) => region.id === 'ground-brush-size-slider'));
  assert.ok(editor.raceGroundBrushSliderRegions.some((region) => region.id === 'ground-brush-opacity-slider'));
  assert.ok(editor.raceGroundBrushSliderRegions.some((region) => region.id === 'ground-brush-hardness-slider'));
  const sizeSlider = editor.raceGroundBrushSliderRegions.find((region) => region.id === 'ground-brush-size-slider');
  editor.handlePointerDown({ id: 'brush-size', x: sizeSlider.track.x + sizeSlider.track.w * 0.14, y: sizeSlider.track.y, button: 0 });
  editor.handlePointerUp({ id: 'brush-size', x: sizeSlider.track.x + sizeSlider.track.w * 0.14, y: sizeSlider.track.y, button: 0 });
  assert.ok(editor.raceGroundBrushCells >= 5);
  editor.handleMenuAction('ground-brush-strength-50');
  assert.equal(editor.raceGroundBrushStrength, 0.5);
  editor.handleMenuAction('ground-brush-falloff-soft');
  assert.equal(editor.raceGroundBrushFalloff, 'soft');
  assert.ok(editor.raceGroundBrushHardness < 1);
  editor.racePortraitHotMenu = null;
  editor.draw(ctx, 390, 844);

  const beforeCells = Object.keys(editor.selectedRace.road.tileMap.cells).length;
  editor.handlePointerDown({
    id: 'paint-ground',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.52,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.42,
    button: 0
  });
  const paintedCells = Object.values(editor.selectedRace.road.tileMap.cells);
  assert.equal(paintedCells.length > beforeCells, true);
  assert.ok(paintedCells.some((cell) => cell.tileWeights && cell.tileWeights.snow > 0 && cell.tileWeights.grass > 0));
  assert.equal(paintedCells.length >= 9, true);

  editor.handleMenuAction('race-ground-mode-elevation');
  editor.draw(ctx, 390, 844);
  editor.buttons.find((button) => button.id === 'race-ground-paint').onClick();
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-paint-raise'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-paint-lower'));
  editor.buttons.find((button) => button.id === 'race-ground-paint-raise').onClick();
  editor.draw(ctx, 390, 844);
  editor.buttons.find((button) => button.id === 'race-ground-intensity').onClick();
  editor.draw(ctx, 390, 844);
  assert.ok(editor.buttons.some((button) => button.id === 'elevation-up-tiny'));
  assert.ok(editor.buttons.some((button) => button.id === 'elevation-up-large'));
  editor.buttons.find((button) => button.id === 'elevation-up-large').onClick();
  assert.equal(editor.raceElevationBrushAmount, 0.1);
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-mode'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-paint'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-intensity'));
  assert.ok(editor.buttons.some((button) => button.id === 'race-ground-brush'));
  const beforeElevationCells = Object.keys(editor.selectedRace.road.tileMap.cells).length;
  const elevationPoint = {
    id: 'paint-elevation',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.68,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.52,
    button: 0
  };
  editor.handlePointerDown(elevationPoint);
  const firstElevation = Math.max(...Object.values(editor.selectedRace.road.tileMap.cells).map((cell) => Number(cell.elevation) || 0));
  editor.handlePointerDown(elevationPoint);
  const secondElevation = Math.max(...Object.values(editor.selectedRace.road.tileMap.cells).map((cell) => Number(cell.elevation) || 0));
  const elevationCells = Object.values(editor.selectedRace.road.tileMap.cells);
  assert.equal(elevationCells.length >= beforeElevationCells, true);
  assert.ok(elevationCells.some((cell) => typeof cell.elevation === 'number' && cell.source === 'height-brush'));
  assert.equal(secondElevation > firstElevation, true);
});

test('Race Editor migrates old coarse terrain cells to finer five meter cells', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.tileMap = {
    cellSizeM: 20,
    defaultTileId: 'grass',
    minElevation: -0.42,
    maxElevation: 0.42,
    cells: {
      '2,3': {
        tileId: 'snow',
        tileWeights: { grass: 0.25, snow: 0.75 },
        elevation: 0.2,
        source: 'tile-editor'
      }
    }
  };

  const tileMap = editor.ensureRaceTileMap();

  assert.equal(tileMap.cellSizeM, 5);
  assert.equal(tileMap.minElevation, -1);
  assert.equal(tileMap.maxElevation, 1);
  assert.equal(Object.keys(tileMap.cells).length, 16);
  assert.equal(tileMap.cells['8,12'].tileId, 'snow');
  assert.equal(tileMap.cells['11,15'].tileWeights.snow, 0.75);
  assert.equal(tileMap.cells['11,15'].elevation, 0.2);
});

test('Race Editor keeps terrain chunks eligible when painted cells miss the chunk center', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const tileMap = editor.ensureRaceTileMap();
  tileMap.cellSizeM = 5;
  tileMap.defaultTileId = 'grass';
  tileMap.cells = {
    '0,0': {
      tileId: 'grass',
      tileWeights: { grass: 1 },
      artRef: 'providenceGround',
      elevation: 0,
      source: 'tile-editor'
    }
  };
  tileMap.revision = 17;

  const chunk = editor.getRaceBakedTerrainChunk(0, 0, 40, tileMap, editor.getRaceTerrainBakeCache(tileMap, 40));

  assert.ok(chunk);
  assert.equal(chunk.tileCoverage.paintedCount, 1);
  assert.equal(chunk.tileCell.artRef, 'providenceGround');
  assert.equal(chunk.tileCell.explicit, true);
});

test('Race playtest camera safe elevation clamps above nearby terrain footprint', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const tileMap = editor.ensureRaceTileMap();
  tileMap.cellSizeM = 5;
  editor.setRaceTileMapCell(0, -2, { tileId: 'grass', elevation: 0.38 }, { invalidate: true });

  const safeElevation = editor.getRaceCameraSafeTerrainElevation({
    x: 0,
    z: -10,
    yaw: 0
  }, 0);

  assert.equal(safeElevation >= editor.getRaceGroundElevationAtWorldPoint({ x: 0, z: -10 }, 0), true);
  assert.equal(editor.getRaceRawGroundElevationAtWorldPoint({ x: 2.5, z: -7.5 }, 0), 0.38);
});

test('Race playtest camera no longer terrain-clamps during live rendering', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  let safeClampCalls = 0;
  editor.getRaceCameraSafeTerrainElevation = () => {
    safeClampCalls += 1;
    return 999;
  };

  editor.drawRaceProjectedRoadPath(createMockContext(), { x: 0, y: 0, w: 390, h: 260 }, { showPlaytestHud: false });

  assert.equal(safeClampCalls, 0);
  assert.equal(editor.lastRaceRenderCamera.camera.elevation < 999, true);
});

test('Race Editor collects selected race art refs for playtest preload', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const race = editor.selectedRace;
  race.skyboxArtRef = 'Skybox Art';
  race.surfaceArt = { asphalt: 'Asphalt Art', boundary: 'Fence Art' };
  race.margin = { artRef: 'Margin Art' };
  race.sceneryDefinitions = [{ artRef: 'Tree Art' }];
  race.scenery = [{ artRef: 'Bush Art' }];
  race.decals = [{ artRef: 'Skid Art' }];
  race.tireFx = {
    skidSmoke: { artRef: 'Smoke Art' },
    dirtDust: { artRef: 'Dust Art' },
    gravelDust: { artRef: 'Gravel Smoke Art' }
  };
  editor.selectedCar.art = {
    shell: 'WRX Shell',
    turnFrames: { left: 'WRX Left', center: 'WRX Center', right: 'WRX Right' }
  };
  race.competition = {
    aiDrivers: [{ carId: 'subaru-brz-2022', enabled: true }]
  };
  const aiCar = editor.project.cars.find((car) => car.id === 'subaru-brz-2022');
  aiCar.art = {
    shell: 'BRZ Shell',
    turnFrames: { center: 'BRZ Center' }
  };
  race.road.tileMap = {
    cellSizeM: 5,
    defaultTileId: 'grass',
    cells: {
      '0,0': { artRef: 'Ground Art' }
    }
  };

  const refs = editor.collectSelectedRaceArtRefs();

  ['Skybox Art', 'Asphalt Art', 'Fence Art', 'Margin Art', 'Tree Art', 'Bush Art', 'Skid Art', 'Smoke Art', 'Dust Art', 'Gravel Smoke Art', 'Ground Art', 'WRX Shell', 'WRX Left', 'WRX Center', 'WRX Right', 'BRZ Shell', 'BRZ Center'].forEach((ref) => {
    assert.equal(refs.includes(ref), true);
  });
});

test('Race playtest prewarms terrain resources before the first driving frame', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.ensureRaceTileMap().cells = {
    '0,0': { tileId: 'grass', explicit: true },
    '1,0': { tileId: 'dirt', explicit: true }
  };

  editor.startPlaytest('starter-rwd');

  assert.equal(Number(editor.lastRaceRenderStats?.prewarmTerrainChunks || 0) > 0, true);
  assert.equal(Number.isFinite(Number(editor.lastRaceRenderStats?.prewarmRenderMs)), true);
});

test('Race Editor top-down terrain coverage includes every painted terrain chunk', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const tileMap = editor.ensureRaceTileMap();
  tileMap.cellSizeM = 5;
  tileMap.defaultTileId = 'grass';
  tileMap.cells = {};
  for (let y = -2; y <= 9; y += 1) {
    for (let x = -3; x <= 8; x += 1) {
      tileMap.cells[`${x},${y}`] = {
        tileId: 'grass',
        tileWeights: { grass: 1 },
        artRef: 'providenceGround',
        elevation: ((x + y) % 3) * 0.02,
        source: 'tile-editor'
      };
    }
  }
  tileMap.revision = 23;
  const terrainSize = 40;
  const paintedChunkKeys = editor.getRacePaintedTerrainChunkKeys(tileMap, terrainSize);
  const cache = editor.getRaceTerrainBakeCache(tileMap, terrainSize);

  assert.equal(paintedChunkKeys.size > 0, true);
  paintedChunkKeys.forEach((key) => {
    const [chunkX, chunkZ] = key.split(',').map(Number);
    const chunk = editor.getRaceBakedTerrainChunk(chunkX, chunkZ, terrainSize, tileMap, cache);
    assert.ok(chunk, key);
    assert.equal(chunk.tileCoverage.paintedCount > 0, true, key);
    assert.equal(chunk.fullPoints.length, 4, key);
  });
});

test('Race Editor terrain camera culling keeps chunks whose bounds intersect the view', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const camera = { x: 0, z: 0 };
  const rightVector = { x: 1, z: 0 };
  const forwardVector = { x: 0, z: 1 };
  const edgeVisibleBounds = editor.getRaceTerrainCameraBounds([
    { x: 340, z: 80 },
    { x: 380, z: 80 },
    { x: 380, z: 120 },
    { x: 340, z: 120 }
  ], camera, rightVector, forwardVector);
  const centerOnlyOutside = Math.abs((edgeVisibleBounds.minCameraX + edgeVisibleBounds.maxCameraX) * 0.5) > 320;

  assert.equal(centerOnlyOutside, true);
  assert.equal(editor.isRaceTerrainCameraBoundsVisible(edgeVisibleBounds, {
    terrainSize: 40,
    terrainForwardDistance: 880,
    screenWidth: 390,
    lateralMargin: 64
  }), true);
});

test('Race Editor terrain mesh projection does not hard-floor clip terrain by default', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 0,
    elevation: 0,
    nearPlane: 1.6,
    farPlane: 2200,
    focalScale: 1.04,
    roadWidthScale: 2.2,
    roadMaxWidthRatio: 0.72,
    horizonRatio: 0.31,
    roadDepthRatio: 0.7
  };
  const raisedTerrain = [
    { x: -20, z: 40, elevation: 0.2 },
    { x: 20, z: 40, elevation: 0.2 },
    { x: 20, z: 80, elevation: 0.2 },
    { x: -20, z: 80, elevation: 0.2 }
  ];
  const stats = {};
  const unclipped = editor.getRaceWebGLWorldMeshVertices(bounds, raisedTerrain, {
    camera,
    cameraYaw: 0,
    textureWorldM: 1,
    meshSource: 'terrain',
    stats
  });
  const floorClippedStats = {};
  const floorClipped = editor.getRaceWebGLWorldMeshVertices(bounds, raisedTerrain, {
    camera,
    cameraYaw: 0,
    textureWorldM: 1,
    minScreenY: editor.getRaceProjectedTerrainTop(bounds, camera),
    meshSource: 'terrain',
    stats: floorClippedStats
  });

  assert.equal(unclipped.length > 0, true);
  assert.equal(floorClipped.length, 0);
  assert.equal(floorClippedStats.terrainProjectionFloorSkipped, 1);
  assert.equal(raceEditorSource.includes('terrainProjectionNearSkipped'), true);
  assert.equal(raceEditorSource.includes('terrainProjectionOffscreenSkipped'), true);
  assert.equal(raceEditorSource.includes('terrainProjectionFloorSkipped'), true);
  assert.equal(raceEditorSource.includes('terrainProjectionDegenerateSkipped'), true);
});

test('Race Editor raw terrain polygons near-clip straddling terrain and reject invisible terrain', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 0,
    elevation: 0,
    nearPlane: 1.6,
    farPlane: 2200,
    focalScale: 1.04,
    roadWidthScale: 2.2,
    roadMaxWidthRatio: 0.72,
    horizonRatio: 0.31,
    roadDepthRatio: 0.7
  };
  const stableNear = [
    { x: -2, z: 1.8, elevation: 0 },
    { x: 2, z: 2.4, elevation: 0 },
    { x: 2, z: 8, elevation: 0 },
    { x: -2, z: 8, elevation: 0 }
  ];
  const raw = editor.getRaceWebGLWorldMeshVertices(bounds, stableNear, {
    camera,
    cameraYaw: 0,
    textureWorldM: 1,
    meshSource: 'terrain',
    rawTerrainPolygons: true,
    stats: {}
  });
  const rawVs = [];
  for (let index = 0; index < raw.length; index += 6) rawVs.push(raw[index + 4] / raw[index + 5]);
  assert.equal(raw.length > 0, true);
  assert.equal(rawVs.some((value) => Math.abs(value + 1.8) < 0.00001), true);

  const straddleStats = {};
  const straddling = editor.getRaceWebGLWorldMeshVertices(bounds, [
    { x: -2, z: 0.4, elevation: 0 },
    { x: 2, z: 2.4, elevation: 0 },
    { x: 2, z: 8, elevation: 0 },
    { x: -2, z: 8, elevation: 0 }
  ], {
    camera,
    cameraYaw: 0,
    textureWorldM: 1,
    meshSource: 'terrain',
    rawTerrainPolygons: true,
    stats: straddleStats
  });
  assert.equal(straddling.length > 0, true);
  assert.equal(straddleStats.terrainProjectionNearSkipped || 0, 0);
  const clippedVs = [];
  const clippedDepths = [];
  for (let index = 0; index < straddling.length; index += 6) {
    assert.equal(Number.isFinite(straddling[index]), true);
    assert.equal(Number.isFinite(straddling[index + 1]), true);
    assert.equal(Number.isFinite(straddling[index + 3]), true);
    assert.equal(Number.isFinite(straddling[index + 4]), true);
    assert.equal(Number.isFinite(straddling[index + 5]), true);
    clippedVs.push(straddling[index + 4] / straddling[index + 5]);
    clippedDepths.push(1 / straddling[index + 5]);
  }
  assert.equal(clippedDepths.some((depth) => Math.abs(depth - camera.nearPlane) < 0.00001), true);
  assert.equal(clippedVs.every((value) => value <= -1.59999 && value >= -8.00001), true);

  const behindStats = {};
  const behind = editor.getRaceWebGLWorldMeshVertices(bounds, [
    { x: -4, z: -5, elevation: 0 },
    { x: 4, z: -5, elevation: 0 },
    { x: 4, z: -2, elevation: 0 },
    { x: -4, z: -2, elevation: 0 }
  ], {
    camera,
    cameraYaw: 0,
    meshSource: 'terrain',
    rawTerrainPolygons: true,
    stats: behindStats
  });
  assert.equal(behind.length, 0);
  assert.equal(behindStats.terrainProjectionNearSkipped, 1);

  const offscreenStats = {};
  const offscreen = editor.getRaceWebGLWorldMeshVertices(bounds, [
    { x: 900, z: 20, elevation: 0 },
    { x: 920, z: 20, elevation: 0 },
    { x: 920, z: 50, elevation: 0 },
    { x: 900, z: 50, elevation: 0 }
  ], {
    camera,
    cameraYaw: 0,
    meshSource: 'terrain',
    rawTerrainPolygons: true,
    stats: offscreenStats
  });
  assert.equal(offscreen.length, 0);
  assert.equal(offscreenStats.terrainProjectionOffscreenSkipped, 1);
  assert.equal(raceEditorSource.includes('rawTerrainPolygonsEnabled'), true);
  assert.equal(raceEditorSource.includes('getRaceRawProjectedTriangles'), true);
  assert.equal(raceEditorSource.includes('this.getRaceProjectedPolygonForWebGL(renderPoints, camera, cameraYaw, bounds)'), true);
});

test('Race Editor WebGL mesh textures use perspective-correct UV packing', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 0,
    elevation: 0,
    nearPlane: 1.6,
    farPlane: 2200,
    focalScale: 1.04,
    roadWidthScale: 2.2,
    roadMaxWidthRatio: 0.72,
    horizonRatio: 0.31,
    roadDepthRatio: 0.7
  };
  const vertices = editor.getRaceWebGLWorldMeshVertices(bounds, [
    { x: -4, z: 4, elevation: 0 },
    { x: 4, z: 4, elevation: 0 },
    { x: 4, z: 40, elevation: 0 },
    { x: -4, z: 40, elevation: 0 }
  ], {
    camera,
    cameraYaw: 0,
    textureWorldM: 2,
    meshSource: 'terrain'
  });
  const reconstructedUvs = [];
  const inverseDepths = [];
  for (let index = 0; index < vertices.length; index += 6) {
    const invDepth = vertices[index + 5];
    inverseDepths.push(invDepth);
    reconstructedUvs.push({
      u: vertices[index + 3] / invDepth,
      v: vertices[index + 4] / invDepth
    });
  }

  assert.equal(vertices.length % 18, 0);
  assert.equal(inverseDepths.some((value) => Math.abs(value - 0.25) < 0.00001), true);
  assert.equal(inverseDepths.some((value) => Math.abs(value - 0.025) < 0.00001), true);
  assert.equal(reconstructedUvs.some((uv) => Math.abs(uv.u - 2) < 0.00001 && Math.abs(uv.v + 20) < 0.00001), true);
  assert.equal(raceEditorSource.includes('aTexCoordOverDepth'), true);
  assert.equal(raceEditorSource.includes('aInvDepth'), true);
  assert.equal(raceEditorSource.includes('vec2 uv = vTexCoordOverDepth / max(vInvDepth, 0.000001);'), true);
  assert.equal(raceEditorSource.includes('gl.vertexAttribPointer(renderer.meshLocations.position, 2, gl.FLOAT, false, 24, 0);'), true);
  assert.equal(raceEditorSource.includes('gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);'), true);
});

test('Race Editor prioritizes road-corridor terrain before distant painted background chunks', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const candidates = [
    {
      cameraCellX: 10,
      cameraCellZ: 45,
      chunk: { key: 'road-left', nearRoad: true, roadAdjacent: true, roadDistance: 0 }
    },
    {
      cameraCellX: 0,
      cameraCellZ: 8,
      chunk: { key: 'background-near', nearRoad: false, roadAdjacent: false, roadDistance: 240 }
    },
    {
      cameraCellX: -10,
      cameraCellZ: 47,
      chunk: { key: 'road-right', nearRoad: true, roadAdjacent: true, roadDistance: 0 }
    }
  ];

  candidates.sort((a, b) => editor.compareRaceTerrainCandidates(a, b, 40));

  assert.deepEqual(candidates.map((candidate) => candidate.chunk.key), [
    'road-left',
    'road-right',
    'background-near'
  ]);
});

test('Race Editor keeps road-adjacent terrain at compatible detail near the camera', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  assert.equal(editor.getRaceBakedTerrainSubdivision({
    nearRoad: true,
    roadAdjacent: true,
    roadDistance: 0,
    elevationVariance: 0
  }, 340, { detailEnabled: true, textured: true }), 3);
  assert.equal(editor.getRaceBakedTerrainSubdivision({
    nearRoad: false,
    roadAdjacent: true,
    roadDistance: 70,
    elevationVariance: 0
  }, 320, { cameraCellX: 80, detailEnabled: true, textured: true }), 3);
});

test('Race Editor keeps Studio Sprint side terrain on matching near-road LOD', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const roadChunk = {
    nearRoad: true,
    roadAdjacent: true,
    roadDistance: 12,
    elevationVariance: 0.02
  };
  const sideChunk = {
    nearRoad: false,
    roadAdjacent: true,
    roadDistance: 58,
    elevationVariance: 0.02
  };

  assert.equal(editor.getRaceBakedTerrainSubdivision(roadChunk, 160, {
    cameraCellX: 20,
    detailEnabled: true,
    textured: true
  }), 3);
  assert.equal(editor.getRaceBakedTerrainSubdivision(sideChunk, 160, {
    cameraCellX: 60,
    detailEnabled: true,
    textured: true
  }), 3);
  assert.equal(editor.getRaceBakedTerrainSubdivision(sideChunk, 290, {
    cameraCellX: 160,
    detailEnabled: true,
    textured: true
  }), 3);
  assert.equal(editor.getRaceBakedTerrainSubdivision(sideChunk, 360, {
    cameraCellX: 160,
    detailEnabled: true,
    textured: true
  }), 3);
  assert.equal(editor.getRaceBakedTerrainSubdivision(sideChunk, 559, {
    cameraCellX: 240,
    detailEnabled: true,
    textured: true
  }), 3);
  assert.equal(editor.getRaceBakedTerrainSubdivision(sideChunk, 560, {
    cameraCellX: 240,
    detailEnabled: true,
    textured: true
  }), 3);
  assert.equal(raceEditorSource.includes('if (textured && roadCorridor && z < 560 && x <= 260) return 4;'), false);
  assert.equal(raceEditorSource.includes('if (textured && z < 130)'), false);
  assert.equal(raceEditorSource.includes('if (textured && roadCorridor'), false);
});

test('Race Editor textured terrain LOD stays stable as camera moves slowly', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const roadChunk = {
    nearRoad: true,
    roadAdjacent: true,
    roadDistance: 8,
    elevationVariance: 0.02
  };
  const sideChunk = {
    nearRoad: false,
    roadAdjacent: true,
    roadDistance: 64,
    elevationVariance: 0.02
  };
  const roughChunk = {
    nearRoad: false,
    roadAdjacent: false,
    roadDistance: 220,
    elevationVariance: 0.12
  };
  const cameraSamples = [
    { cameraCellX: -80, cameraCellZ: 24 },
    { cameraCellX: 0, cameraCellZ: 96 },
    { cameraCellX: 120, cameraCellZ: 260 },
    { cameraCellX: 260, cameraCellZ: 620 }
  ];

  [roadChunk, sideChunk, roughChunk].forEach((chunk) => {
    const subdivisions = cameraSamples.map((sample) => editor.getRaceBakedTerrainSubdivision(chunk, sample.cameraCellZ, {
      cameraCellX: sample.cameraCellX,
      detailEnabled: true,
      textured: true
    }));
    assert.equal(subdivisions.every((value) => value === subdivisions[0]), true);
  });
});

test('Race Editor renders default terrain chunks even when painted ground exists elsewhere', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const tileMap = editor.ensureRaceTileMap();
  tileMap.cellSizeM = 5;
  tileMap.defaultTileId = 'grass';
  tileMap.cells = {
    '0,0': {
      tileId: 'dirt',
      tileWeights: { dirt: 1 },
      artRef: 'painted-ground',
      explicit: true
    }
  };
  tileMap.revision = (Number(tileMap.revision) || 0) + 1;
  const cache = editor.getRaceTerrainBakeCache(tileMap, 80);
  const paintedChunk = editor.getRaceBakedTerrainChunk(0, 0, 80, tileMap, cache);
  const defaultChunk = editor.getRaceBakedTerrainChunk(8, 8, 80, tileMap, cache);

  assert.equal(editor.getRaceTileMapStats(tileMap).hasPaintedTerrainCells, true);
  assert.equal(paintedChunk.tileCoverage.paintedCount > 0, true);
  assert.equal(defaultChunk.tileCoverage.paintedCount, 0);
  assert.equal(defaultChunk.tileCell.tileId, 'grass');
  assert.equal(editor.shouldIncludeRaceTerrainChunkForRendering(defaultChunk), true);
  assert.equal(raceEditorSource.includes('hasPaintedTerrainCells && !chunk.tileCoverage?.paintedCount'), false);
});

test('Race Editor terrain render limits extend far coverage and keep enough budget for default ground', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const normal = editor.getRaceTerrainRenderLimits({
    terrainSize: 80,
    roadFarCameraZ: 560,
    detailEnabled: false,
    terrainBudgetEnabled: true
  });
  const longView = editor.getRaceTerrainRenderLimits({
    terrainSize: 80,
    roadFarCameraZ: 3200,
    detailEnabled: false,
    terrainBudgetEnabled: true
  });
  const detailed = editor.getRaceTerrainRenderLimits({
    terrainSize: 40,
    roadFarCameraZ: 1200,
    detailEnabled: true,
    terrainBudgetEnabled: true
  });

  assert.equal(normal.terrainForwardDistance >= 2200, true);
  assert.equal(longView.terrainForwardDistance > 3200, true);
  assert.equal(longView.terrainCellRadius > normal.terrainCellRadius, true);
  assert.equal(normal.maxTerrainCells >= 1400, true);
  assert.equal(detailed.maxTerrainCells >= 2600, true);
  assert.equal(editor.getRaceTerrainCandidatePriority({
    cameraCellX: 0,
    cameraCellZ: 180,
    chunk: { nearRoad: false, roadAdjacent: false, roadDistance: 240 }
  }, 80) < editor.getRaceTerrainCandidatePriority({
    cameraCellX: 0,
    cameraCellZ: 2600,
    chunk: { nearRoad: true, roadAdjacent: true, roadDistance: 0 }
  }, 80), true);
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
    'cycle-surface'
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
  assert.equal(raceEditorSource.includes('top-down track editor'), false);
  assert.equal(raceEditorSource.includes('drawRaceMapScaleBar(ctx, bounds)'), true);
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
  const paintedCells = Object.values(road.tileMap.cells);
  assert.ok(paintedCells.length >= 1);
  assert.ok(paintedCells.some((cell) => cell.tileId === selectedTile));
  assert.ok(paintedCells.some((cell) => cell.source === 'tile-editor'));
  assert.ok(paintedCells.some((cell) => cell.tileLabel === 'Snow Block'));
  assert.ok(paintedCells.some((cell) => typeof cell.elevation === 'number'));

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
  const baselineSection = editor.getRaceRoadCrossSectionAtDistance(80);
  const tileMap = editor.ensureRaceTileMap();
  [centerPose, baselineSection.left, baselineSection.center, baselineSection.right].forEach((point) => {
    const cell = editor.getRaceTileMapCellCoords({ x: point.x, z: point.z }, tileMap);
    editor.setRaceTileMapCell(cell.cellX, cell.cellY, {
      tileId: 'snow',
      source: 'height-brush',
      elevation: 0.42
    });
  });

  const section = editor.getRaceRoadCrossSectionAtDistance(80);

  const smoothedLeftGround = editor.getRaceGroundElevationAtWorldPoint(section.left, 0);
  assert.equal(editor.getRaceRawGroundElevationAtWorldPoint(section.left, 0), 0.42);
  assert.equal(smoothedLeftGround > 0, true);
  assert.equal(smoothedLeftGround < 0.42, true);
  assert.equal(editor.getRaceStitchedTerrainElevationAtWorldPoint(section.center, 0), section.center.elevation);
  assert.equal(Math.abs(editor.getRaceStitchedTerrainElevationAtWorldPoint(section.left, 0) - section.left.elevation) < 0.0001, true);
  assert.equal(section.left.elevation, section.center.elevation);
  assert.equal(section.right.elevation, section.center.elevation);

  const shoulderOnly = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  seedEditableRaceRoute(shoulderOnly);
  const shoulderSection = shoulderOnly.getRaceRoadCrossSectionAtDistance(80);
  const shoulderCell = shoulderOnly.getRaceTileMapCellCoords(shoulderSection.shoulderLeft, shoulderOnly.ensureRaceTileMap());
  shoulderOnly.setRaceTileMapCell(shoulderCell.cellX, shoulderCell.cellY, {
    tileId: 'snow',
    source: 'height-brush',
    elevation: 0.42
  });
  const shoulderRaisedSection = shoulderOnly.getRaceRoadCrossSectionAtDistance(80);
  assert.equal(Math.abs(
    shoulderOnly.getRaceStitchedTerrainElevationAtWorldPoint(shoulderRaisedSection.shoulderLeft, 0) - shoulderRaisedSection.shoulderLeft.elevation
  ) < 0.0001, true);
  assert.equal(raceEditorSource.includes('getRaceRoadCorridorSampleAtDistance'), true);
  assert.equal(raceEditorSource.includes('getRaceRawGroundElevationAtWorldPoint'), true);
  assert.equal(raceEditorSource.includes('getRaceSmoothedGroundElevationAtWorldPoint'), true);
  assert.equal(raceEditorSource.includes('getRaceStitchedTerrainElevationAtWorldPoint'), true);
  assert.equal(raceEditorSource.includes('return samples;'), true);
});

test('Race Editor smooths painted terrain elevation between tile cells', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const tileMap = editor.ensureRaceTileMap();
  tileMap.cellSizeM = 5;
  editor.setRaceTileMapCell(0, 0, { tileId: 'grass', source: 'height-test', elevation: 0 }, { invalidate: false });
  editor.setRaceTileMapCell(1, 0, { tileId: 'grass', source: 'height-test', elevation: 1 }, { invalidate: false });
  editor.invalidateRaceTerrainCaches(tileMap);

  const leftCenter = editor.getRaceGroundElevationAtWorldPoint({ x: 2.5, z: 2.5 }, 0);
  const betweenCells = editor.getRaceGroundElevationAtWorldPoint({ x: 5, z: 2.5 }, 0);
  const rightCenter = editor.getRaceGroundElevationAtWorldPoint({ x: 7.5, z: 2.5 }, 0);

  assert.equal(leftCenter < betweenCells, true);
  assert.equal(betweenCells < rightCenter, true);
  assert.equal(Math.abs(betweenCells - 0.5) < 0.0001, true);
});

test('Race Editor lifts the road deck above both terrain edges before stitching shoulders', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  seedEditableRaceRoute(editor);
  const section = editor.getRaceRoadCrossSectionAtDistance(80);
  const tileMap = editor.ensureRaceTileMap();
  const leftCell = editor.getRaceTileMapCellCoords(section.left, tileMap);
  const shoulderCell = editor.getRaceTileMapCellCoords(section.shoulderLeft, tileMap);
  editor.setRaceTileMapCell(leftCell.cellX, leftCell.cellY, {
    tileId: 'grass',
    source: 'height-test',
    elevation: 1
  }, { invalidate: false });
  editor.setRaceTileMapCell(shoulderCell.cellX, shoulderCell.cellY, {
    tileId: 'grass',
    source: 'height-test',
    elevation: 1
  }, { invalidate: false });
  editor.invalidateRaceTerrainCaches(tileMap);

  const raisedSection = editor.getRaceRoadCrossSectionAtDistance(80);
  const rawLeft = editor.getRaceGroundElevationAtWorldPoint(raisedSection.left, 0);
  const finalLeft = editor.getRaceStitchedTerrainElevationAtWorldPoint(raisedSection.left, 0);
  const finalShoulder = editor.getRaceStitchedTerrainElevationAtWorldPoint(raisedSection.shoulderLeft, 0);

  assert.equal(raisedSection.center.elevation >= rawLeft, true);
  assert.equal(raisedSection.left.elevation >= rawLeft, true);
  assert.equal(Math.abs(finalLeft - raisedSection.left.elevation) < 0.0001, true);
  assert.equal(Math.abs(finalShoulder - raisedSection.shoulderLeft.elevation) < 0.0001, true);
  assert.equal(Math.abs(raisedSection.left.elevation - raisedSection.center.elevation) < 0.0001, true);
});

test('Race Editor keeps road deck above deterministic random terrain', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 160, elevation: 0.22 },
    { x: 92, y: 260, elevation: -0.18 },
    { x: 185, y: 170, elevation: 0.36 },
    { x: 245, y: 330, elevation: 0.05 }
  ];
  editor.selectedRace.road.segments = [
    { length: 160, curve: 0, elevation: 0.22, roadWidthM: 6, shoulderWidthM: 2, surface: 'asphalt' },
    { length: 136, curve: 0.48, elevation: -0.18, roadWidthM: 6, shoulderWidthM: 2, surface: 'asphalt' },
    { length: 130, curve: -0.52, elevation: 0.36, roadWidthM: 6, shoulderWidthM: 2, surface: 'asphalt' },
    { length: 172, curve: 0.3, elevation: 0.05, roadWidthM: 6, shoulderWidthM: 2, surface: 'asphalt' }
  ];
  const tileMap = editor.ensureRaceTileMap();
  tileMap.minElevation = -1;
  tileMap.maxElevation = 1;
  tileMap.cells = {};
  const deterministicElevation = (cellX, cellY) => {
    const value = Math.sin(cellX * 12.9898 + cellY * 78.233) * 43758.5453;
    return Math.round(((value - Math.floor(value)) * 1.8 - 0.9) * 1000) / 1000;
  };
  for (let cellY = -10; cellY <= 80; cellY += 1) {
    for (let cellX = -12; cellX <= 58; cellX += 1) {
      editor.setRaceTileMapCell(cellX, cellY, {
        tileId: 'grass',
        tileWeights: { grass: 1 },
        source: 'height-test',
        elevation: deterministicElevation(cellX, cellY)
      }, { invalidate: false });
    }
  }
  const highPose = editor.getRaceWorldPoseAtDistance(80);
  const highCell = editor.getRaceTileMapCellCoords(highPose, tileMap);
  editor.setRaceTileMapCell(highCell.cellX, highCell.cellY, {
    tileId: 'grass',
    tileWeights: { grass: 1 },
    source: 'height-test',
    elevation: 0.92
  }, { invalidate: false });
  editor.invalidateRaceTerrainCaches(tileMap);

  const routeLength = editor.getRaceRouteLength();
  let checked = 0;
  for (let distance = 0; distance <= routeLength; distance += 17) {
    const section = editor.getRaceRoadCrossSectionAtDistance(distance);
    const sectionPoints = [section.center, section.left, section.right, section.shoulderLeft, section.shoulderRight];
    sectionPoints.forEach((point) => {
      const finalGround = editor.getRaceStitchedTerrainElevationAtWorldPoint(point, 0);
      assert.equal(Math.abs(point.elevation - finalGround) < 0.0001, true);
      checked += 1;
    });
    assert.equal(Math.abs(section.left.elevation - section.center.elevation) < 0.0001, true);
    assert.equal(Math.abs(section.right.elevation - section.center.elevation) < 0.0001, true);
    assert.equal(Math.abs(section.shoulderLeft.elevation - section.center.elevation) < 0.0001, true);
    assert.equal(Math.abs(section.shoulderRight.elevation - section.center.elevation) < 0.0001, true);
  }

  const highSection = editor.getRaceRoadCrossSectionAtDistance(80);
  assert.equal(editor.getRaceRawGroundElevationAtWorldPoint({
    x: (highCell.cellX + 0.5) * tileMap.cellSizeM,
    z: (highCell.cellY + 0.5) * tileMap.cellSizeM
  }, 0), 0.92);
  assert.equal(Math.abs(highSection.center.elevation - editor.getRaceStitchedTerrainElevationAtWorldPoint(highSection.center, 0)) < 0.0001, true);
  assert.equal(checked > 80, true);
  assert.equal(raceEditorSource.includes('getRaceRoadSurfaceProfileAtDistance(distance'), true);
  assert.equal(raceEditorSource.includes('getRaceRoadDeckElevationAtDistance(distance'), true);
  assert.equal(raceEditorSource.includes('getRaceRoadDeckElevationForProjection(projection'), true);
  assert.equal(raceEditorSource.includes('getRaceWebGLMeshElevationOffsetForSource(source'), true);
});

test('Race Editor stable road sections keep world vertices fixed as the camera moves', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 360, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 360, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 2, hazardIds: [] }
  ];
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const cameraA = {
    x: 0,
    z: 84,
    elevation: 0.3,
    nearPlane: 1.2,
    farPlane: 900,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.35,
    roadMaxWidthRatio: 1
  };
  const cameraB = { ...cameraA, z: 87 };
  const sectionsA = editor.getRaceStableRoadSections({
    bounds,
    camera: cameraA,
    cameraYaw: 0,
    visualTravel: 120,
    routeLength: 360,
    routeRuntimeType: 'destination',
    viewDistance: 340,
    backDistance: 42
  });
  const sectionsB = editor.getRaceStableRoadSections({
    bounds,
    camera: cameraB,
    cameraYaw: 0,
    visualTravel: 123,
    routeLength: 360,
    routeRuntimeType: 'destination',
    viewDistance: 340,
    backDistance: 42
  });
  const byDistanceB = new Map(sectionsB.map((section) => [Math.round(Number(section.center.distance || 0) * 1000), section]));
  const common = sectionsA.filter((section) => byDistanceB.has(Math.round(Number(section.center.distance || 0) * 1000)));

  assert.equal(common.length > 20, true);
  common.forEach((sectionA) => {
    const sectionB = byDistanceB.get(Math.round(Number(sectionA.center.distance || 0) * 1000));
    ['center', 'left', 'right', 'shoulderLeft', 'shoulderRight'].forEach((key) => {
      assert.equal(Math.abs(Number(sectionA[key].x || 0) - Number(sectionB[key].x || 0)) < 0.000001, true);
      assert.equal(Math.abs(Number(sectionA[key].z || 0) - Number(sectionB[key].z || 0)) < 0.000001, true);
      assert.equal(Math.abs(Number(sectionA[key].elevation || 0) - Number(sectionB[key].elevation || 0)) < 0.000001, true);
    });
  });
  assert.equal(raceEditorSource.includes('getRaceStableRoadSections({'), true);
  assert.equal(raceEditorSource.includes('getRaceStableRoadBands(sections = [])'), true);
});

test('Race Editor stable road bands keep road shoulder and boundary segment anchors aligned', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 260, elevation: 0.12 }
  ];
  editor.selectedRace.road.segments = [
    { length: 260, curve: 0, elevation: 0.12, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 2, hazardIds: [] }
  ];
  const sections = editor.getRaceStableRoadSections({
    bounds: { x: 0, y: 0, w: 390, h: 240 },
    camera: {
      x: 0,
      z: 90,
      elevation: 0.2,
      nearPlane: 1.2,
      farPlane: 900,
      focalScale: 1,
      roadWidthScale: 1,
      roadDepthRatio: 0.7,
      horizonRatio: 0.35,
      roadMaxWidthRatio: 1
    },
    cameraYaw: 0,
    visualTravel: 116,
    routeLength: 260,
    routeRuntimeType: 'destination',
    viewDistance: 260,
    backDistance: 36
  });
  const bands = editor.getRaceStableRoadBands(sections);

  assert.equal(bands.length > 12, true);
  bands.forEach((band) => {
    assert.equal(Number.isFinite(Number(band.near.center.distance)), true);
    assert.equal(Number.isFinite(Number(band.far.center.distance)), true);
    assert.equal(Math.abs(Number(band.near.left.distance) - Number(band.near.center.distance)) < 0.000001, true);
    assert.equal(Math.abs(Number(band.near.shoulderLeft.distance) - Number(band.near.center.distance)) < 0.000001, true);
    assert.equal(Math.abs(Number(band.far.right.distance) - Number(band.far.center.distance)) < 0.000001, true);
    assert.equal(Math.abs(Number(band.far.shoulderRight.distance) - Number(band.far.center.distance)) < 0.000001, true);
  });
  assert.equal(raceEditorSource.includes('stableRoadSections = []'), true);
  assert.equal(raceEditorSource.includes('const trackBands = stableRoadBands.length ? stableRoadBands : mode7Bands;'), true);
});

test('Race Editor roadbed profile smooths terrain support without dropping below road edges', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 180, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 180, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 2, hazardIds: [] }
  ];
  editor.getRaceGroundElevationAtWorldPoint = (point = {}, fallback = 0) => {
    const z = Number(point.z ?? point.y ?? 0);
    const x = Math.abs(Number(point.x || 0));
    if (z > 72 && z < 108 && x > 2.6 && x < 4.2) return 0.34;
    if (z > 66 && z < 114 && x < 2.4) return 0.08;
    return Number(fallback) || 0;
  };
  editor.raceRoadbedProfileCache.clear();
  editor.raceRoadCorridorCache.clear();

  const profile = editor.getRaceRoadbedProfile({ runtimeType: 'destination', routeLength: 180 });
  const supported = profile.samples.filter((sample) => Number(sample.distance || 0) > 74 && Number(sample.distance || 0) < 106);
  const maxStep = profile.samples.slice(1).reduce((worst, sample, index) => Math.max(
    worst,
    Math.abs(Number(sample.elevation || 0) - Number(profile.samples[index].elevation || 0))
  ), 0);

  assert.equal(supported.every((sample) => Number(sample.elevation || 0) >= Number(sample.supportElevation || 0) - 0.0001), true);
  assert.equal(Math.max(...supported.map((sample) => Number(sample.elevation || 0))) >= 0.34, true);
  assert.equal(maxStep <= 0.08, true);
});

test('Race Editor replaces road-corridor terrain quads with road-owned seam strips', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 220, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 2, hazardIds: [] }
  ];
  editor.invalidateRaceTerrainCaches();
  const roadQuad = [
    { x: -6, z: 80, elevation: 0 },
    { x: 6, z: 80, elevation: 0 },
    { x: 6, z: 92, elevation: 0 },
    { x: -6, z: 92, elevation: 0 }
  ];
  const outsideQuad = [
    { x: 34, z: 80, elevation: 0.35 },
    { x: 46, z: 80, elevation: 0.35 },
    { x: 46, z: 92, elevation: 0.35 },
    { x: 34, z: 92, elevation: 0.35 }
  ];
  const chunk = {
    roadAdjacent: true,
    nearRoad: true
  };
  editor.getRaceGroundElevationAtWorldPoint = (point = {}, fallback = 0) => (
    Math.abs(Number(point.x || 0)) < 10 ? 0 : Number(fallback) || 0
  );
  editor.raceRoadbedProfileCache.clear();
  editor.raceRoadCorridorCache.clear();
  editor.raceSurfaceBakeCache = null;
  const roadStitched = editor.getRaceStitchedTerrainElevationAtWorldPoint({ x: 0, z: 86 }, 0.4);
  const outsideStitched = editor.getRaceStitchedTerrainElevationAtWorldPoint({ x: 40, z: 86 }, 0.4);
  const transitionSurface = editor.getRaceCompositedSurfaceAtWorldPoint({ x: 30, z: 86 }, 0.4);
  const roadSurface = editor.getRaceCompositedSurfaceAtWorldPoint({ x: 0, z: 86 }, 0.4);

  assert.equal(editor.getRaceRoadbedTerrainSubdivision(chunk, 80) >= 6, true);
  assert.equal(editor.isRaceTerrainQuadInsideRoadCorridor(roadQuad, { runtimeType: 'destination' }), true);
  assert.equal(editor.isRaceTerrainQuadInsideRoadCorridor(outsideQuad, { runtimeType: 'destination' }), false);
  assert.equal(roadStitched < outsideStitched, true);
  assert.equal(roadSurface.region, 'road');
  assert.equal(transitionSurface.region === 'transition' || transitionSurface.region === 'terrain', true);
  assert.equal(transitionSurface.elevation >= roadSurface.elevation, true);
  assert.equal(raceEditorSource.includes('getRaceSurfaceBake({'), true);
  assert.equal(raceEditorSource.includes('terrainRoadCorridorSkipped'), true);
  assert.equal(raceEditorSource.includes('getRaceRoadsideTerrainBlendMeshes'), true);
});

test('Race Editor terrain cutout keeps straddling terrain until subquad center enters fused track corridor', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 220, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 2, hazardIds: [] }
  ];
  editor.invalidateRaceTerrainCaches();

  const centerInside = [
    { x: -12, z: 80 },
    { x: 12, z: 80 },
    { x: 12, z: 92 },
    { x: -12, z: 92 }
  ];
  const outsideCenter = [
    { x: 11, z: 80 },
    { x: 79, z: 80 },
    { x: 79, z: 92 },
    { x: 11, z: 92 }
  ];

  assert.equal(editor.isRaceTerrainQuadInsideRoadCorridor(centerInside, { runtimeType: 'destination' }), true);
  assert.equal(editor.isRaceTerrainQuadInsideRoadCorridor(outsideCenter, { runtimeType: 'destination' }), false);
});

test('Race Editor terrain cutout removes only the hard road corridor, not the transition band', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 220, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 0, hazardIds: [] }
  ];
  editor.selectedRace.margin = {
    marginMode: 'off',
    shoulderMode: 'off',
    widthM: 0.22,
    shoulderWidthM: 0,
    collisionMode: 'none',
    collisionEdge: 'none',
    collisionEffect: 'collide'
  };
  editor.invalidateRaceTerrainCaches();

  const transitionQuad = [
    { x: -3.68, z: 80 },
    { x: -3.45, z: 80 },
    { x: -3.45, z: 92 },
    { x: -3.68, z: 92 }
  ];

  assert.equal(editor.isRaceTerrainQuadInsideRoadCorridor(transitionQuad, {
    runtimeType: 'destination',
    tolerance: 0.25,
    includeTransition: false
  }), false);
  assert.equal(editor.isRaceTerrainQuadInsideRoadCorridor(transitionQuad, {
    runtimeType: 'destination',
    tolerance: 0.25,
    includeTransition: true
  }), true);
});

test('Race Editor terrain seam joins the outermost visible road edge', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 220, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 0, hazardIds: [] }
  ];
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 80,
    elevation: 0.2,
    nearPlane: 1.2,
    farPlane: 900,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.35,
    roadMaxWidthRatio: 1
  };
  const samePoint = (actual, expected) => {
    assert.equal(Math.abs(Number(actual?.x || 0) - Number(expected?.x || 0)) < 0.000001, true);
    assert.equal(Math.abs(Number(actual?.z || 0) - Number(expected?.z || 0)) < 0.000001, true);
    assert.equal(Math.abs(Number(actual?.elevation || 0) - Number(expected?.elevation || 0)) < 0.000001, true);
  };
  const seamFor = (margin) => {
    editor.selectedRace.margin = {
      widthM: 0.44,
      shoulderWidthM: 12,
      collisionMode: 'none',
      collisionEdge: 'none',
      collisionEffect: 'collide',
      ...margin
    };
    editor.invalidateRaceTerrainCaches(editor.ensureRaceTileMap());
    const sections = editor.getRaceStableRoadSections({
      bounds,
      camera,
      cameraYaw: 0,
      visualTravel: 80,
      routeLength: 220,
      routeRuntimeType: 'destination',
      viewDistance: 160,
      backDistance: 20
    });
    const bands = editor.getRaceStableRoadBands(sections);
    const seamMeshes = editor.getRaceRoadsideTerrainBlendMeshes(bands, {
      currentSegment: editor.selectedRace.road.segments[0],
      routeLength: 220,
      runtimeType: 'destination',
      allowVisualExtension: true
    });
    return {
      band: bands[0],
      leftFlat: seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-flat-left'),
      rightFlat: seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-flat-right'),
      leftSeam: seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-left'),
      rightSeam: seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-right')
    };
  };

  [
    { margin: { marginMode: 'off', shoulderMode: 'off', enabled: false, shoulderEnabled: false }, edge: 'left' },
    { margin: { marginMode: 'on', shoulderMode: 'off', enabled: true, shoulderEnabled: false }, edge: 'marginLeft' },
    { margin: { marginMode: 'on', shoulderMode: 'on', enabled: true, shoulderEnabled: true }, edge: 'shoulderLeft' },
    { margin: { marginMode: 'hidden', shoulderMode: 'hidden', enabled: true, shoulderEnabled: true }, edge: 'left' }
  ].forEach(({ margin, edge }) => {
    const {
      band, leftFlat, rightFlat, leftSeam, rightSeam
    } = seamFor(margin);
    assert.ok(leftFlat);
    assert.ok(rightFlat);
    assert.ok(leftSeam);
    assert.ok(rightSeam);
    samePoint(leftFlat.points[1], band.far[edge]);
    samePoint(leftFlat.points[2], band.near[edge]);
    samePoint(leftSeam.points[1], leftFlat.points[0]);
    samePoint(leftSeam.points[2], leftFlat.points[3]);
    if (edge !== 'shoulderLeft') {
      assert.equal(Math.abs(Math.abs(Number(leftFlat.points[0].lateralOffset || 0)) - Math.abs(Number(leftFlat.points[1].lateralOffset || 0))) <= 1, true);
    }
    const rightEdge = edge === 'left' ? 'right' : edge === 'marginLeft' ? 'marginRight' : 'shoulderRight';
    samePoint(rightFlat.points[0], band.far[rightEdge]);
    samePoint(rightFlat.points[3], band.near[rightEdge]);
    samePoint(rightSeam.points[0], rightFlat.points[1]);
    samePoint(rightSeam.points[3], rightFlat.points[2]);
  });
});

test('Race Editor Studio Sprint roadside seam meshes share baked shoulder coordinates with the road bands', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  assert.equal(editor.selectedRace.name, 'Studio Sprint');
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const visualTravel = 470;
  const routeLength = editor.getRaceRouteLength();
  const camera = {
    x: -28,
    z: 458,
    elevation: 0.35,
    nearPlane: 1.2,
    farPlane: 1300,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.35,
    roadMaxWidthRatio: 1
  };
  const sections = editor.getRaceStableRoadSections({
    bounds,
    camera,
    cameraYaw: Math.PI * 0.5,
    visualTravel,
    routeLength,
    routeRuntimeType: editor.getSelectedRaceRuntimeType(),
    viewDistance: 420,
    backDistance: 60
  });
  const bands = editor.getRaceStableRoadBands(sections);
  const seamMeshes = editor.getRaceRoadsideTerrainBlendMeshes(bands, {
    currentSegment: editor.getRaceSegmentAtDistance(visualTravel).segment,
    useSunShading: false,
    minScreenY: null
  });
  const leftSeam = seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-left');
  const rightSeam = seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-right');
  const leftFlat = seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-flat-left');
  const rightFlat = seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-flat-right');
  const firstBand = bands[0];

  assert.equal(bands.length > 8, true);
  assert.ok(leftFlat);
  assert.ok(rightFlat);
  assert.ok(leftSeam);
  assert.ok(rightSeam);
  [
    [leftFlat.points[1], firstBand.far.shoulderLeft],
    [leftFlat.points[2], firstBand.near.shoulderLeft],
    [rightFlat.points[0], firstBand.far.shoulderRight],
    [rightFlat.points[3], firstBand.near.shoulderRight],
    [leftSeam.points[1], leftFlat.points[0]],
    [leftSeam.points[2], leftFlat.points[3]],
    [rightSeam.points[0], rightFlat.points[1]],
    [rightSeam.points[3], rightFlat.points[2]]
  ].forEach(([actual, expected]) => {
    assert.equal(Math.abs(Number(actual.x || 0) - Number(expected.x || 0)) < 0.000001, true);
    assert.equal(Math.abs(Number(actual.z || 0) - Number(expected.z || 0)) < 0.000001, true);
    assert.equal(Math.abs(Number(actual.elevation || 0) - Number(expected.elevation || 0)) < 0.000001, true);
  });
  assert.equal(leftFlat.points[0].roadDeckElevation, false);
  assert.equal(rightFlat.points[1].roadDeckElevation, false);
  assert.equal(leftSeam.points[0].roadDeckElevation, false);
  assert.equal(rightSeam.points[1].roadDeckElevation, false);
  assert.equal(leftSeam.points[0].edge === 'transition-left' || leftSeam.points[0].edge === 'terrain-left', true);
  assert.equal(rightSeam.points[1].edge === 'transition-right' || rightSeam.points[1].edge === 'terrain-right', true);
});

test('Race Editor Studio Sprint strip stack has no lateral seam gaps from road to terrain', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  assert.equal(editor.selectedRace.name, 'Studio Sprint');
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const visualTravel = 470;
  const routeLength = editor.getRaceRouteLength();
  const camera = {
    x: -28,
    z: 458,
    elevation: 0.35,
    nearPlane: 1.2,
    farPlane: 1300,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.35,
    roadMaxWidthRatio: 1
  };
  const sections = editor.getRaceStableRoadSections({
    bounds,
    camera,
    cameraYaw: Math.PI * 0.5,
    visualTravel,
    routeLength,
    routeRuntimeType: editor.getSelectedRaceRuntimeType(),
    viewDistance: 420,
    backDistance: 60
  });
  const bands = editor.getRaceStableRoadBands(sections);
  const firstBand = bands[0];
  const boundaryMeshes = editor.getRaceWebGLBoundaryStripMeshes(firstBand.near, firstBand.far);
  const seamMeshes = editor.getRaceRoadsideTerrainBlendMeshes(bands, {
    currentSegment: editor.getRaceSegmentAtDistance(visualTravel).segment,
    artRef: 'benchGround',
    textured: true,
    textureWorldM: 2.5
  });
  const leftBoundary = boundaryMeshes.find((mesh) => mesh.source === 'boundary-left');
  const rightBoundary = boundaryMeshes.find((mesh) => mesh.source === 'boundary-right');
  const leftSeam = seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-left');
  const rightSeam = seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-right');
  const samePoint = (actual, expected) => {
    assert.equal(Math.abs(Number(actual?.x || 0) - Number(expected?.x || 0)) < 0.000001, true);
    assert.equal(Math.abs(Number(actual?.z || 0) - Number(expected?.z || 0)) < 0.000001, true);
    assert.equal(Math.abs(Number(actual?.elevation || 0) - Number(expected?.elevation || 0)) < 0.000001, true);
  };

  assert.ok(firstBand.near.marginLeft);
  assert.ok(firstBand.near.marginRight);
  assert.ok(firstBand.near.transitionLeft || firstBand.near.terrainLeft);
  assert.ok(leftBoundary);
  assert.ok(rightBoundary);
  assert.ok(leftSeam);
  assert.ok(rightSeam);
  samePoint(leftBoundary.points[1], firstBand.far.left);
  samePoint(leftBoundary.points[2], firstBand.near.left);
  samePoint(leftBoundary.points[0], firstBand.far.marginLeft);
  samePoint(leftBoundary.points[3], firstBand.near.marginLeft);
  samePoint(rightBoundary.points[0], firstBand.far.right);
  samePoint(rightBoundary.points[3], firstBand.near.right);
  samePoint(rightBoundary.points[1], firstBand.far.marginRight);
  samePoint(rightBoundary.points[2], firstBand.near.marginRight);
  assert.equal(leftSeam.textured, true);
  assert.equal(rightSeam.textured, true);
  assert.equal(leftSeam.artRef, 'benchGround');
  assert.equal(rightSeam.artRef, 'benchGround');
});

test('Race Editor road-to-terrain transition uses terrain tile material instead of asphalt shoulder green', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 180, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 180, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 0, hazardIds: [] }
  ];
  editor.selectedRace.margin = {
    marginMode: 'off',
    shoulderMode: 'off',
    widthM: 0.22,
    shoulderWidthM: 12,
    collisionMode: 'none',
    collisionEdge: 'none',
    collisionEffect: 'collide'
  };
  const tileMap = editor.ensureRaceTileMap();
  tileMap.defaultTileId = 'dirt';
  editor.invalidateRaceTerrainCaches(tileMap);
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 40,
    elevation: 0.2,
    nearPlane: 1.2,
    farPlane: 900,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.35,
    roadMaxWidthRatio: 1
  };
  const sections = editor.getRaceStableRoadSections({
    bounds,
    camera,
    cameraYaw: 0,
    visualTravel: 40,
    routeLength: 180,
    routeRuntimeType: 'destination',
    viewDistance: 180,
    backDistance: 20
  });
  const bands = editor.getRaceStableRoadBands(sections);
  const seamMeshes = editor.getRaceRoadsideTerrainBlendMeshes(bands, {
    currentSegment: editor.selectedRace.road.segments[0],
    useSunShading: false,
    textured: false
  });
  const leftSeam = seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-left');
  const asphaltShoulder = editor.getRaceRoadSurfacePalette('asphalt').shoulderA;
  const dirtGround = editor.getRaceGroundTilePalette('dirt').groundA;

  assert.ok(leftSeam);
  assert.equal(leftSeam.color, dirtGround);
  assert.notEqual(leftSeam.color, asphaltShoulder);
  assert.equal(editor.isRaceMarginVisible(), false);
  assert.equal(editor.isRaceShoulderVisible(), false);
});

test('Race Editor roadside terrain holds road height before blending out cliff edges', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 180, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 180, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 0, hazardIds: [] }
  ];
  editor.selectedRace.margin = {
    marginMode: 'off',
    shoulderMode: 'off',
    widthM: 0.22,
    shoulderWidthM: 12,
    collisionMode: 'none',
    collisionEdge: 'none',
    collisionEffect: 'collide'
  };
  editor.getRaceGroundElevationAtWorldPoint = (point = {}, fallback = 0) => (
    Math.abs(Number(point.x || 0)) <= 3.01 ? Number(fallback) || 0 : 0.7
  );
  editor.invalidateRaceTerrainCaches(editor.ensureRaceTileMap());
  const road = editor.getRaceRoadSurfaceProfileAtDistance(80, { runtimeType: 'destination', routeLength: 180 });
  const at = (x) => editor.getRaceCompositedSurfaceAtWorldPoint({ x, z: 80 }, road.elevation, {
    runtimeType: 'destination',
    routeLength: 180
  });

  assert.equal(Math.abs(road.elevation) < 0.000001, true);
  assert.equal(Math.abs(at(3.25).elevation - road.elevation) < 0.000001, true);
  assert.equal(Math.abs(at(3.5).elevation - road.elevation) < 0.000001, true);
  assert.equal(at(5.5).elevation > 0.3 && at(5.5).elevation < 0.4, true);
  assert.equal(at(7.5).elevation > 0.69, true);
  assert.equal(Math.abs(at(-3.5).elevation - road.elevation) < 0.000001, true);
});

test('Race Editor textured road-to-terrain transition keeps project terrain art untinted', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 180, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 180, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 0, hazardIds: [] }
  ];
  editor.selectedRace.margin = {
    marginMode: 'off',
    shoulderMode: 'off',
    widthM: 0.22,
    shoulderWidthM: 12,
    collisionMode: 'none',
    collisionEdge: 'none',
    collisionEffect: 'collide'
  };
  const tileMap = editor.ensureRaceTileMap();
  tileMap.defaultTileId = 'grass';
  editor.invalidateRaceTerrainCaches(tileMap);
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 40,
    elevation: 0.2,
    nearPlane: 1.2,
    farPlane: 900,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.35,
    roadMaxWidthRatio: 1
  };
  const sections = editor.getRaceStableRoadSections({
    bounds,
    camera,
    cameraYaw: 0,
    visualTravel: 40,
    routeLength: 180,
    routeRuntimeType: 'destination',
    viewDistance: 180,
    backDistance: 20
  });
  const bands = editor.getRaceStableRoadBands(sections);
  const seamMeshes = editor.getRaceRoadsideTerrainBlendMeshes(bands, {
    currentSegment: editor.selectedRace.road.segments[0],
    useSunShading: false,
    artRef: 'benchGround',
    textured: true,
    textureWorldM: 2.5
  });
  const leftSeam = seamMeshes.find((mesh) => mesh.source === 'terrain-roadside-left');

  assert.ok(leftSeam);
  assert.equal(leftSeam.textured, true);
  assert.equal(leftSeam.artRef, 'benchGround');
  assert.equal(leftSeam.color, '#ffffff');
  assert.notEqual(leftSeam.color, editor.getRaceGroundTilePalette('grass').groundA);
});

test('Race Editor precomputes Studio Sprint world terrain before playtest frames', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.selectedRace.renderDebug = {
    terrainEnabled: true,
    texturesEnabled: true,
    detailEnabled: false,
    threeEnabled: false
  };

  editor.startPlaytest('starter-rwd');
  const bake = editor.playtestSession.worldBake;
  const secondBake = editor.buildRaceWorldBake({
    terrainSize: bake.terrainSize,
    routeLength: bake.routeLength,
    runtimeType: bake.runtimeType,
    renderDebug: editor.getRaceRenderDebugSettings(),
    textureWorldM: bake.textureWorldM
  });
  let chunkCalls = 0;
  editor.getRaceBakedTerrainChunk = () => {
    chunkCalls += 1;
    throw new Error('terrain chunk generation should not run while selecting from a world bake');
  };
  const visible = editor.getRaceVisibleWorldBakeTerrainCells(bake, {
    camera: {
      x: editor.playtestSession.worldX,
      z: editor.playtestSession.worldZ,
      elevation: editor.playtestSession.heightM / 12,
      nearPlane: 1.2,
      farPlane: 1300
    },
    cameraYaw: editor.playtestSession.cameraYaw,
    bounds: { x: 0, y: 0, w: 390, h: 240 },
    terrainForwardDistance: 1800,
    maxTerrainCells: 500,
    stats: { terrainPreculled: 0, terrainBudgetDropped: 0 }
  });

  assert.ok(bake);
  assert.equal(secondBake, bake);
  assert.equal(bake.terrainCells.length > 0, true);
  assert.equal(bake.terrainChunks.length > 0, true);
  assert.equal(visible.length > 0, true);
  assert.equal(chunkCalls, 0);
  assert.equal(raceEditorSource.includes('this.playtestSession?.worldBake'), true);
  assert.equal(raceEditorSource.includes('getRaceVisibleWorldBakeTerrainCells'), true);
});

test('Race Editor paints magenta as the default WebGL Track uncovered background', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.selectedRace.renderDebug = {
    terrainEnabled: true,
    texturesEnabled: true,
    detailEnabled: false,
    threeEnabled: false
  };
  editor.startPlaytest('starter-rwd');
  editor.drawRaceWebGLTrackScene = () => true;
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const ctx = createMockContext();

  editor.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud: false });
  assert.equal(ctx.calls.some((call) => call.type === 'fillRect' && call.style === '#ff00ff'), true);
  assert.equal('magentaUnderlayEnabled' in editor.getRaceRenderDebugSettings(), false);
});

test('Race Editor baked terrain visibility scans past early budget entries before choosing cells', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const makeCell = (key, x0, z0, flags = {}) => ({
    key,
    points: [
      { x: x0, z: z0, elevation: 0 },
      { x: x0 + 40, z: z0, elevation: 0 },
      { x: x0 + 40, z: z0 + 40, elevation: 0 },
      { x: x0, z: z0 + 40, elevation: 0 }
    ],
    tileCell: { tileId: 'grass', tileWeights: { grass: 1 } },
    ...flags
  });
  const worldBake = {
    terrainSize: 40,
    terrainCells: [
      makeCell('background-first', -20, 160, { nearRoad: false, roadAdjacent: false, roadDistance: 240 }),
      makeCell('road-later', -20, 520, { nearRoad: true, roadAdjacent: true, roadDistance: 0 })
    ]
  };
  const stats = { terrainPreculled: 0, terrainBudgetDropped: 0 };
  const visible = editor.getRaceVisibleWorldBakeTerrainCells(worldBake, {
    camera: { x: 0, z: 0 },
    cameraYaw: 0,
    bounds: { x: 0, y: 0, w: 390, h: 240 },
    terrainForwardDistance: 900,
    maxTerrainCells: 1,
    terrainCullingEnabled: false,
    stats
  });

  assert.equal(visible.length, 2);
  assert.equal(visible.some((cell) => cell.key === 'background-first'), true);
  assert.equal(visible.some((cell) => cell.key === 'road-later'), true);
  assert.equal(stats.terrainCoverageDropped, 0);
});

test('Race Editor terrain budget drops refinement but never base coverage', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const makeCell = (key, x0, z0, layer = 'base', parentGroupKey = '') => ({
    key,
    groupKey: layer === 'base' ? key : `${parentGroupKey}:refined`,
    parentGroupKey,
    terrainLayer: layer,
    refinementGroupSize: layer === 'refinement' ? 2 : 0,
    points: [
      { x: x0, z: z0, elevation: 0 },
      { x: x0 + 20, z: z0, elevation: 0 },
      { x: x0, z: z0 + 20, elevation: 0 }
    ],
    tileCell: { tileId: 'grass', tileWeights: { grass: 1 } },
    nearRoad: layer === 'refinement',
    roadAdjacent: layer === 'refinement',
    roadDistance: layer === 'refinement' ? 0 : 220
  });
  const base = [
    makeCell('base-a', -40, 80),
    makeCell('base-b', 20, 120)
  ];
  const refinement = [
    makeCell('ref-a', -20, 90, 'refinement', 'base-a'),
    makeCell('ref-b', -10, 95, 'refinement', 'base-a')
  ];
  const stats = { terrainPreculled: 0, terrainBudgetDropped: 0 };
  const visible = editor.getRaceVisibleWorldBakeTerrainCells({
    terrainSize: 40,
    terrainCells: [...base, ...refinement],
    terrainBaseCells: base,
    terrainRefinementCells: refinement
  }, {
    camera: { x: 0, z: 0 },
    cameraYaw: 0,
    bounds: { x: 0, y: 0, w: 390, h: 240 },
    terrainForwardDistance: 900,
    maxTerrainTriangles: 2,
    terrainCullingEnabled: false,
    stats
  });

  assert.equal(visible.length, 2);
  assert.equal(visible.every((cell) => cell.terrainLayer !== 'refinement'), true);
  assert.equal(stats.terrainBaseTriangles, 2);
  assert.equal(stats.terrainCoverageDropped, 0);
  assert.equal(stats.terrainRefinementDropped, 2);
});

test('Race Three terrain geometry accepts triangle terrain cells', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const geometry = editor.getRaceThreeTerrainGeometry([{
    points: [
      { x: 0, z: 0, elevation: 0 },
      { x: 5, z: 0, elevation: 0 },
      { x: 0, z: 5, elevation: 0 }
    ],
    tileCell: { tileId: 'grass', tileWeights: { grass: 1 } }
  }], {
    textureWorldM: 2.5,
    tileMap: editor.ensureRaceTileMap(),
    textured: false
  });

  assert.ok(geometry);
  assert.equal(Math.floor((geometry.getAttribute('position')?.count || 0) / 3), 1);
});

test('Race Editor Studio Sprint world bake includes camera-visible terrain chunks through the route', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.selectedRace.renderDebug = {
    terrainEnabled: true,
    texturesEnabled: true,
    detailEnabled: false,
    threeEnabled: false
  };
  editor.startPlaytest('starter-rwd');
  const bake = editor.playtestSession.worldBake;
  const bakedChunkKeys = new Set(bake.terrainChunks.map((chunk) => chunk.key));
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const routeLength = editor.getRaceRouteLength();
  const terrainSize = Number(bake.terrainSize || 120);
  const rightAndForwardFor = (cameraYaw) => ({
    right: editor.getRaceRightVector(cameraYaw),
    forward: editor.getRaceForwardVector(cameraYaw)
  });
  const missing = [];
  const inspectFrame = (distance, reverse = false) => {
    const pose = editor.getRaceWorldPoseAtDistance(distance, { runtimeType: editor.playtestSession.routeRuntimeType });
    const yaw = Number(pose.yaw || 0) + (reverse ? Math.PI : 0);
    editor.playtestSession.distance = distance;
    editor.playtestSession.projectedDistance = distance;
    editor.playtestSession.worldX = pose.x;
    editor.playtestSession.worldZ = pose.z;
    editor.playtestSession.carYaw = yaw;
    editor.playtestSession.cameraYaw = yaw;
    editor.drawRaceWebGLTrackScene = () => true;
    editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
    const camera = editor.lastRaceRenderCamera.camera;
    const cameraYaw = editor.lastRaceRenderCamera.cameraYaw;
    const { right, forward } = rightAndForwardFor(cameraYaw);
    const roadFarCameraZ = 900;
    const { terrainForwardDistance, terrainCellRadius } = editor.getRaceTerrainRenderLimits({
      terrainSize,
      roadFarCameraZ,
      detailEnabled: false,
      terrainBudgetEnabled: false
    });
    const centerCellX = Math.round(Number(camera.x || 0) / terrainSize);
    const centerCellZ = Math.round(Number(camera.z || 0) / terrainSize);
    const tileMap = editor.ensureRaceTileMap();
    const cache = editor.getRaceTerrainBakeCache(tileMap, terrainSize);
    for (let z = centerCellZ - terrainCellRadius; z <= centerCellZ + terrainCellRadius; z += 1) {
      for (let x = centerCellX - terrainCellRadius; x <= centerCellX + terrainCellRadius; x += 1) {
        const chunk = editor.getRaceBakedTerrainChunk(x, z, terrainSize, tileMap, cache);
        if (!editor.shouldIncludeRaceTerrainChunkForRendering(chunk)) continue;
        const cameraBounds = editor.getRaceTerrainCameraBounds(chunk.fullPoints, camera, right, forward);
        if (!editor.isRaceTerrainCameraBoundsVisible(cameraBounds, {
          terrainSize,
          terrainForwardDistance,
          screenWidth: bounds.w,
          forwardMargin: terrainSize * 2,
          lateralMargin: terrainSize
        })) continue;
        if (!bakedChunkKeys.has(chunk.key)) missing.push(`${Math.round(distance)}:${reverse ? 'reverse' : 'forward'}:${chunk.key}`);
      }
    }
  };

  [0, routeLength * 0.25, routeLength * 0.38, routeLength * 0.52, routeLength * 0.76, routeLength - 12].forEach((distance) => {
    const clamped = Math.max(0, Math.min(routeLength, distance));
    inspectFrame(clamped, false);
    inspectFrame(clamped, true);
  });

  assert.equal(missing.length, 0, `Missing baked visible terrain chunks: ${missing.slice(0, 12).join(', ')}`);
});

test('Race Editor Studio Sprint visible terrain budget does not drop sampled route coverage', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.selectedRace.renderDebug = {
    terrainEnabled: true,
    texturesEnabled: true,
    detailEnabled: false,
    threeEnabled: false
  };
  editor.startPlaytest('starter-rwd');
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const routeLength = editor.getRaceRouteLength();
  const dropped = [];
  const inspectFrame = (distance, reverse = false) => {
    const pose = editor.getRaceWorldPoseAtDistance(distance, { runtimeType: editor.playtestSession.routeRuntimeType });
    const yaw = Number(pose.yaw || 0) + (reverse ? Math.PI : 0);
    editor.playtestSession.distance = distance;
    editor.playtestSession.projectedDistance = distance;
    editor.playtestSession.worldX = pose.x;
    editor.playtestSession.worldZ = pose.z;
    editor.playtestSession.carYaw = yaw;
    editor.playtestSession.cameraYaw = yaw;
    editor.drawRaceWebGLTrackScene = () => true;
    editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
    const camera = editor.lastRaceRenderCamera.camera;
    const cameraYaw = editor.lastRaceRenderCamera.cameraYaw;
    const terrainSize = Number(editor.playtestSession.worldBake.terrainSize || 120);
    const limits = editor.getRaceTerrainRenderLimits({
      terrainSize,
      roadFarCameraZ: 900,
      detailEnabled: false,
      terrainBudgetEnabled: true
    });
    const stats = { terrainPreculled: 0, terrainBudgetDropped: 0 };
    editor.getRaceVisibleWorldBakeTerrainCells(editor.playtestSession.worldBake, {
      camera,
      cameraYaw,
      bounds,
      terrainForwardDistance: limits.terrainForwardDistance,
      maxTerrainCells: limits.maxTerrainCells,
      terrainCullingEnabled: true,
      stats
    });
    if (stats.terrainCoverageDropped > 0) {
      dropped.push(`${reverse ? 'reverse' : 'forward'}:${Math.round(distance)}:${stats.terrainCoverageDropped}`);
    }
  };

  [0, routeLength * 0.25, routeLength * 0.38, routeLength * 0.52, routeLength * 0.76, routeLength - 12].forEach((distance) => {
    const clamped = Math.max(0, Math.min(routeLength, distance));
    inspectFrame(clamped, false);
    inspectFrame(clamped, true);
  });

  assert.equal(dropped.length, 0, `Visible terrain budget dropped base coverage: ${dropped.join(', ')}`);
});

test('Race Editor terrain chunks keep raw heightmap elevations under the baked road surface', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 220, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 220, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 6, shoulderWidthM: 2, hazardIds: [] }
  ];
  const tileMap = editor.ensureRaceTileMap();
  tileMap.cellSizeM = 5;
  editor.getRaceGroundElevationAtWorldPoint = (point = {}, fallback = 0) => (
    Math.abs(Number(point.x || 0)) < 10 ? 0.72 : Number(fallback) || 0
  );
  editor.invalidateRaceTerrainCaches(tileMap);
  const terrainBake = editor.getRaceTerrainBakeCache(tileMap, 40);
  const chunk = editor.getRaceBakedTerrainChunk(0, 2, 40, tileMap, terrainBake);
  const roadSection = editor.getRaceRoadCrossSectionAtDistance(88, { runtimeType: 'destination', routeLength: 220 });

  assert.ok(chunk);
  assert.equal(chunk.fullPoints.some((point) => Math.abs(Number(point.elevation || 0) - 0.72) < 0.0001), true);
  assert.equal(roadSection.center.elevation >= 0.72, true);
  assert.equal(chunk.fullPoints.every((point) => point.roadDeckElevation !== true), true);
});

test('Race Editor Studio Sprint centerline run finishes at 40 MPH without collision or suspension damage', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  assert.equal(editor.selectedRace.name, 'Studio Sprint');
  assert.deepEqual(editor.selectedRace.hazards, []);
  assert.equal(editor.selectedRace.road.segments.every((segment) => !Array.isArray(segment.hazardIds) || segment.hazardIds.length === 0), true);
  editor.startPlaytest('starter-rwd');
  const car = editor.project.cars.find((candidate) => candidate.id === editor.playtestSession.carId) || editor.selectedCar;
  const tuning = editor.getRaceCarTuning(car);
  const routeLength = editor.getRaceRouteLength();
  const speedMps = 40 * 0.44704;
  const dt = 0.1;
  let previousDistance = 0;

  editor.playtestSession.speedMps = speedMps;
  editor.playtestSession.projectedDistance = 0;
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.routeRuntimeType = 'destination';
  editor.playtestSession.routeLength = routeLength;
  editor.selectedRace.laps = 1;

  for (let distance = 0; distance <= routeLength; distance += speedMps * dt) {
    const clampedDistance = Math.min(distance, routeLength);
    const pose = editor.getRaceWorldPoseAtDistance(clampedDistance, { runtimeType: 'destination' });
    const previousPose = editor.getRaceWorldPoseAtDistance(previousDistance, { runtimeType: 'destination' });
    const profile = editor.getRaceRoadSurfaceProfileAtDistance(clampedDistance, { runtimeType: 'destination' });
    const previousProfile = editor.getRaceRoadSurfaceProfileAtDistance(previousDistance, { runtimeType: 'destination' });
    pose.elevation = profile.elevation;
    previousPose.elevation = previousProfile.elevation;
    editor.playtestSession.distance = clampedDistance;
    editor.playtestSession.previousDistance = previousDistance;
    editor.playtestSession.worldX = pose.x;
    editor.playtestSession.worldZ = pose.z;
    editor.playtestSession.carYaw = pose.yaw;
    editor.playtestSession.velocityYaw = pose.yaw;
    editor.playtestSession.cameraYaw = pose.yaw;
    editor.playtestSession.lateral = 0;
    editor.playtestSession.heading = 0;
    editor.playtestSession.speedMps = speedMps;

    const wheelSurfaceState = editor.getRaceWheelSurfaceState({
      car,
      tuning,
      session: editor.playtestSession,
      damage: editor.getRaceSessionDamage()
    });
    const wheelContactState = editor.getRaceWheelContactState({
      car,
      tuning,
      session: editor.playtestSession,
      wheelSurfaceState
    });
    editor.updateRaceVerticalAndRollState({
      seconds: dt,
      tuning,
      roadPose: pose,
      previousRoadPose: previousPose,
      lateralAcceleration: 0,
      wheelContactState
    });

    assert.equal(Object.values(wheelSurfaceState.terrainByWheel).every((terrain) => terrain === 'road'), true);
    assert.equal(Object.values(wheelContactState.contacts).every((contact) => contact.terrain === 'road'), true);
    previousDistance = clampedDistance;
  }

  editor.playtestSession.distance = routeLength;
  const damage = editor.getRaceSessionDamage();
  assert.equal(routeLength > 100, true);
  assert.equal(editor.playtestSession.distance, routeLength);
  assert.equal(editor.getAverageDamage(damage.panels), 0);
  assert.equal(editor.getAverageDamage(damage.suspension), 0);
  assert.equal(damage.engine, 0);
  assert.equal(damage.transmission, 0);
  assert.equal(editor.playtestSession.rolledOver, false);
});

function runStudioSprintFixedLateralNoDamage({
  lateralSign = 0,
  lateralMode = 'road-edge',
  expectedRoadWheels = [],
  expectedOffRoadWheels = [],
  expectedShoulderWheels = [],
  expectedNonOffRoadWheels = [],
  speedMph = 30
} = {}) {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  assert.equal(editor.selectedRace.name, 'Studio Sprint');
  editor.startPlaytest('starter-rwd');
  const car = editor.project.cars.find((candidate) => candidate.id === editor.playtestSession.carId) || editor.selectedCar;
  const tuning = editor.getRaceCarTuning(car);
  const dimensions = editor.getRaceCarDimensions(car);
  const routeLength = editor.getRaceRouteLength();
  const speedMps = speedMph * 0.44704;
  const dt = 0.1;
  const wheelHalfTrack = Math.max(dimensions.trackFrontM, dimensions.trackRearM) * 0.5;
  const getLateralOffset = (pose) => {
    const roadHalfWidth = editor.getRaceRoadHalfWidthWorld(pose.segment);
    if (lateralSign === 0) return 0;
    if (lateralMode === 'shoulder-edge') {
      const shoulderLimit = roadHalfWidth + editor.getRaceShoulderWidthWorld(pose.segment);
      return lateralSign * Math.max(0, shoulderLimit - 1 - wheelHalfTrack);
    }
    return lateralSign * Math.max(0, roadHalfWidth - wheelHalfTrack + 0.12);
  };
  let previousDistance = 0;

  editor.playtestSession.speedMps = speedMps;
  editor.playtestSession.projectedDistance = 0;
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.routeRuntimeType = 'destination';
  editor.playtestSession.routeLength = routeLength;
  editor.selectedRace.laps = 1;

  for (let distance = 0; distance <= routeLength; distance += speedMps * dt) {
    const clampedDistance = Math.min(distance, routeLength);
    const pose = editor.getRaceWorldPoseAtDistance(clampedDistance, { runtimeType: 'destination' });
    const previousPose = editor.getRaceWorldPoseAtDistance(previousDistance, { runtimeType: 'destination' });
    const profile = editor.getRaceRoadSurfaceProfileAtDistance(clampedDistance, { runtimeType: 'destination' });
    const previousProfile = editor.getRaceRoadSurfaceProfileAtDistance(previousDistance, { runtimeType: 'destination' });
    const lateralOffset = getLateralOffset(pose);
    const right = editor.getRaceRightVector(pose.yaw);
    pose.elevation = profile.elevation;
    previousPose.elevation = previousProfile.elevation;
    editor.playtestSession.distance = clampedDistance;
    editor.playtestSession.previousDistance = previousDistance;
    editor.playtestSession.worldX = pose.x + right.x * lateralOffset;
    editor.playtestSession.worldZ = pose.z + right.z * lateralOffset;
    editor.playtestSession.carYaw = pose.yaw;
    editor.playtestSession.velocityYaw = pose.yaw;
    editor.playtestSession.cameraYaw = pose.yaw;
    editor.playtestSession.lateral = lateralOffset;
    editor.playtestSession.heading = 0;
    editor.playtestSession.speedMps = speedMps;

    const wheelSurfaceState = editor.getRaceWheelSurfaceState({
      car,
      tuning,
      session: editor.playtestSession,
      damage: editor.getRaceSessionDamage()
    });
    const wheelContactState = editor.getRaceWheelContactState({
      car,
      tuning,
      session: editor.playtestSession,
      wheelSurfaceState
    });
    editor.updateRaceVerticalAndRollState({
      seconds: dt,
      tuning,
      roadPose: pose,
      previousRoadPose: previousPose,
      lateralAcceleration: 0,
      wheelContactState
    });

    expectedRoadWheels.forEach((wheelId) => {
      assert.equal(wheelSurfaceState.terrainByWheel[wheelId], 'road');
      assert.equal(wheelContactState.contacts[wheelId].terrain, 'road');
    });
    expectedOffRoadWheels.forEach((wheelId) => {
      assert.notEqual(wheelSurfaceState.terrainByWheel[wheelId], 'road');
      assert.notEqual(wheelContactState.contacts[wheelId].terrain, 'road');
    });
    expectedShoulderWheels.forEach((wheelId) => {
      assert.equal(wheelSurfaceState.terrainByWheel[wheelId], 'shoulder');
      assert.equal(wheelContactState.contacts[wheelId].terrain, 'shoulder');
    });
    expectedNonOffRoadWheels.forEach((wheelId) => {
      assert.notEqual(wheelSurfaceState.terrainByWheel[wheelId], 'off-road');
      assert.notEqual(wheelContactState.contacts[wheelId].terrain, 'off-road');
    });
    previousDistance = clampedDistance;
  }

  editor.playtestSession.distance = routeLength;
  const damage = editor.getRaceSessionDamage();
  assert.equal(routeLength > 100, true);
  assert.equal(editor.playtestSession.distance, routeLength);
  assert.equal(editor.getAverageDamage(damage.panels), 0);
  assert.equal(editor.getAverageDamage(damage.suspension), 0);
  assert.equal(damage.engine, 0);
  assert.equal(damage.transmission, 0);
  assert.equal(editor.playtestSession.rolledOver, false);
}

function runStudioSprintWeaveNoDamage({ speedMph = 30, cycles = 6 } = {}) {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  assert.equal(editor.selectedRace.name, 'Studio Sprint');
  editor.startPlaytest('starter-rwd');
  const car = editor.project.cars.find((candidate) => candidate.id === editor.playtestSession.carId) || editor.selectedCar;
  const tuning = editor.getRaceCarTuning(car);
  const dimensions = editor.getRaceCarDimensions(car);
  const routeLength = editor.getRaceRouteLength();
  const speedMps = speedMph * 0.44704;
  const dt = 0.1;
  const wheelHalfTrack = Math.max(dimensions.trackFrontM, dimensions.trackRearM) * 0.5;
  let previousDistance = 0;
  let reachedLeftShoulder = false;
  let reachedRightShoulder = false;

  editor.playtestSession.speedMps = speedMps;
  editor.playtestSession.projectedDistance = 0;
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.routeRuntimeType = 'destination';
  editor.playtestSession.routeLength = routeLength;
  editor.selectedRace.laps = 1;

  for (let distance = 0; distance <= routeLength; distance += speedMps * dt) {
    const clampedDistance = Math.min(distance, routeLength);
    const pose = editor.getRaceWorldPoseAtDistance(clampedDistance, { runtimeType: 'destination' });
    const previousPose = editor.getRaceWorldPoseAtDistance(previousDistance, { runtimeType: 'destination' });
    const profile = editor.getRaceRoadSurfaceProfileAtDistance(clampedDistance, { runtimeType: 'destination' });
    const previousProfile = editor.getRaceRoadSurfaceProfileAtDistance(previousDistance, { runtimeType: 'destination' });
    const roadHalfWidth = editor.getRaceRoadHalfWidthWorld(pose.segment);
    const shoulderLimit = roadHalfWidth + editor.getRaceShoulderWidthWorld(pose.segment);
    const maxLateral = Math.max(0, shoulderLimit - 0.75 - wheelHalfTrack);
    const phase = (clampedDistance / Math.max(1, routeLength)) * Math.PI * 2 * cycles;
    const lateralOffset = Math.sin(phase) * maxLateral;
    const right = editor.getRaceRightVector(pose.yaw);
    pose.elevation = profile.elevation;
    previousPose.elevation = previousProfile.elevation;
    editor.playtestSession.distance = clampedDistance;
    editor.playtestSession.previousDistance = previousDistance;
    editor.playtestSession.worldX = pose.x + right.x * lateralOffset;
    editor.playtestSession.worldZ = pose.z + right.z * lateralOffset;
    editor.playtestSession.carYaw = pose.yaw;
    editor.playtestSession.velocityYaw = pose.yaw;
    editor.playtestSession.cameraYaw = pose.yaw;
    editor.playtestSession.lateral = lateralOffset;
    editor.playtestSession.heading = 0;
    editor.playtestSession.speedMps = speedMps;

    const wheelSurfaceState = editor.getRaceWheelSurfaceState({
      car,
      tuning,
      session: editor.playtestSession,
      damage: editor.getRaceSessionDamage()
    });
    const wheelContactState = editor.getRaceWheelContactState({
      car,
      tuning,
      session: editor.playtestSession,
      wheelSurfaceState
    });
    editor.updateRaceVerticalAndRollState({
      seconds: dt,
      tuning,
      roadPose: pose,
      previousRoadPose: previousPose,
      lateralAcceleration: 0,
      wheelContactState
    });

    if (lateralOffset < -roadHalfWidth) reachedLeftShoulder = true;
    if (lateralOffset > roadHalfWidth) reachedRightShoulder = true;
    assert.equal(Object.values(wheelSurfaceState.terrainByWheel).some((terrain) => terrain === 'off-road'), false);
    assert.equal(Object.values(wheelContactState.contacts).some((contact) => contact.terrain === 'off-road'), false);
    previousDistance = clampedDistance;
  }

  editor.playtestSession.distance = routeLength;
  const damage = editor.getRaceSessionDamage();
  assert.equal(reachedLeftShoulder, true);
  assert.equal(reachedRightShoulder, true);
  assert.equal(routeLength > 100, true);
  assert.equal(editor.playtestSession.distance, routeLength);
  assert.equal(editor.getAverageDamage(damage.panels), 0);
  assert.equal(editor.getAverageDamage(damage.suspension), 0);
  assert.equal(damage.engine, 0);
  assert.equal(damage.transmission, 0);
  assert.equal(editor.playtestSession.rolledOver, false);
  assert.equal((editor.playtestSession.damageLog || []).some((entry) => String(entry.source || '').startsWith('edge:')), false);
}

test('Race Editor Studio Sprint left-edge run finishes at 30 MPH without damage', () => {
  runStudioSprintFixedLateralNoDamage({
    lateralSign: -1,
    lateralMode: 'road-edge',
    expectedRoadWheels: ['fr', 'rr'],
    expectedOffRoadWheels: ['fl', 'rl']
  });
});

test('Race Editor Studio Sprint right-edge run finishes at 30 MPH without damage', () => {
  runStudioSprintFixedLateralNoDamage({
    lateralSign: 1,
    lateralMode: 'road-edge',
    expectedRoadWheels: ['fl', 'rl'],
    expectedOffRoadWheels: ['fr', 'rr']
  });
});

test('Race Editor Studio Sprint left shoulder-edge run finishes at 30 MPH without damage', () => {
  runStudioSprintFixedLateralNoDamage({
    lateralSign: -1,
    lateralMode: 'shoulder-edge',
    expectedShoulderWheels: ['fl', 'fr', 'rl', 'rr'],
    expectedNonOffRoadWheels: ['fl', 'fr', 'rl', 'rr']
  });
});

test('Race Editor Studio Sprint right shoulder-edge run finishes at 30 MPH without damage', () => {
  runStudioSprintFixedLateralNoDamage({
    lateralSign: 1,
    lateralMode: 'shoulder-edge',
    expectedShoulderWheels: ['fl', 'fr', 'rl', 'rr'],
    expectedNonOffRoadWheels: ['fl', 'fr', 'rl', 'rr']
  });
});

test('Race Editor Studio Sprint shoulder-to-shoulder weave finishes at 30 MPH without damage', () => {
  runStudioSprintWeaveNoDamage();
});

test('Race Editor normalizes legacy Studio Sprint hazard data away on load', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const legacy = editor.cloneRaceDocument();
  legacy.hazards = [
    { id: 'zombie-pack-1', type: 'zombie-pack', at: 380 },
    { id: 'test-jump', type: 'jump', at: 650 },
    { id: 'wall-1', type: 'damage-wall', at: 720 }
  ];
  legacy.road.segments[2].hazardIds = ['zombie-pack-1'];
  legacy.road.segments[4].hazardIds = ['test-jump'];

  const normalized = editor.normalizeLoadedRaceDocument({ kind: 'race-track', race: legacy }, 'Studio Sprint');

  assert.ok(normalized);
  assert.equal(normalized.name, 'Studio Sprint');
  assert.deepEqual(normalized.hazards, []);
  assert.equal(normalized.road.segments.every((segment) => !Array.isArray(segment.hazardIds) || segment.hazardIds.length === 0), true);
});

test('Race Editor Studio Sprint centerline projection stays on road through curves', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const routeLength = editor.getRaceRouteLength();
  let maxLateral = 0;
  let maxDistanceError = 0;

  for (let distance = 0; distance <= routeLength; distance += 2) {
    const pose = editor.getRaceWorldPoseAtDistance(distance);
    const projection = editor.getRaceRouteProjectionForWorldPoint({ x: pose.x, z: pose.z });
    maxLateral = Math.max(maxLateral, Math.abs(Number(projection.lateral || 0)));
    maxDistanceError = Math.max(maxDistanceError, Math.abs(Number(projection.distance || 0) - distance));
  }

  assert.equal(maxLateral < 0.04, true);
  assert.equal(maxDistanceError < 0.65, true);
});

test('Race Editor hidden shoulder collision uses hidden shoulder width while visual seam joins margin', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.margin = {
    enabled: true,
    marginMode: 'on',
    widthM: 0.5,
    shoulderEnabled: true,
    shoulderMode: 'hidden',
    shoulderWidthM: 24,
    collisionEdge: 'shoulder',
    collisionMode: 'shoulder',
    collisionEffect: 'reset'
  };
  editor.selectedRace.road.segments = [
    { length: 200, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 8, hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');
  const pose = editor.getRaceWorldPoseAtDistance(35);
  const right = editor.getRaceRightVector(pose.yaw);
  const putCarAtLateral = (lateral) => {
    editor.playtestSession.edgeResetFadeMs = 0;
    editor.playtestSession.pendingEdgeCenterReset = null;
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    editor.playtestSession.distance = 35;
    editor.playtestSession.previousDistance = 34.5;
    editor.playtestSession.worldX = pose.x + right.x * lateral;
    editor.playtestSession.worldZ = pose.z + right.z * lateral;
    editor.playtestSession.velocityYaw = pose.yaw;
    editor.playtestSession.carYaw = pose.yaw;
    editor.playtestSession.speedMps = 4;
  };

  assert.equal(editor.getRaceShoulderWidthWorld(), 0);
  assert.equal(editor.getRaceCollisionShoulderWidthWorld(editor.selectedRace.road.segments[0], 'shoulder'), 24);
  assert.equal(editor.getRaceCollisionMarginWidthWorld(editor.selectedRace.road.segments[0], 'shoulder'), 0.5);

  putCarAtLateral(12);
  editor.updatePlaytest(1 / 30);
  assert.equal(Boolean(editor.playtestSession.pendingEdgeCenterReset), false);

  putCarAtLateral(31);
  editor.updatePlaytest(1 / 30);
  assert.equal(Boolean(editor.playtestSession.pendingEdgeCenterReset), true);
});

test('Race Editor Studio Sprint baked terrain mesh stays static while driving', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  const bake = editor.playtestSession.worldBake;
  assert.ok(bake?.terrainCells?.length);
  const fingerprint = () => JSON.stringify(
    bake.terrainCells.slice(0, 80).map((cell) => cell.points.map((point) => [
      Math.round(Number(point.x || 0) * 1000),
      Math.round(Number(point.z || 0) * 1000),
      Math.round(Number(point.elevation || 0) * 1000),
      Math.round(Number(point.u || 0) * 1000),
      Math.round(Number(point.v || 0) * 1000)
    ]))
  );
  const before = fingerprint();

  [120, 380, 560, 700].forEach((distance) => {
    const pose = editor.getRaceWorldPoseAtDistance(distance);
    editor.playtestSession.distance = distance;
    editor.playtestSession.projectedDistance = distance;
    editor.playtestSession.worldX = pose.x;
    editor.playtestSession.worldZ = pose.z;
    editor.playtestSession.carYaw = pose.yaw;
    editor.playtestSession.cameraYaw = pose.yaw;
    editor.drawRaceProjectedRoadPath(createMockContext(), { x: 0, y: 0, w: 390, h: 240 }, { showPlaytestHud: false });
    assert.equal(fingerprint(), before);
  });
});

test('Race Editor edits selected edge width, bumpiness, boundary, and snow condition', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const segment = editor.selectedSegment;

  assert.equal(editor.getRaceRoadWidthMForSegment(segment), 3.6);
  editor.handleMenuAction('segment-width');
  assert.equal(segment.roadWidthM, 4.1);
  editor.handleMenuAction('segment-bumpiness');
  assert.equal(segment.bumpiness, 0.15);
  assert.equal(segment.boundaryCollidable, undefined);
  editor.handleMenuAction('boundary-collidable');
  assert.equal(segment.boundaryCollidable, true);
  assert.equal(editor.getRaceActionLabel('boundary-collidable'), 'Margin Solid');
  editor.handleMenuAction('snow-condition');
  assert.equal(segment.surface, 'snow');
  assert.equal(segment.snowCondition, 'dusting');
  assert.equal(editor.getRaceSegmentSurfaceDetailGrip(segment) < 1, true);

  const defaultHalfWidth = editor.getRaceRoadHalfWidthWorld({ roadWidthM: 11 });
  const daytonaHalfWidth = editor.getRaceRoadHalfWidthWorld({ roadWidthM: 24 });
  const rallyHalfWidth = editor.getRaceRoadHalfWidthWorld({ roadWidthM: 6 });
  const narrowHalfWidth = editor.getRaceRoadHalfWidthWorld({ roadWidthM: 2.5 });
  assert.equal(Math.abs(defaultHalfWidth - 5.5) < 0.001, true);
  assert.equal(Math.abs(narrowHalfWidth - 1.25) < 0.001, true);
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
  const world = editor.screenToRaceMapWorldPoint(paintPoint.x, paintPoint.y, editor.raceMapBounds);
  const palette = editor.getRaceGroundPaletteForSegment(editor.selectedSegment, {
    x: world.x,
    z: world.y
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

  ['generate-random-race', 'draw-road', 'segment-prev', 'segment-next', 'curve', 'elevation', 'cycle-surface'].forEach((id) => {
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
    { mode: 'race', roots: ['file', 'edit', 'view', 'track', 'ground', 'sprites', 'settings'] },
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
  openLandscapeRoot(editor, 'track');

  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.gamepadSubmenuOpen, false);
  assert.equal(editor.activeRootId, 'track');
  assert.ok(editor.buttons.some((button) => button.id === 'track' && button.bounds.x < 240));
  assert.ok(editor.buttons.some((button) => button.id === 'draw-road' && button.bounds.x > 600));
  assert.equal(editor.buttons.filter((button) => button.id === 'draw-road').length, 1);
  assert.ok(editor.buttons.some((button) => button.id === 'test-drive' && button.bounds.y < 80));
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
  assert.ok(editor.buttons.some((button) => button.id === 'shell-frames' && button.bounds.x > 600));
  assert.equal(editor.buttons.filter((button) => button.id === 'shell-frames').length, 1);
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
  const trackRoot = editor.buttons.find((button) => button.id === 'track');
  assert.ok(trackRoot);
  editor.handlePointerDown({
    x: trackRoot.bounds.x + trackRoot.bounds.w / 2,
    y: trackRoot.bounds.y + trackRoot.bounds.h / 2
  });

  editor.draw(ctx, 844, 390);
  assert.equal(editor.mobileRootOpen, false);
  assert.equal(editor.gamepadSubmenuOpen, true);
  assert.ok(editor.buttons.some((button) => button.id === 'draw-road' && button.bounds.x < 380));
  assert.equal(editor.buttons.some((button) => button.id === 'draw-road' && button.bounds.x > 600), false);
  assert.equal(editor.buttons.some((button) => button.id === 'menu' && button.bounds.x < 120), false);
  assert.equal(editor.buttons.some((button) => button.id === 'file' && button.bounds.x < 120), false);
  assert.equal(editor.buttons.some((button) => button.id === 'generate-random-race' && button.bounds.x < 380), false);
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
  assert.ok(editor.buttons.some((button) => button.id === 'drivetrain-menu' && button.bounds.x < 380));
  assert.equal(editor.buttons.some((button) => button.id === 'drivetrain-menu' && button.bounds.x > 600), false);
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

test('Car Editor preview draws geometric fallback layers before art is assigned', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  const ctx = createMockContext();

  editor.drawCarEditorPreview(ctx, { x: 10, y: 20, w: 260, h: 180 }, editor.selectedCar);

  assert.equal(ctx.calls.some((call) => call.type === 'drawImage'), false);
  assert.equal(ctx.calls.some((call) => call.type === 'fill' && call.style === editor.getDamageColor(0)), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && String(call.value).includes('Default race body')), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && String(call.value).includes('Default race tires')), true);
});

test('Car Editor preview replaces individual geometric layers with assigned artwork', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  editor.selectedCar.art.shell = 'bodySprite';
  editor.selectedCar.art.tires = 'tireSprite';
  editor.selectedCar.art.spoiler = 'wingSprite';
  editor.getRaceArtSpriteCanvas = (artRef) => ({ artRef, width: 32, height: 32 });
  const ctx = createMockContext();

  editor.drawCarEditorPreview(ctx, { x: 10, y: 20, w: 260, h: 180 }, editor.selectedCar);

  const imageRefs = ctx.calls
    .filter((call) => call.type === 'drawImage')
    .map((call) => call.args[0]?.artRef);
  assert.equal(imageRefs.filter((ref) => ref === 'tireSprite').length, 4);
  assert.equal(imageRefs.includes('bodySprite'), true);
  assert.equal(imageRefs.includes('wingSprite'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'fill' && call.style === editor.getDamageColor(0)), false);
});

test('Car Editor turn-frame preview uses the active turn artwork', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  editor.selectedCar.art.shell = 'bodySprite';
  editor.selectedCar.art.turnFrames.left = 'leftSprite';
  editor.selectedCar.art.turnFrames.right = 'rightSprite';
  editor.getRaceArtSpriteCanvas = (artRef) => ({ artRef, width: 32, height: 32 });
  const ctx = createMockContext();

  editor.activeAction = 'turn-left';
  editor.drawCarEditorPreview(ctx, { x: 10, y: 20, w: 260, h: 180 }, editor.selectedCar);

  const imageRefs = ctx.calls
    .filter((call) => call.type === 'drawImage')
    .map((call) => call.args[0]?.artRef);
  assert.equal(imageRefs.includes('leftSprite'), true);
  assert.equal(imageRefs.includes('rightSprite'), false);
});

test('Car Editor top-menu tuning actions update actual car data', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  const startTorque = editor.selectedCar.tuning.torqueLbFt;
  const startPressure = editor.selectedCar.setup.tirePressurePsi.fl;

  editor.handleMenuAction('power-curve');
  editor.handleMenuAction('tire-pressure');

  assert.ok(editor.selectedCar.tuning.torqueLbFt > startTorque);
  assert.equal(editor.selectedCar.setup.tirePressurePsi.fl, startPressure + 1);
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
    { mode: 'race', from: 'file', to: 'track', expectedAction: 'draw-road' },
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

  const generateRoot = editor.buttons.find((button) => button.desktopRootId === 'file');
  assert.ok(generateRoot);
  editor.handlePointerDown({
    x: generateRoot.bounds.x + generateRoot.bounds.w / 2,
    y: generateRoot.bounds.y + generateRoot.bounds.h / 2
  });
  editor.draw(ctx, 1280, 800);

  const drawerGenerate = editor.buttons.find((button) => button.id === 'generate-random-race' && button.desktopDropdownItem);
  assert.ok(drawerGenerate);
  assert.equal(editor.buttons.some((button) => (
    button.id === 'generate-random-race'
    && !button.contextPanelCommand
    && !button.desktopRootId
    && !button.desktopDropdownItem
  )), false);
});

test('Race desktop exposes play through the top editor control instead of a Drive drawer', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();

  editor.draw(ctx, 1280, 800);
  assert.equal(editor.buttons.some((button) => button.desktopRootId === 'drive'), false);
  const playButton = editor.buttons.find((button) => button.id === 'test-drive' && !button.desktopDropdownItem);
  assert.ok(playButton);
  assert.ok(playButton.bounds.y > 48 && playButton.bounds.y < 90);

  editor.startPlaytest('starter-rwd');
  editor.draw(ctx, 1280, 800);
  assert.equal(editor.buttons.some((button) => button.id === 'end-playtest' && !button.desktopDropdownItem), false);
  assert.ok(editor.buttons.some((button) => button.id === 'race-pause-return-editor'));
  assert.equal(editor.getMenuItems('drive').length, 0);
});

test('Race desktop top Play control opens the car picker without a Drive drawer', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();

  editor.draw(ctx, 1280, 800);
  const playButton = editor.buttons.find((button) => button.id === 'test-drive' && !button.desktopDropdownItem);
  assert.ok(playButton);

  editor.handlePointerDown({
    x: playButton.bounds.x + playButton.bounds.w / 2,
    y: playButton.bounds.y + playButton.bounds.h / 2
  });
  assert.equal(editor.playtestPickerOpen, false);
  editor.handlePointerUp({
    x: playButton.bounds.x + playButton.bounds.w / 2,
    y: playButton.bounds.y + playButton.bounds.h / 2
  });
  assert.equal(editor.playtestPickerOpen, true);
  assert.equal(editor.buttons.some((button) => button.desktopRootId === 'drive'), false);
});

test('Race desktop playtest top pause returns to editor on release only', () => {
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
  assert.equal(editor.raceInput.paused, false);

  editor.startPlaytest('starter-rwd');
  editor.raceInput.paused = false;
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
  assert.deepEqual(fileItems.slice(6, 12).map((item) => item.id), [
    'generate-random-race',
    'load-weathertech-raceway',
    'load-nurburgring-nordschleife',
    'load-col-de-turini',
    'load-ouninpohja',
    'load-daytona-tri-oval'
  ]);
  assert.deepEqual(carFileItems.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'load-wrx', 'load-brz', 'load-civic', 'exit-main']);
  assert.equal(carFileItems.find((item) => item.id === 'load-wrx')?.label, 'Load WRX');
  assert.equal(carFileItems.find((item) => item.id === 'load-brz')?.disabled, false);
  assert.equal(carFileItems.find((item) => item.id === 'load-civic')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'new')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'save')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'save-as')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'open')?.disabled, false);
  assert.equal(fileItems.find((item) => item.id === 'export')?.disabled, true);
  assert.equal(fileItems.find((item) => item.id === 'import')?.disabled, true);
  assert.equal(fileItems.at(-1)?.id, 'exit-main');
  assert.equal(fileItems.at(-1)?.label, 'Exit to Main Menu');
  assert.equal(fileItems.find((item) => item.id === 'exit-main')?.disabled, false);
  assert.equal(typeof fileItems.find((item) => item.id === 'exit-main')?.onSelect, 'function');
});

test('Race Editor touch file menu enables Open and keeps remaining scaffold rows inert', () => {
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
  const exportButton = editor.buttons.find((button) => button.id === 'export');
  assert.ok(openButton);
  assert.equal(openButton.disabled, false);
  assert.equal(typeof openButton.onClick, 'function');
  assert.ok(exportButton);
  assert.equal(exportButton.disabled, true);
  assert.equal(exportButton.onClick, null);
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

test('Race Editor default cars expose real dimensions for physics and rendering scale', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const wrx = editor.project.cars.find((car) => car.id === 'starter-rwd');
  const brz = editor.project.cars.find((car) => car.id === 'subaru-brz-2022');
  const civic = editor.project.cars.find((car) => car.id === 'honda-civic-type-r-2023');

  assert.deepEqual(
    ['widthM', 'wheelbaseM', 'trackFrontM', 'trackRearM'].map((key) => Number(wrx.dimensions[key].toFixed(2))),
    [1.83, 2.67, 1.56, 1.56]
  );
  assert.deepEqual(
    ['widthM', 'wheelbaseM', 'trackFrontM', 'trackRearM'].map((key) => Number(brz.dimensions[key].toFixed(2))),
    [1.78, 2.58, 1.52, 1.55]
  );
  assert.deepEqual(
    ['widthM', 'wheelbaseM', 'trackFrontM', 'trackRearM'].map((key) => Number(civic.dimensions[key].toFixed(2))),
    [1.89, 2.74, 1.63, 1.62]
  );
  assert.equal(Number(editor.getRaceCarDimensions(brz).trackWidthM.toFixed(3)), 1.535);
});

test('Race playtest keeps road and car scale in a believable range', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');

  assert.equal(editor.selectedRace.road.laneCount, 1);
  assert.equal(editor.selectedRace.road.laneWidthM, 3.6);
  assert.equal(editor.selectedRace.road.width, 3.6);
  assert.equal(editor.getRaceRoadHalfWidthWorld(), 1.8);
  assert.equal(editor.getRaceRoadWidthToCarRatio() > 1.9, true);
  assert.equal(editor.getRaceThirdPersonCarWidth({ w: 390, h: 240 }) >= 94, true);
  assert.equal(editor.getRaceThirdPersonCarWidth({ w: 390, h: 240 }) <= 104, true);
  assert.equal(editor.getRaceCarWorldWidth() > 1.7, true);
  assert.equal(editor.shouldRenderRaceCenterLaneDash({ roadWidthM: 3.6 }, editor.selectedCar), false);
  assert.equal(editor.shouldRenderRaceCenterLaneDash({ roadWidthM: 7.2 }, editor.selectedCar), true);
  assert.equal(editor.getRaceRoadWidthToCarRatio({ roadWidthM: 2.5 }) >= 1.25, true);
  assert.equal(editor.getRaceRoadWidthToCarRatio({ roadWidthM: 2.5 }) <= 1.5, true);
  const marker = editor.getRaceLaneMarkerDimensionsWorld();
  assert.equal(Math.abs(marker.dashLength / marker.interval - 0.25) < 0.001, true);
  assert.equal(marker.dashWidth < editor.getRaceCarWorldWidth() * 0.08, true);
});

test('Race playtest steering angle is limited by wheelbase and plausible lateral grip', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });

  ['starter-rwd', 'subaru-brz-2022', 'honda-civic-type-r-2023'].forEach((carId) => {
    editor.startPlaytest(carId);
    const car = editor.project.cars.find((candidate) => candidate.id === carId);
    const dimensions = editor.getRaceCarDimensions(car);
    const speedMps = 60 * 0.44704;
    const tireAngle = editor.getRacePhysicalTireAngleForSteering(1, speedMps);
    const turnRadiusM = dimensions.wheelbaseM / Math.tan(Math.abs(tireAngle));
    const lateralG = (speedMps * speedMps / turnRadiusM) / 9.81;

    assert.equal(dimensions.wheelbaseM >= 2.58, true);
    assert.equal(dimensions.trackWidthM >= 1.53, true);
    assert.equal(Math.abs(tireAngle) < 0.04, true);
    assert.equal(turnRadiusM > 70, true);
    assert.equal(lateralG <= 0.96, true);
  });
});

test('Race playtest projection scales one-lane roads for first and third person views', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 60;
  editor.playtestSession.elapsedMs = 2000;
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const measureNearRoadRatio = (cameraView) => {
    editor.raceInput.cameraView = cameraView;
    editor.playtestSession.cameraView = cameraView;
    editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
    const { camera, cameraYaw } = editor.lastRaceRenderCamera;
    const currentSegment = editor.getRaceSegmentAtDistance(editor.getRaceVisualTravelDistance(editor.playtestSession)).segment;
    const slices = editor.getRaceMode7DepthSlices({
      bounds,
      camera,
      cameraYaw,
      visualTravel: editor.getRaceVisualTravelDistance(editor.playtestSession),
      routeLength: editor.playtestSession.routeLength,
      routeRuntimeType: editor.playtestSession.routeRuntimeType,
      nearDistance: Math.max(camera.nearPlane + 3.8, 3.2),
      viewDistance: 500,
      sliceCount: 20
    });
    const near = slices.find((slice) => slice.left?.visible && slice.right?.visible);
    return Math.abs(near.right.screenX - near.left.screenX) / bounds.w;
  };
  const firstPersonRatio = measureNearRoadRatio('first-person');
  const thirdPersonRatio = measureNearRoadRatio('third-person');
  const carWidth = editor.getRaceThirdPersonCarWidth(bounds);
  const thirdPersonRoadWidth = thirdPersonRatio * bounds.w;

  assert.equal(firstPersonRatio >= 0.9, true);
  assert.equal(firstPersonRatio <= 1.08, true);
  assert.equal(thirdPersonRatio >= 0.45, true);
  assert.equal(thirdPersonRatio <= 0.55, true);
  assert.equal(carWidth / thirdPersonRoadWidth > 0.45, true);
  assert.equal(carWidth / thirdPersonRoadWidth < 0.58, true);
});

test('Race third-person procedural car footprint fits inside a one-lane road', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.raceInput.cameraView = 'third-person';
  editor.playtestSession.cameraView = 'third-person';
  editor.playtestSession.elapsedMs = 2000;
  editor.playtestSession.speedMps = 18;
  const pose = editor.getRaceWorldPoseAtDistance(24);
  editor.playtestSession.distance = 24;
  editor.playtestSession.worldX = pose.x;
  editor.playtestSession.worldZ = pose.z;
  editor.playtestSession.carYaw = pose.yaw;
  editor.playtestSession.cameraYaw = pose.yaw;
  const bounds = { x: 0, y: 0, w: 390, h: 260 };

  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const { camera, cameraYaw } = editor.lastRaceRenderCamera;
  const section = editor.getRaceRoadCrossSectionAtDistance(24, {
    runtimeType: editor.playtestSession.routeRuntimeType,
    routeLength: editor.playtestSession.routeLength
  });
  const roadLeft = editor.projectRaceWorldPointToCamera(section.left, camera, cameraYaw, bounds);
  const roadRight = editor.projectRaceWorldPointToCamera(section.right, camera, cameraYaw, bounds);
  const carPoints = editor.getRaceProjectedCarFootprintPoints({
    x: pose.x,
    z: pose.z,
    elevation: section.center.elevation
  }, pose.yaw, editor.selectedCar, { elevation: section.center.elevation })
    .map((point) => editor.projectRaceWorldPointToCamera(point, camera, cameraYaw, bounds))
    .filter((point) => point.visible);
  const roadWidth = Math.abs(Number(roadRight.screenX || 0) - Number(roadLeft.screenX || 0));
  const xs = carPoints.map((point) => Number(point.screenX || 0));
  const carWidth = Math.max(...xs) - Math.min(...xs);

  assert.equal(editor.selectedRace.road.width, 3.6);
  assert.equal(editor.getRaceRoadWidthToCarRatio() > 1.9, true);
  assert.equal(roadLeft.visible && roadRight.visible, true);
  assert.equal(carPoints.length >= 4, true);
  assert.equal(carWidth < roadWidth * 0.72, true);
});

test('Race playtest camera FOV uses normal game camera ranges instead of telephoto zoom', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { w: 390, h: 260 };

  assert.equal(editor.getRaceEquivalentFovDegrees('third-person', 0, bounds) >= 45, true);
  assert.equal(editor.getRaceEquivalentFovDegrees('third-person', 1, bounds) <= 55, true);
  assert.equal(editor.getRaceEquivalentFovDegrees('first-person', 0, bounds) >= 60, true);
  assert.equal(editor.getRaceEquivalentFovDegrees('first-person', 1, bounds) <= 70, true);
});

test('Race playtest widens roads and damps high-speed steering', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');

  assert.equal(editor.getRaceRoadHalfWidthWorld() >= 1.8, true);
  assert.equal(editor.getRaceMaxSteerForSpeed(0), 1);
  assert.equal(editor.getRaceMaxSteerForSpeed(70) >= 0.19, true);
  assert.equal(editor.getRaceMaxSteerForSpeed(70) <= 0.21, true);
  assert.equal(editor.getRaceBinarySteerAssist(70).steeringAuthority <= 0.21, true);
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
  assert.equal(editor.getRaceMaxSteerForSpeed(27) > 0.58, true);
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

test('Race playtest launch camera keeps the initial yaw until launch lock releases', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadConnected: true, isGamepadConnected() { return this.gamepadConnected; } },
    exitRaceEditor() {}
  });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.startYaw = 0.4;
  editor.playtestSession.carYaw = 1.2;
  editor.playtestSession.launchLockMs = 180;
  editor.raceInput.lookAngle = 0;

  assert.equal(editor.getRacePlaytestCameraYaw(editor.playtestSession), 0.4);

  editor.raceInput.lookAngle = 0.25;
  assert.equal(editor.getRacePlaytestCameraYaw(editor.playtestSession), 1.45);

  editor.raceInput.lookAngle = 0;
  editor.playtestSession.launchLockMs = 0;
  assert.equal(editor.getRacePlaytestCameraYaw(editor.playtestSession), 1.2);
});

test('Race playtest launch ignores held left thumbstick until staged start releases', () => {
  const gameInput = { gamepadAxes: { leftX: 1, leftTrigger: 0, rightTrigger: 0 } };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    exitRaceEditor() {}
  });
  editor.startPlaytest('starter-rwd');
  const startYaw = editor.playtestSession.startYaw;

  editor.updatePlaytest(0.2);

  assert.equal(editor.raceInput.analogSteeringActive, true);
  assert.equal(editor.raceInput.analogSteeringIntent > 0.9, true);
  assert.equal(editor.raceInput.steeringTarget, 0);
  assert.equal(editor.raceInput.steeringWheel, 0);
  assert.equal(editor.playtestSession.lateral, 0);
  assert.equal(editor.playtestSession.roadViewOffset, 0);
  assert.equal(editor.playtestSession.cameraYaw, startYaw);

  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.projectedDistance = 0;
  editor.playtestSession.speedMps = 4;
  editor.updatePlaytest(0.1);

  assert.equal(editor.raceInput.steeringTarget > 0, true);
  assert.equal(editor.raceInput.steeringWheel > 0, true);
});

test('Race playtest launch starts with the camera behind the live car pose', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.startPlaytest('starter-rwd');
  editor.raceInput.binarySteer = 1;
  editor.raceInput.throttle = true;
  editor.raceInput.activeThrottlePointerId = 'go';

  for (let frame = 0; frame < 90; frame += 1) editor.updatePlaytest(1 / 60);
  editor.playtestSession.worldX += 32;
  editor.playtestSession.carYaw += 0.65;
  editor.playtestSession.cameraYaw = editor.playtestSession.carYaw;
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const chaseDistance = editor.getRaceThirdPersonChaseDistance(editor.selectedCar);
  const liveCarYaw = Number(editor.playtestSession.carYaw || 0);
  const expectedCameraX = Number(editor.playtestSession.worldX || 0) - Math.sin(liveCarYaw) * chaseDistance;
  const expectedCameraZ = Number(editor.playtestSession.worldZ || 0) - Math.cos(liveCarYaw) * chaseDistance;

  assert.equal(editor.raceInput.steeringWheel > 0, true);
  assert.equal(Math.abs(editor.lastRaceRenderCamera.camera.x - expectedCameraX) < 0.001, true);
  assert.equal(Math.abs(editor.lastRaceRenderCamera.camera.z - expectedCameraZ) < 0.001, true);
  assert.equal(Math.abs(editor.lastRaceRenderCamera.cameraYaw - liveCarYaw) < 0.001, true);
  assert.equal(Object.prototype.hasOwnProperty.call(editor.lastRaceRenderCamera, 'launchProjectionBlend'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(editor.playtestSession, 'launchProjectionHold'), false);
});

test('Race playtest keeps Studio Sprint pre-start projection stable before throttle', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.startPlaytest('starter-rwd');
  assert.equal(editor.selectedRace.name, 'Studio Sprint');
  assert.equal(editor.playtestSession.projectedDistance < 0, true);

  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const initialProjectedDistance = editor.playtestSession.projectedDistance;
  const initialVisualTravel = editor.getRaceVisualTravelDistance(editor.playtestSession);
  const initialCameraYaw = editor.playtestSession.cameraYaw;
  const initialHorizonRatio = editor.lastRaceRenderCamera.camera.horizonRatio;
  const initialNearPlane = editor.lastRaceRenderCamera.camera.nearPlane;
  const initialFirstSlice = editor.lastRaceMode7Slices[0].center.distance;

  editor.updatePlaytest(0.016);
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });

  assert.equal(editor.playtestSession.distance, 0);
  assert.equal(editor.playtestSession.projectedDistance, initialProjectedDistance);
  assert.equal(editor.getRaceVisualTravelDistance(editor.playtestSession), initialVisualTravel);
  assert.equal(editor.playtestSession.cameraYaw, initialCameraYaw);
  assert.equal(editor.lastRaceRenderCamera.camera.horizonRatio, initialHorizonRatio);
  assert.equal(editor.lastRaceRenderCamera.camera.nearPlane, initialNearPlane);
  assert.equal(editor.lastRaceMode7Slices[0].center.distance, initialFirstSlice);
});

test('Race playtest holds WebGL render scale during pre-start launch', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.startPlaytest('starter-rwd');
  editor.raceWebGLTrackDynamicScale = 0.7;

  assert.equal(editor.shouldHoldRaceWebGLDynamicScale(), true);
  editor.updateRacePlaytestFps(0.2);

  assert.equal(editor.raceWebGLTrackDynamicScale, 1);
  assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 32 }), 0.32);

  editor.playtestSession.projectedDistance = 10;
  editor.playtestSession.distance = 10;
  editor.playtestSession.launchLockMs = 0;
  assert.equal(editor.shouldHoldRaceWebGLDynamicScale(), false);
  editor.updateRacePlaytestFps(0.2);
  assert.equal(editor.raceWebGLTrackDynamicScale < 1, true);
});

test('Race playtest prewarms terrain from the negative visual start distance', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.prewarmRacePlaytestRenderResources();
  const routeLength = editor.getRaceRouteLength();
  const range = editor.getRaceVisualDistanceRange({
    routeLength,
    runtimeType: editor.playtestSession.routeRuntimeType,
    startBackDistance: editor.playtestSession.startBackDistance
  });

  assert.equal(range.minVisualDistance < 0, true);
  assert.equal(editor.playtestSession.worldBake?.terrainCells?.length > 0, true);
  assert.equal(editor.playtestSession.worldBake?.runtimeType, editor.playtestSession.routeRuntimeType);
});

test('Race visual range keeps signed destination extension available to terrain clipping', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  const routeLength = editor.getRaceRouteLength();
  const range = editor.getRaceVisualDistanceRange({
    routeLength,
    runtimeType: 'destination',
    startBackDistance: editor.playtestSession.startBackDistance
  });
  const beforeStart = editor.getRaceSurfaceSectionAtDistance(range.minVisualDistance, {
    routeLength,
    runtimeType: 'destination',
    allowVisualExtension: true
  });
  const afterFinish = editor.getRaceSurfaceSectionAtDistance(range.maxVisualDistance, {
    routeLength,
    runtimeType: 'destination',
    allowVisualExtension: true
  });

  assert.equal(range.minVisualDistance < 0, true);
  assert.equal(range.maxVisualDistance > routeLength, true);
  assert.equal(beforeStart.center.distance, range.minVisualDistance);
  assert.equal(afterFinish.center.distance, range.maxVisualDistance);
  assert.equal(raceEditorSource.includes('getRaceVisualDistanceRange'), true);
  assert.equal(raceEditorSource.includes('weldSeamPoint'), true);
});

test('Race playtest keeps road center and width stable through a slow first frame', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.startPlaytest('starter-rwd');
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const initialNear = editor.lastRaceMode7Slices[0];
  const initialCenter = initialNear.center.screenX;
  const initialWidth = initialNear.right.screenX - initialNear.left.screenX;
  const initialHorizonRatio = editor.lastRaceRenderCamera.camera.horizonRatio;
  const initialResolution = editor.getRaceWebGLTrackRenderResolution({ resolution: 32 });

  editor.updateRacePlaytestFps(0.2);
  editor.updatePlaytest(0.016);
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });

  const nextNear = editor.lastRaceMode7Slices[0];
  assert.equal(nextNear.center.screenX, initialCenter);
  assert.equal(nextNear.right.screenX - nextNear.left.screenX, initialWidth);
  assert.equal(editor.lastRaceRenderCamera.camera.horizonRatio, initialHorizonRatio);
  assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 32 }), initialResolution);
  assert.equal(editor.raceWebGLTrackDynamicScale, 1);
});

test('Race playtest pre-start projection advances smoothly until the start line', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.projectedDistance = -0.25;
  editor.playtestSession.speedMps = 5;
  editor.playtestSession.velocityYaw = editor.playtestSession.startYaw;
  editor.playtestSession.carYaw = editor.playtestSession.startYaw;
  editor.playtestSession.launchLockMs = 0;

  editor.updatePlaytest(0.1);

  assert.equal(editor.playtestSession.projectedDistance, 0);
  assert.equal(editor.getRaceVisualTravelDistance(editor.playtestSession) >= 0, true);
  assert.equal(raceEditorSource.includes('const preStartProjectedDistance = clamp(previousProjectedDistance + routeAdvance'), true);
});

test('Race playtest uses live projection on the first start-line transition frame', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.startPlaytest('starter-rwd');
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const initialResolution = editor.getRaceWebGLTrackRenderResolution({ resolution: 32 });

  editor.playtestSession.projectedDistance = -0.2;
  editor.playtestSession.launchLockMs = 1;
  editor.playtestSession.speedMps = 18;
  editor.playtestSession.velocityYaw = editor.playtestSession.startYaw;
  editor.playtestSession.carYaw = editor.playtestSession.startYaw;
  editor.updatePlaytest(0.05);
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });

  assert.equal(editor.playtestSession.projectedDistance, 0);
  assert.equal(editor.lastRaceRenderCamera.cameraYaw, editor.playtestSession.cameraYaw);
  assert.equal(Object.prototype.hasOwnProperty.call(editor.lastRaceRenderCamera, 'launchProjectionBlend'), false);
  assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 32 }), initialResolution);
});

test('Race playtest does not use a launch projection blend period', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.projectedDistance = 0;
  editor.playtestSession.distance = 0;
  editor.playtestSession.speedMps = 44;
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const startFocal = editor.lastRaceRenderCamera.camera.focalScale;

  editor.playtestSession.distance = 9;
  editor.playtestSession.projectedDistance = 9;
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const midFocal = editor.lastRaceRenderCamera.camera.focalScale;

  editor.playtestSession.distance = 20;
  editor.playtestSession.projectedDistance = 20;
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const endFocal = editor.lastRaceRenderCamera.camera.focalScale;

  assert.equal(Object.prototype.hasOwnProperty.call(editor.lastRaceRenderCamera, 'launchProjectionBlend'), false);
  assert.equal(midFocal, startFocal);
  assert.equal(endFocal, startFocal);
  assert.equal(raceEditorSource.includes('launchProjectionTransitionMs'), false);
  assert.equal(raceEditorSource.includes('launchProjectionBlendDistanceM'), false);
  assert.equal(raceEditorSource.includes('launchProjectionHold'), false);
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
  const backDistance = (startPose.x - editor.playtestSession.worldX) * forwardX
    + (startPose.z - editor.playtestSession.worldZ) * forwardZ;
  assert.equal(backDistance >= editor.getRaceCarWorldWidth() * 4, true);
  assert.equal(editor.playtestSession.startBackDistance > 0, true);
  assert.equal(editor.playtestSession.projectedDistance < 0, true);
  assert.equal(editor.getRaceVisualTravelDistance(editor.playtestSession) < 0, true);

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

test('Race playtest HUD top pause button returns to editor and pause overlay stays on controller pause', () => {
  let exited = false;
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() { exited = true; }
  });
  const ctx = createMockContext();
  editor.startPlaytest('starter-rwd');
  editor.updateRacePlaytestFps(1 / 60);
  editor.lastRaceRenderStats = { polygons: 124, drawCalls: 4, terrainCells: 12, terrainCandidates: 48 };
  editor.drawRacePlaytestScreen(ctx, { x: 0, y: 0, w: 390, h: 260 });

  const pause = editor.buttons.find((button) => button.id === 'race-pause-return-editor');
  const returnButton = editor.buttons.find((button) => button.id === 'race-return-editor');
  const mainMenu = editor.buttons.find((button) => button.id === 'race-exit-main');
  assert.ok(pause);
  assert.equal(Boolean(returnButton), false);
  assert.equal(Boolean(mainMenu), false);
  assert.equal(pause.bounds.y <= 8, true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === '60 FPS'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && String(call.value || '').startsWith('Polys 124 / Draws 4 / T 12/48')), true);

  pause.onClick();
  assert.equal(editor.playtestSession, null);
  assert.equal(editor.raceInput.paused, false);

  editor.startPlaytest('starter-rwd');
  editor.toggleRacePause();
  editor.drawRacePlaytestScreen(ctx, { x: 0, y: 0, w: 390, h: 260 });
  const resume = editor.buttons.find((button) => button.id === 'race-resume');
  const settings = editor.buttons.find((button) => button.id === 'race-car-settings');
  const exit = editor.buttons.find((button) => button.id === 'race-exit-main');
  assert.ok(resume);
  assert.ok(settings);
  assert.ok(exit);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === '> Return to Game'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === '  Settings'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value.includes?.('ABS')), false);
  settings.onClick();
  const settingsCtx = createMockContext();
  editor.drawRacePlaytestScreen(settingsCtx, { x: 0, y: 0, w: 390, h: 260 });
  const abs = editor.buttons.find((button) => button.id === 'race-toggle-abs');
  const traction = editor.buttons.find((button) => button.id === 'race-toggle-tc');
  const transmission = editor.buttons.find((button) => button.id === 'race-toggle-transmission');
  const telemetry = editor.buttons.find((button) => button.id === 'race-toggle-telemetry');
  assert.ok(abs);
  assert.ok(traction);
  assert.ok(transmission);
  assert.ok(telemetry);
  assert.equal(settingsCtx.calls.some((call) => call.type === 'text' && call.value === '> ABS'), true);
  assert.equal(settingsCtx.calls.some((call) => call.type === 'text' && call.value === '< On >'), true);
  assert.equal(settingsCtx.calls.some((call) => call.type === 'text' && call.value === '  Traction Control'), true);
  assert.equal(settingsCtx.calls.some((call) => call.type === 'text' && call.value === '  Telemetry'), true);
  assert.equal(settingsCtx.calls.some((call) => call.type === 'text' && call.value === '  Back'), true);
  abs.onClick();
  assert.equal(editor.playtestSession.absEnabled, false);
  traction.onClick();
  assert.equal(editor.playtestSession.tractionControlEnabled, false);
  transmission.onClick();
  assert.equal(editor.playtestSession.transmissionType, 'manual');
  telemetry.onClick();
  assert.equal(editor.playtestSession.telemetryVisible, true);
  resume.onClick();
  assert.equal(editor.raceInput.paused, false);
  editor.toggleRacePause();
  editor.drawRacePlaytestScreen(ctx, { x: 0, y: 0, w: 390, h: 260 });
  const pausedExit = editor.buttons.find((button) => button.id === 'race-exit-main');
  assert.ok(pausedExit);
  pausedExit.onClick();
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

test('Race playtest pause overlay renders as text navigation instead of editor buttons', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.startPlaytest('starter-rwd');
  editor.toggleRacePause();

  editor.drawRacePauseOverlay(ctx, { x: 0, y: 0, w: 390, h: 240 });

  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === 'Paused'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === '> Return to Game'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === '  Settings'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && String(call.value).includes('D-pad: Navigate')), true);
  assert.equal(ctx.calls.some((call) => call.type === 'strokeRect'), false);
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
  assert.equal(raceEditorSource.includes('const clipTop = this.getRaceProjectedTerrainTop(bounds, camera);'), true);
  assert.equal(raceEditorSource.includes('ctx.rect?.(Number(bounds.x || 0), clipTop, Number(bounds.w || 1), Math.max(1, Number(bounds.y || 0) + Number(bounds.h || 1) - clipTop));'), true);
});

test('Race playtest checker stripes use projected road slices when available', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  const ctx = createMockContext();
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const camera = {
    ...editor.getRaceWorldPoseAtDistance(0),
    horizonRatio: 0.31,
    roadDepthRatio: 0.66,
    roadWidthScale: 2,
    focalScale: 1.04,
    nearPlane: 1.2,
    distance: 0
  };
  const slices = [
    {
      center: { distance: 6, screenX: 195, screenY: 232, cameraZ: 8, renderZ: 8, segment: editor.selectedSegment },
      left: { screenX: 88, screenY: 236, cameraZ: 8, renderZ: 8, visible: true },
      right: { screenX: 302, screenY: 228, cameraZ: 8, renderZ: 8, visible: true }
    },
    {
      center: { distance: 15, screenX: 198, screenY: 178, cameraZ: 24, renderZ: 24, segment: editor.selectedSegment },
      left: { screenX: 132, screenY: 181, cameraZ: 24, renderZ: 24, visible: true },
      right: { screenX: 264, screenY: 175, cameraZ: 24, renderZ: 24, visible: true }
    }
  ];
  let directProjectionCalls = 0;
  editor.projectRaceWorldPointToCamera = () => {
    directProjectionCalls += 1;
    return { visible: false, screenX: 0, screenY: 0, cameraZ: -1, renderZ: -1 };
  };

  editor.drawRaceCheckerStripeAtDistance(ctx, bounds, {
    slices,
    camera,
    cameraYaw: 0,
    distance: 6,
    depth: 9
  });

  assert.equal(ctx.calls.filter((call) => call.type === 'fill').length >= 10, true);
  assert.equal(directProjectionCalls, 0);
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
  assert.equal(raceEditorSource.includes('visualWidthMultiplier: visualRoadWidthMultiplier'), false);
});

test('Race destination visual sampling extends before start and beyond finish without changing clamped physics sampling', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 0, y: 180, elevation: 0 },
    { x: 60, y: 260, elevation: 0 }
  ];
  const routeLength = editor.getRaceRouteLength();
  const clampedStart = editor.getRaceWorldPoseAtDistance(-20, { runtimeType: 'destination' });
  const visualStart = editor.getRaceWorldPoseAtDistance(-20, {
    runtimeType: 'destination',
    allowVisualExtension: true
  });
  const clampedFinish = editor.getRaceWorldPoseAtDistance(routeLength + 20, { runtimeType: 'destination' });
  const visualFinish = editor.getRaceWorldPoseAtDistance(routeLength + 20, {
    runtimeType: 'destination',
    allowVisualExtension: true
  });

  assert.equal(clampedStart.distance, 0);
  assert.equal(visualStart.distance, -20);
  assert.equal(Math.hypot(visualStart.x - clampedStart.x, visualStart.z - clampedStart.z) > 10, true);
  assert.equal(Math.abs(clampedFinish.distance - routeLength) < 0.001, true);
  assert.equal(visualFinish.distance, routeLength + 20);
  assert.equal(Math.hypot(visualFinish.x - clampedFinish.x, visualFinish.z - clampedFinish.z) > 10, true);
  editor.startPlaytest('starter-rwd');
  const camera = {
    ...editor.getRaceWorldPoseAtDistance(0, { runtimeType: 'destination' }),
    z: -8,
    elevation: 1.2,
    nearPlane: 1.4,
    horizonRatio: 0.31,
    roadDepthRatio: 0.66,
    focalScale: 1.04,
    roadWidthScale: 2.06,
    roadMaxWidthRatio: 1
  };
  const slices = editor.getRaceMode7DepthSlices({
    bounds: { x: 0, y: 0, w: 390, h: 260 },
    camera,
    cameraYaw: camera.yaw,
    visualTravel: 0,
    routeLength: editor.playtestSession.routeLength,
    routeRuntimeType: 'destination',
    nearDistance: 1.4,
    viewDistance: 120,
    sliceCount: 48
  });
  assert.equal(slices.some((slice) => Number(slice.routeDistance) < 0), true);
  assert.equal(raceEditorSource.includes('RACE_DESTINATION_VISUAL_EXTENSION_M'), true);
});

test('Race WebGL mesh triangulation is stable for duplicate and reversed projected polygons', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 320, h: 180 };
  const camera = { nearPlane: 1.2, farPlane: 500 };
  const projected = [
    { clipX: -0.4, clipY: -0.2, screenX: 96, screenY: 108, cameraZ: 20, x: 0, z: 0, elevation: 0 },
    { clipX: 0.4, clipY: -0.2, screenX: 224, screenY: 108, cameraZ: 20, x: 10, z: 0, elevation: 0 },
    { clipX: 0.4, clipY: 0.2, screenX: 224, screenY: 72, cameraZ: 35, x: 10, z: 10, elevation: 0 },
    { clipX: 0.4, clipY: 0.2, screenX: 224, screenY: 72, cameraZ: 35, x: 10, z: 10, elevation: 0 },
    { clipX: -0.4, clipY: 0.2, screenX: 96, screenY: 72, cameraZ: 35, x: 0, z: 10, elevation: 0 }
  ];
  const points = projected.slice(0, 4).map((point) => ({
    x: point.x,
    z: point.z,
    elevation: point.elevation
  }));
  const stats = {};
  const vertices = editor.getRaceWebGLWorldMeshVertices(bounds, points, {
    camera,
    projectedPolygon: projected,
    stats
  });
  const reversed = editor.getRaceWebGLWorldMeshVertices(bounds, points, {
    camera,
    projectedPolygon: [...projected].reverse()
  });

  assert.equal(vertices.length > 0, true);
  assert.equal(reversed.length, vertices.length);
  assert.equal((stats.skippedDegenerateTriangles || 0) >= 0, true);
  assert.equal(raceEditorSource.includes('getRaceStableProjectedTriangles'), true);
  assert.equal(raceEditorSource.includes('dedupeRaceProjectedPolygon'), true);
});

test('Race WebGL terrain quads remain stable across near camera distance changes', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 220 };
  const points = [
    { x: -14, z: 4, elevation: 0 },
    { x: 14, z: 4, elevation: 0 },
    { x: 14, z: 52, elevation: 0.05 },
    { x: -14, z: 52, elevation: 0.05 }
  ];
  const counts = [0, 1.4, 2.8, 4.2].map((cameraZ) => editor.getRaceWebGLWorldMeshVertices(bounds, points, {
    camera: {
      x: 0,
      z: cameraZ,
      elevation: 0,
      nearPlane: 1.2,
      farPlane: 500,
      focalScale: 1,
      roadWidthScale: 2.2,
      horizonRatio: 0.31,
      roadDepthRatio: 0.66
    },
    cameraYaw: 0,
    stats: {}
  }).length);

  assert.equal(counts.every((count) => count > 0), true);
  assert.equal(raceEditorSource.includes('const cameraBounds = this.getRaceTerrainCameraBounds(points, camera, rightVector, forwardVector);'), true);
  assert.equal(raceEditorSource.includes('terrainCells.push({ points, averageCameraZ: cameraBounds.averageCameraZ, tileCell });'), true);
});

test('Race WebGL textured meshes keep UVs world anchored instead of centroid-generated', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 0,
    elevation: 0.1,
    nearPlane: 1.6,
    farPlane: 900,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.42
  };
  const points = [
    { x: -3, z: 0.8, elevation: 0 },
    { x: 3, z: 0.8, elevation: 0 },
    { x: 3, z: 9, elevation: 0 },
    { x: -3, z: 9, elevation: 0 }
  ];
  const texturedVertices = editor.getRaceWebGLWorldMeshVertices(bounds, points, {
    camera,
    cameraYaw: 0,
    textureWorldM: 2,
    textured: true
  });
  const untexturedVertices = editor.getRaceWebGLWorldMeshVertices(bounds, points, {
    camera,
    cameraYaw: 0,
    textureWorldM: 2,
    textured: false
  });

  assert.equal(texturedVertices.length > 0, true);
  assert.equal(untexturedVertices.length > texturedVertices.length, true);
  assert.equal(raceEditorSource.includes('const useWorldAnchoredUvTriangles = Boolean(textured);'), true);
});

function decodeRaceMeshUvs(vertices = []) {
  const uvs = [];
  for (let index = 0; index < vertices.length; index += 6) {
    const invDepth = vertices[index + 5];
    uvs.push({
      u: Math.round((vertices[index + 3] / invDepth) * 100000) / 100000,
      v: Math.round((vertices[index + 4] / invDepth) * 100000) / 100000
    });
  }
  return uvs.sort((a, b) => {
    if (Math.abs(a.u - b.u) > 0.000001) return a.u - b.u;
    return a.v - b.v;
  });
}

test('Race WebGL textured terrain UVs stay fixed across camera movement', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const points = [
    { x: -8, z: 12, elevation: 0.02 },
    { x: 8, z: 12, elevation: 0.03 },
    { x: 8, z: 32, elevation: 0.04 },
    { x: -8, z: 32, elevation: 0.01 }
  ];
  const cameras = [
    { x: 0, z: 0, elevation: 0.12, nearPlane: 1.2, farPlane: 900, focalScale: 1, roadWidthScale: 1, roadDepthRatio: 0.7, horizonRatio: 0.42 },
    { x: 0.9, z: 1.2, elevation: 0.12, nearPlane: 1.2, farPlane: 900, focalScale: 1, roadWidthScale: 1, roadDepthRatio: 0.7, horizonRatio: 0.42 },
    { x: -1.1, z: 2.4, elevation: 0.12, nearPlane: 1.2, farPlane: 900, focalScale: 1, roadWidthScale: 1, roadDepthRatio: 0.7, horizonRatio: 0.42 }
  ];
  const uvSets = cameras.map((camera) => decodeRaceMeshUvs(editor.getRaceWebGLWorldMeshVertices(bounds, points, {
    camera,
    cameraYaw: 0,
    textureWorldM: 4,
    textured: true,
    meshSource: 'terrain',
    rawTerrainPolygons: true,
    stats: {}
  })));

  assert.equal(uvSets.every((uvs) => uvs.length === uvSets[0].length), true);
  uvSets.slice(1).forEach((uvs) => assert.deepEqual(uvs, uvSets[0]));
});

test('Race WebGL textured terrain UVs are locally normalized for tiny texture scales', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = { x: 99996, z: 49994, elevation: 0.12, nearPlane: 1.2, farPlane: 900, focalScale: 1, roadWidthScale: 1, roadDepthRatio: 0.7, horizonRatio: 0.42 };
  const points = [
    { x: 100000, z: 50000, elevation: 0 },
    { x: 100008, z: 50000, elevation: 0 },
    { x: 100008, z: 50008, elevation: 0 },
    { x: 100000, z: 50008, elevation: 0 }
  ];
  const vertices = editor.getRaceWebGLWorldMeshVertices(bounds, points, {
    camera,
    cameraYaw: 0,
    textureWorldM: 0.001,
    textured: true,
    meshSource: 'terrain',
    rawTerrainPolygons: true,
    textureOriginX: Math.floor(100000 / 0.001) * 0.001,
    textureOriginZ: Math.floor(50000 / 0.001) * 0.001,
    stats: {}
  });
  const uvs = decodeRaceMeshUvs(vertices);
  const maxAbsUv = Math.max(...uvs.flatMap((uv) => [Math.abs(uv.u), Math.abs(uv.v)]));

  assert.equal(vertices.length > 0, true);
  assert.equal(maxAbsUv < 10000, true);
  assert.equal(raceEditorSource.includes('textureOriginX'), true);
  assert.equal(raceEditorSource.includes('textureOriginZ'), true);
});

test('Race WebGL world terrain mesh vertices are camera-independent and locally UV anchored', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const points = [
    { x: 100000, z: 50000, elevation: 0.01 },
    { x: 100008, z: 50000, elevation: 0.02 },
    { x: 100008, z: 50008, elevation: 0.03 },
    { x: 100000, z: 50008, elevation: 0.04 }
  ];
  const cells = [{ points, tileCell: { tileId: 'grass' } }];
  const vertices = editor.getRaceWebGLTerrainMeshVertices(cells, {
    textureWorldM: 0.001,
    textured: true,
    tileMap: editor.ensureRaceTileMap(),
    useSunShading: false
  });
  const verticesAgain = editor.getRaceWebGLTerrainMeshVertices(cells, {
    textureWorldM: 0.001,
    textured: true,
    tileMap: editor.ensureRaceTileMap(),
    useSunShading: false
  });
  const maxAbsUv = Math.max(...[3, 4, 12, 13, 21, 22, 30, 31, 39, 40, 48, 49].map((index) => Math.abs(vertices[index])));

  assert.equal(vertices.length, 54);
  assert.deepEqual(verticesAgain, vertices);
  assert.equal(maxAbsUv < 10000, true);
  assert.equal(raceEditorSource.includes('uniform vec3 uCameraPosition;'), true);
  assert.equal(raceEditorSource.includes('textureWorldM'), true);
});

test('Race WebGL screen-clipped terrain UVs use perspective-correct world interpolation', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const from = {
    x: -10,
    z: 12,
    elevation: 0,
    cameraX: -10,
    cameraY: 0,
    cameraZ: 10,
    renderZ: 10,
    screenX: 100,
    screenY: 40,
    clipX: -0.5,
    clipY: 0.7
  };
  const to = {
    x: 10,
    z: 36,
    elevation: 0,
    cameraX: 10,
    cameraY: 0,
    cameraZ: 40,
    renderZ: 40,
    screenX: 260,
    screenY: 200,
    clipX: 0.5,
    clipY: -0.6
  };
  const clipped = editor.clipRaceWebGLProjectedPolygonToScreenY([
    from,
    to,
    { ...to, x: 14, screenX: 300 },
    { ...from, x: -14, screenX: 60 }
  ], 120, bounds, { stats: {} });
  const intersection = clipped.find((point) => point.clippedToScreenY && Math.abs(Number(point.screenY) - 120) < 0.001);
  const t = 0.5;
  const fromInv = 1 / from.cameraZ;
  const toInv = 1 / to.cameraZ;
  const mixedInv = fromInv + (toInv - fromInv) * t;
  const expectedX = ((from.x * fromInv) + ((to.x * toInv) - (from.x * fromInv)) * t) / mixedInv;
  const expectedZ = ((from.z * fromInv) + ((to.z * toInv) - (from.z * fromInv)) * t) / mixedInv;

  assert.ok(intersection);
  assert.equal(Math.abs(intersection.x - expectedX) < 0.00001, true);
  assert.equal(Math.abs(intersection.z - expectedZ) < 0.00001, true);
  assert.equal(Math.abs(intersection.x - ((from.x + to.x) * 0.5)) > 1, true);
  assert.equal(Math.abs(intersection.z - ((from.z + to.z) * 0.5)) > 1, true);
});

test('Race WebGL near-plane clipping keeps terrain UVs on the world edge', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: 0,
    elevation: 0,
    nearPlane: 2,
    farPlane: 900,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.42
  };
  const from = {
    x: -8,
    z: 1,
    elevation: 0.02,
    cameraX: -8,
    cameraY: 0.02,
    cameraZ: 1,
    renderZ: 1
  };
  const to = {
    x: 8,
    z: 5,
    elevation: 0.06,
    cameraX: 8,
    cameraY: 0.06,
    cameraZ: 5,
    renderZ: 5
  };
  const clipped = editor.interpolateRaceNearPlaneClipPoint(from, to, 2, camera, bounds);

  assert.equal(Math.abs(clipped.x - -4) < 0.00001, true);
  assert.equal(Math.abs(clipped.z - 2) < 0.00001, true);
  assert.equal(Math.abs(clipped.elevation - 0.03) < 0.00001, true);
  assert.equal(clipped.cameraZ, 2);
  assert.equal(clipped.renderZ, 2);
  assert.equal(clipped.clippedToNearPlane, true);
  assert.equal(raceEditorSource.includes('interpolateRaceNearPlaneClipPoint'), true);
});

test('Race WebGL Studio Sprint bend terrain UVs stay world-bounded through optimization paths', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const bendPose = editor.getRaceWorldPoseAtDistance(470);
  const yaw = Number(bendPose.yaw || 0);
  const right = editor.getRaceRightVector(yaw);
  const forward = editor.getRaceForwardVector(yaw);
  const center = { x: Number(bendPose.x || 0) + forward.x * 12, z: Number(bendPose.z || 0) + forward.z * 12 };
  const makePoint = (side, depth) => {
    const point = {
      x: center.x + right.x * side + forward.x * depth,
      z: center.z + right.z * side + forward.z * depth
    };
    return {
      ...point,
      elevation: editor.getRaceStitchedTerrainElevationAtWorldPoint(point, Number(bendPose.elevation || 0))
    };
  };
  const points = [
    makePoint(-18, -10),
    makePoint(18, -10),
    makePoint(18, 34),
    makePoint(-18, 34)
  ];
  const original = JSON.stringify(points);
  const camera = {
    x: Number(bendPose.x || 0) - Math.sin(yaw) * 8,
    z: Number(bendPose.z || 0) - Math.cos(yaw) * 8,
    elevation: Number(bendPose.elevation || 0) + 0.32,
    nearPlane: 1.6,
    farPlane: 900,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    horizonRatio: 0.42
  };
  const scale = 4;
  const minU = Math.min(...points.map((point) => point.x / scale)) - 0.00001;
  const maxU = Math.max(...points.map((point) => point.x / scale)) + 0.00001;
  const minV = Math.min(...points.map((point) => -point.z / scale)) - 0.00001;
  const maxV = Math.max(...points.map((point) => -point.z / scale)) + 0.00001;
  const modes = [
    { rawTerrainPolygons: false, minScreenY: null },
    { rawTerrainPolygons: true, minScreenY: null },
    { rawTerrainPolygons: false, minScreenY: bounds.y + bounds.h * 0.28 }
  ];

  modes.forEach((mode) => {
    const vertices = editor.getRaceWebGLWorldMeshVertices(bounds, points, {
      camera,
      cameraYaw: yaw,
      textureWorldM: scale,
      textured: true,
      meshSource: 'terrain',
      rawTerrainPolygons: mode.rawTerrainPolygons,
      minScreenY: mode.minScreenY,
      stats: {}
    });
    assert.equal(vertices.length > 0, true);
    assert.equal(JSON.stringify(points), original);
    for (let index = 0; index < vertices.length; index += 6) {
      const invDepth = vertices[index + 5];
      const u = vertices[index + 3] / invDepth;
      const v = vertices[index + 4] / invDepth;
      assert.equal(Number.isFinite(u), true);
      assert.equal(Number.isFinite(v), true);
      assert.equal(u >= minU && u <= maxU, true);
      assert.equal(v >= minV && v <= maxV, true);
    }
  });
});

test('Race WebGL Studio Sprint slow camera keeps baked terrain subquad vertices and UVs fixed', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const tileMap = editor.ensureRaceTileMap();
  const terrainSize = 40;
  const bendPose = editor.getRaceWorldPoseAtDistance(470);
  const bendYaw = Number(bendPose.yaw || 0);
  const forward = editor.getRaceForwardVector(bendYaw);
  const targetX = Number(bendPose.x || 0) + forward.x * 58;
  const targetZ = Number(bendPose.z || 0) + forward.z * 58;
  const chunk = editor.getRaceBakedTerrainChunk(
    Math.trunc(targetX / terrainSize),
    Math.trunc(targetZ / terrainSize),
    terrainSize,
    tileMap,
    editor.getRaceTerrainBakeCache(tileMap, terrainSize)
  );
  const cameraSamples = [0, 1.4, 2.8, 4.2].map((offset) => {
    const pose = editor.getRaceWorldPoseAtDistance(470 + offset);
    const yaw = Number(pose.yaw || 0) + offset * 0.002;
    return {
      x: Number(pose.x || 0) - Math.sin(yaw) * 8,
      z: Number(pose.z || 0) - Math.cos(yaw) * 8,
      elevation: Number(pose.elevation || 0) + 0.32,
      nearPlane: 1.6,
      farPlane: 900,
      focalScale: 1,
      roadWidthScale: 1,
      roadDepthRatio: 0.7,
      horizonRatio: 0.42,
      yaw
    };
  });

  assert.ok(chunk);
  const subdivisionSamples = cameraSamples.map((camera) => {
    const cameraBounds = editor.getRaceTerrainCameraBounds(
      chunk.fullPoints,
      camera,
      editor.getRaceRightVector(camera.yaw),
      editor.getRaceForwardVector(camera.yaw)
    );
    return editor.getRaceBakedTerrainSubdivision(chunk, cameraBounds.averageCameraZ, {
      cameraCellX: (Number(cameraBounds.minCameraX) + Number(cameraBounds.maxCameraX)) * 0.5,
      detailEnabled: true,
      textured: true
    });
  });
  assert.equal(subdivisionSamples.every((value) => value === subdivisionSamples[0]), true);

  const subdivisions = subdivisionSamples[0];
  const subquad = editor.getRaceBakedTerrainQuadPoints(chunk, 0, 0, subdivisions);
  const expectedWorld = JSON.stringify(subquad.map((point) => ({
    x: Math.round(point.x * 1000) / 1000,
    z: Math.round(point.z * 1000) / 1000,
    elevation: Math.round(point.elevation * 100000) / 100000
  })));
  const snapshots = cameraSamples.map((camera) => {
    const vertices = editor.getRaceWebGLWorldMeshVertices(bounds, subquad, {
      camera,
      cameraYaw: camera.yaw,
      textureWorldM: 4,
      textured: true,
      meshSource: 'terrain',
      rawTerrainPolygons: true,
      stats: {}
    });
    assert.equal(vertices.length > 0, true);
    assert.equal(JSON.stringify(subquad.map((point) => ({
      x: Math.round(point.x * 1000) / 1000,
      z: Math.round(point.z * 1000) / 1000,
      elevation: Math.round(point.elevation * 100000) / 100000
    }))), expectedWorld);
    return decodeRaceMeshUvs(vertices);
  });

  snapshots.slice(1).forEach((uvs) => assert.deepEqual(uvs, snapshots[0]));
});

test('Race WebGL terrain vertex source remains stable across camera projections', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const points = [
    { x: -6, z: 0.9, elevation: 0.02 },
    { x: 6, z: 1.8, elevation: 0.03 },
    { x: 7, z: 22, elevation: 0.08 },
    { x: -7, z: 21, elevation: 0.06 }
  ];
  const original = JSON.stringify(points);
  const cameras = [
    { x: 0, z: 0, elevation: 0.12, nearPlane: 1.2, farPlane: 900, focalScale: 1, roadWidthScale: 1, roadDepthRatio: 0.7, horizonRatio: 0.42 },
    { x: 0.5, z: 1.1, elevation: 0.12, nearPlane: 1.2, farPlane: 900, focalScale: 1, roadWidthScale: 1, roadDepthRatio: 0.7, horizonRatio: 0.42 },
    { x: -0.75, z: 2.2, elevation: 0.12, nearPlane: 1.2, farPlane: 900, focalScale: 1, roadWidthScale: 1, roadDepthRatio: 0.7, horizonRatio: 0.42 }
  ];

  cameras.forEach((camera) => {
    const vertices = editor.getRaceWebGLWorldMeshVertices(bounds, points, {
      camera,
      cameraYaw: 0,
      textureWorldM: 2,
      textured: true,
      meshSource: 'terrain',
      rawTerrainPolygons: true,
      stats: {}
    });
    assert.equal(vertices.length > 0, true);
    assert.equal(JSON.stringify(points), original);
    for (let index = 0; index < vertices.length; index += 6) {
      const invDepth = vertices[index + 5];
      const textureU = vertices[index + 3] / invDepth;
      const textureV = vertices[index + 4] / invDepth;
      assert.equal(Number.isFinite(textureU), true);
      assert.equal(Number.isFinite(textureV), true);
      assert.equal(textureU >= -3.50001 && textureU <= 3.50001, true);
      assert.equal(textureV >= -11.00001 && textureV <= -0.45, true);
    }
  });
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

test('Race automatic brake reverse moves opposite the car heading from rest', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  seedLongStraightRace(editor);
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.worldX = 0;
  editor.playtestSession.worldZ = 0;
  editor.playtestSession.carYaw = 0;
  editor.playtestSession.velocityYaw = 0;
  editor.playtestSession.speedMps = 0;
  editor.raceInput.throttleAxis = 0;
  editor.raceInput.brakeAxis = 1;

  for (let frame = 0; frame < 180; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.raceInput.gear, -1);
  assert.equal(editor.playtestSession.speedMps < -0.5, true);
  assert.equal(editor.playtestSession.worldZ < -1.5, true);
  assert.equal(editor.playtestSession.distance, 0);

  editor.raceInput.brakeAxis = 0;
  editor.raceInput.throttleAxis = 1;
  const reverseSpeed = editor.playtestSession.speedMps;
  for (let frame = 0; frame < 90; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.raceInput.gear, 1);
  assert.equal(editor.playtestSession.speedMps > reverseSpeed, true);
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

test('Race parallax background does not render a literal sun disc', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.setRaceSunSettings({ angleDeg: 90, intensity: 1 });

  editor.drawRaceParallaxBackground(ctx, { x: 0, y: 0, w: 390, h: 260 }, {
    horizon: 90,
    cameraYaw: Math.PI / 2,
    heading: Math.PI / 2,
    speedMps: 30
  });

  assert.equal(ctx.calls.some((call) => call.type === 'arc'), false);
  assert.equal(raceEditorSource.includes('getRaceTerrainSunTint'), true);
  assert.equal(raceEditorSource.includes('getRaceTextureSunTint'), true);
});

test('Race playtest renderer projects a continuous world-space road path through camera yaw', () => {
  assert.equal(raceEditorSource.includes('const steeringCamera ='), false);
  assert.equal(raceEditorSource.includes('this.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud });'), true);
  assert.equal(raceEditorSource.includes('getRacePathSamples({ step = 18 } = {})'), true);
  assert.equal(raceEditorSource.includes('getRaceWorldPoseAtDistance(distance = 0, {'), true);
  assert.equal(raceEditorSource.includes('samples: providedSamples = null,'), true);
  assert.equal(raceEditorSource.includes('getRaceRoadCrossSectionAtDistance(distance = 0, {'), true);
  assert.equal(raceEditorSource.includes('visualWidthMultiplier = 1,'), false);
  assert.equal(raceEditorSource.includes('projectRaceWorldPointToCamera(point = {}, camera = {}, cameraYaw = 0, bounds = {})'), true);
  assert.equal(raceEditorSource.includes('const right = this.getRaceRightVector(cameraYaw);'), true);
  assert.equal(raceEditorSource.includes('const forward = this.getRaceForwardVector(cameraYaw);'), true);
  assert.equal(raceEditorSource.includes('const launchAligning = launchLockActive || (Number(this.playtestSession.elapsedMs || 0) <= 120 && absSpeed < 0.8);'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.carYaw = launchAligning'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.worldX = Number(this.playtestSession.worldX || 0)'), true);
  assert.equal(raceEditorSource.includes("const chaseDistance = cameraView === 'third-person'"), true);
  assert.equal(raceEditorSource.includes('x: carWorldX - Math.sin(carYaw) * chaseDistance,'), true);
  assert.equal(raceEditorSource.includes('z: carWorldZ - Math.cos(carYaw) * chaseDistance,'), true);
  assert.equal(raceEditorSource.includes('getRacePlaytestCameraYaw(session = this.playtestSession)'), true);
  assert.equal(raceEditorSource.includes('this.playtestSession.cameraYaw = this.getRacePlaytestCameraYaw(this.playtestSession);'), true);
  assert.equal(raceEditorSource.includes('const liveCameraYaw = Number(session?.cameraYaw ?? camera.yaw);'), true);
  assert.equal(raceEditorSource.includes('const cameraYaw = liveCameraYaw;'), true);
  assert.equal(raceEditorSource.includes('blendRaceAngleValue'), true);
  assert.equal(raceEditorSource.includes('launchProjectionHold'), false);
  assert.equal(raceEditorSource.includes('launchProjectionBlend'), false);
  assert.equal(raceEditorSource.includes("const renderTravel = routeRuntimeType === 'circuit'"), true);
  assert.equal(raceEditorSource.includes('getRaceRenderSampleDistances({'), true);
  assert.equal(raceEditorSource.includes('const sampleDistances = this.getRaceRenderSampleDistances({'), false);
  assert.equal(raceEditorSource.includes('getRaceMode7DepthSlices({'), true);
  assert.equal(raceEditorSource.includes('const mode7Slices = this.getRaceMode7DepthSlices({'), true);
  assert.equal(raceEditorSource.includes('Math.pow(t, 1.46)'), true);
  assert.equal(raceEditorSource.includes('point.distance = rawDistance;'), true);
  assert.equal(raceEditorSource.includes('drawRaceParallaxBackground(ctx, bounds'), true);
  assert.equal(raceEditorSource.includes('const sampleDirection = this.getRaceCameraRouteSampleDirection'), true);
  assert.equal(raceEditorSource.includes('getRaceProjectedRoadQuads(crossSections = [])'), true);
  assert.equal(raceEditorSource.includes('const crossSections = [];'), false);
  assert.equal(raceEditorSource.includes('const roadQuads = this.getRaceProjectedRoadQuads(crossSections);'), false);
  assert.equal(raceEditorSource.includes('const mode7Bands = this.getRaceMode7RoadBands(mode7Slices);'), true);
  assert.equal(raceEditorSource.includes('shoulderLeft: this.projectRaceWorldPointToCamera(section.shoulderLeft'), true);
  assert.equal(raceEditorSource.includes('[far.left, far.right, near.right, near.left],'), true);
  assert.equal(raceEditorSource.includes('{ camera, tileWorldM:'), true);
  assert.equal(raceEditorSource.includes('const cameraRouteProjection = this.getRaceRouteProjectionForWorldPoint({ x: camera.x, z: camera.z });'), false);
  assert.equal(raceEditorSource.includes('drawRaceTrackMinimap(ctx'), true);
});

test('Race distance markers project onto apron margins instead of screen-space posts', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const pose = editor.getRaceWorldPoseAtDistance(0);
  const camera = {
    ...pose,
    x: pose.x,
    z: pose.z - 8,
    elevation: Number(pose.elevation || 0) + 0.14,
    nearPlane: 1.2,
    horizonRatio: 0.3,
    roadDepthRatio: 0.64,
    roadWidthScale: 2.08,
    roadMaxWidthRatio: 0.52,
    focalScale: 0.96,
    distance: 0
  };
  const slices = editor.getRaceMode7DepthSlices({
    bounds,
    camera,
    cameraYaw: 0,
    visualTravel: 0,
    routeLength: editor.getRaceRouteLength(),
    routeRuntimeType: editor.getSelectedRaceRuntimeType(),
    nearDistance: 1,
    viewDistance: 360,
    sliceCount: 44
  });
  const drawn = [];
  const originalDrawTexturedQuad = editor.drawRaceProjectedTexturedQuad.bind(editor);
  editor.drawRaceProjectedTexturedQuad = (ctx, targetBounds, points, fillStyle, artRef, options) => {
    if (fillStyle === 'rgba(242,212,92,0.76)') drawn.push(points);
    return originalDrawTexturedQuad(ctx, targetBounds, points, fillStyle, artRef, options);
  };
  editor.drawRaceContinuousDistanceMarkers(createMockContext(), bounds, {
    slices,
    currentSegment: editor.selectedSegment,
    camera,
    cameraYaw: 0
  });

  assert.ok(drawn.length >= 2);
  assert.equal(drawn.some((quad) => quad.some((point) => String(point.edge || '').startsWith('shoulder-'))), true);
});

test('Race distance markers prefer road renderer slices over separate projection', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const pose = editor.getRaceWorldPoseAtDistance(0);
  const camera = {
    ...pose,
    x: pose.x,
    z: pose.z - 8,
    elevation: Number(pose.elevation || 0) + 0.14,
    nearPlane: 1.2,
    horizonRatio: 0.3,
    roadDepthRatio: 0.64,
    roadWidthScale: 2.08,
    roadMaxWidthRatio: 0.52,
    focalScale: 0.96,
    distance: 0
  };
  const slices = editor.getRaceMode7DepthSlices({
    bounds,
    camera,
    cameraYaw: 0,
    visualTravel: 0,
    routeLength: editor.getRaceRouteLength(),
    routeRuntimeType: editor.getSelectedRaceRuntimeType(),
    nearDistance: 1,
    viewDistance: 180,
    sliceCount: 44
  });
  let directCalls = 0;
  editor.getRaceProjectedMarkerAtDistance = () => {
    directCalls += 1;
    return null;
  };

  editor.drawRaceContinuousDistanceMarkers(createMockContext(), bounds, {
    slices,
    currentSegment: editor.selectedSegment,
    camera,
    cameraYaw: 0
  });

  assert.equal(directCalls, 0);
});

test('Race WebGL Track builds road paint meshes for lane dashes', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.selectedRace.margin = { enabled: true, widthM: 0.22, shoulderWidthM: 30 };
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const segment = {
    ...editor.selectedSegment,
    roadWidthM: 7.2,
    laneCount: 2,
    surface: 'asphalt'
  };
  const makeSlice = (distance, centerX, y, roadHalfWidth, shoulderHalfWidth, cameraZ) => ({
    center: { distance, screenX: centerX, screenY: y, cameraZ, renderZ: cameraZ, segment },
    left: { distance, screenX: centerX - roadHalfWidth, screenY: y, cameraZ, renderZ: cameraZ, x: -3.6, z: distance, visible: true, segment },
    right: { distance, screenX: centerX + roadHalfWidth, screenY: y, cameraZ, renderZ: cameraZ, x: 3.6, z: distance, visible: true, segment },
    shoulderLeft: { distance, screenX: centerX - shoulderHalfWidth, screenY: y + 2, cameraZ, renderZ: cameraZ, x: -33.6, z: distance, visible: true, segment },
    shoulderRight: { distance, screenX: centerX + shoulderHalfWidth, screenY: y + 2, cameraZ, renderZ: cameraZ, x: 33.6, z: distance, visible: true, segment }
  });
  const slices = [
    makeSlice(0, 195, 238, 112, 160, 8),
    makeSlice(9, 197, 204, 84, 122, 20),
    makeSlice(49, 202, 142, 42, 66, 58),
    makeSlice(70, 204, 120, 30, 50, 78)
  ];
  const meshes = editor.getRaceWebGLTrackPaintMeshes([], {
    bounds,
    camera: { nearPlane: 1.2, horizonRatio: 0.3 },
    currentSegment: segment,
    slices,
    travel: 0,
    routeLength: 200
  });

  const checkerMeshes = meshes.filter((mesh) => mesh.color === '#f1f4ef' || mesh.color === '#050807');
  const dashMeshes = meshes.filter((mesh) => mesh.color === editor.getRaceRoadSurfacePalette('asphalt').lane);
  const marginMarkerMeshes = meshes.filter((mesh) => mesh.color === 'rgba(242,212,92,0.76)');

  assert.equal(checkerMeshes.length, 0);
  assert.equal(dashMeshes.length >= 1, true);
  assert.equal(marginMarkerMeshes.length, 0);
  assert.equal(dashMeshes.every((mesh) => mesh.projectedPolygon?.length >= 3), true);
});

test('Race WebGL Track renders quarter-mile markers as upright world-space posts', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.selectedRace.margin = { enabled: true, widthM: 0.22, shoulderWidthM: 30 };
  const segment = {
    ...editor.selectedSegment,
    roadWidthM: 7.2,
    laneCount: 2,
    surface: 'asphalt'
  };
  const makeSlice = (distance, centerX, y, roadHalfWidth, shoulderHalfWidth, cameraZ) => ({
    center: { distance, screenX: centerX, screenY: y, cameraZ, renderZ: cameraZ, segment },
    left: { distance, screenX: centerX - roadHalfWidth, screenY: y, cameraZ, renderZ: cameraZ, visible: true, segment },
    right: { distance, screenX: centerX + roadHalfWidth, screenY: y, cameraZ, renderZ: cameraZ, visible: true, segment },
    shoulderLeft: { distance, screenX: centerX - shoulderHalfWidth, screenY: y + 2, cameraZ, renderZ: cameraZ, visible: true, segment },
    shoulderRight: { distance, screenX: centerX + shoulderHalfWidth, screenY: y + 2, cameraZ, renderZ: cameraZ, visible: true, segment }
  });
  const slices = [
    makeSlice(0, 195, 238, 112, 160, 8),
    makeSlice(48.768, 202, 142, 42, 66, 58),
    makeSlice(97.536, 206, 108, 28, 45, 96),
    makeSlice(146.304, 210, 92, 20, 34, 140)
  ];

  const meshes = editor.getRaceWebGLRoadsidePostMeshes(slices, {
    travel: 0,
    routeLength: 500,
    camera: { nearPlane: 1.2, horizonRatio: 0.3 }
  });
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const camera = {
    ...editor.getRaceWorldPoseAtDistance(0),
    x: 0,
    z: -8,
    elevation: 0.32,
    nearPlane: 1.2,
    horizonRatio: 0.3,
    roadDepthRatio: 0.64,
    roadWidthScale: 2.08,
    roadMaxWidthRatio: 0.52,
    focalScale: 0.96
  };
  const projectedHeightAt = (distance) => {
    const section = editor.getRaceRoadCrossSectionAtDistance(distance, { routeLength: 500 });
    const anchor = editor.getRaceRoadsidePostAnchor(section, 'right');
    const post = editor.getRaceWebGLVerticalPostMeshes(anchor, Number(section.center?.yaw || 0), {
      width: 0.16,
      depth: 0.16,
      height: 0.022,
      source: 'quarter-mile-post'
    });
    const projected = post.flatMap((mesh) => mesh.points.map((point) => editor.projectRaceWorldPointToCamera(point, camera, 0, bounds)));
    const visible = projected.filter((point) => point.visible || point.clippedToNearPlane);
    return Math.max(...visible.map((point) => Number(point.screenY || 0))) - Math.min(...visible.map((point) => Number(point.screenY || 0)));
  };

  assert.equal(meshes.length >= 20, true);
  assert.equal(meshes.every((mesh) => mesh.source === 'quarter-mile-post'), true);
  assert.equal(meshes.every((mesh) => Number(mesh.depthOffset || 0) === -0.045), true);
  assert.equal(meshes.some((mesh) => {
    const elevations = mesh.points.map((point) => Number(point.elevation || 0));
    const height = Math.max(...elevations) - Math.min(...elevations);
    return height >= 0.012 && height <= 0.03;
  }), true);
  assert.equal(meshes.some((mesh) => {
    const bottom = mesh.points.filter((point) => Math.abs(Number(point.elevation || 0) - Math.min(...mesh.points.map((entry) => Number(entry.elevation || 0)))) < 0.0001);
    const top = mesh.points.filter((point) => Math.abs(Number(point.elevation || 0) - Math.max(...mesh.points.map((entry) => Number(entry.elevation || 0)))) < 0.0001);
    const widthOf = (points) => Math.max(...points.map((point) => Number(point.x || 0))) - Math.min(...points.map((point) => Number(point.x || 0)));
    return bottom.length >= 2 && top.length >= 2 && widthOf(top) < widthOf(bottom);
  }), true);
  assert.equal(projectedHeightAt(97.536) <= projectedHeightAt(48.768) * 1.08, true);
  assert.equal(raceEditorSource.includes('height: 1.45'), false);
  assert.equal(raceEditorSource.includes('height: 0.055'), false);
  assert.equal(raceEditorSource.includes('Math.max(0.2, Number(height)'), false);
  assert.equal(raceEditorSource.includes('getRaceWebGLRoadsidePostMeshes'), true);
  assert.equal(raceEditorSource.includes('this.drawRaceProjectedDistanceMarkerTicks(ctx, bounds'), false);
  assert.equal(raceEditorSource.includes('markerOverlayCount'), false);
});

test('Race WebGL Track renders start and finish checkers as world-space meshes', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0 },
    { x: 0, y: 260, elevation: 0 },
    { x: 80, y: 420, elevation: 0 }
  ];
  editor.startPlaytest('starter-rwd');
  const routeLength = editor.playtestSession.routeLength;
  const slices = [
    { center: { distance: 0 } },
    { center: { distance: routeLength } }
  ];

  const meshes = editor.getRaceWebGLCheckerStripeMeshes({
    travel: 0,
    routeLength,
    slices
  });

  const checkerMeshes = meshes.filter((mesh) => mesh.color === '#f1f4ef' || mesh.color === '#050807');
  assert.equal(checkerMeshes.length >= 20, true);
  assert.equal(checkerMeshes.every((mesh) => mesh.source === 'road-checker'), true);
  assert.equal(checkerMeshes.every((mesh) => !mesh.projectedPolygon), true);
  assert.equal(checkerMeshes.some((mesh) => mesh.points.some((point) => Number(point.elevation || 0) > 0)), true);
});

test('Race WebGL Track can still draw old overlay ticks only when called directly', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.selectedRace.margin = { enabled: true, widthM: 0.22, shoulderWidthM: 30 };
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const segment = {
    ...editor.selectedSegment,
    roadWidthM: 7.2,
    laneCount: 2,
    surface: 'asphalt'
  };
  const makeSlice = (distance, centerX, y, roadHalfWidth, shoulderHalfWidth, cameraZ) => ({
    center: { distance, screenX: centerX, screenY: y, cameraZ, renderZ: cameraZ, segment },
    left: { distance, screenX: centerX - roadHalfWidth, screenY: y, cameraZ, renderZ: cameraZ, visible: true, segment },
    right: { distance, screenX: centerX + roadHalfWidth, screenY: y, cameraZ, renderZ: cameraZ, visible: true, segment },
    shoulderLeft: { distance, screenX: centerX - shoulderHalfWidth, screenY: y + 2, cameraZ, renderZ: cameraZ, visible: true, segment },
    shoulderRight: { distance, screenX: centerX + shoulderHalfWidth, screenY: y + 2, cameraZ, renderZ: cameraZ, visible: true, segment }
  });
  const slices = [
    makeSlice(0, 195, 238, 112, 160, 8),
    makeSlice(48.768, 202, 142, 42, 66, 58),
    makeSlice(97.536, 206, 108, 28, 45, 96),
    makeSlice(146.304, 210, 92, 20, 34, 140)
  ];
  const ctx = createMockContext();

  const count = editor.drawRaceProjectedDistanceMarkerTicks(ctx, bounds, {
    slices,
    currentSegment: segment,
    camera: { nearPlane: 1.2, horizonRatio: 0.3 }
  });

  const ticks = ctx.calls.filter((call) => call.type === 'fillRect' && call.style === 'rgba(242,212,92,0.86)');
  assert.equal(count >= 4, true);
  assert.equal(ticks.length, count);
  assert.equal(ticks.every((tick) => tick.h > tick.w), true);
  assert.equal(raceEditorSource.includes('drawRaceProjectedDistanceMarkerTicks'), true);
});

test('Race WebGL Track skips old canvas marker and checker overlays', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.selectedRace.groundRenderer = 'webgl-track';
  let markerCalls = 0;
  let checkerCalls = 0;
  editor.drawRaceWebGLTrackScene = () => true;
  editor.drawRaceContinuousDistanceMarkers = () => { markerCalls += 1; };
  editor.drawRaceStartFinishCheckerStripes = () => { checkerCalls += 1; };

  editor.drawRaceProjectedRoadPath(createMockContext(), { x: 0, y: 0, w: 390, h: 260 }, { showPlaytestHud: false });

  assert.equal(markerCalls, 0);
  assert.equal(checkerCalls, 0);
});

test('Race WebGL Track road meshes use surface textures when configured', () => {
  assert.equal(raceEditorSource.includes("const roadArtRef = texturesEnabled ? this.getRaceSurfaceArtRefForSurface(surfaceId) : '';"), true);
  assert.equal(raceEditorSource.includes('textured: Boolean(texturesEnabled && roadArtRef)'), true);
  assert.equal(raceEditorSource.includes('roadPaintPolygons'), true);
  assert.equal(raceEditorSource.includes('getRaceWebGLCheckerStripeMeshes'), true);
  assert.equal(raceEditorSource.includes('getRaceWebGLRoadsidePostMeshes'), true);
});

test('Race WebGL Track ground textures stay on the 3D terrain mesh path', () => {
  const stableLayer = raceEditorSource.indexOf('const stableGroundTextureLayer = Boolean(texturedTerrainCanvas && this.drawRaceStableGroundTextureLayer');
  const threeTerrainDraw = raceEditorSource.indexOf('const drewThreeTerrain = canDrawThreeTerrain && this.drawRaceThreeWorldScene(ctx, bounds, terrainCells');
  const fallbackTerrainDraw = raceEditorSource.indexOf('this.drawRaceWebGLTerrainMeshBatch(ctx, bounds, renderer, terrainCells');
  const roadMeshes = raceEditorSource.indexOf('const roadMeshes = [];');
  const opaqueTrackMeshes = raceEditorSource.indexOf('const opaqueTrackMeshes = [');
  const roadDraw = raceEditorSource.indexOf('this.drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer, opaqueTrackMeshes');

  assert.equal(stableLayer, -1);
  assert.equal(threeTerrainDraw >= 0, true);
  assert.equal(roadMeshes < threeTerrainDraw, true);
  assert.equal(fallbackTerrainDraw > threeTerrainDraw, true);
  assert.equal(opaqueTrackMeshes > fallbackTerrainDraw, true);
  assert.equal(roadDraw > fallbackTerrainDraw, true);
  assert.equal(raceEditorSource.includes('drawRaceStableGroundTextureLayer'), true);
  assert.equal(raceEditorSource.includes('renderStats.texturedTerrainMeshSkipped = terrainCells.length;'), false);
  assert.equal(raceEditorSource.includes('getRaceThreeTerrainGeometry'), true);
  assert.equal(raceEditorSource.includes('getRaceProjectedPolygonForWebGL(renderPoints, camera, cameraYaw, bounds)'), true);
  assert.equal(raceEditorSource.includes('stats.terrainMeshTexturePolygons'), true);
});

test('Race WebGL Track keeps Three as the default heightmap renderer before native fallback', () => {
  const threeImport = raceEditorSource.indexOf("import * as THREE from '../vendorBridge/three.js';");
  const threeGeometry = raceEditorSource.indexOf('new THREE.BufferGeometry()');
  const threeTexture = raceEditorSource.indexOf('new THREE.CanvasTexture(canvas)');
  const threeDraw = raceEditorSource.indexOf('drawRaceThreeWorldScene(ctx, bounds, terrainCells');
  const fallbackTerrainDraw = raceEditorSource.indexOf('this.drawRaceWebGLTerrainMeshBatch(ctx, bounds, renderer, terrainCells');
  const legacyTerrainDraw = raceEditorSource.indexOf('this.drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer, terrainMeshes');

  assert.equal(threeImport >= 0, true);
  assert.equal(threeGeometry >= 0, true);
  assert.equal(threeTexture >= 0, true);
  assert.equal(threeDraw >= 0, true);
  assert.equal(fallbackTerrainDraw > threeDraw, true);
  assert.equal(legacyTerrainDraw, -1);
  assert.equal(raceEditorSource.includes('RACE_THREE_ELEVATION_SCALE'), false);
  assert.equal(raceEditorSource.includes('RACE_THREE_CAMERA_EYE_M'), false);
  assert.equal(raceEditorSource.includes('const RACE_THREE_ELEVATION_M = 12;'), true);
  assert.equal(raceEditorSource.includes('addRaceThreeMeshGroups(renderer, meshes'), true);
  assert.equal(raceEditorSource.includes('shoulderMeshes,'), true);
  assert.equal(raceEditorSource.includes('roadMeshes,'), true);
  assert.equal(raceEditorSource.includes('boundaryMeshes,'), true);
  assert.equal(raceEditorSource.includes('roadPaintMeshes,'), true);
  assert.equal(raceEditorSource.includes('trackFurnitureMeshes,'), true);
  assert.equal(raceEditorSource.includes('renderer.camera.lookAt('), true);
});

test('Race Three world geometry keeps road slightly above terrain in meter scale', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.getRaceStitchedTerrainElevationAtWorldPoint = (point, fallbackElevation = 0) => fallbackElevation;
  const terrain = editor.getRaceThreeMeshGeometry([{
    source: 'terrain',
    points: [
      { x: 0, z: 0, elevation: 0.1 },
      { x: 4, z: 0, elevation: 0.1 },
      { x: 4, z: 4, elevation: 0.1 },
      { x: 0, z: 4, elevation: 0.1 }
    ],
    color: '#315734',
    threeLiftM: 0
  }]);
  const road = editor.getRaceThreeMeshGeometry([{
    source: 'road',
    points: [
      { x: 0, z: 0, elevation: 0.1 },
      { x: 4, z: 0, elevation: 0.1 },
      { x: 4, z: 4, elevation: 0.1 },
      { x: 0, z: 4, elevation: 0.1 }
    ],
    color: '#202020',
    threeLiftM: 0.075
  }]);
  const terrainY = terrain.getAttribute('position').array[1];
  const roadY = road.getAttribute('position').array[1];

  assert.equal(Math.abs(terrainY - 1.2) < 0.000001, true);
  assert.equal(Math.abs(roadY - 1.275) < 0.000001, true);
  assert.equal(roadY > terrainY, true);
});

test('Race Three road vertices sample stitched terrain before applying road lift', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.getRaceStitchedTerrainElevationAtWorldPoint = () => 0.25;
  const road = editor.getRaceThreeMeshGeometry([{
    source: 'road',
    points: [
      { x: 0, z: 0, elevation: -0.2 },
      { x: 4, z: 0, elevation: -0.2 },
      { x: 4, z: 4, elevation: -0.2 },
      { x: 0, z: 4, elevation: -0.2 }
    ],
    color: '#202020'
  }]);
  const roadY = road.getAttribute('position').array[1];

  assert.equal(Math.abs(roadY - 3) < 0.000001, true);
  assert.equal(raceEditorSource.includes('getRaceThreeSurfacePoint(point = {}, source = \'\')'), true);
  assert.equal(raceEditorSource.includes('getRaceStitchedTerrainElevationAtWorldPoint'), true);
});

test('Race WebGL road mesh vertices sample stitched terrain before projection', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = {
    x: 0,
    z: -10,
    elevation: 0,
    nearPlane: 1.2,
    farPlane: 2200,
    horizonRatio: 0.35,
    focalScale: 1,
    roadWidthScale: 1,
    roadDepthRatio: 0.7,
    roadMaxWidthRatio: 1
  };
  editor.getRaceStitchedTerrainElevationAtWorldPoint = () => 0.25;
  const vertices = editor.getRaceWebGLWorldMeshVertices(bounds, [
    { x: -1, z: 20, elevation: -0.25 },
    { x: 1, z: 20, elevation: -0.25 },
    { x: 1, z: 24, elevation: -0.25 },
    { x: -1, z: 24, elevation: -0.25 }
  ], {
    camera,
    cameraYaw: 0,
    meshSource: 'road'
  });
  const unsampled = editor.projectRaceWorldPointToWebGLClip({ x: -1, z: 20, elevation: -0.25 }, camera, 0, bounds);
  const sampled = editor.projectRaceWorldPointToWebGLClip({ x: -1, z: 20, elevation: 0.25 }, camera, 0, bounds);
  const clipYs = [];
  for (let index = 1; index < vertices.length; index += 6) clipYs.push(vertices[index]);

  assert.equal(vertices.length > 0, true);
  assert.equal(clipYs.some((clipY) => Math.abs(clipY - sampled.clipY) < 0.000001), true);
  assert.equal(clipYs.some((clipY) => Math.abs(clipY - unsampled.clipY) < 0.000001), false);
});

test('Race WebGL Track uses Three by default for terrain-enabled heightmap rendering', () => {
  const canDrawThreeTerrain = raceEditorSource.indexOf('const canDrawThreeTerrain = threeEnabled && terrainEnabled && terrainCells.length > 0;');
  const threeDraw = raceEditorSource.indexOf('const drewThreeTerrain = canDrawThreeTerrain && this.drawRaceThreeWorldScene');

  assert.equal(canDrawThreeTerrain >= 0, true);
  assert.equal(threeDraw >= 0, true);
  assert.equal(threeDraw > canDrawThreeTerrain, true);
  assert.equal(raceEditorSource.includes('trackEnabled: source.trackEnabled !== false'), true);
  assert.equal(raceEditorSource.includes('overlaysEnabled: source.overlaysEnabled !== false'), true);
  assert.equal(raceEditorSource.includes('terrainEnabled: source.terrainEnabled === true'), true);
  assert.equal(raceEditorSource.includes('terrainEnabled: settings.terrainEnabled === true'), true);
  assert.equal(raceEditorSource.includes('terrainEnabled: draft.terrainEnabled === true'), true);
  assert.equal(raceEditorSource.includes('threeEnabled: source.threeEnabled !== false'), true);
  assert.equal(raceEditorSource.includes('threeEnabled: settings.threeEnabled !== false'), true);
  assert.equal(raceEditorSource.includes('const threeEnabled = renderDebug.threeEnabled === true;'), true);
  assert.equal(raceEditorSource.includes('if (drewThreeTerrain) {'), true);
  assert.equal(raceEditorSource.includes('threeRenderer.setPixelRatio?.(1);'), true);
  assert.equal(raceEditorSource.indexOf('const renderer = this.getRaceWebGLGroundRenderer(renderWidth, renderHeight);', threeDraw) > threeDraw, true);
  assert.equal(raceEditorSource.includes('materialCache: new Map()'), true);
  assert.equal(raceEditorSource.includes('getRaceThreeMaterial(renderer'), true);
});

test('Race WebGL Track render diagnostics can disable track and overlay workload early', () => {
  const trackGate = raceEditorSource.indexOf('if (renderDebug.trackEnabled === false) {');
  const mode7Slices = raceEditorSource.indexOf('const mode7Slices = this.getRaceMode7DepthSlices');
  const overlayGate = raceEditorSource.indexOf('const overlaysEnabled = renderDebug.overlaysEnabled !== false;');
  const projectedDecals = raceEditorSource.indexOf('this.drawRaceProjectedDecals(ctx, bounds, { camera, cameraYaw, kind: \'decal\' });');

  assert.equal(trackGate >= 0, true);
  assert.equal(mode7Slices > trackGate, true);
  assert.equal(overlayGate > mode7Slices, true);
  assert.equal(projectedDecals > overlayGate, true);
  assert.equal(raceEditorSource.includes('renderDisabled: true'), true);
  assert.equal(raceEditorSource.includes('Track Off'), true);
});

test('Race WebGL Track Studio Sprint terrain-off path keeps frame workload bounded', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.selectedRace.renderDebug = {
    trackEnabled: true,
    overlaysEnabled: false,
    terrainEnabled: false,
    texturesEnabled: false,
    detailEnabled: false,
    threeEnabled: true
  };
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.distance = 160;
  editor.playtestSession.speedMps = 38;
  editor.playtestSession.worldX = 0;
  editor.playtestSession.worldZ = 160;
  editor.playtestSession.carYaw = editor.getRaceWorldPoseAtDistance(160).yaw;
  editor.playtestSession.cameraYaw = editor.playtestSession.carYaw;
  editor.raceInput.cameraView = 'third-person';

  let terrainBatchCalls = 0;
  let worldBatchCalls = 0;
  let worldBatchMeshes = 0;
  let threePaintCalls = 0;
  let terrainBakeCalls = 0;
  let surfaceArtLookups = 0;
  editor.getRaceWebGLGroundRenderer = () => ({
    canvas: { width: 390, height: 240 },
    lastTargetScale: 1,
    texture: {},
    gl: {
      DEPTH_TEST: 0x0B71,
      LEQUAL: 0x0203,
      CULL_FACE: 0x0B44,
      COLOR_BUFFER_BIT: 0x4000,
      DEPTH_BUFFER_BIT: 0x0100,
      TEXTURE0: 0x84C0,
      TEXTURE_2D: 0x0DE1,
      viewport() {},
      enable() {},
      depthFunc() {},
      depthMask() {},
      clearDepth() {},
      disable() {},
      clearColor() {},
      clear() {},
      activeTexture() {},
      bindTexture() {}
    }
  });
  editor.drawRaceWebGLTerrainMeshBatch = () => {
    terrainBatchCalls += 1;
    return true;
  };
  editor.drawRaceWebGLWorldMeshBatch = (ctx, bounds, renderer, meshes = [], options = {}) => {
    worldBatchCalls += 1;
    worldBatchMeshes += Array.isArray(meshes) ? meshes.length : 0;
    if (options.stats) {
      options.stats.polygons = (Number(options.stats.polygons) || 0) + Math.max(0, meshes.length * 2);
      options.stats.drawCalls = (Number(options.stats.drawCalls) || 0) + 1;
    }
    return true;
  };
  const originalThreePaintMeshes = editor.getRaceThreeTrackPaintMeshes.bind(editor);
  editor.getRaceThreeTrackPaintMeshes = (...args) => {
    threePaintCalls += 1;
    return originalThreePaintMeshes(...args);
  };
  editor.getRaceTerrainBakeCache = (...args) => {
    terrainBakeCalls += 1;
    return RaceEditor.prototype.getRaceTerrainBakeCache.call(editor, ...args);
  };
  editor.getRaceSurfaceArtRefForSurface = (...args) => {
    surfaceArtLookups += 1;
    return RaceEditor.prototype.getRaceSurfaceArtRefForSurface.call(editor, ...args);
  };

  editor.drawRaceProjectedRoadPath(createMockContext(), { x: 0, y: 0, w: 390, h: 240 }, { showPlaytestHud: false });

  assert.equal(editor.selectedRace.name, 'Studio Sprint');
  assert.equal(terrainBatchCalls, 0);
  assert.equal(threePaintCalls, 0);
  assert.equal(terrainBakeCalls, 0);
  assert.equal(surfaceArtLookups, 0);
  assert.equal(worldBatchCalls <= 3, true);
  assert.equal(worldBatchMeshes <= 460, true);
  assert.equal(editor.lastRaceRenderStats.terrainEnabled, false);
  assert.equal(editor.lastRaceRenderStats.texturesEnabled, false);
  assert.equal(editor.lastRaceRenderStats.terrainCells, 0);
  assert.equal(editor.lastRaceRenderStats.terrainCandidates, 0);
});

test('Race WebGL Track Studio Sprint terrain and texture FPS benchmark stays above 45 FPS', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const fakeGl = {
    DEPTH_TEST: 0x0B71,
    LEQUAL: 0x0203,
    CULL_FACE: 0x0B44,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    TEXTURE0: 0x84C0,
    TEXTURE_2D: 0x0DE1,
    ARRAY_BUFFER: 0x8892,
    DYNAMIC_DRAW: 0x88E8,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    BLEND: 0x0BE2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    REPEAT: 0x2901,
    CLAMP_TO_EDGE: 0x812F,
    NEAREST: 0x2600,
    LINEAR: 0x2601,
    NEAREST_MIPMAP_NEAREST: 0x2700,
    NEAREST_MIPMAP_LINEAR: 0x2702,
    LINEAR_MIPMAP_LINEAR: 0x2703,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_MAX_ANISOTROPY_EXT: 0x84FE,
    viewport() {},
    enable() {},
    disable() {},
    depthFunc() {},
    depthMask() {},
    clearDepth() {},
    clearColor() {},
    clear() {},
    createTexture() { return {}; },
    activeTexture() {},
    bindTexture() {},
    useProgram() {},
    bindBuffer() {},
    bufferData() {},
    bufferSubData() {},
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    uniform1i() {},
    uniform4fv() {},
    uniform1f() {},
    uniform2f() {},
    uniform3f() {},
    blendFunc() {},
    pixelStorei() {},
    texImage2D() {},
    generateMipmap() {},
    texParameteri() {},
    texParameterf() {},
    getExtension() { return null; },
    getParameter() { return 4096; },
    drawArrays() {}
  };
  const fakeRenderer = {
    canvas: { width: 390, height: 240 },
    lastTargetScale: 1,
    texture: {},
    gl: fakeGl,
    meshProgram: {},
    meshBuffer: {},
    terrainProgram: {},
    terrainBuffer: {},
    meshLocations: {
      position: 0,
      depth: 1,
      texCoord: 2,
      invDepth: 3,
      textureSampler: 4,
      tint: 5,
      useTexture: 6
    },
    terrainLocations: {
      worldPosition: 0,
      texCoord: 1,
      tint: 2,
      textureSampler: 3,
      useTexture: 4,
      cameraPosition: 5,
      cameraYaw: 6,
      viewport: 7,
      focal: 8,
      roadWidthScale: 9,
      horizonRatio: 10,
      roadDepthRatio: 11,
      nearPlane: 12,
      farPlane: 13
    }
  };
  editor.selectedRace.groundRenderer = 'webgl-track';
  editor.selectedRace.renderDebug = {
    trackEnabled: true,
    overlaysEnabled: false,
    terrainEnabled: true,
    texturesEnabled: true,
    detailEnabled: false,
    threeEnabled: false
  };
  const tileMap = editor.ensureRaceTileMap();
  tileMap.cellSizeM = 5;
  tileMap.defaultTileId = 'grass';
  tileMap.cells = {};
  for (let y = -18; y <= 28; y += 1) {
    for (let x = -18; x <= 18; x += 1) {
      tileMap.cells[`${x},${y}`] = {
        tileId: 'grass',
        tileWeights: { grass: 1 },
        artRef: 'benchGround',
        explicit: true
      };
    }
  }
  tileMap.revision = (Number(tileMap.revision) || 0) + 1;
  editor.getRaceArtSpriteCanvas = (artRef) => (artRef === 'benchGround'
    ? { width: 64, height: 64 }
    : null);
  editor.getRaceWebGLGroundRenderer = () => fakeRenderer;
  editor.startPlaytest('starter-rwd');
  editor.raceInput.cameraView = 'third-person';
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const ctx = createFastMockContext();
  const renderFrame = (distance) => {
    const pose = editor.getRaceWorldPoseAtDistance(distance);
    editor.playtestSession.distance = distance;
    editor.playtestSession.speedMps = 38;
    editor.playtestSession.worldX = pose.x;
    editor.playtestSession.worldZ = pose.z;
    editor.playtestSession.carYaw = pose.yaw;
    editor.playtestSession.cameraYaw = pose.yaw;
    editor.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud: false });
    return Math.max(0.001, Number(editor.lastRaceRenderStats?.webglTrackMs || 0));
  };

  [120, 129, 138, 147].forEach((distance) => renderFrame(distance));
  const frames = 10;
  let renderMs = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    renderMs += renderFrame(120 + frame * 9);
  }
  const fps = frames / (Math.max(0.001, renderMs) / 1000);

  assert.equal(editor.selectedRace.name, 'Studio Sprint');
  assert.equal(editor.lastRaceRenderStats.terrainEnabled, true);
  assert.equal(editor.lastRaceRenderStats.texturesEnabled, true);
  assert.equal(editor.lastRaceRenderStats.terrainCells > 0, true);
  assert.equal(editor.lastRaceRenderStats.textureUploads <= 1, true);
  assert.ok(fps >= 45, `Studio Sprint WebGL Track terrain+texture benchmark rendered ${fps.toFixed(1)} FPS`);
});

test('Race Three drivable surface layers share geometric height and use render order for visibility', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  const terrain = editor.getRaceThreeMeshLiftM({ source: 'terrain' });
  const shoulder = editor.getRaceThreeMeshLiftM({ source: 'shoulder-left' });
  const road = editor.getRaceThreeMeshLiftM({ source: 'road' });
  const boundary = editor.getRaceThreeMeshLiftM({ source: 'boundary-left' });
  const paint = editor.getRaceThreeMeshLiftM({ source: 'road-paint-lane' });

  assert.equal(shoulder, terrain);
  assert.equal(road, terrain);
  assert.equal(boundary, terrain);
  assert.equal(paint > boundary, true);
  assert.equal(raceEditorSource.includes('terrainMesh.renderOrder = 0;'), true);
  assert.equal(raceMaterialBatchingSource.includes("const key = `${textured ? 1 : 0}|${artRef}|${Number(mesh.textureWorldM || textureWorldM)}|${adapter.getMeshLiftM?.(mesh) || 0}`;"), true);
  assert.equal(raceEditorSource.includes("addGroup(shoulderMeshes, 'threeShoulder', { renderOrder: 1 });"), true);
  assert.equal(raceEditorSource.includes("addGroup(roadMeshes, 'threeRoad', { renderOrder: 2 });"), true);
  assert.equal(raceEditorSource.includes("addGroup(boundaryMeshes, 'threeBoundary', { renderOrder: 3 });"), true);
  assert.equal(raceEditorSource.includes("addGroup(trackFurnitureMeshes, 'trackFurniture', { renderOrder: 4 });"), true);
  assert.equal(raceEditorSource.includes("addGroup(roadPaintMeshes, 'roadPaint', { defaultDepthWrite: false, defaultPolygonOffset: true, renderOrder: 5 });"), true);
});

test('Race Three camera FOV is narrowed per playtest view', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  assert.equal(editor.getRaceThreeCameraFov('third-person'), 48);
  assert.equal(editor.getRaceThreeCameraFov('first-person'), 58);
  assert.equal(raceEditorSource.includes('renderer.camera.fov = this.getRaceThreeCameraFov(cameraView);'), true);
  assert.equal(raceEditorSource.includes('cameraView,'), true);
});

test('Race Three playtest caches static geometry and aligns projection horizon', () => {
  assert.equal(raceEditorSource.includes('getRaceThreeStaticWorldKey'), true);
  assert.equal(raceEditorSource.includes('renderer.staticWorldKey !== staticKey'), true);
  assert.equal(raceEditorSource.includes('stats.geometryCacheHits'), true);
  assert.equal(raceEditorSource.includes('stats.staticGeometryRebuilds'), true);
  assert.equal(raceEditorSource.includes('alignRaceThreeCameraHorizon'), true);
  assert.equal(raceEditorSource.includes('projectionMatrix.elements[9]'), true);
  assert.equal(raceEditorSource.includes('this.clearRaceThreeScene(renderer);'), true);
});

test('Race WebGL Track mesh shader uses high precision UV interpolation for close terrain', () => {
  const meshVertexShader = raceEditorSource.indexOf('const meshVertexShader = compileShader(gl.VERTEX_SHADER');
  const meshFragmentShader = raceEditorSource.indexOf('const meshFragmentShader = compileShader(gl.FRAGMENT_SHADER');
  const meshProgram = raceEditorSource.indexOf('const meshProgram = gl.createProgram();');

  assert.equal(meshVertexShader >= 0, true);
  assert.equal(meshFragmentShader > meshVertexShader, true);
  assert.equal(meshProgram > meshFragmentShader, true);
  const meshShaderSource = raceEditorSource.slice(meshVertexShader, meshProgram);
  assert.equal(meshShaderSource.includes('precision highp float;'), true);
  assert.equal(meshShaderSource.includes('precision mediump float;'), false);
  assert.equal(meshShaderSource.includes('vTexCoordOverDepth / max(vInvDepth, 0.000001)'), true);
});

test('Race WebGL Track draws road paint in Three and keeps native depth overlay fallback', () => {
  const canDrawThreeTerrain = raceEditorSource.indexOf('const canDrawThreeTerrain = threeEnabled && terrainEnabled && terrainCells.length > 0;');
  const threePaintMeshes = raceEditorSource.indexOf('const roadPaintMeshes = canDrawThreeTerrain');
  const threeDraw = raceEditorSource.indexOf('const drewThreeTerrain = canDrawThreeTerrain && this.drawRaceThreeWorldScene(ctx, bounds, terrainCells');
  const opaqueTrackMeshes = raceEditorSource.indexOf('const opaqueTrackMeshes = [');
  const roadDraw = raceEditorSource.indexOf('this.drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer, opaqueTrackMeshes');
  const paintDraw = raceEditorSource.indexOf('this.drawRaceWebGLWorldMeshBatch(ctx, bounds, renderer, fallbackRoadPaintMeshes');

  assert.equal(canDrawThreeTerrain >= 0, true);
  assert.equal(threePaintMeshes > canDrawThreeTerrain, true);
  assert.equal(threeDraw > threePaintMeshes, true);
  assert.equal(raceEditorSource.includes('roadPaintMeshes,'), true);
  assert.equal(roadDraw >= 0, true);
  assert.equal(opaqueTrackMeshes < roadDraw, true);
  assert.equal(paintDraw > roadDraw, true);
  assert.equal(raceEditorSource.includes('depthTest = true'), true);
  assert.equal(raceEditorSource.includes('if (!depthTest) {\n      gl.disable(gl.DEPTH_TEST);\n      gl.depthMask(false);'), true);
  assert.equal(raceEditorSource.includes('depthTest: false'), true);
  assert.equal(raceEditorSource.includes('depthOverlayDrawCalls'), true);
});

test('Race playtest renderer keeps road bands visible when facing reverse or across the track', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  seedLongStraightRace(editor);
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.distance = 420;
  editor.playtestSession.worldX = 0;
  editor.playtestSession.worldZ = 420;
  const bounds = { x: 0, y: 0, w: 390, h: 260 };
  const visualTravel = editor.getRaceVisualTravelDistance(editor.playtestSession);
  const routeLength = editor.playtestSession.routeLength;
  const routeRuntimeType = editor.playtestSession.routeRuntimeType;

  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((yaw) => {
    editor.playtestSession.carYaw = yaw;
    editor.playtestSession.cameraYaw = yaw;
    const routeCamera = editor.getRaceWorldPoseAtDistance(visualTravel, { runtimeType: routeRuntimeType });
    const camera = {
      ...routeCamera,
      x: editor.playtestSession.worldX - Math.sin(yaw) * 13,
      z: editor.playtestSession.worldZ - Math.cos(yaw) * 13,
      yaw,
      distance: visualTravel,
      horizonRatio: 0.3,
      roadDepthRatio: 0.6,
      focalScale: 1,
      roadWidthScale: 4.9,
      roadMaxWidthRatio: 0.52,
      roadElevation: 0,
      eyeHeight: 0.14,
      elevation: 0.14,
      nearPlane: 1.2
    };
    const slices = editor.getRaceMode7DepthSlices({
      bounds,
      camera,
      cameraYaw: yaw,
      visualTravel,
      routeLength,
      routeRuntimeType,
      nearDistance: 2,
      viewDistance: 500,
      sliceCount: 80
    });
    assert.equal(editor.getRaceMode7RoadBands(slices).length > 0, true, `yaw ${yaw}`);
  });
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
  const roadPass = raceEditorSource.indexOf('const drewWebGLTrack = this.drawRaceWebGLTrackScene');
  const fallbackRoadPass = raceEditorSource.indexOf('this.drawRaceProjectedTexturedQuad(\n          ctx,\n          bounds,\n          [far.left, far.right, near.right, near.left]');
  const markerCall = raceEditorSource.indexOf('this.drawRaceContinuousDistanceMarkers(ctx, bounds, {');
  assert.equal(firstGroundPass >= 0, true);
  assert.equal(roadPass > firstGroundPass, true);
  assert.equal(fallbackRoadPass > roadPass, true);
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
    viewDistance: 580
  }).length > 120, true);
  assert.equal(raceEditorSource.includes('return bands.sort((a, b) => b.avgZ - a.avgZ || b.maxZ - a.maxZ || b.index - a.index);'), true);
});

test('Race Mode 7 projection keeps a flat straight road aligned with terrain', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  seedLongStraightRace(editor);
  editor.startPlaytest('starter-rwd');
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const pose = editor.getRaceWorldPoseAtDistance(60);
  const camera = {
    ...pose,
    x: pose.x,
    z: pose.z - 8,
    roadElevation: 0,
    eyeHeight: editor.getRaceCameraEyeHeight('third-person'),
    elevation: editor.getRaceCameraEyeHeight('third-person'),
    horizonRatio: 0.31,
    nearPlane: 1.4,
    roadDepthRatio: 0.64,
    focalScale: 1,
    roadWidthScale: 2.12,
    roadMaxWidthRatio: 0.52
  };

  const roadSection = editor.getRaceRoadCrossSectionAtDistance(80);
  const terrainElevation = editor.getRaceStitchedTerrainElevationAtWorldPoint(roadSection.center, 0);
  const slices = editor.getRaceMode7DepthSlices({
    bounds,
    camera,
    cameraYaw: pose.yaw,
    visualTravel: 60,
    routeLength: editor.playtestSession.routeLength,
    routeRuntimeType: 'destination',
    nearDistance: 2,
    viewDistance: 220,
    sliceCount: 90
  });
  const visibleCenters = slices
    .map((slice) => slice.center)
    .filter((point) => point.visible && point.screenY >= editor.getRaceProjectedTerrainTop(bounds, camera));
  const centerXs = visibleCenters.map((point) => point.screenX);

  assert.equal(Math.abs(roadSection.center.elevation - terrainElevation) < 0.0001, true);
  assert.equal(centerXs.length > 12, true);
  assert.equal(Math.max(...centerXs) - Math.min(...centerXs) < 3, true);
});

test('Race Mode 7 markers interpolate smoothly between projected depth slices', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const slices = [
    {
      center: { distance: 100, screenX: 200, screenY: 210, cameraZ: 20, renderZ: 20, segment: { surface: 'asphalt' } },
      left: { screenX: 120, screenY: 210, cameraZ: 20, renderZ: 20 },
      right: { screenX: 280, screenY: 210, cameraZ: 20, renderZ: 20 }
    },
    {
      center: { distance: 112.192, screenX: 202, screenY: 180, cameraZ: 42, renderZ: 42, segment: { surface: 'asphalt' } },
      left: { screenX: 145, screenY: 180, cameraZ: 42, renderZ: 42 },
      right: { screenX: 259, screenY: 180, cameraZ: 42, renderZ: 42 }
    }
  ];

  const first = editor.getRaceInterpolatedMarkerSlice(slices, 104);
  const second = editor.getRaceInterpolatedMarkerSlice(slices, 104.4);

  assert.equal(first.center.screenY > second.center.screenY, true);
  assert.equal(Math.abs(first.center.screenY - second.center.screenY) < 2, true);
  assert.equal(first.center.cameraZ > 20 && first.center.cameraZ < 42, true);
  assert.equal(first.left.renderZ > 20 && first.left.renderZ < 42, true);
  assert.equal(raceEditorSource.includes('drawRaceContinuousDistanceMarkers(ctx, bounds'), true);
});

test('Race Mode 7 markers draw road-aligned lane dash quads', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ctx = createMockContext();
  const twoLaneSegment = { surface: 'asphalt', roadWidthM: 7.2 };
  const slices = [
    {
      center: { distance: 100, screenX: 200, screenY: 210, cameraZ: 18, renderZ: 18, segment: twoLaneSegment },
      left: { screenX: 120, screenY: 210, cameraZ: 18, renderZ: 18 },
      right: { screenX: 280, screenY: 210, cameraZ: 18, renderZ: 18 }
    },
    {
      center: { distance: 112.192, screenX: 212, screenY: 178, cameraZ: 34, renderZ: 34, segment: twoLaneSegment },
      left: { screenX: 155, screenY: 184, cameraZ: 34, renderZ: 34 },
      right: { screenX: 269, screenY: 172, cameraZ: 34, renderZ: 34 }
    },
    {
      center: { distance: 124.384, screenX: 226, screenY: 152, cameraZ: 52, renderZ: 52, segment: twoLaneSegment },
      left: { screenX: 188, screenY: 158, cameraZ: 52, renderZ: 52 },
      right: { screenX: 264, screenY: 146, cameraZ: 52, renderZ: 52 }
    }
  ];

  editor.drawRaceContinuousDistanceMarkers(ctx, { x: 0, y: 0, w: 390, h: 240 }, { slices });

  assert.equal(ctx.calls.some((call) => call.type === 'beginPath'), true);
  assert.equal(ctx.calls.filter((call) => call.type === 'lineTo').length >= 3, true);
  assert.equal(raceEditorSource.includes('drawRaceProjectedLaneDash(ctx, startMarker, endMarker, markerW);'), true);
  assert.equal(raceEditorSource.includes('fillRect(marker.center.screenX - markerW / 2'), false);
  assert.equal(raceEditorSource.includes('const markerLimitDistance = Math.max(markerDimensions.edgePostInterval, markerInterval) * 5;'), true);
  assert.equal(raceEditorSource.includes('const horizonScreenY = this.getRaceProjectedTerrainTop(bounds, this.lastRaceRenderCamera?.camera || {});'), true);
  assert.equal(raceEditorSource.includes('Number(marker.center.screenY || 0) < horizonScreenY'), true);
});

test('Race Mode 7 projected markers stay centered between road edges at long distance', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 220, elevation: 0 },
    { x: 140, y: 380, elevation: 0.03 },
    { x: 280, y: 380, elevation: 0.02 }
  ];
  editor.selectedRace.road.segments = [];
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 38;
  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });

  const marker = editor.getRaceProjectedMarkerAtDistance(editor.getRaceVisualTravelDistance(editor.playtestSession) + 180, {
    camera: editor.lastRaceRenderCamera.camera,
    cameraYaw: editor.lastRaceRenderCamera.cameraYaw,
    bounds
  });
  const edgeX = Number(marker.right.screenX || 0) - Number(marker.left.screenX || 0);
  const edgeY = Number(marker.right.screenY || 0) - Number(marker.left.screenY || 0);
  const edgeLengthSq = Math.max(0.001, edgeX * edgeX + edgeY * edgeY);
  const centerT = ((Number(marker.center.screenX || 0) - Number(marker.left.screenX || 0)) * edgeX
    + (Number(marker.center.screenY || 0) - Number(marker.left.screenY || 0)) * edgeY) / edgeLengthSq;

  assert.equal(marker.center.visible, true);
  assert.equal(centerT > 0.42 && centerT < 0.58, true);
});

test('Race Mode 7 center dashes are hidden on one-lane roads', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const makeSlices = (segment) => [
    {
      center: { distance: 100, screenX: 200, screenY: 210, cameraZ: 18, renderZ: 18, segment },
      left: { screenX: 120, screenY: 210, cameraZ: 18, renderZ: 18 },
      right: { screenX: 280, screenY: 210, cameraZ: 18, renderZ: 18 }
    },
    {
      center: { distance: 112.192, screenX: 212, screenY: 178, cameraZ: 34, renderZ: 34, segment },
      left: { screenX: 155, screenY: 184, cameraZ: 34, renderZ: 34 },
      right: { screenX: 269, screenY: 172, cameraZ: 34, renderZ: 34 }
    }
  ];
  const narrowCtx = createMockContext();
  editor.drawRaceContinuousDistanceMarkers(narrowCtx, { x: 0, y: 0, w: 390, h: 240 }, {
    slices: makeSlices({ surface: 'asphalt', roadWidthM: 3.2 })
  });
  assert.equal(narrowCtx.calls.some((call) => call.type === 'beginPath'), false);

  const wideCtx = createMockContext();
  editor.drawRaceContinuousDistanceMarkers(wideCtx, { x: 0, y: 0, w: 390, h: 240 }, {
    slices: makeSlices({ surface: 'asphalt', roadWidthM: 7.2 })
  });
  assert.equal(wideCtx.calls.some((call) => call.type === 'beginPath'), true);
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
    sliceCount: 120
  });

  assert.equal(slices.length > 40, true);
  assert.equal(sampleCalls <= 2, true);
  assert.equal(raceEditorSource.includes('getRacePathSamplesCached({ step: 10 })'), true);
  assert.equal(raceEditorSource.includes('getRaceSampleSpanAtDistance(samples, target)'), true);
});

test('Race Mode 7 road bands reject non-contiguous route slices', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const makeSlice = (routeOrder, renderZ, screenX, screenY, halfWidth) => ({
    routeOrder,
    center: { visible: true, renderZ, cameraZ: renderZ, screenX, screenY, distance: routeOrder },
    left: { visible: true, renderZ, cameraZ: renderZ, screenX: screenX - halfWidth, screenY },
    right: { visible: true, renderZ, cameraZ: renderZ, screenX: screenX + halfWidth, screenY },
    shoulderLeft: { visible: true, renderZ, cameraZ: renderZ, screenX: screenX - halfWidth * 1.8, screenY: screenY + 4 },
    shoulderRight: { visible: true, renderZ, cameraZ: renderZ, screenX: screenX + halfWidth * 1.8, screenY: screenY + 4 }
  });

  assert.equal(editor.getRaceMode7RoadBands([makeSlice(10, 80, 190, 220, 80), makeSlice(24, 92, 198, 168, 48)]).length, 1);
  assert.equal(editor.getRaceMode7RoadBands([makeSlice(10, 80, 190, 220, 80), makeSlice(240, 92, 198, 168, 48)]).length, 0);
  assert.equal(raceEditorSource.includes('areRaceMode7SlicesContiguous(near = null, far = null)'), true);
});

test('Race wheel terrain classification matches physical road edge', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.worldZ = 20;
  editor.playtestSession.carYaw = 0;

  editor.playtestSession.worldX = 0.8;
  assert.deepEqual(editor.getRaceWheelSurfaceState().terrainByWheel, {
    fl: 'road',
    fr: 'road',
    rl: 'road',
    rr: 'road'
  });

  editor.playtestSession.worldX = -1.5;
  assert.equal(editor.getRaceWheelSurfaceState().terrainByWheel.fr, 'shoulder');
  assert.equal(editor.getRaceWheelSurfaceState().terrainByWheel.rr, 'shoulder');
  assert.equal(editor.getRaceWheelSurfaceState().terrainByWheel.fl, 'road');
  assert.equal(editor.getRaceWheelSurfaceState().terrainByWheel.rl, 'road');
});

test('Race playtest camera yaw follows the car instead of auto-following road yaw', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.segments = [
    { length: 120, curve: 1, elevation: 0, surface: 'asphalt', turn: 'square', hazardIds: [] },
    { length: 120, curve: 1, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest(editor.selectedCar.id);
  editor.playtestSession.projectedDistance = 80;
  editor.playtestSession.distance = 80;
  editor.playtestSession.launchLockMs = 0;
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
  editor.playtestSession.projectedDistance = 80;
  editor.playtestSession.distance = 80;
  editor.playtestSession.launchLockMs = 0;
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

test('Race playtest hard high-speed steering produces rear tire breakaway', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 1, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.road.segments = [
    { length: 1200, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest('subaru-brz-2022');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 86 * 0.44704;
  editor.playtestSession.carYaw = 0;
  editor.playtestSession.velocityYaw = 0;
  editor.raceInput.steeringTarget = 1;
  editor.raceInput.steeringWheel = 1;
  editor.raceInput.analogSteeringActive = true;

  for (let frame = 0; frame < 20; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.playtestSession.tireSlip.rearBreakaway > 0.35, true);
  assert.equal(editor.playtestSession.tireSlip.rl > editor.playtestSession.tireSlip.fl, true);
  assert.equal(editor.playtestSession.tireSlip.rr > editor.playtestSession.tireSlip.fr, true);
  assert.equal(Math.abs(editor.playtestSession.carYaw) > Math.abs(editor.playtestSession.velocityYaw), true);
  assert.equal(editor.playtestSession.tireSlip.audibleSlip > 0.2, true);
});

test('Race playtest full brake and steering can rotate a BRZ into rear breakaway', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: { gamepadAxes: { leftX: 1, leftTrigger: 1, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.road.segments = [
    { length: 1200, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest('subaru-brz-2022');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 62 * 0.44704;
  editor.playtestSession.carYaw = 0;
  editor.playtestSession.velocityYaw = 0;
  editor.raceInput.steeringTarget = 1;
  editor.raceInput.steeringWheel = 1;
  editor.raceInput.analogSteeringActive = true;
  editor.raceInput.rawBrakeAxis = 1;
  editor.raceInput.brakeAxis = 1;
  editor.raceInput.analogBrakeActive = true;

  for (let frame = 0; frame < 24; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.playtestSession.tireSlip.rearBreakaway > 0.25, true);
  assert.equal(editor.playtestSession.tireSlip.brakeLock > 0, true);
  assert.equal(Math.abs(editor.playtestSession.carYaw) > 0.02, true);
});

test('Race playtest 100 mph BRZ handbrake creates sustained drift breakaway', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: { gamepadAxes: { leftX: 1, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.road.segments = [
    { length: 1400, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest('subaru-brz-2022');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 100 * 0.44704;
  editor.playtestSession.carYaw = 0;
  editor.playtestSession.velocityYaw = 0;
  editor.raceInput.steeringTarget = 0.8;
  editor.raceInput.steeringWheel = 0.8;
  editor.raceInput.handbrake = true;

  for (let frame = 0; frame < 60; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.playtestSession.tireSlip.rearBreakaway > 0.75, true);
  assert.equal(editor.playtestSession.tireSlip.brakeLockByWheel.rl > 0.4, true);
  assert.equal(editor.playtestSession.tireSlip.brakeLockByWheel.rr > 0.4, true);
  assert.equal(editor.playtestSession.tireSlip.slipAngle > 0.45, true);
  assert.equal(Math.abs(editor.playtestSession.carYaw) > 0.8, true);
});

test('Race tire temperature has an aggressive gameplay grip curve', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const cold = editor.getRaceTireTemperatureGripMultiplier(70);
  const optimal = editor.getRaceTireTemperatureGripMultiplier(190);
  const overheated = editor.getRaceTireTemperatureGripMultiplier(335);

  assert.equal(optimal > cold, true);
  assert.equal(overheated < cold, true);
  assert.equal(editor.getRaceTireTemperatureGripMultipliers({ fl: 190, fr: 190, rl: 335, rr: 335 }).rl < cold, true);
});

test('Race playtest launch wheelspin is produced by driven-wheel traction limits', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 1 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.road.segments = [
    { length: 800, curve: 0, elevation: 0, surface: 'dirt', turn: 'smooth', hazardIds: [] }
  ];
  editor.raceInput.tractionControlEnabled = false;
  editor.startPlaytest('subaru-brz-2022');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.raceInput.rawThrottleAxis = 1;
  editor.raceInput.throttleAxis = 1;
  editor.raceInput.analogThrottleActive = true;

  for (let frame = 0; frame < 12; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.playtestSession.tireSlip.wheelSpin > 0, true);
  assert.equal(editor.playtestSession.tireSlip.rl > 0 || editor.playtestSession.tireSlip.rr > 0, true);
});

test('Race playtest samples traction independently for wheels on road and shoulder', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.segments = [
    { length: 700, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');
  const tuning = editor.getRaceCarTuning(editor.selectedCar);
  const roadHalfWidth = editor.getRaceRoadHalfWidthWorld(editor.selectedSegment);
  editor.playtestSession.worldX = -roadHalfWidth;
  editor.playtestSession.worldZ = 100;
  editor.playtestSession.carYaw = 0;

  const state = editor.getRaceWheelSurfaceState({
    car: editor.selectedCar,
    tuning,
    session: editor.playtestSession,
    damage: editor.getRaceSessionDamage()
  });

  assert.equal(state.terrainByWheel.fr !== 'road' || state.terrainByWheel.rr !== 'road', true);
  assert.equal(state.gripByWheel.fr < state.gripByWheel.fl || state.gripByWheel.rr < state.gripByWheel.rl, true);
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

  assert.equal(shoulderHalfWidth > roadHalfWidth + editor.getRaceCarWorldWidth() * 3, true);
  assert.equal(shoulderHalfWidth < roadHalfWidth + 50, true);
  assert.equal(Number.isFinite(section.shoulderLeft.elevation), true);
  assert.equal(Number.isFinite(section.shoulderRight.elevation), true);
  assert.equal(section.shoulderLeft.elevation, section.center.elevation);
  assert.equal(section.shoulderRight.elevation, section.center.elevation);

  editor.selectedRace.margin = { enabled: true, widthM: 0.22, shoulderWidthM: 30 };
  editor.invalidateRaceTerrainCaches(editor.ensureRaceTileMap());
  const wideSection = editor.getRaceRoadCrossSectionAtDistance(80);
  const wideShoulderHalfWidth = Math.hypot(
    Number(wideSection.shoulderLeft.x || 0) - Number(wideSection.center.x || 0),
    Number(wideSection.shoulderLeft.z || 0) - Number(wideSection.center.z || 0)
  );
  assert.equal(Math.round((wideShoulderHalfWidth - roadHalfWidth) * 10) / 10, 30.2);

  editor.selectedRace.margin = { enabled: true, widthM: 0.22, shoulderWidthM: 30, shoulderMode: 'hidden' };
  editor.invalidateRaceTerrainCaches(editor.ensureRaceTileMap());
  const hiddenShoulderSection = editor.getRaceRoadCrossSectionAtDistance(80);
  const hiddenShoulderHalfWidth = Math.hypot(
    Number(hiddenShoulderSection.shoulderLeft.x || 0) - Number(hiddenShoulderSection.center.x || 0),
    Number(hiddenShoulderSection.shoulderLeft.z || 0) - Number(hiddenShoulderSection.center.z || 0)
  );
  assert.equal(Math.round((hiddenShoulderHalfWidth - roadHalfWidth) * 10) / 10, 0.2);

  editor.selectedRace.margin = { enabled: true, widthM: 0.22, shoulderWidthM: 30, shoulderMode: 'off', shoulderEnabled: false };
  editor.invalidateRaceTerrainCaches(editor.ensureRaceTileMap());
  const noShoulderSection = editor.getRaceRoadCrossSectionAtDistance(80);
  const noShoulderHalfWidth = Math.hypot(
    Number(noShoulderSection.shoulderLeft.x || 0) - Number(noShoulderSection.center.x || 0),
    Number(noShoulderSection.shoulderLeft.z || 0) - Number(noShoulderSection.center.z || 0)
  );
  assert.equal(Math.round((noShoulderHalfWidth - roadHalfWidth) * 10) / 10, 0.2);
});

test('Race Editor settings store project art skybox references for parallax backgrounds', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = undefined;
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const settingsIds = editor.getMenuItems('settings').map((item) => item.id);

  assert.equal(settingsIds.includes('skybox-next'), true);
  assert.equal(editor.getRaceActionLabel('skybox-next'), 'Skybox');
  await editor.openRaceSkyboxArtPicker();
  assert.equal(editor.selectedRace.skyboxArtRef, 'Test Skybox');
  assert.equal(editor.getRaceActionLabel('skybox-next'), 'Skybox: Test Skybox');
  globalThis.document = previousDocument;
});

test('Race Editor settings use dialogs for AI, weather, tile art, and decal project art', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = undefined;
  try {
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    const settingsIds = editor.getMenuItems('settings').map((item) => item.id);
    const spriteIds = editor.getMenuItems('sprites').map((item) => item.id);

    assert.deepEqual(settingsIds, ['ai-count', 'add-sprite', 'skybox-next', 'race-sun', 'race-weather', 'race-margin', 'race-tiles', 'race-tire-fx', 'race-texture-scale']);
    assert.deepEqual(spriteIds, ['sprite-select', 'race-decal', 'race-ground-box', 'paint-sprite', 'sprite-brush-settings', 'erase-sprite', 'paint-decal', 'erase-decal', 'paint-tile', 'erase-tile']);
    assert.equal(editor.getRaceGroundRenderer(), 'webgl-track');

    editor.openRaceAiDialog();
    editor.raceSettingsDialogDraft.aiCount = 7;
    editor.closeRaceSettingsDialog({ accept: true });
    assert.equal(editor.getRaceAiCount(), 7);

    editor.openRaceWeatherDialog();
    editor.raceSettingsDialogDraft.weather = 'snow';
    editor.raceSettingsDialogDraft.intensity = 0.6;
    editor.closeRaceSettingsDialog({ accept: true });
    assert.equal(editor.selectedRace.weather, 'snow');
    assert.equal(editor.selectedRace.weatherIntensity, 0.6);

    editor.openRaceSunDialog();
    editor.raceSettingsDialogDraft.angleDeg = 92;
    editor.raceSettingsDialogDraft.intensity = 0.4;
    editor.closeRaceSettingsDialog({ accept: true });
    assert.deepEqual(editor.getRaceSunSettings(), { angleDeg: 92, intensity: 0.4 });

    editor.openRaceTilesDialog();
    editor.raceSettingsDialogDraft.slotId = 'boundary';
    editor.closeRaceSettingsDialog({ accept: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(editor.selectedRace.surfaceArt.boundary, 'Test Margin');

    editor.openRaceMarginDialog();
    editor.raceSettingsDialogDraft.marginMode = 'hidden';
    editor.raceSettingsDialogDraft.enabled = true;
    editor.raceSettingsDialogDraft.widthM = 0.42;
    editor.raceSettingsDialogDraft.shoulderWidthM = 24;
    editor.raceSettingsDialogDraft.shoulderMode = 'hidden';
    editor.raceSettingsDialogDraft.shoulderEnabled = true;
    editor.raceSettingsDialogDraft.collisionEdge = 'shoulder';
    editor.raceSettingsDialogDraft.collisionMode = 'shoulder';
    editor.raceSettingsDialogDraft.collisionEffect = 'reset';
    await editor.openRaceMarginArtPicker();
    editor.closeRaceSettingsDialog({ accept: true });
    assert.equal(editor.selectedRace.margin.marginMode, 'hidden');
    assert.equal(editor.selectedRace.margin.enabled, true);
    assert.equal(editor.selectedRace.margin.widthM, 0.42);
    assert.equal(editor.selectedRace.margin.shoulderWidthM, 24);
    assert.equal(editor.selectedRace.margin.shoulderMode, 'hidden');
    assert.equal(editor.selectedRace.margin.shoulderEnabled, true);
    assert.equal(editor.selectedRace.margin.collisionEdge, 'shoulder');
    assert.equal(editor.selectedRace.margin.collisionMode, 'shoulder');
    assert.equal(editor.selectedRace.margin.collisionEffect, 'reset');
    assert.equal(editor.getRaceShoulderWidthWorld(), 24);
    assert.equal(editor.getRaceEdgeCollisionMode(), 'shoulder');
    assert.equal(editor.getRaceEdgeCollisionEffect(), 'reset');
    assert.equal(editor.selectedRace.margin.artRef, 'Test Margin');
    assert.equal(editor.getRaceMarginLabel(), 'Margin: Hidden');

    editor.setRaceGroundRenderer('software');
    editor.openRaceTextureScaleDialog();
    assert.equal(editor.raceSettingsDialogDraft.pixelWorldM, 0.0313);
    assert.equal(editor.raceSettingsDialogDraft.nearTextureQuality, 2);
    assert.equal(editor.raceSettingsDialogDraft.textureFilterMode, 'balanced');
    assert.equal(editor.raceSettingsDialogDraft.mipStart, 0.0015);
    assert.equal(editor.raceSettingsDialogDraft.mipStrength, 1.35);
    assert.equal(editor.raceSettingsDialogDraft.scanlineResolution, 100);
    assert.equal(editor.raceSettingsDialogDraft.scanlineRowStep, 1);
    assert.equal(editor.raceSettingsDialogDraft.groundRenderer, 'software');
    assert.equal(editor.raceSettingsDialogDraft.trackEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.overlaysEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.lightingEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.terrainEnabled, false);
    assert.equal(editor.raceSettingsDialogDraft.texturesEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.detailEnabled, false);
    assert.equal(editor.raceSettingsDialogDraft.terrainCullingEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.terrainLodEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.terrainBudgetEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.farRoadDecimationEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.threeEnabled, true);
    assert.equal(editor.raceSettingsDialogDraft.rawTerrainPolygonsEnabled, false);
    const ctx = createMockContext();
    editor.draw(ctx, 390, 844);
    const cancelButton = editor.buttons.find((button) => button.id === 'race-settings-cancel');
    const okButton = editor.buttons.find((button) => button.id === 'race-settings-ok');
    assert.ok(cancelButton);
    assert.ok(okButton);
    assert.equal(cancelButton.bounds.y + cancelButton.bounds.h <= 844, true);
    assert.equal(okButton.bounds.y + okButton.bounds.h <= 844, true);
    const rendererButton = editor.buttons.find((button) => button.id === 'texture-renderer-webgl');
    assert.ok(rendererButton);
    assert.ok(editor.buttons.find((button) => button.id === 'texture-debug-lighting'));
    assert.ok(editor.buttons.find((button) => button.id === 'texture-debug-track'));
    assert.ok(editor.buttons.find((button) => button.id === 'texture-debug-overlays'));
    assert.ok(editor.buttons.find((button) => button.id === 'texture-debug-terrain'));
    assert.ok(editor.buttons.find((button) => button.id === 'texture-debug-textures'));
    assert.ok(editor.buttons.find((button) => button.id === 'texture-debug-detail'));
    assert.equal(ctx.calls.some((call) => call.type === 'text' && String(call.value || '').includes('Set how many meters')), false);
    assert.equal(ctx.calls.some((call) => call.type === 'text' && String(call.value || '').includes('WebGL uses')), false);
    assert.equal(ctx.calls.some((call) => call.type === 'text' && String(call.value || '').includes('WebGL Track draws')), false);
    assert.equal(ctx.calls.some((call) => call.type === 'text' && String(call.value || '').startsWith('32px = ')), true);
    assert.deepEqual(
      editor.raceSettingsSliderRegions.map((region) => region.key),
      ['texture-scale', 'mip-start', 'mip-strength', 'scanline-resolution', 'scanline-row-step']
    );
    const lightingButton = editor.buttons.find((button) => button.id === 'texture-debug-lighting');
    editor.handlePointerDown({
      x: lightingButton.bounds.x + lightingButton.bounds.w / 2,
      y: lightingButton.bounds.y + lightingButton.bounds.h / 2,
      button: 0
    });
    assert.equal(editor.raceSettingsDialogDraft.lightingEnabled, false);
    editor.handlePointerDown({
      x: rendererButton.bounds.x + rendererButton.bounds.w / 2,
      y: rendererButton.bounds.y + rendererButton.bounds.h / 2,
      button: 0
    });
    assert.equal(editor.raceSettingsDialogDraft.groundRenderer, 'webgl');
    editor.draw(ctx, 390, 844);
    assert.deepEqual(
      editor.raceSettingsSliderRegions.map((region) => region.key),
      ['texture-scale', 'scanline-resolution']
    );
    editor.handlePointerDown({
      x: rendererButton.bounds.x + rendererButton.bounds.w / 2,
      y: rendererButton.bounds.y + rendererButton.bounds.h / 2,
      button: 0
    });
    assert.equal(editor.raceSettingsDialogDraft.groundRenderer, 'webgl-track');
    editor.draw(ctx, 390, 844);
    assert.deepEqual(
      editor.raceSettingsSliderRegions.map((region) => region.key),
      ['texture-scale', 'near-texture-quality', 'scanline-resolution']
    );
    const nearQualityRegion = editor.raceSettingsSliderRegions.find((region) => region.key === 'near-texture-quality');
    assert.ok(nearQualityRegion);
    editor.updateRaceSettingsSlider(nearQualityRegion, nearQualityRegion.track.x + nearQualityRegion.track.w * ((3.5 - nearQualityRegion.min) / (nearQualityRegion.max - nearQualityRegion.min)));
    assert.equal(editor.raceSettingsDialogDraft.nearTextureQuality, 3.5);
    const textureFilterButton = editor.buttons.find((button) => button.id === 'texture-filter-mode');
    assert.ok(textureFilterButton);
    const cullingButton = editor.buttons.find((button) => button.id === 'texture-debug-culling');
    const lodButton = editor.buttons.find((button) => button.id === 'texture-debug-lod');
    const budgetButton = editor.buttons.find((button) => button.id === 'texture-debug-budget');
    const roadThinButton = editor.buttons.find((button) => button.id === 'texture-debug-road-thin');
    const threeButton = editor.buttons.find((button) => button.id === 'texture-debug-three');
    const rawTerrainButton = editor.buttons.find((button) => button.id === 'texture-debug-raw-terrain');
    assert.ok(cullingButton);
    assert.ok(lodButton);
    assert.ok(budgetButton);
    assert.ok(roadThinButton);
    assert.ok(threeButton);
    assert.ok(rawTerrainButton);
    [cullingButton, lodButton, budgetButton, roadThinButton].forEach((button) => {
      editor.handlePointerDown({
        x: button.bounds.x + button.bounds.w / 2,
        y: button.bounds.y + button.bounds.h / 2,
        button: 0
      });
    });
    editor.handlePointerDown({
      x: threeButton.bounds.x + threeButton.bounds.w / 2,
      y: threeButton.bounds.y + threeButton.bounds.h / 2,
      button: 0
    });
    editor.handlePointerDown({
      x: rawTerrainButton.bounds.x + rawTerrainButton.bounds.w / 2,
      y: rawTerrainButton.bounds.y + rawTerrainButton.bounds.h / 2,
      button: 0
    });
    assert.equal(editor.raceSettingsDialogDraft.terrainCullingEnabled, false);
    assert.equal(editor.raceSettingsDialogDraft.terrainLodEnabled, false);
    assert.equal(editor.raceSettingsDialogDraft.terrainBudgetEnabled, false);
    assert.equal(editor.raceSettingsDialogDraft.farRoadDecimationEnabled, false);
    assert.equal(editor.raceSettingsDialogDraft.threeEnabled, false);
    assert.equal(editor.raceSettingsDialogDraft.rawTerrainPolygonsEnabled, true);
    editor.handlePointerDown({
      x: textureFilterButton.bounds.x + textureFilterButton.bounds.w / 2,
      y: textureFilterButton.bounds.y + textureFilterButton.bounds.h / 2,
      button: 0
    });
    assert.equal(editor.raceSettingsDialogDraft.textureFilterMode, 'smooth');
    editor.draw(ctx, 390, 560);
    const shortOkButton = editor.buttons.find((button) => button.id === 'race-settings-ok');
    const shortCancelButton = editor.buttons.find((button) => button.id === 'race-settings-cancel');
    assert.ok(shortOkButton);
    assert.ok(shortCancelButton);
    assert.equal(shortOkButton.bounds.y + shortOkButton.bounds.h <= 560, true);
    assert.equal(shortCancelButton.bounds.y + shortCancelButton.bounds.h <= 560, true);
    const shortRendererButton = editor.buttons.find((button) => button.id === 'texture-renderer-webgl');
    assert.ok(shortRendererButton);
    editor.handlePointerDown({
      x: shortRendererButton.bounds.x + shortRendererButton.bounds.w / 2,
      y: shortRendererButton.bounds.y + shortRendererButton.bounds.h / 2,
      button: 0
    });
    assert.equal(editor.raceSettingsDialogDraft.groundRenderer, 'software');
    editor.raceSettingsDialogDraft.pixelWorldM = 0.1;
    editor.raceSettingsDialogDraft.nearTextureQuality = 4;
    editor.raceSettingsDialogDraft.textureFilterMode = 'crisp';
    editor.raceSettingsDialogDraft.mipStart = 0.01;
    editor.raceSettingsDialogDraft.mipStrength = 2.25;
    editor.raceSettingsDialogDraft.scanlineResolution = 350;
    editor.raceSettingsDialogDraft.scanlineRowStep = 0.5;
    editor.raceSettingsDialogDraft.groundRenderer = 'webgl-track';
    editor.raceSettingsDialogDraft.trackEnabled = false;
    editor.raceSettingsDialogDraft.overlaysEnabled = false;
    editor.raceSettingsDialogDraft.lightingEnabled = false;
    editor.raceSettingsDialogDraft.terrainEnabled = false;
    editor.raceSettingsDialogDraft.texturesEnabled = false;
    editor.raceSettingsDialogDraft.detailEnabled = false;
    editor.raceSettingsDialogDraft.terrainCullingEnabled = false;
    editor.raceSettingsDialogDraft.terrainLodEnabled = false;
    editor.raceSettingsDialogDraft.terrainBudgetEnabled = false;
    editor.raceSettingsDialogDraft.farRoadDecimationEnabled = false;
    editor.raceSettingsDialogDraft.threeEnabled = true;
    editor.raceSettingsDialogDraft.rawTerrainPolygonsEnabled = true;
    editor.closeRaceSettingsDialog({ accept: true });
    assert.equal(editor.getRaceGroundTextureBaseWorldM(), 3.2);
    assert.equal(editor.getRaceGroundNearTextureQuality(), 4);
    assert.equal(editor.getRaceGroundTextureFilterMode(), 'crisp');
    assert.equal(editor.getRaceActionLabel('race-texture-scale'), 'Scale: 0.1m/px');
    assert.deepEqual(editor.getRaceGroundMipSettings(), { start: 0.01, strength: 2.25 });
    assert.deepEqual(editor.getRaceGroundScanlineSettings(), { resolution: 350, rowStep: 0.5 });
    assert.equal(editor.getRaceGroundRenderer(), 'webgl-track');
    assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 2 }), 0.25);
    assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 4 }), 0.25);
    assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 8 }), 0.25);
    assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 16 }), 0.25);
    assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 32 }), 0.32);
    assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 64 }), 0.64);
    assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 100 }), 1);
    assert.equal(editor.getRaceWebGLTrackRenderResolution({ resolution: 400 }), 4);
    editor.setRaceGroundNearTextureQuality(24);
    assert.equal(editor.getRaceGroundNearTextureQuality(), 24);
    assert.deepEqual(editor.getRaceRenderDebugSettings(), {
      trackEnabled: false,
      overlaysEnabled: false,
      lightingEnabled: false,
      terrainEnabled: false,
      texturesEnabled: false,
      detailEnabled: false,
      terrainCullingEnabled: false,
      terrainLodEnabled: false,
      terrainBudgetEnabled: false,
      farRoadDecimationEnabled: false,
      threeEnabled: true,
      rawTerrainPolygonsEnabled: true
    });

    editor.setRaceGroundTexturePixelWorldM(0.0001);
    assert.equal(editor.getRaceGroundTexturePixelWorldM(), 0.0001);
    editor.setRaceGroundTexturePixelWorldM(12);
    assert.equal(editor.getRaceGroundTexturePixelWorldM(), 10);

    await editor.openRaceDecalArtPicker();
    assert.equal(editor.selectedRaceDecalArtRef, 'Test Decal');
    assert.equal(editor.activeAction, 'paint-decal');
    await editor.openRaceGroundBoxArtPicker();
    assert.equal(editor.selectedRaceGroundBoxArtRef, 'Test Ground Tile');
    assert.equal(editor.activeAction, 'paint-tile');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('Race Editor saves and loads selected race tracks with authored data intact', () => {
  resetProjectFilesForTests();
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const race = editor.selectedRace;
  race.id = 'custom-ridge';
  race.name = 'Custom Ridge';
  race.weather = 'rain';
  race.margin = { enabled: true, widthM: 0.44, shoulderWidthM: 28, artRef: 'Fence Texture' };
  race.surfaceArt = { boundary: 'Fence Texture', grass: 'Grass Tile', asphalt: 'Asphalt Tile' };
  race.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 40, y: 120, elevation: 0.18 },
    { x: 110, y: 190, elevation: -0.04 }
  ];
  race.road.segments = [
    { length: 126, curve: 0.25, elevation: 0.18, surface: 'asphalt', roadWidthM: 7.2, boundaryCollidable: true, bumpiness: 0.12 },
    { length: 99, curve: -0.45, elevation: -0.04, surface: 'dirt', roadWidthM: 6.4, snowCondition: 'slush' }
  ];
  race.road.tileMap = {
    cellSizeM: 5,
    defaultTileId: 'grass',
    cells: {
      '0,0': { tileId: 'grass', elevation: 0.12, weights: { grass: 0.8, dirt: 0.2 } },
      '1,0': { tileId: 'dirt', elevation: 0.18, weights: { dirt: 1 } }
    }
  };
  race.sceneryDefinitions = [{ id: 'tree-def', artRef: 'Tree Art', label: 'Tree', widthM: 2, heightM: 7, behavior: 'indestructible' }];
  race.scenery = [{ id: 'tree-1', definitionId: 'tree-def', artRef: 'Tree Art', x: 12, z: 18, widthM: 2, heightM: 7, behavior: 'indestructible' }];
  race.decals = [{ id: 'skid-1', artRef: 'Skid Art', x: 20, z: 30, widthM: 3, heightM: 1.2, rotation: 0.4 }];

  const saved = editor.saveSelectedRaceToName('Custom Ridge');
  assert.equal(saved.folder, 'races');
  assert.equal(saved.name, 'Custom Ridge');
  const payload = loadProjectFile('races', 'Custom Ridge');
  assert.equal(payload.data.kind, 'race-track');
  assert.equal(payload.data.race.margin.shoulderWidthM, 28);
  assert.equal(payload.data.race.road.segments[0].boundaryCollidable, true);
  assert.equal(payload.data.race.road.tileMap.cells['0,0'].weights.grass, 0.8);
  assert.equal(payload.data.race.sceneryDefinitions[0].artRef, 'Tree Art');
  assert.equal(payload.data.race.decals[0].artRef, 'Skid Art');

  const loaded = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  assert.equal(loaded.applyLoadedRaceDocument(payload.data, { name: 'Custom Ridge' }), true);
  assert.equal(loaded.selectedRace.id, 'custom-ridge');
  assert.equal(loaded.selectedRace.margin.widthM, 0.44);
  assert.equal(loaded.selectedRace.margin.shoulderWidthM, 28);
  assert.equal(loaded.selectedRace.surfaceArt.boundary, 'Fence Texture');
  assert.equal(loaded.selectedRace.road.nodes.length, 3);
  assert.equal(loaded.selectedRace.road.segments[1].snowCondition, 'slush');
  assert.equal(loaded.selectedRace.scenery[0].definitionId, 'tree-def');
  assert.equal(loaded.selectedRace.decals[0].rotation, 0.4);
  assert.equal(loaded.currentRaceDocumentName, 'Custom Ridge');
});

test('Car Editor saves, seeds, and loads selected cars through project files', () => {
  resetProjectFilesForTests();
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }, { mode: 'car' });

  editor.ensureBuiltInCarProjectFiles();
  const seededWrx = loadProjectFile('cars', '2022 Subaru WRX');
  const seededBrz = loadProjectFile('cars', '2022 Subaru BRZ');
  const seededCivic = loadProjectFile('cars', '2023 Honda Civic Type R');
  assert.equal(seededWrx.data.kind, 'race-car');
  assert.equal(seededBrz.data.car.id, 'subaru-brz-2022');
  assert.equal(seededCivic.data.car.id, 'honda-civic-type-r-2023');

  assert.equal(editor.loadBuiltInCarDocument('starter-rwd'), true);
  assert.equal(editor.selectedCar.id, 'starter-rwd');
  assert.equal(editor.currentCarDocumentName, '2022 Subaru WRX');
  editor.handleMenuAction('load-civic');
  assert.equal(editor.selectedCar.id, 'honda-civic-type-r-2023');
  assert.equal(editor.currentCarDocumentName, '2023 Honda Civic Type R');

  editor.project.selectedCarId = 'subaru-brz-2022';
  editor.selectedCar.audio.engineProfile = 'custom-brz-engine';
  const saved = editor.saveSelectedCarToName('Track BRZ');
  assert.equal(saved.folder, 'cars');
  assert.equal(saved.name, 'Track BRZ');

  const payload = loadProjectFile('cars', 'Track BRZ');
  assert.equal(payload.data.kind, 'race-car');
  assert.equal(payload.data.car.audio.engineProfile, 'custom-brz-engine');

  const loaded = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }, { mode: 'car' });
  assert.equal(loaded.applyLoadedCarDocument(payload.data, { name: 'Track BRZ' }), true);
  assert.equal(loaded.selectedCar.id, 'subaru-brz-2022');
  assert.equal(loaded.selectedCar.name, '2022 Subaru BRZ');
  assert.equal(loaded.selectedCar.audio.engineProfile, 'custom-brz-engine');
  assert.equal(loaded.currentCarDocumentName, 'Track BRZ');
});

test('Race reverse steering keeps signed speed in the physical yaw model', () => {
  assert.equal(raceEditorSource.includes('const yawSpeedMps = this.playtestSession.speedMps < -0.2 ? this.playtestSession.speedMps * 0.72 : this.playtestSession.speedMps;'), true);
  assert.equal(raceEditorSource.includes('const yawSpeedMps = this.playtestSession.speedMps < -0.2 ? absSpeed * 0.72 : this.playtestSession.speedMps;'), false);
});

test('Race playtest projected cars use authored Car Editor artwork before procedural fallback', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedCar.art = {
    shell: 'Car Shell',
    turnFrames: { left: 'Car Left', center: 'Car Center', right: 'Car Right' }
  };
  let requestedArt = '';
  editor.getRaceArtSpriteCanvas = (artRef) => {
    requestedArt = artRef;
    return { width: 8, height: 12 };
  };
  const ctx = createMockContext();
  ctx.drawImage = (...args) => ctx.calls.push({ type: 'drawImage', args });

  editor.lastRaceRenderCamera = {
    camera: { focalScale: 1.1, roadWidthScale: 1 },
    cameraYaw: 0,
    bounds: { x: 0, y: 0, w: 390, h: 240 }
  };
  editor.drawRaceProjectedCarSprite(ctx, { x: 0, y: 0, w: 390, h: 240 }, {
    projected: { visible: true, screenX: 195, screenY: 190, cameraZ: 24, renderZ: 24 },
    yaw: 0,
    cameraYaw: 0,
    car: editor.selectedCar
  });

  assert.equal(requestedArt, 'Car Center');
  assert.equal(ctx.calls.some((call) => call.type === 'drawImage'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'fillRect'), false);
});

test('Race playtest procedural fallback car renders flat wheel footprints on the road plane', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedCar.art = {};
  editor.lastRaceRenderCamera = {
    camera: {
      x: 0,
      z: -16,
      elevation: 1.2,
      nearPlane: 1.4,
      farPlane: 900,
      focalScale: 1.04,
      roadWidthScale: 2.06,
      roadMaxWidthRatio: 1,
      horizonRatio: 0.31,
      roadDepthRatio: 0.66
    },
    cameraYaw: 0,
    bounds: { x: 0, y: 0, w: 390, h: 240 }
  };
  const ctx = createMockContext();

  editor.drawRaceProjectedCarSprite(ctx, { x: 0, y: 0, w: 390, h: 240 }, {
    projected: { visible: true, screenX: 195, screenY: 190, cameraZ: 24, renderZ: 24, x: 0, z: 16, elevation: 0 },
    yaw: 0,
    cameraYaw: 0,
    car: editor.selectedCar
  });

  assert.equal(ctx.calls.some((call) => call.type === 'drawImage'), false);
  assert.equal(ctx.calls.some((call) => call.type === 'fillRect'), false);
  assert.equal(ctx.calls.filter((call) => call.type === 'fill').length >= 5, true);
  assert.equal(raceEditorSource.includes('drawRaceProjectedProceduralCar'), true);
  assert.equal(raceEditorSource.includes('getRaceWheelWorldCenters'), true);
  assert.equal(raceEditorSource.includes('frontTireAngle'), true);
});

test('Race Editor skybox yaw scrolls continuously across the north seam', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const a = editor.getRaceContinuousSkyboxYaw(Math.PI * 1.98);
  const b = editor.getRaceContinuousSkyboxYaw(0.02);

  assert.equal(b > a, true);
  assert.equal(b - a < 0.2, true);
});

test('Race fallback skybox shows only the facing cardinal marker', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const ctx = createMockContext();

  editor.drawRaceParallaxBackground(ctx, bounds, {
    horizon: 130,
    cameraYaw: 0,
    heading: 0,
    velocityYaw: 0,
    speedMps: 0,
    hillPitch: 0
  });

  const labels = ctx.calls.filter((call) => call.type === 'text').map((call) => call.value);
  assert.deepEqual(labels, ['N']);

  const eastCtx = createMockContext();
  editor.drawRaceParallaxBackground(eastCtx, bounds, {
    horizon: 130,
    cameraYaw: Math.PI / 2,
    heading: 0,
    velocityYaw: 0,
    speedMps: 0,
    hillPitch: 0
  });
  const eastLabels = eastCtx.calls.filter((call) => call.type === 'text').map((call) => call.value);
  assert.deepEqual(eastLabels, ['E']);
});

test('Race art skybox is cached between playtest frames', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {};
  try {
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    editor.selectedRace.skyboxArtRef = 'Fast Sky';
    let artLoads = 0;
    editor.getRaceArtSpriteCanvas = (artRef) => {
      artLoads += 1;
      assert.equal(artRef, 'Fast Sky');
      return { width: 64, height: 16 };
    };
    const ctx = {
      ...createMockContext(),
      rect() {},
      clip() {},
      drawImage(...args) {
        this.calls.push({ type: 'drawImage', args });
      },
      imageSmoothingEnabled: true
    };
    const bounds = { x: 0, y: 0, w: 390, h: 240 };

    editor.drawRaceSkyboxArt(ctx, bounds, { horizon: 130, normalizedCameraYaw: 0 });
    editor.drawRaceSkyboxArt(ctx, bounds, { horizon: 130, normalizedCameraYaw: Math.PI / 2 });

    assert.equal(artLoads, 1);
    assert.equal(ctx.calls.some((call) => call.type === 'drawImage'), true);
    assert.equal(raceEditorSource.includes('const skyHeight = Math.max(1, horizon - bounds.y + bounds.h * 0.16);'), true);
    assert.equal(raceEditorSource.includes('const destH = Math.max(skyHeight, bounds.h * 0.58);'), true);
    assert.equal(raceEditorSource.includes('ctx.rect?.(bounds.x, bounds.y, bounds.w, Math.max(1, horizon - bounds.y + bounds.h * 0.18));'), true);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('Race art skybox scrolls by yaw turns instead of raw radians', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {};
  try {
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    editor.selectedRace.skyboxArtRef = 'Panorama';
    editor.getRaceArtSpriteCanvas = () => ({ width: 64, height: 16 });
    const bounds = { x: 0, y: 0, w: 390, h: 240 };
    const getFirstX = (yaw) => {
      const ctx = {
        ...createMockContext(),
        rect() {},
        clip() {},
        drawImage(...args) {
          this.calls.push({ type: 'drawImage', args });
        },
        imageSmoothingEnabled: true
      };
      editor.drawRaceSkyboxArt(ctx, bounds, { horizon: 130, normalizedCameraYaw: yaw });
      return ctx.calls.find((call) => call.type === 'drawImage')?.args?.[1];
    };

    const yaw0X = getFirstX(0);
    const yawSmallX = getFirstX(0.1);

    assert.equal(Number.isFinite(yaw0X), true);
    assert.equal(Number.isFinite(yawSmallX), true);
    assert.equal(yawSmallX > yaw0X, true);
    assert.equal(Math.abs(yawSmallX - yaw0X) < 40, true);
    assert.equal(raceEditorSource.includes('const yawTurns = Number(normalizedCameraYaw || 0) / (Math.PI * 2);'), true);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('Race Editor weather intensity builds up and converts effective road surfaces', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.weather = 'snow';
  editor.selectedRace.weatherIntensity = 1;
  editor.playtestSession = { elapsedMs: 0 };

  assert.equal(editor.getRaceEffectiveSurfaceId('asphalt'), 'asphalt');
  editor.playtestSession.elapsedMs = 70_000;
  assert.equal(editor.getRaceEffectiveSurfaceId('asphalt'), 'snow');
  assert.equal(editor.getRaceEffectiveSurfaceId('dirt'), 'snow');

  editor.selectedRace.weather = 'rain';
  editor.selectedRace.weatherIntensity = 1;
  editor.playtestSession.elapsedMs = 150_000;
  assert.equal(editor.getRaceEffectiveSurfaceId('asphalt'), 'wet-asphalt');
  assert.equal(editor.getRaceEffectiveSurfaceId('dirt'), 'mud');
  assert.equal(editor.getRaceEffectiveSurfaceId('gravel'), 'wet-gravel');
  assert.equal(editor.getRaceEffectiveSurfaceId('snow'), 'slush');
});

test('Race projection keeps near-clipped road points available for closest quads', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 640, h: 360 };
  const camera = {
    x: 0,
    z: 0,
    elevation: 0,
    horizonRatio: 0.31,
    roadDepthRatio: 0.7,
    focalScale: 1,
    roadWidthScale: 2.2,
    roadMaxWidthRatio: 0.72,
    nearPlane: 2.4
  };
  const projected = editor.projectRaceWorldPointToCamera({ x: 3, z: 1.6, elevation: 0, segment: editor.selectedSegment }, camera, 0, bounds);

  assert.equal(projected.visible, false);
  assert.equal(projected.clippedToNearPlane, true);
  assert.equal(projected.renderZ >= camera.nearPlane, true);
  assert.equal(Number.isFinite(projected.screenY), true);

  const clipped = editor.getRaceNearClippedProjectedPolygon([
    editor.projectRaceCameraSpacePointToScreen({ cameraX: -3, cameraY: 0, cameraZ: 1.6 }, camera, bounds),
    editor.projectRaceCameraSpacePointToScreen({ cameraX: 3, cameraY: 0, cameraZ: 1.6 }, camera, bounds),
    editor.projectRaceCameraSpacePointToScreen({ cameraX: 3, cameraY: 0, cameraZ: 4.2 }, camera, bounds),
    editor.projectRaceCameraSpacePointToScreen({ cameraX: -3, cameraY: 0, cameraZ: 4.2 }, camera, bounds)
  ], camera, bounds);
  assert.equal(clipped.length >= 4, true);
  assert.equal(clipped.some((point) => point.visible && point.clippedToNearPlane), true);
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
  assert.equal(editor.selectedRace.road.laneCount, 2);
  assert.equal(editor.selectedRace.road.width, 7.2);

  editor.handleMenuAction('surface-snow');
  assert.equal(editor.selectedSegment.surface, 'snow');
});

test('Race Editor File New lane choices create one to six real-meter lanes', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  editor.handleMenuAction('new');
  assert.equal(editor.selectedRace.road.laneCount, 1);
  assert.equal(editor.selectedRace.road.laneWidthM, 3.6);
  assert.equal(editor.selectedRace.road.width, 3.6);

  for (let laneCount = 1; laneCount <= 6; laneCount += 1) {
    editor.handleMenuAction(`new-${laneCount}-lane`);
    assert.equal(editor.selectedRace.road.laneCount, laneCount);
    assert.equal(editor.selectedRace.road.laneWidthM, 3.6);
    assert.equal(editor.selectedRace.road.width, Number((laneCount * 3.6).toFixed(1)));
  }
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
  assert.equal(editor.doesRaceRouteSelfIntersect(editor.selectedRace.road.nodes), false);
  assert.equal(raceEditorSource.includes("segment.turn === 'junction'"), true);
  assert.equal(raceEditorSource.includes("segment.turn === 'angled'"), true);
  assert.equal(raceEditorSource.includes('simplifyGeneratedRaceSegmentsForCleanRoute(segments = [])'), true);
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

  assert.equal(portrait.activeRootId, 'track');
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

  assert.equal(gamepad.activeRootId, 'track');
  assert.equal(gamepad.mobileRootOpen, false);
  assert.equal(gamepad.gamepadSubmenuOpen, true);
});

test('Race Editor File menu loads built-in test tracks', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const generateMenuIds = editor.getMenuItems('file').map((item) => item.id).slice(6, 12);

  assert.deepEqual(generateMenuIds, [
    'generate-random-race',
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

test('Race Editor File menu has no blank rows', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const fileItems = editor.getMenuItems('file');

  assert.equal(fileItems.length > 0, true);
  assert.equal(fileItems.some((item) => !item.id || !item.label || item.divider || item.separator), false);
  assert.deepEqual(fileItems.map((item) => item.id), [
    'new',
    'save',
    'save-as',
    'open',
    'export',
    'import',
    'generate-random-race',
    'load-weathertech-raceway',
    'load-nurburgring-nordschleife',
    'load-col-de-turini',
    'load-ouninpohja',
    'load-daytona-tri-oval',
    'exit-main'
  ]);
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
  assert.equal(editor.activeRootId, 'track');
  assert.equal(editor.racePortraitMode, 'race');
  assert.equal(editor.raceSelectionType, 'edge');
  assert.equal(editor.mobileRootOpen, true);
  assert.equal(editor.getMenuItems('file').some((item) => item.id === 'generate-random-race'), true);

  editor.startPlaytest('starter-rwd');
  assert.ok(editor.playtestSession);
  editor.endPlaytest();
  assert.equal(editor.playtestSession, null);
  assert.equal(editor.activeRootId, 'track');
  assert.equal(editor.mobileRootOpen, true);

  editor.startPlaytest('starter-rwd');
  editor.finishPlaytest();
  assert.equal(editor.playtestSession, null);
  assert.equal(editor.activeRootId, 'track');
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
  assert.equal(editor.buttons.some((button) => button.id === 'tuning-tab-tires'), true);
  assert.equal(editor.buttons.some((button) => button.id === 'tuning-tab-gearing'), true);
  assert.equal(editor.buttons.some((button) => button.id === 'tuning-tab-stats'), true);
  assert.equal(editor.buttons.some((button) => button.id === 'tire-fl'), true);
  assert.equal(editor.buttons.some((button) => button.id === 'tune-frontTirePressure-up'), true);

  const beforeCompound = editor.selectedCar.setup.tireCompoundByWheel.fl;
  editor.buttons.find((button) => button.id === 'tire-fl').onClick();
  assert.notEqual(editor.selectedCar.setup.tireCompoundByWheel.fl, beforeCompound);
  const beforePressure = editor.selectedCar.setup.tirePressurePsi.fl;
  editor.buttons.find((button) => button.id === 'tune-frontTirePressure-up').onClick();
  assert.equal(editor.selectedCar.setup.tirePressurePsi.fl, beforePressure + 1);

  editor.buttons.find((button) => button.id === 'tuning-tab-gearing').onClick();
  editor.buttons = [];
  editor.draw(createMockContext(), 1280, 800);
  assert.equal(editor.buttons.some((button) => button.id === 'tune-gearFinalDrive-down'), true);
  assert.equal(editor.buttons.some((button) => button.id === 'tune-gearRatio-1-up'), true);

  editor.buttons.find((button) => button.id === 'pre-race-start').onClick();
  assert.equal(editor.playtestSession.carId, 'subaru-brz-2022');
});

test('Race Editor exposes full tuning tabs and drivetrain-specific differential rows', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const tabs = editor.getRaceTuningTabs().map((tab) => tab.id);
  assert.deepEqual(tabs, ['tires', 'gearing', 'alignment', 'antiroll', 'springs', 'damping', 'aero', 'brake', 'differential', 'stats']);
  assert.equal(editor.getRaceTuningRowsForTab('alignment').some(([id]) => id === 'toeFront'), true);
  assert.equal(editor.getRaceTuningRowsForTab('springs').some(([id]) => id === 'suspensionTravelFront'), true);
  assert.equal(editor.getRaceTuningRowsForTab('brake').some(([id]) => id === 'brakePressure'), true);
  assert.equal(editor.getRaceTuningRowsForTab('differential').some(([id]) => id === 'centerDifferentialBalance'), true);

  editor.project.selectedCarId = 'honda-civic-type-r-2023';
  assert.deepEqual(editor.getRaceTuningRowsForTab('differential').map(([id]) => id), ['frontDifferentialAccel', 'frontDifferentialDecel']);
  editor.project.selectedCarId = 'subaru-brz-2022';
  assert.deepEqual(editor.getRaceTuningRowsForTab('differential').map(([id]) => id), ['rearDifferentialAccel', 'rearDifferentialDecel']);
});

test('Race Editor tuning changes affect gearing, braking, and simulated performance stats', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const car = editor.selectedCar;
  const baseStats = editor.getRaceTuningPerformanceStats(car);
  const baseRedline = editor.getRaceRedlineSpeedMps(editor.getRaceCarTuning(car), 1);
  editor.adjustRaceTuningValue('gearRatio-1', 1);
  const nextRedline = editor.getRaceRedlineSpeedMps(editor.getRaceCarTuning(car), 1);
  assert.equal(nextRedline < baseRedline, true);

  const baseBrake = editor.getRaceBrakeForceForInput({
    tuning: editor.getRaceCarTuning(car),
    brake: 1,
    normalLoads: { fl: 3600, fr: 3600, rl: 2600, rr: 2600 },
    gripByWheel: { fl: 1, fr: 1, rl: 1, rr: 1 },
    speedMps: 30
  });
  editor.adjustRaceTuningValue('brakePressure', 1);
  const strongerBrake = editor.getRaceBrakeForceForInput({
    tuning: editor.getRaceCarTuning(car),
    brake: 1,
    normalLoads: { fl: 3600, fr: 3600, rl: 2600, rr: 2600 },
    gripByWheel: { fl: 2, fr: 2, rl: 2, rr: 2 },
    speedMps: 30
  });
  assert.equal(strongerBrake.force > baseBrake.force, true);

  const tunedStats = editor.getRaceTuningPerformanceStats(car);
  assert.equal(tunedStats.braking60 < baseStats.braking60, true);
  assert.equal(['F', 'D', 'C', 'B', 'A', 'S1', 'S2'].includes(tunedStats.piClass), true);
});

test('Race Editor every exposed tuning row has a measurable physics or performance effect', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const paths = editor.getRaceTuningTabs()
    .filter((tab) => tab.id !== 'stats')
    .flatMap((tab) => editor.getRaceTuningRowsForTab(tab.id).map(([id]) => id));

  assert.equal(paths.length >= 28, true);
  paths.forEach((path) => {
    const before = getRaceTuningEffectSignature(editor, editor.selectedCar);
    editor.adjustRaceTuningValue(path, 1);
    const after = getRaceTuningEffectSignature(editor, editor.selectedCar);
    assert.notEqual(after, before, path);
    editor.adjustRaceTuningValue(path, -1);
  });
});

test('Race Editor displayed stock performance stats stay near documented real-world targets', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const wrx = editor.getRaceTuningPerformanceStats(editor.project.cars.find((car) => car.id === 'starter-rwd'));
  const brz = editor.getRaceTuningPerformanceStats(editor.project.cars.find((car) => car.id === 'subaru-brz-2022'));
  const civic = editor.getRaceTuningPerformanceStats(editor.project.cars.find((car) => car.id === 'honda-civic-type-r-2023'));

  assert.equal(wrx.zeroToSixty >= 5.4 && wrx.zeroToSixty <= 6.3, true);
  assert.equal(wrx.topSpeed >= 132 && wrx.topSpeed <= 137, true);
  assert.equal(wrx.powerHp, 271);
  assert.equal(wrx.torqueLbFt, 258);
  assert.equal(wrx.stockTarget.source, 'real-world');
  assert.equal(brz.zeroToSixty >= 5.3 && brz.zeroToSixty <= 7.2, true);
  assert.equal(brz.topSpeed >= 136 && brz.topSpeed <= 145, true);
  assert.equal(brz.powerHp, 228);
  assert.equal(brz.torqueLbFt, 184);
  assert.equal(civic.zeroToSixty >= 4.5 && civic.zeroToSixty <= 5.4, true);
  assert.equal(civic.topSpeed >= 164 && civic.topSpeed <= 171, true);
  assert.equal(civic.powerHp, 315);
  assert.equal(civic.torqueLbFt, 310);
  assert.equal(civic.stockTarget.carName, '2023 Honda Civic Type R');
});

test('Race Editor stock simulator hits documented acceleration and quarter-mile targets', () => {
  const stockCases = [
    ['starter-rwd', { zeroToSixtySec: [4.8, 5.7], quarterMileSec: [13.5, 14.4], quarterMileTrapMph: [95, 103] }],
    ['subaru-brz-2022', { zeroToSixtySec: [5.3, 7.1], quarterMileSec: [13.8, 15.5], quarterMileTrapMph: [94, 102] }],
    ['honda-civic-type-r-2023', { zeroToSixtySec: [4.5, 5.4], quarterMileSec: [13.0, 13.9], quarterMileTrapMph: [103, 111] }]
  ];

  stockCases.forEach(([carId, runtimeTarget]) => {
    const editor = new RaceEditor({
      deviceIsMobile: true,
      isMobile: true,
      input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 1 } },
      exitRaceEditor() {}
    });
    seedStockPerformanceStraight(editor);
    editor.startPlaytest(carId);
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    const result = simulateRaceAcceleration(editor, { seconds: 45, fps: 60 });
    const metadata = RACE_STOCK_PERFORMANCE_TARGETS[carId];

    assert.equal(metadata.source, 'real-world', carId);
    assertWithinRange(result.zeroToSixty, runtimeTarget.zeroToSixtySec, `${carId} 0-60`);
    assertWithinRange(result.quarterMile, runtimeTarget.quarterMileSec, `${carId} quarter-mile`);
    assertWithinRange(result.quarterMileTrapMph, runtimeTarget.quarterMileTrapMph, `${carId} quarter-mile trap`);
  });
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
  setup.tireCompoundByWheel = { fl: 'tarmac', fr: 'tarmac', rl: 'tarmac', rr: 'tarmac' };
  assert.equal(editor.getRaceTireSetupGripMultiplier(car, 'dirt', 'clear') > 0.8, true);
  assert.equal(editor.getRaceTireSetupGripMultiplier(car, 'gravel', 'clear') > 0.78, true);
  assert.equal(snowInSnow > dirtInSnow, true);
});

test('Race Editor playtest advances, exposes hazards, and top pause returns to editor', () => {
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
  const pauseButton = editor.buttons.find((button) => button.id === 'race-pause-return-editor');
  assert.ok(pauseButton);
  assert.equal(editor.buttons.some((button) => button.id === 'end-playtest' && !button.desktopDropdownItem), false);
  editor.handlePointerDown({
    x: pauseButton.bounds.x + pauseButton.bounds.w / 2,
    y: pauseButton.bounds.y + pauseButton.bounds.h / 2
  });
  editor.handlePointerUp({
    x: pauseButton.bounds.x + pauseButton.bounds.w / 2,
    y: pauseButton.bounds.y + pauseButton.bounds.h / 2
  });

  assert.equal(editor.playtestSession, null);
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
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.projectedDistance = 30;
  editor.playtestSession.distance = 30;
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
  assert.equal(ctx.calls.some((call) => call.type === 'fillRect' && call.w === 7 && call.h === 6), true);
  assert.equal(ctx.calls.some((call) => call.type === 'fillRect' && call.w === 16 && call.h === 5), true);
  assert.equal(ctx.calls.some((call) => call.type === 'arc'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'lineTo'), true);
});

test('Race Editor normal telemetry uses live gauges while diagnostics keep timing metrics', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.tireSlip = {
    fl: 0.2,
    fr: 0.1,
    rl: 0.35,
    rr: 0.28,
    slipAngle: 0.12,
    wheelSurfaces: { fl: 'asphalt', fr: 'asphalt', rl: 'gravel', rr: 'asphalt' }
  };
  editor.playtestSession.diagnostics = {
    ...editor.createRaceDiagnosticsState(null),
    lateralG: 0.7,
    peakLateralG: 0.9,
    tireLoad: { fl: 1.1, fr: 0.9, rl: 1.2, rr: 0.8 },
    tireTemperature: { fl: 112, fr: 106, rl: 130, rr: 118 },
    suspensionTravel: { fl: 0.4, fr: 0.22, rl: 0.5, rr: 0.18 }
  };
  const ctx = createMockContext();
  editor.drawRaceDiagnosticsHud(ctx, { x: 0, y: 0, w: 390, h: 260 });
  const text = ctx.calls.filter((call) => call.type === 'text').map((call) => String(call.value));

  assert.equal(text.some((value) => value.includes('Slip')), true);
  assert.equal(text.some((value) => value.includes('Pedal')), true);
  assert.equal(text.some((value) => value.includes('0-60')), false);

  editor.playtestSession.diagnostics.mode = 'quarter-mile';
  const diagnosticCtx = createMockContext();
  editor.drawRaceDiagnosticsHud(diagnosticCtx, { x: 0, y: 0, w: 390, h: 260 });
  const diagnosticText = diagnosticCtx.calls.filter((call) => call.type === 'text').map((call) => String(call.value));
  assert.equal(diagnosticText.some((value) => value.includes('0-60')), true);
});

test('Race Editor playtest telemetry is hidden unless enabled from pause or diagnostic mode', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.diagnostics = {
    ...editor.createRaceDiagnosticsState(null),
    lateralG: 0.6,
    peakLateralG: 0.8
  };

  const hiddenCtx = createMockContext();
  editor.drawRacePlaytestHud(hiddenCtx, { x: 0, y: 0, w: 390, h: 260 });
  let text = hiddenCtx.calls.filter((call) => call.type === 'text').map((call) => String(call.value));
  assert.equal(text.some((value) => value.includes('Slip')), false);

  editor.toggleRaceTelemetry();
  const visibleCtx = createMockContext();
  editor.drawRacePlaytestHud(visibleCtx, { x: 0, y: 0, w: 390, h: 260 });
  text = visibleCtx.calls.filter((call) => call.type === 'text').map((call) => String(call.value));
  assert.equal(text.some((value) => value.includes('Slip')), true);

  editor.toggleRaceTelemetry();
  editor.playtestSession.diagnosticMode = 'quarter-mile';
  editor.playtestSession.diagnostics.mode = 'quarter-mile';
  const diagnosticCtx = createMockContext();
  editor.drawRacePlaytestHud(diagnosticCtx, { x: 0, y: 0, w: 390, h: 260 });
  text = diagnosticCtx.calls.filter((call) => call.type === 'text').map((call) => String(call.value));
  assert.equal(text.some((value) => value.includes('0-60')), true);
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

test('Race playtest minimap matches top-down editor orientation for L routes', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.selectedRace.type = 'destination';
  editor.selectedRace.road.nodes = [
    { x: 0, y: 0, elevation: 0, role: 'start', locked: true },
    { x: 0, y: 120, elevation: 0 },
    { x: 90, y: 120, elevation: 0 }
  ];
  editor.selectedRace.road.segments = [
    { length: 120, curve: 0, elevation: 0, surface: 'asphalt' },
    { length: 90, curve: 0, elevation: 0, surface: 'asphalt' }
  ];
  const mapBounds = { x: 0, y: 0, w: 220, h: 220 };
  const editorPoints = editor.getRaceMapPoints(mapBounds);
  assert.equal(editorPoints[1].screenY > editorPoints[0].screenY, true);
  assert.equal(editorPoints[2].screenX > editorPoints[1].screenX, true);

  editor.startPlaytest('starter-rwd');
  const ctx = createMockContext();
  editor.drawRaceTrackMinimap(ctx, { x: 0, y: 0, w: 120, h: 120 });
  const pathCalls = ctx.calls.filter((call) => call.type === 'moveTo' || call.type === 'lineTo');
  const start = pathCalls[0];
  const routeCalls = pathCalls.slice(0, editor.getRacePathSamples({ step: 28 }).length);
  const maxY = Math.max(...routeCalls.map((call) => call.y));
  const end = routeCalls.at(-1);
  assert.equal(maxY > start.y + 40, true);
  assert.equal(end.x > start.x + 40, true);
  assert.equal(Math.abs(end.y - maxY) < 4, true);
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

test('Race Editor speed affects perspective while capping far road distance', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.projectedDistance = 80;
  editor.playtestSession.distance = 80;
  editor.playtestSession.launchLockMs = 0;
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
  assert.ok(editor.getRaceRoadHalfWidthWorld() >= 1.8);
  assert.equal(raceEditorSource.includes('drawRaceStartFinishCheckerStripes'), true);
  assert.equal(raceEditorSource.includes("ctx.fillStyle = index % 2 === 0 ? '#f1f4ef' : '#050807';"), true);
  assert.equal(raceEditorSource.includes('getRaceCameraPitchProfile({'), true);
  assert.equal(raceEditorSource.includes('const liveNearPlane = Math.max(1.2'), true);
  assert.equal(raceEditorSource.includes("const viewDistance = routeRuntimeType === 'circuit'"), true);
  assert.equal(raceEditorSource.includes('Math.min(Math.max(routeLength * 1.5, absSpeed * 20 + 720, 1100), 1800)'), true);
  assert.equal(raceEditorSource.includes('safeCameraGroundElevation'), false);
  assert.equal(raceEditorSource.includes('const clearance = 0.055;'), false);
  assert.equal(raceEditorSource.includes('getRaceRoadDeckElevationAtDistance(distance'), true);
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

test('Race playtest applies hill grade force so steep inclines can roll backward', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  editor.selectedRace.road.nodes = [];
  editor.selectedRace.road.segments = [
    { length: 6, curve: 0, elevation: 0.8, surface: 'snow', hazardIds: [] },
    { length: 200, curve: 0, elevation: 0.8, surface: 'snow', hazardIds: [] }
  ];
  editor.startPlaytest('subaru-brz-2022');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.distance = 0.2;
  editor.playtestSession.speedMps = 1.2;
  editor.raceInput.throttleAxis = 0;
  editor.raceInput.brakeAxis = 0;

  for (let frame = 0; frame < 240; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.playtestSession.tireSlip.roadGrade > 0.08, true);
  assert.equal(editor.playtestSession.tireSlip.gradeForce < -1000, true);
  assert.equal(editor.playtestSession.speedMps < -0.5, true);
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
  assert.equal(clipped.clippedToNearPlane, true);
  assert.equal(visible.visible, true);
});

test('Race playtest near-road perspective comes from normal Mode 7 road bands', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.cameraView = 'first-person';
  editor.raceInput.cameraView = 'first-person';
  editor.playtestSession.distance = 40;
  const pose = editor.getRaceWorldPoseAtDistance(40);
  editor.playtestSession.worldX = pose.x;
  editor.playtestSession.worldZ = pose.z;
  editor.playtestSession.carYaw = pose.yaw;
  editor.playtestSession.cameraYaw = pose.yaw;

  const ctx = createMockContext();
  editor.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud: false });
  const bands = editor.getRaceMode7RoadBands(editor.lastRaceMode7Slices || []);
  const closest = bands.reduce((best, band) => (band.minZ < (best?.minZ ?? Infinity) ? band : best), null);

  assert.equal(raceEditorSource.includes('drawRaceImmediateCameraRoadPatch'), false);
  assert.ok(closest);
  assert.equal(closest.minZ <= editor.lastRaceRenderCamera.camera.nearPlane + 2.5, true);
  assert.equal(ctx.calls.some((call) => call.type === 'fill'), true);
});

test('Race third-person renderer samples from camera route distance at cardinal rotations', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.startPlaytest('starter-rwd');
  editor.raceInput.cameraView = 'third-person';
  editor.playtestSession.cameraView = 'third-person';
  editor.playtestSession.distance = 120;
  const pose = editor.getRaceWorldPoseAtDistance(120);
  editor.playtestSession.worldX = pose.x;
  editor.playtestSession.worldZ = pose.z;

  [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((yaw) => {
    editor.playtestSession.carYaw = yaw;
    editor.playtestSession.cameraYaw = yaw;
    const ctx = createMockContext();
    editor.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud: false });
    const bands = editor.getRaceMode7RoadBands(editor.lastRaceMode7Slices || []);
    const closest = bands.reduce((best, band) => (band.minZ < (best?.minZ ?? Infinity) ? band : best), null);

    assert.ok(closest);
    if (yaw === 0 || yaw === Math.PI) {
      assert.equal(closest.minZ <= editor.lastRaceRenderCamera.camera.nearPlane + 2.5, true);
    } else {
      assert.equal(closest.minZ <= editor.getRaceThirdPersonChaseDistance() + 2.5, true);
    }
    assert.equal(Number.isFinite(editor.lastRaceRenderCamera.camera.distance), true);
    assert.equal(ctx.calls.some((call) => call.type === 'fill'), true);
  });
  assert.equal(raceEditorSource.includes('backDistance: cameraView === \'third-person\' ? chaseDistance + camera.nearPlane * 2 : 0'), true);
});

test('Race third-person camera sits higher than first person while car anchor stays in chase band', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };

  assert.equal(editor.getRaceCameraEyeHeight('first-person'), 0.1);
  assert.equal(editor.getRaceCameraEyeHeight('third-person') > 0.3, true);

  editor.startPlaytest('starter-rwd');
  editor.raceInput.cameraView = 'third-person';
  editor.playtestSession.cameraView = 'third-person';
  editor.playtestSession.distance = 120;
  const pose = editor.getRaceWorldPoseAtDistance(120);
  editor.playtestSession.worldX = pose.x;
  editor.playtestSession.worldZ = pose.z;
  editor.playtestSession.carYaw = pose.yaw;
  editor.playtestSession.cameraYaw = pose.yaw;

  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  const camera = editor.lastRaceRenderCamera.camera;
  assert.equal(camera.eyeHeight, editor.getRaceCameraEyeHeight('third-person'));
  const chaseDistance = Math.hypot(
    editor.playtestSession.worldX - camera.x,
    editor.playtestSession.worldZ - camera.z
  );
  assert.equal(chaseDistance >= editor.getRaceThirdPersonChaseDistance() - 0.001, true);
  assert.equal(editor.getRaceThirdPersonChaseDistance() >= 14.5, true);

  const anchorCamera = {
    ...camera,
    elevation: Number(camera.roadElevation || 0) + 0.14,
    eyeHeight: 0.14
  };
  const segment = editor.getRaceSegmentAtDistance(editor.getRaceVisualTravelDistance()).segment;
  const roadContact = editor.projectRaceWorldPointToCamera({
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ,
    elevation: editor.getRaceStitchedTerrainElevationAtWorldPoint({
      x: editor.playtestSession.worldX,
      z: editor.playtestSession.worldZ
    }, Number(segment?.elevation || 0)),
    segment
  }, anchorCamera, editor.lastRaceRenderCamera.cameraYaw, bounds);
  const anchorY = editor.getRaceThirdPersonCarAnchorY(bounds, roadContact);

  assert.equal(anchorY >= bounds.y + bounds.h * 0.66, true);
  assert.equal(anchorY <= bounds.y + bounds.h * 0.84, true);
});

test('Race third-person car overlay uses road contact for vertical grounding', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  editor.startPlaytest('starter-rwd');
  editor.raceInput.cameraView = 'third-person';
  editor.playtestSession.cameraView = 'third-person';
  editor.playtestSession.distance = 120;
  const pose = editor.getRaceWorldPoseAtDistance(120);
  editor.playtestSession.worldX = pose.x;
  editor.playtestSession.worldZ = pose.z;
  editor.playtestSession.carYaw = pose.yaw;
  editor.playtestSession.cameraYaw = pose.yaw;
  editor.playtestSession.heightM = 18;

  editor.drawRaceProjectedRoadPath(createMockContext(), bounds, { showPlaytestHud: false });
  let capturedContact = null;
  const originalAnchor = editor.getRaceThirdPersonCarAnchorY.bind(editor);
  editor.getRaceThirdPersonCarAnchorY = (anchorBounds, projectedContact) => {
    capturedContact = projectedContact;
    return originalAnchor(anchorBounds, projectedContact);
  };

  editor.drawRaceThirdPersonCar(createMockContext(), bounds);

  const segment = editor.getRaceSegmentAtDistance(editor.getRaceVisualTravelDistance()).segment;
  const expectedRoadElevation = editor.getRaceStitchedTerrainElevationAtWorldPoint({
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ
  }, Number(segment?.elevation || 0));
  assert.ok(capturedContact);
  assert.equal(Math.abs(Number(capturedContact.elevation || 0) - expectedRoadElevation) < 0.0001, true);
  assert.equal(Math.abs(Number(capturedContact.elevation || 0) - Number(editor.playtestSession.heightM || 0) / 12) > 0.1, true);
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
  assert.equal(projectedNear.screenY >= bounds.y + bounds.h * 0.88, true);

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
  const firstSection = editor.getRaceRoadCrossSectionAtDistance(editor.playtestSession.distance + 12);
  const thirdSection = editor.getRaceRoadCrossSectionAtDistance(editor.playtestSession.distance + 12);
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

  assert.equal(firstWidth > thirdWidth * 1.2, true);
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
  assert.equal(editor.raceInput.analogSteeringIntent, 1);
  assert.equal(editor.raceInput.steeringTarget > 0.16, true);
  assert.equal(editor.raceInput.steeringTarget < 0.22, true);
  assert.equal(editor.raceInput.steeringWheel > 0.018, true);
  assert.equal(editor.raceInput.steeringWheel < 0.032, true);
  assert.equal(editor.getRaceMaxSteerForSpeed(editor.playtestSession.speedMps) <= 0.27, true);
});

test('Race Editor gamepad left thumbstick is primary steering during playtest', () => {
  const gameInput = { gamepadAxes: { leftX: 0.75, leftTrigger: 0, rightTrigger: 0 } };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    exitRaceEditor() {}
  });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.projectedDistance = 0;
  editor.playtestSession.speedMps = 4;
  editor.raceInput.binarySteer = -1;
  editor.applyRaceAnalogInput();

  assert.equal(editor.raceInput.analogSteeringActive, true);
  assert.equal(editor.raceInput.analogSteeringIntent > 0.6, true);
  editor.updatePlaytest(1 / 30);
  assert.equal(editor.playtestSession.steeringTarget > 0, true);
  assert.equal(editor.playtestSession.steeringTarget < editor.raceInput.analogSteeringIntent, true);

  gameInput.gamepadAxes.leftX = 0;
  editor.applyRaceAnalogInput();
  assert.equal(editor.raceInput.analogSteeringActive, false);
});

test('Race Editor analog steering decays fully after left thumbstick release', () => {
  const gameInput = { gamepadAxes: { leftX: 0.9, leftTrigger: 0, rightTrigger: 0 } };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    exitRaceEditor() {}
  });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.speedMps = 34;

  for (let frame = 0; frame < 12; frame += 1) editor.update(null, 1 / 60);
  assert.equal(editor.raceInput.steeringTarget > 0.05, true);

  gameInput.gamepadAxes.leftX = 0.01;
  for (let frame = 0; frame < 50; frame += 1) editor.update(null, 1 / 60);

  assert.equal(editor.raceInput.analogSteeringActive, false);
  assert.equal(editor.raceInput.analogSteeringIntent, 0);
  assert.equal(Math.abs(editor.raceInput.steeringTarget) < 0.03, true);
  assert.equal(Math.abs(editor.raceInput.steeringWheel) < 0.03, true);
});

test('Race Editor hides simulated handheld race controls when physical gamepad is connected', () => {
  let shellDraws = 0;
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: {
      gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 },
      isGamepadConnected: () => true
    },
    drawPortraitHandheldShell() { shellDraws += 1; },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.raceInput.activeDpadPointerId = 'touch';
  editor.raceInput.binarySteer = 1;
  editor.raceInput.activeThrottlePointerId = 'touch-go';
  editor.raceInput.throttle = true;
  editor.draw(ctx, 390, 844);

  assert.equal(shellDraws, 0);
  assert.deepEqual(editor.editorBounds, { x: 0, y: 0, w: 390, h: 844 });
  assert.equal(editor.buttons.some((button) => button.id === 'race-dpad'), false);
  assert.equal(editor.buttons.some((button) => button.id === 'race-go'), false);
  assert.equal(editor.buttons.some((button) => button.id === 'race-brake'), false);
  assert.equal(editor.raceInput.binarySteer, 0);
  assert.equal(editor.raceInput.throttle, false);
});

test('Race Editor physical gamepad fullscreen mode still reads left thumbstick axes', () => {
  const gameInput = {
    gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 },
    getGamepadAxes() {
      return this.gamepadAxes;
    },
    isGamepadConnected: () => true
  };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    drawPortraitHandheldShell() {
      throw new Error('physical gamepad playtest should not draw handheld shell');
    },
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.projectedDistance = 0;
  editor.playtestSession.speedMps = 4;
  gameInput.gamepadAxes.leftX = 0.82;
  editor.draw(ctx, 390, 844);
  editor.updatePlaytest(1 / 30);

  assert.equal(editor.raceInput.analogSteeringActive, true);
  assert.equal(editor.raceInput.analogSteeringIntent > 0.7, true);
  assert.equal(editor.raceInput.steeringTarget > 0, true);
  assert.equal(editor.raceInput.steeringWheel > 0, true);
  assert.equal(editor.buttons.some((button) => button.id === 'race-dpad'), false);
});

test('Race Editor off-road projection avoids black near-camera planes', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  const ctx = createMockContext();

  editor.selectedRace.road.segments = [
    { length: 900, curve: 0, elevation: 0, surface: 'asphalt', turn: 'smooth', hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.worldX = 260;
  editor.playtestSession.worldZ = 120;
  editor.playtestSession.carYaw = Math.PI / 2;
  editor.playtestSession.velocityYaw = Math.PI / 2;
  editor.playtestSession.cameraYaw = Math.PI / 2;
  editor.playtestSession.speedMps = 24;

  editor.drawRacePlaytestScreen(ctx, { x: 0, y: 0, w: 390, h: 240 });

  const blackProjectedFills = ctx.calls.filter((call) => (
    call.type === 'fill'
    && (call.style === '#000' || call.style === '#000000' || call.style === 'black')
  ));
  assert.equal(blackProjectedFills.length, 0);
});

test('Race Editor reverse steering keeps controller direction intuitive', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.projectedDistance = 80;
  editor.playtestSession.distance = 80;
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = -8;
  editor.playtestSession.carYaw = 0;
  editor.playtestSession.velocityYaw = 0;
  editor.raceInput.steeringTarget = 1;
  editor.raceInput.steeringWheel = 1;

  editor.updatePlaytest(0.25);

  assert.equal(editor.playtestSession.carYaw > 0, true);
});

test('Race Editor right steering follows map compass handedness', () => {
  const makeEditor = (yaw) => {
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    editor.startPlaytest('starter-rwd');
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    editor.playtestSession.speedMps = 20;
    editor.playtestSession.carYaw = yaw;
    editor.playtestSession.velocityYaw = yaw;
    editor.playtestSession.worldX = 0;
    editor.playtestSession.worldZ = 0;
    editor.playtestSession.distance = 20;
    editor.raceInput.steeringTarget = 1;
    editor.raceInput.steeringWheel = 1;
    return editor;
  };

  const southbound = makeEditor(0);
  southbound.updatePlaytest(0.2);
  assert.equal(southbound.playtestSession.carYaw < 0, true);
  assert.equal(southbound.playtestSession.worldX < 0, true);

  const northbound = makeEditor(Math.PI);
  northbound.updatePlaytest(0.2);
  assert.equal(northbound.playtestSession.carYaw < Math.PI, true);
  assert.equal(northbound.playtestSession.worldX > 0, true);
});

test('Race Editor right thumbstick looks around and hides third-person car while looking away', () => {
  const gameInput = {
    gamepadConnected: true,
    gamepadAxes: { leftX: 0, rightX: 1, leftTrigger: 0, rightTrigger: 0 },
    isGamepadConnected() {
      return this.gamepadConnected;
    },
    getGamepadAxes() {
      return this.gamepadAxes;
    }
  };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    exitRaceEditor() {}
  });
  let thirdPersonDraws = 0;
  editor.drawRaceThirdPersonCar = () => { thirdPersonDraws += 1; };

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.projectedDistance = 80;
  editor.playtestSession.distance = 80;
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.updatePlaytest(0.2);

  assert.equal(editor.raceInput.lookAngle > 0.5, true);
  assert.equal(editor.playtestSession.cameraYaw > editor.playtestSession.carYaw, true);
  editor.drawRacePlaytestScreen(createMockContext(), { x: 0, y: 0, w: 390, h: 240 });
  assert.equal(thirdPersonDraws, 0);

  gameInput.gamepadAxes.rightX = 0;
  for (let frame = 0; frame < 40; frame += 1) editor.updatePlaytest(1 / 60);
  assert.equal(Math.abs(editor.raceInput.lookAngle) < 0.2, true);
});

test('Race Editor ignores look-around axes unless a physical gamepad is connected', () => {
  const gameInput = {
    gamepadConnected: false,
    gamepadAxes: { leftX: 0, rightX: 1, leftTrigger: 0, rightTrigger: 0 },
    isGamepadConnected() {
      return this.gamepadConnected;
    },
    getGamepadAxes() {
      return this.gamepadAxes;
    }
  };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.projectedDistance = 80;
  editor.playtestSession.distance = 80;
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.raceInput.lookAngle = 1.2;
  editor.updatePlaytest(0.2);

  assert.equal(editor.raceInput.lookIntentX, 0);
  assert.equal(Math.abs(editor.raceInput.lookAngle) < 0.6, true);
  assert.equal(editor.playtestSession.cameraYaw, editor.playtestSession.carYaw);

  gameInput.gamepadConnected = true;
  editor.updatePlaytest(0.2);

  assert.equal(editor.raceInput.lookIntentX > 0.9, true);
  assert.equal(editor.raceInput.lookAngle > 0.5, true);
});

test('Race Editor pause menu navigates to car settings and adjusts values with controller directions', () => {
  const gameInput = {
    gamepadActions: {},
    gamepadPressed: new Set(),
    gamepadConnected: true
  };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    exitRaceEditor() {}
  });
  const idleInput = {
    isDown: () => false,
    isDownCode: () => false,
    wasPressed: () => false,
    wasPressedCode: () => false,
    gamepadConnected: true
  };

  editor.startPlaytest('starter-rwd');
  editor.toggleRacePause();
  gameInput.gamepadPressed = new Set(['dpadDown']);
  editor.updateRaceKeyboardInput(idleInput);
  assert.equal(editor.raceInput.pauseMenuIndex, 1);

  gameInput.gamepadPressed = new Set(['gamepadA']);
  editor.updateRaceKeyboardInput(idleInput);
  assert.equal(editor.raceInput.pauseMenuMode, 'settings');
  assert.equal(editor.raceInput.pauseMenuIndex, 0);

  const beforeAbs = editor.raceInput.absEnabled;
  gameInput.gamepadPressed = new Set(['dpadRight']);
  editor.updateRaceKeyboardInput(idleInput);
  assert.equal(editor.raceInput.absEnabled, !beforeAbs);

  gameInput.gamepadPressed = new Set(['gamepadB']);
  editor.updateRaceKeyboardInput(idleInput);
  assert.equal(editor.raceInput.pauseMenuMode, 'main');
});

test('Race Editor WeatherTech WRX physics stay within stock acceleration and braking sanity bounds', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  editor.handleMenuAction('load-weathertech-raceway');
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.raceInput.activeThrottlePointerId = 'go';
  for (let frame = 0; frame < 8 * 60; frame += 1) editor.updatePlaytest(1 / 60);
  const mphAfterEight = editor.playtestSession.speedMps * 2.23694;

  assert.equal(editor.selectedRace.id, 'weathertech-raceway');
  assert.equal(mphAfterEight > 62, true);
  assert.equal(mphAfterEight < 92, true);

  editor.raceInput.activeThrottlePointerId = null;
  editor.raceInput.activeBrakePointerId = 'brake';
  const startSpeed = editor.playtestSession.speedMps;
  for (let frame = 0; frame < 2 * 60; frame += 1) editor.updatePlaytest(1 / 60);

  assert.equal(editor.playtestSession.speedMps < startSpeed - 8, true);
  assert.equal(editor.playtestSession.tireSlip.brakeLock < 0.9, true);
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

  assert.equal(Math.abs(editor.playtestSession.tireSlip.frontTireAngle - expectedTireAngle) < 0.003, true);
  assert.equal(Math.abs(editor.playtestSession.steeringWheelRotation - expectedWheelRotation) < 0.04, true);
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

test('Race Editor maps plugged-in gamepad buttons to race-specific controls', () => {
  const gameInput = {
    gamepadActions: { dpadRight: true, gamepadA: true },
    gamepadPressed: new Set(['gamepadB'])
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

  assert.equal(editor.raceInput.keyboardThrottle, false);
  assert.equal(editor.raceInput.keyboardBrake, false);
  assert.equal(editor.raceInput.handbrake, true);
  assert.equal(editor.raceInput.binarySteer, 1);
  assert.equal(editor.raceInput.gear, 2);

  editor.playtestSession.shiftCooldownMs = 0;
  gameInput.gamepadActions = { dpadLeft: true, gamepadA: false };
  gameInput.gamepadPressed = new Set(['gamepadX', 'gamepadSelect', 'gamepadStart']);
  editor.updateRaceKeyboardInput({
    isDown: () => false,
    isDownCode: () => false,
    wasPressed: () => false,
    wasPressedCode: () => false
  });
  assert.equal(editor.raceInput.binarySteer, -1);
  assert.equal(editor.raceInput.handbrake, false);
  assert.equal(editor.raceInput.gear, 1);
  assert.equal(editor.raceInput.cameraView, 'first-person');
  assert.equal(editor.raceInput.paused, true);
});

test('Race Editor clears held gamepad handbrake on A release', () => {
  const gameInput = {
    gamepadConnected: true,
    gamepadActions: { gamepadA: true },
    gamepadPressed: new Set()
  };
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: gameInput,
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  const idleInput = {
    gamepadConnected: true,
    isDown: () => false,
    isDownCode: () => false,
    wasPressed: () => false,
    wasPressedCode: () => false
  };
  editor.updateRaceKeyboardInput(idleInput);
  assert.equal(editor.raceInput.handbrake, true);

  gameInput.gamepadActions = { gamepadA: false, gamepadB: false, gamepadX: false, gamepadY: false };
  editor.updateRaceKeyboardInput(idleInput);
  assert.equal(editor.raceInput.handbrake, false);
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
  seedLongStraightRace(manual);
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
  assert.equal(manualRun.maxMph >= 118, true);
  assert.equal(manualRun.maxMph <= 137, true);

  const automatic = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  seedLongStraightRace(automatic);
  automatic.startPlaytest('starter-rwd');

  assert.equal(automatic.selectedCar.name, '2022 Subaru WRX');
  assert.equal(automatic.playtestSession.transmissionType, 'automatic');
  assert.equal(automatic.raceInput.autoShift, true);
  assert.equal(automatic.raceInput.gear, 1);

  const automaticRun = simulateRaceAcceleration(automatic);
  assert.equal(automaticRun.zeroToSixty >= 5, true);
  assert.equal(automaticRun.zeroToSixty <= 6.3, true);
  assert.equal(automaticRun.maxMph >= 117, true);
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
  editor.raceInput.activeThrottlePointerId = 'go';
  editor.applyRaceDamage('tires', 80, { keys: ['fl', 'rl'] });
  editor.updatePlaytest(0.1);

  assert.equal(editor.playtestSession.tireSlip.left > editor.playtestSession.tireSlip.right, true);
  assert.equal(Math.abs(editor.playtestSession.tireSlip.pull) > 0, true);
  assert.equal(Math.abs(editor.playtestSession.carYaw) > 0, true);
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

test('Race Editor playtest samples per-wheel contact height for suspension travel and body roll', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });

  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 16;
  const tuning = editor.getRaceCarTuning(editor.selectedCar);
  const wheelContactState = {
    averageHeightM: 0.25,
    terrainRollRad: 0.12,
    terrainPitchRad: -0.08,
    heights: {
      fl: 0.6,
      fr: 0,
      rl: 0.55,
      rr: -0.05
    }
  };

  editor.updateRaceVerticalAndRollState({
    seconds: 0.1,
    tuning,
    roadPose: { elevation: 0 },
    previousRoadPose: { elevation: 0 },
    lateralAcceleration: 0,
    wheelContactState
  });

  assert.equal(Math.abs(editor.playtestSession.rollRad) > 0, true);
  assert.equal(editor.playtestSession.pitchRad < 0, true);
  assert.equal(editor.playtestSession.suspensionTravel.fl >= 0, true);
  assert.equal(editor.playtestSession.suspensionTravel.rr >= 0, true);
  assert.equal(raceEditorSource.includes('getRaceWheelContactState'), true);
});

test('Race Editor includes BRZ and Civic test cars with runtime transmission toggles', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  const carIds = editor.project.cars.map((car) => car.id);
  assert.deepEqual(carIds, ['starter-rwd', 'subaru-brz-2022', 'honda-civic-type-r-2023']);

  const brz = editor.project.cars.find((car) => car.id === 'subaru-brz-2022');
  const civic = editor.project.cars.find((car) => car.id === 'honda-civic-type-r-2023');
  assert.equal(brz.tuning.powerHp, 228);
  assert.equal(brz.tuning.torqueLbFt, 184);
  assert.equal(brz.tuning.drivetrain, 'rwd');
  assert.equal(civic.tuning.powerHp, 315);
  assert.equal(civic.tuning.torqueLbFt, 310);
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
  assert.equal(editor.getRaceTireSetupGripMultiplier(editor.selectedCar, 'dirt', 'clear') > 0.8, true);
  assert.equal(editor.getRaceTireSetupGripMultiplier(editor.selectedCar, 'gravel', 'clear') > 0.78, true);
  assert.equal(editor.getRaceTireSetupGripMultiplier(editor.selectedCar, 'snow', 'snow') < editor.getRaceTireSetupGripMultiplier(editor.selectedCar, 'gravel', 'clear'), true);
});

test('Race Editor braking remains surface limited without making dirt and gravel feel like ice', () => {
  const asphalt = simulateRaceBrakingDistance(new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }), {
    surface: 'asphalt'
  });
  const dirt = simulateRaceBrakingDistance(new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }), {
    surface: 'dirt'
  });
  const gravel = simulateRaceBrakingDistance(new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }), {
    surface: 'gravel'
  });
  const snow = simulateRaceBrakingDistance(new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }), {
    surface: 'snow',
    weather: 'snow'
  });

  assert.equal(asphalt > 20 && asphalt < 80, true);
  assert.equal(dirt > asphalt, true);
  assert.equal(gravel > asphalt, true);
  assert.equal(dirt < asphalt * 1.85, true);
  assert.equal(gravel < asphalt * 2.05, true);
  assert.equal(snow > dirt * 1.25, true);
});

test('Race Editor side hazards only damage panels on actual side contact and log the source', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.hazards = [
    { id: 'right-wall', type: 'damage-wall', at: 10, side: 'right', damage: 40 }
  ];
  editor.selectedRace.road.segments = [
    { length: 200, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: ['right-wall'] }
  ];
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = 12;
  editor.playtestSession.previousDistance = 0;
  editor.playtestSession.distance = 11;
  editor.playtestSession.lateral = 0;
  editor.updateRaceWearAndDamage(1 / 60);
  assert.equal(editor.getRaceSessionDamage().panels.right, 0);

  const contact = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  contact.selectedRace.hazards = [
    { id: 'right-wall', type: 'damage-wall', at: 10, side: 'right', damage: 40 }
  ];
  contact.selectedRace.road.segments = [
    { length: 200, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: ['right-wall'] }
  ];
  contact.startPlaytest('starter-rwd');
  contact.playtestSession.launchLockMs = 0;
  contact.playtestSession.elapsedMs = 1000;
  contact.playtestSession.speedMps = 12;
  contact.playtestSession.previousDistance = 0;
  contact.playtestSession.distance = 11;
  contact.playtestSession.lateral = 1;
  contact.updateRaceWearAndDamage(1 / 60);
  assert.equal(contact.getRaceSessionDamage().panels.right, 40);
  assert.equal(contact.playtestSession.damageLog.some((entry) => entry.source === 'hazard:right-wall'), true);
});

test('Race Editor solid track edge reflects velocity and damps runaway wall spins', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.margin = { enabled: true, widthM: 0.5, collisionMode: 'margin' };
  editor.selectedRace.road.segments = [
    { length: 200, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 8, hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');
  const pose = editor.getRaceWorldPoseAtDistance(35);
  const right = editor.getRaceRightVector(pose.yaw);
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.distance = 35;
  editor.playtestSession.previousDistance = 34.5;
  editor.playtestSession.worldX = pose.x + right.x * 12;
  editor.playtestSession.worldZ = pose.z + right.z * 12;
  editor.playtestSession.velocityYaw = Math.PI / 2;
  editor.playtestSession.carYaw = Math.PI / 2;
  editor.playtestSession.speedMps = 24;
  editor.playtestSession.yawVelocityRadps = 3.4;

  editor.updatePlaytest(1 / 30);

  assert.equal(editor.playtestSession.speedMps < 24, true);
  assert.equal(Math.abs(editor.playtestSession.yawVelocityRadps) < 3.4, true);
  assert.equal(editor.playtestSession.damageLog.some((entry) => entry.source === 'edge:margin'), true);
  const projection = editor.getRaceRouteProjectionForWorldPoint({
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ
  });
  assert.equal(Math.abs(projection.lateral) < 7, true);
});

test('Race Editor edge collision separates margin, shoulder, and reset effects', () => {
  const makeEditor = ({ collisionEdge = 'margin', collisionEffect = 'collide' } = {}) => {
    const editor = new RaceEditor({
      deviceIsMobile: true,
      isMobile: true,
      input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
      exitRaceEditor() {}
    });
    editor.selectedRace.margin = {
      enabled: true,
      marginMode: 'on',
      widthM: 0.5,
      shoulderEnabled: true,
      shoulderMode: 'hidden',
      shoulderWidthM: 24,
      collisionEdge,
      collisionMode: collisionEdge,
      collisionEffect
    };
    editor.selectedRace.road.segments = [
      { length: 200, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 8, hazardIds: [] }
    ];
    editor.startPlaytest('starter-rwd');
    const pose = editor.getRaceWorldPoseAtDistance(35);
    const right = editor.getRaceRightVector(pose.yaw);
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    editor.playtestSession.distance = 35;
    editor.playtestSession.previousDistance = 34.5;
    editor.playtestSession.worldX = pose.x + right.x * 8;
    editor.playtestSession.worldZ = pose.z + right.z * 8;
    editor.playtestSession.velocityYaw = Math.PI / 2;
    editor.playtestSession.carYaw = Math.PI / 2;
    editor.playtestSession.speedMps = 16;
    return editor;
  };
  const marginEdge = makeEditor({ collisionEdge: 'margin' });
  const shoulderEdge = makeEditor({ collisionEdge: 'shoulder' });
  const resetEdge = makeEditor({ collisionEdge: 'margin', collisionEffect: 'reset' });

  marginEdge.updatePlaytest(1 / 30);
  shoulderEdge.updatePlaytest(1 / 30);
  resetEdge.updatePlaytest(1 / 30);

  assert.equal(marginEdge.getRaceCollisionShoulderWidthWorld(marginEdge.selectedRace.road.segments[0], 'shoulder') > 20, true);
  assert.equal(marginEdge.isRaceShoulderVisible(), false);
  assert.equal((marginEdge.playtestSession.damageLog || []).some((entry) => entry.source === 'edge:margin'), true);
  assert.equal((shoulderEdge.playtestSession.damageLog || []).some((entry) => String(entry.source || '').startsWith('edge:')), false);
  assert.equal((resetEdge.playtestSession.damageLog || []).some((entry) => String(entry.source || '').startsWith('edge:')), false);
  assert.equal(Math.abs(resetEdge.playtestSession.speedMps) > 1, true);
  assert.equal(resetEdge.playtestSession.edgeResetFadeMs > 0, true);
  assert.ok(resetEdge.playtestSession.pendingEdgeCenterReset);
  const beforeFadeResetProjection = resetEdge.getRaceRouteProjectionForWorldPoint({
    x: resetEdge.playtestSession.worldX,
    z: resetEdge.playtestSession.worldZ
  });
  assert.equal(Math.abs(beforeFadeResetProjection.lateral) > 1, true);

  for (let frame = 0; frame < 30; frame += 1) resetEdge.updatePlaytest(1 / 60);
  assert.equal(resetEdge.playtestSession.pendingEdgeCenterReset.moved, false);
  assert.equal(Math.abs(resetEdge.playtestSession.speedMps) > 1, true);

  for (let frame = 0; frame < 10; frame += 1) resetEdge.updatePlaytest(1 / 60);

  const resetProjection = resetEdge.getRaceRouteProjectionForWorldPoint({
    x: resetEdge.playtestSession.worldX,
    z: resetEdge.playtestSession.worldZ
  });
  assert.equal(Math.abs(resetProjection.lateral) < 1, true);
  assert.equal(Math.abs(resetEdge.playtestSession.speedMps) > 1, true);
});

test('Race Editor solid track edge collides from car footprint, not center only', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { gamepadAxes: { leftX: 0, leftTrigger: 0, rightTrigger: 0 } },
    exitRaceEditor() {}
  });
  editor.selectedRace.margin = { enabled: true, widthM: 0.5, collisionMode: 'margin' };
  editor.selectedRace.road.segments = [
    { length: 200, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 8, hazardIds: [] }
  ];
  editor.startPlaytest('starter-rwd');
  const pose = editor.getRaceWorldPoseAtDistance(35);
  const right = editor.getRaceRightVector(pose.yaw);
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.distance = 35;
  editor.playtestSession.previousDistance = 34.5;
  editor.playtestSession.worldX = pose.x + right.x * 3.9;
  editor.playtestSession.worldZ = pose.z + right.z * 3.9;
  editor.playtestSession.velocityYaw = Math.PI / 2;
  editor.playtestSession.carYaw = 0;
  editor.playtestSession.speedMps = 12;

  const before = editor.getRaceRouteProjectionForWorldPoint({
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ
  });
  assert.equal(Math.abs(before.lateral) < 4.5, true);
  assert.equal(editor.getRaceVehicleCollisionContactPoints().some((point) => (
    Math.abs(editor.getRaceRouteProjectionForWorldPoint(point).lateral) > 4.5
  )), true);

  editor.updatePlaytest(1 / 30);

  assert.equal(editor.playtestSession.damageLog.some((entry) => entry.source === 'edge:margin'), true);
  assert.equal(Math.abs(editor.playtestSession.yawVelocityRadps) < 2.4, true);
});

test('Race Editor flat procedural car renders front wheels with physics steering sign', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  const wheelYaws = [];
  editor.projectRaceWorldPointToCamera = (point) => ({ ...point, visible: true, screenX: point.x, screenY: point.z, depth: 1 });
  editor.drawRaceProjectedVehicleQuad = () => true;
  const originalWheelPoints = editor.getRaceProjectedWheelFootprintPoints.bind(editor);
  editor.getRaceProjectedWheelFootprintPoints = (center, yaw, options) => {
    wheelYaws.push(yaw);
    return originalWheelPoints(center, yaw, options);
  };

  editor.drawRaceProjectedProceduralCar(ctx, { x: 0, y: 0, w: 240, h: 160 }, {
    x: 0,
    z: 0,
    yaw: 1,
    camera: { x: 0, z: -10, elevation: 1, horizonY: 80, scale: 1, nearPlane: 0.1 },
    cameraYaw: 0,
    frontTireAngle: 0.25
  });

  assert.equal(Math.abs(wheelYaws[0] - 0.75) < 0.0001, true);
  assert.equal(Math.abs(wheelYaws[1] - 0.75) < 0.0001, true);
  assert.equal(Math.abs(wheelYaws[2] - 1) < 0.0001, true);
  assert.equal(Math.abs(wheelYaws[3] - 1) < 0.0001, true);
});

test('Race Editor hides diagnostics from menus while keeping them callable for unit tests', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const menuIds = ['file', 'edit', 'view', 'track', 'ground', 'sprites', 'settings']
    .flatMap((rootId) => editor.getMenuItems(rootId).map((item) => item.id));

  [
    'test-drive',
    'diagnostic-skidpad',
    'diagnostic-acceleration',
    'diagnostic-braking',
    'diagnostic-quarter-mile',
    'diagnostic-slalom',
    'diagnostic-jump',
    'ai-fill-grid',
    'diagnostic-ai-laps',
    'ghost-compare'
  ].forEach((id) => assert.equal(menuIds.includes(id), false, id));

  editor.handleMenuAction('diagnostic-skidpad');
  assert.equal(editor.playtestPickerOpen, true);
  assert.equal(editor.selectedRace.id, 'diagnostic-skidpad');
});

test('Race Editor diagnostic actions create test tracks and initialize playtest telemetry', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });

  editor.handleMenuAction('diagnostic-quarter-mile');
  assert.equal(editor.playtestPickerOpen, true);
  assert.equal(editor.selectedRace.id, 'diagnostic-quarter-mile');
  assert.equal(editor.selectedRace.road.segments[0].length, 402.336);

  editor.startPlaytest('starter-rwd');
  assert.equal(editor.playtestSession.diagnosticMode, 'quarter-mile');
  assert.equal(editor.playtestSession.diagnostics.mode, 'quarter-mile');
  assert.equal(editor.pendingDiagnosticMode, null);
});

test('Race Editor diagnostic telemetry records acceleration, braking, quarter mile, slalom, tire load, suspension, jump, and ghost delta', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.handleMenuAction('diagnostic-slalom');
  editor.startPlaytest('starter-rwd');
  const session = editor.playtestSession;
  session.elapsedMs = 6100;
  session.distance = 430;
  session.speedMps = 62 * 0.44704;
  session.activeGhost = {
    samples: [
      { distance: 200, elapsedMs: 4000 },
      { distance: 430, elapsedMs: 6500 }
    ]
  };
  editor.updateRaceDiagnostics(1 / 60, {
    tuning: editor.getRaceCarTuning(),
    brake: 0,
    lateralAcceleration: 8.4,
    dynamicNormalLoads: { fl: 3900, fr: 4700, rl: 3100, rr: 3600 },
    initialNormalLoads: { fl: 3600, fr: 3600, rl: 3000, rr: 3000 },
    tireSlipByWheel: { fl: 0.25, fr: 0.18, rl: 0.12, rr: 0.1 }
  });

  assert.equal(session.diagnostics.zeroToSixtyMs, 6100);
  assert.equal(session.diagnostics.quarterMileMs, 6100);
  assert.equal(session.diagnostics.nextSlalomGate >= 4, true);
  assert.equal(session.diagnostics.peakLateralG > 0.8, true);
  assert.equal(session.diagnostics.tireTemperature.fl > 70, true);
  assert.equal(session.diagnostics.tireLoad.fr > 1, true);
  assert.equal(session.diagnostics.suspensionTravel.fr > 0, true);
  assert.equal(session.diagnostics.ghostDeltaMs, -400);

  session.elapsedMs = 8200;
  session.speedMps = 0.2;
  editor.updateRaceDiagnostics(1 / 60, {
    brake: 1,
    lateralAcceleration: 0,
    dynamicNormalLoads: { fl: 3600, fr: 3600, rl: 3000, rr: 3000 },
    initialNormalLoads: { fl: 3600, fr: 3600, rl: 3000, rr: 3000 },
    tireSlipByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 }
  });
  assert.equal(session.diagnostics.sixtyToZeroMs > 0, true);

  session.airborne = true;
  session.heightM = 3;
  editor.updateRaceDiagnostics(0.5, {});
  session.airborne = false;
  session.verticalVelocityMps = -4.5;
  editor.updateRaceDiagnostics(1 / 60, {});
  assert.equal(session.diagnostics.jump.airtimeMs >= 500, true);
  assert.equal(session.diagnostics.jump.maxHeightM >= 3, true);
  assert.equal(session.diagnostics.jump.stable, true);
});

test('Race tire FX emits terrain-specific particles from slipping wheels', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('subaru-brz-2022');
  editor.selectedRace.tireFx = {
    dirtDust: {
      enabled: true,
      artRef: 'Dust Art',
      color: 'rgba(155,116,72,0.68)',
      density: 3,
      lifetimeMs: 800,
      scale: 1.4
    }
  };

  editor.emitRaceTireFxParticles(1, {
    speedMps: 28,
    tireSlipByWheel: { fl: 0, fr: 0, rl: 0.85, rr: 0.9 },
    brakeState: { lockByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 } },
    wheelSurfaceState: {
      positions: {
        rl: { x: -0.8, z: 8, elevation: 0 },
        rr: { x: 0.8, z: 8, elevation: 0 }
      },
      surfaceByWheel: { rl: 'dirt', rr: 'dirt' },
      terrainByWheel: { rl: 'off-road', rr: 'off-road' }
    }
  });

  assert.equal(editor.playtestSession.tireFxParticles.length > 0, true);
  assert.equal(editor.playtestSession.tireFxParticles.every((particle) => particle.slotId === 'dirtDust'), true);
  assert.equal(editor.playtestSession.tireFxParticles.some((particle) => particle.artRef === 'Dust Art'), true);

  const ctx = createMockContext();
  editor.getRaceArtSpriteCanvas = () => ({ width: 8, height: 8 });
  editor.drawRaceTireFxParticles(ctx, { x: 0, y: 0, w: 390, h: 240 }, {
    camera: {
      x: 0,
      z: 0,
      elevation: 0.1,
      nearPlane: 1.2,
      focalScale: 1,
      roadWidthScale: 1,
      horizonRatio: 0.42
    },
    cameraYaw: 0
  });

  assert.equal(ctx.calls.some((call) => call.type === 'drawImage'), true);
});

test('Race tire FX keeps asphalt cornering to marks instead of smoke', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('subaru-brz-2022');
  editor.selectedRace.tireFx = {
    asphaltSkid: { enabled: true, density: 3, lifetimeMs: 900, scale: 1 },
    skidSmoke: { enabled: true, density: 3, lifetimeMs: 900, scale: 1 }
  };

  editor.emitRaceTireFxParticles(1, {
    speedMps: 30,
    wheelSpin: 0.1,
    tireSlipByWheel: { fl: 0.7, fr: 0.72, rl: 0.66, rr: 0.68 },
    brakeState: { lockByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 } },
    wheelSurfaceState: {
      positions: {
        fl: { x: -0.8, z: 9, elevation: 0 },
        fr: { x: 0.8, z: 9, elevation: 0 },
        rl: { x: -0.8, z: 8, elevation: 0 },
        rr: { x: 0.8, z: 8, elevation: 0 }
      },
      surfaceByWheel: { fl: 'asphalt', fr: 'asphalt', rl: 'asphalt', rr: 'asphalt' },
      terrainByWheel: { fl: 'road', fr: 'road', rl: 'road', rr: 'road' }
    }
  });

  assert.equal(editor.playtestSession.tireFxParticles.length > 0, true);
  assert.equal(editor.playtestSession.tireFxParticles.every((particle) => particle.slotId === 'asphaltSkid'), true);
});

test('Race tire FX emits asphalt smoke for burnout wheelspin', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('subaru-brz-2022');
  editor.selectedRace.tireFx = {
    skidSmoke: { enabled: true, density: 3, lifetimeMs: 900, scale: 1 }
  };

  editor.emitRaceTireFxParticles(1, {
    speedMps: 12,
    wheelSpin: 1.1,
    tireSlipByWheel: { rl: 0.35, rr: 0.36 },
    brakeState: { lockByWheel: { rl: 0, rr: 0 } },
    wheelSurfaceState: {
      positions: {
        rl: { x: -0.8, z: 8, elevation: 0 },
        rr: { x: 0.8, z: 8, elevation: 0 }
      },
      surfaceByWheel: { rl: 'asphalt', rr: 'asphalt' },
      terrainByWheel: { rl: 'road', rr: 'road' }
    }
  });

  assert.equal(editor.playtestSession.tireFxParticles.length > 0, true);
  assert.equal(editor.playtestSession.tireFxParticles.every((particle) => particle.slotId === 'skidSmoke'), true);
});

test('Race tire FX emits dirt dust from speed without a hard slide', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('subaru-brz-2022');
  editor.selectedRace.tireFx = {
    dirtDust: { enabled: true, density: 3, lifetimeMs: 900, scale: 1 }
  };

  editor.emitRaceTireFxParticles(1, {
    speedMps: 18,
    wheelSpin: 0,
    tireSlipByWheel: { rl: 0.05, rr: 0.06 },
    brakeState: { lockByWheel: { rl: 0, rr: 0 } },
    wheelSurfaceState: {
      positions: {
        rl: { x: -0.8, z: 8, elevation: 0 },
        rr: { x: 0.8, z: 8, elevation: 0 }
      },
      surfaceByWheel: { rl: 'dirt', rr: 'dirt' },
      terrainByWheel: { rl: 'road', rr: 'road' }
    }
  });

  assert.equal(editor.playtestSession.tireFxParticles.length > 0, true);
  assert.equal(editor.playtestSession.tireFxParticles.every((particle) => particle.slotId === 'dirtDust'), true);

  editor.playtestSession.tireFxParticles = [];
  editor.emitRaceTireFxParticles(1, {
    speedMps: 2,
    tireSlipByWheel: { rl: 0.04, rr: 0.04 },
    brakeState: { lockByWheel: { rl: 0, rr: 0 } },
    wheelSurfaceState: {
      positions: {
        rl: { x: -0.8, z: 8, elevation: 0 },
        rr: { x: 0.8, z: 8, elevation: 0 }
      },
      surfaceByWheel: { rl: 'dirt', rr: 'dirt' },
      terrainByWheel: { rl: 'road', rr: 'road' }
    }
  });

  assert.equal(editor.playtestSession.tireFxParticles.length, 0);
});

test('Race tire FX emits grey gravel smoke separately from dirt dust', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('subaru-brz-2022');
  editor.selectedRace.tireFx = {
    gravelDust: {
      enabled: true,
      artRef: 'Gravel Smoke Art',
      color: 'rgba(176,178,172,0.62)',
      density: 3,
      lifetimeMs: 900,
      scale: 1
    },
    dirtDust: { enabled: true, density: 3, lifetimeMs: 900, scale: 1 }
  };

  editor.emitRaceTireFxParticles(1, {
    speedMps: 18,
    wheelSpin: 0,
    tireSlipByWheel: { rl: 0.05, rr: 0.06 },
    brakeState: { lockByWheel: { rl: 0, rr: 0 } },
    wheelSurfaceState: {
      positions: {
        rl: { x: -0.8, z: 8, elevation: 0 },
        rr: { x: 0.8, z: 8, elevation: 0 }
      },
      surfaceByWheel: { rl: 'gravel', rr: 'wet-gravel' },
      terrainByWheel: { rl: 'road', rr: 'road' }
    }
  });

  assert.equal(editor.playtestSession.tireFxParticles.length > 0, true);
  assert.equal(editor.playtestSession.tireFxParticles.every((particle) => particle.slotId === 'gravelDust'), true);
  assert.equal(editor.playtestSession.tireFxParticles.some((particle) => particle.artRef === 'Gravel Smoke Art'), true);
});

test('Race Editor AI grid creates 11 racers and runtime advances with expert manual behavior', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.fillRaceAiGrid();

  assert.equal(editor.selectedRace.competition.aiDrivers.length, 11);
  assert.deepEqual(new Set(editor.selectedRace.competition.aiDrivers.map((driver) => driver.difficulty)), new Set(['easy', 'medium', 'hard', 'expert']));

  editor.startPlaytest('starter-rwd');
  assert.equal(editor.playtestSession.aiRuntime.length, 11);
  assert.equal(editor.playtestSession.aiRuntime.some((ai) => ai.difficulty === 'expert' && ai.shiftMode === 'manual'), true);
  const before = editor.playtestSession.aiRuntime.map((ai) => ai.distance);
  for (let index = 0; index < 120; index += 1) editor.updateRaceAiDrivers(1 / 60);
  assert.equal(editor.playtestSession.aiRuntime.some((ai, index) => ai.distance > before[index]), true);
  assert.equal(editor.playtestSession.diagnostics.aiConsistency.length, 0);
  editor.updateRaceDiagnostics(1 / 60, {});
  assert.equal(editor.playtestSession.diagnostics.aiConsistency.length, 11);
});

test('Race Editor ghost recording stores best finished run and computes comparison deltas', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.distance = 20;
  editor.recordRaceGhostSample();
  editor.playtestSession.elapsedMs = 2200;
  editor.playtestSession.distance = 80;
  editor.recordRaceGhostSample();
  editor.completeRaceGhost({ finished: true });

  const ghost = editor.bestRaceGhosts[editor.playtestSession.raceId];
  assert.ok(ghost);
  assert.equal(ghost.samples.length >= 2, true);
  assert.equal(editor.getRaceGhostDeltaMs(ghost, 80, 2600), 400);
});

test('Race Editor renders placed Pixel Editor artwork as vertical race sprites instead of fallback trees', () => {
  const previousDocument = globalThis.document;
  const imageWrites = [];
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            createImageData(width, height) {
              return { data: new Uint8ClampedArray(width * height * 4) };
            },
            putImageData(imageData, x, y) {
              imageWrites.push({ imageData, x, y });
            },
            fillRect() {}
          };
        }
      };
    }
  };

  try {
    clearCachedProjectFilesForTests();
    upsertCachedProjectFile('art', 'Race Billboard', JSON.stringify({
      version: 1,
      folder: 'art',
      name: 'Race Billboard',
      savedAt: 1234,
      data: {
        kind: 'pixel-art',
        width: 2,
        height: 2,
        frames: [
          ['#ff0000', '', 0, '#00ff00']
        ]
      }
    }));

    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    const canvas = editor.getRaceArtSpriteCanvas('Race Billboard');

    assert.ok(canvas);
    assert.equal(canvas.width, 2);
    assert.equal(canvas.height, 2);
    assert.equal(imageWrites.length, 1);
    assert.deepEqual(Array.from(imageWrites[0].imageData.data.slice(0, 4)), [255, 0, 0, 255]);
    assert.deepEqual(Array.from(imageWrites[0].imageData.data.slice(4, 8)), [0, 0, 0, 0]);
    assert.deepEqual(Array.from(imageWrites[0].imageData.data.slice(12, 16)), [0, 255, 0, 255]);
  } finally {
    globalThis.document = previousDocument;
    clearCachedProjectFilesForTests();
  }
});

test('Race Editor sprite definitions are configured from Settings and painted or erased from Sprites', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.draw(createMockContext(), 390, 844);
  editor.selectedRace.sceneryDefinitions = [{
    id: 'tree-def',
    artRef: 'Tree Art',
    label: 'Tree Art',
    widthM: 2,
    heightM: 7,
    behavior: 'indestructible',
    weightKg: 900
  }];
  editor.selectedSceneryDefinitionIndex = 0;
  editor.setRacePortraitMode('sprites');
  editor.draw(createMockContext(), 390, 844);

  assert.ok(editor.buttons.some((button) => button.id === 'sprite-select'));
  assert.ok(editor.buttons.some((button) => button.id === 'paint-sprite'));
  assert.ok(editor.buttons.some((button) => button.id === 'erase-sprite'));
  assert.equal(editor.buttons.some((button) => button.id === 'add-sprite'), false);

  const before = editor.selectedRace.scenery.length;
  editor.handlePointerDown({
    id: 'paint-sprite',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.54,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.48,
    button: 0
  });
  assert.equal(editor.selectedRace.scenery.length, before + 1);
  assert.equal(editor.selectedRace.scenery.at(-1).definitionId, 'tree-def');
  assert.equal(editor.selectedRace.scenery.at(-1).widthM, 2);
  assert.equal(editor.selectedRace.scenery.at(-1).heightM, 7);

  editor.handleMenuAction('sprite-size');
  editor.handleMenuAction('sprite-height');
  editor.handleMenuAction('sprite-behavior');
  assert.equal(editor.selectedRace.sceneryDefinitions[0].widthM > 2, true);
  assert.equal(editor.selectedRace.sceneryDefinitions[0].heightM > 7, true);
  assert.notEqual(editor.selectedRace.sceneryDefinitions[0].behavior, 'indestructible');

  editor.handleMenuAction('erase-sprite');
  const spriteScreen = editor.raceMapWorldToScreenPoint({
    x: editor.selectedRace.scenery[0].x,
    y: editor.selectedRace.scenery[0].z
  }, editor.raceMapBounds);
  editor.handlePointerDown({
    id: 'erase-sprite',
    x: spriteScreen.screenX,
    y: spriteScreen.screenY,
    button: 0
  });
  assert.equal(editor.selectedRace.scenery.length, before);
});

test('Race Editor decals are painted on the map and rendered in playtest from project art', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.draw(createMockContext(), 390, 844);
  editor.selectedRaceDecalArtRef = 'Skid Mark';
  editor.handleMenuAction('paint-decal');
  editor.handlePointerDown({
    id: 'paint-decal',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.52,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.52,
    button: 0
  });

  assert.equal(editor.selectedRace.decals.length, 1);
  assert.equal(editor.selectedRace.decals[0].artRef, 'Skid Mark');
  assert.equal(editor.selectedRace.decals[0].kind, 'decal');

  editor.selectedRaceGroundBoxArtRef = 'Grass Ground Box';
  editor.raceGroundBrushCells = 5;
  editor.raceGroundBrushShape = 'round';
  editor.handleMenuAction('paint-tile');
  const decalCountBeforeTilePaint = editor.selectedRace.decals.length;
  editor.handlePointerDown({
    id: 'paint-tile',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.42,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.42,
    button: 0
  });

  assert.equal(editor.selectedRace.decals.length, decalCountBeforeTilePaint);
  assert.equal(Object.values(editor.selectedRace.road.tileMap.cells).filter((cell) => cell.artRef === 'Grass Ground Box').length, 21);
  editor.handlePointerMove({
    id: 'paint-tile',
    x: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.72,
    y: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.72,
    button: 0
  });
  editor.handlePointerUp({ id: 'paint-tile' });
  assert.equal(editor.selectedRace.decals.length, decalCountBeforeTilePaint);
  assert.equal(Object.values(editor.selectedRace.road.tileMap.cells).filter((cell) => cell.artRef === 'Grass Ground Box').length > 21, true);

  const topDownTileIndex = raceEditorSource.indexOf('this.drawRaceTopDownTileMap(ctx, bounds);');
  const topDownRoadIndex = raceEditorSource.indexOf('const baseRoadWidth = Math.max(2, this.getRaceRoadWidthMForSegment');
  const projectedTileIndex = raceEditorSource.indexOf('const mode7Bands = this.getRaceMode7RoadBands(mode7Slices);');
  const projectedRoadIndex = raceEditorSource.indexOf('const effectiveSurfaceId = this.getRaceEffectiveSurfaceId(near.center.segment?.surface');
  assert.equal(topDownTileIndex >= 0 && topDownTileIndex < topDownRoadIndex, true);
  assert.equal(projectedTileIndex >= 0 && projectedTileIndex < projectedRoadIndex, true);

  const calls = [];
  const ctx = createMockContext();
  ctx.drawImage = (...args) => calls.push({ type: 'drawImage', args });
  ctx.clip = () => calls.push({ type: 'clip' });
  editor.getRaceArtSpriteCanvas = () => ({ width: 4, height: 4 });
  editor.projectRaceWorldPointToCamera = (point) => ({
    ...point,
    visible: true,
    screenX: 180 + (Number(point.x || 0) - Number(editor.selectedRace.decals[0].x || 0)) * 4,
    screenY: 180 + (Number(point.z || 0) - Number(editor.selectedRace.decals[0].z || 0)) * 4,
    cameraZ: 12,
    renderZ: 12
  });
  editor.getRaceNearClippedProjectedPolygon = (points) => points;
  editor.drawRaceProjectedDecals(ctx, { x: 0, y: 0, w: 390, h: 240 }, {
    camera: { nearPlane: 1.2 },
    cameraYaw: 0
  });

  assert.equal(calls.some((call) => call.type === 'drawImage'), true);

  const tileScreen = {
    screenX: editor.raceMapBounds.x + editor.raceMapBounds.w * 0.42,
    screenY: editor.raceMapBounds.y + editor.raceMapBounds.h * 0.42
  };
  editor.handleMenuAction('erase-tile');
  editor.handlePointerDown({
    id: 'erase-tile',
    x: tileScreen.screenX,
    y: tileScreen.screenY,
    button: 0
  });
  assert.equal(editor.selectedRace.decals.length, 1);
  assert.equal(editor.selectedRace.decals[0].kind, 'decal');
  assert.equal(Object.values(editor.selectedRace.road.tileMap.cells).filter((cell) => cell.artRef === 'Grass Ground Box').length > 0, true);
});

test('Race Editor projected terrain texture sampler blends pixels and keeps texture hooks wired', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {};
  try {
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    editor.getRaceArtSpriteCanvas = () => ({
      width: 2,
      height: 2,
      getContext() {
        return {
          getImageData() {
            return {
              data: new Uint8ClampedArray([
                0, 0, 0, 255,
                255, 0, 0, 255,
                0, 255, 0, 255,
                0, 0, 255, 255
              ])
            };
          }
        };
      }
    });

    const sampler = editor.getRaceArtTextureSampler('terrain');
    const blended = sampler.sample(0.5, 0.5);

    assert.equal(/^rgba\(\d+, \d+, \d+, 1\)$/.test(blended), true);
    assert.notEqual(blended, 'rgba(0, 0, 0, 1)');
    assert.notEqual(blended, 'rgba(255, 0, 0, 1)');
    assert.equal(Array.isArray(sampler.mipLevels), true);
    assert.equal(sampler.mipLevels.length >= 2, true);
    assert.equal(raceEditorSource.includes('tileWorldM: 2.5'), true);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('Race Editor terrain sampler uses nearest pixels instead of blurry bilinear filtering', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {};
  try {
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    editor.getRaceArtSpriteCanvas = () => ({
      width: 2,
      height: 2,
      getContext() {
        return {
          getImageData() {
            return {
              data: new Uint8ClampedArray([
                0, 0, 0, 255,
                255, 0, 0, 255,
                0, 255, 0, 255,
                0, 0, 255, 255
              ])
            };
          }
        };
      }
    });

    const sampler = editor.getRaceArtTextureSampler('terrain');
    const terrain = sampler.readTerrainColor(0.5, 0.5);
    const raw = sampler.readColor(0.5, 0.5);

    assert.deepEqual(
      [Math.round(terrain.r), Math.round(terrain.g), Math.round(terrain.b), terrain.a],
      [0, 0, 255, 1]
    );
    assert.notDeepEqual(
      [Math.round(raw.r), Math.round(raw.g), Math.round(raw.b), raw.a],
      [0, 0, 255, 1]
    );
  } finally {
    globalThis.document = previousDocument;
  }
});

test('Race Editor keeps large ground art as a cleaned 64px chunk atlas', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {};
  try {
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    const width = 512;
    const height = 512;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const base = (y * width + x) * 4;
        data[base] = (x * 13 + y * 7) % 256;
        data[base + 1] = (x * 5 + y * 19) % 256;
        data[base + 2] = (x * 23 + y * 3) % 256;
        data[base + 3] = 255;
      }
    }
    editor.getRaceArtSpriteCanvas = () => ({
      width,
      height,
      getContext() {
        return {
          getImageData() {
            return { data };
          }
        };
      }
    });

    const sampler = editor.getRaceArtTextureSampler('providenceGround');
    const terrainBase = sampler.terrainMipLevels[0];
    const rawUnique = new Set();
    const cleanUnique = new Set();
    for (let i = 0; i < width * height; i += 4096) {
      const base = i * 4;
      rawUnique.add(`${data[base]},${data[base + 1]},${data[base + 2]}`);
    }
    for (let i = 0; i < terrainBase.width * terrainBase.height; i += 1) {
      const base = i * 4;
      cleanUnique.add(`${terrainBase.data[base]},${terrainBase.data[base + 1]},${terrainBase.data[base + 2]}`);
    }

    assert.equal(terrainBase.width, 512);
    assert.equal(terrainBase.height, 512);
    assert.equal(typeof sampler.terrainAverageSample(0.25, 0.75, 0.2), 'string');
    assert.equal(raceEditorSource.includes('RACE_GROUND_ART_CHUNK_PX = 64'), true);
    assert.equal(cleanUnique.size < width * height, true);
    assert.equal(cleanUnique.size < rawUnique.size * 4096, true);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('Race Editor top-down art tiles are cropped by world texture scale instead of stretched per cell', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  editor.setRaceGroundTexturePixelWorldM(1);
  const calls = [];
  const ctx = {
    imageSmoothingEnabled: true,
    drawImage(...args) {
      calls.push(args);
    }
  };

  const drew = editor.drawRaceWorldSpaceArtTexture(
    ctx,
    { width: 512, height: 512 },
    { x: 64, y: 128, w: 64, h: 64 },
    { x: 10, y: 20, w: 32, h: 32 }
  );

  assert.equal(drew, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(1, 5), [64, 128, 64, 64]);
  assert.deepEqual(calls[0].slice(5), [10, 20, 32, 32]);
  assert.equal(editor.getRaceGroundArtChunkWorldM(), 64);
});

test('Race Editor scales project ground art by 32 pixel chunks instead of squeezing every image into one tile', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {};
  try {
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
    editor.getRaceArtSpriteCanvas = () => ({
      width: 1024,
      height: 512,
      getContext() {
        return {
          getImageData() {
            return {
              data: new Uint8ClampedArray(1024 * 512 * 4).fill(255)
            };
          }
        };
      }
    });

    const sampler = editor.getRaceArtTextureSampler('large-ground');

    assert.equal(sampler.worldWidthM, 32);
    assert.equal(sampler.worldHeightM, 16);

    let sampledU = null;
    let sampledV = null;
    editor.getRaceArtTextureSampler = () => ({
      worldWidthUnits: 32,
      worldHeightUnits: 16,
      readColor(u, v) {
        sampledU = u;
        sampledV = v;
        return { r: 20, g: 30, b: 40, a: 1 };
      }
    });
    editor.setRaceTileMapCell(0, 0, {
      tileId: 'grass',
      tileWeights: { grass: 1 },
      artRef: 'large-ground'
    });
    editor.getRaceProjectedGroundSampleColor({ x: 128, z: 64, cameraZ: 25 }, {
      tileMap: editor.ensureRaceTileMap(),
      fallbackArtRef: 'large-ground',
      samplerCache: new Map()
    });

    assert.equal(sampledU, 4);
    assert.equal(sampledV, 4);

    editor.setRaceGroundTextureBaseWorldM(5);
    editor.getRaceProjectedGroundSampleColor({ x: 80, z: 40, cameraZ: 25 }, {
      tileMap: editor.ensureRaceTileMap(),
      fallbackArtRef: 'large-ground',
      samplerCache: new Map()
    });
    assert.equal(sampledU, 0.5);
    assert.equal(sampledV, 0.5);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('Race Editor bakes terrain chunks and chooses adaptive terrain detail by distance and variance', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const tileMap = editor.ensureRaceTileMap();
  const cache = editor.getRaceTerrainBakeCache(tileMap, 40);
  const chunk = editor.getRaceBakedTerrainChunk(0, 0, 40, tileMap, cache);
  const cachedAgain = editor.getRaceBakedTerrainChunk(0, 0, 40, tileMap, cache);

  assert.ok(chunk);
  assert.equal(cachedAgain, chunk);
  assert.equal(cache.frameGenerated, 1);
  assert.equal(cache.frameHits, 1);
  assert.equal(Array.isArray(chunk.fullPoints), true);
  assert.equal(Number.isFinite(chunk.elevationVariance), true);
  assert.equal(Number.isFinite(chunk.roadDistance), true);

  assert.equal(editor.getRaceBakedTerrainSubdivision(chunk, 40, {
    detailEnabled: false,
    textured: true
  }), 1);

  const nearRoadChunk = {
    nearRoad: true,
    roadDistance: 0,
    elevationVariance: 0.01
  };
  const farFromRoadChunk = {
    nearRoad: false,
    roadDistance: 220,
    elevationVariance: 0.01
  };
  const roughChunk = {
    nearRoad: true,
    roadDistance: 0,
    elevationVariance: 0.11
  };

  assert.equal(editor.getRaceBakedTerrainSubdivision(nearRoadChunk, 40, {
    detailEnabled: true,
    textured: true
  }), 3);
  assert.equal(editor.getRaceBakedTerrainSubdivision(farFromRoadChunk, 40, {
    detailEnabled: true,
    textured: true
  }) < 4, true);
  assert.equal(editor.getRaceBakedTerrainSubdivision(nearRoadChunk, 620, {
    detailEnabled: true,
    textured: true
  }), 3);
  assert.equal(editor.getRaceBakedTerrainSubdivision(roughChunk, 190, {
    detailEnabled: true,
    textured: false
  }), 4);
});

test('Race Editor starts projected terrain at the canonical projection horizon', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };
  const camera = { horizonRatio: 0.31 };
  const projectionHorizon = bounds.y + bounds.h * camera.horizonRatio;
  const terrainTop = editor.getRaceProjectedTerrainTop(bounds, camera);

  assert.equal(terrainTop, Math.floor(projectionHorizon));
  assert.equal(raceEditorSource.includes('h * 0.115'), false);
  assert.equal(raceEditorSource.includes('createImageData(renderWidth, renderHeight)'), true);
  assert.equal(raceEditorSource.includes('ctx.drawImage(canvas, bounds.x, groundTop, bounds.w, groundHeight)'), true);
  assert.equal(raceEditorSource.includes('rowT > 0.5 ? 1 : 2'), false);
  assert.equal(raceEditorSource.includes('getRaceGroundScanlineSettings()'), true);
  assert.equal(raceEditorSource.includes('const renderHeight = clamp(Math.ceil(groundHeight / rowStep)'), true);
  assert.equal(raceEditorSource.includes('cameraAngleDeg / 120'), false);
  assert.equal(raceEditorSource.includes('const horizonRatio = liveHorizonRatio;'), true);
  assert.equal(raceEditorSource.includes('drawRaceWebGLGroundPlane'), true);
  assert.equal(raceEditorSource.includes("this.getRaceGroundRenderer() === 'webgl'"), true);
  assert.equal(raceEditorSource.includes("'webgl-track'"), true);
  assert.equal(raceEditorSource.includes('drawRaceWebGLTrackScene'), true);
  assert.equal(raceEditorSource.includes('drawRaceWebGLWorldMesh'), true);
  assert.equal(raceEditorSource.includes('renderer.meshProgram'), true);
  assert.equal(raceEditorSource.includes('getRaceGroundElevationAtWorldPoint({ x: x0, z: z0 }, 0)'), true);
  assert.equal(raceEditorSource.includes('let drewWebGLTrack = false;'), true);
  assert.equal(raceEditorSource.includes('this.drawRaceParallaxBackground(ctx, bounds, {\n      horizon,'), true);
  assert.equal(raceEditorSource.includes('this.drawRaceParallaxBackground(ctx, bounds, {\n      horizon: terrainTop,'), false);
  assert.equal(raceEditorSource.includes('WebGL Track draws world terrain, shoulders, and road as projected mesh geometry.'), false);
  assert.equal(raceEditorSource.includes('applyRaceWebGLTextureSettings(renderer, {'), true);
  assert.equal(raceEditorSource.includes('if (canMipmap) gl.generateMipmap(gl.TEXTURE_2D);'), true);
  assert.equal(raceEditorSource.includes('gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)'), true);
  assert.equal(raceEditorSource.includes('uDepthTuning'), false);
  assert.equal(raceEditorSource.includes('float z = clamp(nearDepth / pow(perspective, 1.0 / 0.542) - nearDepth, uNearPlane, 560.0);'), true);
  assert.equal(raceEditorSource.includes('fract(-world.y / textureWorld.y)'), true);
  assert.equal(raceEditorSource.includes('const renderHeight = clamp(Math.ceil(groundHeight), 1, 2048);'), true);
  assert.equal(raceEditorSource.includes('if (!drewSkyboxArt) {\n      drawLayer(7'), true);
  assert.equal(raceEditorSource.includes('minScreenY = null'), true);
  assert.equal(raceEditorSource.includes('clipRaceWebGLProjectedPolygonToScreenY'), true);
  assert.equal(raceEditorSource.includes('point.screenY = floorY;'), true);
  assert.equal(raceEditorSource.includes('minScreenY: roadMinScreenY'), true);
  assert.equal(raceEditorSource.includes('const baseDepth = ((Number(point.cameraZ || nearPlane) - nearPlane) / (farPlane - nearPlane)) * 2 - 1;'), true);
  assert.equal(raceEditorSource.includes('return clamp(baseDepth + Number(depthOffset || 0), -1, 1);'), true);
  assert.equal(raceEditorSource.includes('const roadMinScreenY = this.getRaceProjectedTerrainTop(bounds, camera);'), true);
  assert.equal(raceEditorSource.includes('elevationOffset: 0.075'), false);
  assert.equal(raceEditorSource.includes('elevationOffset: 0.055'), false);
  assert.equal(raceEditorSource.includes('getRaceMode7SliceCount(cameraView = \'third-person\', speedMps = 0, bounds = {})'), true);
  assert.equal(raceEditorSource.includes('getRaceMode7RenderSliceCount(cameraView = \'third-person\', speedMps = 0, bounds = {}, renderDebug = this.getRaceRenderDebugSettings())'), true);
  assert.equal(raceEditorSource.includes('sliceCount: this.getRaceMode7RenderSliceCount(cameraView, speedMps, bounds, renderDebug)'), true);
  assert.equal(raceEditorSource.includes("this.getRaceGroundRenderer() === 'webgl-track'"), true);
  assert.equal(raceEditorSource.includes("return Math.min(baseCount, cameraView === 'first-person' ? 44 : 36);"), true);
  assert.equal(raceEditorSource.includes("return Math.min(baseCount, cameraView === 'first-person' ? 40 : 32);"), true);
  assert.equal(raceEditorSource.includes('const baseTileSize = Math.max(1, Number(tileMap?.cellSizeM) || RACE_TILE_MAP_CELL_SIZE_M);'), true);
  assert.equal(raceEditorSource.includes('const centerCoords = this.getRaceTileMapCellCoords({ x: centerX, z: centerZ }, tileMap);'), true);
  assert.equal(raceEditorSource.includes('getRaceTerrainChunkTileCoverage(x0, z0, x1, z1, tileMap, centerTileCell)'), true);
  assert.equal(raceEditorSource.includes('compareRaceTerrainCandidates(a, b, terrainSize)'), true);
  assert.equal(raceEditorSource.includes('const roadFarCameraZ = Math.max('), true);
  assert.equal(raceEditorSource.includes('getRaceTerrainRenderLimits({'), true);
  assert.equal(raceEditorSource.includes('const terrainForwardDistance = clamp(requestedFar + size * 8, 2200, 5200);'), true);
  assert.equal(raceEditorSource.includes('const trackBands = stableRoadBands.length ? stableRoadBands : mode7Bands;'), true);
  assert.equal(raceEditorSource.includes('getRaceTerrainCameraBounds(chunk.fullPoints, camera, rightVector, forwardVector)'), true);
  assert.equal(raceEditorSource.includes('isRaceTerrainCameraBoundsVisible(cameraBounds'), true);
  assert.equal(raceEditorSource.includes('maxTerrainTriangles'), true);
  assert.equal(raceEditorSource.includes('terrainCoverageDropped'), true);
  assert.equal(raceEditorSource.includes('minScreenY: null'), true);
  assert.equal(raceEditorSource.includes('preserveDrawingBuffer: false'), true);
  assert.equal(raceEditorSource.includes('renderer.meshUploadArray = new Float32Array(capacity);'), true);
  assert.equal(raceEditorSource.includes('gl.bufferSubData(gl.ARRAY_BUFFER, 0, renderer.meshUploadArray.subarray(0, requiredFloats));'), true);
  assert.equal(raceEditorSource.includes('getRaceWebGLColorArray(color)'), true);
  assert.equal((raceEditorSource.match(/this\.drawRaceWeatherFx\(ctx, bounds/g) || []).length, 1);
  assert.equal(raceEditorSource.includes('getRaceRenderDebugSettings'), true);
  assert.equal(raceEditorSource.includes('const terrainEnabled = renderDebug.terrainEnabled === true;'), true);
  assert.equal(raceEditorSource.includes('const texturesEnabled = renderDebug.texturesEnabled !== false;'), true);
  assert.equal(raceEditorSource.includes('const detailEnabled = renderDebug.detailEnabled === true;'), true);
  assert.equal(raceEditorSource.includes('const terrainCullingEnabled = renderDebug.terrainCullingEnabled !== false;'), true);
  assert.equal(raceEditorSource.includes('const terrainLodEnabled = renderDebug.terrainLodEnabled !== false;'), true);
  assert.equal(raceEditorSource.includes('const terrainBudgetEnabled = renderDebug.terrainBudgetEnabled !== false;'), true);
  assert.equal(raceEditorSource.includes('const farRoadDecimationEnabled = renderDebug.farRoadDecimationEnabled !== false;'), true);
  assert.equal(raceEditorSource.includes('const threeEnabled = renderDebug.threeEnabled === true;'), true);
  assert.equal(raceEditorSource.includes('const rawTerrainPolygonsEnabled = renderDebug.rawTerrainPolygonsEnabled === true;'), true);
  assert.equal(raceEditorSource.includes('this.drawRaceWebGLTerrainMeshBatch(ctx, bounds, renderer, terrainCells'), true);
  assert.equal(raceEditorSource.includes('rawTerrainPolygons: rawTerrainPolygonsEnabled'), false);
  assert.equal(raceEditorSource.includes('const terrainSize = Math.max(detailEnabled ? 40 : 120, baseTileSize * (detailEnabled ? 8 : 24));'), true);
  assert.equal(raceEditorSource.includes('maxTerrainTriangles'), true);
  assert.equal(raceEditorSource.includes('getRaceTerrainBakeCache(tileMap, terrainSize)'), true);
  assert.equal(raceEditorSource.includes('getRaceBakedTerrainSubdivision(chunk, cameraCellZ'), true);
  assert.equal(raceEditorSource.includes('terrainLod${subdivisions - 1}'), true);
  assert.equal(raceEditorSource.includes('getRaceGroundNearTextureQuality'), true);
  assert.equal(raceEditorSource.includes('applyRaceWebGLTextureSettings'), true);
  assert.equal(raceEditorSource.includes('texture-filter-mode'), true);
  assert.equal(raceEditorSource.includes('getRaceTerrainTextureWorldM(textureWorldM, cell.averageCameraZ)'), false);
  assert.equal(raceEditorSource.includes('getRaceTextureSunTint(points)'), true);
  assert.equal(raceEditorSource.includes('if (terrainEnabled) {'), true);
  assert.equal(raceEditorSource.includes('Preview ${previewFps || \'--\'} FPS'), true);

  const clipped = editor.clipRaceWebGLProjectedPolygonToScreenY([
    { screenX: 0, screenY: 40, clipX: -0.5, clipY: 0.6, x: 0, z: 0, cameraZ: 40 },
    { screenX: 80, screenY: 40, clipX: 0.5, clipY: 0.6, x: 8, z: 0, cameraZ: 40 },
    { screenX: 80, screenY: 120, clipX: 0.5, clipY: -0.4, x: 8, z: 8, cameraZ: 20 },
    { screenX: 0, screenY: 120, clipX: -0.5, clipY: -0.4, x: 0, z: 8, cameraZ: 20 }
  ], 80, { x: 0, y: 0, w: 100, h: 160 });
  assert.equal(clipped.every((point) => point.screenY >= 80), true);
  assert.equal(clipped.some((point) => point.screenY === 80), true);
});

test('Race Editor projected project-art ground renders fixed visible tile cells instead of road-wide strips', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const tileMap = editor.ensureRaceTileMap();
  editor.setRaceTileMapCell(0, 0, {
    tileId: 'grass',
    tileWeights: { grass: 1 },
    artRef: 'providenceGround',
    source: 'project-art'
  });
  editor.setRaceTileMapCell(90, 90, {
    tileId: 'grass',
    tileWeights: { grass: 1 },
    artRef: 'providenceGround',
    source: 'project-art'
  });
  const visible = editor.getRaceVisibleProjectedTileMapCells(
    { x: 0, y: 0, w: 390, h: 240 },
    {
      camera: {
        x: 0,
        z: -40,
        elevation: 0.1,
        nearPlane: 1.4,
        focalScale: 1,
        roadWidthScale: 1,
        roadMaxWidthRatio: 1,
        horizonRatio: 0.48
      },
      cameraYaw: 0
    }
  );

  assert.equal(tileMap.cellSizeM, 5);
  assert.equal(visible.some((cell) => cell.key === '0,0'), true);
  assert.equal(visible.some((cell) => cell.key === '90,90'), false);
  assert.equal(raceEditorSource.includes('createImageData(renderWidth, renderHeight)'), true);
  assert.equal(raceEditorSource.includes('for (let bufferY = 0; bufferY < renderHeight; bufferY += 1)'), true);
  assert.equal(raceEditorSource.includes('if (canvas.height !== 1) canvas.height = 1;'), false);
  assert.equal(raceEditorSource.includes('footprintWorldM'), true);
  assert.equal(raceEditorSource.includes('ctx.imageSmoothingEnabled = false;'), true);

  let samplerCalls = 0;
  editor.getRaceArtTextureSampler = () => ({
    sample: () => {
      samplerCalls += 1;
      return 'rgba(30, 120, 60, 1)';
    },
    averageSample: () => {
      samplerCalls += 1;
      return 'rgba(30, 120, 60, 1)';
    }
  });
  const drew = editor.drawRaceProjectedFlatTileMap(
    createMockContext(),
    { x: 0, y: 0, w: 390, h: 240 },
    [],
    {
      camera: {
        x: 0,
        z: -40,
        elevation: 0.1,
        nearPlane: 1.4,
        focalScale: 1,
        roadWidthScale: 1,
        roadMaxWidthRatio: 1,
        horizonRatio: 0.48
      },
      cameraYaw: 0
    }
  );

  assert.equal(drew, true);
  assert.equal(samplerCalls > 0, true);
});

test('Race Editor projected boundary draws road-edge seam strips with optional texture', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const ctx = createMockContext();
  editor.selectedRace.surfaceArt = { boundary: 'Fence' };
  editor.getRaceArtTextureSampler = () => ({
    sample: () => 'rgba(255, 255, 255, 1)'
  });
  const near = {
    center: { segment: { roadWidthM: 8 }, visible: true },
    left: { screenX: 120, screenY: 220, x: -4, z: 0, cameraZ: 8, renderZ: 8, visible: true },
    right: { screenX: 270, screenY: 220, x: 4, z: 0, cameraZ: 8, renderZ: 8, visible: true }
  };
  const far = {
    center: { segment: { roadWidthM: 8 }, visible: true },
    left: { screenX: 160, screenY: 120, x: -4, z: 20, cameraZ: 32, renderZ: 32, visible: true },
    right: { screenX: 230, screenY: 120, x: 4, z: 20, cameraZ: 32, renderZ: 32, visible: true }
  };

  const drew = editor.drawRaceProjectedBoundaryStrip(ctx, { x: 0, y: 0, w: 390, h: 240 }, near, far, {
    camera: { nearPlane: 1.2 }
  });

  assert.equal(drew, true);
  assert.equal(ctx.calls.some((call) => call.type === 'fill' && call.style === 'rgba(255, 255, 255, 1)'), true);
  const meshes = editor.getRaceWebGLBoundaryStripMeshes(near, far, { minScreenY: 80 });
  assert.equal(meshes.length, 2);
  assert.equal(meshes.every((mesh) => mesh.textured === true && mesh.artRef === 'Fence'), true);

  editor.selectedRace.margin = { enabled: false, widthM: 0.42, artRef: 'Fence' };
  assert.equal(editor.drawRaceProjectedBoundaryStrip(ctx, { x: 0, y: 0, w: 390, h: 240 }, near, far, {
    camera: { nearPlane: 1.2 }
  }), false);

  editor.selectedRace.margin = { marginMode: 'hidden', enabled: true, widthM: 0.42, artRef: 'Fence' };
  assert.equal(editor.isRaceMarginEnabled(), false);
  assert.equal(editor.isRaceMarginVisible(), false);
  assert.equal(editor.drawRaceProjectedBoundaryStrip(ctx, { x: 0, y: 0, w: 390, h: 240 }, near, far, {
    camera: { nearPlane: 1.2 }
  }), false);
});

test('Race Editor art billboards draw without debug rectangles and keep close height anchored', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });
  const canvas = { width: 2, height: 4 };
  editor.getRaceArtSpriteCanvas = () => canvas;
  editor.projectRaceWorldPointToCamera = (point) => ({
    ...point,
    visible: true,
    screenX: 195,
    screenY: 230,
    cameraZ: 8,
    renderZ: 8
  });
  editor.selectedRace.scenery = [{
    id: 'billboard',
    artRef: 'Billboard',
    label: 'Billboard',
    x: 0,
    z: 8,
    widthM: 2,
    heightM: 8,
    behavior: 'indestructible',
    state: 'standing'
  }];
  const calls = [];
  const ctx = createMockContext();
  ctx.drawImage = (...args) => calls.push({ type: 'drawImage', args });
  ctx.strokeRect = (...args) => calls.push({ type: 'strokeRect', args });
  const bounds = { x: 0, y: 0, w: 390, h: 240 };

  editor.drawRaceProjectedScenerySprites(ctx, bounds, {
    camera: {
      focalScale: 1,
      roadWidthScale: 1,
      nearPlane: 1.2
    },
    cameraYaw: 0
  });

  const draw = calls.find((call) => call.type === 'drawImage');
  assert.ok(draw);
  assert.equal(calls.some((call) => call.type === 'strokeRect'), false);
  assert.equal(draw.args[4] > draw.args[3], true);
});

test('Race editor surface preview and playtest world bake share the same surface revision', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const runtimeType = editor.getSelectedRaceRuntimeType();
  const routeLength = editor.getRaceRouteLength();
  const renderDebug = {
    ...editor.getRaceRenderDebugSettings(),
    terrainEnabled: true,
    texturesEnabled: false,
    detailEnabled: false,
    terrainCullingEnabled: false,
    terrainBudgetEnabled: false,
    editorSurfacePreviewEnabled: true,
    editorSurfaceDebugMode: 'bands'
  };

  const preview = editor.getRaceEditorSurfacePreviewBake({
    terrainSize: 28,
    routeLength,
    runtimeType,
    renderDebug
  });
  const playtestBake = editor.buildRaceWorldBake({
    terrainSize: 28,
    routeLength,
    runtimeType,
    renderDebug
  });

  assert.equal(preview.surfaceRevision, playtestBake.surfaceRevision);
  assert.equal(preview.validation.surfaceRevision, playtestBake.validation.surfaceRevision);
  assert.equal(preview.surfaceBake.sections.length > 2, true);
  assert.equal(playtestBake.surfaceBake.sections.length, preview.surfaceBake.sections.length);
});

test('Race editor surface preview cache invalidates with terrain and surface geometry changes', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.renderDebug = {
    ...editor.getRaceRenderDebugSettings(),
    editorSurfacePreviewEnabled: true,
    editorSurfaceDebugMode: 'seams'
  };
  const first = editor.getRaceEditorSurfacePreviewBake();
  assert.ok(first);

  const margin = editor.ensureRaceMarginSettings();
  margin.marginMode = 'on';
  margin.widthM = Number(margin.widthM || 0.24) + 0.11;
  editor.invalidateRaceTerrainCaches(editor.ensureRaceTileMap());

  assert.equal(editor.raceEditorSurfacePreviewBake, null);
  const second = editor.getRaceEditorSurfacePreviewBake();
  assert.notEqual(first.surfaceRevision, second.surfaceRevision);
});

test('Race editor top-down surface debug bands come from canonical surface cross-sections', () => {
  assert.equal(raceEditorSource.includes('drawRaceCanonicalSurfacePreview(ctx, bounds, renderDebug = this.getRaceRenderDebugSettings())'), true);
  assert.equal(raceEditorSource.includes('getRaceEditorSurfacePreviewBake({ runtimeType, routeLength, renderDebug })'), true);
  assert.equal(raceEditorSource.includes('preview?.surfaceBake?.sections'), true);
  assert.equal(raceEditorSource.includes("drawStrip('left', 'right'"), true);
  assert.equal(raceEditorSource.includes("drawPolyline('transitionLeft'"), true);
  assert.equal(raceEditorSource.includes('validation.magentaEdges'), true);
});

test('Race render debug settings persist editor surface preview controls', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

  editor.setRaceRenderDebugSettings({
    terrainEnabled: true,
    texturesEnabled: true,
    editorSurfacePreviewEnabled: true,
    editorSurfacePreview3dEnabled: true,
    editorSurfaceDebugMode: 'wheels'
  });
  const settings = editor.getRaceRenderDebugSettings();

  assert.equal(settings.editorSurfacePreviewEnabled, true);
  assert.equal(settings.editorSurfacePreview3dEnabled, true);
  assert.equal(settings.editorSurfaceDebugMode, 'wheels');
});

function createSyntheticVehicleSurface({ slopeZ = 0, slopeX = 0, ridge = false } = {}) {
  return {
    sampleWorld(point = {}) {
      const x = Number(point.x || 0);
      const z = Number(point.z || 0);
      const elevation = slopeZ * z + slopeX * x + (ridge ? Math.max(0, 1 - Math.abs(z) / 5) * 0.18 : 0);
      const normal = {
        x: -slopeX,
        y: 1,
        z: -slopeZ
      };
      const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
      const absX = Math.abs(x);
      const region = absX <= 3 ? 'road' : absX <= 3.7 ? 'margin' : absX <= 5.4 ? 'shoulder' : 'terrain';
      const surfaceId = region === 'road' || region === 'margin' ? 'asphalt' : 'dirt';
      const friction = region === 'road' ? 1 : region === 'margin' ? 0.92 : region === 'shoulder' ? 0.62 : 0.48;
      return {
        x,
        z,
        elevation,
        normal: { x: normal.x / length, y: normal.y / length, z: normal.z / length },
        region,
        surfaceId,
        materialId: surfaceId,
        friction,
        driveable: region !== 'terrain'
      };
    }
  };
}

function createVehiclePhysicsFixture(surfaceModel = createSyntheticVehicleSurface()) {
  const tuning = {
    weightKg: 1450,
    wheelbaseM: 2.65,
    trackWidthM: 1.56,
    trackFrontM: 1.56,
    trackRearM: 1.56,
    rideHeightFront: 0.18,
    rideHeightRear: 0.18,
    suspensionTravelFront: 0.5,
    suspensionTravelRear: 0.5,
    springRateFront: 24000,
    springRateRear: 23000,
    dampingReboundFront: 2400,
    dampingReboundRear: 2300
  };
  const carDimensions = { wheelbaseM: 2.65, trackWidthM: 1.56, trackFrontM: 1.56, trackRearM: 1.56 };
  const session = {
    worldX: 0,
    worldZ: 0,
    speedMps: 12,
    carYaw: 0,
    velocityYaw: 0,
    pitchRad: 0,
    rollRad: 0
  };
  const state = createRaceVehiclePhysicsState({
    session,
    tuning,
    carDimensions,
    surfaceModel,
    elevationScaleM: 12
  });
  return { state, session, tuning, carDimensions, surfaceModel };
}

test('Race 3D vehicle contact follows uphill and downhill grades without sinking', () => {
  const { state, tuning, carDimensions, surfaceModel } = createVehiclePhysicsFixture(createSyntheticVehicleSurface({ slopeZ: 0.012 }));
  const initialY = state.position.y;

  for (let index = 0; index < 30; index += 1) {
    stepRaceVehiclePhysics(state, {
      dt: 1 / 60,
      tuning,
      carDimensions,
      surfaceModel,
      elevationScaleM: 12,
      planarVelocity: { x: 0, y: 0, z: 18 },
      yaw: 0
    });
  }

  const averageContactY = Object.values(state.wheels).reduce((sum, wheel) => sum + wheel.contactPoint.y, 0) / 4;
  assert.equal(state.position.z > 1, true);
  assert.equal(state.position.y > initialY, true);
  assert.equal(state.position.y > averageContactY, true);
});

test('Race 3D vehicle pitch, roll, and wheel contact respond to surface and load', () => {
  const pitchFixture = createVehiclePhysicsFixture(createSyntheticVehicleSurface({ slopeZ: 0.018 }));
  stepRaceVehiclePhysics(pitchFixture.state, {
    dt: 0.4,
    tuning: pitchFixture.tuning,
    carDimensions: pitchFixture.carDimensions,
    surfaceModel: pitchFixture.surfaceModel,
    elevationScaleM: 12,
    planarVelocity: { x: 0, y: 0, z: 10 },
    controls: { longitudinalAcceleration: -6 }
  });
  assert.equal(Math.abs(pitchFixture.state.pitch) > 0.002, true);

  const rollFixture = createVehiclePhysicsFixture(createSyntheticVehicleSurface({ slopeX: 0.025 }));
  stepRaceVehiclePhysics(rollFixture.state, {
    dt: 0.4,
    tuning: rollFixture.tuning,
    carDimensions: rollFixture.carDimensions,
    surfaceModel: rollFixture.surfaceModel,
    elevationScaleM: 12,
    planarVelocity: { x: 0, y: 0, z: 10 },
    controls: { lateralAcceleration: 7 }
  });
  assert.equal(Math.abs(rollFixture.state.roll) > 0.002, true);
});

test('Race 3D vehicle allows wheel contact loss and settles deterministically after landing', () => {
  const { state, tuning, carDimensions, surfaceModel } = createVehiclePhysicsFixture(createSyntheticVehicleSurface());
  state.position.y += 3;
  state.linearVelocity.y = 1.5;
  stepRaceVehiclePhysics(state, {
    dt: 0.05,
    tuning,
    carDimensions,
    surfaceModel,
    elevationScaleM: 12,
    planarVelocity: { x: 0, y: 0, z: 18 }
  });
  assert.equal(Object.values(state.wheels).some((wheel) => !wheel.inContact), true);

  for (let index = 0; index < 180; index += 1) {
    stepRaceVehiclePhysics(state, {
      dt: 1 / 60,
      tuning,
      carDimensions,
      surfaceModel,
      elevationScaleM: 12,
      planarVelocity: { x: 0, y: 0, z: 8 }
    });
  }
  assert.equal(Object.values(state.wheels).some((wheel) => wheel.inContact), true);
  assert.equal(Number.isFinite(state.position.y), true);
  assert.equal(Math.abs(state.linearVelocity.y) < 18, true);
});

test('Race 3D vehicle wheel contacts use canonical road apron shoulder regions and friction', () => {
  const { state, tuning, carDimensions, surfaceModel } = createVehiclePhysicsFixture(createSyntheticVehicleSurface());
  state.position.x = 4.4;
  stepRaceVehiclePhysics(state, {
    dt: 1 / 30,
    tuning,
    carDimensions,
    surfaceModel,
    elevationScaleM: 12,
    planarVelocity: { x: 0, y: 0, z: 2 }
  });
  const regions = Object.fromEntries(Object.entries(state.wheels).map(([wheelId, wheel]) => [wheelId, wheel.region]));

  assert.equal(Object.values(regions).includes('margin'), true);
  assert.equal(Object.values(regions).includes('shoulder'), true);
  assert.equal(Object.values(state.wheels).some((wheel) => wheel.friction < 0.8), true);
});

test('Race 3D vehicle physics is deterministic for identical inputs', () => {
  const fixture = createVehiclePhysicsFixture(createSyntheticVehicleSurface({ slopeZ: 0.01, slopeX: 0.004 }));
  const a = cloneRaceVehiclePhysicsState(fixture.state);
  const b = cloneRaceVehiclePhysicsState(fixture.state);
  const options = {
    tuning: fixture.tuning,
    carDimensions: fixture.carDimensions,
    surfaceModel: fixture.surfaceModel,
    elevationScaleM: 12,
    planarVelocity: { x: 1.2, y: 0, z: 16 },
    yaw: 0.08,
    controls: {
      longitudinalAcceleration: 2.1,
      lateralAcceleration: 4.2,
      driveForceByWheel: { fl: 900, fr: 900, rl: 900, rr: 900 },
      brakeForceByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
      longitudinalUsageByWheel: { fl: 0.3, fr: 0.3, rl: 0.4, rr: 0.4 },
      lateralUsageByWheel: { fl: 0.2, fr: 0.25, rl: 0.15, rr: 0.18 }
    }
  };
  for (let index = 0; index < 90; index += 1) {
    stepRaceVehiclePhysics(a, { ...options, dt: 1 / 60 });
    stepRaceVehiclePhysics(b, { ...options, dt: 1 / 60 });
  }

  assert.deepEqual(a, b);
});

test('Race Editor session exposes 3D body state while preserving billboard render path', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.raceInput.activeThrottlePointerId = 'throttle';
  editor.raceInput.throttleAxis = 0.7;
  editor.updatePlaytest(1 / 30);

  assert.ok(editor.playtestSession.vehicle3d);
  assert.equal(Number.isFinite(editor.playtestSession.bodyY), true);
  assert.equal(Number.isFinite(editor.playtestSession.velocityX), true);
  assert.equal(Number.isFinite(editor.playtestSession.angularVelocityZ), true);
  assert.equal(Object.keys(editor.playtestSession.wheelContacts3d || {}).length, 4);
  assert.equal(raceEditorSource.includes('drawRaceProjectedProceduralCar'), true);
  assert.equal(raceEditorSource.includes('bodyY'), true);
});
