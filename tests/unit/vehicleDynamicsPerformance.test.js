import assert from 'node:assert/strict';
import test from 'node:test';

import RaceEditor from '../../src/ui/RaceEditor.js';
import {
  VehicleDynamicsRunner
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const HEIGHTS = Object.freeze({ fl: 0, fr: 0, rl: 0, rr: 0 });

test('runtime telemetry policies avoid retained snapshots while preserving fixed-step callbacks', () => {
  let transientCallbacks = 0;
  const transient = new VehicleDynamicsRunner({
    config: { chassisHz: 120, tireHz: 360, telemetryRetention: 'transient' },
    initialState: { heightM: 0.55 },
    environmentProvider: () => ({ surfaceHeightByWheel: HEIGHTS })
  });
  transient.advance(1 / 30, { onFixedStep: () => { transientCallbacks += 1; } });
  assert.equal(transientCallbacks, 4);
  assert.equal(transient.telemetry.length, 0);
  assert.equal(transient.performanceDiagnostics.environmentQueries, 12);
  assert.equal(transient.performanceDiagnostics.retainedTelemetrySnapshots, 0);

  let noneCallbacks = 0;
  const none = new VehicleDynamicsRunner({
    config: { chassisHz: 120, tireHz: 120, telemetryRetention: 'none' },
    initialState: { heightM: 0.55 },
    environmentProvider: () => ({ surfaceHeightByWheel: HEIGHTS })
  });
  none.advance(1 / 30, { onFixedStep: () => { noneCallbacks += 1; } });
  assert.equal(noneCallbacks, 0);
  assert.equal(none.telemetry.length, 0);
  assert.equal(none.performanceDiagnostics.environmentQueries, 4);
  assert.equal(none.performanceDiagnostics.retainedTelemetrySnapshots, 0);
});

test('history remains the replay-safe default and latest retains exactly one owned sample', () => {
  const history = new VehicleDynamicsRunner({
    config: { chassisHz: 120, tireHz: 120, telemetryLimit: 8 },
    environmentProvider: () => ({ surfaceHeightByWheel: HEIGHTS })
  });
  history.advance(3 / 120);
  assert.equal(history.config.telemetryRetention, 'history');
  assert.equal(history.telemetry.length, 3);
  assert.equal(history.performanceDiagnostics.retainedTelemetrySnapshots, 3);

  const latest = new VehicleDynamicsRunner({
    config: { chassisHz: 120, tireHz: 120, telemetryRetention: 'latest' },
    environmentProvider: () => ({ surfaceHeightByWheel: HEIGHTS })
  });
  latest.advance(3 / 120);
  assert.equal(latest.telemetry.length, 1);
  assert.equal(latest.telemetry[0].stepIndex, 3);
});

test('realtime single-player builds one shared geometry frame per chassis step', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: {
      getGamepadAxes: () => ({ leftX: 0, rightTrigger: 0.4, leftTrigger: 0, rightX: 0 }),
      isGamepadConnected: () => true
    },
    exitRaceEditor() {}
  });
  editor.selectedRace.hazards = [];
  editor.startPlaytest(editor.selectedCar.id);
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.raceInput.rawThrottleAxis = 0.4;
  editor.raceInput.throttleAxis = 0.4;
  editor.updatePlaytest(1 / 60);
  const surface = editor.getRaceSurfaceModel();
  surface.performanceDiagnostics.fullSurfaceQueries = 0;
  surface.performanceDiagnostics.geometryQueries = 0;
  surface.performanceDiagnostics.rawTerrainQueries = 0;
  const runner = editor.playtestSession.vehicleDynamicsRunner;
  const terrainFrame = editor.vehicleDynamicsAuthority.terrainQueryFrameCache.frame;
  const frameSequenceBefore = terrainFrame.sequence;
  runner.performanceDiagnostics.environmentQueries = 0;
  runner.performanceDiagnostics.bodyBroadphaseRejectedSubsteps = 0;
  runner.performanceDiagnostics.bodyNarrowphaseSubsteps = 0;

  editor.updatePlaytest(1 / 60);

  assert.equal(runner.config.physicsQualityProfile, 'realtime');
  assert.equal(runner.config.chassisHz, 120);
  assert.equal(runner.config.tireHz, 120);
  assert.equal(runner.config.geometryHz, 120);
  assert.equal(runner.performanceDiagnostics.environmentQueries, 2);
  assert.equal(terrainFrame.sequence - frameSequenceBefore, 2);
  assert.equal(runner.performanceDiagnostics.bodyBroadphaseRejectedSubsteps, 2);
  assert.equal(runner.performanceDiagnostics.bodyNarrowphaseSubsteps, 0);
  assert.equal(surface.performanceDiagnostics.geometryQueries, 0,
    'footprint and body geometry must use the prepared query frame directly');
  assert.equal(surface.performanceDiagnostics.fullSurfaceQueries <= 8, true,
    'only four wheel regions per chassis boundary may request material classification');
  assert.equal(surface.performanceDiagnostics.rawTerrainQueries <= 8, true);
  assert.equal(terrainFrame.statistics.batchQueries, 2,
    'wheel centres and footprint points are the only steady-state geometry batches');
  assert.equal(terrainFrame.statistics.pointQueries <= 40, true,
    'clear-body penetration validation must stay deferred');
  assert.equal(terrainFrame.statistics.trianglesVisited < 500, true,
    'fine-grid sampling must not fall back to a complete baked bucket');
});

test('high-fidelity tire substeps reuse 120 Hz geometry unless contact leaves its frame', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: {
      getGamepadAxes: () => ({ leftX: 0, rightTrigger: 0.4, leftTrigger: 0, rightX: 0 }),
      isGamepadConnected: () => true
    },
    exitRaceEditor() {}
  });
  editor.selectedRace.hazards = [];
  editor.startPlaytest(editor.selectedCar.id);
  editor.playtestSession.physicsQualityProfile = 'high-fidelity';
  editor.playtestSession.physicsPerformanceVisible = true;
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.raceInput.rawThrottleAxis = 0.4;
  editor.raceInput.throttleAxis = 0.4;
  editor.updatePlaytest(1 / 60);

  const runner = editor.playtestSession.vehicleDynamicsRunner;
  const cost = runner.physicsCostAccounting;
  editor.updatePlaytest(1 / 60);
  const frame = cost.getLatestFrame();
  const count = (name) => Number(frame?.counters?.[name] || 0);

  assert.equal(runner.config.physicsQualityProfile, 'high-fidelity');
  assert.equal(runner.config.chassisHz, 120);
  assert.equal(runner.config.tireHz, 360);
  assert.equal(runner.config.geometryHz, 120);
  assert.equal(count('completedSteps'), 2);
  assert.equal(count('completedTireSubsteps'), 6);
  assert.equal(
    count('chassisGeometryFrames'),
    count('completedSteps') + count('tireSubstepGeometryRefreshes'),
    'only the chassis boundary and explicit event refreshes may build geometry'
  );
  assert.equal(
    count('tireSubstepGeometryReuses') + count('tireSubstepGeometryRefreshes'),
    count('completedTireSubsteps') - count('completedSteps'),
    'every intermediate tire substep must either reuse geometry or record its refresh'
  );
  assert.equal(count('tireSubstepGeometryReuses') >= 3, true,
    'steady high-fidelity contact must reuse geometry for most intermediate substeps');
  assert.equal(count('recoveryRecalculations'), 0);
});

test('a 250 ms race hitch preserves backlog while bounding each render-frame catch-up', () => {
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { getGamepadAxes: () => ({}), isGamepadConnected: () => false },
    exitRaceEditor() {}
  });
  editor.startPlaytest(editor.selectedCar.id);
  editor.playtestSession.launchLockMs = 0;
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.elapsedMs = 1000;
  editor.updatePlaytest(1 / 60);
  const runner = editor.playtestSession.vehicleDynamicsRunner;

  const hitch = runner.advance(0.25);
  assert.equal(runner.config.maxCatchUpSteps, 8);
  assert.equal(hitch.completedSteps, 8);
  assert.equal(hitch.backlogSteps >= 22, true);
  const followingFrame = runner.advance(1 / 60);
  assert.equal(followingFrame.completedSteps, 8);
  assert.equal(followingFrame.backlogSteps < hitch.backlogSteps, true);
  assert.equal(Number.isFinite(followingFrame.advanceWallTimeMs), true);
});

test('geometry-only surface queries exactly match authoritative geometry', () => {
  const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, input: {}, exitRaceEditor() {} });
  editor.selectedRace.hazards = [];
  editor.startPlaytest(editor.selectedCar.id);
  const surface = editor.getRaceSurfaceModel();
  const context = surface.createPhysicsQueryContext({
    runtimeType: editor.playtestSession.routeRuntimeType
  });
  for (let distance = 0; distance <= Math.min(240, editor.getRaceRouteLength()); distance += 12) {
    const pose = editor.getRaceWorldPoseAtDistance(distance);
    const right = editor.getRaceRightVector(pose.yaw);
    [-7, -3, 0, 3, 7].forEach((lateral) => {
      const point = {
        x: pose.x + right.x * lateral,
        z: pose.z + right.z * lateral
      };
      const authoritative = surface.sampleWorld(point, 0, context);
      const geometry = surface.samplePhysicsGeometry(point, context);
      assert.equal(geometry.elevation, authoritative.elevation);
      assert.deepEqual(geometry.normal, authoritative.normal);
      assert.equal(geometry.region, authoritative.region);
      assert.equal(geometry.friction, authoritative.friction);
    });
  }
});
