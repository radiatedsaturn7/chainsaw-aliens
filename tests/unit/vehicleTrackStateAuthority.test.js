import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkerTrackStateAuthority } from '../../src/racing/simulation/VehicleTrackStateAuthority.js';

function telemetry(stepIndex, x) {
  const patch = {
    contactPointWorld: { x, y: 0, z: 0 },
    normalLoadN: 3200,
    slipRatio: 0.2,
    slipAngleRad: 0.05,
    wheelAngularVelocityRadps: 35,
    effectiveRollingRadiusM: 0.33,
    longitudinalVelocityMps: 10,
    lateralVelocityMps: 0.5,
    longitudinalForceN: 900,
    lateralForceN: 500
  };
  return {
    stepIndex,
    state: {
      yawRad: 0,
      speedMps: 10,
      wheelLoadsN: { fl: 3200, fr: 3200, rl: 3200, rr: 3200 },
      wheelSlip: { fl: 0.2, fr: 0.2, rl: 0.2, rr: 0.2 },
      tireState: {},
      contactPatches: { fl: patch, fr: patch, rl: patch, rr: patch }
    }
  };
}

test('worker Track State owns deterministic tire mutation and checkpoint state', () => {
  const first = createWorkerTrackStateAuthority({
    options: { seed: 42, fixedStepMs: 100 },
    tireCompoundByWheel: { fl: 'sport', fr: 'sport', rl: 'sport', rr: 'sport' }
  });
  const vehicle = { id: 'player', runner: { state: {} } };
  let latest = null;
  for (let step = 1; step <= 24; step += 1) {
    latest = first.mutate({ vehicle, telemetry: telemetry(step, step * 0.1) });
  }
  assert.equal(latest.eventSequence > 0, true);
  assert.equal(first.trackState.stepIndex, 2);
  const snapshot = first.trackState.createSnapshot();
  const restored = createWorkerTrackStateAuthority({ snapshot });
  assert.equal(restored.trackState.getChecksum(), first.trackState.getChecksum());
  assert.equal(restored.trackState.nextSequence, first.trackState.nextSequence);
});

test('worker Track State applies live weather forcing at fixed-step boundaries', () => {
  const authority = createWorkerTrackStateAuthority({
    options: { seed: 7, fixedStepMs: 100 }
  });
  authority.updateWeatherForcing({
    type: 'rain',
    precipitationRateMmPerS: 1,
    ambientTemperatureC: 15,
    sunIntensity: 0,
    windIntensity: 0,
    windDirectionRad: 0,
    humidity: 1
  });
  const vehicle = { id: 'player', runner: { state: {} } };
  for (let step = 1; step <= 12; step += 1) {
    authority.mutate({ vehicle, telemetry: telemetry(step, 0.2) });
  }
  assert.equal(authority.trackState.stepIndex, 1);
  assert.equal(authority.trackState.getStoredWaterMm() > 0, true);
});

test('worker Track State publishes bounded revisioned visual deltas', () => {
  const authority = createWorkerTrackStateAuthority({
    options: { seed: 11, fixedStepMs: 100 }
  });
  const vehicle = { id: 'player', runner: { state: {} } };
  let visualDelta = null;
  for (let step = 1; step <= 24; step += 1) {
    visualDelta = authority.mutate({ vehicle, telemetry: telemetry(step, step * 0.1) })
      .visualDelta || visualDelta;
  }
  assert.ok(visualDelta);
  assert.equal(visualDelta.cells.length > 0, true);
  assert.equal(visualDelta.cells.length <= 192, true);
  assert.equal(visualDelta.stepIndex, authority.trackState.stepIndex);
  assert.equal(visualDelta.cellRevision > 0, true);
  assert.equal(visualDelta.cells.every((cell) => Number(cell.revision) > 0), true);
});
