import {selectableGridIndex} from '../menus/MenuSelection.js';
import {CAR_PART_FIELDS,garageTuningRanges,readCarSetting,partFits,isStockPart} from './CarPart.js';
import {createMenuRepeatState,getMenuRepeatDirection,resetMenuRepeatState} from '../ui/shared/menuRepeat.js';

export const TUNING_SECTIONS=[
 {id:'pressure',label:'Tire pressure',hint:'Tire pressure is adjustable on every car.',matches:id=>id.startsWith('pressure.')},
 {id:'tires',label:'Tire type',hint:'Buy compatible tires in Upgrade to change tire type.',matches:()=>false},
 {id:'engine',label:'Engine & weight',hint:'Install a tunable ECU or weight upgrade.',matches:id=>['torqueScale','weightKg'].includes(id)},
 {id:'gearing',label:'Gearing',hint:'Install an adjustable transmission.',matches:id=>id==='gearFinalDrive'||id.startsWith('gearRatios.')},
 {id:'suspension',label:'Suspension',hint:'Install adjustable springs, dampers or anti-roll bars.',matches:id=>/^(spring|rideHeight|damping|bump|rebound|antiRoll)/.test(id)},
 {id:'alignment',label:'Alignment & aero',hint:'Install adjustable alignment or aero parts.',matches:id=>/^(camber|toe|aero)/.test(id)},
 {id:'brakes',label:'Brakes',hint:'Install adjustable brakes.',matches:id=>id.startsWith('brake')},
 {id:'differential',label:'Differential',hint:'Install an adjustable differential.',matches:id=>id.startsWith('differential')}
];
export function tuningRows(garage,ref,stock,car){
 const ranges=garageTuningRanges(garage.installed(ref)),tune=garage.configuration(ref).tune;
 const rows=CAR_PART_FIELDS.filter(f=>!f.id.startsWith('gearRatios.')||readCarSetting(car,f.id)!==undefined).map(f=>{
  const range=ranges[f.id],value=tune[f.id]??readCarSetting(car,f.id);
  return {...f,...range,value:typeof value==='number'?value:f.min,enabled:!!range&&Number.isFinite(value),reason:range?'This car does not expose this setting.':'Install a part that unlocks this setting.'};
 });
 const installed=garage.installed(ref).filter(i=>i.carPart.tireRef);
 const tires=garage.owned().filter(i=>i.carPart.tireRef&&!isStockPart(i)&&partFits(i.carPart,ref,stock)&&(garage.availableCount(i.id)>0||installed.some(p=>p.id===i.id)));
 const options=[{id:'',label:'Stock'},...tires.map(i=>({id:i.id,label:i.name}))];
 rows.push({id:'tireType',label:'Tire type',min:0,max:options.length-1,step:1,value:Math.max(0,options.findIndex(o=>o.id===installed[0]?.id)),options,enabled:options.length>1,reason:TUNING_SECTIONS[1].hint});
 return rows;
}
export function stepTuningValue(row,value,direction,multiplier=1){
 return Number(Math.max(row.min,Math.min(row.max,value+direction*row.step*multiplier)).toFixed(8));
}
export class GarageTuner {
 constructor({garage,carRef,resolveCar,onExit=()=>{},onSaved=()=>{}}){
  Object.assign(this,{garage,carRef,resolveCar,onExit,onSaved});this.mode='grid';this.index=0;this.rowIndex=0;this.rows=[];this.ready=false;this.active=true;this.busy=false;this.message='';this.repeat=createMenuRepeatState();this.readyTask=this.load();
 }
 async load(){try{
  if(!this.carRef)throw Error('Choose a car first.');
  this.stock=await this.resolveCar(this.carRef);if(!this.stock)throw Error('Car unavailable.');
  await this.refresh();if(!this.active)return;this.ready=true;this.message='';
 }catch(error){if(this.active)this.message=error.message;}}
 async refresh(){const car=await this.garage.build(this.carRef,this.stock);if(this.active)this.rows=tuningRows(this.garage,this.carRef,this.stock,car);}
 dispose(){this.active=false;this.pointerDirection=null;this.dragging=false;}
 sectionRows(index=this.index){const section=TUNING_SECTIONS[index];if(!section)return [];return this.rows.filter(r=>section.id==='tires'?r.id==='tireType':section.matches(r.id));}
 enabled(index){return this.ready&&this.sectionRows(index).some(r=>r.enabled);}
 get row(){return this.sectionRows()[this.rowIndex];}
 move(direction,multiplier=1){
  if(!this.ready||this.busy)return;
  this.message='';
  if(this.mode==='edit'){
   if(direction==='left'||direction==='right')this.draft=stepTuningValue(this.row,this.draft,direction==='left'?-1:1,multiplier);
  }else if(this.mode==='grid'){
   this.index=selectableGridIndex(TUNING_SECTIONS.map((_,i)=>({disabled:!this.enabled(i)})),this.index,direction);
  }else{
   this.rowIndex=selectableGridIndex(this.sectionRows().map(r=>({disabled:!r.enabled})),this.rowIndex,direction);

  }
 }
 async confirm(){
  if(this.busy||!this.active)return;
  if(!this.ready)return;
  if(this.mode==='grid'){
   if(!this.enabled(this.index)){this.message=TUNING_SECTIONS[this.index].hint;return;}
   this.mode='list';this.rowIndex=this.sectionRows().findIndex(r=>r.enabled);this.message='';
  }else if(this.mode==='list'){
   if(!this.row?.enabled){this.message=this.row?.reason||'No available settings';return;}
   this.draft=Math.max(this.row.min,Math.min(this.row.max,this.row.value));this.mode='edit';this.message='';resetMenuRepeatState(this.repeat);
  }else{
   const row=this.row,value=this.draft;this.busy=true;
   try{
    if(row.options)await this.garage.setTireType(this.carRef,row.options[value].id,this.stock);
    else await this.garage.setTune(this.carRef,{[row.id]:value});
    await this.refresh();if(!this.active)return;
    this.mode='list';this.message='Setting applied';this.onSaved();
   }catch(error){if(this.active)this.message=error.message;}
   finally{this.busy=false;}
  }
 }
 cancel(){
  if(this.busy)return;
  this.message='';this.pointerDirection=null;this.dragging=false;resetMenuRepeatState(this.repeat);
  if(this.mode==='edit'){this.mode='list';delete this.draft;}
  else if(this.mode==='list')this.mode='grid';else this.onExit();
 }
 update({held={},confirm=false,cancel=false},dt){
  if(!this.active||this.busy)return;
  if(cancel){this.cancel();return;}
  if(confirm){void this.confirm();return;}
  if(this.pointerDirection)held={...held,[this.pointerDirection]:true};
  const direction=getMenuRepeatDirection(this.repeat,held,dt,{initialDelay:.35,repeatInterval:this.mode==='edit'?.06:.12});
  if(direction)this.move(direction,this.repeat.holdTime>=1.8?10:this.repeat.holdTime>=.8?5:1);
 }
 pointerDown(point){
  if(this.busy)return;
  const hit=this.hitAreas?.find(a=>point.x>=a.x&&point.x<=a.x+a.w&&point.y>=a.y&&point.y<=a.y+a.h);if(!hit)return;
  if(hit.kind==='exit'){this.cancel();return;}
  if(hit.kind==='apply'){void this.confirm();return;}
  if(hit.kind==='category'){if(!this.enabled(hit.index))return;this.index=hit.index;void this.confirm();return;}
  if(hit.kind==='row'){if(!this.sectionRows()[hit.index]?.enabled)return;this.rowIndex=hit.index;void this.confirm();return;}
  if(hit.kind==='step'){this.pointerDirection=hit.direction;resetMenuRepeatState(this.repeat);return;}
  if(hit.kind==='slider'){this.dragging=true;this.dragPointer=point.id;this.dragTrack=hit;this.pointerMove(point);}
 }
 pointerMove(point){if(this.dragging&&!this.busy&&(this.dragPointer===undefined||point.id===this.dragPointer)){
  const fraction=Math.max(0,Math.min(1,(point.x-this.dragTrack.x)/this.dragTrack.w)),r=this.row;
  this.draft=Number(Math.min(r.max,r.min+Math.round(fraction*(r.max-r.min)/r.step)*r.step).toFixed(8));
 }}
 pointerUp(){this.dragging=false;this.pointerDirection=null;resetMenuRepeatState(this.repeat);}
}
