import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { createBranchingExampleRace } from '../../src/racing/RaceExample.js';
import { buildRaceMinimap } from '../../src/racing/RaceMinimap.js';
import { validateRaceRouteNetwork, findNetworkRoute, normalizeRaceRouteNetwork, projectNetworkPoint } from '../../src/racing/RaceRouteNetwork.js';
import { sampleRaceBakedSurface } from '../../src/racing/RaceBakedSurfaceSampler.js';

test('example has real Y/T/four-way junctions and every branch connects start to finish', () => {
  const race = createBranchingExampleRace(), graph = race.road.network;
  assert.deepEqual(validateRaceRouteNetwork(graph), []);
  for (const [id, count] of [['y', 3], ['t', 3], ['cross', 4]]) {
    assert.equal(graph.edges.filter(e => e.from === id || e.to === id).length, count);
  }
  for (const node of graph.nodes) {
    assert.ok(findNetworkRoute(graph, graph.startNodeId, node.id), node.id);
    assert.ok(findNetworkRoute(graph, node.id, graph.finishNodeId), node.id);
  }
  assert.notEqual(graph.startNodeId, graph.finishNodeId);
  assert.ok(Object.keys(race.road.tileMap.cells).length > 100);
  assert.ok(Object.values(race.road.tileMap.cells).every(c => c.elevation * 12 <= 2.01));
  const other = createBranchingExampleRace();
  race.road.network.nodes[0].x = 999;
  assert.equal(other.road.network.nodes[0].x, 0);
});

test('example bridge crosses a road, tunnel crosses under a road, and ford is shallow', () => {
  const editor = new RaceEditor({});
  editor.project.races[0] = createBranchingExampleRace();
  const bake = editor.buildRaceWorldBake({ validate: false });
  const height = (x, z, y) => sampleRaceBakedSurface(bake.surfaceSampler, { x, z, y })?.elevation * 12;
  assert.ok(Math.abs(height(-90, 160, 6.4) - 6) < 1e-5);
  assert.ok(Math.abs(height(-90, 160, 0.4)) < 1e-5);
  assert.ok(Math.abs(height(0, 500, -5.6) + 6) < 1e-5);
  assert.ok(Math.abs(height(0, 500, 0.4)) < 1e-5);
  const water = editor.selectedRace.waterRegions[0];
  const depth = water.levelM - height(water.x, water.z, 0.4);
  assert.ok(depth > 0.1 && depth < 0.3);
});

test('File New and lane variants create a simple start-only track and preserve it through save/load', async () => {
  for (const action of ['new', ...Array.from({ length: 6 }, (_, i) => `new-${i + 1}-lane`)]) {
    const editor = new RaceEditor({});
    editor.raceMapZoom = 3; editor.raceMapPan = { x: 500, y: -500 };
    editor.networkNodeId = 'stale'; editor.networkWaterId = 'stale';
    editor.currentRaceDocumentName = 'Previously saved race';
    await editor.handleMenuAction(action);
    assert.equal(editor.raceMapZoom, 1); assert.deepEqual(editor.raceMapPan, { x: 0, y: 0 });
    assert.equal(editor.networkNodeId, 'start'); assert.equal(editor.networkWaterId, '');
    assert.equal(editor.selectedRace.name, 'New Race', action);
    assert.equal(editor.getRaceDocumentName(), 'New Race');
    assert.equal(editor.selectedRace.road.network.finishNodeId, '');
    assert.equal(editor.selectedRace.road.network.edges.length,1);
    const restored = editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());
    assert.deepEqual(restored.road.network, editor.selectedRace.road.network);
    assert.deepEqual(restored.waterRegions, editor.selectedRace.waterRegions);
    assert.equal(Object.keys(restored.road.tileMap.cells).length,0);
    const expectedWidth = (action === 'new' ? 1 : Number(action.split('-')[1])) * 3.6;
    assert.ok(restored.road.network.edges.every(e => e.widthM === expectedWidth));
  }
});

test('minimap includes every independent edge and uses explicit start/finish markers', () => {
  const network = createBranchingExampleRace().road.network;
  const map = buildRaceMinimap({ network });
  assert.equal(map.paths.length, network.edges.length);
  assert.equal(map.minX, -260); assert.equal(map.maxX, 180);
  assert.equal(map.start.id, 'start'); assert.equal(map.finish.id, 'finish');
  for (const path of map.paths) {
    const edge = network.edges.find(e => e.id === path.id);
    assert.equal(path.points[0].id, edge.from);
    assert.equal(path.points.at(-1).id, edge.to);
    assert.equal(path.closed, false);
  }
  const legacy = buildRaceMinimap({ samples: [{ x: 0, z: 0 }, { x: 100, z: 100 }], circuit: true });
  assert.equal(legacy.paths[0].closed, true); assert.equal(legacy.finish, null);
});

test('racing minimap draws separate branches, keeps player visible, and uses physical AI positions', () => {
  const editor = new RaceEditor({});
  editor.project.races[0] = createBranchingExampleRace();
  editor.selectedRace.road.segments = [];
  editor.playtestSession = { routeRuntimeType: 'destination', worldX: 180, worldZ: 160,
    aiRuntime: [{ worldX: 180, worldZ: 160, distance: 0 }] };
  const paths = [], dots = []; let path = [], player;
  const ctx = { save() {}, restore() {}, fillRect() {}, beginPath() { path = []; },
    rect() {}, clip() {}, moveTo(x,y) { path.push(['M',x,y]); }, lineTo(x,y) { path.push(['L',x,y]); },
    closePath() { path.push(['close']); }, setLineDash() {}, stroke() { paths.push([...path]); },
    arc(x,y) { dots.push({x,y}); }, fill() {}, fillText() {} };
  editor.drawRaceMinimapPlayerDot = (_, point) => { player = point; };
  editor.drawRaceTrackMinimap(ctx, { x: 0, y: 0, w: 92, h: 92 });
  assert.ok(paths.length >= editor.selectedRace.road.network.edges.length);
  assert.ok(paths.every(p => p.filter(v => v[0] === 'M').length === 1));
  assert.deepEqual(dots[0], player);
  const cached = editor.raceMinimapCache.data;
  editor.playtestSession.worldX = 10000;
  editor.drawRaceTrackMinimap(ctx, { x: 0, y: 0, w: 92, h: 92 });
  assert.equal(editor.raceMinimapCache.data, cached);
  assert.ok(player.x <= 89 && player.y <= 89);
});

test('tile painting redraw resolves route geometry and artwork once per viewport', () => {
  const editor = new RaceEditor({});
  editor.createNewRaceProject();
  editor.selectedRaceGroundBoxArtRef = 'painted-tile';
  editor.racePortraitMode = 'sprites';
  editor.raceGroundBrushCells = 15;
  const rawPoints = editor.getRaceRawMapPoints.bind(editor);
  let reads = 0, artReads = 0;
  editor.getRaceRawMapPoints = () => { reads++; return rawPoints(); };
  editor.getRaceArtSpriteCanvas = () => { artReads++; return { width: 16, height: 16 }; };
  const textures = [];
  editor.drawRaceWorldSpaceArtTexture = (ctx, art, world, screen) => textures.push({ world, screen });
  const ctx = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
  for (const [w, h, zoom, pan] of [[1280, 800, 1, 0], [390, 700, 3, 20], [844, 300, 2, -30]]) {
    const bounds = { x: 12, y: 40, w, h };
    editor.raceMapBounds = bounds;
    editor.raceMapZoom = zoom;
    editor.raceMapPan = { x: pan, y: -pan };
    assert.equal(editor.paintRaceArtTileAtPoint({ x: bounds.x + w / 2, y: bounds.y + h / 2 }), true);
    textures.length = 0; reads = 0; artReads = 0;
    editor.drawRaceTopDownTileMap(ctx, bounds);
    assert.equal(reads, 1, 'route coordinates are read once, not per cell corner');
    assert.equal(artReads, 1, 'shared tile artwork is resolved once per redraw');
    assert.ok(textures.length > 0, 'painted artwork is visible');
    for (const { world, screen } of textures) {
      const a = editor.raceMapWorldToScreenPoint({ x: world.x, y: world.y }, bounds);
      const b = editor.raceMapWorldToScreenPoint({ x: world.x + world.w, y: world.y + world.h }, bounds);
      assert.ok(Math.abs(screen.x - a.screenX) < 1e-8);
      assert.ok(Math.abs(screen.y - a.screenY) < 1e-8);
      assert.ok(Math.abs(screen.w - Math.max(1, b.screenX - a.screenX + 0.5)) < 1e-8);
    }
  }
});

test('first-person camera follows driver heading through spins in every exterior tracking mode', () => {
  const editor = new RaceEditor({});
  editor.hasPhysicalRaceGamepad = () => true;
  for (const tracking of ['dynamic', 'dynamic-fixed', 'fixed-rear']) {
    editor.getCarCameraTrackingMode = () => tracking;
    for (const yaw of [-3, -1.5, 0, 1.5, 3]) {
      const session = { cameraView: 'first-person', carYaw: yaw, velocityYaw: yaw + 2,
        speedMps: 28, cameraYaw: yaw - 2, tireSlip: { wheelSpin: 1, drift: 1 } };
      editor.raceInput.lookAngle = 0;
      assert.ok(Math.abs(editor.getRacePlaytestCameraYaw(session, { seconds: 1 / 60, smooth: true }) - yaw) < 1e-10);
      editor.raceInput.lookAngle = 0.4;
      const actual = editor.getRacePlaytestCameraYaw(session);
      assert.ok(Math.abs(Math.atan2(Math.sin(actual - yaw - 0.4), Math.cos(actual - yaw - 0.4))) < 1e-10);
    }
  }
});

test('chase camera stays inside default tunnel on entry, under the crossing and on exit', () => {
  const editor = new RaceEditor({});
  Object.assign(editor.selectedRace,createBranchingExampleRace({id:editor.selectedRace.id}));
  const network = editor.selectedRace.road.network;
  const tunnel = network.edges.find(e => e.structure === 'tunnel');
  const session = { startedAt: 1, elapsedMs: 0, thirdPersonCameraPlacement: { safetyLiftM: 10, chaseDistance: 30, elapsedMs: 0, resetKey: 1 } };
  for (const z of [401, 420, 445, 460, 480, 500, 530, 550, 575, 595, 600]) {
    const floor = z < 460 ? -(z - 400) / 10 : z <= 540 ? -6 : -6 + (z - 540) / 10;
    session.elapsedMs += 16;
    const options = { carWorldX: 0, carWorldZ: z, carYaw: 0, roadElevation: floor / 12,
      eyeHeight: 3.5 / 12, desiredChaseDistance: 18, cameraView: 'third-person' };
    const placement = editor.getRaceThirdPersonSafeCameraPlacement(options);
    const final = editor.smoothRaceThirdPersonSafeCameraPlacement(session, placement, options);
    assert.equal(final.tunnelConstrained, true, `z=${z}`);
    const camera = final.camera;
    const rearFloor = camera.z < 400 ? 0 : camera.z < 460 ? -(camera.z - 400) / 10
      : camera.z <= 540 ? -6 : -6 + (camera.z - 540) / 10;
    assert.ok(camera.elevation * 12 >= rearFloor + 0.25, `above floor z=${z}`);
    assert.ok(camera.elevation * 12 <= rearFloor + tunnel.clearanceM - 0.35, `below ceiling z=${z}`);
    assert.equal(session.thirdPersonCameraPlacement, null, 'old exterior smoothing cannot lift camera through roof');
  }
});

test('default race renders sprite chooser and placed scenery in every editor layout', async () => {
  for (const [width, height, mobile, gamepad] of [[1280, 800, false, false], [390, 844, true, false], [844, 390, true, false], [1280, 720, true, true]]) {
    const editor = new RaceEditor({ deviceIsMobile: mobile, isMobile: mobile, input: { isGamepadConnected: () => gamepad } });
    editor.createNewRaceProject();
    editor.selectedRace.sceneryDefinitions = [{ id: 'test-tree', label: 'Tree', artRef: 'tree', widthM: 2, heightM: 5 }];
    const ctx = new Proxy({ measureText: text => ({ width: String(text).length * 6 }),
      createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
      { get: (o, k) => o[k] ?? (() => {}), set: (o, k, v) => { o[k] = v; return true; } });
    editor.draw(ctx, width, height);
    await editor.handleMenuAction('sprite-select'); editor.draw(ctx, width, height);
    const button = editor.buttons.find(b => b.id === 'sprite-def-test-tree');
    assert.ok(button, `visible chooser at ${width}x${height}`);
    editor.handlePointerDown({ x: button.bounds.x + 3, y: button.bounds.y + 3, id: 1, button: 0 });
    editor.handlePointerUp({ x: button.bounds.x + 3, y: button.bounds.y + 3, id: 1, button: 0 });
    editor.draw(ctx, width, height);
    const b = editor.raceMapBounds;
    editor.handlePointerDown({ x: b.x + b.w * 0.35, y: b.y + b.h * 0.5, id: 2, button: 0 });
    editor.handlePointerUp({ x: b.x + b.w * 0.35, y: b.y + b.h * 0.5, id: 2, button: 0 });
    assert.equal(editor.selectedRace.scenery.length, 1);
    let rendered = 0;
    const original = editor.drawRaceTopDownScenerySprites.bind(editor);
    editor.drawRaceTopDownScenerySprites = (...args) => { rendered++; original(...args); };
    editor.draw(ctx, width, height);
    assert.equal(rendered, 1, 'network viewport draws the placed scenery');
  }
});


test('tunnel camera retracts around a bend without crossing the inside wall', () => {
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: -30, z: 0, heightM: -6 }, { id: 'b', x: 0, z: 30, heightM: -6 }],
    edges: [{ id: 'bend', from: 'a', to: 'b', structure: 'tunnel', widthM: 4, clearanceM: 3,
      points: [{ x: 0, z: 0, heightM: -6 }] }], startNodeId: 'a', finishNodeId: 'b'
  });
  const placement = editor.getRaceThirdPersonSafeCameraPlacement({ carWorldX: 0, carWorldZ: 3, carYaw: 0,
    desiredChaseDistance: 10, roadElevation: -0.5, eyeHeight: 3.5 / 12 });
  assert.equal(placement.tunnelConstrained, true);
  assert.ok(placement.chaseDistance < 10);
  for (let t = 0; t <= 1; t += 0.1) {
    const point = { x: placement.camera.x * t, z: 3 + (placement.camera.z - 3) * t, heightM: -6 };
    assert.ok(projectNetworkPoint(editor.selectedRace.road.network, point).distanceToRoute < 1.7);
  }
  assert.ok(placement.camera.elevation * 12 < -3.35);
});
