import { RACE_WHEEL_IDS } from './SimulationMath.js';
import {
  eulerFromQuaternion,
  rotateVectorByQuaternion,
  rotateVectorToBody
} from './RigidBodyMath.js';
import { resolvePerWheelAlignment } from './SuspensionGeometry.js';

export const VEHICLE_RENDER_STATE_SCHEMA_VERSION = 1;

export const VEHICLE_RENDER_WHEEL_FLAGS = Object.freeze({
  validTreadContact: 1,
  geometricContact: 2,
  loadBearing: 4,
  normalLoadKnown: 8,
  terrainDataAvailable: 16,
  provisional: 32
});

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const vector = (value = {}, fallback = {}) => ({
  x: finite(value.x, finite(fallback.x)),
  y: finite(value.y, finite(fallback.y)),
  z: finite(value.z, finite(fallback.z))
});

const quaternion = (value = {}) => ({
  x: finite(value.x), y: finite(value.y), z: finite(value.z), w: finite(value.w, 1)
});

const subtract = (point = {}, origin = {}) => ({
  x: finite(point.x) - finite(origin.x),
  y: finite(point.y) - finite(origin.y),
  z: finite(point.z) - finite(origin.z)
});

function multiplyQuaternion(left = {}, right = {}) {
  const lx = finite(left.x); const ly = finite(left.y); const lz = finite(left.z); const lw = finite(left.w, 1);
  const rx = finite(right.x); const ry = finite(right.y); const rz = finite(right.z); const rw = finite(right.w, 1);
  return {
    x: lw * rx + lx * rw + ly * rz - lz * ry,
    y: lw * ry - lx * rz + ly * rw + lz * rx,
    z: lw * rz + lx * ry - ly * rx + lz * rw,
    w: lw * rw - lx * rx - ly * ry - lz * rz
  };
}

export function reconstructVehicleRenderWheelPose(body, wheel = {}) {
  const position = body.position || {};
  const orientation = body.orientation || { w: 1 };
  const hubOffset = rotateVectorByQuaternion(wheel.hubPositionBody, orientation);
  const mountOffset = rotateVectorByQuaternion(wheel.suspensionMountBody, orientation);
  const steering = finite(wheel.steeringAngleRad);
  const spin = finite(wheel.spinAngleRad);
  const camber = finite(wheel.camberAngleRad);
  const toe = finite(wheel.toeAngleRad);
  const steerOrientation = {
    x: 0, y: Math.sin((steering + toe) * 0.5), z: 0,
    w: Math.cos((steering + toe) * 0.5)
  };
  const camberOrientation = {
    x: 0, y: 0, z: Math.sin(camber * 0.5), w: Math.cos(camber * 0.5)
  };
  const spinOrientation = {
    x: Math.sin(spin * 0.5), y: 0, z: 0, w: Math.cos(spin * 0.5)
  };
  return {
    ...wheel,
    position: {
      x: finite(position.x) + hubOffset.x,
      y: finite(position.y) + hubOffset.y,
      z: finite(position.z) + hubOffset.z
    },
    orientation: multiplyQuaternion(
      multiplyQuaternion(
        multiplyQuaternion(orientation, steerOrientation), camberOrientation
      ), spinOrientation
    ),
    suspensionMount: {
      x: finite(position.x) + mountOffset.x,
      y: finite(position.y) + mountOffset.y,
      z: finite(position.z) + mountOffset.z
    },
    suspensionAxis: rotateVectorByQuaternion(wheel.suspensionAxisBody, orientation),
    contactPoint: wheel.contactPointWorld,
    normal: wheel.surfaceNormalWorld,
    compressionRatio: finite(wheel.suspensionCompressionM),
    angularSpeedRadps: finite(wheel.wheelAngularVelocityRadps),
    inContact: wheel.loadBearing === true
  };
}

export function reconstructVehicleRenderState(state = {}) {
  state.wheels ||= {};
  const wheelPoses = {};
  const contactPatches = {};
  const suspensionState = {};
  const wheelLoadsN = {};
  for (const wheelId of RACE_WHEEL_IDS) {
    const wheel = state.wheels?.[wheelId] || {};
    wheel.resetGeneration = Math.max(0, Math.trunc(Number(state.resetGeneration) || 0));
    state.wheels[wheelId] = wheel;
    const pose = reconstructVehicleRenderWheelPose(state, wheel);
    pose.resetGeneration = Math.max(0, Math.trunc(Number(state.resetGeneration) || 0));
    wheelPoses[wheelId] = pose;
    contactPatches[wheelId] = {
      hubPositionWorld: pose.position,
      wheelCenterWorld: pose.position,
      contactPointWorld: pose.contactPointWorld,
      surfaceNormalWorld: pose.surfaceNormalWorld,
      suspensionMountPositionWorld: pose.suspensionMount,
      suspensionAxisWorld: pose.suspensionAxis,
      normalLoadN: pose.normalLoadN,
      gripCoefficient: pose.gripCoefficient,
      steeringAngleRad: pose.steeringAngleRad,
      lateralForceN: pose.lateralForceN,
      selfAligningMomentNm: pose.selfAligningMomentNm,
      validTreadContact: pose.validTreadContact,
      geometricContact: pose.geometricContact,
      normalLoadKnown: pose.normalLoadKnown
    };
    suspensionState[wheelId] = {
      hubPositionWorld: pose.position,
      suspensionMountPositionWorld: pose.suspensionMount,
      suspensionAxisWorld: pose.suspensionAxis,
      compressionM: pose.suspensionCompressionM,
      compressionRatio: pose.suspensionCompressionM
    };
    wheelLoadsN[wheelId] = pose.normalLoadN;
  }
  const euler = eulerFromQuaternion(state.orientation);
  state.wheelPoses = wheelPoses;
  state.contactPatches = contactPatches;
  state.suspensionState = suspensionState;
  state.wheelLoadsN = wheelLoadsN;
  state.yawRad = euler.yaw;
  state.pitchRad = euler.pitch;
  state.rollRad = euler.roll;
  state.grounded = (Number(state.visualState || 0) & 1) !== 0;
  return state;
}

export function createVehicleRenderStateFromRunner(runner, {
  eventSequence = 0,
  visualState = 0
} = {}) {
  const state = runner?.state || {};
  const config = runner?.config || {};
  const position = vector(state.position);
  const orientation = quaternion(state.orientation);
  const wheels = {};
  const suspensionPose = {};
  const tireTemperature = {};
  const wheelAngularVelocity = {};
  const impactEvents = (runner?.terrainImpactHistory || runner?.impactHistory || []).filter((impact) => (
    impact.terrainImpact === true
  )).slice(-4).map((impact) => ({
    sequence: Math.max(0, Math.trunc(Number(impact.sequence) || 0)),
    stepIndex: Math.max(0, Math.trunc(Number(impact.stepIndex) || 0)),
    resetGeneration: Math.max(0, Math.trunc(Number(impact.resetGeneration) || 0)),
    normalImpulseNs: finite(impact.bodyNormalImpulseNs),
    vehicleMassKg: Math.max(1, finite(config.massKg, 1450)),
    preImpactNormalSpeedMps: finite(impact.preImpactNormalSpeedMps),
    energyLossJ: Math.max(0, finite(impact.preImpactKineticEnergyJ)
      - finite(impact.postImpactKineticEnergyJ)),
    pointWorld: vector(impact.impactPointWorld),
    normalWorld: vector(impact.impactNormalWorld, { y: 1 }),
    vehicleYawRad: finite(impact.impactYawRad),
    recoveredCoupledCorrection: impact.recoveredCoupledCorrection === true,
    terrainImpact: true
  }));
  const frontZ = finite(
    config.frontAxleDistanceFromCgM,
    finite(config.wheelbaseM, 2.65) * 0.5
  );
  const rearZ = -finite(
    config.rearAxleDistanceFromCgM,
    finite(config.wheelbaseM, 2.65) * 0.5
  );
  for (const wheelId of RACE_WHEEL_IDS) {
    const front = wheelId[0] === 'f';
    const left = wheelId[1] === 'l';
    const fallbackAlignment = resolvePerWheelAlignment({
      wheelId,
      axleCamberRad: front ? config.camberFrontRad : config.camberRearRad,
      axleToeRad: front ? config.toeFrontRad : config.toeRearRad
    });
    const patch = state.contactPatches?.[wheelId] || {};
    const suspension = state.suspensionState?.[wheelId] || {};
    const compression = finite(
      suspension.compressionM,
      state.suspensionTravel?.[wheelId] ?? suspension.compressionRatio
    );
    const halfTrack = finite(front ? config.frontTrackWidthM : config.rearTrackWidthM, 1.58) * 0.5;
    const fallbackHubBody = {
      x: left ? -halfTrack : halfTrack,
      y: -finite(config.cgHeightM, 0.55) + finite(config.wheelRadiusM, 0.337) - compression,
      z: front ? frontZ : rearZ
    };
    const hubWorld = patch.hubPositionWorld || suspension.hubPositionWorld || patch.wheelCenterWorld;
    const mountWorld = patch.suspensionMountPositionWorld
      || suspension.suspensionMountPositionWorld;
    const axisWorld = patch.suspensionAxisWorld || suspension.suspensionAxisWorld;
    const normalLoadN = finite(patch.normalLoadN);
    const flags = (
      (patch.validTreadContact === true ? VEHICLE_RENDER_WHEEL_FLAGS.validTreadContact : 0)
      | (patch.geometricContact === true || patch.contactPointWorld
        ? VEHICLE_RENDER_WHEEL_FLAGS.geometricContact : 0)
      | (normalLoadN > 1 ? VEHICLE_RENDER_WHEEL_FLAGS.loadBearing : 0)
      | (patch.normalLoadKnown === false ? 0 : VEHICLE_RENDER_WHEEL_FLAGS.normalLoadKnown)
      | (Object.hasOwn(state.contactPatches || {}, wheelId)
        && patch.terrainSampleValid !== false
        ? VEHICLE_RENDER_WHEEL_FLAGS.terrainDataAvailable : 0)
    );
    wheels[wheelId] = {
      hubPositionBody: hubWorld
        ? vector(rotateVectorToBody(subtract(hubWorld, position), orientation))
        : fallbackHubBody,
      suspensionMountBody: mountWorld
        ? vector(rotateVectorToBody(subtract(mountWorld, position), orientation))
        : { x: fallbackHubBody.x, y: fallbackHubBody.y + compression, z: fallbackHubBody.z },
      suspensionAxisBody: axisWorld
        ? vector(rotateVectorToBody(axisWorld, orientation))
        : { x: 0, y: -1, z: 0 },
      suspensionCompressionM: compression,
      steeringAngleRad: finite(
        patch.steeringAngleRad,
        state.steeringTelemetry?.actualWheelAnglesRad?.[wheelId]
      ),
      camberAngleRad: finite(
        patch.camberAngleRad,
        fallbackAlignment.camberRad
      ),
      toeAngleRad: finite(
        patch.toeAngleRad,
        fallbackAlignment.toeRad
      ),
      spinAngleRad: finite(runner?.renderWheelSpinAngles?.[wheelId]),
      wheelAngularVelocityRadps: finite(state.wheelAngularVelocityRadps?.[wheelId]),
      normalLoadN,
      gripCoefficient: finite(patch.gripCoefficient, 1),
      lateralForceN: finite(patch.lateralForceN),
      selfAligningMomentNm: finite(patch.selfAligningMomentNm),
      contactPointWorld: vector(patch.contactPointWorld),
      surfaceNormalWorld: vector(patch.surfaceNormalWorld, { y: 1 }),
      flags,
      validTreadContact: (flags & VEHICLE_RENDER_WHEEL_FLAGS.validTreadContact) !== 0,
      geometricContact: (flags & VEHICLE_RENDER_WHEEL_FLAGS.geometricContact) !== 0,
      loadBearing: (flags & VEHICLE_RENDER_WHEEL_FLAGS.loadBearing) !== 0,
      normalLoadKnown: (flags & VEHICLE_RENDER_WHEEL_FLAGS.normalLoadKnown) !== 0,
      resetGeneration: Math.max(0, Math.trunc(Number(state.vehicleResetGeneration) || 0)),
      terrainDataAvailable: (flags & VEHICLE_RENDER_WHEEL_FLAGS.terrainDataAvailable) !== 0,
      provisional: false
    };
    suspensionPose[wheelId] = compression;
    tireTemperature[wheelId] = finite(state.tireState?.[wheelId]?.temperatureF, 70);
    wheelAngularVelocity[wheelId] = finite(state.wheelAngularVelocityRadps?.[wheelId]);
  }
  return reconstructVehicleRenderState({
    schemaVersion: VEHICLE_RENDER_STATE_SCHEMA_VERSION,
    stepIndex: runner?.stepIndex || 0,
    resetGeneration: Math.max(0, Math.trunc(Number(state.vehicleResetGeneration) || 0)),
    eventSequence,
    impactEvents,
    visualState,
    simulationTimeSeconds: runner?.simulationTimeSeconds || 0,
    position,
    orientation,
    velocity: vector(state.velocity),
    angularVelocity: vector(state.angularVelocityWorld),
    wheels,
    suspensionPose,
    tireTemperature,
    wheelAngularVelocity,
    speedMps: finite(state.speedMps, state.groundSpeedMps),
    groundSpeedMps: finite(state.groundSpeedMps, state.speedMps),
    bodyLongitudinalSpeedMps: finite(state.bodyLongitudinalSpeedMps, state.speedMps),
    bodyLateralSpeedMps: finite(state.bodyLateralSpeedMps),
    signedTravelSpeedMps: finite(state.signedTravelSpeedMps, state.speedMps),
    engineRpm: finite(state.powertrainState?.engineRpm, state.engineRpm),
    gear: finite(state.powertrainState?.gear, state.gear)
  });
}

export function createVehicleRenderProfileFromRunner(runner) {
  const config = runner?.config || {};
  const bodyProfile = config.bodyProfile || {};
  return {
    bodyColliderPieces: (bodyProfile.pieces || []).map((piece) => ({
      id: String(piece.id || piece.name || 'body-piece'),
      centerBody: vector(piece.centerM),
      sizeM: vector(piece.sizeM)
    })),
    // The authoritative body transform is centred on the CG; collider-piece
    // centres are already expressed relative to that origin.
    cgPositionBody: { x: 0, y: 0, z: 0 },
    wheelRadiusM: finite(config.wheelRadiusM, 0.337),
    tireWidthMByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId, finite(config.tireByWheel?.[wheelId]?.widthMm, 225) / 1000
    ]))
  };
}
