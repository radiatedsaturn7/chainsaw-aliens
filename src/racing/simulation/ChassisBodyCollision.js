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
import { StaticColliderCollision } from './StaticRaceColliderWorld.js';

const EPSILON = 1e-9;
const terrainSampleContract = (raw, queryPosition, source) => {
  if (raw?.physicsTerrainQueryFrameSample === true) return raw;
  return createSurfaceSample(raw, { queryPosition, source });
};
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

function mixPoseInto(previousState = {}, proposedState = {}, fraction = 0, target = {}) {
  const previousPosition = previousState.position || {};
  const proposedPosition = proposedState.position || {};
  const position = target.position;
  position.x = Number(previousPosition.x || 0)
    + (Number(proposedPosition.x || 0) - Number(previousPosition.x || 0)) * fraction;
  position.y = Number(previousPosition.y || 0)
    + (Number(proposedPosition.y || 0) - Number(previousPosition.y || 0)) * fraction;
  position.z = Number(previousPosition.z || 0)
    + (Number(proposedPosition.z || 0) - Number(previousPosition.z || 0)) * fraction;
  const previousOrientation = previousState.orientation || {};
  const proposedOrientation = proposedState.orientation || {};
  const ax = Number(previousOrientation.x || 0);
  const ay = Number(previousOrientation.y || 0);
  const az = Number(previousOrientation.z || 0);
  const aw = Number(previousOrientation.w ?? 1);
  const bx = Number(proposedOrientation.x || 0);
  const by = Number(proposedOrientation.y || 0);
  const bz = Number(proposedOrientation.z || 0);
  const bw = Number(proposedOrientation.w ?? 1);
  const sign = ax * bx + ay * by + az * bz + aw * bw < 0 ? -1 : 1;
  const orientation = target.orientation;
  orientation.x = ax + (bx * sign - ax) * fraction;
  orientation.y = ay + (by * sign - ay) * fraction;
  orientation.z = az + (bz * sign - az) * fraction;
  orientation.w = aw + (bw * sign - aw) * fraction;
  const magnitude = Math.hypot(
    orientation.x,
    orientation.y,
    orientation.z,
    orientation.w
  ) || 1;
  orientation.x /= magnitude;
  orientation.y /= magnitude;
  orientation.z /= magnitude;
  orientation.w /= magnitude;
  return target;
}

function rotateVectorInto(vector = {}, quaternion = {}, target = {}) {
  const vx = Number(vector.x || 0);
  const vy = Number(vector.y || 0);
  const vz = Number(vector.z || 0);
  const qx = Number(quaternion.x || 0);
  const qy = Number(quaternion.y || 0);
  const qz = Number(quaternion.z || 0);
  const qw = Number(quaternion.w ?? 1);
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  target.x = vx + qw * tx + (qy * tz - qz * ty);
  target.y = vy + qw * ty + (qz * tx - qx * tz);
  target.z = vz + qw * tz + (qx * ty - qy * tx);
  return target;
}

function integerPairKey(first, second) {
  const encodedFirst = first >= 0 ? first * 2 : -first * 2 - 1;
  const encodedSecond = second >= 0 ? second * 2 : -second * 2 - 1;
  const sum = encodedFirst + encodedSecond;
  return sum * (sum + 1) * 0.5 + encodedSecond;
}

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
    this.staticColliderCollision = new StaticColliderCollision({ candidates: this.candidates });
    this.supportEnvelopeBucketM = clamp(
      Number(config.bodyCollisionSupportSpacingM || 0.55) * 0.5,
      0.1,
      0.4
    );
    this.supportCandidateCache = new Map();
    this.penetrationCacheCapacity = 64;
    this.penetrationCacheFrameSequence = -1;
    this.penetrationCacheKeys = new Float64Array(this.penetrationCacheCapacity * 8);
    this.penetrationCacheValues = new Array(this.penetrationCacheCapacity).fill(null);
    this.broadphaseLocalScratch = { x: 0, y: 0, z: 0 };
    this.broadphaseArmScratch = { x: 0, y: 0, z: 0 };
    this.broadphaseBoundsScratch = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    this.lowerHullVariationReference = {
      point: { x: 0, y: 0, z: 0 },
      heightM: 0,
      normal: { x: 0, y: 1, z: 0 }
    };
    this.lowerHullVariationOptions = {
      heightToleranceM: 0.025,
      normalToleranceRad: 8 * Math.PI / 180
    };
    this.sweepPoseScratch = {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    };
    this.adaptivePieceBuckets = new Map();
    this.adaptiveBucketArrayPool = [];
    const minimumLocalY = this.candidates.reduce((minimum, candidate) => (
      Math.min(minimum, Number(candidate.localPoint?.y ?? Infinity))
    ), Infinity);
    const lowerFacing = this.candidates.filter((candidate) => (
      Number(candidate.localPoint?.y ?? Infinity) <= minimumLocalY + 0.03
      || candidate.localNormals?.some((normal) => Number(normal.y || 0) < -0.5)
    ));
    const lowerBuckets = new Map();
    const lowerSpacingM = Math.max(0.45, this.supportEnvelopeBucketM * 3);
    lowerFacing.forEach((candidate) => {
      const point = candidate.localPoint || {};
      const key = `${Math.round(Number(point.x || 0) / lowerSpacingM)}:${Math.round(
        Number(point.z || 0) / lowerSpacingM
      )}`;
      const existing = lowerBuckets.get(key);
      if (!existing || Number(point.y || 0) < Number(existing.localPoint?.y || 0)
        || (Number(point.y || 0) === Number(existing.localPoint?.y || 0)
          && String(candidate.id) < String(existing.id))) {
        lowerBuckets.set(key, candidate);
      }
    });
    this.lowerHullCandidates = Object.freeze([...lowerBuckets.values()].sort((left, right) => (
      String(left.id).localeCompare(String(right.id))
    )));
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

  getAdaptiveSupportWorldUnprofiled(pose, environment = {}, target = null) {
    const precomputedCandidates = environment.precomputedAdaptiveBodySupportCandidates;
    const sourceCandidates = Array.isArray(precomputedCandidates)
      ? precomputedCandidates : this.getSupportCandidates(pose);
    const targetBuffer = target && !Array.isArray(target) ? target : null;
    const base = targetBuffer?.entries || target || [];
    const spareEntries = targetBuffer?.spareEntries || null;
    if (spareEntries) {
      while (base.length > sourceCandidates.length) spareEntries.push(base.pop());
    } else {
      base.length = sourceCandidates.length;
    }
    for (let index = 0; index < sourceCandidates.length; index += 1) {
      const candidate = sourceCandidates[index];
      let entry = base[index] || spareEntries?.pop();
      if (!entry) {
        entry = {
          candidate: null,
          arm: { x: 0, y: 0, z: 0 },
          worldPoint: { x: 0, y: 0, z: 0 }
        };
        if (target) {
          environment.physicsCostAccounting?.count('temporaryObjects', 3);
          environment.physicsCostAccounting?.count('bodySupportEntryAllocations');
        }
      }
      entry.candidate = candidate;
      rotateVectorInto(candidate.localPoint, pose.orientation, entry.arm);
      entry.worldPoint.x = Number(pose.position?.x || 0) + entry.arm.x;
      entry.worldPoint.y = Number(pose.position?.y || 0) + entry.arm.y;
      entry.worldPoint.z = Number(pose.position?.z || 0) + entry.arm.z;
      base[index] = entry;
    }
    if (Array.isArray(precomputedCandidates)) return base;
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
      if (!sampled.has(point)) sampled.set(point, createSurfaceSample(sampleTerrain(point), {
        queryPosition: point,
        source: 'body-adaptive-support'
      }));
      return sampled.get(point);
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
    for (const pieceBuckets of this.adaptivePieceBuckets.values()) pieceBuckets.clear();
    let bucketArrayCount = 0;
    for (let index = 0; index < base.length; index += 1) {
      const entry = base[index];
      const pieceId = entry.candidate.pieceId;
      let pieceBuckets = this.adaptivePieceBuckets.get(pieceId);
      if (!pieceBuckets) {
        pieceBuckets = new Map();
        this.adaptivePieceBuckets.set(pieceId, pieceBuckets);
      }
      const bucketX = Math.floor(entry.worldPoint.x / neighborLimitM);
      const bucketZ = Math.floor(entry.worldPoint.z / neighborLimitM);
      const key = integerPairKey(bucketX, bucketZ);
      let bucket = pieceBuckets.get(key);
      if (!bucket) {
        bucket = this.adaptiveBucketArrayPool[bucketArrayCount] || [];
        this.adaptiveBucketArrayPool[bucketArrayCount] = bucket;
        bucketArrayCount += 1;
        bucket.length = 0;
        pieceBuckets.set(key, bucket);
      }
      bucket.push(index);
    }
    for (let first = 0; first < base.length; first += 1) {
      const entry = base[first];
      const bucketX = Math.floor(entry.worldPoint.x / neighborLimitM);
      const bucketZ = Math.floor(entry.worldPoint.z / neighborLimitM);
      const pieceBuckets = this.adaptivePieceBuckets.get(entry.candidate.pieceId);
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          const bucket = pieceBuckets?.get(integerPairKey(
            bucketX + offsetX,
            bucketZ + offsetZ
          ));
          if (!bucket) continue;
          for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex += 1) {
            const second = bucket[bucketIndex];
            if (second <= first) continue;
            const secondPoint = base[second].worldPoint;
            if (Math.hypot(
              Number(secondPoint.x || 0) - Number(entry.worldPoint.x || 0),
              Number(secondPoint.y || 0) - Number(entry.worldPoint.y || 0),
              Number(secondPoint.z || 0) - Number(entry.worldPoint.z || 0)
            ) <= neighborLimitM) {
              subdivide(entry, base[second], 0);
            }
          }
        }
      }
    }
    return base.concat(additions);
  }

  getLowerHullSupportWorldUnprofiled(pose, environment = {}, target = null) {
    const targetBuffer = target && !Array.isArray(target) ? target : null;
    const base = targetBuffer?.entries || target || [];
    const spareEntries = targetBuffer?.spareEntries || null;
    if (spareEntries) {
      while (base.length > this.lowerHullCandidates.length) spareEntries.push(base.pop());
    } else {
      base.length = this.lowerHullCandidates.length;
    }
    for (let index = 0; index < this.lowerHullCandidates.length; index += 1) {
      const candidate = this.lowerHullCandidates[index];
      let entry = base[index] || spareEntries?.pop();
      if (!entry) {
        entry = {
          candidate: null,
          arm: { x: 0, y: 0, z: 0 },
          worldPoint: { x: 0, y: 0, z: 0 }
        };
        if (target) {
          environment.physicsCostAccounting?.count('temporaryObjects', 3);
          environment.physicsCostAccounting?.count('bodyLowerHullEntryAllocations');
        }
      }
      entry.candidate = candidate;
      rotateVectorInto(candidate.localPoint, pose.orientation, entry.arm);
      entry.worldPoint.x = Number(pose.position?.x || 0) + entry.arm.x;
      entry.worldPoint.y = Number(pose.position?.y || 0) + entry.arm.y;
      entry.worldPoint.z = Number(pose.position?.z || 0) + entry.arm.z;
      base[index] = entry;
    }
    return base;
  }

  sampleLowerHullMaximumPenetrationM(pose, environment = {}) {
    const queryFrame = environment.physicsTerrainQueryFrame;
    const sampleTerrain = environment.sampleTerrainAtWorldPoint;
    const supportBuffer = queryFrame?.acquireBodySupportBuffer?.() || null;
    const support = this.getLowerHullSupportWorldUnprofiled(
      pose,
      environment,
      supportBuffer
    );
    const terrainBatch = typeof queryFrame?.sampleSupportEntries === 'function'
      ? queryFrame.sampleSupportEntries(support)
      : null;
    let maximumPenetrationM = -Infinity;
    for (let index = 0; index < support.length; index += 1) {
      const point = support[index].worldPoint;
      const raw = terrainBatch?.[index]
        || (typeof sampleTerrain === 'function' ? sampleTerrain(point) : null);
      const heightM = Number(raw?.heightM);
      if (raw?.valid === false || !Number.isFinite(heightM)) {
        queryFrame?.releaseBodySupportBuffer?.(supportBuffer);
        return null;
      }
      const normalY = Math.max(0.05, Number(raw?.normal?.y ?? raw?.normalWorld?.y ?? 1));
      maximumPenetrationM = Math.max(
        maximumPenetrationM,
        (heightM - Number(point.y || 0)) * normalY
      );
    }
    queryFrame?.releaseBodySupportBuffer?.(supportBuffer);
    return maximumPenetrationM;
  }

  prepareAdaptiveSupportCandidates(previousPose, proposedPose, environment = {}) {
    if (environment.adaptiveBodySupport !== true
      && environment.terrainHasDiscontinuities !== true) return null;
    // Avoid cloning the full contact environment inside the 360 Hz path. The
    // adaptive-support override is the only property that differs here.
    const buildEnvironment = Object.create(environment);
    buildEnvironment.precomputedAdaptiveBodySupportCandidates = null;
    const previous = previousPose
      ? this.getAdaptiveSupportWorldUnprofiled(previousPose, buildEnvironment) : [];
    const proposed = this.getAdaptiveSupportWorldUnprofiled(proposedPose, buildEnvironment);
    const candidates = [];
    const keys = new Set();
    previous.concat(proposed).forEach(({ candidate }) => {
      const local = candidate.localPoint || {};
      const key = `${candidate.id}:${Number(local.x || 0).toFixed(6)}:${Number(local.y || 0).toFixed(6)}:${Number(local.z || 0).toFixed(6)}`;
      if (keys.has(key)) return;
      keys.add(key);
      candidates.push(candidate);
    });
    environment.precomputedAdaptiveBodySupportCandidates = candidates;
    return candidates;
  }

  getAdaptiveSupportWorld(pose, environment = {}) {
    const physicsCosts = environment.physicsCostAccounting;
    const queryFrame = environment.physicsTerrainQueryFrame;
    const collect = () => {
      const result = this.getAdaptiveSupportWorldUnprofiled(pose, environment);
      physicsCosts?.count('bodySupportFeatures', result.length);
      physicsCosts?.count('adaptiveBodySupportFeatures', result.filter(
        ({ candidate }) => candidate?.adaptive === true
      ).length);
      physicsCosts?.count('temporaryObjects', result.length);
      return result;
    };
    return physicsCosts
      ? physicsCosts.measure('bodySupportGeneration', collect)
      : collect();
  }

  samplePosePenetrationUnprofiled(pose, environment, toleranceM) {
    const sampleTerrain = environment.sampleTerrainAtWorldPoint;
    const sampleTerrainBatch = environment.sampleTerrainAtWorldPoints;
    const queryFrame = environment.physicsTerrainQueryFrame;
    const supportBuffer = queryFrame?.acquireBodySupportBuffer?.() || null;
    const points = supportBuffer
      ? this.getAdaptiveSupportWorldUnprofiled(pose, environment, supportBuffer)
      : this.getAdaptiveSupportWorld(pose, environment);
    if (supportBuffer) {
      environment.physicsCostAccounting?.count('bodySupportFeatures', points.length);
      let adaptiveCount = 0;
      for (let index = 0; index < points.length; index += 1) {
        if (points[index].candidate?.adaptive === true) adaptiveCount += 1;
      }
      environment.physicsCostAccounting?.count('adaptiveBodySupportFeatures', adaptiveCount);
    }
    const terrainBatch = typeof queryFrame?.sampleSupportEntries === 'function'
      ? queryFrame.sampleSupportEntries(points)
      : typeof sampleTerrainBatch === 'function'
        ? sampleTerrainBatch(points.map(({ worldPoint }) => worldPoint))
        : null;
    let maximumPenetrationM = -Infinity;
    let minimumPenetrationM = Infinity;
    let deepestNormalX = 0;
    let deepestNormalY = 1;
    let deepestNormalZ = 0;
    let hasDeepestNormal = false;
    let invalidTerrainSampleCount = 0;
    let belowTerrainSampleCount = 0;
    let validLowerBodySupportSampleCount = 0;
    let submergedLowerBodySupportSampleCount = 0;
    let minimumLowerBodySupportPenetrationM = Infinity;
    let terrainTriangleIds = null;
    let terrainSources = null;
    let terrainRegions = null;
    let penetratingFeatureIds = null;
    let minimumLocalSupportY = Infinity;
    for (let index = 0; index < points.length; index += 1) {
      minimumLocalSupportY = Math.min(
        minimumLocalSupportY,
        Number(points[index].candidate?.localPoint?.y ?? Infinity)
      );
    }
    for (let index = 0; index < points.length; index += 1) {
      const { candidate, worldPoint } = points[index];
      let downwardFacing = false;
      const localNormals = candidate?.localNormals || [];
      for (let normalIndex = 0; normalIndex < localNormals.length; normalIndex += 1) {
        if (Number(localNormals[normalIndex].y || 0) < -0.5) {
          downwardFacing = true;
          break;
        }
      }
      const lowerBodySupportFeature = Number(candidate?.localPoint?.y ?? Infinity)
          <= minimumLocalSupportY + 1e-6
        && downwardFacing;
      const rawTerrain = terrainBatch?.[index]
        || (typeof sampleTerrain === 'function' ? sampleTerrain(worldPoint) : null)
        || {};
      const terrain = terrainSampleContract(
        rawTerrain, worldPoint, 'body-penetration-query'
      );
      if (!terrain.valid) {
        invalidTerrainSampleCount += 1;
        continue;
      }
      const heightM = terrain.heightM;
      const rawNormal = terrain.normal || terrain.normalWorld || {};
      const normalMagnitude = Math.hypot(
        Number(rawNormal.x || 0),
        Number(rawNormal.y || 0),
        Number(rawNormal.z || 0)
      );
      const inverseNormalMagnitude = normalMagnitude > EPSILON ? 1 / normalMagnitude : 1;
      const normalX = normalMagnitude > EPSILON
        ? Number(rawNormal.x || 0) * inverseNormalMagnitude : 0;
      const normalY = normalMagnitude > EPSILON
        ? Number(rawNormal.y || 0) * inverseNormalMagnitude : 1;
      const normalZ = normalMagnitude > EPSILON
        ? Number(rawNormal.z || 0) * inverseNormalMagnitude : 0;
      const penetrationM = (heightM - worldPoint.y) * normalY;
      if (penetrationM > maximumPenetrationM) {
        maximumPenetrationM = penetrationM;
        deepestNormalX = normalX;
        deepestNormalY = normalY;
        deepestNormalZ = normalZ;
        hasDeepestNormal = true;
      }
      minimumPenetrationM = Math.min(minimumPenetrationM, penetrationM);
      if (lowerBodySupportFeature) {
        validLowerBodySupportSampleCount += 1;
        minimumLowerBodySupportPenetrationM = Math.min(
          minimumLowerBodySupportPenetrationM,
          penetrationM
        );
        if (penetrationM > toleranceM) submergedLowerBodySupportSampleCount += 1;
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
    }
    const result = {
      maximumPenetrationM: Number.isFinite(maximumPenetrationM) ? maximumPenetrationM : null,
      minimumPenetrationM: Number.isFinite(minimumPenetrationM) ? minimumPenetrationM : null,
      deepestNormal: hasDeepestNormal
        ? { x: deepestNormalX, y: deepestNormalY, z: deepestNormalZ }
        : null,
      invalidTerrainSampleCount,
      validTerrainSampleCount: points.length - invalidTerrainSampleCount,
      belowTerrainSampleCount,
      validLowerBodySupportSampleCount,
      submergedLowerBodySupportSampleCount,
      minimumLowerBodySupportPenetrationM: Number.isFinite(
        minimumLowerBodySupportPenetrationM
      ) ? minimumLowerBodySupportPenetrationM : null,
      allLowerBodySupportFeaturesBelowTerrain: validLowerBodySupportSampleCount > 0
        && submergedLowerBodySupportSampleCount === validLowerBodySupportSampleCount,
      terrainTriangleIds: terrainTriangleIds ? [...terrainTriangleIds].sort() : [],
      terrainSources: terrainSources ? [...terrainSources].sort() : [],
      terrainRegions: terrainRegions ? [...terrainRegions].sort() : [],
      penetratingFeatureIds: penetratingFeatureIds ? [...penetratingFeatureIds].sort() : [],
      allBodySamplesBelowTerrain: belowTerrainSampleCount > 0
        && belowTerrainSampleCount === points.length - invalidTerrainSampleCount,
      allTerrainSamplesInvalid: invalidTerrainSampleCount === points.length
    };
    queryFrame?.releaseBodySupportBuffer?.(supportBuffer);
    return result;
  }

  samplePosePenetration(pose, environment, toleranceM) {
    const physicsCosts = environment.physicsCostAccounting;
    const queryFrame = environment.physicsTerrainQueryFrame;
    // Without a query frame there is no prepared-world revision identity with
    // which to validate a cached terrain result. Preserve the exact legacy
    // query behavior instead of allowing results to leak between substeps.
    if (!queryFrame) {
      return physicsCosts
        ? physicsCosts.measure('penetrationValidation', () => (
            this.samplePosePenetrationUnprofiled(pose, environment, toleranceM)
          ))
        : this.samplePosePenetrationUnprofiled(pose, environment, toleranceM);
    }
    const frameSequence = Number(queryFrame.sequence);
    if (frameSequence !== this.penetrationCacheFrameSequence) {
      this.penetrationCacheFrameSequence = frameSequence;
      this.penetrationCacheValues.fill(null);
    }
    const position = pose?.position || {};
    const orientation = pose?.orientation || {};
    const positionX = Number(position.x || 0);
    const positionY = Number(position.y || 0);
    const positionZ = Number(position.z || 0);
    const orientationX = Number(orientation.x || 0);
    const orientationY = Number(orientation.y || 0);
    const orientationZ = Number(orientation.z || 0);
    const orientationW = Number(orientation.w ?? 1);
    const tolerance = Number(toleranceM || 0);
    let hash = 0;
    hash ^= Math.imul(Math.round(positionX * 1e6) | 0, 2654435761);
    hash ^= Math.imul(Math.round(positionY * 1e6) | 0, 2654435761 + 97);
    hash ^= Math.imul(Math.round(positionZ * 1e6) | 0, 2654435761 + 2 * 97);
    hash ^= Math.imul(Math.round(orientationX * 1e6) | 0, 2654435761 + 3 * 97);
    hash ^= Math.imul(Math.round(orientationY * 1e6) | 0, 2654435761 + 4 * 97);
    hash ^= Math.imul(Math.round(orientationZ * 1e6) | 0, 2654435761 + 5 * 97);
    hash ^= Math.imul(Math.round(orientationW * 1e6) | 0, 2654435761 + 6 * 97);
    hash ^= Math.imul(Math.round(tolerance * 1e6) | 0, 2654435761 + 7 * 97);
    const slot = hash & (this.penetrationCacheCapacity - 1);
    const offset = slot * 8;
    const cached = this.penetrationCacheValues[slot];
    const matches = cached !== null
      && this.penetrationCacheKeys[offset] === positionX
      && this.penetrationCacheKeys[offset + 1] === positionY
      && this.penetrationCacheKeys[offset + 2] === positionZ
      && this.penetrationCacheKeys[offset + 3] === orientationX
      && this.penetrationCacheKeys[offset + 4] === orientationY
      && this.penetrationCacheKeys[offset + 5] === orientationZ
      && this.penetrationCacheKeys[offset + 6] === orientationW
      && this.penetrationCacheKeys[offset + 7] === tolerance;
    if (matches) {
      physicsCosts?.count('penetrationValidationCacheHits');
      return cached;
    }
    const sample = physicsCosts
      ? physicsCosts.measure('penetrationValidation', () => (
          this.samplePosePenetrationUnprofiled(pose, environment, toleranceM)
        ))
      : this.samplePosePenetrationUnprofiled(pose, environment, toleranceM);
    this.penetrationCacheKeys[offset] = positionX;
    this.penetrationCacheKeys[offset + 1] = positionY;
    this.penetrationCacheKeys[offset + 2] = positionZ;
    this.penetrationCacheKeys[offset + 3] = orientationX;
    this.penetrationCacheKeys[offset + 4] = orientationY;
    this.penetrationCacheKeys[offset + 5] = orientationZ;
    this.penetrationCacheKeys[offset + 6] = orientationW;
    this.penetrationCacheKeys[offset + 7] = tolerance;
    this.penetrationCacheValues[slot] = sample;
    return sample;
  }

  findSweepImpactUnprofiled(previousState, proposedState, environment, toleranceM, config) {
    if (!previousState) return null;
    const translationM = Math.hypot(
      Number(proposedState.position?.x || 0) - Number(previousState.position?.x || 0),
      Number(proposedState.position?.y || 0) - Number(previousState.position?.y || 0),
      Number(proposedState.position?.z || 0) - Number(previousState.position?.z || 0)
    );
    const angularSpeed = length(previousState.angularVelocityWorld);
    const bodyRadiusM = Math.hypot(
      Number(config.bodyLengthM || 4.5) * 0.5,
      Number(config.bodyWidthM || 1.8) * 0.5,
      Number(config.bodyHeightM || 1.45)
    );
    const slices = clamp(Math.ceil((translationM + angularSpeed * bodyRadiusM
      * Math.max(0, Number(config.__collisionSubstepDt || 0))) / 0.02), 1, 128);
    environment.physicsCostAccounting?.count('bodySweepSlices', slices);
    const useLowerHullSweep = config.__useLowerHullSweep === true;
    const sampleAt = (fraction) => {
      const pose = mixPoseInto(
        previousState,
        proposedState,
        fraction,
        this.sweepPoseScratch
      );
      if (!useLowerHullSweep) return this.samplePosePenetration(pose, environment, toleranceM);
      return {
        maximumPenetrationM: this.sampleLowerHullMaximumPenetrationM(pose, environment)
      };
    };
    let previousFraction = 0;
    let previousSample = sampleAt(0);
    for (let slice = 1; slice <= slices; slice += 1) {
      const fraction = slice / slices;
      const sample = sampleAt(fraction);
      if (sample.maximumPenetrationM !== null
        && sample.maximumPenetrationM > toleranceM
        && (previousSample.maximumPenetrationM === null
          || previousSample.maximumPenetrationM <= toleranceM)) {
        let low = previousFraction;
        let high = fraction;
        for (let iteration = 0; iteration < 10; iteration += 1) {
          environment.physicsCostAccounting?.count('binarySearchIterations');
          const middle = (low + high) * 0.5;
          const middleSample = sampleAt(middle);
          if (middleSample.maximumPenetrationM !== null
            && middleSample.maximumPenetrationM > toleranceM) high = middle;
          else low = middle;
        }
        const impactFraction = Math.min(1, high + 1e-5);
        const impactPose = {
          position: mixVector(
            previousState.position,
            proposedState.position,
            impactFraction
          ),
          orientation: mixQuaternion(
            previousState.orientation,
            proposedState.orientation,
            impactFraction
          )
        };
        const impactSample = useLowerHullSweep
          ? this.samplePosePenetration(impactPose, environment, toleranceM) : sample;
        if (Number(impactSample.maximumPenetrationM) > toleranceM) {
          return { fraction: impactFraction, pose: impactPose, sample: impactSample };
        }
      }
      previousFraction = fraction;
      previousSample = sample;
    }
    return null;
  }

  findSweepImpact(previousState, proposedState, environment, toleranceM, config) {
    const physicsCosts = environment.physicsCostAccounting;
    return physicsCosts
      ? physicsCosts.measure('bodyContinuousSweep', () => (
          this.findSweepImpactUnprofiled(
            previousState, proposedState, environment, toleranceM, config
          )
        ))
      : this.findSweepImpactUnprofiled(
          previousState, proposedState, environment, toleranceM, config
        );
  }

  stepTerrain({ workingState, previousWorkingState = null, config, environment = {}, dt = 0, advanceState = true }) {
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
    const physicsCosts = environment.physicsCostAccounting;
    const queryFrame = environment.physicsTerrainQueryFrame;
    const broadphaseTimer = physicsCosts?.start('bodyBroadphase');
    const toleranceM = Math.max(0.001, Number(config.bodyCollisionToleranceM || 0.008));
    const proposedState = this.createWorkingState(workingState);
    const profile = config.bodyProfile || {};
    const halfWidth = Number(profile.overallWidthM || config.bodyWidthM || 1.8) * 0.5;
    const halfLength = Number(profile.overallLengthM || config.bodyLengthM || 4.5) * 0.5;
    const bottom = Number(profile.groundClearanceM ?? config.bodyGroundClearanceM ?? 0.12)
      - Number(profile.cgPositionM?.y ?? config.cgHeightM ?? 0.55);
    const top = bottom + Number(profile.overallHeightM || config.bodyHeightM || 1.45);
    let endpointMinX = Infinity;
    let endpointMaxX = -Infinity;
    let endpointMinZ = Infinity;
    let endpointMaxZ = -Infinity;
    let endpointMinimumHeightM = Infinity;
    const endpointCount = previousWorkingState ? 2 : 1;
    for (let endpointIndex = 0; endpointIndex < endpointCount; endpointIndex += 1) {
      const pose = endpointIndex === 0 && previousWorkingState
        ? previousWorkingState : proposedState;
      for (let xSign = -1; xSign <= 1; xSign += 2) {
        for (let yIndex = 0; yIndex < 2; yIndex += 1) {
          for (let zSign = -1; zSign <= 1; zSign += 2) {
            this.broadphaseLocalScratch.x = xSign * halfWidth;
            this.broadphaseLocalScratch.y = yIndex === 0 ? bottom : top;
            this.broadphaseLocalScratch.z = zSign * halfLength;
            rotateVectorInto(
              this.broadphaseLocalScratch, pose.orientation, this.broadphaseArmScratch
            );
            const worldX = Number(pose.position?.x || 0) + this.broadphaseArmScratch.x;
            const worldY = Number(pose.position?.y || 0) + this.broadphaseArmScratch.y;
            const worldZ = Number(pose.position?.z || 0) + this.broadphaseArmScratch.z;
            endpointMinX = Math.min(endpointMinX, worldX);
            endpointMaxX = Math.max(endpointMaxX, worldX);
            endpointMinZ = Math.min(endpointMinZ, worldZ);
            endpointMaxZ = Math.max(endpointMaxZ, worldZ);
            endpointMinimumHeightM = Math.min(endpointMinimumHeightM, worldY);
          }
        }
      }
    }
    let knownMaximumTerrainHeightM = Number(environment.groundHeightM);
    if (!Number.isFinite(knownMaximumTerrainHeightM)) knownMaximumTerrainHeightM = null;
    const wheelSurfaceHeights = environment.surfaceHeightByWheel || {};
    for (const wheelId in wheelSurfaceHeights) {
      const heightM = Number(wheelSurfaceHeights[wheelId]);
      if (Number.isFinite(heightM)) {
        knownMaximumTerrainHeightM = knownMaximumTerrainHeightM === null
          ? heightM : Math.max(knownMaximumTerrainHeightM, heightM);
      }
    }
    if (typeof environment.sampleTerrainMaximumHeightInBounds === 'function') {
      this.broadphaseBoundsScratch.minX = endpointMinX;
      this.broadphaseBoundsScratch.maxX = endpointMaxX;
      this.broadphaseBoundsScratch.minZ = endpointMinZ;
      this.broadphaseBoundsScratch.maxZ = endpointMaxZ;
      const sampledMaximum = Number(environment.sampleTerrainMaximumHeightInBounds(
        this.broadphaseBoundsScratch
      ));
      if (Number.isFinite(sampledMaximum)) knownMaximumTerrainHeightM = sampledMaximum;
    }
    const angularTravelRad = length(previousWorkingState?.angularVelocityWorld || {}) * dt;
    const bodyRadiusM = Math.hypot(
      Number(config.bodyLengthM || 4.5) * 0.5,
      Number(config.bodyWidthM || 1.8) * 0.5,
      Number(config.bodyHeightM || 1.45)
    );
    const conservativeMinimumBodyHeightM = endpointMinimumHeightM
      - bodyRadiusM * angularTravelRad;
    const conservativeClearanceM = Number.isFinite(knownMaximumTerrainHeightM)
      ? conservativeMinimumBodyHeightM - knownMaximumTerrainHeightM
      : null;
    physicsCosts?.end(broadphaseTimer);
    const wheelCylinderSweep = sweepWheelCylinders({
      cylinders: environment.wheelCylinderSweeps || [],
      environment,
      toleranceM,
      spacingM: config.wheelCylinderSweepSpacingM,
      radialSamples: config.wheelCylinderRadialSamples
    });
    let lowerHullDeepestNormal = null;
    let lowerHullMaximumPenetrationM = 0;
    let uprightForLowerHullProbe = false;
    if (Number.isFinite(knownMaximumTerrainHeightM) && !wheelCylinderSweep) {
      const lowerHullProbeRangeM = Math.max(0.05, Number(
        config.bodyCollisionLowerHullProbeRangeM ?? 0.08
      ));
      if (conservativeClearanceM > lowerHullProbeRangeM) {
        physicsCosts?.count('bodyAabbRejections');
        return {
          linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
          angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
          positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
          contacts: [],
          broadphaseRejected: true,
          bodySupportLod: 'aabb',
          maximumPenetrationM: 0
        };
      }
      this.broadphaseLocalScratch.x = 0;
      this.broadphaseLocalScratch.y = 1;
      this.broadphaseLocalScratch.z = 0;
      rotateVectorInto(
        this.broadphaseLocalScratch,
        proposedState.orientation,
        this.broadphaseArmScratch
      );
      uprightForLowerHullProbe = this.broadphaseArmScratch.y > 0.55;
      // A small lower-envelope batch is authoritative as a rejection on clear
      // poses. A conservative overlap on globally varying terrain gets a second
      // continuity check against the exact lower-hull bounds before deciding
      // whether adaptive compound support is actually required.
      let requiresAdaptiveOverlap = environment.terrainHasDiscontinuities === true
        && conservativeClearanceM <= toleranceM;
      if (uprightForLowerHullProbe) {
        physicsCosts?.count('bodyLowerHullProbes');
        const supportBuffer = queryFrame?.acquireBodySupportBuffer?.() || null;
        const lowerSupport = this.getLowerHullSupportWorldUnprofiled(
          proposedState,
          environment,
          supportBuffer
        );
        physicsCosts?.count('bodyLowerHullSupportFeatures', lowerSupport.length);
        const terrainBatch = typeof queryFrame?.sampleSupportEntries === 'function'
          ? queryFrame.sampleSupportEntries(lowerSupport)
          : typeof sampleTerrainBatch === 'function'
            ? sampleTerrainBatch(lowerSupport.map(({ worldPoint }) => worldPoint))
            : null;
        let unresolvedLowerHullContact = false;
        let lowerMinX = Infinity;
        let lowerMaxX = -Infinity;
        let lowerMinZ = Infinity;
        let lowerMaxZ = -Infinity;
        let hasVariationReference = false;
        for (let index = 0; index < lowerSupport.length; index += 1) {
          const entry = lowerSupport[index];
          lowerMinX = Math.min(lowerMinX, entry.worldPoint.x);
          lowerMaxX = Math.max(lowerMaxX, entry.worldPoint.x);
          lowerMinZ = Math.min(lowerMinZ, entry.worldPoint.z);
          lowerMaxZ = Math.max(lowerMaxZ, entry.worldPoint.z);
          const rawTerrain = terrainBatch?.[index]
            || (typeof sampleTerrain === 'function' ? sampleTerrain(entry.worldPoint) : null);
          const terrain = terrainSampleContract(
            rawTerrain, entry.worldPoint, 'body-lower-hull-lod'
          );
          if (!terrain.valid) {
            unresolvedLowerHullContact = true;
            break;
          }
          const rawNormal = terrain.normal || terrain.normalWorld || {};
          const normalMagnitude = Math.hypot(
            Number(rawNormal.x || 0),
            Number(rawNormal.y || 0),
            Number(rawNormal.z || 0)
          );
          const inverseNormalMagnitude = normalMagnitude > EPSILON ? 1 / normalMagnitude : 1;
          const normalX = normalMagnitude > EPSILON
            ? Number(rawNormal.x || 0) * inverseNormalMagnitude : 0;
          const normalY = normalMagnitude > EPSILON
            ? Number(rawNormal.y || 0) * inverseNormalMagnitude : 1;
          const normalZ = normalMagnitude > EPSILON
            ? Number(rawNormal.z || 0) * inverseNormalMagnitude : 0;
          if (!hasVariationReference) {
            const reference = this.lowerHullVariationReference;
            reference.point.x = entry.worldPoint.x;
            reference.point.y = entry.worldPoint.y;
            reference.point.z = entry.worldPoint.z;
            reference.heightM = terrain.heightM;
            reference.normal.x = normalX;
            reference.normal.y = normalY;
            reference.normal.z = normalZ;
            hasVariationReference = true;
          }
          const penetrationM = (terrain.heightM - entry.worldPoint.y) * normalY;
          if (penetrationM > lowerHullMaximumPenetrationM) {
            lowerHullMaximumPenetrationM = penetrationM;
            lowerHullDeepestNormal = terrain.normal;
          }
          if (penetrationM > toleranceM) {
            unresolvedLowerHullContact = true;
            break;
          }
        }
        if (!unresolvedLowerHullContact && requiresAdaptiveOverlap
          && hasVariationReference
          && typeof queryFrame?.terrainVariationInBounds === 'function') {
          this.broadphaseBoundsScratch.minX = lowerMinX;
          this.broadphaseBoundsScratch.maxX = lowerMaxX;
          this.broadphaseBoundsScratch.minZ = lowerMinZ;
          this.broadphaseBoundsScratch.maxZ = lowerMaxZ;
          this.lowerHullVariationOptions.heightToleranceM = Math.max(0.025, Number(
            environment.bodySupportHeightErrorM || 0.025
          ));
          const localVariation = queryFrame.terrainVariationInBounds(
            this.broadphaseBoundsScratch,
            this.lowerHullVariationReference,
            this.lowerHullVariationOptions
          );
          requiresAdaptiveOverlap = !localVariation.valid || localVariation.discontinuity;
          if (!requiresAdaptiveOverlap) {
            physicsCosts?.count('bodyLocalContinuityRejections');
          }
        }
        queryFrame?.releaseBodySupportBuffer?.(supportBuffer);
        if (!unresolvedLowerHullContact && !requiresAdaptiveOverlap) {
          physicsCosts?.count('bodyLowerHullRejections');
          return {
            linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
            angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
            positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
            contacts: [],
            broadphaseRejected: true,
            bodySupportLod: 'lower-hull',
            maximumPenetrationM: 0
          };
        }
      }
    }
    physicsCosts?.count('bodyFullEnvelopeActivations');
    this.prepareAdaptiveSupportCandidates(
      previousWorkingState, proposedState, environment
    );
    const lowerHullClosingSpeedMps = lowerHullDeepestNormal
      ? Math.max(0, -dot(proposedState.velocity, lowerHullDeepestNormal)) : 0;
    const angularSurfaceSpeedMps = length(proposedState.angularVelocityWorld) * bodyRadiusM;
    const bodyTranslationM = previousWorkingState ? Math.hypot(
      Number(proposedState.position?.x || 0)
        - Number(previousWorkingState.position?.x || 0),
      Number(proposedState.position?.y || 0)
        - Number(previousWorkingState.position?.y || 0),
      Number(proposedState.position?.z || 0)
        - Number(previousWorkingState.position?.z || 0)
    ) : 0;
    const requiresContinuousBodySweep = Boolean(previousWorkingState) && (
      environment.terrainHasDiscontinuities === true
      || wheelCylinderSweep
      || bodyTranslationM > 0.3
      || lowerHullClosingSpeedMps + angularSurfaceSpeedMps > 3
      || Math.abs(Number(proposedState.pitchRad || 0)) > 0.35
      || Math.abs(Number(proposedState.rollRad || 0)) > 0.35
      || lowerHullMaximumPenetrationM > Math.max(0.03, toleranceM * 3)
    );
    const bodySweep = requiresContinuousBodySweep
      ? this.findSweepImpact(previousWorkingState, proposedState, environment, toleranceM, {
          ...config,
          __collisionSubstepDt: dt,
          __useLowerHullSweep: uprightForLowerHullProbe
        })
      : null;
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
    const manifoldTimer = physicsCosts?.start('bodyManifoldSolve');
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
    const manifoldSupportBuffer = queryFrame?.acquireBodySupportBuffer?.() || null;
    const candidateWorld = manifoldSupportBuffer
      ? this.getAdaptiveSupportWorldUnprofiled(
          workingState, environment, manifoldSupportBuffer
        )
      : this.getAdaptiveSupportWorld(workingState, environment);
    if (manifoldSupportBuffer) {
      physicsCosts?.count('bodySupportFeatures', candidateWorld.length);
      let adaptiveCount = 0;
      for (let index = 0; index < candidateWorld.length; index += 1) {
        if (candidateWorld[index].candidate?.adaptive === true) adaptiveCount += 1;
      }
      physicsCosts?.count('adaptiveBodySupportFeatures', adaptiveCount);
    }
    const appendWheelFeature = (feature) => {
      candidateWorld.push({
        candidate: feature,
        arm: addVector3(feature.worldPoint, scaleVector3(workingState.position, -1)),
        worldPoint: feature.worldPoint
      });
    };
    uniqueWheelSupportFeatures.forEach(appendWheelFeature);
    sweptWheelContactFeatures.forEach(appendWheelFeature);
    if (typeof environment.sampleTerrainMaximumHeightInBounds === 'function') {
      let candidateMinX = Infinity;
      let candidateMaxX = -Infinity;
      let candidateMinZ = Infinity;
      let candidateMaxZ = -Infinity;
      let minimumCandidateHeightM = Infinity;
      for (let index = 0; index < candidateWorld.length; index += 1) {
        const point = candidateWorld[index].worldPoint;
        candidateMinX = Math.min(candidateMinX, point.x);
        candidateMaxX = Math.max(candidateMaxX, point.x);
        candidateMinZ = Math.min(candidateMinZ, point.z);
        candidateMaxZ = Math.max(candidateMaxZ, point.z);
        minimumCandidateHeightM = Math.min(minimumCandidateHeightM, point.y);
      }
      const maximumTerrainHeightM = environment.sampleTerrainMaximumHeightInBounds({
        minX: candidateMinX,
        maxX: candidateMaxX,
        minZ: candidateMinZ,
        maxZ: candidateMaxZ
      });
      if (Number.isFinite(Number(maximumTerrainHeightM))
        && minimumCandidateHeightM - Number(maximumTerrainHeightM) > toleranceM) {
        queryFrame?.releaseBodySupportBuffer?.(manifoldSupportBuffer);
        physicsCosts?.end(manifoldTimer);
        return {
          linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
          angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
          positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
          contacts: [],
          broadphaseRejected: true
        };
      }
    }
    const terrainBatch = typeof queryFrame?.sampleSupportEntries === 'function'
      ? queryFrame.sampleSupportEntries(candidateWorld)
      : typeof sampleTerrainBatch === 'function'
        ? sampleTerrainBatch(candidateWorld.map(({ worldPoint }) => worldPoint))
        : null;
    const contacts = [];
    let maximumContactPenetrationM = 0;
    let nonWheelCandidateCount = 0;
    let nonWheelContactCount = 0;
    for (let candidateIndex = 0; candidateIndex < candidateWorld.length; candidateIndex += 1) {
      const { candidate, arm, worldPoint } = candidateWorld[candidateIndex];
      const contactType = candidate.contactType || 'body';
      const wheelContact = String(contactType).startsWith('wheel-');
      if (!wheelContact) nonWheelCandidateCount += 1;
      const rawTerrain = candidate.surfaceSample || terrainBatch?.[candidateIndex]
        || (typeof sampleTerrain === 'function' ? sampleTerrain(worldPoint) : null)
        || {};
      const terrain = terrainSampleContract(rawTerrain, worldPoint, 'body-contact-query');
      if (!terrain.valid) continue;
      const heightM = terrain.heightM;
      const rawNormal = candidate.collisionNormal || terrain.normal || terrain.normalWorld || {};
      const normalMagnitude = Math.hypot(
        Number(rawNormal.x || 0),
        Number(rawNormal.y || 0),
        Number(rawNormal.z || 0)
      );
      const inverseNormalMagnitude = normalMagnitude > EPSILON ? 1 / normalMagnitude : 1;
      const normalX = normalMagnitude > EPSILON
        ? Number(rawNormal.x || 0) * inverseNormalMagnitude : 0;
      const normalY = normalMagnitude > EPSILON
        ? Number(rawNormal.y || 0) * inverseNormalMagnitude : 1;
      const normalZ = normalMagnitude > EPSILON
        ? Number(rawNormal.z || 0) * inverseNormalMagnitude : 0;
      const penetrationM = Number.isFinite(Number(candidate.penetrationM))
        ? Number(candidate.penetrationM)
        : (heightM - worldPoint.y) * normalY;
      if (penetrationM <= toleranceM) continue;
      const normal = { x: normalX, y: normalY, z: normalZ };
      maximumContactPenetrationM = Math.max(maximumContactPenetrationM, penetrationM);
      if (!wheelContact) nonWheelContactCount += 1;
      contacts.push({
        id: candidate.id,
        candidateIndex,
        localPoint: candidate.localPoint || null,
        arm: { ...arm },
        pointWorld: { ...worldPoint },
        normal,
        penetrationM,
        friction: clamp(Math.sqrt(
          Math.max(0, Number(candidate.friction ?? config.bodyCollisionFriction ?? 0.62))
          * Math.max(0, Number(terrain.friction ?? config.bodyCollisionFriction ?? 0.62))
        ), 0, 1.5),
        pieceId: candidate.pieceId || null,
        wheelId: candidate.wheelId || null,
        contactType,
        triangleId: candidate.triangleId ?? terrain.triangleId,
        terrainSource: candidate.terrainSource ?? terrain.source,
        terrainRegion: candidate.terrainRegion ?? terrain.region,
        poweredTreadContact: candidate.poweredTreadContact === true,
        widthFraction: candidate.widthFraction ?? null,
        partialWidth: candidate.partialWidth === true,
        sweepMechanism: candidate.mechanism || null,
        normalImpulseNs: 0,
        tangentialImpulseNs: 0,
        tangentialImpulseWorldNs: { x: 0, y: 0, z: 0 },
        restitutionImpulseNs: 0,
        penetrationBiasImpulseNs: 0,
        restitutionTargetSpeedMps: 0,
        suspensionSupported: Number(
          environment.suspensionBodyContactSupport?.supportedWheelCount || 0
        ) > 0 && /lower|frame|underbody|underside|rocker/.test(candidate.id)
      });
    }
    const unsupportedAtContactStart = Number(
      environment.suspensionBodyContactSupport?.supportedWheelCount || 0
    ) === 0;
    const initialUnsupportedMaximumPenetrationM = unsupportedAtContactStart
      ? maximumContactPenetrationM : null;
    const initialUnsupportedAllBodySamplesBelowTerrain = unsupportedAtContactStart
      && contacts.length > 0
      && nonWheelContactCount === nonWheelCandidateCount;
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
        const desiredNormalDelta = contact.restitutionTargetSpeedMps - normalSpeed;
        const normalDenominator = Math.max(EPSILON, effectiveMassDenominator(
          contact.normal,
          contact.arm,
          config,
          workingState.orientation
        ));
        const previousNormalImpulseNs = Number(contact.normalImpulseNs || 0);
        const accumulatedNormalImpulseNs = Math.max(
          0,
          previousNormalImpulseNs + desiredNormalDelta / normalDenominator
        );
        const normalImpulseMagnitude = accumulatedNormalImpulseNs - previousNormalImpulseNs;
        const normalImpulse = scaleVector3(contact.normal, normalImpulseMagnitude);
        applyImpulse(workingState, normalImpulse, contact.arm, config);
        linearImpulse = addVector3(linearImpulse, normalImpulse);
        const normalAngularImpulse = crossVector3(contact.arm, normalImpulse);
        angularImpulse = addVector3(angularImpulse, normalAngularImpulse);
        contact.normalImpulseNs = accumulatedNormalImpulseNs;
        contact.restitutionImpulseNs = Math.min(
          accumulatedNormalImpulseNs,
          contact.restitutionTargetSpeedMps / normalDenominator
        );

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
        const previousFrictionImpulse = contact.tangentialImpulseWorldNs;
        const requestedFrictionImpulse = scaleVector3(
          tangent,
          -tangentSpeed / tangentDenominator
        );
        const accumulatedFrictionImpulse = addVector3(
          previousFrictionImpulse,
          requestedFrictionImpulse
        );
        const maximumFrictionImpulseNs = contact.friction * accumulatedNormalImpulseNs;
        const accumulatedMagnitude = length(accumulatedFrictionImpulse);
        const clampedFrictionImpulse = accumulatedMagnitude > maximumFrictionImpulseNs
          && accumulatedMagnitude > EPSILON
          ? scaleVector3(
              accumulatedFrictionImpulse,
              maximumFrictionImpulseNs / accumulatedMagnitude
            )
          : accumulatedFrictionImpulse;
        const frictionImpulse = addVector3(
          clampedFrictionImpulse,
          scaleVector3(previousFrictionImpulse, -1)
        );
        applyImpulse(workingState, frictionImpulse, contact.arm, config);
        linearImpulse = addVector3(linearImpulse, frictionImpulse);
        angularImpulse = addVector3(angularImpulse, crossVector3(contact.arm, frictionImpulse));
        contact.tangentialImpulseWorldNs = clampedFrictionImpulse;
        contact.tangentialImpulseNs = length(clampedFrictionImpulse);
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
        const terrain = terrainSampleContract(
          typeof sampleTerrain === 'function' ? sampleTerrain(pointWorld) : null,
          pointWorld,
          'body-split-impulse-query'
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
    const localRollbackMinimumPenetrationM = Math.max(
      toleranceM,
      Number(config.shallowContactPenetrationM ?? 0.03)
    );
    if (Number(residualPenetration.maximumPenetrationM) > localRollbackMinimumPenetrationM
      && previousWorkingState) {
      const previousPenetration = this.samplePosePenetration(
        previousWorkingState, environment, toleranceM
      );
      if (!(Number(previousPenetration.maximumPenetrationM) > toleranceM)) {
        const penetratedPose = this.createWorkingState(workingState);
        let low = 0;
        let high = 1;
        for (let iteration = 0; iteration < 14; iteration += 1) {
          physicsCosts?.count('binarySearchIterations');
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
    const result = {
      bodySupportLod: 'full-compound',
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
      finalPenetrationSample: residualPenetration,
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
    queryFrame?.releaseBodySupportBuffer?.(manifoldSupportBuffer);
    physicsCosts?.end(manifoldTimer);
    return result;
  }

  step(args = {}) {
    const staticResult = this.staticColliderCollision.step(args);
    if (!staticResult) return this.stepTerrain(args);
    if (args.environment?.staticCollidersOwnBodyCollision === true) {
      return {
        ...staticResult,
        staticCollision: staticResult,
        bodySupportLod: 'prepared-static-collider'
      };
    }
    const suspensionSupport = args.environment?.suspensionBodyContactSupport || {};
    const skipTerrainCollision = args.environment?.terrainCollisionClassification
        === 'smooth-connected-surface'
      && args.environment?.bodyCollisionPredicted !== true
      && Number(suspensionSupport.maximumOvertravelM || 0) <= 0;
    if (skipTerrainCollision) {
      staticResult.bodySupportLod = args.environment?.reuseContactGeometry === true
        ? 'chassis-geometry-reuse' : 'chassis-clearance-broadphase';
      staticResult.terrainCollisionDeferred = true;
      return staticResult;
    }
    const terrainResult = this.stepTerrain({
      ...args,
      // The static solver has already advanced from its TOI through the
      // remaining substep. Terrain still validates/corrects that final pose,
      // but must not replay the original trajectory a second time.
      previousWorkingState: staticResult.swept ? null : args.previousWorkingState
    });
    const sumVector = (field) => addVector3(
      staticResult[field] || {},
      terrainResult[field] || {}
    );
    const staticToi = Number(staticResult.timeOfImpactFraction);
    const terrainToi = Number(terrainResult.timeOfImpactFraction);
    const timeOfImpactFraction = Number.isFinite(staticToi)
      ? Number.isFinite(terrainToi) ? Math.min(staticToi, terrainToi) : staticToi
      : Number.isFinite(terrainToi) ? terrainToi : null;
    return {
      ...terrainResult,
      linearImpulseWorldNs: sumVector('linearImpulseWorldNs'),
      angularImpulseWorldNms: sumVector('angularImpulseWorldNms'),
      positionalCorrectionWorldM: sumVector('positionalCorrectionWorldM'),
      contacts: [...(staticResult.contacts || []), ...(terrainResult.contacts || [])],
      bodyNormalImpulseNs: Number(staticResult.bodyNormalImpulseNs || 0)
        + Number(terrainResult.bodyNormalImpulseNs || 0),
      bodyFrictionImpulseNs: Number(staticResult.bodyFrictionImpulseNs || 0)
        + Number(terrainResult.bodyFrictionImpulseNs || 0),
      restitutionContributionNs: Number(staticResult.restitutionContributionNs || 0)
        + Number(terrainResult.restitutionContributionNs || 0),
      swept: staticResult.swept === true || terrainResult.swept === true,
      sweepSource: staticResult.swept === true
        ? 'static-collider' : terrainResult.sweepSource,
      timeOfImpactFraction,
      maximumPenetrationM: Math.max(
        Number(staticResult.maximumPenetrationM || 0),
        Number(terrainResult.maximumPenetrationM || 0)
      ),
      residualPenetrationM: Math.max(
        Number(staticResult.residualPenetrationM || 0),
        Number(terrainResult.residualPenetrationM || 0)
      ),
      broadphaseRejected: staticResult.broadphaseRejected === true
        && terrainResult.broadphaseRejected === true,
      staticCollision: staticResult
    };
  }
}

export default ChassisBodyCollision;
