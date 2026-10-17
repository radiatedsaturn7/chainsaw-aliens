import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { normalizeRaceRouteNetwork, networkFromLegacySamples } from '../../src/racing/RaceRouteNetwork.js';

test('legacy races stay opt-in and conversion retains sampled positions and named endpoints', () => {
  const editor = new RaceEditor({});
  const original = editor.getRacePathSamples({ step: 8 });
  assert.equal(editor.selectedRace.road.network, undefined);
  const network = networkFromLegacySamples(original);
  editor.selectedRace.road.network = network;
  assert.equal(editor.getSelectedRaceRuntimeType(), 'destination');
  assert.equal(editor.getRaceStartPose().x, original[0].x);
  assert.equal(editor.getRaceStartPose().z, original[0].z);
  const samples = editor.getRacePathSamples({ step: 8 });
  assert.equal(samples.at(-1).x, original.at(-1).x);
  assert.equal(samples.at(-1).z, original.at(-1).z);
  assert.deepEqual(editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument()).road.network, network);
});

test('network world bake and route projection agree on an elevated branch', () => {
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'start', x: 0, z: 0 }, { id: 'finish', x: 0, z: 100 }, { id: 'high', x: 40, z: 50, heightM: 6 }],
    edges: [{ id: 'main', from: 'start', to: 'finish' },
      { id: 'ramp-up', from: 'start', to: 'high', structure: 'bridge' },
      { id: 'ramp-down', from: 'high', to: 'finish', structure: 'bridge' }],
    startNodeId: 'start', finishNodeId: 'finish'
  });
  const bake = editor.buildRaceWorldBake({ validate: false });
  assert.equal(bake.surfaceSampler.layered, true);
  assert.equal(bake.terrainTopology, 'route-network');
  assert.equal(bake.surfaceBake.paths.length, 3);
  assert.ok(bake.staticColliders.length);
  const projection = editor.getRaceRouteProjectionForWorldPoint({ x: 40, y: 6, z: 50 });
  assert.equal(projection.heightM, 6);
  assert.ok(projection.edgeId.startsWith('ramp-'));
  assert.ok(projection.distance < editor.getRaceRouteLength());
});

test('unreachable one-way branch has finite race progress', () => {
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'start', x: 0, z: 0 }, { id: 'finish', x: 0, z: 100 },
      { id: 'a', x: 100, z: 0 }, { id: 'b', x: 100, z: 100 }],
    edges: [{ id: 'main', from: 'start', to: 'finish' }, { id: 'dead-end', from: 'a', to: 'b', bidirectional: false }],
    startNodeId: 'start', finishNodeId: 'finish'
  });
  const projection = editor.getRaceRouteProjectionForWorldPoint({ x: 100, y: 0, z: 50 });
  assert.equal(projection.canReachFinish, false);
  assert.equal(projection.distance, 0);
});

test('automatic barriers cover separate network branches without connecting their endpoints', async () => {
  const { createRaceStaticColliderWorld } = await import('../../src/racing/RaceSimulation.js');
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'start', x: 0, z: 0 }, { id: 'finish', x: 0, z: 100 },
      { id: 'a', x: 100, z: 0 }, { id: 'b', x: 100, z: 100 }],
    edges: [{ id: 'main', from: 'start', to: 'finish' }, { id: 'branch', from: 'a', to: 'b' }],
    startNodeId: 'start', finishNodeId: 'finish'
  });
  editor.getRaceEdgeCollisionMode = () => 'wall';
  editor.getRaceCollisionMarginWidthWorld = () => 0;
  editor.getRaceCollisionShoulderWidthWorld = () => 0;
  const authority = {};
  createRaceStaticColliderWorld(editor, { authority, worldBake: { key: 'test' }, runtimeType: 'destination', routeLength: 100 });
  const walls = authority.staticColliderDefinitions.filter(d => d.source.startsWith('edge:'));
  assert.ok(walls.some(w => w.center.x < 10));
  assert.ok(walls.some(w => w.center.x > 90));
  assert.ok(walls.every(w => w.center.x < 10 || w.center.x > 90), 'no phantom barrier between independent branches');
});

for (const heightM of [-6, 6]) test(`worker physics stays on the ${heightM}m deck while crossing overlapping terrain`, async () => {
  const { buildRaceNetworkWorld } = await import('../../src/racing/RaceNetworkWorld.js');
  const { VehicleDynamicsRunner } = await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
  const { createPackedRaceWorkerEnvironmentProvider } = await import('../../src/racing/simulation/PackedRaceWorkerEnvironment.js');
  const network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: 0, z: -60, heightM: -6 }, { id: 'b', x: 0, z: 60, heightM: -6 },
      { id: 'c', x: 0, z: -60, heightM: 6 }, { id: 'd', x: 0, z: 60, heightM: 6 }],
    edges: [{ id: 'lower', from: 'a', to: 'b', structure: 'tunnel', clearanceM: 4 },
      { id: 'upper', from: 'c', to: 'd', structure: 'bridge' }], startNodeId: 'a', finishNodeId: 'b'
  });
  const bake = buildRaceNetworkWorld(network);
  const provider = createPackedRaceWorkerEnvironmentProvider({ surfaceSampler: bake.surfaceSampler,
    staticColliderDefinitions: bake.staticColliders });
  const runner = new VehicleDynamicsRunner({ config: { telemetryRetention: 'none' },
    initialState: { position: { x: 0, y: heightM + 0.55, z: -5 }, velocity: { x: 0, y: 0, z: 10 } },
    environmentProvider: request => provider(request, runner.config) });
  for (let frame = 0; frame < 60; frame++) {
    runner.advance(1 / 60);
    assert.ok(runner.state.position.y > heightM && runner.state.position.y < heightM + 1.5,
      `frame ${frame}: chassis y=${runner.state.position.y}`);
  }
  assert.ok(runner.state.position.z > 0, 'car crossed the overlapping decks');
});

test('network render meshes include every branch, structure shell, and water plane', () => {
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 0, z: 100 }, { id: 'c', x: 50, z: 50, heightM: 6 }],
    edges: [{ id: 'main', from: 'a', to: 'b' }, { id: 'bridge', from: 'a', to: 'c', structure: 'bridge' },
      { id: 'return', from: 'c', to: 'b', structure: 'bridge' }], startNodeId: 'a', finishNodeId: 'b'
  });
  editor.selectedRace.waterRegions = [{ id: 'pond', x: 20, z: 40, widthM: 20, lengthM: 20, levelM: 0.2, bottomM: -2, color: '#287fa3' }];
  const bake = editor.buildRaceWorldBake({ validate: false });
  const meshes = editor.getRaceStaticTrackSurfaceMeshes(bake, { texturesEnabled: false, useSunShading: false });
  assert.ok(meshes.roadMeshes.some(m => m.points.some(p => p.x > 40)), 'alternate branch is rendered');
  assert.ok(meshes.trackFurnitureMeshes.some(m => m.source === 'bridge:bridge'));
  assert.ok(meshes.trackFurnitureMeshes.some(m => m.source === 'water:pond' && m.opacity < 1));
});

test('junction pointer dragging preserves sampled road shape and supports undo/redo', async () => {
  const { networkPointer } = await import('../../src/ui/RaceNetworkEditor.js');
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 0, z: 200 }],
    edges: [{ id: 'road', from: 'a', to: 'b', points: [{ x: 0, z: 100 }] }], startNodeId: 'a', finishNodeId: 'b'
  });
  editor.raceMapBounds = { x: 0, y: 0, w: 800, h: 600 };
  editor.networkTool = 'network-select';
  const point = editor.raceMapWorldToScreenPoint({ x: 0, y: 0 });
  assert.equal(networkPointer(editor, { x: point.screenX, y: point.screenY }, 'down'), true);
  const scale = editor.getRaceMapTransform().scale;
  networkPointer(editor, { x: point.screenX + 20 * scale, y: point.screenY }, 'move');
  networkPointer(editor, { x: point.screenX + 20 * scale, y: point.screenY }, 'up');
  assert.ok(Math.abs(editor.selectedRace.road.network.nodes[0].x - 20) < 1e-7);
  assert.ok(Math.abs(editor.selectedRace.road.network.edges[0].points[0].x - 10) < 1e-7);
  assert.equal(editor.undoRaceHistory(), true);
  assert.equal(editor.selectedRace.road.network.nodes[0].x, 0);
  assert.equal(editor.redoRaceHistory(), true);
  assert.ok(Math.abs(editor.selectedRace.road.network.nodes[0].x - 20) < 1e-7);
});

test('water transparency uses a separate cached material from opaque roads', () => {
  const editor = new RaceEditor({});
  const renderer = {};
  const road = editor.getRaceThreeMaterial(renderer);
  const water = editor.getRaceThreeMaterial(renderer, { opacity: 0.65, depthWrite: false });
  assert.notEqual(water, road);
  assert.equal(water.transparent, true);
  assert.equal(water.opacity, 0.65);
  assert.equal(water.depthWrite, false);
  assert.equal(road.transparent, false);
  assert.equal(editor.getRaceThreeMaterial(renderer, { opacity: 0.65, depthWrite: false }), water);
});
