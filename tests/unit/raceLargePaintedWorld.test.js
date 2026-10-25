import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRaceRouteNetwork } from '../../src/racing/RaceRouteNetwork.js';
import { buildRaceNetworkWorld } from '../../src/racing/RaceNetworkWorld.js';

test('large painted terrain appends vertices without exceeding JavaScript argument limits', () => {
  const network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'start', x: 0, z: 0 }, { id: 'finish', x: 0, z: 200 }],
    edges: [{ id: 'road', from: 'start', to: 'finish', widthM: 10 }],
    startNodeId: 'start', finishNodeId: 'finish'
  });
  const paintedCells = [];
  for (let z = -160; z < 360; z += 4) for (let x = -160; x < 160; x += 4) paintedCells.push({ x, z });
  const bake = buildRaceNetworkWorld(network, {
    tileSizeM: 1, paintedCells, buildSurfaceSampler: false, retainTerrainCells: false
  });
  assert.ok(bake.mesh.vertices.length > 160000);
  assert.equal(bake.mesh.normals.length, bake.mesh.vertices.length);
  assert.equal(bake.mesh.stats.vertices, bake.mesh.vertices.length);
  assert.equal(bake.mesh.stats.triangles, bake.mesh.triangles.length);
  for (const triangle of bake.mesh.triangles) {
    assert.ok(triangle.indices.every(i => Number.isInteger(i) && i >= 0 && i < bake.mesh.vertices.length));
  }
  assert.ok(bake.mesh.groups.terrain.length > 0);
});
