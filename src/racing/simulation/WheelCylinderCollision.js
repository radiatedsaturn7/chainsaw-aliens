import { createSurfaceSample } from './SurfaceSample.js';
import { addVector3, scaleVector3 } from './RigidBodyMath.js';

const EPSILON = 1e-9;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dot = (a = {}, b = {}) => Number(a.x || 0) * Number(b.x || 0)
  + Number(a.y || 0) * Number(b.y || 0)
  + Number(a.z || 0) * Number(b.z || 0);
const length = (value = {}) => Math.hypot(
  Number(value.x || 0), Number(value.y || 0), Number(value.z || 0)
);
const normalize = (value = {}, fallback = { x: 0, y: 1, z: 0 }) => {
  const magnitude = length(value);
  return magnitude > EPSILON ? scaleVector3(value, 1 / magnitude) : { ...fallback };
};
const subtract = (a = {}, b = {}) => addVector3(a, scaleVector3(b, -1));
const mixVector = (a = {}, b = {}, t = 0) => ({
  x: Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t,
  y: Number(a.y || 0) + (Number(b.y || 0) - Number(a.y || 0)) * t,
  z: Number(a.z || 0) + (Number(b.z || 0) - Number(a.z || 0)) * t
});

function interpolateAxis(previous, proposed, fraction, fallback) {
  return normalize(mixVector(previous || fallback, proposed || previous || fallback, fraction), fallback);
}

function cylinderPoseAt(cylinder, fraction) {
  return {
    hub: mixVector(cylinder.previousHubPositionWorld, cylinder.hubPositionWorld, fraction),
    forward: interpolateAxis(
      cylinder.previousWheelForwardWorld, cylinder.wheelForwardWorld, fraction,
      { x: 0, y: 0, z: 1 }
    ),
    lateral: interpolateAxis(
      cylinder.previousWheelLateralWorld, cylinder.wheelLateralWorld, fraction,
      { x: 1, y: 0, z: 0 }
    ),
    suspension: interpolateAxis(
      cylinder.previousSuspensionAxisWorld, cylinder.suspensionAxisWorld, fraction,
      { x: 0, y: -1, z: 0 }
    )
  };
}

function pointForFeature(cylinder, feature, fraction) {
  const pose = cylinderPoseAt(cylinder, fraction);
  const radial = addVector3(
    scaleVector3(pose.forward, Math.cos(feature.angleRad) * cylinder.radiusM),
    scaleVector3(pose.suspension, Math.sin(feature.angleRad) * cylinder.radiusM)
  );
  return {
    pose,
    point: addVector3(
      addVector3(pose.hub, radial),
      scaleVector3(pose.lateral, feature.widthOffsetM)
    ),
    radial
  };
}

function createLeadingFeatures(cylinder, radialSamples) {
  const movement = subtract(cylinder.hubPositionWorld, cylinder.previousHubPositionWorld);
  const horizontalMovement = { x: movement.x, y: 0, z: movement.z };
  const movementDirection = normalize(horizontalMovement, cylinder.wheelForwardWorld);
  const pose = cylinderPoseAt(cylinder, 0);
  const halfWidthM = cylinder.widthM * 0.5;
  const features = [];
  for (let radialIndex = 0; radialIndex < radialSamples; radialIndex += 1) {
    const angleRad = radialIndex * Math.PI * 2 / radialSamples;
    const radialDirection = normalize(addVector3(
      scaleVector3(pose.forward, Math.cos(angleRad)),
      scaleVector3(pose.suspension, Math.sin(angleRad))
    ));
    const leadingAlignment = dot(radialDirection, movementDirection);
    const bottomAlignment = dot(radialDirection, pose.suspension);
    // Ordinary lower-tread support remains owned by ContactPatchTireModel.
    // Cylinder collision covers the leading half and axial faces, excluding
    // only the exact bottom probe that would duplicate that constraint.
    if (length(horizontalMovement) > 1e-5 && leadingAlignment < -0.02) continue;
    if (cylinder.validTreadContact && bottomAlignment > 0.995) continue;
    [-halfWidthM, 0, halfWidthM].forEach((widthOffsetM) => features.push({
      id: `${cylinder.wheelId}-cylinder-${radialIndex}-${widthOffsetM < 0 ? 'inner' : widthOffsetM > 0 ? 'outer' : 'center'}`,
      angleRad,
      radialIndex,
      widthOffsetM,
      axialFace: Math.abs(widthOffsetM) > halfWidthM * 0.99,
      leadingAlignment
    }));
  }
  return features;
}

function terrainAt(environment, point, cylinder, fraction) {
  const raw = typeof environment.sampleTerrainAtWorldPoint === 'function'
    ? environment.sampleTerrainAtWorldPoint(point, {
      query: 'wheel-cylinder-sweep', wheelId: cylinder.wheelId, sweepFraction: fraction
    }) : null;
  const sample = createSurfaceSample(raw, {
    queryPosition: point,
    source: 'wheel-cylinder-sweep'
  });
  return sample.valid ? {
    ...sample,
    friction: Number.isFinite(Number(raw?.friction)) ? Number(raw.friction) : null
  } : sample;
}

function penetrationAt(environment, cylinder, feature, fraction) {
  const geometry = pointForFeature(cylinder, feature, fraction);
  const terrain = terrainAt(environment, geometry.point, cylinder, fraction);
  if (!terrain.valid) return { ...geometry, terrain, penetrationM: null };
  const surfacePoint = {
    x: geometry.point.x,
    y: terrain.heightM,
    z: geometry.point.z
  };
  return {
    ...geometry,
    terrain,
    penetrationM: -dot(subtract(geometry.point, surfacePoint), terrain.normal)
  };
}

function segmentTriangleIntersection(start, end, triangle) {
  const [a, b, c] = triangle.vertices || [];
  if (!a || !b || !c) return null;
  const direction = subtract(end, start);
  const edge1 = subtract(b, a);
  const edge2 = subtract(c, a);
  const p = {
    x: direction.y * edge2.z - direction.z * edge2.y,
    y: direction.z * edge2.x - direction.x * edge2.z,
    z: direction.x * edge2.y - direction.y * edge2.x
  };
  const determinant = dot(edge1, p);
  if (Math.abs(determinant) <= 1e-10) return null;
  const inverse = 1 / determinant;
  const tVector = subtract(start, a);
  const u = dot(tVector, p) * inverse;
  if (u < -1e-8 || u > 1 + 1e-8) return null;
  const q = {
    x: tVector.y * edge1.z - tVector.z * edge1.y,
    y: tVector.z * edge1.x - tVector.x * edge1.z,
    z: tVector.x * edge1.y - tVector.y * edge1.x
  };
  const v = dot(direction, q) * inverse;
  if (v < -1e-8 || u + v > 1 + 1e-8) return null;
  const fraction = dot(edge2, q) * inverse;
  if (fraction < -1e-8 || fraction > 1 + 1e-8) return null;
  return {
    fraction: clamp(fraction, 0, 1),
    point: mixVector(start, end, clamp(fraction, 0, 1))
  };
}

function normalizeTriangle(raw = {}) {
  const vertices = (raw.vertices || []).map((vertex) => ({
    x: Number(vertex.x || 0),
    y: Number((vertex.y ?? vertex.heightM ?? vertex.elevation) || 0),
    z: Number(vertex.z || 0)
  }));
  if (vertices.length !== 3) return null;
  const edge1 = subtract(vertices[1], vertices[0]);
  const edge2 = subtract(vertices[2], vertices[0]);
  let normal = raw.normal ? normalize(raw.normal) : normalize({
    x: edge1.y * edge2.z - edge1.z * edge2.y,
    y: edge1.z * edge2.x - edge1.x * edge2.z,
    z: edge1.x * edge2.y - edge1.y * edge2.x
  });
  if (normal.y < 0) normal = scaleVector3(normal, -1);
  return {
    ...raw,
    vertices,
    normal,
    id: raw.id ?? raw.triangleId ?? null
  };
}

function collisionType(cylinder, feature, normal, movement) {
  const pose = cylinderPoseAt(cylinder, 0.5);
  const lateralNormalAlignment = Math.abs(dot(normal, pose.lateral));
  const movementDirection = normalize(movement, pose.forward);
  const lateralTravelAlignment = Math.abs(dot(movementDirection, pose.lateral));
  return feature.axialFace && (lateralNormalAlignment > 0.42 || lateralTravelAlignment > 0.42)
    ? 'wheel-sidewall'
    : 'wheel-leading-tread';
}

function makeContact({ cylinder, feature, fraction, point, terrain, normal, penetrationM,
  mechanism, examinedTriangleIds }) {
  const movement = subtract(cylinder.hubPositionWorld, cylinder.previousHubPositionWorld);
  const contactType = collisionType(cylinder, feature, normal, movement);
  const halfWidthM = Math.max(EPSILON, cylinder.widthM * 0.5);
  return {
    id: `wheel-${cylinder.wheelId}-${contactType}-${feature.radialIndex}-${feature.widthOffsetM < 0 ? 'inner' : feature.widthOffsetM > 0 ? 'outer' : 'center'}`,
    wheelId: cylinder.wheelId,
    contactType,
    poweredTreadContact: false,
    worldPoint: { ...point },
    collisionNormal: normalize(normal),
    penetrationM: Math.max(0, Number(penetrationM || 0)),
    surfaceSample: terrain,
    triangleId: terrain?.triangleId ?? null,
    terrainSource: terrain?.source ?? null,
    terrainRegion: terrain?.region ?? null,
    friction: Number.isFinite(Number(terrain?.friction))
      ? Number(terrain.friction) : cylinder.collisionFriction,
    widthFraction: clamp((feature.widthOffsetM / halfWidthM + 1) * 0.5, 0, 1),
    partialWidth: Math.abs(feature.widthOffsetM) > EPSILON,
    sweepFraction: fraction,
    mechanism,
    examinedTriangleIds
  };
}

function findTriangleContacts(cylinders, featuresByWheel, triangles, toleranceM) {
  const contacts = [];
  cylinders.forEach((cylinder) => {
    (featuresByWheel.get(cylinder.wheelId) || []).forEach((feature) => {
      const start = pointForFeature(cylinder, feature, 0).point;
      const end = pointForFeature(cylinder, feature, 1).point;
      triangles.forEach((triangle) => {
        const hit = segmentTriangleIntersection(start, end, triangle);
        if (!hit || hit.fraction <= 1e-6) return;
        const sample = {
          ...createSurfaceSample({
            valid: true,
            heightM: hit.point.y,
            normal: triangle.normal,
            triangleId: triangle.id,
            source: triangle.source,
            region: triangle.region
          }, { queryPosition: hit.point, source: 'wheel-cylinder-triangle' }),
          friction: Number.isFinite(Number(triangle.friction))
            ? Number(triangle.friction) : null
        };
        contacts.push(makeContact({
          cylinder, feature, fraction: hit.fraction, point: hit.point,
          terrain: sample, normal: triangle.normal,
          penetrationM: toleranceM + 1e-4,
          mechanism: 'prepared-triangle',
          examinedTriangleIds: [triangle.id].filter((id) => id !== null)
        }));
      });
    });
  });
  return contacts;
}

function findHeightSweepContacts(cylinders, featuresByWheel, environment, toleranceM, spacingM) {
  const contacts = [];
  cylinders.forEach((cylinder) => {
    const hubTravelM = length(subtract(
      cylinder.hubPositionWorld, cylinder.previousHubPositionWorld
    ));
    const slices = clamp(Math.ceil(hubTravelM / spacingM), 1, 96);
    (featuresByWheel.get(cylinder.wheelId) || []).forEach((feature) => {
      let previousFraction = 0;
      let previous = penetrationAt(environment, cylinder, feature, 0);
      for (let slice = 1; slice <= slices; slice += 1) {
        const fraction = slice / slices;
        const current = penetrationAt(environment, cylinder, feature, fraction);
        const crossed = current.penetrationM !== null
          && current.penetrationM > toleranceM
          && (previous.penetrationM === null || previous.penetrationM <= toleranceM);
        if (!crossed) {
          previous = current;
          previousFraction = fraction;
          continue;
        }
        let low = previousFraction;
        let high = fraction;
        let lowSample = previous;
        let highSample = current;
        for (let iteration = 0; iteration < 11; iteration += 1) {
          const middle = (low + high) * 0.5;
          const middleSample = penetrationAt(environment, cylinder, feature, middle);
          if (middleSample.penetrationM !== null && middleSample.penetrationM > toleranceM) {
            high = middle;
            highSample = middleSample;
          } else {
            low = middle;
            lowSample = middleSample;
          }
        }
        const heightRiseM = highSample.terrain.valid && lowSample.terrain.valid
          ? highSample.terrain.heightM - lowSample.terrain.heightM : 0;
        const horizontalStepM = Math.hypot(
          highSample.point.x - lowSample.point.x,
          highSample.point.z - lowSample.point.z
        );
        const abrupt = heightRiseM > 0.004
          && heightRiseM / Math.max(1e-5, horizontalStepM) > 0.7;
        let normal = highSample.terrain.normal;
        if (abrupt) {
          const edgePoint = {
            x: (lowSample.point.x + highSample.point.x) * 0.5,
            y: highSample.terrain.heightM,
            z: (lowSample.point.z + highSample.point.z) * 0.5
          };
          normal = normalize(subtract(highSample.pose.hub, edgePoint), normal);
          const hubMovement = subtract(
            cylinder.hubPositionWorld, cylinder.previousHubPositionWorld
          );
          if (dot(normal, hubMovement) > 0) normal = scaleVector3(normal, -1);
        }
        contacts.push(makeContact({
          cylinder, feature, fraction: high, point: highSample.point,
          terrain: highSample.terrain, normal,
          penetrationM: highSample.penetrationM,
          mechanism: abrupt ? 'authoritative-height-edge' : 'authoritative-height-sweep',
          examinedTriangleIds: [highSample.terrain.triangleId]
            .filter((id) => id !== null && id !== undefined)
        }));
        break;
      }
    });
  });
  return contacts;
}

function findActiveCylinders(cylinders, environment, spacingM) {
  if (typeof environment.sampleTerrainAtWorldPoint !== 'function'
    && typeof environment.sampleTerrainAtWorldPoints !== 'function') return [];
  const records = [];
  const directlyActiveWheelIds = new Set();
  const unresolvedCylinders = cylinders.filter((cylinder) => {
    const baseHeightM = Number(
      environment.surfaceHeightByWheel?.[cylinder.wheelId]
        ?? environment.groundHeightM
    );
    if (!Number.isFinite(baseHeightM)
      || typeof environment.sampleTerrainMaximumHeightInBounds !== 'function') return true;
    const maximumHeightM = Number(environment.sampleTerrainMaximumHeightInBounds({
      minX: Math.min(cylinder.previousHubPositionWorld.x, cylinder.hubPositionWorld.x)
        - cylinder.radiusM,
      maxX: Math.max(cylinder.previousHubPositionWorld.x, cylinder.hubPositionWorld.x)
        + cylinder.radiusM,
      minZ: Math.min(cylinder.previousHubPositionWorld.z, cylinder.hubPositionWorld.z)
        - cylinder.radiusM - cylinder.widthM * 0.5,
      maxZ: Math.max(cylinder.previousHubPositionWorld.z, cylinder.hubPositionWorld.z)
        + cylinder.radiusM + cylinder.widthM * 0.5
    }));
    if (!Number.isFinite(maximumHeightM)) return true;
    if (maximumHeightM - baseHeightM > 0.004) directlyActiveWheelIds.add(cylinder.wheelId);
    return false;
  });
  unresolvedCylinders.forEach((cylinder) => {
    const movement = subtract(cylinder.hubPositionWorld, cylinder.previousHubPositionWorld);
    const travelM = length(movement);
    if (travelM <= 1e-7) return;
    const slices = clamp(Math.ceil(travelM / spacingM), 1, 64);
    const horizontalDirection = normalize({ x: movement.x, y: 0, z: movement.z }, {
      x: cylinder.wheelForwardWorld.x, y: 0, z: cylinder.wheelForwardWorld.z
    });
    for (let slice = 0; slice <= slices; slice += 1) {
      const fraction = slice / slices;
      const pose = cylinderPoseAt(cylinder, fraction);
      const leadingCenter = addVector3(
        pose.hub, scaleVector3(horizontalDirection, cylinder.radiusM)
      );
      records.push({ cylinder, fraction, point: pose.hub });
      [0, 15, 30, 45, 60, 75, 90].forEach((angleDegrees) => {
        const angleRad = angleDegrees * Math.PI / 180;
        records.push({
          cylinder,
          fraction,
          point: addVector3(
            addVector3(
              pose.hub,
              scaleVector3(horizontalDirection, Math.cos(angleRad) * cylinder.radiusM)
            ),
            scaleVector3(pose.suspension, Math.sin(angleRad) * cylinder.radiusM)
          )
        });
      });
      [-0.5, 0, 0.5].forEach((widthFraction) => records.push({
        cylinder,
        fraction,
        point: addVector3(
          leadingCenter,
          scaleVector3(pose.lateral, cylinder.widthM * widthFraction)
        )
      }));
    }
  });
  const rawBatch = typeof environment.sampleTerrainAtWorldPoints === 'function'
    ? environment.sampleTerrainAtWorldPoints(records.map(({ point }) => point)) : null;
  const stats = new Map();
  records.forEach((record, index) => {
    const raw = rawBatch?.[index]
      || (typeof environment.sampleTerrainAtWorldPoint === 'function'
        ? environment.sampleTerrainAtWorldPoint(record.point, {
          query: 'wheel-cylinder-activation',
          wheelId: record.cylinder.wheelId,
          sweepFraction: record.fraction
        }) : null);
    const sample = createSurfaceSample(raw, {
      queryPosition: record.point,
      source: 'wheel-cylinder-activation'
    });
    if (!sample.valid) return;
    if (!stats.has(record.cylinder.wheelId)) stats.set(record.cylinder.wheelId, {
      minimumHeightM: Infinity,
      maximumHeightM: -Infinity,
      firstNormal: sample.normal,
      maximumNormalChange: 0
    });
    const entry = stats.get(record.cylinder.wheelId);
    entry.minimumHeightM = Math.min(entry.minimumHeightM, sample.heightM);
    entry.maximumHeightM = Math.max(entry.maximumHeightM, sample.heightM);
    entry.maximumNormalChange = Math.max(
      entry.maximumNormalChange,
      1 - clamp(dot(entry.firstNormal, sample.normal), -1, 1)
    );
  });
  return cylinders.filter((cylinder) => {
    if (directlyActiveWheelIds.has(cylinder.wheelId)) return true;
    const entry = stats.get(cylinder.wheelId);
    if (!entry) return false;
    if (typeof environment.sampleTerrainMaximumHeightInBounds === 'function') {
      const minimumX = Math.min(
        cylinder.previousHubPositionWorld.x, cylinder.hubPositionWorld.x
      ) - cylinder.radiusM;
      const maximumX = Math.max(
        cylinder.previousHubPositionWorld.x, cylinder.hubPositionWorld.x
      ) + cylinder.radiusM;
      const minimumZ = Math.min(
        cylinder.previousHubPositionWorld.z, cylinder.hubPositionWorld.z
      ) - cylinder.radiusM - cylinder.widthM * 0.5;
      const maximumZ = Math.max(
        cylinder.previousHubPositionWorld.z, cylinder.hubPositionWorld.z
      ) + cylinder.radiusM + cylinder.widthM * 0.5;
      const maximum = Number(environment.sampleTerrainMaximumHeightInBounds({
        minX: minimumX, maxX: maximumX, minZ: minimumZ, maxZ: maximumZ
      }));
      if (Number.isFinite(maximum)) entry.maximumHeightM = Math.max(
        entry.maximumHeightM, maximum
      );
    }
    return entry.maximumHeightM - entry.minimumHeightM > 0.004
      || entry.maximumNormalChange > 1 - Math.cos(0.5 * Math.PI / 180);
  });
}

/**
 * Sweeps finite-width wheel cylinders against the authoritative terrain
 * source. Ordinary bottom-tread support stays in the tire solver; every
 * result here is a non-powered collision feature for the chassis manifold.
 */
export function sweepWheelCylinders({
  cylinders = [], environment = {}, toleranceM = 0.008,
  spacingM = 0.02, radialSamples = 24
} = {}) {
  const validCylinders = cylinders.filter((cylinder) => (
    cylinder?.previousHubPositionWorld && cylinder?.hubPositionWorld
    && Number(cylinder.radiusM) > 0 && Number(cylinder.widthM) > 0
    && length(subtract(cylinder.hubPositionWorld, cylinder.previousHubPositionWorld)) > 1e-7
  ));
  const active = findActiveCylinders(validCylinders, environment, spacingM);
  if (!active.length) return null;
  const featuresByWheel = new Map(active.map((cylinder) => [
    cylinder.wheelId,
    createLeadingFeatures(cylinder, clamp(Math.trunc(radialSamples), 16, 48))
  ]));
  const bounds = active.reduce((result, cylinder) => {
    [cylinder.previousHubPositionWorld, cylinder.hubPositionWorld].forEach((hub) => {
      result.minX = Math.min(result.minX, hub.x - cylinder.radiusM - cylinder.widthM);
      result.maxX = Math.max(result.maxX, hub.x + cylinder.radiusM + cylinder.widthM);
      result.minY = Math.min(result.minY, hub.y - cylinder.radiusM);
      result.maxY = Math.max(result.maxY, hub.y + cylinder.radiusM);
      result.minZ = Math.min(result.minZ, hub.z - cylinder.radiusM - cylinder.widthM);
      result.maxZ = Math.max(result.maxZ, hub.z + cylinder.radiusM + cylinder.widthM);
    });
    return result;
  }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const triangles = typeof environment.sampleTerrainTrianglesInBounds === 'function'
    ? (environment.sampleTerrainTrianglesInBounds(bounds) || []).map(normalizeTriangle).filter(Boolean)
    : [];
  const triangleContacts = triangles.length
    ? findTriangleContacts(active, featuresByWheel, triangles, toleranceM) : [];
  const heightContacts = findHeightSweepContacts(
    active, featuresByWheel, environment, toleranceM, clamp(spacingM, 0.005, 0.05)
  );
  const contactByFeature = new Map();
  triangleContacts.concat(heightContacts).forEach((contact) => {
    const existing = contactByFeature.get(contact.id);
    if (!existing || contact.sweepFraction < existing.sweepFraction - 1e-8
      || (Math.abs(contact.sweepFraction - existing.sweepFraction) <= 1e-8
        && contact.mechanism === 'prepared-triangle')) {
      contactByFeature.set(contact.id, contact);
    }
  });
  const allContacts = [...contactByFeature.values()];
  if (!allContacts.length) return null;
  allContacts.sort((left, right) => left.sweepFraction - right.sweepFraction
    || String(left.wheelId).localeCompare(String(right.wheelId))
    || String(left.id).localeCompare(String(right.id)));
  const fraction = allContacts[0].sweepFraction;
  const contacts = allContacts.filter((contact) => (
    contact.sweepFraction <= fraction + 2e-4
  ));
  const impactedWidths = new Map();
  contacts.forEach((contact) => {
    if (!impactedWidths.has(contact.wheelId)) impactedWidths.set(contact.wheelId, new Set());
    impactedWidths.get(contact.wheelId).add(contact.widthFraction);
  });
  contacts.forEach((contact) => {
    contact.partialWidth = impactedWidths.get(contact.wheelId).size < 3;
  });
  return {
    fraction,
    contacts,
    activeWheelIds: active.map(({ wheelId }) => wheelId),
    terrainTriangleIds: [...new Set(contacts.flatMap((contact) => (
      contact.examinedTriangleIds || []
    )).map(String))].sort(),
    bounds
  };
}

export function createWheelCylinderSupportFeatures(cylinders = [], fraction = 1) {
  return cylinders.flatMap((cylinder) => {
    const halfWidthM = Number(cylinder.widthM || 0) * 0.5;
    const radialIndices = cylinder.validTreadContact
      ? [0, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
    return [-halfWidthM, halfWidthM].flatMap((widthOffsetM) => (
      radialIndices.map((radialIndex) => {
        const feature = {
          angleRad: radialIndex * Math.PI / 4,
          radialIndex,
          widthOffsetM,
          axialFace: true
        };
        const geometry = pointForFeature(cylinder, feature, fraction);
        return {
          id: `wheel-${cylinder.wheelId}-sidewall-${widthOffsetM < 0 ? 'inner' : 'outer'}-${radialIndex}`,
          wheelId: cylinder.wheelId,
          contactType: 'wheel-sidewall',
          poweredTreadContact: false,
          worldPoint: geometry.point,
          friction: cylinder.collisionFriction
        };
      })
    ));
  });
}

export default sweepWheelCylinders;
