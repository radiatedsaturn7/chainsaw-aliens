import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const { decodeStoredDocument } = require('../../tools/playwright/static-server.cjs');

test('Playwright static server decodes compact project documents before serving them', () => {
  const raceDocument = {
    schemaVersion: 1,
    kind: 'race-track',
    race: {
      id: 'test-loop',
      name: 'Studio Sprint',
      road: { nodes: [{ x: 0, y: 0 }], segments: [] }
    }
  };
  const stored = {
    __chainsawStorage: 'compact-v1',
    encoding: 'json-gzip-base64',
    data: zlib.gzipSync(JSON.stringify(raceDocument)).toString('base64')
  };

  assert.deepEqual(decodeStoredDocument(stored), raceDocument);
});

test('Playwright static server preserves ordinary project documents', () => {
  const document = { kind: 'race-track', race: { name: 'Plain Race' } };

  assert.equal(decodeStoredDocument(document), document);
});
