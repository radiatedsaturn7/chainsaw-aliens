import assert from 'node:assert/strict';
import test from 'node:test';
import { Worker } from 'node:worker_threads';

import {
  buildRaceBakedSurfaceSampler,
  packRaceBakedSurfaceSampler
} from '../../src/racing/RaceBakedSurfaceSampler.js';
import { getPackedRaceWorkerEnvironmentTransferables } from '../../src/racing/simulation/PackedRaceWorkerEnvironment.js';
import {
  VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
  createVehicleControlInputBuffer,
  readVehicleRenderSnapshot
} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] || 0;
}

test('collision-heavy worker physics leaves the render event loop responsive with no growing backlog', async () => {
  const sampler = packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({
    mesh: { triangles: [
      { region: 'road', vertices: [
        { x: -100, y: -100, elevation: 0 }, { x: 100, y: -100, elevation: 0 }, { x: 100, y: 100, elevation: 0 }
      ] },
      { region: 'road', vertices: [
        { x: -100, y: -100, elevation: 0 }, { x: 100, y: 100, elevation: 0 }, { x: -100, y: 100, elevation: 0 }
      ] }
    ] }
  }));
  const staticColliderDefinitions = Array.from({ length: 80 }, (_, index) => ({
    id: `collision-wall-${index}`,
    type: 'box',
    center: { x: 1.2 + (index % 4) * 0.4, y: 0.8, z: -20 + index * 0.5 },
    size: { x: 0.3, y: 1.6, z: 0.3 },
    restitution: 0.1,
    friction: 0.8
  }));
  const worker = new Worker(new URL('../fixtures/vehicleDynamicsNodeWorker.mjs', import.meta.url), {
    type: 'module'
  });
  const workerTimes = [];
  const stepIndices = [];
  const snapshotReceiveTimes = [];
  const backlogs = [];
  const heartbeatGaps = [];
  let previousHeartbeat = performance.now();
  const heartbeat = setInterval(() => {
    const current = performance.now();
    heartbeatGaps.push(current - previousHeartbeat);
    previousHeartbeat = current;
  }, 2);
  const physicsWorld = { surfaceSampler: sampler, staticColliderDefinitions };
  const transferables = getPackedRaceWorkerEnvironmentTransferables(physicsWorld);
  const completed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(
      'worker responsiveness capture timed out'
    )), 10000);
    worker.on('message', (message) => {
      if (message.type === 'error') reject(new Error(message.message));
      if (message.type !== 'snapshot') return;
      workerTimes.push(Number(message.workerStepMs || 0));
      snapshotReceiveTimes.push(performance.now());
      backlogs.push(Number(message.backlogSteps || 0));
      stepIndices.push(readVehicleRenderSnapshot(message.buffer).stepIndex);
      worker.postMessage({ type: 'recycleSnapshotBuffer', buffer: message.buffer }, [message.buffer]);
      if (workerTimes.length >= 120) {
        clearTimeout(timeout);
        resolve();
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0 && workerTimes.length < 120) reject(new Error(`worker exited ${code}`));
    });
  });
  const inputBuffer = createVehicleControlInputBuffer({ throttle: 0.5 });
  worker.postMessage({
    type: 'initialize',
    protocolVersion: VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
    payload: { vehicle: {
      id: 'player',
      player: true,
      config: { chassisHz: 120, tireHz: 120, maxCatchUpSteps: 8, telemetryRetention: 'none' },
      initialState: { worldX: 0, heightM: 0.55, worldZ: -10, speedMps: 20 },
      physicsWorld
    } }
  }, transferables);
  worker.postMessage({
    type: 'input',
    vehicleId: 'player',
    inputSequence: 1,
    inputBuffer
  }, [inputBuffer]);
  try {
    await completed;
  } finally {
    clearInterval(heartbeat);
    await worker.terminate();
  }
  assert.equal(workerTimes.length >= 120, true);
  assert.equal(backlogs.at(-1), 0, `worker retained backlog: ${backlogs.join(',')}`);
  assert.equal(backlogs.slice(-30).every((backlog) => backlog === 0), true,
    `worker backlog did not drain and remain flat: ${backlogs.join(',')}`);
  assert.equal(stepIndices.at(-1) - stepIndices[0] >= 119, true);
  const steadyElapsedSeconds = Math.max(
    1e-6,
    (snapshotReceiveTimes.at(-1) - snapshotReceiveTimes[0]) / 1000
  );
  const sustainedStepsPerSecond = (
    stepIndices.at(-1) - stepIndices[0]
  ) / steadyElapsedSeconds;
  assert.equal(sustainedStepsPerSecond >= 120, true,
    `collision-heavy worker sustained only ${sustainedStepsPerSecond.toFixed(2)} steps/s`);
  const workerMetrics = {
    p50: percentile(workerTimes, 0.5),
    p95: percentile(workerTimes, 0.95),
    p99: percentile(workerTimes, 0.99)
  };
  const renderMetrics = {
    p50: percentile(heartbeatGaps, 0.5),
    p95: percentile(heartbeatGaps, 0.95),
    p99: percentile(heartbeatGaps, 0.99)
  };
  assert.equal(renderMetrics.p99 < 100, true,
    `render p99 stalled for ${renderMetrics.p99.toFixed(2)}ms`);
  assert.equal(Math.max(...heartbeatGaps) < 500, true,
    `render event loop stalled for ${Math.max(...heartbeatGaps).toFixed(2)}ms`);
  assert.equal(Object.values(workerMetrics).every(Number.isFinite), true);
  assert.equal(Object.values(renderMetrics).every(Number.isFinite), true);
});
