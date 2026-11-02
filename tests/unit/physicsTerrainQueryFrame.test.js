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

test('wheel terrain samples retain distinct mutable ownership across a packed batch', () => {
  const frame = createPhysicsTerrainQueryFrameCache({ resultCapacity: 16 }).begin({
    sampler: createSlopedSampler(),
    revision: 9,
    elevationScaleM: 1,
    bounds: { minX: 0, maxX: 4, minZ: 0, maxZ: 4 }
  });
  const coordinates = new Float64Array([
    0.5, 0, 0.5,
    1.0, 0, 0.5,
    0.5, 0, 1.0,
    1.0, 0, 1.0
  ]);
  const samples = frame.samplePackedPoints(coordinates, 4);
  const originals = structuredClone(samples);
  for (let wheelIndex = 0; wheelIndex < samples.length; wheelIndex += 1) {
    for (let otherIndex = 0; otherIndex < samples.length; otherIndex += 1) {
      if (wheelIndex === otherIndex) continue;
      assert.notEqual(samples[wheelIndex], samples[otherIndex]);
      assert.notEqual(samples[wheelIndex].normal, samples[otherIndex].normal);
    }
    samples[wheelIndex].heightM += 100 + wheelIndex;
    samples[wheelIndex].normal.x += 10 + wheelIndex;
    for (let otherIndex = wheelIndex + 1; otherIndex < samples.length; otherIndex += 1) {
      assert.deepEqual(samples[otherIndex], originals[otherIndex]);
    }
  }
  const next = frame.samplePackedPoints(coordinates, 4);
  assert.deepEqual(next, originals);
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

test('pooled body support reuses its contact triangle and refreshes after triangle exit', () => {
  const frame = createPhysicsTerrainQueryFrameCache().begin({
    sampler: createSlopedSampler(),
    revision: 1,
    elevationScaleM: 1,
    bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }
  });
  const entry = {
    candidate: { id: 'underbody-center' },
    worldPoint: { x: 2, y: 1, z: 1 },
    contactTriangleCandidateId: null,
    contactTriangleId: null
  };
  const first = frame.sampleSupportEntries([entry])[0];
  const fullQueriesAfterFirst = frame.statistics.pointQueries;
  entry.worldPoint.x = 2.1;
  entry.worldPoint.z = 1.05;
  const reused = frame.sampleSupportEntries([entry])[0];
  const reusedHeightM = reused.heightM;
  const fullQueriesAfterReuse = frame.statistics.pointQueries;
  entry.worldPoint.x = 1;
  entry.worldPoint.z = 2;
  const refreshed = frame.sampleSupportEntries([entry])[0];

  assert.equal(first.valid, true);
  assert.ok(Math.abs(reusedHeightM - 0.21) < 1e-12);
  assert.equal(fullQueriesAfterReuse, fullQueriesAfterFirst);
  assert.equal(refreshed.valid, true);
  assert.ok(frame.statistics.pointQueries > fullQueriesAfterFirst);
  assert.ok(frame.statistics.analyticContactPlaneQueries >= 2);
});

test('RaceSurfaceModel batches consume the shared prepared frame without an opt-in hint', () => {
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
    physicsTerrainQueryFrame: frame
  });

  assert.equal(routeProjectionCalls, 0);
  assert.ok(Math.abs(samples[0].heightM - 0.05) < 1e-12);
  assert.ok(Math.abs(samples[1].heightM - 0.15) < 1e-12);
  assert.equal(frame.statistics.batchQueries, 1);
});

test('prepared edge classifications are reused when a vehicle revisits a bucket range', () => {
  const cache = createPhysicsTerrainQueryFrameCache();
  const sampler = createSlopedSampler();
  const first = cache.begin({
    sampler,
    revision: 1,
    elevationScaleM: 1,
    bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }
  });
  const firstEdges = first.cache.discontinuityEdges;
  const firstCounts = first.cache.edgeClassificationCounts;
  cache.begin({
    sampler,
    revision: 1,
    elevationScaleM: 1,
    bounds: { minX: 8, maxX: 10, minZ: 8, maxZ: 10 }
  });
  const revisited = cache.begin({
    sampler,
    revision: 1,
    elevationScaleM: 1,
    bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }
  });

  assert.equal(revisited.cache.discontinuityEdges, firstEdges);
  assert.equal(revisited.cache.edgeClassificationCounts, firstCounts);
  assert.equal(revisited.cache.edgeClassificationsByBucketRange.size, 2);
});

test('smooth road apron and terrain transition share one driveable support family', () => {
  const sampler = buildRaceBakedSurfaceSampler({
    elevationScaleM: 1,
    bucketSizeM: 8,
    mesh: {
      triangles: [{
        region: 'road', source: 'road:12',
        vertices: [
          { x: 0, elevation: 0, z: 0 },
          { x: 2, elevation: 0.1, z: 0 },
          { x: 2, elevation: 0.1, z: 2 }
        ]
      }, {
        region: 'transition', source: 'corridor:right:12:5',
        vertices: [
          { x: 0, elevation: 0, z: 0 },
          { x: 2, elevation: 0.1, z: 2 },
          { x: 0, elevation: 0, z: 2 }
        ]
      }, {
        region: 'transition', source: 'corridor:right:12:6',
        vertices: [
          { x: 2, elevation: 0.1, z: 0 },
          { x: 2.2, elevation: 1.2, z: 0 },
          { x: 2, elevation: 0.1, z: 2 }
        ]
      }]
    }
  });
  const frame = createPhysicsTerrainQueryFrameCache().begin({
    sampler, revision: 1, elevationScaleM: 1,
    bounds: { minX: 0, maxX: 2.2, minZ: 0, maxZ: 2 }
  });
  const road = structuredClone(frame.samplePoint({ x: 1.5, z: 0.25 }));
  const apronTransition = structuredClone(frame.samplePoint({ x: 0.5, z: 1.5 }));
  const sharpFace = structuredClone(frame.samplePoint({ x: 2.05, z: 0.5 }));

  assert.equal(road.supportFamilyId, apronTransition.supportFamilyId);
  assert.equal(road.supportFamilyDriveable, true);
  assert.equal(apronTransition.supportFamilyDriveable, true);
  assert.equal(apronTransition.supportEdgeClassification, 'smooth-connected-surface');
  assert.notEqual(sharpFace.supportFamilyId, road.supportFamilyId);
  assert.equal(sharpFace.supportFamilyDriveable, false);
  assert.equal(frame.classifyCollisionFeaturesInBounds({
    minX: 1.95, maxX: 2.15, minY: 0, maxY: 1.3, minZ: 0, maxZ: 2
  }).discontinuity, true);

  const roadOnly = createPhysicsTerrainQueryFrameCache().begin({
    sampler, revision: 1, elevationScaleM: 1,
    bounds: { minX: 1.2, maxX: 1.9, minZ: 0.1, maxZ: 0.8 }
  }).samplePoint({ x: 1.5, z: 0.25 });
  const transitionOnly = createPhysicsTerrainQueryFrameCache().begin({
    sampler, revision: 1, elevationScaleM: 1,
    bounds: { minX: 0.1, maxX: 0.8, minZ: 1.2, maxZ: 1.9 }
  }).samplePoint({ x: 0.5, z: 1.5 });
  assert.equal(roadOnly.supportFamilyId, transitionOnly.supportFamilyId,
    'support identity must not depend on the local query-frame bucket range');
  assert.equal(transitionOnly.supportFamilyDriveable, true);
});

test('driveable sharp boundary is never silently classified as smooth support', () => {
  const sampler = buildRaceBakedSurfaceSampler({
    elevationScaleM: 1,
    bucketSizeM: 8,
    mesh: { triangles: [{
      region: 'road', source: 'road:lower', vertices: [
        { x: 0, elevation: 0, z: 0 }, { x: 2, elevation: 0, z: 0 },
        { x: 2, elevation: 0, z: 2 }
      ]
    }, {
      region: 'road', source: 'road:sharp-rise', vertices: [
        { x: 0, elevation: 0, z: 0 }, { x: 2, elevation: 0, z: 2 },
        { x: 0, elevation: 2, z: 2 }
      ]
    }] }
  });
  const frame = createPhysicsTerrainQueryFrameCache().begin({
    sampler, revision: 1, elevationScaleM: 1,
    bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }
  });
  const lower = frame.samplePoint({ x: 1.6, z: 0.2 });
  assert.equal(lower.supportFamilyDriveable, true);
  assert.equal(lower.supportEdgeClassification, 'sharp-dihedral-edge');
  assert.equal(frame.classifyCollisionFeaturesInBounds({
    minX: 0, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2
  }).discontinuity, true);
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


test('long drives bound edge caches and rebuild identical classifications after eviction', () => {
  const cache = createPhysicsTerrainQueryFrameCache();
  const sampler = buildRaceBakedSurfaceSampler({ elevationScaleM: 1, bucketSizeM: 4,
    mesh: { triangles: [{ region: 'wall', source: 'test-wall', vertices: [
      { x: 0, elevation: 0, z: 0 }, { x: 0, elevation: 2, z: 0 }, { x: 0, elevation: 0, z: 2 }
    ] }] } });
  const begin = x => cache.begin({ sampler, revision: 1, elevationScaleM: 1,
    bounds: { minX: x, maxX: x + 2, minZ: 0, maxZ: 2 } });
  begin(0);
  const original = structuredClone({ edges: cache.discontinuityEdges, counts: cache.edgeClassificationCounts });
  assert.ok(original.edges.length > 0);
  const firstKey = cache.edgeClassificationsByBucketRange.keys().next().value;
  for (let i = 1; i <= 300; i++) begin(i * 8);
  assert.equal(cache.edgeClassificationsByBucketRange.size, 128);
  assert.equal(cache.edgeClassificationsByBucketRange.has(firstKey), false);
  begin(0);
  assert.deepEqual(structuredClone({ edges: cache.discontinuityEdges, counts: cache.edgeClassificationCounts }), original);
  assert.equal(cache.edgeClassificationsByBucketRange.size, 128);
  assert.equal(cache.edgeClassificationsByBucketRange.has(firstKey), true);
});

test('rocking across a terrain bucket boundary reuses the guard band without changing samples', () => {
  const sampler = createSlopedSampler();
  const cache = createPhysicsTerrainQueryFrameCache();
  let discoveries = 0;
  for (let index = 0; index < 120; index++) {
    const x = index % 2 ? 3.99 : 4.01;
    const bounds = { minX: x, maxX: x + 1, minZ: 2, maxZ: 3 };
    const frame = cache.begin({ sampler, revision: 1, bounds });
    discoveries += frame.statistics.bucketDiscoveries;
    const reference = createPhysicsTerrainQueryFrameCache().begin({ sampler, revision: 1, bounds });
    const point = { x: x + .2, y: 2, z: 2.5 };
    assert.deepEqual(frame.samplePoint(point), reference.samplePoint(point));
  }
  assert.equal(discoveries, 1, 'stationary jitter must not repeatedly rebuild the local grid');
  cache.begin({ sampler, revision: 2, bounds: { minX: 4, maxX: 5, minZ: 2, maxZ: 3 } });
  assert.equal(cache.frame.statistics.cacheHit, false, 'edited geometry must invalidate the cache');
});


test('exact terrain contacts survive steps but invalidate on revision, sampler and scale changes', () => {
  const cache = createPhysicsTerrainQueryFrameCache();
  const options = { sampler: createSlopedSampler(), revision: 1, elevationScaleM: 1,
    bounds: { minX: 0, maxX: 4, minZ: 0, maxZ: 4 } };
  const point = { x: 1, z: 1 };
  let frame = cache.begin(options);
  frame.samplePoint(point);
  frame = cache.begin(options);
  assert.ok(Math.abs(frame.samplePoint(point).heightM - 0.1) < 1e-10);
  assert.equal(frame.statistics.pointCacheHits, 1);
  for (const change of [{ revision: 2 }, { elevationScaleM: 2 }, { sampler: createSlopedSampler() }]) {
    Object.assign(options, change);
    frame = cache.begin(options);
    const sample = frame.samplePoint(point);
    assert.equal(frame.statistics.pointCacheHits, 0);
    assert.ok(Math.abs(sample.heightM - 0.1 * options.elevationScaleM) < 1e-10);
  }
});

test('nearby cars share prepared edges, while batches remain private and lazy', () => {
  const a = createPhysicsTerrainQueryFrameCache();
  const b = createPhysicsTerrainQueryFrameCache();
  const options = { sampler: createSlopedSampler(), revision: 1,
    bounds: { minX: 0, maxX: 4, minZ: 0, maxZ: 4 } };
  const fa = a.begin(options), fb = b.begin(options);
  assert.equal(fa.batchBuffers.length, 0);
  assert.equal(fa.bodySupportBatch, null);
  assert.equal(a.discontinuityEdges, b.discontinuityEdges);
  assert.equal(a.edgeClassificationsByBucketRange, b.edgeClassificationsByBucketRange);
  const points = Array.from({ length: 40 }, (_, i) => ({ x: i / 10, z: 1 }));
  const samples = fa.samplePoints(points);
  assert.equal(samples.length, 40);
  assert.ok(samples.every(sample => sample.valid));
  assert.equal(fb.batchBuffers.length, 0);
  assert.notEqual(fa.samplePoints([{ x: 2, z: 2 }]), samples);
  assert.equal(samples.length, 40);
  b.begin({ ...options, revision: 2 });
  assert.notEqual(a.edgeClassificationsByBucketRange, b.edgeClassificationsByBucketRange);
});

test('ordered terrain feature scan agrees with exhaustive bounds checks', () => {
  const cache = createPhysicsTerrainQueryFrameCache();
  const frame = cache.begin({ sampler: createSlopedSampler(),
    bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 } });
  const ranks = ['curb-or-authored-step', 'height-discontinuity',
    'sharp-dihedral-edge', 'non-manifold-seam', 'vertical-static-obstacle'];
  // Deliberately overlapping features, including tall walls and thin steps.
  cache.discontinuityEdges = Array.from({ length: 100 }, (_, i) => ({
    minX: i - 50, maxX: i - 45, minZ: (i % 9) - 4, maxZ: (i % 9) + 2,
    minY: i % 3, maxY: (i % 3) + 0.5, classification: ranks[i % 5]
  }));
  for (let i = 0; i < 120; i++) {
    const bounds = { minX: i - 60, maxX: i - 57.5, minZ: -1.5, maxZ: 1.5,
      minY: 0.75, maxY: 2.25 };
    const expected = cache.discontinuityEdges.filter(f => f.maxX >= bounds.minX
      && f.minX <= bounds.maxX && f.maxZ >= bounds.minZ && f.minZ <= bounds.maxZ
      && f.maxY >= bounds.minY && f.minY <= bounds.maxY);
    const actual = frame.classifyCollisionFeaturesInBounds(bounds);
    assert.equal(actual.featureCount, expected.length);
    assert.equal(actual.discontinuity, expected.length > 0);
    const rank = Math.max(-1, ...expected.map(f => ranks.indexOf(f.classification)));
    assert.equal(actual.classification, ranks[rank] || 'smooth-connected-surface');
  }
});
