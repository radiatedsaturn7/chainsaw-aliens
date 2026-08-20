const BARYCENTRIC_EPSILON = 0.0001;
const EMPTY_SAMPLE_POINTS_OPTIONS = Object.freeze({});
const EMPTY_PACKED_POINTS_OPTIONS = Object.freeze({});
const DEFAULT_RESULT_CAPACITY = 256;

const pointZ = (point = {}) => Number(point.z ?? point.y ?? 0);

const finiteBounds = (bounds = {}) => {
  const minX = Number(bounds.minX);
  const maxX = Number(bounds.maxX);
  const minZ = Number(bounds.minZ);
  const maxZ = Number(bounds.maxZ);
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)
    || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) return null;
  return minX === bounds.minX && maxX === bounds.maxX
    && minZ === bounds.minZ && maxZ === bounds.maxZ
    ? bounds
    : { minX, maxX, minZ, maxZ };
};

function packedTriangleHeightResidualAt(
  positions,
  offset,
  x,
  z,
  requireInside,
  referenceX,
  referenceZ,
  referenceHeightM,
  referenceNormalX,
  referenceNormalY,
  referenceNormalZ,
  elevationScaleM
) {
  const ax = positions[offset];
  const ay = positions[offset + 1];
  const az = positions[offset + 2];
  const bx = positions[offset + 3];
  const by = positions[offset + 4];
  const bz = positions[offset + 5];
  const cx = positions[offset + 6];
  const cy = positions[offset + 7];
  const cz = positions[offset + 8];
  const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(denominator) < 1e-10) return Number.NaN;
  const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
  const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
  const wc = 1 - wa - wb;
  if (requireInside && (wa < -BARYCENTRIC_EPSILON
    || wb < -BARYCENTRIC_EPSILON || wc < -BARYCENTRIC_EPSILON)) return Number.NaN;
  const heightM = (wa * ay + wb * by + wc * cy) * elevationScaleM;
  const tangentHeightM = referenceHeightM - (
    referenceNormalX * (x - referenceX) + referenceNormalZ * (z - referenceZ)
  ) / referenceNormalY;
  return heightM - tangentHeightM;
}

function preparedTriangleOverlapsBounds(sampler, triangleIndex, bounds) {
  if (sampler.packed) {
    const offset = triangleIndex * 4;
    return sampler.bounds[offset + 1] >= bounds.minX - BARYCENTRIC_EPSILON
      && sampler.bounds[offset] <= bounds.maxX + BARYCENTRIC_EPSILON
      && sampler.bounds[offset + 3] >= bounds.minZ - BARYCENTRIC_EPSILON
      && sampler.bounds[offset + 2] <= bounds.maxZ + BARYCENTRIC_EPSILON;
  }
  const triangle = sampler.triangles[triangleIndex];
  return Boolean(triangle
    && triangle.maxX >= bounds.minX - BARYCENTRIC_EPSILON
    && triangle.minX <= bounds.maxX + BARYCENTRIC_EPSILON
    && triangle.maxZ >= bounds.minZ - BARYCENTRIC_EPSILON
    && triangle.minZ <= bounds.maxZ + BARYCENTRIC_EPSILON);
}

function includeMaximumPointInBounds(maximum, bounds, x, height, z) {
  return x >= bounds.minX - BARYCENTRIC_EPSILON
    && x <= bounds.maxX + BARYCENTRIC_EPSILON
    && z >= bounds.minZ - BARYCENTRIC_EPSILON
    && z <= bounds.maxZ + BARYCENTRIC_EPSILON
    ? Math.max(maximum, height)
    : maximum;
}

function includeMaximumTriangleCorner(
  maximum,
  x,
  z,
  ax,
  ay,
  az,
  bx,
  by,
  bz,
  cx,
  cy,
  cz,
  denominator
) {
  const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
  const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
  const wc = 1 - wa - wb;
  return wa >= -BARYCENTRIC_EPSILON && wb >= -BARYCENTRIC_EPSILON
    && wc >= -BARYCENTRIC_EPSILON
    ? Math.max(maximum, wa * ay + wb * by + wc * cy)
    : maximum;
}

function includeMaximumEdgeIntersections(
  maximum,
  bounds,
  x1,
  y1,
  z1,
  x2,
  y2,
  z2
) {
  const dx = x2 - x1;
  if (Math.abs(dx) > 1e-12) {
    let t = (bounds.minX - x1) / dx;
    if (t >= 0 && t <= 1) {
      maximum = includeMaximumPointInBounds(
        maximum,
        bounds,
        bounds.minX,
        y1 + (y2 - y1) * t,
        z1 + (z2 - z1) * t
      );
    }
    t = (bounds.maxX - x1) / dx;
    if (t >= 0 && t <= 1) {
      maximum = includeMaximumPointInBounds(
        maximum,
        bounds,
        bounds.maxX,
        y1 + (y2 - y1) * t,
        z1 + (z2 - z1) * t
      );
    }
  }
  const dz = z2 - z1;
  if (Math.abs(dz) > 1e-12) {
    let t = (bounds.minZ - z1) / dz;
    if (t >= 0 && t <= 1) {
      maximum = includeMaximumPointInBounds(
        maximum,
        bounds,
        x1 + (x2 - x1) * t,
        y1 + (y2 - y1) * t,
        bounds.minZ
      );
    }
    t = (bounds.maxZ - z1) / dz;
    if (t >= 0 && t <= 1) {
      maximum = includeMaximumPointInBounds(
        maximum,
        bounds,
        x1 + (x2 - x1) * t,
        y1 + (y2 - y1) * t,
        bounds.maxZ
      );
    }
  }
  return maximum;
}

function maximumTriangleHeightInBounds(
  maximum,
  bounds,
  ax,
  ay,
  az,
  bx,
  by,
  bz,
  cx,
  cy,
  cz
) {
  maximum = includeMaximumPointInBounds(maximum, bounds, ax, ay, az);
  maximum = includeMaximumPointInBounds(maximum, bounds, bx, by, bz);
  maximum = includeMaximumPointInBounds(maximum, bounds, cx, cy, cz);
  const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(denominator) > 1e-10) {
    maximum = includeMaximumTriangleCorner(
      maximum, bounds.minX, bounds.minZ,
      ax, ay, az, bx, by, bz, cx, cy, cz, denominator
    );
    maximum = includeMaximumTriangleCorner(
      maximum, bounds.minX, bounds.maxZ,
      ax, ay, az, bx, by, bz, cx, cy, cz, denominator
    );
    maximum = includeMaximumTriangleCorner(
      maximum, bounds.maxX, bounds.minZ,
      ax, ay, az, bx, by, bz, cx, cy, cz, denominator
    );
    maximum = includeMaximumTriangleCorner(
      maximum, bounds.maxX, bounds.maxZ,
      ax, ay, az, bx, by, bz, cx, cy, cz, denominator
    );
  }
  maximum = includeMaximumEdgeIntersections(maximum, bounds, ax, ay, az, bx, by, bz);
  maximum = includeMaximumEdgeIntersections(maximum, bounds, bx, by, bz, cx, cy, cz);
  return includeMaximumEdgeIntersections(maximum, bounds, cx, cy, cz, ax, ay, az);
}

function createMutableSample() {
  const normal = { x: 0, y: 1, z: 0 };
  return {
    physicsTerrainQueryFrameSample: true,
    valid: false,
    heightM: null,
    elevation: null,
    normal,
    normalWorld: normal,
    region: null,
    source: null,
    triangleId: null,
    queryPosition: null,
    reason: 'unqueried',
    score: -Infinity,
    friction: null,
    surfaceId: null,
    supportFamilyId: null,
    supportFamilyDriveable: false,
    supportEdgeClassification: null,
    bakedElevation: null,
    bakedNormal: normal,
    bakedTriangleId: null,
    bakedSurfaceSource: null
  };
}

function createBatchBuffer(capacity = DEFAULT_RESULT_CAPACITY) {
  const resolvedCapacity = Math.max(1, Math.trunc(Number(capacity) || 1));
  const targets = new Array(resolvedCapacity);
  const queryPoints = new Array(resolvedCapacity);
  for (let index = 0; index < resolvedCapacity; index += 1) {
    targets[index] = createMutableSample();
    queryPoints[index] = { x: 0, y: 0, z: 0 };
  }
  return {
    capacity: resolvedCapacity,
    count: 0,
    samples: new Array(resolvedCapacity),
    targets,
    queryPoints,
    pointXZ: new Float64Array(resolvedCapacity * 2),
    heightM: new Float64Array(resolvedCapacity),
    normalXYZ: new Float64Array(resolvedCapacity * 3),
    triangleId: new Int32Array(resolvedCapacity),
    valid: new Uint8Array(resolvedCapacity)
  };
}

function growBatchBuffer(buffer, required) {
  if (buffer.capacity >= required) return false;
  let capacity = Math.max(1, buffer.capacity);
  while (capacity < required) capacity *= 2;
  for (let index = buffer.capacity; index < capacity; index += 1) {
    buffer.targets[index] = createMutableSample();
    buffer.queryPoints[index] = { x: 0, y: 0, z: 0 };
  }
  buffer.capacity = capacity;
  buffer.pointXZ = new Float64Array(capacity * 2);
  buffer.heightM = new Float64Array(capacity);
  buffer.normalXYZ = new Float64Array(capacity * 3);
  buffer.triangleId = new Int32Array(capacity);
  buffer.valid = new Uint8Array(capacity);
  return true;
}

function resetSample(sample, queryPosition) {
  sample.valid = false;
  sample.heightM = null;
  sample.elevation = null;
  sample.normal.x = 0;
  sample.normal.y = 1;
  sample.normal.z = 0;
  sample.region = null;
  sample.source = null;
  sample.triangleId = null;
  sample.queryPosition = queryPosition;
  sample.reason = 'outside-prepared-terrain';
  sample.score = -Infinity;
  sample.friction = null;
  sample.surfaceId = null;
  sample.supportFamilyId = null;
  sample.supportFamilyDriveable = false;
  sample.supportEdgeClassification = null;
  sample.bakedElevation = null;
  sample.bakedTriangleId = null;
  sample.bakedSurfaceSource = null;
  return sample;
}

const SUPPORT_EDGE_CLASSIFICATIONS = Object.freeze([
  'smooth-connected-surface',
  'curb-or-authored-step',
  'height-discontinuity',
  'sharp-dihedral-edge',
  'non-manifold-seam',
  'vertical-static-obstacle'
]);

function annotatePreparedSupport(sampler, sample) {
  if (!sample?.valid || sample.triangleId === null || sample.triangleId === undefined) {
    return sample;
  }
  const triangleIndex = Number(sample.triangleId);
  sample.supportFamilyId = Number(sampler?.supportFamilyIds?.[triangleIndex] ?? triangleIndex);
  sample.supportFamilyDriveable = sampler?.supportFamilyDriveable?.[triangleIndex] === 1;
  const edgeFlag = Number(sampler?.supportEdgeFlags?.[triangleIndex] || 0);
  sample.supportEdgeClassification = sample.supportFamilyDriveable
    ? 'smooth-connected-surface'
    : (SUPPORT_EDGE_CLASSIFICATIONS[edgeFlag] || 'smooth-connected-surface');
  return sample;
}

function createStatistics() {
  return {
    frameSequence: 0,
    cacheHit: false,
    bucketDiscoveries: 0,
    localTriangleCount: 0,
      pointQueries: 0,
    pointCacheHits: 0,
    pointCacheMisses: 0,
    batchQueries: 0,
    trianglesVisited: 0,
    barycentricTests: 0,
    maximumHeightQueries: 0,
    triangleRangeQueries: 0,
    outOfFrameQueries: 0,
    fullSurfaceClassifications: 0,
    projectionCacheHits: 0,
    projectionCacheMisses: 0,
    materialCacheHits: 0,
    materialCacheMisses: 0,
    analyticContactPlaneQueries: 0,
    contactTriangleExitRefreshes: 0,
    temporaryObjects: 0
  };
}

function resetStatistics(statistics, frameSequence) {
  statistics.frameSequence = frameSequence;
  statistics.cacheHit = false;
  statistics.bucketDiscoveries = 0;
  statistics.localTriangleCount = 0;
  statistics.pointQueries = 0;
  statistics.pointCacheHits = 0;
  statistics.pointCacheMisses = 0;
  statistics.batchQueries = 0;
  statistics.trianglesVisited = 0;
  statistics.barycentricTests = 0;
  statistics.maximumHeightQueries = 0;
  statistics.triangleRangeQueries = 0;
  statistics.outOfFrameQueries = 0;
  statistics.fullSurfaceClassifications = 0;
  statistics.projectionCacheHits = 0;
  statistics.projectionCacheMisses = 0;
  statistics.materialCacheHits = 0;
  statistics.materialCacheMisses = 0;
  statistics.analyticContactPlaneQueries = 0;
  statistics.contactTriangleExitRefreshes = 0;
  statistics.temporaryObjects = 0;
  return statistics;
}

/**
 * Reusable owner for per-substep terrain frames. The cache is intentionally
 * vehicle-local: a prepared-world revision change or a bucket-range change is
 * the only event which rebuilds its local triangle index set.
 */
export class PhysicsTerrainQueryFrameCache {
  constructor({ resultCapacity = DEFAULT_RESULT_CAPACITY } = {}) {
    this.revision = null;
    this.sampler = null;
    this.bucketRangeKey = '';
    this.localTriangleIndices = new Uint32Array(0);
    this.localTriangleCount = 0;
    this.triangleStamps = new Uint32Array(0);
    this.stamp = 0;
    this.bucketGrid = new Int32Array(0);
    this.bucketGridWidth = 0;
    this.bucketGridHeight = 0;
    this.minBucketX = 0;
    this.minBucketZ = 0;
    this.fineCellSizeM = 1;
    this.fineMinX = 0;
    this.fineMinZ = 0;
    this.fineGridWidth = 0;
    this.fineGridHeight = 0;
    this.fineCellCounts = new Uint32Array(0);
    this.fineCellOffsets = new Uint32Array(0);
    this.fineCellCursors = new Uint32Array(0);
    this.fineCellTriangles = new Uint32Array(0);
    this.discontinuityEdges = [];
    this.edgeClassificationCounts = Object.create(null);
    this.edgeClassificationsByBucketRange = new Map();
    this.resultCapacity = Math.max(32, Math.trunc(Number(resultCapacity) || DEFAULT_RESULT_CAPACITY));
    this.frame = new PhysicsTerrainQueryFrame(this);
  }

  begin(options = {}) {
    return this.frame.begin(options);
  }

  ensureTriangleCapacity(count) {
    if (this.localTriangleIndices.length >= count) return;
    const previous = this.localTriangleIndices;
    let capacity = Math.max(64, this.localTriangleIndices.length || 64);
    while (capacity < count) capacity *= 2;
    const next = new Uint32Array(capacity);
    next.set(previous);
    this.localTriangleIndices = next;
  }

  ensureStampCapacity(count) {
    if (this.triangleStamps.length >= count) return;
    this.triangleStamps = new Uint32Array(count);
    this.stamp = 0;
  }

  ensureBucketGridCapacity(count) {
    if (this.bucketGrid.length >= count) return;
    let capacity = Math.max(16, this.bucketGrid.length || 16);
    while (capacity < count) capacity *= 2;
    this.bucketGrid = new Int32Array(capacity);
  }

  ensureFineCellCapacity(count) {
    if (this.fineCellCounts.length >= count) return;
    let capacity = Math.max(64, this.fineCellCounts.length || 64);
    while (capacity < count) capacity *= 2;
    this.fineCellCounts = new Uint32Array(capacity);
    this.fineCellOffsets = new Uint32Array(capacity + 1);
    this.fineCellCursors = new Uint32Array(capacity);
  }

  ensureFineTriangleCapacity(count) {
    if (this.fineCellTriangles.length >= count) return;
    let capacity = Math.max(256, this.fineCellTriangles.length || 256);
    while (capacity < count) capacity *= 2;
    this.fineCellTriangles = new Uint32Array(capacity);
  }
}

/**
 * One deterministic, copy-free prepared-terrain query context for one vehicle
 * contact substep. Results are pooled and valid until the next begin() call.
 */
export class PhysicsTerrainQueryFrame {
  constructor(cache) {
    if (!cache) throw new TypeError('PhysicsTerrainQueryFrame requires a vehicle-local cache');
    this.cache = cache;
    this.sampler = null;
    this.revision = null;
    this.bounds = null;
    this.elevationScaleM = 1;
    this.physicsCostAccounting = null;
    this.statistics = createStatistics();
    this.batchBuffers = Array.from({ length: 16 }, () => (
      createBatchBuffer(cache.resultCapacity || DEFAULT_RESULT_CAPACITY)
    ));
    this.batchBufferCursor = 0;
    // Body support batches are consumed synchronously by collision loops and
    // never cross the public environment snapshot boundary. Keeping one
    // dedicated buffer prevents tire-frequency collision work from growing the
    // rotating wheel/environment batch pool for the duration of a chassis step.
    this.bodySupportBatch = createBatchBuffer(
      cache.resultCapacity || DEFAULT_RESULT_CAPACITY
    );
    this.lastBatch = null;
    this.scalarResult = createMutableSample();
    this.analyticResults = Array.from({ length: 8 }, () => createMutableSample());
    this.analyticResultCursor = 0;
    this.projectionValues = new Array(8).fill(null);
    this.projectionKeys = new Array(8).fill(null);
    this.materialValues = new Array(4).fill(null);
    this.materialKeys = new Array(4).fill(null);
    this.materialTriangleIds = new Int32Array(4).fill(-1);
    this.materialRegions = new Array(4).fill(null);
    this.materialSources = new Array(4).fill(null);
    this.segmentResult = {
      hit: false,
      fraction: null,
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      triangleId: null,
      region: null,
      source: null
    };
    this.variationResult = {
      valid: false,
      triangleCount: 0,
      heightResidualRangeM: Infinity,
      maximumNormalAngleRad: Math.PI,
      discontinuity: true
    };
    this.collisionClassificationResult = {
      classification: 'no-terrain',
      discontinuity: true,
      featureCount: 0,
      edgeClassifications: null
    };
    this.wheelActivationReferences = Array.from({ length: 4 }, () => ({
      point: null,
      heightM: 0,
      normal: { x: 0, y: 1, z: 0 }
    }));
    this.wheelActivationBounds = Array.from({ length: 4 }, () => ({
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0
    }));
    this.bodyVariationReference = {
      point: { x: 0, y: 0, z: 0 },
      heightM: 0,
      normal: { x: 0, y: 1, z: 0 }
    };
    this.bodyVariationBounds = {
      minX: 0, maxX: 0, minY: -Infinity, maxY: Infinity, minZ: 0, maxZ: 0
    };
    this.pointCacheCapacity = 8192;
    this.pointCacheStamps = new Uint32Array(this.pointCacheCapacity);
    this.pointCacheX = new Float64Array(this.pointCacheCapacity);
    this.pointCacheZ = new Float64Array(this.pointCacheCapacity);
    this.pointCacheElevation = new Float64Array(this.pointCacheCapacity);
    this.pointCacheNormal = new Float64Array(this.pointCacheCapacity * 3);
    this.pointCacheTriangleId = new Int32Array(this.pointCacheCapacity);
    this.pointCacheScore = new Float64Array(this.pointCacheCapacity);
    this.pointCacheRegion = new Array(this.pointCacheCapacity).fill(null);
    this.pointCacheSource = new Array(this.pointCacheCapacity).fill(null);
    this.pointCacheValid = new Uint8Array(this.pointCacheCapacity);
    this.pointCacheStamp = 0;
    this.rangeTriangleStamps = new Uint32Array(0);
    this.rangeTriangleStamp = 0;
    this.rangeTriangleIndices = new Uint32Array(64);
    this.rangeTriangleCount = 0;
    this.bucketRange = [0, 0, null, false];
    this.triangleView = {
      index: -1,
      positions: null,
      positionOffset: 0,
      normals: null,
      normalOffset: 0,
      triangle: null,
      elevationScaleM: 1,
      region: null,
      source: null
    };
    this.bodySupportBuffers = Array.from({ length: 4 }, () => ({
      inUse: false,
      entries: [],
      adaptiveAdditions: [],
      sampledTerrain: new Map(),
      supportCandidates: [],
      supportEnvelopeCandidates: new Map(),
      supportEnvelopeHeights: new Map(),
      spareEntries: Array.from({ length: 256 }, () => ({
        candidate: null,
        contactTriangleCandidateId: null,
        contactTriangleId: null,
        adaptiveCandidate: {
          id: '',
          pieceId: null,
          pieceType: null,
          localPoint: { x: 0, y: 0, z: 0 },
          adaptive: true
        },
        arm: { x: 0, y: 0, z: 0 },
        worldPoint: { x: 0, y: 0, z: 0 }
      }))
    }));
    this.sequence = 0;
  }

  begin({
    sampler = null,
    revision = null,
    bounds = null,
    elevationScaleM = null,
    physicsCostAccounting = null
  } = {}) {
    const nextRevision = revision ?? sampler?.revision ?? 0;
    const retainMaterialCache = this.sampler === sampler && this.revision === nextRevision;
    if (!retainMaterialCache) this.cache.edgeClassificationsByBucketRange.clear();
    this.sampler = sampler;
    this.revision = nextRevision;
    this.bounds = finiteBounds(bounds);
    this.elevationScaleM = Math.max(0.000001, Number(
      elevationScaleM ?? sampler?.elevationScaleM ?? 1
    ) || 1);
    this.physicsCostAccounting = physicsCostAccounting;
    this.sequence += 1;
    resetStatistics(this.statistics, this.sequence);
    this.batchBufferCursor = 0;
    this.analyticResultCursor = 0;
    this.lastBatch = null;
    this.projectionValues.fill(null);
    this.projectionKeys.fill(null);
    if (!retainMaterialCache) {
      this.materialValues.fill(null);
      this.materialKeys.fill(null);
      this.materialTriangleIds.fill(-1);
      this.materialRegions.fill(null);
      this.materialSources.fill(null);
    }
    this.pointCacheStamp = (this.pointCacheStamp + 1) >>> 0;
    if (this.pointCacheStamp === 0) {
      this.pointCacheStamps.fill(0);
      this.pointCacheStamp = 1;
    }
    this.rebuildLocalIndexIfNeeded();
    const triangleCount = Number(sampler?.triangleCount) || 0;
    if (this.rangeTriangleStamps.length < triangleCount) {
      this.rangeTriangleStamps = new Uint32Array(triangleCount);
      this.rangeTriangleStamp = 0;
    }
    physicsCostAccounting?.count('terrainQueryFrames');
    if (this.statistics.cacheHit) physicsCostAccounting?.count('terrainQueryFrameCacheHits');
    return this;
  }

  rebuildLocalIndexIfNeeded() {
    const sampler = this.sampler;
    const bounds = this.bounds;
    if (!sampler?.triangleCount || !bounds) {
      this.cache.localTriangleCount = 0;
      return;
    }
    const bucketSize = Math.max(4, Number(sampler.bucketSizeM) || 20);
    const minBucketX = Math.floor(bounds.minX / bucketSize);
    const maxBucketX = Math.floor(bounds.maxX / bucketSize);
    const minBucketZ = Math.floor(bounds.minZ / bucketSize);
    const maxBucketZ = Math.floor(bounds.maxZ / bucketSize);
    const key = `${minBucketX}:${maxBucketX}:${minBucketZ}:${maxBucketZ}`;
    if (this.cache.sampler === sampler
      && this.cache.revision === this.revision
      && this.cache.bucketRangeKey === key) {
      this.statistics.cacheHit = true;
      this.statistics.localTriangleCount = this.cache.localTriangleCount;
      return;
    }

    this.statistics.bucketDiscoveries += 1;
    this.cache.sampler = sampler;
    this.cache.revision = this.revision;
    this.cache.bucketRangeKey = key;
    this.cache.minBucketX = minBucketX;
    this.cache.minBucketZ = minBucketZ;
    this.cache.bucketGridWidth = maxBucketX - minBucketX + 1;
    this.cache.bucketGridHeight = maxBucketZ - minBucketZ + 1;
    const gridCount = this.cache.bucketGridWidth * this.cache.bucketGridHeight;
    this.cache.ensureBucketGridCapacity(gridCount);
    this.cache.bucketGrid.fill(-1, 0, gridCount);
    this.cache.ensureStampCapacity(Number(sampler.triangleCount) || 0);
    this.cache.stamp = (this.cache.stamp + 1) >>> 0;
    if (this.cache.stamp === 0) {
      this.cache.triangleStamps.fill(0);
      this.cache.stamp = 1;
    }
    const stamp = this.cache.stamp;
    let localCount = 0;

    if (sampler.packed) {
      if (!sampler.bucketLookup) {
        sampler.bucketLookup = new Map();
        for (let index = 0; index < sampler.bucketOffsets.length - 1; index += 1) {
          sampler.bucketLookup.set(
            `${sampler.bucketCoords[index * 2]},${sampler.bucketCoords[index * 2 + 1]}`,
            index
          );
        }
      }
      for (let bucketZ = minBucketZ; bucketZ <= maxBucketZ; bucketZ += 1) {
        for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX += 1) {
          const gridIndex = (bucketZ - minBucketZ) * this.cache.bucketGridWidth
            + bucketX - minBucketX;
          this.physicsCostAccounting?.count('bakedTriangleBucketLookups');
          const bucketIndex = sampler.bucketLookup.get(`${bucketX},${bucketZ}`);
          if (!Number.isFinite(bucketIndex)) continue;
          this.cache.bucketGrid[gridIndex] = bucketIndex;
          for (let entry = sampler.bucketOffsets[bucketIndex];
            entry < sampler.bucketOffsets[bucketIndex + 1]; entry += 1) {
            const triangleIndex = sampler.bucketTriangles[entry];
            if (this.cache.triangleStamps[triangleIndex] === stamp) continue;
            this.cache.triangleStamps[triangleIndex] = stamp;
            this.cache.ensureTriangleCapacity(localCount + 1);
            this.cache.localTriangleIndices[localCount] = triangleIndex;
            localCount += 1;
          }
        }
      }
    } else {
      for (let bucketZ = minBucketZ; bucketZ <= maxBucketZ; bucketZ += 1) {
        for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX += 1) {
          const gridIndex = (bucketZ - minBucketZ) * this.cache.bucketGridWidth
            + bucketX - minBucketX;
          const entries = sampler.buckets?.get(`${bucketX},${bucketZ}`) || null;
          if (!entries) continue;
          this.cache.bucketGrid[gridIndex] = gridIndex;
          for (let index = 0; index < entries.length; index += 1) {
            const triangleIndex = Number(entries[index]);
            if (this.cache.triangleStamps[triangleIndex] === stamp) continue;
            this.cache.triangleStamps[triangleIndex] = stamp;
            this.cache.ensureTriangleCapacity(localCount + 1);
            this.cache.localTriangleIndices[localCount] = triangleIndex;
            localCount += 1;
          }
        }
      }
    }
    this.cache.localTriangleCount = localCount;
    this.cache.localTriangleIndices.subarray(0, localCount).sort();
    this.buildFineTriangleGrid({
      minBucketX, maxBucketX, minBucketZ, maxBucketZ, bucketSize
    });
    this.buildLocalEdgeClassifications(key);
    this.statistics.localTriangleCount = localCount;
  }

  buildLocalEdgeClassifications(bucketRangeKey = '') {
    const sampler = this.sampler;
    const cache = this.cache;
    const preparedKey = `${String(this.revision)}:${bucketRangeKey}`;
    const prepared = cache.edgeClassificationsByBucketRange.get(preparedKey);
    if (prepared) {
      cache.discontinuityEdges = prepared.discontinuityEdges;
      cache.edgeClassificationCounts = prepared.edgeClassificationCounts;
      return;
    }
    const edges = new Map();
    const quantize = (value) => Math.round(Number(value) * 10000);
    const appendEdge = (firstX, firstY, firstZ, secondX, secondY, secondZ,
      normalX, normalY, normalZ, region, source) => {
      const firstKey = `${quantize(firstX)}:${quantize(firstZ)}`;
      const secondKey = `${quantize(secondX)}:${quantize(secondZ)}`;
      const forward = firstKey <= secondKey;
      const ax = forward ? firstX : secondX;
      const ay = forward ? firstY : secondY;
      const az = forward ? firstZ : secondZ;
      const bx = forward ? secondX : firstX;
      const by = forward ? secondY : firstY;
      const bz = forward ? secondZ : firstZ;
      const key = forward ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
      let edge = edges.get(key);
      if (!edge) {
        edge = {
          minX: Math.min(ax, bx),
          maxX: Math.max(ax, bx),
          minY: Math.min(ay, by) * this.elevationScaleM,
          maxY: Math.max(ay, by) * this.elevationScaleM,
          minZ: Math.min(az, bz),
          maxZ: Math.max(az, bz),
          entries: []
        };
        edges.set(key, edge);
      }
      edge.entries.push({
        aHeightM: ay * this.elevationScaleM,
        bHeightM: by * this.elevationScaleM,
        normalX,
        normalY,
        normalZ,
        region,
        source
      });
    };
    for (let localIndex = 0; localIndex < cache.localTriangleCount; localIndex += 1) {
      const triangleIndex = cache.localTriangleIndices[localIndex];
      let ax;
      let ay;
      let az;
      let bx;
      let by;
      let bz;
      let cx;
      let cy;
      let cz;
      let normalX;
      let normalY;
      let normalZ;
      let region;
      let source;
      if (sampler.packed) {
        const positionOffset = triangleIndex * 9;
        const normalOffset = triangleIndex * 3;
        ax = sampler.positions[positionOffset];
        ay = sampler.positions[positionOffset + 1];
        az = sampler.positions[positionOffset + 2];
        bx = sampler.positions[positionOffset + 3];
        by = sampler.positions[positionOffset + 4];
        bz = sampler.positions[positionOffset + 5];
        cx = sampler.positions[positionOffset + 6];
        cy = sampler.positions[positionOffset + 7];
        cz = sampler.positions[positionOffset + 8];
        normalX = sampler.normals[normalOffset];
        normalY = sampler.normals[normalOffset + 1];
        normalZ = sampler.normals[normalOffset + 2];
        region = sampler.regionTable[sampler.regions[triangleIndex]] || 'terrain';
        source = sampler.sourceTable[sampler.sources[triangleIndex]] || 'terrain';
      } else {
        const triangle = sampler.triangles[triangleIndex];
        if (!triangle) continue;
        const a = triangle.vertices[0];
        const b = triangle.vertices[1];
        const c = triangle.vertices[2];
        ax = Number(a?.x || 0);
        ay = Number(a?.elevation || 0);
        az = pointZ(a);
        bx = Number(b?.x || 0);
        by = Number(b?.elevation || 0);
        bz = pointZ(b);
        cx = Number(c?.x || 0);
        cy = Number(c?.elevation || 0);
        cz = pointZ(c);
        normalX = Number(triangle.normal?.x || 0);
        normalY = Number(triangle.normal?.y ?? 1);
        normalZ = Number(triangle.normal?.z || 0);
        region = triangle.region || 'terrain';
        source = triangle.source || 'terrain';
      }
      appendEdge(ax, ay, az, bx, by, bz, normalX, normalY, normalZ, region, source);
      appendEdge(bx, by, bz, cx, cy, cz, normalX, normalY, normalZ, region, source);
      appendEdge(cx, cy, cz, ax, ay, az, normalX, normalY, normalZ, region, source);
    }
    const discontinuityEdges = [];
    const edgeClassificationCounts = Object.create(null);
    edges.forEach((edge) => {
      const entries = edge.entries;
      let classification = 'smooth-connected-surface';
      let maximumHeightMismatchM = 0;
      let maximumNormalAngleRad = 0;
      let containsVertical = false;
      for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
        const first = entries[firstIndex];
        if (Number(first.normalY || 0) < 0.35) containsVertical = true;
        for (let secondIndex = firstIndex + 1; secondIndex < entries.length; secondIndex += 1) {
          const second = entries[secondIndex];
          maximumHeightMismatchM = Math.max(
            maximumHeightMismatchM,
            Math.abs(first.aHeightM - second.aHeightM),
            Math.abs(first.bHeightM - second.bHeightM)
          );
          const normalDot = Math.max(-1, Math.min(1,
            Number(first.normalX || 0) * Number(second.normalX || 0)
              + Number(first.normalY || 0) * Number(second.normalY || 0)
              + Number(first.normalZ || 0) * Number(second.normalZ || 0)
          ));
          maximumNormalAngleRad = Math.max(maximumNormalAngleRad, Math.acos(normalDot));
        }
      }
      if (containsVertical) {
        classification = 'vertical-static-obstacle';
      } else if (maximumHeightMismatchM > 0.012) {
        classification = 'height-discontinuity';
      } else if (entries.length > 2 && maximumNormalAngleRad > 35 * Math.PI / 180) {
        classification = 'non-manifold-seam';
      } else if (maximumNormalAngleRad > 35 * Math.PI / 180) {
        const first = entries[0];
        const second = entries[1];
        classification = first.region !== second.region || first.source !== second.source
            ? 'curb-or-authored-step' : 'sharp-dihedral-edge';
      }
      edgeClassificationCounts[classification] = Number(
        edgeClassificationCounts[classification] || 0
      ) + 1;
      if (classification !== 'smooth-connected-surface') {
        discontinuityEdges.push({
          minX: edge.minX,
          maxX: edge.maxX,
          minY: edge.minY,
          maxY: edge.maxY,
          minZ: edge.minZ,
          maxZ: edge.maxZ,
          classification
        });
      }
    });
    cache.discontinuityEdges = discontinuityEdges;
    cache.edgeClassificationCounts = edgeClassificationCounts;
    cache.edgeClassificationsByBucketRange.set(preparedKey, {
      discontinuityEdges,
      edgeClassificationCounts
    });
  }

  buildFineTriangleGrid({ minBucketX, maxBucketX, minBucketZ, maxBucketZ, bucketSize }) {
    const sampler = this.sampler;
    const cache = this.cache;
    const cellSize = cache.fineCellSizeM;
    cache.fineMinX = minBucketX * bucketSize;
    cache.fineMinZ = minBucketZ * bucketSize;
    cache.fineGridWidth = Math.max(1, Math.ceil(
      ((maxBucketX + 1) * bucketSize - cache.fineMinX) / cellSize
    ));
    cache.fineGridHeight = Math.max(1, Math.ceil(
      ((maxBucketZ + 1) * bucketSize - cache.fineMinZ) / cellSize
    ));
    const cellCount = cache.fineGridWidth * cache.fineGridHeight;
    cache.ensureFineCellCapacity(cellCount);
    cache.fineCellCounts.fill(0, 0, cellCount);
    const visitTriangleCells = (triangleIndex, callback) => {
      let minX;
      let maxX;
      let minZ;
      let maxZ;
      if (sampler.packed) {
        const offset = triangleIndex * 4;
        minX = sampler.bounds[offset];
        maxX = sampler.bounds[offset + 1];
        minZ = sampler.bounds[offset + 2];
        maxZ = sampler.bounds[offset + 3];
      } else {
        const triangle = sampler.triangles[triangleIndex];
        minX = triangle.minX;
        maxX = triangle.maxX;
        minZ = triangle.minZ;
        maxZ = triangle.maxZ;
      }
      const firstX = Math.max(0, Math.floor((
        minX - BARYCENTRIC_EPSILON - cache.fineMinX
      ) / cellSize));
      const lastX = Math.min(cache.fineGridWidth - 1,
        Math.floor((maxX + BARYCENTRIC_EPSILON - cache.fineMinX) / cellSize));
      const firstZ = Math.max(0, Math.floor((
        minZ - BARYCENTRIC_EPSILON - cache.fineMinZ
      ) / cellSize));
      const lastZ = Math.min(cache.fineGridHeight - 1,
        Math.floor((maxZ + BARYCENTRIC_EPSILON - cache.fineMinZ) / cellSize));
      for (let cellZ = firstZ; cellZ <= lastZ; cellZ += 1) {
        const row = cellZ * cache.fineGridWidth;
        for (let cellX = firstX; cellX <= lastX; cellX += 1) callback(row + cellX);
      }
    };
    for (let entry = 0; entry < cache.localTriangleCount; entry += 1) {
      visitTriangleCells(cache.localTriangleIndices[entry], (cellIndex) => {
        cache.fineCellCounts[cellIndex] += 1;
      });
    }
    let totalEntries = 0;
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      cache.fineCellOffsets[cellIndex] = totalEntries;
      totalEntries += cache.fineCellCounts[cellIndex];
    }
    cache.fineCellOffsets[cellCount] = totalEntries;
    cache.ensureFineTriangleCapacity(totalEntries);
    cache.fineCellCursors.set(cache.fineCellOffsets.subarray(0, cellCount), 0);
    for (let entry = 0; entry < cache.localTriangleCount; entry += 1) {
      const triangleIndex = cache.localTriangleIndices[entry];
      visitTriangleCells(triangleIndex, (cellIndex) => {
        cache.fineCellTriangles[cache.fineCellCursors[cellIndex]] = triangleIndex;
        cache.fineCellCursors[cellIndex] += 1;
      });
    }
  }

  get localTriangleIndices() {
    return this.cache.localTriangleIndices.subarray(0, this.cache.localTriangleCount);
  }

  ensureRangeTriangleCapacity(count) {
    if (this.rangeTriangleIndices.length >= count) return;
    let capacity = Math.max(64, this.rangeTriangleIndices.length);
    while (capacity < count) capacity *= 2;
    this.rangeTriangleIndices = new Uint32Array(capacity);
  }

  collectTriangleIndicesInBounds(bounds = this.bounds) {
    const resolved = finiteBounds(bounds);
    const sampler = this.sampler;
    if (!resolved || !sampler?.triangleCount) {
      this.rangeTriangleCount = 0;
      return 0;
    }
    this.statistics.triangleRangeQueries += 1;
    this.rangeTriangleStamp = (this.rangeTriangleStamp + 1) >>> 0;
    if (this.rangeTriangleStamp === 0) {
      this.rangeTriangleStamps.fill(0);
      this.rangeTriangleStamp = 1;
    }
    const stamp = this.rangeTriangleStamp;
    let count = 0;
    const cache = this.cache;
    const fineMaxX = cache.fineMinX + cache.fineGridWidth * cache.fineCellSizeM;
    const fineMaxZ = cache.fineMinZ + cache.fineGridHeight * cache.fineCellSizeM;
    const insideFineGrid = resolved.minX >= cache.fineMinX
      && resolved.maxX <= fineMaxX && resolved.minZ >= cache.fineMinZ
      && resolved.maxZ <= fineMaxZ;
    if (insideFineGrid && cache.fineGridWidth > 0 && cache.fineGridHeight > 0) {
      const firstX = Math.max(0, Math.floor(
        (resolved.minX - cache.fineMinX) / cache.fineCellSizeM
      ));
      const lastX = Math.min(cache.fineGridWidth - 1, Math.floor(
        (resolved.maxX - cache.fineMinX) / cache.fineCellSizeM
      ));
      const firstZ = Math.max(0, Math.floor(
        (resolved.minZ - cache.fineMinZ) / cache.fineCellSizeM
      ));
      const lastZ = Math.min(cache.fineGridHeight - 1, Math.floor(
        (resolved.maxZ - cache.fineMinZ) / cache.fineCellSizeM
      ));
      for (let cellZ = firstZ; cellZ <= lastZ; cellZ += 1) {
        const row = cellZ * cache.fineGridWidth;
        for (let cellX = firstX; cellX <= lastX; cellX += 1) {
          const cell = row + cellX;
          for (let entry = cache.fineCellOffsets[cell];
            entry < cache.fineCellOffsets[cell + 1]; entry += 1) {
            const triangleIndex = cache.fineCellTriangles[entry];
            if (this.rangeTriangleStamps[triangleIndex] === stamp) continue;
            this.rangeTriangleStamps[triangleIndex] = stamp;
            if (!preparedTriangleOverlapsBounds(sampler, triangleIndex, resolved)) continue;
            this.ensureRangeTriangleCapacity(count + 1);
            this.rangeTriangleIndices[count] = triangleIndex;
            count += 1;
          }
        }
      }
    } else {
      for (let entry = 0; entry < cache.localTriangleCount; entry += 1) {
        const triangleIndex = cache.localTriangleIndices[entry];
        if (this.rangeTriangleStamps[triangleIndex] === stamp) continue;
        this.rangeTriangleStamps[triangleIndex] = stamp;
        if (!preparedTriangleOverlapsBounds(sampler, triangleIndex, resolved)) continue;
        this.ensureRangeTriangleCapacity(count + 1);
        this.rangeTriangleIndices[count] = triangleIndex;
        count += 1;
      }
    }
    this.rangeTriangleIndices.subarray(0, count).sort();
    this.rangeTriangleCount = count;
    return count;
  }

  containsPoint(point = {}) {
    const x = Number(point.x);
    const z = pointZ(point);
    return Boolean(this.bounds && x >= this.bounds.minX && x <= this.bounds.maxX
      && z >= this.bounds.minZ && z <= this.bounds.maxZ);
  }

  getBucketRangeForPoint(x, z, useFineGrid = true) {
    const sampler = this.sampler;
    const range = this.bucketRange;
    const fineX = Math.floor((x - this.cache.fineMinX) / this.cache.fineCellSizeM);
    const fineZ = Math.floor((z - this.cache.fineMinZ) / this.cache.fineCellSizeM);
    if (useFineGrid && fineX >= 0 && fineX < this.cache.fineGridWidth
      && fineZ >= 0 && fineZ < this.cache.fineGridHeight) {
      const fineIndex = fineZ * this.cache.fineGridWidth + fineX;
      range[0] = this.cache.fineCellOffsets[fineIndex];
      range[1] = this.cache.fineCellOffsets[fineIndex + 1];
      range[2] = this.cache.fineCellTriangles;
      range[3] = true;
      return range;
    }
    const bucketSize = Math.max(4, Number(sampler?.bucketSizeM) || 20);
    const bucketX = Math.floor(x / bucketSize);
    const bucketZ = Math.floor(z / bucketSize);
    const localX = bucketX - this.cache.minBucketX;
    const localZ = bucketZ - this.cache.minBucketZ;
    if (localX >= 0 && localX < this.cache.bucketGridWidth
      && localZ >= 0 && localZ < this.cache.bucketGridHeight) {
      const bucketIndex = this.cache.bucketGrid[localZ * this.cache.bucketGridWidth + localX];
      if (bucketIndex < 0) return null;
      if (sampler.packed) {
        range[0] = sampler.bucketOffsets[bucketIndex];
        range[1] = sampler.bucketOffsets[bucketIndex + 1];
        range[2] = null;
        range[3] = false;
        return range;
      }
      const entries = sampler.buckets?.get(`${bucketX},${bucketZ}`) || null;
      if (!entries) return null;
      range[0] = 0;
      range[1] = entries.length;
      range[2] = entries;
      range[3] = false;
      return range;
    }
    this.statistics.outOfFrameQueries += 1;
    this.physicsCostAccounting?.count('terrainQueryFrameOutOfBoundsQueries');
    if (sampler.packed) {
      const bucketIndex = sampler.bucketLookup?.get(`${bucketX},${bucketZ}`);
      if (!Number.isFinite(bucketIndex)) return null;
      range[0] = sampler.bucketOffsets[bucketIndex];
      range[1] = sampler.bucketOffsets[bucketIndex + 1];
      range[2] = null;
      range[3] = false;
      return range;
    }
    const entries = sampler.buckets?.get(`${bucketX},${bucketZ}`) || null;
    if (!entries) return null;
    range[0] = 0;
    range[1] = entries.length;
    range[2] = entries;
    range[3] = false;
    return range;
  }

  samplePoint(
    point = {}, target = this.scalarResult, preferredRegion = null, skipFineGrid = false
  ) {
    const sample = resetSample(target, point);
    const sampler = this.sampler;
    if (!sampler?.triangleCount) {
      sample.reason = 'missing-prepared-terrain';
      return sample;
    }
    const x = Number(point.x);
    const z = pointZ(point);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      sample.reason = 'non-finite-query-position';
      return sample;
    }
    this.statistics.pointQueries += 1;
    this.physicsCostAccounting?.count('terrainQueryFramePointQueries');
    const quantizedX = Math.round(x * 1e6);
    const quantizedZ = Math.round(z * 1e6);
    const cacheSlot = (Math.imul(quantizedX | 0, 73856093)
      ^ Math.imul(quantizedZ | 0, 19349663)) & (this.pointCacheCapacity - 1);
    if (!preferredRegion
      && this.pointCacheStamps[cacheSlot] === this.pointCacheStamp
      && this.pointCacheX[cacheSlot] === x
      && this.pointCacheZ[cacheSlot] === z) {
      this.statistics.pointCacheHits += 1;
      this.physicsCostAccounting?.count('terrainQueryFramePointCacheHits');
      if (this.pointCacheValid[cacheSlot] === 0) return sample;
      sample.valid = true;
      sample.elevation = this.pointCacheElevation[cacheSlot];
      sample.heightM = sample.elevation * this.elevationScaleM;
      const normalOffset = cacheSlot * 3;
      sample.normal.x = this.pointCacheNormal[normalOffset];
      sample.normal.y = this.pointCacheNormal[normalOffset + 1];
      sample.normal.z = this.pointCacheNormal[normalOffset + 2];
      sample.region = this.pointCacheRegion[cacheSlot];
      sample.source = this.pointCacheSource[cacheSlot];
      sample.triangleId = this.pointCacheTriangleId[cacheSlot];
      sample.reason = null;
      sample.score = this.pointCacheScore[cacheSlot];
      sample.bakedElevation = sample.elevation;
      sample.bakedTriangleId = sample.triangleId;
      sample.bakedSurfaceSource = sample.source;
      return annotatePreparedSupport(this.sampler, sample);
    }
    this.statistics.pointCacheMisses += 1;
    const range = this.getBucketRangeForPoint(x, z, !skipFineGrid);
    if (!range) {
      if (!preferredRegion) {
        this.pointCacheStamps[cacheSlot] = this.pointCacheStamp;
        this.pointCacheX[cacheSlot] = x;
        this.pointCacheZ[cacheSlot] = z;
        this.pointCacheValid[cacheSlot] = 0;
      }
      return sample;
    }
    const entries = range[2] || sampler.bucketTriangles;
    for (let entry = range[0]; entry < range[1]; entry += 1) {
      const triangleIndex = Number(entries[entry]);
      this.statistics.trianglesVisited += 1;
      this.statistics.barycentricTests += 1;
      this.physicsCostAccounting?.count('preparedTrianglesVisited');
      if (sampler.packed) {
        const boundsOffset = triangleIndex * 4;
        if (x < sampler.bounds[boundsOffset] - BARYCENTRIC_EPSILON
          || x > sampler.bounds[boundsOffset + 1] + BARYCENTRIC_EPSILON
          || z < sampler.bounds[boundsOffset + 2] - BARYCENTRIC_EPSILON
          || z > sampler.bounds[boundsOffset + 3] + BARYCENTRIC_EPSILON) continue;
        const offset = triangleIndex * 9;
        const ax = sampler.positions[offset];
        const ay = sampler.positions[offset + 1];
        const az = sampler.positions[offset + 2];
        const bx = sampler.positions[offset + 3];
        const by = sampler.positions[offset + 4];
        const bz = sampler.positions[offset + 5];
        const cx = sampler.positions[offset + 6];
        const cy = sampler.positions[offset + 7];
        const cz = sampler.positions[offset + 8];
        const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(denominator) < 0.0000001) continue;
        const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
        const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
        const wc = 1 - wa - wb;
        if (wa < -BARYCENTRIC_EPSILON || wb < -BARYCENTRIC_EPSILON
          || wc < -BARYCENTRIC_EPSILON) continue;
        const elevation = wa * ay + wb * by + wc * cy;
        const region = sampler.regionTable[sampler.regions[triangleIndex]] || 'terrain';
        const regionMatch = preferredRegion && (
          region === preferredRegion
          || (preferredRegion === 'shoulder' && (region === 'inner' || region === 'flat-join'))
          || (preferredRegion === 'terrain' && region === 'transition')
        );
        const score = Number(sampler.priorities[triangleIndex] || 0) + (regionMatch ? 20 : 0);
        if (score < sample.score || (score === sample.score && elevation <= sample.elevation)) continue;
        const normalOffset = triangleIndex * 3;
        sample.valid = true;
        sample.elevation = elevation;
        sample.heightM = elevation * this.elevationScaleM;
        sample.normal.x = sampler.normals[normalOffset];
        sample.normal.y = sampler.normals[normalOffset + 1];
        sample.normal.z = sampler.normals[normalOffset + 2];
        sample.region = region;
        sample.source = sampler.sourceTable[sampler.sources[triangleIndex]] || 'terrain';
        sample.triangleId = triangleIndex;
        sample.reason = null;
        sample.score = score;
      } else {
        const triangle = sampler.triangles[triangleIndex];
        if (!triangle || x < triangle.minX - BARYCENTRIC_EPSILON
          || x > triangle.maxX + BARYCENTRIC_EPSILON
          || z < triangle.minZ - BARYCENTRIC_EPSILON
          || z > triangle.maxZ + BARYCENTRIC_EPSILON) continue;
        const a = triangle.vertices[0];
        const b = triangle.vertices[1];
        const c = triangle.vertices[2];
        const ax = Number(a.x || 0);
        const ay = Number(a.elevation || 0);
        const az = pointZ(a);
        const bx = Number(b.x || 0);
        const by = Number(b.elevation || 0);
        const bz = pointZ(b);
        const cx = Number(c.x || 0);
        const cy = Number(c.elevation || 0);
        const cz = pointZ(c);
        const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(denominator) < 0.0000001) continue;
        const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
        const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
        const wc = 1 - wa - wb;
        if (wa < -BARYCENTRIC_EPSILON || wb < -BARYCENTRIC_EPSILON
          || wc < -BARYCENTRIC_EPSILON) continue;
        const elevation = wa * ay + wb * by + wc * cy;
        const region = triangle.region || 'terrain';
        const score = Number(triangle.priority || 0) + (region === preferredRegion ? 20 : 0);
        if (score < sample.score || (score === sample.score && elevation <= sample.elevation)) continue;
        sample.valid = true;
        sample.elevation = elevation;
        sample.heightM = elevation * this.elevationScaleM;
        sample.normal.x = Number(triangle.normal?.x || 0);
        sample.normal.y = Number(triangle.normal?.y ?? 1);
        sample.normal.z = Number(triangle.normal?.z || 0);
        sample.region = region;
        sample.source = triangle.source || 'terrain';
        sample.triangleId = triangleIndex;
        sample.reason = null;
        sample.score = score;
      }
    }
    if (!sample.valid && range[3] === true) {
      return this.samplePoint(point, target, preferredRegion, true);
    }
    if (sample.valid) {
      sample.bakedElevation = sample.elevation;
      sample.bakedTriangleId = sample.triangleId;
      sample.bakedSurfaceSource = sample.source;
      annotatePreparedSupport(this.sampler, sample);
    }
    if (!preferredRegion) {
      this.pointCacheStamps[cacheSlot] = this.pointCacheStamp;
      this.pointCacheX[cacheSlot] = x;
      this.pointCacheZ[cacheSlot] = z;
      this.pointCacheValid[cacheSlot] = sample.valid ? 1 : 0;
      if (sample.valid) {
        this.pointCacheElevation[cacheSlot] = sample.elevation;
        const normalOffset = cacheSlot * 3;
        this.pointCacheNormal[normalOffset] = sample.normal.x;
        this.pointCacheNormal[normalOffset + 1] = sample.normal.y;
        this.pointCacheNormal[normalOffset + 2] = sample.normal.z;
        this.pointCacheTriangleId[cacheSlot] = Number(sample.triangleId);
        this.pointCacheScore[cacheSlot] = sample.score;
        this.pointCacheRegion[cacheSlot] = sample.region;
        this.pointCacheSource[cacheSlot] = sample.source;
      }
    }
    return sample;
  }

  samplePointOnTriangle(point = {}, triangleId = null, target = null) {
    const sample = resetSample(
      target || this.analyticResults[
        this.analyticResultCursor++ % this.analyticResults.length
      ],
      point
    );
    const sampler = this.sampler;
    const triangleIndex = Number(triangleId);
    this.statistics.analyticContactPlaneQueries += 1;
    this.physicsCostAccounting?.count('analyticContactPlaneQueries');
    if (!sampler?.triangleCount || !Number.isInteger(triangleIndex)
      || triangleIndex < 0 || triangleIndex >= sampler.triangleCount) {
      sample.reason = 'missing-contact-triangle';
      return sample;
    }
    const x = Number(point.x);
    const z = pointZ(point);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      sample.reason = 'non-finite-query-position';
      return sample;
    }
    let ax;
    let ay;
    let az;
    let bx;
    let by;
    let bz;
    let cx;
    let cy;
    let cz;
    let region;
    let source;
    let priority;
    if (sampler.packed) {
      const boundsOffset = triangleIndex * 4;
      if (x < sampler.bounds[boundsOffset] - BARYCENTRIC_EPSILON
        || x > sampler.bounds[boundsOffset + 1] + BARYCENTRIC_EPSILON
        || z < sampler.bounds[boundsOffset + 2] - BARYCENTRIC_EPSILON
        || z > sampler.bounds[boundsOffset + 3] + BARYCENTRIC_EPSILON) {
        sample.reason = 'outside-contact-triangle';
        return sample;
      }
      const offset = triangleIndex * 9;
      ax = sampler.positions[offset];
      ay = sampler.positions[offset + 1];
      az = sampler.positions[offset + 2];
      bx = sampler.positions[offset + 3];
      by = sampler.positions[offset + 4];
      bz = sampler.positions[offset + 5];
      cx = sampler.positions[offset + 6];
      cy = sampler.positions[offset + 7];
      cz = sampler.positions[offset + 8];
      region = sampler.regionTable[sampler.regions[triangleIndex]] || 'terrain';
      source = sampler.sourceTable[sampler.sources[triangleIndex]] || 'terrain';
      priority = Number(sampler.priorities[triangleIndex] || 0);
    } else {
      const triangle = sampler.triangles[triangleIndex];
      if (!triangle || x < triangle.minX - BARYCENTRIC_EPSILON
        || x > triangle.maxX + BARYCENTRIC_EPSILON
        || z < triangle.minZ - BARYCENTRIC_EPSILON
        || z > triangle.maxZ + BARYCENTRIC_EPSILON) {
        sample.reason = 'outside-contact-triangle';
        return sample;
      }
      const a = triangle.vertices[0];
      const b = triangle.vertices[1];
      const c = triangle.vertices[2];
      ax = Number(a?.x || 0);
      ay = Number(a?.elevation || 0);
      az = pointZ(a);
      bx = Number(b?.x || 0);
      by = Number(b?.elevation || 0);
      bz = pointZ(b);
      cx = Number(c?.x || 0);
      cy = Number(c?.elevation || 0);
      cz = pointZ(c);
      region = triangle.region || 'terrain';
      source = triangle.source || 'terrain';
      priority = Number(triangle.priority || 0);
    }
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 1e-10) {
      sample.reason = 'degenerate-contact-triangle';
      return sample;
    }
    const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
    const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
    const wc = 1 - wa - wb;
    if (wa < -BARYCENTRIC_EPSILON || wb < -BARYCENTRIC_EPSILON
      || wc < -BARYCENTRIC_EPSILON) {
      sample.reason = 'outside-contact-triangle';
      return sample;
    }
    const elevation = wa * ay + wb * by + wc * cy;
    const normalOffset = triangleIndex * 3;
    sample.valid = true;
    sample.elevation = elevation;
    sample.heightM = elevation * this.elevationScaleM;
    if (sampler.packed) {
      sample.normal.x = Number(sampler.normals[normalOffset] || 0);
      sample.normal.y = Number(sampler.normals[normalOffset + 1] ?? 1);
      sample.normal.z = Number(sampler.normals[normalOffset + 2] || 0);
    } else {
      const normal = sampler.triangles[triangleIndex].normal;
      sample.normal.x = Number(normal?.x || 0);
      sample.normal.y = Number(normal?.y ?? 1);
      sample.normal.z = Number(normal?.z || 0);
    }
    sample.region = region;
    sample.source = source;
    sample.triangleId = triangleIndex;
    sample.reason = null;
    sample.score = priority;
    sample.bakedElevation = elevation;
    sample.bakedTriangleId = triangleIndex;
    sample.bakedSurfaceSource = source;
    return annotatePreparedSupport(this.sampler, sample);
  }

  classifyCollisionFeaturesInBounds(bounds = this.bounds, target = this.collisionClassificationResult) {
    target.classification = 'smooth-connected-surface';
    target.discontinuity = false;
    target.featureCount = 0;
    target.edgeClassifications = this.cache.edgeClassificationCounts;
    const resolved = finiteBounds(bounds);
    if (!resolved || !this.sampler?.triangleCount) {
      target.classification = 'no-terrain';
      target.discontinuity = true;
      return target;
    }
    const priority = {
      'curb-or-authored-step': 1,
      'height-discontinuity': 2,
      'sharp-dihedral-edge': 3,
      'non-manifold-seam': 4,
      'vertical-static-obstacle': 5
    };
    let selectedPriority = 0;
    const features = this.cache.discontinuityEdges;
    for (let index = 0; index < features.length; index += 1) {
      const feature = features[index];
      if (feature.maxX < resolved.minX - BARYCENTRIC_EPSILON
        || feature.minX > resolved.maxX + BARYCENTRIC_EPSILON
        || (Number.isFinite(Number(resolved.minY))
          && feature.maxY < resolved.minY - BARYCENTRIC_EPSILON)
        || (Number.isFinite(Number(resolved.maxY))
          && feature.minY > resolved.maxY + BARYCENTRIC_EPSILON)
        || feature.maxZ < resolved.minZ - BARYCENTRIC_EPSILON
        || feature.minZ > resolved.maxZ + BARYCENTRIC_EPSILON) continue;
      target.featureCount += 1;
      const featurePriority = priority[feature.classification] || 1;
      if (featurePriority > selectedPriority) {
        selectedPriority = featurePriority;
        target.classification = feature.classification;
      }
    }
    target.discontinuity = target.featureCount > 0;
    return target;
  }

  samplePoints(points = [], {
    preferredRegion = null
  } = EMPTY_SAMPLE_POINTS_OPTIONS) {
    const count = points.length;
    this.statistics.batchQueries += 1;
    this.physicsCostAccounting?.count('terrainQueryFrameBatchQueries');
    const batch = this.acquireBatchBuffer(count);
    const samples = batch.samples;
    for (let index = 0; index < count; index += 1) {
      const point = points[index];
      if (!batch.targets[index]) {
        batch.targets[index] = createMutableSample();
        this.statistics.temporaryObjects += 2;
        this.physicsCostAccounting?.count('temporaryObjects', 2);
        this.physicsCostAccounting?.count('terrainBatchTargetAllocations');
      }
      const sample = this.samplePoint(
        points[index], batch.targets[index], preferredRegion
      );
      this.writeBatchResult(batch, index, point, sample);
    }
    this.lastBatch = batch;
    return samples;
  }

  sampleSupportEntries(entries = []) {
    const count = entries.length;
    this.statistics.batchQueries += 1;
    this.physicsCostAccounting?.count('terrainQueryFrameBatchQueries');
    const batch = this.bodySupportBatch;
    if (growBatchBuffer(batch, count)) {
      this.statistics.temporaryObjects += 5;
      this.physicsCostAccounting?.count('temporaryObjects', 5);
      this.physicsCostAccounting?.count('terrainBatchBufferGrowths');
    }
    batch.count = count;
    batch.samples.length = count;
    const samples = batch.samples;
    for (let index = 0; index < count; index += 1) {
      const entry = entries[index];
      const point = entry.worldPoint;
      if (!batch.targets[index]) {
        batch.targets[index] = createMutableSample();
        this.statistics.temporaryObjects += 2;
        this.physicsCostAccounting?.count('temporaryObjects', 2);
        this.physicsCostAccounting?.count('terrainBatchTargetAllocations');
      }
      const candidateId = entry.candidate?.id || null;
      let sample = null;
      if (candidateId && entry.contactTriangleCandidateId === candidateId
        && Number.isInteger(entry.contactTriangleId)) {
        sample = this.samplePointOnTriangle(
          point,
          entry.contactTriangleId,
          batch.targets[index]
        );
      }
      if (!sample?.valid) sample = this.samplePoint(point, batch.targets[index]);
      if (candidateId && sample.valid) {
        entry.contactTriangleCandidateId = candidateId;
        entry.contactTriangleId = sample.triangleId;
      }
      this.writeBatchResult(batch, index, point, sample);
    }
    this.lastBatch = batch;
    return samples;
  }

  samplePackedPoints(coordinates, count, {
    startIndex = 0,
    stride = 3,
    xOffset = 0,
    yOffset = 1,
    zOffset = 2,
    preferredRegion = null
  } = EMPTY_PACKED_POINTS_OPTIONS) {
    const resolvedCount = Math.max(0, Math.trunc(Number(count) || 0));
    this.statistics.batchQueries += 1;
    this.physicsCostAccounting?.count('terrainQueryFrameBatchQueries');
    const batch = this.acquireBatchBuffer(resolvedCount);
    for (let index = 0; index < resolvedCount; index += 1) {
      if (!batch.targets[index]) {
        batch.targets[index] = createMutableSample();
        this.statistics.temporaryObjects += 2;
        this.physicsCostAccounting?.count('temporaryObjects', 2);
        this.physicsCostAccounting?.count('terrainBatchTargetAllocations');
      }
      let point = batch.queryPoints[index];
      if (!point) {
        point = { x: 0, y: 0, z: 0 };
        batch.queryPoints[index] = point;
        this.statistics.temporaryObjects += 1;
        this.physicsCostAccounting?.count('temporaryObjects');
        this.physicsCostAccounting?.count('terrainBatchPointAllocations');
      }
      const offset = (startIndex + index) * stride;
      point.x = Number(coordinates[offset + xOffset] || 0);
      point.y = Number(coordinates[offset + yOffset] || 0);
      point.z = Number(coordinates[offset + zOffset] || 0);
      const sample = this.samplePoint(point, batch.targets[index], preferredRegion);
      this.writeBatchResult(batch, index, point, sample);
    }
    this.lastBatch = batch;
    return batch.samples;
  }

  writeBatchResult(batch, index, point, sample) {
    batch.samples[index] = sample;
    batch.pointXZ[index * 2] = Number(point?.x || 0);
    batch.pointXZ[index * 2 + 1] = pointZ(point);
    batch.valid[index] = sample.valid ? 1 : 0;
    batch.heightM[index] = sample.valid ? Number(sample.heightM) : Number.NaN;
    batch.normalXYZ[index * 3] = Number(sample.normal?.x || 0);
    batch.normalXYZ[index * 3 + 1] = Number(sample.normal?.y ?? 1);
    batch.normalXYZ[index * 3 + 2] = Number(sample.normal?.z || 0);
    batch.triangleId[index] = sample.triangleId === null
      || sample.triangleId === undefined ? -1 : Number(sample.triangleId);
  }

  acquireBatchBuffer(count) {
    let batch = this.batchBuffers[this.batchBufferCursor];
    if (!batch) {
      batch = createBatchBuffer(Math.max(
        this.cache.resultCapacity || DEFAULT_RESULT_CAPACITY,
        count
      ));
      this.batchBuffers.push(batch);
      this.statistics.temporaryObjects += 8;
      this.physicsCostAccounting?.count('temporaryObjects', 8);
      this.physicsCostAccounting?.count('terrainBatchBufferAllocations');
    }
    this.batchBufferCursor += 1;
    if (growBatchBuffer(batch, count)) {
      this.statistics.temporaryObjects += 5;
      this.physicsCostAccounting?.count('temporaryObjects', 5);
      this.physicsCostAccounting?.count('terrainBatchBufferGrowths');
    }
    batch.count = count;
    batch.samples.length = count;
    return batch;
  }

  maximumHeightInBounds(bounds = this.bounds) {
    const resolved = finiteBounds(bounds);
    if (!resolved || !this.sampler?.triangleCount) return null;
    this.statistics.maximumHeightQueries += 1;
    this.physicsCostAccounting?.count('terrainQueryFrameMaximumHeightQueries');
    let maximum = -Infinity;
    const count = this.collectTriangleIndicesInBounds(resolved);
    const indices = this.rangeTriangleIndices;
    const sampler = this.sampler;
    for (let entry = 0; entry < count; entry += 1) {
      const triangleIndex = indices[entry];
      if (sampler.packed) {
        const boundsOffset = triangleIndex * 4;
        if (sampler.bounds[boundsOffset + 1] < resolved.minX
          || sampler.bounds[boundsOffset] > resolved.maxX
          || sampler.bounds[boundsOffset + 3] < resolved.minZ
          || sampler.bounds[boundsOffset + 2] > resolved.maxZ) continue;
        const offset = triangleIndex * 9;
        if (sampler.bounds[boundsOffset] >= resolved.minX
          && sampler.bounds[boundsOffset + 1] <= resolved.maxX
          && sampler.bounds[boundsOffset + 2] >= resolved.minZ
          && sampler.bounds[boundsOffset + 3] <= resolved.maxZ) {
          maximum = Math.max(
            maximum,
            sampler.positions[offset + 1],
            sampler.positions[offset + 4],
            sampler.positions[offset + 7]
          );
          continue;
        }
        maximum = maximumTriangleHeightInBounds(
          maximum,
          resolved,
          sampler.positions[offset], sampler.positions[offset + 1], sampler.positions[offset + 2],
          sampler.positions[offset + 3], sampler.positions[offset + 4], sampler.positions[offset + 5],
          sampler.positions[offset + 6], sampler.positions[offset + 7], sampler.positions[offset + 8]
        );
      } else {
        const triangle = sampler.triangles[triangleIndex];
        if (!triangle || triangle.maxX < resolved.minX || triangle.minX > resolved.maxX
          || triangle.maxZ < resolved.minZ || triangle.minZ > resolved.maxZ) continue;
        if (triangle.minX >= resolved.minX && triangle.maxX <= resolved.maxX
          && triangle.minZ >= resolved.minZ && triangle.maxZ <= resolved.maxZ) {
          maximum = Math.max(
            maximum,
            Number(triangle.vertices[0]?.elevation || 0),
            Number(triangle.vertices[1]?.elevation || 0),
            Number(triangle.vertices[2]?.elevation || 0)
          );
          continue;
        }
        maximum = maximumTriangleHeightInBounds(
          maximum,
          resolved,
          Number(triangle.vertices[0]?.x || 0),
          Number(triangle.vertices[0]?.elevation || 0),
          pointZ(triangle.vertices[0]),
          Number(triangle.vertices[1]?.x || 0),
          Number(triangle.vertices[1]?.elevation || 0),
          pointZ(triangle.vertices[1]),
          Number(triangle.vertices[2]?.x || 0),
          Number(triangle.vertices[2]?.elevation || 0),
          pointZ(triangle.vertices[2])
        );
      }
    }
    this.statistics.trianglesVisited += count;
    this.physicsCostAccounting?.count('preparedTrianglesVisited', count);
    return Number.isFinite(maximum) ? maximum * this.elevationScaleM : null;
  }

  terrainVariationInBounds(bounds = this.bounds, reference = null, {
    heightToleranceM = 0.004,
    normalToleranceRad = 0.5 * Math.PI / 180
  } = {}) {
    const result = this.variationResult;
    const resolved = finiteBounds(bounds);
    if (!resolved || !reference?.normal || !this.sampler?.triangleCount
      || Math.abs(Number(reference.normal.y || 0)) < 0.1) {
      result.valid = false;
      result.triangleCount = 0;
      result.heightResidualRangeM = Infinity;
      result.maximumNormalAngleRad = Math.PI;
      result.discontinuity = true;
      return result;
    }
    const referenceX = Number(reference.point?.x || 0);
    const referenceZ = pointZ(reference.point || {});
    const referenceHeightM = Number(reference.heightM);
    const referenceNormal = reference.normal;
    const referenceNormalX = Number(referenceNormal.x || 0);
    const referenceNormalY = Number(referenceNormal.y || 1);
    const referenceNormalZ = Number(referenceNormal.z || 0);
    const sampler = this.sampler;
    let minimumResidualM = Infinity;
    let maximumResidualM = -Infinity;
    let minimumNormalDot = 1;
    let triangleCount = 0;
    const middleX = (resolved.minX + resolved.maxX) * 0.5;
    const middleZ = (resolved.minZ + resolved.maxZ) * 0.5;
    const count = this.collectTriangleIndicesInBounds(resolved);
    const indices = this.rangeTriangleIndices;
    for (let entry = 0; entry < count; entry += 1) {
      const triangleIndex = indices[entry];
      if (sampler.packed) {
        const boundsOffset = triangleIndex * 4;
        if (sampler.bounds[boundsOffset + 1] < resolved.minX
          || sampler.bounds[boundsOffset] > resolved.maxX
          || sampler.bounds[boundsOffset + 3] < resolved.minZ
          || sampler.bounds[boundsOffset + 2] > resolved.maxZ) continue;
        triangleCount += 1;
        const normalOffset = triangleIndex * 3;
        const normalDot = Math.max(-1, Math.min(1,
          sampler.normals[normalOffset] * Number(referenceNormal.x || 0)
            + sampler.normals[normalOffset + 1] * Number(referenceNormal.y || 0)
            + sampler.normals[normalOffset + 2] * Number(referenceNormal.z || 0)
        ));
        minimumNormalDot = Math.min(minimumNormalDot, normalDot);
        const positionOffset = triangleIndex * 9;
        for (let vertex = 0; vertex < 3; vertex += 1) {
          const x = sampler.positions[positionOffset + vertex * 3];
          const z = sampler.positions[positionOffset + vertex * 3 + 2];
          if (x >= resolved.minX - BARYCENTRIC_EPSILON
            && x <= resolved.maxX + BARYCENTRIC_EPSILON
            && z >= resolved.minZ - BARYCENTRIC_EPSILON
            && z <= resolved.maxZ + BARYCENTRIC_EPSILON) {
            const residualM = packedTriangleHeightResidualAt(
              sampler.positions,
              positionOffset,
              x,
              z,
              false,
              referenceX,
              referenceZ,
              referenceHeightM,
              referenceNormalX,
              referenceNormalY,
              referenceNormalZ,
              this.elevationScaleM
            );
            if (Number.isFinite(residualM)) {
              minimumResidualM = Math.min(minimumResidualM, residualM);
              maximumResidualM = Math.max(maximumResidualM, residualM);
            }
          }
        }
        for (let zIndex = 0; zIndex < 3; zIndex += 1) {
          const sampleZ = zIndex === 0 ? resolved.minZ
            : zIndex === 1 ? middleZ : resolved.maxZ;
          for (let xIndex = 0; xIndex < 3; xIndex += 1) {
            const sampleX = xIndex === 0 ? resolved.minX
              : xIndex === 1 ? middleX : resolved.maxX;
            const residualM = packedTriangleHeightResidualAt(
              sampler.positions,
              positionOffset,
              sampleX,
              sampleZ,
              true,
              referenceX,
              referenceZ,
              referenceHeightM,
              referenceNormalX,
              referenceNormalY,
              referenceNormalZ,
              this.elevationScaleM
            );
            if (Number.isFinite(residualM)) {
              minimumResidualM = Math.min(minimumResidualM, residualM);
              maximumResidualM = Math.max(maximumResidualM, residualM);
            }
          }
        }
      } else {
        const triangle = sampler.triangles[triangleIndex];
        if (!triangle || triangle.maxX < resolved.minX || triangle.minX > resolved.maxX
          || triangle.maxZ < resolved.minZ || triangle.minZ > resolved.maxZ) continue;
        triangleCount += 1;
        const normalDot = Math.max(-1, Math.min(1,
          Number(triangle.normal?.x || 0) * Number(referenceNormal.x || 0)
            + Number(triangle.normal?.y || 0) * Number(referenceNormal.y || 0)
            + Number(triangle.normal?.z || 0) * Number(referenceNormal.z || 0)
        ));
        minimumNormalDot = Math.min(minimumNormalDot, normalDot);
        for (let vertex = 0; vertex < 3; vertex += 1) {
          const point = triangle.vertices[vertex];
          const x = Number(point?.x || 0);
          const z = pointZ(point);
          if (x < resolved.minX - BARYCENTRIC_EPSILON
            || x > resolved.maxX + BARYCENTRIC_EPSILON
            || z < resolved.minZ - BARYCENTRIC_EPSILON
            || z > resolved.maxZ + BARYCENTRIC_EPSILON) continue;
          const tangentHeightM = referenceHeightM - (
            referenceNormalX * (x - referenceX) + referenceNormalZ * (z - referenceZ)
          ) / referenceNormalY;
          const residualM = Number(point?.elevation || 0) * this.elevationScaleM
            - tangentHeightM;
          minimumResidualM = Math.min(minimumResidualM, residualM);
          maximumResidualM = Math.max(maximumResidualM, residualM);
        }
      }
    }
    const heightResidualRangeM = Number.isFinite(minimumResidualM)
      ? maximumResidualM - minimumResidualM : 0;
    const maximumNormalAngleRad = Math.acos(Math.max(-1, Math.min(1, minimumNormalDot)));
    this.statistics.trianglesVisited += triangleCount;
    this.physicsCostAccounting?.count('preparedTrianglesVisited', triangleCount);
    this.physicsCostAccounting?.count('terrainVariationQueries');
    if (heightResidualRangeM > heightToleranceM) {
      this.physicsCostAccounting?.count('terrainVariationHeightTriggers');
    }
    if (maximumNormalAngleRad > normalToleranceRad) {
      this.physicsCostAccounting?.count('terrainVariationNormalTriggers');
    }
    result.valid = triangleCount > 0;
    result.triangleCount = triangleCount;
    result.heightResidualRangeM = heightResidualRangeM;
    result.maximumNormalAngleRad = maximumNormalAngleRad;
    result.discontinuity = triangleCount === 0
      || heightResidualRangeM > heightToleranceM
      || maximumNormalAngleRad > normalToleranceRad;
    return result;
  }

  forEachTriangleInBounds(bounds = this.bounds, callback = null) {
    const resolved = finiteBounds(bounds);
    if (!resolved || !this.sampler?.triangleCount || typeof callback !== 'function') return 0;
    const sampler = this.sampler;
    const count = this.collectTriangleIndicesInBounds(resolved);
    const indices = this.rangeTriangleIndices;
    const view = this.triangleView;
    let visited = 0;
    for (let entry = 0; entry < count; entry += 1) {
      const triangleIndex = indices[entry];
      if (sampler.packed) {
        const boundsOffset = triangleIndex * 4;
        if (sampler.bounds[boundsOffset + 1] < resolved.minX
          || sampler.bounds[boundsOffset] > resolved.maxX
          || sampler.bounds[boundsOffset + 3] < resolved.minZ
          || sampler.bounds[boundsOffset + 2] > resolved.maxZ) continue;
        visited += 1;
        view.index = triangleIndex;
        view.positions = sampler.positions;
        view.positionOffset = triangleIndex * 9;
        view.normals = sampler.normals;
        view.normalOffset = triangleIndex * 3;
        view.triangle = null;
        view.elevationScaleM = this.elevationScaleM;
        view.region = sampler.regionTable[sampler.regions[triangleIndex]] || 'terrain';
        view.source = sampler.sourceTable[sampler.sources[triangleIndex]] || 'terrain';
        callback(view);
      } else {
        const triangle = sampler.triangles[triangleIndex];
        if (!triangle || triangle.maxX < resolved.minX || triangle.minX > resolved.maxX
          || triangle.maxZ < resolved.minZ || triangle.minZ > resolved.maxZ) continue;
        visited += 1;
        view.index = triangleIndex;
        view.positions = null;
        view.positionOffset = 0;
        view.normals = null;
        view.normalOffset = 0;
        view.triangle = triangle;
        view.elevationScaleM = this.elevationScaleM;
        view.region = triangle.region;
        view.source = triangle.source;
        callback(view);
      }
    }
    this.statistics.trianglesVisited += visited;
    this.physicsCostAccounting?.count('preparedTrianglesVisited', visited);
    return visited;
  }

  segmentTriangleSweep(start = {}, end = {}, bounds = null, target = this.segmentResult) {
    target.hit = false;
    target.fraction = null;
    target.triangleId = null;
    target.region = null;
    target.source = null;
    const sampler = this.sampler;
    if (!sampler?.triangleCount) return target;
    const minX = Number(bounds?.minX ?? Math.min(Number(start.x || 0), Number(end.x || 0)));
    const maxX = Number(bounds?.maxX ?? Math.max(Number(start.x || 0), Number(end.x || 0)));
    const minY = Number(bounds?.minY ?? Math.min(Number(start.y || 0), Number(end.y || 0)));
    const maxY = Number(bounds?.maxY ?? Math.max(Number(start.y || 0), Number(end.y || 0)));
    const minZ = Number(bounds?.minZ ?? Math.min(pointZ(start), pointZ(end)));
    const maxZ = Number(bounds?.maxZ ?? Math.max(pointZ(start), pointZ(end)));
    const sx = Number(start.x || 0);
    const sy = Number(start.y || 0);
    const sz = pointZ(start);
    const dx = Number(end.x || 0) - sx;
    const dy = Number(end.y || 0) - sy;
    const dz = pointZ(end) - sz;
    let bestFraction = Infinity;
    const count = this.collectTriangleIndicesInBounds({ minX, maxX, minZ, maxZ });
    const indices = this.rangeTriangleIndices;
    for (let entry = 0; entry < count; entry += 1) {
      const triangleIndex = indices[entry];
      let ax;
      let ay;
      let az;
      let bx;
      let by;
      let bz;
      let cx;
      let cy;
      let cz;
      let triangle = null;
      if (sampler.packed) {
        const boundsOffset = triangleIndex * 4;
        if (sampler.bounds[boundsOffset + 1] < minX - BARYCENTRIC_EPSILON
          || sampler.bounds[boundsOffset] > maxX + BARYCENTRIC_EPSILON
          || sampler.bounds[boundsOffset + 3] < minZ - BARYCENTRIC_EPSILON
          || sampler.bounds[boundsOffset + 2] > maxZ + BARYCENTRIC_EPSILON) continue;
        const offset = triangleIndex * 9;
        ax = sampler.positions[offset];
        ay = sampler.positions[offset + 1] * this.elevationScaleM;
        az = sampler.positions[offset + 2];
        bx = sampler.positions[offset + 3];
        by = sampler.positions[offset + 4] * this.elevationScaleM;
        bz = sampler.positions[offset + 5];
        cx = sampler.positions[offset + 6];
        cy = sampler.positions[offset + 7] * this.elevationScaleM;
        cz = sampler.positions[offset + 8];
      } else {
        triangle = sampler.triangles[triangleIndex];
        if (!triangle || triangle.maxX < minX - BARYCENTRIC_EPSILON
          || triangle.minX > maxX + BARYCENTRIC_EPSILON
          || triangle.maxZ < minZ - BARYCENTRIC_EPSILON
          || triangle.minZ > maxZ + BARYCENTRIC_EPSILON) continue;
        ax = Number(triangle.vertices[0]?.x || 0);
        ay = Number(triangle.vertices[0]?.elevation || 0) * this.elevationScaleM;
        az = pointZ(triangle.vertices[0]);
        bx = Number(triangle.vertices[1]?.x || 0);
        by = Number(triangle.vertices[1]?.elevation || 0) * this.elevationScaleM;
        bz = pointZ(triangle.vertices[1]);
        cx = Number(triangle.vertices[2]?.x || 0);
        cy = Number(triangle.vertices[2]?.elevation || 0) * this.elevationScaleM;
        cz = pointZ(triangle.vertices[2]);
      }
      if (Math.max(ay, by, cy) < minY - BARYCENTRIC_EPSILON
        || Math.min(ay, by, cy) > maxY + BARYCENTRIC_EPSILON) continue;
      const e1x = bx - ax;
      const e1y = by - ay;
      const e1z = bz - az;
      const e2x = cx - ax;
      const e2y = cy - ay;
      const e2z = cz - az;
      const px = dy * e2z - dz * e2y;
      const py = dz * e2x - dx * e2z;
      const pz = dx * e2y - dy * e2x;
      const determinant = e1x * px + e1y * py + e1z * pz;
      this.physicsCostAccounting?.count('triangleIntersectionTests');
      if (Math.abs(determinant) <= 1e-10) continue;
      const inverse = 1 / determinant;
      const tx = sx - ax;
      const ty = sy - ay;
      const tz = sz - az;
      const u = (tx * px + ty * py + tz * pz) * inverse;
      if (u < -1e-8 || u > 1 + 1e-8) continue;
      const qx = ty * e1z - tz * e1y;
      const qy = tz * e1x - tx * e1z;
      const qz = tx * e1y - ty * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inverse;
      if (v < -1e-8 || u + v > 1 + 1e-8) continue;
      const fraction = (e2x * qx + e2y * qy + e2z * qz) * inverse;
      if (fraction <= 1e-6 || fraction > 1 + 1e-8
        || fraction > bestFraction + 1e-12) continue;
      if (Math.abs(fraction - bestFraction) <= 1e-12
        && triangleIndex >= Number(target.triangleId ?? Infinity)) continue;
      bestFraction = Math.max(0, Math.min(1, fraction));
      target.hit = true;
      target.fraction = bestFraction;
      target.point.x = sx + dx * bestFraction;
      target.point.y = sy + dy * bestFraction;
      target.point.z = sz + dz * bestFraction;
      if (sampler.packed) {
        const normalOffset = triangleIndex * 3;
        target.normal.x = sampler.normals[normalOffset];
        target.normal.y = sampler.normals[normalOffset + 1];
        target.normal.z = sampler.normals[normalOffset + 2];
      } else {
        target.normal.x = Number(triangle.normal?.x || 0);
        target.normal.y = Number(triangle.normal?.y ?? 1);
        target.normal.z = Number(triangle.normal?.z || 0);
      }
      target.triangleId = triangleIndex;
      target.region = sampler.packed
        ? (sampler.regionTable[sampler.regions[triangleIndex]] || 'terrain')
        : (triangle.region || 'terrain');
      target.source = sampler.packed
        ? (sampler.sourceTable[sampler.sources[triangleIndex]] || 'terrain')
        : (triangle.source || 'terrain');
    }
    this.statistics.trianglesVisited += count;
    this.physicsCostAccounting?.count('preparedTrianglesVisited', count);
    return target;
  }

  project(cacheKey, point, projector) {
    const slot = Math.abs(Number(cacheKey) || 0) % this.projectionValues.length;
    const x = Number(point?.x || 0);
    const z = pointZ(point);
    const key = `${cacheKey}:${x}:${z}`;
    if (this.projectionKeys[slot] === key) {
      this.statistics.projectionCacheHits += 1;
      return this.projectionValues[slot];
    }
    this.statistics.projectionCacheMisses += 1;
    const value = typeof projector === 'function' ? projector(point) : null;
    this.projectionKeys[slot] = key;
    this.projectionValues[slot] = value;
    return value;
  }

  materialForWheel(wheelIndex, key, resolver) {
    const slot = Math.max(0, Math.min(3, Math.trunc(Number(wheelIndex) || 0)));
    if (this.materialKeys[slot] === key) {
      this.statistics.materialCacheHits += 1;
      return this.materialValues[slot];
    }
    this.statistics.materialCacheMisses += 1;
    const value = typeof resolver === 'function' ? resolver() : null;
    this.materialKeys[slot] = key;
    this.materialValues[slot] = value;
    return value;
  }

  materialForWheelSignature(
    wheelIndex,
    triangleId,
    region,
    source,
    resolver,
    point,
    context = null
  ) {
    const slot = Math.max(0, Math.min(3, Math.trunc(Number(wheelIndex) || 0)));
    const resolvedTriangleId = Number.isInteger(Number(triangleId))
      ? Number(triangleId) : -1;
    if (this.materialTriangleIds[slot] === resolvedTriangleId
      && this.materialRegions[slot] === region
      && this.materialSources[slot] === source) {
      this.statistics.materialCacheHits += 1;
      return this.materialValues[slot];
    }
    this.statistics.materialCacheMisses += 1;
    const value = typeof resolver === 'function'
      ? resolver(point, context) : null;
    this.materialTriangleIds[slot] = resolvedTriangleId;
    this.materialRegions[slot] = region;
    this.materialSources[slot] = source;
    this.materialValues[slot] = value;
    return value;
  }

  noteFullSurfaceClassification(count = 1) {
    this.statistics.fullSurfaceClassifications += Number(count) || 0;
    this.physicsCostAccounting?.count('terrainQueryFrameFullSurfaceClassifications', count);
  }

  acquireBodySupportBuffer() {
    let buffer = null;
    for (let index = 0; index < this.bodySupportBuffers.length; index += 1) {
      if (this.bodySupportBuffers[index].inUse === false) {
        buffer = this.bodySupportBuffers[index];
        break;
      }
    }
    if (!buffer) {
      buffer = {
        inUse: false,
        entries: [],
        adaptiveAdditions: [],
        sampledTerrain: new Map(),
        supportCandidates: [],
        supportEnvelopeCandidates: new Map(),
        supportEnvelopeHeights: new Map(),
        spareEntries: Array.from({ length: 256 }, () => ({
          candidate: null,
          contactTriangleCandidateId: null,
          contactTriangleId: null,
          adaptiveCandidate: {
            id: '',
            pieceId: null,
            pieceType: null,
            localPoint: { x: 0, y: 0, z: 0 },
            adaptive: true
          },
          arm: { x: 0, y: 0, z: 0 },
          worldPoint: { x: 0, y: 0, z: 0 }
        }))
      };
      this.bodySupportBuffers.push(buffer);
      this.statistics.temporaryObjects += 2;
      this.physicsCostAccounting?.count('temporaryObjects', 2);
    }
    buffer.inUse = true;
    return buffer;
  }

  releaseBodySupportBuffer(buffer) {
    if (!buffer) return;
    buffer.inUse = false;
  }
}

export function createPhysicsTerrainQueryFrameCache(options = {}) {
  return new PhysicsTerrainQueryFrameCache(options);
}

export default PhysicsTerrainQueryFrame;
