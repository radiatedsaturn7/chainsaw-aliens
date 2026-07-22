/**
 * Project file facade backed by per-file server storage.
 *
 * How it works:
 * - Files are grouped into fixed folders: levels, art, music, actors, sfx, cutscenes, races, cars, doodads.
 * - File payloads are cached in memory while the app is running.
 * - Saves are written directly to individual server files.
 * - Each payload includes version/folder/name/savedAt/data, where `data`
 *   is the editor-specific JSON object already used by the app.
 */

import {
  deleteCachedProjectFile,
  listServerIndexedFiles,
  listCachedProjectFiles,
  queueServerFileDelete,
  queueServerFileRename,
  queueServerFileSave,
  readCachedProjectFile,
  upsertCachedProjectFile,
  clearCachedProjectFilesForTests,
  deleteServerFileVersion,
  hydrateProjectFile,
  listServerFileVersions,
  loadServerFileVersion,
  restoreServerFileVersion
} from './serverStorage.js';

const FOLDERS = ['levels', 'art', 'music', 'actors', 'sfx', 'cutscenes', 'races', 'cars', 'doodads'];
const parsedPayloadCache = new Map();
const LARGE_PARSED_PAYLOAD_LIMIT = 8 * 1024 * 1024;
const DEFAULT_SAVE_CONFIRM_TIMEOUT_MS = 12000;
const MAX_SAVE_CONFIRM_TIMEOUT_MS = 300000;
const LARGE_SAVE_TIMEOUT_BYTES = 1024 * 1024;
const LARGE_SAVE_TIMEOUT_MS_PER_MB = 10000;

const emptyIndex = () => FOLDERS.reduce((index, folder) => {
  index[folder] = {};
  return index;
}, {});

function getCachedPayloadMeta(raw) {
  const fallback = { updatedAt: Date.now(), size: typeof raw === 'string' ? raw.length : 0 };
  if (typeof raw !== 'string') return fallback;
  try {
    const payload = JSON.parse(raw);
    return {
      updatedAt: Number(payload?.savedAt || fallback.updatedAt),
      size: raw.length
    };
  } catch (error) {
    return fallback;
  }
}

export function ensureProjectFileIndex() {
  let index = emptyIndex();
  const serverIndex = listServerIndexedFiles();
  FOLDERS.forEach((folder) => {
    index[folder] = { ...(serverIndex[folder] || {}) };
  });
  listCachedProjectFiles('*').forEach(({ folder, name, raw }) => {
    if (!FOLDERS.includes(folder) || !name || typeof raw !== 'string') return;
    const cachedMeta = getCachedPayloadMeta(raw);
    const serverMeta = index[folder][name];
    index[folder][name] = serverMeta
      ? { ...serverMeta, size: Math.max(Number(serverMeta.size || 0), cachedMeta.size) }
      : cachedMeta;
  });
  return index;
}

function assertFolder(folder) {
  if (!FOLDERS.includes(folder)) throw new Error(`Invalid project file folder: ${folder}`);
}

function saveIndex(index) {
  void index;
}

function cacheParsedPayload(cacheKey, raw, payload) {
  if (typeof raw === 'string' && raw.length > LARGE_PARSED_PAYLOAD_LIMIT) {
    parsedPayloadCache.forEach((entry, key) => {
      if (key !== cacheKey && typeof entry?.raw === 'string' && entry.raw.length > LARGE_PARSED_PAYLOAD_LIMIT) {
        parsedPayloadCache.delete(key);
      }
    });
  }
  parsedPayloadCache.set(cacheKey, { raw, payload });
}

export function getProjectFileSaveTimeoutMs(rawLength = 0, options = {}) {
  if (Number.isFinite(options.timeoutMs)) {
    return Math.max(1, Math.round(options.timeoutMs));
  }
  const bytes = Math.max(0, Number(rawLength) || 0);
  if (bytes <= LARGE_SAVE_TIMEOUT_BYTES) return DEFAULT_SAVE_CONFIRM_TIMEOUT_MS;
  const extraMb = Math.ceil((bytes - LARGE_SAVE_TIMEOUT_BYTES) / LARGE_SAVE_TIMEOUT_BYTES);
  return Math.min(
    MAX_SAVE_CONFIRM_TIMEOUT_MS,
    DEFAULT_SAVE_CONFIRM_TIMEOUT_MS + extraMb * LARGE_SAVE_TIMEOUT_MS_PER_MB
  );
}

export function sanitizeProjectFileName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 64);
}

export function listProjectFiles(folder) {
  assertFolder(folder);
  const index = ensureProjectFileIndex();
  const listed = Object.entries(index[folder] || {})
    .map(([name, meta]) => ({
      name,
      updatedAt: Number(meta?.updatedAt || 0),
      size: Number(meta?.size || 0),
      deleted: Boolean(meta?.deleted),
      versionCount: Number(meta?.versionCount || 0)
    }));
  listCachedProjectFiles(folder).forEach(({ name, raw }) => {
    const existing = listed.find((entry) => entry.name === name);
    const cachedMeta = getCachedPayloadMeta(raw);
    if (existing) {
      existing.size = Math.max(existing.size || 0, cachedMeta.size);
    } else {
      listed.push({ name, updatedAt: cachedMeta.updatedAt, size: cachedMeta.size });
    }
  });
  listed.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  return listed;
}

export function projectFileExists(folder, name) {
  const clean = sanitizeProjectFileName(name);
  if (!clean) return false;
  const index = ensureProjectFileIndex();
  return Boolean(index?.[folder]?.[clean]);
}

export function loadProjectFile(folder, name) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean) return null;
  try {
    const raw = readCachedProjectFile(folder, clean);
    if (!raw) return null;
    const cacheKey = `${folder}:${clean}`;
    const cached = parsedPayloadCache.get(cacheKey);
    if (cached?.raw === raw) return cached.payload;
    const payload = JSON.parse(raw);
    cacheParsedPayload(cacheKey, raw, payload);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function hydrateProjectFilePayload(folder, name) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean) return null;
  const payload = await hydrateProjectFile(folder, clean);
  if (!payload) return null;
  const raw = JSON.stringify(payload);
  cacheParsedPayload(`${folder}:${clean}`, raw, payload);
  return payload;
}

export function saveProjectFile(folder, name, dataObj, options = {}) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean) return null;
  const savedAt = Date.now();
  const payload = {
    version: 1,
    folder,
    name: clean,
    savedAt,
    data: dataObj
  };
  const raw = JSON.stringify(payload);
  cacheParsedPayload(`${folder}:${clean}`, raw, payload);
  upsertCachedProjectFile(folder, clean, raw);
  const index = ensureProjectFileIndex();
  index[folder][clean] = { updatedAt: savedAt, size: raw.length };
  saveIndex(index);
  const syncPromise = queueServerFileSave(folder, clean, dataObj, {
    savedAt,
    version: 1,
    createVersion: options.createVersion !== false,
    timeoutMs: getProjectFileSaveTimeoutMs(raw.length, options)
  });
  return { ...payload, syncPromise };
}

export async function saveProjectFileAndConfirm(folder, name, dataObj, options = {}) {
  const saved = saveProjectFile(folder, name, dataObj, options);
  if (!saved) throw new Error('Invalid file name');
  const persisted = await saved.syncPromise;
  if (!persisted) throw new Error('Server did not confirm file save');
  if (persisted.persisted === false) {
    throw new Error(persisted.reason || 'Server did not persist file');
  }
  return { ...saved, ...persisted, data: dataObj };
}

export function deleteProjectFile(folder, name) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean) return;
  deleteCachedProjectFile(folder, clean);
  parsedPayloadCache.delete(`${folder}:${clean}`);
  const index = ensureProjectFileIndex();
  if (index[folder]) delete index[folder][clean];
  saveIndex(index);
  queueServerFileDelete(folder, clean);
}

export function discardCachedProjectFile(folder, name) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean) return;
  deleteCachedProjectFile(folder, clean);
  parsedPayloadCache.delete(`${folder}:${clean}`);
}

export function renameProjectFile(folder, oldName, newName) {
  const oldClean = sanitizeProjectFileName(oldName);
  const nextClean = sanitizeProjectFileName(newName);
  if (!oldClean || !nextClean) return null;
  const payload = loadProjectFile(folder, oldClean);
  if (!payload) return null;
  const savedAt = Date.now();
  const saved = {
    version: 1,
    folder,
    name: nextClean,
    savedAt,
    data: payload.data,
    syncPromise: queueServerFileRename(folder, oldClean, nextClean)
  };
  upsertCachedProjectFile(folder, nextClean, JSON.stringify({ version: 1, folder, name: nextClean, savedAt, data: payload.data }));
  deleteCachedProjectFile(folder, oldClean);
  parsedPayloadCache.delete(`${folder}:${oldClean}`);
  parsedPayloadCache.delete(`${folder}:${nextClean}`);
  return saved;
}

export function duplicateProjectFile(folder, name, newName) {
  const oldClean = sanitizeProjectFileName(name);
  const nextClean = sanitizeProjectFileName(newName);
  if (!oldClean || !nextClean) return null;
  const payload = loadProjectFile(folder, oldClean);
  if (!payload) return null;
  const saved = saveProjectFile(folder, nextClean, payload.data);
  return saved;
}

export async function listProjectFileVersions(folder, name) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean) return [];
  return listServerFileVersions(folder, clean);
}

export async function loadProjectFileVersion(folder, name, versionId) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean || !versionId) return null;
  return loadServerFileVersion(folder, clean, versionId);
}

export async function restoreProjectFileVersion(folder, name, versionId) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean || !versionId) return null;
  const restored = await restoreServerFileVersion(folder, clean, versionId);
  if (restored?.data !== undefined) {
    const raw = JSON.stringify(restored);
    cacheParsedPayload(`${folder}:${clean}`, raw, restored);
    upsertCachedProjectFile(folder, clean, raw);
  }
  return restored;
}

export async function deleteProjectFileVersion(folder, name, versionId) {
  assertFolder(folder);
  const clean = sanitizeProjectFileName(name);
  if (!clean || !versionId) return { ok: false };
  return deleteServerFileVersion(folder, clean, versionId);
}

export function resetProjectFilesForTests() {
  parsedPayloadCache.clear();
  clearCachedProjectFilesForTests();
}

export { FOLDERS as PROJECT_FOLDERS };
