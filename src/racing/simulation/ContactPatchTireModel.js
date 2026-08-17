import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';
import { PowertrainModel } from './PowertrainModel.js';
import { rotateVectorByQuaternion } from './RigidBodyMath.js';
import { solveSuspensionGeometry } from './SuspensionGeometry.js';
import {
  createContactFootprintScratch,
  resolveContactFootprint
} from './ContactFootprint.js';
import { resolveCompoundSurfaceGrip } from './SurfaceConditionGrip.js';
import { createInvalidSurfaceSample, createSurfaceSample } from './SurfaceSample.js';

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

function resolveTreadContactValidity({
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
  if (requestedCompressionM <= EPSILON) {
    return setTreadContactValidity(target, {
      valid: false, state: 'airborne', reason: 'airborne',
      supportAlignment: q(supportAlignment), geometricProximity: true, bottomedOut: false
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

function classifyWheelContact(contactValidity) {
  if (contactValidity.state === 'full-bump-support') return 'full-bump-support';
  if (contactValidity.valid) return 'tread-support';
  if (contactValidity.reason === 'sidewall-normal') return 'sidewall-contact';
  if (contactValidity.reason === 'body-occluded') return 'body-contact';
  return contactValidity.state || 'unsupported-suspension';
}

export function getAckermannSteeringAngles({
  steeringAngleRad = 0,
  wheelbaseM = 2.65,
  frontTrackWidthM = 1.58,
  ackermannRatio = 1,
  steeringRackRatio = 1,
  target = null
} = {}) {
  const output = target && typeof target === 'object' ? target : {};
  const center = Number(steeringAngleRad || 0) * Math.max(0.01, Number(steeringRackRatio) || 1);
  if (Math.abs(center) < EPSILON) {
    output.fl = 0;
    output.fr = 0;
    output.rl = 0;
    output.rr = 0;
    return output;
  }
  const sign = Math.sign(center);
  const radius = Math.max(frontTrackWidthM * 0.51, wheelbaseM / Math.max(EPSILON, Math.tan(Math.abs(center))));
  const inner = Math.atan(wheelbaseM / Math.max(0.01, radius - frontTrackWidthM * 0.5));
  const outer = Math.atan(wheelbaseM / (radius + frontTrackWidthM * 0.5));
  const ratio = clamp(Number(ackermannRatio) || 0, 0, 1.5);
  const blend = (angle) => center + (sign * angle - center) * ratio;
  output.fl = q(blend(sign > 0 ? outer : inner));
  output.fr = q(blend(sign > 0 ? inner : outer));
  output.rl = 0;
  output.rr = 0;
  return output;
}

export function calculateAuthoritativeSteeringEnvelope(state = {}, config = {}) {
  const front = ['fl', 'fr'].map((wheelId) => state.contactPatches?.[wheelId]).filter((patch) => (
    Number(patch?.normalLoadN || 0) > 1
  ));
  const maximumAngleRad = Math.max(0.05, Number(config.maxSteerAngleRad) || 0.52);
  const speedMps = Math.max(0, Number(state.groundSpeedMps
    ?? Math.hypot(Number(state.velocity?.x || 0), Number(state.velocity?.z || 0))) || 0);
  if (speedMps < 1) return maximumAngleRad;
  if (!front.length) return 0.002;
  let supportedLoadN = 0;
  let supportedSuspensionLoadN = 0;
  front.forEach((patch) => {
    const loadN = Math.max(0, Number(patch.normalLoadN || 0));
    const suspensionLoadN = Math.max(loadN, Number(patch.suspensionNormalLoadN || loadN));
    supportedLoadN += loadN;
    supportedSuspensionLoadN += suspensionLoadN;
  });
  const contactScale = front.length / 2;
  const frontReferenceLoadN = Math.max(1, Number(config.massKg || 1450) * 9.81
    * clamp(Number(config.frontWeightDistribution ?? 0.55), 0.3, 0.75));
  const loadSupportScale = clamp(supportedLoadN / frontReferenceLoadN, 0, 1);
  const aquaplaningSupport = clamp(
    supportedLoadN / Math.max(1, supportedSuspensionLoadN), 0, 1
  );
  // The controller envelope is a safety limit, not a no-slip target. Tire
  // utilization and surface mu must remain free to create saturation and
  // understeer after the rack has received the driver's command.
  const speedEnvelope = maximumAngleRad / (
    1 + Math.pow(speedMps / Math.max(8, Number(config.steeringEnvelopeSpeedMps || 23)), 1.35)
  );
  const contactAuthority = contactScale * clamp(loadSupportScale / 0.35, 0, 1);
  const hydroAuthority = clamp((aquaplaningSupport - 0.12) / 0.58, 0, 1);
  return clamp(speedEnvelope * contactAuthority * hydroAuthority, 0.002, maximumAngleRad);
}

export function classifySteeringResponseTelemetry(telemetry = {}) {
  const intent = Math.abs(Number(telemetry.inputIntent || 0));
  const target = Math.abs(Number(telemetry.steeringTarget || 0));
  const output = Math.abs(Number(telemetry.controllerFilterOutput || 0));
  const requested = Math.abs(Number(telemetry.requestedRackAngleRad || 0));
  const permitted = Math.abs(Number(telemetry.permittedRackAngleRad || 0));
  const utilization = Math.max(0, ...Object.values(telemetry.frontUtilization || {}).map(Number));
  const longitudinalUse = Math.max(0, ...Object.values(telemetry.throttleFrictionCircleUse || {}).map(Number));
  const grip = Object.values(telemetry.frontGripCoefficients || {}).map(Number).filter(Number.isFinite);
  if (intent > 0.2 && target > 0.1 && output < target * 0.65) return 'input-latency';
  if (requested > 0.01 && permitted < requested * 0.75) return 'steering-envelope-limitation';
  if (telemetry.escInterventionActive === true) return 'esc-intervention';
  if (longitudinalUse > 0.55 && utilization > 0.82) return 'drivetrain-understeer';
  if (utilization > 0.92) return 'front-tire-saturation';
  if (grip.length && grip.reduce((sum, value) => sum + value, 0) / grip.length < 0.45) {
    return 'insufficient-surface-grip';
  }
  return 'responsive';
}

export function resolvePhysicalCenterSteeringAngle(controls = {}, config = {}, state = {}) {
  const maximumAngleRad = Math.max(0.05, Number(config.maxSteerAngleRad) || 0.52);
  const direct = String(config.handlingPreset || 'sport').toLowerCase() === 'simulation'
    || controls.steeringInputMode === 'simulation-wheel';
  if (direct) {
    return typeof controls.centerSteeringAngleRad === 'number'
      && Number.isFinite(controls.centerSteeringAngleRad)
      ? clamp(controls.centerSteeringAngleRad, -maximumAngleRad, maximumAngleRad)
      : clamp(Number(controls.steering) || 0, -1, 1) * maximumAngleRad;
  }
  if (!config.handlingPreset && !controls.steeringInputMode
    && typeof controls.centerSteeringAngleRad === 'number'
    && Number.isFinite(controls.centerSteeringAngleRad)) {
    return clamp(controls.centerSteeringAngleRad, -maximumAngleRad, maximumAngleRad);
  }
  const envelope = calculateAuthoritativeSteeringEnvelope(state, config)
    * (String(config.handlingPreset || 'sport').toLowerCase() === 'accessible' ? 1.08 : 1);
  return clamp(Number(controls.steering) || 0, -1, 1) * Math.min(maximumAngleRad, envelope);
}

export function getContactPatchMaterialGrip(material = {}) {
  if (Number.isFinite(Number(material.surfaceGripScale))) {
    return clamp(Number(material.surfaceGripScale), 0.025, 2);
  }
  if (material.trackStateConditionApplied === true) {
    return clamp(Number(
      material.effectiveGripMultiplier
      ?? material.effectiveGrip
      ?? material.grip
      ?? material.baseGrip
      ?? 1
    ), 0.025, 2);
  }
  const moisture = Math.max(0, Number(material.moistureDepthMm || 0));
  const snow = Math.max(0, Number(material.snowDepthMm || 0));
  const ice = Math.max(0, Number(material.iceDepthMm || 0));
  const marbles = clamp(Number(material.looseMarbles || 0), 0, 1);
  const dirt = clamp(Number(material.dirt || 0), 0, 1);
  const mud = clamp(Number(material.mud || 0), 0, 1);
  const oil = clamp(Number(material.oil || 0), 0, 1);
  const roughness = clamp(Number(material.roughness || 0), 0, 1);
  const rubber = clamp(Number(material.rubber || 0), 0, 1);
  const baseGrip = Math.max(0.03, Number(material.grip ?? material.baseGrip ?? 1));
  // Standing water is handled by the load-supporting aquaplaning model below.
  // Only the bonded damp film belongs in the surface friction coefficient.
  const contamination = (1 - clamp(moisture / 3, 0, 0.18))
    * (1 - clamp(snow / 45, 0, 0.72))
    * (1 - clamp(ice / 3, 0, 0.9))
    * (1 - marbles * 0.38)
    * (1 - dirt * 0.16)
    * (1 - mud * 0.48)
    * (1 - oil * 0.72);
  return clamp(baseGrip * contamination * (1 + rubber * 0.1) * (1 - roughness * 0.08), 0.025, 2);
}

export function calculateVelocitySensitiveDamperForce({
  relativeVelocityMps = 0,
  bumpDamperNsM = 0,
  reboundDamperNsM = 0,
  highSpeedThresholdMps = 0.25,
  highSpeedScale = 1
} = {}) {
  const velocityMps = Number(relativeVelocityMps) || 0;
  const speedMps = Math.abs(velocityMps);
  if (speedMps <= EPSILON) return 0;
  const lowSpeedDamperNsM = Math.max(0, velocityMps >= 0
    ? Number(bumpDamperNsM) || 0
    : Number(reboundDamperNsM) || 0);
  const thresholdMps = Math.max(EPSILON, Number(highSpeedThresholdMps) || 0.25);
  const highSpeedDamperNsM = lowSpeedDamperNsM * Math.max(0, Number(highSpeedScale) || 0);
  const lowSpeedVelocityMps = Math.min(speedMps, thresholdMps);
  const highSpeedVelocityMps = Math.max(0, speedMps - thresholdMps);
  const forceN = lowSpeedDamperNsM * lowSpeedVelocityMps
    + highSpeedDamperNsM * highSpeedVelocityMps;
  return q(Math.sign(velocityMps) * forceN);
}

export function calculateAquaplaningState({
  kinematics = {},
  normalLoadN = 0,
  tire = {},
  material = {},
  target = null
} = {}) {
  const loadN = Math.max(0, Number(normalLoadN) || 0);
  const waterDepthMm = Math.max(0, Number(
    material.standingWaterDepthMm ?? material.waterDepthMm ?? 0
  ));
  const widthM = clamp(Number(tire.widthMm ?? 245) / 1000, 0.12, 0.45);
  const pressurePsi = clamp(Number(tire.effectivePressurePsi ?? tire.pressurePsi ?? 32), 12, 70);
  const wear = clamp(Number(tire.wear || 0), 0, 1);
  const unwornTreadDepthMm = Number(tire.treadDepthMm ?? tire.compound?.treadDepthMm ?? 8);
  const treadDepthMm = clamp(unwornTreadDepthMm * (1 - wear * 0.8), 0.4, 14);
  const wetCharacteristic = clamp(Number(
    tire.wetEvacuationFactor
      ?? tire.compound?.wetEvacuationFactor
      ?? (/wet|rain/.test(String(tire.compound?.id || '')) ? 1.28 : 1)
  ), 0.45, 1.7);
  const longitudinalSpeedMps = Math.abs(Number(kinematics.longitudinalVelocityMps || 0));
  const rollingSpeedMps = Math.abs(Number(kinematics.wheelAngularVelocityRadps || 0)
    * Number(kinematics.effectiveRollingRadiusM || 0));
  const speedMps = Math.max(longitudinalSpeedMps, rollingSpeedMps);
  const signedSlipRatio = Number(kinematics.slipRatio || 0);
  const patchAreaM2 = loadN > 0 ? loadN / (pressurePsi * 6894.757) : 0;
  const patchLengthM = patchAreaM2 / widthM;
  const waterDemandM3ps = waterDepthMm / 1000 * widthM * speedMps
    * (1 + Math.min(2, Math.abs(signedSlipRatio)) * 0.3);
  const loadFactor = clamp(Math.sqrt(loadN / 3500), 0.35, 1.5);
  const pressureFactor = clamp(Math.sqrt(pressurePsi / 32), 0.62, 1.5);
  const evacuationCapacityM3ps = widthM * treadDepthMm / 1000
    * (2.2 + 0.42 * speedMps) * wetCharacteristic * loadFactor * pressureFactor;
  const demandRatio = waterDemandM3ps / Math.max(0.000001, evacuationCapacityM3ps);
  const immersion = clamp((waterDepthMm - 0.15) / 5.85, 0, 1);
  const onset = clamp((demandRatio - 0.72) / 1.5, 0, 1);
  const liftFraction = clamp(immersion * onset * onset * (3 - 2 * onset), 0, 0.94);
  const supportedNormalLoadN = loadN * (1 - liftFraction);
  const filmShear = 1 - liftFraction;
  const longitudinalForceScale = clamp(filmShear ** 1.1, 0.04, 1);
  const lateralForceScale = clamp(filmShear ** 1.35, 0.025, 1);
  const aligningTorqueScale = clamp(filmShear ** 1.7, 0.01, 1);
  const displacedWaterVolumeM3 = Math.min(waterDemandM3ps, evacuationCapacityM3ps)
    + Math.max(0, waterDemandM3ps - evacuationCapacityM3ps) * (1 - liftFraction) * 0.25;
  const output = target && typeof target === 'object' ? target : {};
  output.waterDepthMm = q(waterDepthMm);
  output.contactPatchAreaM2 = q(patchAreaM2, 9);
  output.contactPatchLengthM = q(patchLengthM);
  output.waterDemandM3ps = q(waterDemandM3ps, 9);
  output.evacuationCapacityM3ps = q(evacuationCapacityM3ps, 9);
  output.aquaplaningRatio = q(demandRatio);
  output.liftFraction = q(liftFraction);
  output.supportedNormalLoadN = q(supportedNormalLoadN);
  output.longitudinalForceScale = q(longitudinalForceScale);
  output.lateralForceScale = q(lateralForceScale);
  output.aligningTorqueScale = q(aligningTorqueScale);
  output.displacedWaterVolumeM3ps = q(displacedWaterVolumeM3, 9);
  return output;
}

export function calculateWheelContactKinematics({
  state,
  config,
  controls,
  environment,
  wheelId,
  surfaceNormalOverride = null,
  suspensionCompressionOverrideM = null,
  suspensionCompressionVelocityOverrideMps = null,
  camberOverrideRad = null,
  toeOverrideRad = null,
  target = null,
  computationScratch = null
}) {
  const front = wheelId[0] === 'f';
  const left = wheelId[1] === 'l';
  const track = front ? config.frontTrackWidthM : config.rearTrackWidthM;
  const suspensionTravelM = front ? config.suspensionTravelFrontM : config.suspensionTravelRearM;
  const staticSagRatio = front ? config.staticSagRatioFront : config.staticSagRatioRear;
  const staticSagTargetM = suspensionTravelM * staticSagRatio;
  const droopTravelM = staticSagTargetM;
  const bumpTravelM = suspensionTravelM - staticSagTargetM;
  const definition = front ? config.suspensionDefinitionFront : config.suspensionDefinitionRear;
  const suspensionAxisLocal = computationScratch
    ? normalizeInto(
        computationScratch.suspensionAxisLocal,
        vectorInto(
          computationScratch.vectorA,
          definition?.suspensionAxis,
          { x: 0, y: -1, z: 0 }
        ),
        { x: 0, y: -1, z: 0 }
      )
    : normalize(vector(definition?.suspensionAxis, { x: 0, y: -1, z: 0 }), {
        x: 0, y: -1, z: 0
      });
  const suspension = environment.suspensionStateByWheel?.[wheelId]
    || state.suspensionState?.[wheelId]
    || {};
  const compressionM = clamp(Number(
    suspensionCompressionOverrideM ?? suspension.compressionM ?? staticSagTargetM
  ), 0, suspensionTravelM);
  const compressionVelocityMps = Number(
    suspensionCompressionVelocityOverrideMps
      ?? suspension.compressionVelocityMps
      ?? suspension.unsprungVelocityMps
      ?? 0
  );
  const yaw = Number(state.yawRad || 0);
  const orientation = state.orientation || {
    x: 0,
    y: Math.sin(yaw * 0.5),
    z: 0,
    w: Math.cos(yaw * 0.5)
  };
  const normalizedOrientation = computationScratch
    ? normalizeQuaternionInto(orientation, computationScratch.normalizedOrientation)
    : null;
  const rotateInto = computationScratch
    ? (value, output) => rotateVectorByNormalizedQuaternionInto(
        value, normalizedOrientation, output
      )
    : (value) => rotateVectorByQuaternion(value, orientation);
  const staticHubOffset = computationScratch?.staticHubOffset || {};
  staticHubOffset.x = (left ? -0.5 : 0.5) * track;
  staticHubOffset.y = -config.cgHeightM + config.wheelRadiusM;
  staticHubOffset.z = front
    ? config.frontAxleDistanceFromCgM : -config.rearAxleDistanceFromCgM;
  const localOffset = computationScratch
    ? addInto(
        computationScratch.localOffset,
        staticHubOffset,
        scaleInto(
          computationScratch.vectorA,
          suspensionAxisLocal,
          staticSagTargetM - compressionM
        )
      )
    : add(staticHubOffset, scale(suspensionAxisLocal, staticSagTargetM - compressionM));
  const suspensionRestLengthM = front ? config.suspensionRestLengthFrontM : config.suspensionRestLengthRearM;
  const fullDroopHubOffset = computationScratch
    ? addInto(
        computationScratch.fullDroopHubOffset,
        staticHubOffset,
        scaleInto(computationScratch.vectorA, suspensionAxisLocal, staticSagTargetM)
      )
    : add(staticHubOffset, scale(suspensionAxisLocal, staticSagTargetM));
  const suspensionMountOffset = computationScratch
    ? addInto(
        computationScratch.suspensionMountOffset,
        fullDroopHubOffset,
        scaleInto(
          computationScratch.vectorA, suspensionAxisLocal, -suspensionRestLengthM
        )
      )
    : add(fullDroopHubOffset, scale(suspensionAxisLocal, -suspensionRestLengthM));
  const rotatedForward = rotateInto(
    computationScratch?.localForward || { x: 0, y: 0, z: 1 },
    computationScratch?.rotatedForward
  );
  const chassisForward = computationScratch
    ? normalizeInto(
        computationScratch.chassisForward, rotatedForward, { x: 0, y: 0, z: 1 }
      )
    : normalize(rotatedForward, { x: 0, y: 0, z: 1 });
  const rotatedRight = rotateInto(
    computationScratch?.localRight || { x: 1, y: 0, z: 0 },
    computationScratch?.rotatedRight
  );
  const chassisRight = computationScratch
    ? normalizeInto(
        computationScratch.chassisRight, rotatedRight, { x: 1, y: 0, z: 0 }
      )
    : normalize(rotatedRight, { x: 1, y: 0, z: 0 });
  const centerRadius = rotateInto(localOffset, computationScratch?.centerRadius);
  const center = computationScratch
    ? addInto(computationScratch.center, state.position, centerRadius)
    : add(vector(state.position), centerRadius);
  const mountRadius = rotateInto(suspensionMountOffset, computationScratch?.mountRadius);
  const mountPosition = computationScratch
    ? addInto(computationScratch.mountPosition, state.position, mountRadius)
    : add(vector(state.position), mountRadius);
  const rotatedSuspensionAxis = rotateInto(
    suspensionAxisLocal, computationScratch?.suspensionAxisWorld
  );
  const suspensionAxisWorld = computationScratch
    ? normalizeInto(
        computationScratch.suspensionAxisWorld,
        rotatedSuspensionAxis,
        { x: 0, y: -1, z: 0 }
      )
    : normalize(rotatedSuspensionAxis, { x: 0, y: -1, z: 0 });
  const normal = computationScratch
    ? normalizeInto(
        computationScratch.normal,
        vectorInto(
          computationScratch.vectorA,
          surfaceNormalOverride || environment.surfaceNormalByWheel?.[wheelId],
          { x: 0, y: 1, z: 0 }
        )
      )
    : normalize(vector(
        surfaceNormalOverride || environment.surfaceNormalByWheel?.[wheelId],
        { x: 0, y: 1, z: 0 }
      ));
  const centerSteeringAngleRad = resolvePhysicalCenterSteeringAngle(controls, config, state);
  const steeringAngles = getAckermannSteeringAngles({
    steeringAngleRad: centerSteeringAngleRad,
    wheelbaseM: config.wheelbaseM,
    frontTrackWidthM: config.frontTrackWidthM,
    ackermannRatio: config.ackermannRatio,
    // centerSteeringAngleRad is already the physical post-rack center angle.
    steeringRackRatio: 1,
    target: computationScratch?.steeringAngles
  });
  const steeringAngleRad = steeringAngles[wheelId] + Number(
    toeOverrideRad ?? environment.toeByWheel?.[wheelId] ?? 0
  );
  let rawForward;
  let wheelForward;
  let wheelLateral;
  let contactPoint;
  let radius;
  let angularVelocity;
  let hubRelativeVelocity;
  let hubVelocity;
  let mountVelocity;
  let contactVelocity;
  if (computationScratch) {
    rawForward = addInto(
      computationScratch.rawForward,
      scaleInto(computationScratch.vectorA, chassisForward, Math.cos(steeringAngleRad)),
      scaleInto(computationScratch.vectorB, chassisRight, Math.sin(steeringAngleRad))
    );
    const projectedDot = dot(rawForward, normal);
    const projectedForward = addInto(
      computationScratch.projectedForward,
      rawForward,
      scaleInto(computationScratch.vectorA, normal, -projectedDot)
    );
    wheelForward = normalizeInto(
      computationScratch.wheelForward, projectedForward, chassisForward
    );
    wheelLateral = normalizeInto(
      computationScratch.wheelLateral,
      crossInto(computationScratch.vectorA, normal, wheelForward),
      chassisRight
    );
    contactPoint = addInto(
      computationScratch.contactPoint,
      center,
      scaleInto(computationScratch.vectorA, normal, -config.wheelRadiusM)
    );
    radius = addInto(
      computationScratch.radius,
      contactPoint,
      scaleInto(computationScratch.vectorA, state.position, -1)
    );
    angularVelocity = vectorInto(
      computationScratch.angularVelocity,
      state.angularVelocityWorld,
      { x: 0, y: Number(state.yawRateRadps || 0), z: 0 }
    );
    hubRelativeVelocity = scaleInto(
      computationScratch.hubRelativeVelocity,
      suspensionAxisWorld,
      -compressionVelocityMps
    );
    hubVelocity = addInto(
      computationScratch.hubVelocity,
      addInto(
        computationScratch.vectorA,
        state.velocity,
        crossInto(computationScratch.vectorB, angularVelocity, centerRadius)
      ),
      hubRelativeVelocity
    );
    mountVelocity = addInto(
      computationScratch.mountVelocity,
      state.velocity,
      crossInto(computationScratch.vectorA, angularVelocity, mountRadius)
    );
    contactVelocity = addInto(
      computationScratch.contactVelocity,
      hubVelocity,
      crossInto(
        computationScratch.vectorA,
        angularVelocity,
        addInto(
          computationScratch.vectorB,
          radius,
          scaleInto(computationScratch.projectedForward, centerRadius, -1)
        )
      )
    );
  } else {
    rawForward = add(
      scale(chassisForward, Math.cos(steeringAngleRad)),
      scale(chassisRight, Math.sin(steeringAngleRad))
    );
    wheelForward = normalize(projectOnPlane(rawForward, normal), chassisForward);
    wheelLateral = normalize(cross(normal, wheelForward), chassisRight);
    contactPoint = add(center, scale(normal, -config.wheelRadiusM));
    radius = add(contactPoint, scale(vector(state.position), -1));
    angularVelocity = vector(state.angularVelocityWorld, {
      x: 0,
      y: Number(state.yawRateRadps || 0),
      z: 0
    });
    hubRelativeVelocity = scale(suspensionAxisWorld, -compressionVelocityMps);
    hubVelocity = add(
      add(vector(state.velocity), cross(angularVelocity, centerRadius)),
      hubRelativeVelocity
    );
    mountVelocity = add(vector(state.velocity), cross(angularVelocity, mountRadius));
    contactVelocity = add(
      hubVelocity,
      cross(angularVelocity, add(radius, scale(centerRadius, -1)))
    );
  }
  const longitudinalVelocityMps = dot(contactVelocity, wheelForward);
  const lateralVelocityMps = dot(contactVelocity, wheelLateral);
  const effectiveRollingRadiusM = config.wheelRadiusM * clamp(Number(environment.effectiveRadiusScaleByWheel?.[wheelId] ?? 1), 0.82, 1.05);
  const wheelAngularVelocityRadps = Number(state.wheelAngularVelocityRadps?.[wheelId] ?? longitudinalVelocityMps / effectiveRollingRadiusM);
  const rollingSpeedMps = wheelAngularVelocityRadps * effectiveRollingRadiusM;
  const slipRatio = (rollingSpeedMps - longitudinalVelocityMps)
    / Math.max(0.5, Math.abs(longitudinalVelocityMps), Math.abs(rollingSpeedMps) * 0.12);
  const slipAngleRad = Math.atan2(lateralVelocityMps, Math.max(0.35, Math.abs(longitudinalVelocityMps)));
  const camberAngleRad = Number(camberOverrideRad
    ?? environment.camberByWheel?.[wheelId]
    ?? (front ? config.camberFrontRad : config.camberRearRad));
  const output = target && typeof target === 'object' ? target : {};
  output.wheelId = wheelId;
  output.wheelCenterWorld = cleanVectorInto(output.wheelCenterWorld, center);
  output.hubPositionWorld = cleanVectorInto(output.hubPositionWorld, center);
  output.hubVelocityWorld = cleanVectorInto(output.hubVelocityWorld, hubVelocity);
  output.suspensionMountPositionWorld = cleanVectorInto(
    output.suspensionMountPositionWorld, mountPosition
  );
  output.suspensionMountVelocityWorld = cleanVectorInto(
    output.suspensionMountVelocityWorld, mountVelocity
  );
  output.suspensionAxisLocal = cleanVectorInto(output.suspensionAxisLocal, suspensionAxisLocal);
  output.suspensionAxisWorld = cleanVectorInto(output.suspensionAxisWorld, suspensionAxisWorld);
  output.suspensionCompressionM = q(compressionM);
  output.suspensionCompressionVelocityMps = q(compressionVelocityMps);
  output.suspensionRestLengthM = q(suspensionRestLengthM);
  output.suspensionDroopTravelM = q(droopTravelM);
  output.suspensionBumpTravelM = q(bumpTravelM);
  output.staticSagTargetM = q(staticSagTargetM);
  output.contactPointWorld = cleanVectorInto(output.contactPointWorld, contactPoint);
  output.steeringAngleRad = q(steeringAngleRad);
  output.wheelForwardWorld = cleanVectorInto(output.wheelForwardWorld, wheelForward);
  output.wheelLateralWorld = cleanVectorInto(output.wheelLateralWorld, wheelLateral);
  output.surfaceNormalWorld = cleanVectorInto(output.surfaceNormalWorld, normal);
  output.surfaceTangentForwardWorld = cleanVectorInto(
    output.surfaceTangentForwardWorld, wheelForward
  );
  output.surfaceTangentLateralWorld = cleanVectorInto(
    output.surfaceTangentLateralWorld, wheelLateral
  );
  output.contactVelocityWorld = cleanVectorInto(output.contactVelocityWorld, contactVelocity);
  output.longitudinalVelocityMps = q(longitudinalVelocityMps);
  output.lateralVelocityMps = q(lateralVelocityMps);
  output.slipRatio = q(slipRatio);
  output.slipAngleRad = q(slipAngleRad);
  output.camberAngleRad = q(camberAngleRad);
  output.wheelAngularVelocityRadps = q(wheelAngularVelocityRadps);
  output.effectiveRollingRadiusM = q(effectiveRollingRadiusM);
  return output;
}

function getTireGrip(tire, material, loadN, referenceLoadN) {
  const compound = tire.compound || {};
  const compoundGrip = Number(tire.compoundGrip ?? resolveCompoundSurfaceGrip(compound, material));
  const pressureDelta = Math.abs(Number(tire.effectivePressurePsi ?? tire.pressurePsi ?? 32)
    - Number(tire.targetPressurePsi ?? 32));
  const pressureScale = clamp(1 - pressureDelta * 0.009, 0.72, 1.05);
  const temperatureF = Number.isFinite(Number(tire.treadTemperatureC))
    ? Number(tire.treadTemperatureC) * 9 / 5 + 32
    : Number(tire.temperatureF ?? 180);
  const temperatureScale = temperatureF < 70 ? clamp(0.72 + temperatureF / 250, 0.72, 1) : temperatureF > 280 ? clamp(1 - (temperatureF - 280) / 300, 0.55, 1) : 1;
  const wearScale = clamp(1 - Number(tire.wear ?? 0) * 0.42, 0.5, 1);
  const damageScale = clamp(1 - Number(tire.damage ?? 0) / 150, 0.25, 1);
  const widthScale = clamp(Math.sqrt(Number(tire.widthMm ?? 245) / 245), 0.82, 1.18);
  const loadSensitivity = clamp(Math.pow(referenceLoadN / Math.max(1, loadN), Number(tire.loadSensitivityExponent ?? 0.08)), 0.72, 1.22);
  return clamp(compoundGrip * pressureScale * temperatureScale * wearScale * damageScale * widthScale
    * loadSensitivity * getContactPatchMaterialGrip(material), 0.02, 2.2);
}

export function calculateBrushTireForce({
  kinematics,
  normalLoadN,
  tire = {},
  material = {},
  target = null
}) {
  const load = Math.max(0, Number(normalLoadN || 0));
  const output = target && typeof target === 'object' ? target : {};
  if (load <= 0.01) {
    output.longitudinalForceN = 0;
    output.lateralForceN = 0;
    output.combinedSlipLimitN = 0;
    output.selfAligningMomentNm = 0;
    output.pneumaticTrailM = 0;
    output.rollingResistanceN = 0;
    output.postPeakSlidingForceN = 0;
    output.utilization = 0;
    output.gripCoefficient = 0;
    return output;
  }
  const referenceLoad = Math.max(1, Number(tire.referenceLoadN || load));
  const camberContactScale = clamp(
    1 - Math.abs(Number(kinematics.camberAngleRad || 0)) * 1.45,
    0.82,
    1
  );
  const mu = getTireGrip(tire, material, load, referenceLoad) * camberContactScale;
  const limit = mu * load;
  const widthScale = clamp(Number(tire.widthMm ?? 245) / 245, 0.7, 1.4);
  const pressureScale = clamp(32 / Math.max(18, Number(tire.effectivePressurePsi
    ?? tire.pressurePsi ?? 32)), 0.7, 1.35);
  const longitudinalStiffness = Math.max(1000, Number(tire.longitudinalStiffnessN || referenceLoad * 18) * widthScale);
  const corneringStiffness = Math.max(1000, Number(tire.corneringStiffnessNPerRad || referenceLoad * 17) * widthScale * pressureScale);
  const camberStiffness = Math.max(0, Number(tire.camberStiffnessNPerRad || referenceLoad * 0.65));
  const contactMotionMps = Math.max(
    Math.abs(Number(kinematics.longitudinalVelocityMps || 0)),
    Math.abs(Number(kinematics.lateralVelocityMps || 0)),
    Math.abs(Number(kinematics.wheelAngularVelocityRadps || 0) * Number(kinematics.effectiveRollingRadiusM || 0))
  );
  const camberActivation = contactMotionMps
    / Math.sqrt(contactMotionMps * contactMotionMps + 0.25 * 0.25);
  const rawDemandX = longitudinalStiffness * Number(kinematics.slipRatio || 0);
  const rawDemandY = -corneringStiffness * Math.tan(Number(kinematics.slipAngleRad || 0))
    + camberStiffness * Number(kinematics.camberAngleRad || 0) * camberActivation;
  const naturalPeakSlip = 3 * limit / longitudinalStiffness;
  const configuredPeakSlip = Number(tire.peakSlip);
  const peakSlipScale = Number.isFinite(configuredPeakSlip) && configuredPeakSlip > EPSILON
    ? naturalPeakSlip / configuredPeakSlip
    : 1;
  const demandX = rawDemandX * peakSlipScale;
  const demandY = rawDemandY * peakSlipScale;
  const demand = Math.hypot(demandX, demandY);
  const slidingFrictionRatio = clamp(Number(tire.slidingFrictionRatio ?? 0.66), 0.35, 1);
  const postPeakFalloff = clamp(Number(tire.postPeakFalloff ?? 1.8), 0.1, 8);
  const transition = Math.max(EPSILON, 3 * limit);
  let magnitude;
  let postPeakSlidingForceN = limit;
  if (demand <= transition) {
    const ratio = demand / transition;
    magnitude = demand * (1 - ratio + ratio * ratio / 3);
  } else {
    const excess = (demand - transition) / transition;
    // The squared exponent leaves both value and first derivative continuous
    // at the brush/sliding boundary: F(0)=limit and dF/d(excess)(0)=0.
    postPeakSlidingForceN = limit * (
      slidingFrictionRatio
      + (1 - slidingFrictionRatio) * Math.exp(-postPeakFalloff * excess * excess)
    );
    magnitude = postPeakSlidingForceN;
  }
  const directionScale = demand > EPSILON ? magnitude / demand : 0;
  const longitudinalForceN = demandX * directionScale;
  const lateralForceN = demandY * directionScale;
  const utilization = limit > EPSILON ? Math.hypot(longitudinalForceN, lateralForceN) / limit : 0;
  const contactLengthM = clamp(Number(tire.contactPatchLengthM || 0.16) * Math.sqrt(load / referenceLoad), 0.06, 0.3);
  const pneumaticTrailM = contactLengthM / 3 * Math.max(0, 1 - Math.min(1, utilization) ** 1.7);
  const selfAligningMomentNm = -lateralForceN * pneumaticTrailM;
  const rollingCoefficient = Math.max(0, Number(tire.rollingResistanceCoefficient ?? 0.012))
    * (1 + Number(material.roughness || 0) * 0.7 + Number(material.mud || 0) * 1.2);
  const rollingResistanceN = load * rollingCoefficient;
  output.longitudinalForceN = q(longitudinalForceN);
  output.lateralForceN = q(lateralForceN);
  output.combinedSlipLimitN = q(limit);
  output.selfAligningMomentNm = q(selfAligningMomentNm);
  output.pneumaticTrailM = q(pneumaticTrailM);
  output.rollingResistanceN = q(rollingResistanceN);
  output.postPeakSlidingForceN = q(postPeakSlidingForceN);
  output.utilization = q(utilization);
  output.gripCoefficient = q(mu);
  return output;
}

function applyAntiRollTransfer(
  wheelInputs,
  leftId,
  rightId,
  antiRollNormalized,
  physicalStiffnessNpm,
  config
) {
  const left = wheelInputs[leftId];
  const right = wheelInputs[rightId];
  if (!left || !right) return;
  const travelM = (left.suspensionTravelM + right.suspensionTravelM) * 0.5;
  const compressionDeltaM = Number(left.compressionM || 0) - Number(right.compressionM || 0);
  const authoredRollScale = clamp(config.rollStiffnessNormalized / 0.76, 0.5, 1.75);
  const requestedTransferN = clamp(
    physicalStiffnessNpm > 0
      ? compressionDeltaM * physicalStiffnessNpm
      : (compressionDeltaM / Math.max(0.05, travelM)) * config.massKg * 9.81
        * (0.065 + antiRollNormalized * 0.26) * authoredRollScale,
    -config.massKg * 9.81 * 0.22,
    config.massKg * 9.81 * 0.22
  );
  const transferN = requestedTransferN >= 0
    ? Math.min(requestedTransferN, Number(right.normalLoadN || 0))
    : Math.max(requestedTransferN, -Number(left.normalLoadN || 0));
  left.antiRollLoadTransferN = transferN;
  right.antiRollLoadTransferN = -transferN;
  left.normalLoadN = Math.max(0, Number(left.normalLoadN || 0) + transferN);
  right.normalLoadN = Math.max(0, Number(right.normalLoadN || 0) - transferN);
}

export class ContactPatchTireModel {
  constructor() {
    this.stepScratchCursor = 0;
    this.stepScratch = Array.from({ length: 8 }, () => ({
      outputs: {},
      wheelLoadsN: {},
      wheelSlip: {},
      suspensionTravel: {},
      tireForcesN: {},
      wheelAngularVelocityRadps: {},
      wheelAngularMomentumReactionImpulseWorldNms: {},
      suspensionState: {},
      wheelInputs: {},
      geometryByWheel: { fl: {}, fr: {}, rl: {}, rr: {} },
      fallbackMaterialByWheel: {
        fl: { grip: 1 }, fr: { grip: 1 }, rl: { grip: 1 }, rr: { grip: 1 }
      },
      worldForce: { x: 0, y: 0, z: 0 },
      worldMoment: { x: 0, y: 0, z: 0 },
      suspensionForce: { x: 0, y: 0, z: 0 },
      forceWorldByWheel: {
        fl: { x: 0, y: 0, z: 0 }, fr: { x: 0, y: 0, z: 0 },
        rl: { x: 0, y: 0, z: 0 }, rr: { x: 0, y: 0, z: 0 }
      },
      radiusByWheel: {
        fl: { x: 0, y: 0, z: 0 }, fr: { x: 0, y: 0, z: 0 },
        rl: { x: 0, y: 0, z: 0 }, rr: { x: 0, y: 0, z: 0 }
      },
      normalForceByWheel: {
        fl: { x: 0, y: 0, z: 0 }, fr: { x: 0, y: 0, z: 0 },
        rl: { x: 0, y: 0, z: 0 }, rr: { x: 0, y: 0, z: 0 }
      },
      reactionImpulseByWheel: {
        fl: { x: 0, y: 0, z: 0 }, fr: { x: 0, y: 0, z: 0 },
        rl: { x: 0, y: 0, z: 0 }, rr: { x: 0, y: 0, z: 0 }
      },
      footprintSurfaceSampleByWheel: {
        fl: createMutableSurfaceSampleTarget(), fr: createMutableSurfaceSampleTarget(),
        rl: createMutableSurfaceSampleTarget(), rr: createMutableSurfaceSampleTarget()
      },
      iterativeSurfaceSamplesByWheel: {
        fl: Array.from({ length: 3 }, createMutableSurfaceSampleTarget),
        fr: Array.from({ length: 3 }, createMutableSurfaceSampleTarget),
        rl: Array.from({ length: 3 }, createMutableSurfaceSampleTarget),
        rr: Array.from({ length: 3 }, createMutableSurfaceSampleTarget)
      },
      iterativeQueryPositionByWheel: {
        fl: { x: 0, y: 0, z: 0 }, fr: { x: 0, y: 0, z: 0 },
        rl: { x: 0, y: 0, z: 0 }, rr: { x: 0, y: 0, z: 0 }
      },
      iterativeQueryByWheel: {
        fl: { wheelId: 'fl', query: 'iterative-tread-contact', iteration: 0, target: null },
        fr: { wheelId: 'fr', query: 'iterative-tread-contact', iteration: 0, target: null },
        rl: { wheelId: 'rl', query: 'iterative-tread-contact', iteration: 0, target: null },
        rr: { wheelId: 'rr', query: 'iterative-tread-contact', iteration: 0, target: null }
      },
      contactFootprintScratchByWheel: {
        fl: createContactFootprintScratch(),
        fr: createContactFootprintScratch(),
        rl: createContactFootprintScratch(),
        rr: createContactFootprintScratch()
      },
      contactFootprintOptions: { maxGapM: 0.045, minimumSamples: 4 }
    }));
    for (let scratchIndex = 0; scratchIndex < this.stepScratch.length; scratchIndex += 1) {
      const scratch = this.stepScratch[scratchIndex];
      scratch.validTreadContactByWheel = {};
      scratch.invalidContactReasonByWheel = {};
      scratch.geometricTerrainProximityByWheel = {};
      scratch.contactTypeByWheel = {};
      scratch.copiedDriveShareByWheel = {};
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const wheelId = RACE_WHEEL_IDS[wheelIndex];
        const kinematicsScratch = createWheelContactKinematicsScratch();
        scratch.wheelAngularMomentumReactionImpulseWorldNms[wheelId] = {
          x: 0, y: 0, z: 0
        };
        scratch.wheelInputs[wheelId] = {
          tire: {},
          relaxedKinematics: {},
          relativeHubVelocityWorld: { x: 0, y: 0, z: 0 },
          tireTransition: {},
          aquaplaning: {},
          brushTire: {},
          force: {},
          kinematicsTarget: kinematicsScratch.target,
          kinematicsComputationScratch: kinematicsScratch.computation,
          kinematicsRequest: {},
          suspensionGeometryRequest: {},
          initialContactValidityRequest: {},
          contactValidityRequest: {},
          damperRequest: {},
          aquaplaningRequest: {},
          brushForceRequest: {},
          initialContactValidity: {},
          contactValidity: {}
        };
        scratch.suspensionState[wheelId] = {};
        scratch.tireForcesN[wheelId] = { longitudinal: 0, lateral: 0 };
        scratch.outputs[wheelId] = {
          localForceN: { longitudinal: 0, lateral: 0, normal: 0 },
          worldForceN: { x: 0, y: 0, z: 0 },
          tireEnergyWork: {},
          chassisWheelReactionImpulseWorldNms: { x: 0, y: 0, z: 0 },
          tireParameters: {},
          material: {}
        };
      }
      scratch.steeringTelemetry = {
        actualWheelAnglesRad: {},
        frontLoadsN: {},
        frontGripCoefficients: {},
        frontUtilization: {},
        frontSlipAnglesRad: {},
        frontLateralForceN: {},
        throttleFrictionCircleUse: {},
        aquaplaningSupport: {}
      };
      scratch.capacityByWheel = {};
      scratch.kinematicsByWheel = {};
      scratch.drivetrainCapacityRequest = {};
      scratch.powertrainStepRequest = {};
      scratch.powertrainTuning = {};
      scratch.powertrainControls = {};
      scratch.fallbackDamage = { engine: null, transmission: null, brakes: null };
      scratch.result = {
        worldForceN: { x: 0, y: 0, z: 0 },
        worldMomentNm: { x: 0, y: 0, z: 0 },
        suspensionForceWorldN: { x: 0, y: 0, z: 0 },
        validTreadContactByWheel: scratch.validTreadContactByWheel,
        invalidContactReasonByWheel: scratch.invalidContactReasonByWheel,
        geometricTerrainProximityByWheel: scratch.geometricTerrainProximityByWheel,
        contactTypeByWheel: scratch.contactTypeByWheel,
        driveForceShareByWheel: scratch.copiedDriveShareByWheel,
        steeringTelemetry: scratch.steeringTelemetry,
        wheelLoadsN: scratch.wheelLoadsN,
        wheelSlip: scratch.wheelSlip,
        suspensionTravel: scratch.suspensionTravel,
        suspensionState: scratch.suspensionState,
        tireForcesN: scratch.tireForcesN,
        wheelAngularVelocityRadps: scratch.wheelAngularVelocityRadps,
        wheelAngularMomentumReactionImpulseWorldNms:
          scratch.wheelAngularMomentumReactionImpulseWorldNms,
        contactPatches: scratch.outputs
      };
    }
  }

  step({ state, controls, config, environment = {}, dt = 0 }) {
    const physicsCosts = environment.physicsCostAccounting || null;
    const drivenWheelIds = config.drivenWheelIds || [];
    const centerSteeringAngleRad = resolvePhysicalCenterSteeringAngle(controls, config, state);
    const scratch = this.stepScratch[this.stepScratchCursor++ % this.stepScratch.length];
    const outputs = scratch.outputs;
    const wheelLoadsN = scratch.wheelLoadsN;
    const wheelSlip = scratch.wheelSlip;
    const suspensionTravel = scratch.suspensionTravel;
    const tireForcesN = scratch.tireForcesN;
    const wheelAngularVelocityRadps = scratch.wheelAngularVelocityRadps;
    const wheelAngularMomentumReactionImpulseWorldNms =
      scratch.wheelAngularMomentumReactionImpulseWorldNms;
    const suspensionState = scratch.suspensionState;
    const worldForce = scratch.worldForce;
    const worldMoment = scratch.worldMoment;
    const suspensionForce = scratch.suspensionForce;
    worldForce.x = 0;
    worldForce.y = 0;
    worldForce.z = 0;
    worldMoment.x = 0;
    worldMoment.y = 0;
    worldMoment.z = 0;
    suspensionForce.x = 0;
    suspensionForce.y = 0;
    suspensionForce.z = 0;
    let sampledSurfaceHeightSum = 0;
    let sampledSurfaceHeightCount = 0;
    const wheelInputs = scratch.wheelInputs;
    scratch.contactFootprintOptions.maxGapM = config.contactFootprintMaxGapM;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const sampledHeight = Number(environment.surfaceHeightByWheel?.[wheelId]);
      if (Number.isFinite(sampledHeight)) {
        sampledSurfaceHeightSum += sampledHeight;
        sampledSurfaceHeightCount += 1;
      }
      const front = wheelId[0] === 'f';
      const staticLoad = config.massKg * 9.81
        * (front ? config.frontWeightDistribution : 1 - config.frontWeightDistribution) / 2;
      const springRateNpm = front
        ? config.suspensionSpringRateFrontNpm
        : config.suspensionSpringRateRearNpm;
      const suspensionTravelM = front
        ? config.suspensionTravelFrontM
        : config.suspensionTravelRearM;
      const staticSagRatio = front ? config.staticSagRatioFront : config.staticSagRatioRear;
      const staticSagTargetM = suspensionTravelM * staticSagRatio;
      const droopTravelM = staticSagTargetM;
      const bumpTravelM = suspensionTravelM - staticSagTargetM;
      const footprint = resolveContactFootprint(
        environment.contactSamplesByWheel?.[wheelId] || [],
        scratch.contactFootprintOptions,
        scratch.contactFootprintScratchByWheel[wheelId]
      );
      const explicitSurfaceSample = environment.surfaceSamplesByWheel?.[wheelId];
      const legacyHeight = environment.surfaceHeightByWheel?.[wheelId];
      let footprintSurfaceSample = null;
      if (footprint.heightM !== null) {
        footprintSurfaceSample = scratch.footprintSurfaceSampleByWheel[wheelId];
        let footprintTriangleId = null;
        for (let sampleIndex = 0; sampleIndex < footprint.samples.length; sampleIndex += 1) {
          const candidateTriangleId = footprint.samples[sampleIndex]?.triangleId;
          if (!Number.isFinite(Number(candidateTriangleId))) continue;
          footprintTriangleId = candidateTriangleId;
          break;
        }
        footprintSurfaceSample.valid = true;
        footprintSurfaceSample.heightM = footprint.heightM;
        footprintSurfaceSample.elevation = footprint.heightM;
        footprintSurfaceSample.normal.x = footprint.normal.x;
        footprintSurfaceSample.normal.y = footprint.normal.y;
        footprintSurfaceSample.normal.z = footprint.normal.z;
        footprintSurfaceSample.region = explicitSurfaceSample?.region ?? null;
        footprintSurfaceSample.source = 'contact-footprint';
        footprintSurfaceSample.triangleId = footprintTriangleId;
        footprintSurfaceSample.queryPosition = explicitSurfaceSample?.queryPosition || null;
        footprintSurfaceSample.reason = null;
      }
      let surfaceSample = footprintSurfaceSample || (isResolvedSurfaceSample(explicitSurfaceSample)
        ? explicitSurfaceSample
        : createSurfaceSample(explicitSurfaceSample || {
          heightM: legacyHeight,
          normal: environment.surfaceNormalByWheel?.[wheelId] || { x: 0, y: 1, z: 0 },
          source: 'legacy-wheel-height'
        },
        { defaultNormal: { x: 0, y: 1, z: 0 }, source: 'wheel-surface' }));
      const contactScaleForFootprint = footprint.heightM === null ? Number(
        environment.contactScaleByWheel?.[wheelId]
          ?? (environment.grounded === false ? 0 : 1)
      ) : footprint.supportedFraction;
      const wheelRequestScratch = wheelInputs[wheelId];
      const kinematicsRequest = wheelRequestScratch.kinematicsRequest;
      kinematicsRequest.state = state;
      kinematicsRequest.config = config;
      kinematicsRequest.controls = controls;
      kinematicsRequest.environment = environment;
      kinematicsRequest.wheelId = wheelId;
      kinematicsRequest.surfaceNormalOverride = surfaceSample.valid ? surfaceSample.normal : null;
      kinematicsRequest.suspensionCompressionOverrideM = undefined;
      kinematicsRequest.suspensionCompressionVelocityOverrideMps = undefined;
      kinematicsRequest.camberOverrideRad = undefined;
      kinematicsRequest.toeOverrideRad = undefined;
      kinematicsRequest.target = wheelRequestScratch.kinematicsTarget;
      kinematicsRequest.computationScratch = wheelRequestScratch.kinematicsComputationScratch;
      let kinematics = calculateWheelContactKinematics(kinematicsRequest);
      let contactSolveIterationCount = 0;
      if (typeof environment.sampleTerrainAtWorldPoint === 'function') {
        const iterativeContactTimer = physicsCosts?.start('iterativeTireContactSolving');
        let previousSample = surfaceSample;
        const queryPosition = scratch.iterativeQueryPositionByWheel[wheelId];
        const iterativeQuery = scratch.iterativeQueryByWheel[wheelId];
        const iterativeTargets = scratch.iterativeSurfaceSamplesByWheel[wheelId];
        const maximumContactIterations = environment.reuseContactGeometry === true ? 1 : 3;
        for (let iteration = 0; iteration < maximumContactIterations; iteration += 1) {
          queryPosition.x = Number(kinematics.contactPointWorld.x || 0);
          queryPosition.y = Number(kinematics.contactPointWorld.y || 0);
          queryPosition.z = Number(kinematics.contactPointWorld.z || 0);
          iterativeQuery.iteration = iteration;
          iterativeQuery.target = iterativeTargets[iteration];
          const rawQueriedSample = environment.sampleTerrainAtWorldPoint(
            queryPosition,
            iterativeQuery
          );
          const queriedSample = isResolvedSurfaceSample(rawQueriedSample)
            ? rawQueriedSample
            : createSurfaceSample(rawQueriedSample, {
                queryPosition,
                source: 'iterative-tread-contact'
              });
          contactSolveIterationCount = iteration + 1;
          surfaceSample = queriedSample;
          if (!surfaceSample.valid) break;
          const heightDeltaM = previousSample.valid
            ? Math.abs(surfaceSample.heightM - previousSample.heightM) : Infinity;
          const normalDeltaRad = previousSample.valid
            ? Math.acos(clamp(dot(surfaceSample.normal, previousSample.normal), -1, 1))
            : Infinity;
          // A height-only refinement on the same prepared triangle cannot
          // change wheel axes or contact velocity. Avoid rebuilding the full
          // kinematic graph unless the authoritative surface normal changed.
          if (!previousSample.valid
            || surfaceSample.normal.x !== previousSample.normal.x
            || surfaceSample.normal.y !== previousSample.normal.y
            || surfaceSample.normal.z !== previousSample.normal.z) {
            kinematicsRequest.surfaceNormalOverride = surfaceSample.normal;
            kinematics = calculateWheelContactKinematics(kinematicsRequest);
          }
          previousSample = surfaceSample;
          if (heightDeltaM < 0.001 && normalDeltaRad < 0.5 * Math.PI / 180) break;
        }
        physicsCosts?.end(iterativeContactTimer);
      }
      const hasSurfaceHeight = surfaceSample.valid;
      const contactScale = clamp(contactScaleForFootprint, 0, 1);
      const surfaceHeightM = hasSurfaceHeight ? surfaceSample.heightM : null;
      const penetrationM = hasSurfaceHeight
        ? surfaceHeightM - Number(kinematics.contactPointWorld.y)
        : null;
      const contactVelocityNormalMps = dot(kinematics.contactVelocityWorld, kinematics.surfaceNormalWorld);
      const compressionVelocityMps = -contactVelocityNormalMps;
      const staticCompressionM = staticSagTargetM;
      const previousSuspension = state.suspensionState?.[wheelId] || {};
      const hasPreviousSuspensionState = Number.isFinite(Number(previousSuspension.compressionM));
      const previousCompressionM = clamp(
        Number(previousSuspension.compressionM ?? staticCompressionM),
        0,
        suspensionTravelM
      );
      const rawRequestedCompressionM = hasSurfaceHeight
        ? previousCompressionM + penetrationM
        : null;
      const initialValidityRequest = wheelRequestScratch.initialContactValidityRequest;
      initialValidityRequest.state = state;
      initialValidityRequest.config = config;
      initialValidityRequest.environment = environment;
      initialValidityRequest.wheelId = wheelId;
      initialValidityRequest.kinematics = kinematics;
      initialValidityRequest.surfaceSample = surfaceSample;
      initialValidityRequest.rawRequestedCompressionM = rawRequestedCompressionM;
      initialValidityRequest.suspensionTravelM = suspensionTravelM;
      initialValidityRequest.target = wheelRequestScratch.initialContactValidity;
      const initialContactValidity = resolveTreadContactValidity(initialValidityRequest);
      const clampedCompressionM = initialContactValidity.valid
        ? clamp(rawRequestedCompressionM, 0, suspensionTravelM)
        : null;
      const overtravelM = initialContactValidity.valid
        ? Math.max(0, Number(rawRequestedCompressionM) - suspensionTravelM) : 0;
      let unsprungVelocityMps = Number(previousSuspension.unsprungVelocityMps || 0);
      let compressionM = previousCompressionM;
      if (initialContactValidity.valid) {
        if (!hasPreviousSuspensionState) {
          compressionM = Number(clampedCompressionM);
          unsprungVelocityMps = 0;
        } else {
          const tireErrorM = Number(clampedCompressionM) - compressionM;
          const unsprungMassKg = Number(config.unsprungMassByWheelKg?.[wheelId] || config.unsprungMassKg);
          const normalizedUnsprungSpeed = unsprungVelocityMps / 0.32;
          const normalizedTireError = tireErrorM / 0.018;
          const lowSpeedTireModeBlend = Math.exp(-(normalizedUnsprungSpeed ** 2))
            * Math.exp(-(normalizedTireError ** 2));
          const effectiveTireVerticalDampingNsM = config.tireVerticalDampingNsM
            + (Math.min(6000, 2.8 * config.tireVerticalDampingNsM)
              - config.tireVerticalDampingNsM) * lowSpeedTireModeBlend;
          const tireForceN = tireErrorM * config.tireVerticalStiffnessNpm
            - unsprungVelocityMps * effectiveTireVerticalDampingNsM;
          unsprungVelocityMps += tireForceN / unsprungMassKg * dt;
          compressionM = clamp(compressionM + unsprungVelocityMps * dt, 0, suspensionTravelM);
          if (compressionM === 0 && unsprungVelocityMps < 0) unsprungVelocityMps = 0;
          if (compressionM === suspensionTravelM && unsprungVelocityMps > 0) {
            unsprungVelocityMps = 0;
          }
        }
        if (overtravelM > 0) {
          compressionM = suspensionTravelM;
          // The bump stop is a unilateral constraint. Retaining inward wheel
          // velocity here reloads the stop on the next substep and can create
          // an endless landing bounce even though the damper is dissipative.
          unsprungVelocityMps = Math.min(0, unsprungVelocityMps);
        }
      } else {
        unsprungVelocityMps -= 9.81 * dt;
        compressionM = Math.max(0, compressionM + unsprungVelocityMps * dt);
        if (compressionM === 0) unsprungVelocityMps = 0;
      }
      const geometryRequest = wheelRequestScratch.suspensionGeometryRequest;
      geometryRequest.definition = front
        ? config.suspensionDefinitionFront : config.suspensionDefinitionRear;
      geometryRequest.compressionM = compressionM - staticCompressionM;
      geometryRequest.steeringAngleRad = resolvePhysicalCenterSteeringAngle(
        controls, config, state
      );
      geometryRequest.staticCamberRad = front ? config.camberFrontRad : config.camberRearRad;
      geometryRequest.staticToeRad = front ? config.toeFrontRad : config.toeRearRad;
      geometryRequest.springRateNpm = springRateNpm;
      geometryRequest.target = scratch.geometryByWheel[wheelId];
      const geometry = solveSuspensionGeometry(geometryRequest);
      kinematicsRequest.surfaceNormalOverride = surfaceSample.valid ? surfaceSample.normal : null;
      kinematicsRequest.suspensionCompressionOverrideM = compressionM;
      kinematicsRequest.suspensionCompressionVelocityOverrideMps = unsprungVelocityMps;
      kinematicsRequest.camberOverrideRad = geometry.camberRad;
      kinematicsRequest.toeOverrideRad = geometry.toeRad;
      kinematics = calculateWheelContactKinematics(kinematicsRequest);
      const validityRequest = wheelRequestScratch.contactValidityRequest;
      validityRequest.state = state;
      validityRequest.config = config;
      validityRequest.environment = environment;
      validityRequest.wheelId = wheelId;
      validityRequest.kinematics = kinematics;
      validityRequest.hasSurfaceHeight = hasSurfaceHeight;
      validityRequest.surfaceSample = surfaceSample;
      validityRequest.rawRequestedCompressionM = rawRequestedCompressionM;
      validityRequest.suspensionTravelM = suspensionTravelM;
      validityRequest.target = wheelRequestScratch.contactValidity;
      const contactValidity = resolveTreadContactValidity(validityRequest);
      const geometricContact = contactValidity.valid && Number(clampedCompressionM) > EPSILON;
      const compressionRatio = compressionM / suspensionTravelM;
      const bumpTravelRatio = clamp(
        Math.max(0, compressionM - staticCompressionM) / Math.max(EPSILON, bumpTravelM),
        0,
        1
      );
      const progressiveRate = geometry.wheelRateNpm * (1 + config.progressiveSpringRate * bumpTravelRatio ** 2);
      const bumpStopStartM = staticCompressionM
        + bumpTravelM * config.bumpStopStartRatio;
      const bumpStopCompressionM = Math.max(0, compressionM - bumpStopStartM);
      const bumpStopRangeM = Math.max(EPSILON, suspensionTravelM - bumpStopStartM);
      const bumpStopForceN = compressionM > bumpStopStartM
        ? config.bumpStopRateNpm * bumpStopCompressionM
          * (1 + 2 * bumpStopCompressionM / bumpStopRangeM)
        : 0;
      const remainingBumpTravelM = Math.max(0, suspensionTravelM - compressionM);
      const maximumTireVerticalDeflectionM = Math.max(
        0.005,
        Number(config.maximumTireVerticalDeflectionM ?? config.wheelRadiusM * 0.12)
      );
      const tireVerticalDeflectionM = Math.min(overtravelM, maximumTireVerticalDeflectionM);
      const hardStopDeflectionM = Math.max(0, overtravelM - tireVerticalDeflectionM);
      const hardStopForceN = overtravelM > 0
        ? tireVerticalDeflectionM * config.tireVerticalStiffnessNpm
          + hardStopDeflectionM * config.hardStopRateNpm
          + Math.max(0, compressionVelocityMps) * config.tireVerticalDampingNsM
        : 0;
      const relativeHubVelocityWorld = wheelInputs[wheelId].relativeHubVelocityWorld;
      relativeHubVelocityWorld.x = Number(kinematics.hubVelocityWorld?.x ?? 0)
        + Number(kinematics.suspensionMountVelocityWorld?.x ?? 0) * -1;
      relativeHubVelocityWorld.y = Number(kinematics.hubVelocityWorld?.y ?? 0)
        + Number(kinematics.suspensionMountVelocityWorld?.y ?? 0) * -1;
      relativeHubVelocityWorld.z = Number(kinematics.hubVelocityWorld?.z ?? 0)
        + Number(kinematics.suspensionMountVelocityWorld?.z ?? 0) * -1;
      const suspensionAxisWorld = kinematics.suspensionAxisWorld || {};
      const suspensionAxisX = Number(suspensionAxisWorld.x ?? 0);
      const suspensionAxisY = Number(suspensionAxisWorld.y ?? -1);
      const suspensionAxisZ = Number(suspensionAxisWorld.z ?? 0);
      const suspensionRelativeVelocityMps = -(
        relativeHubVelocityWorld.x * suspensionAxisX
        + relativeHubVelocityWorld.y * suspensionAxisY
        + relativeHubVelocityWorld.z * suspensionAxisZ
      );
      const damperRateNsM = front
        ? (suspensionRelativeVelocityMps >= 0
          ? config.suspensionBumpDamperFrontNsM
          : config.suspensionReboundDamperFrontNsM)
        : (suspensionRelativeVelocityMps >= 0
          ? config.suspensionBumpDamperRearNsM
          : config.suspensionReboundDamperRearNsM);
      const damperRequest = wheelRequestScratch.damperRequest;
      damperRequest.relativeVelocityMps = suspensionRelativeVelocityMps;
      damperRequest.bumpDamperNsM = front
          ? config.suspensionBumpDamperFrontNsM
          : config.suspensionBumpDamperRearNsM;
      damperRequest.reboundDamperNsM = front
          ? config.suspensionReboundDamperFrontNsM
          : config.suspensionReboundDamperRearNsM;
      damperRequest.highSpeedThresholdMps = config.damperHighSpeedThresholdMps;
      damperRequest.highSpeedScale = config.damperHighSpeedScale;
      const damperForceN = calculateVelocitySensitiveDamperForce(damperRequest);
      const springDisplacementFromSagM = compressionM - staticCompressionM;
      const baseSuspensionLoadN = geometricContact
        ? staticLoad + progressiveRate * springDisplacementFromSagM
          + damperForceN
          + bumpStopForceN
          + hardStopForceN
        : hasSurfaceHeight ? 0 : null;
      const geometryPitchSupport = front
        ? geometry.antiDive * Number(controls.brake || 0)
          * clamp(Math.abs(kinematics.longitudinalVelocityMps) / 2, 0, 1) * 0.12
        : geometry.antiSquat * Number(controls.throttle || 0)
          * clamp(1 - Number(controls.clutch || 0), 0, 1)
          * clamp(Math.abs(kinematics.longitudinalVelocityMps) / 2, 0, 1) * 0.1;
      const suspensionLoadN = baseSuspensionLoadN === null
        ? null
        : baseSuspensionLoadN * (1 + geometryPitchSupport);
      const fallbackLoadN = environment.normalLoadByWheel?.[wheelId]
        ?? staticLoad * Number(environment.normalLoadScaleByWheel?.[wheelId] ?? 1);
      const maxNormalLoadN = staticLoad * config.maxSuspensionLoadFactor;
      const normalLoadN = clamp(
        Number(suspensionLoadN ?? fallbackLoadN),
        0,
        maxNormalLoadN
      ) * contactScale;
      const fallbackMaterial = scratch.fallbackMaterialByWheel[wheelId];
      fallbackMaterial.grip = environment.gripByWheel?.[wheelId] ?? 1;
      const material = environment.trackStateByWheel?.[wheelId]
        || environment.materialByWheel?.[wheelId]
        || fallbackMaterial;
      const configuredTire = config.tireByWheel?.[wheelId] || {};
      const environmentTire = environment.tireByWheel?.[wheelId] || {};
      const wheelInput = wheelInputs[wheelId];
      const tire = wheelInput.tire;
      for (const key in tire) delete tire[key];
      for (const key in configuredTire) tire[key] = configuredTire[key];
      for (const key in environmentTire) tire[key] = environmentTire[key];
      const tireState = state.tireState?.[wheelId] || {};
      tire.treadTemperatureC = tireState.treadTemperatureC ?? tire.treadTemperatureC;
      tire.carcassTemperatureC = tireState.carcassTemperatureC
        ?? tire.carcassTemperatureC;
      tire.internalAirTemperatureC = tireState.internalAirTemperatureC
        ?? tire.internalAirTemperatureC;
      tire.effectivePressurePsi = tireState.effectivePressurePsi
        ?? tire.effectivePressurePsi;
      tire.temperatureF = tireState.temperatureF ?? tire.temperatureF;
      tire.wear = tireState.wear ?? tire.wear;
      tire.damage = tire.damage ?? tireState.damage;
      wheelInput.kinematics = kinematics;
      wheelInput.normalLoadN = normalLoadN;
      wheelInput.staticLoadN = staticLoad;
      wheelInput.springRateNpm = springRateNpm;
      wheelInput.damperRateNsM = damperRateNsM;
      wheelInput.suspensionTravelM = suspensionTravelM;
      wheelInput.staticSagTargetM = staticSagTargetM;
      wheelInput.droopTravelM = droopTravelM;
      wheelInput.bumpTravelM = bumpTravelM;
      wheelInput.material = material;
      wheelInput.hasSurfaceHeight = hasSurfaceHeight;
      wheelInput.contactValidity = contactValidity;
      wheelInput.geometricContact = geometricContact;
      wheelInput.rawRequestedCompressionM = rawRequestedCompressionM;
      wheelInput.compressionM = compressionM;
      wheelInput.penetrationM = penetrationM;
      wheelInput.contactVelocityNormalMps = contactVelocityNormalMps;
      wheelInput.compressionVelocityMps = suspensionRelativeVelocityMps;
      wheelInput.unsprungVelocityMps = unsprungVelocityMps;
      wheelInput.geometry = geometry;
      wheelInput.footprint = footprint;
      wheelInput.surfaceSample = surfaceSample;
      wheelInput.contactSolveIterationCount = contactSolveIterationCount;
      wheelInput.progressiveRate = progressiveRate;
      wheelInput.bumpStopForceN = bumpStopForceN;
      wheelInput.hardStopForceN = hardStopForceN;
      wheelInput.tireVerticalDeflectionM = tireVerticalDeflectionM;
      wheelInput.remainingBumpTravelM = remainingBumpTravelM;
      wheelInput.overtravelM = overtravelM;
      wheelInput.clampedCompressionM = clampedCompressionM;
      wheelInput.damperForceN = damperForceN;
    }
    applyAntiRollTransfer(
      wheelInputs, 'fl', 'fr', config.antiRollFront, config.antiRollStiffnessFrontNpm, config
    );
    applyAntiRollTransfer(
      wheelInputs, 'rl', 'rr', config.antiRollRear, config.antiRollStiffnessRearNpm, config
    );
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const input = wheelInputs[wheelId];
      const rawKinematics = input.kinematics;
      const previousPatch = state.contactPatches?.[wheelId] || {};
      // Profiles can opt into a longer physical relaxation length. Keep the
      // compatibility default short so vehicles without authored tire data do
      // not acquire an unintended large transient lag.
      const relaxationLengthM = clamp(Number(input.tire.relaxationLengthM ?? 0.03), 0.03, 3);
      const peakSlip = clamp(Number(input.tire.peakSlip ?? 0.16), 0.03, 1.5);
      const breakawayHysteresis = clamp(Number(input.tire.breakawayHysteresis ?? 0.025), 0, 0.3);
      const recoveryHysteresis = clamp(Number(input.tire.recoveryHysteresis ?? 0.04), 0, 0.3);
      const rawCombinedSlip = Math.hypot(
        Number(rawKinematics.slipRatio || 0),
        Math.tan(Number(rawKinematics.slipAngleRad || 0))
      );
      const wasBrokenAway = previousPatch.breakawayActive === true;
      const breakawayActive = wasBrokenAway
        ? rawCombinedSlip > Math.max(0, peakSlip - recoveryHysteresis)
        : rawCombinedSlip > peakSlip + breakawayHysteresis;
      const contactTravelM = Math.max(
        0.5,
        Math.abs(Number(rawKinematics.longitudinalVelocityMps || 0)),
        Math.abs(Number(rawKinematics.wheelAngularVelocityRadps || 0)
          * Number(rawKinematics.effectiveRollingRadiusM || 0))
      ) * dt;
      const baseRelaxationAlpha = 1 - Math.exp(-contactTravelM / relaxationLengthM);
      const relaxationAlpha = clamp(
        baseRelaxationAlpha * (breakawayActive ? 1 : 1 - recoveryHysteresis * 1.5),
        0,
        1
      );
      const relaxedKinematics = input.relaxedKinematics;
      Object.assign(relaxedKinematics, rawKinematics);
      input.kinematics = relaxedKinematics;
      input.kinematics.slipRatio = Number(
        previousPatch.relaxedSlipRatio ?? rawKinematics.slipRatio
      ) + (Number(rawKinematics.slipRatio || 0)
        - Number(previousPatch.relaxedSlipRatio ?? rawKinematics.slipRatio)) * relaxationAlpha;
      input.kinematics.slipAngleRad = Number(
        previousPatch.relaxedSlipAngleRad ?? rawKinematics.slipAngleRad
      ) + (Number(rawKinematics.slipAngleRad || 0)
        - Number(previousPatch.relaxedSlipAngleRad ?? rawKinematics.slipAngleRad)) * relaxationAlpha;
      const tireTransition = input.tireTransition;
      tireTransition.rawSlipRatio = q(rawKinematics.slipRatio);
      tireTransition.rawSlipAngleRad = q(rawKinematics.slipAngleRad);
      tireTransition.relaxedSlipRatio = q(input.kinematics.slipRatio);
      tireTransition.relaxedSlipAngleRad = q(input.kinematics.slipAngleRad);
      tireTransition.relaxationLengthM = q(relaxationLengthM);
      tireTransition.breakawayHysteresis = q(breakawayHysteresis);
      tireTransition.recoveryHysteresis = q(recoveryHysteresis);
      tireTransition.breakawayActive = breakawayActive;
      const aquaplaningRequest = input.aquaplaningRequest;
      aquaplaningRequest.kinematics = input.kinematics;
      aquaplaningRequest.normalLoadN = input.normalLoadN;
      aquaplaningRequest.tire = input.tire;
      aquaplaningRequest.material = input.material;
      aquaplaningRequest.target = input.aquaplaning;
      calculateAquaplaningState(aquaplaningRequest);
      const brushTire = input.brushTire;
      for (const key in brushTire) delete brushTire[key];
      brushTire.referenceLoadN = input.staticLoadN;
      for (const key in input.tire) brushTire[key] = input.tire[key];
      const brushForceRequest = input.brushForceRequest;
      brushForceRequest.kinematics = input.kinematics;
      brushForceRequest.normalLoadN = input.aquaplaning.supportedNormalLoadN;
      brushForceRequest.tire = brushTire;
      brushForceRequest.material = input.material;
      brushForceRequest.target = input.force;
      const brushForce = calculateBrushTireForce(brushForceRequest);
      input.force.longitudinalForceN = q(
        brushForce.longitudinalForceN * input.aquaplaning.longitudinalForceScale
      );
      input.force.lateralForceN = q(
        brushForce.lateralForceN * input.aquaplaning.lateralForceScale
      );
      input.force.selfAligningMomentNm = q(
        brushForce.selfAligningMomentNm * input.aquaplaning.aligningTorqueScale
      );
      input.force.combinedSlipLimitN = q(brushForce.combinedSlipLimitN
        * Math.max(
          input.aquaplaning.longitudinalForceScale,
          input.aquaplaning.lateralForceScale
        ));
      input.force.aquaplaning = input.aquaplaning;
    }
    const capacityByWheel = scratch.capacityByWheel;
    const kinematicsByWheel = scratch.kinematicsByWheel;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      capacityByWheel[wheelId] = wheelInputs[wheelId].aquaplaning.supportedNormalLoadN
        * Math.max(0.1, Number(wheelInputs[wheelId].force.gripCoefficient || 1));
      kinematicsByWheel[wheelId] = wheelInputs[wheelId].kinematics;
    }
    const powertrainTuning = scratch.powertrainTuning;
    for (const key in powertrainTuning) delete powertrainTuning[key];
    powertrainTuning.torqueLbFt = Number(config.powertrainTuning?.torqueLbFt)
      || Number(config.enginePeakTorqueNm || 0) / 1.35582;
    powertrainTuning.idleRpm = config.idleRpm;
    powertrainTuning.revLimitRpm = config.maxRpm;
    powertrainTuning.torquePeakStartRpm = config.idleRpm
      + (config.maxRpm - config.idleRpm) * 0.35;
    powertrainTuning.torquePeakEndRpm = config.idleRpm
      + (config.maxRpm - config.idleRpm) * 0.68;
    powertrainTuning.torqueFalloffRpm = config.maxRpm;
    const configuredPowertrain = config.powertrainTuning || {};
    for (const key in configuredPowertrain) {
      powertrainTuning[key] = configuredPowertrain[key];
    }
    const mode = controls.throttle > 0.001 ? 'accel' : 'decel';
    const drivetrainCapacityRequest = scratch.drivetrainCapacityRequest;
    drivetrainCapacityRequest.tuning = powertrainTuning;
    drivetrainCapacityRequest.drivenWheelIds = config.drivenWheelIds;
    drivetrainCapacityRequest.capacityByWheel = capacityByWheel;
    drivetrainCapacityRequest.mode = mode;
    const drivetrainCapacity = powertrainModel.resolveDrivetrainCapacity(
      drivetrainCapacityRequest
    );
    const driveShareByWheel = drivetrainCapacity.forceShareByWheel;
    const powertrainControls = scratch.powertrainControls;
    for (const key in powertrainControls) delete powertrainControls[key];
    for (const key in controls) powertrainControls[key] = controls[key];
    powertrainControls.centerSteeringAngleRad = centerSteeringAngleRad;
    const fallbackDamage = scratch.fallbackDamage;
    fallbackDamage.engine = environment.engineDamage;
    fallbackDamage.transmission = environment.transmissionDamage;
    fallbackDamage.brakes = environment.brakeDamageByWheel;
    const powertrainStepRequest = scratch.powertrainStepRequest;
    powertrainStepRequest.tuning = powertrainTuning;
    powertrainStepRequest.config = config;
    powertrainStepRequest.controls = powertrainControls;
    powertrainStepRequest.previous = state.powertrainState || {};
    powertrainStepRequest.kinematicsByWheel = kinematicsByWheel;
    powertrainStepRequest.capacityByWheel = capacityByWheel;
    powertrainStepRequest.driveShareByWheel = driveShareByWheel;
    powertrainStepRequest.state = state;
    powertrainStepRequest.damage = environment.damage || fallbackDamage;
    powertrainStepRequest.dt = dt;
    const powertrainStep = powertrainModel.stepAuthoritativeWheelTorques(
      powertrainStepRequest
    );
    const powertrainGear = Math.trunc(Number(powertrainStep.state.gear || 0));
    const selectedGearRatio = powertrainGear < 0
      ? Math.abs(Number(powertrainTuning.reverseRatio || 0))
      : powertrainGear > 0
        ? Math.abs(Number(powertrainTuning.gearRatios?.[powertrainGear - 1] || 0))
        : 0;
    const finalDriveRatio = Math.abs(Number(
      powertrainTuning.gearFinalDrive || powertrainTuning.finalDrive || 1
    ));
    const overallDriveRatio = selectedGearRatio * finalDriveRatio;
    const maximumPoweredWheelOmegaRadps = overallDriveRatio > EPSILON
      ? (config.maxRpm * Math.PI * 2 / 60) / overallDriveRatio
        * (1 + clamp(Number(powertrainTuning.torqueConverterSlip || 0), 0, 0.25))
      : null;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const {
        kinematics, normalLoadN, force, hasSurfaceHeight, geometricContact, contactValidity,
        compressionM, contactVelocityNormalMps, suspensionTravelM,
        rawRequestedCompressionM, springRateNpm, damperRateNsM, antiRollLoadTransferN = 0
      } = wheelInputs[wheelId];
      const rollingVelocity = Number(kinematics.longitudinalVelocityMps || 0);
      const rollingSign = rollingVelocity / Math.sqrt(rollingVelocity * rollingVelocity + 0.25 * 0.25);
      let localLongitudinal = force.longitudinalForceN - force.rollingResistanceN * rollingSign;
      if (Number(controls.throttle || 0) <= 0.001
        && localLongitudinal * rollingVelocity > 0) {
        localLongitudinal = 0;
      }
      const forceWorld = scratch.forceWorldByWheel[wheelId];
      forceWorld.x = kinematics.wheelForwardWorld.x * localLongitudinal
        + kinematics.wheelLateralWorld.x * force.lateralForceN;
      forceWorld.y = kinematics.wheelForwardWorld.y * localLongitudinal
        + kinematics.wheelLateralWorld.y * force.lateralForceN;
      forceWorld.z = kinematics.wheelForwardWorld.z * localLongitudinal
        + kinematics.wheelLateralWorld.z * force.lateralForceN;
      const radius = scratch.radiusByWheel[wheelId];
      radius.x = kinematics.contactPointWorld.x - Number(state.position?.x ?? 0);
      radius.y = kinematics.contactPointWorld.y - Number(state.position?.y ?? 0);
      radius.z = kinematics.contactPointWorld.z - Number(state.position?.z ?? 0);
      const momentX = radius.y * forceWorld.z - radius.z * forceWorld.y;
      const momentY = radius.z * forceWorld.x - radius.x * forceWorld.z;
      const momentZ = radius.x * forceWorld.y - radius.y * forceWorld.x;
      const normalForceWorld = scratch.normalForceByWheel[wheelId];
      normalForceWorld.x = kinematics.surfaceNormalWorld.x * normalLoadN;
      normalForceWorld.y = kinematics.surfaceNormalWorld.y * normalLoadN;
      normalForceWorld.z = kinematics.surfaceNormalWorld.z * normalLoadN;
      const suspensionMomentX = radius.y * normalForceWorld.z
        - radius.z * normalForceWorld.y;
      const suspensionMomentY = radius.z * normalForceWorld.x
        - radius.x * normalForceWorld.z;
      const suspensionMomentZ = radius.x * normalForceWorld.y
        - radius.y * normalForceWorld.x;
      worldMoment.x += (momentX + suspensionMomentX)
        + kinematics.surfaceNormalWorld.x * force.selfAligningMomentNm;
      worldMoment.y += (momentY + suspensionMomentY)
        + kinematics.surfaceNormalWorld.y * force.selfAligningMomentNm;
      worldMoment.z += (momentZ + suspensionMomentZ)
        + kinematics.surfaceNormalWorld.z * force.selfAligningMomentNm;
      suspensionForce.x += normalForceWorld.x;
      suspensionForce.y += normalForceWorld.y;
      suspensionForce.z += normalForceWorld.z;
      worldForce.x += forceWorld.x;
      worldForce.y += forceWorld.y;
      worldForce.z += forceWorld.z;
      const driveTorque = Number(powertrainStep.wheelDriveTorqueNm[wheelId] || 0);
      const brakeTorqueMagnitude = Math.max(0, Number(
        powertrainStep.wheelBrakeTorqueNm[wheelId] || 0
      ));
      const angularReference = Math.abs(kinematics.wheelAngularVelocityRadps) > 0.05
        ? kinematics.wheelAngularVelocityRadps
        : Math.abs(kinematics.longitudinalVelocityMps) > 0.05
          ? kinematics.longitudinalVelocityMps / Math.max(EPSILON, kinematics.effectiveRollingRadiusM)
          : 0;
      const angularSign = Math.sign(angularReference);
      const reactionTorque = force.longitudinalForceN * kinematics.effectiveRollingRadiusM;
      const appliedWheelTorque = driveTorque - brakeTorqueMagnitude * angularSign;
      let nextAngular = kinematics.wheelAngularVelocityRadps
        + (appliedWheelTorque - reactionTorque) / config.wheelInertiaKgM2 * dt;
      const rollingAngularVelocityRadps = kinematics.longitudinalVelocityMps
        / Math.max(EPSILON, kinematics.effectiveRollingRadiusM);
      const currentRollingError = kinematics.wheelAngularVelocityRadps - rollingAngularVelocityRadps;
      const nextRollingError = nextAngular - rollingAngularVelocityRadps;
      const crossedRollingSpeed = currentRollingError * nextRollingError < 0;
      const crossedAgainstAppliedTorque = Math.abs(appliedWheelTorque) <= EPSILON
        || Math.sign(nextRollingError) !== Math.sign(appliedWheelTorque);
      if (crossedRollingSpeed && crossedAgainstAppliedTorque) {
        nextAngular = rollingAngularVelocityRadps;
      }
      const rollingRadiusM = Math.max(EPSILON, kinematics.effectiveRollingRadiusM);
      const staticTorqueCapacityNm = Math.max(0, Number(capacityByWheel[wheelId] || 0)) * rollingRadiusM;
      const tire = wheelInputs[wheelId].tire || {};
      const peakSlip = clamp(Number(tire.peakSlip ?? 0.16), 0.03, 1.5);
      const recoveryHysteresis = clamp(Number(tire.recoveryHysteresis ?? 0.04), 0, 0.3);
      const widthScale = clamp(Number(tire.widthMm ?? 245) / 245, 0.7, 1.4);
      const longitudinalStiffnessN = Math.max(
        1000,
        Number(tire.longitudinalStiffnessN || wheelInputs[wheelId].staticLoadN * 18) * widthScale
      );
      const equilibriumSlipDemand = Math.abs(
        (appliedWheelTorque / rollingRadiusM) / longitudinalStiffnessN
      );
      const withinStaticSlipRange = Math.abs(Number(
        wheelInputs[wheelId].tireTransition?.rawSlipRatio ?? kinematics.slipRatio ?? 0
      )) <= Math.max(0.03, peakSlip - recoveryHysteresis);
      const atRollingSpeed = Math.abs(currentRollingError) < 0.05 || crossedRollingSpeed;
      const staticTorqueRatio = Math.abs(appliedWheelTorque) / Math.max(EPSILON, staticTorqueCapacityNm);
      // Keep substep reaction torque from ratcheting a low-demand wheel out of
      // static adhesion. Higher launch demand still has to re-enter through the
      // rolling-speed crossing so genuine breakaway and wheelspin remain free.
      const nearRollingConstraint = (atRollingSpeed && staticTorqueRatio <= 0.72)
        || (withinStaticSlipRange
          && ((Number(controls.throttle || 0) > 0.5 && staticTorqueRatio <= 0.55)
            || (Number(controls.throttle || 0) <= 0.5
              && appliedWheelTorque > 0
              && equilibriumSlipDemand <= Math.min(0.007, peakSlip * 0.07))));
      if (geometricContact
        && nearRollingConstraint) {
        const equilibriumSlipRatio = clamp(
          (appliedWheelTorque / rollingRadiusM) / longitudinalStiffnessN,
          -0.08,
          0.08
        );
        const slipReferenceSpeedMps = Math.max(
          0.5,
          Math.abs(kinematics.longitudinalVelocityMps)
        );
        nextAngular = (kinematics.longitudinalVelocityMps
          + equilibriumSlipRatio * slipReferenceSpeedMps) / rollingRadiusM;
      }
      if (drivenWheelIds.includes(wheelId)
        && powertrainStep.state.clutchCoupling > 0.001
        && Number.isFinite(maximumPoweredWheelOmegaRadps)) {
        const rollingOmega = Math.abs(
          kinematics.longitudinalVelocityMps / Math.max(EPSILON, kinematics.effectiveRollingRadiusM)
        );
        const coupledLimit = Math.max(
          maximumPoweredWheelOmegaRadps * 1.04,
          rollingOmega * 1.08 + 2
        );
        nextAngular = clamp(nextAngular, -coupledLimit, coupledLimit);
      }
      const wheelAngularMomentumDeltaNms = config.wheelInertiaKgM2
        * (nextAngular - kinematics.wheelAngularVelocityRadps);
      const chassisReactionImpulseWorldNms = scratch.reactionImpulseByWheel[wheelId];
      chassisReactionImpulseWorldNms.x = kinematics.wheelLateralWorld.x
        * -wheelAngularMomentumDeltaNms;
      chassisReactionImpulseWorldNms.y = kinematics.wheelLateralWorld.y
        * -wheelAngularMomentumDeltaNms;
      chassisReactionImpulseWorldNms.z = kinematics.wheelLateralWorld.z
        * -wheelAngularMomentumDeltaNms;
      const inverseDt = 1 / Math.max(EPSILON, dt);
      worldMoment.x += chassisReactionImpulseWorldNms.x * inverseDt;
      worldMoment.y += chassisReactionImpulseWorldNms.y * inverseDt;
      worldMoment.z += chassisReactionImpulseWorldNms.z * inverseDt;
      const storedReactionImpulse = wheelAngularMomentumReactionImpulseWorldNms[wheelId];
      storedReactionImpulse.x = q(chassisReactionImpulseWorldNms.x);
      storedReactionImpulse.y = q(chassisReactionImpulseWorldNms.y);
      storedReactionImpulse.z = q(chassisReactionImpulseWorldNms.z);
      wheelAngularVelocityRadps[wheelId] = q(nextAngular);
      wheelLoadsN[wheelId] = q(wheelInputs[wheelId].aquaplaning.supportedNormalLoadN);
      wheelSlip[wheelId] = q(Math.hypot(kinematics.slipRatio, Math.tan(kinematics.slipAngleRad)));
      suspensionTravel[wheelId] = q(clamp(Number(environment.suspensionTravelByWheel?.[wheelId]
        ?? (hasSurfaceHeight ? compressionM / suspensionTravelM : (normalLoadN / Math.max(1, wheelInputs[wheelId].staticLoadN) - 0.7) / 0.6)), 0, 1));
      const storedSuspension = suspensionState[wheelId];
      storedSuspension.requestedCompressionM = rawRequestedCompressionM === null
        ? null : q(rawRequestedCompressionM);
      storedSuspension.rawRequestedCompressionM = rawRequestedCompressionM === null
        ? null : q(rawRequestedCompressionM);
      storedSuspension.clampedCompressionM = wheelInputs[wheelId].clampedCompressionM === null
        ? null : q(wheelInputs[wheelId].clampedCompressionM);
      storedSuspension.overtravelM = q(wheelInputs[wheelId].overtravelM);
      storedSuspension.remainingBumpTravelM = q(wheelInputs[wheelId].remainingBumpTravelM);
      storedSuspension.bottomedOut = contactValidity.bottomedOut === true;
      storedSuspension.suspensionTravelM = q(suspensionTravelM);
      storedSuspension.compressionM = q(hasSurfaceHeight ? compressionM : clamp(
        suspensionTravelM * suspensionTravel[wheelId], 0, suspensionTravelM
      ));
      storedSuspension.compressionRatio = suspensionTravel[wheelId];
      storedSuspension.compressionVelocityMps = q(wheelInputs[wheelId].compressionVelocityMps);
      storedSuspension.suspensionAxisLocal = kinematics.suspensionAxisLocal;
      storedSuspension.suspensionAxisWorld = kinematics.suspensionAxisWorld;
      storedSuspension.restLengthM = kinematics.suspensionRestLengthM;
      storedSuspension.droopTravelM = q(wheelInputs[wheelId].droopTravelM);
      storedSuspension.bumpTravelM = q(wheelInputs[wheelId].bumpTravelM);
      storedSuspension.staticSagTargetM = q(wheelInputs[wheelId].staticSagTargetM);
      storedSuspension.bumpStopClearanceM = q(Math.max(
        0,
        wheelInputs[wheelId].staticSagTargetM
          + wheelInputs[wheelId].bumpTravelM * config.bumpStopStartRatio - compressionM
      ));
      storedSuspension.hubPositionWorld = kinematics.hubPositionWorld;
      storedSuspension.hubVelocityWorld = kinematics.hubVelocityWorld;
      storedSuspension.suspensionMountPositionWorld = kinematics.suspensionMountPositionWorld;
      storedSuspension.suspensionMountVelocityWorld = kinematics.suspensionMountVelocityWorld;
      storedSuspension.springForceN = q(Math.max(0, normalLoadN));
      storedSuspension.springRateNpm = q(springRateNpm);
      storedSuspension.damperRateNsM = q(damperRateNsM);
      storedSuspension.damperVelocityMps = q(wheelInputs[wheelId].compressionVelocityMps);
      storedSuspension.damperForceN = q(wheelInputs[wheelId].damperForceN);
      storedSuspension.antiRollLoadTransferN = q(antiRollLoadTransferN);
      storedSuspension.unsprungVelocityMps = q(wheelInputs[wheelId].unsprungVelocityMps);
      storedSuspension.unsprungMassKg = q(
        config.unsprungMassByWheelKg?.[wheelId] || config.unsprungMassKg
      );
      storedSuspension.tireVerticalStiffnessNpm = q(config.tireVerticalStiffnessNpm);
      storedSuspension.bumpStopForceN = q(wheelInputs[wheelId].bumpStopForceN);
      storedSuspension.hardStopForceN = q(wheelInputs[wheelId].hardStopForceN);
      storedSuspension.tireVerticalDeflectionM = q(wheelInputs[wheelId].tireVerticalDeflectionM);
      storedSuspension.terrainSampleValid = wheelInputs[wheelId].surfaceSample.valid === true;
      storedSuspension.terrainTriangleId = wheelInputs[wheelId].surfaceSample.triangleId;
      storedSuspension.terrainSampleSource = wheelInputs[wheelId].surfaceSample.source;
      storedSuspension.terrainSampleReason = wheelInputs[wheelId].surfaceSample.reason;
      storedSuspension.contactSolveIterationCount = wheelInputs[wheelId].contactSolveIterationCount;
      storedSuspension.geometry = wheelInputs[wheelId].geometry;
      storedSuspension.footprint = wheelInputs[wheelId].footprint;
      storedSuspension.geometricContact = hasSurfaceHeight ? geometricContact : normalLoadN > 1;
      storedSuspension.geometricTerrainProximity = contactValidity.geometricProximity;
      storedSuspension.validTreadContact = contactValidity.valid && normalLoadN > 1;
      storedSuspension.invalidContactReason = contactValidity.valid ? null : contactValidity.reason;
      storedSuspension.contactState = contactValidity.state;
      storedSuspension.contactType = classifyWheelContact(contactValidity);
      storedSuspension.supportAlignment = contactValidity.supportAlignment;
      storedSuspension.inContact = contactValidity.valid && normalLoadN > 1;
      tireForcesN[wheelId].longitudinal = q(localLongitudinal);
      tireForcesN[wheelId].lateral = force.lateralForceN;
      const rollingSurfaceSpeedMps = kinematics.wheelAngularVelocityRadps
        * kinematics.effectiveRollingRadiusM;
      const longitudinalSlipSpeedMps = rollingSurfaceSpeedMps - kinematics.longitudinalVelocityMps;
      const contactSpeedMps = Math.hypot(
        kinematics.longitudinalVelocityMps,
        kinematics.lateralVelocityMps
      );
      const treadTemperatureC = Number(wheelInputs[wheelId].tire.treadTemperatureC
        ?? ((Number(wheelInputs[wheelId].tire.temperatureF ?? 70) - 32) * 5 / 9));
      const surfaceTemperatureC = Number(wheelInputs[wheelId].material.surfaceTemperatureC
        ?? environment.ambientTemperatureC ?? 21);
      const standingWaterDepthMm = Math.max(0, Number(
        wheelInputs[wheelId].material.standingWaterDepthMm || 0
      ));
      const surfaceConductanceWPerC = normalLoadN > 1
        ? 32 + Math.min(90, normalLoadN / 55)
        : 0;
      const waterCoolingWPerC = normalLoadN > 1
        ? clamp(standingWaterDepthMm / 2.5, 0, 1) * (45 + contactSpeedMps * 5)
        : 0;
      const output = outputs[wheelId];
      const tireEnergyWork = output.tireEnergyWork;
      tireEnergyWork.longitudinalFrictionWorkJ = q(
        Math.abs(force.longitudinalForceN * longitudinalSlipSpeedMps) * dt
      );
      tireEnergyWork.lateralFrictionWorkJ = q(
        Math.abs(force.lateralForceN * kinematics.lateralVelocityMps) * dt
      );
      tireEnergyWork.carcassFlexWorkJ = q(normalLoadN * (
          Math.abs(kinematics.slipRatio) * 0.34
          + Math.abs(kinematics.slipAngleRad) * 0.42
        ) * dt);
      tireEnergyWork.loadHeatingWorkJ = q(normalLoadN * contactSpeedMps * 0.0028 * dt);
      tireEnergyWork.surfaceConductionWorkJ = q(
        (surfaceTemperatureC - treadTemperatureC) * surfaceConductanceWPerC * dt
      );
      tireEnergyWork.waterCoolingWorkJ = q(
        Math.max(0, treadTemperatureC - Number(environment.ambientTemperatureC ?? 21))
          * waterCoolingWPerC * dt
      );
      Object.assign(output, kinematics, wheelInputs[wheelId].tireTransition, force);
      output.normalLoadN = q(wheelInputs[wheelId].aquaplaning.supportedNormalLoadN);
      output.suspensionNormalLoadN = q(normalLoadN);
      output.suspensionForceN = q(Math.max(0,
          Number(wheelInputs[wheelId].progressiveRate || 0)
            * Math.max(0, Number(wheelInputs[wheelId].compressionM || 0)
              - Number(wheelInputs[wheelId].staticSagTargetM || 0))
          + Number(wheelInputs[wheelId].damperForceN || 0)
          + Number(wheelInputs[wheelId].bumpStopForceN || 0)
          + Number(wheelInputs[wheelId].hardStopForceN || 0)
        ));
      output.tireVerticalForceN = q(wheelInputs[wheelId].aquaplaning.supportedNormalLoadN);
      output.wheelGrounded = contactValidity.valid && normalLoadN > 1;
      output.validTreadContact = contactValidity.valid && normalLoadN > 1;
      output.invalidContactReason = contactValidity.valid ? null : contactValidity.reason;
      output.contactState = contactValidity.state;
      output.contactType = classifyWheelContact(contactValidity);
      output.geometricTerrainProximity = contactValidity.geometricProximity;
      output.rawRequestedCompressionM = rawRequestedCompressionM === null
        ? null : q(rawRequestedCompressionM);
      output.clampedCompressionM = wheelInputs[wheelId].clampedCompressionM === null
        ? null : q(wheelInputs[wheelId].clampedCompressionM);
      output.overtravelM = q(wheelInputs[wheelId].overtravelM);
      output.remainingBumpTravelM = q(wheelInputs[wheelId].remainingBumpTravelM);
      output.bottomedOut = contactValidity.bottomedOut === true;
      output.bumpStopForceN = q(wheelInputs[wheelId].bumpStopForceN);
      output.hardStopForceN = q(wheelInputs[wheelId].hardStopForceN);
      output.tireVerticalDeflectionM = q(wheelInputs[wheelId].tireVerticalDeflectionM);
      output.terrainSampleValid = wheelInputs[wheelId].surfaceSample.valid === true;
      output.terrainTriangleId = wheelInputs[wheelId].surfaceSample.triangleId;
      output.terrainSampleSource = wheelInputs[wheelId].surfaceSample.source;
      output.terrainSampleReason = wheelInputs[wheelId].surfaceSample.reason;
      output.contactSolveIterationCount = wheelInputs[wheelId].contactSolveIterationCount;
      output.supportAlignment = contactValidity.supportAlignment;
      output.localForceN.longitudinal = q(localLongitudinal);
      output.localForceN.lateral = force.lateralForceN;
      output.localForceN.normal = 0;
      output.worldForceN.x = q(forceWorld.x);
      output.worldForceN.y = q(forceWorld.y);
      output.worldForceN.z = q(forceWorld.z);
      output.forceApplicationPointWorld = kinematics.contactPointWorld;
      output.momentApplicationPointWorld = kinematics.contactPointWorld;
      output.aligningMomentAxisWorld = kinematics.surfaceNormalWorld;
      output.driveTorqueNm = q(driveTorque);
      output.brakeTorqueNm = q(brakeTorqueMagnitude);
      output.wheelAngularAccelerationRadps2 = q(
        (nextAngular - kinematics.wheelAngularVelocityRadps) / Math.max(EPSILON, dt)
      );
      output.chassisWheelReactionImpulseWorldNms.x = q(chassisReactionImpulseWorldNms.x);
      output.chassisWheelReactionImpulseWorldNms.y = q(chassisReactionImpulseWorldNms.y);
      output.chassisWheelReactionImpulseWorldNms.z = q(chassisReactionImpulseWorldNms.z);
      output.absModulation = q(powertrainStep.state.absModulationByWheel?.[wheelId] ?? 1);
      output.tireParameters.pressurePsi = q(wheelInputs[wheelId].tire.pressurePsi ?? 32);
      output.tireParameters.coldPressurePsi = q(wheelInputs[wheelId].tire.coldPressurePsi
        ?? wheelInputs[wheelId].tire.pressurePsi ?? 32);
      output.tireParameters.treadThermalMassKg = q(
        wheelInputs[wheelId].tire.treadThermalMassKg ?? 3.4
      );
      output.tireParameters.carcassThermalMassKg = q(
        wheelInputs[wheelId].tire.carcassThermalMassKg ?? 6.8
      );
      output.tireParameters.damage = q(wheelInputs[wheelId].tire.damage ?? 0);
      output.material.baseSurfaceId = String(
        wheelInputs[wheelId].material.baseSurfaceId || 'unknown'
      );
      output.material.surfaceId = String(wheelInputs[wheelId].material.surfaceId
        || wheelInputs[wheelId].material.baseSurfaceId || 'unknown');
      output.material.effectiveGrip = q(wheelInputs[wheelId].material.effectiveGrip ?? 1);
      output.material.effectiveGripMultiplier = q(
        wheelInputs[wheelId].material.effectiveGripMultiplier ?? 1
      );
      output.material.surfaceGripScale = q(wheelInputs[wheelId].material.surfaceGripScale ?? 1);
      output.material.trackStateConditionApplied =
        wheelInputs[wheelId].material.trackStateConditionApplied === true;
      output.material.surfaceTemperatureC = q(
        wheelInputs[wheelId].material.surfaceTemperatureC ?? 21
      );
      output.material.moistureDepthMm = q(wheelInputs[wheelId].material.moistureDepthMm || 0);
      output.material.standingWaterDepthMm = q(
        wheelInputs[wheelId].material.standingWaterDepthMm || 0
      );
      output.material.snowDepthMm = q(wheelInputs[wheelId].material.snowDepthMm || 0);
      output.material.iceDepthMm = q(wheelInputs[wheelId].material.iceDepthMm || 0);
      output.material.looseMarbles = q(wheelInputs[wheelId].material.looseMarbles || 0);
      output.material.dirt = q(wheelInputs[wheelId].material.dirt || 0);
      output.material.mud = q(wheelInputs[wheelId].material.mud || 0);
      output.material.oil = q(wheelInputs[wheelId].material.oil || 0);
      output.material.roughness = q(wheelInputs[wheelId].material.roughness || 0);
      output.material.debris = q(wheelInputs[wheelId].material.debris || 0);
      output.ambientTemperatureC = q(environment.ambientTemperatureC ?? 21);
    }
    const validTreadContactByWheel = scratch.validTreadContactByWheel;
    const invalidContactReasonByWheel = scratch.invalidContactReasonByWheel;
    const geometricTerrainProximityByWheel = scratch.geometricTerrainProximityByWheel;
    const contactTypeByWheel = scratch.contactTypeByWheel;
    const copiedDriveShareByWheel = scratch.copiedDriveShareByWheel;
    let supportedWheelCount = 0;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const validTreadContact = outputs[wheelId]?.validTreadContact === true;
      validTreadContactByWheel[wheelId] = validTreadContact;
      invalidContactReasonByWheel[wheelId] = outputs[wheelId]?.invalidContactReason || null;
      geometricTerrainProximityByWheel[wheelId] =
        outputs[wheelId]?.geometricTerrainProximity === true;
      contactTypeByWheel[wheelId] = outputs[wheelId]?.contactType
        || 'unsupported-suspension';
      copiedDriveShareByWheel[wheelId] = driveShareByWheel[wheelId];
      if (validTreadContact) supportedWheelCount += 1;
    }
    const result = scratch.result;
    result.dt = q(dt, 12);
    const yawSin = Math.sin(state.yawRad);
    const yawCos = Math.cos(state.yawRad);
    result.longitudinalForceN = q(
      worldForce.x * yawSin + worldForce.z * yawCos
    );
    result.lateralForceN = q(
      worldForce.x * yawCos + worldForce.z * -yawSin
    );
    result.worldForceN.x = q(worldForce.x);
    result.worldForceN.y = q(worldForce.y);
    result.worldForceN.z = q(worldForce.z);
    result.worldMomentNm.x = q(worldMoment.x);
    result.worldMomentNm.y = q(worldMoment.y);
    result.worldMomentNm.z = q(worldMoment.z);
    result.yawMomentNm = q(worldMoment.y);
    result.suspensionForceWorldN.x = q(suspensionForce.x);
    result.suspensionForceWorldN.y = q(suspensionForce.y);
    result.suspensionForceWorldN.z = q(suspensionForce.z);
    result.verticalAccelerationMps2 = q(Number(environment.verticalAccelerationMps2 || 0));
    result.groundHeightM = Number.isFinite(Number(environment.groundHeightM))
      ? q(environment.groundHeightM)
      : sampledSurfaceHeightCount > 0
        ? q(sampledSurfaceHeightSum / sampledSurfaceHeightCount)
        : null;
    result.grounded = supportedWheelCount > 0;
    result.wheelGrounded = supportedWheelCount > 0;
    result.supportedWheelCount = supportedWheelCount;
    result.powertrainState = powertrainStep.state;
    result.powertrainTelemetry = powertrainStep.telemetry;
    const steeringTelemetry = scratch.steeringTelemetry;
    steeringTelemetry.inputIntent = q(clamp(
      Number((controls.driverSteeringIntent ?? controls.steering) || 0), -1, 1
    ));
    steeringTelemetry.steeringTarget = q(clamp(
      Number((controls.steeringTarget ?? controls.steering) || 0), -1, 1
    ));
    steeringTelemetry.controllerFilterOutput = q(clamp(
      Number((controls.controllerFilterOutput ?? controls.steering) || 0), -1, 1
    ));
    steeringTelemetry.normalizedDriverSteering = q(clamp(
      Number(controls.steering || 0), -1, 1
    ));
    steeringTelemetry.requestedRackAngleRad = q(
      clamp(Number(controls.steering || 0), -1, 1)
        * Math.max(0.05, Number(config.maxSteerAngleRad) || 0.52)
    );
    steeringTelemetry.permittedRackAngleRad = q(
      calculateAuthoritativeSteeringEnvelope(state, config)
    );
    steeringTelemetry.resolvedCenterRackAngleRad = q(centerSteeringAngleRad);
    steeringTelemetry.actualWheelAnglesRad.fl = q(outputs.fl?.steeringAngleRad || 0);
    steeringTelemetry.actualWheelAnglesRad.fr = q(outputs.fr?.steeringAngleRad || 0);
    steeringTelemetry.frontLoadsN.fl = q(outputs.fl?.normalLoadN || 0);
    steeringTelemetry.frontLoadsN.fr = q(outputs.fr?.normalLoadN || 0);
    steeringTelemetry.frontGripCoefficients.fl = q(outputs.fl?.gripCoefficient || 0);
    steeringTelemetry.frontGripCoefficients.fr = q(outputs.fr?.gripCoefficient || 0);
    steeringTelemetry.frontUtilization.fl = q(outputs.fl?.utilization || 0);
    steeringTelemetry.frontUtilization.fr = q(outputs.fr?.utilization || 0);
    steeringTelemetry.frontSlipAnglesRad.fl = q(outputs.fl?.slipAngleRad || 0);
    steeringTelemetry.frontSlipAnglesRad.fr = q(outputs.fr?.slipAngleRad || 0);
    steeringTelemetry.frontLateralForceN.fl = q(outputs.fl?.lateralForceN || 0);
    steeringTelemetry.frontLateralForceN.fr = q(outputs.fr?.lateralForceN || 0);
    steeringTelemetry.throttleFrictionCircleUse.fl = q(
      Math.abs(Number(outputs.fl?.longitudinalForceN || 0))
        / Math.max(1, Number(outputs.fl?.combinedSlipLimitN || 0))
    );
    steeringTelemetry.throttleFrictionCircleUse.fr = q(
      Math.abs(Number(outputs.fr?.longitudinalForceN || 0))
        / Math.max(1, Number(outputs.fr?.combinedSlipLimitN || 0))
    );
    steeringTelemetry.aquaplaningSupport.fl = q(
      1 - Number(outputs.fl?.aquaplaning?.liftFraction || 0)
    );
    steeringTelemetry.aquaplaningSupport.fr = q(
      1 - Number(outputs.fr?.aquaplaning?.liftFraction || 0)
    );
    steeringTelemetry.yawRateRadps = q(
      state.angularVelocityWorld?.y || state.yawRateRadps || 0
    );
    steeringTelemetry.bodySlipAngleRad = q(Math.atan2(
      Number(state.bodyLateralSpeedMps || 0),
      Math.max(0.5, Math.abs(Number(state.bodyLongitudinalSpeedMps || 0)))
    ));
    const yawRateMagnitude = Math.abs(Number(
      state.angularVelocityWorld?.y || state.yawRateRadps || 0
    ));
    steeringTelemetry.turnRadiusM = q(yawRateMagnitude > 0.001
      ? Number(state.groundSpeedMps || 0) / yawRateMagnitude
      : 1000000);
    steeringTelemetry.responseClassification = classifySteeringResponseTelemetry(
      steeringTelemetry
    );
    return result;
  }
}
