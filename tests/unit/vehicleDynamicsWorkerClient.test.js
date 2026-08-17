import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VehicleDynamicsWorkerClient,
  createVehicleDynamicsWorkerQualificationFromReport,
  qualifyVehicleDynamicsWorkerMigration
} from '../../src/racing/simulation/VehicleDynamicsWorkerClient.js';
import {
  createVehicleRenderSnapshotBuffer,
  writeVehicleRenderSnapshot
} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';

class FakeWorker {
  constructor() {
    this.messages = [];
    this.listeners = new Set();
  }
  addEventListener(type, listener) { if (type === 'message') this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === 'message') this.listeners.delete(listener); }
  postMessage(message, transfers = []) { this.messages.push({ message, transfers }); }
  emit(data) { this.listeners.forEach((listener) => listener({ data })); }
  terminate() { this.terminated = true; }
}

const qualified = Object.freeze({
  achievedStepsPerSecond: 140,
  p95StepMs: 7,
  backlogStart: 0,
  backlogEnd: 0
});

test('worker migration gate rejects slow physics even when Worker is available', () => {
  assert.throws(() => new VehicleDynamicsWorkerClient({ worker: new FakeWorker() }),
    /performance gate failed/);
  const slow = qualifyVehicleDynamicsWorkerMigration({
    achievedStepsPerSecond: 119,
    p95StepMs: 9,
    backlogStart: 0,
    backlogEnd: 3
  });
  assert.equal(slow.qualified, false);
  assert.equal(slow.reasons.length, 3);
  assert.throws(() => new VehicleDynamicsWorkerClient({
    worker: new FakeWorker(), performanceQualification: slow
  }), /performance gate failed/);
  assert.equal(qualifyVehicleDynamicsWorkerMigration(qualified).qualified, true);
});

test('only a designated zero-backlog performance report can qualify migration', () => {
  const report = {
    environment: { designatedReferenceMachine: true },
    settings: { chassisHz: 120 },
    runs: [{
      fps: 60,
      finalStepIndex: 1440,
      peakBacklogSteps: 0,
      physicsUpdateMs: { p95: 8 },
      physicsStepMs: { p95: 6.5 },
      counters: { completedSteps: 1440 },
      timers: { raceSimulationVehicleAuthorityUpdate: { inclusiveTotalMs: 6000 } }
    }]
  };
  const qualified = createVehicleDynamicsWorkerQualificationFromReport(report);
  assert.equal(qualified.qualified, true);
  assert.equal(qualified.achievedStepsPerSecond, 240);
  assert.equal(qualified.p95StepMs, 6.5);
  const portable = createVehicleDynamicsWorkerQualificationFromReport({
    ...report,
    environment: { designatedReferenceMachine: false }
  });
  assert.equal(portable.qualified, false);
  assert.match(portable.reasons[0], /designated reference machine/);
  const estimatedOnly = createVehicleDynamicsWorkerQualificationFromReport({
    ...report,
    runs: [{ ...report.runs[0], physicsStepMs: undefined }]
  });
  assert.equal(estimatedOnly.qualified, false);
  assert.match(estimatedOnly.reasons[0], /measured fixed-step p95/);
});

test('client transfers compact inputs, keeps two snapshots, and recycles snapshot buffers', () => {
  const worker = new FakeWorker();
  let now = 100;
  const client = new VehicleDynamicsWorkerClient({
    worker,
    performanceQualification: qualified,
    now: () => now++
  });
  const input = new ArrayBuffer(16);
  client.submitInput(input, 4);
  assert.deepEqual(worker.messages[0].transfers, [input]);
  client.setVehicleActive('ai-1', false);
  assert.deepEqual(worker.messages[1].message, {
    type: 'setVehicleActive', vehicleId: 'ai-1', active: false
  });

  for (let stepIndex = 1; stepIndex <= 3; stepIndex += 1) {
    const buffer = createVehicleRenderSnapshotBuffer();
    writeVehicleRenderSnapshot(buffer, {
      stepIndex,
      simulationTimeSeconds: stepIndex,
      position: { x: stepIndex, y: 0, z: 0 },
      orientation: { w: 1 },
      wheelPoses: {},
      suspensionPose: {}
    });
    worker.emit({ type: 'snapshot', buffer, workerStepMs: stepIndex, backlogSteps: 0 });
  }
  assert.equal(client.previousSnapshot.stepIndex, 2);
  assert.equal(client.latestSnapshot.stepIndex, 3);
  assert.equal(client.getInterpolatedSnapshot(2.5).position.x, 2.5);
  assert.equal(worker.messages.filter(({ message }) => message.type === 'recycleSnapshotBuffer').length, 3);
  assert.equal(client.getMetrics().worker.samples, 3);

  const resetBuffer = new ArrayBuffer(48);
  client.submitReset(resetBuffer, 7);
  assert.equal(client.latestSnapshot, null);
  assert.equal(worker.messages.at(-1).message.type, 'resetVehicle');
  assert.deepEqual(worker.messages.at(-1).transfers, [resetBuffer]);
  const stale = createVehicleRenderSnapshotBuffer();
  writeVehicleRenderSnapshot(stale, {
    stepIndex: 4,
    eventSequence: 9,
    simulationTimeSeconds: 4,
    position: { x: 999 },
    orientation: { w: 1 },
    wheelPoses: {},
    suspensionPose: {}
  });
  worker.emit({ type: 'snapshot', buffer: stale, workerStepMs: 1, backlogSteps: 0 });
  assert.equal(client.latestSnapshot, null, 'in-flight pre-reset snapshots must be discarded');
  worker.emit({
    type: 'resetApplied', vehicleId: 'player', resetSequence: 7, eventSequence: 10
  });
  const settled = createVehicleRenderSnapshotBuffer();
  writeVehicleRenderSnapshot(settled, {
    stepIndex: 4,
    eventSequence: 10,
    simulationTimeSeconds: 4,
    position: { x: 5 },
    orientation: { w: 1 },
    wheelPoses: {},
    suspensionPose: {}
  });
  worker.emit({ type: 'snapshot', buffer: settled, workerStepMs: 1, backlogSteps: 0 });
  assert.equal(client.latestSnapshot.position.x, 5);
});
