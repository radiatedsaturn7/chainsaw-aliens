const pointZ = (point = {}) => Number(point.z ?? point.y ?? 0);

const regionPriority = {
  road: 5,
  margin: 4,
  shoulder: 3,
  'flat-join': 3,
  inner: 3,
  transition: 2,
  terrain: 1
};

const PACKED_SURFACE_VERSION = 2;

function triangleNormal(a = {}, b = {}, c = {}, elevationScaleM = 12) {
  const ab = {
    x: Number(b.x || 0) - Number(a.x || 0),
    y: (Number(b.elevation || 0) - Number(a.elevation || 0)) * elevationScaleM,
    z: pointZ(b) - pointZ(a)
  };
  const ac = {
    x: Number(c.x || 0) - Number(a.x || 0),
    y: (Number(c.elevation || 0) - Number(a.elevation || 0)) * elevationScaleM,
    z: pointZ(c) - pointZ(a)
  };
  let normal = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x
  };
  if (normal.y < 0) normal = { x: -normal.x, y: -normal.y, z: -normal.z };
  const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
  return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
}

function addPolygonTriangles(target = [], points = [], metadata = {}) {
  if (!Array.isArray(points) || points.length < 3) return;
  for (let index = 1; index < points.length - 1; index += 1) {
    const vertices = [points[0], points[index], points[index + 1]];
    if (vertices.some((point) => !Number.isFinite(Number(point?.x))
      || !Number.isFinite(pointZ(point))
      || !Number.isFinite(Number(point?.elevation)))) continue;
    target.push({ vertices, ...metadata });
  }
}

function terrainCellRegion(cell = {}) {
  const regions = new Set((cell.points || []).map((point) => String(point?.terrainRegion || point?.region || 'terrain')));
  if (regions.has('transition')) return 'transition';
  if (regions.has('shoulder')) return 'shoulder';
  if (regions.has('flat-join')) return 'flat-join';
  if (regions.has('inner')) return 'inner';
  return 'terrain';
}

function addSurfaceSectionTriangles(target = [], sections = [], runtimeType = 'destination') {
  if (!Array.isArray(sections) || sections.length < 2) return;
  const pairCount = runtimeType === 'circuit' ? sections.length : sections.length - 1;
  for (let index = 0; index < pairCount; index += 1) {
    const near = sections[index];
    const far = sections[(index + 1) % sections.length];
    addPolygonTriangles(target, [near?.left, far?.left, far?.right, near?.right], {
      region: 'road',
      source: 'road',
      priority: regionPriority.road
    });
    if (near?.marginLeft && far?.marginLeft) {
      addPolygonTriangles(target, [near.marginLeft, far.marginLeft, far.left, near.left], {
        region: 'margin',
        source: 'margin-left',
        priority: regionPriority.margin
      });
    }
    if (near?.marginRight && far?.marginRight) {
      addPolygonTriangles(target, [near.right, far.right, far.marginRight, near.marginRight], {
        region: 'margin',
        source: 'margin-right',
        priority: regionPriority.margin
      });
    }
  }
}

function indexSamplerTriangles(sampler, startIndex = 0) {
  const {
    triangles,
    buckets,
    bucketSizeM: bucketSize,
    elevationScaleM
  } = sampler;
  for (let triangleIndex = startIndex; triangleIndex < triangles.length; triangleIndex += 1) {
    const triangle = triangles[triangleIndex];
    const xs = triangle.vertices.map((point) => Number(point.x || 0));
    const zs = triangle.vertices.map((point) => pointZ(point));
    triangle.minX = Math.min(...xs);
    triangle.maxX = Math.max(...xs);
    triangle.minZ = Math.min(...zs);
    triangle.maxZ = Math.max(...zs);
    triangle.normal = triangle.normal || triangleNormal(...triangle.vertices, elevationScaleM);
    const minBucketX = Math.floor(triangle.minX / bucketSize);
    const maxBucketX = Math.floor(triangle.maxX / bucketSize);
    const minBucketZ = Math.floor(triangle.minZ / bucketSize);
    const maxBucketZ = Math.floor(triangle.maxZ / bucketSize);
    for (let z = minBucketZ; z <= maxBucketZ; z += 1) {
      for (let x = minBucketX; x <= maxBucketX; x += 1) {
        const key = `${x},${z}`;
        const bucket = buckets.get(key) || [];
        bucket.push(triangleIndex);
        buckets.set(key, bucket);
      }
    }
  }
  sampler.triangleCount = triangles.length;
  return sampler;
}

export function buildRaceBakedSurfaceSampler({
  mesh = null,
  terrainCells = [],
  surfaceBake = null,
  runtimeType = 'destination',
  elevationScaleM = 12,
  bucketSizeM = 20
} = {}) {
  const triangles = [];
  if (Array.isArray(mesh?.triangles) && mesh.triangles.length) {
    mesh.triangles.forEach((triangle, triangleIndex) => {
      const region = String(triangle.region || 'terrain');
      triangles.push({
        vertices: triangle.vertices || (triangle.indices || []).map((index) => mesh.vertices?.[index]).filter(Boolean),
        region,
        source: triangle.source || `canonical:${triangleIndex}`,
        priority: regionPriority[region] || regionPriority.terrain,
        normal: triangle.faceNormal || null,
        canonicalTriangleIndex: triangleIndex
      });
    });
  } else {
    addSurfaceSectionTriangles(triangles, surfaceBake?.sections || [], runtimeType);
    terrainCells.forEach((cell) => {
      const region = terrainCellRegion(cell);
      addPolygonTriangles(triangles, cell.points || [], {
        region,
        source: cell.key || 'terrain',
        priority: regionPriority[region] || regionPriority.terrain
      });
    });
  }
  const bucketSize = Math.max(4, Number(bucketSizeM) || 20);
  return indexSamplerTriangles({
    triangles,
    buckets: new Map(),
    bucketSizeM: bucketSize,
    elevationScaleM,
    triangleCount: 0
  });
}

export function appendRaceBakedSurfaceSamplerTerrainCells(sampler = null, terrainCells = []) {
  if (!sampler || !Array.isArray(sampler.triangles) || !sampler.buckets || !Array.isArray(terrainCells)) return sampler;
  const startIndex = sampler.triangles.length;
  terrainCells.forEach((cell) => {
    const region = terrainCellRegion(cell);
    addPolygonTriangles(sampler.triangles, cell.points || [], {
      region,
      source: cell.key || 'terrain',
      priority: regionPriority[region] || regionPriority.terrain
    });
  });
  return indexSamplerTriangles(sampler, startIndex);
}

export function packRaceBakedSurfaceSampler(sampler = null) {
  if (!sampler?.triangles?.length) return null;
  const triangles = sampler.triangles;
  const regionTable = [...new Set(triangles.map((triangle) => String(triangle.region || 'terrain')))];
  const sourceTable = ['road', 'margin', 'terrain'];
  // Surface selection can land exactly on a shared triangle edge. Keep the
  // authored precision so packing cannot change which face wins the tie.
  const positions = new Float64Array(triangles.length * 9);
  const normals = new Float64Array(triangles.length * 3);
  const bounds = new Float64Array(triangles.length * 4);
  const regions = new Uint8Array(triangles.length);
  const sources = new Uint8Array(triangles.length);
  const priorities = new Uint8Array(triangles.length);
  triangles.forEach((triangle, triangleIndex) => {
    (triangle.vertices || []).slice(0, 3).forEach((point, vertexIndex) => {
      const offset = triangleIndex * 9 + vertexIndex * 3;
      positions[offset] = Number(point?.x || 0);
      positions[offset + 1] = Number(point?.elevation || 0);
      positions[offset + 2] = pointZ(point);
    });
    const normalOffset = triangleIndex * 3;
    normals[normalOffset] = Number(triangle.normal?.x || 0);
    normals[normalOffset + 1] = Number(triangle.normal?.y ?? 1);
    normals[normalOffset + 2] = Number(triangle.normal?.z || 0);
    const boundsOffset = triangleIndex * 4;
    bounds[boundsOffset] = Number(triangle.minX || 0);
    bounds[boundsOffset + 1] = Number(triangle.maxX || 0);
    bounds[boundsOffset + 2] = Number(triangle.minZ || 0);
    bounds[boundsOffset + 3] = Number(triangle.maxZ || 0);
    regions[triangleIndex] = Math.max(0, regionTable.indexOf(String(triangle.region || 'terrain')));
    const source = String(triangle.source || '');
    sources[triangleIndex] = source.startsWith('road')
      ? 0
      : source.startsWith('margin')
        ? 1
        : 2;
    priorities[triangleIndex] = Math.max(0, Math.min(255, Math.round(Number(triangle.priority || 0))));
  });
  const bucketEntries = [...sampler.buckets.entries()];
  const bucketCoords = new Int32Array(bucketEntries.length * 2);
  const bucketOffsets = new Uint32Array(bucketEntries.length + 1);
  const bucketTriangleCount = bucketEntries.reduce((sum, [, entries]) => sum + entries.length, 0);
  const bucketTriangles = new Uint32Array(bucketTriangleCount);
  let bucketOffset = 0;
  bucketEntries.forEach(([key, entries], bucketIndex) => {
    const [x, z] = String(key).split(',').map(Number);
    bucketCoords[bucketIndex * 2] = Math.trunc(x || 0);
    bucketCoords[bucketIndex * 2 + 1] = Math.trunc(z || 0);
    bucketOffsets[bucketIndex] = bucketOffset;
    bucketTriangles.set(entries, bucketOffset);
    bucketOffset += entries.length;
  });
  bucketOffsets[bucketEntries.length] = bucketOffset;
  return {
    packed: true,
    version: PACKED_SURFACE_VERSION,
    triangleCount: triangles.length,
    bucketSizeM: sampler.bucketSizeM,
    elevationScaleM: sampler.elevationScaleM,
    positions,
    normals,
    bounds,
    regions,
    sources,
    priorities,
    regionTable,
    sourceTable,
    bucketCoords,
    bucketOffsets,
    bucketTriangles,
    bucketLookup: null
  };
}

export function packRaceCanonicalSurfaceMesh(mesh = null, {
  bucketSizeM = 20,
  elevationScaleM = 12
} = {}) {
  if (!Array.isArray(mesh?.triangles) || !mesh.triangles.length) return null;
  const triangles = mesh.triangles;
  const regionTable = [...new Set(triangles.map((triangle) => String(triangle?.region || 'terrain')))];
  const sourceTable = ['road', 'margin', 'terrain'];
  const positions = new Float64Array(triangles.length * 9);
  const normals = new Float64Array(triangles.length * 3);
  const bounds = new Float64Array(triangles.length * 4);
  const regions = new Uint8Array(triangles.length);
  const sources = new Uint8Array(triangles.length);
  const priorities = new Uint8Array(triangles.length);
  const bucketSize = Math.max(4, Number(bucketSizeM) || 20);
  const buckets = new Map();

  triangles.forEach((triangle, triangleIndex) => {
    const vertices = Array.isArray(triangle?.vertices) && triangle.vertices.length >= 3
      ? triangle.vertices
      : (triangle?.indices || []).slice(0, 3).map((index) => mesh.vertices?.[index]).filter(Boolean);
    const safeVertices = [vertices[0] || {}, vertices[1] || {}, vertices[2] || {}];
    safeVertices.forEach((point, vertexIndex) => {
      const offset = triangleIndex * 9 + vertexIndex * 3;
      positions[offset] = Number(point?.x || 0);
      positions[offset + 1] = Number(point?.elevation || 0);
      positions[offset + 2] = pointZ(point);
    });

    const normal = triangle?.faceNormal || triangle?.normal
      || triangleNormal(...safeVertices, elevationScaleM);
    const normalOffset = triangleIndex * 3;
    normals[normalOffset] = Number(normal?.x || 0);
    normals[normalOffset + 1] = Number(normal?.y ?? 1);
    normals[normalOffset + 2] = Number(normal?.z || 0);

    const xs = safeVertices.map((point) => Number(point?.x || 0));
    const zs = safeVertices.map((point) => pointZ(point));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const boundsOffset = triangleIndex * 4;
    bounds[boundsOffset] = minX;
    bounds[boundsOffset + 1] = maxX;
    bounds[boundsOffset + 2] = minZ;
    bounds[boundsOffset + 3] = maxZ;

    const region = String(triangle?.region || 'terrain');
    regions[triangleIndex] = Math.max(0, regionTable.indexOf(region));
    const source = String(triangle?.source || '');
    sources[triangleIndex] = source.startsWith('road')
      ? 0
      : source.startsWith('margin')
        ? 1
        : 2;
    priorities[triangleIndex] = Math.max(
      0,
      Math.min(255, Math.round(Number(triangle?.priority ?? regionPriority[region] ?? regionPriority.terrain)))
    );

    const minBucketX = Math.floor(minX / bucketSize);
    const maxBucketX = Math.floor(maxX / bucketSize);
    const minBucketZ = Math.floor(minZ / bucketSize);
    const maxBucketZ = Math.floor(maxZ / bucketSize);
    for (let z = minBucketZ; z <= maxBucketZ; z += 1) {
      for (let x = minBucketX; x <= maxBucketX; x += 1) {
        const key = `${x},${z}`;
        const entries = buckets.get(key) || [];
        entries.push(triangleIndex);
        buckets.set(key, entries);
      }
    }
  });

  const bucketEntries = [...buckets.entries()];
  const bucketCoords = new Int32Array(bucketEntries.length * 2);
  const bucketOffsets = new Uint32Array(bucketEntries.length + 1);
  const bucketTriangleCount = bucketEntries.reduce((sum, [, entries]) => sum + entries.length, 0);
  const bucketTriangles = new Uint32Array(bucketTriangleCount);
  let bucketOffset = 0;
  bucketEntries.forEach(([key, entries], bucketIndex) => {
    const [x, z] = String(key).split(',').map(Number);
    bucketCoords[bucketIndex * 2] = Math.trunc(x || 0);
    bucketCoords[bucketIndex * 2 + 1] = Math.trunc(z || 0);
    bucketOffsets[bucketIndex] = bucketOffset;
    bucketTriangles.set(entries, bucketOffset);
    bucketOffset += entries.length;
  });
  bucketOffsets[bucketEntries.length] = bucketOffset;

  return {
    packed: true,
    version: PACKED_SURFACE_VERSION,
    triangleCount: triangles.length,
    bucketSizeM: bucketSize,
    elevationScaleM,
    positions,
    normals,
    bounds,
    regions,
    sources,
    priorities,
    regionTable,
    sourceTable,
    bucketCoords,
    bucketOffsets,
    bucketTriangles,
    bucketLookup: null
  };
}

export function getPackedRaceSurfaceTransferables(sampler = null) {
  if (!sampler?.packed) return [];
  return [
    sampler.positions,
    sampler.normals,
    sampler.bounds,
    sampler.regions,
    sampler.sources,
    sampler.priorities,
    sampler.bucketCoords,
    sampler.bucketOffsets,
    sampler.bucketTriangles
  ].map((entry) => entry?.buffer).filter(Boolean);
}

function samplePackedRaceBakedSurface(sampler, worldPoint, preferredRegion = null) {
  const x = Number(worldPoint.x || 0);
  const z = pointZ(worldPoint);
  if (!sampler.bucketLookup) {
    sampler.bucketLookup = new Map();
    for (let bucketIndex = 0; bucketIndex < sampler.bucketOffsets.length - 1; bucketIndex += 1) {
      sampler.bucketLookup.set(
        `${sampler.bucketCoords[bucketIndex * 2]},${sampler.bucketCoords[bucketIndex * 2 + 1]}`,
        bucketIndex
      );
    }
  }
  const bucketKey = `${Math.floor(x / sampler.bucketSizeM)},${Math.floor(z / sampler.bucketSizeM)}`;
  const bucketIndex = sampler.bucketLookup.get(bucketKey);
  if (!Number.isFinite(bucketIndex)) return null;
  let best = null;
  const start = sampler.bucketOffsets[bucketIndex];
  const end = sampler.bucketOffsets[bucketIndex + 1];
  for (let entryIndex = start; entryIndex < end; entryIndex += 1) {
    const triangleIndex = sampler.bucketTriangles[entryIndex];
    const boundsOffset = triangleIndex * 4;
    if (x < sampler.bounds[boundsOffset] - 0.0001
      || x > sampler.bounds[boundsOffset + 1] + 0.0001
      || z < sampler.bounds[boundsOffset + 2] - 0.0001
      || z > sampler.bounds[boundsOffset + 3] + 0.0001) continue;
    const positionOffset = triangleIndex * 9;
    const ax = sampler.positions[positionOffset];
    const ay = sampler.positions[positionOffset + 1];
    const az = sampler.positions[positionOffset + 2];
    const bx = sampler.positions[positionOffset + 3];
    const by = sampler.positions[positionOffset + 4];
    const bz = sampler.positions[positionOffset + 5];
    const cx = sampler.positions[positionOffset + 6];
    const cy = sampler.positions[positionOffset + 7];
    const cz = sampler.positions[positionOffset + 8];
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 0.0000001) continue;
    const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
    const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
    const wc = 1 - wa - wb;
    if (wa < -0.0001 || wb < -0.0001 || wc < -0.0001) continue;
    const elevation = wa * ay + wb * by + wc * cy;
    const region = sampler.regionTable[sampler.regions[triangleIndex]] || 'terrain';
    const regionMatch = preferredRegion && (
      region === preferredRegion
      || (preferredRegion === 'shoulder' && ['inner', 'flat-join'].includes(region))
      || (preferredRegion === 'terrain' && region === 'transition')
    );
    const score = Number(sampler.priorities[triangleIndex] || 0) + (regionMatch ? 20 : 0);
    if (!best || score > best.score || (score === best.score && elevation > best.elevation)) {
      const normalOffset = triangleIndex * 3;
      best = {
        triangleId: triangleIndex,
        elevation,
        normal: {
          x: sampler.normals[normalOffset],
          y: sampler.normals[normalOffset + 1],
          z: sampler.normals[normalOffset + 2]
        },
        region,
        source: sampler.sourceTable[sampler.sources[triangleIndex]] || 'terrain',
        score
      };
    }
  }
  return best;
}

export function sampleRaceBakedSurface(sampler = null, worldPoint = null, {
  preferredRegion = null
} = {}) {
  if (!worldPoint) return null;
  if (sampler?.packed) return samplePackedRaceBakedSurface(sampler, worldPoint, preferredRegion);
  if (!sampler?.triangles?.length) return null;
  const x = Number(worldPoint.x || 0);
  const z = pointZ(worldPoint);
  const key = `${Math.floor(x / sampler.bucketSizeM)},${Math.floor(z / sampler.bucketSizeM)}`;
  const candidates = sampler.buckets.get(key) || [];
  let best = null;
  candidates.forEach((triangleIndex) => {
    const triangle = sampler.triangles[triangleIndex];
    if (x < triangle.minX - 0.0001 || x > triangle.maxX + 0.0001
      || z < triangle.minZ - 0.0001 || z > triangle.maxZ + 0.0001) return;
    const [a, b, c] = triangle.vertices;
    const ax = Number(a.x || 0);
    const az = pointZ(a);
    const bx = Number(b.x || 0);
    const bz = pointZ(b);
    const cx = Number(c.x || 0);
    const cz = pointZ(c);
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 0.0000001) return;
    const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
    const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
    const wc = 1 - wa - wb;
    if (wa < -0.0001 || wb < -0.0001 || wc < -0.0001) return;
    const elevation = wa * Number(a.elevation || 0)
      + wb * Number(b.elevation || 0)
      + wc * Number(c.elevation || 0);
    const regionMatch = preferredRegion && (
      triangle.region === preferredRegion
      || (preferredRegion === 'shoulder' && ['inner', 'flat-join'].includes(triangle.region))
      || (preferredRegion === 'terrain' && triangle.region === 'transition')
    );
    const score = Number(triangle.priority || 0) + (regionMatch ? 20 : 0);
    if (!best || score > best.score || (score === best.score && elevation > best.elevation)) {
      best = {
        triangleId: triangleIndex,
        elevation,
        normal: triangle.normal,
        region: triangle.region,
        source: triangle.source,
        score
      };
    }
  });
  return best;
}

export function getRaceBakedSurfaceMaximumElevationInBounds(sampler = null, bounds = {}) {
  if (!sampler?.triangleCount) return null;
  const minX = Number(bounds.minX);
  const maxX = Number(bounds.maxX);
  const minZ = Number(bounds.minZ);
  const maxZ = Number(bounds.maxZ);
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return null;
  const bucketSize = Math.max(4, Number(sampler.bucketSizeM) || 20);
  const triangleIndices = new Set();
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
    for (let z = Math.floor(minZ / bucketSize); z <= Math.floor(maxZ / bucketSize); z += 1) {
      for (let x = Math.floor(minX / bucketSize); x <= Math.floor(maxX / bucketSize); x += 1) {
        const bucketIndex = sampler.bucketLookup.get(`${x},${z}`);
        if (!Number.isFinite(bucketIndex)) continue;
        for (let entry = sampler.bucketOffsets[bucketIndex]; entry < sampler.bucketOffsets[bucketIndex + 1]; entry += 1) {
          triangleIndices.add(sampler.bucketTriangles[entry]);
        }
      }
    }
    let maximum = -Infinity;
    triangleIndices.forEach((triangleIndex) => {
      const boundOffset = triangleIndex * 4;
      if (sampler.bounds[boundOffset + 1] < minX || sampler.bounds[boundOffset] > maxX
        || sampler.bounds[boundOffset + 3] < minZ || sampler.bounds[boundOffset + 2] > maxZ) return;
      const positionOffset = triangleIndex * 9;
      maximum = Math.max(
        maximum,
        sampler.positions[positionOffset + 1],
        sampler.positions[positionOffset + 4],
        sampler.positions[positionOffset + 7]
      );
    });
    return Number.isFinite(maximum) ? maximum : null;
  }
  for (let z = Math.floor(minZ / bucketSize); z <= Math.floor(maxZ / bucketSize); z += 1) {
    for (let x = Math.floor(minX / bucketSize); x <= Math.floor(maxX / bucketSize); x += 1) {
      (sampler.buckets.get(`${x},${z}`) || []).forEach((index) => triangleIndices.add(index));
    }
  }
  let maximum = -Infinity;
  triangleIndices.forEach((triangleIndex) => {
    const triangle = sampler.triangles[triangleIndex];
    if (!triangle || triangle.maxX < minX || triangle.minX > maxX
      || triangle.maxZ < minZ || triangle.minZ > maxZ) return;
    (triangle.vertices || []).forEach((point) => {
      maximum = Math.max(maximum, Number(point?.elevation));
    });
  });
  return Number.isFinite(maximum) ? maximum : null;
}

function collectTriangleIndicesInBounds(sampler, { minX, maxX, minZ, maxZ }) {
  const bucketSize = Math.max(4, Number(sampler.bucketSizeM) || 20);
  const indices = new Set();
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
    for (let z = Math.floor(minZ / bucketSize); z <= Math.floor(maxZ / bucketSize); z += 1) {
      for (let x = Math.floor(minX / bucketSize); x <= Math.floor(maxX / bucketSize); x += 1) {
        const bucketIndex = sampler.bucketLookup.get(`${x},${z}`);
        if (!Number.isFinite(bucketIndex)) continue;
        for (let entry = sampler.bucketOffsets[bucketIndex]; entry < sampler.bucketOffsets[bucketIndex + 1]; entry += 1) {
          indices.add(Number(sampler.bucketTriangles[entry]));
        }
      }
    }
  } else {
    for (let z = Math.floor(minZ / bucketSize); z <= Math.floor(maxZ / bucketSize); z += 1) {
      for (let x = Math.floor(minX / bucketSize); x <= Math.floor(maxX / bucketSize); x += 1) {
        (sampler.buckets.get(`${x},${z}`) || []).forEach((index) => indices.add(index));
      }
    }
  }
  return [...indices].sort((left, right) => left - right);
}

// Diagnostic export used by incident fixtures. It deliberately copies the
// prepared sampler's exact vertices and normals instead of rebuilding a local
// approximation from route distance or analytical elevation.
export function getRaceBakedSurfaceTrianglesInBounds(sampler = null, bounds = {}) {
  if (!sampler?.triangleCount) return [];
  const resolved = {
    minX: Number(bounds.minX), maxX: Number(bounds.maxX),
    minZ: Number(bounds.minZ), maxZ: Number(bounds.maxZ)
  };
  if (!Object.values(resolved).every(Number.isFinite)) return [];
  return collectTriangleIndicesInBounds(sampler, resolved).flatMap((triangleIndex) => {
    if (sampler.packed) {
      const boundOffset = triangleIndex * 4;
      if (sampler.bounds[boundOffset + 1] < resolved.minX
        || sampler.bounds[boundOffset] > resolved.maxX
        || sampler.bounds[boundOffset + 3] < resolved.minZ
        || sampler.bounds[boundOffset + 2] > resolved.maxZ) return [];
      const positionOffset = triangleIndex * 9;
      const normalOffset = triangleIndex * 3;
      return [{
        id: triangleIndex,
        vertices: [0, 1, 2].map((vertexIndex) => ({
          x: Number(sampler.positions[positionOffset + vertexIndex * 3]),
          elevation: Number(sampler.positions[positionOffset + vertexIndex * 3 + 1]),
          z: Number(sampler.positions[positionOffset + vertexIndex * 3 + 2])
        })),
        normal: {
          x: Number(sampler.normals[normalOffset]),
          y: Number(sampler.normals[normalOffset + 1]),
          z: Number(sampler.normals[normalOffset + 2])
        },
        region: sampler.regionTable[sampler.regions[triangleIndex]] || 'terrain',
        source: sampler.sourceTable[sampler.sources[triangleIndex]] || 'terrain',
        priority: Number(sampler.priorities[triangleIndex] || 0)
      }];
    }
    const triangle = sampler.triangles[triangleIndex];
    if (!triangle || triangle.maxX < resolved.minX || triangle.minX > resolved.maxX
      || triangle.maxZ < resolved.minZ || triangle.minZ > resolved.maxZ) return [];
    return [{
      id: triangleIndex,
      canonicalTriangleIndex: triangle.canonicalTriangleIndex ?? null,
      vertices: triangle.vertices.map((vertex) => ({
        x: Number(vertex.x || 0),
        elevation: Number(vertex.elevation || 0),
        z: pointZ(vertex)
      })),
      normal: { ...triangle.normal },
      region: triangle.region,
      source: triangle.source,
      priority: Number(triangle.priority || 0)
    }];
  });
}

export default buildRaceBakedSurfaceSampler;
