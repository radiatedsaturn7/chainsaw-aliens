const PROJECT_FILE_PREFIX = 'server-project-file:';
const DEFAULT_FOLDERS = ['levels', 'art', 'music', 'actors', 'sfx', 'cutscenes'];
const STATIC_STORAGE_ROOT = '/data/server-storage/files';

let syncQueue = Promise.resolve();
const volatileFiles = new Map();
let serverIndex = DEFAULT_FOLDERS.reduce((acc, folder) => { acc[folder] = {}; return acc; }, {});
let storageApiAvailable = true;

function fileKey(folder, name) {
  return `${PROJECT_FILE_PREFIX}${folder}:${name}`;
}

function parseFileKey(key) {
  const match = String(key || '').slice(PROJECT_FILE_PREFIX.length).match(/^([^:]+):(.+)$/);
  return match ? { folder: match[1], name: match[2] } : null;
}

function normalizeIndex(index = {}) {
  return DEFAULT_FOLDERS.reduce((acc, folder) => {
    acc[folder] = index?.[folder] && typeof index[folder] === 'object' ? { ...index[folder] } : {};
    return acc;
  }, {});
}

function updateCachedPayload(payload) {
  if (!payload?.folder || !payload?.name) return;
  const raw = JSON.stringify(payload);
  volatileFiles.set(fileKey(payload.folder, payload.name), raw);
  if (!serverIndex[payload.folder]) serverIndex[payload.folder] = {};
  serverIndex[payload.folder][payload.name] = {
    updatedAt: Number(payload.savedAt || Date.now()),
    size: raw.length
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error || payload?.reason || `HTTP ${response.status}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }
  return payload;
}

function isStorageApiUnavailable(error) {
  const message = String(error?.message || error || '');
  return error?.status === 404
    || error?.status === 405
    || message.includes('HTTP 404')
    || message.includes('HTTP 405')
    || message.toLowerCase().includes('failed to parse url')
    || message.toLowerCase().includes('failed to fetch');
}

function enqueueServerMutation(task) {
  const queued = syncQueue
    .catch(() => undefined)
    .then(task);
  queued.catch(() => undefined);
  syncQueue = queued;
  return queued;
}

async function fetchServerIndex() {
  if (storageApiAvailable) {
    try {
      const payload = await requestJson('/__storage/index');
      serverIndex = normalizeIndex(payload.index);
      return serverIndex;
    } catch (error) {
      if (!isStorageApiUnavailable(error)) throw error;
      storageApiAvailable = false;
    }
  }
  return hydrateStaticStorageFiles();
}

async function fetchServerFile(folder, name) {
  const payload = await requestJson(`/__storage/file?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`);
  updateCachedPayload(payload.file);
  return payload.file;
}

async function hydrateServerFiles() {
  const index = await fetchServerIndex();
  const count = Object.values(index).reduce((sum, files) => sum + Object.keys(files || {}).length, 0);
  return {
    ok: true,
    storageApiAvailable,
    stats: { pulledServer: 0, indexedServer: count, keptLocal: 0, merged: count, conflictsResolved: 0 }
  };
}

async function hydrateStaticStorageFiles() {
  const response = await fetch(`${STATIC_STORAGE_ROOT}/manifest.json`);
  if (!response.ok) {
    serverIndex = normalizeIndex(serverIndex);
    return serverIndex;
  }
  const manifest = await response.json().catch(() => null);
  const folders = manifest?.folders && typeof manifest.folders === 'object' ? manifest.folders : {};
  const nextIndex = normalizeIndex({});
  await Promise.all(DEFAULT_FOLDERS.flatMap((folder) => {
    const entries = folders[folder] && typeof folders[folder] === 'object' ? folders[folder] : {};
    return Object.entries(entries).map(async ([name, path]) => {
      if (!name || typeof path !== 'string') return;
      try {
        const cleanPath = path.split('/').map((part) => encodeURIComponent(decodeURIComponent(part))).join('/');
        const documentUrl = `${STATIC_STORAGE_ROOT}/${cleanPath}`;
        const metadataUrl = documentUrl.replace(/\/document\.json$/, '/metadata.json');
        const [documentResponse, metadataResponse] = await Promise.all([
          fetch(documentUrl),
          fetch(metadataUrl).catch(() => null)
        ]);
        if (!documentResponse.ok) return;
        const data = await documentResponse.json().catch(() => null);
        if (!data) return;
        const metadata = metadataResponse?.ok ? await metadataResponse.json().catch(() => ({})) : {};
        const savedAt = Number(metadata?.savedAt || Date.now());
        const payload = {
          version: Number(metadata?.version || 1),
          folder,
          name: typeof metadata?.name === 'string' && metadata.name ? metadata.name : name,
          savedAt,
          data
        };
        updateCachedPayload(payload);
        nextIndex[folder][payload.name] = {
          updatedAt: savedAt,
          size: JSON.stringify(payload).length
        };
      } catch (error) {
        // Static fallback is best-effort; keep loading any other readable files.
      }
    });
  }));
  serverIndex = normalizeIndex(nextIndex);
  return serverIndex;
}

function fetchServerFileSync(folder, name) {
  if (typeof XMLHttpRequest === 'undefined') return null;
  const xhr = new XMLHttpRequest();
  const url = `/__storage/file?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`;
  try {
    xhr.open('GET', url, false);
    xhr.send();
    if (xhr.status < 200 || xhr.status >= 300) return null;
    const payload = JSON.parse(xhr.responseText || '{}');
    if (!payload?.ok || !payload.file) return null;
    updateCachedPayload(payload.file);
    return payload.file;
  } catch (error) {
    return null;
  }
}

export function isServerStorageEnabled() {
  return true;
}

export function setServerStorageEnabled(enabled) {
  void enabled;
}

export function upsertCachedProjectFile(folder, name, raw) {
  if (!folder || !name || typeof raw !== 'string') return;
  volatileFiles.set(fileKey(folder, name), raw);
  try {
    const payload = JSON.parse(raw);
    if (!serverIndex[folder]) serverIndex[folder] = {};
    serverIndex[folder][name] = {
      updatedAt: Number(payload?.savedAt || Date.now()),
      size: raw.length
    };
  } catch (error) {
    if (!serverIndex[folder]) serverIndex[folder] = {};
    serverIndex[folder][name] = { updatedAt: Date.now(), size: raw.length };
  }
}

export function deleteCachedProjectFile(folder, name) {
  if (!folder || !name) return;
  volatileFiles.delete(fileKey(folder, name));
  if (serverIndex[folder]) delete serverIndex[folder][name];
}

export function readCachedProjectFile(folder, name) {
  if (!folder || !name) return null;
  const key = fileKey(folder, name);
  const cached = volatileFiles.get(key);
  if (cached) return cached;
  if (!serverIndex?.[folder]?.[name]) return null;
  const payload = fetchServerFileSync(folder, name);
  return payload ? volatileFiles.get(key) || null : null;
}

export function listCachedProjectFiles(folder) {
  if (folder === '*') {
    return Array.from(volatileFiles.entries())
      .map(([key, raw]) => {
        const parsed = parseFileKey(key);
        return parsed ? { ...parsed, raw } : null;
      })
      .filter(Boolean);
  }
  const prefix = `${PROJECT_FILE_PREFIX}${folder}:`;
  return Array.from(volatileFiles.entries())
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, raw]) => ({ name: key.slice(prefix.length), raw }));
}

export function clearCachedProjectFilesForTests() {
  volatileFiles.clear();
  serverIndex = DEFAULT_FOLDERS.reduce((acc, folder) => { acc[folder] = {}; return acc; }, {});
  storageApiAvailable = true;
}

export function listServerIndexedFiles(folder = null) {
  const index = normalizeIndex(serverIndex);
  if (folder) return index[folder] || {};
  return index;
}

export async function saveServerFile(folder, name, data, options = {}) {
  const savedAt = Number(options.savedAt || Date.now());
  const version = Number(options.version || 1);
  if (!storageApiAvailable) {
    return { version, folder, name, savedAt, data, persisted: false, reason: 'Storage API unavailable' };
  }
  try {
    const payload = await requestJson('/__storage/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, name, savedAt, version, data })
    });
    updateCachedPayload(payload.file);
    return { ...payload.file, persisted: true };
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    return { version, folder, name, savedAt, data, persisted: false, reason: error?.message || 'Storage API unavailable' };
  }
}

export function queueServerFileSave(folder, name, data, options = {}) {
  return enqueueServerMutation(() => saveServerFile(folder, name, data, options));
}

export async function deleteServerFile(folder, name) {
  if (!storageApiAvailable) {
    deleteCachedProjectFile(folder, name);
    return { ok: true, storageApiAvailable: false };
  }
  try {
    await requestJson(`/__storage/file?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`, { method: 'DELETE' });
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
  }
  deleteCachedProjectFile(folder, name);
  return { ok: true };
}

export function queueServerFileDelete(folder, name) {
  return enqueueServerMutation(() => deleteServerFile(folder, name));
}

export async function renameServerFile(folder, oldName, newName) {
  if (!storageApiAvailable) {
    const raw = readCachedProjectFile(folder, oldName);
    deleteCachedProjectFile(folder, oldName);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    const savedAt = Date.now();
    const renamed = { version: Number(payload?.version || 1), folder, name: newName, savedAt, data: payload.data };
    updateCachedPayload(renamed);
    return renamed;
  }
  try {
    const payload = await requestJson('/__storage/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, oldName, newName })
    });
    deleteCachedProjectFile(folder, oldName);
    updateCachedPayload(payload.file);
    return payload.file;
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    return renameServerFile(folder, oldName, newName);
  }
}

export function queueServerFileRename(folder, oldName, newName) {
  return enqueueServerMutation(() => renameServerFile(folder, oldName, newName));
}

export async function hydrateServerStorage() {
  return hydrateServerFiles();
}

export async function bootstrapServerStorage() {
  return hydrateServerFiles();
}

export async function flushServerStorage() {
  await syncQueue;
  return { ok: true };
}

export async function syncServerSnapshotToGitHub() {
  await syncQueue;
  try {
    const response = await fetch('/__storage/sync-github', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      return { ok: false, reason: payload?.stderr || payload?.error || `HTTP ${response.status}` };
    }
    return { ok: true, stdout: payload.stdout || '' };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}
