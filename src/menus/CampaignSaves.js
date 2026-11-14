import {HAPTIC_DEFAULTS} from '../racing/RaceHaptics.js';
import {normalizeCarCondition,repairRows,repairConditionSummary} from '../garage/GarageRepairs.js';
import {loadServerPreferenceAsync, saveServerPreference} from '../ui/serverPreferences.js';
import {normalizeMenuVariables} from './MenuProgress.js';
import {normalizeItemProgress} from '../items/ItemEffects.js';

export const CAMPAIGN_SAVE_KEY = 'campaign-save-slots';
const freshStats = () => ({health:5,maxHealth:5,armor:0,credits:0});
const copy = value => structuredClone(value);
const validSlot = index => Number.isInteger(index) && index >= 0 && index < 3;

// Compute at save/load migration time, never while opening the slot menu.
function savedCarSummary(slot){
  const car=slot.progress?.selectedGameCar||'';
  const condition=normalizeCarCondition(slot.items?.garage?.cars?.[car]?.condition);
  const garage={configuration:()=>({condition}),items:{progress:{bags:{items:{}}}}};
  return {car,condition:Math.round(repairConditionSummary(repairRows(garage,car,{})).average)};
}

export class CampaignSaves {
  constructor(game, {load=loadServerPreferenceAsync, save=saveServerPreference, now=Date.now}={}) {
    this.game=game;this.loadPreference=load;this.savePreference=save;this.now=now;
    this.slots=[null,null,null];this.activeSlot=null;this.queue=Promise.resolve();this.playTimes=new Map();
  }
  tick(dt){
    const game=this.game,menu=game.menuPlayer,session=game.raceEditor?.playtestSession;
    if(!this.hasActive||menu?.preview||globalThis.document?.hidden)return;
    const inMenu=game.state==='menu-player'&&menu?.flow?.active&&!menu.paused&&
      !['splash','settings','mapping','vibration','vibration-effects'].includes(menu.flow.screenId)&&!menu.flow.screenId.startsWith('saves-');
    const inRace=game.state==='race-editor'&&game.raceTravelSession&&session?.running&&!session.preparing&&!session.raceResults&&!game.raceEditor?.raceInput?.paused;
    if(!(inMenu||inRace)||!Number.isFinite(dt)||dt<=0)return;
    const index=this.activeSlot;
    this.playTimes.set(index,this.playSeconds(index)+Math.min(dt,1));
  }
  playSeconds(index){return Math.max(0,Number(this.playTimes.get(index)??this.slots[index]?.playTimeSeconds)||0);}
  get hasActive(){return validSlot(this.activeSlot);}
  async load(){
    if(!this.loading)this.loading=(async()=>{
      const saved=await this.loadPreference(CAMPAIGN_SAVE_KEY,null);
      if(saved?.version===1 && Array.isArray(saved.slots)){
        this.slots=Array.from({length:3},(_,i)=>saved.slots[i]?.progress && saved.slots[i]?.items ? copy(saved.slots[i]) : null);
      }else{
        const progress=normalizeMenuVariables(this.game.menuProgress||await this.loadPreference('menu-progress',{}));
        if(Object.keys(progress).length){
          const items=await this.loadPreference('rtg-item-progress',{});
          const slots=[{savedAt:this.now(),progress:copy(progress),items:copy(items),parameters:{carRef:progress.selectedGameCar}},null,null];
          await this.persist(slots);this.slots=slots;
        }
      }
      for(const slot of this.slots)if(slot && (!slot.summary || !Number.isFinite(slot.summary.condition)))slot.summary=savedCarSummary(slot);
      return this;
    })().catch(error=>{this.loading=null;throw error;});
    return this.loading;
  }
  async persist(slots){
    for(const slot of slots)if(slot)slot.summary=savedCarSummary(slot);
    const result=await this.savePreference(CAMPAIGN_SAVE_KEY,{version:1,slots});
    if(!result?.ok)throw Error('Could not save game progress. Please try again.');
  }
  serialize(task){const result=this.queue.then(task);this.queue=result.catch(()=>{});return result;}
  capture(){
    const items=this.game.items;
    const stats={...freshStats(),...items?.savedStats};
    for(const key of Object.keys(stats))if(Number.isFinite(this.game.player?.[key]))stats[key]=this.game.player[key];
    const params=this.game.menuPlayer?.flow?.parameters||{};
    return {savedAt:this.now(),playTimeSeconds:this.playSeconds(this.activeSlot),progress:copy(this.game.menuProgress||{}),
      settings:copy(this.game.menuPlayer?.settings?.parameters?.()||{}),
      haptics:copy(this.game.raceHaptics?.settings||HAPTIC_DEFAULTS),
      items:{...copy(items?.progress||normalizeItemProgress()),stats},
      parameters:Object.fromEntries(['carRef','raceRef','difficulty'].filter(k=>params[k]!==undefined).map(k=>[k,copy(params[k])]))};
  }
  save(patch={}){
    if(!this.hasActive || this.game.menuPlayer?.preview)return Promise.resolve({ok:true});
    const index=this.activeSlot;
    return this.serialize(async()=>{
      const current=this.capture();
      const snapshot={...this.slots[index],...(Object.keys(patch).length?copy(patch):current),parameters:current.parameters,playTimeSeconds:current.playTimeSeconds,savedAt:this.now()};
      const slots=this.slots.slice();slots[index]=snapshot;
      await this.persist(slots);this.slots=slots;return {ok:true};
    });
  }
  async settle(){await this.game.campaignSavePending?.catch(()=>{});await this.game.menuProgressSaving?.catch(()=>{});await this.game.menuPlayer?.settings?.persist;await this.game.menuPlayer?.hapticSave;await this.game.items?.queue;await this.queue;}
  async startNew(index,{overwrite=false}={}){
    if(!validSlot(index))throw Error('Choose a save slot.');
    await this.load();await this.settle();
    if(this.slots[index]&&!overwrite)throw Error('Confirm before overwriting this save slot.');
    const snapshot={savedAt:this.now(),playTimeSeconds:0,progress:{},items:{...normalizeItemProgress(),stats:{...freshStats(),credits:500}},parameters:{}};
    const slots=this.slots.slice();slots[index]=snapshot;
    await this.persist(slots);this.slots=slots;this.activeSlot=index;this.playTimes.set(index,0);this.restore(snapshot);return copy(snapshot);
  }
  async clear(index){
    if(!validSlot(index))throw Error('Choose a save slot.');
    await this.load();await this.settle();
    return this.serialize(async()=>{
      const slots=this.slots.slice();slots[index]=null;
      await this.persist(slots);this.slots=slots;this.playTimes.delete(index);
      if(this.activeSlot===index)this.activeSlot=null;
    });
  }
  async copySlot(source,destination){
    if(!validSlot(source)||!validSlot(destination)||source===destination)throw Error('Choose a different destination slot.');
    await this.load();await this.settle();
    return this.serialize(async()=>{
      if(!this.slots[source])throw Error('This save slot is empty.');
      const slots=this.slots.slice();slots[destination]={...copy(slots[source]),playTimeSeconds:this.playSeconds(source)};
      await this.persist(slots);this.slots=slots;this.playTimes.delete(destination);
      // A copied save becomes live only when explicitly selected from Start.
      if(this.activeSlot===destination)this.activeSlot=null;
    });
  }
  async resume(index){
    if(!validSlot(index))throw Error('Choose a save slot.');
    await this.load();await this.settle();
    const snapshot=this.slots[index];if(!snapshot)throw Error('This save slot is empty.');
    this.activeSlot=index;this.restore(snapshot);return copy(snapshot);
  }
  restore(snapshot){
    const game=this.game,items=game.items;
    game.menuProgress=normalizeMenuVariables(snapshot.progress);game.menuProgressLoading=Promise.resolve(game.menuProgress);
    game.menuPlayer?.settings?.restore(snapshot.settings||{});
    game.raceHaptics?.setSettings(snapshot.haptics||HAPTIC_DEFAULTS);
    if(!items)return;
    items.progress=normalizeItemProgress(snapshot.items);items.savedStats={...freshStats(),...snapshot.items.stats};
    items.events=[];items.revision=0;items.selectedItemId='';items.sessionCollected.clear();items.pending.clear();items.retryAt.clear();
    items.appliedPlayers=new WeakSet();items.restoredMinimap=null;items.ready=true;items.loading=Promise.resolve(items);
    items.garage.revision++;
    game.abilities={};items.restorePlayer();game.itemProgress=items.progress;
  }
  describeSlot(index){
    const slot=this.slots[index];if(!slot)return null;
    const {car,condition:health}=slot.summary||{car:slot.progress?.selectedGameCar||'',condition:100};
    const seconds=Math.floor(this.playSeconds(index));
    const time=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
    return {car,condition:health,time};
  }

  choices(){return this.slots.map((slot,index)=>({value:index,label:`Slot ${'ABC'[index]} — ${slot ? `${slot.progress.selectedGameCar||'Choose a car'} · ${Number(slot.items?.stats?.credits)||0} scrap` : 'Empty'}`}));}
}
export async function loadCampaignSaves(game){game.campaignSaves ||= new CampaignSaves(game);await game.campaignSaves.load();return game.campaignSaves;}
