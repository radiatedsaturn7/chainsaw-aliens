import { vfsDelete, vfsEnsureIndex, vfsLoad, vfsSave } from '../ui/vfs.js';
import { createDefaultActorDefinition, normalizeActorDefinition, validateActorDefinition } from './definitions.js';

const ACTOR_FOLDER = 'actors';
const LEGACY_FOLDER = 'npcs';
const STORAGE_KEY = 'robter:actor-registry-cache';
const listeners = new Set();

const ensureFolder = (folder) => {
  const storage = window.localStorage;
  const index = JSON.parse(storage.getItem('robter:vfs:index') || 'null') || { levels: {}, art: {}, music: {} };
  if (!index[folder]) {
    index[folder] = {};
    storage.setItem('robter:vfs:index', JSON.stringify(index));
  }
};

const listFolderNames = (folder) => {
  try {
    const index = JSON.parse(window.localStorage.getItem('robter:vfs:index') || 'null') || {};
    return Object.keys(index[folder] || {});
  } catch {
    return [];
  }
};

const loadBundledActors = async () => {
  const candidates = ['./data/actors.json', './data/npcs.json'];
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data)) return data;
    } catch {}
  }
  return [];
};

export default class ActorRegistry {
  constructor() {
    this.definitions = new Map();
    this.loaded = false;
    this.loading = null;
  }

  async load() {
    if (this.loaded) return this;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      if (typeof window !== 'undefined') {
        vfsEnsureIndex();
        ensureFolder(ACTOR_FOLDER);
        ensureFolder(LEGACY_FOLDER);
      }
      const bundled = await loadBundledActors();
      bundled.forEach((entry) => {
        const { actor } = validateActorDefinition(entry);
        this.definitions.set(actor.id, actor);
      });
      [...listFolderNames(LEGACY_FOLDER), ...listFolderNames(ACTOR_FOLDER)].forEach((name) => {
        const payload = vfsLoad(ACTOR_FOLDER, name) || vfsLoad(LEGACY_FOLDER, name);
        const data = payload?.data || payload;
        if (!data) return;
        const { actor } = validateActorDefinition(data);
        this.definitions.set(actor.id, actor);
      });
      this.loaded = true;
      this.persistCache();
      this.emit();
      return this;
    })();
    return this.loading;
  }

  restoreCache() {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const list = JSON.parse(raw || 'null');
      if (!Array.isArray(list)) return false;
      list.forEach((entry) => {
        const { actor } = validateActorDefinition(entry);
        this.definitions.set(actor.id, actor);
      });
      this.loaded = true;
      return true;
    } catch {
      return false;
    }
  }

  persistCache() {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list()));
  }

  list() {
    return Array.from(this.definitions.values()).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  get(id) { return this.definitions.get(id) || null; }

  createTemplate(actorType = 'npc', alignment = 'impartial') {
    let index = 1;
    let id = `${actorType}-${index}`;
    while (this.definitions.has(id)) { index += 1; id = `${actorType}-${index}`; }
    return createDefaultActorDefinition({
      id,
      name: `${actorType[0].toUpperCase()}${actorType.slice(1)} ${index}`,
      actorType,
      alignment,
      editor: { color: alignment === 'enemy' ? '#ff6b6b' : alignment === 'friendly' ? '#67d5b5' : '#8ecae6', glyph: actorType.slice(0, 2).toUpperCase() }
    });
  }

  save(definition, { previousId = null } = {}) {
    const { actor, errors, warnings } = validateActorDefinition(definition);
    if (errors.length) throw new Error(errors.join(' '));
    if (previousId && previousId !== actor.id) {
      this.definitions.delete(previousId);
      try { vfsDelete(ACTOR_FOLDER, previousId); } catch {}
      try { vfsDelete(LEGACY_FOLDER, previousId); } catch {}
    }
    this.definitions.set(actor.id, actor);
    vfsSave(ACTOR_FOLDER, actor.id, actor);
    this.persistCache();
    this.emit();
    return { actor, warnings };
  }

  delete(id) {
    this.definitions.delete(id);
    try { vfsDelete(ACTOR_FOLDER, id); } catch {}
    try { vfsDelete(LEGACY_FOLDER, id); } catch {}
    this.persistCache();
    this.emit();
  }

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  emit() {
    const list = this.list();
    listeners.forEach((listener) => listener(list));
  }
}

export const actorRegistry = new ActorRegistry();
export { ACTOR_FOLDER };
