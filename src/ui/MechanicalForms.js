import {openEditorForm} from './shared/editorForm.js';
import {normalizeMechanicalConfig,MECHANICAL_COMPONENTS} from '../racing/simulation/MechanicalModel.js';
const slider=(id,label,value,min,max,step=.1)=>({id,label,type:'range',value,min,max,step});
export async function editCarMechanics(editor,showForm=openEditorForm){
 const car=editor.selectedCar;if(!car)return;
 const cfg=normalizeMechanicalConfig(car.mechanics);
 const fields=[{id:'enabled',label:'Mechanical failures enabled',type:'checkbox',value:cfg.enabled},
 slider('timeScale','Wear / fluid / battery time scale',cfg.timeScale,.1,60),slider('failureRate','Failure frequency',cfg.failureRate,0,10),
 slider('batteryAh','Battery capacity (Ah)',cfg.batteryAh,5,150,1),slider('fuelTankGallons','Fuel tank capacity (US gallons)',cfg.fuelTankGallons,1,100,.1),slider('fuelMpg','Reference cruise economy (US MPG)',cfg.fuelMpg,1,200,1),slider('fuelIdleGallonsPerHour','Idle fuel use (US gallons/hour)',cfg.fuelIdleGallonsPerHour,0,5,.05),slider('fuelConsumptionScale','Fuel consumption multiplier',cfg.fuelConsumptionScale,0,20,.1),{id:'fuelDoorSide',label:'Fuel filler door side',value:cfg.fuelDoorSide,options:['left','right']},slider('boostBar','Rated turbo boost (bar; 0 = no turbo)',cfg.boostBar,0,4),
 {id:'component',label:'Component to configure',value:MECHANICAL_COMPONENTS[0].id,options:MECHANICAL_COMPONENTS.map(c=>({value:c.id,label:c.label}))},
 {id:'component-settings',label:'Component durability, repair cost & replacement part',type:'button',onClick:async values=>{
  const id=values.component,part=cfg.components[id];const result=await showForm(MECHANICAL_COMPONENTS.find(c=>c.id===id).label,[
   slider('durability','Durability multiplier',part.durability,.1,10),slider('repairCost','Full repair cost (scrap)',part.repairCost,0,5000,1),
   {id:'requiredPart',label:'Required inventory item ID (blank = scrap only)',type:'text',required:false,value:part.requiredPart}
  ],{description:'An exact item ID provides compatibility: only this salvaged replacement can repair this component. Create a pickup with an Inventory effect granting that ID in the Item Editor.'});
  if(result)cfg.components[id]={durability:Number(result.durability),repairCost:Number(result.repairCost),requiredPart:result.requiredPart||''};
  return values;
 }}];
 const result=await showForm('Mechanical systems',fields,{description:'Existing handling and damage remain. Wear time scaling accelerates leaks, wear and battery consumption. Fuel burn uses reference US MPG, distance, engine load and its separate multiplier. These are gameplay calibration values, not manufacturer-certified ratings. Healthy cars do not roll random failures.'});
 if(!result||editor.selectedCar!==car)return;
 editor.captureRaceHistory('Mechanical systems');car.mechanics=normalizeMechanicalConfig({...cfg,...result});editor.status='Mechanical systems updated. Save the car.';
}
export async function editMechanicalMission(editor,showForm=openEditorForm){
 const race=editor.selectedRace;if(!race)return;
 const mission=structuredClone(race.mechanicalMission||{});mission.components||={};mission.requiredParts||={};
 const result=await showForm('Mechanical mission',[
 {id:'headlights',label:'Start with headlights on',type:'checkbox',value:mission.headlights!==false},
 ...['charge','oil','coolant'].map(id=>slider(id,({charge:'Battery charge',fuel:'Fuel',oil:'Oil',coolant:'Coolant'})[id]+' at start (%)',100*(mission[id]??1),0,100,1)),
 {id:'overrideFluids',label:'Override saved fluid and battery levels at start',type:'checkbox',value:mission.charge!==undefined},
 {id:'component',label:'Starting component',value:'alternator',options:MECHANICAL_COMPONENTS.map(c=>({value:c.id,label:c.label}))},
 {id:'fault',label:'Configure starting fault',type:'button',onClick:async values=>{
 const id=values.component,old=mission.components[id]||{};
 const fault=await showForm('Starting '+MECHANICAL_COMPONENTS.find(c=>c.id===id).label,[
 {id:'override',label:'Apply starting condition',type:'checkbox',value:!!mission.components[id]},slider('damage','Damage (0 = healthy)',old.damage??(old.failed?100:0),0,100,1),
 {id:'failed',label:'Failed at start',type:'checkbox',value:old.failed===true},
 {id:'part',label:'Required replacement inventory ID',type:'text',required:false,value:mission.requiredParts[id]||''}
 ]);if(fault){if(fault.override)mission.components[id]={damage:Number(fault.damage),failed:fault.failed};else delete mission.components[id];if(fault.part)mission.requiredParts[id]=fault.part;else delete mission.requiredParts[id];}return values;
 }},
 {id:'requiredInventory',label:'Inventory ID required at finish (blank = none)',type:'text',required:false,value:mission.requiredInventory||''},
 slider('minimumVoltage','Minimum battery voltage at finish (0 = no requirement)',mission.minimumVoltage??0,0,14.2),
 {id:'outputPrefix',label:'Mission variable prefix',type:'text',value:mission.outputPrefix||'mechanical',required:false}
 ],{description:'Starting faults are applied each time this race starts. Place salvage pickups using existing item placement. At the finish, missing salvage or low voltage produces a failed mission result instead of trapping the player in the race. Use published variables in world-map and menu conditions.'});
 if(!result||editor.selectedRace!==race)return;
 editor.captureRaceHistory('Mechanical mission');
 for(const id of ['charge','oil','coolant']){if(result.overrideFluids)mission[id]=Number(result[id])/100;else delete mission[id];}
 Object.assign(mission,{headlights:result.headlights,requiredInventory:result.requiredInventory||'',minimumVoltage:Number(result.minimumVoltage),outputPrefix:String(result.outputPrefix||'mechanical').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,60)});
 race.mechanicalMission=mission;editor.status='Mechanical mission updated. Save the race.';
}

export async function editRaceStartingFuel(editor,showForm=openEditorForm){
 const race=editor.selectedRace;if(!race)return;
 const m=race.mechanicalMission||{},old=m.startingFuel||(m.fuel!==undefined?{mode:'percent',value:m.fuel*100}:{mode:'saved',value:100});
 const result=await showForm('Starting fuel',[
 {id:'mode',label:'Starting fuel',value:old.mode,options:[{value:'saved',label:'Keep saved fuel level'},{value:'percent',label:'Percent of this car’s tank'},{value:'gallons',label:'US gallons'}]},
 {id:'value',label:s=>s.mode==='gallons'?'Starting US gallons':'Starting percent',value:old.value,min:0,max:100,step:.1,visibleWhen:s=>s.mode!=='saved'}
 ],{description:'Applied to the selected car using its tank capacity. Amounts above capacity are capped at full. Restarting a race with preserved condition does not refill the tank.'});
 if(!result||editor.selectedRace!==race)return;
 editor.captureRaceHistory('Starting fuel');race.mechanicalMission||={};delete race.mechanicalMission.fuel;
 if(result.mode==='saved')delete race.mechanicalMission.startingFuel;else race.mechanicalMission.startingFuel={mode:result.mode,value:Math.max(0,Number(result.value)||0)};
 editor.status='Starting fuel updated. Save the race.';
}
