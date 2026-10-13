import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('pause Restart Race starts a fresh attempt with the same car and baked track without cancelling travel', () => {
  let closed = 0;
  let stopped = 0;
  const travel = {};
  const editor = new RaceEditor({
    raceTravelSession: travel,
    stopSfxById() { stopped++; },
    cancelRaceTravel() { throw new Error('restart must stay in race'); }
  });
  // Render prewarming is unrelated to restart lifecycle and needs a browser.
  editor.preloadSelectedRaceArtRefs = () => {};
  editor.prewarmRacePlaytestRenderResources = () => {};
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  const old = editor.playtestSession;
  const bake = { key: 'prepared-track' };
  old.worldBake = bake;
  old.elapsedMs = 12000;
  old.distance = 150;
  old.lap = 2;
  old.tireTrackSegments.push({ id: 1 });
  old.activeEngineSoundId = 'engine';
  old.deferredArtWorker = { terminate() { closed++; } };
  editor.vehicleDynamicsAuthority = { workerBridge: { close() { closed++; } } };
  editor.raceInput.autoShift = false;
  editor.raceInput.keyboardThrottle = true;
  editor.raceInput.activeDpadPointerId = 42;
  editor.toggleRacePause();
  const rows = editor.getRacePauseMenuRows();
  assert.equal(rows.find(row => row.id === 'race-restart').label, 'Restart Race');
  editor.raceInput.pauseMenuIndex = rows.findIndex(row => row.id === 'race-restart');
  editor.handleRacePauseMenuInput({ wasGamepadPressed: key => key === 'gamepadA' });
  const fresh = editor.playtestSession;
  assert.notEqual(fresh, old);
  assert.equal(old.running, false);
  assert.equal(fresh.carId, old.carId);
  assert.equal(fresh.raceId, old.raceId);
  assert.equal(fresh.worldBake, bake);
  assert.equal(fresh.elapsedMs, 0);
  assert.equal(fresh.distance, 0);
  assert.equal(fresh.lap, 1);
  assert.equal(fresh.countdownRemainingMs, editor.getRaceStartSettings().countdown ? 4000 : 0);
  assert.equal(fresh.tireTrackSegments.length, 0);
  assert.notEqual(fresh.trackState, old.trackState);
  assert.equal(editor.raceInput.paused, false);
  assert.equal(editor.raceInput.autoShift, false);
  assert.equal(editor.raceInput.keyboardThrottle, false);
  assert.equal(editor.raceInput.activeDpadPointerId, null);
  assert.equal(editor.game.raceTravelSession, travel);
  assert.equal(closed, 2);
  assert.equal(stopped, 1);
});
