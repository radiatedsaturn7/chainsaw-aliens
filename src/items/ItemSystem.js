import {ItemRuntime} from './ItemRuntime.js';
import {normalizeItemDocument} from './ItemDocument.js';
import {applyItemModifier} from './ItemDocument.js';
import {loadServerPreferenceAsync,saveServerPreference} from '../ui/serverPreferences.js';
import {normalizeItemProgress,planItemEffects,applyItemPlan,syncItemGrantsToPlayer} from './ItemEffects.js';

export const ITEM_PROGRESS_KEY='rtg-item-progress';
export class ItemSystem {
  constructor(game,{load=loadServerPreferenceAsync,save=saveServerPreference}={}) {
    this.game=game;this.runtime=new ItemRuntime(game);this.selectedItemId='';this.loadPreference=load;this.savePreference=save;
    this.progress=normalizeItemProgress();this.revision=0;this.events=[];this.sessionCollected=new Set();this.pending=new Map();this.retryAt=new Map();this.queue=Promise.resolve();this.appliedPlayers=new WeakSet();
  }
  async load() {
    if(!this.loading)this.loading=Promise.all([this.loadPreference(ITEM_PROGRESS_KEY,{}),this.loadPreference('rtg-radio-progress',{}),this.loadPreference('rtg-radio-library',{})]).then(async([value,radio,library])=>{
      this.progress=normalizeItemProgress(value);
      const tracks=[...(value?.bags ? [] : radio?.unlocked||[]),...(library?.tracks||[]).filter(t=>t.initiallyUnlocked).map(t=>t.id)];
      const added=tracks.filter(id=>!(this.progress.bags.radio[id]>0));
      for(const id of added)this.progress.bags.radio[id]=1;
      if(added.length){const result=await this.savePreference(ITEM_PROGRESS_KEY,{...this.progress,stats:value?.stats});if(result?.ok===false)throw Error('Inventory could not be saved.');}
      this.savedStats=value?.stats||null;this.ready=true;return this;
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
  grantRadioTrack(id) {
    const task=this.queue.then(async()=>{
      await this.load();if(this.progress.bags.radio[id]>0)return false;
      const next=normalizeItemProgress(this.progress);next.bags.radio[id]=1;
      const result=await this.savePreference(ITEM_PROGRESS_KEY,{...next,stats:this.savedStats});
      if(result?.ok===false)throw Error('Inventory could not be saved.');
      this.progress=next;this.game.itemProgress=next;syncItemGrantsToPlayer(this.game.player,next);this.game.radio?.onChange?.();return true;
    });this.queue=task.catch(()=>{});return task;
  }
  usableItems(){return Object.values(this.progress.usable).filter(item=>this.progress.bags.items[item.id]>0);}
  async use(id=this.usableItems().some(item=>item.id===this.selectedItemId)?this.selectedItemId:this.usableItems()[0]?.id){
    const task=this.queue.then(async()=>{
      await this.load();this.restorePlayer();
      const item=this.progress.usable[id];if(!item||!(this.progress.bags.items[id]>0))return false;
      const session=this.game.raceEditor?.playtestSession;if(session?.carEditorPreview)return false;
      const definition=normalizeItemDocument({...item,effects:item.effects.filter(e=>e.when==='use').map(e=>({...e,when:'collect'}))});
      const plan=planItemEffects(definition,this.game.player,this.game.abilities,this.progress);
      for(const track of plan.radioTracks){await this.game.radio?.load();if(!this.game.radio?.library.tracks.some(entry=>entry.id===track))throw Error('Track unavailable.');}
      plan.progress.bags.items[id]-=1;plan.progress.inventory[id]=plan.progress.bags.items[id];
      const stats={...this.savedStats};
      for(const effect of definition.effects){
        if(!['player','everyone'].includes(effect.recipient))continue;
        for(const key of ({health:['health'],'max-health':['maxHealth','health'],armor:['armor'],currency:['credits']}[effect.type]||[]))stats[key]=plan.stats[key];
      }
      const result=await this.savePreference(ITEM_PROGRESS_KEY,{...plan.progress,stats});if(result?.ok===false)throw Error('Inventory could not be saved.');
      this.progress=plan.progress;this.savedStats=stats;this.selectedItemId=id;applyItemPlan(plan,this.game);
      this.events.push({revision:++this.revision,item:definition});
      this.runtime.apply(item,'use');this.runtime.fire(item);this.game.radio?.onChange?.();return true;
    });
    this.queue=task.catch(()=>{});
    return task.catch(error=>{this.game.showSystemToast?.(error.message);return false;});
  }
  beginRun(){this.runtime.reset();this.sessionCollected.clear();this.retryAt.clear();}
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
      // Track ownership is committed with the rest of the inventory in one write.
      {
        if(plan.definition.persistent)plan.progress.collected.push(id);
        const stats={...this.savedStats};
        for(const effect of plan.definition.effects){
          if(effect.when!=='collect'||!['player','everyone'].includes(effect.recipient))continue;
          const fields={health:['health'],'max-health':['maxHealth','health'],armor:['armor'],currency:['credits']}[effect.type]||[];
          for(const key of fields)stats[key]=plan.stats[key];
        }
        const result=await this.savePreference(ITEM_PROGRESS_KEY,{...plan.progress,stats});
        if(result?.ok===false)throw Error(result.reason||'Item progress could not be saved');
        this.savedStats=stats;
      }
      this.progress=plan.progress;applyItemPlan(plan,this.game);this.game.radio?.onChange?.();this.sessionCollected.add(id);this.runtime.apply(plan.definition,'collect');
      this.events.push({revision:++this.revision,item:structuredClone(plan.definition)});
      this.game.showSystemToast?.(`${plan.definition.name} acquired`);return true;
    });
    const handled=task.catch(error=>{this.retryAt.set(id,Date.now()+5000);this.game.showSystemToast?.(`Item not collected: ${error.message}`);return false;}).finally(()=>this.pending.delete(id));
    this.queue=handled;this.pending.set(id,handled);return handled;
  }
}
