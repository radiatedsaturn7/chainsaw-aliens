/**
 * Virtual filesystem (VFS) backed by server storage.
 *
 * How it works:
 * - Files are grouped into fixed folders: levels, art, music, actors.
 * - File payloads are kept in memory while the app is running and synced to
 *   the dev server snapshot.
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

const FOLDERS = ['levels', 'art', 'music', 'actors'];

const emptyIndex = () => ({ levels: {}, art: {}, music: {}, actors: {} });

export function vfsEnsureIndex() {
  let index = emptyIndex();
  listVolatileVfsFiles('*').forEach(({ folder, name, raw }) => {
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
  if (!FOLDERS.includes(folder)) throw new Error(`Invalid VFS folder: ${folder}`);
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
  return listed;
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
  if (!clean) return null;
  try {
    const raw = readVolatileVfsFile(folder, clean);
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
