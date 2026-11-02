import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { RacePerformanceCapture } from '../../src/racing/RacePerformanceCapture.js';
import { serviceRacePerformanceWork } from '../../src/racing/RacePerformanceUpload.js';

function activeEditor(gameOverrides = {}) {
  const game = { state: 'race-editor', ...gameOverrides };
  const editor = new RaceEditor(game, { mode: 'race' });
  game.raceEditor = editor;
  editor.selectedRace.scenery = []; editor.selectedRace.hazards = [];
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  Object.assign(editor.playtestSession, { running: true, preparing: false,
    startupFramePending: false, countdownRemainingMs: 0, launchLockMs: 0 });
  if (editor.playtestSession.raceIntro) editor.playtestSession.raceIntro.active = false;
  return { editor, game, session: editor.playtestSession };
}

function ownedResources(editor, session = editor.playtestSession) {
  const calls = [];
  session.vehicleDynamicsRunner ||= {};
  editor.vehicleDynamicsAuthority = { session, runner: session.vehicleDynamicsRunner,
    workerBridge: { close() { calls.push('worker'); } } };
  session.deferredArtWorker = { terminate() { calls.push('art'); } };
  session.incrementalRoadReset = { return() { calls.push('reset'); } };
  session.frameBudget = { jobs: new Map([['optional', {}]]) };
  const capture = editor.racePerformanceCapture = new RacePerformanceCapture(editor, {
    observe: false, onStop() { calls.push('capture'); }
  });
  return { calls, capture };
}

function assertReleased(editor, session, resources) {
  for (const name of ['worker', 'art', 'reset', 'capture']) {
    assert.equal(resources.calls.filter(item => item === name).length, 1, `${name} released exactly once`);
  }
  assert.equal(session.running, false);
  assert.equal(session.frameBudget.jobs.size, 0);
  assert.equal(resources.capture.active, false);
  assert.notEqual(editor.vehicleDynamicsAuthority?.session, session);
}

function gameCoreExit() {
  // Execute the actual short public method without constructing unrelated game
  // entities, audio or canvas state. RaceEditor and its disposal path are real.
  const source = readFileSync(new URL('../../src/game/GameCore.js', import.meta.url), 'utf8');
  const method = source.match(/^  exitRaceEditor\(\) \{[\s\S]*?^  \}/m)?.[0];
  assert.ok(method, 'GameCore.exitRaceEditor source is present');
  return new Function(`return ({${method}}).exitRaceEditor;`)();
}

test('actual End Drive disposes the session after ghost finalization and remains idempotent', () => {
  const { editor, session } = activeEditor();
  const resources = ownedResources(editor);
  const finishGhost = editor.completeRaceGhost.bind(editor);
  editor.completeRaceGhost = options => {
    assert.equal(session.running, true, 'ghost finalization still owns the live session');
    resources.calls.push('ghost'); return finishGhost(options);
  };
  editor.endPlaytest(); editor.endPlaytest();
  assert.equal(editor.playtestSession, null);
  assertReleased(editor, session, resources);
  assert.ok(resources.calls.indexOf('ghost') < resources.calls.indexOf('worker'));
});

test('actual Restart releases only the outgoing session and creates a fresh running race', () => {
  const { editor, session } = activeEditor();
  const resources = ownedResources(editor);
  editor.raceInput.autoShift = false;
  editor.restartRacePlaytest();
  assertReleased(editor, session, resources);
  assert.ok(editor.playtestSession);
  assert.notEqual(editor.playtestSession, session);
  assert.equal(editor.playtestSession.running, true);
  assert.equal(editor.playtestSession.carId, session.carId);
  assert.equal(editor.raceInput.autoShift, false);
  editor.disposeRaceEditorSessions('test-cleanup');
});

test('starting a replacement race releases an existing session without requiring Restart', () => {
  const { editor, session } = activeEditor();
  const resources = ownedResources(editor);
  editor.startPlaytest(session.carId, { hydrateCars: false });
  assertReleased(editor, session, resources);
  assert.notEqual(editor.playtestSession, session);
  assert.equal(editor.playtestSession.running, true);
  editor.disposeRaceEditorSessions('test-cleanup');
});

test('actual Finish retains its ghost and releases the completed session', async () => {
  const { editor, session } = activeEditor();
  const resources = ownedResources(editor);
  session.elapsedMs = 1234;
  session.ghostRecording = [{ elapsedMs: 1234, distance: 12, x: 0, z: 12 }];
  await editor.finishPlaytest();
  assert.equal(editor.playtestSession, null);
  assertReleased(editor, session, resources);
  assert.equal(editor.bestRaceGhosts[session.raceId].finished, true);
  assert.equal(editor.bestRaceGhosts[session.raceId].elapsedMs, 1234);
});

test('asynchronous menu finish keeps the frozen session until travel succeeds', async () => {
  let finishTravel;
  const travel = new Promise(resolve => { finishTravel = resolve; });
  const { editor, session } = activeEditor({ completeRaceTravel: () => travel });
  editor.selectedRace.finishBehavior = { type: 'menu', menuRef: 'test-menu' };
  const resources = ownedResources(editor);
  const pending = editor.finishPlaytest();
  await Promise.resolve();
  assert.equal(editor.playtestSession, session);
  assert.equal(session.running, true);
  assert.equal(session.finishing, true);
  assert.equal(editor.raceInput.paused, true);
  assert.deepEqual(resources.calls, [], 'resources still belong to the frozen finishing session');
  finishTravel(); await pending;
  assert.equal(editor.playtestSession, null);
  assertReleased(editor, session, resources);
});

test('failed asynchronous finish preserves the paused session for retry', async () => {
  const { editor, session } = activeEditor({ completeRaceTravel: async () => { throw Error('travel unavailable'); } });
  editor.selectedRace.finishBehavior = { type: 'menu', menuRef: 'test-menu' };
  const resources = ownedResources(editor);
  await editor.finishPlaytest();
  assert.equal(editor.playtestSession, session);
  assert.equal(session.running, true);
  assert.equal(session.finishing, false);
  assert.equal(session.raceResults, true);
  assert.equal(editor.raceInput.paused, true);
  assert.deepEqual(resources.calls, []);
  editor.disposeRaceEditorSessions('test-cleanup');
  assertReleased(editor, session, resources);
});

test('preview reset releases its own session and preserves an outer bound race session', () => {
  const { editor, session } = activeEditor();
  const resources = ownedResources(editor);
  const outer = { running: true };
  editor.carEditorPreviewPlaytest = { session, input: editor.raceInput, carId: session.carId };
  editor.playtestSession = outer;
  editor.resetCarEditorPreviewPlaytest({ preserveEditorUi: true });
  assertReleased(editor, session, resources);
  assert.equal(editor.carEditorPreviewPlaytest, null);
  assert.equal(editor.playtestSession, outer);
  assert.equal(outer.running, true);
});

test('resetting an absent preview does not dispose the currently bound ordinary race', () => {
  const { editor, session } = activeEditor();
  const resources = ownedResources(editor);
  editor.carEditorPreviewPlaytest = null;
  editor.resetCarEditorPreviewPlaytest({ preserveEditorUi: true });
  assert.equal(editor.playtestSession, session); assert.equal(session.running, true);
  assert.equal(resources.capture.active, true); assert.deepEqual(resources.calls, []);
  editor.disposeRaceEditorSessions('test-cleanup');
  assertReleased(editor, session, resources);
});

test('prepared preview replacement transfers its art worker and preserves the bound outer session', () => {
  const { editor, session: outer } = activeEditor();
  editor.playtestSession = null;
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, carEditorPreview: true });
  const outgoing = editor.playtestSession;
  const resources = ownedResources(editor);
  const artWorker = outgoing.deferredArtWorker;
  editor.carEditorPreviewPlaytest = { session: outgoing, input: editor.raceInput,
    raceId: editor.selectedRace.id, carId: outgoing.carId };
  editor.playtestSession = outer;
  const preview = editor.installPreparedCarEditorPreview({
    key: 'updated', baseKey: 'preview', tuningRevision: '2',
    previewRace: editor.selectedRace, car: editor.selectedCar,
    worldBake: { key: 'prepared-preview', terrainCells: [], surfaceSampler: null }
  });
  assert.ok(preview?.session); assert.notEqual(preview.session, outgoing);
  assert.equal(editor.playtestSession, outer); assert.equal(outer.running, true);
  assert.equal(outgoing.running, false);
  assert.equal(outgoing.deferredArtWorker, null);
  assert.equal(preview.session.deferredArtWorker, artWorker);
  for (const name of ['worker', 'reset', 'capture']) assert.equal(resources.calls.filter(item => item === name).length, 1);
  assert.equal(resources.calls.includes('art'), false, 'transferred worker remains live');
  editor.resetCarEditorPreviewPlaytest({ preserveEditorUi: true });
  assert.equal(resources.calls.filter(item => item === 'art').length, 1);
  assert.equal(editor.playtestSession, outer); assert.equal(outer.running, true);
  editor.disposeRaceEditorSessions('test-cleanup');
});

test('failed prepared preview construction releases only its partial session', () => {
  const { editor, session: outer } = activeEditor();
  editor.playtestSession = null;
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, carEditorPreview: true });
  const outgoing = editor.playtestSession;
  const resources = ownedResources(editor);
  editor.carEditorPreviewPlaytest = { session: outgoing, input: editor.raceInput,
    raceId: editor.selectedRace.id, carId: outgoing.carId };
  editor.playtestSession = outer;
  const start = editor.startPlaytest.bind(editor);
  let partial, partialStops = 0;
  editor.startPlaytest = (...args) => {
    start(...args); partial = editor.playtestSession;
    partial.deferredArtWorker = { terminate() { partialStops++; } };
    throw Error('injected preview startup failure');
  };
  assert.throws(() => editor.installPreparedCarEditorPreview({
    previewRace: editor.selectedRace, car: editor.selectedCar,
    worldBake: { key: 'prepared-preview', terrainCells: [], surfaceSampler: null }
  }), /injected preview startup failure/);
  assert.equal(partial.running, false); assert.equal(partialStops, 1);
  assert.equal(editor.playtestSession, outer); assert.equal(outer.running, true);
  assert.equal(editor.carEditorPreviewPlaytest.session, outgoing);
  assert.equal(outgoing.running, true); assert.deepEqual(resources.calls, []);
  editor.disposeRaceEditorSessions('test-cleanup');
  assertReleased(editor, outgoing, resources);
});

test('preserving travel preparation keeps its workers alive until the prepared race takes ownership', () => {
  const { editor } = activeEditor();
  editor.beginRaceTravelLoading('Lifecycle route', editor.selectedCar.id);
  const preparation = editor.racePlaytestPreparation;
  let preparationStops = 0, artStops = 0;
  preparation.worker = { terminate() { preparationStops++; } };
  const artWorker = preparation.deferredArtWorker = { terminate() { artStops++; } };
  assert.equal(editor.applyLoadedRaceDocument(editor.selectedRace, {
    normalized: true, preservePreparation: true, name: 'Lifecycle route'
  }), true);
  assert.equal(editor.racePlaytestPreparation, preparation);
  assert.equal(preparation.cancelled, false);
  assert.equal(preparationStops, 0); assert.equal(artStops, 0);
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false, raceTravel: true,
    preparedWorldBake: { key: 'prepared-travel', terrainCells: [], surfaceSampler: null } });
  assert.equal(editor.racePlaytestPreparation, null);
  assert.equal(editor.playtestSession.running, true);
  assert.equal(preparationStops, 1); assert.equal(artStops, 0);
  assert.equal(editor.playtestSession.deferredArtWorker, artWorker);
  editor.disposeRaceEditorSessions('test-cleanup');
  assert.equal(artStops, 1);
});

test('temporary preview binding restores the outer session without disposing either one', () => {
  const { editor, session } = activeEditor();
  const preview = { raceId: editor.selectedRace.id, carId: session.carId,
    session: { running: true }, input: { ...editor.raceInput } };
  editor.ensureCarEditorPreviewPlaytestSession = () => preview;
  let disposals = 0;
  const dispose = editor.disposeRacePlaytestSession.bind(editor);
  editor.disposeRacePlaytestSession = (...args) => { disposals++; return dispose(...args); };
  assert.equal(editor.bindCarEditorPreviewPlaytest(() => {
    assert.equal(editor.playtestSession, preview.session); return 'rendered';
  }), 'rendered');
  assert.equal(editor.playtestSession, session);
  assert.equal(session.running, true); assert.equal(preview.session.running, true);
  assert.equal(disposals, 0);
  editor.disposeRaceEditorSessions('test-cleanup');
});

test('actual GameCore global exit invokes session disposal before changing state', () => {
  const exitRaceEditor = gameCoreExit();
  const { editor, game, session } = activeEditor();
  const resources = ownedResources(editor);
  game.playtestActive = true;
  game.transitionTo = (state, metadata) => {
    assertReleased(editor, session, resources);
    assert.equal(state, 'title'); assert.equal(metadata.forceCleanup, true); game.state = state;
  };
  exitRaceEditor.call(game);
  assert.equal(game.playtestActive, false); assert.equal(game.state, 'title');
  assert.equal(editor.playtestSession, null);
});

test('global exit also releases the separate car editor retained preview', () => {
  const { editor, game } = activeEditor();
  const { editor: carEditor, session: previewSession } = activeEditor();
  carEditor.mode = 'car';
  const resources = ownedResources(carEditor);
  carEditor.carEditorPreviewPlaytest = { session: previewSession, input: carEditor.raceInput,
    carId: previewSession.carId };
  carEditor.playtestSession = null;
  game.carEditor = carEditor;
  game.state = 'car-editor';
  game.transitionTo = state => { game.state = state; };
  gameCoreExit().call(game);
  assertReleased(carEditor, previewSession, resources);
  assert.equal(carEditor.carEditorPreviewPlaytest, null);
  assert.equal(editor.playtestSession, null);
});

test('actual async Export waits for pause and shares its prepared report with upload', async t => {
  let posts = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    posts++; return { ok: true, json: async () => ({ ok: true, id: 'lifecycle-capture' }) };
  });
  const { editor } = activeEditor();
  const capture = editor.racePerformanceCapture = new RacePerformanceCapture(editor, {
    observe: false, onStop: c => editor.uploadRacePerformanceCapture(c)
  });
  capture.begin(); capture.finish();
  let builds = 0;
  const report = capture.report.bind(capture);
  capture.report = () => { builds++; return report(); };
  const exported = editor.exportRacePerformanceCapture();
  assert.equal(typeof exported.then, 'function');
  await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(capture.active, false); assert.equal(builds, 0); assert.equal(posts, 0);
  editor.raceInput.paused = true; serviceRacePerformanceWork(editor);
  const result = await exported;
  await capture.uploadPromise;
  assert.equal(result.version, 1); assert.equal(builds, 1);
  assert.equal(posts, 1); assert.equal(capture.uploadState, 'saved');
  assert.equal(await editor.exportRacePerformanceCapture(), result);
  assert.equal(builds, 1);
  editor.disposeRaceEditorSessions('test-cleanup');
});
