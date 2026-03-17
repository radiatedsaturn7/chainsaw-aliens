const SETTINGS_KEY = 'chainsaw:server-storage:enabled';
const INDEX_KEY = 'robter:vfs:index';
const VFS_PREFIX = 'robter:vfs:';
const FOLDERS = ['levels', 'art', 'music'];

let syncQueue = Promise.resolve();

function getStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function emptyIndex() {
  return { levels: {}, art: {}, music: {} };
}

function normalizeIndex(index) {
  if (!index || typeof index !== 'object') return emptyIndex();
  return {
    levels: index.levels && typeof index.levels === 'object' ? index.levels : {},
    art: index.art && typeof index.art === 'object' ? index.art : {},
    music: index.music && typeof index.music === 'object' ? index.music : {}
  };
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
  const storage = getStorage();
  if (!storage) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(storage.getItem(INDEX_KEY) || 'null');
  } catch (error) {
    parsed = null;
  }
  const index = normalizeIndex(parsed);
  const files = {};
  FOLDERS.forEach((folder) => {
    Object.keys(index[folder] || {}).forEach((name) => {
      const key = fileKey(folder, name);
      const raw = storage.getItem(key);
      if (typeof raw === 'string') files[key] = raw;
    });
  });
  return { index, files, generatedAt: Date.now() };
}

function writeLocalSnapshot(snapshot) {
  const storage = getStorage();
  if (!storage) return false;
  const index = normalizeIndex(snapshot?.index);
  const files = snapshot?.files && typeof snapshot.files === 'object' ? snapshot.files : {};

    FOLDERS.forEach((folder) => {
    Object.keys(index[folder] || {}).forEach((name) => {
      const key = fileKey(folder, name);
      if (typeof files[key] === 'string') {
        storage.setItem(key, files[key]);
      }
    });
  });

  storage.setItem(INDEX_KEY, JSON.stringify(index));
  return true;
}

function mergeSnapshots(localSnapshot, serverSnapshot) {
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
  const stats = { keptLocal: 0, pulledServer: 0, merged: 0 };

  FOLDERS.forEach((folder) => {
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
      else {
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
  const storage = getStorage();
  return storage?.getItem(SETTINGS_KEY) === '1';
}

export function setServerStorageEnabled(enabled) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SETTINGS_KEY, enabled ? '1' : '0');
}

export async function pullServerSnapshot() {
  if (!isServerStorageEnabled()) return { ok: false, reason: 'disabled' };
  const local = readLocalSnapshot();
  if (!local) return { ok: false, reason: 'storage-unavailable' };
  try {
    const remote = await fetchServerSnapshot();
    if (!remote.ok) return remote;
    const merged = mergeSnapshots(local, remote.snapshot);
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

export async function bootstrapServerStorage() {
  if (!isServerStorageEnabled()) return { ok: false, reason: 'disabled' };
  const local = readLocalSnapshot();
  if (!local) return { ok: false, reason: 'storage-unavailable' };
  try {
    const remote = await fetchServerSnapshot();
    if (!remote.ok) return remote;
    const merged = mergeSnapshots(local, remote.snapshot);
    const wrote = writeLocalSnapshot(merged.snapshot);
    if (!wrote) return { ok: false, reason: 'storage-unavailable' };
    const pushed = await pushServerSnapshot(merged.snapshot);
    if (!pushed.ok) return pushed;
    return { ok: true, stats: merged.stats };
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
