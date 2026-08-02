import assert from 'node:assert/strict';
import test from 'node:test';

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
