import NpcEntity from './NpcEntity.js';

export const spawnNpcEntities = ({ world, registry, tileSize = 32 }) => {
  const instances = Array.isArray(world?.npcs) ? world.npcs : [];
  return instances
    .map((instance) => {
      const definition = registry.get(instance.npcId);
      if (!definition) {
        console.warn(`[NPC] Missing npcId reference: ${instance.npcId}`);
        return null;
      }
      return new NpcEntity({ definition, instance, tileSize });
    })
    .filter(Boolean);
};
