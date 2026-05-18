const SETTINGS_KEY = 'chainsaw:server-storage:enabled';
const INDEX_KEY = 'robter:vfs:index';
const VFS_PREFIX = 'robter:vfs:';
const DEFAULT_FOLDERS = ['levels', 'art', 'music', 'actors'];

let syncQueue = Promise.resolve();
const volatileFiles = new Map();

function getStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function getFolderNames(index = null) {
  const extra = index && typeof index === 'object'
    ? Object.keys(index).filter((name) => name && typeof name === 'string')
    : [];
  return Array.from(new Set([...DEFAULT_FOLDERS, ...extra]));
}

function emptyIndex() {
  return DEFAULT_FOLDERS.reduce((acc, folder) => { acc[folder] = {}; return acc; }, {});
}

function normalizeIndex(index) {
  const folders = getFolderNames(index);
  return folders.reduce((acc, folder) => {
    acc[folder] = index && typeof index[folder] === 'object' && index[folder] ? index[folder] : {};
    return acc;
  }, {});
}

function fileKey(folder, name) {
  return `${VFS_PREFIX}${folder}:${name}`;
}

function readTimestamp(meta, raw) {
  const metaTs = Number(meta?.updatedAt || 0);
  if (Number.isFinite(metaTs) && metaTs > 0) return metaTs;
  if (typeof raw === 'string') {
    try {
      const payload = JSON.parse(raw);
      const savedAt = Number(payload?.savedAt || 0);
      if (Number.isFinite(savedAt) && savedAt > 0) return savedAt;
    } catch (error) {
      // ignore malformed payload timestamp
    }
  }
  return 0;
}

function readLocalSnapshot() {
  const index = emptyIndex();
  const files = {};
  const storage = getStorage();

  if (storage) {
    try {
      const parsed = JSON.parse(storage.getItem(INDEX_KEY) || 'null');
      const normalized = normalizeIndex(parsed && typeof parsed === 'object' ? parsed : emptyIndex());
      getFolderNames(normalized).forEach((folder) => {
        Object.keys(normalized[folder] || {}).forEach((name) => {
          const key = fileKey(folder, name);
          const raw = storage.getItem(key);
          if (typeof raw !== 'string') return;
          index[folder][name] = { updatedAt: readTimestamp(normalized[folder][name], raw) || Date.now(), size: raw.length };
          files[key] = raw;
        });
      });
    } catch (error) {
      // ignore localStorage read failures
    }
  }

  volatileFiles.forEach((raw, key) => {
    if (typeof raw !== 'string') return;
    const match = key.slice(VFS_PREFIX.length).match(/^([^:]+):(.+)$/);
    if (!match) return;
    const [, folder, name] = match;
    if (!index[folder] || typeof index[folder] !== 'object') index[folder] = {};
    const existingRaw = files[key];
    if (typeof existingRaw === 'string' && existingRaw !== raw) {
      const existingTs = readTimestamp(index[folder][name], existingRaw);
      const volatileTs = readTimestamp(null, raw);
      if (existingTs > volatileTs) return;
    }
    index[folder][name] = { updatedAt: readTimestamp(index[folder][name], raw) || Date.now(), size: raw.length };
    files[key] = raw;
  });

  return { index, files, generatedAt: Date.now() };
}

export function upsertVolatileVfsFile(folder, name, raw) {
  if (!folder || !name || typeof raw !== 'string') return;
  volatileFiles.set(fileKey(folder, name), raw);
}

export function deleteVolatileVfsFile(folder, name) {
  if (!folder || !name) return;
  volatileFiles.delete(fileKey(folder, name));
}

export function readVolatileVfsFile(folder, name) {
  if (!folder || !name) return null;
  return volatileFiles.get(fileKey(folder, name)) || null;
}

export function listVolatileVfsFiles(folder) {
  const prefix = `${VFS_PREFIX}${folder}:`;
  return Array.from(volatileFiles.entries())
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, raw]) => ({ name: key.slice(prefix.length), raw }));
}

function writeLocalSnapshot(snapshot) {
  const index = normalizeIndex(snapshot?.index);
  const files = snapshot?.files && typeof snapshot.files === 'object' ? snapshot.files : {};
  volatileFiles.clear();
  getFolderNames(index).forEach((folder) => {
    Object.keys(index[folder] || {}).forEach((name) => {
      const key = fileKey(folder, name);
      const raw = files[key];
      if (typeof raw === 'string') volatileFiles.set(key, raw);
    });
  });

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(INDEX_KEY, JSON.stringify(index));
      getFolderNames(index).forEach((folder) => {
        Object.keys(index[folder] || {}).forEach((name) => {
          const key = fileKey(folder, name);
          const raw = files[key];
          if (typeof raw === 'string') storage.setItem(key, raw);
        });
      });
    } catch (error) {
      // ignore localStorage write failures
    }
  }
  return true;
}

function getConflicts(localSnapshot, serverSnapshot) {
  const local = {
    index: normalizeIndex(localSnapshot?.index),
    files: localSnapshot?.files && typeof localSnapshot.files === 'object' ? localSnapshot.files : {}
  };
  const server = {
    index: normalizeIndex(serverSnapshot?.index),
    files: serverSnapshot?.files && typeof serverSnapshot.files === 'object' ? serverSnapshot.files : {}
  };

  const conflicts = [];
  getFolderNames(local.index).forEach((folder) => {
    const localNames = Object.keys(local.index[folder] || {});
    localNames.forEach((name) => {
      const key = fileKey(folder, name);
      const localRaw = local.files[key];
      const serverRaw = server.files[key];
      if (typeof localRaw !== 'string' || typeof serverRaw !== 'string') return;
      if (localRaw === serverRaw) return;
      conflicts.push({ folder, name });
    });
  });
  return conflicts;
}

function mergeSnapshots(localSnapshot, serverSnapshot, duplicatePreference = 'local') {
  const local = {
    index: normalizeIndex(localSnapshot?.index),
    files: localSnapshot?.files && typeof localSnapshot.files === 'object' ? localSnapshot.files : {}
  };
  const server = {
    index: normalizeIndex(serverSnapshot?.index),
    files: serverSnapshot?.files && typeof serverSnapshot.files === 'object' ? serverSnapshot.files : {}
  };

  const mergedIndex = emptyIndex();
  const mergedFiles = {};
  const stats = { keptLocal: 0, pulledServer: 0, merged: 0, conflictsResolved: 0 };

  getFolderNames(local.index).forEach((folder) => {
    const names = new Set([
      ...Object.keys(local.index[folder] || {}),
      ...Object.keys(server.index[folder] || {})
    ]);

    names.forEach((name) => {
      const key = fileKey(folder, name);
      const localMeta = local.index[folder]?.[name];
      const serverMeta = server.index[folder]?.[name];
      const localRaw = local.files[key];
      const serverRaw = server.files[key];
      const hasLocal = typeof localRaw === 'string';
      const hasServer = typeof serverRaw === 'string';
      if (!hasLocal && !hasServer) return;

      let winner = 'local';
      if (!hasLocal) winner = 'server';
      else if (!hasServer) winner = 'local';
      else if (localRaw !== serverRaw) {
        winner = duplicatePreference === 'server' ? 'server' : 'local';
        stats.conflictsResolved += 1;
      } else {
        const localTs = readTimestamp(localMeta, localRaw);
        const serverTs = readTimestamp(serverMeta, serverRaw);
        winner = serverTs > localTs ? 'server' : 'local';
      }

      const raw = winner === 'server' ? serverRaw : localRaw;
      if (typeof raw !== 'string') return;
      const size = raw.length;
      const updatedAt = winner === 'server'
        ? readTimestamp(serverMeta, serverRaw)
        : readTimestamp(localMeta, localRaw);

      mergedFiles[key] = raw;
      mergedIndex[folder][name] = { updatedAt, size };

      if (winner === 'server') stats.pulledServer += 1;
      else stats.keptLocal += 1;
      stats.merged += 1;
    });
  });

  return {
    snapshot: { index: mergedIndex, files: mergedFiles, generatedAt: Date.now() },
    stats
  };
}

async function fetchServerSnapshot() {
  const response = await fetch('/__storage/snapshot');
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
  const payload = await response.json().catch(() => ({}));
  if (!payload?.ok) return { ok: false, reason: payload?.error || 'invalid-response' };
  return { ok: true, snapshot: payload.snapshot || { index: emptyIndex(), files: {} } };
}

export function isServerStorageEnabled() {
  return true;
}

export function setServerStorageEnabled(enabled) {
  void enabled;
}

export async function pullServerSnapshot(duplicatePreference = 'server') {
  if (!isServerStorageEnabled()) return { ok: false, reason: 'disabled' };
  const local = readLocalSnapshot();
  if (!local) return { ok: false, reason: 'storage-unavailable' };
  try {
    const remote = await fetchServerSnapshot();
    if (!remote.ok) return remote;
    const merged = mergeSnapshots(local, remote.snapshot, duplicatePreference);
    const wrote = writeLocalSnapshot(merged.snapshot);
    return { ok: wrote, stats: merged.stats };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

export async function pushServerSnapshot(snapshotOverride = null) {
  if (!isServerStorageEnabled()) return { ok: false, reason: 'disabled' };
  const snapshot = snapshotOverride || readLocalSnapshot();
  if (!snapshot) return { ok: false, reason: 'storage-unavailable' };
  try {
    const response = await fetch('/__storage/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      return { ok: false, reason: payload?.error || `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

export async function bootstrapServerStorage(options = {}) {
  if (!isServerStorageEnabled()) return { ok: false, reason: 'disabled' };
  const local = readLocalSnapshot();
  if (!local) return { ok: false, reason: 'storage-unavailable' };
  const duplicatePreference = options?.duplicatePreference;
  try {
    const remote = await fetchServerSnapshot();
    if (!remote.ok) return remote;
    const conflicts = getConflicts(local, remote.snapshot);
    const mergeChoice = conflicts.length > 0
      ? (duplicatePreference === 'local' || duplicatePreference === 'server' ? duplicatePreference : 'server')
      : 'local';
    const merged = mergeSnapshots(local, remote.snapshot, mergeChoice);
    const wrote = writeLocalSnapshot(merged.snapshot);
    if (!wrote) {
      Object.entries(merged.snapshot.files || {}).forEach(([key, raw]) => {
        const match = key.slice(VFS_PREFIX.length).match(/^([^:]+):(.+)$/);
        if (!match || typeof raw !== 'string') return;
        const [, folder, name] = match;
        upsertVolatileVfsFile(folder, name, raw);
      });
    }
    const pushed = await pushServerSnapshot(merged.snapshot);
    if (!pushed.ok) return pushed;
    return { ok: true, stats: merged.stats, conflicts: conflicts.length, preference: mergeChoice };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

export function queueServerSnapshotPush() {
  if (!isServerStorageEnabled()) return;
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(() => pushServerSnapshot())
    .catch(() => undefined);
  return syncQueue;
}

export async function syncServerSnapshotToGitHub() {
  if (!isServerStorageEnabled()) return { ok: false, reason: 'disabled' };
  const pushResult = await pushServerSnapshot();
  if (!pushResult.ok) return pushResult;
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
