import assert from 'node:assert/strict';
import test from 'node:test';

import { createVehicleDynamicsWorkerMessageHandler } from '../../src/racing/simulation/vehicleDynamicsWorker.js';
import {
  VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
  createVehicleControlInputBuffer,
  createVehicleEnvironmentUpdateBuffer,
  createVehicleResetCommandBuffer
} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';

test('worker entry initializes all active dynamics runners and accepts only packed controls', () => {
  const messages = [];
  const inputs = [];
  const activeChanges = [];
  const environmentUpdates = [];
  const resets = [];
  let started = false;
  const authority = {
    recycleSnapshotBuffer() {},
    setInput(id, input, metadata) { inputs.push({ id, input, metadata }); },
    setVehicleActive(id, active) { activeChanges.push({ id, active }); return true; },
    updateEnvironmentState(update) { environmentUpdates.push(update); },
    resetVehicle(id, state, metadata) {
      resets.push({ id, state, metadata });
      return {
        event: { stepIndex: 12 }, resetGeneration: metadata.sequence,
        contactRebuildStatus: 'rebuilt', supportedWheelCount: 4,
        perWheelContactValidity: {},
        renderState: {
          resetGeneration: metadata.sequence,
          stepIndex: 12, eventSequence: metadata.sequence,
          position: state.position, orientation: state.orientation,
          wheels: {}, suspensionPose: {}
        }
      };
    },
    start() { started = true; },
    stop() {}
  };
  const handler = createVehicleDynamicsWorkerMessageHandler({
    scope: { postMessage: (message, transfers) => messages.push({ message, transfers }) },
    createRunner: (definition) => ({ definition, advance() {} }),
    createAuthority: ({ runners }) => {
      assert.equal(runners.length, 2);
      assert.equal(runners[0].player, true);
      return authority;
    }
  });
  handler({ data: {
    type: 'initialize',
    protocolVersion: VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
    payload: { vehicles: [
      { id: 'player', player: true, config: {} },
      { id: 'ai-1', active: true, config: {} }
    ] }
  } });
  assert.equal(started, true);
  assert.equal(messages.at(-1).message.type, 'ready');
  handler({ data: {
    type: 'input',
    vehicleId: 'player',
    inputSequence: 5,
    inputBuffer: createVehicleControlInputBuffer({ throttle: 0.75 })
  } });
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].id, 'player');
  assert.ok(Math.abs(inputs[0].input.throttle - 0.75) < 1e-6);
  assert.equal(inputs[0].metadata.sequence, 5);
  handler({ data: { type: 'setVehicleActive', vehicleId: 'ai-1', active: false } });
  assert.deepEqual(activeChanges, [{ id: 'ai-1', active: false }]);
  handler({ data: {
    type: 'environmentUpdate',
    buffer: createVehicleEnvironmentUpdateBuffer({
      weatherState: { id: 'rain', effectiveIntensity: 0.5 }
    })
  } });
  assert.equal(environmentUpdates[0].weatherState.id, 'rain');
  handler({ data: {
    type: 'resetVehicle',
    vehicleId: 'player',
    resetSequence: 6,
    buffer: createVehicleResetCommandBuffer({
      position: { x: 3, y: 1, z: 8 },
      orientation: { w: 1 },
      routeDistance: 8
    })
  } });
  assert.equal(resets.length, 1);
  assert.equal(resets[0].state.position.x, 3);
  assert.equal(resets[0].metadata.sequence, 6);
  assert.equal(messages.at(-1).message.type, 'resetApplied');
  assert.equal(messages.at(-1).message.resetGeneration, 6);
  assert.equal(messages.at(-1).message.buffer instanceof ArrayBuffer, true);
});
