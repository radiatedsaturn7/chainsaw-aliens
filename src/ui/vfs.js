/**
 * Virtual filesystem (VFS) backed by localStorage.
 *
 * How it works:
 * - Files are grouped into three fixed folders: levels, art, music.
 * - File payloads are stored under keys: robter:vfs:<folder>:<name>
 * - A single index key (robter:vfs:index) stores metadata per file
 *   (updatedAt + serialized size) so listing is fast.
 * - Each payload includes version/folder/name/savedAt/data, where `data`
 *   is the editor-specific JSON object already used by the app.
 */

import {
  deleteVolatileVfsFile,
  listVolatileVfsFiles,
  queueServerSnapshotPush,
  readVolatileVfsFile,
  upsertVolatileVfsFile
} from './serverStorage.js';

const VFS_PREFIX = 'robter:vfs:';
const INDEX_KEY = `${VFS_PREFIX}index`;
const FOLDERS = ['levels', 'art', 'music', 'actors'];

const getStorage = () => {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
};

const emptyIndex = () => ({ levels: {}, art: {}, music: {}, actors: {} });

export function vfsEnsureIndex() {
  const storage = getStorage();
  if (!storage) return emptyIndex();
  let index = emptyIndex();
  try {
    const parsed = JSON.parse(storage.getItem(INDEX_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      index = {
        levels: parsed.levels && typeof parsed.levels === 'object' ? parsed.levels : {},
        art: parsed.art && typeof parsed.art === 'object' ? parsed.art : {},
        music: parsed.music && typeof parsed.music === 'object' ? parsed.music : {},
        actors: parsed.actors && typeof parsed.actors === 'object' ? parsed.actors : {}
      };
    }
  } catch (error) {
    index = emptyIndex();
  }
  return index;
}

function assertFolder(folder) {
  if (!FOLDERS.includes(folder)) throw new Error(`Invalid VFS folder: ${folder}`);
}

function fileKey(folder, name) {
  return `${VFS_PREFIX}${folder}:${name}`;
}

function saveIndex(index) {
  void index;
}

export function vfsSanitizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 64);
}

export function vfsList(folder) {
  assertFolder(folder);
  const index = vfsEnsureIndex();
  const listed = Object.entries(index[folder] || {})
    .map(([name, meta]) => ({
      name,
      updatedAt: Number(meta?.updatedAt || 0),
      size: Number(meta?.size || 0)
    }));
  listVolatileVfsFiles(folder).forEach(({ name, raw }) => {
    const existing = listed.find((entry) => entry.name === name);
    if (existing) {
      existing.updatedAt = Math.max(existing.updatedAt || 0, Date.now());
      existing.size = Math.max(existing.size || 0, typeof raw === 'string' ? raw.length : 0);
    } else {
      listed.push({ name, updatedAt: Date.now(), size: typeof raw === 'string' ? raw.length : 0 });
    }
  });
  listed.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  if (listed.length) return listed;
  const storage = getStorage();
  if (!storage) {
    const withVolatile = [...listed];
    listVolatileVfsFiles(folder).forEach(({ name, raw }) => {
      if (!withVolatile.some((entry) => entry.name === name)) {
        withVolatile.push({ name, updatedAt: Date.now(), size: typeof raw === 'string' ? raw.length : 0 });
      }
    });
    return withVolatile.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  }
  const folderPrefix = `${VFS_PREFIX}${folder}:`;
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !key.startsWith(folderPrefix)) continue;
    const name = key.slice(folderPrefix.length);
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const payload = JSON.parse(raw);
      index[folder][name] = {
        updatedAt: Number(payload?.savedAt || Date.now()),
        size: raw.length
      };
    } catch (error) {
      // ignore malformed entries and continue rebuilding index
    }
  }
  listVolatileVfsFiles(folder).forEach(({ name, raw }) => {
    if (!index[folder][name]) index[folder][name] = {};
    index[folder][name].updatedAt = Date.now();
    index[folder][name].size = typeof raw === 'string' ? raw.length : 0;
  });
  saveIndex(index);
  return Object.entries(index[folder] || {})
    .map(([name, meta]) => ({
      name,
      updatedAt: Number(meta?.updatedAt || 0),
      size: Number(meta?.size || 0)
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

export function vfsExists(folder, name) {
  const clean = vfsSanitizeName(name);
  if (!clean) return false;
  if (readVolatileVfsFile(folder, clean)) return true;
  const index = vfsEnsureIndex();
  return Boolean(index?.[folder]?.[clean]);
}

export function vfsLoad(folder, name) {
  assertFolder(folder);
  const clean = vfsSanitizeName(name);
  const storage = getStorage();
  if (!clean) return null;
  if (!storage) {
    const raw = readVolatileVfsFile(folder, clean);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  try {
    const raw = readVolatileVfsFile(folder, clean) || storage.getItem(fileKey(folder, clean));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function vfsSave(folder, name, dataObj) {
  assertFolder(folder);
  const clean = vfsSanitizeName(name);
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
  upsertVolatileVfsFile(folder, clean, raw);
  const index = vfsEnsureIndex();
  index[folder][clean] = { updatedAt: savedAt, size: raw.length };
  saveIndex(index);
  const syncPromise = queueServerSnapshotPush();
  return { ...payload, syncPromise };
}

export function vfsDelete(folder, name) {
  assertFolder(folder);
  const clean = vfsSanitizeName(name);
  if (!clean) return;
  deleteVolatileVfsFile(folder, clean);
  const index = vfsEnsureIndex();
  if (index[folder]) delete index[folder][clean];
  saveIndex(index);
  queueServerSnapshotPush();
}

export function vfsRename(folder, oldName, newName) {
  const oldClean = vfsSanitizeName(oldName);
  const nextClean = vfsSanitizeName(newName);
  if (!oldClean || !nextClean) return null;
  const payload = vfsLoad(folder, oldClean);
  if (!payload) return null;
  const saved = vfsSave(folder, nextClean, payload.data);
  vfsDelete(folder, oldClean);
  queueServerSnapshotPush();
  return saved;
}

export function vfsDuplicate(folder, name, newName) {
  const oldClean = vfsSanitizeName(name);
  const nextClean = vfsSanitizeName(newName);
  if (!oldClean || !nextClean) return null;
  const payload = vfsLoad(folder, oldClean);
  if (!payload) return null;
  const saved = vfsSave(folder, nextClean, payload.data);
  queueServerSnapshotPush();
  return saved;
}

export { FOLDERS as VFS_FOLDERS };
