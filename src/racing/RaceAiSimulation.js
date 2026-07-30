import { RACE_PEDAL_INPUT, RACE_THREE_ELEVATION_M } from './simulation/RaceSimulationConfig.js';
import { RACE_WHEEL_IDS, clamp } from './simulation/SimulationMath.js';

export function getRaceAiDifficultyProfile(editor, difficulty = 'easy') {
  return {
    easy: { pace: 0.64, corner: 0.56, brake: 0.58, shift: 0.72, variance: 0.18 },
    medium: { pace: 0.78, corner: 0.72, brake: 0.74, shift: 0.84, variance: 0.11 },
    hard: { pace: 0.9, corner: 0.86, brake: 0.88, shift: 0.94, variance: 0.055 },
    expert: { pace: 1.02, corner: 1, brake: 1, shift: 1, variance: 0.018 }
  }[difficulty] || { pace: 0.72, corner: 0.68, brake: 0.7, shift: 0.8, variance: 0.12 };
}

export function getRaceAiLookaheadSeverity(editor, distance = 0, speedMps = 0) {
  const lookahead = Math.max(40, Math.abs(Number(speedMps || 0)) * 2.2);
  const samples = [0.25, 0.55, 0.9].map((weight) => editor.getRaceSegmentAtDistance(distance + lookahead * weight, { wrap: true }).segment || {});
  return samples.reduce((max, segment) => Math.max(
    max,
    Math.abs(Number(segment.curve || 0)) * 0.86
      + Math.abs(Number(segment.elevation || 0)) * 0.22
      + Number(segment.bumpiness || 0) * 0.28
  ), 0);
}

export function getRaceAiContactState(editor, ai = {}, car = editor.selectedCar, tuning = editor.getRaceCarTuning(car)) {
  const distance = Number(ai.projectedDistance ?? ai.distance ?? 0) || 0;
  const runtimeType = editor.playtestSession?.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const pose = editor.getRaceWorldPoseAtDistance(distance, { runtimeType });
  const section = editor.getRaceSurfaceSectionAtDistance(distance, {
    routeLength: editor.playtestSession?.routeLength || editor.getRaceRouteLength(),
    runtimeType
  });
  const roadHalfWidth = Math.max(1, Number(section.metrics?.roadEnd || editor.getRaceRoadHalfWidthWorld(pose.segment)));
  const lateral = clamp(Number(ai.lineOffset || 0), -0.85, 0.85) * roadHalfWidth;
  const right = editor.getRaceRightVector(pose.yaw);
  const aiSession = {
    worldX: Number(pose.x || 0) + right.x * lateral,
    worldZ: Number(pose.z ?? pose.y ?? 0) + right.z * lateral,
    carYaw: Number(pose.yaw || 0),
    speedMps: Number(ai.speedMps || 0),
    routeRuntimeType: runtimeType,
    trackState: editor.playtestSession?.trackState || null
  };
  const contacts = editor.getRaceWheelContactState({ car, tuning, session: aiSession });
  const surfaceGrip = RACE_WHEEL_IDS.reduce((sum, wheelId) => {
    const contact = contacts.contacts?.[wheelId] || {};
    return sum + clamp(Number(contact.friction || 1), 0.18, 1.2);
  }, 0) / RACE_WHEEL_IDS.length;
  return {
    pose,
    lateral,
    session: aiSession,
    contacts,
    averageSurfaceGrip: clamp(surfaceGrip, 0.18, 1.2)
  };
}

export function updateRaceAiVehiclePhysics(editor, ai = {}, {
  car = editor.selectedCar,
  tuning = editor.getRaceCarTuning(car),
  seconds = 0,
  previousSpeedMps = Number(ai.speedMps || 0)
} = {}) {
  if (!ai) return null;
  const contactState = editor.getRaceAiContactState(ai, car, tuning);
  const aiSession = {
    ...contactState.session,
    vehicle3d: ai.vehicle3d,
    bodyY: ai.bodyY,
    pitchRad: ai.pitchRad,
    rollRad: ai.rollRad,
    verticalVelocityMps: ai.verticalVelocityMps || 0,
    speedMps: Number(ai.speedMps || 0),
    velocityYaw: contactState.session.carYaw,
    yawVelocityRadps: 0,
    routeRuntimeType: editor.playtestSession?.routeRuntimeType || editor.getSelectedRaceRuntimeType()
  };
  if (!aiSession.vehicle3d?.enabled) {
    aiSession.vehicle3d = editor.raceSimulationSystems.chassis.createState({
      session: aiSession,
      tuning,
      carDimensions: editor.getRaceCarDimensions(car),
      surfaceModel: editor.getRaceSurfaceModel(),
      elevationScaleM: RACE_THREE_ELEVATION_M
    });
  }
  const yaw = Number(aiSession.carYaw || 0);
  const speed = Number(ai.speedMps || 0);
  const previousSpeed = Number(previousSpeedMps || 0);
  const dt = Math.max(0.0001, Number(seconds) || 0.0001);
  const engineDrive = ai.engineDrive || {};
  const lateralAcceleration = speed * speed * Number(contactState.pose?.segment?.curve || 0) * 0.0025;
  const lateralForceTotal = lateralAcceleration * Math.max(450, Number(tuning.weightKg) || 1400);
  const lateralForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const isFront = wheelId === 'fl' || wheelId === 'fr';
    const axleShare = isFront ? 0.56 : 0.44;
    const usage = Number(engineDrive.wheelLateralUsage?.[wheelId] || 0);
    return [wheelId, usage > 0 ? lateralForceTotal * axleShare * 0.5 : 0];
  }));
  editor.raceSimulationSystems.chassis.step(aiSession.vehicle3d, {
    dt,
    tuning,
    carDimensions: editor.getRaceCarDimensions(car),
    surfaceModel: editor.getRaceSurfaceModel(),
    elevationScaleM: RACE_THREE_ELEVATION_M,
    planarVelocity: {
      x: Math.sin(yaw) * speed,
      y: Number(ai.verticalVelocityMps || 0),
      z: Math.cos(yaw) * speed
    },
    yaw,
    controls: {
      yawRate: 0,
      longitudinalAcceleration: (speed - previousSpeed) / dt,
      lateralAcceleration,
      driveForceByWheel: engineDrive.combinedChassisLongitudinalForceByWheel || engineDrive.chassisLongitudinalForceByWheel || engineDrive.driveForceByWheel || {},
      brakeForceByWheel: engineDrive.combinedBrakeState?.appliedByWheel || engineDrive.brakeState?.appliedByWheel || {},
      longitudinalUsageByWheel: engineDrive.wheelLongitudinalUsage || {},
      lateralUsageByWheel: engineDrive.wheelLateralUsage || {},
      lateralForceByWheel
    }
  });
  editor.raceSimulationSystems.chassis.syncToSession(
    aiSession.vehicle3d,
    aiSession,
    { preservePlanarPosition: true }
  );
  ai.vehicle3d = aiSession.vehicle3d;
  ai.worldX = aiSession.worldX;
  ai.worldZ = aiSession.worldZ;
  ai.carYaw = aiSession.carYaw;
  ai.bodyY = aiSession.bodyY;
  ai.heightM = aiSession.heightM;
  ai.pitchRad = aiSession.pitchRad;
  ai.rollRad = aiSession.rollRad;
  ai.verticalVelocityMps = aiSession.verticalVelocityMps;
  ai.grounded = aiSession.grounded;
  ai.airborne = aiSession.airborne;
  ai.wheelContacts3d = aiSession.wheelContacts3d;
  ai.suspensionTravel = aiSession.suspensionTravel;
  ai.terrainRollRad = Number(contactState.contacts?.terrainRollRad || 0);
  ai.terrainPitchRad = Number(contactState.contacts?.terrainPitchRad || 0);
  ai.averageSurfaceGrip = Number(contactState.averageSurfaceGrip || 1);
  ai.wheelRegions = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    aiSession.vehicle3d?.wheels?.[wheelId]?.surface?.region
      || contactState.contacts?.contacts?.[wheelId]?.region
      || 'terrain'
  ]));
  return aiSession.vehicle3d;
}

export function getRaceAiLongitudinalPhysicsStep(editor, ai = {}, {
  car = editor.selectedCar,
  tuning = editor.getRaceCarTuning(car),
  targetMps = 0,
  profile = editor.getRaceAiDifficultyProfile(ai.difficulty),
  contactState = null,
  seconds = 0
} = {}) {
  const dt = Math.max(0.0001, Number(seconds) || 0.0001);
  const speed = Math.max(0, Number(ai.speedMps || 0));
  const aiDistance = Number(ai.projectedDistance ?? ai.distance ?? 0) || 0;
  const target = Math.max(0, Number(targetMps) || 0);
  const speedError = target - speed;
  const braking = speedError < -0.35;
  const throttle = braking ? 0 : clamp(speedError / Math.max(4, 20 - Number(profile.pace || 0.8) * 8), 0, 1);
  const brake = braking ? clamp(-speedError / Math.max(5, 22 - Number(profile.brake || 0.7) * 10), 0, 1) : 0;
  const drivenWheelIds = editor.getRaceDrivenWheelIds(tuning);
  const contacts = contactState || editor.getRaceAiContactState(ai, car, tuning);
  const wheelContacts = contacts.contacts?.contacts || {};
  const wheelContacts3d = ai.vehicle3d?.wheels || ai.wheelContacts3d || null;
  const aiAirborneWithoutContacts = !wheelContacts3d && (ai.airborne || ai.grounded === false);
  const aiWheelContactCount = wheelContacts3d
    ? RACE_WHEEL_IDS.filter((wheelId) => {
      const wheel = wheelContacts3d?.[wheelId];
      if (!wheel?.inContact) return false;
      if (wheel.normalLoadKnown === false) return true;
      return Number(wheel.normalLoadN || 0) > 1;
    }).length
    : (aiAirborneWithoutContacts ? 0 : RACE_WHEEL_IDS.length);
  const tireContactScale = clamp(aiWheelContactCount / RACE_WHEEL_IDS.length, 0, 1);
  const zeroLoadsIfAirborne = (loads = {}) => {
    if (tireContactScale > 0.001) return loads;
    RACE_WHEEL_IDS.forEach((wheelId) => {
      loads[wheelId] = 0;
    });
    return loads;
  };
  const aiDamage = ai.damage || {};
  const setup = editor.getRaceCarSetup(car);
  ai.tireTemperature = {
    fl: 70,
    fr: 70,
    rl: 70,
    rr: 70,
    ...(ai.tireTemperature || {})
  };
  const weatherState = editor.getRaceWeatherState(editor.selectedRace, editor.playtestSession);
  const perWheelGrip = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const contact = wheelContacts[wheelId] || {};
    const surfaceId = contact.surface || contact.surfaceId || contacts.contacts?.surfaceByWheel?.[wheelId] || 'asphalt';
    return [
      wheelId,
      editor.getRaceWheelGripForSurface({
        car,
        wheelId,
        surfaceId,
        baseSurfaceId: contact.baseSurface || contacts.contacts?.baseSurfaceByWheel?.[wheelId] || surfaceId,
        snowDepthInches: contact.snowDepthInches
          ?? contacts.contacts?.snowDepthByWheel?.[wheelId]
          ?? weatherState.snowDepthInches,
        weather: weatherState.id,
        damage: aiDamage,
        terrainGripScale: contact.terrainGripScale || 1,
        temperatureF: ai.tireTemperature[wheelId]
      })
    ];
  }));
  const looseSurfaceFactor = editor.getRaceLooseSurfaceFactor({
    surfaceByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      wheelContacts[wheelId]?.surface || wheelContacts[wheelId]?.surfaceId || contacts.contacts?.surfaceByWheel?.[wheelId] || 'asphalt'
    ])),
    terrainByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      wheelContacts[wheelId]?.region || contacts.contacts?.terrainByWheel?.[wheelId] || 'road'
    ]))
  });
  const setupModifiers = editor.getRaceSetupPhysicsModifiers(tuning, speed);
  const aeroLoadEffectiveness = editor.getRaceAeroLoadEffectiveness(looseSurfaceFactor);
  const referenceNormalLoads = editor.getRaceWheelNormalLoads(tuning, 0, 0, speed, { aeroLoadEffectiveness });
  const aeroDownforceForLoads = editor.getRaceEffectiveAeroDownforceByAxle(tuning, speed, looseSurfaceFactor);
  const normalLoads = editor.getRace3DResolvedWheelNormalLoads(
    referenceNormalLoads,
    wheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  const bumpNormalLoadScales = editor.getRaceBumpNormalLoadScales({
    segment: contacts.pose?.segment || editor.getRaceSegmentAtDistance(aiDistance).segment,
    distance: aiDistance,
    speedMps: speed
  });
  editor.applyRaceBumpNormalLoadScales(normalLoads, bumpNormalLoadScales);
  zeroLoadsIfAirborne(normalLoads);
  const referenceFrontNormal = Math.max(1, Number(referenceNormalLoads.fl || 0) + Number(referenceNormalLoads.fr || 0));
  const referenceRearNormal = Math.max(1, Number(referenceNormalLoads.rl || 0) + Number(referenceNormalLoads.rr || 0));
  const frontNormal = Number(normalLoads.fl || 0) + Number(normalLoads.fr || 0);
  const rearNormal = Number(normalLoads.rl || 0) + Number(normalLoads.rr || 0);
  const lateralContactScale = clamp((frontNormal + rearNormal) / Math.max(1, referenceFrontNormal + referenceRearNormal), 0, 1);
  const drivenStaticLoad = drivenWheelIds.reduce((sum, wheelId) => sum + Math.max(1, Number(referenceNormalLoads[wheelId] || 0)), 0);
  const drivenContactLoad = wheelContacts3d
    ? drivenWheelIds.reduce((sum, wheelId) => {
      const wheel = wheelContacts3d[wheelId];
      if (!wheel || wheel.inContact === false) return sum;
      return sum + Math.max(0, Number(normalLoads[wheelId] || 0));
    }, 0)
    : drivenStaticLoad * tireContactScale;
  const drivenLoadScale = tireContactScale <= 0.001
    ? 0
    : clamp(drivenContactLoad / Math.max(1, drivenStaticLoad), 0, 1);
  const gripFactor = Math.max(0.35, Math.min(1.4, tuning.tireGrip))
    * clamp(Number(contacts.averageSurfaceGrip || 1), 0.22, 1.2)
    * (editor.playtestSession?.trackState
      ? 1
      : editor.getRaceWeatherGripMultiplier(editor.getRaceWeatherState(editor.selectedRace, editor.playtestSession)))
    * setupModifiers.grip;
  let gear = clamp(Math.round(Number(ai.gear || 1)), 1, Math.max(1, tuning.gearRatios.length));
  const projectedRpm = editor.getRaceProjectedEngineRpmForGear(tuning, speed, gear);
  const automaticUpshiftRpm = editor.getRaceAutomaticUpshiftRpm(tuning);
  const automaticDownshiftRpm = editor.getRaceAutomaticDownshiftRpm(tuning);
  const shiftAt = automaticUpshiftRpm * (ai.difficulty === 'expert' ? 0.99 : 0.92);
  let automaticOverrevUpshifts = 0;
  if (!braking && projectedRpm > shiftAt && gear < tuning.gearRatios.length) gear += 1;
  if ((braking || projectedRpm < automaticDownshiftRpm * Number(profile.shift || 0.8)) && gear > 1 && editor.canRaceAutomaticDownshift(tuning, speed, gear - 1)) gear -= 1;
  const safeCurrentGearRpm = Math.max(automaticUpshiftRpm, tuning.revLimitRpm * 0.985);
  while (
    gear < tuning.gearRatios.length
    && editor.getRaceProjectedEngineRpmForGear(tuning, speed, gear) > safeCurrentGearRpm
  ) {
    gear += 1;
    automaticOverrevUpshifts += 1;
  }
  const gearRatio = editor.getRaceGearRatio(tuning, gear);
  const rpm = clamp(editor.getRaceProjectedEngineRpmForGear(tuning, speed, gear), tuning.idleRpm, tuning.revLimitRpm);
  const engineTorqueNm = editor.getRaceTorqueNmAtRpm(rpm, tuning);
  const driveForceComponents = editor.getRaceDriveForceComponents({
    tuning,
    gearRatio,
    engineTorqueNm,
    availablePowerW: tuning.powerHp * 745.7,
    speedMps: speed
  });
  const driveForceCommandRaw = driveForceComponents.baseForceN * tuning.accelerationCalibration * throttle;
  const driveForceRaw = drivenLoadScale > 0.001 ? driveForceCommandRaw : 0;
  const preliminaryDrivenTraction = editor.getRaceDrivenTractionLimit({
    tuning,
    drivenWheelIds,
    normalLoads,
    referenceNormalLoads,
    gripByWheel: perWheelGrip,
    gripFactor,
    looseSurfaceFactor,
    setupModifiers
  });
  const preliminaryDrivenTractionLimit = preliminaryDrivenTraction.tractionLimitN;
  const preliminaryDriveDemandRatio = driveForceCommandRaw ? Math.abs(driveForceCommandRaw) / Math.max(1, preliminaryDrivenTractionLimit) : 0;
  const preliminaryExcessDriveSlip = clamp((preliminaryDriveDemandRatio - 1) / 1.2, 0, 1);
  const preliminaryPostPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(
    preliminaryExcessDriveSlip,
    looseSurfaceFactor,
    false
  );
  const preliminaryEffectiveDrivenTractionLimit = preliminaryDrivenTractionLimit * preliminaryPostPeakTractionEfficiency;
  const preliminaryAppliedDriveForce = Math.min(driveForceRaw, preliminaryEffectiveDrivenTractionLimit);
  const driveLoadAcceleration = clamp(
    preliminaryAppliedDriveForce / Math.max(450, Number(tuning.weightKg) || 1400),
    -9.5,
    9.5
  );
  const driveNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, driveLoadAcceleration, 0, speed, { aeroLoadEffectiveness }),
    wheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(driveNormalLoads, bumpNormalLoadScales);
  zeroLoadsIfAirborne(driveNormalLoads);
  const drivenTraction = editor.getRaceDrivenTractionLimit({
    tuning,
    drivenWheelIds,
    normalLoads: driveNormalLoads,
    referenceNormalLoads,
    gripByWheel: perWheelGrip,
    gripFactor,
    looseSurfaceFactor,
    setupModifiers
  });
  const drivenTractionLimit = drivenTraction.tractionLimitN;
  const driveLoadSensitivityByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    editor.getRaceTireLoadSensitivityMultiplier(driveNormalLoads[wheelId], referenceNormalLoads[wheelId], looseSurfaceFactor)
  ]));
  const driveForceDemandRaw = driveForceCommandRaw;
  const driveDemandRatio = driveForceDemandRaw ? Math.abs(driveForceDemandRaw) / Math.max(1, drivenTractionLimit) : 0;
  const excessDriveSlip = clamp((driveDemandRatio - 1) / 1.2, 0, 1);
  const postPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(
    excessDriveSlip,
    looseSurfaceFactor,
    false
  );
  const effectiveDrivenTractionLimit = drivenTractionLimit * postPeakTractionEfficiency;
  const driveForce = Math.min(driveForceRaw, effectiveDrivenTractionLimit);
  const appliedDriveDemandRatio = driveForceRaw ? Math.abs(driveForceRaw) / Math.max(1, drivenTractionLimit) : 0;
  const wheelSpinRatio = clamp(appliedDriveDemandRatio, 0, 1.8);
  const relaxedWheelSpinRatio = editor.getRaceRelaxedLongitudinalSlipRatio({
    targetSlipRatio: wheelSpinRatio,
    previousSlipRatio: ai.longitudinalWheelSlipRatio,
    speedMps: speed,
    looseSurfaceFactor,
    tireContactScale,
    seconds
  });
  ai.longitudinalWheelSlipRatio = relaxedWheelSpinRatio;
  const driveForceShareByWheel = drivenTraction.forceShareByWheel
    || editor.getRaceDriveForceShareByWheel(tuning, drivenWheelIds, {
      normalLoads: driveNormalLoads,
      gripByWheel: perWheelGrip,
      driveForce: driveForceRaw
    });
  const driveForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    driveForce * Number(driveForceShareByWheel[wheelId] || 0)
  ]));
  const engineBraking = editor.getRaceEngineBrakingForce({
    tuning,
    gearRatio,
    throttle,
    speedMps: speed,
    engineRpm: rpm,
    drivenTractionLimit,
    tireContactScale: drivenLoadScale
  });
  const engineBrakeForceShareByWheel = editor.getRaceDriveForceShareByWheel(tuning, drivenWheelIds, {
    normalLoads: driveNormalLoads,
    gripByWheel: perWheelGrip,
    driveForce: engineBraking.force
  });
  const engineBrakeForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    engineBraking.force * Number(engineBrakeForceShareByWheel[wheelId] || 0)
  ]));
  const chassisLongitudinalForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Number(driveForceByWheel[wheelId] || 0) + Number(engineBrakeForceByWheel[wheelId] || 0)
  ]));
  const preliminaryBrakeState = editor.getRaceBrakeForceForInput({
    tuning,
    brake,
    handbrake: 0,
    gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
    normalLoads,
    referenceNormalLoads,
    looseSurfaceFactor,
    speedMps: speed
  });
  if (tireContactScale <= 0.001) preliminaryBrakeState.force = 0;
  const brakeLoadAcceleration = -preliminaryBrakeState.force / Math.max(450, Number(tuning.weightKg) || 1400);
  const brakeNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, brakeLoadAcceleration, 0, speed, { aeroLoadEffectiveness }),
    wheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(brakeNormalLoads, bumpNormalLoadScales);
  zeroLoadsIfAirborne(brakeNormalLoads);
  const brakeState = editor.getRaceBrakeForceForInput({
    tuning,
    brake,
    handbrake: 0,
    gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
    normalLoads: brakeNormalLoads,
    referenceNormalLoads,
    looseSurfaceFactor,
    speedMps: speed
  });
  if (tireContactScale <= 0.001) {
    brakeState.force = 0;
    brakeState.appliedByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
    brakeState.lockByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
  }
  const wheelLongitudinalUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const wheelLimit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: brakeNormalLoads,
      referenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor
    });
    const driveUsage = Math.abs(driveForceRaw) * Number(driveForceShareByWheel[wheelId] || 0);
    const engineBrakeUsage = Math.abs(engineBraking.force) * Number(engineBrakeForceShareByWheel[wheelId] || 0);
    const brakeUsage = Number(brakeState.appliedByWheel?.[wheelId] || 0);
    if (wheelLimit <= 0.001) return [wheelId, 0];
    return [wheelId, clamp((driveUsage + engineBrakeUsage + brakeUsage) / wheelLimit, 0, 2.2)];
  }));
  const routeCurve = Number(contacts.pose?.segment?.curve || ai.curve || 0);
  const aiLateralAcceleration = speed * speed * routeCurve * 0.0025;
  const aiTireLongitudinalLoadAcceleration = clamp(
    (driveForce + engineBraking.force - brakeState.force) / Math.max(450, Number(tuning.weightKg) || 1400),
    -9.5,
    9.5
  );
  const dynamicNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, aiTireLongitudinalLoadAcceleration, aiLateralAcceleration, speed, { aeroLoadEffectiveness }),
    wheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(dynamicNormalLoads, bumpNormalLoadScales);
  zeroLoadsIfAirborne(dynamicNormalLoads);
  const dynamicFrontNormal = Number(dynamicNormalLoads.fl || 0) + Number(dynamicNormalLoads.fr || 0);
  const dynamicRearNormal = Number(dynamicNormalLoads.rl || 0) + Number(dynamicNormalLoads.rr || 0);
  const dynamicLateralContactScale = clamp(
    (dynamicFrontNormal + dynamicRearNormal) / Math.max(1, referenceFrontNormal + referenceRearNormal),
    0,
    1
  );
  const lateralForceTotal = Math.abs(aiLateralAcceleration) * Math.max(450, Number(tuning.weightKg) || 1400);
  const aiAxleLateralGripModifier = { front: 1, rear: 1 };
  const wheelRemainingLateralLimit = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    editor.getRaceWheelRemainingLateralLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads,
      gripByWheel: perWheelGrip,
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      longitudinalUsage: wheelLongitudinalUsage[wheelId],
      axleGripModifier: wheelId === 'fl' || wheelId === 'fr' ? aiAxleLateralGripModifier.front : aiAxleLateralGripModifier.rear
    })
  ]));
  const wheelLateralUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const isFront = wheelId === 'fl' || wheelId === 'fr';
    const axleShare = isFront ? 0.56 : 0.44;
    const wheelLimit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor
    });
    const remainingLateralLimit = Number(wheelRemainingLateralLimit[wheelId] || 0);
    if (wheelLimit <= 0.001) return [wheelId, 0];
    return [wheelId, clamp(Math.min(lateralForceTotal * axleShare * 0.5, remainingLateralLimit) / wheelLimit, 0, 1.45)];
  }));
  const wheelFrictionUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Math.hypot(Number(wheelLongitudinalUsage[wheelId] || 0), Number(wheelLateralUsage[wheelId] || 0))
  ]));
  const combinedLongitudinalEfficiency = editor.getRaceCombinedLongitudinalEfficiency(
    wheelFrictionUsage,
    wheelLongitudinalUsage,
    looseSurfaceFactor,
    dynamicLateralContactScale
  );
  const longitudinalTireForce = driveForce + engineBraking.force - brakeState.force;
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
  const aiWheelContactScaleByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const referenceLoad = Math.max(1, Number(referenceNormalLoads[wheelId] || 1));
    const rawLoad = Number(dynamicNormalLoads[wheelId]);
    const load = Number.isFinite(rawLoad) ? Math.max(0, rawLoad) : referenceLoad;
    return [wheelId, clamp(load / referenceLoad, 0, 1)];
  }));
  const aiContactWheelSpinRatioByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    drivenWheelIds.includes(wheelId)
      ? relaxedWheelSpinRatio * Number(aiWheelContactScaleByWheel[wheelId] || 0)
      : 0
  ]));
  const aiFreeWheelSpinRatioByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    drivenWheelIds.includes(wheelId)
      ? relaxedWheelSpinRatio * (1 - Number(aiWheelContactScaleByWheel[wheelId] || 0))
      : 0
  ]));
  const aiTireSlipByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Math.max(
      Math.max(0, Number(aiContactWheelSpinRatioByWheel[wheelId] || 0) - 0.78) * 1.1,
      Math.max(0, Number(wheelLongitudinalUsage[wheelId] || 0) - 0.92) * 0.8,
      Math.max(0, Number(wheelLateralUsage[wheelId] || 0) - 0.85) * 1.4,
      Number(brakeState.lockByWheel?.[wheelId] || 0)
    ) * Number(aiWheelContactScaleByWheel[wheelId] || 0)
  ]));
  const tirePressureDynamicsByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const compound = editor.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]);
    const surfaceId = wheelContacts[wheelId]?.surface || wheelContacts[wheelId]?.surfaceId || contacts.contacts?.surfaceByWheel?.[wheelId] || 'asphalt';
    return [wheelId, editor.getRaceTirePressureDynamics({
      pressurePsi: setup.tirePressurePsi[wheelId],
      compoundId: compound.id,
      surfaceId,
      tireSize: setup.tireSize,
      temperatureF: ai.tireTemperature[wheelId]
    })];
  }));
  const nextTireTemperature = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const staticLoad = Math.max(1, Number(referenceNormalLoads[wheelId] || 1));
    const rawLoad = Number(dynamicNormalLoads[wheelId]);
    const load = Number.isFinite(rawLoad) ? Math.max(0, rawLoad) : staticLoad;
    return [wheelId, editor.getRaceUpdatedTireTemperature({
      previousTemperatureF: ai.tireTemperature[wheelId],
      seconds: dt,
      speedMps: speed,
      loadRatio: load / staticLoad,
      slip: aiTireSlipByWheel[wheelId],
      pressureDynamics: tirePressureDynamicsByWheel[wheelId],
      handbrake: 0,
      wheelId,
      contactLoadScale: aiWheelContactScaleByWheel[wheelId],
      surfaceId: wheelContacts[wheelId]?.surface || wheelContacts[wheelId]?.surfaceId || contacts.contacts?.surfaceByWheel?.[wheelId] || 'asphalt',
      terrain: wheelContacts[wheelId]?.terrain || contacts.contacts?.terrainByWheel?.[wheelId] || 'road'
    })];
  }));
  const tirePressureRollingMultiplier = RACE_WHEEL_IDS.reduce((sum, wheelId) => {
    const pressureDynamics = tirePressureDynamicsByWheel[wheelId] || {};
    return sum + Number(pressureDynamics.rollingMultiplier || 1);
  }, 0) / RACE_WHEEL_IDS.length;
  const tireTemperatureGrip = editor.getRaceTireTemperatureGripMultipliers(ai.tireTemperature);
  const snowDepthInches = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
    sum + Number(
      wheelContacts[wheelId]?.snowDepthInches
      ?? contacts.contacts?.snowDepthByWheel?.[wheelId]
      ?? weatherState.snowDepthInches
      ?? 0
    )
  ), 0) / RACE_WHEEL_IDS.length;
  const trackStateRollingResistance = editor.playtestSession?.trackState
    ? RACE_WHEEL_IDS.reduce((sum, wheelId) => (
      sum + (
        Number(wheelContacts[wheelId]?.trackState?.rollingResistanceMultiplier || 1)
        / Math.max(0.2, Number(wheelContacts[wheelId]?.trackState?.cell?.baseRollingResistance || 1))
      )
    ), 0) / RACE_WHEEL_IDS.length
    : 1;
  const terrainResistance = (1 + looseSurfaceFactor * 0.32
    + editor.getRaceSnowResistanceMultiplier(snowDepthInches)) * trackStateRollingResistance;
  const resistanceForces = editor.getRaceLongitudinalResistanceForces({
    tuning,
    speedMps: speed,
    setupModifiers,
    terrainResistance,
    looseSurfaceFactor,
    tirePressureRollingMultiplier,
    tireContactScale
  });
  const runtimeType = editor.playtestSession?.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const roadGrade = Number(editor.getRaceRoadSurfaceProfileAtDistance(aiDistance, { runtimeType }).grade || 0);
  const gradeForce = -Math.max(450, Number(tuning.weightKg) || 1400) * 9.81 * editor.getRaceGradeGravityRatio(roadGrade) * tireContactScale;
  const acceleration = (combinedLongitudinalAppliedForce + gradeForce - resistanceForces.totalN) / Math.max(450, Number(tuning.weightKg) || 1400);
  const topSpeedLimitMps = editor.getRaceRuntimeTopSpeedLimitMps(car, tuning, {
    setupModifiers,
    gripFactor,
    looseSurfaceFactor,
    tirePressureRollingMultiplier
  });
  ai.gear = gear;
  ai.rpm = rpm;
  ai.engineDrive = {
    throttle,
    brake,
    topSpeedLimitMps,
    driveDemandRatio,
    automaticUpshiftRpm,
    automaticOverrevUpshifts,
    postPeakTractionEfficiency,
    limitingSource: driveForceComponents.limitingSource,
    powerLimitBlend: driveForceComponents.powerLimitBlend,
    tractionLimitN: drivenTractionLimit,
    drivenTraction,
    demandedForceN: driveForceDemandRaw,
    appliedRawForceN: driveForceRaw,
    driveForceN: driveForce,
    appliedDriveDemandRatio,
    wheelSpinRatio: relaxedWheelSpinRatio,
    targetWheelSpinRatio: wheelSpinRatio,
    referenceNormalLoads,
    normalLoads,
    driveNormalLoads,
    brakeNormalLoads,
    dynamicNormalLoads,
    bumpNormalLoadScales,
    tireLongitudinalLoadAcceleration: aiTireLongitudinalLoadAcceleration,
    brakeLoadAcceleration,
    brakeState,
    combinedBrakeState,
    preliminaryBrakeForce: preliminaryBrakeState.force,
    driveLoadAcceleration,
    preliminaryDrivenTractionLimit,
    preliminaryAppliedDriveForce,
    driveLoadSensitivityByWheel,
    driveForceShareByWheel,
    engineBrakeForceShareByWheel,
    engineBrakeForceByWheel,
    driveForceByWheel,
    chassisLongitudinalForceByWheel,
    combinedChassisLongitudinalForceByWheel,
    wheelLongitudinalUsage,
    wheelLateralUsage,
    wheelFrictionUsage,
    wheelRemainingLateralLimit,
    combinedLongitudinalForceScale,
    combinedSlipEfficiency: combinedLongitudinalEfficiency,
    combinedSlipAppliedForceN: combinedLongitudinalAppliedForce,
    combinedSlipForceLossN: combinedLongitudinalForceLoss,
    lateralAcceleration: aiLateralAcceleration,
    lateralContactScale: dynamicLateralContactScale,
    neutralLateralContactScale: lateralContactScale,
    engineBraking,
    tireSlipByWheel: aiTireSlipByWheel,
    contactWheelSpinRatioByWheel: aiContactWheelSpinRatioByWheel,
    freeWheelSpinRatioByWheel: aiFreeWheelSpinRatioByWheel,
    wheelContactScaleByWheel: aiWheelContactScaleByWheel,
    tireTemperature: { ...ai.tireTemperature },
    nextTireTemperature,
    tireTemperatureGrip,
    tirePressureDynamics: tirePressureDynamicsByWheel,
    perWheelGrip,
    tirePressureRollingMultiplier,
    resistanceForces,
    tireContactScale,
    drivenLoadScale,
    wheelContacts3d: wheelContacts3d || null
  };
  ai.tireTemperature = nextTireTemperature;
  ai.driveForceShareByWheel = driveForceShareByWheel;
  const nextAiSpeedMps = Math.max(0, speed + acceleration * dt);
  return {
    speedMps: throttle > RACE_PEDAL_INPUT.activeThreshold && acceleration > 0
      ? Math.min(nextAiSpeedMps, topSpeedLimitMps * 1.02)
      : nextAiSpeedMps,
    acceleration,
    braking,
    gripFactor,
    looseSurfaceFactor
  };
}

export function updateRaceAiDrivers(editor, seconds = 0, {
  preStartMode = 'none',
  rollingStartSpeedMps = 0
} = {}) {
  const session = editor.playtestSession;
  if (!session?.aiRuntime?.length) return;
  const dt = Math.max(0, Number(seconds) || 0);
  const routeLength = Math.max(1, Number(session.routeLength || editor.getRaceRouteLength()));
  const isCircuit = (session.routeRuntimeType || editor.getSelectedRaceRuntimeType()) === 'circuit';
  if (preStartMode === 'standing' || preStartMode === 'rolling') {
    const stagedSpeedMps = preStartMode === 'rolling'
      ? Math.max(0, Number(rollingStartSpeedMps || 0))
      : 0;
    session.aiRuntime.forEach((ai) => {
      const car = editor.project.cars.find((candidate) => candidate.id === ai.carId) || editor.selectedCar;
      const tuning = editor.getRaceCarTuning(car, {
        transmissionType: ai.shiftMode === 'manual' ? 'manual' : 'automatic'
      });
      ai.speedMps = stagedSpeedMps;
      if (stagedSpeedMps > 0) {
        ai.distance = Number(ai.distance || 0) + stagedSpeedMps * dt;
        if (isCircuit && ai.distance >= routeLength) ai.distance -= routeLength;
        if (!isCircuit) ai.distance = Math.min(ai.distance, routeLength);
      }
      ai.projectedDistance = isCircuit
        ? ((Number(ai.distance || 0) % routeLength) + routeLength) % routeLength
        : clamp(Number(ai.distance || 0), 0, routeLength);
      ai.rpm = tuning.idleRpm;
      ai.engineDrive = {
        throttle: 0,
        brake: 0,
        driveForceN: 0,
        demandedForceN: 0,
        appliedRawForceN: 0,
        wheelSpinRatio: 0,
        tireSlipByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        contactWheelSpinRatioByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        wheelLongitudinalUsage: { fl: 0, fr: 0, rl: 0, rr: 0 },
        wheelLateralUsage: { fl: 0, fr: 0, rl: 0, rr: 0 },
        chassisLongitudinalForceByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        combinedChassisLongitudinalForceByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
        combinedBrakeState: {
          force: 0,
          appliedByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 }
        }
      };
    });
    return;
  }
  session.aiRuntime.forEach((ai, index) => {
    const car = editor.project.cars.find((candidate) => candidate.id === ai.carId) || editor.selectedCar;
    const tuning = editor.getRaceCarTuning(car, { transmissionType: ai.shiftMode === 'manual' ? 'manual' : 'automatic' });
    const profile = editor.getRaceAiDifficultyProfile(ai.difficulty);
    if (session.trackState
      && Number(ai.trackStateLastObservationStep) !== Number(session.trackState.stepIndex)) {
      const lineDecision = editor.raceSimulationSystems.surface.evaluateTrackStateAiCandidates({
        trackState: session.trackState,
        distance: Number(ai.projectedDistance ?? ai.distance ?? 0),
        currentOffset: Number(ai.trackStateTargetLineOffset ?? ai.lineOffset ?? 0),
        candidateOffsets: [-0.68, -0.34, 0, 0.34, 0.68],
        lookaheadDistances: [10, 22, 38, 56],
        nextSwitchStep: Number(ai.trackStateNextLineSwitchStep || 0),
        hysteresis: 0.025,
        switchCooldownSteps: 12,
        getWorldPoint: (distance, offset) => {
          const pose = editor.getRaceWorldPoseAtDistance(distance, {
            runtimeType: session.routeRuntimeType || editor.getSelectedRaceRuntimeType()
          });
          const section = editor.getRaceSurfaceSectionAtDistance(distance, {
            routeLength,
            runtimeType: session.routeRuntimeType || editor.getSelectedRaceRuntimeType()
          });
          const roadHalfWidth = Math.max(
            1,
            Number(section.metrics?.roadEnd || editor.getRaceRoadHalfWidthWorld(pose.segment))
          );
          const right = editor.getRaceRightVector(pose.yaw);
          const lateral = clamp(Number(offset || 0), -0.85, 0.85) * roadHalfWidth;
          return {
            x: Number(pose.x || 0) + right.x * lateral,
            z: Number(pose.z ?? pose.y ?? 0) + right.z * lateral
          };
        }
      });
      ai.trackStateTargetLineOffset = lineDecision.chosenOffset;
      ai.trackStateNextLineSwitchStep = lineDecision.nextSwitchStep;
      ai.trackStateLineDecision = lineDecision;
      ai.trackStateLastObservationStep = session.trackState.stepIndex;
    }
    if (session.trackState) {
      const targetOffset = Number(ai.trackStateTargetLineOffset ?? ai.lineOffset ?? 0);
      const currentOffset = Number(ai.lineOffset || 0);
      const maxOffsetChange = Math.max(0, dt) * 0.42;
      ai.lineOffset = currentOffset + clamp(
        targetOffset - currentOffset,
        -maxOffsetChange,
        maxOffsetChange
      );
    }
    const contactState = editor.getRaceAiContactState(ai, car, tuning);
    const terrainRollRad = Number(contactState.contacts?.terrainRollRad || 0);
    const bankAssist = clamp(Math.abs(terrainRollRad) * 0.75, 0, 0.28);
    const gripScale = clamp(Number(contactState.averageSurfaceGrip || 1), 0.28, 1.12);
    const predictiveGripScale = session.trackState
      ? Math.min(gripScale, clamp(Number(ai.trackStateLineDecision?.gripScale || gripScale), 0.18, 1.12))
      : gripScale;
    const predictiveSurfaceRisk = session.trackState
      ? clamp(Number(ai.trackStateLineDecision?.risk || 0), 0, 1)
      : 0;
    const setupModifiers = editor.getRaceSetupPhysicsModifiers(tuning, Number(ai.speedMps || 0));
    const topSpeedLimitMps = editor.getRaceRuntimeTopSpeedLimitMps(car, tuning, {
      setupModifiers,
      terrainResistance: 1 + editor.getRaceLooseSurfaceFactor(contactState.contacts) * 0.32,
      gripFactor: gripScale,
      looseSurfaceFactor: editor.getRaceLooseSurfaceFactor(contactState.contacts)
    });
    const severity = editor.getRaceAiLookaheadSeverity(ai.projectedDistance || ai.distance || 0, ai.speedMps || 0) * (1 - bankAssist);
    const variance = Math.sin((Number(session.elapsedMs || 0) / 1000) * (0.45 + index * 0.04) + index) * profile.variance;
    const targetMps = Math.max(
      9,
      topSpeedLimitMps
        * profile.pace
        * Math.sqrt(predictiveGripScale)
        * (1 - predictiveSurfaceRisk * 0.34)
        * (1 - clamp(severity * (0.48 - profile.corner * 0.16), 0, 0.66))
        * (1 + variance)
    );
    const previousSpeedMps = Number(ai.speedMps || 0);
    const aiPhysics = editor.getRaceAiLongitudinalPhysicsStep(ai, {
      car,
      tuning,
      targetMps,
      profile,
      contactState,
      seconds: dt
    });
    ai.speedMps = aiPhysics.speedMps;
    ai.distance += ai.speedMps * dt;
    if (isCircuit) {
      while (ai.distance >= routeLength) {
        ai.distance -= routeLength;
        ai.lap += 1;
        if (!ai.bestLapMs || ai.currentLapMs < ai.bestLapMs) ai.bestLapMs = ai.currentLapMs;
        ai.currentLapMs = 0;
      }
      ai.projectedDistance = ((ai.distance % routeLength) + routeLength) % routeLength;
    } else {
      ai.distance = Math.min(ai.distance, routeLength);
      ai.projectedDistance = clamp(ai.distance, 0, routeLength);
    }
    ai.currentLapMs += dt * 1000;
    editor.updateRaceAiVehiclePhysics(ai, { car, tuning, seconds: dt, previousSpeedMps });
    if (session.trackState && Number(ai.trackStateLastQueuedStep) !== Number(session.trackState.stepIndex)) {
      const aiSurfaceSession = {
        ...contactState.session,
        worldX: Number(ai.worldX ?? contactState.session.worldX ?? 0),
        worldZ: Number(ai.worldZ ?? contactState.session.worldZ ?? 0),
        carYaw: Number(ai.carYaw ?? contactState.session.carYaw ?? 0),
        speedMps: Number(ai.speedMps || 0),
        vehicle3d: ai.vehicle3d,
        routeRuntimeType: session.routeRuntimeType,
        trackState: session.trackState
      };
      const wheelSurfaceState = editor.getRaceWheelSurfaceState({
        car,
        tuning,
        session: aiSurfaceSession,
        damage: ai.damage || {}
      });
      editor.raceSimulationSystems.surface.queueTrackStateTireEvents(session.trackState, {
        vehicleId: ai.id || ai.carId || `ai-${index}`,
        normalLoads: ai.engineDrive?.dynamicNormalLoads || {},
        tireSlipByWheel: ai.engineDrive?.tireSlipByWheel || {},
        wheelContactScaleByWheel: ai.engineDrive?.wheelContactScaleByWheel || {},
        wheelSurfaceState,
        previousPositions: ai.trackStatePreviousWheelPositions || {},
        speedMps: Math.abs(Number(ai.speedMps || 0)),
        tireCompoundByWheel: editor.getRaceCarSetup(car).tireCompoundByWheel,
        tireTemperatures: ai.tireTemperature || {},
        brakeState: ai.engineDrive?.combinedBrakeState || ai.engineDrive?.brakeState || {},
        wheelSpinByWheel: ai.engineDrive?.contactWheelSpinRatioByWheel || {},
        direction: editor.getRaceForwardVector(Number(ai.carYaw || 0))
      });
      ai.trackStatePreviousWheelPositions = Object.fromEntries(
        Object.entries(wheelSurfaceState.positions || {}).map(([wheelId, position]) => [
          wheelId,
          { x: Number(position.x || 0), z: Number(position.z || 0) }
        ])
      );
      ai.trackStateLastQueuedStep = session.trackState.stepIndex;
    }
    ai.consistencyError = variance + severity * (1 - profile.corner) * 0.2;
    ai.averageSurfaceGrip = Number(aiPhysics.gripFactor || contactState.averageSurfaceGrip || 1);
    ai.looseSurfaceFactor = Number(aiPhysics.looseSurfaceFactor || 0);
  });
}
