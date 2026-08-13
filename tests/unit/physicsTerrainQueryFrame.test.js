import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRaceBakedSurfaceSampler } from '../../src/racing/RaceBakedSurfaceSampler.js';
import {
  createPhysicsTerrainQueryFrameCache
} from '../../src/racing/simulation/PhysicsTerrainQueryFrame.js';
import { RaceSurfaceModel } from '../../src/racing/RaceSurfaceModel.js';

function createSlopedSampler() {
  return buildRaceBakedSurfaceSampler({
    elevationScaleM: 1,
    bucketSizeM: 4,
    mesh: {
      triangles: [
        {
          region: 'road',
          source: 'road-a',
          vertices: [
            { x: 0, elevation: 0, z: 0 },
            { x: 10, elevation: 1, z: 0 },
            { x: 10, elevation: 1, z: 10 }
          ]
        },
        {
          region: 'road',
          source: 'road-b',
          vertices: [
            { x: 0, elevation: 0, z: 0 },
            { x: 10, elevation: 1, z: 10 },
            { x: 0, elevation: 0, z: 10 }
          ]
        }
      ]
    }
  });
}

test('one terrain query frame batches prepared geometry and caches its local triangle set', () => {
  const sampler = createSlopedSampler();
  const cache = createPhysicsTerrainQueryFrameCache({ resultCapacity: 8 });
  const frame = cache.begin({
    sampler,
    revision: 4,
    elevationScaleM: 1,
    bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }
  });
  const samples = frame.samplePoints([
    { x: 0.5, z: 0.25 },
    { x: 1.5, z: 1.25 },
    { x: 1.5, z: 1.25 }
  ]);

  assert.equal(samples.every((sample) => sample.valid), true);
  assert.ok(Math.abs(samples[0].heightM - 0.05) < 1e-12);
  assert.ok(Math.abs(samples[1].heightM - 0.15) < 1e-12);
  assert.equal(frame.statistics.bucketDiscoveries, 1);
  assert.equal(frame.statistics.pointCacheHits, 1);
  assert.ok(frame.localTriangleIndices instanceof Uint32Array);
  assert.ok(frame.lastBatch.pointXZ instanceof Float64Array);
  assert.ok(frame.lastBatch.heightM instanceof Float64Array);
  assert.ok(frame.lastBatch.normalXYZ instanceof Float64Array);
  assert.ok(frame.lastBatch.triangleId instanceof Int32Array);
  assert.deepEqual([...frame.lastBatch.valid.subarray(0, 3)], [1, 1, 1]);

  const retainedBatch = samples;
  const nextBatch = frame.samplePoints([{ x: 0.25, z: 0.25 }]);
  assert.notEqual(nextBatch, retainedBatch);
  assert.equal(retainedBatch.length, 3);
  const packed = new Float64Array([
    0.75, 0, 0.5,
    1.25, 0, 0.5
  ]);
  const packedSamples = frame.samplePackedPoints(packed, 2);
  assert.ok(Math.abs(packedSamples[0].heightM - 0.075) < 1e-12);
  assert.ok(Math.abs(packedSamples[1].heightM - 0.125) < 1e-12);

  cache.begin({
    sampler,
    revision: 4,
    elevationScaleM: 1,
    bounds: { minX: 0.25, maxX: 2.25, minZ: 0.25, maxZ: 2.25 }
  });
  assert.equal(frame.statistics.cacheHit, true);
  cache.begin({
    sampler,
    revision: 5,
    elevationScaleM: 1,
    bounds: { minX: 0.25, maxX: 2.25, minZ: 0.25, maxZ: 2.25 }
  });
  assert.equal(frame.statistics.cacheHit, false);
});

test('maximum height clips triangles to query bounds and segment sweep reuses their vertices', () => {
  const sampler = createSlopedSampler();
  const frame = createPhysicsTerrainQueryFrameCache().begin({
    sampler,
    revision: 1,
    elevationScaleM: 1,
    bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }
  });

  assert.ok(Math.abs(frame.maximumHeightInBounds({
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1
  }) - 0.1) < 1e-12);

  const hit = frame.segmentTriangleSweep(
    { x: 0.5, y: 2, z: 0.5 },
    { x: 0.5, y: -1, z: 0.5 }
  );
  assert.equal(hit.hit, true);
  assert.ok(Math.abs(hit.point.y - 0.05) < 1e-12);
  assert.ok(hit.fraction > 0 && hit.fraction < 1);
  assert.ok(Number.isInteger(hit.triangleId));

  let firstView = null;
  let viewCount = 0;
  let reusedView = true;
  frame.forEachTriangleInBounds(frame.bounds, (view) => {
    firstView ||= view;
    reusedView &&= view === firstView;
    if (sampler.packed) {
      assert.equal(view.positions, sampler.positions);
      assert.equal(view.positionOffset, view.index * 9);
    } else {
      assert.equal(view.triangle, sampler.triangles[view.index]);
    }
    viewCount += 1;
  });
  assert.ok(viewCount >= 2);
  assert.equal(reusedView, true);
});

test('RaceSurfaceModel geometry-only batches consume the shared prepared frame', () => {
  let routeProjectionCalls = 0;
  const model = new RaceSurfaceModel({
    elevationScaleM: 1,
    projectWorldToTrack: () => {
      routeProjectionCalls += 1;
      return null;
    }
  });
  const frame = createPhysicsTerrainQueryFrameCache().begin({
    sampler: createSlopedSampler(),
    revision: 1,
    elevationScaleM: 1,
    bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }
  });
  const samples = model.samplePhysicsGeometryBatch([
    { x: 0.5, z: 0.5 },
    { x: 1.5, z: 0.5 }
  ], {
    physicsTerrainQueryFrame: frame,
    geometryOnly: true
  });

  assert.equal(routeProjectionCalls, 0);
  assert.ok(Math.abs(samples[0].heightM - 0.05) < 1e-12);
  assert.ok(Math.abs(samples[1].heightM - 0.15) < 1e-12);
  assert.equal(frame.statistics.batchQueries, 1);
});

test('local triangle growth preserves early faces and keeps point queries on the fine grid', () => {
  const triangles = [];
  for (let zIndex = 0; zIndex < 10; zIndex += 1) {
    for (let xIndex = 0; xIndex < 15; xIndex += 1) {
      const x = xIndex * 0.5;
      const z = zIndex * 0.5;
      triangles.push({
        region: 'road',
        source: `tile-${xIndex}-${zIndex}-a`,
        vertices: [
          { x, elevation: 0, z },
          { x: x + 0.5, elevation: 0, z },
          { x: x + 0.5, elevation: 0, z: z + 0.5 }
        ]
      }, {
        region: 'road',
        source: `tile-${xIndex}-${zIndex}-b`,
        vertices: [
          { x, elevation: 0, z },
          { x: x + 0.5, elevation: 0, z: z + 0.5 },
          { x, elevation: 0, z: z + 0.5 }
        ]
      });
    }
  }
  const sampler = buildRaceBakedSurfaceSampler({
    elevationScaleM: 1,
    bucketSizeM: 8,
    mesh: { triangles }
  });
  const frame = createPhysicsTerrainQueryFrameCache().begin({
    sampler,
    revision: 1,
    elevationScaleM: 1,
    bounds: { minX: 0, maxX: 7.5, minZ: 0, maxZ: 5 }
  });
  const earlyTriangleId = 34;
  assert.equal(frame.localTriangleIndices.includes(earlyTriangleId), true);
  const sample = frame.samplePoint({ x: 1.1, z: 0.6 });
  assert.equal(sample.valid, true);
  assert.equal(frame.statistics.pointQueries, 1,
    'a populated fine-grid cell must not recurse into the full baked bucket');
});
