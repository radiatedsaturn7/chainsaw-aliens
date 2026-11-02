import {projectStorageUrl} from './projectStorageUrls.js';
const PROJECT_FILE_PREFIX = 'server-project-file:';
const DEFAULT_FOLDERS = ['levels', 'art', 'music', 'actors', 'sfx', 'cutscenes', 'races', 'cars', 'tires', 'models', 'menus', 'doodads', 'items', 'fonts', 'settings'];
const STATIC_STORAGE_ROOT = projectStorageUrl('data/server-storage/files');
let staticManifestPromise = null;
const staticLoads = new Map();
const STORAGE_REQUEST_TIMEOUT_MS = 12000;
const COMPACT_STORAGE_MARKER = '__chainsawStorage';
const COMPACT_STORAGE_VERSION = 'compact-v1';
const COMPACT_STORAGE_ENCODING = 'json-gzip-base64';
const ASSET_REF_MARKER = '__chainsawAssetRef';

let syncQueue = Promise.resolve();
const volatileFiles = new Map();
const volatileFileSources = new Map();
let serverIndex = DEFAULT_FOLDERS.reduce((acc, folder) => { acc[folder] = {}; return acc; }, {});
let storageApiAvailable = true;

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function fileKey(folder, name) {
  return `${PROJECT_FILE_PREFIX}${folder}:${name}`;
}

function parseFileKey(key) {
  const match = String(key || '').slice(PROJECT_FILE_PREFIX.length).match(/^([^:]+):(.+)$/);
  return match ? { folder: match[1], name: match[2] } : null;
}

function getCurrentStorageOrigin() {
  return typeof window !== 'undefined' && window?.location?.origin
    ? window.location.origin
    : 'this page';
}

function attachStorageSource(payload, source) {
  if (!payload || typeof payload !== 'object' || !source) return payload;
  try {
    Object.defineProperty(payload, 'storageSource', {
      value: source,
      configurable: true,
      enumerable: false,
      writable: true
    });
  } catch (error) {
    // Non-enumerable metadata is best-effort only.
  }
  return payload;
}

function resolveStaticStorageUrl(ref, baseUrl = '') {
  const value = String(ref || '');
  if (!value) return '';
  try {
    return new URL(value, baseUrl).toString();
  } catch (error) {
    const origin = typeof window !== 'undefined' && window?.location?.origin
      ? window.location.origin
      : 'http://localhost';
    return new URL(value, new URL(baseUrl || '/', origin)).toString();
  }
}

async function requestStatic(url, format = 'json') {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error(`Published file request timed out: ${url}`)); }, STORAGE_REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([(async () => {
      const response = await fetch(url, {signal: controller.signal});
      if (!response.ok) {
        const error = new Error(`Could not load published file ${url} (HTTP ${response.status})`);
        error.status = response.status;
        throw error;
      }
      return format === 'bytes' ? response.arrayBuffer() : response.json();
    })(), timeout]);
  } finally { clearTimeout(timer); }
}

function decodeBase64Bytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function decodeStoredProjectDocument(data, baseUrl = '') {
  let decoded = data;
  if (decoded && typeof decoded === 'object' && decoded[COMPACT_STORAGE_MARKER] === COMPACT_STORAGE_VERSION) {
    if (decoded.encoding !== COMPACT_STORAGE_ENCODING || typeof decoded.data !== 'string') {
      throw new Error('Unsupported compact storage document');
    }
    if (typeof DecompressionStream !== 'function') {
      throw new Error('Compact storage requires DecompressionStream support');
    }
    const bytes = decodeBase64Bytes(decoded.data);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    decoded = JSON.parse(text);
  }
  const hydrateAssets = async (value) => {
    if (Array.isArray(value)) {
      return Promise.all(value.map((entry) => hydrateAssets(entry)));
    }
    if (value && typeof value === 'object') {
      const ref = value[ASSET_REF_MARKER];
      const mime = value.mime;
      if (typeof ref === 'string' && typeof mime === 'string') {
        const buffer = await requestStatic(resolveStaticStorageUrl(ref, baseUrl), 'bytes');
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        return `data:${mime};base64,${btoa(binary)}`;
      }
      const result = {};
      await Promise.all(Object.entries(value).map(async ([key, entry]) => {
        result[key] = await hydrateAssets(entry);
      }));
      return result;
    }
    return value;
  };
  return hydrateAssets(decoded);
}

function normalizeIndex(index = {}) {
  return DEFAULT_FOLDERS.reduce((acc, folder) => {
    acc[folder] = index?.[folder] && typeof index[folder] === 'object' ? { ...index[folder] } : {};
    return acc;
  }, {});
}

function updateCachedPayload(payload, source = 'server') {
  if (!payload?.folder || !payload?.name) return false;
  const raw = JSON.stringify(payload);
  const key = fileKey(payload.folder, payload.name);
  // A late response must not replace edits saved while its request was in flight.
  const current = volatileFiles.get(key);
  if (current) {
    try {
      if (Number(JSON.parse(current).savedAt || 0) > Number(payload.savedAt || 0)) return false;
    } catch { /* Replace invalid cache entries. */ }
  }
  volatileFiles.set(key, raw);
  volatileFileSources.set(key, source);
  if (!serverIndex[payload.folder]) serverIndex[payload.folder] = {};
  serverIndex[payload.folder][payload.name] = {
    updatedAt: Number(payload.savedAt || Date.now()),
    size: raw.length
  };
  return true;
}

async function requestJson(url, options = {}) {
  url = projectStorageUrl(url);
  const { timeoutMs = STORAGE_REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort?.();
      const error = new Error(`Storage request timed out after ${timeoutMs}ms`);
      error.name = 'TimeoutError';
      error.status = 408;
      error.url = url;
      reject(error);
    }, Math.max(1, Number(timeoutMs) || STORAGE_REQUEST_TIMEOUT_MS));
  });
  try {
    const response = await Promise.race([
      fetch(url, controller ? { ...fetchOptions, signal: controller.signal } : fetchOptions),
      timeoutPromise
    ]);
    const payload = await Promise.race([response.json(), timeoutPromise]).catch(error => {
      // Static hosts can return an HTML 404 for the absent storage API.
      if (!response.ok && error.name !== 'TimeoutError') { error.status = response.status; error.url = url; }
      throw error;
    });
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || payload?.reason || `HTTP ${response.status}`);
      error.status = response.status;
      error.url = url;
      throw error;
    }
    return payload;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function isStorageApiUnavailable(error) {
  const message = String(error?.message || error || '');
  return error instanceof TypeError || error instanceof SyntaxError || Number(error?.status) >= 500
    || error?.status === 404
    || error?.status === 405
    || message.includes('HTTP 404')
    || message.includes('HTTP 405')
    || message.toLowerCase().includes('failed to parse url')
    || message.toLowerCase().includes('failed to fetch')
    || message.toLowerCase().includes('timed out')
    || error?.name === 'AbortError'
    || error?.name === 'TimeoutError'
    || error?.status === 408;
}

function getStorageUnavailableReason(error) {
  const message = String(error?.message || error || '');
  if (message.toLowerCase().includes('failed to fetch')) return 'Storage API request failed.';
  if (message.toLowerCase().includes('timed out') || error?.name === 'TimeoutError' || error?.status === 408) {
    return 'Storage server timed out. Your local save is cached; try again after the server responds.';
  }
  if (message.toLowerCase().includes('failed to parse url')) return 'Storage server URL is unavailable from this page.';
  if (error?.status === 404 || message.includes('HTTP 404')) return 'Storage API endpoint was not found on this server.';
  if (error?.status === 405 || message.includes('HTTP 405')) return 'Storage API does not accept saves on this server.';
  return message || 'Storage API unavailable';
}

function isHardStorageApiUnavailable(error) {
  const message = String(error?.message || error || '');
  return error?.status === 404
    || error?.status === 405
    || message.includes('HTTP 404')
    || message.includes('HTTP 405')
    || message.toLowerCase().includes('failed to parse url');
}

function getStorageSaveFailureReason(error) {
  const message = String(error?.message || error || '');
  const origin = getCurrentStorageOrigin();
  const endpoint = `${origin}${projectStorageUrl('__storage/file')}`;
  if (isHardStorageApiUnavailable(error)) {
    return `Save failed: ${endpoint} is not accepting project file saves (${message || `HTTP ${error?.status}`}).`;
  }
  if (message.toLowerCase().includes('timed out') || error?.name === 'TimeoutError' || error?.status === 408) {
    return `Save failed: ${endpoint} timed out. Your local copy is cached; try saving again.`;
  }
  if (message.toLowerCase().includes('failed to fetch') || error?.name === 'AbortError') {
    return `Save failed: could not send request to ${endpoint}. Your local copy is cached; try saving again.`;
  }
  return `Save failed: ${endpoint} returned ${message || 'an unknown error'}.`;
}

function enqueueServerMutation(task) {
  const queued = syncQueue
    .catch(() => undefined)
    .then(task);
  queued.catch(() => undefined);
  syncQueue = queued;
  return queued;
}

async function probeStorageApi() {
  try {
    const payload = await requestJson('/__storage/index');
    serverIndex = normalizeIndex(payload.index);
    storageApiAvailable = true;
    return true;
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    return false;
  }
}

async function fetchServerIndex(folder = null) {
  if (storageApiAvailable) {
    try {
      const suffix = folder ? `?folder=${encodeURIComponent(folder)}` : '';
      const payload = await requestJson(`/__storage/index${suffix}`);
      const nextIndex = normalizeIndex(payload.index);
      serverIndex = folder
        ? normalizeIndex({ ...serverIndex, [folder]: nextIndex[folder] || {} })
        : nextIndex;
      return serverIndex;
    } catch (error) {
      if (!isStorageApiUnavailable(error)) throw error;
      storageApiAvailable = false;
    }
  }
  return hydrateStaticStorageFiles();
}

async function fetchServerFile(folder, name, options = {}) {
  let payload;
  try {
    payload = await requestJson(`/__storage/file?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`, {timeoutMs: options.timeoutMs});
  } catch (error) {
    // A valid API reporting a missing file is not a missing API endpoint.
    if (error.status === 404 && error.message === 'File not found') return null;
    throw error;
  }
  // Keep the already decoded response on a fresh load. Parsing the just-written
  // cache duplicates every large sprite-sheet allocation on the main thread.
  if (updateCachedPayload(payload.file, 'server')) return attachStorageSource(payload.file, 'server');
  const key = fileKey(folder, name);
  const cached = volatileFiles.get(key);
  return attachStorageSource(cached ? JSON.parse(cached) : payload.file, volatileFileSources.get(key) || 'server');
}

async function hydrateServerFiles(options = {}) {
  const folder = DEFAULT_FOLDERS.includes(options?.folder) ? options.folder : null;
  const index = await fetchServerIndex(folder);
  const count = folder
    ? Object.keys(index?.[folder] || {}).length
    : Object.values(index).reduce((sum, files) => sum + Object.keys(files || {}).length, 0);
  return {
    ok: true,
    storageApiAvailable,
    readOnly: !storageApiAvailable,
    stats: { pulledServer: 0, indexedServer: count, keptLocal: 0, merged: count, conflictsResolved: 0 }
  };
}

async function loadStaticManifest() {
  if (!staticManifestPromise) {
    staticManifestPromise = requestStatic(`${STATIC_STORAGE_ROOT}/manifest.json`)
      .then(manifest => {
        if (!manifest?.folders || typeof manifest.folders !== 'object') throw new Error('Invalid published project index');
        return manifest.folders;
      }).catch(error => { staticManifestPromise = null; throw error; });
  }
  return staticManifestPromise;
}

async function fetchStaticFile(folder, name) {
  const key = fileKey(folder, name);
  if (staticLoads.has(key)) return staticLoads.get(key);
  const load = (async () => {
    const folders = await loadStaticManifest();
    const path = folders[folder]?.[name];
    if (typeof path !== 'string') return null;
    // Manifest paths are filesystem names, not already URL-encoded URLs. A
    // literal percent sign must survive the HTTP server's one decoding pass.
    const documentUrl = `${STATIC_STORAGE_ROOT}/${path.split('/').map(encodeURIComponent).join('/')}`;
    const metadataUrl = documentUrl.replace(/\/document\.json$/, '/metadata.json');
    const [storedData, metadata] = await Promise.all([
      requestStatic(documentUrl), requestStatic(metadataUrl).catch(error => {
        if (error.status === 404) return {};
        throw error;
      })
    ]);
    if (metadata.deleted) { delete serverIndex[folder]?.[name]; return null; }
    const data = await decodeStoredProjectDocument(storedData, documentUrl);
    const payload = {version: Number(metadata.version || 1), folder, name,
      savedAt: Number(metadata.savedAt || 0), data};
    updateCachedPayload(payload, 'static');
    serverIndex[folder][name] = {...serverIndex[folder][name], systemFile: metadata.systemFile === true};
    const raw = volatileFiles.get(key);
    return attachStorageSource(raw ? JSON.parse(raw) : payload, volatileFileSources.get(key) || 'static');
  })().finally(() => staticLoads.delete(key));
  staticLoads.set(key, load);
  return load;
}

async function hydrateStaticStorageFiles() {
  const folders = await loadStaticManifest();
  // Listing never reads document bodies. Selected files and their resources are
  // hydrated before the editor receives them; legacy sync readers use that cache.
  for (const folder of DEFAULT_FOLDERS) {
    for (const name of Object.keys(folders[folder] || {})) {
      if (!serverIndex[folder]) serverIndex[folder] = {};
      serverIndex[folder][name] ||= {updatedAt: 0, size: 0};
    }
  }
  return serverIndex;
}

const RESOURCE_FOLDERS = ['art', 'music', 'actors', 'sfx', 'cars', 'tires', 'models', 'doodads', 'items', 'fonts'];
async function hydrateStaticDependencies(payload) {
  if (!payload?.data || payload.folder === 'settings') return;
  const folders = await loadStaticManifest();
  const references = new Map();
  for (const folder of RESOURCE_FOLDERS) for (const name of Object.keys(folders[folder] || {})) {
    if (!references.has(name)) references.set(name, []);
    references.get(name).push({folder, name});
  }
  const visited = new Set([fileKey(payload.folder, payload.name)]);
  let pending = [payload.data];
  while (pending.length) {
    const wanted = [];
    const scan = value => {
      if (typeof value === 'string') {
        for (const ref of references.get(value) || []) {
          const key = fileKey(ref.folder, ref.name);
          if (!visited.has(key)) { visited.add(key); wanted.push(ref); }
        }
      } else if (Array.isArray(value)) {
        for (const entry of value) scan(entry);
      } else if (value && typeof value === 'object') {
        for (const entry of Object.values(value)) scan(entry);
      }
    };
    for (const data of pending) scan(data);
    pending = [];
    let cursor = 0;
    await Promise.all(Array.from({length: Math.min(3, wanted.length)}, async () => {
      while (cursor < wanted.length) {
        const {folder, name} = wanted[cursor++];
        const raw = volatileFiles.get(fileKey(folder, name));
        const dependency = raw ? JSON.parse(raw) : await fetchStaticFile(folder, name);
        if (dependency?.data) pending.push(dependency.data);
      }
    }));
  }
}

function fetchServerFileSync(folder, name) {
  if (typeof XMLHttpRequest === 'undefined') return null;
  const xhr = new XMLHttpRequest();
  const url = projectStorageUrl(`/__storage/file?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`);
  try {
    xhr.open('GET', url, false);
    xhr.send();
    if (xhr.status < 200 || xhr.status >= 300) return null;
    const payload = JSON.parse(xhr.responseText || '{}');
    if (!payload?.ok || !payload.file) return null;
    updateCachedPayload(payload.file, 'server-sync');
    return attachStorageSource(payload.file, 'server-sync');
  } catch (error) {
    return null;
  }
}

export function isProjectStorageReadOnly() {
  return !storageApiAvailable;
}

export function isServerStorageEnabled() {
  return true;
}

export function setServerStorageEnabled(enabled) {
  void enabled;
}

export function upsertCachedProjectFile(folder, name, raw) {
  if (!folder || !name || typeof raw !== 'string') return;
  const key = fileKey(folder, name);
  volatileFiles.set(key, raw);
  volatileFileSources.set(key, 'cache');
  if (!serverIndex[folder]) serverIndex[folder] = {};
  const existing = serverIndex[folder][name];
  try {
    const payload = JSON.parse(raw);
    serverIndex[folder][name] = {
      ...existing,
      updatedAt: Number(existing?.updatedAt || payload?.savedAt || Date.now()),
      size: raw.length
    };
  } catch (error) {
    serverIndex[folder][name] = {
      ...existing,
      updatedAt: Number(existing?.updatedAt || Date.now()),
      size: raw.length
    };
  }
}

export function deleteCachedProjectFile(folder, name) {
  if (!folder || !name) return;
  const key = fileKey(folder, name);
  volatileFiles.delete(key);
  volatileFileSources.delete(key);
  if (serverIndex[folder]) delete serverIndex[folder][name];
}

export function readCachedProjectFile(folder, name, {allowSyncFetch = true} = {}) {
  if (!folder || !name) return null;
  const key = fileKey(folder, name);
  const cached = volatileFiles.get(key);
  if (cached) return cached;
  if (!storageApiAvailable || !allowSyncFetch || !serverIndex?.[folder]?.[name]) return null;
  const payload = fetchServerFileSync(folder, name);
  return payload ? volatileFiles.get(key) || null : null;
}

async function hydrateProjectFileOnly(folder, name, options = {}) {
  if (!folder || !name) return null;
  const key = fileKey(folder, name);
  const freshness = String(options?.freshness || '').trim().toLowerCase();
  const requireNewest = freshness === 'newest' || options?.forceRefresh === true;
  let cachedPayload = null;
  let cachedSource = volatileFileSources.get(key) || 'cache';
  if (volatileFiles.has(key)) {
    try {
      cachedPayload = JSON.parse(volatileFiles.get(key));
      if (!requireNewest) return attachStorageSource(cachedPayload, cachedSource);
    } catch (error) {
      cachedPayload = null;
    }
  }
  if (storageApiAvailable || requireNewest) {
    try {
      const serverPayload = await fetchServerFile(folder, name, options);
      storageApiAvailable = true;
      if (cachedPayload
        && Number(cachedPayload.savedAt || 0) > Number(serverPayload?.savedAt || 0)) {
        updateCachedPayload(cachedPayload, cachedSource);
        return attachStorageSource(cachedPayload, cachedSource);
      }
      return serverPayload;
    } catch (error) {
      if (!isStorageApiUnavailable(error)) throw error;
      storageApiAvailable = false;
    }
  }
  if (cachedPayload) {
    return attachStorageSource(cachedPayload, cachedSource);
  }
  await fetchStaticFile(folder, name);
  const cached = volatileFiles.get(key);
  if (!cached) return null;
  try {
    return attachStorageSource(JSON.parse(cached), volatileFileSources.get(key) || 'cache');
  } catch (error) {
    return null;
  }
}

export async function hydrateProjectFile(folder, name, options = {}) {
  const payload = await hydrateProjectFileOnly(folder, name, options);
  if (payload?.storageSource === 'static') await hydrateStaticDependencies(payload);
  return payload;
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
  volatileFileSources.clear();
  staticManifestPromise = null;
  staticLoads.clear();
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
  const createVersion = options.createVersion !== false;
  try {
    const payload = await requestJson('/__storage/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, name, savedAt, version, createVersion, data }),
      timeoutMs: options.timeoutMs
    });
    const responseFile = payload.file && typeof payload.file === 'object' ? payload.file : {};
    const savedFile = {
      version,
      folder,
      name,
      savedAt,
      ...responseFile,
      data: hasOwn(responseFile, 'data') ? responseFile.data : data
    };
    updateCachedPayload(savedFile, 'server');
    storageApiAvailable = true;
    return { ...savedFile, persisted: true };
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    if (isHardStorageApiUnavailable(error)) storageApiAvailable = false;
    return { version, folder, name, savedAt, data, persisted: false, reason: getStorageSaveFailureReason(error) };
  }
}

export function queueServerFileSave(folder, name, data, options = {}) {
  return enqueueServerMutation(() => saveServerFile(folder, name, data, options));
}

export async function deleteServerFile(folder, name) {
  if (!storageApiAvailable) throw new Error('Published project files are read-only; deletion requires the storage server.');
  try {
    await requestJson(`/__storage/file?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`, { method: 'DELETE' });
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    throw new Error('Published project files are read-only; deletion requires the storage server.');
  }
  deleteCachedProjectFile(folder, name);
  return { ok: true };
}

export function queueServerFileDelete(folder, name) {
  return enqueueServerMutation(() => deleteServerFile(folder, name));
}

export async function listServerFileVersions(folder, name) {
  if (!storageApiAvailable) return [];
  try {
    const payload = await requestJson(`/__storage/versions?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`);
    return Array.isArray(payload.versions) ? payload.versions : [];
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    return [];
  }
}

export async function loadServerFileVersion(folder, name, versionId) {
  if (!storageApiAvailable || !versionId) return null;
  try {
    const payload = await requestJson(`/__storage/version?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}&versionId=${encodeURIComponent(versionId)}`);
    return payload.file || null;
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    return null;
  }
}

export async function restoreServerFileVersion(folder, name, versionId) {
  if (!storageApiAvailable || !versionId) return null;
  try {
    const payload = await requestJson('/__storage/restore-version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, name, versionId })
    });
    const responseFile = payload.file && typeof payload.file === 'object' ? payload.file : {};
    const restored = hasOwn(responseFile, 'data')
      ? responseFile
      : await fetchServerFile(folder, name);
    if (restored) updateCachedPayload(restored);
    return restored;
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    return null;
  }
}

export async function deleteServerFileVersion(folder, name, versionId) {
  if (!storageApiAvailable || !versionId) return { ok: false };
  try {
    await requestJson(`/__storage/version?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}&versionId=${encodeURIComponent(versionId)}`, { method: 'DELETE' });
    return { ok: true };
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    return { ok: false };
  }
}

export async function renameServerFile(folder, oldName, newName) {
  if (!storageApiAvailable) throw new Error('Published project files are read-only; renaming requires the storage server.');
  try {
    const oldRaw = readCachedProjectFile(folder, oldName);
    let oldPayload = null;
    if (oldRaw) {
      try {
        oldPayload = JSON.parse(oldRaw);
      } catch (error) {
        oldPayload = null;
      }
    }
    const payload = await requestJson('/__storage/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, oldName, newName })
    });
    const responseFile = payload.file && typeof payload.file === 'object' ? payload.file : {};
    deleteCachedProjectFile(folder, oldName);
    if (!hasOwn(responseFile, 'data') && oldPayload?.data === undefined) {
      return fetchServerFile(folder, newName);
    }
    const renamed = {
      version: Number(oldPayload?.version || 1),
      folder,
      name: newName,
      savedAt: Date.now(),
      ...responseFile,
      data: hasOwn(responseFile, 'data') ? responseFile.data : oldPayload.data
    };
    updateCachedPayload(renamed);
    return renamed;
  } catch (error) {
    if (!isStorageApiUnavailable(error)) throw error;
    storageApiAvailable = false;
    return renameServerFile(folder, oldName, newName);
  }
}

export function queueServerFileRename(folder, oldName, newName) {
  return enqueueServerMutation(() => renameServerFile(folder, oldName, newName));
}

export async function hydrateServerStorage(options = {}) {
  return hydrateServerFiles(options);
}

export async function bootstrapServerStorage(options = {}) {
  return hydrateServerFiles(options);
}

export async function flushServerStorage() {
  await syncQueue;
  return { ok: true };
}

export async function syncServerSnapshotToGitHub() {
  await syncQueue;
  try {
    const response = await fetch(projectStorageUrl('/__storage/sync-github'), { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      return { ok: false, reason: payload?.stderr || payload?.error || `HTTP ${response.status}` };
    }
    return { ok: true, stdout: payload.stdout || '' };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}
