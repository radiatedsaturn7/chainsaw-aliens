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

export function isServerStorageEnabled() {
  const storage = getStorage();
  return storage?.getItem(SETTINGS_KEY) === '1';
}

export function setServerStorageEnabled(enabled) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SETTINGS_KEY, enabled ? '1' : '0');
}

function readIndex() {
  const storage = getStorage();
  if (!storage) return { levels: {}, art: {}, music: {} };
  try {
    const parsed = JSON.parse(storage.getItem(INDEX_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        levels: parsed.levels && typeof parsed.levels === 'object' ? parsed.levels : {},
        art: parsed.art && typeof parsed.art === 'object' ? parsed.art : {},
        music: parsed.music && typeof parsed.music === 'object' ? parsed.music : {}
      };
    }
  } catch (error) {
    // Ignore malformed index and rebuild from scratch.
  }
  return { levels: {}, art: {}, music: {} };
}

function snapshotLocalVfs() {
  const storage = getStorage();
  if (!storage) return null;
  const index = readIndex();
  const files = {};
  FOLDERS.forEach((folder) => {
    Object.keys(index[folder] || {}).forEach((name) => {
      const key = `${VFS_PREFIX}${folder}:${name}`;
      const raw = storage.getItem(key);
      if (raw) files[key] = raw;
    });
  });
  return { index, files, generatedAt: Date.now() };
}

function applyServerSnapshot(snapshot) {
  if (!snapshot?.index || !snapshot?.files) return false;
  const storage = getStorage();
  if (!storage) return false;
  const nextIndex = {
    levels: snapshot.index.levels && typeof snapshot.index.levels === 'object' ? snapshot.index.levels : {},
    art: snapshot.index.art && typeof snapshot.index.art === 'object' ? snapshot.index.art : {},
    music: snapshot.index.music && typeof snapshot.index.music === 'object' ? snapshot.index.music : {}
  };

  FOLDERS.forEach((folder) => {
    Object.keys(nextIndex[folder] || {}).forEach((name) => {
      const key = `${VFS_PREFIX}${folder}:${name}`;
      const raw = snapshot.files[key];
      if (typeof raw === 'string') {
        storage.setItem(key, raw);
      }
    });
  });

  storage.setItem(INDEX_KEY, JSON.stringify(nextIndex));
  return true;
}

export async function pullServerSnapshot() {
  if (!isServerStorageEnabled()) return { ok: false, reason: 'disabled' };
  try {
    const response = await fetch('/__storage/snapshot');
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const payload = await response.json();
    if (!payload?.ok || !payload?.snapshot) {
      return { ok: false, reason: payload?.error || 'invalid-response' };
    }
    return { ok: applyServerSnapshot(payload.snapshot) };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

export async function pushServerSnapshot() {
  if (!isServerStorageEnabled()) return { ok: false, reason: 'disabled' };
  const snapshot = snapshotLocalVfs();
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
