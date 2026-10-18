import {CAR_PART_FIELDS,garageTuningRanges,readCarSetting,partFits} from './CarPart.js';
import {openEditorForm} from '../ui/shared/editorForm.js';

export const GARAGE_ACTION_LABELS={
 'garage-fit':'Buy / install selected upgrade',
 'garage-buy':'Buy car part','garage-install':'Install car part','garage-remove':'Remove car part',
 'garage-tune':'Tune installed parts','garage-reset':'Reset car tuning'
};
export async function runGarageAction(garage,type,partRef,parameters,{resolveCar}={}){
 const ref=parameters.carRef;
 const selectedPart=()=>partRef?.startsWith('owned:')?Promise.resolve(garage.progress.parts[partRef.slice(6)]):garage.items.library.load(partRef);
 if(type==='garage-buy'){if(partRef?.startsWith('owned:'))throw Error('This part is no longer in the shop');return garage.purchase(partRef);}
 if(!ref)throw Error('Choose a car first');
 if(type==='garage-fit'){
  if(!partRef)return garage.remove(ref,parameters.partSlot);
  const item=await selectedPart();if(!item?.carPart)throw Error('Part unavailable');
  const stock=await resolveCar?.(ref);if(!partFits(item.carPart,ref,stock))throw Error('This upgrade is disabled for the selected car');
  if(garage.configuration(ref).installed[item.carPart.slot]===item.id)return;
  if(garage.availableCount(item.id)>0)return garage.equip(ref,item.id);
  if(partRef.startsWith('owned:'))throw Error('This part is installed on another car');
  return garage.purchase(partRef,{carRef:ref});
 }
 if(type==='garage-install'){
  const item=await selectedPart();if(!item)throw Error('Part unavailable');const stock=await resolveCar?.(ref);if(!partFits(item.carPart,ref,stock))throw Error('This upgrade is disabled for the selected car');return garage.equip(ref,item.id);
 }
 if(type==='garage-remove'){
  const item=await selectedPart();if(!item)throw Error('Part unavailable');
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
  e('garage-preview','car-preview','Car',0.05,0.12,0.5,0.4,{binding:'carRef',angle:135}),
  e('garage-stats','car-stats','Specifications',0.56,0.12,0.39,0.28,{binding:'carRef'}),
  e('garage-play','button','Play',0.56,0.43,0.19,0.09,{tabOrder:1,action:{type:'screen',target:'events'}}),
  e('garage-back','button','Change Car',0.77,0.43,0.18,0.09,{tabOrder:2,action:{type:'back'}}),
  e('garage-parts','garage-browser','Upgrades',0.05,0.57,0.9,0.29,{tabOrder:3,binding:'partRef',action:{type:'garage-fit',target:'$partRef'}}),
  e('garage-tune','button','Tune',0.05,0.9,0.28,0.07,{tabOrder:4,action:{type:'garage-tune'}}),
  e('garage-reset','button','Reset tuning',0.36,0.9,0.28,0.07,{tabOrder:5,action:{type:'garage-reset'}}),
  e('garage-credits','property-display','Credits',0.67,0.9,0.28,0.07,{dataSource:'garage',property:'credits',binding:'partRef'})
 ]};
}
export function createCarShowroomScreen(){
 return {id:'cars',name:'Choose Car',elements:[
  {id:'heading',type:'text',label:'Choose your car',x:.05,y:.03,w:.9,h:.08},
  {id:'car',type:'car-showroom',label:'Garage',x:.04,y:.14,w:.92,h:.48,binding:'carRef',source:'cars',angle:135,duration:8,selectedScale:1.12,inactiveOpacity:.4,maxVisible:4,action:{type:'screen',target:'garage'}},
  {id:'stats',type:'car-stats',label:'Specifications',x:.05,y:.65,w:.43,h:.2,binding:'carRef'},
  {id:'power',type:'power-curve',label:'HP / Torque',x:.52,y:.65,w:.43,h:.2,binding:'carRef'}
 ]};
}
