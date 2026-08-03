import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('race playtest feel keeps 1200 HP loose-surface cars traction limited with travel-yaw camera', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await waitForGameReady(page);

  const result = await page.evaluate(() => {
    const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
    const configureCar = (editor, { surface = 'dirt', drivetrain = 'awd', powerHp = 1200, torqueLbFt = 1000, compound = 'dirt' } = {}) => {
      editor.selectedRace.hazards = [];
      editor.selectedRace.weather = surface === 'snow' ? 'snow' : 'clear';
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
            { rpm: 1000, torqueLbFt: torqueLbFt * 0.55 },
            { rpm: 3500, torqueLbFt },
            { rpm: 6500, torqueLbFt: torqueLbFt * 0.88 },
            { rpm: 8000, torqueLbFt: torqueLbFt * 0.62 }
          ]
        }
      };
      editor.selectedCar.setup = {
        ...(editor.selectedCar.setup || {}),
        defaultTireCompound: compound,
        tireCompoundByWheel: { fl: compound, fr: compound, rl: compound, rr: compound }
      };
    };
    const preparedWorldBakes = new Map();
    const runCase = ({ surface = 'dirt', drivetrain = 'awd', powerHp = 1200, torqueLbFt = 1000, throttleAxis = 1, steerAxis = 0.8, startSpeedMps = 0, switchSteerFrame = null, frames = 120, sampleProjectedCamera = false } = {}) => {
      const game = window.__game;
      game.enterRaceEditor();
      const editor = game.raceEditor;
      configureCar(editor, {
        surface,
        drivetrain,
        powerHp,
        torqueLbFt,
        compound: surface === 'asphalt' ? 'tarmac' : 'dirt'
      });
      let preparedWorldBake = preparedWorldBakes.get(surface);
      if (!preparedWorldBake) {
        preparedWorldBake = editor.buildRaceWorldBake(
          editor.getRacePlaytestWorldBakeOptions()
        );
        preparedWorldBakes.set(surface, preparedWorldBake);
      }
      editor.startPlaytest(editor.selectedCar.id, {
        hydrateCars: false,
        preparedWorldBake
      });
      editor.playtestSession.startupFramePending = false;
      editor.playtestSession.countdownRemainingMs = 0;
      editor.playtestSession.launchLockMs = 0;
      editor.playtestSession.elapsedMs = 1000;
      editor.playtestSession.speedMps = Number(startSpeedMps) || 0;
      editor.playtestSession.carYaw = 0;
      editor.playtestSession.velocityYaw = 0;
      editor.playtestSession.cameraYaw = 0;
      let maxWheelSpin = 0;
      let maxBodyTravelSlip = 0;
      let maxCameraTravelError = 0;
      let maxYawRate = 0;
      let maxDemandRatio = 0;
      let maxAppliedDriveDemandRatio = 0;
      let maxDemandedDriveForceN = 0;
      let maxAppliedDriveForceN = 0;
      let maxRejectedDriveForceN = 0;
      let minAppliedToDemandedDriveForceRatio = 1;
      let minTractionControlCut = 1;
      let minShiftTorqueCut = 1;
      let maxDrivetrainUnload = 0;
      let maxGear = 0;
      let maxAutomaticOverrevUpshifts = 0;
      let minPostPeakTraction = 1;
      let maxProjectedAnchorLateralOffsetM = 0;
      let maxProjectedAnchorForwardOffsetM = 0;
      let maxProjectedCameraChaseYawError = 0;
      let minProjectedBodyChaseYawDelta = Infinity;
      let maxDrivenWheelLongitudinalUsage = 0;
      let maxDrivenWheelFrictionUsage = 0;
      let min3dFrictionCircle = 1;
      let minEffectiveFrictionMu = Infinity;
      let maxEffectiveFrictionMu = 0;
      const canvas = sampleProjectedCamera ? document.createElement('canvas') : null;
      if (canvas) {
        canvas.width = 640;
        canvas.height = 360;
      }
      const ctx = canvas?.getContext?.('2d') || null;
      const session = editor.playtestSession;
      for (let frame = 0; frame < frames; frame += 1) {
        const frameSteer = Number.isFinite(Number(switchSteerFrame)) && frame >= Number(switchSteerFrame)
          ? -steerAxis
          : steerAxis;
        editor.raceInput.steeringTarget = frameSteer;
        editor.raceInput.steeringWheel = frameSteer;
        editor.raceInput.analogSteeringActive = Math.abs(frameSteer) > 0;
        editor.raceInput.analogSteeringIntent = frameSteer;
        editor.raceInput.activeThrottlePointerId = throttleAxis >= 0.95 ? 'browser-physics' : null;
        editor.raceInput.rawThrottleAxis = throttleAxis;
        editor.raceInput.throttleAxis = throttleAxis;
        editor.raceInput.analogThrottleActive = throttleAxis < 0.95;
        editor.updatePlaytest(1 / 60);
        const engineDrive = session.tireSlip?.engineDrive || {};
        maxWheelSpin = Math.max(maxWheelSpin, Number(session.tireSlip?.wheelSpin || 0));
        if (Math.abs(Number(session.speedMps || 0)) > 3) {
          maxBodyTravelSlip = Math.max(maxBodyTravelSlip, Math.abs(normalizeAngle(session.carYaw - session.velocityYaw)));
        }
        maxCameraTravelError = Math.max(maxCameraTravelError, Math.abs(normalizeAngle(session.cameraYaw - session.velocityYaw)));
        maxYawRate = Math.max(maxYawRate, Math.abs(Number(session.yawVelocityRadps || 0)));
        maxDemandRatio = Math.max(maxDemandRatio, Number(engineDrive.driveDemandRatio || 0));
        maxAppliedDriveDemandRatio = Math.max(maxAppliedDriveDemandRatio, Number(engineDrive.appliedDriveDemandRatio || 0));
        const demandedDriveForceN = Math.abs(Number(engineDrive.demandedForceN || 0));
        const appliedDriveForceN = Math.abs(Number(engineDrive.appliedForceN || 0));
        maxDemandedDriveForceN = Math.max(maxDemandedDriveForceN, demandedDriveForceN);
        maxAppliedDriveForceN = Math.max(maxAppliedDriveForceN, appliedDriveForceN);
        maxRejectedDriveForceN = Math.max(maxRejectedDriveForceN, Math.max(0, demandedDriveForceN - appliedDriveForceN));
        if (demandedDriveForceN > 1) {
          minAppliedToDemandedDriveForceRatio = Math.min(
            minAppliedToDemandedDriveForceRatio,
            appliedDriveForceN / demandedDriveForceN
          );
        }
        minTractionControlCut = Math.min(minTractionControlCut, Number(engineDrive.tractionControlCut ?? 1));
        minShiftTorqueCut = Math.min(minShiftTorqueCut, Number(engineDrive.shiftTorqueCut ?? 1));
        maxDrivetrainUnload = Math.max(maxDrivetrainUnload, Number(engineDrive.drivetrainUnload || 0));
        maxGear = Math.max(maxGear, Number(editor.raceInput.gear || session.gear || 0));
        maxAutomaticOverrevUpshifts = Math.max(maxAutomaticOverrevUpshifts, Number(engineDrive.automaticOverrevUpshifts || 0));
        minPostPeakTraction = Math.min(minPostPeakTraction, Number(engineDrive.postPeakTractionEfficiency ?? 1));
        const drivenWheelIds = drivetrain === 'fwd'
          ? ['fl', 'fr']
          : drivetrain === 'rwd'
            ? ['rl', 'rr']
            : ['fl', 'fr', 'rl', 'rr'];
        maxDrivenWheelLongitudinalUsage = Math.max(
          maxDrivenWheelLongitudinalUsage,
          ...drivenWheelIds.map((wheelId) => Number(engineDrive.wheelLongitudinalUsage?.[wheelId] || 0))
        );
        maxDrivenWheelFrictionUsage = Math.max(
          maxDrivenWheelFrictionUsage,
          ...drivenWheelIds.map((wheelId) => Number(engineDrive.wheelFrictionUsage?.[wheelId] || 0))
        );
        min3dFrictionCircle = Math.min(
          min3dFrictionCircle,
          ...Object.values(session.tireSlip?.vehicle3dFrictionCircleScaleByWheel || { x: 1 }).map(Number)
        );
        const effectiveMuValues = Object.values(session.tireSlip?.effectiveFrictionMuByWheel || {}).map(Number).filter(Number.isFinite);
        if (effectiveMuValues.length) {
          minEffectiveFrictionMu = Math.min(minEffectiveFrictionMu, ...effectiveMuValues);
          maxEffectiveFrictionMu = Math.max(maxEffectiveFrictionMu, ...effectiveMuValues);
        }
        if (ctx && frame % 15 === 0) {
          editor.drawRaceProjectedRoadPath(ctx, { x: 0, y: 0, w: 640, h: 360 }, { showPlaytestHud: false });
          const renderCamera = editor.lastRaceRenderCamera || {};
          const anchor = renderCamera.cameraAnchor || {};
          maxProjectedAnchorLateralOffsetM = Math.max(maxProjectedAnchorLateralOffsetM, Math.abs(Number(anchor.lateralOffsetM || 0)));
          maxProjectedAnchorForwardOffsetM = Math.max(maxProjectedAnchorForwardOffsetM, Math.abs(Number(anchor.forwardOffsetM || 0)));
          const camera = renderCamera.camera || {};
          if (Number.isFinite(Number(camera.x)) && Number.isFinite(Number(camera.z))) {
            const chaseYaw = Math.atan2(Number(anchor.x || 0) - Number(camera.x || 0), Number(anchor.z || 0) - Number(camera.z || 0));
            const bodyTravelSlipYaw = Math.abs(normalizeAngle(Number(session.velocityYaw || 0) - Number(session.carYaw || 0)));
            maxProjectedCameraChaseYawError = Math.max(
              maxProjectedCameraChaseYawError,
              Math.abs(normalizeAngle(chaseYaw - Number(renderCamera.cameraYaw || 0)))
            );
            if (bodyTravelSlipYaw > 0.4) {
              minProjectedBodyChaseYawDelta = Math.min(
                minProjectedBodyChaseYawDelta,
                Math.abs(normalizeAngle(chaseYaw - Number(session.carYaw || 0)))
              );
            }
          }
        }
      }
      if (ctx) {
        editor.drawRaceProjectedRoadPath(ctx, { x: 0, y: 0, w: 640, h: 360 }, { showPlaytestHud: false });
        const renderCamera = editor.lastRaceRenderCamera || {};
        const anchor = renderCamera.cameraAnchor || {};
        maxProjectedAnchorLateralOffsetM = Math.max(maxProjectedAnchorLateralOffsetM, Math.abs(Number(anchor.lateralOffsetM || 0)));
        maxProjectedAnchorForwardOffsetM = Math.max(maxProjectedAnchorForwardOffsetM, Math.abs(Number(anchor.forwardOffsetM || 0)));
        const camera = renderCamera.camera || {};
        if (Number.isFinite(Number(camera.x)) && Number.isFinite(Number(camera.z))) {
          const chaseYaw = Math.atan2(Number(anchor.x || 0) - Number(camera.x || 0), Number(anchor.z || 0) - Number(camera.z || 0));
          const bodyTravelSlipYaw = Math.abs(normalizeAngle(Number(session.velocityYaw || 0) - Number(session.carYaw || 0)));
          maxProjectedCameraChaseYawError = Math.max(
            maxProjectedCameraChaseYawError,
            Math.abs(normalizeAngle(chaseYaw - Number(renderCamera.cameraYaw || 0)))
          );
          if (bodyTravelSlipYaw > 0.4) {
            minProjectedBodyChaseYawDelta = Math.min(
              minProjectedBodyChaseYawDelta,
              Math.abs(normalizeAngle(chaseYaw - Number(session.carYaw || 0)))
            );
          }
        }
      }
      return {
        surface,
        drivetrain,
        powerHp,
        throttleAxis,
        distance: Number(session.distance || 0),
        speedMps: Number(session.speedMps || 0),
        maxWheelSpin,
        maxBodyTravelSlip,
        maxCameraTravelError,
        maxYawRate,
        maxDemandRatio,
        maxAppliedDriveDemandRatio,
        maxDemandedDriveForceN,
        maxAppliedDriveForceN,
        maxRejectedDriveForceN,
        minAppliedToDemandedDriveForceRatio,
        minTractionControlCut,
        minShiftTorqueCut,
        maxDrivetrainUnload,
        maxGear,
        maxAutomaticOverrevUpshifts,
        minPostPeakTraction,
        maxProjectedAnchorLateralOffsetM,
        maxProjectedAnchorForwardOffsetM,
        maxProjectedCameraChaseYawError,
        minProjectedBodyChaseYawDelta,
        maxDrivenWheelLongitudinalUsage,
        maxDrivenWheelFrictionUsage,
        min3dFrictionCircle,
        minEffectiveFrictionMu,
        maxEffectiveFrictionMu
      };
    };
    return {
      stockDirtPartial: runCase({ surface: 'dirt', drivetrain: 'awd', powerHp: 271, torqueLbFt: 258, throttleAxis: 0.35 }),
      overpoweredDirtPartial: runCase({ surface: 'dirt', drivetrain: 'awd', powerHp: 1200, torqueLbFt: 1000, throttleAxis: 0.35 }),
      overpoweredDirtRwdFull: runCase({ surface: 'dirt', drivetrain: 'rwd', powerHp: 1200, torqueLbFt: 1000, throttleAxis: 1, startSpeedMps: 8, frames: 150 }),
      overpoweredDirtFwdFull: runCase({ surface: 'dirt', drivetrain: 'fwd', powerHp: 1200, torqueLbFt: 1000, throttleAxis: 1, startSpeedMps: 8, frames: 150 }),
      overpoweredGravelFull: runCase({ surface: 'gravel', drivetrain: 'rwd', powerHp: 1200, torqueLbFt: 1000, throttleAxis: 1 }),
      movingDirtAwdFull: runCase({
        surface: 'dirt',
        drivetrain: 'awd',
        powerHp: 1200,
        torqueLbFt: 1000,
        throttleAxis: 1,
        startSpeedMps: 30 * 0.44704,
        switchSteerFrame: 90,
        frames: 180
      }),
      projectedDirtAwdFull: runCase({
        surface: 'dirt',
        drivetrain: 'awd',
        powerHp: 1200,
        torqueLbFt: 1000,
        throttleAxis: 1,
        startSpeedMps: 8,
        frames: 150,
        sampleProjectedCamera: true
      })
    };
  });

  expect(result.stockDirtPartial.maxWheelSpin).toBeLessThan(0.08);
  expect(result.stockDirtPartial.maxDrivenWheelLongitudinalUsage).toBeLessThan(1.6);
  expect(result.overpoweredDirtPartial.speedMps).toBeGreaterThan(result.stockDirtPartial.speedMps * 1.5);
  expect(result.overpoweredDirtPartial.maxWheelSpin).toBeGreaterThan(1);
  expect(result.overpoweredDirtPartial.maxDemandRatio).toBeGreaterThan(result.stockDirtPartial.maxDemandRatio * 3);
  expect(result.overpoweredDirtPartial.maxRejectedDriveForceN).toBeGreaterThan(result.stockDirtPartial.maxRejectedDriveForceN + 5000);
  expect(result.overpoweredDirtPartial.minAppliedToDemandedDriveForceRatio).toBeLessThan(result.stockDirtPartial.minAppliedToDemandedDriveForceRatio * 0.7);
  expect(result.overpoweredDirtPartial.minPostPeakTraction).toBeLessThan(0.75);
  expect(result.overpoweredDirtPartial.maxBodyTravelSlip).toBeGreaterThan(0.25);
  expect(result.overpoweredDirtPartial.maxBodyTravelSlip).toBeGreaterThan(result.stockDirtPartial.maxBodyTravelSlip * 1.6);
  expect(result.overpoweredDirtPartial.maxCameraTravelError).toBeLessThan(0.28);
  expect(result.overpoweredDirtRwdFull.maxWheelSpin).toBeGreaterThan(1);
  expect(result.overpoweredDirtRwdFull.maxDemandRatio).toBeGreaterThan(result.movingDirtAwdFull.maxDemandRatio * 1.4);
  expect(result.overpoweredDirtRwdFull.maxRejectedDriveForceN).toBeGreaterThan(32000);
  expect(result.overpoweredDirtRwdFull.minAppliedToDemandedDriveForceRatio).toBeLessThan(0.28);
  expect(result.overpoweredDirtRwdFull.maxDrivenWheelLongitudinalUsage).toBeGreaterThan(1);
  expect(result.overpoweredDirtRwdFull.maxDrivenWheelFrictionUsage).toBeGreaterThan(1);
  expect(result.overpoweredDirtRwdFull.min3dFrictionCircle).toBeLessThan(0.75);
  expect(result.overpoweredDirtRwdFull.minPostPeakTraction).toBeLessThan(0.75);
  expect(result.overpoweredDirtRwdFull.maxCameraTravelError).toBeLessThan(0.28);
  expect(result.overpoweredDirtFwdFull.maxWheelSpin).toBeGreaterThan(1);
  expect(result.overpoweredDirtFwdFull.maxDemandRatio).toBeGreaterThan(result.movingDirtAwdFull.maxDemandRatio * 1.7);
  expect(result.overpoweredDirtFwdFull.maxRejectedDriveForceN).toBeGreaterThan(32000);
  expect(result.overpoweredDirtFwdFull.minAppliedToDemandedDriveForceRatio).toBeLessThan(0.28);
  expect(result.overpoweredDirtFwdFull.maxDrivenWheelLongitudinalUsage).toBeGreaterThan(1);
  expect(result.overpoweredDirtFwdFull.maxDrivenWheelFrictionUsage).toBeGreaterThan(1);
  expect(result.overpoweredDirtFwdFull.min3dFrictionCircle).toBeLessThan(0.75);
  expect(result.overpoweredDirtFwdFull.minPostPeakTraction).toBeLessThan(0.75);
  expect(result.overpoweredDirtFwdFull.maxCameraTravelError).toBeLessThan(0.28);
  expect(result.overpoweredGravelFull.maxWheelSpin).toBeGreaterThan(1);
  expect(result.overpoweredGravelFull.maxYawRate).toBeGreaterThan(0.2);
  expect(result.overpoweredGravelFull.speedMps).toBeLessThan(25);
  expect(result.overpoweredGravelFull.maxCameraTravelError).toBeLessThan(0.36);
  expect(result.movingDirtAwdFull.maxWheelSpin).toBeGreaterThan(0.7);
  expect(result.movingDirtAwdFull.maxBodyTravelSlip).toBeGreaterThan(0.25);
  expect(result.movingDirtAwdFull.maxCameraTravelError).toBeLessThan(0.26);
  expect(result.movingDirtAwdFull.maxCameraTravelError).toBeLessThan(result.movingDirtAwdFull.maxBodyTravelSlip * 0.35);
  expect(result.projectedDirtAwdFull.maxWheelSpin).toBeGreaterThan(1);
  expect(result.projectedDirtAwdFull.maxDemandRatio).toBeGreaterThan(5);
  expect(result.projectedDirtAwdFull.maxAppliedDriveDemandRatio).toBeGreaterThan(5);
  expect(result.projectedDirtAwdFull.maxDemandedDriveForceN).toBeGreaterThan(45000);
  expect(result.projectedDirtAwdFull.maxRejectedDriveForceN).toBeGreaterThan(35000);
  expect(result.projectedDirtAwdFull.minAppliedToDemandedDriveForceRatio).toBeLessThan(0.24);
  expect(result.projectedDirtAwdFull.minTractionControlCut).toBe(1);
  expect(result.projectedDirtAwdFull.minShiftTorqueCut).toBeGreaterThan(0);
  expect(result.projectedDirtAwdFull.minShiftTorqueCut).toBeLessThanOrEqual(1);
  expect(result.projectedDirtAwdFull.maxGear).toBeGreaterThanOrEqual(1);
  expect(result.projectedDirtAwdFull.maxAutomaticOverrevUpshifts).toBeGreaterThanOrEqual(0);
  expect(result.projectedDirtAwdFull.maxDrivetrainUnload).toBeGreaterThan(0.6);
  expect(result.projectedDirtAwdFull.maxBodyTravelSlip).toBeGreaterThan(0.25);
  expect(result.projectedDirtAwdFull.maxCameraTravelError).toBeLessThan(0.25);
  expect(result.projectedDirtAwdFull.min3dFrictionCircle).toBeLessThan(0.75);
  expect(result.projectedDirtAwdFull.maxEffectiveFrictionMu).toBeLessThan(1.3);
  expect(result.projectedDirtAwdFull.minEffectiveFrictionMu).toBeGreaterThan(0.28);
  expect(result.projectedDirtAwdFull.maxProjectedAnchorLateralOffsetM).toBeGreaterThan(0.15);
  expect(result.projectedDirtAwdFull.maxProjectedAnchorLateralOffsetM).toBeLessThan(1.85);
  expect(result.projectedDirtAwdFull.maxProjectedAnchorForwardOffsetM).toBeLessThan(1.5);
  expect(Number.isFinite(result.projectedDirtAwdFull.minProjectedBodyChaseYawDelta)).toBe(true);
  expect(result.projectedDirtAwdFull.maxProjectedCameraChaseYawError).toBeLessThan(0.08);
  expect(result.projectedDirtAwdFull.minProjectedBodyChaseYawDelta).toBeGreaterThan(0.15);
});

test('race third-person render uses live world position when body position is stale', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await waitForGameReady(page);

  const result = await page.evaluate(() => {
    const game = window.__game;
    game.enterRaceEditor();
    const editor = game.raceEditor;
    const bounds = { x: 0, y: 0, w: 640, h: 360 };
    editor.raceInput.cameraView = 'third-person';
    const preparedWorldBake = editor.buildRaceWorldBake(
      editor.getRacePlaytestWorldBakeOptions()
    );
    editor.startPlaytest(editor.selectedCar.id, {
      hydrateCars: false,
      preparedWorldBake
    });
    editor.playtestSession.startupFramePending = false;
    editor.playtestSession.countdownRemainingMs = 0;
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.projectedDistance = 120;
    editor.playtestSession.distance = 120;
    const livePose = editor.getRaceWorldPoseAtDistance(120);
    const stalePose = editor.getRaceWorldPoseAtDistance(30);
    const staleRight = editor.getRaceRightVector(stalePose.yaw);
    editor.playtestSession.worldX = livePose.x;
    editor.playtestSession.worldZ = livePose.z;
    editor.playtestSession.bodyX = stalePose.x + staleRight.x * 9;
    editor.playtestSession.bodyZ = stalePose.z + staleRight.z * 9;
    editor.playtestSession.carYaw = livePose.yaw;
    editor.playtestSession.velocityYaw = livePose.yaw;
    editor.playtestSession.cameraYaw = livePose.yaw;
    editor.playtestSession.vehicle3d = editor.playtestSession.vehicle3d || {};
    editor.playtestSession.vehicle3d.enabled = true;
    editor.playtestSession.vehicle3d.position = {
      ...(editor.playtestSession.vehicle3d.position || {}),
      x: stalePose.x,
      z: stalePose.z
    };
    editor.playtestSession.vehicle3d.wheels = {
      ...(editor.playtestSession.vehicle3d.wheels || {}),
      fl: {
        ...(editor.playtestSession.vehicle3d.wheels?.fl || {}),
        inContact: true,
        contactPoint: { x: stalePose.x + 1, y: 0, z: stalePose.z + 2 },
        normal: { x: 0, y: 1, z: 0 }
      }
    };
    const updateSession = editor.playtestSession;
    updateSession.launchLockMs = 0;
    updateSession.elapsedMs = 1000;
    updateSession.speedMps = 12;
    updateSession.velocityYaw = updateSession.startYaw;
    updateSession.carYaw = updateSession.startYaw;
    updateSession.bodyX = Number(updateSession.worldX || 0) - 8;
    updateSession.bodyZ = Number(updateSession.worldZ || 0) - 6;
    const staleBodyBeforeAuthority = { x: updateSession.bodyX, z: updateSession.bodyZ };
    updateSession.vehicle3d.position = {
      ...(updateSession.vehicle3d.position || {}),
      x: updateSession.bodyX,
      z: updateSession.bodyZ
    };
    updateSession.vehicle3d.wheels.fl = {
      ...(updateSession.vehicle3d.wheels?.fl || {}),
      inContact: true,
      contactPoint: { x: updateSession.bodyX + 1, y: 0, z: updateSession.bodyZ + 2 },
      normal: { x: 0, y: 1, z: 0 }
    };
    editor.raceInput.rawThrottleAxis = 0.35;
    editor.raceInput.throttleAxis = 0.35;
    editor.updatePlaytest(1 / 30);
    const updateWheelOffset = Math.hypot(
      Number(updateSession.vehicle3d.wheels.fl.contactPoint.x || 0) - Number(updateSession.vehicle3d.position.x || 0),
      Number(updateSession.vehicle3d.wheels.fl.contactPoint.z || 0) - Number(updateSession.vehicle3d.position.z || 0)
    );
    const canvas = document.createElement('canvas');
    canvas.width = bounds.w;
    canvas.height = bounds.h;
    const ctx = canvas.getContext('2d');
    editor.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud: false });
    const projectedLive = editor.projectRaceWorldPointToCamera({
      x: livePose.x,
      z: livePose.z,
      elevation: editor.getRaceStitchedTerrainElevationAtWorldPoint({ x: livePose.x, z: livePose.z }, Number(livePose.elevation || 0)),
      segment: livePose.segment
    }, editor.lastRaceRenderCamera.camera, editor.lastRaceRenderCamera.cameraYaw, bounds);
    const projectedStale = editor.projectRaceWorldPointToCamera({
      x: staleBodyBeforeAuthority.x,
      z: staleBodyBeforeAuthority.z,
      elevation: editor.getRaceStitchedTerrainElevationAtWorldPoint(staleBodyBeforeAuthority, Number(stalePose.elevation || 0)),
      segment: stalePose.segment
    }, editor.lastRaceRenderCamera.camera, editor.lastRaceRenderCamera.cameraYaw, bounds);
    let renderArgs = null;
    const originalProjectedCar = editor.drawRaceProjectedProceduralCar;
    const originalDebugOverlay = editor.drawRaceGeometricDebugOverlay;
    const originalBillboardLayers = editor.drawRaceCarBillboardLayers;
    try {
      editor.lastRaceRenderStats = {
        ...(editor.lastRaceRenderStats || {}),
        threeProceduralCar: false
      };
      editor.drawRaceProjectedProceduralCar = () => false;
      editor.drawRaceGeometricDebugOverlay = () => false;
      editor.drawRaceCarBillboardLayers = (_ctx, args) => {
        renderArgs = args;
      };
      editor.drawRaceThirdPersonCar(ctx, bounds);
    } finally {
      editor.drawRaceProjectedProceduralCar = originalProjectedCar;
      editor.drawRaceGeometricDebugOverlay = originalDebugOverlay;
      editor.drawRaceCarBillboardLayers = originalBillboardLayers;
    }
    return {
      rendered: Boolean(renderArgs),
      liveErrorPx: Math.abs(Number(renderArgs?.centerX || 0) - Number(projectedLive.screenX || 0)),
      staleErrorPx: Math.abs(Number(renderArgs?.centerX || 0) - Number(projectedStale.screenX || 0)),
      updateBodyWorldErrorM: Math.hypot(
        Number(updateSession.bodyX || 0) - Number(updateSession.worldX || 0),
        Number(updateSession.bodyZ || 0) - Number(updateSession.worldZ || 0)
      ),
      updateVehicleWorldErrorM: Math.hypot(
        Number(updateSession.vehicle3d.position.x || 0) - Number(updateSession.worldX || 0),
        Number(updateSession.vehicle3d.position.z || 0) - Number(updateSession.worldZ || 0)
      ),
      updateWheelOffsetM: updateWheelOffset,
      carWidthM: editor.getRaceCarWorldWidth()
    };
  });

  expect(result.rendered).toBe(true);
  expect(result.liveErrorPx).toBeLessThan(0.01);
  expect(result.staleErrorPx).toBeGreaterThan(4);
  expect(result.updateBodyWorldErrorM).toBeLessThan(0.000001);
  expect(result.updateVehicleWorldErrorM).toBeLessThan(0.000001);
  expect(result.updateWheelOffsetM).toBeLessThan(result.carWidthM * 1.6);
});
