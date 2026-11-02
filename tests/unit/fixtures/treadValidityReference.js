// Frozen validation implementation before per-wheel vector reuse.
import { getGamepadSpeedSteeringScale } from '../../../src/racing/simulation/RaceSimulationConfig.js';
import { RACE_WHEEL_IDS, clamp } from '../../../src/racing/simulation/SimulationMath.js';
import { PowertrainModel } from '../../../src/racing/simulation/PowertrainModel.js';
import { rotateVectorByQuaternion } from '../../../src/racing/simulation/RigidBodyMath.js';
import {
  resolvePerWheelAlignment,
  solveSuspensionGeometry
} from '../../../src/racing/simulation/SuspensionGeometry.js';
import {
  createContactFootprintScratch,
  resolveContactFootprint
} from '../../../src/racing/simulation/ContactFootprint.js';
import { resolveCompoundSurfaceGrip } from '../../../src/racing/simulation/SurfaceConditionGrip.js';
import { createInvalidSurfaceSample, createSurfaceSample } from '../../../src/racing/simulation/SurfaceSample.js';

const powertrainModel = new PowertrainModel();

const EPSILON = 1e-9;
const QUANTIZE_SCALE_BY_PRECISION = Object.freeze({
  6: 1e6,
  9: 1e9,
  12: 1e12
});
const q = (value, precision = 6) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scale = QUANTIZE_SCALE_BY_PRECISION[precision] || 10 ** precision;
  return Math.round(numeric * scale) / scale;
};
const vector = (value = {}, fallback = {}) => ({
  x: Number(value.x ?? fallback.x ?? 0),
  y: Number(value.y ?? fallback.y ?? 0),
  z: Number(value.z ?? fallback.z ?? 0)
});
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, amount) => ({ x: a.x * amount, y: a.y * amount, z: a.z * amount });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const normalize = (value, fallback = { x: 0, y: 1, z: 0 }) => {
  const length = Math.hypot(value.x, value.y, value.z);
  return length > EPSILON ? scale(value, 1 / length) : { ...fallback };
};
const projectOnPlane = (value, normal) => add(value, scale(normal, -dot(value, normal)));
const cleanVectorInto = (target, value) => {
  const output = target && typeof target === 'object' ? target : {};
  output.x = q(value.x);
  output.y = q(value.y);
  output.z = q(value.z);
  return output;
};

function vectorInto(target, value = {}, fallback = {}) {
  target.x = Number(value.x ?? fallback.x ?? 0);
  target.y = Number(value.y ?? fallback.y ?? 0);
  target.z = Number(value.z ?? fallback.z ?? 0);
  return target;
}

function addInto(target, left, right) {
  target.x = left.x + right.x;
  target.y = left.y + right.y;
  target.z = left.z + right.z;
  return target;
}

function scaleInto(target, value, amount) {
  target.x = value.x * amount;
  target.y = value.y * amount;
  target.z = value.z * amount;
  return target;
}

function crossInto(target, left, right) {
  const x = left.y * right.z - left.z * right.y;
  const y = left.z * right.x - left.x * right.z;
  const z = left.x * right.y - left.y * right.x;
  target.x = x;
  target.y = y;
  target.z = z;
  return target;
}

function normalizeInto(target, value, fallback = { x: 0, y: 1, z: 0 }) {
  const length = Math.hypot(value.x, value.y, value.z);
  if (length > EPSILON) return scaleInto(target, value, 1 / length);
  target.x = fallback.x;
  target.y = fallback.y;
  target.z = fallback.z;
  return target;
}

function normalizeQuaternionInto(value, target) {
  const output = target && typeof target === 'object' ? target : {};
  const x = Number(value?.x || 0);
  const y = Number(value?.y || 0);
  const z = Number(value?.z || 0);
  const w = Number(value?.w ?? 1);
  const length = Math.hypot(x, y, z, w);
  if (length < 1e-12) {
    output.x = 0;
    output.y = 0;
    output.z = 0;
    output.w = 1;
  } else {
    output.x = x / length;
    output.y = y / length;
    output.z = z / length;
    output.w = w / length;
  }
  return output;
}

function rotateVectorByNormalizedQuaternionInto(value, orientation, target) {
  const output = target && typeof target === 'object' ? target : {};
  const vectorX = Number(value?.x || 0);
  const vectorY = Number(value?.y || 0);
  const vectorZ = Number(value?.z || 0);
  const twiceCrossX = (orientation.y * vectorZ - orientation.z * vectorY) * 2;
  const twiceCrossY = (orientation.z * vectorX - orientation.x * vectorZ) * 2;
  const twiceCrossZ = (orientation.x * vectorY - orientation.y * vectorX) * 2;
  output.x = vectorX + (
    twiceCrossX * orientation.w
    + (orientation.y * twiceCrossZ - orientation.z * twiceCrossY)
  );
  output.y = vectorY + (
    twiceCrossY * orientation.w
    + (orientation.z * twiceCrossX - orientation.x * twiceCrossZ)
  );
  output.z = vectorZ + (
    twiceCrossZ * orientation.w
    + (orientation.x * twiceCrossY - orientation.y * twiceCrossX)
  );
  return output;
}

export function createWheelContactKinematicsScratch() {
  return {
    target: {},
    computation: {
      normalizedOrientation: { x: 0, y: 0, z: 0, w: 1 },
      localForward: { x: 0, y: 0, z: 1 },
      localRight: { x: 1, y: 0, z: 0 },
      rotatedForward: { x: 0, y: 0, z: 1 },
      rotatedRight: { x: 1, y: 0, z: 0 },
      centerRadius: { x: 0, y: 0, z: 0 },
      mountRadius: { x: 0, y: 0, z: 0 },
      suspensionAxisWorld: { x: 0, y: -1, z: 0 },
      suspensionAxisLocal: { x: 0, y: -1, z: 0 },
      staticHubOffset: { x: 0, y: 0, z: 0 },
      localOffset: { x: 0, y: 0, z: 0 },
      fullDroopHubOffset: { x: 0, y: 0, z: 0 },
      suspensionMountOffset: { x: 0, y: 0, z: 0 },
      chassisForward: { x: 0, y: 0, z: 1 },
      chassisRight: { x: 1, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      mountPosition: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      steeringAngles: { fl: 0, fr: 0, rl: 0, rr: 0 },
      rawForward: { x: 0, y: 0, z: 1 },
      projectedForward: { x: 0, y: 0, z: 1 },
      wheelForward: { x: 0, y: 0, z: 1 },
      wheelLateral: { x: 1, y: 0, z: 0 },
      contactPoint: { x: 0, y: 0, z: 0 },
      radius: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      hubRelativeVelocity: { x: 0, y: 0, z: 0 },
      hubVelocity: { x: 0, y: 0, z: 0 },
      mountVelocity: { x: 0, y: 0, z: 0 },
      contactVelocity: { x: 0, y: 0, z: 0 },
      vectorA: { x: 0, y: 0, z: 0 },
      vectorB: { x: 0, y: 0, z: 0 }
    }
  };
}

function createMutableSurfaceSampleTarget() {
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
    bakedElevation: null,
    bakedNormal: normal,
    bakedTriangleId: null,
    bakedSurfaceSource: null
  };
}

function isResolvedSurfaceSample(sample) {
  return sample && typeof sample.valid === 'boolean'
    && (sample.valid === false || (
      Number.isFinite(Number(sample.heightM))
      && sample.normal
      && Number.isFinite(Number(sample.normal.x))
      && Number.isFinite(Number(sample.normal.y))
      && Number.isFinite(Number(sample.normal.z))
    ));
}

function isPointInsideBodyPiece(pointX, pointY, pointZ, piece) {
  const centerX = Number(piece.centerM?.x || 0);
  const centerY = Number(piece.centerM?.y || 0);
  const centerZ = Number(piece.centerM?.z || 0);
  const vertices = piece.type === 'convex' && piece.vertices?.length
    ? piece.vertices : null;
  if (!vertices) {
    return Math.abs(pointX - centerX) < Number(piece.sizeM?.x || 0) * 0.5 * 0.98
      && Math.abs(pointY - centerY) < Number(piece.sizeM?.y || 0) * 0.5 * 0.98
      && Math.abs(pointZ - centerZ) < Number(piece.sizeM?.z || 0) * 0.5 * 0.98;
  }
  let minimumX = Infinity;
  let minimumY = Infinity;
  let minimumZ = Infinity;
  let maximumX = -Infinity;
  let maximumY = -Infinity;
  let maximumZ = -Infinity;
  for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex += 1) {
    const vertex = vertices[vertexIndex];
    const x = Number(vertex.x || 0);
    const y = Number(vertex.y || 0);
    const z = Number(vertex.z || 0);
    minimumX = Math.min(minimumX, x);
    minimumY = Math.min(minimumY, y);
    minimumZ = Math.min(minimumZ, z);
    maximumX = Math.max(maximumX, x);
    maximumY = Math.max(maximumY, y);
    maximumZ = Math.max(maximumZ, z);
  }
  const relativeX = pointX - centerX;
  const relativeY = pointY - centerY;
  const relativeZ = pointZ - centerZ;
  return relativeX > minimumX * 0.98 && relativeX < maximumX * 0.98
    && relativeY > minimumY * 0.98 && relativeY < maximumY * 0.98
    && relativeZ > minimumZ * 0.98 && relativeZ < maximumZ * 0.98;
}

function setTreadContactValidity(target, {
  valid,
  state,
  reason,
  surfaceReason = null,
  supportAlignment,
  geometricProximity,
  bottomedOut
}) {
  const output = target && typeof target === 'object' ? target : {};
  output.valid = valid;
  output.state = state;
  output.reason = reason;
  output.surfaceReason = surfaceReason;
  output.supportAlignment = supportAlignment;
  output.geometricProximity = geometricProximity;
  output.bottomedOut = bottomedOut;
  return output;
}

export function referenceTreadContactValidity({
  state,
  config,
  environment,
  wheelId,
  kinematics,
  surfaceSample,
  rawRequestedCompressionM,
  suspensionTravelM,
  target = null
}) {
  if (surfaceSample?.valid !== true) {
    return setTreadContactValidity(target, {
      valid: false,
      state: 'no-terrain',
      reason: 'no-terrain',
      surfaceReason: surfaceSample?.reason || 'missing-surface-sample',
      supportAlignment: 0,
      geometricProximity: false,
      bottomedOut: false
    });
  }
  const normal = normalize(vector(kinematics.surfaceNormalWorld, { x: 0, y: 1, z: 0 }));
  const axis = normalize(vector(kinematics.suspensionAxisWorld, { x: 0, y: -1, z: 0 }));
  const supportAlignment = dot(axis, scale(normal, -1));
  const minimumAlignment = clamp(Number(config.minimumTreadSupportAlignment ?? 0.2), 0.01, 0.95);
  const reachToleranceM = Math.max(0.002, Number(config.treadReachToleranceM ?? 0.025));
  if (supportAlignment < minimumAlignment) {
    return setTreadContactValidity(target, {
      valid: false, state: 'wrong-suspension-side', reason: 'wrong-suspension-side',
      supportAlignment: q(supportAlignment), geometricProximity: false, bottomedOut: false
    });
  }
  const axleNormalAlignment = Math.abs(dot(
    normalize(vector(kinematics.wheelLateralWorld, { x: 1, y: 0, z: 0 })),
    normal
  ));
  if (axleNormalAlignment > Math.max(0.2, Number(config.maximumTreadAxleNormalAlignment ?? 0.72))) {
    return setTreadContactValidity(target, {
      valid: false, state: 'leading-tread-or-sidewall-collision', reason: 'sidewall-normal',
      supportAlignment: q(supportAlignment), geometricProximity: true, bottomedOut: false
    });
  }
  if (environment.bodyOccludedByWheel?.[wheelId] === true) {
    return setTreadContactValidity(target, {
      valid: false, state: 'body-occluded', reason: 'body-occluded',
      supportAlignment: q(supportAlignment), geometricProximity: true, bottomedOut: false
    });
  }
  // Test the complete mount-to-contact path in body space. A suspension mount
  // may begin inside its mounting body, but after the path exits that piece it
  // must not enter any compound piece again before reaching the tread.
  const orientation = state.orientation || { x: 0, y: 0, z: 0, w: 1 };
  const inverseOrientation = {
    x: -Number(orientation.x || 0),
    y: -Number(orientation.y || 0),
    z: -Number(orientation.z || 0),
    w: Number(orientation.w ?? 1)
  };
  const toBody = (point) => rotateVectorByQuaternion(
    add(vector(point), scale(vector(state.position), -1)), inverseOrientation
  );
  const localMount = toBody(kinematics.suspensionMountPositionWorld
    || kinematics.hubPositionWorld || kinematics.wheelCenterWorld);
  const localContact = toBody(kinematics.contactPointWorld);
  const pathX = localContact.x - localMount.x;
  const pathY = localContact.y - localMount.y;
  const pathZ = localContact.z - localMount.z;
  const pieces = config.bodyProfile?.pieces || [];
  let pathOccluded = false;
  for (let pieceIndex = 0; pieceIndex < pieces.length && !pathOccluded; pieceIndex += 1) {
    const piece = pieces[pieceIndex];
    let hasExitedStartingPiece = !isPointInsideBodyPiece(
      localMount.x, localMount.y, localMount.z, piece
    );
    for (let sample = 1; sample <= 12; sample += 1) {
      const fraction = sample / 12;
      const inside = isPointInsideBodyPiece(
        localMount.x + pathX * fraction,
        localMount.y + pathY * fraction,
        localMount.z + pathZ * fraction,
        piece
      );
      if (!inside) hasExitedStartingPiece = true;
      else if (hasExitedStartingPiece) {
        pathOccluded = true;
        break;
      }
    }
  }
  if (pathOccluded) {
    return setTreadContactValidity(target, {
      valid: false, state: 'body-occluded', reason: 'body-occluded',
      supportAlignment: q(supportAlignment), geometricProximity: true, bottomedOut: false
    });
  }
  const requestedCompressionM = Number(rawRequestedCompressionM);
  if (!Number.isFinite(requestedCompressionM)) {
    return setTreadContactValidity(target, {
      valid: false, state: 'no-terrain', reason: 'no-terrain',
      surfaceReason: 'non-finite-requested-compression',
      supportAlignment: q(supportAlignment), geometricProximity: false, bottomedOut: false
    });
  }
  if (requestedCompressionM < -reachToleranceM) {
    return setTreadContactValidity(target, {
      valid: false, state: 'below-droop-reach', reason: 'outside-suspension-reach',
      supportAlignment: q(supportAlignment), geometricProximity: false, bottomedOut: false
    });
  }
  const previousPatch = state.contactPatches?.[wheelId] || {};
  const surfaceClassification = `${surfaceSample.region || ''} ${surfaceSample.source || ''}`;
  const smoothConnectedSurface = !/(curb|step|gap|discontinuity|wall|barrier|shoulder)/i
    .test(surfaceClassification);
  const physicalEnterToleranceM = 0.0001;
  const physicalExitToleranceM = -0.00025;
  const contactThresholdM = previousPatch.validTreadContact === true
    && smoothConnectedSurface ? physicalExitToleranceM : physicalEnterToleranceM;
  if (requestedCompressionM <= contactThresholdM) {
    return setTreadContactValidity(target, {
      valid: false, state: 'airborne', reason: 'airborne',
      supportAlignment: q(supportAlignment),
      geometricProximity: requestedCompressionM > -reachToleranceM,
      bottomedOut: false
    });
  }
  const bottomedOut = requestedCompressionM >= suspensionTravelM - EPSILON;
  return setTreadContactValidity(target, {
    valid: true,
    state: bottomedOut ? 'full-bump-support' : 'valid-suspension-support',
    reason: null,
    supportAlignment: q(supportAlignment),
    geometricProximity: true,
    bottomedOut
  });
}
