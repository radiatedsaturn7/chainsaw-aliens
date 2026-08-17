import assert from 'node:assert/strict';
import test from 'node:test';

import { PhysicsCostAccounting } from '../../src/racing/simulation/PhysicsCostAccounting.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

test('physics cost accounting records nested inclusive and exclusive frame and step cost', () => {
  let nowMs = 0;
  const costs = new PhysicsCostAccounting({ now: () => nowMs });
  assert.equal(costs.beginFrame({ renderFps: 60 }), true);
  assert.equal(costs.beginStep({ stepIndex: 1 }), true);
  const outer = costs.start('environmentProvider');
  nowMs = 5;
  const child = costs.start('raceSurfaceModelProjection');
  nowMs = 8;
  costs.end(child);
  nowMs = 10;
  costs.end(outer);
  costs.count('physicsGeometryPointsQueried', 4);
  costs.count('completedSteps');
  costs.count('completedTireSubsteps', 3);
  nowMs = 11;
  const step = costs.finishStep();
  nowMs = 12;
  const frame = costs.finishFrame({ backlogSteps: 2 });

  assert.deepEqual(step.timings.environmentProvider, {
    inclusiveMs: 10,
    exclusiveMs: 7,
    calls: 1
  });
  assert.deepEqual(frame.timings.raceSurfaceModelProjection, {
    inclusiveMs: 3,
    exclusiveMs: 3,
    calls: 1
  });
  assert.equal(step.counters.physicsGeometryPointsQueried, 4);
  assert.equal(frame.counters.completedTireSubsteps, 3);
  assert.equal(costs.getSummary().backlog.peak, 2);
});

test('physics cost accounting reports frame percentiles, expensive systems, CCD, and recovery', () => {
  let nowMs = 0;
  const costs = new PhysicsCostAccounting({ now: () => nowMs });
  [2, 4, 10, 20].forEach((durationMs, index) => {
    costs.beginFrame({ renderFps: 60 });
    const update = costs.start('raceSimulationVehicleAuthorityUpdate');
    const subsystem = costs.start(index % 2 ? 'bodyContinuousSweep' : 'environmentProvider');
    nowMs += durationMs * 0.75;
    costs.end(subsystem);
    nowMs += durationMs * 0.25;
    costs.end(update);
    costs.count('completedTireSubsteps', 3);
    costs.count('bodyCcdActivations', index === 3 ? 1 : 0);
    costs.count('staticColliderCcdActivations', index >= 2 ? 1 : 0);
    costs.count('staticColliderCandidates', index + 1);
    costs.count('staticColliderNarrowphaseTests', (index + 1) * 2);
    costs.finishFrame({ backlogSteps: index });
  });
  costs.noteRecovery('deep-body-penetration');
  const summary = costs.getSummary();
  assert.equal(summary.physicsUpdateMs.p50, 4);
  assert.equal(summary.physicsUpdateMs.p95, 20);
  assert.equal(summary.physicsUpdateMs.p99, 20);
  assert.equal(summary.backlog.current, 3);
  assert.equal(summary.backlog.peak, 3);
  assert.equal(summary.expensiveSubsystems.length, 2);
  assert.equal(summary.ccdActivationRates.body, 1 / 12);
  assert.equal(summary.ccdActivationRates.static, 2 / 12);
  assert.equal(summary.latestCounters.staticColliderCandidates, 4);
  assert.equal(summary.latestCounters.staticColliderNarrowphaseTests, 8);
  assert.deepEqual(summary.recovery, {
    count: 1,
    lastReason: 'deep-body-penetration'
  });
});

test('enabling wall-clock accounting cannot change authoritative vehicle state', () => {
  const createRunner = (enabled) => new VehicleDynamicsRunner({
    config: {
      chassisHz: 120,
      tireHz: 360,
      telemetryRetention: 'none',
      physicsCostAccountingEnabled: enabled
    },
    inputTimeline: [{
      timeSeconds: 0,
      input: { throttle: 0.45, steering: 0.15, requestedGear: 1 }
    }],
    environmentProvider: () => ({
      airDensityKgM3: 0,
      grounded: false
    })
  });
  const disabled = createRunner(false);
  const enabled = createRunner(true);
  for (let frame = 0; frame < 60; frame += 1) {
    disabled.advance(1 / 60);
    enabled.advance(1 / 60);
  }
  assert.deepEqual(enabled.createStateSnapshot(), disabled.createStateSnapshot());
  assert.equal(disabled.physicsCostAccounting.frameHistory.length, 0);
  assert.equal(enabled.physicsCostAccounting.frameHistory.length, 60);
});

test('fixed-step accounting records the backlog remaining at each step boundary', () => {
  const runner = new VehicleDynamicsRunner({
    config: {
      chassisHz: 120,
      tireHz: 120,
      maxCatchUpSteps: 8,
      telemetryRetention: 'none',
      physicsCostAccountingEnabled: true
    },
    environmentProvider: () => ({ airDensityKgM3: 0, grounded: false })
  });
  const advance = runner.advance(4 / 120);
  assert.equal(advance.completedSteps, 4);
  assert.deepEqual(runner.physicsCostAccounting.stepHistory.map(
    (step) => step.counters.backlogSteps
  ), [3, 2, 1, 0]);
  assert.equal(runner.physicsCostAccounting.getLatestFrame().counters.backlogSteps, 0);
});

test('lightweight fixed-step records retain elapsed time and backlog without duplicating frame detail', () => {
  let nowMs = 0;
  const costs = new PhysicsCostAccounting({
    now: () => nowMs,
    detailedStepRecords: false
  });
  costs.beginFrame();
  costs.beginStep({ stepIndex: 1 });
  const timer = costs.start('environmentProvider');
  nowMs = 5;
  costs.end(timer);
  costs.count('physicsGeometryPointsQueried', 12);
  costs.count('backlogSteps', 2);
  const step = costs.finishStep();
  const frame = costs.finishFrame();
  assert.equal(step.elapsedMs, 5);
  assert.deepEqual(step.timings, {});
  assert.deepEqual(step.counters, { backlogSteps: 2 });
  assert.equal(frame.timings.environmentProvider.inclusiveMs, 5);
  assert.equal(frame.counters.physicsGeometryPointsQueried, 12);
});

test('elapsed-ring step accounting preserves chronological samples without retaining records', () => {
  let nowMs = 0;
  const costs = new PhysicsCostAccounting({
    now: () => nowMs,
    detailedStepRecords: false,
    stepHistoryLimit: 120
  });
  costs.stepHistoryMode = 'elapsed-ring';
  for (let index = 0; index < 125; index += 1) {
    costs.beginStep({ stepIndex: index });
    nowMs += index + 1;
    costs.finishStep({ backlogSteps: 0 });
  }
  assert.equal(costs.stepHistory.length, 0);
  assert.deepEqual(
    costs.appendStepElapsedHistory([]),
    Array.from({ length: 120 }, (_, index) => index + 6)
  );
  assert.equal(costs.getLatestStep().elapsedMs, 125);
  costs.reset();
  assert.deepEqual(costs.appendStepElapsedHistory([]), []);
});

test('bounded diagnostic histories recycle evicted records without retaining stale values', () => {
  let nowMs = 0;
  const costs = new PhysicsCostAccounting({
    now: () => nowMs,
    frameHistoryLimit: 30,
    stepHistoryLimit: 120
  });
  let firstFrame = null;
  for (let index = 0; index < 32; index += 1) {
    costs.beginFrame({ frameIndex: index });
    if (index === 0) {
      costs.count('physicsGeometryPointsQueried', 7);
      firstFrame = costs.currentFrame;
    }
    nowMs += 1;
    costs.finishFrame();
  }
  assert.equal(costs.frameHistory.length, 30);
  assert.equal(costs.frameHistory.at(-1), firstFrame);
  assert.equal(firstFrame.metadata.frameIndex, 31);
  assert.deepEqual(firstFrame.counters, { backlogSteps: 0 });
});
