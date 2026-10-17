import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRaceBakedSurfaceSampler, packRaceBakedSurfaceSampler, packRaceCanonicalSurfaceMesh, sampleRaceBakedSurface } from '../../src/racing/RaceBakedSurfaceSampler.js';
import { createPhysicsTerrainQueryFrameCache } from '../../src/racing/simulation/PhysicsTerrainQueryFrame.js';

function stackedMesh(layered = true) {
  const triangles = [-3, 0, 6].flatMap(heightM => {
    const corners = [[-10, -10], [10, -10], [10, 10], [-10, 10]].map(([x, z]) => ({ x, z, elevation: heightM / 12 }));
    return [[0, 2, 1], [0, 3, 2]].map(indices => ({ vertices: indices.map(i => corners[i]), region: 'road', source: `deck-${heightM}`, faceNormal: { x: 0, y: 1, z: 0 } }));
  });
  return { layered, triangles };
}
for (const format of ['objects', 'packed', 'canonical-packed']) test(`${format}: wheels above, under and between decks select reachable support`, () => {
  const mesh = stackedMesh(), raw = buildRaceBakedSurfaceSampler({ mesh });
  const sampler = format === 'objects' ? raw : format === 'packed' ? packRaceBakedSurfaceSampler(raw) : packRaceCanonicalSurfaceMesh(mesh);
  for (const [height, expected] of [[6.4, 6], [0.4, 0], [-2.6, -3], [4, 0], [12, 6], [-0.1, 0]]) {
    assert.equal(sampleRaceBakedSurface(sampler, { x: 1, y: height, z: 2 }).elevation * 12, expected);
  }
  assert.equal(sampleRaceBakedSurface(sampler, { x: 1, y: -5, z: 2 }), null);
  assert.equal(sampleRaceBakedSurface(sampler, { x: 1, z: 2, supportHeightM: -2.6 }).source, 'deck--3');
  // Explicitly 2D editor queries still see the uppermost visible surface.
  assert.equal(sampleRaceBakedSurface(sampler, { x: 1, z: 2 }).source, 'deck-6');
});
test('existing non-layered tracks retain their heightfield sampling behavior', () => {
  const sampler = packRaceCanonicalSurfaceMesh(stackedMesh(false));
  assert.equal(sampleRaceBakedSurface(sampler, { x: 1, y: -10, z: 2 }).source, 'deck-6');
});
test('physics query cache and reused wheel contacts do not alias vertically overlapping decks', () => {
  const sampler = packRaceCanonicalSurfaceMesh(stackedMesh());
  const frame = createPhysicsTerrainQueryFrameCache().begin({ sampler, elevationScaleM: 12,
    revision: 1, bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 } });
  const upper = frame.samplePoint({ x: 1, y: 6.4, z: 1 });
  const upperId = upper.triangleId;
  assert.equal(upper.heightM, 6);
  assert.equal(frame.samplePoint({ x: 1, y: -2.6, z: 1 }).heightM, -3);
  assert.equal(frame.samplePointOnTriangle({ x: 1, y: -2.6, z: 1 }, upperId).heightM, -3);
});
