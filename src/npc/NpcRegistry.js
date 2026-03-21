import { vfsDelete, vfsDuplicate, vfsEnsureIndex, vfsList, vfsLoad, vfsRename, vfsSave, VFS_FOLDERS } from '../ui/vfs.js';
import { createDefaultNpcDefinition, normalizeNpcDefinition, normalizeNpcInstance, validateNpcDefinition } from './definitions.js';

const NPC_FOLDER = 'npcs';
const REGISTRY_LISTENERS = new Set();
const STORAGE_KEY = 'robter:npc-registry-cache';

const readBundledNpcDefinitions = async () => {
  try {
    const response = await fetch('./data/npcs.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[NpcRegistry] Failed to load bundled NPC definitions.', error);
    return [];
  }
};

const ensureNpcFolderInIndex = () => {
  const storage = window.localStorage;
  try {
    const index = JSON.parse(storage.getItem('robter:vfs:index') || 'null') || {};
    if (!index[NPC_FOLDER]) {
      index[NPC_FOLDER] = {};
      storage.setItem('robter:vfs:index', JSON.stringify(index));
    }
  } catch (error) {
    storage.setItem('robter:vfs:index', JSON.stringify({ levels: {}, art: {}, music: {}, [NPC_FOLDER]: {} }));
  }
};

export default class NpcRegistry {
  constructor() {
    this.definitions = new Map();
    this.loaded = false;
    this.loadingPromise = null;
  }

  async load() {
    if (this.loaded) return this;
    if (this.loadingPromise) return this.loadingPromise;
    this.loadingPromise = (async () => {
      if (typeof window !== 'undefined') {
        vfsEnsureIndex();
        ensureNpcFolderInIndex();
      }
      const bundled = await readBundledNpcDefinitions();
      bundled.forEach((entry) => {
        const { npc } = validateNpcDefinition(entry);
        this.definitions.set(npc.id, npc);
      });

      const storedEntries = this.listNames();
      storedEntries.forEach((name) => {
        const payload = this.loadPayload(name);
        const data = payload?.data || payload;
        if (!data) return;
        const { npc } = validateNpcDefinition(data);
        this.definitions.set(npc.id, npc);
      });
      this.loaded = true;
      this.persistCache();
      this.emitChange();
      return this;
    })();
    return this.loadingPromise;
  }

  listNames() {
    try {
      const index = JSON.parse(window.localStorage.getItem('robter:vfs:index') || 'null') || {};
      return Object.keys(index[NPC_FOLDER] || {}).sort();
    } catch (error) {
      return [];
    }
  }

  loadPayload(name) {
    try {
      return vfsLoad(NPC_FOLDER, name);
    } catch (error) {
      return null;
    }
  }

  persistCache() {
    if (typeof window === 'undefined') return;
    const payload = this.list().map((entry) => entry);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  restoreCache() {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return false;
      list.forEach((entry) => {
        const { npc } = validateNpcDefinition(entry);
        this.definitions.set(npc.id, npc);
      });
      this.loaded = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  list() {
    return Array.from(this.definitions.values()).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  listByAlignment(alignment) {
    return this.list().filter((entry) => entry.alignment === alignment);
  }

  get(id) {
    return this.definitions.get(id) || null;
  }

  createTemplate(alignment = 'impartial') {
    const baseId = `npc-${alignment}`;
    let index = 1;
    let id = `${baseId}-${index}`;
    while (this.definitions.has(id)) {
      index += 1;
      id = `${baseId}-${index}`;
    }
    return createDefaultNpcDefinition({
      id,
      name: `New ${alignment[0].toUpperCase()}${alignment.slice(1)} NPC ${index}`,
      alignment,
      editorPreview: {
        color: alignment === 'enemy' ? '#ff6b6b' : alignment === 'friendly' ? '#67d5b5' : '#cdb4db',
        glyph: alignment === 'enemy' ? 'EN' : alignment === 'friendly' ? 'FR' : 'IM'
      }
    });
  }

  save(definition, { previousId = null } = {}) {
    const { npc, warnings, errors } = validateNpcDefinition(definition);
    if (errors.length) {
      throw new Error(errors.join(' '));
    }
    if (previousId && previousId !== npc.id) {
      this.definitions.delete(previousId);
      try {
        vfsDelete(NPC_FOLDER, previousId);
      } catch (error) {
        console.warn('[NpcRegistry] Failed to remove old NPC id during rename.', error);
      }
    }
    this.definitions.set(npc.id, npc);
    vfsSave(NPC_FOLDER, npc.id, npc);
    this.persistCache();
    this.emitChange();
    return { npc, warnings };
  }

  delete(id) {
    this.definitions.delete(id);
    try {
      vfsDelete(NPC_FOLDER, id);
    } catch (error) {
      console.warn('[NpcRegistry] Failed to delete NPC.', error);
    }
    this.persistCache();
    this.emitChange();
  }

  duplicate(id, nextId) {
    const source = this.get(id);
    if (!source) return null;
    const duplicated = normalizeNpcDefinition({ ...source, id: nextId, name: `${source.name} Copy` });
    this.save(duplicated);
    return duplicated;
  }

  rename(oldId, newId) {
    const source = this.get(oldId);
    if (!source) return null;
    const renamed = normalizeNpcDefinition({ ...source, id: newId });
    this.save(renamed, { previousId: oldId });
    return renamed;
  }

  validateDefinition(definition) {
    return validateNpcDefinition(definition);
  }

  normalizeInstance(instance) {
    return normalizeNpcInstance(instance);
  }

  subscribe(listener) {
    REGISTRY_LISTENERS.add(listener);
    return () => REGISTRY_LISTENERS.delete(listener);
  }

  emitChange() {
    REGISTRY_LISTENERS.forEach((listener) => listener(this.list()));
  }
}

export const npcRegistry = new NpcRegistry();
export { NPC_FOLDER };
