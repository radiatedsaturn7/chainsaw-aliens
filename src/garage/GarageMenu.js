import {CAR_PART_FIELDS,garageTuningRanges,readCarSetting} from './CarPart.js';
import {openEditorForm} from '../ui/shared/editorForm.js';

export const GARAGE_ACTION_LABELS={
 'garage-buy':'Buy car part','garage-install':'Install car part','garage-remove':'Remove car part',
 'garage-tune':'Tune installed parts','garage-reset':'Reset car tuning'
};
export async function runGarageAction(garage,type,partRef,parameters,{resolveCar}={}){
 const ref=parameters.carRef;
 if(type==='garage-buy')return garage.purchase(partRef);
 if(!ref)throw Error('Choose a car first');
 if(type==='garage-install'){
  const item=await garage.items.library.load(partRef);return garage.equip(ref,item.id);
 }
 if(type==='garage-remove'){
  const item=await garage.items.library.load(partRef);
  if(garage.configuration(ref).installed[item.carPart?.slot]!==item.id)throw Error('This part is not installed');
  return garage.remove(ref,item.carPart.slot);
 }
 if(type==='garage-reset')return garage.resetTune(ref);
 if(type==='garage-tune'){
  const ranges=garageTuningRanges(garage.installed(ref));
  if(!Object.keys(ranges).length)throw Error('Install a tunable part first');
  const stock=await resolveCar(ref);if(!stock)throw Error('Car unavailable');
  const car=await garage.build(ref,stock),tune=garage.configuration(ref).tune;
  const fields=Object.entries(ranges).filter(([id])=>readCarSetting(car,id)!==undefined).map(([id,r])=>({id,label:CAR_PART_FIELDS.find(f=>f.id===id).label,value:tune[id]??Math.max(r.min,Math.min(r.max,readCarSetting(car,id)??r.min)),type:'number',min:r.min,max:r.max,step:r.step}));
  const result=await openEditorForm('Garage Tuning',fields);if(!result)return;
  return garage.setTune(ref,result);
 }
 throw Error('Unknown garage action');
}
// Standard widgets and actions: authors can rearrange or replace this screen.
export function createGarageMenuScreen(){
 const e=(id,type,label,x,y,w,h,extra={})=>({id,type,label,x,y,w,h,...extra});
 return {id:'garage',name:'Garage',elements:[
  e('garage-title','text','Garage',0.05,0.02,0.9,0.07),
  e('garage-car','choice','Car',0.05,0.11,0.9,0.08,{source:'cars',binding:'carRef'}),
  e('garage-preview','car-preview','Car',0.05,0.21,0.42,0.22,{binding:'carRef'}),
  e('garage-stats','car-stats','Specifications',0.52,0.21,0.43,0.22,{binding:'carRef'}),
  e('garage-part','choice','Part',0.05,0.46,0.9,0.08,{source:'garage-parts',binding:'partRef'}),
  e('garage-status','property-display','Status',0.05,0.56,0.9,0.06,{dataSource:'garage',property:'partStatus',binding:'partRef',fontSize:18}),
  ...[['buy','Buy'],['install','Install'],['remove','Remove']].map(([action,label],i)=>e(`garage-${action}`,'button',label,0.05+i*0.31,0.65,0.28,0.08,{action:{type:`garage-${action}`,target:'$partRef'}})),
  e('garage-tune','button','Tune',0.05,0.76,0.43,0.08,{action:{type:'garage-tune'}}),
  e('garage-reset','button','Reset tuning',0.52,0.76,0.43,0.08,{action:{type:'garage-reset'}}),
  e('garage-back','button','Back',0.05,0.88,0.9,0.08,{action:{type:'back'}})
 ]};
}
