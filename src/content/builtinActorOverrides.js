import { createDefaultActor, createDefaultState, ensureActorDefinition } from './actorEditorData.js';

export const BUILTIN_ACTOR_FOLDER = 'actors';
export const BUILTIN_ACTOR_NAMES = {
  player: 'Player',
  companion: 'Companion'
};

export const BUILTIN_ACTOR_IDS = Object.keys(BUILTIN_ACTOR_NAMES);

const BASE_STATE_IDS = ['idle', 'walk', 'run', 'jump', 'fall', 'duck', 'crouch', 'dash', 'attack', 'hurt', 'dead'];

function makeState(id) {
  const state = createDefaultState(id);
  state.id = id;
  state.name = id.split('-').map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');
  state.transitions = [];
  return state;
}

export function isBuiltInActorName(name) {
  const normalized = String(name || '').trim().toLowerCase().replace(/\.json$/i, '');
  return BUILTIN_ACTOR_IDS.includes(normalized);
}

export function getBuiltInActorIdFromName(name) {
  const normalized = String(name || '').trim().toLowerCase().replace(/\.json$/i, '');
  return BUILTIN_ACTOR_IDS.includes(normalized) ? normalized : '';
}

export function createBuiltInActorDefinition(id = 'player') {
  const actorId = BUILTIN_ACTOR_IDS.includes(id) ? id : 'player';
  const actor = createDefaultActor(BUILTIN_ACTOR_NAMES[actorId]);
  actor.id = actorId;
  actor.name = BUILTIN_ACTOR_NAMES[actorId];
  actor.attackTarget = 'none';
  actor.taxonomies = actorId === 'companion' ? ['Player and Allies'] : ['Player'];
  actor.aggressiveTo = [];
  actor.bodyDamageEnabled = false;
  actor.contactDamage = 0;
  actor.destructible = false;
  actor.invulnerable = true;
  actor.isRoot = false;
  actor.tags = ['built-in', actorId];
  actor.health = actorId === 'player' ? 5 : 3;
  actor.size = actorId === 'player' ? { width: 22, height: 34 } : { width: 22, height: 34 };
  actor.states = BASE_STATE_IDS.map(makeState);
  actor.initialStateId = 'idle';
  actor.deathStateId = 'dead';
  actor.destroyAfterDeath = false;
  actor.respawnOnRoomEntry = false;
  actor.advanced = {
    ...actor.advanced,
    builtInActor: actorId,
    reserved: true,
    notes: 'Visual override for hardcoded gameplay actor. Movement, combat, and AI remain hardcoded.'
  };
  return ensureActorDefinition(actor);
}

export function mergeBuiltInActorOverride(name, overrideData = null) {
  const actorId = getBuiltInActorIdFromName(name);
  if (!actorId) return null;
  const base = createBuiltInActorDefinition(actorId);
  const override = overrideData && typeof overrideData === 'object' ? overrideData : {};
  const mergedStates = new Map(base.states.map((state) => [state.id, state]));
  if (Array.isArray(override.states)) {
    override.states.forEach((state) => {
      if (state?.id) mergedStates.set(state.id, state);
    });
  }
  return ensureActorDefinition({
    ...base,
    ...override,
    id: actorId,
    name: BUILTIN_ACTOR_NAMES[actorId],
    isRoot: false,
    destructible: false,
    invulnerable: true,
    states: Array.from(mergedStates.values()),
    initialStateId: override.initialStateId || base.initialStateId,
    advanced: {
      ...base.advanced,
      ...(override.advanced || {}),
      builtInActor: actorId,
      reserved: true
    }
  });
}

export function listBuiltInActorBrowserEntries() {
  return BUILTIN_ACTOR_IDS.map((id, index) => ({
    name: BUILTIN_ACTOR_NAMES[id],
    updatedAt: Number.MAX_SAFE_INTEGER - index,
    size: 0,
    builtIn: true
  }));
}
