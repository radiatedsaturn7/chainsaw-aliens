import {itemLibrary} from './ItemLibrary.js';
import {ItemSystem} from './ItemSystem.js';

export const isItemPickup=placement=>placement?.itemType==='item';
export function getItemSystem(game) {return game.items ||= new ItemSystem(game);}
export function itemPlacementId(placement) {return `item:${placement.id}`;}
export function collectItemPlacement(game,placement) {
  return getItemSystem(game).collect(placement.item||placement,itemPlacementId(placement));
}
export function updateLevelItems(game) {
  const player=game.player;if(!player||player.dead)return;
  const system=getItemSystem(game);
  if(!system.ready){if(!system.preparing)system.preparing=system.load().then(()=>{system.ready=true;system.restorePlayer();}).catch(error=>game.showSystemToast?.(error.message)).finally(()=>{system.preparing=null;});return;}
  system.restorePlayer();
  for(const placement of game.world?.decals||[]) {
    if(!isItemPickup(placement)||system.isCollected(itemPlacementId(placement)))continue;
    if(player.x+player.width/2<placement.x||player.x-player.width/2>placement.x+placement.w||player.y+player.height/2<placement.y||player.y-player.height/2>placement.y+placement.h)continue;
    void collectItemPlacement(game,placement);
  }
}

// Legacy map tiles stay loadable, but their effects come from editable item files.
export function updateLegacyItemPickups(game) {
  const player=game.player;if(!player||player.dead)return;
  const system=getItemSystem(game);
  game.legacyItemPending ||= new Set();
  const groups=[...(game.world.abilityPickups||[]).map(pickup=>({pickup,ref:pickup.itemRef||pickup.ability})),...(game.world.mapPickups||[]).map(pickup=>({pickup,ref:pickup.itemRef||'map'})),...(game.world.healthUpgrades||[]).map(pickup=>({pickup,ref:pickup.itemRef||'vitality-core'}))];
  for(const {pickup,ref} of groups){
    const id=`legacy:${game.world.itemScope||"level"}:${pickup.id}`;
    if(system.isCollected(id)){pickup.collected=true;continue;}
    if(pickup.collected||game.legacyItemPending.has(pickup)||Math.hypot(pickup.x-player.x,pickup.y-player.y)>=30)continue;
    game.legacyItemPending.add(pickup);
    void itemLibrary.load(ref).then(item=>system.collect(item,id)).then(collected=>{
      if(!collected)return;pickup.collected=true;game.audio?.pickup?.();game.spawnEffect?.('pickup',pickup.x,pickup.y-8);
    }).catch(error=>game.showSystemToast?.(error.message)).finally(()=>game.legacyItemPending.delete(pickup));
  }
}
