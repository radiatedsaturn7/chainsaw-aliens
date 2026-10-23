import {partFits} from './CarPart.js';

export const GARAGE_ACTION_LABELS={
 'garage-fit':'Buy / install selected upgrade',
 'garage-buy':'Buy car part','garage-install':'Install car part','garage-remove':'Remove car part',
 'garage-tune':'Tune car','garage-reset':'Reset car tuning'
};
export async function runGarageAction(garage,type,partRef,parameters,{resolveCar,openTuner}={}){
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
  if(!openTuner)throw Error('Open the in-game tuning screen to adjust settings');
  return openTuner(ref);
 }
 throw Error('Unknown garage action');
}
// Standard widgets and actions: authors can rearrange or replace this screen.
const menuElement=(id,type,label,x,y,w,h,extra={})=>({id,type,label,x,y,w,h,...extra});
export function createGarageMenuScreen(){
 const e=menuElement;
 return {id:'garage',name:'Garage',transitionGroup:'garage',background:'#000000',effect:'none',elements:[
  e('garage-title','text','Garage',0.05,0.02,0.9,0.07),
  e('garage-preview','car-preview','Car',0.05,0.14,0.5,0.5,{binding:'carRef',angle:135}),
  e('garage-stats','car-stats','Specifications',0.56,0.14,0.39,0.4,{binding:'carRef'}),
  e('garage-play','button','Drive',0.05,0.78,0.28,0.12,{tabOrder:1,action:{type:'race',target:'$raceRef'}}),
  e('garage-tune','button','Tune',0.36,0.78,0.28,0.12,{tabOrder:2,action:{type:'screen',target:'tuning'}}),
  e('garage-upgrade','button','Upgrade',0.67,0.78,0.28,0.12,{tabOrder:3,action:{type:'screen',target:'upgrades'}})
 ]};
}
export function createTuningMenuScreen(){
 return {id:'tuning',name:'Tuning',transitionGroup:'garage',background:'#000000',effect:'none',elements:[
  menuElement('tuner','garage-tuner','Adjust tuning',.05,.16,.9,.70,{binding:'carRef',selectionIndicator:'disabled'})
 ]};
}
export function createUpgradeMenuScreen(){
 const e=menuElement;
 return {id:'upgrades',name:'Upgrades',transitionGroup:'garage',background:'#000000',effect:'none',elements:[
  e('credits','property-display','Scrap',0.67,0.02,0.28,0.08,{dataSource:'garage',property:'credits',binding:'partRef'}),
  e('garage-parts','garage-browser','Upgrades',0.05,0.16,0.9,0.70,{selectionIndicator:'disabled',background:'#000000',binding:'partRef',action:{type:'garage-fit',target:'$partRef'}}),
 ]};
}
export function createWorldMapMenuScreen(){
 const e=menuElement;
 return {id:'world-map',name:'World Map',background:'#122c40',elements:[
  e('event','world-map','Races',0.05,0.15,0.9,0.61,{binding:'raceRef',selectionIndicator:'disabled',showSelectedLabel:false,action:{type:'screen',target:'garage'}}),
  e('description','race-description','Race description',0.30,0.76,0.66,0.22,{binding:'raceRef'})
 ]};
}
export function createCarShowroomScreen(){
 return {id:'cars',name:'Choose Car',background:'#000000',effect:'none',elements:[
  {id:'car',type:'car-showroom',label:'Garage',x:.04,y:.14,w:.92,h:.48,binding:'carRef',source:'cars',angle:135,duration:4,selectedScale:1.25,selectedZoomDuration:.18,selectionBorder:false,background:'#000000',inactiveOpacity:.4,maxVisible:4,action:{type:'screen',target:'world-map'}},
  {id:'description',type:'car-description',label:'Car description',x:.05,y:.62,w:.9,h:.34,binding:'carRef'}
 ]};
}
