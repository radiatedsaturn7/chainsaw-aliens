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

const VFS_PREFIX = 'robter:vfs:';
const INDEX_KEY = `${VFS_PREFIX}index`;
const FOLDERS = ['levels', 'art', 'music'];

const getStorage = () => {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
};

const emptyIndex = () => ({ levels: {}, art: {}, music: {} });

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
        music: parsed.music && typeof parsed.music === 'object' ? parsed.music : {}
      };
    }
  } catch (error) {
    index = emptyIndex();
  }
  storage.setItem(INDEX_KEY, JSON.stringify(index));
  return index;
}

function assertFolder(folder) {
  if (!FOLDERS.includes(folder)) throw new Error(`Invalid VFS folder: ${folder}`);
}

function fileKey(folder, name) {
  return `${VFS_PREFIX}${folder}:${name}`;
}

function saveIndex(index) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(INDEX_KEY, JSON.stringify(index));
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
  const index = vfsEnsureIndex();
  return Boolean(index?.[folder]?.[clean]);
}

export function vfsLoad(folder, name) {
  assertFolder(folder);
  const clean = vfsSanitizeName(name);
  const storage = getStorage();
  if (!storage || !clean) return null;
  try {
    const raw = storage.getItem(fileKey(folder, clean));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function vfsSave(folder, name, dataObj) {
  assertFolder(folder);
  const clean = vfsSanitizeName(name);
  const storage = getStorage();
  if (!storage || !clean) return null;
  const savedAt = Date.now();
  const payload = {
    version: 1,
    folder,
    name: clean,
    savedAt,
    data: dataObj
  };
  const raw = JSON.stringify(payload);
  storage.setItem(fileKey(folder, clean), raw);
  const index = vfsEnsureIndex();
  index[folder][clean] = { updatedAt: savedAt, size: raw.length };
  saveIndex(index);
  return payload;
}

export function vfsDelete(folder, name) {
  assertFolder(folder);
  const clean = vfsSanitizeName(name);
  const storage = getStorage();
  if (!storage || !clean) return;
  storage.removeItem(fileKey(folder, clean));
  const index = vfsEnsureIndex();
  if (index[folder]) delete index[folder][clean];
  saveIndex(index);
}

export function vfsRename(folder, oldName, newName) {
  const oldClean = vfsSanitizeName(oldName);
  const nextClean = vfsSanitizeName(newName);
  if (!oldClean || !nextClean) return null;
  const payload = vfsLoad(folder, oldClean);
  if (!payload) return null;
  const saved = vfsSave(folder, nextClean, payload.data);
  vfsDelete(folder, oldClean);
  return saved;
}

export function vfsDuplicate(folder, name, newName) {
  const oldClean = vfsSanitizeName(name);
  const nextClean = vfsSanitizeName(newName);
  if (!oldClean || !nextClean) return null;
  const payload = vfsLoad(folder, oldClean);
  if (!payload) return null;
  return vfsSave(folder, nextClean, payload.data);
}

export { FOLDERS as VFS_FOLDERS };
