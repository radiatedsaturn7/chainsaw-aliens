import test from 'node:test';
import assert from 'node:assert/strict';
import AITestHarness from '../../src/debug/AITestHarness.js';

const EXPECTED_SCENARIO_NAMES = [
  'Empty room',
  '3x3 solid box',
  '5x3 solid box',
  '3x5 solid box',
  '3x1 hazard strip',
  'Elevator up 10 with 10x3 column',
  '10x3 column + staggered one-way runs',
  '10x10 staircase + drop',
  '1x10 hazard + moving platform above'
];

function createMockGame() {
  const game = {
    world: {
      tileSize: 32,
      applyData(data) {
        this.tileSize = data.tileSize;
        this.data = data;
      }
    },
    minimap: null,
    player: { x: 0, y: 0, vx: 0, vy: 0 },
    enemies: ['x'],
    projectiles: ['x'],
    effects: ['x'],
    friendlyCompanion: { x: 0, y: 0 },
    lastToast: '',
    spawnFriendlyCompanion(x, y) {
      this.friendlyCompanion = { x, y };
    },
    showSystemToast(message) {
      this.lastToast = message;
    },
    transitionedTo: null,
    transitionTo(state) {
      this.transitionedTo = state;
    }
  };
  return game;
}

function makeInput(...pressed) {
  const set = new Set(pressed);
  return {
    wasPressed(action) {
      return set.has(action);
    }
  };
}

test('AI harness builds requested scenario list and exposes menu actions', () => {
  const harness = new AITestHarness();
  assert.equal(harness.scenarios.length, EXPECTED_SCENARIO_NAMES.length);
  assert.deepEqual(harness.scenarios.map((scenario) => scenario.name), EXPECTED_SCENARIO_NAMES);

  const actions = harness.getScenarioMenuActions();
  assert.equal(actions.length, EXPECTED_SCENARIO_NAMES.length);
  assert.equal(actions[0].action, 'ai-test-scenario-0');
  assert.equal(actions[actions.length - 1].action, `ai-test-scenario-${actions.length - 1}`);
});

test('enable/loadCurrent applies scenario world, spawns companion, and resets room state', () => {
  const harness = new AITestHarness();
  const game = createMockGame();

  harness.enable(game, 2);

  assert.equal(harness.active, true);
  assert.equal(harness.index, 2);
  assert.equal(game.world.data.width, 56);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.projectiles.length, 0);
  assert.equal(game.effects.length, 0);
  assert.ok(game.lastToast.includes('5x3 solid box'));
  assert.ok(Number.isFinite(game.friendlyCompanion.x));
  assert.ok(Number.isFinite(game.friendlyCompanion.y));
});

test('update marks pass when companion reaches player and fail when time limit expires', () => {
  const harness = new AITestHarness();
  const game = createMockGame();
  harness.enable(game, 0);

  game.friendlyCompanion.x = game.player.x;
  game.friendlyCompanion.y = game.player.y;
  harness.update(makeInput(), game, 0.016);
  assert.equal(harness.success, true);
  assert.equal(harness.results.get(harness.index), 'pass');

  harness.loadCurrent(game);
  harness.timeLimit = 0.1;
  harness.update(makeInput(), game, 0.2);
  assert.equal(harness.failed, true);
  assert.equal(harness.results.get(harness.index), 'fail');
});

test('auto-run advances scenarios after pass/fail and cancel exits back to title', () => {
  const harness = new AITestHarness();
  const game = createMockGame();
  harness.enable(game, 0);
  harness.autoRun = true;

  game.friendlyCompanion.x = game.player.x;
  game.friendlyCompanion.y = game.player.y;
  harness.update(makeInput(), game, 0.7);
  harness.update(makeInput(), game, 0.7);

  assert.equal(harness.index, 1);

  harness.update(makeInput('cancel'), game, 0.016);
  assert.equal(harness.active, false);
  assert.equal(game.transitionedTo, 'title');
});
