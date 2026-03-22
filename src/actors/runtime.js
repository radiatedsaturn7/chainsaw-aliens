import ActorEntity from './ActorEntity.js';
import { normalizeActorInstance } from './definitions.js';

export const spawnActorEntities = ({ world, registry, tileSize = 32 }) => {
  const source = Array.isArray(world?.npcs) ? world.npcs : Array.isArray(world?.actors) ? world.actors : [];
  return source.map((instance) => normalizeActorInstance(instance)).map((instance) => {
    const definition = registry.get(instance.actorId || instance.npcId);
    if (!definition) {
      console.warn(`[Actor] Missing actorId reference: ${instance.actorId || instance.npcId}`);
      return null;
    }
    return new ActorEntity({ definition, instance, tileSize });
  }).filter(Boolean);
};
