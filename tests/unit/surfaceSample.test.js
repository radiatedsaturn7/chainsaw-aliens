import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInvalidSurfaceSample,
  createSurfaceSample,
  isValidSurfaceSample
} from '../../src/racing/simulation/SurfaceSample.js';

test('authoritative surface samples preserve zero height only when it is explicitly valid', () => {
  const seaLevel = createSurfaceSample({
    heightM: 0,
    normal: { x: 0, y: 1, z: 0 },
    triangleId: 17,
    region: 'road',
    source: 'prepared-world'
  }, { queryPosition: { x: 4, y: 2, z: 8 } });
  assert.equal(seaLevel.valid, true);
  assert.equal(seaLevel.heightM, 0);
  assert.equal(seaLevel.triangleId, 17);
  assert.equal(isValidSurfaceSample(seaLevel), true);
  assert.equal(createSurfaceSample({
    heightM: 1,
    normal: { x: 0, y: 1, z: 0 },
    triangleId: 'prepared-hill-17'
  }).triangleId, 'prepared-hill-17');

  for (const raw of [null, {}, { heightM: null }, { heightM: Number.NaN }, {
    heightM: 2,
    normal: { x: Number.NaN, y: 1, z: 0 }
  }]) {
    const sample = createSurfaceSample(raw, { queryPosition: { x: 1, z: 2 } });
    assert.equal(sample.valid, false);
    assert.equal(sample.heightM, null);
    assert.equal(isValidSurfaceSample(sample), false);
  }
});

test('invalid surface samples keep their source, query, triangle, and failure reason', () => {
  const sample = createInvalidSurfaceSample({
    queryPosition: { x: 7, y: 3, z: -2 },
    region: 'terrain',
    source: 'prepared-world',
    triangleId: 42,
    reason: 'triangle-query-miss'
  });
  assert.deepEqual(sample, {
    valid: false,
    heightM: null,
    normal: null,
    region: 'terrain',
    source: 'prepared-world',
    triangleId: 42,
    queryPosition: { x: 7, y: 3, z: -2 },
    reason: 'triangle-query-miss'
  });
});
