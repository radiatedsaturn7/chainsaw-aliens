import test from 'node:test';
import assert from 'node:assert/strict';

import { createSnapshotHistory } from '../../src/ui/shared/history/SnapshotHistory.js';

test('respects stack bounds by trimming oldest undo snapshots', () => {
  let state = 'v0';
  const history = createSnapshotHistory({
    limit: 2,
    createSnapshot: () => state,
    applySnapshot: (snapshot) => {
      state = snapshot;
    }
  });

  history.reset('v0');
  state = 'v1';
  history.commit();
  state = 'v2';
  history.commit();
  state = 'v3';
  history.commit();

  assert.deepEqual(history.undoStack, ['v1', 'v2']);
});

test('invalidates redo stack when committing a new edit after undo', () => {
  let state = 'base';
  const history = createSnapshotHistory({
    createSnapshot: () => state,
    applySnapshot: (snapshot) => {
      state = snapshot;
    }
  });

  history.reset('base');
  state = 'a';
  history.commit();
  state = 'b';
  history.commit();

  history.undo();
  assert.equal(history.redoStack.length, 1);

  state = 'c';
  history.commit();
  assert.equal(history.redoStack.length, 0);
});

test('short-circuits commit when snapshot identity is unchanged', () => {
  const snapshot = { marker: 'same-reference' };
  let state = snapshot;
  const history = createSnapshotHistory({
    createSnapshot: () => state,
    applySnapshot: () => {}
  });

  history.reset(snapshot);
  const committed = history.commit(snapshot);

  assert.equal(committed, false);
  assert.equal(history.undoStack.length, 0);
});
