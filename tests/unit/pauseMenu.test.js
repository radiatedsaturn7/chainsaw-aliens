import test from 'node:test';
import assert from 'node:assert/strict';

import Pause from '../../src/ui/Pause.js';

test('pause menu exposes explicit navigable actions', () => {
  const pause = new Pause();

  assert.deepEqual(pause.getItems().map((item) => item.id), ['resume', 'exit']);
  assert.equal(pause.currentItem().id, 'resume');

  pause.move(1);
  assert.equal(pause.confirm(), 'exit');
  pause.move(1);
  assert.equal(pause.confirm(), 'resume');
});

test('pause menu exit confirmation defaults to no', () => {
  const pause = new Pause();

  pause.resetConfirm();
  assert.equal(pause.confirmExitChoice(), 'no');
  pause.moveConfirm(1);
  assert.equal(pause.confirmExitChoice(), 'yes');
  pause.moveConfirm(1);
  assert.equal(pause.confirmExitChoice(), 'no');
});
