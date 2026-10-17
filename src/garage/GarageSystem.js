import {createTireDefinition} from '../racing/raceTires.js';
import {buildGarageCar,garageTuningRanges,normalizeCarPart,partFits,safeGarageKey} from './CarPart.js';
import {normalizeItemDocument} from '../items/ItemDocument.js';
import {normalizeItemProgress,syncItemGrantsToPlayer} from '../items/ItemEffects.js';
import {loadSavedTire} from '../ui/TireLibrary.js';

export class GarageSystem {
 constructor(items,{loadTire=ref=>ref.startsWith('builtin:')?Promise.resolve(createTireDefinition(ref.slice(8))):loadSavedTire(ref)}={}){this.items=items;this.loadTire=loadTire;this.revision=0;}
 get progress(){return this.items.progress.garage;}
 async load(){await this.items.load();return this;}
 configuration(ref,progress=this.items.progress){return progress.garage.cars[ref]||{installed:{},tune:{}};}
 installed(ref,progress=this.items.progress){return Object.values(this.configuration(ref,progress).installed).map(id=>progress.garage.parts[id]).filter(Boolean);}
 owned(progress=this.items.progress){return Object.values(progress.garage.parts).filter(item=>progress.bags.items[item.id]>0);}
 availableCount(id,progress=this.items.progress){return (Number(progress.bags.items[id])||0)-Object.values(progress.garage.cars).reduce((n,setup)=>n+Object.values(setup.installed).filter(value=>value===id).length,0);}
 transaction(change){
  const items=this.items;
  const task=items.queue.then(async()=>{
   await items.load();items.restorePlayer();
   const next=normalizeItemProgress(items.progress),stats={...items.savedStats};
   const beforeCredits=Number(items.game.player?.credits??stats.credits)||0;
   const result=await change(next,{credits:beforeCredits});
   const debit=Number(result?.debit)||0;
   if(debit>beforeCredits)throw Error('Not enough credits');
   if(debit)stats.credits=beforeCredits-debit;
   const saved=await items.savePreference('rtg-item-progress',{...next,stats});
   if(saved?.ok===false)throw Error(saved.reason||'Garage could not be saved');
   items.progress=next;items.savedStats=stats;items.game.itemProgress=next;
   if(debit&&items.game.player)items.game.player.credits=Math.max(0,items.game.player.credits-debit);
   syncItemGrantsToPlayer(items.game.player,next);this.revision++;return result;
  });items.queue=task.catch(()=>{});return task;
 }
 purchase(ref,{carRef}={}){return this.transaction(async(next)=>{
  const item=normalizeItemDocument(await this.items.library.load(ref)),part=item.carPart;
  if(!part||!part.forSale)throw Error('This item is not for sale');
  if(part.unlockKey&&!next.unlocks[part.unlockKey])throw Error('This part has not been unlocked');
  next.garage.parts[item.id]=item;next.bags.items[item.id]=(Number(next.bags.items[item.id])||0)+1;
  next.inventory[item.id]=next.bags.items[item.id];next.contentNames[item.id]=item.name;
  if(carRef){
   if(!safeGarageKey(carRef)||!partFits(part,carRef))throw Error('This part does not fit the selected car');
   const setup=next.garage.cars[carRef]||={installed:{},tune:{}};
   setup.installed[part.slot]=item.id;this.validateSetup(carRef,next);this.pruneTune(carRef,next);
  }
  return {debit:part.price,item};
 });}
 equip(carRef,id){return this.transaction(next=>{
  if(!safeGarageKey(carRef))throw Error('Choose a car');
  const item=next.garage.parts[id],part=item?.carPart;if(!part||!(next.bags.items[id]>0))throw Error('You do not own this part');
  if(!partFits(part,carRef))throw Error('This part does not fit the selected car');
  const setup=next.garage.cars[carRef]||={installed:{},tune:{}};
  if(setup.installed[part.slot]===id)return;
  if(this.availableCount(id,next)<1)throw Error('This part is installed on another car');
  setup.installed[part.slot]=id;
  this.validateSetup(carRef,next);this.pruneTune(carRef,next);
 });}
 remove(carRef,slot){return this.transaction(next=>{
  const setup=next.garage.cars[carRef];if(!setup)return;
  delete setup.installed[slot];this.validateSetup(carRef,next);this.pruneTune(carRef,next);
 });}
 validateSetup(ref,progress){
  const setup=this.configuration(ref,progress);
  for(const [slot,id] of Object.entries(setup.installed)){
   if(!(progress.bags.items[id]>0)||progress.garage.parts[id]?.carPart.slot!==slot)throw Error('An installed part is unavailable');
   if(this.availableCount(id,progress)<0)throw Error('Not enough copies of an installed part');
  }
  const parts=this.installed(ref,progress),ids=parts.map(item=>item.id);
  for(const item of parts)for(const id of item.carPart.requires)if(!ids.includes(id))throw Error(`${item.name} requires another installed part`);
  garageTuningRanges(parts);
 }
 pruneTune(ref,progress){const ranges=garageTuningRanges(this.installed(ref,progress)),setup=progress.garage.cars[ref];
  setup.tune=Object.fromEntries(Object.entries(setup.tune).filter(([id,value])=>ranges[id]&&value>=ranges[id].min&&value<=ranges[id].max));
 }
 tune(carRef,field,value){return this.setTune(carRef,{[field]:value});}
 setTune(carRef,values){return this.transaction(next=>{
  const ranges=garageTuningRanges(this.installed(carRef,next));
  for(const [field,value] of Object.entries(values)){
   const range=ranges[field];if(!range)throw Error('Install a part that unlocks this setting');
   const number=Number(value);if(!Number.isFinite(number)||number<range.min||number>range.max)throw Error('Value is outside the tuning range');
   next.garage.cars[carRef].tune[field]=number;
  }
 });}
 resetTune(carRef){return this.transaction(next=>{if(next.garage.cars[carRef])next.garage.cars[carRef].tune={};});}
 async build(carRef,stock){
  await this.load();const parts=this.installed(carRef);
  for(const item of parts)if(!partFits(item.carPart,carRef,stock))throw Error('An installed part is no longer compatible');
  this.validateSetup(carRef,this.items.progress);
  const tires={};for(const item of parts)if(item.carPart.tireRef)tires[item.carPart.tireRef]=await this.loadTire(item.carPart.tireRef);
  return buildGarageCar(stock,{parts,tune:this.configuration(carRef).tune,tires});
 }
}
