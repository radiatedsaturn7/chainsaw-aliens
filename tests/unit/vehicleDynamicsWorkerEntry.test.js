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
    reason: 'automatic-upside-down',
    buffer: createVehicleResetCommandBuffer({
      position: { x: 3, y: 1, z: 8 },
      orientation: { w: 1 },
      routeDistance: 8
    })
  } });
  assert.equal(resets.length, 1);
  assert.equal(resets[0].state.position.x, 3);
  assert.equal(resets[0].metadata.sequence, 6);
  assert.equal(resets[0].metadata.reason, 'automatic-upside-down');
  assert.equal(messages.at(-1).message.type, 'resetApplied');
  assert.equal(messages.at(-1).message.resetGeneration, 6);
  assert.equal(messages.at(-1).message.resetReason, 'automatic-upside-down');
  assert.equal(messages.at(-1).message.buffer instanceof ArrayBuffer, true);
});

test('worker entry can add and remove a debug opponent without reinitializing the race',()=>{
 const messages=[];
 const vehicles=new Map();
 const authority={vehicles,start(){},stop(){},recycleSnapshotBuffer(){},
  addVehicle(id,runner,entry){vehicles.set(id,{runner,...entry});},
  removeVehicle(id){vehicles.delete(id);}};
 let definitions=0;
 const handler=createVehicleDynamicsWorkerMessageHandler({scope:{postMessage:m=>messages.push(m)},
  createRunner:definition=>{definitions++;return {definition,advance(){}};},
  createAuthority:({runners})=>{for(const r of runners)vehicles.set(r.id,r);return authority;}});
 handler({type:'initialize',protocolVersion:VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,payload:{vehicles:[{id:'player',player:true}]}});
 const player=vehicles.get('player');
 handler({type:'addVehicle',definition:{id:'debug-1',initialState:{worldX:50}}});
 assert.equal(vehicles.size,2);
 assert.equal(vehicles.get('debug-1').runner.definition.initialState.worldX,50);
 handler({type:'removeVehicle',vehicleId:'debug-1'});
 assert.equal(vehicles.size,1);
 assert.strictEqual(vehicles.get('player'),player);
 assert.equal(definitions,2);
 assert.equal(messages.filter(m=>m.type==='error').length,0);
});

test('worker pause and resume stop and restart the authority clock', () => {
 const calls = [], messages = [];
 const handler = createVehicleDynamicsWorkerMessageHandler({
  scope: { postMessage: m => messages.push(m) },
  createRunner: definition => ({ definition }),
  createAuthority: () => ({ start: () => calls.push('start'), stop: () => calls.push('stop'),
    recycleSnapshotBuffer() {} })
 });
 handler({ type: 'initialize', protocolVersion: VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
   payload: { vehicle: { id: 'player', config: {} } } });
 handler({ type: 'setPaused', paused: true });
 handler({ type: 'setPaused', paused: false });
 assert.deepEqual(calls, ['start', 'stop', 'start']);
 assert.deepEqual(messages.filter(m => m.type === 'pauseState').map(m => m.paused), [true, false]);
});


test('worker shares immutable collider preparation but keeps per-vehicle output and resets the cache', () => {
 const messages = []; let entries;
 const handler = createVehicleDynamicsWorkerMessageHandler({
  scope: { postMessage: m => messages.push(m) },
  createRunner: definition => ({ definition }),
  createAuthority: ({ runners }) => { entries = runners; return {start() {}, stop() {}, recycleSnapshotBuffer() {}}; }
 });
 const shared = {surfaceSampler: {packed: true}, staticColliderDefinitions: [
  {id: 'wall', type: 'box', center: {x: 0, y: 0, z: 0}, halfExtents: {x: 1, y: 1, z: 1}}
 ]};
 const initialize = () => handler({type: 'initialize', protocolVersion: VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
  payload: {vehicles: [{id: 'player', player: true, physicsWorld: shared}, {id: 'ai-1'},
   {id: 'ai-2', physicsWorld: {...shared, staticColliderDefinitions: [...shared.staticColliderDefinitions]}}]}});
 const output = entry => entry.environmentController({reuseContactGeometry: true});
 initialize();
 assert.equal(messages.filter(m => m.type === 'error').length, 0);
 const a = output(entries[0]), b = output(entries[1]), c = output(entries[2]);
 assert.ok(a.staticColliderWorld);
 assert.notStrictEqual(a, b);
 assert.strictEqual(a.staticColliderWorld, b.staticColliderWorld);
 assert.notStrictEqual(a.staticColliderWorld, c.staticColliderWorld);
 initialize();
 assert.notStrictEqual(a.staticColliderWorld, output(entries[0]).staticColliderWorld);
});
