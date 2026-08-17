import {
  addVector3,
  crossVector3,
  integrateQuaternion,
  inverseInertiaWorldMultiply,
  normalizeQuaternion,
  rotateVectorByQuaternion,
  scaleVector3
} from './RigidBodyMath.js';

const EPSILON = 1e-9;
const DEFAULT_BUCKET_SIZE_M = 16;
const BOX_VERTEX_SIGNS = new Int8Array([
  -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
  -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1
]);
const BOX_FACE_INDICES = new Uint8Array([
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
  0, 7, 3, 0, 4, 7, 1, 2, 6, 1, 6, 5,
  0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2
]);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const dot = (left = {}, right = {}) => finite(left.x) * finite(right.x)
  + finite(left.y) * finite(right.y)
  + finite(left.z) * finite(right.z);
const length = (value = {}) => Math.hypot(finite(value.x), finite(value.y), finite(value.z));
const normalize = (value = {}, fallback = { x: 0, y: 1, z: 0 }) => {
  const magnitude = length(value);
  return magnitude > EPSILON ? scaleVector3(value, 1 / magnitude) : { ...fallback };
};
const subtract = (left = {}, right = {}) => addVector3(left, scaleVector3(right, -1));
const mixVector = (left = {}, right = {}, fraction = 0) => ({
  x: finite(left.x) + (finite(right.x) - finite(left.x)) * fraction,
  y: finite(left.y) + (finite(right.y) - finite(left.y)) * fraction,
  z: finite(left.z) + (finite(right.z) - finite(left.z)) * fraction
});
const mixQuaternion = (left = {}, right = {}, fraction = 0) => {
  const sign = finite(left.x) * finite(right.x)
    + finite(left.y) * finite(right.y)
    + finite(left.z) * finite(right.z)
    + finite(left.w, 1) * finite(right.w, 1) < 0 ? -1 : 1;
  return normalizeQuaternion({
    x: finite(left.x) + (finite(right.x) * sign - finite(left.x)) * fraction,
    y: finite(left.y) + (finite(right.y) * sign - finite(left.y)) * fraction,
    z: finite(left.z) + (finite(right.z) * sign - finite(left.z)) * fraction,
    w: finite(left.w, 1) + (finite(right.w, 1) * sign - finite(left.w, 1)) * fraction
  });
};
const transformPoint = (point = {}, position = {}, orientation = {}) => addVector3(
  position,
  rotateVectorByQuaternion(point, orientation)
);
const copyCollisionStateInto = (source = {}, target) => {
  const sourcePosition = source.position || {};
  target.position.x = finite(sourcePosition.x);
  target.position.y = finite(sourcePosition.y);
  target.position.z = finite(sourcePosition.z);
  const sourceOrientation = source.orientation || {};
  target.orientation.x = finite(sourceOrientation.x);
  target.orientation.y = finite(sourceOrientation.y);
  target.orientation.z = finite(sourceOrientation.z);
  target.orientation.w = finite(sourceOrientation.w, 1);
  const sourceVelocity = source.velocity || {};
  target.velocity.x = finite(sourceVelocity.x);
  target.velocity.y = finite(sourceVelocity.y);
  target.velocity.z = finite(sourceVelocity.z);
  const sourceAngularVelocity = source.angularVelocityWorld || {};
  target.angularVelocityWorld.x = finite(sourceAngularVelocity.x);
  target.angularVelocityWorld.y = finite(sourceAngularVelocity.y);
  target.angularVelocityWorld.z = finite(sourceAngularVelocity.z);
  return target;
};
const boundsOverlap = (left = {}, right = {}) => left.minX <= right.maxX
  && left.maxX >= right.minX
  && left.minY <= right.maxY
  && left.maxY >= right.minY
  && left.minZ <= right.maxZ
  && left.maxZ >= right.minZ;
const emptyBounds = () => ({
  minX: Infinity, minY: Infinity, minZ: Infinity,
  maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity
});
const includePoint = (bounds, point) => {
  bounds.minX = Math.min(bounds.minX, finite(point.x));
  bounds.minY = Math.min(bounds.minY, finite(point.y));
  bounds.minZ = Math.min(bounds.minZ, finite(point.z));
  bounds.maxX = Math.max(bounds.maxX, finite(point.x));
  bounds.maxY = Math.max(bounds.maxY, finite(point.y));
  bounds.maxZ = Math.max(bounds.maxZ, finite(point.z));
  return bounds;
};
const includeTransformedPoint = (bounds, point, position, q) => {
  const x = finite(point.x);
  const y = finite(point.y);
  const z = finite(point.z);
  const crossX = q.y * z - q.z * y;
  const crossY = q.z * x - q.x * z;
  const crossZ = q.x * y - q.y * x;
  const twiceCrossX = crossX * 2;
  const twiceCrossY = crossY * 2;
  const twiceCrossZ = crossZ * 2;
  const worldX = finite(position.x) + x
    + (twiceCrossX * q.w + (q.y * twiceCrossZ - q.z * twiceCrossY));
  const worldY = finite(position.y) + y
    + (twiceCrossY * q.w + (q.z * twiceCrossX - q.x * twiceCrossZ));
  const worldZ = finite(position.z) + z
    + (twiceCrossZ * q.w + (q.x * twiceCrossY - q.y * twiceCrossX));
  bounds.minX = Math.min(bounds.minX, worldX);
  bounds.minY = Math.min(bounds.minY, worldY);
  bounds.minZ = Math.min(bounds.minZ, worldZ);
  bounds.maxX = Math.max(bounds.maxX, worldX);
  bounds.maxY = Math.max(bounds.maxY, worldY);
  bounds.maxZ = Math.max(bounds.maxZ, worldZ);
};
const expandBounds = (bounds, amount = 0) => ({
  minX: bounds.minX - amount,
  minY: bounds.minY - amount,
  minZ: bounds.minZ - amount,
  maxX: bounds.maxX + amount,
  maxY: bounds.maxY + amount,
  maxZ: bounds.maxZ + amount
});

function triangleBounds(a, b, c) {
  const bounds = emptyBounds();
  includePoint(bounds, a);
  includePoint(bounds, b);
  includePoint(bounds, c);
  return bounds;
}

function createTriangle({ a, b, c, colliderIndex, colliderId, featureId, friction,
  restitution, twoSided = false, reuseVertices = false }) {
  const rawNormal = crossVector3(subtract(b, a), subtract(c, a));
  const rawLength = length(rawNormal);
  if (!(rawLength > EPSILON)) return null;
  const normal = scaleVector3(rawNormal, 1 / rawLength);
  return Object.freeze({
    a: reuseVertices ? a : Object.freeze({ ...a }),
    b: reuseVertices ? b : Object.freeze({ ...b }),
    c: reuseVertices ? c : Object.freeze({ ...c }),
    normal: Object.freeze(normal),
    offset: dot(normal, a),
    bounds: Object.freeze(triangleBounds(a, b, c)),
    colliderIndex,
    colliderId,
    featureId,
    friction,
    restitution,
    twoSided: twoSided === true
  });
}

function transformedVertices(vertices = [], position = {}, orientation = {}) {
  return vertices.map((vertex) => transformPoint(vertex, position, orientation));
}

function boxGeometry(definition, colliderIndex, common) {
  const center = definition.center || definition.position || {};
  const size = definition.size || definition.sizeM || {};
  const half = {
    x: Math.max(0.0005, finite(size.x, 1) * 0.5),
    y: Math.max(0.0005, finite(size.y, 1) * 0.5),
    z: Math.max(0.0005, finite(size.z, 1) * 0.5)
  };
  const orientation = normalizeQuaternion(definition.orientation || {});
  const vertices = new Array(8);
  const localPoint = { x: 0, y: 0, z: 0 };
  for (let vertexIndex = 0; vertexIndex < 8; vertexIndex += 1) {
    const signOffset = vertexIndex * 3;
    localPoint.x = half.x * BOX_VERTEX_SIGNS[signOffset];
    localPoint.y = half.y * BOX_VERTEX_SIGNS[signOffset + 1];
    localPoint.z = half.z * BOX_VERTEX_SIGNS[signOffset + 2];
    vertices[vertexIndex] = Object.freeze(transformPoint(localPoint, center, orientation));
  }
  const triangles = new Array(12);
  for (let faceIndex = 0; faceIndex < 12; faceIndex += 1) {
    const indexOffset = faceIndex * 3;
    triangles[faceIndex] = createTriangle({
      a: vertices[BOX_FACE_INDICES[indexOffset]],
      b: vertices[BOX_FACE_INDICES[indexOffset + 1]],
      c: vertices[BOX_FACE_INDICES[indexOffset + 2]],
      colliderIndex,
      colliderId: common.id,
      featureId: `${common.id}:face:${faceIndex >> 1}`,
      friction: common.friction,
      restitution: common.restitution,
      reuseVertices: true
    });
  }
  const planes = [];
  for (let faceIndex = 0; faceIndex < triangles.length; faceIndex += 2) {
    const triangle = triangles[faceIndex];
    planes.push(Object.freeze({
      normal: triangle.normal,
      offset: triangle.offset,
      featureId: triangle.featureId
    }));
  }
  return { vertices, triangles, planes, verticesImmutable: true };
}

function convexGeometry(definition, colliderIndex, common) {
  const sourceVertices = Array.isArray(definition.vertices) ? definition.vertices : [];
  const vertices = transformedVertices(
    sourceVertices.map((vertex) => ({
      x: finite(vertex.x), y: finite(vertex.y), z: finite(vertex.z)
    })),
    definition.position || {},
    normalizeQuaternion(definition.orientation || {})
  );
  if (vertices.length < 4) return { vertices, triangles: [], planes: [] };
  const centroid = scaleVector3(vertices.reduce((sum, vertex) => addVector3(sum, vertex), {
    x: 0, y: 0, z: 0
  }), 1 / vertices.length);
  const planeMap = new Map();
  for (let first = 0; first < vertices.length - 2; first += 1) {
    for (let second = first + 1; second < vertices.length - 1; second += 1) {
      for (let third = second + 1; third < vertices.length; third += 1) {
        const a = vertices[first];
        const raw = crossVector3(subtract(vertices[second], a), subtract(vertices[third], a));
        if (length(raw) <= EPSILON) continue;
        let normal = normalize(raw);
        let offset = dot(normal, a);
        let positive = false;
        let negative = false;
        vertices.forEach((vertex) => {
          const side = dot(normal, vertex) - offset;
          if (side > 1e-6) positive = true;
          if (side < -1e-6) negative = true;
        });
        if (positive && negative) continue;
        if (dot(normal, centroid) - offset > 0) {
          normal = scaleVector3(normal, -1);
          offset *= -1;
        }
        const key = `${Math.round(normal.x * 1e5)}:${Math.round(normal.y * 1e5)}:${Math.round(normal.z * 1e5)}:${Math.round(offset * 1e5)}`;
        if (!planeMap.has(key)) planeMap.set(key, { normal, offset });
      }
    }
  }
  const triangles = [];
  const planes = [];
  [...planeMap.values()].forEach((plane, faceIndex) => {
    const faceVertices = vertices.filter((vertex) => (
      Math.abs(dot(plane.normal, vertex) - plane.offset) <= 1e-5
    ));
    if (faceVertices.length < 3) return;
    const faceCenter = scaleVector3(faceVertices.reduce((sum, vertex) => (
      addVector3(sum, vertex)
    ), { x: 0, y: 0, z: 0 }), 1 / faceVertices.length);
    const reference = Math.abs(plane.normal.y) < 0.9
      ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const tangent = normalize(crossVector3(reference, plane.normal), { x: 1, y: 0, z: 0 });
    const bitangent = crossVector3(plane.normal, tangent);
    faceVertices.sort((left, right) => Math.atan2(
      dot(subtract(left, faceCenter), bitangent), dot(subtract(left, faceCenter), tangent)
    ) - Math.atan2(
      dot(subtract(right, faceCenter), bitangent), dot(subtract(right, faceCenter), tangent)
    ));
    const featureId = `${common.id}:face:${faceIndex}`;
    for (let index = 1; index < faceVertices.length - 1; index += 1) {
      let triangle = createTriangle({
        a: faceVertices[0], b: faceVertices[index], c: faceVertices[index + 1],
        colliderIndex, colliderId: common.id, featureId,
        friction: common.friction, restitution: common.restitution
      });
      if (triangle && dot(triangle.normal, plane.normal) < 0) {
        triangle = createTriangle({
          a: faceVertices[0], b: faceVertices[index + 1], c: faceVertices[index],
          colliderIndex, colliderId: common.id, featureId,
          friction: common.friction, restitution: common.restitution
        });
      }
      if (triangle) triangles.push(triangle);
    }
    planes.push(Object.freeze({
      normal: Object.freeze({ ...plane.normal }),
      offset: plane.offset,
      featureId
    }));
  });
  return { vertices, triangles, planes };
}

function meshGeometry(definition, colliderIndex, common) {
  const position = definition.position || {};
  const orientation = normalizeQuaternion(definition.orientation || {});
  const triangles = [];
  const vertices = [];
  (Array.isArray(definition.triangles) ? definition.triangles : []).forEach((source, index) => {
    const sourceVertices = Array.isArray(source) ? source : source?.vertices;
    if (!Array.isArray(sourceVertices) || sourceVertices.length < 3) return;
    const transformed = transformedVertices(sourceVertices.slice(0, 3), position, orientation);
    let triangle = createTriangle({
      a: transformed[0], b: transformed[1], c: transformed[2],
      colliderIndex,
      colliderId: common.id,
      featureId: String(source?.id ?? source?.triangleId ?? `${common.id}:triangle:${index}`),
      friction: finite(source?.friction, common.friction),
      restitution: finite(source?.restitution, common.restitution),
      twoSided: source?.twoSided ?? definition.twoSided ?? true
    });
    const authoredNormal = source?.normal || source?.normalWorld;
    if (triangle && authoredNormal && dot(triangle.normal, authoredNormal) < 0) {
      triangle = createTriangle({
        a: transformed[0], b: transformed[2], c: transformed[1],
        colliderIndex,
        colliderId: common.id,
        featureId: triangle.featureId,
        friction: triangle.friction,
        restitution: triangle.restitution,
        twoSided: triangle.twoSided
      });
    }
    if (triangle) {
      triangles.push(triangle);
      transformed.forEach((vertex) => vertices.push(vertex));
    }
  });
  return { vertices, triangles, planes: [] };
}

function prepareCollider(definition = {}, colliderIndex = 0) {
  const type = String(definition.type || definition.shape || 'box').toLowerCase();
  const id = String(definition.id || `static-collider-${colliderIndex}`);
  const common = {
    id,
    friction: clamp(finite(definition.friction, 0.62), 0, 1.5),
    restitution: clamp(finite(definition.restitution, 0.08), 0, 0.6)
  };
  if (type === 'plane') {
    const normal = normalize(definition.normal || definition.normalWorld || { x: 0, y: 1, z: 0 });
    const point = definition.point || definition.pointWorld || definition.position || {};
    return Object.freeze({
      index: colliderIndex,
      id,
      type: 'plane',
      normal: Object.freeze(normal),
      offset: dot(normal, point),
      friction: common.friction,
      restitution: common.restitution,
      featureId: `${id}:plane`,
      infinite: true,
      enabled: definition.enabled !== false,
      source: String(definition.source || id),
      triangles: Object.freeze([]),
      planes: Object.freeze([]),
      vertices: Object.freeze([]),
      bounds: null
    });
  }
  const geometry = type === 'convex' || type === 'convex-hull'
    ? convexGeometry(definition, colliderIndex, common)
    : type === 'triangle-mesh' || type === 'prepared-triangle-mesh' || type === 'mesh'
      ? meshGeometry(definition, colliderIndex, common)
      : boxGeometry(definition, colliderIndex, common);
  const bounds = emptyBounds();
  for (let vertexIndex = 0; vertexIndex < geometry.vertices.length; vertexIndex += 1) {
    includePoint(bounds, geometry.vertices[vertexIndex]);
  }
  for (let triangleIndex = 0; triangleIndex < geometry.triangles.length; triangleIndex += 1) {
    const triangle = geometry.triangles[triangleIndex];
    includePoint(bounds, triangle.a);
    includePoint(bounds, triangle.b);
    includePoint(bounds, triangle.c);
  }
  return Object.freeze({
    index: colliderIndex,
    id,
    type: type === 'convex-hull' ? 'convex' : type === 'mesh' ? 'triangle-mesh' : type,
    friction: common.friction,
    restitution: common.restitution,
    enabled: definition.enabled !== false,
    source: String(definition.source || id),
    infinite: false,
    solidBelow: definition.solidBelow === true,
    vertices: Object.freeze(geometry.verticesImmutable
      ? geometry.vertices
      : geometry.vertices.map((vertex) => Object.freeze({ ...vertex }))),
    triangles: Object.freeze(geometry.triangles),
    planes: Object.freeze(geometry.planes),
    bounds: Object.freeze(bounds)
  });
}

export class PreparedStaticRaceColliderWorld {
  constructor(definitions = [], { revision = 0, bucketSizeM = DEFAULT_BUCKET_SIZE_M } = {}) {
    this.revision = String(revision ?? 0);
    this.bucketSizeM = Math.max(1, finite(bucketSizeM, DEFAULT_BUCKET_SIZE_M));
    const sourceDefinitions = Array.isArray(definitions) ? definitions : [];
    const colliders = [];
    for (let definitionIndex = 0; definitionIndex < sourceDefinitions.length;
      definitionIndex += 1) {
      const definition = sourceDefinitions[definitionIndex];
      if (definition?.enabled === false) continue;
      colliders.push(prepareCollider(definition, colliders.length));
    }
    this.colliders = Object.freeze(colliders);
    this.infiniteColliderIndices = [];
    this.buckets = new Map();
    for (let colliderIndex = 0; colliderIndex < this.colliders.length; colliderIndex += 1) {
      const collider = this.colliders[colliderIndex];
      if (collider.infinite || !collider.bounds) {
        this.infiniteColliderIndices.push(collider.index);
        continue;
      }
      const minX = Math.floor(collider.bounds.minX / this.bucketSizeM);
      const maxX = Math.floor(collider.bounds.maxX / this.bucketSizeM);
      const minZ = Math.floor(collider.bounds.minZ / this.bucketSizeM);
      const maxZ = Math.floor(collider.bounds.maxZ / this.bucketSizeM);
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const key = `${x}:${z}`;
          const bucket = this.buckets.get(key) || [];
          bucket.push(collider.index);
          this.buckets.set(key, bucket);
        }
      }
    }
    this.buckets.forEach((indices, key) => {
      this.buckets.set(key, Object.freeze([...new Set(indices)].sort((a, b) => a - b)));
    });
    Object.freeze(this.infiniteColliderIndices);
  }

  querySweptAabb(bounds, physicsCostAccounting = null) {
    physicsCostAccounting?.count('staticColliderBroadphaseQueries');
    const indices = new Set(this.infiniteColliderIndices);
    const minX = Math.floor(bounds.minX / this.bucketSizeM);
    const maxX = Math.floor(bounds.maxX / this.bucketSizeM);
    const minZ = Math.floor(bounds.minZ / this.bucketSizeM);
    const maxZ = Math.floor(bounds.maxZ / this.bucketSizeM);
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        (this.buckets.get(`${x}:${z}`) || []).forEach((index) => indices.add(index));
      }
    }
    const candidates = [...indices].sort((a, b) => a - b)
      .map((index) => this.colliders[index])
      .filter((collider) => collider?.infinite || boundsOverlap(bounds, collider.bounds));
    physicsCostAccounting?.count('staticColliderCandidates', candidates.length);
    return candidates;
  }
}

export function prepareStaticRaceColliders(definitions = [], options = {}) {
  if (definitions instanceof PreparedStaticRaceColliderWorld) return definitions;
  return new PreparedStaticRaceColliderWorld(definitions, options);
}

function segmentTriangle(start, end, triangle) {
  const direction = subtract(end, start);
  const edge1 = subtract(triangle.b, triangle.a);
  const edge2 = subtract(triangle.c, triangle.a);
  const p = crossVector3(direction, edge2);
  const determinant = dot(edge1, p);
  // With this Moller-Trumbore ordering, an outward-facing triangle produces a
  // positive determinant when the segment approaches from the solid's
  // exterior (direction dot normal < 0).
  if (!triangle.twoSided && determinant <= EPSILON) return null;
  if (Math.abs(determinant) <= EPSILON) return null;
  const inverse = 1 / determinant;
  const translated = subtract(start, triangle.a);
  const u = dot(translated, p) * inverse;
  if (u < -1e-8 || u > 1 + 1e-8) return null;
  const q = crossVector3(translated, edge1);
  const v = dot(direction, q) * inverse;
  if (v < -1e-8 || u + v > 1 + 1e-8) return null;
  const fraction = dot(edge2, q) * inverse;
  if (fraction < -1e-8 || fraction > 1 + 1e-8) return null;
  let normal = triangle.normal;
  if (triangle.twoSided && dot(direction, normal) > 0) normal = scaleVector3(normal, -1);
  if (dot(direction, normal) >= -EPSILON) return null;
  return {
    fraction: clamp(fraction, 0, 1),
    point: mixVector(start, end, clamp(fraction, 0, 1)),
    normal
  };
}

function pointInsideConvex(point, collider, toleranceM = 0) {
  if (!collider.planes?.length) return null;
  let closest = null;
  for (const plane of collider.planes) {
    const distance = dot(plane.normal, point) - plane.offset;
    if (distance > toleranceM) return null;
    if (!closest || distance > closest.distance) closest = { ...plane, distance };
  }
  return closest ? {
    normal: closest.normal,
    penetrationM: Math.max(0, -closest.distance),
    featureId: closest.featureId
  } : null;
}

function pointProjectsInsideTriangle(point, triangle, tolerance = 1e-7) {
  const v0 = subtract(triangle.c, triangle.a);
  const v1 = subtract(triangle.b, triangle.a);
  const planeDistance = dot(triangle.normal, point) - triangle.offset;
  const projected = subtract(point, scaleVector3(triangle.normal, planeDistance));
  const v2 = subtract(projected, triangle.a);
  const dot00 = dot(v0, v0);
  const dot01 = dot(v0, v1);
  const dot02 = dot(v0, v2);
  const dot11 = dot(v1, v1);
  const dot12 = dot(v1, v2);
  const denominator = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denominator) <= EPSILON) return false;
  const inverse = 1 / denominator;
  const u = (dot11 * dot02 - dot01 * dot12) * inverse;
  const v = (dot00 * dot12 - dot01 * dot02) * inverse;
  return u >= -tolerance && v >= -tolerance && u + v <= 1 + tolerance;
}

function sampleMeshVerticalSurface(point, collider) {
  let highest = null;
  collider.triangles.forEach((triangle) => {
      const ax = triangle.a.x;
      const az = triangle.a.z;
      const bx = triangle.b.x;
      const bz = triangle.b.z;
      const cx = triangle.c.x;
      const cz = triangle.c.z;
      const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(denominator) > EPSILON) {
        const first = ((bz - cz) * (point.x - cx) + (cx - bx) * (point.z - cz))
          / denominator;
        const second = ((cz - az) * (point.x - cx) + (ax - cx) * (point.z - cz))
          / denominator;
        const third = 1 - first - second;
        if (first >= -1e-7 && second >= -1e-7 && third >= -1e-7) {
          const heightM = first * triangle.a.y + second * triangle.b.y + third * triangle.c.y;
          if (!highest || heightM > highest.heightM) highest = {
            heightM,
            normal: triangle.normal.y >= 0 ? triangle.normal : scaleVector3(triangle.normal, -1),
            featureId: triangle.featureId
          };
        }
      }
  });
  return highest;
}

function pointInsideMeshSurface(point, collider, toleranceM = 0) {
  if (collider.solidBelow === true) {
    const surface = sampleMeshVerticalSurface(point, collider);
    const penetrationM = surface ? surface.heightM - point.y : 0;
    return penetrationM > toleranceM ? {
      normal: surface.normal,
      penetrationM,
      featureId: surface.featureId
    } : null;
  }
  let deepest = null;
  collider.triangles.forEach((triangle) => {
    const signedDistance = dot(triangle.normal, point) - triangle.offset;
    if (!(signedDistance < -toleranceM)
      || !pointProjectsInsideTriangle(point, triangle)) return;
    const overlap = {
      normal: triangle.normal,
      penetrationM: -signedDistance,
      featureId: triangle.featureId
    };
    if (!deepest || overlap.penetrationM > deepest.penetrationM) deepest = overlap;
  });
  return deepest;
}

function bodySweptBounds(candidates, previousState, proposedState, toleranceM, envelope = null) {
  const bounds = emptyBounds();
  let maximumRadiusM = Number(envelope?.maximumRadiusM || 0);
  if (envelope?.corners?.length) {
    const previousOrientation = normalizeQuaternion(previousState.orientation);
    const proposedOrientation = normalizeQuaternion(proposedState.orientation);
    for (let index = 0; index < envelope.corners.length; index += 1) {
      const point = envelope.corners[index];
      includeTransformedPoint(
        bounds, point, previousState.position, previousOrientation
      );
      includeTransformedPoint(
        bounds, point, proposedState.position, proposedOrientation
      );
    }
  } else {
    candidates.forEach((candidate) => {
      maximumRadiusM = Math.max(maximumRadiusM, length(candidate.localPoint));
      includePoint(bounds, transformPoint(
        candidate.localPoint, previousState.position, previousState.orientation
      ));
      includePoint(bounds, transformPoint(
        candidate.localPoint, proposedState.position, proposedState.orientation
      ));
    });
  }
  const angularTravel = length(previousState.angularVelocityWorld || {})
    + length(proposedState.angularVelocityWorld || {});
  return expandBounds(bounds, toleranceM + maximumRadiusM * Math.min(1, angularTravel * 0.002));
}

function inverseMassDenominator(direction, arm, config, orientation) {
  const armCrossDirection = crossVector3(arm, direction);
  const angularVelocityPerImpulse = inverseInertiaWorldMultiply(
    armCrossDirection,
    orientation,
    config.inertiaTensorBodyKgM2
  );
  return 1 / Math.max(1, finite(config.massKg, 1))
    + dot(direction, crossVector3(angularVelocityPerImpulse, arm));
}

function applyImpulse(state, impulse, arm, config) {
  state.velocity = addVector3(
    state.velocity,
    scaleVector3(impulse, 1 / Math.max(1, finite(config.massKg, 1)))
  );
  state.angularVelocityWorld = addVector3(
    state.angularVelocityWorld,
    inverseInertiaWorldMultiply(
      crossVector3(arm, impulse),
      state.orientation,
      config.inertiaTensorBodyKgM2
    )
  );
}

export class StaticColliderCollision {
  constructor({ candidates = [] } = {}) {
    this.candidates = candidates;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    let maximumRadiusM = 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const point = candidates[index].localPoint || {};
      const x = Number(point.x || 0);
      const y = Number(point.y || 0);
      const z = Number(point.z || 0);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
      maximumRadiusM = Math.max(maximumRadiusM, Math.hypot(x, y, z));
    }
    const corners = [];
    if (candidates.length) {
      for (let xIndex = 0; xIndex < 2; xIndex += 1) {
        for (let yIndex = 0; yIndex < 2; yIndex += 1) {
          for (let zIndex = 0; zIndex < 2; zIndex += 1) {
            corners.push({
              x: xIndex ? maxX : minX,
              y: yIndex ? maxY : minY,
              z: zIndex ? maxZ : minZ
            });
          }
        }
      }
    }
    this.bodyEnvelope = { corners, maximumRadiusM };
    const collisionState = () => ({
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocityWorld: { x: 0, y: 0, z: 0 }
    });
    this.proposedStateScratch = collisionState();
    this.previousStateScratch = collisionState();
  }

  poseAt(previousState, proposedState, fraction) {
    return {
      position: mixVector(previousState.position, proposedState.position, fraction),
      orientation: mixQuaternion(previousState.orientation, proposedState.orientation, fraction),
      velocity: proposedState.velocity,
      angularVelocityWorld: proposedState.angularVelocityWorld
    };
  }

  findEarliestImpact({ previousState, proposedState, world, toleranceM, dt,
    physicsCostAccounting }) {
    const bounds = bodySweptBounds(
      this.candidates,
      previousState,
      proposedState,
      toleranceM,
      this.bodyEnvelope
    );
    const broadphaseTimer = physicsCostAccounting?.start('staticColliderBroadphase');
    const colliders = world.querySweptAabb(bounds, physicsCostAccounting);
    physicsCostAccounting?.end(broadphaseTimer);
    if (!colliders.length) return { impact: null, colliders, bounds };
    const narrowphaseTimer = physicsCostAccounting?.start('staticColliderContinuousSweep');
    const angularTravelRad = Math.max(
      length(previousState.angularVelocityWorld || {}),
      length(proposedState.angularVelocityWorld || {})
    ) * dt;
    const slices = clamp(Math.ceil(angularTravelRad / (2 * Math.PI / 180)), 1, 24);
    const events = [];
    let earliest = Infinity;
    this.candidates.forEach((candidate, candidateIndex) => {
      let sliceStartFraction = 0;
      let sliceStartPoint = transformPoint(
        candidate.localPoint, previousState.position, previousState.orientation
      );
      for (let slice = 1; slice <= slices; slice += 1) {
        const sliceEndFraction = slice / slices;
        const sliceEndPose = this.poseAt(previousState, proposedState, sliceEndFraction);
        const sliceEndPoint = transformPoint(
          candidate.localPoint, sliceEndPose.position, sliceEndPose.orientation
        );
        colliders.forEach((collider) => {
          if (collider.type === 'plane') {
            const startDistance = dot(collider.normal, sliceStartPoint) - collider.offset;
            const endDistance = dot(collider.normal, sliceEndPoint) - collider.offset;
            const crossing = startDistance > toleranceM && endDistance <= toleranceM;
            const startingPenetrating = sliceStartFraction === 0
              && startDistance < -toleranceM;
            const startingClosing = sliceStartFraction === 0
              && startDistance <= toleranceM
              && endDistance < startDistance - EPSILON;
            if (!crossing && !startingPenetrating && !startingClosing) return;
            let localFraction = 0;
            if (crossing) {
              let low = 0;
              let high = 1;
              for (let iteration = 0; iteration < 18; iteration += 1) {
                const middle = (low + high) * 0.5;
                const global = sliceStartFraction
                  + (sliceEndFraction - sliceStartFraction) * middle;
                const pose = this.poseAt(previousState, proposedState, global);
                const point = transformPoint(candidate.localPoint, pose.position, pose.orientation);
                if (dot(collider.normal, point) - collider.offset > toleranceM) low = middle;
                else high = middle;
              }
              localFraction = high;
            }
            const fraction = sliceStartFraction
              + (sliceEndFraction - sliceStartFraction) * localFraction;
            if (fraction <= earliest + 1e-7) {
              earliest = Math.min(earliest, fraction);
              events.push({
                fraction,
                candidate,
                candidateIndex,
                collider,
                featureId: collider.featureId,
                normal: collider.normal,
                point: transformPoint(
                  candidate.localPoint,
                  this.poseAt(previousState, proposedState, fraction).position,
                  this.poseAt(previousState, proposedState, fraction).orientation
                )
              });
            }
            return;
          }
          collider.triangles.forEach((triangle) => {
            physicsCostAccounting?.count('staticColliderNarrowphaseTests');
            const hit = segmentTriangle(sliceStartPoint, sliceEndPoint, triangle);
            if (!hit) return;
            const fraction = sliceStartFraction
              + (sliceEndFraction - sliceStartFraction) * hit.fraction;
            if (fraction <= earliest + 1e-7) {
              earliest = Math.min(earliest, fraction);
              events.push({
                fraction,
                candidate,
                candidateIndex,
                collider,
                featureId: triangle.featureId,
                triangle,
                normal: hit.normal,
                point: hit.point
              });
            }
          });
          if (sliceStartFraction !== 0) return;
          const overlap = collider.planes.length
            ? pointInsideConvex(sliceStartPoint, collider, -toleranceM)
            : collider.triangles.length
              ? pointInsideMeshSurface(sliceStartPoint, collider, toleranceM)
              : null;
          if (!overlap) return;
          earliest = 0;
          events.push({
            fraction: 0,
            candidate,
            candidateIndex,
            collider,
            featureId: overlap.featureId,
            normal: overlap.normal,
            point: sliceStartPoint,
            penetrationM: overlap.penetrationM
          });
        });
        sliceStartFraction = sliceEndFraction;
        sliceStartPoint = sliceEndPoint;
      }
    });
    physicsCostAccounting?.end(narrowphaseTimer);
    if (!Number.isFinite(earliest)) return { impact: null, colliders, bounds };
    const manifoldEvents = events.filter((event) => Math.abs(event.fraction - earliest) <= 2e-5)
      .sort((left, right) => left.collider.index - right.collider.index
        || left.candidateIndex - right.candidateIndex
        || String(left.featureId).localeCompare(String(right.featureId)));
    return {
      impact: { fraction: earliest, events: manifoldEvents },
      colliders,
      bounds
    };
  }

  buildManifold(impact, state, config) {
    const contacts = [];
    const keys = new Set();
    const appendEvent = (event) => {
      const key = `${event.collider.index}:${event.candidateIndex}:${Math.round(event.normal.x * 1e5)}:${Math.round(event.normal.y * 1e5)}:${Math.round(event.normal.z * 1e5)}`;
      if (keys.has(key)) return;
      keys.add(key);
      const pointWorld = transformPoint(
        event.candidate.localPoint, state.position, state.orientation
      );
      contacts.push({
        id: `static:${event.collider.id}:${event.featureId}:${event.candidate.id}`,
        colliderId: event.collider.id,
        colliderType: event.collider.type,
        colliderSource: event.collider.source,
        featureId: event.featureId,
        pieceId: event.candidate.pieceId || null,
        localPoint: event.candidate.localPoint,
        pointWorld,
        arm: subtract(pointWorld, state.position),
        normal: { ...event.normal },
        penetrationM: Math.max(0, finite(event.penetrationM)),
        friction: clamp(Math.sqrt(
          Math.max(0, event.collider.friction)
            * Math.max(0, finite(config.bodyCollisionFriction, 0.62))
        ), 0, 1.5),
        restitution: clamp(event.collider.restitution, 0, 0.6),
        normalImpulseNs: 0,
        tangentialImpulseNs: 0,
        restitutionImpulseNs: 0,
        contactType: 'static-body'
      });
    };
    impact.events.forEach(appendEvent);
    const manifoldSlopM = Math.max(0.004, finite(config.staticColliderManifoldSlopM, 0.015));
    const impactedColliders = [...new Map(impact.events.map((event) => [
      event.collider.id,
      event.collider
    ])).values()].sort((left, right) => left.index - right.index);
    this.candidates.forEach((candidate, candidateIndex) => {
      const point = transformPoint(candidate.localPoint, state.position, state.orientation);
      impactedColliders.forEach((collider) => {
        let surface = null;
        if (collider.type === 'plane') {
          const distance = dot(collider.normal, point) - collider.offset;
          if (Math.abs(distance) <= manifoldSlopM) surface = {
            normal: collider.normal,
            featureId: collider.featureId
          };
        } else if (collider.planes.length) {
          const overlap = pointInsideConvex(point, collider, manifoldSlopM);
          if (overlap && Math.abs(overlap.penetrationM) <= manifoldSlopM) surface = overlap;
        } else if (collider.solidBelow === true) {
          const vertical = sampleMeshVerticalSurface(point, collider);
          const separationM = vertical ? point.y - vertical.heightM : Infinity;
          if (Math.abs(separationM) <= manifoldSlopM) surface = vertical;
        }
        if (!surface) return;
        appendEvent({
          fraction: impact.fraction,
          candidate,
          candidateIndex,
          collider,
          featureId: surface.featureId,
          normal: surface.normal,
          point
        });
      });
    });
    return contacts;
  }

  resolveManifold(state, contacts, config) {
    let linearImpulse = { x: 0, y: 0, z: 0 };
    let angularImpulse = { x: 0, y: 0, z: 0 };
    const restitutionThreshold = Math.max(0, finite(
      config.bodyCollisionRestitutionThresholdMps, 2
    ));
    contacts.forEach((contact) => {
      const pointVelocity = addVector3(
        state.velocity,
        crossVector3(state.angularVelocityWorld, contact.arm)
      );
      const closingSpeed = Math.max(0, -dot(pointVelocity, contact.normal));
      contact.restitutionTargetSpeedMps = closingSpeed >= restitutionThreshold
        ? closingSpeed * contact.restitution : 0;
    });
    const iterations = Math.max(4, Math.trunc(finite(config.bodyCollisionSolverIterations, 4)));
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      contacts.forEach((contact) => {
        contact.arm = subtract(contact.pointWorld, state.position);
        const pointVelocity = addVector3(
          state.velocity,
          crossVector3(state.angularVelocityWorld, contact.arm)
        );
        const normalSpeed = dot(pointVelocity, contact.normal);
        const desiredDelta = Math.max(0, -normalSpeed)
          + (iteration === 0 ? contact.restitutionTargetSpeedMps : 0);
        if (!(desiredDelta > EPSILON)) return;
        const denominator = Math.max(EPSILON, inverseMassDenominator(
          contact.normal, contact.arm, config, state.orientation
        ));
        const magnitude = desiredDelta / denominator;
        const impulse = scaleVector3(contact.normal, magnitude);
        applyImpulse(state, impulse, contact.arm, config);
        linearImpulse = addVector3(linearImpulse, impulse);
        angularImpulse = addVector3(angularImpulse, crossVector3(contact.arm, impulse));
        contact.normalImpulseNs += magnitude;
        if (iteration === 0) {
          contact.restitutionImpulseNs += contact.restitutionTargetSpeedMps / denominator;
        }
        const postNormalVelocity = addVector3(
          state.velocity,
          crossVector3(state.angularVelocityWorld, contact.arm)
        );
        const tangentVelocity = subtract(
          postNormalVelocity,
          scaleVector3(contact.normal, dot(postNormalVelocity, contact.normal))
        );
        const tangentSpeed = length(tangentVelocity);
        if (!(tangentSpeed > EPSILON)) return;
        const tangent = scaleVector3(tangentVelocity, 1 / tangentSpeed);
        const tangentDenominator = Math.max(EPSILON, inverseMassDenominator(
          tangent, contact.arm, config, state.orientation
        ));
        const frictionMagnitude = Math.min(
          tangentSpeed / tangentDenominator,
          contact.friction * magnitude
        );
        const frictionImpulse = scaleVector3(tangent, -frictionMagnitude);
        applyImpulse(state, frictionImpulse, contact.arm, config);
        linearImpulse = addVector3(linearImpulse, frictionImpulse);
        angularImpulse = addVector3(
          angularImpulse,
          crossVector3(contact.arm, frictionImpulse)
        );
        contact.tangentialImpulseNs += frictionMagnitude;
      });
    }
    return { linearImpulse, angularImpulse };
  }

  measureAndCorrectPenetration(state, colliders, toleranceM, config) {
    let maximumPenetrationM = 0;
    let correction = { x: 0, y: 0, z: 0 };
    const maximumCorrectionM = Math.max(0.01, finite(
      config.staticColliderMaximumPositionalCorrectionM, 1
    ));
    for (let iteration = 0; iteration < 16; iteration += 1) {
      let deepest = null;
      this.candidates.forEach((candidate) => {
        const point = transformPoint(candidate.localPoint, state.position, state.orientation);
        colliders.forEach((collider) => {
          let overlap = null;
          if (collider.type === 'plane') {
            const penetrationM = collider.offset - dot(collider.normal, point);
            if (penetrationM > toleranceM) overlap = {
              normal: collider.normal,
              penetrationM,
              collider
            };
          } else if (collider.planes.length) {
            const convexOverlap = pointInsideConvex(point, collider, 0);
            if (convexOverlap?.penetrationM > toleranceM) overlap = {
              ...convexOverlap,
              collider
            };
          } else if (collider.triangles.length) {
            const meshOverlap = pointInsideMeshSurface(point, collider, toleranceM);
            if (meshOverlap) overlap = { ...meshOverlap, collider };
          }
          if (overlap && (!deepest || overlap.penetrationM > deepest.penetrationM)) {
            deepest = overlap;
          }
        });
      });
      if (!deepest) break;
      maximumPenetrationM = Math.max(maximumPenetrationM, deepest.penetrationM);
      const remaining = Math.max(0, maximumCorrectionM - length(correction));
      if (!(remaining > EPSILON)) break;
      const magnitude = Math.min(remaining, deepest.penetrationM - toleranceM + 1e-6);
      const applied = scaleVector3(deepest.normal, magnitude);
      state.position = addVector3(state.position, applied);
      correction = addVector3(correction, applied);
    }
    let residualPenetrationM = 0;
    this.candidates.forEach((candidate) => {
      const point = transformPoint(candidate.localPoint, state.position, state.orientation);
      colliders.forEach((collider) => {
        if (collider.type === 'plane') {
          residualPenetrationM = Math.max(
            residualPenetrationM,
            collider.offset - dot(collider.normal, point)
          );
        } else if (collider.planes.length) {
          residualPenetrationM = Math.max(
            residualPenetrationM,
            finite(pointInsideConvex(point, collider, 0)?.penetrationM)
          );
        } else if (collider.triangles.length) {
          residualPenetrationM = Math.max(
            residualPenetrationM,
            finite(pointInsideMeshSurface(point, collider, 0)?.penetrationM)
          );
        }
      });
    });
    return {
      maximumPenetrationM: Math.max(0, maximumPenetrationM),
      residualPenetrationM: Math.max(0, residualPenetrationM),
      correction
    };
  }

  step({ workingState, previousWorkingState, config, environment = {}, dt = 0 }) {
    const world = environment.staticColliderWorld;
    if (!(world instanceof PreparedStaticRaceColliderWorld)
      || !(dt > 0)
      || !this.candidates.length) return null;
    const physicsCostAccounting = environment.physicsCostAccounting;
    const toleranceM = Math.max(0.001, finite(config.staticColliderToleranceM,
      finite(config.bodyCollisionToleranceM, 0.008)));
    const proposedState = copyCollisionStateInto(
      workingState, this.proposedStateScratch
    );
    const previousState = previousWorkingState || copyCollisionStateInto(
      workingState, this.previousStateScratch
    );
    const sweep = this.findEarliestImpact({
      previousState,
      proposedState,
      world,
      toleranceM,
      dt,
      physicsCostAccounting
    });
    if (!sweep.impact) return {
      linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
      angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
      positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
      contacts: [],
      candidates: sweep.colliders.length,
      narrowphaseTests: 0,
      swept: false,
      broadphaseRejected: sweep.colliders.length === 0,
      maximumPenetrationM: 0,
      residualPenetrationM: 0
    };
    physicsCostAccounting?.count('staticColliderCcdActivations');
    const impactPose = this.poseAt(
      previousState, proposedState, sweep.impact.fraction
    );
    workingState.position = { ...impactPose.position };
    workingState.orientation = { ...impactPose.orientation };
    const contacts = this.buildManifold(sweep.impact, workingState, config);
    physicsCostAccounting?.count('staticColliderManifoldContacts', contacts.length);
    const manifoldTimer = physicsCostAccounting?.start('staticColliderManifoldSolve');
    let resolved = this.resolveManifold(workingState, contacts, config);
    let remainingDt = dt * Math.max(0, 1 - sweep.impact.fraction);
    let activeColliders = sweep.colliders;
    const maximumImpactIterations = clamp(Math.trunc(finite(
      config.staticColliderImpactIterations, 16
    )), 1, 24);
    // Integrate the post-impact remainder through the same swept query. A
    // corner impulse can rotate another compound piece into the obstacle even
    // after the first feature has stopped closing; checking the remainder is
    // what makes rotational CCD continuous instead of a TOI followed by a
    // discrete penetration correction.
    for (let impactIteration = 1;
      impactIteration < maximumImpactIterations && remainingDt > EPSILON;
      impactIteration += 1) {
      const remainderStart = {
        position: { ...workingState.position },
        orientation: { ...workingState.orientation },
        velocity: { ...workingState.velocity },
        angularVelocityWorld: { ...workingState.angularVelocityWorld }
      };
      const remainderProposed = {
        ...remainderStart,
        position: addVector3(
          remainderStart.position,
          scaleVector3(remainderStart.velocity, remainingDt)
        ),
        orientation: integrateQuaternion(
          remainderStart.orientation,
          remainderStart.angularVelocityWorld,
          remainingDt
        )
      };
      const remainderSweep = this.findEarliestImpact({
        previousState: remainderStart,
        proposedState: remainderProposed,
        world,
        toleranceM,
        dt: remainingDt,
        physicsCostAccounting
      });
      activeColliders = [...new Map(
        [...activeColliders, ...remainderSweep.colliders].map((collider) => [collider.id, collider])
      ).values()].sort((left, right) => left.index - right.index);
      if (!remainderSweep.impact) {
        workingState.position = remainderProposed.position;
        workingState.orientation = remainderProposed.orientation;
        remainingDt = 0;
        break;
      }
      const nextImpactPose = this.poseAt(
        remainderStart, remainderProposed, remainderSweep.impact.fraction
      );
      workingState.position = { ...nextImpactPose.position };
      workingState.orientation = { ...nextImpactPose.orientation };
      const nextContacts = this.buildManifold(remainderSweep.impact, workingState, config);
      physicsCostAccounting?.count('staticColliderManifoldContacts', nextContacts.length);
      const nextResolved = this.resolveManifold(workingState, nextContacts, config);
      resolved = {
        linearImpulse: addVector3(resolved.linearImpulse, nextResolved.linearImpulse),
        angularImpulse: addVector3(resolved.angularImpulse, nextResolved.angularImpulse)
      };
      contacts.push(...nextContacts);
      const consumedFraction = clamp(remainderSweep.impact.fraction, 0, 1);
      remainingDt *= Math.max(0, 1 - consumedFraction);
      if (consumedFraction <= 1e-8 && nextContacts.every((contact) => (
        contact.normalImpulseNs <= EPSILON
      ))) break;
    }
    if (remainingDt > EPSILON) {
      workingState.position = addVector3(
        workingState.position,
        scaleVector3(workingState.velocity, remainingDt)
      );
      workingState.orientation = integrateQuaternion(
        workingState.orientation,
        workingState.angularVelocityWorld,
        remainingDt
      );
    }
    physicsCostAccounting?.end(manifoldTimer);
    const penetration = this.measureAndCorrectPenetration(
      workingState, activeColliders, toleranceM, config
    );
    return {
      linearImpulseWorldNs: resolved.linearImpulse,
      angularImpulseWorldNms: resolved.angularImpulse,
      positionalCorrectionWorldM: penetration.correction,
      contacts,
      candidates: activeColliders.length,
      swept: true,
      sweepSource: 'static-collider',
      timeOfImpactFraction: sweep.impact.fraction,
      maximumPenetrationM: penetration.residualPenetrationM,
      peakPredictedPenetrationM: penetration.maximumPenetrationM,
      residualPenetrationM: penetration.residualPenetrationM,
      bodyNormalImpulseNs: contacts.reduce((sum, contact) => (
        sum + contact.normalImpulseNs
      ), 0),
      bodyFrictionImpulseNs: contacts.reduce((sum, contact) => (
        sum + contact.tangentialImpulseNs
      ), 0),
      restitutionContributionNs: contacts.reduce((sum, contact) => (
        sum + contact.restitutionImpulseNs
      ), 0),
      penetrationBiasContributionNs: 0,
      colliderIds: [...new Set(contacts.map((contact) => contact.colliderId))]
    };
  }
}

export default PreparedStaticRaceColliderWorld;
