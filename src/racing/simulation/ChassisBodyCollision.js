import {
  addVector3,
  crossVector3,
  inverseInertiaWorldMultiply,
  integrateQuaternion,
  rotateVectorByQuaternion,
  scaleVector3
} from './RigidBodyMath.js';
import { normalizeVehicleBodyProfile } from './VehicleBodyProfile.js';

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

  samplePosePenetration(pose, environment, toleranceM) {
    const sampleTerrain = environment.sampleTerrainAtWorldPoint;
    const sampleTerrainBatch = environment.sampleTerrainAtWorldPoints;
    const points = this.getSupportCandidates(pose).map((candidate) => {
      const arm = rotateVectorByQuaternion(candidate.localPoint, pose.orientation);
      return { candidate, arm, worldPoint: addVector3(pose.position, arm) };
    });
    const terrainBatch = typeof sampleTerrainBatch === 'function'
      ? sampleTerrainBatch(points.map(({ worldPoint }) => worldPoint))
      : null;
    let maximumPenetrationM = -Infinity;
    let deepestNormal = null;
    let invalidTerrainSampleCount = 0;
    let belowTerrainSampleCount = 0;
    points.forEach(({ worldPoint }, index) => {
      const terrain = terrainBatch?.[index]
        || (typeof sampleTerrain === 'function' ? sampleTerrain(worldPoint) : null)
        || {};
      const heightM = Number(terrain.heightM ?? terrain.elevationM);
      if (!Number.isFinite(heightM)) {
        invalidTerrainSampleCount += 1;
        return;
      }
      const normal = normalize(terrain.normal || terrain.normalWorld);
      const surfacePoint = { x: worldPoint.x, y: heightM, z: worldPoint.z };
      const penetrationM = -dot(
        addVector3(worldPoint, scaleVector3(surfacePoint, -1)), normal
      );
      if (penetrationM > maximumPenetrationM) {
        maximumPenetrationM = penetrationM;
        deepestNormal = normal;
      }
      if (penetrationM > toleranceM) belowTerrainSampleCount += 1;
    });
    return {
      maximumPenetrationM: Number.isFinite(maximumPenetrationM) ? maximumPenetrationM : null,
      deepestNormal,
      invalidTerrainSampleCount,
      validTerrainSampleCount: points.length - invalidTerrainSampleCount,
      belowTerrainSampleCount,
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
    if (Number.isFinite(knownMaximumTerrainHeightM)
      && conservativeMinimumBodyHeightM - knownMaximumTerrainHeightM > toleranceM) {
      return {
        linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
        angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
        positionalCorrectionWorldM: { x: 0, y: 0, z: 0 },
        contacts: [],
        broadphaseRejected: true,
        maximumPenetrationM: 0
      };
    }
    const sweep = this.findSweepImpact(previousWorkingState, proposedState, environment, toleranceM, {
      ...config,
      __collisionSubstepDt: dt
    });
    if (sweep) {
      workingState.position = { ...sweep.pose.position };
      workingState.orientation = { ...sweep.pose.orientation };
    }
    const candidateWorld = this.getSupportCandidates(workingState).map((candidate) => {
      const arm = rotateVectorByQuaternion(candidate.localPoint, workingState.orientation);
      const worldPoint = addVector3(workingState.position, arm);
      return { candidate, arm, worldPoint };
    }).concat((environment.wheelCollisionSupportFeatures || []).map((feature) => ({
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
      const terrain = terrainBatch?.[candidateIndex]
        || (typeof sampleTerrain === 'function' ? sampleTerrain(worldPoint) : null)
        || {};
      const heightM = Number(terrain.heightM ?? terrain.elevationM);
      if (!Number.isFinite(heightM)) return null;
      const normal = normalize(terrain.normal || terrain.normalWorld);
      const surfacePoint = { x: worldPoint.x, y: heightM, z: worldPoint.z };
      const penetrationM = -dot(addVector3(worldPoint, scaleVector3(surfacePoint, -1)), normal);
      if (penetrationM <= toleranceM) return null;
      return {
        id: candidate.id,
        candidateIndex,
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
    // Correct against the deepest manifold point. Averaging penetration over
    // every contact leaves the deepest point underground and produces a train
    // of small visible pops on subsequent substeps.
    const deepestContact = contacts.reduce((deepest, contact) => (
      !deepest || contact.penetrationM > deepest.penetrationM ? contact : deepest
    ), null);
    const correction = deepestContact
      ? scaleVector3(
          deepestContact.normal,
          Math.max(0, deepestContact.penetrationM - toleranceM)
        )
      : { x: 0, y: 0, z: 0 };
    const correctionLength = length(correction);
    const boundedCorrection = correctionLength > 0.06
      ? scaleVector3(correction, 0.06 / correctionLength)
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
    let remainingCorrectionBudgetM = Math.max(0, 0.06 - length(boundedCorrection));
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
    const totalPositionalCorrection = addVector3(boundedCorrection, finalCorrection);
    return {
      linearImpulseWorldNs: linearImpulse,
      angularImpulseWorldNms: angularImpulse,
      positionalCorrectionWorldM: totalPositionalCorrection,
      bodyNormalImpulseNs: contacts.reduce((sum, contact) => sum + contact.normalImpulseNs, 0),
      bodyFrictionImpulseNs: contacts.reduce((sum, contact) => sum + contact.tangentialImpulseNs, 0),
      restitutionContributionNs: contacts.reduce((sum, contact) => sum + contact.restitutionImpulseNs, 0),
      penetrationBiasContributionNs: 0,
      swept: Boolean(sweep),
      timeOfImpactFraction: sweep?.fraction ?? null,
      maximumPenetrationM: contacts.reduce((maximum, contact) => (
        Math.max(maximum, Number(contact.penetrationM || 0))
      ), 0),
      contacts
    };
  }
}

export default ChassisBodyCollision;
