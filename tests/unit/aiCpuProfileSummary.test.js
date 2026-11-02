import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

function summarize(samples, timeDeltas) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-profile-'));
  const node = (id, functionName, children = [], url = '') =>
    ({id, callFrame: {functionName, url, lineNumber: 0}, children});
  const nodes = [node(1, '(root)', [2, 6, 8]),
    node(2, 'updateRaceAiDrivers', [3, 5]),
    node(3, 'updateRaceAiVehiclePhysics', [4]),
    node(4, 'runStep', [], 'file:///src/racing/simulation/VehicleDynamicsRunner.js'),
    node(5, 'sampleDeckAtDistance', [], 'file:///src/racing/RaceSurfaceModel.js'),
    node(6, 'post', [7], 'node:inspector'), node(7, 'serialize'),
    node(8, '(garbage collector)')];
  try {
    const path = join(dir, 'sample.cpuprofile');
    writeFileSync(path, JSON.stringify({nodes, samples, timeDeltas}));
    return JSON.parse(execFileSync(process.execPath,
      ['tools/loadtest/summarize-ai-cpu-profile.mjs', path], {encoding: 'utf8'}));
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

test('AI profile excludes inspector descendants and separates work outside detailed runner', () => {
  const result = summarize([4, 5, 7, 8, 5], [2000, 3000, 900000, 1000, 0]);
  assert.equal(result.totalSampledMs, 6);
  assert.equal(result.rawSampleCount, 5);
  assert.equal(result.sampleCount, 4);
  assert.deepEqual(result.excluded, {inspectorPostMs: 900, samples: 1});
  assert.equal(result.aiOutsideDetailed.sampledMs, 3);
  assert.equal(result.aiOutsideDetailed.categories[0].name, 'Terrain/surface queries');
  assert.equal(result.aiOutsideDetailed.categories[0].percent, 100);
  assert.equal(result.aiPaths.find(row => row.name === 'updateRaceAiVehiclePhysics').ms, 2);
  assert.equal(result.groups.find(row => row.name === 'GC (unattributed)').ms, 1);
  assert.equal(result.topSelf.some(row => row.name.includes('serialize')), false);
  assert.match(result.aiOutsideDetailed.note, /Not exclusively cheap cars/);
});

test('profile consisting only of inspector shutdown has no gameplay time', () => {
  const result = summarize([7], [1000]);
  assert.equal(result.totalSampledMs, 0);
  assert.equal(result.sampleCount, 0);
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.aiOutsideDetailed.categories, []);
});
