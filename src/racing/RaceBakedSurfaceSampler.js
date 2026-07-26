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
  const buckets = new Map();
  triangles.forEach((triangle, triangleIndex) => {
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
  });
  return {
    triangles,
    buckets,
    bucketSizeM: bucketSize,
    elevationScaleM,
    triangleCount: triangles.length
  };
}

export function sampleRaceBakedSurface(sampler = null, worldPoint = null, {
  preferredRegion = null
} = {}) {
  if (!sampler?.triangles?.length || !worldPoint) return null;
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

export default buildRaceBakedSurfaceSampler;
