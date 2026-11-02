import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {getStressPerimeter} from '../../tools/loadtest/stress-perimeter.mjs';

test('six load-test fences enclose the entire 30-car runtime grid', () => {
  const e = new RaceEditor({});
  e.upsertRaceProjectCar(e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar), 'Grid test car'));
  e.setRaceAiCount(29);
  const grid = e.createRaceAiRuntime(e.selectedRace.competition.aiDrivers);
  assert.equal(grid.length, 29);
  const nodes = e.selectedRace.road.nodes;
  const fence = getStressPerimeter(nodes, grid);
  assert.equal(fence.length, 7);
  assert.deepEqual(fence[0], fence[6]);
  for (const p of [...nodes.map(n => ({x:n.x,z:n.y})), ...grid.map(c => ({x:c.worldX,z:c.worldZ}))]) {
    assert.ok(p.x - fence[0].x >= 130 - 1e-8);
    assert.ok(fence[2].x - p.x >= 130 - 1e-8);
    assert.ok(p.z - fence[0].z >= 130 - 1e-8);
    assert.ok(fence[3].z - p.z >= 130 - 1e-8);
  }
});

test('rejects invalid geometry instead of generating broken fences', () => {
  assert.throws(() => getStressPerimeter([], []));
  assert.throws(() => getStressPerimeter([{x:NaN,y:0}], []));
});
