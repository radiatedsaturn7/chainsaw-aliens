import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VehicleDynamicsWorkerAuthority,
  createVehicleRenderSnapshotFromRunner,
  VEHICLE_VISUAL_STATE
} from '../../src/racing/simulation/VehicleDynamicsWorkerAuthority.js';
import {
  createVehicleRenderSnapshotBuffer,
  readVehicleRenderSnapshot
} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';

class FakeRunner {
  constructor() {
    this.stepIndex = 0;
    this.config = { chassisHz: 120, maxCatchUpSteps: 8, wheelbaseM: 2.6, wheelRadiusM: 0.3 };
    this.state = {
      position: { x: 0, y: 1, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      speedMps: 10,
      engineRpm: 3000,
      wheelAngularVelocityRadps: { fl: 12, fr: 12, rl: 12, rr: 12 },
      suspensionTravel: { fl: 0.1, fr: 0.1, rl: 0.2, rr: 0.2 }
    };
  }
  get simulationTimeSeconds() { return this.stepIndex / 120; }
  advance(delta, { input, onFixedStep } = {}) {
    const due = Math.floor(delta * 120 + 1e-6);
    for (let index = 0; index < due; index += 1) {
      this.stepIndex += 1;
      this.state.position.x += Number(input?.throttle || 0);
      onFixedStep?.({ stepIndex: this.stepIndex });
    }
    return { completedSteps: due, backlogSteps: 0, advanceWallTimeMs: 0.5 };
  }
  resetAuthoritativeState(state, { reason, parkUntilDrive = false } = {}) {
    this.lastResetOptions = { reason, parkUntilDrive };
    this.state = {
      ...this.state,
      ...state,
      speedMps: 0,
      wheelAngularVelocityRadps: { fl: 0, fr: 0, rl: 0, rr: 0 }
    };
    return {
      state: this.state,
      event: { sequence: 1, stepIndex: this.stepIndex + 1, reason }
    };
  }
}

test('worker authority owns fixed clock, player and active AI stepping, Track State sequence, and snapshots', () => {
  const snapshots = [];
  let trackMutations = 0;
  const player = new FakeRunner();
  const ai = new FakeRunner();
  const sleeping = new FakeRunner();
  const wakeUpdates = [];
  const environmentController = {
    setWakeSources(sources, vehicleId) {
      wakeUpdates.push({ sources: sources.map((source) => source.id), vehicleId });
    }
  };
  const authority = new VehicleDynamicsWorkerAuthority({
    runners: [
      { id: 'player', runner: player, player: true, environmentController },
      { id: 'ai-1', runner: ai, environmentController },
      { id: 'ai-sleeping', runner: sleeping, active: false }
    ],
    now: () => 0,
    mutateTrackState: () => { trackMutations += 1; return 1; },
    postSnapshot: (message) => snapshots.push(message)
  });
  authority.setInput('player', { throttle: 0.25 }, { sequence: 1 });
  authority.tick(1000);
  const result = authority.tick(1025);
  assert.equal(result.completedSteps, 6);
  assert.equal(result.backlogSteps, 0);
  assert.equal(player.stepIndex, 3);
  assert.equal(ai.stepIndex, 3);
  assert.equal(sleeping.stepIndex, 0);
  assert.equal(trackMutations, 6);
  assert.equal(authority.eventSequence, 6);
  assert.equal(Math.abs(
    authority.vehicles.get('player').wheelSpinAngles.fl - 3 * 12 / 120
  ) < 1e-12, true);
  assert.equal(snapshots.length, 2);
  assert.equal(readVehicleRenderSnapshot(snapshots[0].buffer).eventSequence > 0, true);
  assert.deepEqual(wakeUpdates.slice(0, 2), [
    { sources: ['player', 'ai-1'], vehicleId: 'player' },
    { sources: ['player', 'ai-1'], vehicleId: 'ai-1' }
  ]);
  assert.equal(authority.setVehicleActive('ai-sleeping', true), true);
  authority.tick(1033.3333333333333);
  assert.equal(sleeping.stepIndex, 1);
});

test('snapshot extraction includes authoritative wheel and suspension poses', () => {
  const runner = new FakeRunner();
  runner.impactHistory = [{
    terrainImpact: true,
    sequence: 2,
    stepIndex: 1,
    resetGeneration: 0,
    bodyNormalImpulseNs: 9200,
    preImpactNormalSpeedMps: 8,
    preImpactKineticEnergyJ: 100000,
    postImpactKineticEnergyJ: 40000,
    impactPointWorld: { x: 0, y: 1, z: 2 },
    impactNormalWorld: { x: 0, y: 0.5, z: -0.8660254 },
    impactYawRad: 0
  }];
  const snapshot = createVehicleRenderSnapshotFromRunner(runner, { eventSequence: 7 });
  assert.equal(snapshot.eventSequence, 7);
  assert.equal(snapshot.wheelPoses.fl.position.x < snapshot.position.x, true);
  assert.equal(snapshot.wheelPoses.fr.position.x > snapshot.position.x, true);
  assert.equal(snapshot.suspensionPose.rr, 0.2);
  assert.equal(snapshot.visualState & VEHICLE_VISUAL_STATE.grounded, VEHICLE_VISUAL_STATE.grounded);
  assert.equal(snapshot.impactEvents.length, 1);
  assert.equal(snapshot.impactEvents[0].sequence, 2);
  assert.equal(snapshot.impactEvents[0].vehicleMassKg, 1450);
  runner.renderWheelSpinAngles = { fl: Math.PI };
  const spinning = createVehicleRenderSnapshotFromRunner(runner);
  assert.notDeepEqual(spinning.wheelPoses.fl.orientation, snapshot.wheelPoses.fl.orientation);
});

test('rolled vehicle snapshots use authoritative hubs instead of world-up contact offsets', () => {
  const runner = new FakeRunner();
  const half = Math.SQRT1_2;
  runner.state.orientation = { x: 0, y: 0, z: half, w: half };
  runner.state.contactPatches = {
    fl: {
      hubPositionWorld: { x: 0.52, y: 0.18, z: 1.3 },
      contactPointWorld: { x: 0.2, y: 0.18, z: 1.3 },
      surfaceNormalWorld: { x: 1, y: 0, z: 0 },
      suspensionMountPositionWorld: { x: 0.8, y: 0.18, z: 1.3 },
      suspensionAxisWorld: { x: -1, y: 0, z: 0 },
      normalLoadN: 3200,
      validTreadContact: true
    }
  };
  const snapshot = createVehicleRenderSnapshotFromRunner(runner);
  assert.deepEqual(snapshot.wheelPoses.fl.position, { x: 0.52, y: 0.18, z: 1.3 });
  assert.notEqual(
    snapshot.wheelPoses.fl.position.y,
    runner.state.contactPatches.fl.contactPointWorld.y + runner.config.wheelRadiusM
  );
  assert.equal(snapshot.wheelPoses.fl.validTreadContact, undefined);
  assert.equal(snapshot.wheelPoses.fl.flags > 0, true);
  assert.equal(Math.abs(snapshot.wheelPoses.fl.orientation.z - half) < 1e-12, true);
});

test('authoritative collision impacts advance the render event sequence', () => {
  const runner = new FakeRunner();
  const originalAdvance = runner.advance.bind(runner);
  runner.advance = (delta, options) => originalAdvance(delta, {
    ...options,
    onFixedStep: (telemetry) => {
      if (runner.stepIndex === 2) runner.activeImpact = { sequence: 1 };
      options.onFixedStep?.(telemetry);
    }
  });
  const snapshots = [];
  const authority = new VehicleDynamicsWorkerAuthority({
    runners: [{ id: 'player', runner, player: true }],
    now: () => 0,
    postSnapshot: (message) => snapshots.push(message)
  });
  authority.tick(0);
  authority.tick(25);
  assert.equal(authority.eventSequence, 1);
  assert.equal(readVehicleRenderSnapshot(snapshots[0].buffer).eventSequence, 1);
});

test('worker authority applies reset inside the owner and clears presentation spin', () => {
  const runner = new FakeRunner();
  const authority = new VehicleDynamicsWorkerAuthority({
    runners: [{ id: 'player', runner, player: true }],
    now: () => 0
  });
  authority.setInput('player', { throttle: 1 }, { sequence: 1 });
  authority.vehicles.get('player').wheelSpinAngles.fl = 2;
  const reset = authority.resetVehicle('player', {
    position: { x: 5, y: 1, z: 20 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    parkUntilDrive: true
  }, { sequence: 8 });
  assert.equal(reset.event.reason, 'track-center-reset');
  assert.deepEqual(runner.lastResetOptions, {
    reason: 'track-center-reset',
    parkUntilDrive: true
  });
  assert.deepEqual(runner.state.position, { x: 5, y: 1, z: 20 });
  assert.equal(authority.latestInputs.has('player'), false);
  assert.equal(authority.vehicles.get('player').wheelSpinAngles.fl, 0);
  assert.equal(authority.eventSequence, 8);
});

test('shared snapshot ring keeps publishing latest state through a 250 ms render stall', {
  skip: typeof SharedArrayBuffer !== 'function'
}, () => {
  const runner = new FakeRunner();
  const buffers = Array.from(
    { length: 4 }, () => createVehicleRenderSnapshotBuffer({ shared: true })
  );
  const control = new SharedArrayBuffer(buffers.length * Int32Array.BYTES_PER_ELEMENT);
  const published = [];
  const authority = new VehicleDynamicsWorkerAuthority({
    runners: [{ id: 'player', runner, player: true }],
    now: () => 0,
    snapshotSequenceControl: control,
    postSnapshot: (message) => published.push(message)
  });
  authority.snapshotBuffers.length = 0;
  buffers.forEach((buffer) => authority.recycleSnapshotBuffer(buffer));
  authority.tick(0);
  for (let milliseconds = 9; milliseconds <= 250; milliseconds += 9) {
    authority.tick(milliseconds);
  }
  const latest = published.at(-1);
  const counters = new Int32Array(control);
  assert.equal(published.length > buffers.length, true);
  assert.equal(latest.snapshotSequence, published.length);
  assert.equal(Atomics.load(counters, latest.snapshotSlot), latest.snapshotSequence * 2);
  assert.equal(readVehicleRenderSnapshot(latest.buffer).stepIndex, runner.stepIndex);
  assert.equal(authority.bufferStarvationCount, 0);
  assert.equal(authority.overwrittenSnapshots > 0, true);
  assert.equal(authority.snapshotBuffers.length, buffers.length);
});
