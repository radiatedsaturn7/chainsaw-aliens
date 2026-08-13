import assert from 'node:assert/strict';
import test from 'node:test';

import RaceEditor from '../../src/ui/RaceEditor.js';

test('Race debug menu toggles the Physics Performance overlay independently', () => {
  const editor = Object.create(RaceEditor.prototype);
  editor.raceInput = {
    pauseMenuMode: 'debug',
    pauseMenuIndex: 0,
    physicsSurfaceVisible: false,
    physicsPerformanceVisible: false,
    debugHudVisible: false
  };
  editor.playtestSession = {
    physicsSurfaceVisible: false,
    physicsPerformanceVisible: false
  };
  const rows = editor.getRacePauseMenuRows();
  const performance = rows.find((row) => row.id === 'race-toggle-physics-performance');
  assert.ok(performance);
  assert.equal(performance.value, 'Off');
  performance.onClick();
  assert.equal(editor.raceInput.physicsPerformanceVisible, true);
  assert.equal(editor.playtestSession.physicsPerformanceVisible, true);
  assert.equal(editor.raceInput.physicsSurfaceVisible, false);
});

test('Physics Performance HUD exposes frame percentiles, queries, CCD, and top costs', () => {
  const editor = Object.create(RaceEditor.prototype);
  const labels = [];
  editor.playtestFps = 59.8;
  editor.playtestSession = {
    physicsPerformance: {
      physicsUpdateMs: { current: 8.1, p50: 5.2, p95: 11.4, p99: 18.6 },
      vehicleDynamicsWorker: {
        worker: { p50: 1.1, p95: 2.2, p99: 3.3 },
        render: { p50: 0.2, p95: 0.4, p99: 0.8 }
      },
      backlog: { current: 2, peak: 5 },
      latestCounters: {
        completedSteps: 2,
        physicsGeometryPointsQueried: 40,
        routeProjections: 36,
        bakedTriangleBucketLookups: 42,
        preparedTrianglesVisited: 120,
        bodySupportFeatures: 12,
        adaptiveBodySupportFeatures: 3,
        bodySweepSlices: 2,
        binarySearchIterations: 4,
        activeWheelCylinders: 1,
        wheelCylinderActivationPoints: 8,
        wheelCylinderFeatures: 36,
        triangleIntersectionTests: 72,
        heightfieldSweepSamples: 64,
        environmentProviderCalls: 6,
        staticColliderCandidates: 5,
        staticColliderNarrowphaseTests: 19,
        staticColliderManifoldContacts: 2,
        recoveryRecalculations: 1,
        temporaryObjects: 18
      },
      ccdActivationRates: { body: 0.1, wheel: 0.25, static: 0.5 },
      recovery: { count: 1, lastReason: 'invalid-terrain' },
      expensiveSubsystems: [{
        name: 'wheelCylinderHeightSweep',
        inclusiveMs: 4.25,
        exclusiveMs: 3.5
      }]
    }
  };
  const ctx = {
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    fillText(label) { labels.push(label); }
  };
  editor.drawRacePhysicsPerformanceOverlay(ctx, { x: 0, y: 0, w: 800, h: 500 });
  assert.ok(labels.includes('PHYSICS PERFORMANCE'));
  assert.ok(labels.some((label) => label.includes('p50 5.20')));
  assert.ok(labels.some((label) => label.includes('WORKER p50 1.10 p95 2.20 p99 3.30')));
  assert.ok(labels.some((label) => label.includes('RENDER p50 0.20 p95 0.40 p99 0.80')));
  assert.ok(labels.some((label) => label.includes('QUERY geo 40 route 36')));
  assert.ok(labels.some((label) => label.includes('STATIC cand 5 narrow 19 contacts 2')));
  assert.ok(labels.some((label) => label.includes('rate B10.0% W25.0% S50.0%')));
  assert.ok(labels.some((label) => label.includes('Wheel height CCD 4.25i/3.50e')));
});
