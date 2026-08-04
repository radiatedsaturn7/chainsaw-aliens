import {
  addVector3,
  crossVector3,
  inverseInertiaWorldMultiply,
  integrateQuaternion,
  rotateVectorByQuaternion,
  scaleVector3
} from './RigidBodyMath.js';

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

export function createChassisBodyContactCandidates(config = {}) {
  const halfLength = Math.max(0.8, Number(config.bodyLengthM || 4.5) * 0.5);
  const halfWidth = Math.max(0.45, Number(config.bodyWidthM || 1.8) * 0.5);
  const bodyHeight = Math.max(0.7, Number(config.bodyHeightM || 1.45));
  const bottom = Number(config.bodyGroundClearanceM || 0.12) - Number(config.cgHeightM || 0.55);
  const roof = bodyHeight - Number(config.cgHeightM || 0.55);
  const bumper = bottom + Math.min(0.22, bodyHeight * 0.16);
  const rockerInset = halfLength * 0.42;
  return Object.freeze([
    ['underbody-fl', -halfWidth, bottom, halfLength * 0.72],
    ['underbody-fr', halfWidth, bottom, halfLength * 0.72],
    ['underbody-rl', -halfWidth, bottom, -halfLength * 0.72],
    ['underbody-rr', halfWidth, bottom, -halfLength * 0.72],
    ['front-underside', 0, bottom, halfLength * 0.9],
    ['underbody-center', 0, bottom, 0],
    ['rear-underside', 0, bottom, -halfLength * 0.9],
    ['left-rocker-front', -halfWidth, bottom + 0.08, rockerInset],
    ['left-rocker-rear', -halfWidth, bottom + 0.08, -rockerInset],
    ['right-rocker-front', halfWidth, bottom + 0.08, rockerInset],
    ['right-rocker-rear', halfWidth, bottom + 0.08, -rockerInset],
    ['front-bumper-left', -halfWidth * 0.72, bumper, halfLength],
    ['front-bumper-right', halfWidth * 0.72, bumper, halfLength],
    ['rear-bumper-left', -halfWidth * 0.72, bumper, -halfLength],
    ['rear-bumper-right', halfWidth * 0.72, bumper, -halfLength],
    ['roof-fl', -halfWidth * 0.82, roof, halfLength * 0.62],
    ['roof-fr', halfWidth * 0.82, roof, halfLength * 0.62],
    ['roof-rl', -halfWidth * 0.82, roof, -halfLength * 0.62],
    ['roof-rr', halfWidth * 0.82, roof, -halfLength * 0.62],
    ['roof-center', 0, roof, 0],
    ['nose', 0, bumper + bodyHeight * 0.18, halfLength],
    ['tail', 0, bumper + bodyHeight * 0.18, -halfLength]
  ].map(([id, x, y, z]) => Object.freeze({ id, localPoint: { x, y, z } })));
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
  }

  createWorkingState(state = {}) {
    return {
      position: { ...state.position },
      orientation: { ...state.orientation },
      velocity: { ...state.velocity },
      angularVelocityWorld: { ...state.angularVelocityWorld }
    };
  }

  step({ workingState, config, environment = {}, dt = 0, advanceState = true }) {
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
    const candidateWorld = this.candidates.map((candidate) => {
      const arm = rotateVectorByQuaternion(candidate.localPoint, workingState.orientation);
      const worldPoint = addVector3(workingState.position, arm);
      return { arm, worldPoint };
    });
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
    const contacts = this.candidates.map((candidate, candidateIndex) => {
      const { arm, worldPoint } = candidateWorld[candidateIndex];
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
        friction: clamp(Number(terrain.friction ?? config.bodyCollisionFriction ?? 0.62), 0, 1.5),
        normalImpulseNs: 0,
        tangentialImpulseNs: 0,
        restitutionImpulseNs: 0,
        penetrationBiasImpulseNs: 0,
        restitutionTargetSpeedMps: 0,
        suspensionSupported: Number(
          environment.suspensionBodyContactSupport?.supportedWheelCount || 0
        ) > 0 && /underbody|underside|rocker/.test(candidate.id)
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
    const correction = contacts.reduce((sum, contact) => addVector3(
      sum,
      scaleVector3(contact.normal, Math.max(0, contact.penetrationM - toleranceM) / contacts.length)
    ), { x: 0, y: 0, z: 0 });
    const correctionLength = length(correction);
    const boundedCorrection = correctionLength > 0.06
      ? scaleVector3(correction, 0.06 / correctionLength)
      : correction;
    workingState.position = addVector3(workingState.position, boundedCorrection);
    return {
      linearImpulseWorldNs: linearImpulse,
      angularImpulseWorldNms: angularImpulse,
      positionalCorrectionWorldM: boundedCorrection,
      bodyNormalImpulseNs: contacts.reduce((sum, contact) => sum + contact.normalImpulseNs, 0),
      bodyFrictionImpulseNs: contacts.reduce((sum, contact) => sum + contact.tangentialImpulseNs, 0),
      restitutionContributionNs: contacts.reduce((sum, contact) => sum + contact.restitutionImpulseNs, 0),
      penetrationBiasContributionNs: 0,
      contacts
    };
  }
}

export default ChassisBodyCollision;
