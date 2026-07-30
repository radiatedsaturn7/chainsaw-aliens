import test from 'node:test';
import assert from 'node:assert/strict';

import RaceRuntimePreparation from '../../src/racing/RaceRuntimePreparation.js';

test('race runtime preparation caches immutable packages with bounded LRU reuse', () => {
  const cache = new RaceRuntimePreparation({ maxEntries: 2 });
  const first = { worldBake: { key: 'one' } };
  const second = { worldBake: { key: 'two' } };
  const third = { worldBake: { key: 'three' } };

  cache.set('one', first);
  cache.set('two', second);
  assert.equal(cache.get('one'), first);
  cache.set('three', third);

  assert.equal(cache.get('two'), null);
  assert.equal(cache.get('one'), first);
  assert.equal(cache.get('three'), third);
});

test('race runtime preparation clears matching in-flight requests after settlement', async () => {
  const cache = new RaceRuntimePreparation();
  let resolveRequest;
  const request = new Promise((resolve) => {
    resolveRequest = resolve;
  });

  cache.setInFlight('race', request);
  assert.equal(cache.getInFlight('race'), request);
  resolveRequest(true);
  await request;
  await Promise.resolve();

  assert.equal(cache.getInFlight('race'), null);
});
