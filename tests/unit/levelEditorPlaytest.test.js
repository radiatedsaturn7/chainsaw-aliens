import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { location: { search: '' } };
const { default: Game } = await import('../../src/game/GameCore.js');

test('normal Level Editor playtest resets once without running hidden golden-path validation', () => {
  const game = Object.create(Game.prototype);
  const worldData = {
    width: 24,
    height: 24,
    spawn: { x: 12, y: 12 },
    tiles: Array.from({ length: 24 }, () => '.'.repeat(24))
  };
  let deactivations = 0;
  let refreshes = 0;
  let resets = 0;
  let spawnPauses = 0;
  const transitions = [];
  let resetOptions = null;

  game.editor = {
    startWithEverything: false,
    deactivate() {
      deactivations += 1;
    },
    flushWorldRefresh() {
      refreshes += 1;
    }
  };
  game.buildWorldData = () => worldData;
  game.syncSpawnPoint = () => {};
  game.transitionTo = (state) => transitions.push(state);
  game.resetRun = (options) => {
    resets += 1;
    resetOptions = options;
  };
  game.startSpawnPause = () => {
    spawnPauses += 1;
  };
  game.runGoldenPathSimulation = () => {
    throw new Error('normal playtest must not run golden-path validation');
  };
  game.debugMode = true;
  game.showCompanionPathDebug = true;
  game.playtestActive = false;
  game.levelEditorPlaytestSnapshot = null;

  game.exitEditor({ playtest: true });

  assert.equal(deactivations, 1);
  assert.equal(refreshes, 1);
  assert.equal(resets, 1);
  assert.deepEqual(resetOptions, {
    playtest: true,
    startWithEverything: false
  });
  assert.deepEqual(transitions, ['playing']);
  assert.equal(spawnPauses, 1);
  assert.equal(game.playtestActive, true);
  assert.equal(game.playtestPauseLock, 0.35);
  assert.equal(game.debugMode, false);
  assert.equal(game.showCompanionPathDebug, false);
  assert.equal(game.levelEditorPlaytestSnapshot.worldData, worldData);
});

test('first active playtest update tracks bounded FPS without stopping the game loop', () => {
  const game = Object.create(Game.prototype);
  let stateUpdates = 0;

  game.playtestActive = true;
  game.playtestFps = 0;
  game.lastPlaytestFpsMs = 0;
  game.stateManager = {
    update() {
      stateUpdates += 1;
    }
  };
  game.updateProjectBrowserMusicPreview = () => {};

  assert.doesNotThrow(() => game.update(1 / 1000));
  assert.equal(game.playtestFps, 240);
  assert.equal(stateUpdates, 1);

  game.playtestFps = 0;
  game.lastPlaytestFpsMs = 0;
  assert.doesNotThrow(() => game.update(2));
  assert.equal(game.playtestFps, 1);
  assert.equal(stateUpdates, 2);
});
