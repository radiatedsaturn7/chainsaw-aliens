import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { clearCachedProjectFilesForTests } from '../../src/ui/serverStorage.js';

const editor = () => new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });

test('race save/reopen preserves default-derived hazards, artwork, scenery rotation and road edits', async () => {
  const e = editor();
  const race = e.selectedRace;
  race.id = 'test-loop'; race.name = 'My edited race';
  race.hazards = [{ id: 'mine', type: 'jump', at: 40 }];
  race.road.segments = [{ length: 100, hazardIds: ['mine'] }];
  race.road.segments[0].width = 21;
  race.skyboxArtRef = 'My sky'; race.skyboxSettings = { artRef: 'My sky', scaleX: 2 };
  race.surfaceArt = { asphalt: 'My road' };
  race.scenery = [{ id: 'sign', presetId: 'doodad', x: 10, z: 20, yaw: 0, widthM: 2, heightM: 3 }];
  e.selectedSceneryIndex = 0; e.raceSelectionType = 'sprite';
  await e.openRaceSceneryRotationDialog(async () => ({ degrees: 270 }));
  assert.equal(e.selectedScenery.yaw, Math.PI * 1.5);
  const payload = e.serializeSelectedRaceDocument();
  const other = editor();
  other.applyLoadedRaceDocument(JSON.parse(JSON.stringify(payload)), { name: 'My edited race' });
  assert.deepEqual(other.selectedRace.hazards, race.hazards);
  assert.deepEqual(other.selectedRace.road.segments[0].hazardIds, ['mine']);
  assert.equal(other.selectedRace.road.segments[0].width, 21);
  assert.equal(other.selectedRace.skyboxArtRef, 'My sky');
  assert.equal(other.selectedRace.skyboxSettings.scaleX, 2);
  assert.equal(other.selectedRace.surfaceArt.asphalt, 'My road');
  assert.deepEqual(other.selectedRace.scenery, race.scenery);
  e.undoRaceHistory();
  assert.equal(e.selectedScenery.yaw, 0);
});

test('rotation changes world quad orientation without moving its center', () => {
  const e = editor();
  e.getRaceDoodadForScenery = () => ({ widthM: 2, heightM: 3 });
  e.sampleRaceDoodadGroundPoint = (x, z) => ({ x, z, elevation: 0 });
  const a = e.getRaceDoodadWorldQuad({ x: 10, z: 20, yaw: 0 });
  const b = e.getRaceDoodadWorldQuad({ x: 10, z: 20, yaw: Math.PI / 2 });
  assert.notDeepEqual(a.points, b.points);
  assert.ok(Math.abs(b.points[0].x - 10) < 1e-9);
  assert.ok(Math.abs(a.points[0].z - 20) < 1e-9);
});

test('race save status waits for persistence and reports unavailable storage', async () => {
  clearCachedProjectFilesForTests();
  const old = globalThis.fetch;
  const e = editor();
  const messages = [];
  e.game.showSaveStatusModal = message => messages.push(message);
  try {
    globalThis.fetch = async () => ({ ok: false, status: 405, json: async () => ({ error: 'unavailable' }) });
    const saved = e.saveSelectedRaceToName('Persistence test');
    assert.match(e.status, /^Saving /);
    await saved.syncPromise;
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(e.status, /^Save failed:/);
    assert.equal(messages[0], 'Saving...');
    assert.match(messages.at(-1), /^Save failed:/);
    assert.equal(messages.includes('Saved'), false);
  } finally { globalThis.fetch = old; clearCachedProjectFilesForTests(); }
});

test('doodad selection keeps rotation reachable in the contextual drawer', () => {
  const e = editor();
  e.raceSpritePaintKind = 'doodad';
  e.selectedRace.scenery = [{ id: 'sign', x: 10, z: 20, yaw: 0 }];
  e.handleMenuAction('move-sprite');
  assert.equal(e.racePortraitMode, 'ground');
  assert.equal(e.getRaceGroundToolMode(), 'doodad');
  e.raceSelectionType = 'sprite';
  e.selectedSceneryIndex = 0;
  e.racePortraitHotMenu = 'ground-intensity';
  const rotate = e.getRacePortraitGroundPopupActions().find(a => a.id === 'rotate-sprite');
  assert.equal(rotate.disabled, false);
  e.raceSelectionType = 'edge';
  assert.equal(e.setSelectedRaceSceneryRotation(90), false);
  assert.equal(e.selectedRace.scenery[0].yaw, 0);
});

test('rotation handle drags in map coordinates, preserves position and records one undo step', () => {
  const e = editor();
  e.selectedRace.scenery = [{ id: 'sign', presetId: 'doodad', x: 10, z: 20, yaw: 0, widthM: 2 }];
  e.selectedSceneryIndex = 0; e.raceSelectionType = 'sprite';
  e.raceMapBounds = { x: 0, y: 0, w: 800, h: 600 };
  // Rotated, zoomed and translated map: world X goes down, world Z goes right.
  e.raceMapWorldToScreenPoint = ({ x, y }) => ({ screenX: 100 + y * 3, screenY: 200 + x * 3, scale: 3 });
  e.screenToRaceMapWorldPoint = (x, y) => ({ x: (y - 200) / 3, y: (x - 100) / 3 });
  const handle = e.getRaceSceneryRotationHandle();
  const history = e.raceHistory.length;
  assert.equal(e.beginRaceSceneryRotationDrag({ id: 1, x: handle.x, y: handle.y }), true);
  assert.equal(e.updateRaceSceneryRotationDrag({ id: 2, x: 0, y: 0 }), false);
  e.handlePointerMove({ id: 1, x: handle.center.screenX, y: handle.center.screenY + 44 });
  assert.ok(Math.abs(e.selectedScenery.yaw - Math.PI / 2) < 1e-9);
  e.handlePointerMove({ id: 1, x: handle.center.screenX - 44, y: handle.center.screenY });
  e.handlePointerUp({ id: 1, x: handle.center.screenX - 44, y: handle.center.screenY });
  assert.ok(Math.abs(e.selectedScenery.yaw - Math.PI) < 1e-9);
  assert.equal(e.selectedScenery.x, 10);
  assert.equal(e.selectedScenery.z, 20);
  assert.equal(e.raceHistory.length, history + 1);
  assert.equal(e.raceSceneryRotationDrag, null);
  const saved = e.serializeSelectedRaceDocument();
  assert.equal(saved.race.scenery[0].yaw, Math.PI);
  e.undoRaceHistory();
  assert.equal(e.selectedScenery.yaw, 0);
});

test('tapping rotation handle does not add history or change facing; hidden doodads have no handle', () => {
  const e = editor();
  e.selectedRace.scenery = [{ id: 'sign', x: 0, z: 0, yaw: 0 }];
  e.raceSelectionType = 'sprite'; e.selectedSceneryIndex = 0;
  e.raceMapBounds = { x: 0, y: 0, w: 800, h: 600 };
  e.raceMapWorldToScreenPoint = ({ x, y }) => ({ screenX: 200 + x, screenY: 200 - y, scale: 1 });
  e.screenToRaceMapWorldPoint = (x, y) => ({ x: x - 200, y: 200 - y });
  const h = e.getRaceSceneryRotationHandle();
  const history = e.raceHistory.length;
  e.beginRaceSceneryRotationDrag({ x: h.x + 8, y: h.y });
  e.handlePointerUp({ x: h.x + 8, y: h.y });
  assert.equal(e.selectedScenery.yaw, 0);
  assert.equal(e.raceHistory.length, history);
  e.showRaceScenery = false;
  assert.equal(e.getRaceSceneryRotationHandle(), null);
});

test('explicit Sprite mode clears previous paint type and preserves saved doodad choice', () => {
  const e = editor();
  e.selectedDoodadRef = 'My sign';
  for (const kind of ['doodad', 'tile', 'decal', 'sprite']) {
    e.raceSpritePaintKind = kind;
    e.handleMenuAction('race-ground-mode-sprites');
    assert.equal(e.getRaceSpritePaintKind(), 'sprite');
    assert.equal(e.getRaceGroundToolMode(), 'sprite');
    assert.equal(e.activeAction, 'paint-sprite');
    assert.equal(e.selectedDoodadRef, 'My sign');
  }
  e.handleMenuAction('race-ground-mode-doodad');
  e.setRacePortraitMode('sprites');
  assert.equal(e.getRaceSpritePaintKind(), 'sprite');
  e.handleMenuAction('race-ground-mode-doodad');
  e.handleMenuAction('move-sprite');
  e.handleMenuAction('race-ground-mode');
  assert.equal(e.getRaceGroundToolMode(), 'doodad');
  assert.equal(e.activeAction, 'move-sprite');
});

test('race save uses Pixel Editor saving and confirmed saved overlay', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const e = editor();
  const messages = [];
  e.game.showSaveStatusModal = message => messages.push(message);
  let release;
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  try {
    const saved = e.saveSelectedRaceToName('Overlay test');
    assert.deepEqual(messages, ['Saving...']);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(messages, ['Saving...']);
    release({ ok: true, json: async () => ({ ok: true, file: {} }) });
    await saved.syncPromise;
    await new Promise(resolve => setTimeout(resolve, 370));
    assert.deepEqual(messages, ['Saving...', 'Saved']);
  } finally { globalThis.fetch = originalFetch; clearCachedProjectFilesForTests(); }
});
