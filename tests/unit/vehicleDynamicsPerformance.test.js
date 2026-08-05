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

test('single-player fixed steps use geometry-only footprints and reject clear body manifolds', () => {
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
  const originalGeometryBatch = surface.samplePhysicsGeometryBatch.bind(surface);
  const geometryBatchSizes = [];
  surface.samplePhysicsGeometryBatch = (points, context) => {
    geometryBatchSizes.push(points.length);
    return originalGeometryBatch(points, context);
  };
  const runner = editor.playtestSession.vehicleDynamicsRunner;
  runner.performanceDiagnostics.environmentQueries = 0;
  runner.performanceDiagnostics.bodyBroadphaseRejectedSubsteps = 0;
  runner.performanceDiagnostics.bodyNarrowphaseSubsteps = 0;

  editor.updatePlaytest(1 / 60);

  assert.equal(runner.performanceDiagnostics.environmentQueries, 6);
  assert.equal(runner.performanceDiagnostics.bodyBroadphaseRejectedSubsteps, 6);
  assert.equal(runner.performanceDiagnostics.bodyNarrowphaseSubsteps, 0);
  assert.equal(surface.performanceDiagnostics.geometryQueries >= 96, true);
  assert.equal(surface.performanceDiagnostics.fullSurfaceQueries < 40, true);
  assert.equal(surface.performanceDiagnostics.rawTerrainQueries < 40, true);
  assert.equal(geometryBatchSizes.filter((size) => size >= 20).length, 6,
    'each contact substep shares its four wheel centers with one footprint batch');
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
