import {hydrateProjectFile, saveServerFile, isProjectStorageReadOnly} from './serverStorage.js';
const FOLDER = 'settings';
const cache = new Map();
const pendingLoads = new Map();

function preferenceName(key) {
  return String(key || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 96);
}

export function loadServerPreference(key, fallback = null) {
  const name = preferenceName(key);
  if (!name) return fallback;
  if (cache.has(name)) return cache.get(name);
  if (typeof fetch === 'function' && !pendingLoads.has(name)) {
    const load = hydrateProjectFile(FOLDER, name, {freshness: 'newest'})
      .then((payload) => {
        const value = payload?.data?.value;
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
  return saveServerFile(FOLDER, name, {value}, {createVersion: false})
    .then(result => ({ok: result.persisted === true || isProjectStorageReadOnly(),
      persisted: result.persisted === true, sessionOnly: result.persisted !== true && isProjectStorageReadOnly(), reason: result.reason}))
    .catch(error => ({ok: false, reason: String(error)}));
}

// Await initial server hydration when a preference decides which content to open.
export async function loadServerPreferenceAsync(key, fallback = null) {
  const immediate = loadServerPreference(key, fallback);
  const pending = pendingLoads.get(preferenceName(key));
  return pending ? (await pending) ?? fallback : immediate;
}
