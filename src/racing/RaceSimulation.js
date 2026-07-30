import { RACE_WHEEL_IDS, clamp, normalizeAngle } from './simulation/SimulationMath.js';
import { getSurfaceById } from './raceData.js';
import {
  RACE_CONTROLLER_STEERING,
  RACE_PEDAL_INPUT,
  RACE_THREE_ELEVATION_M
} from './simulation/RaceSimulationConfig.js';
import { getAuthoritativeVehicleState } from './simulation/VehicleState.js';

export function updateRaceSimulation({
  editor,
  systems,
  vehicleState: requestedVehicleState,
  input,
  dt = 0
} = {}) {
  if (!editor || !systems) return;
  const vehicleState = getAuthoritativeVehicleState(
    requestedVehicleState || editor.playtestSession
  );
  if (!vehicleState?.running) return;
  if (input && input !== editor.raceInput) editor.raceInput = input;
  if (editor.raceInput.paused) return;
  const car = editor.getRaceSessionCar(editor.playtestSession);
  const tuning = editor.getRaceCarTuning(car);
  tuning.absEnabled = editor.playtestSession.absEnabled !== false;
  tuning.tractionControlEnabled = editor.playtestSession.tractionControlEnabled !== false;
  const seconds = Math.max(0, Number(dt) || 0);
  const countdownActive = Number(editor.playtestSession.countdownRemainingMs || 0) > 0;
  editor.playtestSession.sceneElapsedMs = Math.max(
    0,
    Number(editor.playtestSession.sceneElapsedMs || 0) + seconds * 1000
  );
  if (countdownActive && editor.playtestSession.rollingStart) {
    editor.playtestSession.speedMps = Number(editor.playtestSession.rollingStartSpeedMps || 0);
  }
  editor.applyRaceAnalogInput();
  const physicalGamepad = editor.hasPhysicalRaceGamepad();
  if (!physicalGamepad) editor.raceInput.lookIntentX = 0;
  const lookTarget = physicalGamepad ? clamp(Number(editor.raceInput.lookIntentX || 0), -1, 1) * Math.PI : 0;
  const lookRate = Math.abs(lookTarget) > 0.01 ? 7.5 : 4.2;
  editor.raceInput.lookAngle += (lookTarget - Number(editor.raceInput.lookAngle || 0)) * Math.min(1, seconds * lookRate);
  editor.updateRacePedalAxes(seconds);
  const launchSteeringLocked = countdownActive || (
    editor.isRaceLaunchSteeringLocked(editor.playtestSession)
    && editor.raceInput.analogSteeringActive
  );
  if (launchSteeringLocked) {
    editor.raceInput.steeringTarget = 0;
    editor.raceInput.steeringWheel = 0;
    editor.raceInput.digitalSteerHoldMs = 0;
    editor.playtestSession.lateral = 0;
    editor.playtestSession.heading = 0;
    editor.playtestSession.roadViewOffset = 0;
    editor.playtestSession.trackViewOffset = 0;
    editor.playtestSession.yawVelocityRadps = 0;
  }
  const damageEffects = editor.getRaceDamageEffects();
  const segmentInfo = editor.getRaceSegmentAtDistance(editor.playtestSession.distance, {
    wrap: (editor.playtestSession.routeRuntimeType || editor.getSelectedRaceRuntimeType()) === 'circuit'
  });
  const weatherState = editor.getRaceWeatherState(editor.selectedRace, editor.playtestSession);
  const trackState = editor.playtestSession.trackState || null;
  if (!countdownActive
    && trackState
    && editor.playtestSession.trackStateLastQueuedStep !== trackState.stepIndex) {
    const trackStateAdvance = trackState.advance(
      seconds,
      systems.surface.createTrackStateWeatherForcing({
        weatherState,
        race: editor.selectedRace
      })
    );
    editor.playtestSession.trackStateRuntime = {
      stepIndex: trackState.stepIndex,
      simulationTimeMs: trackState.simulationTimeMs,
      activeCellCount: trackState.cells.size,
      ...trackStateAdvance
    };
  }
  const surface = getSurfaceById(editor.getRaceEffectiveSurfaceId(segmentInfo.segment?.surface || 'asphalt', weatherState));
  const engineJitter = damageEffects.engineJitter
    ? 1 - damageEffects.engineJitter * (0.5 + 0.5 * Math.sin(editor.playtestSession.elapsedMs / 173))
    : 1;
  const setupModifiers = editor.getRaceSetupPhysicsModifiers(tuning, editor.playtestSession.speedMps);
  const damage = editor.getRaceSessionDamage();
  const surfaceSession = countdownActive && trackState
    ? { ...editor.playtestSession, trackState: null }
    : editor.playtestSession;
  const wheelSurfaceState = editor.getRaceWheelSurfaceState({
    car,
    tuning,
    session: surfaceSession,
    damage
  });
  const snowDepthInches = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
    sum + Number(wheelSurfaceState.snowDepthByWheel?.[wheelId] ?? weatherState.snowDepthInches ?? 0)
  ), 0) / RACE_WHEEL_IDS.length;
  const surfaceGrip = wheelSurfaceState.averageSurfaceGrip || (surface.grip * editor.getRaceSegmentSurfaceDetailGrip(segmentInfo.segment));
  const looseSurfaceFactor = editor.getRaceLooseSurfaceFactor(wheelSurfaceState);
  const tireTemperatures = editor.playtestSession?.diagnostics?.tireTemperature || {};
  const tireTemperatureGrip = editor.getRaceTireTemperatureGripMultipliers(tireTemperatures);
  const weatherGripMultiplier = trackState ? 1 : editor.getRaceWeatherGripMultiplier(weatherState);
  const gripFactor = Math.max(0.35, Math.min(1.4, tuning.tireGrip)) * surfaceGrip * weatherGripMultiplier * damageEffects.grip * setupModifiers.grip;
  const setup = editor.getRaceCarSetup(car);
  const tirePressureDynamicsByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const compound = editor.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]);
    return [
      wheelId,
      editor.getRaceTirePressureDynamics({
        pressurePsi: setup.tirePressurePsi[wheelId],
        compoundId: compound.id,
        surfaceId: wheelSurfaceState.surfaceByWheel?.[wheelId] || surface.id,
        tireSize: setup.tireSize,
        temperatureF: tireTemperatures[wheelId]
      })
    ];
  }));
  const perWheelGrip = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const pressureDynamics = tirePressureDynamicsByWheel[wheelId] || {};
    const coldPressureGrip = Math.max(0.01, Number(pressureDynamics.coldGripMultiplier || pressureDynamics.gripMultiplier || 1));
    const hotPressureGrip = Number(pressureDynamics.gripMultiplier || coldPressureGrip);
    const temperaturePressureGrip = clamp(hotPressureGrip / coldPressureGrip, 0.72, 1.08);
    return [
      wheelId,
      clamp(
        Number(wheelSurfaceState.gripByWheel?.[wheelId] || 0.7)
          * Number(tireTemperatureGrip[wheelId] || 1)
          * temperaturePressureGrip,
        0.08,
        1.38
      )
    ];
  }));
  const tirePressureRollingMultiplier = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
    sum + Number(tirePressureDynamicsByWheel[wheelId]?.rollingMultiplier || 1)
  ), 0) / RACE_WHEEL_IDS.length;
  const leftTireGrip = (perWheelGrip.fl + perWheelGrip.rl) * 0.5;
  const rightTireGrip = (perWheelGrip.fr + perWheelGrip.rr) * 0.5;
  let gear = clamp(Math.round(Number(editor.raceInput.gear ?? 0)), -1, tuning.gearRatios.length);
  let automaticOverrevUpshifts = 0;
  const driverThrottle = clamp(Number(editor.raceInput.throttleAxis || 0), 0, 1);
  const driverBrake = clamp(Number(editor.raceInput.brakeAxis || 0), 0, 1);
  let throttle = countdownActive ? 0 : driverThrottle;
  let brake = countdownActive ? 0 : driverBrake;
  const controlsLockedByRollover = Boolean(editor.playtestSession.rolledOver);
  let controlLockReason = controlsLockedByRollover ? 'rollover' : 'none';
  if (controlsLockedByRollover) {
    throttle = 0;
    brake = 0;
  }
  const engineThrottle = controlsLockedByRollover ? 0 : driverThrottle;
  const handbrake = controlsLockedByRollover || countdownActive
    ? 0
    : editor.raceInput.handbrake ? 1 : 0;
  if (handbrake) {
    editor.playtestSession.handbrakeSlipMs = Math.max(Number(editor.playtestSession.handbrakeSlipMs || 0), 760);
  } else {
    editor.playtestSession.handbrakeSlipMs = Math.max(0, Number(editor.playtestSession.handbrakeSlipMs || 0) - seconds * 1000);
  }
  const rawHandbrakeSlip = clamp(Number(editor.playtestSession.handbrakeSlipMs || 0) / 760, 0, 1);
  const absSpeedBefore = Math.abs(editor.playtestSession.speedMps);
  const physicsRouteRuntimeType = editor.playtestSession.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const previousStepDistance = Number(editor.playtestSession.previousDistance || editor.playtestSession.distance || 0);
  const contactRoadProfile = editor.getRaceRoadSurfaceProfileAtDistance(Number(editor.playtestSession.distance || 0), { runtimeType: physicsRouteRuntimeType });
  const contactPreviousRoadProfile = editor.getRaceRoadSurfaceProfileAtDistance(previousStepDistance, { runtimeType: physicsRouteRuntimeType });
  const contactRoadRiseMps = seconds > 0
    ? ((Number(contactRoadProfile.elevation || 0) - Number(contactPreviousRoadProfile.elevation || 0)) * RACE_THREE_ELEVATION_M) / seconds
    : 0;
  const previousWheelContactCount = editor.playtestSession.vehicle3d?.enabled
    ? RACE_WHEEL_IDS.filter((wheelId) => {
      const wheel = editor.playtestSession.vehicle3d.wheels?.[wheelId];
      if (!wheel?.inContact) return false;
      if (wheel.normalLoadKnown === false) return true;
      return Number(wheel.normalLoadN || 0) > 1;
    }).length
    : (editor.playtestSession.airborne || editor.playtestSession.grounded === false ? 0 : RACE_WHEEL_IDS.length);
  const crestLaunchPredicted = previousWheelContactCount > 0
    && contactRoadRiseMps < -2.6
    && absSpeedBefore > 18;
  const tireContactScale = crestLaunchPredicted || editor.playtestSession.airborne || editor.playtestSession.grounded === false
    ? 0
    : clamp(previousWheelContactCount / RACE_WHEEL_IDS.length, 0, 1);
  if (!controlsLockedByRollover && tireContactScale <= 0.001) controlLockReason = 'airborne-contact';
  const isAutomatic = editor.raceInput.autoShift && tuning.shiftMode !== 'manual';
  if (isAutomatic && gear <= 0 && throttle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 1.1) {
    gear = 1;
    editor.raceInput.gear = 1;
  }
  if (isAutomatic && gear < 0 && driverThrottle > RACE_PEDAL_INPUT.activeThreshold) {
    gear = 1;
    editor.raceInput.gear = 1;
  }
  if (isAutomatic && brake > RACE_PEDAL_INPUT.reverseThreshold && throttle <= RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 0.75 && gear >= 0) {
    gear = -1;
    editor.raceInput.gear = -1;
  }
  const automaticReverseBrakeActive = isAutomatic
    && gear < 0
    && brake > RACE_PEDAL_INPUT.activeThreshold
    && throttle <= RACE_PEDAL_INPUT.activeThreshold;
  if (automaticReverseBrakeActive) {
    throttle = brake;
    brake = 0;
  }
  if (isAutomatic && gear < 0 && driverThrottle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 0.75) {
    gear = 1;
    editor.raceInput.gear = 1;
  }
  if (isAutomatic && gear > 0 && Number(editor.playtestSession.speedMps || 0) > 0.75) {
    const safeCurrentGearRpm = Math.max(editor.getRaceAutomaticUpshiftRpm(tuning), tuning.revLimitRpm * 0.985);
    while (
      gear < tuning.gearRatios.length
      && editor.getRaceProjectedEngineRpmForGear(tuning, absSpeedBefore, gear) > safeCurrentGearRpm
    ) {
      gear += 1;
      automaticOverrevUpshifts += 1;
      editor.raceInput.gear = gear;
    }
  }
  const gearRatio = editor.getRaceGearRatio(tuning, gear);
  const binarySteer = launchSteeringLocked ? 0 : clamp(Number(editor.raceInput.binarySteer || 0), -1, 1);
  const binaryActive = Math.abs(binarySteer) > 0.01;
  if (launchSteeringLocked) {
    editor.raceInput.digitalSteerHoldMs = 0;
  } else if (editor.raceInput.analogSteeringActive) {
    editor.raceInput.lastSteeringInputMode = 'analog';
    editor.raceInput.digitalSteerHoldMs = 0;
    const analogIntent = clamp(Number(editor.raceInput.analogSteeringIntent || 0), -1, 1);
    const analogRate = editor.getRaceAnalogSteeringTargetRate(editor.playtestSession.speedMps, analogIntent);
    editor.raceInput.steeringTarget += (analogIntent - Number(editor.raceInput.steeringTarget || 0)) * Math.min(0.38, seconds * analogRate);
  } else {
    if (binaryActive) {
      editor.raceInput.lastSteeringInputMode = 'binary';
      editor.raceInput.digitalSteerHoldMs = Number(editor.raceInput.digitalSteerHoldMs || 0) + seconds * 1000;
      const hold = clamp(
        Number(editor.raceInput.digitalSteerHoldMs || 0) / RACE_CONTROLLER_STEERING.digitalTargetHoldRampMs,
        0,
        1
      );
      const speedFactor = clamp(
        Math.abs(Number(editor.playtestSession.speedMps) || 0) / RACE_CONTROLLER_STEERING.speedReferenceMps,
        0,
        1
      );
      const nudgeRate = (
        RACE_CONTROLLER_STEERING.digitalTargetPressBase
        + hold * RACE_CONTROLLER_STEERING.digitalTargetPressHoldBonus
      ) * (1 - speedFactor * 0.35);
      editor.raceInput.steeringTarget += binarySteer * seconds * nudgeRate;
    } else {
      editor.raceInput.digitalSteerHoldMs = 0;
      const analogCentered = editor.raceInput.lastSteeringInputMode === 'analog';
      const centeredMs = Number(editor.raceInput.analogSteeringCenteredMs || 0) + (analogCentered ? seconds * 1000 : 0);
      if (analogCentered) editor.raceInput.analogSteeringCenteredMs = centeredMs;
      const returnRate = analogCentered
        ? editor.getRaceAnalogSteeringReleaseRate(editor.playtestSession.speedMps) * (centeredMs > 90 ? 1.45 : 1)
        : editor.getRaceSteeringReturnRate(editor.playtestSession.speedMps);
      editor.raceInput.steeringTarget += (0 - Number(editor.raceInput.steeringTarget || 0)) * Math.min(0.88, seconds * returnRate);
    }
  }
  editor.raceInput.steeringTarget = clamp(editor.raceInput.steeringTarget, -1, 1);
  const activeTurnInput = !launchSteeringLocked && (binaryActive || editor.raceInput.analogSteeringActive);
  const wheelResponse = editor.raceInput.analogSteeringActive
    ? editor.getRaceAnalogSteerResponse(editor.playtestSession.speedMps)
    : (binaryActive ? editor.getRaceBinarySteerAssist(editor.playtestSession.speedMps).response : editor.getRaceSteeringReturnRate(editor.playtestSession.speedMps) + 1.2);
  const activeTurnResponseScale = editor.raceInput.analogSteeringActive
    ? RACE_CONTROLLER_STEERING.analogActiveTurnResponseScale
    : RACE_CONTROLLER_STEERING.digitalActiveTurnResponseScale;
  const wheelResponseStep = Math.min(
    activeTurnInput ? 1.05 * activeTurnResponseScale : 0.94,
    seconds * wheelResponse * (activeTurnInput ? activeTurnResponseScale : 1)
  );
  editor.raceInput.steeringWheel += (editor.raceInput.steeringTarget - editor.raceInput.steeringWheel) * wheelResponseStep;
  if (!editor.raceInput.analogSteeringActive
    && !binaryActive
    && Math.abs(editor.raceInput.steeringWheel) < 0.026
    && Math.abs(editor.raceInput.steeringTarget) < 0.026) {
    editor.raceInput.steeringWheel = 0;
    editor.raceInput.steeringTarget = 0;
    editor.raceInput.analogSteeringCenteredMs = 0;
    editor.raceInput.lastSteeringInputMode = null;
  }
  const driveDirection = gear < 0 ? -1 : gear > 0 ? 1 : 0;
  editor.playtestSession.previousDistance = editor.playtestSession.distance;
  if (countdownActive) {
    editor.playtestSession.countdownRemainingMs = Math.max(0, Number(editor.playtestSession.countdownRemainingMs || 0) - seconds * 1000);
    if (editor.playtestSession.countdownRemainingMs <= 0) {
      editor.playtestSession.startupPhase = 'running';
    }
  } else {
    editor.playtestSession.elapsedMs += seconds * 1000;
  }
  if (!countdownActive) editor.updateRaceTriggers();
  editor.playtestSession.launchLockMs = Math.max(0, Number(editor.playtestSession.launchLockMs || 0) - seconds * 1000);
  editor.playtestSession.edgeResetFadeMs = Math.max(0, Number(editor.playtestSession.edgeResetFadeMs || 0) - seconds * 1000);
  editor.updateRaceEdgeCenterResetFade();
  editor.playtestSession.shiftCooldownMs = Math.max(0, Number(editor.playtestSession.shiftCooldownMs || 0) - seconds * 1000);
  const wheelContacts3d = editor.playtestSession.vehicle3d?.wheels || editor.playtestSession.wheelContacts3d || null;
  const effectiveWheelContacts3d = crestLaunchPredicted
    ? Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, {
      ...(wheelContacts3d?.[wheelId] || {}),
      inContact: false,
      normalLoadKnown: true,
      normalLoadN: 0
    }]))
    : wheelContacts3d;
  const aeroLoadEffectiveness = editor.getRaceAeroLoadEffectiveness(looseSurfaceFactor);
  const neutralReferenceNormalLoads = editor.getRaceWheelNormalLoads(tuning, 0, 0, absSpeedBefore, { aeroLoadEffectiveness });
  const aeroDownforceForLoads = editor.getRaceEffectiveAeroDownforceByAxle(tuning, absSpeedBefore, looseSurfaceFactor);
  const neutralNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    neutralReferenceNormalLoads,
    effectiveWheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  const initialNormalLoads = { ...neutralNormalLoads };
  const bumpNormalLoadScales = editor.getRaceBumpNormalLoadScales({
    segment: segmentInfo.segment,
    distance: editor.playtestSession.distance,
    speedMps: absSpeedBefore
  });
  editor.applyRaceBumpNormalLoadScales(initialNormalLoads, bumpNormalLoadScales);
  const drivenWheelIds = editor.getRaceDrivenWheelIds(tuning);
  const drivenStaticLoad = drivenWheelIds.reduce((sum, wheelId) => sum + Math.max(1, Number(neutralReferenceNormalLoads[wheelId] || 0)), 0);
  const drivenContactLoad = wheelContacts3d
    ? drivenWheelIds.reduce((sum, wheelId) => {
      const wheel = wheelContacts3d[wheelId];
      if (!wheel || wheel.inContact === false) return sum;
      return sum + Math.max(0, Number(initialNormalLoads[wheelId] || 0));
    }, 0)
    : drivenStaticLoad * tireContactScale;
  const drivenLoadScale = tireContactScale <= 0.001
    ? 0
    : clamp(drivenContactLoad / Math.max(1, drivenStaticLoad), 0, 1);
  const drivenWheelRotationSamples = drivenWheelIds
    .map((wheelId) => {
      const wheel = effectiveWheelContacts3d?.[wheelId];
      const loadN = Math.max(0, Number(wheel?.filteredNormalLoadN ?? wheel?.normalLoadN) || 0);
      if (!wheel || wheel.inContact === false || loadN <= 1) return null;
      return {
        loadN,
        angularSpeedRadps: Math.abs(Number(wheel.angularSpeedRadps) || 0),
        slipRatio: Math.max(0, Number(wheel.longitudinalSlipRatio ?? wheel.slipLongitudinal) || 0)
      };
    })
    .filter(Boolean);
  const drivenWheelRotationLoadN = drivenWheelRotationSamples.reduce((sum, wheel) => sum + wheel.loadN, 0);
  const measuredDrivenWheelSlipRatio = drivenWheelRotationLoadN > 1
    ? drivenWheelRotationSamples.reduce((sum, wheel) => sum + wheel.slipRatio * wheel.loadN, 0) / drivenWheelRotationLoadN
    : 0;
  const coupledDrivenWheelAngularSpeedRadps = drivenWheelRotationLoadN > 1
    ? drivenWheelRotationSamples.reduce((sum, wheel) => sum + wheel.angularSpeedRadps * wheel.loadN, 0) / drivenWheelRotationLoadN
    : null;
  const wheelRpm = gearRatio
    ? (
      coupledDrivenWheelAngularSpeedRadps == null
        ? absSpeedBefore / Math.max(0.01, tuning.wheelRadiusM)
        : coupledDrivenWheelAngularSpeedRadps
    ) * gearRatio * tuning.finalDrive * (60 / (Math.PI * 2))
    : 0;
  const limiterPhase = Math.sin(editor.playtestSession.sceneElapsedMs / 34) > 0 ? 1 : 0;
  const neutralLimiterTarget = tuning.revLimitRpm - tuning.revLimiterDropRpm * limiterPhase;
  const neutralRevTarget = engineThrottle > RACE_PEDAL_INPUT.activeThreshold ? neutralLimiterTarget : tuning.idleRpm;
  const roadCoupledRpmTarget = gearRatio
    ? clamp(
      Math.max(
        wheelRpm * (1 + tuning.torqueConverterSlip * engineThrottle),
        engineThrottle > RACE_PEDAL_INPUT.activeThreshold
          ? Math.min(tuning.launchRpm, tuning.revLimitRpm)
          : tuning.idleRpm
      ),
      tuning.idleRpm,
      tuning.revLimitRpm
    )
    : neutralRevTarget;
  const shiftWindowMs = Math.max(1, tuning.shiftTimeMs + editor.getRaceDamageEffects().shiftDelayMs);
  const shiftClutchDisengagement = editor.playtestSession.shiftCooldownMs > 0
    ? clamp(Number(editor.playtestSession.shiftCooldownMs || 0) / shiftWindowMs, 0, 1)
    : 0;
  const previousLongitudinalWheelSlipRatio = measuredDrivenWheelSlipRatio;
  const longitudinalSlipTarget = editor.getRaceLongitudinalSlipTarget(looseSurfaceFactor);
  const wheelspinDrivetrainUnload = gearRatio
    && driveDirection !== 0
    && drivenLoadScale > 0.001
    ? clamp((previousLongitudinalWheelSlipRatio - longitudinalSlipTarget) / 0.9, 0, 1) * (
      engineThrottle > RACE_PEDAL_INPUT.activeThreshold
        ? 0.38 + looseSurfaceFactor * 0.24
        : 0.18 + looseSurfaceFactor * 0.2
    )
    : 0;
  const drivetrainUnload = gearRatio ? Math.max(1 - drivenLoadScale, shiftClutchDisengagement, wheelspinDrivetrainUnload) : 1;
  const stagedFreeRevTarget = tuning.idleRpm
    + (neutralLimiterTarget - tuning.idleRpm) * engineThrottle;
  const loadedRpmTarget = countdownActive
    ? stagedFreeRevTarget
    : gearRatio
      ? roadCoupledRpmTarget + (neutralRevTarget - roadCoupledRpmTarget) * drivetrainUnload
      : neutralRevTarget;
  const loadedRpmResponse = engineThrottle > RACE_PEDAL_INPUT.activeThreshold ? 4.6 : 8.5;
  const freeRpmResponse = engineThrottle > RACE_PEDAL_INPUT.activeThreshold ? 7.6 : 3.8;
  const rpmResponse = countdownActive
    ? freeRpmResponse
    : gearRatio
      ? loadedRpmResponse + (freeRpmResponse - loadedRpmResponse) * drivetrainUnload
      : freeRpmResponse;
  const liftOffWheelspinInertia = throttle <= RACE_PEDAL_INPUT.activeThreshold
    ? clamp((previousLongitudinalWheelSlipRatio - 0.8) / 0.9, 0, 1) * (0.28 + looseSurfaceFactor * 0.38)
    : 0;
  const effectiveRpmResponse = rpmResponse * (1 - liftOffWheelspinInertia);
  editor.playtestSession.engineRpm = Number(editor.playtestSession.engineRpm || tuning.idleRpm)
    + (loadedRpmTarget - Number(editor.playtestSession.engineRpm || tuning.idleRpm)) * Math.min(1, seconds * effectiveRpmResponse);
  editor.playtestSession.engineRpm = clamp(editor.playtestSession.engineRpm, tuning.idleRpm * 0.72, tuning.revLimitRpm + (gearRatio ? 40 : 80));
  const limiterActive = editor.playtestSession.engineRpm >= tuning.revLimitRpm - 80;
  const limiterCut = limiterActive && engineThrottle > RACE_PEDAL_INPUT.activeThreshold ? 0.08 + 0.18 * limiterPhase : 1;
  const shiftTorqueCut = editor.playtestSession.shiftCooldownMs > 0
    ? clamp(1 - (editor.playtestSession.shiftCooldownMs / shiftWindowMs), 0.12, 1)
    : 1;
  const launchAssistRpm = tuning.idleRpm + (tuning.launchRpm - tuning.idleRpm) * clamp(absSpeedBefore / 5, 0.35, 1);
  const torqueRpm = gearRatio && throttle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 5
    ? Math.max(editor.playtestSession.engineRpm, launchAssistRpm)
    : editor.playtestSession.engineRpm;
  const engineTorqueNm = editor.getRaceTorqueNmAtRpm(torqueRpm, tuning) * damageEffects.enginePower * engineJitter;
  const availablePowerW = tuning.powerHp * 745.7 * damageEffects.enginePower * engineJitter;
  const driveForceComponents = editor.getRaceDriveForceComponents({
    tuning,
    gearRatio,
    engineTorqueNm,
    availablePowerW,
    speedMps: absSpeedBefore
  });
  let driveForceCommandRaw = driveForceComponents.baseForceN * tuning.accelerationCalibration * throttle * limiterCut * shiftTorqueCut * driveDirection;
  let driveForceRaw = drivenLoadScale > 0.001 ? driveForceCommandRaw : 0;
  if (automaticReverseBrakeActive && driverThrottle <= RACE_PEDAL_INPUT.activeThreshold && driverBrake > RACE_PEDAL_INPUT.activeThreshold) {
    const reverseAssistForce = tuning.weightKg * 1.05 * clamp(driverBrake, 0, 1);
    driveForceCommandRaw = Math.min(driveForceCommandRaw, -reverseAssistForce);
    driveForceRaw = drivenLoadScale > 0.001 ? driveForceCommandRaw : 0;
  }
  if (controlsLockedByRollover) {
    driveForceCommandRaw = 0;
    driveForceRaw = 0;
  }
  const driveForceDemandRaw = driveForceCommandRaw;
  const preliminaryDrivenTraction = editor.getRaceDrivenTractionLimit({
    tuning,
    drivenWheelIds,
    normalLoads: initialNormalLoads,
    referenceNormalLoads: neutralReferenceNormalLoads,
    gripByWheel: perWheelGrip,
    gripFactor,
    looseSurfaceFactor,
    setupModifiers
  });
  const preliminaryDrivenTractionLimit = preliminaryDrivenTraction.tractionLimitN;
  const preliminaryDriveDemandRatio = driveForceDemandRaw
    ? Math.abs(driveForceDemandRaw) / Math.max(1, preliminaryDrivenTractionLimit)
    : 0;
  const tractionControlActive = tuning.tractionControlEnabled
    && !handbrake
    && throttle > RACE_PEDAL_INPUT.activeThreshold
    && drivenLoadScale > 0.001;
  const preliminaryTractionControlSlip = measuredDrivenWheelSlipRatio;
  const preliminaryTractionControlCutTarget = editor.getRaceTractionControlCutTarget(
    preliminaryTractionControlSlip,
    looseSurfaceFactor,
    tractionControlActive
  );
  const tractionControlCut = editor.getRaceTractionControlAppliedCut(
    preliminaryTractionControlCutTarget,
    looseSurfaceFactor,
    seconds,
    tractionControlActive,
    { commit: false }
  );
  const preliminaryDriveForceRaw = drivenLoadScale > 0.001
    ? driveForceCommandRaw * tractionControlCut
    : 0;
  const preliminaryAppliedDriveDemandRatio = preliminaryDriveForceRaw
    ? Math.abs(preliminaryDriveForceRaw) / Math.max(1, preliminaryDrivenTractionLimit)
    : 0;
  const preliminaryExcessDriveSlip = clamp(
    (measuredDrivenWheelSlipRatio - longitudinalSlipTarget) / Math.max(0.2, 0.65 + looseSurfaceFactor * 0.25),
    0,
    1
  );
  const preliminaryPostPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(
    preliminaryExcessDriveSlip,
    looseSurfaceFactor,
    false
  );
  const preliminaryEffectiveDrivenTractionLimit = preliminaryDrivenTractionLimit * preliminaryPostPeakTractionEfficiency;
  const preliminaryAppliedDriveForce = clamp(
    preliminaryDriveForceRaw,
    -preliminaryEffectiveDrivenTractionLimit,
    preliminaryEffectiveDrivenTractionLimit
  );
  const driveLoadAcceleration = clamp(
    preliminaryAppliedDriveForce / Math.max(450, Number(tuning.weightKg) || 1400),
    -9.5,
    9.5
  );
  const driveNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, driveLoadAcceleration, 0, absSpeedBefore, { aeroLoadEffectiveness }),
    effectiveWheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(driveNormalLoads, bumpNormalLoadScales);
  let driveForceShareByWheel = editor.getRaceDriveForceShareByWheel(tuning, drivenWheelIds, {
    normalLoads: driveNormalLoads,
    gripByWheel: perWheelGrip,
    driveForce: driveForceRaw
  });
  const drivenTraction = editor.getRaceDrivenTractionLimit({
    tuning,
    drivenWheelIds,
    normalLoads: driveNormalLoads,
    referenceNormalLoads: neutralReferenceNormalLoads,
    gripByWheel: perWheelGrip,
    gripFactor,
    looseSurfaceFactor,
    setupModifiers
  });
  const drivenTractionLimit = drivenTraction.tractionLimitN;
  driveForceShareByWheel = drivenTraction.forceShareByWheel || driveForceShareByWheel;
  const driveLoadSensitivityByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      editor.getRaceTireLoadSensitivityMultiplier(driveNormalLoads[wheelId], neutralReferenceNormalLoads[wheelId], looseSurfaceFactor)
  ]));
  const driveDemandRatio = driveForceDemandRaw
    ? Math.abs(driveForceDemandRaw) / Math.max(1, drivenTractionLimit)
    : 0;
  const tractionControlSlip = measuredDrivenWheelSlipRatio;
  const tractionControlCutTarget = editor.getRaceTractionControlCutTarget(
    tractionControlSlip,
    looseSurfaceFactor,
    tractionControlActive
  );
  const finalTractionControlCut = editor.getRaceTractionControlAppliedCut(
    tractionControlCutTarget,
    looseSurfaceFactor,
    seconds,
    tractionControlActive
  );
  if (finalTractionControlCut < 1) driveForceRaw = drivenLoadScale > 0.001
    ? driveForceCommandRaw * finalTractionControlCut
    : 0;
  const appliedDriveDemandRatio = driveForceRaw
    ? Math.abs(driveForceRaw) / Math.max(1, drivenTractionLimit)
    : 0;
  const excessDriveSlip = clamp(
    (measuredDrivenWheelSlipRatio - longitudinalSlipTarget) / Math.max(0.2, 0.65 + looseSurfaceFactor * 0.25),
    0,
    1
  );
  const postPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(
    excessDriveSlip,
    looseSurfaceFactor,
    false
  );
  const effectiveDrivenTractionLimit = drivenTractionLimit * postPeakTractionEfficiency;
  const driveForce = clamp(driveForceRaw, -effectiveDrivenTractionLimit, effectiveDrivenTractionLimit);
  const wheelSpinRatio = clamp(measuredDrivenWheelSlipRatio, 0, 1.8);
  const relaxedWheelSpinRatio = editor.getRaceRelaxedLongitudinalSlipRatio({
    targetSlipRatio: wheelSpinRatio,
    speedMps: absSpeedBefore,
    looseSurfaceFactor,
    tireContactScale,
    seconds,
    reset: launchSteeringLocked || drivenLoadScale <= 0.001
  });
  editor.playtestSession.longitudinalWheelSlipRatio = measuredDrivenWheelSlipRatio;
  editor.playtestSession.measuredDrivenWheelSlipRatio = measuredDrivenWheelSlipRatio;
  editor.playtestSession.tractionControlSlipTarget = longitudinalSlipTarget;
  const engineBraking = editor.getRaceEngineBrakingForce({
    tuning,
    gearRatio,
    throttle,
    speedMps: editor.playtestSession.speedMps,
    engineRpm: editor.playtestSession.engineRpm,
    drivenTractionLimit,
    tireContactScale: drivenLoadScale
  });
  if (countdownActive) engineBraking.force = 0;
  const engineBrakeForceShareByWheel = editor.getRaceDriveForceShareByWheel(tuning, drivenWheelIds, {
    normalLoads: driveNormalLoads,
    gripByWheel: perWheelGrip,
    driveForce: engineBraking.force
  });
  const engineBrakeForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    engineBraking.force * Number(engineBrakeForceShareByWheel[wheelId] || 0)
  ]));
  const preliminaryBrakeState = editor.getRaceBrakeForceForInput({
    tuning,
    brake,
    handbrake,
    gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
    normalLoads: initialNormalLoads,
    referenceNormalLoads: neutralReferenceNormalLoads,
    looseSurfaceFactor,
    speedMps: editor.playtestSession.speedMps
  });
  if (tireContactScale <= 0.001) preliminaryBrakeState.force = 0;
  const brakeLoadAcceleration = -preliminaryBrakeState.force / Math.max(450, Number(tuning.weightKg) || 1400);
  const brakeNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(
      tuning,
      brakeLoadAcceleration,
      Number(editor.playtestSession.tireSlip?.lateralAcceleration || 0),
      absSpeedBefore,
      { aeroLoadEffectiveness }
    ),
    effectiveWheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(brakeNormalLoads, bumpNormalLoadScales);
  const brakeState = editor.getRaceBrakeForceForInput({
    tuning,
    brake,
    handbrake,
    gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
    normalLoads: brakeNormalLoads,
    referenceNormalLoads: neutralReferenceNormalLoads,
    looseSurfaceFactor,
    speedMps: editor.playtestSession.speedMps
  });
  if (tireContactScale <= 0.001) {
    brakeState.force = 0;
    brakeState.appliedByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
    brakeState.lockByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
  }
  const brakeForce = brakeState.force;
  const offRoadWheelCount = Object.values(wheelSurfaceState.terrainByWheel).filter((terrain) => terrain !== 'road').length;
  const localRollingResistance = trackState
    ? Math.max(0.35, Number(wheelSurfaceState.averageRollingResistance || 1))
    : 1;
  const terrainResistance = (1 + looseSurfaceFactor * 0.32 + offRoadWheelCount * 0.18
    + Object.values(wheelSurfaceState.terrainGripScaleByWheel).reduce((sum, value) => sum + Math.max(0, 1 - Number(value || 1)), 0) * 0.22
    + editor.getRaceSnowResistanceMultiplier(snowDepthInches)) * localRollingResistance;
  const resistanceForces = editor.getRaceLongitudinalResistanceForces({
    tuning,
    speedMps: absSpeedBefore,
    setupModifiers,
    terrainResistance,
    tirePressureRollingMultiplier,
    tireContactScale,
    panelDrag: damageEffects.panelDrag
  });
  const dragForce = resistanceForces.totalN;
  const resistanceDirection = editor.playtestSession.speedMps >= 0 ? -1 : 1;
  const brakeDirection = editor.playtestSession.speedMps >= 0 ? -1 : 1;
  const gradeSampleDistance = 12;
  const gradeRuntimeType = editor.playtestSession.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const gradeProfile = editor.getRaceRoadSurfaceProfileAtDistance(Number(editor.playtestSession.distance || 0), { runtimeType: gradeRuntimeType });
  const gradeAheadProfile = editor.getRaceRoadSurfaceProfileAtDistance(Number(editor.playtestSession.distance || 0) + gradeSampleDistance, { runtimeType: gradeRuntimeType });
  const gradeBehindProfile = editor.getRaceRoadSurfaceProfileAtDistance(Number(editor.playtestSession.distance || 0) - gradeSampleDistance, { runtimeType: gradeRuntimeType });
  const roadGrade = Number.isFinite(Number(gradeProfile.grade))
    ? Number(gradeProfile.grade)
    : clamp(
      ((Number(gradeAheadProfile.elevation || 0) - Number(gradeBehindProfile.elevation || 0)) * RACE_THREE_ELEVATION_M) / (gradeSampleDistance * 2),
      -0.42,
      0.42
    );
  const gradeForce = -tuning.weightKg * 9.81 * editor.getRaceGradeGravityRatio(roadGrade) * tireContactScale;
  const tireLongitudinalLoadAcceleration = clamp(
    (driveForce + engineBraking.force + brakeDirection * brakeForce) / Math.max(450, Number(tuning.weightKg) || 1400),
    -9.5,
    9.5
  );
  let acceleration = (
    driveForce
    + engineBraking.force
    + gradeForce
    + resistanceDirection * dragForce
    + brakeDirection * brakeForce
  ) / tuning.weightKg;
  const routeRuntimeType = editor.playtestSession.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const absSpeed = Math.abs(editor.playtestSession.speedMps);
  const tireTravelDirection = editor.playtestSession.speedMps < -0.2 ? -1 : 1;
  const launchLockActive = editor.isRaceLaunchSteeringLocked(editor.playtestSession);
  const roadSteer = launchSteeringLocked ? 0 : editor.raceInput.steeringWheel;
  const roadPose = editor.getRaceWorldPoseAtDistance(editor.playtestSession.distance, { runtimeType: routeRuntimeType });
  const previousRoadPose = editor.getRaceWorldPoseAtDistance(previousStepDistance, { runtimeType: routeRuntimeType });
  const roadProfile = editor.getRaceRoadSurfaceProfileAtDistance(editor.playtestSession.distance, { runtimeType: routeRuntimeType });
  const previousRoadProfile = editor.getRaceRoadSurfaceProfileAtDistance(previousStepDistance, { runtimeType: routeRuntimeType });
  const deckSample = editor.getRaceRoadCorridorSampleAtDistance(editor.playtestSession.distance, { runtimeType: routeRuntimeType });
  const bankAngleRad = Number(deckSample?.bankAngleRad || 0);
  roadPose.elevation = roadProfile.elevation;
  previousRoadPose.elevation = previousRoadProfile.elevation;
  const roadYaw = roadPose.yaw;
  const previousCarYaw = Number.isFinite(editor.playtestSession.carYaw)
    ? editor.playtestSession.carYaw
    : roadYaw;
  const wheelbaseM = tuning.wheelbaseM;
  const launchAligning = launchLockActive || (Number(editor.playtestSession.elapsedMs || 0) <= 120 && absSpeed < 0.8);
  const effectiveRoadSteer = launchAligning ? 0 : roadSteer;
  const rawSteeringAngle = launchAligning
    ? 0
    : editor.getRaceRawTireAngleForSteering(effectiveRoadSteer, absSpeed);
  const bankTurnDirection = Math.sign(
    (rawSteeringAngle || effectiveRoadSteer || 0) * tireTravelDirection
    || -bankAngleRad
    || 0
  );
  const signedBankSupportG = clamp(
    -bankTurnDirection * Math.sin(bankAngleRad),
    -0.68,
    0.68
  );
  const bankSupportG = Math.max(0, signedBankSupportG);
  const bankOppositionG = Math.max(0, -signedBankSupportG);
  const bankNormalLoadScale = clamp(
    Math.cos(bankAngleRad) + bankSupportG * 0.28 - bankOppositionG * 0.16,
    0.7,
    1.16
  );
  const steeringSpeedScale = launchAligning ? 0 : clamp(absSpeed / 2.8, 0, 1);
  const lateralForceSpeedScale = launchAligning ? 0 : clamp(absSpeed / 6, 0, 1);
  const previousVelocityYaw = Number.isFinite(editor.playtestSession.velocityYaw)
    ? editor.playtestSession.velocityYaw
    : previousCarYaw;
  const vehicleSlipAngle = normalizeAngle(previousVelocityYaw - previousCarYaw);
  const previousLateralAcceleration = Number(editor.playtestSession.tireSlip?.lateralAcceleration || 0);
  const dynamicReferenceNormalLoads = editor.getRaceWheelNormalLoads(tuning, 0, 0, absSpeed, { aeroLoadEffectiveness });
  const dynamicNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, tireLongitudinalLoadAcceleration, previousLateralAcceleration, absSpeed, { aeroLoadEffectiveness }),
    effectiveWheelContacts3d,
    { aeroDownforce: editor.getRaceEffectiveAeroDownforceByAxle(tuning, absSpeed, looseSurfaceFactor) }
  );
  editor.applyRaceBumpNormalLoadScales(dynamicNormalLoads, bumpNormalLoadScales);
  const wheelContactScaleByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    clamp(
      Number(dynamicNormalLoads[wheelId] || 0) / Math.max(1, Number(dynamicReferenceNormalLoads[wheelId] || 1)),
      0,
      1
    )
  ]));
  const frontNormal = (dynamicNormalLoads.fl + dynamicNormalLoads.fr) * bankNormalLoadScale;
  const rearNormal = (dynamicNormalLoads.rl + dynamicNormalLoads.rr) * bankNormalLoadScale;
  const referenceFrontNormal = Math.max(1, (dynamicReferenceNormalLoads.fl + dynamicReferenceNormalLoads.fr) * bankNormalLoadScale);
  const referenceRearNormal = Math.max(1, (dynamicReferenceNormalLoads.rl + dynamicReferenceNormalLoads.rr) * bankNormalLoadScale);
  const frontAxleLoadRatio = clamp(frontNormal / referenceFrontNormal, 0, 1);
  const frontContactAuthorityProgress = clamp((frontAxleLoadRatio - 0.08) / 0.62, 0, 1);
  const frontAxleContactScale = frontContactAuthorityProgress
    * frontContactAuthorityProgress
    * (3 - 2 * frontContactAuthorityProgress);
  const rearAxleContactScale = clamp(rearNormal / referenceRearNormal, 0, 1);
  const handbrakeSlip = rawHandbrakeSlip * rearAxleContactScale;
  const frontGrip = (perWheelGrip.fl + perWheelGrip.fr) * 0.5 * Math.max(0.25, gripFactor) * setupModifiers.frontGrip;
  const rearGrip = (perWheelGrip.rl + perWheelGrip.rr) * 0.5 * Math.max(0.25, gripFactor) * setupModifiers.rearGrip * (1 - handbrakeSlip * 0.92);
  const steeringYawAuthorityScale = steeringSpeedScale * frontAxleContactScale;
  const wheelLongitudinalUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const wheelLimit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads: dynamicReferenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      normalLoadScale: bankNormalLoadScale
    });
    const brakeUsage = Number(brakeState.appliedByWheel?.[wheelId] || 0);
    const driveUsage = Math.abs(driveForceRaw) * Number(driveForceShareByWheel[wheelId] || 0);
    const engineBrakeUsage = Math.abs(engineBraking.force) * Number(engineBrakeForceShareByWheel[wheelId] || 0);
    if (wheelLimit <= 0.001) return [wheelId, 0];
    return [wheelId, clamp((brakeUsage + driveUsage + engineBrakeUsage) / wheelLimit, 0, 2.2)];
  }));
  const driveForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    driveForce * Number(driveForceShareByWheel[wheelId] || 0)
  ]));
  const driveCommandForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    driveForceRaw * Number(driveForceShareByWheel[wheelId] || 0)
      + Number(engineBrakeForceByWheel[wheelId] || 0)
  ]));
  const chassisLongitudinalForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Number(driveForceByWheel[wheelId] || 0) + Number(engineBrakeForceByWheel[wheelId] || 0)
  ]));
  const frontLongitudinalUsage = (wheelLongitudinalUsage.fl + wheelLongitudinalUsage.fr) * 0.5;
  const rearLongitudinalUsage = (wheelLongitudinalUsage.rl + wheelLongitudinalUsage.rr) * 0.5;
  const effectiveFrictionMuByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const load = Math.max(0, Number(dynamicNormalLoads[wheelId] || 0) * bankNormalLoadScale);
    const limit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads: dynamicReferenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      normalLoadScale: bankNormalLoadScale
    });
    return [wheelId, load > 0.001 ? limit / load : 0];
  }));
  const frontFrictionCircle = Math.sqrt(Math.max(0.08, 1 - Math.pow(frontLongitudinalUsage, 2) * 0.78));
  const rearFrictionCircle = Math.sqrt(Math.max(0.08, 1 - Math.pow(rearLongitudinalUsage, 2) * 0.86));
  const frontLoadSensitivity = editor.getRaceAxleLoadSensitivity(dynamicNormalLoads, dynamicReferenceNormalLoads, 'front', looseSurfaceFactor);
  const rearLoadSensitivity = editor.getRaceAxleLoadSensitivity(dynamicNormalLoads, dynamicReferenceNormalLoads, 'rear', looseSurfaceFactor);
  const axleLateralGripModifier = {
    front: Math.max(0.1, Number(setupModifiers.frontGrip) || 1),
    rear: Math.max(0.1, Number(setupModifiers.rearGrip) || 1) * (1 - handbrakeSlip * 0.92)
  };
  const wheelRemainingLateralLimit = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    editor.getRaceWheelRemainingLateralLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads: dynamicReferenceNormalLoads,
      gripByWheel: perWheelGrip,
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      normalLoadScale: bankNormalLoadScale,
      longitudinalUsage: wheelLongitudinalUsage[wheelId],
      axleGripModifier: wheelId === 'fl' || wheelId === 'fr' ? axleLateralGripModifier.front : axleLateralGripModifier.rear
    })
  ]));
  const frontPerWheelLatLimit = Number(wheelRemainingLateralLimit.fl || 0) + Number(wheelRemainingLateralLimit.fr || 0);
  const rearPerWheelLatLimit = Number(wheelRemainingLateralLimit.rl || 0) + Number(wheelRemainingLateralLimit.rr || 0);
  const baseFrontLatLimit = Math.min(frontNormal * frontGrip * frontFrictionCircle * frontLoadSensitivity, frontPerWheelLatLimit);
  const baseRearLatLimit = Math.min(rearNormal * rearGrip * rearFrictionCircle * rearLoadSensitivity, rearPerWheelLatLimit);
  const steeringEnvelopeCorneringG = clamp(
    (
      frontNormal * frontGrip * frontLoadSensitivity
      + rearNormal * rearGrip * rearLoadSensitivity
    ) / Math.max(1, tuning.weightKg * 9.81) * 0.82,
    0.28,
    1.08
  );
  const lateralContactScale = clamp((frontNormal + rearNormal) / Math.max(1, referenceFrontNormal + referenceRearNormal), 0, 1);
  const availableCorneringG = clamp(
    ((baseFrontLatLimit + baseRearLatLimit) / Math.max(1, tuning.weightKg * 9.81)) * 0.82,
    0.18,
    1.08
  );
  const usableFullLockTireAngle = launchAligning
    ? 0
    : editor.getRaceUsableFullLockTireAngle(absSpeed, {
      wheelbaseM,
      availableLateralG: steeringEnvelopeCorneringG
    });
  const steeringAngle = launchAligning
    ? 0
    : clamp(Number(effectiveRoadSteer) || 0, -1, 1) * usableFullLockTireAngle;
  const targetFrontSlipAngle = normalizeAngle(steeringAngle - vehicleSlipAngle);
  const targetRearSlipAngle = normalizeAngle(-vehicleSlipAngle);
  const relaxedSlipAngles = editor.getRaceRelaxedTireSlipAngles({
    targetFrontSlipAngle,
    targetRearSlipAngle,
    speedMps: absSpeed,
    looseSurfaceFactor,
    tireContactScale,
    seconds,
    reset: launchAligning
  });
  editor.playtestSession.tireSlipRelaxationAngles = {
    front: relaxedSlipAngles.front,
    rear: relaxedSlipAngles.rear
  };
  const frontSlipAngle = relaxedSlipAngles.front;
  const rearSlipAngle = relaxedSlipAngles.rear;
  const rawFrontLatForce = frontSlipAngle * tuning.weightKg * 42 * lateralForceSpeedScale * tireTravelDirection;
  const rawRearLatForce = rearSlipAngle * tuning.weightKg * 34 * lateralForceSpeedScale * tireTravelDirection;
  const frontLateralDemandUsage = Math.abs(rawFrontLatForce) / Math.max(1, baseFrontLatLimit);
  const rearLateralDemandUsage = Math.abs(rawRearLatForce) / Math.max(1, baseRearLatLimit);
  const frontPostPeakGrip = editor.getRaceTirePostPeakEfficiency(
    Math.hypot(frontLongitudinalUsage, frontLateralDemandUsage),
    looseSurfaceFactor
  );
  const rearPostPeakGrip = editor.getRaceTirePostPeakEfficiency(
    Math.hypot(rearLongitudinalUsage, rearLateralDemandUsage),
    looseSurfaceFactor
  );
  const frontLatLimit = baseFrontLatLimit * frontPostPeakGrip;
  const rearLatLimit = baseRearLatLimit * rearPostPeakGrip;
  const frontLatForce = clamp(rawFrontLatForce * frontPostPeakGrip, -frontLatLimit, frontLatLimit);
  const rearLatForce = clamp(rawRearLatForce * rearPostPeakGrip, -rearLatLimit, rearLatLimit);
  const wheelSlipAngles = {
    fl: frontSlipAngle,
    fr: frontSlipAngle,
    rl: rearSlipAngle,
    rr: rearSlipAngle
  };
  const wheelLateralUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const isFront = wheelId === 'fl' || wheelId === 'fr';
    const axleNormal = Math.max(1, isFront ? frontNormal : rearNormal);
    const axleForce = isFront ? frontLatForce : rearLatForce;
    const wheelLoadShare = (Number(dynamicNormalLoads[wheelId] || 0) * bankNormalLoadScale) / axleNormal;
    const wheelLatForce = Math.abs(axleForce) * clamp(wheelLoadShare * 2, 0.35, 1.65) * 0.5;
    const wheelLimit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads: dynamicReferenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      normalLoadScale: bankNormalLoadScale
    });
    if (wheelLimit <= 0.001) return [wheelId, 0];
    return [wheelId, clamp(wheelLatForce / wheelLimit, 0, 1.45)];
  }));
  const wheelFrictionUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Math.hypot(Number(wheelLongitudinalUsage[wheelId] || 0), Number(wheelLateralUsage[wheelId] || 0))
  ]));
  const combinedLongitudinalEfficiency = editor.getRaceCombinedLongitudinalEfficiency(
    wheelFrictionUsage,
    wheelLongitudinalUsage,
    looseSurfaceFactor,
    lateralContactScale
  );
  const longitudinalTireForce = driveForce + engineBraking.force + brakeDirection * brakeForce;
  const combinedLongitudinalForceLoss = longitudinalTireForce * (1 - combinedLongitudinalEfficiency);
  const combinedLongitudinalAppliedForce = longitudinalTireForce - combinedLongitudinalForceLoss;
  const combinedLongitudinalForceScale = Math.abs(longitudinalTireForce) > 0.001
    ? clamp(Math.abs(combinedLongitudinalAppliedForce / longitudinalTireForce), 0, 1)
    : 1;
  const combinedChassisLongitudinalForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Number(chassisLongitudinalForceByWheel[wheelId] || 0) * combinedLongitudinalForceScale
  ]));
  const combinedBrakeState = {
    ...brakeState,
    force: Number(brakeState.force || 0) * combinedLongitudinalForceScale,
    appliedByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(brakeState.appliedByWheel?.[wheelId] || 0) * combinedLongitudinalForceScale
    ]))
  };
  acceleration = (
    combinedLongitudinalAppliedForce
    + gradeForce
    + resistanceDirection * dragForce
  ) / tuning.weightKg;
  editor.playtestSession.speedMps += acceleration * seconds;
  if (!throttle && Math.abs(editor.playtestSession.speedMps) < 0.08 && Math.abs(roadGrade) < 0.01) editor.playtestSession.speedMps = 0;
  if (automaticReverseBrakeActive
    && !controlsLockedByRollover
    && drivenLoadScale > 0.001
    && driverThrottle <= RACE_PEDAL_INPUT.activeThreshold) {
    const reverseTargetMps = -clamp(1.1 + driverBrake * 1.9, 1.1, 3);
    if (editor.playtestSession.speedMps > reverseTargetMps) {
      editor.playtestSession.speedMps += (reverseTargetMps - editor.playtestSession.speedMps) * Math.min(1, seconds * 1.15);
    } else if (editor.playtestSession.speedMps < reverseTargetMps) {
      editor.playtestSession.speedMps += (reverseTargetMps - editor.playtestSession.speedMps) * Math.min(1, seconds * 2.8);
    }
    editor.playtestSession.speedMps = Math.max(editor.playtestSession.speedMps, reverseTargetMps);
  }
  const topSpeedMps = editor.getRaceRuntimeTopSpeedLimitMps(car, tuning, {
    setupModifiers,
    terrainResistance,
    tirePressureRollingMultiplier,
    gripFactor,
    looseSurfaceFactor,
    enginePowerScale: damageEffects.enginePower
  });
  if (throttle > RACE_PEDAL_INPUT.activeThreshold && driveForce > 0 && editor.playtestSession.speedMps > topSpeedMps) {
    editor.playtestSession.speedMps += (topSpeedMps - editor.playtestSession.speedMps) * Math.min(1, seconds * 1.8);
  } else if (editor.playtestSession.speedMps < -9) {
    editor.playtestSession.speedMps += (-9 - editor.playtestSession.speedMps) * Math.min(1, seconds * 3);
  }
  if (countdownActive) {
    acceleration = 0;
    editor.playtestSession.speedMps = editor.playtestSession.rollingStart
      ? Number(editor.playtestSession.rollingStartSpeedMps || 0)
      : 0;
  }
  const lateralAcceleration = launchAligning
    ? 0
    : (frontLatForce + rearLatForce) / tuning.weightKg;
  const rawLateralDemandG = launchAligning
    ? 0
    : (Math.abs(Math.tan(steeringAngle) * absSpeed * absSpeed / Math.max(1.8, wheelbaseM)) / 9.81) * frontAxleContactScale;
  const lateralDemandG = Math.max(0, rawLateralDemandG - bankSupportG);
  const lateralOverdrive = clamp(
    (rawLateralDemandG + bankOppositionG - (availableCorneringG + bankSupportG * 0.72)) / 0.55,
    0,
    1
  );
  const rearGripG = rearLatLimit / Math.max(1, tuning.weightKg * 9.81);
  const rearLoadShare = rearNormal / Math.max(1, frontNormal + rearNormal);
  const rearLightness = clamp((0.48 - rearLoadShare) / 0.16, 0, 1);
  const throttleDestabilize = clamp((throttle - 0.38) / 0.62, 0, 1) * (tuning.drivetrain === 'rwd' ? 0.52 : tuning.drivetrain === 'awd' ? 0.2 : 0.08) * tireContactScale;
  const brakeDestabilize = clamp((brake + Math.max(handbrake, handbrakeSlip * 0.96) * 4.4) / 1.18, 0, 1) * (tuning.drivetrain === 'rwd' ? 1.08 : 0.78) * tireContactScale;
  const rearLongitudinalOverload = clamp(((wheelLongitudinalUsage.rl + wheelLongitudinalUsage.rr) * 0.5 - 0.72) / 0.45, 0, 1);
  const leftLongitudinalDemand = (wheelLongitudinalUsage.fl + wheelLongitudinalUsage.rl) * 0.5;
  const rightLongitudinalDemand = (wheelLongitudinalUsage.fr + wheelLongitudinalUsage.rr) * 0.5;
  const splitGripYaw = clamp(
    ((rightTireGrip - leftTireGrip) * (Math.abs(driveForceRaw) > brakeForce ? throttle : brake + handbrake))
      + (rightLongitudinalDemand - leftLongitudinalDemand) * 0.24,
    -0.58,
    0.58
  );
  const mixedSurfaceYaw = splitGripYaw * clamp(absSpeed / 8, 0.18, 1) * tireContactScale;
  const powerOverloadYawSeed = Math.sin(Number(editor.playtestSession.elapsedMs || 0) * 0.017)
    + Math.sin(Number(editor.playtestSession.elapsedMs || 0) * 0.031 + 1.7) * 0.42;
  const drivetrainYawScale = tuning.drivetrain === 'rwd' ? 1
    : tuning.drivetrain === 'awd' ? 0.62
      : 0.36;
  const postPeakDriveInstability = clamp(
    (driveDemandRatio - 0.96) / 1.35,
    0,
    1
  ) * clamp(relaxedWheelSpinRatio - 0.72, 0, 1.1) * tireContactScale;
  const powerOverloadYaw = clamp(
    powerOverloadYawSeed * postPeakDriveInstability * drivetrainYawScale * (0.12 + looseSurfaceFactor * 0.72),
    -0.58,
    0.58
  );
  const rearFrictionOveruse = clamp(((wheelFrictionUsage.rl + wheelFrictionUsage.rr) * 0.5 - 0.86) / 0.42, 0, 1);
  const frontFrictionOveruse = clamp(((wheelFrictionUsage.fl + wheelFrictionUsage.fr) * 0.5 - 0.92) / 0.42, 0, 1);
  const bodyTravelSlipOveruse = clamp(
    (Math.abs(vehicleSlipAngle) - 0.22) / Math.max(0.22, 0.55 - looseSurfaceFactor * 0.14),
    0,
    1
  );
  const velocityAlignmentOveruse = Math.max(
    frontFrictionOveruse * 0.72,
    rearFrictionOveruse,
    postPeakDriveInstability * (0.58 + looseSurfaceFactor * 0.42),
    bodyTravelSlipOveruse * (0.62 + looseSurfaceFactor * 0.26)
  );
  const previousYawVelocity = Number.isFinite(editor.playtestSession.yawVelocityRadps)
    ? editor.playtestSession.yawVelocityRadps
    : 0;
  const highGripSurfaceStability = Math.pow(1 - looseSurfaceFactor, 1.4);
  const highGripPoweredFrontStability = highGripSurfaceStability
    * (tuning.drivetrain === 'awd' ? 0.84 : tuning.drivetrain === 'fwd' ? 0.86 : 0);
  const rearBreakaway = launchAligning
    ? 0
    : clamp(
      ((lateralDemandG - rearGripG * 0.68) / Math.max(0.08, rearGripG * 0.38))
        + rearLightness * 0.42
        + throttleDestabilize
        + brakeDestabilize
        + lateralOverdrive * 0.75
        + rearFrictionOveruse * 0.88,
      0,
      1
    ) * clamp((absSpeed - 5.5) / 19, 0, 1) * tireContactScale * (1 - highGripPoweredFrontStability);
  const previousRearBreakawayMemory = Number(editor.playtestSession.rearBreakawayMemory || 0);
  const rearBreakawayRecoveryPenalty = (
    handbrakeSlip * 0.42
    + clamp(Math.abs(previousYawVelocity) / 1.8, 0, 1) * 0.28
    + (tuning.drivetrain === 'awd' ? clamp(throttle, 0, 1) * 0.18 : 0)
  );
  const rearBreakawayDecay = seconds * (0.82 - rearBreakawayRecoveryPenalty);
  editor.playtestSession.rearBreakawayMemory = clamp(
    Math.max(rearBreakaway, previousRearBreakawayMemory - Math.max(0.08, rearBreakawayDecay)),
    0,
    1
  );
  const sustainedRearBreakaway = Math.max(
    rearBreakaway,
    editor.playtestSession.rearBreakawayMemory * clamp((absSpeed - 8) / 24, 0, 1) * tireContactScale,
    handbrakeSlip * clamp((absSpeed - 7) / 22, 0, 1) * tireContactScale
  );
  const tirePull = clamp(
    mixedSurfaceYaw + (Number(damageEffects.suspensionPull || 0) * 0.7),
    -0.34,
    0.34
  ) * clamp(absSpeed / 18, 0, 1);
  const leftLongitudinalForce = Number(combinedChassisLongitudinalForceByWheel.fl || 0)
    + Number(combinedChassisLongitudinalForceByWheel.rl || 0);
  const rightLongitudinalForce = Number(combinedChassisLongitudinalForceByWheel.fr || 0)
    + Number(combinedChassisLongitudinalForceByWheel.rr || 0);
  const longitudinalTorqueYawAcceleration = clamp(
    ((rightLongitudinalForce - leftLongitudinalForce) * Math.max(1.25, Number(tuning.trackWidthM) || 1.82) * 0.5)
      / Math.max(1, editor.getRaceYawInertiaKgM2(tuning)),
    -1.6,
    1.6
  ) * tireContactScale;
  const yawSpeedMps = editor.playtestSession.speedMps < -0.2 ? editor.playtestSession.speedMps * 0.72 : editor.playtestSession.speedMps;
  const bicycleYawRate = -yawSpeedMps * Math.tan(steeringAngle) / Math.max(2.1, wheelbaseM);
  const physicalYawAcceleration = editor.getRaceYawAccelerationFromAxleForces({
    tuning,
    frontLatForce,
    rearLatForce
  }) * steeringSpeedScale;
  const slipYawRate = -Math.sign(steeringAngle || roadSteer || 0)
    * Math.max(sustainedRearBreakaway, rearLongitudinalOverload * 0.72)
    * (0.58 + clamp(absSpeed / 58, 0, 1) * 0.86)
    * tireTravelDirection;
  const rearLockSpin = handbrakeSlip
    * clamp((absSpeed - 12) / 32, 0, 1)
    * tireContactScale
    * -Math.sign(steeringAngle || roadSteer || vehicleSlipAngle || 0)
    * tireTravelDirection;
  const rearBreakawaySpin = Math.max(sustainedRearBreakaway, rearLongitudinalOverload * 0.72)
    * clamp(absSpeed / 42, 0, 1)
    * (0.42 + handbrakeSlip * 0.58)
    * -Math.sign(steeringAngle || roadSteer || vehicleSlipAngle || 0)
    * tireTravelDirection;
  const counterSteerRecovery = Math.sign(previousYawVelocity || 0) !== 0
    && Math.sign((steeringAngle || 0) * tireTravelDirection) === Math.sign(previousYawVelocity || 0)
    ? clamp(Math.abs(steeringAngle) / 0.12, 0, 1) * clamp(absSpeed / 24, 0, 1)
    : 0;
  const yawStability = setupModifiers.yawStability
    * (1 - sustainedRearBreakaway * 0.72)
    * (1 - handbrakeSlip * 0.46);
  const yawAssistOveruse = Math.max(
    sustainedRearBreakaway,
    rearFrictionOveruse * 0.82,
    postPeakDriveInstability * (0.55 + looseSurfaceFactor * 0.45),
    bodyTravelSlipOveruse * (0.5 + looseSurfaceFactor * 0.28),
    handbrakeSlip * 0.7
  );
  const severeLoosePowerOveruse = clamp((postPeakDriveInstability - 0.32) / 0.48, 0, 1)
    * clamp(looseSurfaceFactor / 0.62, 0, 1)
    * clamp(relaxedWheelSpinRatio - 0.85, 0, 1);
  const yawAssistAuthority = (1 - clamp(yawAssistOveruse, 0, 1) * (0.58 + looseSurfaceFactor * 0.28))
    * (1 - severeLoosePowerOveruse * 0.58);
  const passiveYawDampingAuthority = (1 - clamp(yawAssistOveruse, 0, 1) * (0.45 + looseSurfaceFactor * 0.3))
    * (1 - severeLoosePowerOveruse * 0.52);
  const bodySlipYawCorrectionPenalty = bodyTravelSlipOveruse
    * (0.32 + looseSurfaceFactor * 0.28)
    * clamp(absSpeed / 18, 0, 1);
  const bicycleYawCorrectionAuthority = yawAssistAuthority
    * (1 - severeLoosePowerOveruse * 0.68)
    * (1 - bodySlipYawCorrectionPenalty);
  const settledControlsForSpinRecovery = !activeTurnInput
    && throttle <= RACE_PEDAL_INPUT.activeThreshold
    && brake <= RACE_PEDAL_INPUT.activeThreshold
    && !handbrake;
  const tireYawRateCorrection = (bicycleYawRate * steeringYawAuthorityScale - previousYawVelocity)
    * (2.2 + yawStability * 1.35)
    * bicycleYawCorrectionAuthority
    * tireContactScale;
  const tireYawDamping = ((0.8 + yawStability * 1.1) * passiveYawDampingAuthority + counterSteerRecovery * 3.6)
    * tireContactScale;
  const airborneYawDamping = 0;
  const yawAcceleration = launchAligning
    ? -previousYawVelocity * 12
    : (
      physicalYawAcceleration * (0.72 + yawStability * 0.24)
      + tireYawRateCorrection
      + slipYawRate * (2.4 + handbrakeSlip * 3.2)
      + rearBreakawaySpin * 3.2
      + rearLockSpin * 7.2
      + tirePull * 2.2
      + longitudinalTorqueYawAcceleration
      + powerOverloadYaw * (2.2 + looseSurfaceFactor * 5.2)
      - Math.sign(previousYawVelocity || 0) * counterSteerRecovery * tireContactScale * (1.8 + clamp(absSpeed / 42, 0, 1) * 2.2)
      - previousYawVelocity * (tireYawDamping + airborneYawDamping)
    );
  let yawRate = clamp(
    launchAligning ? 0 : previousYawVelocity + yawAcceleration * seconds,
    -3.8,
    3.8
  );
  let lowSpeedSpinRecovery = 0;
  let runawaySpinRecovery = 0;
  let yawSpinRecoveryRate = 0;
  const activeThrottleSpinOveruse = clamp((throttle - RACE_PEDAL_INPUT.activeThreshold) / Math.max(0.001, 1 - RACE_PEDAL_INPUT.activeThreshold), 0, 1)
    * Math.max(
      severeLoosePowerOveruse,
      postPeakDriveInstability * clamp(looseSurfaceFactor / 0.62, 0, 1),
      rearLongitudinalOverload * 0.65
    );
  const spinRecoveryAuthority = 1 - activeThrottleSpinOveruse * (0.68 + looseSurfaceFactor * 0.22);
  if (!launchAligning && tireContactScale > 0.001) {
    lowSpeedSpinRecovery = clamp((4.5 - absSpeed) / 4.5, 0, 1);
    runawaySpinRecovery = clamp((Math.abs(yawRate) - 1.15) / 2.2, 0, 1);
    const recoveryGrip = clamp(gripFactor, 0.18, 1.15) * (1 - handbrakeSlip * 0.72);
    const recoveryRate = (lowSpeedSpinRecovery * 5.5 + (settledControlsForSpinRecovery ? 2.8 : 0.8))
      * runawaySpinRecovery
      * recoveryGrip
      * spinRecoveryAuthority
      * seconds;
    yawSpinRecoveryRate = recoveryRate;
    yawRate *= Math.max(0.08, 1 - recoveryRate);
  }
  editor.playtestSession.yawVelocityRadps = yawRate;
  editor.playtestSession.carYaw = launchAligning
    ? roadYaw
    : previousCarYaw + yawRate * seconds;
  const velocityYawRateFromLateralForce = launchAligning
    ? 0
    : lateralAcceleration / Math.max(2.2, absSpeed)
      * tireTravelDirection
      * clamp(absSpeed / 3, 0, 1)
      * lateralContactScale;
  const velocityYawAfterForce = launchAligning
    ? roadYaw
    : normalizeAngle(previousVelocityYaw + velocityYawRateFromLateralForce * seconds);
  const slipAngle = normalizeAngle(editor.playtestSession.carYaw - velocityYawAfterForce);
  const slipAlignmentOveruse = clamp(
    (Math.abs(slipAngle) - 0.18) / Math.max(0.22, 0.48 - looseSurfaceFactor * 0.12),
    0,
    1
  );
  const settledControls = !activeTurnInput && throttle <= RACE_PEDAL_INPUT.activeThreshold && brake <= RACE_PEDAL_INPUT.activeThreshold && !handbrake;
  const gripAlignmentRate = launchAligning
    ? 8
    : (3.4 + clamp(gripFactor, 0.25, 1.25) * 3.8)
      * (1 - Math.pow(clamp(absSpeed / 78, 0, 1), 0.72) * 0.5)
      * (1 - Math.max(sustainedRearBreakaway, handbrakeSlip * 0.72) * 0.97)
      * (1 - clamp(velocityAlignmentOveruse, 0, 1) * (0.68 + looseSurfaceFactor * 0.28))
      * (1 - slipAlignmentOveruse * (0.36 + looseSurfaceFactor * 0.42))
      * setupModifiers.yawStability
      * (settledControls ? 2.15 : 1);
  const velocityAlignmentAlpha = launchAligning
    ? 1
    : Math.min(0.36, seconds * gripAlignmentRate * tireContactScale);
  const velocityYaw = launchAligning
    ? roadYaw
    : velocityYawAfterForce + slipAngle * velocityAlignmentAlpha;
  const slipAmountRaw = Math.abs(normalizeAngle(editor.playtestSession.carYaw - velocityYaw));
  const lowSpeedSlipGate = clamp((absSpeed - 1.8) / 7, 0, 1);
  const rearBreakawayScrubAuthority = clamp(
    (Math.abs(vehicleSlipAngle) + Math.abs(previousYawVelocity) * 0.35 + Math.abs(steeringAngle) * 3 + Math.abs(roadSteer) * 1.5) / 0.18,
    0,
    1
  );
  const slipAmount = Math.max(slipAmountRaw, sustainedRearBreakaway * 0.22 * rearBreakawayScrubAuthority) * lowSpeedSlipGate;
  const scrub = clamp((slipAmount - 0.055 - bankSupportG * 0.055) / 0.46, 0, 1)
    * clamp((absSpeed - 2.2) / 24, 0, 1)
    * (1 - bankSupportG * 0.32)
    * tireContactScale;
  if (scrub > 0) {
    const scrubLoss = 1 - Math.min(0.12, scrub * seconds * 0.78);
    editor.playtestSession.speedMps *= scrubLoss;
  }
  const wheelSpinSlip = Math.max(0, relaxedWheelSpinRatio - 0.78) * 1.1;
  const brakeLockSlip = Math.max(...Object.values(brakeState.lockByWheel));
  const lateralSlipFront = Math.max(
    clamp((Math.abs(frontLatForce) / Math.max(1, frontLatLimit) - 0.92) / 0.4, 0, 1),
    frontFrictionOveruse * 0.55
  ) * lowSpeedSlipGate;
  const lateralSlipRear = Math.max(
    clamp((Math.abs(rearLatForce) / Math.max(1, rearLatLimit) - 0.92) / 0.4, 0, 1),
    sustainedRearBreakaway,
    rearFrictionOveruse
  ) * lowSpeedSlipGate;
  const contactWheelSpinRatioByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    drivenWheelIds.includes(wheelId)
      ? relaxedWheelSpinRatio * Number(wheelContactScaleByWheel[wheelId] || 0)
      : 0
  ]));
  const freeWheelSpinRatioByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    drivenWheelIds.includes(wheelId)
      ? relaxedWheelSpinRatio * (1 - Number(wheelContactScaleByWheel[wheelId] || 0))
      : 0
  ]));
  const drivenSlipByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Math.max(0, Number(contactWheelSpinRatioByWheel[wheelId] || 0) - 0.78) * 1.1
  ]));
  const tireSlipByWheel = {
    fl: Math.max(lateralSlipFront, brakeState.lockByWheel.fl, drivenSlipByWheel.fl) * wheelContactScaleByWheel.fl,
    fr: Math.max(lateralSlipFront, brakeState.lockByWheel.fr, drivenSlipByWheel.fr) * wheelContactScaleByWheel.fr,
    rl: Math.max(lateralSlipRear, brakeState.lockByWheel.rl, drivenSlipByWheel.rl) * wheelContactScaleByWheel.rl,
    rr: Math.max(lateralSlipRear, brakeState.lockByWheel.rr, drivenSlipByWheel.rr) * wheelContactScaleByWheel.rr
  };
  const leftSlip = (tireSlipByWheel.fl + tireSlipByWheel.rl) * 0.5 + clamp(1 - leftTireGrip, 0, 1) * 0.12;
  const rightSlip = (tireSlipByWheel.fr + tireSlipByWheel.rr) * 0.5 + clamp(1 - rightTireGrip, 0, 1) * 0.12;
  const audibleSlip = editor.getRaceAudibleTireSlip({
    wheelSpin: Math.max(...Object.values(drivenSlipByWheel)),
    brakeLock: brakeLockSlip,
    slipAngle: slipAmount,
    scrub,
    leftSlip,
    rightSlip,
    speedMps: absSpeed
  });
  const selfAligningSteeringCorrection = editor.getRaceSelfAligningSteeringCorrection({
    frontSlipAngle,
    steeringAngle,
    speedMps: absSpeed,
    looseSurfaceFactor,
    tireContactScale: tireContactScale * frontAxleContactScale,
    seconds,
    activeTurnInput,
    launchAligning
  });
  if (selfAligningSteeringCorrection) {
    editor.raceInput.steeringWheel = clamp(Number(editor.raceInput.steeringWheel || 0) + selfAligningSteeringCorrection, -1, 1);
    if (!activeTurnInput) {
      editor.raceInput.steeringTarget = clamp(Number(editor.raceInput.steeringTarget || 0) + selfAligningSteeringCorrection * 0.72, -1, 1);
    }
  }
  editor.playtestSession.velocityYaw = velocityYaw;
  const automaticUpshiftRpm = editor.getRaceAutomaticUpshiftRpm(tuning);
  const automaticDownshiftRpm = editor.getRaceAutomaticDownshiftRpm(tuning);
  editor.playtestSession.tireSlip = {
    ...tireSlipByWheel,
    left: leftSlip,
    right: rightSlip,
    pull: tirePull,
    longitudinalTorqueYawAcceleration,
    frontSlipAngle,
    rearSlipAngle,
    targetFrontSlipAngle,
    targetRearSlipAngle,
    slipRelaxationRates: relaxedSlipAngles.rates,
    lateralAcceleration,
    roadGrade,
    gradeForce,
    tireContactScale,
    crestLaunchPredicted,
    contactRoadRiseMps,
    rollover: {
      confirmed: Boolean(editor.playtestSession.rolledOver),
      candidateMs: Number(editor.playtestSession.rolloverCandidateMs || 0),
      recoveryMs: Number(editor.playtestSession.rolloverRecoveryMs || 0),
      supportedWheelCount: Number(editor.playtestSession.rolloverSupportedWheelCount ?? RACE_WHEEL_IDS.length),
      supportedLoadRatio: Number(editor.playtestSession.rolloverSupportedLoadRatio ?? 1)
    },
    slipAngle: slipAmount,
    yawVelocity: yawRate,
    scrub,
    rearBreakaway,
    rawHandbrakeSlip,
    handbrakeSlip,
    lateralOverdrive,
    bankAngleRad,
    bankSupportG,
    signedBankSupportG,
    bankOppositionG,
    rearLongitudinalOverload,
    frontFrictionOveruse,
    rearFrictionOveruse,
    velocityAlignmentOveruse,
    bodyTravelSlipOveruse,
    slipAlignmentOveruse,
    yawAssistOveruse,
    yawAssistAuthority,
    passiveYawDampingAuthority,
    severeLoosePowerOveruse,
    bodySlipYawCorrectionPenalty,
    bicycleYawCorrectionAuthority,
    physicalYawAcceleration,
    bicycleYawRate,
    tireTravelDirection,
    velocityYawRateFromLateralForce,
    velocityAlignmentAlpha,
    tireYawRateCorrection,
    tireYawDamping,
    airborneYawDamping,
    effectiveFrictionMuByWheel,
    lowSpeedSpinRecovery,
    runawaySpinRecovery,
    yawSpinRecoveryRate,
    spinRecoveryAuthority,
    activeThrottleSpinOveruse,
    yawInertiaKgM2: editor.getRaceYawInertiaKgM2(tuning),
    frontPostPeakGrip,
    rearPostPeakGrip,
    powerOverloadYaw,
    postPeakDriveInstability,
    rearLockSpin,
    counterSteerRecovery,
    selfAligningSteeringCorrection,
    frontTireAngle: steeringAngle,
    steeringInputMode: editor.raceInput.analogSteeringActive ? 'analog' : binaryActive ? 'digital' : 'centered',
    requestedSteering: effectiveRoadSteer,
    rawSteeringAngle,
    usableFullLockTireAngle,
    steeringEnvelopeCorneringG,
    availableCorneringG,
    frontAxleLoadRatio,
    frontSteeringContactAuthority: frontAxleContactScale,
    tireSlipRelaxationRates: relaxedSlipAngles.rates,
    wheelSlipAngles,
    aeroDownforce: editor.getRaceAeroDownforceByAxle(tuning, absSpeed),
    effectiveAeroDownforce: editor.getRaceEffectiveAeroDownforceByAxle(tuning, absSpeed, looseSurfaceFactor),
    aeroLoadEffectiveness,
    wheelNormalLoads: dynamicNormalLoads,
    wheelContactScaleByWheel,
    vehicle3dTireLimitByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(effectiveWheelContacts3d?.[wheelId]?.tireLimitN || 0)
    ])),
    vehicle3dLoadSensitivityByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(effectiveWheelContacts3d?.[wheelId]?.loadSensitivityMultiplier || 1)
    ])),
    vehicle3dFrictionCircleScaleByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(effectiveWheelContacts3d?.[wheelId]?.frictionCircleScale || 1)
    ])),
    driveNormalLoads,
    driveLoadAcceleration,
    preliminaryDrivenTractionLimit,
    preliminaryAppliedDriveForce,
    driveLoadSensitivityByWheel,
    lateralLoadSensitivity: { front: frontLoadSensitivity, rear: rearLoadSensitivity },
    axleContactScale: { front: frontAxleContactScale, rear: rearAxleContactScale },
    steeringYawAuthorityScale,
    brakeNormalLoads,
    brakeLoadAcceleration,
    preliminaryBrakeForce: preliminaryBrakeState.force,
    tireLongitudinalLoadAcceleration,
    bumpNormalLoadScales,
    driveForceShareByWheel,
    engineBrakeForceShareByWheel,
    engineBrakeForceByWheel,
    chassisLongitudinalForceByWheel,
    combinedChassisLongitudinalForceByWheel,
    wheelLongitudinalUsage,
    wheelLateralUsage,
    wheelFrictionUsage,
    wheelRemainingLateralLimit,
    combinedLongitudinalForceScale,
    combinedLongitudinalEfficiency,
    lateralContactScale,
    combinedLongitudinalAppliedForce,
    combinedLongitudinalForceLoss,
    wheelSpin: wheelSpinSlip,
    wheelSpinRatio: relaxedWheelSpinRatio,
    targetWheelSpinRatio: wheelSpinRatio,
    contactWheelSpinRatioByWheel,
    freeWheelSpinRatioByWheel,
    brakeLock: brakeLockSlip,
    brakeLockByWheel: brakeState.lockByWheel,
    brakeRequestedByWheel: brakeState.requestedByWheel,
    brakeAppliedByWheel: brakeState.appliedByWheel,
    combinedBrakeAppliedByWheel: combinedBrakeState.appliedByWheel,
    combinedBrakeForce: combinedBrakeState.force,
    brakeLimitByWheel: brakeState.limitByWheel,
    absInterventionByWheel: brakeState.absInterventionByWheel,
    brakeSlidingEfficiencyByWheel: brakeState.slidingEfficiencyByWheel,
    tireTemperatureGrip,
    gripFactor,
    perWheelGrip,
    tireTemperature: { ...(editor.playtestSession.diagnostics?.tireTemperature || {}) },
    tirePressureDynamics: tirePressureDynamicsByWheel,
    resistanceForces,
    tireHealth: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      1 - clamp(Number(damage.tires?.[wheelId] || 0) / 100, 0, 1)
    ])),
    engineDrive: {
      gearRatio,
      torqueRpm,
      engineTorqueNm,
      availablePowerW,
      topSpeedLimitMps: topSpeedMps,
      torqueForceN: driveForceComponents.torqueForceN,
      powerForceN: driveForceComponents.powerForceN,
      baseForceN: driveForceComponents.baseForceN,
      powerLimitBlend: driveForceComponents.powerLimitBlend,
      demandedForceN: driveForceDemandRaw,
      appliedRawForceN: driveForceRaw,
      appliedForceN: driveForce,
      limitingSource: driveForceComponents.limitingSource,
      controlLockReason,
      limiterCut,
      shiftTorqueCut,
      torqueCutReason: limiterCut < 1
        ? 'rev-limiter'
        : shiftTorqueCut < 1
          ? 'shift'
          : finalTractionControlCut < 0.999
            ? 'traction-control'
            : 'none',
      shiftClutchDisengagement,
      drivetrainUnload,
      liftOffWheelspinInertia,
      automaticUpshiftRpm,
      automaticDownshiftRpm,
      automaticOverrevUpshifts,
      rpmResponse: effectiveRpmResponse,
      drivenLoadScale,
      wheelspinDrivetrainUnload,
      previousLongitudinalWheelSlipRatio,
      tractionControlCut: finalTractionControlCut,
      tractionControlCutTarget,
      preliminaryTractionControlCutTarget,
      preliminaryTractionControlSlip,
      tractionControlSlip,
      measuredDrivenWheelSlipRatio,
      tractionControlSlipTarget: longitudinalSlipTarget,
      coupledEngineRpmTarget: roadCoupledRpmTarget,
      drivenTraction,
      postPeakTractionEfficiency,
      combinedSlipEfficiency: combinedLongitudinalEfficiency,
      combinedSlipAppliedForceN: combinedLongitudinalAppliedForce,
      combinedSlipForceLossN: combinedLongitudinalForceLoss,
      driveDemandRatio,
      appliedDriveDemandRatio,
      wheelLongitudinalUsage,
      wheelLateralUsage,
      wheelFrictionUsage,
      wheelRemainingLateralLimit,
      driveLoadAcceleration,
      tireLongitudinalLoadAcceleration,
      preliminaryDrivenTractionLimit,
      preliminaryAppliedDriveForce,
      engineBrakeForceByWheel,
      chassisLongitudinalForceByWheel,
      engineBraking
    },
    wheelSurfaces: wheelSurfaceState.surfaceByWheel,
    wheelBaseSurfaces: wheelSurfaceState.baseSurfaceByWheel,
    wheelTerrains: wheelSurfaceState.terrainByWheel,
    snowDepthByWheel: wheelSurfaceState.snowDepthByWheel,
    snowDepthInches,
    snowResistanceMultiplier: editor.getRaceSnowResistanceMultiplier(snowDepthInches),
    audibleSlip
  };
  editor.playtestSession.steeringWheelRotation = editor.getRaceSteeringWheelRotationForTireAngle(steeringAngle, car);
  const wheelContactState = editor.getRaceWheelContactState({
    car,
    tuning,
    session: surfaceSession,
    wheelSurfaceState
  });
  editor.updateRaceVerticalAndRollState({
    seconds,
    tuning,
    roadPose,
    previousRoadPose,
    lateralAcceleration,
    wheelContactState,
    wheelNormalLoads: dynamicNormalLoads,
    referenceNormalLoads: dynamicReferenceNormalLoads,
    wheelContacts3d: effectiveWheelContacts3d
  });
  const lateralDrift = (
    normalizeAngle(editor.playtestSession.velocityYaw - roadYaw) * clamp(absSpeed / 32, 0, 1) * 0.04
    + Math.sign(steeringAngle || roadSteer || 0) * tireTravelDirection * rearBreakaway * 0.035
  );
  editor.playtestSession.driftLateral = clamp(
    Number(editor.playtestSession.driftLateral || 0) * Math.max(0, 1 - seconds * 1.7) + lateralDrift,
    -0.24,
    0.24
  );
  editor.playtestSession.worldX = Number(editor.playtestSession.worldX || 0)
    + Math.sin(editor.playtestSession.velocityYaw) * editor.playtestSession.speedMps * seconds;
  editor.playtestSession.worldZ = Number(editor.playtestSession.worldZ || 0)
    + Math.cos(editor.playtestSession.velocityYaw) * editor.playtestSession.speedMps * seconds;
  editor.updateRaceVehicle3DContactState({
    seconds,
    car,
    tuning,
    acceleration,
    lateralAcceleration,
    brakeState: combinedBrakeState,
    driveForce,
    drivenWheelIds,
    driveCommandForceByWheel,
    driveForceByWheel: combinedChassisLongitudinalForceByWheel,
    wheelLongitudinalUsage,
    wheelLateralUsage,
    frontLatForce,
    rearLatForce
  });
  const routeLength = Math.max(1, Number(editor.playtestSession.routeLength || editor.getRaceRouteLength()));
  let projection = editor.getRaceRouteProjectionForWorldPoint({
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ
  });
  const boundarySegment = projection.segment || segmentInfo.segment || editor.selectedSegment;
  const projectedRoadHalfWidth = Math.max(1, editor.getRaceRoadHalfWidthWorld(boundarySegment));
  const projectedLateralMeters = Number(projection.lateral || 0);
  const projectedLateralNormalized = clamp(projectedLateralMeters / projectedRoadHalfWidth, -1.5, 1.5);
  editor.playtestSession.routeLateralM = projectedLateralMeters;
  editor.playtestSession.routeLateralNormalized = projectedLateralNormalized;
  editor.playtestSession.lateral = projectedLateralNormalized;
  const edgeCollisionMode = editor.getRaceEdgeCollisionMode(boundarySegment);
  if (edgeCollisionMode !== 'none') {
    const roadHalfWidth = editor.getRaceRoadHalfWidthWorld(boundarySegment);
    const marginWidth = editor.getRaceCollisionMarginWidthWorld(boundarySegment, edgeCollisionMode);
    const shoulderWidth = editor.getRaceCollisionShoulderWidthWorld(boundarySegment, edgeCollisionMode);
    const contactLimit = Math.max(0.2, roadHalfWidth + marginWidth + shoulderWidth);
    let boundaryHit = null;
    const contactPoints = editor.getRaceVehicleCollisionContactPoints({
      session: editor.playtestSession,
      car,
      tuning
    });
    contactPoints.forEach((point) => {
      const pointProjection = editor.getRaceRouteProjectionForWorldPoint(point);
      const lateral = Number(pointProjection.lateral || 0);
      const excess = Math.abs(lateral) - contactLimit;
      if (excess <= 0) return;
      if (!boundaryHit || excess > boundaryHit.excess) {
        boundaryHit = {
          point,
          projection: pointProjection,
          lateral,
          excess
        };
      }
    });
    if (boundaryHit) {
      const side = Math.sign(boundaryHit.lateral || 1);
      const hitProjection = boundaryHit.projection || projection;
      const right = editor.getRaceRightVector(Number(hitProjection.yaw || roadYaw || 0));
      const forward = editor.getRaceForwardVector(Number(hitProjection.yaw || roadYaw || 0));
      const collisionEffect = editor.getRaceEdgeCollisionEffect();
      if (collisionEffect === 'reset') {
        editor.resetRaceCarToRouteCenter({ projection: hitProjection, roadYaw });
      } else {
        editor.playtestSession.worldX -= right.x * side * boundaryHit.excess;
        editor.playtestSession.worldZ -= right.z * side * boundaryHit.excess;
        const speedMps = Number(editor.playtestSession.speedMps || 0);
        const velocityYaw = Number(editor.playtestSession.velocityYaw || editor.playtestSession.carYaw || 0);
        const vx = Math.sin(velocityYaw) * speedMps;
        const vz = Math.cos(velocityYaw) * speedMps;
        const normalX = right.x * side;
        const normalZ = right.z * side;
        const normalVelocity = vx * normalX + vz * normalZ;
        const tangentVelocity = vx * forward.x + vz * forward.z;
        const restitution = clamp(0.18 + Math.abs(normalVelocity) / 72, 0.18, 0.48);
        const tangentFriction = clamp(0.82 - Math.abs(normalVelocity) / 140, 0.55, 0.84);
        if (normalVelocity > 0.05) {
          const nextNormalVelocity = -normalVelocity * restitution;
          const nextTangentVelocity = tangentVelocity * tangentFriction;
          const nextVx = forward.x * nextTangentVelocity + normalX * nextNormalVelocity;
          const nextVz = forward.z * nextTangentVelocity + normalZ * nextNormalVelocity;
          editor.playtestSession.speedMps = Math.hypot(nextVx, nextVz) * (nextTangentVelocity < 0 ? -1 : 1);
          editor.playtestSession.velocityYaw = Math.atan2(nextVx, nextVz);
          const impactYaw = normalizeAngle(editor.playtestSession.carYaw - Math.atan2(normalX, normalZ));
          editor.playtestSession.yawVelocityRadps = clamp(
            Number(editor.playtestSession.yawVelocityRadps || 0) * 0.42 - Math.sin(impactYaw) * Math.abs(normalVelocity) * 0.035,
            -2.4,
            2.4
          );
          editor.playtestSession.carYaw = normalizeAngle(Number(editor.playtestSession.carYaw || 0) + editor.playtestSession.yawVelocityRadps * seconds * 0.35);
        } else {
          editor.playtestSession.speedMps *= 0.94;
          editor.playtestSession.yawVelocityRadps = clamp(Number(editor.playtestSession.yawVelocityRadps || 0) * 0.72, -1.4, 1.4);
        }
        editor.applyRaceDamage('panels', Math.min(14, Math.max(0.2, Math.abs(normalVelocity) * 0.42)), {
          keys: [side < 0 ? 'left' : 'right'],
          source: `edge:${edgeCollisionMode}`
        });
      }
    }
  }
  projection = editor.getRaceRouteProjectionForWorldPoint({
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ
  });
  editor.syncRaceSessionPlanarBodyToWorld(editor.playtestSession);
  editor.playtestSession.routeLateralM = Number(projection.lateral || 0);
  editor.playtestSession.routeLateralNormalized = clamp(
    Number(projection.lateral || 0) / Math.max(1, editor.getRaceRoadHalfWidthWorld(projection.segment || boundarySegment)),
    -1.5,
    1.5
  );
  editor.playtestSession.lateral = editor.playtestSession.routeLateralNormalized;
  const previousDistance = Number(editor.playtestSession.previousDistance || editor.playtestSession.distance || 0);
  const progressRoadYaw = editor.getRaceWorldPoseAtDistance(previousDistance).yaw;
  const progressHeading = normalizeAngle(editor.playtestSession.velocityYaw - progressRoadYaw);
  const routeAdvance = editor.playtestSession.speedMps * Math.cos(progressHeading) * seconds;
  const integratedDistance = previousDistance + routeAdvance;
  if (routeRuntimeType === 'circuit') {
    const nextDistance = ((integratedDistance % routeLength) + routeLength) % routeLength;
    if (!countdownActive) {
      editor.updateRaceCheckpointProgress({
        previousDistance,
        nextDistance,
        routeAdvance
      });
    }
    const crossedStart = routeAdvance > 0 && previousDistance > routeLength * 0.72 && nextDistance < routeLength * 0.28;
    const checkpointsComplete = Number(editor.playtestSession.checkpointIndex || 0) >= Number(editor.playtestSession.checkpointCount || 0);
    if (!countdownActive && crossedStart && checkpointsComplete) {
      editor.playtestSession.lap += 1;
      const nextCheckpoint = (editor.playtestSession.checkpointDistances || []).findIndex((distance) => (
        distance > Math.max(8, editor.getRaceCarWorldWidth(editor.getRaceSessionCar(editor.playtestSession)) * 2)
      ));
      editor.playtestSession.checkpointIndex = nextCheckpoint >= 0 ? nextCheckpoint : 0;
      editor.playtestSession.passedCheckpoints = [];
      if (editor.playtestSession.lap > Math.max(1, Number(editor.selectedRace.laps || 1))) {
        editor.playtestSession.lap = Math.max(1, Number(editor.selectedRace.laps || 1));
        editor.finishPlaytest();
        return;
      }
    }
    editor.playtestSession.distance = nextDistance;
  } else {
    editor.playtestSession.distance = clamp(integratedDistance, 0, routeLength);
    if (!countdownActive) {
      editor.updateRaceCheckpointProgress({
        previousDistance,
        nextDistance: editor.playtestSession.distance,
        routeAdvance
      });
    }
    const finish = editor.getRaceWorldPoseAtDistance(routeLength);
    const finishDx = Number(editor.playtestSession.worldX || 0) - Number(finish.x || 0);
    const finishDz = Number(editor.playtestSession.worldZ || 0) - Number(finish.z || 0);
    const runtimeCarWidth = editor.getRaceCarWorldWidth(editor.getRaceSessionCar(editor.playtestSession));
    const finishRange = Math.max(editor.getRaceRoadHalfWidthWorld() * 1.55, runtimeCarWidth * 5);
    const integratedFinish = integratedDistance >= routeLength;
    const checkpointsComplete = Number(editor.playtestSession.checkpointIndex || 0) >= Number(editor.playtestSession.checkpointCount || 0);
    if (!countdownActive && ((editor.playtestSession.distance >= routeLength - Math.max(4, runtimeCarWidth * 2)
      && Math.hypot(finishDx, finishDz) <= finishRange
      && checkpointsComplete)
      || (integratedFinish && checkpointsComplete))) {
      editor.playtestSession.distance = routeLength;
      editor.finishPlaytest();
      return;
    }
  }
  const routeProjectedDistance = routeRuntimeType === 'circuit'
    ? ((Number(projection.distance || 0) % routeLength) + routeLength) % routeLength
    : clamp(Number(projection.distance || editor.playtestSession.distance || 0), 0, routeLength);
  const previousProjectedDistance = Number(editor.playtestSession.projectedDistance);
  if (previousProjectedDistance < 0) {
    const startBackDistance = Math.max(0, Number(editor.playtestSession.startBackDistance || 0));
    const preStartProjectedDistance = clamp(previousProjectedDistance + routeAdvance, -startBackDistance, 0);
    editor.playtestSession.projectedDistance = preStartProjectedDistance;
  } else {
    editor.playtestSession.projectedDistance = routeProjectedDistance;
  }
  editor.playtestSession.heading = normalizeAngle(editor.playtestSession.carYaw - roadYaw);
  editor.playtestSession.cameraYaw = editor.getRacePlaytestCameraYaw(editor.playtestSession, { seconds, smooth: true });
  editor.playtestSession.cameraChaseYaw = Number(editor.playtestSession.cameraYaw || roadYaw);
  const trackViewTarget = clamp(
    (-editor.playtestSession.lateral * 0.24) + (editor.playtestSession.heading * 0.66),
    -0.58,
    0.58
  );
  editor.playtestSession.roadViewOffset += (trackViewTarget - Number(editor.playtestSession.roadViewOffset || 0)) * Math.min(1, seconds * 3.2);
  editor.playtestSession.rpm = clamp(editor.playtestSession.engineRpm / tuning.revLimitRpm, 0, 1.08);
  editor.updateRaceEngineAudio({ tuning, throttle: engineThrottle, load: relaxedWheelSpinRatio });
  editor.updateRaceTireAudio({
    slip: audibleSlip,
    surface: segmentInfo.segment?.surface,
    speedMps: absSpeed
  });
  if (!countdownActive
    && editor.raceInput.autoShift
    && gear > 0
    && editor.playtestSession.shiftCooldownMs <= 0) {
    const lowerGearUsefulSpeed = gear > 1 ? editor.getRaceRedlineSpeedMps(tuning, gear - 1) * 0.72 : 0;
    const currentGearRedlineSpeed = editor.getRaceRedlineSpeedMps(tuning, gear);
    const forwardSpeedMps = Number(editor.playtestSession.speedMps || 0);
    const stableDriveContact = drivenLoadScale >= 0.25 && drivetrainUnload < 0.55;
    const wantsUpshift = editor.playtestSession.engineRpm > automaticUpshiftRpm * 0.96
      || absSpeed > currentGearRedlineSpeed * 0.9;
    if (throttle > RACE_PEDAL_INPUT.activeThreshold
      && forwardSpeedMps > 1
      && stableDriveContact
      && wantsUpshift
      && editor.raceInput.gear < tuning.gearRatios.length) {
      editor.shiftRaceGear(1);
    } else if (editor.raceInput.gear > 1
      && (
        forwardSpeedMps <= 0
        || editor.playtestSession.engineRpm < automaticDownshiftRpm
        || brake > RACE_PEDAL_INPUT.activeThreshold
        || absSpeed < lowerGearUsefulSpeed
      )
      && editor.canRaceAutomaticDownshift(tuning, absSpeed, editor.raceInput.gear - 1)) {
      editor.shiftRaceGear(-1);
    }
  }
  editor.playtestSession.steeringWheel = editor.raceInput.steeringWheel;
  editor.playtestSession.steeringTarget = editor.raceInput.steeringTarget;
  editor.playtestSession.gear = editor.raceInput.gear;
  editor.playtestSession.cameraView = editor.raceInput.cameraView;
  editor.updateRaceWeatherApproachDistance(seconds, {
    previousSpeedMps: absSpeedBefore,
    currentSpeedMps: editor.playtestSession.speedMps
  });
  editor.updateRaceWeatherFxState(seconds, {
    weatherState
  });
  editor.playtestSession.handbrakeMs = Math.max(0, Number(editor.playtestSession.handbrakeMs || 0) - seconds * 1000);
  if (handbrake) editor.playtestSession.handbrakeMs = 180;
  if (!countdownActive) {
    editor.updateRaceDiagnostics(seconds, {
      tuning,
      car,
      throttle,
      brake,
      handbrake,
      acceleration,
      lateralAcceleration,
      dynamicNormalLoads,
      initialNormalLoads,
      wheelContactScaleByWheel,
      tireSlipByWheel,
      tirePressureDynamicsByWheel,
      wheelSurfaceState,
      previousDistance,
      routeLength,
      routeRuntimeType
    });
  }
  const tireFxContext = {
    tireSlipByWheel,
    wheelSurfaceState,
    brakeState,
    handbrake,
    wheelSpin: relaxedWheelSpinRatio,
    wheelSpinByWheel: contactWheelSpinRatioByWheel,
    wheelContactScaleByWheel,
    speedMps: absSpeed
  };
  if (!countdownActive) {
    editor.updateRaceTireTracks(tireFxContext);
    editor.stepRaceTireFxParticles(seconds, tireFxContext);
  }
  if (!countdownActive && trackState) {
    const previousPositions = editor.playtestSession.trackStatePreviousWheelPositions || {};
    systems.surface.queueTrackStateTireEvents(trackState, {
      vehicleId: editor.playtestSession.carId || 'player',
      normalLoads: dynamicNormalLoads,
      tireSlipByWheel,
      wheelContactScaleByWheel,
      wheelSurfaceState,
      previousPositions,
      speedMps: absSpeed,
      tireCompoundByWheel: setup.tireCompoundByWheel,
      tireTemperatures: editor.playtestSession.diagnostics?.tireTemperature || tireTemperatures,
      brakeState,
      wheelSpinByWheel: contactWheelSpinRatioByWheel,
      direction: editor.getRaceForwardVector(
        Number(editor.playtestSession.velocityYaw ?? editor.playtestSession.carYaw ?? roadYaw)
      )
    });
    editor.playtestSession.trackStatePreviousWheelPositions = Object.fromEntries(
      Object.entries(wheelSurfaceState.positions || {}).map(([wheelId, position]) => [
        wheelId,
        { x: Number(position.x || 0), z: Number(position.z || 0) }
      ])
    );
    editor.playtestSession.trackStateLastQueuedStep = trackState.stepIndex;
  }
  editor.updateRaceAiDrivers(seconds, {
    preStartMode: countdownActive
      ? editor.playtestSession.rollingStart ? 'rolling' : 'standing'
      : 'none',
    rollingStartSpeedMps: editor.playtestSession.rollingStartSpeedMps
  });
  if (!countdownActive) {
    editor.recordRaceGhostSample();
    editor.updateRaceWearAndDamage(seconds);
    if (trackState) systems.surface.queueTrackStateCrashEvents(trackState, editor.playtestSession);
  }
}

export function estimateRacePowerLimitedTopSpeedMps(editor, {
  tuning = editor.getRaceCarTuning(),
  setupModifiers = editor.getRaceSetupPhysicsModifiers(tuning, 0),
  terrainResistance = 1,
  tirePressureRollingMultiplier = 1,
  gripFactor = 1,
  looseSurfaceFactor = 0,
  respectConfiguredLimit = false
} = {}) {
  const ratios = Array.isArray(tuning.gearRatios) && tuning.gearRatios.length ? tuning.gearRatios : [1];
  const redline = Math.max(Number(tuning.revLimitRpm || tuning.redlineRpm) || 6500, Number(tuning.idleRpm || 800) + 500);
  const topGearSpeedMps = Math.max(...ratios.map((_ratio, index) => editor.getRaceRedlineSpeedMps(tuning, index + 1)), 20);
  const configuredLimitMps = Math.max(20, Number(tuning.topSpeedMps) || topGearSpeedMps);
  const gearLimitedMps = Math.max(topGearSpeedMps, 20);
  const hardLimitMps = respectConfiguredLimit ? Math.min(gearLimitedMps, configuredLimitMps) : gearLimitedMps;
  const scanLimit = hardLimitMps;
  const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
  const drivenWheelIds = editor.getRaceDrivenWheelIds(tuning);
  const aeroLoadEffectiveness = editor.getRaceAeroLoadEffectiveness(loose);
  const mass = Math.max(450, Number(tuning.weightKg) || 1400);
  let best = 0;
  for (let speed = 0; speed <= scanLimit + 0.0001; speed += 0.5) {
    let bestDriveForce = 0;
    ratios.forEach((ratio, index) => {
      const gear = index + 1;
      const rpm = editor.getRaceProjectedEngineRpmForGear(tuning, speed, gear);
      if (rpm > redline * 1.015 || rpm < Math.max(400, Number(tuning.idleRpm || 800) * 0.55)) return;
      const engineTorqueNm = editor.getRaceTorqueNmAtRpm(clamp(rpm, Number(tuning.idleRpm || 800), redline), tuning);
      const driveForce = editor.getRaceDriveForceComponents({
        tuning,
        gearRatio: Math.max(0.1, Number(ratio) || 1),
        engineTorqueNm,
        availablePowerW: Math.max(0, Number(tuning.powerHp) || 0) * 745.7,
        speedMps: speed
      }).baseForceN * clamp(Number(tuning.accelerationCalibration) || 1, 0.7, 1.35);
      bestDriveForce = Math.max(bestDriveForce, driveForce);
    });
    if (bestDriveForce > 0 && (loose > 0.001 || Number(gripFactor) < 0.995)) {
      const referenceNormalLoads = editor.getRaceWheelNormalLoads(tuning, 0, 0, speed, { aeroLoadEffectiveness });
      const driveLoadAcceleration = clamp(bestDriveForce / mass, -9.5, 9.5);
      const normalLoads = editor.getRaceWheelNormalLoads(tuning, driveLoadAcceleration, 0, speed, { aeroLoadEffectiveness });
      const drivenTractionLimit = editor.getRaceDrivenTractionLimit({
        tuning,
        drivenWheelIds,
        normalLoads,
        referenceNormalLoads,
        gripByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, 1])),
        gripFactor,
        looseSurfaceFactor: loose,
        setupModifiers
      }).tractionLimitN;
      const driveDemandRatio = bestDriveForce / Math.max(1, drivenTractionLimit);
      const excessDriveSlip = clamp((driveDemandRatio - 1) / 1.2, 0, 1);
      const postPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(excessDriveSlip, loose, false);
      bestDriveForce = Math.min(bestDriveForce, drivenTractionLimit * postPeakTractionEfficiency);
    }
    const resistance = editor.getRaceLongitudinalResistanceForces({
      tuning,
      speedMps: speed,
      setupModifiers: editor.getRaceSetupPhysicsModifiers(tuning, speed),
      terrainResistance,
      tirePressureRollingMultiplier,
      looseSurfaceFactor: loose,
      tireContactScale: 1
    }).totalN;
    if (bestDriveForce >= resistance) best = speed;
  }
  return clamp(best || hardLimitMps, 20, hardLimitMps);
}
