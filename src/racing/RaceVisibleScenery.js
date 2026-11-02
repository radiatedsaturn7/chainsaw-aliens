const buffers = new WeakMap();
const managedSessions = new WeakMap();
const managedLists = new WeakMap();
const isDoodad = sprite => Boolean(sprite.presetId === 'doodad' || sprite.doodadRef || sprite.previewDoodad);
const isStanding = sprite => Boolean(sprite && sprite.state !== 'removed' && sprite.state !== 'flattened');

// Only the editor's race-start path opts into managed placement ownership.
// Editor mutation commands invalidate it; arbitrary external mutable arrays keep
// the legacy validation path below. Runtime pickups/destruction remain observable
// even when their ID arrays are edited in place, replaced, or shortened.
export function prepareManagedRaceScenery(scenery, session) {
  if (!session || session.carEditorPreview || !Array.isArray(scenery)) return null;
  const state = {
    session, source: scenery, length: -1, dirty: true, generation: 0,
    visibilityRevision: 0, visibleRevision: -1,
    removed: [], flattened: [], hidden: new Set(),
    doodads: [], projected: [], all: [], visible: [],
    chunks: new Map(), chunksById: new Map(),
    statistics: { placementScans: 0, preparations: 0, visibilityChunkUpdates: 0 }
  };
  managedSessions.set(session, state);
  return getManagedRaceScenery(scenery, session);
}

// Renderer geometry is released by the owning editor. Drop CPU indices here so
// a retained finish/replay session does not also retain its placement partitions.
export function releaseManagedRaceScenery(session) {
  if (!session) return false;
  const state = managedSessions.get(session);
  if (state) managedLists.delete(state.doodads);
  managedSessions.delete(session);
  buffers.delete(session);
  return Boolean(state);
}

export function invalidateRaceSceneryPresentation(editor) {
  const state = managedSessions.get(editor?.playtestSession);
  if (state) state.dirty = true;
  if (editor) {
    editor.raceDoodadSceneSnapshot = null;
    editor.raceDoodadDefinitionSession = null;
  }
}

function sameIds(before, after) {
  if (before.length !== (after?.length || 0)) return false;
  for (let index = 0; index < before.length; index += 1) {
    if (before[index] !== after[index]) return false;
  }
  return true;
}

function refreshChunkVisibility(state, chunk) {
  let count = 0;
  for (const sprite of chunk.sprites) {
    if (!state.hidden.has(sprite.id)) chunk.visible[count++] = sprite;
  }
  chunk.visible.length = count;
  chunk.revision += 1;
  state.statistics.visibilityChunkUpdates += 1;
}

function refreshHiddenIds(state) {
  const removed = state.session.removedSceneryIds;
  const flattened = state.session.flattenedSceneryIds;
  if (sameIds(state.removed, removed) && sameIds(state.flattened, flattened)) return;
  state.removed = Array.from(removed || []);
  state.flattened = Array.from(flattened || []);
  const next = new Set([...state.removed, ...state.flattened]);
  const dirtyChunks = new Set();
  let changed = false;
  const mark = id => {
    changed = true;
    const chunks = state.chunksById.get(id);
    if (Array.isArray(chunks)) for (const chunk of chunks) dirtyChunks.add(chunk);
    else if (chunks) dirtyChunks.add(chunks);
  };
  for (const id of state.hidden) if (!next.has(id)) mark(id);
  for (const id of next) if (!state.hidden.has(id)) mark(id);
  state.hidden = next;
  if (changed) {
    state.visibilityRevision += 1;
    for (const chunk of dirtyChunks) refreshChunkVisibility(state, chunk);
  }
}

export function getManagedRaceScenery(scenery, session) {
  const state = session && managedSessions.get(session);
  if (!state || session.carEditorPreview) return null;
  if (state.source !== scenery || state.length !== scenery.length || state.dirty) {
    state.source = scenery;
    state.length = scenery.length;
    state.dirty = false;
    state.generation += 1;
    state.statistics.preparations += 1;
    state.doodads = [];
    state.projected = [];
    state.all = [];
    state.visible = [];
    state.visibleRevision = -1;
    state.chunks = new Map();
    state.chunksById = new Map();
    refreshHiddenIds(state);
    for (const sprite of scenery) {
      state.statistics.placementScans += 1;
      if (!isStanding(sprite)) continue;
      state.all.push(sprite);
      if (!isDoodad(sprite)) { state.projected.push(sprite); continue; }
      state.doodads.push(sprite);
      const key = `${Math.floor((Number(sprite.x) || 0) / 128)},${Math.floor((Number(sprite.z) || 0) / 128)}`;
      let chunk = state.chunks.get(key);
      if (!chunk) {
        chunk = { key, sprites: [], visible: [], revision: 0 };
        state.chunks.set(key, chunk);
      }
      chunk.sprites.push(sprite);
      const previous = state.chunksById.get(sprite.id);
      if (!previous) state.chunksById.set(sprite.id, chunk);
      else if (Array.isArray(previous)) {
        if (!previous.includes(chunk)) previous.push(chunk);
      } else if (previous !== chunk) state.chunksById.set(sprite.id, [previous, chunk]);
    }
    for (const chunk of state.chunks.values()) refreshChunkVisibility(state, chunk);
    managedLists.set(state.doodads, state);
  } else refreshHiddenIds(state);
  return state;
}

export function getManagedRaceSceneryVersion(sprites, session) {
  const state = managedLists.get(sprites);
  return state?.session === session && !state.dirty && state.doodads === sprites
    ? state.generation : null;
}

// Reuse the placement-list backing store during play. Still inspect authored
// state every frame for unmanaged callers so their in-place edits stay observable.
export function getVisibleRaceDoodadSprites(scenery, session) {
  const managed = getManagedRaceScenery(scenery, session);
  if (managed) {
    if (managed.visibleRevision !== managed.visibilityRevision) {
      let count = 0;
      for (const sprite of managed.doodads) {
        if (!managed.hidden.has(sprite.id)) managed.visible[count++] = sprite;
      }
      managed.visible.length = count;
      managed.visibleRevision = managed.visibilityRevision;
    }
    return managed.visible;
  }
  let buffer = session && buffers.get(session);
  if (!buffer) {
    buffer = {sprites: [], hidden: new Set()};
    if (session) buffers.set(session, buffer);
  }
  const {sprites, hidden} = buffer;
  hidden.clear();
  for (const id of session?.removedSceneryIds || []) hidden.add(id);
  for (const id of session?.flattenedSceneryIds || []) hidden.add(id);
  let count = 0;
  for (const sprite of scenery) {
    if (sprite && sprite.state !== 'removed' && sprite.state !== 'flattened'
      && !hidden.has(sprite.id) && (sprite.presetId === 'doodad' || sprite.doodadRef || sprite.previewDoodad)) {
      sprites[count++] = sprite;
    }
  }
  sprites.length = count;
  return sprites;
}

// The Three path only needs non-doodad Canvas sprites plus transient effects.
// Avoid copying/filtering every authored tree a second time after the 3D pass.
export function getProjectedRaceScenerySprites(scenery, session, skipDoodads = false) {
  const managed = getManagedRaceScenery(scenery, session);
  let buffer = session && buffers.get(session);
  if (!buffer) {
    buffer = { sprites: [], hidden: new Set(), projected: [] };
    if (session) buffers.set(session, buffer);
  }
  const result = buffer.projected ||= [];
  const hidden = managed?.hidden || buffer.hidden;
  if (!managed) {
    hidden.clear();
    for (const id of session?.removedSceneryIds || []) hidden.add(id);
    for (const id of session?.flattenedSceneryIds || []) hidden.add(id);
  }
  let count = 0;
  const append = source => {
    for (const sprite of source) {
      if (isStanding(sprite) && !hidden.has(sprite.id) && !(skipDoodads && isDoodad(sprite))) {
        result[count++] = sprite;
      }
    }
  };
  append(managed ? (skipDoodads ? managed.projected : managed.all) : scenery);
  append(session?.triggerSprites || []);
  result.length = count;
  return result;
}
