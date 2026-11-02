import test from 'node:test';
import assert from 'node:assert/strict';
import { disposeRaceSessionResources } from '../../src/racing/RaceSessionResources.js';
import { RacePerformanceCapture } from '../../src/racing/RacePerformanceCapture.js';

test('ten play/end cycles return worker, listener, generator and art ownership to baseline', () => {
  let workers = 0, listeners = 0, returns = 0, artStops = 0, captureStops = 0;
  const editor = {};
  for (let i = 0; i < 10; i++) {
    const session = editor.playtestSession = { running: true, vehicleDynamicsRunner: {},
      incrementalRoadReset: { return() { returns++; } },
      deferredArtWorker: { terminate() { artStops++; } },
      frameBudget: { jobs: new Map([['pending', {}]]) } };
    workers++; listeners++;
    editor.vehicleDynamicsAuthority = { session, runner: session.vehicleDynamicsRunner,
      workerBridge: { close() { workers--; listeners--; } } };
    editor.racePerformanceCapture = { active: true, session,
      stop() { this.active = false; captureStops++; } };
    assert.equal(disposeRaceSessionResources(editor).disposed, true);
    assert.equal(disposeRaceSessionResources(editor, session).disposed, false);
    assert.equal(workers, 0); assert.equal(listeners, 0);
    assert.equal(editor.vehicleDynamicsAuthority, null);
    assert.equal(session.running, false);
    assert.equal(session.frameBudget.jobs.size, 0);
    assert.equal(session.incrementalRoadReset, null);
    assert.equal(session.deferredArtWorker, null);
    editor.playtestSession = null;
  }
  assert.equal(returns, 10); assert.equal(artStops, 10); assert.equal(captureStops, 10);
});

test('an old session cannot dispose a replacement session or its resources', () => {
  const old = { running: true, vehicleDynamicsRunner: {} };
  const current = { running: true, vehicleDynamicsRunner: {} };
  const editor = { playtestSession: current,
    vehicleDynamicsAuthority: { session: current, runner: current.vehicleDynamicsRunner,
      workerBridge: { close() { assert.fail('closed new worker'); } } },
    racePerformanceCapture: { active: true, session: current, stop() { assert.fail('stopped new capture'); } } };
  disposeRaceSessionResources(editor, old);
  assert.equal(current.running, true);
  assert.equal(editor.vehicleDynamicsAuthority.session, current);
});

test('cleanup completes the remaining releases when one resource throws', () => {
  let artStopped = false;
  const session = { running: true, deferredArtWorker: { terminate() { artStopped = true; } } };
  const editor = { playtestSession: session, vehicleDynamicsAuthority: { session,
    workerBridge: { close() { throw Error('broken worker'); } } } };
  const result = disposeRaceSessionResources(editor);
  assert.equal(result.errors.length, 1);
  assert.equal(artStopped, true);
  assert.equal(editor.vehicleDynamicsAuthority, null);
});

test('session disposal restores real recorder hooks and releases its owner session', () => {
  const session = { running: true };
  const editor = { playtestSession: session, update() {}, draw() {} };
  const original = editor.update;
  editor.racePerformanceCapture = new RacePerformanceCapture(editor, { observe: false });
  editor.update(); editor.draw();
  disposeRaceSessionResources(editor, session, { reason: 'test-exit' });
  assert.equal(editor.update, original);
  assert.equal(editor.racePerformanceCapture.active, false);
  assert.equal(editor.racePerformanceCapture.session, null);
  assert.equal(editor.racePerformanceCapture.reason, 'test-exit');
});
