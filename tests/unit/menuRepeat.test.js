import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMenuRepeatState,
  getMenuRepeatDirection,
  resetMenuRepeatState
} from '../../src/ui/shared/menuRepeat.js';

test('menu repeat fires immediately, waits, then repeats while direction is held', () => {
  const state = createMenuRepeatState();

  assert.equal(getMenuRepeatDirection(state, { down: true }, 0), 'down');
  assert.equal(getMenuRepeatDirection(state, { down: true }, 0.12), null);
  assert.equal(getMenuRepeatDirection(state, { down: true }, 0.16), 'down');
  assert.equal(getMenuRepeatDirection(state, { down: true }, 0.08), null);
  assert.equal(getMenuRepeatDirection(state, { down: true }, 0.04), 'down');
});

test('menu repeat resets when released or changed', () => {
  const state = createMenuRepeatState();

  assert.equal(getMenuRepeatDirection(state, { down: true }, 0), 'down');
  assert.equal(getMenuRepeatDirection(state, {}, 0.1), null);
  assert.equal(getMenuRepeatDirection(state, { down: true }, 0), 'down');
  assert.equal(getMenuRepeatDirection(state, { up: true }, 0.01), 'up');

  resetMenuRepeatState(state);
  assert.equal(state.direction, null);
  assert.equal(state.holdTime, 0);
  assert.equal(state.repeatTime, 0);
});
