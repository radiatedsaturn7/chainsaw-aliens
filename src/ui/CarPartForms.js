import {RACE_TIRE_COMPOUNDS} from '../racing/raceData.js';
import {CAR_PART_FIELDS,normalizeCarPart} from '../garage/CarPart.js';
import {openEditorForm} from './shared/editorForm.js';
import {listProjectFiles} from './projectFiles.js';
import {itemLibrary} from '../items/ItemLibrary.js';
const options=values=>values.map(value=>({value,label:value}));
const yesNo=options(['yes','no']);
const toggle=(id,label,value)=>({id,label,value:value?'yes':'no',options:yesNo});
const settingOptions=CAR_PART_FIELDS.map(f=>({value:f.id,label:f.label}));
export const CAR_PART_ACTIONS={'item-part':'Part Properties','item-part-changes':'Part Changes','item-part-tuning':'Tuning Unlocks','item-part-curve':'Torque Curve','item-part-remove':'Remove Part Definition'};
export async function editCarPart(item,section='properties'){
 const part=item.carPart||normalizeCarPart({slot:'engine'});
 if(section==='properties'){
  const entries=await itemLibrary.list(),items=(await Promise.all(entries.map(e=>itemLibrary.load(e.name).catch(()=>null)))).filter(Boolean);
  const cars=listProjectFiles('cars').map(e=>e.name),tires=listProjectFiles('tires').map(e=>e.name);
  const required=items.filter(e=>e.carPart&&e.id!==item.id);
  const unlocks=[...new Map(items.flatMap(e=>e.effects.filter(f=>f.type==='unlock').map(f=>[f.target,{value:f.target,label:f.contentName||e.name}]))).values()];
  if(part.unlockKey&&!unlocks.some(e=>e.value===part.unlockKey))unlocks.push({value:part.unlockKey,label:part.unlockKey});
  const result=await openEditorForm('Car Part Properties',[
   {id:'slot',label:'Installation slot',type:'text',value:part.slot,suggestions:['engine','turbo','ecu','transmission','tires','suspension','weight']},
   toggle('forSale','Available in shop',part.forSale),{id:'price',label:'Price (credits)',value:part.price,min:0},
   {id:'unlockKey',label:'Required unlock',value:part.unlockKey,options:[{value:'',label:'None'},...unlocks]},
   {id:'tireRef',label:'Install tires',value:part.tireRef,options:[{value:'',label:'No tire replacement'},...RACE_TIRE_COMPOUNDS.map(t=>({value:'builtin:'+t.id,label:t.label+' (template)'})),...options([...new Set([...tires,...(part.tireRef&&!part.tireRef.startsWith('builtin:')?[part.tireRef]:[])])])]},
   toggle('allCars','Fits all cars',!part.compatibleCars.length),
   ...[...new Set([...cars,...part.compatibleCars])].map((name,i)=>({...toggle(`car${i}`,`Fits ${name}`,part.compatibleCars.includes(name)),visibleWhen:s=>s.allCars==='no'})),
   ...required.map((other,i)=>toggle(`requires${i}`,`Requires ${other.name}`,part.requires.includes(other.id)))
  ]);
  if(result&&result.allCars==='no'&&![...new Set([...cars,...part.compatibleCars])].some((_,i)=>result[`car${i}`]==='yes'))throw Error('Choose at least one compatible car');
  if(result)item.carPart=normalizeCarPart({...part,...result,forSale:result.forSale==='yes',compatibleCars:result.allCars==='yes'?[]:[...new Set([...cars,...part.compatibleCars])].filter((_,i)=>result[`car${i}`]==='yes'),requires:required.filter((_,i)=>result[`requires${i}`]==='yes').map(e=>e.id)});
  return;
 }
 const key={changes:'modifiers',tuning:'tuning',curve:'torqueCurve'}[section];
 const entries=part[key];const fields=[];
 const rows=[...entries,section==='changes'?{field:'weightKg',operation:'add',value:0}:section==='tuning'?{field:'gearFinalDrive',min:2,max:6,step:0.1}:{rpm:4000,multiplier:1}];
 rows.forEach((entry,i)=>{
  const prefix=i===entries.length?'New':`${i+1}`;
  fields.push(toggle(`keep${i}`,`${prefix}: enabled`,i<entries.length));
  const visibleWhen=s=>s[`keep${i}`]==='yes';
  if(section==='curve')fields.push({id:`rpm${i}`,label:`${prefix}: RPM`,value:entry.rpm,min:0,visibleWhen},{id:`multiplier${i}`,label:`${prefix}: torque multiplier`,value:entry.multiplier,min:0.1,max:5,visibleWhen});
  else{
   fields.push({id:`field${i}`,label:`${prefix}: setting`,value:entry.field,options:settingOptions,visibleWhen});
   if(section==='changes')fields.push({id:`operation${i}`,label:`${prefix}: operation`,value:entry.operation,options:options(['add','multiply','set']),visibleWhen},{id:`value${i}`,label:`${prefix}: value`,value:entry.value,visibleWhen});
   else for(const name of ['min','max','step'])fields.push({id:`${name}${i}`,label:`${prefix}: ${name}`,value:entry[name],visibleWhen});
  }
 });
 const result=await openEditorForm({changes:'Part Changes',tuning:'Tuning Unlocks',curve:'Torque Curve'}[section],fields);
 if(result){const keys=section==='curve'?['rpm','multiplier']:section==='changes'?['field','operation','value']:['field','min','max','step'];
  item.carPart=normalizeCarPart({...part,[key]:rows.flatMap((_,i)=>result[`keep${i}`]==='yes'?[Object.fromEntries(keys.map(k=>[k,result[`${k}${i}`]]))]:[])});
 }
}
