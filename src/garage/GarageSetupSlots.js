import {buildGarageCar,garageTuningRanges,partFits,safeGarageKey} from './CarPart.js';
import {normalizeSavedSetups} from './GarageProgress.js';

function validateSlot(ref,index){
 if(!safeGarageKey(ref)||!Number.isInteger(index)||index<0||index>=8)throw Error('Choose a car and one of the eight setup slots');
}
async function buildSavedConfiguration(garage,ref,stock,progress){
 const parts=garage.installed(ref,progress),tires={},setup=garage.configuration(ref,progress);
 garage.validateSetup(ref,progress);
 for(const item of parts){
  if(!partFits(item.carPart,ref,stock))throw Error(item.name+' no longer fits this car');
  if(item.carPart.tireRef)tires[item.carPart.tireRef]=await garage.loadTire(item.carPart.tireRef);
 }
 const ranges=garageTuningRanges(parts);
 for(const [id,value] of Object.entries(setup.tune)){
  if(!ranges[id]||value<ranges[id].min||value>ranges[id].max)throw Error('Saved tuning is no longer supported by these parts');
 }
 return buildGarageCar(await garage.stockBaseline(stock),{parts,tires,tune:setup.tune});
}
export function saveGarageSetupSlot(garage,ref,stock,index,evaluate){
 validateSlot(ref,index);
 return garage.transaction(async next=>{
  if(!evaluate)throw Error('Car stats unavailable');
  const car=await buildSavedConfiguration(garage,ref,stock,next),rating=evaluate(car);
  const setup=next.garage.cars[ref]||={installed:{},tune:{}};
  const tire=garage.installed(ref,next).find(item=>item.carPart.slot==='tires');
  const tires=tire?tire.name.replace(/\s*Tires?\s*/ig,' ').trim():('Stock '+(stock.setup?.defaultTireCompound||'')).trim();
  setup.savedSetups=normalizeSavedSetups(setup.savedSetups);
  setup.savedSetups[index]={installed:structuredClone(setup.installed),tune:structuredClone(setup.tune),...(setup.setupId?{setupId:setup.setupId}:{}),pi:rating.points,tires};
 });
}
export function loadGarageSetupSlot(garage,ref,stock,index){
 validateSlot(ref,index);
 return garage.transaction(async next=>{
  const setup=next.garage.cars[ref],saved=setup?.savedSetups?.[index];
  if(!saved)throw Error('This slot is empty');
  setup.installed=structuredClone(saved.installed);setup.tune=structuredClone(saved.tune);
  if(saved.setupId)setup.setupId=saved.setupId;else delete setup.setupId;
  // Restoring a slot equips owned parts only; no purchases or repairs occur.
  await buildSavedConfiguration(garage,ref,stock,next);
 });
}
