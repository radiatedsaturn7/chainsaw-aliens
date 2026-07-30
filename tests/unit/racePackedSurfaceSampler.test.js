import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRaceBakedSurfaceSampler,
  packRaceCanonicalSurfaceMesh,
  packRaceBakedSurfaceSampler,
  sampleRaceBakedSurface
} from '../../src/racing/RaceBakedSurfaceSampler.js';

test('packed race surface sampler preserves object sampler results', () => {
  const terrainCells = [{
    key: 'terrain:0',
    points: [
      { x: 0, z: 0, elevation: 0, terrainRegion: 'terrain' },
      { x: 5, z: 0, elevation: 0.1, terrainRegion: 'terrain' },
      { x: 5, z: 5, elevation: 0.2, terrainRegion: 'terrain' },
      { x: 0, z: 5, elevation: 0.1, terrainRegion: 'terrain' }
    ]
  }];
  const objectSampler = buildRaceBakedSurfaceSampler({
    terrainCells,
    elevationScaleM: 12,
    bucketSizeM: 5
  });
  const packedSampler = packRaceBakedSurfaceSampler(objectSampler);
  const objectSample = sampleRaceBakedSurface(
    objectSampler,
    { x: 2.5, z: 2.5 },
    { preferredRegion: 'terrain' }
  );
  const packedSample = sampleRaceBakedSurface(
    packedSampler,
    { x: 2.5, z: 2.5 },
    { preferredRegion: 'terrain' }
  );

  assert.equal(packedSampler.packed, true);
  assert.equal(packedSampler.version, 2);
  assert.equal(packedSampler.positions instanceof Float64Array, true);
  assert.equal(packedSampler.normals instanceof Float64Array, true);
  assert.equal(packedSampler.bounds instanceof Float64Array, true);
  assert.equal(packedSampler.triangleCount, objectSampler.triangleCount);
  assert.ok(packedSample);
  assert.equal(packedSample.elevation, objectSample.elevation);
  assert.equal(packedSample.region, objectSample.region);
  assert.deepEqual(packedSample.normal, objectSample.normal);
});

test('canonical mesh packing matches the object sampler without allocating an intermediate sampler', () => {
  const vertices = [
    { x: 0, z: 0, elevation: 0 },
    { x: 5, z: 0, elevation: 0.1 },
    { x: 5, z: 5, elevation: 0.2 },
    { x: 0, z: 5, elevation: 0.1 }
  ];
  const mesh = {
    vertices,
    triangles: [
      {
        indices: [0, 1, 2],
        vertices: [vertices[0], vertices[1], vertices[2]],
        region: 'terrain',
        source: 'terrain:0',
        faceNormal: { x: -0.19245008972987523, y: 0.9622504486493761, z: -0.19245008972987523 }
      },
      {
        indices: [0, 2, 3],
        vertices: [vertices[0], vertices[2], vertices[3]],
        region: 'terrain',
        source: 'terrain:1',
        faceNormal: { x: -0.19245008972987523, y: 0.9622504486493761, z: -0.19245008972987523 }
      }
    ]
  };
  const objectSampler = buildRaceBakedSurfaceSampler({
    mesh,
    elevationScaleM: 12,
    bucketSizeM: 5
  });
  const packedObjectSampler = packRaceBakedSurfaceSampler(objectSampler);
  const packedMeshSampler = packRaceCanonicalSurfaceMesh(mesh, {
    elevationScaleM: 12,
    bucketSizeM: 5
  });

  assert.deepEqual(Array.from(packedMeshSampler.positions), Array.from(packedObjectSampler.positions));
  assert.deepEqual(Array.from(packedMeshSampler.normals), Array.from(packedObjectSampler.normals));
  assert.deepEqual(Array.from(packedMeshSampler.bounds), Array.from(packedObjectSampler.bounds));
  assert.deepEqual(Array.from(packedMeshSampler.regions), Array.from(packedObjectSampler.regions));
  assert.deepEqual(Array.from(packedMeshSampler.sources), Array.from(packedObjectSampler.sources));
  assert.deepEqual(Array.from(packedMeshSampler.priorities), Array.from(packedObjectSampler.priorities));
  assert.deepEqual(Array.from(packedMeshSampler.bucketCoords), Array.from(packedObjectSampler.bucketCoords));
  assert.deepEqual(Array.from(packedMeshSampler.bucketOffsets), Array.from(packedObjectSampler.bucketOffsets));
  assert.deepEqual(Array.from(packedMeshSampler.bucketTriangles), Array.from(packedObjectSampler.bucketTriangles));

  const objectSample = sampleRaceBakedSurface(
    packedObjectSampler,
    { x: 2.5, z: 2.5 },
    { preferredRegion: 'terrain' }
  );
  const meshSample = sampleRaceBakedSurface(
    packedMeshSampler,
    { x: 2.5, z: 2.5 },
    { preferredRegion: 'terrain' }
  );
  assert.deepEqual(meshSample, objectSample);
});
