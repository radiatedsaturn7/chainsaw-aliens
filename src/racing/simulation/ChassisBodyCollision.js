import {
  addVector3,
  crossVector3,
  inverseInertiaWorldMultiply,
  integrateQuaternion,
  rotateVectorByQuaternion,
  scaleVector3
} from './RigidBodyMath.js';
import { normalizeVehicleBodyProfile } from './VehicleBodyProfile.js';
import { createSurfaceSample } from './SurfaceSample.js';
import {
  createWheelCylinderSupportFeatures,
  sweepWheelCylinders
} from './WheelCylinderCollision.js';

const EPSILON = 1e-9;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dot = (a = {}, b = {}) => Number(a.x || 0) * Number(b.x || 0)
  + Number(a.y || 0) * Number(b.y || 0)
  + Number(a.z || 0) * Number(b.z || 0);
const length = (value = {}) => Math.hypot(Number(value.x || 0), Number(value.y || 0), Number(value.z || 0));
const normalize = (value = {}, fallback = { x: 0, y: 1, z: 0 }) => {
  const magnitude = length(value);
  return magnitude > EPSILON ? scaleVector3(value, 1 / magnitude) : { ...fallback };
};
const mixVector = (a = {}, b = {}, t = 0) => ({
  x: Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t,
  y: Number(a.y || 0) + (Number(b.y || 0) - Number(a.y || 0)) * t,
  z: Number(a.z || 0) + (Number(b.z || 0) - Number(a.z || 0)) * t
});
const mixQuaternion = (a = {}, b = {}, t = 0) => {
  const sign = Number(a.x || 0) * Number(b.x || 0)
    + Number(a.y || 0) * Number(b.y || 0)
    + Number(a.z || 0) * Number(b.z || 0)
    + Number(a.w ?? 1) * Number(b.w ?? 1) < 0 ? -1 : 1;
  const mixed = {
    x: Number(a.x || 0) + (Number(b.x || 0) * sign - Number(a.x || 0)) * t,
    y: Number(a.y || 0) + (Number(b.y || 0) * sign - Number(a.y || 0)) * t,
    z: Number(a.z || 0) + (Number(b.z || 0) * sign - Number(a.z || 0)) * t,
    w: Number(a.w ?? 1) + (Number(b.w ?? 1) * sign - Number(a.w ?? 1)) * t
  };
  const magnitude = Math.hypot(mixed.x, mixed.y, mixed.z, mixed.w) || 1;
  return { x: mixed.x / magnitude, y: mixed.y / magnitude, z: mixed.z / magnitude, w: mixed.w / magnitude };
};

export function createChassisBodyContactCandidates(config = {}) {
  const profile = normalizeVehicleBodyProfile(config.bodyProfile || {}, {
    lengthM: config.bodyLengthM, widthM: config.bodyWidthM, heightM: config.bodyHeightM,
    groundClearanceM: config.bodyGroundClearanceM,
    cgPositionM: config.cgLocationBodyM || { y: config.cgHeightM },
    collisionFriction: config.bodyCollisionFriction,
    collisionRestitution: config.bodyCollisionRestitution
  });
  const candidates = [];
  const supportSpacingM = clamp(Number(config.bodyCollisionSupportSpacingM || 0.55), 0.2, 0.8);
  profile.pieces.forEach((piece) => {
    if (piece.type === 'convex' && piece.vertices.length) {
      piece.vertices.forEach((vertex, index) => candidates.push(Object.freeze({
        id: `${piece.id}-vertex-${index}`, pieceId: piece.id, pieceType: piece.type,
        localPoint: addVector3(piece.centerM, vertex)
      })));
      // Custom convex pieces need support between authored vertices as well as
      // at them. Deterministic edge interpolation and a face/interior support
      // point prevent narrow crests from passing through a sparse vertex cage.
      for (let first = 0; first < piece.vertices.length; first += 1) {
        for (let second = first + 1; second < piece.vertices.length; second += 1) {
          const start = piece.vertices[first];
          const end = piece.vertices[second];
          const edgeLength = length(addVector3(end, scaleVector3(start, -1)));
          const divisions = Math.max(2, Math.ceil(edgeLength / supportSpacingM));
          for (let division = 1; division < divisions; division += 1) {
            candidates.push(Object.freeze({
              id: `${piece.id}-edge-${first}-${second}-${division}`,
              pieceId: piece.id,
              pieceType: piece.type,
              localPoint: addVector3(piece.centerM, mixVector(start, end, division / divisions))
            }));
          }
        }
      }
      const faceKeys = new Set();
      for (let first = 0; first < piece.vertices.length - 2; first += 1) {
        for (let second = first + 1; second < piece.vertices.length - 1; second += 1) {
          for (let third = second + 1; third < piece.vertices.length; third += 1) {
            const a = piece.vertices[first];
            const b = piece.vertices[second];
            const c = piece.vertices[third];
            const rawNormal = crossVector3(
              addVector3(b, scaleVector3(a, -1)),
              addVector3(c, scaleVector3(a, -1))
            );
            if (length(rawNormal) <= EPSILON) continue;
            let normal = normalize(rawNormal);
            const sides = piece.vertices.map((vertex) => dot(
              addVector3(vertex, scaleVector3(a, -1)), normal
            ));
            const hasPositive = sides.some((side) => side > 1e-6);
            const hasNegative = sides.some((side) => side < -1e-6);
            if (hasPositive && hasNegative) continue;
            if (hasPositive) normal = scaleVector3(normal, -1);
            const faceVertices = piece.vertices.filter((vertex) => Math.abs(dot(
              addVector3(vertex, scaleVector3(a, -1)), normal
            )) <= 1e-6);
            const key = faceVertices.map((vertex) => piece.vertices.indexOf(vertex))
              .sort((left, right) => left - right).join('-');
            if (faceKeys.has(key)) continue;
            faceKeys.add(key);
            const centroid = scaleVector3(faceVertices.reduce((sum, vertex) => (
              addVector3(sum, vertex)
            ), { x: 0, y: 0, z: 0 }), 1 / faceVertices.length);
            candidates.push(Object.freeze({
              id: `${piece.id}-face-${key}`,
              pieceId: piece.id,
              pieceType: piece.type,
              localNormals: Object.freeze([Object.freeze(normal)]),
              localPoint: addVector3(piece.centerM, centroid)
            }));
          }
        }
      }
      return;
    }
    const half = scaleVector3(piece.sizeM, 0.5);
    const divisions = {
      x: Math.max(1, Math.ceil(piece.sizeM.x / supportSpacingM)),
      y: Math.max(1, Math.ceil(piece.sizeM.y / supportSpacingM)),
      z: Math.max(1, Math.ceil(piece.sizeM.z / supportSpacingM))
    };
    const featureMap = new Map();
    const addFaceGrid = (fixedAxis, fixedSign, axisA, axisB) => {
      for (let a = 0; a <= divisions[axisA]; a += 1) {
        for (let b = 0; b <= divisions[axisB]; b += 1) {
          const normalized = { x: 0, y: 0, z: 0 };
          normalized[fixedAxis] = fixedSign;
          normalized[axisA] = -1 + 2 * a / divisions[axisA];
          normalized[axisB] = -1 + 2 * b / divisions[axisB];
          const key = `${Math.round(normalized.x * 1e6)}:${Math.round(normalized.y * 1e6)}:${Math.round(normalized.z * 1e6)}`;
          const localNormal = { x: 0, y: 0, z: 0 };
          localNormal[fixedAxis] = fixedSign;
          const existing = featureMap.get(key);
          if (existing) {
            existing.localNormals.push(localNormal);
            continue;
          }
          const boundaryAxes = Number(Math.abs(normalized.x) === 1)
            + Number(Math.abs(normalized.y) === 1)
            + Number(Math.abs(normalized.z) === 1);
          featureMap.set(key, {
            feature: boundaryAxes >= 3 ? 'corner' : boundaryAxes === 2 ? 'edge' : 'face',
            normalized,
            localNormals: [localNormal]
          });
        }
      }
    };
    addFaceGrid('x', -1, 'y', 'z');
    addFaceGrid('x', 1, 'y', 'z');
    addFaceGrid('y', -1, 'x', 'z');
    addFaceGrid('y', 1, 'x', 'z');
    addFaceGrid('z', -1, 'x', 'y');
    addFaceGrid('z', 1, 'x', 'y');
    [...featureMap.values()].forEach(({ feature, normalized, localNormals }, index) => {
      candidates.push(Object.freeze({
        id: `${piece.id}-${feature}-${index}`,
        pieceId: piece.id,
        pieceType: piece.type,
        localNormals: Object.freeze(localNormals.map((normal) => Object.freeze(normal))),
        localPoint: addVector3(piece.centerM, {
          x: half.x * normalized.x,
          y: half.y * normalized.y,
          z: half.z * normalized.z
        })
      }));
    });
  });
  return Object.freeze(candidates);
}

function inverseInertiaMultiply(value, config, orientation) {
  return inverseInertiaWorldMultiply(value, orientation, config.inertiaTensorBodyKgM2 || {
    xx: Number(config.pitchInertiaKgM2 || 1),
    yy: Number(config.yawInertiaKgM2 || 1),
    zz: Number(config.rollInertiaKgM2 || 1),
    xy: 0,
    xz: 0,
    yz: 0
  });
}

function effectiveMassDenominator(direction, arm, config, orientation) {
  const armCrossDirection = crossVector3(arm, direction);
  const angularVelocityPerImpulse = inverseInertiaMultiply(armCrossDirection, config, orientation);
  return 1 / config.massKg
    + dot(direction, crossVector3(angularVelocityPerImpulse, arm));
}

function applyImpulse(working, impulse, arm, config) {
  working.velocity = addVector3(working.velocity, scaleVector3(impulse, 1 / config.massKg));
  working.angularVelocityWorld = addVector3(
    working.angularVelocityWorld,
    inverseInertiaMultiply(crossVector3(arm, impulse), config, working.orientation)
  );
}

export class ChassisBodyCollision {
  constructor(config = {}) {
    this.candidates = createChassisBodyContactCandidates(config);
    this.supportEnvelopeBucketM = clamp(
      Number(config.bodyCollisionSupportSpacingM || 0.55) * 0.5,
      0.1,
      0.4
    );
    this.supportCandidateCache = new Map();
  }

  createWorkingState(state = {}) {
    return {
      position: { ...state.position },
      orientation: { ...state.orientation },
      velocity: { ...state.velocity },
      angularVelocityWorld: { ...state.angularVelocityWorld }
    };
  }

  getSupportCandidates(pose = {}) {
    const orientation = pose.orientation || {};
    const cacheKey = ['x', 'y', 'z', 'w'].map((axis) => (
      Math.round(Number(orientation[axis] ?? (axis === 'w' ? 1 : 0)) * 10000)
    )).join(':');
    const cached = this.supportCandidateCache.get(cacheKey);
    if (cached) return cached;
    const facing = this.candidates.filter((candidate) => !candidate.localNormals?.length
      || candidate.localNormals.some((normal) => (
        rotateVectorByQuaternion(normal, pose.orientation).y < -0.05
      )));
    const spacing = this.supportEnvelopeBucketM;
    const envelope = new Map();
    facing.forEach((candidate) => {
      const point = rotateVectorByQuaternion(candidate.localPoint, pose.orientation);
      const key = `${Math.round(point.x / spacing)}:${Math.round(point.z / spacing)}`;
      const existing = envelope.get(key);
      if (!existing || point.y < existing.point.y) envelope.set(key, { candidate, point });
    });
    const result = [...envelope.values()].map(({ candidate }) => candidate);
    if (this.supportCandidateCache.size >= 128) {
      this.supportCandidateCache.delete(this.supportCandidateCache.keys().next().value);
    }
    this.supportCandidateCache.set(cacheKey, result);
    return result;
  }

  getAdaptiveSupportWorld(pose, environment = {}) {
    const base = this.getSupportCandidates(pose).map((candidate) => {
      const arm = rotateVectorByQuaternion(candidate.localPoint, pose.orientation);
      return { candidate, arm, worldPoint: addVector3(pose.position, arm) };
    });
    const sampleTerrain = environment.sampleTerrainAtWorldPoint;
    // Prepared terrain bakes flag only tiles containing meaningful height or
    // normal variation. Flat tiles retain the bounded cached support set.
    if (typeof sampleTerrain !== 'function'
      || (environment.adaptiveBodySupport !== true
        && environment.terrainHasDiscontinuities !== true)) return base;
    const heightErrorM = Math.max(0.005, Number(environment.bodySupportHeightErrorM || 0.025));
    const normalError = Math.max(0.0001, Number(environment.bodySupportNormalError || 0.01));
    const minimumSpacingM = Math.max(0.04, Number(environment.bodySupportMinimumSpacingM || 0.08));
    const maximumDepth = Math.max(1, Math.min(3, Math.trunc(Number(
      environment.bodySupportMaximumSubdivisionDepth ?? 2
    ))));
    const maximumAdditions = Math.max(4, Math.min(64, Math.trunc(Number(
      environment.bodySupportMaximumAdaptiveSamples ?? 32
    ))));
    const additions = [];
    const sampled = new Map();
    const terrainAt = (point) => {
      const key = `${point.x.toFixed(6)}:${point.z.toFixed(6)}`;
      if (!sampled.has(key)) sampled.set(key, createSurfaceSample(sampleTerrain(point), {
        queryPosition: point,
        source: 'body-adaptive-support'
      }));
      return sampled.get(key);
    };
    const subdivide = (left, right, depth) => {
      if (additions.length >= maximumAdditions) return;
      const distanceM = length(addVector3(right.worldPoint, scaleVector3(left.worldPoint, -1)));
      if (distanceM <= minimumSpacingM || depth >= maximumDepth) return;
      const leftTerrain = terrainAt(left.worldPoint);
      const rightTerrain = terrainAt(right.worldPoint);
      if (!leftTerrain.valid || !rightTerrain.valid) return;
      const leftHeight = leftTerrain.heightM;
      const rightHeight = rightTerrain.heightM;
      const leftNormal = normalize(leftTerrain.normal || leftTerrain.normalWorld);
      const rightNormal = normalize(rightTerrain.normal || rightTerrain.normalWorld);
      if (Math.abs(leftHeight - rightHeight) <= heightErrorM
        && 1 - dot(leftNormal, rightNormal) <= normalError) return;
      const localPoint = mixVector(left.candidate.localPoint, right.candidate.localPoint, 0.5);
      const arm = rotateVectorByQuaternion(localPoint, pose.orientation);
      const middle = {
        candidate: {
          id: `${left.candidate.pieceId}-adaptive-${left.candidate.id}-${right.candidate.id}-${depth}`,
          pieceId: left.candidate.pieceId,
          pieceType: left.candidate.pieceType,
          localPoint,
          adaptive: true
        },
        arm,
        worldPoint: addVector3(pose.position, arm)
      };
      additions.push(middle);
      if (additions.length >= maximumAdditions) return;
      subdivide(left, middle, depth + 1);
      subdivide(middle, right, depth + 1);
    };
    const neighborLimitM = this.supportEnvelopeBucketM * 3;
    const buckets = new Map();
    base.forEach((entry, index) => {
      const key = `${entry.candidate.pieceId}:${Math.floor(entry.worldPoint.x / neighborLimitM)}:${Math.floor(entry.worldPoint.z / neighborLimitM)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(index);
    });
    const visitedPairs = new Set();
    base.forEach((entry, first) => {
      const bucketX = Math.floor(entry.worldPoint.x / neighborLimitM);
      const bucketZ = Math.floor(entry.worldPoint.z / neighborLimitM);
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          const key = `${entry.candidate.pieceId}:${bucketX + offsetX}:${bucketZ + offsetZ}`;
          (buckets.get(key) || []).forEach((second) => {
            if (second <= first) return;
            const pairKey = `${first}:${second}`;
            if (visitedPairs.has(pairKey)) return;
            visitedPairs.add(pairKey);
            if (length(addVector3(base[second].worldPoint,
              scaleVector3(entry.worldPoint, -1))) <= neighborLimitM) {
              subdivide(entry, base[second], 0);
            }
          });
        }
      }
    });
    return base.concat(additions);
  }

  samplePosePenetration(pose, environment, toleranceM) {
    const sampleTerrain = environment.sampleTerrainAtWorldPoint;
    const sampleTerrainBatch = environment.sampleTerrainAtWorldPoints;
    const points = this.getAdaptiveSupportWorld(pose, environment);
    const terrainBatch = typeof sampleTerrainBatch === 'function'
      ? sampleTerrainBatch(points.map(({ worldPoint }) => worldPoint))
      : null;
    let maximumPenetrationM = -Infinity;
    let deepestNormal = null;
    let invalidTerrainSampleCount = 0;
    let belowTerrainSampleCount = 0;
    let terrainTriangleIds = null;
    let terrainSources = null;
    let terrainRegions = null;
    let penetratingFeatureIds = null;
    points.forEach(({ candidate, worldPoint }, index) => {
      const rawTerrain = terrainBatch?.[index]
        || (typeof sampleTerrain === 'function' ? sampleTerrain(worldPoint) : null)
        || {};
      const terrain = createSurfaceSample(rawTerrain, {
        queryPosition: worldPoint,
        source: 'body-penetration-query'
      });
      if (!terrain.valid) {
        invalidTerrainSampleCount += 1;
        return;
      }
      const heightM = terrain.heightM;
      const normal = normalize(terrain.normal || terrain.normalWorld);
      const surfacePoint = { x: worldPoint.x, y: heightM, z: worldPoint.z };
      const penetrationM = -dot(
        addVector3(worldPoint, scaleVector3(surfacePoint, -1)), normal
      );
      if (penetrationM > maximumPenetrationM) {
        maximumPenetrationM = penetrationM;
        deepestNormal = normal;
      }
      if (penetrationM > toleranceM) {
        belowTerrainSampleCount += 1;
        terrainTriangleIds ||= new Set();
        terrainSources ||= new Set();
        terrainRegions ||= new Set();
        penetratingFeatureIds ||= new Set();
        if (terrain.triangleId !== null && terrain.triangleId !== undefined) {
          terrainTriangleIds.add(String(terrain.triangleId));
        }
        if (terrain.source) terrainSources.add(String(terrain.source));
        if (terrain.region) terrainRegions.add(String(terrain.region));
        if (candidate?.id) penetratingFeatureIds.add(String(candidate.id));
      }
    });
    return {
      maximumPenetrationM: Number.isFinite(maximumPenetrationM) ? maximumPenetrationM : null,
      deepestNormal,
      invalidTerrainSampleCount,
      validTerrainSampleCount: points.length - invalidTerrainSampleCount,
      belowTerrainSampleCount,
      terrainTriangleIds: terrainTriangleIds ? [...terrainTriangleIds].sort() : [],
      terrainSources: terrainSources ? [...terrainSources].sort() : [],
      terrainRegions: terrainRegions ? [...terrainRegions].sort() : [],
      penetratingFeatureIds: penetratingFeatureIds ? [...penetratingFeatureIds].sort() : [],
      allBodySamplesBelowTerrain: belowTerrainSampleCount > 0
        && belowTerrainSampleCount === points.length - invalidTerrainSampleCount,
      allTerrainSamplesInvalid: invalidTerrainSampleCount === points.length
    };
  }

  findSweepImpact(previousState, proposedState, environment, toleranceM, config) {
    if (!previousState) return null;
    const translationM = length(addVector3(
      proposedState.position, scaleVector3(previousState.position, -1)
    ));
    const angularSpeed = length(previousState.angularVelocityWorld);
    const bodyRadiusM = Math.hypot(
      Number(config.bodyLengthM || 4.5) * 0.5,
      Number(config.bodyWidthM || 1.8) * 0.5,
      Number(config.bodyHeightM || 1.45)
    );
    const slices = clamp(Math.ceil((translationM + angularSpeed * bodyRadiusM
      * Math.max(0, Number(config.__collisionSubstepDt || 0))) / 0.02), 1, 128);
    const poseAt = (fraction) => ({
      position: mixVector(previousState.position, proposedState.position, fraction),
      orientation: mixQuaternion(previousState.orientation, proposedState.orientation, fraction)
    });
    let previousFraction = 0;
    let previousSample = this.samplePosePenetration(poseAt(0), environment, toleranceM);
    for (let slice = 1; slice <= slices; slice += 1) {
      const fraction = slice / slices;
      const sample = this.samplePosePenetration(poseAt(fraction), environment, toleranceM);
      if (sample.maximumPenetrationM !== null
        && sample.maximumPenetrationM > toleranceM
        && (previousSample.maximumPenetrationM === null
          || previousSample.maximumPenetrationM <= toleranceM)) {
        let low = previousFraction;
        let high = fraction;
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const middle = (low + high) * 0.5;
          const middleSample = this.samplePosePenetration(poseAt(middle), environment, toleranceM);
          if (middleSample.maximumPenetrationM !== null
            && middleSample.maximumPenetrationM > toleranceM) high = middle;
          else low = middle;
        }
        const impactFraction = Math.min(1, high + 1e-5);
        return { fraction: impactFraction, pose: poseAt(impactFraction), sample };
      }
      previousFraction = fraction;
      previousSample = sample;
    }
    return null;
  }

  step({ workingState, previousWorkingState = null, config, environment = {}, dt = 0, advanceState = true }) {
    const sampleTerrain = environment.sampleTerrainAtWorldPoint;
    const sampleTerrainBatch = environment.sampleTerrainAtWorldPoints;
    if ((typeof sampleTerrain !== 'function' && typeof sampleTerrainBatch !== 'function') || dt <= 0) {
      return {
        linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
        angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
        positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
        contacts: []
      };
    }
    if (advanceState) {
      workingState.position = addVector3(workingState.position, scaleVector3(workingState.velocity, dt));
      workingState.orientation = integrateQuaternion(
        workingState.orientation,
        workingState.angularVelocityWorld,
        dt
      );
    }
    const toleranceM = Math.max(0.001, Number(config.bodyCollisionToleranceM || 0.008));
    const proposedState = this.createWorkingState(workingState);
    const endpointStates = previousWorkingState ? [previousWorkingState, proposedState] : [proposedState];
    const profile = config.bodyProfile || {};
    const halfWidth = Number(profile.overallWidthM || config.bodyWidthM || 1.8) * 0.5;
    const halfLength = Number(profile.overallLengthM || config.bodyLengthM || 4.5) * 0.5;
    const bottom = Number(profile.groundClearanceM ?? config.bodyGroundClearanceM ?? 0.12)
      - Number(profile.cgPositionM?.y ?? config.cgHeightM ?? 0.55);
    const top = bottom + Number(profile.overallHeightM || config.bodyHeightM || 1.45);
    const broadphaseLocalCorners = [-1, 1].flatMap((x) => [bottom, top].flatMap((y) => (
      [-1, 1].map((z) => ({ x: x * halfWidth, y, z: z * halfLength }))
    )));
    const endpointWorldPoints = endpointStates.flatMap((pose) => broadphaseLocalCorners.map((localPoint) => (
      addVector3(pose.position, rotateVectorByQuaternion(localPoint, pose.orientation))
    )));
    const endpointXs = endpointWorldPoints.map((point) => point.x);
    const endpointZs = endpointWorldPoints.map((point) => point.z);
    const explicitHeights = [
      environment.groundHeightM,
      ...Object.values(environment.surfaceHeightByWheel || {})
    ].map(Number).filter(Number.isFinite);
    let knownMaximumTerrainHeightM = explicitHeights.length ? Math.max(...explicitHeights) : null;
    if (typeof environment.sampleTerrainMaximumHeightInBounds === 'function') {
      const sampledMaximum = Number(environment.sampleTerrainMaximumHeightInBounds({
        minX: Math.min(...endpointXs),
        maxX: Math.max(...endpointXs),
        minZ: Math.min(...endpointZs),
        maxZ: Math.max(...endpointZs)
      }));
      if (Number.isFinite(sampledMaximum)) knownMaximumTerrainHeightM = sampledMaximum;
    }
    const angularTravelRad = length(previousWorkingState?.angularVelocityWorld || {}) * dt;
    const bodyRadiusM = Math.hypot(
      Number(config.bodyLengthM || 4.5) * 0.5,
      Number(config.bodyWidthM || 1.8) * 0.5,
      Number(config.bodyHeightM || 1.45)
    );
    const conservativeMinimumBodyHeightM = Math.min(...endpointWorldPoints.map((point) => point.y))
      - bodyRadiusM * angularTravelRad;
    const wheelCylinderSweep = sweepWheelCylinders({
      cylinders: environment.wheelCylinderSweeps || [],
      environment,
      toleranceM,
      spacingM: config.wheelCylinderSweepSpacingM,
      radialSamples: config.wheelCylinderRadialSamples
    });
    if (Number.isFinite(knownMaximumTerrainHeightM)
      && conservativeMinimumBodyHeightM - knownMaximumTerrainHeightM > toleranceM
      && !wheelCylinderSweep) {
      return {
        linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
        angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
        positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
        contacts: [],
        broadphaseRejected: true,
        maximumPenetrationM: 0
      };
    }
    const bodySweep = this.findSweepImpact(previousWorkingState, proposedState, environment, toleranceM, {
      ...config,
      __collisionSubstepDt: dt
    });
    let sweep = bodySweep;
    let sweepSource = bodySweep ? 'body' : null;
    if (wheelCylinderSweep && (!sweep
      || wheelCylinderSweep.fraction < sweep.fraction - 1e-8)) {
      sweep = {
        fraction: wheelCylinderSweep.fraction,
        pose: {
          position: mixVector(
            previousWorkingState?.position || proposedState.position,
            proposedState.position,
            wheelCylinderSweep.fraction
          ),
          orientation: mixQuaternion(
            previousWorkingState?.orientation || proposedState.orientation,
            proposedState.orientation,
            wheelCylinderSweep.fraction
          )
        },
        sample: null
      };
      sweepSource = 'wheel-cylinder';
    }
    if (sweep) {
      workingState.position = { ...sweep.pose.position };
      workingState.orientation = { ...sweep.pose.orientation };
    }
    const wheelSupportFeatures = environment.wheelCylinderSweeps?.length
      ? createWheelCylinderSupportFeatures(
        environment.wheelCylinderSweeps, sweep?.fraction ?? 1
      )
      : (environment.wheelCollisionSupportFeatures || []);
    const sweptWheelContactFeatures = wheelCylinderSweep
      && wheelCylinderSweep.fraction <= (sweep?.fraction ?? 1) + 2e-4
      ? wheelCylinderSweep.contacts : [];
    const uniqueWheelSupportFeatures = wheelSupportFeatures.filter((feature) => (
      !sweptWheelContactFeatures.some((contact) => contact.wheelId === feature.wheelId
        && length(addVector3(contact.worldPoint, scaleVector3(feature.worldPoint, -1))) < 1e-5)
    ));
    const candidateWorld = this.getAdaptiveSupportWorld(workingState, environment)
      .concat(uniqueWheelSupportFeatures.concat(sweptWheelContactFeatures).map((feature) => ({
      candidate: feature,
      arm: addVector3(feature.worldPoint, scaleVector3(workingState.position, -1)),
      worldPoint: feature.worldPoint
    })));
    if (typeof environment.sampleTerrainMaximumHeightInBounds === 'function') {
      const xs = candidateWorld.map(({ worldPoint }) => worldPoint.x);
      const zs = candidateWorld.map(({ worldPoint }) => worldPoint.z);
      const maximumTerrainHeightM = environment.sampleTerrainMaximumHeightInBounds({
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs)
      });
      const minimumCandidateHeightM = Math.min(...candidateWorld.map(({ worldPoint }) => worldPoint.y));
      if (Number.isFinite(Number(maximumTerrainHeightM))
        && minimumCandidateHeightM - Number(maximumTerrainHeightM) > toleranceM) {
        return {
          linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
          angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
          positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
          contacts: [],
          broadphaseRejected: true
        };
      }
    }
    const terrainBatch = typeof sampleTerrainBatch === 'function'
      ? sampleTerrainBatch(candidateWorld.map(({ worldPoint }) => worldPoint))
      : null;
    const contacts = candidateWorld.map(({ candidate, arm, worldPoint }, candidateIndex) => {
      const rawTerrain = candidate.surfaceSample || terrainBatch?.[candidateIndex]
        || (typeof sampleTerrain === 'function' ? sampleTerrain(worldPoint) : null)
        || {};
      const terrain = createSurfaceSample(rawTerrain, {
        queryPosition: worldPoint,
        source: 'body-contact-query'
      });
      if (!terrain.valid) return null;
      const heightM = terrain.heightM;
      const normal = normalize(candidate.collisionNormal || terrain.normal || terrain.normalWorld);
      const surfacePoint = { x: worldPoint.x, y: heightM, z: worldPoint.z };
      const penetrationM = Number.isFinite(Number(candidate.penetrationM))
        ? Number(candidate.penetrationM)
        : -dot(addVector3(worldPoint, scaleVector3(surfacePoint, -1)), normal);
      if (penetrationM <= toleranceM) return null;
      return {
        id: candidate.id,
        candidateIndex,
        localPoint: candidate.localPoint || null,
        arm,
        pointWorld: worldPoint,
        normal,
        penetrationM,
        friction: clamp(Math.sqrt(
          Math.max(0, Number(candidate.friction ?? config.bodyCollisionFriction ?? 0.62))
          * Math.max(0, Number(terrain.friction ?? config.bodyCollisionFriction ?? 0.62))
        ), 0, 1.5),
        pieceId: candidate.pieceId || null,
        wheelId: candidate.wheelId || null,
        contactType: candidate.contactType || 'body',
        triangleId: candidate.triangleId ?? terrain.triangleId,
        terrainSource: candidate.terrainSource ?? terrain.source,
        terrainRegion: candidate.terrainRegion ?? terrain.region,
        poweredTreadContact: candidate.poweredTreadContact === true,
        widthFraction: candidate.widthFraction ?? null,
        partialWidth: candidate.partialWidth === true,
        sweepMechanism: candidate.mechanism || null,
        normalImpulseNs: 0,
        tangentialImpulseNs: 0,
        restitutionImpulseNs: 0,
        penetrationBiasImpulseNs: 0,
        restitutionTargetSpeedMps: 0,
        suspensionSupported: Number(
          environment.suspensionBodyContactSupport?.supportedWheelCount || 0
        ) > 0 && /lower|frame|underbody|underside|rocker/.test(candidate.id)
      };
    }).filter(Boolean);
    const unsupportedAtContactStart = Number(
      environment.suspensionBodyContactSupport?.supportedWheelCount || 0
    ) === 0;
    const initialUnsupportedMaximumPenetrationM = unsupportedAtContactStart
      ? contacts.reduce((maximum, contact) => Math.max(maximum, contact.penetrationM), 0)
      : null;
    const initialUnsupportedAllBodySamplesBelowTerrain = unsupportedAtContactStart
      && contacts.length > 0
      && contacts.filter((contact) => !contact.contactType.startsWith('wheel-')).length
        === candidateWorld.filter(({ candidate }) => (
          !String(candidate.contactType || '').startsWith('wheel-')
        )).length;
    let linearImpulse = { x: 0, y: 0, z: 0 };
    let angularImpulse = { x: 0, y: 0, z: 0 };
    const restitution = clamp(Number(config.bodyCollisionRestitution ?? 0.08), 0, 0.6);
    const restitutionThresholdMps = Math.max(
      0,
      Number(config.bodyCollisionRestitutionThresholdMps ?? 2)
    );
    const iterations = Math.max(1, Math.trunc(Number(config.bodyCollisionSolverIterations || 4)));
    contacts.forEach((contact) => {
      const initialPointVelocity = addVector3(
        workingState.velocity,
        crossVector3(workingState.angularVelocityWorld, contact.arm)
      );
      const initialClosingSpeedMps = Math.max(0, -dot(initialPointVelocity, contact.normal));
      contact.restitutionTargetSpeedMps = !contact.suspensionSupported
        && initialClosingSpeedMps >= restitutionThresholdMps
        ? initialClosingSpeedMps * restitution
        : 0;
    });
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      contacts.forEach((contact) => {
        const pointVelocity = addVector3(
          workingState.velocity,
          crossVector3(workingState.angularVelocityWorld, contact.arm)
        );
        const normalSpeed = dot(pointVelocity, contact.normal);
        // Split impulse: penetration is corrected in position only. Physical
        // normal velocity comes exclusively from actual closing velocity and
        // configured restitution, so overlap stabilization cannot create a
        // rebound or feed energy into the chassis.
        const closingSpeed = Math.max(0, -normalSpeed);
        const stoppingDelta = closingSpeed;
        const restitutionDelta = Math.max(
          0,
          contact.restitutionTargetSpeedMps - Math.max(0, normalSpeed)
        );
        const desiredNormalDelta = stoppingDelta + restitutionDelta;
        const normalDenominator = Math.max(EPSILON, effectiveMassDenominator(
          contact.normal,
          contact.arm,
          config,
          workingState.orientation
        ));
        const normalImpulseMagnitude = desiredNormalDelta / normalDenominator;
        const normalImpulse = scaleVector3(contact.normal, normalImpulseMagnitude);
        applyImpulse(workingState, normalImpulse, contact.arm, config);
        linearImpulse = addVector3(linearImpulse, normalImpulse);
        const normalAngularImpulse = crossVector3(contact.arm, normalImpulse);
        angularImpulse = addVector3(angularImpulse, normalAngularImpulse);
        contact.normalImpulseNs += normalImpulseMagnitude;
        contact.restitutionImpulseNs += restitutionDelta
          / normalDenominator;

        const postNormalVelocity = addVector3(
          workingState.velocity,
          crossVector3(workingState.angularVelocityWorld, contact.arm)
        );
        const tangentVelocity = addVector3(
          postNormalVelocity,
          scaleVector3(contact.normal, -dot(postNormalVelocity, contact.normal))
        );
        const tangentSpeed = length(tangentVelocity);
        if (tangentSpeed <= EPSILON) return;
        const tangent = scaleVector3(tangentVelocity, 1 / tangentSpeed);
        const tangentDenominator = Math.max(EPSILON, effectiveMassDenominator(
          tangent,
          contact.arm,
          config,
          workingState.orientation
        ));
        const requestedFrictionImpulse = tangentSpeed / tangentDenominator;
        const frictionImpulseMagnitude = Math.min(
          requestedFrictionImpulse,
          contact.friction * normalImpulseMagnitude
        );
        const frictionImpulse = scaleVector3(tangent, -frictionImpulseMagnitude);
        applyImpulse(workingState, frictionImpulse, contact.arm, config);
        linearImpulse = addVector3(linearImpulse, frictionImpulse);
        angularImpulse = addVector3(angularImpulse, crossVector3(contact.arm, frictionImpulse));
        contact.tangentialImpulseNs += frictionImpulseMagnitude;
      });
    }
    // Split-impulse stabilization operates on pose only. Solving its angular
    // component is essential on a convex rise: rotating the chassis onto its
    // tire/body support manifold avoids a large vertical translation while
    // adding no velocity or rebound energy.
    const maximumPositionalCorrectionM = clamp(
      Number(config.bodyCollisionMaximumPositionalCorrectionM ?? 0.25),
      0.06,
      0.25
    );
    let splitPositionalCorrection = { x: 0, y: 0, z: 0 };
    let splitAngularCorrection = { x: 0, y: 0, z: 0 };
    const maximumSplitTranslationM = maximumPositionalCorrectionM;
    const maximumSplitRotationRad = 0.35;
    for (let iteration = 0; iteration < 6; iteration += 1) {
      let corrected = false;
      contacts.forEach((contact) => {
        // Swept wheel-cylinder contacts are velocity constraints at a physical
        // tire/terrain feature. Giving them the body's split-impulse lift
        // would manufacture a climbing force; normal and friction impulses
        // alone carry their response until ordinary tread support takes over.
        if (contact.contactType === 'wheel-leading-tread'
          || contact.contactType === 'wheel-sidewall') return;
        const arm = contact.localPoint
          ? rotateVectorByQuaternion(contact.localPoint, workingState.orientation)
          : contact.arm;
        const pointWorld = addVector3(workingState.position, arm);
        const terrain = createSurfaceSample(
          typeof sampleTerrain === 'function' ? sampleTerrain(pointWorld) : null,
          { queryPosition: pointWorld, source: 'body-split-impulse-query' }
        );
        if (!terrain.valid) return;
        const normal = terrain.normal;
        const surfacePoint = { x: pointWorld.x, y: terrain.heightM, z: pointWorld.z };
        const penetrationM = -dot(
          addVector3(pointWorld, scaleVector3(surfacePoint, -1)), normal
        );
        if (!(penetrationM > toleranceM)) return;
        const denominator = Math.max(EPSILON, effectiveMassDenominator(
          normal, arm, config, workingState.orientation
        ));
        const pseudoImpulseMagnitude = (penetrationM - toleranceM) / denominator * 0.72;
        const pseudoImpulse = scaleVector3(normal, pseudoImpulseMagnitude);
        let linearCorrection = scaleVector3(pseudoImpulse, 1 / Math.max(1, config.massKg));
        const remainingTranslationM = Math.max(
          0,
          maximumSplitTranslationM - length(splitPositionalCorrection)
        );
        const linearLength = length(linearCorrection);
        if (linearLength > remainingTranslationM && linearLength > EPSILON) {
          linearCorrection = scaleVector3(linearCorrection, remainingTranslationM / linearLength);
        }
        let angularCorrection = inverseInertiaWorldMultiply(
          crossVector3(arm, pseudoImpulse),
          workingState.orientation,
          config.inertiaTensorBodyKgM2
        );
        const remainingRotationRad = Math.max(
          0,
          maximumSplitRotationRad - length(splitAngularCorrection)
        );
        const angularLength = length(angularCorrection);
        if (angularLength > remainingRotationRad && angularLength > EPSILON) {
          angularCorrection = scaleVector3(
            angularCorrection, remainingRotationRad / angularLength
          );
        }
        workingState.position = addVector3(workingState.position, linearCorrection);
        workingState.orientation = integrateQuaternion(
          workingState.orientation,
          angularCorrection,
          1
        );
        splitPositionalCorrection = addVector3(
          splitPositionalCorrection, linearCorrection
        );
        splitAngularCorrection = addVector3(splitAngularCorrection, angularCorrection);
        corrected = true;
      });
      if (!corrected) break;
    }
    const postSplitPenetration = this.samplePosePenetration(
      workingState, environment, toleranceM
    );
    const correction = Number(postSplitPenetration.maximumPenetrationM) > toleranceM
      && postSplitPenetration.deepestNormal
      ? scaleVector3(
          postSplitPenetration.deepestNormal,
          Number(postSplitPenetration.maximumPenetrationM) - toleranceM
        )
      : { x: 0, y: 0, z: 0 };
    const correctionLength = length(correction);
    const remainingDirectCorrectionM = Math.max(
      0,
      maximumPositionalCorrectionM - length(splitPositionalCorrection)
    );
    const boundedCorrection = correctionLength > remainingDirectCorrectionM
      ? scaleVector3(correction, remainingDirectCorrectionM / Math.max(EPSILON, correctionLength))
      : correction;
    workingState.position = addVector3(workingState.position, boundedCorrection);
    const remainingDt = sweep ? Math.max(0, dt * (1 - sweep.fraction)) : 0;
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
    let finalCorrection = { x: 0, y: 0, z: 0 };
    let remainingCorrectionBudgetM = Math.max(
      0,
      maximumPositionalCorrectionM
        - length(splitPositionalCorrection)
        - length(boundedCorrection)
    );
    for (let iteration = 0; iteration < 4 && remainingCorrectionBudgetM > EPSILON; iteration += 1) {
      const finalPenetration = this.samplePosePenetration(workingState, environment, toleranceM);
      if (!(Number(finalPenetration.maximumPenetrationM) > toleranceM)
        || !finalPenetration.deepestNormal) break;
      const requested = scaleVector3(
        finalPenetration.deepestNormal,
        Number(finalPenetration.maximumPenetrationM) - toleranceM
      );
      const requestedLength = length(requested);
      const applied = requestedLength > remainingCorrectionBudgetM
        ? scaleVector3(requested, remainingCorrectionBudgetM / requestedLength)
        : requested;
      workingState.position = addVector3(workingState.position, applied);
      finalCorrection = addVector3(finalCorrection, applied);
      remainingCorrectionBudgetM -= length(applied);
    }
    let totalPositionalCorrection = addVector3(
      splitPositionalCorrection,
      addVector3(boundedCorrection, finalCorrection)
    );
    let safePoseRollbackFraction = null;
    let residualPenetration = this.samplePosePenetration(workingState, environment, toleranceM);
    if (Number(residualPenetration.maximumPenetrationM) > toleranceM
      && previousWorkingState) {
      const previousPenetration = this.samplePosePenetration(
        previousWorkingState, environment, toleranceM
      );
      if (!(Number(previousPenetration.maximumPenetrationM) > toleranceM)) {
        const penetratedPose = this.createWorkingState(workingState);
        let low = 0;
        let high = 1;
        for (let iteration = 0; iteration < 14; iteration += 1) {
          const middle = (low + high) * 0.5;
          const pose = {
            position: mixVector(previousWorkingState.position, penetratedPose.position, middle),
            orientation: mixQuaternion(
              previousWorkingState.orientation, penetratedPose.orientation, middle
            )
          };
          const sample = this.samplePosePenetration(pose, environment, toleranceM);
          if (Number(sample.maximumPenetrationM) > toleranceM) high = middle;
          else low = middle;
        }
        const safePose = {
          position: mixVector(previousWorkingState.position, penetratedPose.position, low),
          orientation: mixQuaternion(
            previousWorkingState.orientation, penetratedPose.orientation, low
          )
        };
        const rollbackCorrection = addVector3(
          safePose.position, scaleVector3(workingState.position, -1)
        );
        workingState.position = safePose.position;
        workingState.orientation = safePose.orientation;
        totalPositionalCorrection = addVector3(totalPositionalCorrection, rollbackCorrection);
        safePoseRollbackFraction = low;
        residualPenetration = this.samplePosePenetration(
          workingState, environment, toleranceM
        );
      }
    }
    return {
      linearImpulseWorldNs: linearImpulse,
      angularImpulseWorldNms: angularImpulse,
      positionalCorrectionWorldM: totalPositionalCorrection,
      bodyNormalImpulseNs: contacts.reduce((sum, contact) => sum + contact.normalImpulseNs, 0),
      bodyFrictionImpulseNs: contacts.reduce((sum, contact) => sum + contact.tangentialImpulseNs, 0),
      wheelCylinderNormalImpulseNs: contacts.filter(({ contactType }) => (
        String(contactType).startsWith('wheel-')
      )).reduce((sum, contact) => sum + contact.normalImpulseNs, 0),
      wheelCylinderFrictionImpulseNs: contacts.filter(({ contactType }) => (
        String(contactType).startsWith('wheel-')
      )).reduce((sum, contact) => sum + contact.tangentialImpulseNs, 0),
      restitutionContributionNs: contacts.reduce((sum, contact) => sum + contact.restitutionImpulseNs, 0),
      penetrationBiasContributionNs: 0,
      maximumPositionalCorrectionM,
      positionalAngularCorrectionWorldRad: splitAngularCorrection,
      initialUnsupportedMaximumPenetrationM,
      initialUnsupportedAllBodySamplesBelowTerrain,
      swept: Boolean(sweep),
      sweepSource,
      wheelCylinderSweep: wheelCylinderSweep ? {
        fraction: wheelCylinderSweep.fraction,
        activeWheelIds: [...wheelCylinderSweep.activeWheelIds],
        terrainTriangleIds: [...wheelCylinderSweep.terrainTriangleIds],
        contacts: wheelCylinderSweep.contacts.map((contact) => ({
          id: contact.id,
          wheelId: contact.wheelId,
          contactType: contact.contactType,
          poweredTreadContact: contact.poweredTreadContact,
          triangleId: contact.triangleId,
          terrainSource: contact.terrainSource,
          widthFraction: contact.widthFraction,
          partialWidth: contact.partialWidth,
          sweepFraction: contact.sweepFraction,
          mechanism: contact.mechanism
        }))
      } : null,
      timeOfImpactFraction: sweep?.fraction ?? null,
      maximumPenetrationM: contacts.reduce((maximum, contact) => (
        Math.max(maximum, Number(contact.penetrationM || 0))
      ), 0),
      residualPenetrationM: residualPenetration.maximumPenetrationM,
      safePoseRollbackFraction,
      supportPoints: environment.capturePhysicsIncidentDiagnostics === true
        ? candidateWorld.map(({ candidate, worldPoint }) => ({
            id: candidate.id,
            pieceId: candidate.pieceId || null,
            wheelId: candidate.wheelId || null,
            contactType: candidate.contactType || 'body',
            worldPoint: { ...worldPoint }
          }))
        : [],
      contacts
    };
  }
}

export default ChassisBodyCollision;
