import assert from 'node:assert/strict';
import test from 'node:test';

import RaceEditor from '../../src/ui/RaceEditor.js';

class FakeWorker {
  static instances = [];
  constructor(url, options) {
    this.url = String(url);
    this.options = options;
    this.messages = [];
    this.listeners = new Set();
    FakeWorker.instances.push(this);
  }
  addEventListener(type, listener) { if (type === 'message') this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === 'message') this.listeners.delete(listener); }
  postMessage(message, transferables = []) { this.messages.push({ message, transferables }); }
  terminate() { this.terminated = true; }
}

function createEditor() {
  return new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    input: { getGamepadAxes: () => ({}), isGamepadConnected: () => false },
    exitRaceEditor() {}
  });
}

async function withWorkerGlobals(qualification, callback, options = {}) {
  const enable = Object.hasOwn(options, 'enable') ? options.enable : true;
  const mode = Object.hasOwn(options, 'mode')
    ? options.mode : enable === true ? 'force' : 'off';
  const previousWorker = globalThis.Worker;
  const previousEnable = globalThis.__RTG_ENABLE_VEHICLE_DYNAMICS_WORKER__;
  const previousMode = globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_MODE__;
  const previousQualification = globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_QUALIFICATION__;
  FakeWorker.instances.length = 0;
  globalThis.Worker = FakeWorker;
  if (enable === undefined) delete globalThis.__RTG_ENABLE_VEHICLE_DYNAMICS_WORKER__;
  else globalThis.__RTG_ENABLE_VEHICLE_DYNAMICS_WORKER__ = enable;
  if (mode === undefined) delete globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_MODE__;
  else globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_MODE__ = mode;
  globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_QUALIFICATION__ = qualification;
  try {
    await callback();
  } finally {
    globalThis.Worker = previousWorker;
    globalThis.__RTG_ENABLE_VEHICLE_DYNAMICS_WORKER__ = previousEnable;
    globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_MODE__ = previousMode;
    globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_QUALIFICATION__ = previousQualification;
  }
}

test('RaceSimulation keeps coherent render-thread authority by default', async () => {
  await withWorkerGlobals(undefined, () => {
    const editor = createEditor();
    editor.selectedRace.hazards = [];
    const worldBake = editor.buildRaceWorldBake(editor.getRacePlaytestWorldBakeOptions());
    editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, preparedWorldBake: worldBake });
    editor.playtestSession.countdownRemainingMs = 0;
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    editor.playtestSession.startupFramePending = false;
    editor.updatePlaytest(1 / 60);
    editor.updatePlaytest(1 / 60);
    assert.equal(editor.playtestSession.vehicleDynamicsAuthorityThread, 'render');
    assert.equal(FakeWorker.instances.length, 0);
    assert.equal(editor.playtestSession.vehicleDynamicsRunner.stepIndex > 0, true);
  }, { enable: undefined, mode: undefined });
});

test('RaceSimulation honors an explicit worker opt-out', async () => {
  await withWorkerGlobals(undefined, () => {
    const editor = createEditor();
    editor.selectedRace.hazards = [];
    const worldBake = editor.buildRaceWorldBake(editor.getRacePlaytestWorldBakeOptions());
    editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, preparedWorldBake: worldBake });
    editor.playtestSession.countdownRemainingMs = 0;
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    editor.playtestSession.startupFramePending = false;
    editor.updatePlaytest(1 / 60);
    editor.updatePlaytest(1 / 60);
    assert.equal(editor.playtestSession.vehicleDynamicsAuthorityThread, 'render');
    assert.equal(FakeWorker.instances.length, 0);
    assert.equal(editor.playtestSession.vehicleDynamicsRunner.stepIndex > 0, true);
  }, { enable: false, mode: 'off' });
});

test('RaceSimulation hands authority to the worker only with a qualifying single-thread report', async () => {
  await withWorkerGlobals({
    achievedStepsPerSecond: 140,
    p95StepMs: 7,
    backlogStart: 0,
    backlogEnd: 0
  }, () => {
    const editor = createEditor();
    editor.selectedRace.hazards = [];
    const worldBake = editor.buildRaceWorldBake(editor.getRacePlaytestWorldBakeOptions());
    editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, preparedWorldBake: worldBake });
    editor.playtestSession.countdownRemainingMs = 2000;
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    editor.playtestSession.startupFramePending = false;
    editor.updatePlaytest(1 / 60);
    assert.equal(FakeWorker.instances.length, 0, 'handoff must wait for live Track State');
    assert.equal(
      editor.vehicleDynamicsAuthority.preparedWorkerSurfaceSampler?.workerTransferOwned,
      true,
      'packed worker surface should be copied before GO'
    );
    editor.playtestSession.countdownRemainingMs = 0;
    editor.updatePlaytest(1 / 60);
    editor.updatePlaytest(1 / 60);
    assert.equal(editor.playtestSession.vehicleDynamicsAuthorityThread, 'worker');
    assert.equal(editor.vehicleDynamicsAuthority.authoritativeThread, 'vehicle-dynamics-worker');
    assert.equal(FakeWorker.instances.length, 1);
    const initialization = FakeWorker.instances[0].messages.find(
      ({ message }) => message.type === 'initialize'
    );
    assert.ok(initialization);
    assert.ok(initialization.message.payload.trackState?.snapshot);
    assert.equal(initialization.message.payload.vehicles[0].player, true);
    assert.equal(initialization.transferables.length > 2, true);
    editor.vehicleDynamicsAuthority.workerBridge.close();
  });
});

test('RaceSimulation auto mode waits for a passing live single-thread qualification', async () => {
  await withWorkerGlobals(undefined, () => {
    const editor = createEditor();
    editor.selectedRace.hazards = [];
    const worldBake = editor.buildRaceWorldBake(editor.getRacePlaytestWorldBakeOptions());
    editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, preparedWorldBake: worldBake });
    editor.playtestSession.countdownRemainingMs = 0;
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    editor.playtestSession.startupFramePending = false;
    editor.updatePlaytest(1 / 60);
    assert.equal(FakeWorker.instances.length, 0);
    editor.vehicleDynamicsAuthority.liveWorkerQualification = {
      qualified: true,
      achievedStepsPerSecond: 140,
      p95StepMs: 7,
      backlogStart: 0,
      backlogEnd: 0,
      reasons: []
    };
    editor.updatePlaytest(1 / 60);
    assert.equal(FakeWorker.instances.length, 1);
    assert.equal(editor.playtestSession.vehicleDynamicsAuthorityThread, 'worker');
    editor.vehicleDynamicsAuthority.workerBridge.close();
  }, { enable: undefined, mode: 'auto' });
});

test('RaceSimulation keeps single-thread authority when the hot path misses budget', async () => {
  await withWorkerGlobals({
    achievedStepsPerSecond: 100,
    p95StepMs: 12,
    backlogStart: 0,
    backlogEnd: 4
  }, () => {
    const editor = createEditor();
    editor.selectedRace.hazards = [];
    const worldBake = editor.buildRaceWorldBake(editor.getRacePlaytestWorldBakeOptions());
    editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, preparedWorldBake: worldBake });
    editor.playtestSession.countdownRemainingMs = 0;
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 1000;
    editor.playtestSession.startupFramePending = false;
    editor.updatePlaytest(1 / 60);
    editor.updatePlaytest(1 / 60);
    assert.equal(editor.playtestSession.vehicleDynamicsAuthorityThread, 'render');
    assert.match(editor.playtestSession.vehicleDynamicsWorkerMigrationFailure, /performance gate failed/);
    assert.equal(editor.vehicleDynamicsAuthority.workerBridge, undefined);
    assert.equal(FakeWorker.instances[0].terminated, true);
    assert.equal(editor.playtestSession.vehicleDynamicsRunner.stepIndex > 0, true);
  });
});
