import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VehicleDynamicsRunner,
  createVehicleDynamicsConfig,
  createVehicleDynamicsConfigFromTuning
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

function createRunner(postResetDiagnosticsEnabled, { grade = 0, bank = 0 } = {}) {
  const config = createVehicleDynamicsConfig({
    physicsQualityProfile: 'realtime',
    telemetryRetention: 'none',
    postResetDiagnosticsEnabled
  });
  const length = Math.hypot(bank, 1, grade);
  const sample = (point = {}) => ({
    valid: true,
    heightM: grade * Number(point.z || 0) + bank * Number(point.x || 0),
    normal: { x: -bank / length, y: 1 / length, z: -grade / length },
    surfaceId: 'asphalt', friction: 1, region: 'road', triangleId: 1
  });
  const environment = {
    airDensityKgM3: 0,
    requireValidTerrainEnvelope: true,
    sampleTerrainAtWorldPoint: sample,
    sampleTerrainAtWorldPoints: (points) => points.map(sample),
    sampleTerrainMaximumHeightInBounds: ({ minX, maxX, minZ, maxZ }) => (
      Math.max(grade * minZ + bank * minX, grade * minZ + bank * maxX,
        grade * maxZ + bank * minX, grade * maxZ + bank * maxX)
    )
  };
  return new VehicleDynamicsRunner({
    config,
    initialState: { position: { x: 0, y: config.cgHeightM + 0.08, z: 0 } },
    environmentProvider: () => environment
  });
}

function reset(runner) {
  return runner.resetAuthoritativeState({
    position: { x: 0, y: runner.config.cgHeightM + 0.08, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, gear: 1
  }, { parkUntilDrive: true });
}

test('post-reset diagnostics default off for production profiles and preserve explicit/legacy capture', () => {
  for (const physicsQualityProfile of ['realtime', 'high-fidelity']) {
    assert.equal(createVehicleDynamicsConfig({ physicsQualityProfile })
      .postResetDiagnosticsEnabled, false);
    assert.equal(createVehicleDynamicsConfig({
      physicsQualityProfile, physicsIncidentRecordingEnabled: true
    }).postResetDiagnosticsEnabled, true);
  }
  assert.equal(createVehicleDynamicsConfig({ physicsQualityProfile: 'diagnostic' })
    .postResetDiagnosticsEnabled, true);
  assert.equal(createVehicleDynamicsConfig({ telemetryRetention: 'none' })
    .postResetDiagnosticsEnabled, true, 'legacy custom validation keeps its diagnostics');
  assert.equal(createVehicleDynamicsConfig({
    physicsQualityProfile: 'diagnostic', postResetDiagnosticsEnabled: false
  }).postResetDiagnosticsEnabled, false, 'an explicit override wins');
  assert.equal(createVehicleDynamicsConfigFromTuning({}, {
    physicsQualityProfile: 'realtime', postResetDiagnosticsEnabled: true
  }).postResetDiagnosticsEnabled, true, 'the tuning adapter forwards explicit capture');

  const fresh = createRunner();
  fresh.advance(1 / 120);
  assert.equal(fresh.postResetTelemetryGeneration, 0);
  assert.equal(fresh.postResetTelemetry.length, 0);
  assert.equal(fresh.resetIncidentHistory.length, 0);
});

test('disabling reset diagnostics preserves all 610 parked/driving physical states and reset events', () => {
  const normal = createRunner();
  const capture = createRunner(true);
  assert.deepEqual(reset(normal), reset(capture));
  assert.equal(normal.postResetTelemetryGeneration, 1, 'this exercises a real reset');
  for (let step = 0; step < 610; step += 1) {
    const input = {
      throttle: step < 120 ? 0 : step < 480 ? 0.2 : 0,
      brake: step < 480 ? 0 : 0.15,
      requestedGear: 1
    };
    normal.advance(1 / 120, { input });
    capture.advance(1 / 120, { input });
    assert.deepEqual(normal.createStateSnapshot(), capture.createStateSnapshot(),
      `physical state at step ${step + 1}`);
  }
  assert.equal(normal.postResetTelemetry.length, 0);
  assert.equal(normal.resetIncidentHistory.length, 0);
  assert.equal(normal.diagnostics.latestResetIncident, undefined);
  assert.equal(normal.diagnostics.resetSymmetryIncident, undefined);
  assert.equal(capture.postResetTelemetry.length, 600, 'capture remains bounded');
  assert.equal(capture.resetIncidentHistory.length, 1);
  assert.equal(capture.resetIncidentHistory[0].first60FixedSteps, capture.postResetTelemetry);
  assert.deepEqual(normal.resetTimeline, capture.resetTimeline, 'replay reset events are gameplay data');
  assert.deepEqual(normal.terrainImpactHistory, capture.terrainImpactHistory);
  assert.equal(normal.diagnostics.completedSteps, 610);

  const retainedSamples = capture.postResetTelemetry;
  const retainedFirst = structuredClone(retainedSamples[0]);
  assert.deepEqual(reset(normal), reset(capture));
  normal.advance(1 / 120);
  capture.advance(1 / 120);
  assert.deepEqual(normal.createStateSnapshot(), capture.createStateSnapshot());
  assert.equal(normal.resetIncidentHistory.length, 0);
  assert.equal(capture.resetIncidentHistory.length, 2);
  assert.notEqual(capture.postResetTelemetry, retainedSamples);
  assert.deepEqual(retainedSamples[0], retainedFirst, 'captured history owns its samples');
});

test('diagnostic gating preserves grade/bank support and drive-away behavior', () => {
  const normal = createRunner(false, { grade: 0.08, bank: 0.04 });
  const capture = createRunner(true, { grade: 0.08, bank: 0.04 });
  assert.deepEqual(reset(normal), reset(capture));
  for (let step = 0; step < 180; step += 1) {
    const input = { throttle: step < 60 ? 0 : 0.3, requestedGear: 1 };
    normal.advance(1 / 120, { input });
    capture.advance(1 / 120, { input });
    assert.deepEqual(normal.createStateSnapshot(), capture.createStateSnapshot());
  }
  assert.equal(normal.postResetTelemetry.length, 0);
  assert.equal(capture.postResetTelemetry.length, 180);
  assert.equal(normal.stationaryResetHold, null, 'the normal throttle wake still runs');
});
