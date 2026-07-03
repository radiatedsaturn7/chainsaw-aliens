import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hydrateProjectFile,
  hydrateServerStorage,
  clearCachedProjectFilesForTests,
  deleteServerFileVersion,
  listServerFileVersions,
  listServerIndexedFiles,
  readCachedProjectFile,
  queueServerFileSave,
  renameServerFile,
  restoreServerFileVersion,
  saveServerFile,
  upsertCachedProjectFile
} from '../../src/ui/serverStorage.js';
import {
  getProjectFileSaveTimeoutMs,
  resetProjectFilesForTests,
  saveProjectFileAndConfirm
} from '../../src/ui/projectFiles.js';

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

test('saveServerFile sends versioning policy to storage API', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, '/__storage/file');
    const body = JSON.parse(options.body || '{}');
    bodies.push(body);
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
    await saveServerFile('music', 'manual-song', { tracks: [] }, { savedAt: 1234, version: 1 });
    await saveServerFile('music', 'autosave-song', { tracks: [] }, { savedAt: 1235, version: 1, createVersion: false });

    assert.equal(bodies[0].createVersion, true);
    assert.equal(bodies[1].createVersion, false);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('saveServerFile reports failed save requests without poisoning later saves', async () => {
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
    assert.equal(failed.reason.includes('could not send request to'), true);
    assert.equal(failed.reason.toLowerCase().includes('unreachable'), false);
    assert.equal(failed.reason.toLowerCase().includes('reload'), false);

    online = true;
    const saved = await saveServerFile('art', 'player-idle-art', document, { savedAt: 2222, version: 1 });
    assert.equal(saved.persisted, true);
    assert.deepEqual(saved.data, document);
    assert.equal(calls.some((call) => call.url === '/__storage/index'), false);
    assert.equal(calls.some((call) => call.url === '/__storage/file'), true);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('queued server saves time out instead of hanging and recover on the next save', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const document = { tracks: [{ notes: [{ pitch: 60, startTick: 0, durationTicks: 4 }] }] };
  let online = false;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (!online) {
      return new Promise(() => {});
    }
    if (url === '/__storage/index') {
      return {
        ok: true,
        async json() {
          return { ok: true, index: { music: {} } };
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
    const failed = await queueServerFileSave('music', 'slow-song', document, { savedAt: 3333, version: 1, timeoutMs: 5 });
    assert.equal(failed.persisted, false);
    assert.equal(failed.reason.includes('timed out'), true);

    online = true;
    const saved = await queueServerFileSave('music', 'fast-song', document, { savedAt: 4444, version: 1, timeoutMs: 50 });
    assert.equal(saved.persisted, true);
    assert.deepEqual(saved.data, document);
    assert.equal(calls.some((call) => call.url === '/__storage/index'), false);
    assert.equal(calls.filter((call) => call.url === '/__storage/file').length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('confirmed project saves use larger storage timeouts for large documents', () => {
  assert.equal(getProjectFileSaveTimeoutMs(64 * 1024), 12000);
  assert.equal(getProjectFileSaveTimeoutMs(2 * 1024 * 1024), 22000);
  assert.equal(getProjectFileSaveTimeoutMs(64 * 1024, { timeoutMs: 42 }), 42);
  assert.equal(getProjectFileSaveTimeoutMs(256 * 1024 * 1024), 300000);
});

test('confirmed art saves persist free bone joint mode after server confirmation', async () => {
  resetProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const document = {
    kind: 'actor-state-animation',
    width: 8,
    height: 8,
    fps: 8,
    frames: [Array.from({ length: 64 }, () => null)],
    editor: {
      width: 8,
      height: 8,
      activeLayerIndex: 0,
      frames: [],
      bones: {
        version: 1,
        joints: [
          { id: 'joint-1', x: 1, y: 1 },
          { id: 'joint-2', x: 6, y: 1 }
        ],
        bones: [{
          id: 'bone-1',
          name: 'Free Bone',
          startJointId: 'joint-1',
          endJointId: 'joint-2',
          start: { x: 1, y: 1 },
          end: { x: 6, y: 1 },
          jointMode: 'free',
          jointModeVersion: 2
        }],
        bindings: [],
        poses: [],
        poseTimeline: []
      }
    }
  };
  let posted = null;
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, '/__storage/file');
    posted = JSON.parse(options.body || '{}');
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          file: {
            version: posted.version,
            folder: posted.folder,
            name: posted.name,
            savedAt: posted.savedAt,
            dataOmitted: true
          }
        };
      }
    };
  };
  try {
    const saved = await saveProjectFileAndConfirm('art', 'free-bone-save', document);
    assert.equal(saved.persisted, true);
    assert.equal(posted.data.editor.bones.bones[0].jointMode, 'free');
    assert.equal(saved.data.editor.bones.bones[0].jointMode, 'free');
  } finally {
    globalThis.fetch = originalFetch;
    resetProjectFilesForTests();
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

test('hydrateServerStorage can refresh one folder without loading all folders', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    assert.equal(url, '/__storage/index?folder=art');
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          index: {
            art: {
              player: { updatedAt: 1234, size: 55 }
            },
            music: {
              ignored: { updatedAt: 1, size: 1 }
            }
          }
        };
      }
    };
  };
  try {
    const result = await hydrateServerStorage({ folder: 'art' });
    assert.equal(result.ok, true);
    assert.equal(result.stats.indexedServer, 1);
    assert.deepEqual(Object.keys(listServerIndexedFiles('art')), ['player']);
    assert.deepEqual(Object.keys(listServerIndexedFiles('music')), []);
    assert.deepEqual(calls, ['/__storage/index?folder=art']);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('hydrateProjectFile fetches one selected file and caches it', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const document = { frames: [['#ffffff']] };
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    assert.equal(url, '/__storage/file?folder=art&name=player');
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          file: { version: 1, folder: 'art', name: 'player', savedAt: 2222, data: document }
        };
      }
    };
  };
  try {
    const payload = await hydrateProjectFile('art', 'player');
    assert.deepEqual(payload.data, document);
    assert.deepEqual(JSON.parse(readCachedProjectFile('art', 'player')).data, document);
    assert.deepEqual(calls, ['/__storage/file?folder=art&name=player']);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});

test('static fallback open tracks source and later save retries live POST directly', async () => {
  clearCachedProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const document = {
    frames: [['#ff00ff']],
    assets: [{
      id: 'image-1',
      dataUrl: { __chainsawAssetRef: 'assets/image-1.png', mime: 'image/png' }
    }]
  };
  const calls = [];
  let postOnline = false;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).startsWith('/__storage/file') && options.method !== 'POST') {
      return { ok: false, async json() { return { ok: false, error: 'HTTP 404' }; } };
    }
    if (url === '/data/server-storage/files/manifest.json') {
      return {
        ok: true,
        async json() {
          return { folders: { art: { player: 'art/player/document.json' } } };
        }
      };
    }
    if (url === '/data/server-storage/files/art/player/document.json') {
      return { ok: true, async json() { return document; } };
    }
    if (url === '/data/server-storage/files/art/player/metadata.json') {
      return { ok: true, async json() { return { name: 'player', savedAt: 1234, version: 1 }; } };
    }
    if (url === 'http://localhost/data/server-storage/files/art/player/assets/image-1.png') {
      return {
        ok: true,
        async arrayBuffer() { return Uint8Array.from([137, 80, 78, 71]).buffer; }
      };
    }
    if (url === '/__storage/file' && options.method === 'POST') {
      if (!postOnline) {
        return { ok: false, status: 404, async json() { return { ok: false, error: 'No POST storage here' }; } };
      }
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
    const opened = await hydrateProjectFile('art', 'player');
    assert.equal(opened.data.assets[0].dataUrl, 'data:image/png;base64,iVBORw==');
    assert.equal(opened.storageSource, 'static');

    const failed = await saveServerFile('art', 'player', document, { savedAt: 2222, version: 1 });
    assert.equal(failed.persisted, false);
    assert.equal(failed.reason.includes('/__storage/file'), true);
    assert.equal(failed.reason.includes('not accepting project file saves'), true);
    assert.equal(failed.reason.toLowerCase().includes('unreachable'), false);
    assert.equal(failed.reason.toLowerCase().includes('reload'), false);

    postOnline = true;
    const saved = await saveServerFile('art', 'player', document, { savedAt: 3333, version: 1 });
    assert.equal(saved.persisted, true);
    assert.deepEqual(saved.data, document);
    assert.equal(calls.filter((call) => call.url === '/__storage/file' && call.options.method === 'POST').length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedProjectFilesForTests();
  }
});
