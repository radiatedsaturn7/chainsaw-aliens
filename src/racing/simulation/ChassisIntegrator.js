import {
  createRaceVehiclePhysicsState,
  getRaceNormalizedRideHeightM,
  getRaceNormalizedSuspensionTravelM,
  getRaceVehicleWheelWorldPose,
  stepRaceVehiclePhysics,
  syncRaceVehiclePhysicsToSession
} from '../RaceVehiclePhysics.js';
import { RACE_WHEEL_IDS, clamp, deterministicUnitFloat } from './SimulationMath.js';
import { RACE_THREE_ELEVATION_M } from './RaceSimulationConfig.js';

export class ChassisIntegrator {
  createState(options = {}) {
    return createRaceVehiclePhysicsState(options);
  }

  step(state, options = {}) {
    return stepRaceVehiclePhysics(state, options);
  }

  syncToSession(state, session) {
    return syncRaceVehiclePhysicsToSession(state, session);
  }

  getWheelWorldPose(state, wheelId = 'fl') {
    return getRaceVehicleWheelWorldPose(state, wheelId);
  }

  getYawInertiaKgM2(tuning = {}) {
    const mass = Math.max(450, Number(tuning?.weightKg) || 1495);
    const wheelbase = Math.max(2.1, Number(tuning?.wheelbaseM) || 2.67);
    const trackWidth = Math.max(1.25, Number(tuning?.trackWidthM) || 1.82);
    return Math.max(650, mass * (wheelbase * wheelbase + trackWidth * trackWidth) * 0.22);
  }

  getAxleMomentArms(tuning = {}) {
    const wheelbase = Math.max(2.1, Number(tuning?.wheelbaseM) || 2.67);
    const frontWeight = clamp(Number(tuning?.frontWeightDistribution) || 0.54, 0.35, 0.72);
    return {
      front: wheelbase * (1 - frontWeight),
      rear: wheelbase * frontWeight
    };
  }

  getYawAccelerationFromAxleForces({ tuning = {}, frontLatForce = 0, rearLatForce = 0 } = {}) {
    const arms = this.getAxleMomentArms(tuning);
    const inertia = this.getYawInertiaKgM2(tuning);
    const yawMomentNm = Number(rearLatForce || 0) * arms.front - Number(frontLatForce || 0) * arms.rear;
    return yawMomentNm / Math.max(1, inertia);
  }

  getWheelNormalLoads(
    tuning = {},
    longitudinalAcceleration = 0,
    lateralAcceleration = 0,
    speedMps = 0,
    { aeroDownforce = { front: 0, rear: 0 }, aeroLoadEffectiveness = 1 } = {}
  ) {
    const mass = Math.max(450, Number(tuning.weightKg) || 1495);
    const wheelbase = Math.max(2.1, Number(tuning.wheelbaseM) || 2.67);
    const trackWidth = Math.max(1.25, Number(tuning.trackWidthM) || 1.82);
    const cgHeight = clamp(Number(tuning.cgHeightM) || 0.56, 0.3, 1);
    const staticFront = mass * 9.81 * clamp(Number(tuning.frontWeightDistribution) || 0.54, 0.35, 0.72);
    const staticRear = mass * 9.81 - staticFront;
    const aeroEffectiveness = clamp(Number(aeroLoadEffectiveness) || 1, 0, 1);
    const longitudinalTransfer = clamp(
      (mass * longitudinalAcceleration * cgHeight) / wheelbase,
      -mass * 9.81 * 0.22,
      mass * 9.81 * 0.22
    );
    const lateralTransfer = clamp(
      (mass * lateralAcceleration * cgHeight) / trackWidth,
      -mass * 9.81 * 0.62,
      mass * 9.81 * 0.62
    );
    const frontLoad = staticFront + Number(aeroDownforce.front || 0) * aeroEffectiveness - longitudinalTransfer;
    const rearLoad = staticRear + Number(aeroDownforce.rear || 0) * aeroEffectiveness + longitudinalTransfer;
    const distributeAxleLoad = (axleLoad, axleTransfer) => {
      const load = Math.max(0, Number(axleLoad) || 0);
      const left = clamp(load * 0.5 - Number(axleTransfer || 0), 0, load);
      return { left, right: load - left };
    };
    const front = distributeAxleLoad(frontLoad, lateralTransfer * 0.5);
    const rear = distributeAxleLoad(rearLoad, lateralTransfer * 0.5);
    return { fl: front.left, fr: front.right, rl: rear.left, rr: rear.right };
  }

  resolve3DWheelNormalLoads(baseLoads = {}, wheelContacts3d = null, { aeroDownforce = null } = {}) {
    if (!wheelContacts3d) return baseLoads;
    const aeroByWheel = {
      fl: Math.max(0, Number(aeroDownforce?.front || 0)) * 0.5,
      fr: Math.max(0, Number(aeroDownforce?.front || 0)) * 0.5,
      rl: Math.max(0, Number(aeroDownforce?.rear || 0)) * 0.5,
      rr: Math.max(0, Number(aeroDownforce?.rear || 0)) * 0.5
    };
    return Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
      const fallback = Math.max(0, Number(baseLoads?.[wheelId] || 0));
      const wheel = wheelContacts3d?.[wheelId];
      if (!wheel) return [wheelId, fallback];
      if (wheel.inContact === false) return [wheelId, 0];
      if (wheel.normalLoadKnown === false) return [wheelId, fallback];
      const resolvedNormalLoadN = wheel.filteredNormalLoadN ?? wheel.normalLoadN;
      if (Number.isFinite(Number(resolvedNormalLoadN))) {
        const suspensionLoad = Math.max(0, Number(resolvedNormalLoadN));
        if (suspensionLoad <= 1) return [wheelId, 0];
        return [wheelId, suspensionLoad + aeroByWheel[wheelId]];
      }
      return [wheelId, fallback];
    }));
  }
}

export function updateRaceVerticalAndRollState(editor, {
  seconds = 0,
  tuning,
  roadPose,
  previousRoadPose,
  lateralAcceleration = 0,
  wheelContactState = null,
  wheelNormalLoads = null,
  referenceNormalLoads = null,
  wheelContacts3d = null
} = {}) {
  const session = editor.playtestSession;
  if (!session || !roadPose) return;
  const dt = Math.max(0, Number(seconds) || 0);
  const speed = Math.abs(Number(session.speedMps || 0));
  const desiredRideHeightM = (
    getRaceNormalizedRideHeightM(tuning.rideHeightFront)
    + getRaceNormalizedRideHeightM(tuning.rideHeightRear)
  ) * 0.5;
  const roadHeight = Number.isFinite(Number(wheelContactState?.averageHeightM))
    ? Number(wheelContactState.averageHeightM) + desiredRideHeightM
    : Number(roadPose.elevation || 0) * RACE_THREE_ELEVATION_M;
  const previousRoadHeight = Number(previousRoadPose?.elevation || 0) * RACE_THREE_ELEVATION_M;
  const authoritativeVehicle3d = session.vehicle3d?.enabled ? session.vehicle3d : null;
  if (authoritativeVehicle3d) {
    session.heightM = Number(authoritativeVehicle3d.position?.y || 0);
    session.verticalVelocityMps = Number(authoritativeVehicle3d.linearVelocity?.y || 0);
    session.grounded = RACE_WHEEL_IDS.some((wheelId) => authoritativeVehicle3d.wheels?.[wheelId]?.inContact);
    session.airborne = !session.grounded;
  } else {
    if (!Number.isFinite(session.heightM)) session.heightM = roadHeight;
    if (!Number.isFinite(session.verticalVelocityMps)) session.verticalVelocityMps = 0;
    const roadRiseMps = dt > 0 ? (roadHeight - previousRoadHeight) / dt : 0;
    const crestLaunch = roadRiseMps < -2.6 && speed > 18;
    if (crestLaunch && session.grounded !== false) {
      session.grounded = false;
      session.airborne = true;
      session.verticalVelocityMps = Math.max(0.4, speed * 0.045 + Math.abs(roadRiseMps) * 0.12);
    }
    if (session.grounded === false || session.airborne) {
      session.verticalVelocityMps -= 9.81 * dt;
      session.heightM += session.verticalVelocityMps * dt;
      if (session.heightM <= roadHeight) {
        const landingImpact = Math.max(0, -session.verticalVelocityMps);
        session.heightM = roadHeight;
        session.verticalVelocityMps = 0;
        session.grounded = true;
        session.airborne = false;
        session.lastLandingImpactMps = landingImpact;
        session.lastLandingImpactAtMs = Number(session.elapsedMs || 0);
        if (landingImpact > 4.8) {
          const damageSequence = Math.max(0, Math.trunc(Number(session.damageEventSequence || 0)));
          session.damageEventSequence = damageSequence + 1;
          const variation = deterministicUnitFloat(
            editor.selectedRace?.seed ?? editor.selectedRace?.id ?? 'race',
            editor.getRaceSessionCar?.(session)?.id ?? session.vehicleId ?? 'vehicle',
            'landing',
            damageSequence
          );
          editor.applyRaceDamage('suspension', (landingImpact - 4.8) * 1.7, { pull: (variation - 0.5) * 0.05 });
        }
      }
    } else {
      session.heightM += (roadHeight - session.heightM) * Math.min(1, dt * 12);
      session.grounded = true;
      session.airborne = false;
    }
  }
  const trackWidth = Math.max(1.25, Number(tuning.trackWidthM) || 1.82);
  const cgHeight = clamp(Number(tuning.cgHeightM) || 0.56, 0.3, 1);
  const rolloverThresholdG = clamp((trackWidth / (2 * cgHeight)) * 0.96, 1.45, 2.05);
  const lateralG = lateralAcceleration / 9.81;
  session.rollRate = Number(session.rollRate || 0)
    + (lateralG * 0.72 - Number(session.rollRad || 0) * tuning.rollStiffness * 1.25) * dt;
  session.rollRate *= Math.max(0, 1 - dt * tuning.rollDamping * 1.8);
  const terrainRollRad = Number(wheelContactState?.terrainRollRad || 0);
  const terrainPitchRad = Number(wheelContactState?.terrainPitchRad || 0);
  const dynamicRollRad = Number(session.rollRad || 0) + session.rollRate * dt;
  const rollTarget = dynamicRollRad + (terrainRollRad - dynamicRollRad) * Math.min(1, dt * 6);
  session.rollRad = clamp(rollTarget, -1.35, 1.35);
  session.pitchRad = clamp(
    terrainPitchRad + (roadHeight - previousRoadHeight) * 0.025 + Number(session.verticalVelocityMps || 0) * 0.012,
    -0.48,
    0.48
  );
  if (wheelContactState?.heights) {
    const frontTravel = getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelFront);
    const rearTravel = getRaceNormalizedSuspensionTravelM(tuning.suspensionTravelRear);
    session.suspensionTravel = session.suspensionTravel || { fl: 0, fr: 0, rl: 0, rr: 0 };
    const previousCompression = session.previousSuspensionCompression || {};
    const nextCompression = {};
    let bottomOutImpact = 0;
    const bottomOutKeys = [];
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const travel = wheelId === 'fl' || wheelId === 'fr' ? frontTravel : rearTravel;
      const wheelHeight = Number(wheelContactState.heights[wheelId] || 0);
      const extension = session.heightM - wheelHeight;
      const compression = clamp((desiredRideHeightM + travel * 0.5 - extension) / Math.max(0.05, travel), 0, 1.4);
      const previous = Number.isFinite(Number(previousCompression[wheelId]))
        ? Number(previousCompression[wheelId])
        : compression;
      const compressionRate = dt > 0 ? (compression - previous) / dt : 0;
      nextCompression[wheelId] = compression;
      session.suspensionTravel[wheelId] = clamp(compression, 0, 1);
      if (compression > 1.1 && compressionRate > 1.35 && speed > 9) {
        bottomOutImpact = Math.max(bottomOutImpact, (compression - 1.1) * compressionRate * (1 + speed * 0.018));
        bottomOutKeys.push(wheelId);
      }
    });
    session.previousSuspensionCompression = nextCompression;
    if (bottomOutImpact > 0.18 && !session.vehicle3d?.enabled) {
      editor.applyRaceDamage('suspension', bottomOutImpact * 0.24, {
        keys: bottomOutKeys.length ? Array.from(new Set(bottomOutKeys)) : undefined,
        pull: Math.sign(terrainRollRad || 0) * 0.006,
        source: 'suspension:bottom-out'
      });
    }
  }
  const resolvedWheelContacts = wheelContacts3d || session.vehicle3d?.wheels || session.wheelContacts3d || {};
  const resolvedWheelLoads = wheelNormalLoads || Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Number(resolvedWheelContacts?.[wheelId]?.filteredNormalLoadN ?? resolvedWheelContacts?.[wheelId]?.normalLoadN) || 0
  ]));
  const resolvedReferenceLoads = referenceNormalLoads || editor.getRaceWheelNormalLoads(tuning, 0, 0, speed);
  const supportedWheelCount = RACE_WHEEL_IDS.filter((wheelId) => {
    const wheel = resolvedWheelContacts?.[wheelId];
    return wheel?.inContact !== false && Number(resolvedWheelLoads?.[wheelId] || 0) > 1;
  }).length;
  const supportedLoadN = RACE_WHEEL_IDS.reduce((sum, wheelId) => sum + Math.max(0, Number(resolvedWheelLoads?.[wheelId] || 0)), 0);
  const referenceLoadN = RACE_WHEEL_IDS.reduce((sum, wheelId) => sum + Math.max(1, Number(resolvedReferenceLoads?.[wheelId] || 0)), 0);
  const supportedLoadRatio = clamp(supportedLoadN / Math.max(1, referenceLoadN), 0, 1.5);
  const insufficientSupport = supportedWheelCount <= 2 || supportedLoadRatio < 0.65;
  const rolloverCandidate = (
    Math.abs(session.rollRad) > 1.02
    || Math.abs(lateralG) > rolloverThresholdG
  ) && insufficientSupport;
  const elapsedMs = dt * 1000;
  session.rolloverSupportedWheelCount = supportedWheelCount;
  session.rolloverSupportedLoadRatio = supportedLoadRatio;
  session.rolloverCandidateMs = rolloverCandidate
    ? Math.min(1000, Number(session.rolloverCandidateMs || 0) + elapsedMs)
    : Math.max(0, Number(session.rolloverCandidateMs || 0) - elapsedMs * 2);
  if (!session.rolledOver && session.rolloverCandidateMs >= 400) {
    session.rolledOver = true;
    session.rolloverRecoveryMs = 0;
    session.running = true;
    session.eventLog = [...(session.eventLog || []).slice(-5), 'Car rolled over'];
    editor.status = 'Rolled over';
  }
  const uprightAndSupported = Math.abs(session.rollRad) < 0.45
    && supportedWheelCount >= 3
    && supportedLoadRatio >= 0.65
    && session.grounded !== false
    && !session.airborne;
  if (session.rolledOver) {
    session.rolloverRecoveryMs = uprightAndSupported
      ? Number(session.rolloverRecoveryMs || 0) + elapsedMs
      : 0;
    if (session.rolloverRecoveryMs >= 500) {
      session.rolledOver = false;
      session.rolloverCandidateMs = 0;
      session.rolloverRecoveryMs = 0;
      session.eventLog = [...(session.eventLog || []).slice(-5), 'Car recovered'];
      editor.status = 'Recovered';
    } else {
      session.speedMps *= Math.max(0, 1 - dt * 5);
    }
  } else {
    session.rolloverRecoveryMs = 0;
  }
}

export function updateRaceVehicle3DContactState(editor, {
  seconds = 0,
  car = editor.selectedCar,
  tuning = editor.getRaceCarTuning(car),
  acceleration = 0,
  lateralAcceleration = 0,
  brakeState = null,
  driveForce = 0,
  drivenWheelIds = [],
  driveCommandForceByWheel = null,
  driveForceByWheel = null,
  wheelLongitudinalUsage = {},
  wheelLateralUsage = {},
  frontLatForce = 0,
  rearLatForce = 0
} = {}) {
  const session = editor.playtestSession;
  if (!session) return null;
  if (!session.vehicle3d?.enabled) {
    editor.resetRaceVehiclePhysicsState({ session, car, tuning });
  }
  const speedMps = Number(session.speedMps || 0);
  const velocityYaw = Number(session.velocityYaw ?? session.carYaw ?? 0);
  const planarVelocity = {
    x: Math.sin(velocityYaw) * speedMps,
    y: Number(session.velocityY ?? session.verticalVelocityMps ?? 0),
    z: Math.cos(velocityYaw) * speedMps
  };
  const driven = new Set(drivenWheelIds || []);
  const resolvedDriveForceByWheel = driveForceByWheel || Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    driven.has(wheelId) ? Number(driveForce || 0) / Math.max(1, driven.size) : 0
  ]));
  const lateralForceByWheel = {
    fl: Number(frontLatForce || 0) * 0.5,
    fr: Number(frontLatForce || 0) * 0.5,
    rl: Number(rearLatForce || 0) * 0.5,
    rr: Number(rearLatForce || 0) * 0.5
  };
  editor.raceSimulationSystems.chassis.step(session.vehicle3d, {
    dt: seconds,
    tuning,
    carDimensions: editor.getRaceCarDimensions(car),
    surfaceModel: editor.getRaceSurfaceModel(),
    elevationScaleM: RACE_THREE_ELEVATION_M,
    planarVelocity,
    yaw: session.carYaw,
    controls: {
      yawRate: Number(session.yawVelocityRadps || 0),
      longitudinalAcceleration: acceleration,
      lateralAcceleration,
      driveCommandForceByWheel: driveCommandForceByWheel || resolvedDriveForceByWheel,
      driveForceByWheel: resolvedDriveForceByWheel,
      brakeForceByWheel: brakeState?.appliedByWheel || {},
      longitudinalUsageByWheel: wheelLongitudinalUsage,
      lateralUsageByWheel: wheelLateralUsage,
      lateralForceByWheel
    }
  });
  editor.raceSimulationSystems.chassis.syncToSession(session.vehicle3d, session);
  return session.vehicle3d;
}
