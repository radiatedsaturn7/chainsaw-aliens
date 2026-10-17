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

test('tunnel ramps excavate entrances while preserving terrain above buried sections', async () => {
  const { buildRaceNetworkWorld } = await import('../../src/racing/RaceNetworkWorld.js');
  const { sampleRaceBakedSurface } = await import('../../src/racing/RaceBakedSurfaceSampler.js');
  const network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'start', x: 0, z: -80 }, { id: 'finish', x: 0, z: 80 }],
    edges: [{ id: 'tunnel', from: 'start', to: 'finish', structure: 'tunnel', clearanceM: 4,
      points: [{ x: 0, z: -20, heightM: -6 }, { x: 0, z: 20, heightM: -6 }] }],
    startNodeId: 'start', finishNodeId: 'finish'
  });
  const bake = buildRaceNetworkWorld(network);
  for (const x of [-1, 0, 1]) {
    let support = 0;
    for (let z = -80; z <= 80; z += 0.5) {
      const expected = z < -20 ? -(z + 80) / 10 : z > 20 ? (z - 80) / 10 : -6;
      const sample = sampleRaceBakedSurface(bake.surfaceSampler, { x, z, y: support + 0.4 });
      assert.ok(sample, `missing support at ${x}, ${z}`);
      support = sample.elevation * 12;
      assert.ok(Math.abs(support - expected) < 0.1, `portal blocked at ${x}, ${z}: floor=${expected}, support=${support}`);
    }
  }
  assert.equal(sampleRaceBakedSurface(bake.surfaceSampler, { x: 0, z: 0, y: 0.4 }).elevation, 0,
    'buried tunnel retains upper terrain');
});

test('editor initial wheel contacts and physics queries respect a tunnel below another deck', () => {
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: 0, z: 0, heightM: -6 }, { id: 'b', x: 0, z: 100, heightM: -6 },
      { id: 'c', x: -50, z: 0, heightM: 6 }, { id: 'd', x: 50, z: 0, heightM: 6 }],
    edges: [{ id: 'lower', from: 'a', to: 'b', structure: 'tunnel', clearanceM: 4 },
      { id: 'upper', from: 'c', to: 'd', structure: 'bridge' }], startNodeId: 'a', finishNodeId: 'b'
  });
  editor.raceWorldBakeCache = editor.buildRaceWorldBake({ validate: false });
  assert.equal(editor.getRaceRoadSurfaceProfileAtDistance(0).elevation * 12, -6);
  const session = { worldX: 0, worldZ: 0, heightM: -6, carYaw: 0, grounded: true };
  const contacts = editor.getRaceWheelContactState({ session });
  assert.ok(Math.abs(contacts.averageHeightM + 6) < 1e-6, `initial contacts: ${contacts.averageHeightM}`);
  const geometry = editor.getRaceSurfaceModel().samplePhysicsGeometry({ x: 0, y: -5.5, z: 0 });
  assert.ok(Math.abs(geometry.heightM + 6) < 1e-6, `physics support: ${geometry.heightM}`);
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, preparedWorldBake: editor.raceWorldBakeCache });
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.startupFramePending = false;
  editor.updatePlaytest(0);
  const y = editor.vehicleDynamicsAuthority.runner.state.position.y;
  assert.ok(y > -6 && y < -4.5, `actual playtest initialized on wrong deck: ${y}`);
});

test('a moving vehicle enters a tunnel ramp from ground level without riding over the terrain', async () => {
  const { buildRaceNetworkWorld } = await import('../../src/racing/RaceNetworkWorld.js');
  const { VehicleDynamicsRunner } = await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
  const { createPackedRaceWorkerEnvironmentProvider } = await import('../../src/racing/simulation/PackedRaceWorkerEnvironment.js');
  const network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'start', x: 0, z: -80 }, { id: 'finish', x: 0, z: 80 }],
    edges: [{ id: 'tunnel', from: 'start', to: 'finish', structure: 'tunnel', clearanceM: 4,
      points: [{ x: 0, z: -20, heightM: -6 }, { x: 0, z: 20, heightM: -6 }] }],
    startNodeId: 'start', finishNodeId: 'finish'
  });
  const bake = buildRaceNetworkWorld(network);
  const provider = createPackedRaceWorkerEnvironmentProvider({ surfaceSampler: bake.surfaceSampler,
    staticColliderDefinitions: bake.staticColliders });
  const runner = new VehicleDynamicsRunner({ config: { telemetryRetention: 'none' },
    initialState: { position: { x: 0, y: 0.55, z: -80 }, velocity: { x: 0, y: 0, z: 22 } },
    environmentProvider: request => provider(request, runner.config) });
  for (let frame = 0; frame < 180; frame++) runner.advance(1 / 60);
  assert.ok(runner.state.position.z > -25, `vehicle blocked at portal: ${runner.state.position.z}`);
  assert.ok(runner.state.position.y < -4.5 && runner.state.position.y > -6.1,
    `vehicle did not reach tunnel floor: ${runner.state.position.y}`);
});

test('alternate branch wheel queries use that branch width, height, and surface', () => {
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 0, z: 200 }, { id: 'c', x: 60, z: 100, heightM: 3 }],
    edges: [{ id: 'main', from: 'a', to: 'b', widthM: 4, surface: 'asphalt' },
      { id: 'up', from: 'a', to: 'c', widthM: 18, surface: 'dirt', structure: 'bridge' },
      { id: 'down', from: 'c', to: 'b', widthM: 18, surface: 'dirt', structure: 'bridge' }],
    startNodeId: 'a', finishNodeId: 'b'
  });
  editor.raceWorldBakeCache = editor.buildRaceWorldBake({ validate: false });
  const point = { x: 30 + Math.cos(Math.atan2(60, 100)) * 6, z: 50 - Math.sin(Math.atan2(60, 100)) * 6, y: 1.9 };
  for (const sample of [editor.getRaceSurfaceModel().sampleWorld(point, 0, { physicsContact: true }),
    editor.getRaceSurfaceModel().samplePhysicsGeometry(point)]) {
    assert.equal(sample.region, 'road');
    assert.equal(sample.surfaceId, 'dirt');
    assert.ok(Math.abs(sample.elevation * 12 - 1.5) < 0.02);
  }
});

test('packed worker surface preserves different grip on alternate routes', async () => {
  const { buildRaceNetworkWorld } = await import('../../src/racing/RaceNetworkWorld.js');
  const { createPackedRaceWorkerEnvironmentProvider } = await import('../../src/racing/simulation/PackedRaceWorkerEnvironment.js');
  const { VehicleDynamicsRunner } = await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
  const { prepareRaceVehicleDynamicsWorkerSurface } = await import('../../src/racing/simulation/RaceVehicleDynamicsWorkerBridge.js');
  const network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: 0, z: -50 }, { id: 'b', x: 0, z: 50 }, { id: 'c', x: 40, z: -50 }, { id: 'd', x: 40, z: 50 }],
    edges: [{ id: 'main', from: 'a', to: 'b', surface: 'asphalt' }, { id: 'branch', from: 'c', to: 'd', surface: 'dirt' }],
    startNodeId: 'a', finishNodeId: 'b'
  });
  const bake = buildRaceNetworkWorld(network);
  const provider = createPackedRaceWorkerEnvironmentProvider({ surfaceSampler: prepareRaceVehicleDynamicsWorkerSurface(bake.surfaceSampler) });
  const runner = new VehicleDynamicsRunner({ initialState: { position: { x: 40, y: 0.55, z: 0 } } });
  const offMain = provider({ state: runner.state, controls: {}, reuseContactGeometry: false }, runner.config);
  assert.equal(offMain.materialByWheel.fl.surfaceId, 'dirt');
  assert.equal(offMain.materialByWheel.fl.grip, 0.72);
  runner.state.position.x = 0;
  const main = provider({ state: runner.state, controls: {}, reuseContactGeometry: false }, runner.config);
  assert.equal(main.materialByWheel.fl.surfaceId, 'asphalt');
  assert.equal(main.materialByWheel.fl.grip, 1);
});

for (const heightM of [-6, 6]) test(`delayed recovery stays on the alternate ${heightM}m deck`, () => {
  const editor = new RaceEditor({});
  editor.selectedRace.road.network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: 0, z: -60 }, { id: 'b', x: 0, z: 60 },
      { id: 'c', x: 40, z: -60, heightM }, { id: 'd', x: 40, z: 60, heightM },
      { id: 'e', x: 20, z: 10, heightM: -heightM }, { id: 'f', x: 60, z: 10, heightM: -heightM }],
    edges: [{ id: 'main', from: 'a', to: 'b' },
      { id: 'branch', from: 'c', to: 'd', structure: heightM < 0 ? 'tunnel' : 'bridge' },
      { id: 'crossing', from: 'e', to: 'f', structure: heightM < 0 ? 'bridge' : 'tunnel' }],
    startNodeId: 'a', finishNodeId: 'b'
  });
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  editor.updatePlaytestSafely(0);
  const session = editor.playtestSession;
  const runner = session.vehicleDynamicsRunner;
  runner.state.position = { x: 42, y: heightM + 0.55, z: 10 };
  session.worldX = 42; session.worldZ = 10; session.bodyY = heightM + 0.55; session.heightM = heightM;
  session.vehicleRenderState = { ...session.vehicleRenderState, position: { ...runner.state.position } };
  editor.resetRaceCarToRouteCenter({ projection: { distance: 70 }, reason: 'select-hold-reset' });
  assert.equal(session.pendingEdgeCenterReset.networkProjection?.edgeId, 'branch');
  session.edgeResetFadeMs = 1;
  editor.updateRaceEdgeCenterResetFade();
  assert.equal(session.pendingEdgeCenterReset?.moved, true);
  assert.ok(Math.abs(runner.state.position.x - 40) < 0.01, `reset changed branches: x=${runner.state.position.x}`);
  assert.ok(Math.abs(runner.state.position.z - 10) < 0.01);
  assert.ok(runner.state.position.y > heightM && runner.state.position.y < heightM + 1,
    `reset changed decks: y=${runner.state.position.y}`);
  assert.equal(runner.state.supportedWheelCount, 4);
  assert.deepEqual(session.networkPreviousPosition, { x: 40, z: 10, heightM });
});
