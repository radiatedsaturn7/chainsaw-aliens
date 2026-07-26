const pointZ = (point = {}) => Number(point.z ?? point.y ?? 0);

const normalize3 = (vector = {}) => {
  const length = Math.hypot(
    Number(vector.x || 0),
    Number(vector.y || 0),
    Number(vector.z || 0)
  );
  if (length <= 0.000000001) return { x: 0, y: 1, z: 0 };
  return {
    x: Number(vector.x || 0) / length,
    y: Number(vector.y || 0) / length,
    z: Number(vector.z || 0) / length
  };
};

const triangleCross = (a = {}, b = {}, c = {}, elevationScaleM = 12) => {
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
  return {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x
  };
};

const horizontalArea2 = (a = {}, b = {}, c = {}) => (
  (Number(b.x || 0) - Number(a.x || 0)) * (pointZ(c) - pointZ(a))
  - (Number(c.x || 0) - Number(a.x || 0)) * (pointZ(b) - pointZ(a))
);

const finitePoint = (point = {}) => Number.isFinite(Number(point.x))
  && Number.isFinite(pointZ(point))
  && Number.isFinite(Number(point.elevation));

function terrainRegion(cell = {}) {
  if (cell.terrainRegion) return String(cell.terrainRegion);
  const regions = new Set((cell.points || []).map((point) => String(
    point?.terrainRegion || point?.region || 'terrain'
  )));
  if (regions.has('transition')) return 'transition';
  if (regions.has('flat-join')) return 'transition';
  if (regions.has('shoulder')) return 'shoulder';
  return 'terrain';
}

function pushQuad(pushTriangle, points = [], metadata = {}) {
  if (!Array.isArray(points) || points.length !== 4 || points.some((point) => !finitePoint(point))) return;
  const [a, b, c, d] = points;
  const diagonalAC = Math.hypot(
    Number(c.x || 0) - Number(a.x || 0),
    pointZ(c) - pointZ(a)
  );
  const diagonalBD = Math.hypot(
    Number(d.x || 0) - Number(b.x || 0),
    pointZ(d) - pointZ(b)
  );
  if (diagonalAC <= diagonalBD) {
    pushTriangle(a, b, c, metadata);
    pushTriangle(a, c, d, metadata);
  } else {
    pushTriangle(a, b, d, metadata);
    pushTriangle(b, c, d, metadata);
  }
}

export function buildRaceCanonicalSurfaceMesh({
  surfaceBake = null,
  terrainCells = [],
  runtimeType = 'destination',
  elevationScaleM = 12,
  areaEpsilonM2 = 0.000001
} = {}) {
  const vertices = [];
  const triangles = [];
  const groups = {
    road: [],
    margin: [],
    shoulder: [],
    transition: [],
    terrain: []
  };
  const objectIndices = new WeakMap();
  const coordinateIndices = new Map();
  const normalSums = [];
  let rejectedDegenerateTriangles = 0;
  let correctedWindingTriangles = 0;

  const coordinateKey = (point = {}) => [
    Math.round(Number(point.x || 0) * 100000),
    Math.round(Number(point.elevation || 0) * elevationScaleM * 100000),
    Math.round(pointZ(point) * 100000)
  ].join(',');

  const addVertex = (point = {}) => {
    if (!finitePoint(point)) return -1;
    const byObject = objectIndices.get(point);
    if (Number.isInteger(byObject)) return byObject;
    const key = coordinateKey(point);
    const byCoordinate = coordinateIndices.get(key);
    if (Number.isInteger(byCoordinate)) {
      objectIndices.set(point, byCoordinate);
      return byCoordinate;
    }
    const index = vertices.length;
    vertices.push(point);
    objectIndices.set(point, index);
    coordinateIndices.set(key, index);
    normalSums.push({ x: 0, y: 0, z: 0 });
    return index;
  };

  const pushTriangle = (pointA, pointB, pointC, metadata = {}) => {
    if (![pointA, pointB, pointC].every(finitePoint)) {
      rejectedDegenerateTriangles += 1;
      return false;
    }
    let points = [pointA, pointB, pointC];
    let cross = triangleCross(...points, elevationScaleM);
    const crossLength = Math.hypot(cross.x, cross.y, cross.z);
    const areaM2 = Math.abs(horizontalArea2(...points)) * 0.5;
    if (crossLength <= areaEpsilonM2 * 2 || areaM2 <= areaEpsilonM2) {
      rejectedDegenerateTriangles += 1;
      return false;
    }
    if (cross.y < 0) {
      points = [pointA, pointC, pointB];
      cross = triangleCross(...points, elevationScaleM);
      correctedWindingTriangles += 1;
    }
    if (cross.y <= 0.000000001) {
      rejectedDegenerateTriangles += 1;
      return false;
    }
    const indices = points.map(addVertex);
    if (indices.some((index) => index < 0) || new Set(indices).size !== 3) {
      rejectedDegenerateTriangles += 1;
      return false;
    }
    const region = Object.hasOwn(groups, metadata.region) ? metadata.region : 'terrain';
    const faceNormal = normalize3(cross);
    const triangleIndex = triangles.length;
    const triangle = {
      indices,
      vertices: indices.map((index) => vertices[index]),
      region,
      source: metadata.source || region,
      segment: metadata.segment || null,
      tileCell: metadata.tileCell || null,
      materialId: metadata.materialId || '',
      terrainCell: metadata.terrainCell || null,
      faceNormal
    };
    triangles.push(triangle);
    groups[region].push(triangleIndex);
    indices.forEach((index) => {
      normalSums[index].x += cross.x;
      normalSums[index].y += cross.y;
      normalSums[index].z += cross.z;
    });
    return true;
  };

  const sections = Array.isArray(surfaceBake?.sections) ? surfaceBake.sections : [];
  const pairCount = runtimeType === 'circuit' ? sections.length : Math.max(0, sections.length - 1);
  for (let index = 0; index < pairCount; index += 1) {
    const near = sections[index];
    const far = sections[(index + 1) % sections.length];
    const segment = near?.center?.segment || far?.center?.segment || null;
    pushQuad(pushTriangle, [near?.left, far?.left, far?.right, near?.right], {
      region: 'road',
      source: 'road',
      segment,
      materialId: segment?.surface || 'asphalt'
    });
    const nearMarginLeft = near?.marginLeft || near?.left;
    const farMarginLeft = far?.marginLeft || far?.left;
    const nearMarginRight = near?.marginRight || near?.right;
    const farMarginRight = far?.marginRight || far?.right;
    if (nearMarginLeft !== near?.left || farMarginLeft !== far?.left) {
      pushQuad(pushTriangle, [nearMarginLeft, farMarginLeft, far?.left, near?.left], {
        region: 'margin',
        source: 'margin-left',
        segment,
        materialId: segment?.surface || 'asphalt'
      });
    }
    if (nearMarginRight !== near?.right || farMarginRight !== far?.right) {
      pushQuad(pushTriangle, [near?.right, far?.right, farMarginRight, nearMarginRight], {
        region: 'margin',
        source: 'margin-right',
        segment,
        materialId: segment?.surface || 'asphalt'
      });
    }
    const nearShoulderLeft = near?.shoulderLeft || nearMarginLeft;
    const farShoulderLeft = far?.shoulderLeft || farMarginLeft;
    const nearShoulderRight = near?.shoulderRight || nearMarginRight;
    const farShoulderRight = far?.shoulderRight || farMarginRight;
    if (nearShoulderLeft !== nearMarginLeft || farShoulderLeft !== farMarginLeft) {
      pushQuad(pushTriangle, [nearShoulderLeft, farShoulderLeft, farMarginLeft, nearMarginLeft], {
        region: 'shoulder',
        source: 'shoulder-left',
        segment
      });
    }
    if (nearShoulderRight !== nearMarginRight || farShoulderRight !== farMarginRight) {
      pushQuad(pushTriangle, [nearMarginRight, farMarginRight, farShoulderRight, nearShoulderRight], {
        region: 'shoulder',
        source: 'shoulder-right',
        segment
      });
    }
  }

  (terrainCells || []).forEach((cell) => {
    const points = Array.isArray(cell?.points) ? cell.points : [];
    if (points.length < 3) return;
    const region = terrainRegion(cell);
    const canonicalRegion = region === 'shoulder'
      ? 'shoulder'
      : region === 'transition' || region === 'flat-join' || region === 'inner'
        ? 'transition'
        : 'terrain';
    for (let index = 1; index < points.length - 1; index += 1) {
      pushTriangle(points[0], points[index], points[index + 1], {
        region: canonicalRegion,
        source: cell.key || canonicalRegion,
        segment: points[0]?.segment || null,
        tileCell: cell.tileCell || null,
        materialId: cell.tileCell?.tileId || points[0]?.materialId || '',
        terrainCell: cell
      });
    }
  });

  const normals = normalSums.map((normal, index) => {
    const resolved = normalize3(normal);
    const upward = resolved.y > 0 ? resolved : { x: -resolved.x, y: -resolved.y, z: -resolved.z };
    vertices[index].normal = upward;
    return upward;
  });
  const edgeCounts = new Map();
  triangles.forEach((triangle) => {
    triangle.indices.forEach((a, index) => {
      const b = triangle.indices[(index + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    });
  });
  let openEdges = 0;
  let nonManifoldEdges = 0;
  edgeCounts.forEach((count) => {
    if (count === 1) openEdges += 1;
    else if (count > 2) nonManifoldEdges += 1;
  });

  return {
    topology: 'road-origin-indexed',
    vertices,
    normals,
    triangles,
    groups,
    sections,
    edgeCounts,
    stats: {
      vertices: vertices.length,
      triangles: triangles.length,
      rejectedDegenerateTriangles,
      correctedWindingTriangles,
      openEdges,
      nonManifoldEdges
    }
  };
}

export default buildRaceCanonicalSurfaceMesh;
