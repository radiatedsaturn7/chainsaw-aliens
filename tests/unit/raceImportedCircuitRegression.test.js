import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultRace} from '../../src/racing/raceData.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import * as THREE from '../../src/vendorBridge/three.js';
import { roadEdgeOverlapsRoad } from '../../src/racing/RaceRoadEdgeClearance.js';
import { buildTrackStateGroundGeometry } from '../../src/racing/trackState/TrackStateGroundMesh.js';

const makeEditor = () => new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} });

test('road edge walls leave folded and crossing road corridors clear, preserving separated edges and bridges', () => {
  const wall = { center: { x: 16, y: 2, z: 0 }, yaw: 0, size: { x: 0.4, y: 6, z: 4 } };
  const road = (x, y = 0) => ({ from: { x, y, z: -20 }, to: { x, y, z: 20 }, halfWidth: 4.5 });
  assert.equal(roadEdgeOverlapsRoad(wall, [road(0)]), false, 'original shoulder remains collidable');
  assert.equal(roadEdgeOverlapsRoad({ ...wall, center: { x: 4.7, y: 2, z: 0 } }, [road(0)]), false, 'wall touching the road boundary stays collidable');
  assert.equal(roadEdgeOverlapsRoad(wall, [road(0), road(14)]), true, 'nearby folded road remains driveable');
  assert.equal(roadEdgeOverlapsRoad(wall, [road(14, 12)]), false, 'grade-separated crossing preserves lower wall');
  assert.equal(roadEdgeOverlapsRoad({ ...wall, yaw: Math.PI / 2 }, [
    { from: { x: 0, y: 0, z: 0 }, to: { x: 30, y: 0, z: 0 }, halfWidth: 4.5 }
  ]), true, 'perpendicular crossing');
});

test('ground conditions use upward world-space triangles following terrain with transparent edges', () => {
  const geometry = buildTrackStateGroundGeometry([{ x: 10, z: 20, dirt: 0.8, elevationM: 0 }], (x, z) => x * 0.1 + z * 0.2);
  const p = geometry.getAttribute('position');
  const c = geometry.getAttribute('color');
  assert.equal(p.count, 12);
  for (let i = 0; i < p.count; i += 1) {
    assert.ok(Math.abs(p.getY(i) - (p.getX(i) * 0.1 + p.getZ(i) * 0.2 + 0.025)) < 1e-5);
    assert.ok(p.getX(i) >= 9.5 && p.getX(i) <= 10.5);
    assert.ok(p.getZ(i) >= 19.5 && p.getZ(i) <= 20.5);
    assert.equal(c.getW(i) > 0, i % 3 === 0);
  }
  for (let i = 0; i < p.count; i += 3) {
    const normalY = (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i))
      - (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i));
    assert.ok(normalY > 0);
  }
  geometry.dispose();
});

test('3D dirt patches share depth-tested material, cache geometry, and suppress the legacy camera overlay', () => {
  const editor = makeEditor();
  const cells = [{ x: 0, z: 0, dirt: 0.7 }];
  editor.getRaceTrackStateVisualCells = () => cells;
  editor.getRaceCompositedSurfaceAtWorldPoint = () => ({ elevation: 0 });
  const renderer = { scene: new THREE.Scene() };
  const stats = {};
  editor.syncRaceThreeTrackState(renderer, { stats });
  assert.equal(stats.threeTrackStateRenderer, 1);
  assert.equal(renderer.trackStateMesh.material.depthTest, true);
  assert.equal(renderer.trackStateMesh.material.depthWrite, false);
  const original = renderer.trackStateMesh.geometry;
  editor.syncRaceThreeTrackState(renderer, { stats });
  assert.equal(renderer.trackStateMesh.geometry, original);
  editor.lastRaceRenderStats = stats;
  editor.playtestSession = { trackState: {} };
  const previousDocument = globalThis.document;
  globalThis.document = {};
  editor.getRaceTrackStateVisualCells = () => { throw new Error('legacy overlay must not draw twice'); };
  try {
    assert.equal(editor.drawRaceTrackStateOverlay({}, { x: 0, y: 0, w: 400, h: 800 }, { camera: {} }), 0);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
  editor.getRaceTrackStateVisualCells = () => [];
  editor.syncRaceThreeTrackState(renderer, { stats });
  assert.equal(renderer.trackStateMesh.visible, false, 'old dirt disappears when cells are cleared');
  editor.getRaceTrackStateVisualCells = () => cells;
  editor.syncRaceThreeTrackState(renderer, { stats });
  assert.equal(renderer.trackStateMesh.visible, true);
  editor.clearRaceThreeScene(renderer);
  assert.equal(renderer.trackStateMesh, null);
});

test('frame geometry reads avoid rebuilding signatures and refresh after authored edits or explicit invalidation', () => {
  const editor = makeEditor();
  Object.assign(editor.selectedRace,createDefaultRace(editor.selectedRace.id));
  let reads = 0;
  const getNodes = editor.getRaceEditableNodes.bind(editor);
  editor.getRaceEditableNodes = (...args) => { reads++; return getNodes(...args); };
  let original;
  editor.withRaceGeometryReadCache(() => {
    original = editor.getRacePathSampleCacheSignature(4);
    for (let i = 0; i < 100; i++) assert.equal(editor.getRacePathSampleCacheSignature(4), original);
    assert.equal(reads, 1);
    editor.withRaceGeometryReadCache(() => assert.equal(editor.getRacePathSampleCacheSignature(4), original));
    assert.equal(reads, 1);
  });
  const nodes = getNodes({ create: false });
  nodes[0].x += 1;
  editor.withRaceGeometryReadCache(() => {
    assert.notEqual(editor.getRacePathSampleCacheSignature(4), original);
    nodes[0].x += 1;
    editor.clearRaceRuntimeSurfaceCaches();
    original = editor.getRacePathSampleCacheSignature(4);
  });
  assert.equal(editor.getRacePathSampleCacheSignature(4), original);
  assert.throws(() => editor.withRaceGeometryReadCache(() => { throw new Error('test'); }));
  assert.ok(!editor.raceGeometryReadCache);
});

test('saved buse1 circuit has a continuous road with no generated walls in its driving corridor', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = makeEditor();
  editor.applyLoadedRaceDocument(JSON.parse(readFileSync(new URL('../fixtures/buse1RaceDocument.json', import.meta.url))), { name: 'buse1' });
  const bake = editor.buildRaceWorldBake({ retainTerrainCells: false });
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, preparedWorldBake: bake });
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.startupFramePending = false;
  editor.updatePlaytest(0);
  const walls = editor.vehicleDynamicsAuthority.staticColliderDefinitions.filter(wall => wall.source?.startsWith('edge:'));
  assert.ok(walls.length > 0, 'retains shoulder barriers outside the road');
  const routeLength = editor.getRaceRouteLength();
  editor.withRaceGeometryReadCache(() => {
    for (let d = 0; d < routeLength; d += 1) {
      const pose = editor.getRaceWorldPoseAtDistance(d, { runtimeType: 'circuit' });
      const ground = editor.getRaceBakedSurfaceAtWorldPoint(pose);
      assert.equal(ground?.region, 'road', `road support at ${d}m`);
      for (const wall of walls) {
        const yaw = 2 * Math.atan2(wall.orientation.y, wall.orientation.w);
        const dx = pose.x - wall.center.x;
        const dz = pose.z - wall.center.z;
        const x = dx * Math.cos(yaw) - dz * Math.sin(yaw);
        const z = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        assert.ok(Math.abs(x) > wall.size.x / 2 + 3 || Math.abs(z) > wall.size.z / 2 + 3,
          `${wall.id} blocks car clearance at ${d}m`);
      }
    }
  });
});

test('route progress follows tight bends without jumping across neighboring branches', async () => {
  const { reconcileRaceRouteAdvance } = await import('../../src/racing/RaceSimulation.js');
  const base = { previousDistance: 30, predictedAdvance: 0.12, projectedDistance: 30.18,
    routeLength: 100, circuit: true, travelM: 0.2, onRoad: true };
  assert.ok(Math.abs(reconcileRaceRouteAdvance(base) - 0.18) < 1e-9);
  assert.equal(reconcileRaceRouteAdvance({ ...base, projectedDistance: 78 }), 0.12);
  assert.ok(Math.abs(reconcileRaceRouteAdvance({ ...base, projectedDistance: 31.2 }) - 1.2) < 1e-9, 'local corner projection can span more than one frame of motion');
  assert.equal(reconcileRaceRouteAdvance({ ...base, onRoad: false }), 0.12);
  assert.ok(Math.abs(reconcileRaceRouteAdvance({ ...base, previousDistance: 99.9, projectedDistance: 0.1 }) - 0.2) < 1e-9);
  assert.ok(Math.abs(reconcileRaceRouteAdvance({ ...base, previousDistance: 0.1, projectedDistance: 99.9 }) + 0.2) < 1e-9);
});
