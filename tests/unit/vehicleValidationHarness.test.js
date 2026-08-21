import assert from 'node:assert/strict';
import test from 'node:test';

import VehicleValidationHarness from '../../tools/vehicle-validation/VehicleValidationHarness.mjs';
import { validateAllTireCompoundCycles } from '../../tools/vehicle-validation/TireCompoundValidation.mjs';
import {
  TIRE_COMPOUND_VALIDATION_PROFILES,
  VEHICLE_ACCEPTANCE_TARGETS,
  VEHICLE_TRACE_FIELDS,
  VEHICLE_VALIDATION_CASES
} from '../../tools/vehicle-validation/validationCatalog.mjs';

test('vehicle validation catalog owns targets compounds and complete trace fields', () => {
  assert.equal(VEHICLE_VALIDATION_CASES.length, 16);
  assert.deepEqual(Object.keys(TIRE_COMPOUND_VALIDATION_PROFILES), [
    'roadStreet', 'roadPerformance', 'raceSoft', 'raceMedium', 'raceHard',
    'rain', 'gravel', 'snow'
  ]);
  for (const profile of Object.values(TIRE_COMPOUND_VALIDATION_PROFILES)) {
    for (const field of ['peakSlipRatio', 'peakSlipAngleDeg', 'slidingFrictionRatio',
      'temperatureC', 'temperatureFalloffPerC', 'wearRate', 'carcassStiffnessNPerM',
      'verticalStiffnessNPerM', 'relaxationLengthM', 'treadDepthMm', 'waterEvacuation']) {
      assert.notEqual(profile[field], undefined, field);
    }
  }
  for (const targets of Object.values(VEHICLE_ACCEPTANCE_TARGETS)) {
    for (const criterion of Object.values(targets)) {
      assert.equal(Array.isArray(criterion.range), true);
      assert.ok(criterion.category);
      assert.ok(criterion.source);
      assert.ok(criterion.uncertainty);
    }
  }
  assert.deepEqual(VEHICLE_TRACE_FIELDS, [
    'speedMps', 'engineRpm', 'gear', 'longitudinalAccelerationMps2',
    'lateralAccelerationMps2', 'yawRateRadps', 'bodySlipRad', 'steeringAngleRad',
    'wheelLoadsN', 'slipRatioByWheel', 'slipAngleByWheel', 'suspensionCompressionM',
    'brakePressure', 'tireTemperatureC', 'tirePressurePsi'
  ]);
});

test('exact compound lifecycle uses production thermal integration', () => {
  const cycles = validateAllTireCompoundCycles();
  assert.equal(cycles.length, 8);
  for (const cycle of cycles) {
    assert.deepEqual(cycle.phases, ['heating', 'peak-performance', 'degradation', 'cooling']);
    assert.equal(Object.values(cycle.checks).every(Boolean), true, cycle.name);
    assert.ok(cycle.trace.length > 4, cycle.name);
  }
});

test('exact WRX validation smoke uses the complete authoritative production path', async () => {
  const harness = new VehicleValidationHarness({ maximumDurationSeconds: 0.5, trackLengthM: 80 });
  const result = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'zero-to-30', aidsEnabled: true
  });
  assert.equal(result.authority, 'RaceEditor/RaceSimulation/VehicleDynamicsRunner');
  assert.deepEqual(result.productionPaths, [
    'PhysicsTerrainQueryFrame', 'ContactPatchTireModel', 'powertrain', 'compound-body-collision'
  ]);
  assert.ok(result.trace.length > 0);
  assert.equal(result.traceFields.length, 15);
  assert.equal(result.recoveryCount, 0);
  assert.equal(result.backlogSteps, 0);
  assert.match(result.traceChecksum, /^[a-f0-9]{64}$/);
  assert.match(result.determinismChecksum, /^[a-f0-9]{64}$/);
});
