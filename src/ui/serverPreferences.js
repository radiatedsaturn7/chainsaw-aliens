const FOLDER = 'settings';
const cache = new Map();
const pendingLoads = new Map();

function preferenceName(key) {
  return String(key || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 96);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

export function loadServerPreference(key, fallback = null) {
  const name = preferenceName(key);
  if (!name) return fallback;
  if (cache.has(name)) return cache.get(name);
  if (typeof fetch === 'function' && !pendingLoads.has(name)) {
    const load = requestJson(`/__storage/file?folder=${encodeURIComponent(FOLDER)}&name=${encodeURIComponent(name)}`)
      .then((payload) => {
        const value = payload?.file?.data?.value;
        cache.set(name, value);
        return value;
      })
      .catch(() => fallback)
      .finally(() => pendingLoads.delete(name));
    pendingLoads.set(name, load);
  }
  return fallback;
}

export function saveServerPreference(key, value) {
  const name = preferenceName(key);
  if (!name) return Promise.resolve({ ok: false, reason: 'missing-key' });
  cache.set(name, value);
  if (typeof fetch !== 'function') return Promise.resolve({ ok: false, reason: 'fetch-unavailable' });
  return requestJson('/__storage/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder: FOLDER,
      name,
      savedAt: Date.now(),
      version: 1,
      createVersion: false,
      data: { value }
    })
  }).then(() => ({ ok: true })).catch((error) => ({ ok: false, reason: String(error) }));
}
