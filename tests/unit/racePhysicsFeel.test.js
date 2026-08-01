import assert from 'node:assert/strict';
import test from 'node:test';

import RaceEditor from '../../src/ui/RaceEditor.js';

const angleDelta = (a = 0, b = 0) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function createNoopRaceRenderContext() {
  return {
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    fillText() {},
    measureText(value) {
      return { width: String(value).length * 6 };
    },
    set fillStyle(_value) {},
    set strokeStyle(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
    set textBaseline(_value) {},
    set lineWidth(_value) {},
    set globalAlpha(_value) {}
  };
}

function runHighPowerFeelCase({
  surface = 'dirt',
  drivetrain = 'awd',
  powerHp = 1200,
  torqueLbFt = 1000,
  throttleAxis = 1,
  steerAxis = 0.8,
  frames = 150,
  startSpeedMps = 8,
  sampleProjectedCamera = false
} = {}) {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: {
      getGamepadAxes: () => ({
        leftX: steerAxis,
        rightTrigger: throttleAxis,
        leftTrigger: 0,
        rightX: 0
      }),
      isGamepadConnected: () => true
    },
    exitRaceEditor() {}
  });
  editor.selectedRace.hazards = [];
  editor.selectedRace.weather = 'clear';
  editor.selectedRace.road.segments = [
    { length: 1600, curve: 0, elevation: 0, surface, turn: 'smooth', hazardIds: [] }
  ];
  editor.selectedCar.tuning = {
    ...(editor.selectedCar.tuning || {}),
    drivetrain,
    powerHp,
    torqueLbFt,
    tireGrip: 1.05,
    tractionControlEnabled: false,
    engineCurve: {
      rpmMin: 1000,
      rpmMax: 8000,
      torquePoints: [
        { rpm: 1000, torqueLbFt },
        { rpm: 3500, torqueLbFt },
        { rpm: 6500, torqueLbFt: torqueLbFt * 0.9 },
        { rpm: 8000, torqueLbFt: torqueLbFt * 0.7 }
      ]
    }
  };
  const tire = surface === 'asphalt' ? 'tarmac' : 'dirt';
  editor.selectedCar.setup = {
    ...(editor.selectedCar.setup || {}),
    defaultTireCompound: tire,
    tireCompoundByWheel: { fl: tire, fr: tire, rl: tire, rr: tire }
  };
  editor.raceInput.tractionControlEnabled = false;
  editor.startPlaytest(editor.selectedCar.id);
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.playtestSession.speedMps = startSpeedMps;
  editor.playtestSession.velocityYaw = 0;
  editor.playtestSession.carYaw = 0;
  const renderContext = sampleProjectedCamera ? createNoopRaceRenderContext() : null;
  if (sampleProjectedCamera) {
    editor.drawRaceStableRoadPolygons = () => {};
    editor.drawRaceMode7Road = () => {};
    editor.drawRaceProjectedFlatTileMap = () => {};
    editor.drawRaceProjectedDecals = () => {};
    editor.drawRaceProjectedScenerySprites = () => {};
    editor.drawRaceProjectedAiCars = () => {};
    editor.drawRaceTireFxParticles = () => {};
    editor.drawRacePlaytestHud = () => {};
    editor.drawRaceThirdPersonCar = () => {};
  }

  const metrics = {
    maxSpeedMps: 0,
    maxWheelSpin: 0,
    maxDemandRatio: 0,
    maxYawRate: 0,
    maxBodyTravelSlipYaw: 0,
    maxCameraTravelYawError: 0,
    maxSevereLoosePowerOveruse: 0,
    maxDrivenWheelLongitudinalUsage: 0,
    maxDrivenWheelFrictionUsage: 0,
    minTractionControlCut: 1,
    minShiftTorqueCut: 1,
    maxDrivetrainUnload: 0,
    maxAppliedDriveDemandRatio: 0,
    maxDemandedDriveForceN: 0,
    maxAppliedDriveForceN: 0,
    maxRejectedDriveForceN: 0,
    minAppliedToDemandedDriveForceRatio: 1,
    maxGear: 0,
    maxAutomaticOverrevUpshifts: 0,
    minPostPeakTraction: 1,
    minCombinedLongitudinal: 1,
    min3dLoadSensitivity: 1,
    min3dFrictionCircle: 1,
    minEffectiveFrictionMu: Infinity,
    maxEffectiveFrictionMu: 0,
    maxProjectedAnchorLateralOffsetM: 0,
    maxProjectedAnchorForwardOffsetM: 0,
    maxProjectedCameraChaseYawError: 0,
    minProjectedBodyChaseYawDelta: Infinity
  };

  for (let frame = 0; frame < frames; frame += 1) {
    editor.raceInput.rawThrottleAxis = throttleAxis;
    editor.raceInput.throttleAxis = throttleAxis;
    editor.raceInput.steeringTarget = steerAxis;
    editor.raceInput.steeringWheel = steerAxis;
    editor.raceInput.analogSteeringActive = true;
    editor.raceInput.analogSteeringIntent = steerAxis;
    editor.updatePlaytest(1 / 60);

    const slip = editor.playtestSession.tireSlip || {};
    const engineDrive = slip.engineDrive || {};
    metrics.maxSpeedMps = Math.max(metrics.maxSpeedMps, Math.abs(Number(editor.playtestSession.speedMps || 0)));
    metrics.maxWheelSpin = Math.max(metrics.maxWheelSpin, Number(slip.wheelSpin || 0));
    metrics.maxDemandRatio = Math.max(metrics.maxDemandRatio, Number(engineDrive.driveDemandRatio || 0));
    metrics.maxAppliedDriveDemandRatio = Math.max(metrics.maxAppliedDriveDemandRatio, Number(engineDrive.appliedDriveDemandRatio || 0));
    const demandedDriveForceN = Math.abs(Number(engineDrive.demandedForceN || 0));
    const appliedDriveForceN = Math.abs(Number(engineDrive.appliedForceN || 0));
    metrics.maxDemandedDriveForceN = Math.max(metrics.maxDemandedDriveForceN, demandedDriveForceN);
    metrics.maxAppliedDriveForceN = Math.max(metrics.maxAppliedDriveForceN, appliedDriveForceN);
    metrics.maxRejectedDriveForceN = Math.max(metrics.maxRejectedDriveForceN, Math.max(0, demandedDriveForceN - appliedDriveForceN));
    if (demandedDriveForceN > 1) {
      metrics.minAppliedToDemandedDriveForceRatio = Math.min(
        metrics.minAppliedToDemandedDriveForceRatio,
        appliedDriveForceN / demandedDriveForceN
      );
    }
    metrics.minTractionControlCut = Math.min(metrics.minTractionControlCut, Number(engineDrive.tractionControlCut ?? 1));
    metrics.minShiftTorqueCut = Math.min(metrics.minShiftTorqueCut, Number(engineDrive.shiftTorqueCut ?? 1));
    metrics.maxDrivetrainUnload = Math.max(metrics.maxDrivetrainUnload, Number(engineDrive.drivetrainUnload || 0));
    metrics.maxGear = Math.max(metrics.maxGear, Number(editor.raceInput.gear || editor.playtestSession.gear || 0));
    metrics.maxAutomaticOverrevUpshifts = Math.max(metrics.maxAutomaticOverrevUpshifts, Number(engineDrive.automaticOverrevUpshifts || 0));
    metrics.maxYawRate = Math.max(metrics.maxYawRate, Math.abs(Number(slip.yawVelocity || 0)));
    const drivenWheelIds = drivetrain === 'fwd'
      ? ['fl', 'fr']
      : drivetrain === 'rwd'
        ? ['rl', 'rr']
        : ['fl', 'fr', 'rl', 'rr'];
    metrics.maxDrivenWheelLongitudinalUsage = Math.max(
      metrics.maxDrivenWheelLongitudinalUsage,
      ...drivenWheelIds.map((wheelId) => Number(engineDrive.wheelLongitudinalUsage?.[wheelId] || 0))
    );
    metrics.maxDrivenWheelFrictionUsage = Math.max(
      metrics.maxDrivenWheelFrictionUsage,
      ...drivenWheelIds.map((wheelId) => Number(engineDrive.wheelFrictionUsage?.[wheelId] || 0))
    );
    metrics.maxBodyTravelSlipYaw = Math.max(metrics.maxBodyTravelSlipYaw, Math.abs(angleDelta(
      Number(editor.playtestSession.velocityYaw || 0),
      Number(editor.playtestSession.carYaw || 0)
    )));
    metrics.maxCameraTravelYawError = Math.max(metrics.maxCameraTravelYawError, Math.abs(angleDelta(
      Number(editor.playtestSession.cameraYaw || 0),
      Number(editor.playtestSession.velocityYaw || 0)
    )));
    metrics.minPostPeakTraction = Math.min(metrics.minPostPeakTraction, Number(engineDrive.postPeakTractionEfficiency ?? 1));
    metrics.maxSevereLoosePowerOveruse = Math.max(
      metrics.maxSevereLoosePowerOveruse,
      Number(slip.severeLoosePowerOveruse || 0)
    );
    metrics.minCombinedLongitudinal = Math.min(metrics.minCombinedLongitudinal, Number(engineDrive.combinedSlipEfficiency ?? 1));
    metrics.min3dLoadSensitivity = Math.min(
      metrics.min3dLoadSensitivity,
      ...Object.values(slip.vehicle3dLoadSensitivityByWheel || { x: 1 }).map(Number)
    );
    metrics.min3dFrictionCircle = Math.min(
      metrics.min3dFrictionCircle,
      ...Object.values(slip.vehicle3dFrictionCircleScaleByWheel || { x: 1 }).map(Number)
    );
    const effectiveMuValues = Object.values(slip.effectiveFrictionMuByWheel || {}).map(Number).filter(Number.isFinite);
    if (effectiveMuValues.length) {
      metrics.minEffectiveFrictionMu = Math.min(metrics.minEffectiveFrictionMu, ...effectiveMuValues);
      metrics.maxEffectiveFrictionMu = Math.max(metrics.maxEffectiveFrictionMu, ...effectiveMuValues);
    }
    if (sampleProjectedCamera && frame % 15 === 0) {
      editor.drawRaceProjectedRoadPath(renderContext, { x: 0, y: 0, w: 390, h: 260 }, { showPlaytestHud: false });
      const renderCamera = editor.lastRaceRenderCamera || {};
      const anchor = renderCamera.cameraAnchor || {};
      metrics.maxProjectedAnchorLateralOffsetM = Math.max(
        metrics.maxProjectedAnchorLateralOffsetM,
        Math.abs(Number(anchor.lateralOffsetM || 0))
      );
      metrics.maxProjectedAnchorForwardOffsetM = Math.max(
        metrics.maxProjectedAnchorForwardOffsetM,
        Math.abs(Number(anchor.forwardOffsetM || 0))
      );
      const camera = renderCamera.camera || {};
      if (Number.isFinite(Number(camera.x)) && Number.isFinite(Number(camera.z))) {
        const chaseYaw = Math.atan2(Number(anchor.x || 0) - Number(camera.x || 0), Number(anchor.z || 0) - Number(camera.z || 0));
        const bodyTravelSlipYaw = Math.abs(angleDelta(
          Number(editor.playtestSession.velocityYaw || 0),
          Number(editor.playtestSession.carYaw || 0)
        ));
        metrics.maxProjectedCameraChaseYawError = Math.max(
          metrics.maxProjectedCameraChaseYawError,
          Math.abs(angleDelta(chaseYaw, Number(renderCamera.cameraYaw || 0)))
        );
        if (bodyTravelSlipYaw > 0.5) {
          metrics.minProjectedBodyChaseYawDelta = Math.min(
            metrics.minProjectedBodyChaseYawDelta,
            Math.abs(angleDelta(chaseYaw, Number(editor.playtestSession.carYaw || 0)))
          );
        }
      }
    }
  }
  if (sampleProjectedCamera) {
    editor.drawRaceProjectedRoadPath(renderContext, { x: 0, y: 0, w: 390, h: 260 }, { showPlaytestHud: false });
    const renderCamera = editor.lastRaceRenderCamera || {};
    const anchor = renderCamera.cameraAnchor || {};
    metrics.maxProjectedAnchorLateralOffsetM = Math.max(
      metrics.maxProjectedAnchorLateralOffsetM,
      Math.abs(Number(anchor.lateralOffsetM || 0))
    );
    metrics.maxProjectedAnchorForwardOffsetM = Math.max(
      metrics.maxProjectedAnchorForwardOffsetM,
      Math.abs(Number(anchor.forwardOffsetM || 0))
    );
    const camera = renderCamera.camera || {};
    if (Number.isFinite(Number(camera.x)) && Number.isFinite(Number(camera.z))) {
      const chaseYaw = Math.atan2(Number(anchor.x || 0) - Number(camera.x || 0), Number(anchor.z || 0) - Number(camera.z || 0));
      const bodyTravelSlipYaw = Math.abs(angleDelta(
        Number(editor.playtestSession.velocityYaw || 0),
        Number(editor.playtestSession.carYaw || 0)
      ));
      metrics.maxProjectedCameraChaseYawError = Math.max(
        metrics.maxProjectedCameraChaseYawError,
        Math.abs(angleDelta(chaseYaw, Number(renderCamera.cameraYaw || 0)))
      );
      if (bodyTravelSlipYaw > 0.5) {
        metrics.minProjectedBodyChaseYawDelta = Math.min(
          metrics.minProjectedBodyChaseYawDelta,
          Math.abs(angleDelta(chaseYaw, Number(editor.playtestSession.carYaw || 0)))
        );
      }
    }
  }
  return metrics;
}

test('Race 1200 HP AWD dirt steering remains traction-limited while third-person camera follows travel yaw', () => {
  const dirt = runHighPowerFeelCase({ surface: 'dirt', drivetrain: 'awd', throttleAxis: 1, steerAxis: 0.8 });
  const asphalt = runHighPowerFeelCase({ surface: 'asphalt', drivetrain: 'awd', throttleAxis: 1, steerAxis: 0.8 });

  assert.equal(dirt.maxWheelSpin > 1, true);
  assert.equal(dirt.maxDemandRatio > 5, true);
  assert.equal(dirt.maxAppliedDriveDemandRatio > 5, true);
  assert.equal(dirt.maxDemandedDriveForceN > 45000, true);
  assert.equal(dirt.maxRejectedDriveForceN > 35000, true);
  assert.equal(dirt.minAppliedToDemandedDriveForceRatio < 0.24, true);
  assert.equal(dirt.minTractionControlCut, 1);
  assert.equal(dirt.minShiftTorqueCut > 0, true);
  assert.equal(dirt.minShiftTorqueCut <= 1, true);
  assert.equal(dirt.maxAutomaticOverrevUpshifts >= 0, true);
  assert.equal(dirt.maxGear >= 1, true);
  assert.equal(dirt.maxDrivetrainUnload > 0.6, true);
  assert.equal(dirt.minPostPeakTraction < 0.75, true);
  assert.equal(dirt.maxSpeedMps < asphalt.maxSpeedMps * 0.9, true);
  assert.equal(
    dirt.maxYawRate > 0.72,
    true,
    `expected loose-surface yaw rate above 0.72rad/s, received ${dirt.maxYawRate.toFixed(3)}`
  );
  assert.equal(dirt.maxBodyTravelSlipYaw > 0.5, true);
  assert.equal(dirt.maxCameraTravelYawError < 0.25, true,
    `expected camera/travel yaw error below 0.25rad, received ${dirt.maxCameraTravelYawError.toFixed(3)}`);
  assert.equal(dirt.minCombinedLongitudinal > 0.7, true);
  assert.equal(Number.isFinite(dirt.min3dLoadSensitivity), true);
  assert.equal(Number.isFinite(dirt.min3dFrictionCircle), true);
  assert.equal(dirt.min3dFrictionCircle < 0.75, true);
  assert.equal(dirt.maxEffectiveFrictionMu < 1.05, true);
  assert.equal(dirt.minEffectiveFrictionMu > 0.28, true);
});

test('Race projected third-person camera anchor lags live 1200 HP dirt drift instead of orbiting the body', () => {
  const dirt = runHighPowerFeelCase({
    surface: 'dirt',
    drivetrain: 'awd',
    throttleAxis: 1,
    steerAxis: 0.8,
    sampleProjectedCamera: true
  });

  assert.equal(dirt.maxBodyTravelSlipYaw > 0.5, true);
  assert.equal(dirt.maxCameraTravelYawError < 0.25, true);
  assert.equal(dirt.maxProjectedAnchorLateralOffsetM > 0.45, true);
  assert.equal(dirt.maxProjectedAnchorLateralOffsetM < 1.85, true);
  assert.equal(dirt.maxProjectedAnchorForwardOffsetM < 1.5, true);
  assert.equal(dirt.maxProjectedCameraChaseYawError < 0.08, true);
  assert.equal(Number.isFinite(dirt.minProjectedBodyChaseYawDelta), true);
  assert.equal(dirt.minProjectedBodyChaseYawDelta > 0.35, true);
});

test('Race stock AWD dirt remains controllable while 1200 HP partial throttle is still overpowered', () => {
  const stock = runHighPowerFeelCase({
    surface: 'dirt',
    drivetrain: 'awd',
    powerHp: 271,
    torqueLbFt: 258,
    throttleAxis: 0.35,
    steerAxis: 0.5
  });
  const overpowered = runHighPowerFeelCase({
    surface: 'dirt',
    drivetrain: 'awd',
    powerHp: 1200,
    torqueLbFt: 1000,
    throttleAxis: 0.35,
    steerAxis: 0.5
  });

  assert.equal(stock.maxWheelSpin < 0.08, true);
  assert.equal(stock.maxDemandRatio < 1, true);
  assert.equal(stock.minPostPeakTraction > 0.78, true);
  assert.equal(stock.maxDrivenWheelLongitudinalUsage < 1, true);
  assert.equal(stock.maxBodyTravelSlipYaw < 0.25, true,
    `expected stock body/travel slip below 0.25rad, received ${stock.maxBodyTravelSlipYaw.toFixed(3)}`);
  assert.equal(overpowered.maxWheelSpin > 0.45, true,
    `expected high-power wheelspin above 0.45, received ${overpowered.maxWheelSpin.toFixed(3)}`);
  assert.equal(overpowered.maxDemandRatio > stock.maxDemandRatio * 2.8, true);
  assert.equal(overpowered.maxRejectedDriveForceN > stock.maxRejectedDriveForceN + 12000, true);
  assert.equal(overpowered.minAppliedToDemandedDriveForceRatio < stock.minAppliedToDemandedDriveForceRatio * 0.42, true);
  assert.equal(overpowered.minPostPeakTraction < 0.75, true);
  assert.equal(overpowered.maxBodyTravelSlipYaw > stock.maxBodyTravelSlipYaw * 3, true);
  assert.equal(overpowered.maxSpeedMps > 10, true);
  assert.equal(
    overpowered.maxSpeedMps < stock.maxSpeedMps,
    true,
    `expected wheelspin-limited high-power speed ${overpowered.maxSpeedMps.toFixed(3)}m/s to remain below stock ${stock.maxSpeedMps.toFixed(3)}m/s on dirt`
  );
  assert.equal(overpowered.maxCameraTravelYawError < 0.25, true);
});

test('Race 1200 HP dirt stays overpowered across AWD RWD and FWD drivetrains', () => {
  const awd = runHighPowerFeelCase({ surface: 'dirt', drivetrain: 'awd', throttleAxis: 1, steerAxis: 0.8 });
  const rwd = runHighPowerFeelCase({ surface: 'dirt', drivetrain: 'rwd', throttleAxis: 1, steerAxis: 0.8 });
  const fwd = runHighPowerFeelCase({ surface: 'dirt', drivetrain: 'fwd', throttleAxis: 1, steerAxis: 0.8 });

  [[awd, 'AWD'], [rwd, 'RWD'], [fwd, 'FWD']].forEach(([metrics, drivetrain]) => {
    assert.equal(metrics.maxWheelSpin > 1, true);
    assert.equal(metrics.maxDemandRatio > 5, true);
    assert.equal(metrics.maxRejectedDriveForceN > 45000, true);
    assert.equal(metrics.minAppliedToDemandedDriveForceRatio < 0.2, true);
    assert.equal(metrics.maxDrivenWheelLongitudinalUsage > 1, true);
    assert.equal(metrics.maxDrivenWheelFrictionUsage > 1, true);
    assert.equal(metrics.min3dFrictionCircle < 0.75, true);
    assert.equal(metrics.minPostPeakTraction < 0.75, true);
    assert.equal(metrics.maxSevereLoosePowerOveruse > 0.25, true);
    assert.equal(metrics.maxSpeedMps < 13.5, true);
    assert.equal(
      metrics.maxYawRate > 0.72,
      true,
      `${drivetrain} expected yaw rate above 0.72rad/s, received ${metrics.maxYawRate.toFixed(3)}`
    );
    assert.equal(metrics.maxBodyTravelSlipYaw > 0.25, true);
    assert.equal(metrics.maxCameraTravelYawError < 0.25, true);
  });
  assert.equal(rwd.maxDemandRatio > awd.maxDemandRatio * 1.7, true);
  assert.equal(fwd.maxDemandRatio > awd.maxDemandRatio * 1.7, true);
});

test('Race scenery collisions execute the authored doodad speed rule on the first simulation frame', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  editor.selectedRace.hazards = [];
  editor.selectedRace.scenery = [{
    id: 'first-frame-flatten-rule',
    x: 0,
    z: 0,
    widthM: 12,
    heightM: 2,
    previewDoodad: {
      id: 'first-frame-flatten-rule',
      name: 'First-frame flatten rule',
      widthM: 12,
      heightM: 2,
      hitboxWidthM: 12,
      hitboxHeightM: 2,
      defaultRule: {
        behavior: 'collide',
        speedDrainPercent: 45,
        damage: { panels: 14, suspension: 6, engine: 3.5 }
      },
      rules: [{
        minSpeedMph: 30,
        behavior: 'flatten',
        speedDrainPercent: 18,
        damage: { panels: 2.5, suspension: 0, engine: 0 }
      }]
    }
  }];
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.speedMps = 15;

  editor.updatePlaytest(1 / 60);

  assert.equal(
    editor.playtestSession.flattenedSceneryIds.includes('first-frame-flatten-rule'),
    true
  );
});

test('production WRX preview controller reaches the Studio Sprint finish with scenery present', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  }, { mode: 'car' });
  editor.selectedRace.hazards = [];
  editor.selectedRace.laps = 1;
  editor.selectedRace.scenery = [{
    id: 'route-side-scenery',
    x: 100000,
    z: 100000,
    widthM: 2,
    heightM: 3,
    behavior: 'collide'
  }];
  const preview = editor.ensureCarEditorPreviewPlaytestSession();
  assert.ok(preview?.session);
  assert.equal(preview.session.runtimeCar?.name, '2022 Subaru WRX');
  assert.equal(preview.session.countdownRemainingMs, 0);
  preview.session.startupFramePending = false;
  const routeLength = Number(preview.session.routeLength || 0);
  let maximumDistance = 0;
  let completed = false;

  for (let frame = 0; frame < 90 * 60; frame += 1) {
    const session = editor.carEditorPreviewPlaytest?.session;
    if (session) maximumDistance = Math.max(maximumDistance, Number(session.distance || 0));
    editor.updateCarEditorPreviewPlaytest(1 / 60);
    if (!editor.carEditorPreviewPlaytest && maximumDistance > 0) {
      completed = true;
      break;
    }
  }
  const stalledSession = editor.carEditorPreviewPlaytest?.session;
  const stallDetails = stalledSession
    ? `; speed ${Number(stalledSession.speedMps || 0).toFixed(2)}m/s, checkpoints ${Number(stalledSession.checkpointIndex || 0)}/${Number(stalledSession.checkpointCount || 0)}, lateral ${Number(stalledSession.routeLateralM || 0).toFixed(2)}m`
    : '';

  assert.equal(
    completed,
    true,
    `WRX preview did not finish: ${maximumDistance.toFixed(2)}m / ${routeLength.toFixed(2)}m${stallDetails}`
  );
  assert.equal(
    maximumDistance >= routeLength * 0.95,
    true,
    `WRX preview stopped before the finish: ${maximumDistance.toFixed(2)}m / ${routeLength.toFixed(2)}m`
  );
  assert.equal(editor.carEditorPreviewRuntimeFailureMessage, '');
});
