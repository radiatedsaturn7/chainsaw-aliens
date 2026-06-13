import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCachedProjectFilesForTests,
  deleteServerFileVersion,
  listServerFileVersions,
  readCachedProjectFile,
  renameServerFile,
  restoreServerFileVersion,
  saveServerFile,
  upsertCachedProjectFile
} from '../../src/ui/serverStorage.js';

test('saveServerFile merges metadata-only persisted responses with local data', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const document = { clips: [{ id: 'clip-1', kind: 'text', text: 'hello' }] };
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, '/__storage/file');
    const body = JSON.parse(options.body || '{}');
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          file: {
            version: body.version,
            folder: body.folder,
            name: body.name,
            savedAt: body.savedAt,
            dataOmitted: true
          }
        };
      }
    };
  };
  try {
    const saved = await saveServerFile('cutscenes', 'large', document, { savedAt: 1234, version: 1 });
    assert.equal(saved.persisted, true);
    assert.deepEqual(saved.data, document);

    const cached = JSON.parse(readCachedProjectFile('cutscenes', 'large'));
    assert.deepEqual(cached.data, document);
    assert.equal(cached.savedAt, 1234);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('saveServerFile reports unreachable storage clearly and can recover after restart', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const document = { frames: [['#ffffff']] };
  let online = false;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (!online) throw new TypeError('Failed to fetch');
    if (url === '/__storage/index') {
      return {
        ok: true,
        async json() {
          return { ok: true, index: { art: {} } };
        }
      };
    }
    if (url === '/__storage/file') {
      const body = JSON.parse(options.body || '{}');
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            file: {
              version: body.version,
              folder: body.folder,
              name: body.name,
              savedAt: body.savedAt,
              dataOmitted: true
            }
          };
        }
      };
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const failed = await saveServerFile('art', 'player-idle-art', document, { savedAt: 1111, version: 1 });
    assert.equal(failed.persisted, false);
    assert.equal(failed.reason.includes('Storage server unreachable'), true);

    online = true;
    const saved = await saveServerFile('art', 'player-idle-art', document, { savedAt: 2222, version: 1 });
    assert.equal(saved.persisted, true);
    assert.deepEqual(saved.data, document);
    assert.equal(calls.some((call) => call.url === '/__storage/index'), true);
    assert.equal(calls.some((call) => call.url === '/__storage/file'), true);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('serverStorage lists restores and deletes file versions', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const restoredDocument = { clips: [{ id: 'restored' }] };
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).startsWith('/__storage/versions')) {
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            versions: [{ id: 'v1', folder: 'cutscenes', name: 'c3', savedAt: 1000, size: 123 }]
          };
        }
      };
    }
    if (url === '/__storage/restore-version') {
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            file: { version: 1, folder: 'cutscenes', name: 'c3', savedAt: 2000, data: restoredDocument }
          };
        }
      };
    }
    if (String(url).startsWith('/__storage/version') && options.method === 'DELETE') {
      return { ok: true, async json() { return { ok: true }; } };
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const versions = await listServerFileVersions('cutscenes', 'c3');
    assert.equal(versions.length, 1);
    assert.equal(versions[0].id, 'v1');

    const restored = await restoreServerFileVersion('cutscenes', 'c3', 'v1');
    assert.deepEqual(restored.data, restoredDocument);
    assert.deepEqual(JSON.parse(readCachedProjectFile('cutscenes', 'c3')).data, restoredDocument);

    const deleted = await deleteServerFileVersion('cutscenes', 'c3', 'v1');
    assert.equal(deleted.ok, true);
    assert.equal(calls.some((call) => call.url === '/__storage/restore-version'), true);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('restoreServerFileVersion reloads metadata-only restores before updating cache', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const restoredDocument = { clips: [{ id: 'metadata-restored' }] };
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/__storage/restore-version') {
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            file: {
              version: 1,
              folder: 'cutscenes',
              name: 'c3',
              savedAt: 3000,
              dataOmitted: true
            }
          };
        }
      };
    }
    if (String(url).startsWith('/__storage/file')) {
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            file: {
              version: 1,
              folder: 'cutscenes',
              name: 'c3',
              savedAt: 3000,
              data: restoredDocument
            }
          };
        }
      };
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const restored = await restoreServerFileVersion('cutscenes', 'c3', 'v2');
    assert.deepEqual(restored.data, restoredDocument);
    assert.deepEqual(JSON.parse(readCachedProjectFile('cutscenes', 'c3')).data, restoredDocument);
    assert.equal(calls.some((call) => String(call.url).startsWith('/__storage/file')), true);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('renameServerFile preserves cached data when server returns metadata only', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const document = { frames: [{ id: 'frame-1' }] };
  upsertCachedProjectFile('art', 'old', JSON.stringify({
    version: 1,
    folder: 'art',
    name: 'old',
    savedAt: 1000,
    data: document
  }));
  globalThis.fetch = async (url) => {
    assert.equal(url, '/__storage/rename');
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          file: {
            version: 1,
            folder: 'art',
            name: 'new',
            savedAt: 2000,
            dataOmitted: true
          }
        };
      }
    };
  };
  try {
    const renamed = await renameServerFile('art', 'old', 'new');
    assert.deepEqual(renamed.data, document);
    assert.equal(readCachedProjectFile('art', 'old'), null);

    const cached = JSON.parse(readCachedProjectFile('art', 'new'));
    assert.deepEqual(cached.data, document);
    assert.equal(cached.savedAt, 2000);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});
