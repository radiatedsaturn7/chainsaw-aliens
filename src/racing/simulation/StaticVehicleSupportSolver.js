import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';
import {
  eulerFromQuaternion,
  quaternionFromEuler,
  rotateVectorToBody
} from './RigidBodyMath.js';

const EPSILON = 1e-9;
const clone = (value) => value === undefined ? undefined : structuredClone(value);
const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const SUPPORT_FIELDS = Object.freeze([
  'suspensionState', 'tireState', 'wheelLoadsN', 'wheelSlip',
  'wheelAngularVelocityRadps', 'contactPatches', 'suspensionTravel',
  'validTreadContactByWheel', 'invalidContactReasonByWheel',
  'supportedWheelCount', 'grounded', 'wheelGrounded', 'powertrainState'
]);

function installSupportResult(state, result) {
  for (const field of SUPPORT_FIELDS) {
    if (result?.[field] !== undefined) state[field] = clone(result[field]);
  }
  for (const wheelId of RACE_WHEEL_IDS) {
    state.wheelAngularVelocityRadps[wheelId] = 0;
    state.wheelSlip[wheelId] = 0;
    const suspension = state.suspensionState[wheelId] || {};
    suspension.unsprungVelocityMps = 0;
    suspension.compressionVelocityMps = 0;
    suspension.damperVelocityMps = 0;
    state.suspensionState[wheelId] = suspension;
  }
}

function calculateResidual(state, config) {
  const massKg = finite(config.massKg, 1450);
  const gravity = { x: 0, y: -massKg * 9.81, z: 0 };
  let weightedNormalX = 0;
  let weightedNormalY = 0;
  let weightedNormalZ = 0;
  let totalLoadN = 0;
  let supportedWheelCount = 0;
  for (const wheelId of RACE_WHEEL_IDS) {
    const patch = state.contactPatches?.[wheelId] || {};
    const loadN = Math.max(0, finite(patch.normalLoadN, state.wheelLoadsN?.[wheelId]));
    if (!(loadN > 1) || patch.validTreadContact !== true) continue;
    const normal = patch.surfaceNormalWorld || { x: 0, y: 1, z: 0 };
    weightedNormalX += finite(normal.x) * loadN;
    weightedNormalY += finite(normal.y, 1) * loadN;
    weightedNormalZ += finite(normal.z) * loadN;
    totalLoadN += loadN;
    supportedWheelCount += 1;
  }
  const normalLength = Math.hypot(weightedNormalX, weightedNormalY, weightedNormalZ);
  const supportNormal = normalLength > EPSILON
    ? {
        x: weightedNormalX / normalLength,
        y: weightedNormalY / normalLength,
        z: weightedNormalZ / normalLength
      }
    : { x: 0, y: 1, z: 0 };
  const gravityNormalProjection = gravity.x * supportNormal.x
    + gravity.y * supportNormal.y + gravity.z * supportNormal.z;
  const requiredFriction = {
    x: -(gravity.x - supportNormal.x * gravityNormalProjection),
    y: -(gravity.y - supportNormal.y * gravityNormalProjection),
    z: -(gravity.z - supportNormal.z * gravityNormalProjection)
  };
  const forceResidual = { ...gravity };
  const momentResidual = { x: 0, y: 0, z: 0 };
  const forcesByWheel = {};
  let stableSupportCount = 0;
  for (const wheelId of RACE_WHEEL_IDS) {
    const patch = state.contactPatches?.[wheelId] || {};
    const loadN = Math.max(0, finite(patch.normalLoadN, state.wheelLoadsN?.[wheelId]));
    const point = patch.contactPointWorld;
    const normal = patch.surfaceNormalWorld || supportNormal;
    const valid = patch.validTreadContact === true && point
      && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))
      && Number.isFinite(Number(point.z)) && loadN > 1;
    if (!valid) {
      forcesByWheel[wheelId] = { x: 0, y: 0, z: 0 };
      continue;
    }
    stableSupportCount += 1;
    const share = loadN / Math.max(1, totalLoadN);
    let friction = {
      x: requiredFriction.x * share,
      y: requiredFriction.y * share,
      z: requiredFriction.z * share
    };
    const frictionMagnitude = Math.hypot(friction.x, friction.y, friction.z);
    const frictionLimitN = Math.max(0, finite(patch.gripCoefficient, 1) * loadN);
    if (frictionMagnitude > frictionLimitN && frictionMagnitude > EPSILON) {
      const scale = frictionLimitN / frictionMagnitude;
      friction = { x: friction.x * scale, y: friction.y * scale, z: friction.z * scale };
    }
    const force = {
      x: finite(normal.x) * loadN + friction.x,
      y: finite(normal.y, 1) * loadN + friction.y,
      z: finite(normal.z) * loadN + friction.z
    };
    forcesByWheel[wheelId] = force;
    forceResidual.x += force.x;
    forceResidual.y += force.y;
    forceResidual.z += force.z;
    const radius = {
      x: finite(point.x) - finite(state.position?.x),
      y: finite(point.y) - finite(state.position?.y),
      z: finite(point.z) - finite(state.position?.z)
    };
    momentResidual.x += radius.y * force.z - radius.z * force.y;
    momentResidual.y += radius.z * force.x - radius.x * force.z;
    momentResidual.z += radius.x * force.y - radius.y * force.x;
  }
  return {
    forceResidual,
    momentResidual,
    forceResidualN: Math.hypot(forceResidual.x, forceResidual.y, forceResidual.z),
    momentResidualNm: Math.hypot(momentResidual.x, momentResidual.y, momentResidual.z),
    totalLoadN,
    supportedWheelCount,
    stableSupportCount,
    supportNormal,
    forcesByWheel
  };
}

export function solveStaticVehicleSupportState({
  state,
  config,
  tireContactSubsystem,
  createEnvironment,
  bodyCollision,
  controls = {},
  stepIndex = 0,
  timeSeconds = 0,
  physicsCostAccounting = null,
  maximumIterations = 64
} = {}) {
  const candidate = clone(state);
  const trace = [];
  const forceToleranceN = Math.max(25, finite(config.massKg, 1450) * 9.81 * 0.005);
  const momentToleranceNm = Math.max(
    25,
    finite(config.massKg, 1450) * 9.81 * finite(config.wheelbaseM, 2.65) * 0.01
  );
  const frontRate = finite(config.suspensionSpringRateFrontNpm, 32000);
  const rearRate = finite(config.suspensionSpringRateRearNpm, 32000);
  const tireRate = finite(config.tireVerticalStiffnessNpm, 210000);
  const frontEffective = frontRate * tireRate / Math.max(1, frontRate + tireRate);
  const rearEffective = rearRate * tireRate / Math.max(1, rearRate + tireRate);
  const heaveRateNpm = Math.max(1, 2 * frontEffective + 2 * rearEffective);
  const pitchRateNmRad = Math.max(
    1, heaveRateNpm * finite(config.wheelbaseM, 2.65) ** 2 * 0.25
  );
  const averageTrackM = (finite(config.frontTrackWidthM, 1.58)
    + finite(config.rearTrackWidthM, 1.58)) * 0.5;
  const rollRateNmRad = Math.max(1, heaveRateNpm * averageTrackM ** 2 * 0.25);
  let lastResult = null;
  let lastResidual = null;
  let status = 'failed';
  let error = null;
  let consecutiveConvergedIterations = 0;
  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const environment = createEnvironment(candidate, false, iteration) || {};
    try {
      lastResult = tireContactSubsystem.step({
        state: candidate,
        controls,
        config,
        environment,
        dt: 0,
        stepIndex,
        substepIndex: 0,
        timeSeconds,
        contactRebuildOnly: true,
        authoritativeReset: true,
        staticSupportSolve: true
      }) || {};
    } catch (cause) {
      error = String(cause?.message || cause);
      break;
    }
    installSupportResult(candidate, lastResult);
    lastResidual = calculateResidual(candidate, config);
    const penetration = bodyCollision.samplePosePenetration(
      candidate, environment, config.bodyCollisionToleranceM
    );
    const euler = eulerFromQuaternion(candidate.orientation);
    const bodyMomentResidual = rotateVectorToBody(
      lastResidual.momentResidual,
      candidate.orientation
    );
    const heaveCorrectionM = clamp(
      lastResidual.forceResidual.y / heaveRateNpm * 0.55, -0.02, 0.02
    );
    const pitchCorrectionRad = clamp(
      bodyMomentResidual.x / pitchRateNmRad * 0.45,
      -0.5 * Math.PI / 180,
      0.5 * Math.PI / 180
    );
    const rollCorrectionRad = clamp(
      bodyMomentResidual.z / rollRateNmRad * 0.45,
      -0.5 * Math.PI / 180,
      0.5 * Math.PI / 180
    );
    trace.push({
      iteration: iteration + 1,
      position: clone(candidate.position),
      orientation: clone(candidate.orientation),
      compressionByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
        wheelId, finite(candidate.suspensionState?.[wheelId]?.compressionM)
      ])),
      loadByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
        wheelId, finite(candidate.contactPatches?.[wheelId]?.normalLoadN)
      ])),
      contactPointByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
        wheelId, clone(candidate.contactPatches?.[wheelId]?.contactPointWorld || null)
      ])),
      forceResidual: clone(lastResidual.forceResidual),
      momentResidual: clone(lastResidual.momentResidual),
      bodyMomentResidual: clone(bodyMomentResidual),
      forceResidualN: lastResidual.forceResidualN,
      momentResidualNm: lastResidual.momentResidualNm,
      maximumPenetrationM: penetration.maximumPenetrationM,
      heaveCorrectionM,
      pitchCorrectionRad,
      rollCorrectionRad
    });
    const penetrationResolved = penetration.maximumPenetrationM !== null
      && finite(penetration.invalidTerrainSampleCount) === 0
      && finite(penetration.maximumPenetrationM)
        <= finite(config.bodyCollisionToleranceM) + 1e-6;
    const stableSupport = lastResidual.stableSupportCount >= 3
      || (lastResidual.stableSupportCount >= 2
        && Math.abs(lastResidual.momentResidual.x) <= momentToleranceNm
        && Math.abs(lastResidual.momentResidual.z) <= momentToleranceNm);
    const iterationConverged = iteration > 0
      && lastResidual.forceResidualN <= forceToleranceN
      && lastResidual.momentResidualNm <= momentToleranceNm
      && Math.abs(heaveCorrectionM) < 0.0005
      && Math.abs(pitchCorrectionRad) < 0.05 * Math.PI / 180
      && Math.abs(rollCorrectionRad) < 0.05 * Math.PI / 180
      && penetrationResolved
      && stableSupport;
    if (iterationConverged) {
      consecutiveConvergedIterations += 1;
      if (consecutiveConvergedIterations >= 2) {
        status = 'converged';
        break;
      }
      // Rebuild once more at the identical pose. Static tire deflection uses
      // the preceding pass's wheel loads, so a single successful pass is not
      // yet proof that the installed load/contact state is a fixed point.
      continue;
    }
    consecutiveConvergedIterations = 0;
    candidate.position.y += heaveCorrectionM;
    candidate.orientation = quaternionFromEuler({
      yaw: euler.yaw,
      pitch: euler.pitch + pitchCorrectionRad,
      roll: euler.roll + rollCorrectionRad
    });
    candidate.pitchRad = euler.pitch + pitchCorrectionRad;
    candidate.rollRad = euler.roll + rollCorrectionRad;
  }
  if (status === 'converged') {
    const finalEnvironment = createEnvironment(candidate, true, trace.length) || {};
    lastResult = tireContactSubsystem.step({
      state: candidate,
      controls,
      config,
      environment: finalEnvironment,
      dt: 0,
      stepIndex,
      substepIndex: 0,
      timeSeconds,
      contactRebuildOnly: true,
      authoritativeReset: true,
      staticSupportSolve: true,
      finalStaticSupportRebuild: true,
      physicsCostAccounting
    }) || {};
    installSupportResult(candidate, lastResult);
    lastResidual = calculateResidual(candidate, config);
    const finalPenetration = bodyCollision.samplePosePenetration(
      candidate, finalEnvironment, config.bodyCollisionToleranceM
    );
    if (lastResidual.forceResidualN > forceToleranceN
      || lastResidual.momentResidualNm > momentToleranceNm
      || finalPenetration.maximumPenetrationM === null
      || finite(finalPenetration.invalidTerrainSampleCount) > 0
      || finite(finalPenetration.maximumPenetrationM)
        > finite(config.bodyCollisionToleranceM) + 1e-6) {
      status = 'failed';
      error = 'final static contact rebuild did not preserve equilibrium';
    }
  }
  return {
    status,
    state: candidate,
    result: lastResult,
    residual: lastResidual,
    iterations: trace.length,
    maximumIterations,
    trace,
    error
  };
}
