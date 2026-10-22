import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { decodeStoredDocument, readStoredMetadata } = require('../../tools/playwright/static-server.cjs');

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


test('test-server listings read metadata without parsing large document bodies',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-index-'));
 try {
  fs.writeFileSync(path.join(directory,'document.json'),'This body must not be parsed for a listing');
  fs.writeFileSync(path.join(directory,'metadata.json'),JSON.stringify({savedAt:123,systemFile:true}));
  assert.deepEqual(readStoredMetadata(directory),{updatedAt:123,size:42,systemFile:true});
  fs.writeFileSync(path.join(directory,'metadata.json'),JSON.stringify({deleted:true}));
  assert.equal(readStoredMetadata(directory),null);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
