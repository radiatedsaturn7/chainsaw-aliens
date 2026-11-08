import {safeGarageKey} from './CarPart.js';
import {createMechanicalState,repairMechanicalComponent,MECHANICAL_COMPONENTS} from '../racing/simulation/MechanicalModel.js';
import {DamageModel} from '../racing/simulation/DamageModel.js';
const clone=v=>structuredClone(v);
const SERVICE_JOBS=[
 {id:'service_fuel',label:'Fuel',key:'fuel',cost:15,description:'Refill the fuel tank.'},
 {id:'service_oil',label:'Oil',key:'oil',cost:10,temperature:'oilTemperatureC',target:90,description:'Top up oil and cool it to operating temperature.'},
 {id:'service_coolant',label:'Coolant',key:'coolant',cost:10,temperature:'coolantTemperatureC',target:85,description:'Refill coolant and cool the cooling system.'},
 {id:'service_battery',label:'Battery',key:'charge',cost:5,description:'Recharge the battery.'},
 {id:'service_brakes',label:'Cool Down',cost:0,description:'Let the brakes cool. Does not repair brake wear.'}
];
export function normalizeCarCondition(source={}){
 const damage=new DamageModel().normalizeState(clone(source.damage||new DamageModel().createState()));
 return {damage,mechanical:createMechanicalState(source.mechanical,damage)};
}
// Use each component once, even when the menu has nested subgroups.
export function repairConditionSummary(rows){
 const leaves=rows.flatMap(row=>row.children?repairLeaves(row.children):[row]);
 const all=leaves.find(row=>row.id==='all'&&row.conditionSummary);
 if(all)return all.conditionSummary;
 const service=leaves.find(row=>row.id==='service'&&row.conditionSummary);
 if(service&&leaves.every(row=>row.id==='service'||row.id.startsWith('service_')))return service.conditionSummary;
 const parts=leaves.filter(row=>row.repair&&Number.isFinite(row.value));
 const values=parts.map(row=>Math.max(0,Math.min(100,row.value)));
 const worst=parts.map(row=>Math.max(0,Math.min(100,row.conditionSummary?.worst??row.value)));
 return {average:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:100,worst:worst.length?Math.min(...worst):100,count:values.length};
}
function repairLeaves(rows){return rows.flatMap(row=>row.children?repairLeaves(row.children):[row]);}
export function repairConditionColor(worst){
 return worst<25?'#ef4444':worst<50?'#f97316':worst<75?'#facc15':'#4ade80';
}
export function repairRows(garage,ref,car){
 const condition=garage.configuration(ref).condition || {mechanical:createMechanicalState({}, {},car.mechanics)};
 const state=condition.mechanical;
 const rows=MECHANICAL_COMPONENTS.map(d=>{
  const c=state.components[d.id],required=state.config.components[d.id]?.requiredPart||'',available=!required||garage.items.progress.bags.items[required]>0;
  const needsRepair=c.failed||c.damage>0||(d.id.startsWith('alignment_')&&Math.abs(condition.damage?.suspensionPull||0)>0)||(d.id.startsWith('tire_')&&(state.tires[d.id.slice(5)].pressureRatio<.99||state.tires[d.id.slice(5)].tread<.99));
  const cost=needsRepair?Math.ceil((state.config.components[d.id]?.repairCost??d.cost)*Math.max(.1,c.failed?1:c.damage/100)):0;
  const tire=d.id.startsWith('tire_')?state.tires[d.id.slice(5)]:null;
  const health=c.failed?0:Math.min(100-c.damage,tire?100*Math.min(1,tire.pressureRatio,tire.tread):100);
  const symptoms=c.symptom||(c.failed?'Failed':c.damage>70?'Severe wear':c.damage>25?'Worn':'Operational');
  return {id:d.id,label:({panels:'Front',panel_left:'Left',panel_right:'Right',panel_rear:'Rear',bearings:'Bearings',fans:'Fans'}[d.id]||d.label.replace('brake hydraulics','hydraulics').replace('brake pads','pads')),repair:true,value:needsRepair?Math.min(99,health):100,cost,required:needsRepair?required:'',needsRepair,enabled:true,
   reason:`${symptoms}. ${cost} scrap.${needsRepair&&required?' Part: '+required+(available?' (owned)':' (missing)'):''}`,available};
 });
 const services=SERVICE_JOBS.map(job=>{
  const level=job.key?Math.max(0,Math.min(1,state[job.key])):1;
  const hot=job.temperature?state[job.temperature]>job.target:!job.key&&Object.values(state.tires).some(t=>t.brakeTemperatureC>25);
  const needsRepair=level<1||hot,value=needsRepair?Math.min(99,level*100):100;
  const cost=needsRepair?Math.ceil(job.cost*Math.max(hot ? .1 : 0,1-level)):0;
  return {id:job.id,label:job.label,repair:true,value,cost,enabled:true,needsRepair,reason:`${job.description} ${cost} scrap. Does not fix leaks or failed parts.`};
 });
 rows.unshift(...services);
 const conditionSummary=repairConditionSummary(rows);
 const total=rows.reduce((sum,r)=>sum+r.cost,0);
 const serviceSummary=repairConditionSummary(services);
 rows.unshift({id:'service',label:'All',repair:true,value:serviceSummary.average,conditionSummary:serviceSummary,cost:services.reduce((sum,row)=>sum+row.cost,0),enabled:true,needsRepair:services.some(row=>row.needsRepair),reason:'Service fuel, oil, coolant and battery, and cool the brakes. Does not repair failed components.'});
 rows.unshift({id:'all',label:'Repair All',repair:true,value:conditionSummary.average,conditionSummary,cost:total,enabled:true,needsRepair:rows.some(r=>r.needsRepair),reason:'Repair all components and service fluids. Required replacement parts are consumed only for components needing repair.'});
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
 const rows=repairRows(view,ref,car),selected=id==='all'?rows.filter(r=>!['all','service'].includes(r.id)&&r.needsRepair):id==='service'?rows.filter(r=>r.id.startsWith('service_')&&r.needsRepair):rows.filter(r=>r.id===id);
 if(!selected.length&&!['all','service'].includes(id))throw Error('Unknown repair');
 const repairs=selected.filter(r=>r.needsRepair);
 if(!repairs.length)return {debit:0};
 let debit=0;
 for(const row of repairs){debit+=row.cost;
  if(row.required){if(!(next.bags.items[row.required]>0))throw Error('Required replacement part: '+row.required);next.bags.items[row.required]--;next.inventory[row.required]=next.bags.items[row.required];}
 }
 if(debit>credits)throw Error('Not enough scrap');
 const state=setup.condition.mechanical;
 for(const row of repairs){
  const job=SERVICE_JOBS.find(job=>job.id===row.id);
  if(!job){repairMechanicalComponent(state,row.id);continue;}
  if(job.key)state[job.key]=1;
  if(job.temperature)state[job.temperature]=Math.min(job.target,state[job.temperature]);
  if(job.id==='service_brakes')for(const tire of Object.values(state.tires))tire.brakeTemperatureC=25;
 }
 if(repairs.some(row=>row.id.startsWith('alignment_')))setup.condition.damage.suspensionPull=0;

 // Recompute only health groups touched by the repair. Other systems retain their damage.
 const paths=new Set(MECHANICAL_COMPONENTS.filter(d=>repairs.some(r=>r.id===d.id)).map(d=>d.damagePath));
 for(const path of paths){const members=MECHANICAL_COMPONENTS.filter(d=>d.damagePath===path);const value=Math.max(...members.map(d=>state.components[d.id].damage));
  const keys=path.split('.');if(keys.length===1)setup.condition.damage[path]=value;else setup.condition.damage[keys[0]][keys[1]]=value;
  for(const member of members)state.observedDamage[member.id]=value;
 }
 return {debit};
});}
