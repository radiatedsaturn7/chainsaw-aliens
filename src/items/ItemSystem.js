import {applyItemModifier} from './ItemDocument.js';
import {loadServerPreferenceAsync,saveServerPreference} from '../ui/serverPreferences.js';
import {normalizeItemProgress,planItemEffects,applyItemPlan,syncItemGrantsToPlayer} from './ItemEffects.js';

export const ITEM_PROGRESS_KEY='rtg-item-progress';
export class ItemSystem {
  constructor(game,{load=loadServerPreferenceAsync,save=saveServerPreference}={}) {
    this.game=game;this.loadPreference=load;this.savePreference=save;
    this.progress=normalizeItemProgress();this.revision=0;this.events=[];this.sessionCollected=new Set();this.pending=new Map();this.retryAt=new Map();this.queue=Promise.resolve();this.appliedPlayers=new WeakSet();
  }
  async load() {
    if(!this.loading)this.loading=this.loadPreference(ITEM_PROGRESS_KEY,{}).then(value=>{
      this.progress=normalizeItemProgress(value);this.savedStats=value?.stats||null;this.ready=true;return this;
    }).catch(error=>{this.loading=null;throw error;});
    return this.loading;
  }
  restorePlayer() {
    const {player,minimap,world}=this.game;
    if(minimap&&this.restoredMinimap!==minimap){
      for(const reveal of this.progress.mapReveals)if(reveal.scope===world?.itemScope)minimap.revealNearbyRooms(reveal.room,reveal.radius);
      this.restoredMinimap=minimap;
    }
    if(!player||this.appliedPlayers.has(player))return;
    if(this.savedStats)for(const key of ['health','maxHealth','armor','credits'])if(Number.isFinite(this.savedStats[key]))player[key]=this.savedStats[key];
    this.game.abilities={...this.game.abilities,...this.progress.abilities,...this.progress.weapons};
    for(const effect of this.progress.modifiers){const value=Number(player[effect.target])||0;player[effect.target]=applyItemModifier(value,effect);}
    syncItemGrantsToPlayer(player,this.progress);
    player.itemModifiers=structuredClone(this.progress.modifiers);
    this.game.itemProgress=this.progress;this.game.ensureActiveWeaponAvailable?.();this.appliedPlayers.add(player);
  }
  restoreAfterTravel(snapshot) {
    let progress=normalizeItemProgress(snapshot.itemProgress);
    for(const event of this.events.filter(event=>event.revision>Number(snapshot.itemRevision||0))){
      const plan=planItemEffects(event.item,this.game.player,this.game.abilities,progress);
      applyItemPlan(plan,this.game);progress=plan.progress;
    }
    this.game.itemProgress=this.progress;
    syncItemGrantsToPlayer(this.game.player,this.progress);
    if(this.game.player)this.game.player.itemModifiers=structuredClone(this.progress.modifiers);
    this.game.abilities={...this.game.abilities,...this.progress.abilities,...this.progress.weapons};
    this.game.ensureActiveWeaponAvailable?.();
  }
  beginRun(){this.sessionCollected.clear();this.retryAt.clear();}
  isCollected(id){return this.sessionCollected.has(id)||this.progress.collected.includes(id);}
  collect(item,id) {
    if(!id)return Promise.resolve(false);
    if(this.pending.has(id))return this.pending.get(id);
    if(Date.now()<(this.retryAt.get(id)||0))return Promise.resolve(false);
    const task=this.queue.then(async()=>{
      await this.load();this.restorePlayer();if(this.isCollected(id))return false;
      const plan=planItemEffects(item,this.game.player,this.game.abilities,this.progress);
      for(const trackId of plan.radioTracks){
        const radio=this.game.radio;if(!radio)throw Error('Radio is unavailable.');await radio.load();
        if(!radio.library.tracks.some(track=>track.id===trackId))throw Error('This item needs an existing radio track.');
      }
      for(const radius of plan.maps){
        const {world,player}=this.game;
        const room=world?.roomAtTile?.(Math.floor(player.x/world.tileSize),Math.floor(player.y/world.tileSize));
        if(Number.isFinite(room))plan.progress.mapReveals.push({scope:world.itemScope,room,radius});
      }
      // Radio unlocks are idempotent. If either write fails, keep the pickup available.
      for(const trackId of plan.radioTracks)await this.game.radio.unlock(trackId);
      {
        if(plan.definition.persistent)plan.progress.collected.push(id);
        const stats={...this.savedStats};
        for(const effect of plan.definition.effects){
          const fields={health:['health'],'max-health':['maxHealth','health'],armor:['armor'],currency:['credits']}[effect.type]||[];
          for(const key of fields)stats[key]=plan.stats[key];
        }
        const result=await this.savePreference(ITEM_PROGRESS_KEY,{...plan.progress,stats});
        if(result?.ok===false)throw Error(result.reason||'Item progress could not be saved');
        this.savedStats=stats;
      }
      this.progress=plan.progress;applyItemPlan(plan,this.game);this.sessionCollected.add(id);
      this.events.push({revision:++this.revision,item:structuredClone(plan.definition)});
      this.game.showSystemToast?.(`${plan.definition.name} acquired`);return true;
    });
    const handled=task.catch(error=>{this.retryAt.set(id,Date.now()+5000);this.game.showSystemToast?.(`Item not collected: ${error.message}`);return false;}).finally(()=>this.pending.delete(id));
    this.queue=handled;this.pending.set(id,handled);return handled;
  }
}
