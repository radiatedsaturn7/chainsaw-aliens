import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { createBranchingExampleRace } from '../../src/racing/RaceExample.js';
import { buildRaceMinimap } from '../../src/racing/RaceMinimap.js';
import { validateRaceRouteNetwork, findNetworkRoute } from '../../src/racing/RaceRouteNetwork.js';
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

test('File New and lane variants create an editable example and preserve it through save/load', async () => {
  for (const action of ['new', ...Array.from({ length: 6 }, (_, i) => `new-${i + 1}-lane`)]) {
    const editor = new RaceEditor({});
    editor.raceMapZoom = 3; editor.raceMapPan = { x: 500, y: -500 };
    editor.networkNodeId = 'stale'; editor.networkWaterId = 'stale';
    editor.currentRaceDocumentName = 'Previously saved race';
    await editor.handleMenuAction(action);
    assert.equal(editor.raceMapZoom, 1); assert.deepEqual(editor.raceMapPan, { x: 0, y: 0 });
    assert.equal(editor.networkNodeId, 'start'); assert.equal(editor.networkWaterId, '');
    assert.equal(editor.selectedRace.name, 'Branching Valley', action);
    assert.equal(editor.getRaceDocumentName(), 'Branching Valley');
    assert.deepEqual(validateRaceRouteNetwork(editor.selectedRace.road.network), []);
    const restored = editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());
    assert.deepEqual(restored.road.network, editor.selectedRace.road.network);
    assert.deepEqual(restored.waterRegions, editor.selectedRace.waterRegions);
    assert.ok(Object.keys(restored.road.tileMap.cells).length > 100);
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
