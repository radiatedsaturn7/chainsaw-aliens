/**
 * Project file facade backed by per-file server storage.
 *
 * How it works:
 * - Files are grouped into fixed folders: levels, art, music, actors, sfx, cutscenes.
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
  clearCachedProjectFilesForTests
} from './serverStorage.js';

const FOLDERS = ['levels', 'art', 'music', 'actors', 'sfx', 'cutscenes'];
const parsedPayloadCache = new Map();

const emptyIndex = () => ({ levels: {}, art: {}, music: {}, actors: {}, sfx: {}, cutscenes: {} });

export function ensureProjectFileIndex() {
  let index = emptyIndex();
  const serverIndex = listServerIndexedFiles();
  FOLDERS.forEach((folder) => {
    index[folder] = { ...(serverIndex[folder] || {}) };
  });
  listCachedProjectFiles('*').forEach(({ folder, name, raw }) => {
    if (!FOLDERS.includes(folder) || !name || typeof raw !== 'string') return;
    let updatedAt = Date.now();
    try {
      const payload = JSON.parse(raw);
      updatedAt = Number(payload?.savedAt || updatedAt);
    } catch (error) {
      // ignore malformed volatile payload metadata
    }
    index[folder][name] = { updatedAt, size: raw.length };
  });
  return index;
}

function assertFolder(folder) {
  if (!FOLDERS.includes(folder)) throw new Error(`Invalid project file folder: ${folder}`);
}

function saveIndex(index) {
  void index;
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
      size: Number(meta?.size || 0)
    }));
  listCachedProjectFiles(folder).forEach(({ name, raw }) => {
    const existing = listed.find((entry) => entry.name === name);
    if (existing) {
      existing.updatedAt = Math.max(existing.updatedAt || 0, Date.now());
      existing.size = Math.max(existing.size || 0, typeof raw === 'string' ? raw.length : 0);
    } else {
      listed.push({ name, updatedAt: Date.now(), size: typeof raw === 'string' ? raw.length : 0 });
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
    parsedPayloadCache.set(cacheKey, { raw, payload });
    return payload;
  } catch (error) {
    return null;
  }
}

export function saveProjectFile(folder, name, dataObj) {
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
  parsedPayloadCache.set(`${folder}:${clean}`, { raw, payload });
  upsertCachedProjectFile(folder, clean, raw);
  const index = ensureProjectFileIndex();
  index[folder][clean] = { updatedAt: savedAt, size: raw.length };
  saveIndex(index);
  const syncPromise = queueServerFileSave(folder, clean, dataObj, { savedAt, version: 1 });
  return { ...payload, syncPromise };
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

export function resetProjectFilesForTests() {
  parsedPayloadCache.clear();
  clearCachedProjectFilesForTests();
}

export { FOLDERS as PROJECT_FOLDERS };
