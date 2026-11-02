import {safeGarageKey} from './CarPart.js';
import {createMechanicalState,repairMechanicalComponent,MECHANICAL_COMPONENTS} from '../racing/simulation/MechanicalModel.js';
import {DamageModel} from '../racing/simulation/DamageModel.js';
const clone=v=>structuredClone(v);
export function normalizeCarCondition(source={}){
 const damage=new DamageModel().normalizeState(clone(source.damage||new DamageModel().createState()));
 return {damage,mechanical:createMechanicalState(source.mechanical,damage)};
}
export function repairRows(garage,ref,car){
 const condition=garage.configuration(ref).condition || {mechanical:createMechanicalState({}, {},car.mechanics)};
 const state=condition.mechanical;
 const rows=MECHANICAL_COMPONENTS.map(d=>{
  const c=state.components[d.id],required=state.config.components[d.id]?.requiredPart||'',available=!required||garage.items.progress.bags.items[required]>0;
  const needsRepair=c.failed||c.damage>0||(d.id.startsWith('alignment_')&&Math.abs(condition.damage?.suspensionPull||0)>0)||(d.id.startsWith('tire_')&&(state.tires[d.id.slice(5)].pressureRatio<.99||state.tires[d.id.slice(5)].tread<.99));
  const cost=needsRepair?Math.ceil((state.config.components[d.id]?.repairCost??d.cost)*Math.max(.1,c.failed?1:c.damage/100)):0;
  const symptoms=c.symptom||(c.failed?'Failed':c.damage>70?'Severe wear':c.damage>25?'Worn':'Operational');
  return {id:d.id,label:d.label,repair:true,value:c.failed?0:100-c.damage,cost,required,needsRepair,enabled:needsRepair,
   reason:`${symptoms}. ${cost} scrap.${required?' Part: '+required+(available?' (owned)':' (missing)'):''}`,available};
 });
 rows.unshift({id:'service',label:'Fluids & charge',repair:true,value:100,cost:40,enabled:true,needsRepair:true,reason:'Refuel, refill oil and coolant, and charge battery. 40 scrap. Does not fix leaks or failed parts.'});
 rows.unshift({id:'all',label:'Repair everything',repair:true,value:100,cost:40+rows.reduce((sum,r)=>sum+(r.id==='service'?0:r.cost),0),enabled:true,needsRepair:true,reason:'Repair all components and service fluids. Required replacement parts are consumed; missing parts prevent the transaction.'});
 return rows;
}
export function saveCarCondition(garage,ref,condition){
 if(!safeGarageKey(ref))return Promise.reject(Error('Choose a valid car'));const snapshot=normalizeCarCondition(condition);
 return garage.transaction(next=>{const setup=next.garage.cars[ref]||={installed:{},tune:{}};setup.condition=snapshot;});
}
export function repairCar(garage,ref,id,car){return garage.transaction((next,{credits})=>{
 if(!safeGarageKey(ref))throw Error('Choose a valid car');
 const setup=next.garage.cars[ref]||={installed:{},tune:{}};
 setup.condition=normalizeCarCondition(setup.condition||{mechanical:createMechanicalState({}, {},car.mechanics)});
 const view=Object.create(garage);Object.defineProperty(view,'items',{value:{...garage.items,progress:next}});
 const rows=repairRows(view,ref,car),selected=id==='all'?rows.filter(r=>!['all','service'].includes(r.id)&&r.needsRepair):rows.filter(r=>r.id===id);
 if(!selected.length&&id!=='all')throw Error('Unknown repair');
 let debit=(id==='all'?40:0);
 for(const row of selected){debit+=row.cost;if(!row.enabled)throw Error('This component is already healthy');
  if(row.required){if(!(next.bags.items[row.required]>0))throw Error('Required replacement part: '+row.required);next.bags.items[row.required]--;next.inventory[row.required]=next.bags.items[row.required];}
 }
 if(debit>credits)throw Error('Not enough scrap');
 const state=setup.condition.mechanical;
 for(const row of selected)if(row.id!=='service')repairMechanicalComponent(state,row.id);
 if(selected.some(row=>row.id.startsWith('alignment_')))setup.condition.damage.suspensionPull=0;
 if(id==='all'||id==='service'){state.fuel=state.oil=state.coolant=state.charge=1;state.coolantTemperatureC=Math.min(85,state.coolantTemperatureC);state.oilTemperatureC=Math.min(90,state.oilTemperatureC);for(const tire of Object.values(state.tires))tire.brakeTemperatureC=25;}
 // Recompute only health groups touched by the repair. Other systems retain their damage.
 const paths=new Set(MECHANICAL_COMPONENTS.filter(d=>selected.some(r=>r.id===d.id)).map(d=>d.damagePath));
 for(const path of paths){const members=MECHANICAL_COMPONENTS.filter(d=>d.damagePath===path);const value=Math.max(...members.map(d=>state.components[d.id].damage));
  const keys=path.split('.');if(keys.length===1)setup.condition.damage[path]=value;else setup.condition.damage[keys[0]][keys[1]]=value;
  for(const member of members)state.observedDamage[member.id]=value;
 }
 return {debit};
});}
