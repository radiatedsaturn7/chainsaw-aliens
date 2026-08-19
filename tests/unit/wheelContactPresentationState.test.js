import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWheelContactPresentationState,
  updateWheelContactPresentationState
} from '../../src/racing/simulation/WheelContactPresentationState.js';
import { aggregateTireResults } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const renderState = (wheel = {}) => ({
  wheels: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((id) => [id, {
    validTreadContact: false,
    geometricContact: false,
    normalLoadN: 0,
    terrainDataAvailable: true,
    ...wheel
  }]))
});

test('wheel contact presentation holds numerical chatter but exits real takeoff immediately', () => {
  const state = createWheelContactPresentationState();
  const authoritativeChecksumInput = JSON.stringify(renderState());
  updateWheelContactPresentationState(state, {
    stepIndex: 1,
    renderState: renderState({ validTreadContact: true, geometricContact: true, normalLoadN: 900 }),
    wheelContactTelemetryByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((id) => [id, {
      validContactSubstepCount: 2,
      geometricProximitySubstepCount: 3,
      normalLoadN: { maximum: 1200 },
      finalValidContact: true
    }]))
  });
  assert.equal(state.wheels.fl.supported, true);
  updateWheelContactPresentationState(state, {
    stepIndex: 2,
    renderState: renderState({ geometricContact: true }),
    wheelContactTelemetryByWheel: { fl: {
      validContactSubstepCount: 0,
      geometricProximitySubstepCount: 3,
      normalLoadN: { maximum: 0 },
      finalValidContact: false,
      finalInvalidReason: null
    } }
  });
  assert.equal(state.wheels.fl.supported, true);
  assert.equal(state.wheels.fl.reason, 'geometric-chatter-hold');
  updateWheelContactPresentationState(state, {
    stepIndex: 3,
    renderState: renderState(),
    wheelContactTelemetryByWheel: { fl: {
      validContactSubstepCount: 0,
      geometricProximitySubstepCount: 0,
      normalLoadN: { maximum: 0 },
      finalValidContact: false,
      finalInvalidReason: 'airborne'
    } }
  });
  assert.equal(state.wheels.fl.supported, false);
  assert.equal(JSON.stringify(renderState()), authoritativeChecksumInput,
    'presentation state must not mutate authoritative/render input');
});

test('chassis telemetry aggregates every tire contact substep', () => {
  const result = (valid, load, triangleId, fraction, compression, normal) => ({
    contactPatches: { fl: {
      validTreadContact: valid,
      geometricContact: true,
      normalLoadN: load,
      terrainTriangleId: triangleId,
      surfaceNormalWorld: normal,
      rawRequestedCompressionM: compression,
      supportedFraction: fraction
    } },
    suspensionState: { fl: { compressionM: compression } },
    wheelLoadsN: { fl: load }
  });
  const aggregate = aggregateTireResults([
    result(true, 100, 10, 0.75, 0.04, { x: 0, y: 1, z: 0 }),
    result(false, 0, 11, 0.5, 0.0399, { x: 0.001, y: 0.9999995, z: 0 }),
    result(true, 200, 11, 1, 0.0401, { x: 0, y: 1, z: 0 })
  ], 1 / 360);
  const telemetry = aggregate.wheelContactTelemetryByWheel.fl;
  assert.equal(telemetry.validContactSubstepCount, 2);
  assert.equal(telemetry.geometricProximitySubstepCount, 3);
  assert.deepEqual(telemetry.normalLoadN, { minimum: 0, maximum: 200, average: 100 });
  assert.equal(telemetry.firstValidContact, true);
  assert.equal(telemetry.finalValidContact, true);
  assert.equal(telemetry.contactTransitionCount, 2);
  assert.deepEqual(telemetry.triangleIds, ['10', '11']);
  assert.deepEqual(telemetry.footprintSupportedFractionRange, { minimum: 0.5, maximum: 1 });
  assert.deepEqual(telemetry.rawRequestedCompressionRangeM,
    { minimum: 0.0399, maximum: 0.0401 });
  assert.deepEqual(telemetry.actualCompressionRangeM,
    { minimum: 0.0399, maximum: 0.0401 });
});
