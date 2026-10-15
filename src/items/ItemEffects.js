import { normalizeItemDocument,normalizeItemEffect,applyItemModifier } from './ItemDocument.js';

const copyMap = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !['__proto__','prototype','constructor'].includes(key)));
export function normalizeItemProgress(value = {}) {
  return {
    version:2, collected:[...new Set((Array.isArray(value.collected)?value.collected:[]).filter(id => typeof id === 'string'))],
    keys:copyMap(value.keys), weapons:copyMap(value.weapons), abilities:copyMap(value.abilities),
    bags:{items:copyMap(value.bags?.items || value.inventory),radio:copyMap(value.bags?.radio)},
    usable:copyMap(value.usable),contentNames:copyMap(value.contentNames),
    inventory:copyMap(value.bags?.items || value.inventory), devices:copyMap(value.devices), unlocks:copyMap(value.unlocks),
    modifiers:(Array.isArray(value.modifiers)?value.modifiers:[]).flatMap(effect=>{try{const normalized=normalizeItemEffect(effect);return normalized.type==='modifier'?[normalized]:[];}catch{return [];}}),
    maxHealthBonus:Math.max(0, Number(value.maxHealthBonus) || 0),
    mapReveals:(Array.isArray(value.mapReveals)?value.mapReveals:[]).filter(entry=>typeof entry.scope==='string'&&Number.isFinite(entry.room)&&Number.isFinite(entry.radius)).map(entry=>({...entry})),
    armor:Math.max(0, Number(value.armor) || 0)
  };
}

// Build a transaction without touching the live player. The caller persists first.
export function planItemEffects(item, player = {}, abilities = {}, progress = {}) {
  const definition = normalizeItemDocument(item);
  const next = normalizeItemProgress(progress);
  const stats = {};
  for (const key of ['health','maxHealth','armor','credits','speed','jumpPower','revEfficiency','dashCooldownBase','upgradeSlots']) stats[key] = Number(player[key]) || 0;
  const enabled = {...abilities};
  const radioTracks = [], maps = [];
  for (const effect of definition.effects) {
    const {type, target, amount, operation} = effect;
    if(effect.when !== 'collect' || !['player','everyone'].includes(effect.recipient) || type === 'speed')continue;
    if (type === 'health') stats.health = Math.min(stats.maxHealth, stats.health + amount);
    else if (type === 'max-health') { stats.maxHealth += amount; stats.health += amount; next.maxHealthBonus += amount; }
    else if (type === 'armor') { stats.armor += amount; next.armor = stats.armor; }
    else if (type === 'currency') stats.credits += amount;
    else if (type === 'modifier') {
      stats[target] = applyItemModifier(stats[target],effect);
      next.modifiers.push({...effect});
    } else if (type === 'inventory') {
      next.contentNames[target]=effect.contentName||definition.name;
      const bag=next.bags[effect.bag];bag[target]=(Number(bag[target])||0)+amount;
      if(effect.bag==='radio')radioTracks.push(target);else next.inventory[target]=bag[target];
    }
    else if (type === 'map') maps.push(amount);
    else {
      const field = {key:'keys', weapon:'weapons', ability:'abilities', inventory:'inventory', device:'devices', unlock:'unlocks'}[type];
      next[field][target] = ['key','inventory'].includes(type) ? (Number(next[field][target]) || 0) + amount : true;
      if (type === 'ability' || type === 'weapon') enabled[target] = true;
    }
  }
  if(definition.effects.some(effect=>effect.when!=='collect')){
    next.bags.items[definition.id]=(Number(next.bags.items[definition.id])||0)+1;
    next.inventory[definition.id]=next.bags.items[definition.id];next.usable[definition.id]=definition;
  }
  return {definition, progress:next, stats, abilities:enabled, radioTracks, maps};
}

export function applyItemPlan(plan, game) {
  // Saving can take several frames. Apply to the current stats so damage, spending,
  // and movement modifiers that changed during the write are not overwritten.
  if (game.player) {
    const current=planItemEffects(plan.definition,game.player,game.abilities,game.itemProgress);
    const fields=new Set();
    for(const effect of plan.definition.effects){
      if(effect.when!=='collect'||!['player','everyone'].includes(effect.recipient))continue;
      const keys={health:['health'],'max-health':['maxHealth','health'],armor:['armor'],currency:['credits'],modifier:[effect.target]}[effect.type]||[];
      keys.forEach(key=>fields.add(key));
    }
    for(const key of fields)game.player[key]=current.stats[key];
  }
  game.abilities ||= {};
  for(const effect of plan.definition.effects)if(effect.when==='collect'&&['player','everyone'].includes(effect.recipient)&&(effect.type==='ability'||effect.type==='weapon'))game.abilities[effect.target]=true;
  game.itemProgress = plan.progress;
  syncItemGrantsToPlayer(game.player,plan.progress);
  if(game.player)game.player.itemModifiers=structuredClone(plan.progress.modifiers);
  game.ensureActiveWeaponAvailable?.();
  for (const radius of plan.maps) {
    const player = game.player, world = game.world;
    if (player && world) game.minimap?.revealNearbyRooms(world.roomAtTile?.(Math.floor(player.x/world.tileSize), Math.floor(player.y/world.tileSize)), radius);
  }
}

export function syncItemGrantsToPlayer(player,progress) {
  if(!player)return;
  player.bags=structuredClone(progress.bags);
  for(const field of ['keys','weapons','inventory','devices','unlocks'])player[field]={...progress[field]};
}
