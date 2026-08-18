import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VehicleDynamicsWorkerClient,
  createVehicleDynamicsWorkerQualificationFromReport,
  qualifyVehicleDynamicsWorkerMigration
} from '../../src/racing/simulation/VehicleDynamicsWorkerClient.js';
import {
  createVehicleRenderSnapshotBuffer,
  readVehicleRenderSnapshot,
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
  const provisionalReset = readVehicleRenderSnapshot(writeVehicleRenderSnapshot(
    createVehicleRenderSnapshotBuffer(), {
      resetGeneration: 7, stepIndex: 3, eventSequence: 7,
      simulationTimeSeconds: 3, position: { x: 4 }, orientation: { w: 1 },
      wheelPoses: {}, suspensionPose: {}
    }
  ));
  client.submitReset(resetBuffer, 7, 'player', provisionalReset);
  assert.equal(client.latestSnapshot.position.x, 4);
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
  assert.equal(client.latestSnapshot.position.x, 4,
    'in-flight pre-reset snapshots must not replace provisional reset geometry');
  worker.emit({
    type: 'resetApplied', vehicleId: 'player', resetSequence: 7, eventSequence: 10,
    resetGeneration: 7,
    buffer: writeVehicleRenderSnapshot(createVehicleRenderSnapshotBuffer(), {
      resetGeneration: 7,
      stepIndex: 4,
      eventSequence: 10,
      simulationTimeSeconds: 4,
      position: { x: 5 }, orientation: { w: 1 }, wheelPoses: {}, suspensionPose: {}
    })
  });
  assert.equal(client.latestSnapshot.position.x, 5);
  assert.equal(client.latestSnapshot.resetGeneration, 7);
  const settled = createVehicleRenderSnapshotBuffer();
  writeVehicleRenderSnapshot(settled, {
    stepIndex: 4,
    resetGeneration: 7,
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

test('client keeps bounded ordered history and reads latest-wins shared ring sequences', {
  skip: typeof SharedArrayBuffer !== 'function'
}, () => {
  const worker = new FakeWorker();
  const client = new VehicleDynamicsWorkerClient({
    worker, performanceQualification: qualified, now: () => 500
  });
  client.initialize({ vehicles: [{ id: 'player' }] });
  const initialization = worker.messages[0].message;
  const counters = new Int32Array(initialization.snapshotSequenceControl);
  for (let sequence = 1; sequence <= 12; sequence += 1) {
    const slot = sequence % initialization.snapshotBuffers.length;
    const buffer = initialization.snapshotBuffers[slot];
    Atomics.store(counters, slot, sequence * 2 - 1);
    writeVehicleRenderSnapshot(buffer, {
      stepIndex: sequence,
      simulationTimeSeconds: sequence / 120,
      position: { x: sequence, y: 0, z: 0 },
      orientation: { w: 1 }, wheelPoses: {}, suspensionPose: {}
    });
    Atomics.store(counters, slot, sequence * 2);
    worker.emit({
      type: 'snapshot', buffer, snapshotSlot: slot, snapshotSequence: sequence,
      overwrittenSnapshots: Math.max(0, sequence - initialization.snapshotBuffers.length),
      bufferStarvationCount: 0, workerStepMs: 1, backlogSteps: 0
    });
    if (sequence === 4) client.getInterpolatedSnapshot(3.5 / 120);
  }
  const history = client.snapshotsByVehicle.get('player');
  assert.equal(history.snapshots.length, 4);
  assert.deepEqual(history.snapshots.map(({ stepIndex }) => stepIndex), [9, 10, 11, 12]);
  assert.equal(client.latestSnapshot.position.x, 12);
  assert.equal(history.renderedSnapshot.position.x < history.snapshots[0].position.x, true);
  client.getInterpolatedSnapshot(11.5 / 120);
  const telemetry = client.getPresentationTelemetry();
  assert.equal(telemetry.latestWorkerSequence, 12);
  assert.equal(telemetry.displayedSequence >= 11, true);
  assert.equal(telemetry.bufferStarvationCount, 0);
});
