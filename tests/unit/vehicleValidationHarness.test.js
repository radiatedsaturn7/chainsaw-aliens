import assert from 'node:assert/strict';
import test from 'node:test';

import VehicleValidationHarness, {
  ManualShiftDriver
} from '../../tools/vehicle-validation/VehicleValidationHarness.mjs';
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
    'phase', 'speedMps', 'engineRpm', 'gear', 'requestedGear', 'shiftState',
    'longitudinalAccelerationMps2',
    'lateralAccelerationMps2', 'yawRateRadps', 'bodySlipRad', 'steeringAngleRad',
    'physicalRackAngleRad', 'wheelSteeringAnglesRad', 'assistState',
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
  assert.equal(result.traceFields.length, 21);
  assert.equal(result.recoveryCount, 0);
  assert.equal(result.backlogSteps, 0);
  assert.match(result.traceChecksum, /^[a-f0-9]{64}$/);
  assert.match(result.determinismChecksum, /^[a-f0-9]{64}$/);
});

test('harness self-validation: manual shift driver requests one adjacent gear per edge', () => {
  const driver = new ManualShiftDriver({ initialGear: 1, redlineRpm: 7000 });
  const state = (gear, rpm, remaining = 0, targetGear = gear) => ({
    engineRpm: rpm,
    gear,
    powertrainState: { engineRpm: rpm, gear, targetGear, shiftTimeRemainingSeconds: remaining }
  });
  assert.equal(driver.update(state(1, 6800), 0, 1), 2);
  assert.equal(driver.update(state(1, 6800, 0.1, 2), 0.1, 1), 2);
  assert.equal(driver.update(state(2, 5000), 0.3, 1), 2);
  assert.equal(driver.update(state(2, 6100), 0.4, 1), 2);
  assert.equal(driver.update(state(2, 6800), 0.5, 1), 3);
  assert.deepEqual(driver.events.map(({ from, to }) => ({ from, to })), [{ from: 1, to: 2 }]);
  assert.equal(driver.pending.to, 3);
});

test('harness self-validation: moving initial state has coherent low wheel slip and pressure', async () => {
  const harness = new VehicleValidationHarness({ maximumDurationSeconds: 0.35, trackLengthM: 100 });
  const result = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'step-steer', aidsEnabled: true
  });
  assert.ok(result.initialStateValidation.maximumInitialSlipRatio < 0.03);
  assert.equal(result.initialStateValidation.noPendingShift, true);
  assert.equal(result.initialStateValidation.coherentGeneration, true);
  for (const sample of result.trace) {
    for (const pressure of Object.values(sample.tirePressurePsi)) {
      assert.ok(Number.isFinite(pressure) && pressure >= 12 && pressure <= 70);
    }
  }
});

test('harness self-validation: analog lateral controls reach the physical rack and change sign', async () => {
  const harness = new VehicleValidationHarness({ maximumDurationSeconds: 2.2, trackLengthM: 160 });
  const step = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'step-steer', aidsEnabled: true
  });
  const slalom = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'slalom', aidsEnabled: true
  });
  const skidpad = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'constant-radius-skidpad', aidsEnabled: true
  });
  assert.ok(step.controlValidation.physicalRackMaximumRad > 0.001);
  assert.ok(skidpad.controlValidation.physicalRackMaximumRad > 0.001);
  assert.deepEqual(new Set(slalom.controlValidation.steeringSigns), new Set([-1, 1]));
});

test('harness self-validation: braking measurement starts at brake onset', async () => {
  const harness = new VehicleValidationHarness({ maximumDurationSeconds: 0.8, trackLengthM: 160 });
  const result = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'braking-70-0', aidsEnabled: true
  });
  assert.equal(result.measurement.measurementStartSeconds, 0);
  const firstMeasurement = result.trace.find((sample) => sample.phase === 'measurement');
  assert.equal(firstMeasurement.brakePressure, 1);
});

test('harness self-validation: missing required result is a failure and never baseline-only', async () => {
  const harness = new VehicleValidationHarness({ maximumDurationSeconds: 0.2, trackLengthM: 80 });
  const result = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'zero-to-60', aidsEnabled: true
  });
  assert.equal(result.values.zeroTo60Sec, null);
  assert.equal(result.checks.zeroTo60Sec.status, 'fail');
  assert.equal(Object.values(result.checks).some((check) => check.status === 'baseline-only'), false);
});

test('harness self-validation: configured assists are recorded and Simulation-off intervenes zero times', async () => {
  const harness = new VehicleValidationHarness({ maximumDurationSeconds: 0.6, trackLengthM: 100 });
  const aidsOn = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'step-steer', aidsEnabled: true
  });
  const aidsOff = await harness.runCase({
    vehicleKey: 'wrx-manual', caseName: 'step-steer', aidsEnabled: false
  });
  assert.equal(aidsOn.controlValidation.configuredAssistStateReached, true);
  assert.equal(aidsOff.controlValidation.configuredAssistStateReached, true);
  assert.equal(aidsOff.controlValidation.aidsOffInterventionCount, 0);
});

test('harness self-validation: authoritative case is render-partition deterministic at 30 60 and 144 FPS', async () => {
  const checksums = [];
  for (const renderFps of [30, 60, 144]) {
    const harness = new VehicleValidationHarness({
      renderFps, maximumDurationSeconds: 0.5, trackLengthM: 100
    });
    const result = await harness.runCase({
      vehicleKey: 'wrx-manual', caseName: 'zero-to-30', aidsEnabled: true
    });
    checksums.push(result.determinismChecksum);
  }
  assert.equal(new Set(checksums).size, 1);
});
