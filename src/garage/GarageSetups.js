import {GARAGE_SETUP_PROFILES,getGarageSetupProfile,garageSetupPartIds,garageSetupTargets} from './GarageSetupProfiles.js';
import {buildGarageCar,garageTuningRanges,partFits,readCarSetting,safeGarageKey} from './CarPart.js';
import {normalizeItemDocument} from '../items/ItemDocument.js';

export async function loadGarageSetupCatalog(garage){
 const refs=[...new Set(GARAGE_SETUP_PROFILES.flatMap(garageSetupPartIds))];
 return new Map(await Promise.all(refs.map(async ref=>{
  try{const value=await garage.items.library.load(ref);return [ref,value?normalizeItemDocument(value):null];}catch{return [ref,null];}
 })));
}
function fitPackage(garage,progress,ref,stock,preset,catalog){
 const setup=progress.garage.cars[ref]||={installed:{},tune:{}};
 let cost=0,bought=0,reused=0;
 for(const partRef of garageSetupPartIds(preset)){
  const item=catalog.get(partRef),part=item?.carPart;
  if(!part)throw Error('Unavailable package part: '+partRef);
  if(!partFits(part,ref,stock))throw Error(item.name+' does not fit this car');
  if(setup.installed[part.slot]===item.id){reused++;continue;}
  if(garage.availableCount(item.id,progress)<=0){
   if(!part.forSale)throw Error(item.name+' is not for sale');
   if(part.unlockKey&&!progress.unlocks[part.unlockKey])throw Error(item.name+' is locked');
   progress.garage.parts[item.id]=item;
   progress.bags.items[item.id]=(Number(progress.bags.items[item.id])||0)+1;
   progress.inventory[item.id]=progress.bags.items[item.id];progress.contentNames[item.id]=item.name;
   cost+=part.price;bought++;
  }else reused++;
  setup.installed[part.slot]=item.id;
 }
 garage.validateSetup(ref,progress);garage.pruneTune(ref,progress);
 return {cost,bought,reused};
}
export function quoteGarageSetup(garage,ref,stock,id,catalog){
 if(!safeGarageKey(ref))throw Error('Choose a car first');
 const p=structuredClone(garage.items.progress);
 return fitPackage(garage,p,ref,stock,getGarageSetupProfile(id),catalog);
}
export function planGarageSetup(garage,ref,stock,built,id,progress=garage.items.progress){
 const profile=getGarageSetupProfile(id),targets=garageSetupTargets(profile,stock);
 const ranges=garageTuningRanges(garage.installed(ref,progress)),values={},skipped=[],clamped=[];
 for(const [field,target] of Object.entries(targets)){
  const range=ranges[field];
  if(!range||!Number.isFinite(readCarSetting(built,field))){skipped.push(field);continue;}
  const value=Math.max(range.min,Math.min(range.max,target));
  values[field]=Number(Math.min(range.max,range.min+Math.round((value-range.min)/range.step)*range.step).toFixed(8));
  if(Math.abs(values[field]-target)>range.step/2+.000001)clamped.push(field);
 }
 return {profile,values,skipped,clamped};
}
export async function applyGarageSetup(garage,ref,stock,id,{packageParts=false,expectedCost=null}={}){
 if(!safeGarageKey(ref))throw Error('Choose a car first');
 const profile=getGarageSetupProfile(id);
 await garage.load();
 const catalog=packageParts?await loadGarageSetupCatalog(garage):null;
 return garage.transaction(async next=>{
  const receipt=packageParts?fitPackage(garage,next,ref,stock,profile,catalog):{cost:0,bought:0,reused:0};
  if(packageParts&&Number.isFinite(expectedCost)&&receipt.cost!==expectedCost)throw Error('Package price changed. Reopen the setup to review the new cost.');
  const parts=garage.installed(ref,next),tires={};
  for(const item of parts){if(!partFits(item.carPart,ref,stock))throw Error('An installed part does not fit this car');if(item.carPart.tireRef)tires[item.carPart.tireRef]=await garage.loadTire(item.carPart.tireRef);}
  const built=buildGarageCar(stock,{parts,tires}),plan=planGarageSetup(garage,ref,stock,built,id,next);
  const setup=next.garage.cars[ref]||={installed:{},tune:{}};
  // Generic damping aliases bump/rebound. Remove the old generic override so
  // the preset's independent values stay deterministic on repeated switches.
  for(const axle of ['Front','Rear'])if(plan.values['bump'+axle]!==undefined&&plan.values['rebound'+axle]!==undefined)delete setup.tune['damping'+axle];
  Object.assign(setup.tune,plan.values);setup.setupId=id;
  garage.validateSetup(ref,next);
  buildGarageCar(stock,{parts,tires,tune:setup.tune});
  return {...receipt,debit:receipt.cost,applied:Object.keys(plan.values).length,skipped:plan.skipped.length,clamped:plan.clamped.length,label:profile.label};
 });
}
