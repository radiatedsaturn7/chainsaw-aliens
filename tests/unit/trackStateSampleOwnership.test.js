import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackState } from '../../src/racing/trackState/TrackState.js';
import { getTrackStateCellSample } from '../../src/racing/trackState/TrackStateCell.js';

test('weather samples remain exact and independently owned across cells and mutations', () => {
  const state = new TrackState();
  const retained = [];
  for (let i = 0; i < 120; i++) {
    const point = { x: i % 9, z: i % 7 };
    state.mutateCell(point, {
      standingWaterDepthMm: i % 11,
      snowDepthMm: i % 41,
      iceDepthMm: (i % 5) / 2,
      rubber: (i % 13) / 13,
      oil: (i % 17) / 17,
      mud: (i % 19) / 19
    });
    const sample = state.sample(point);
    assert.deepEqual(sample, getTrackStateCellSample(sample.cell, state.stepIndex));
    // Cells intentionally remain live references, but sampled measurements do not.
    const { cell, ...measurements } = sample;
    retained.push([sample, structuredClone(measurements)]);
    const target = {};
    assert.equal(state.sample(point, target), target);
    assert.deepEqual(target, sample);
    assert.notEqual(target.visual, sample.visual);
  }
  for (const [sample, expected] of retained) {
    const { cell, ...actual } = sample;
    assert.deepEqual(actual, expected);
  }
});

test('visual deltas copy every cell and remain unchanged after later queries', () => {
  const state = new TrackState();
  for (let i = 0; i < 20; i++) {
    state.mutateCell({ x: i, z: 0 }, { standingWaterDepthMm: i / 3, rubber: i / 20 });
  }
  const delta = state.consumeVisualDelta({ includeAll: true });
  const retained = structuredClone(delta);
  for (const entry of delta.cells) {
    const cell = state.cells.get(entry.key);
    const expected = getTrackStateCellSample(cell, state.stepIndex);
    assert.equal(entry.effectiveGrip, expected.effectiveGrip);
    for (const [key, value] of Object.entries(expected.visual)) assert.equal(entry[key], value);
  }
  state.mutateCell({ x: 0, z: 0 }, { standingWaterDepthMm: 15 });
  state.consumeVisualDelta({ includeAll: true });
  state.sample({ x: 50, z: 50 });
  assert.deepEqual(delta, retained);
});
