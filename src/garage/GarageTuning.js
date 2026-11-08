import catalog from '../content/garage-parts.json' with {type:'json'};
import {saveGarageSetupSlot,loadGarageSetupSlot} from './GarageSetupSlots.js';
import {menuAtPath,menuPathLabels,tuningMenu} from './GarageMenuTree.js';
import {tuningLabel} from './GarageLabels.js';
import {GARAGE_UPGRADE_PRESETS} from './GarageSetupProfiles.js';
import {applyGarageSetup} from './GarageSetups.js';
import {selectableGridIndex} from '../menus/MenuSelection.js';
import {CAR_PART_FIELDS,FIXED_PART_FIELDS,garageTuningRanges,readCarSetting} from './CarPart.js';
import {createMenuRepeatState,getMenuRepeatDirection,resetMenuRepeatState} from '../ui/shared/menuRepeat.js';

export const TUNING_SECTIONS=[
 {id:'repair',label:'Repair',hint:'Inspect components, repair faults and service fluids.',matches:()=>false},
 {id:'setup',label:'Setup',hint:'View car stats or apply a tuning preset.',matches:id=>['stats','drivingSetup','saveSetup','loadSetup','revEngine'].includes(id)},
 {id:'engine',label:'Engine',hint:'Install an adjustable ECU or turbo upgrade.',matches:id=>['torqueScale','weightKg','engineInertiaKgM2','chassisRigidityNmDeg','boostLevel','pedalResponse','coolingEfficiency','oilCoolingEfficiency'].includes(id)||id.startsWith('fuel')},
 {id:'gearing',label:'Gearing',hint:'Install an adjustable transmission.',matches:id=>['gearFinalDrive','shiftTimeMs','drivetrainEfficiency'].includes(id)||id.startsWith('gearRatios.')},
 {id:'handling',label:'Handling',hint:'Install adjustable suspension, brakes or ballast.',matches:id=>/^(spring|rideHeight|suspensionTravel|damping|bump|rebound|antiRoll|brake|ballast)/.test(id)},
 {id:'alignment',label:'Geometry',hint:'Install adjustable alignment or aero parts.',matches:id=>id==='dragCoefficient'||/^(camber|toe|caster|aero)/.test(id)},
 {id:'tires',label:'Tires',hint:'Adjust front and rear tire pressures.',matches:id=>id.startsWith('pressure.')||['tireWidthMm','tireAspectRatio','wheelDiameterIn','wheelOutsetMm'].includes(id)},
 {id:'differential',label:'Differential',hint:'Install an adjustable differential.',matches:id=>/differential/i.test(id)}
];
function unlockReason(field,garage,ref,stock,drive){
 if((drive==='fwd'&&/^rearDifferential/.test(field))||(drive==='rwd'&&/^frontDifferential/.test(field))||(drive!=='awd'&&/^centerDifferential/.test(field)))return 'Locked. Install an AWD drivetrain conversion to adjust this differential.';
 const authored=garage.owned?.()||[];
 const choices=[...authored,...catalog.items].filter(item=>item?.carPart?.forSale!==false&&(!item.carPart.compatibleCars?.length||item.carPart.compatibleCars.includes(ref))&&(!stock.garagePartSlots||stock.garagePartSlots.includes(item.carPart.slot))&&item.carPart.tuning?.some(range=>range.field===field||(/^(front|rear)Differential/.test(field)&&range.field==='differential'+field.split('Differential')[1]))).sort((a,b)=>a.carPart.price-b.carPart.price);
 return choices.length?`Locked. Install ${choices[0].name} to adjust this setting.`:'Locked. This car has no compatible adjustable part for this setting.';
}
export function tuningRows(garage,ref,stock,car){
 const ranges=garageTuningRanges(garage.installed(ref)),tune=garage.configuration(ref).tune;
 const rows=CAR_PART_FIELDS.filter(f=>!FIXED_PART_FIELDS.has(f.id)&&!/^differential(Accel|Decel)$/.test(f.id)).filter(f=>!f.id.startsWith('gearRatios.')||readCarSetting(car,f.id)!==undefined).map(f=>{
  let range=ranges[f.id];
  const drive=car.tuning?.drivetrain||'awd';
  if((drive==='fwd'&&/^rearDifferential/.test(f.id))||(drive==='rwd'&&/^frontDifferential/.test(f.id))||(drive!=='awd'&&/^centerDifferential/.test(f.id)))range=null;
  const value=tune[f.id]??readCarSetting(car,f.id);
  return {...f,...range,label:tuningLabel(f),description:f.label,inspectable:true,...(f.id==='torqueScale'?{minLabel:'Efficiency',maxLabel:'Performance',format:'percent'}:f.id==='boostLevel'?{minLabel:'Minimum',maxLabel:'Full boost',format:'percent'}:f.id==='pedalResponse'?{minLabel:'Gentle',maxLabel:'Sharp'}:f.id==='ballastPosition'?{minLabel:'Rear',maxLabel:'Front'}:{}),value:typeof value==='number'?value:f.min,enabled:!!range&&Number.isFinite(value),reason:range?'Locked. This car does not expose this setting.':unlockReason(f.id,garage,ref,stock,drive)};
 });
 return rows;
}
export function stepTuningValue(row,value,direction,multiplier=1){
 return Number(Math.max(row.min,Math.min(row.max,value+direction*row.step*multiplier)).toFixed(8));
}
export class GarageTuner {
 constructor({garage,carRef,resolveCar,evaluate,enginePreview=null,onExit=()=>{},onSaved=()=>{}}){
  Object.assign(this,{garage,carRef,resolveCar,evaluate,enginePreview,onExit,onSaved});this.mode='grid';this.path=[];this.index=0;this.rowIndex=0;this.rows=[];this.ready=false;this.active=true;this.busy=false;this.message='';this.repeat=createMenuRepeatState();this.readyTask=this.load();
 }
 async load(){try{
  if(!this.carRef)throw Error('Choose a car first.');
  this.stock=await this.resolveCar(this.carRef);if(!this.stock)throw Error('Car unavailable.');
  await this.refresh();if(!this.active)return;this.ready=true;this.message='';
 }catch(error){if(this.active)this.message=error.message;}}
 async refresh(){const car=await this.garage.build(this.carRef,this.stock);if(this.active){this.car=car;this.rows=tuningRows(this.garage,this.carRef,this.stock,car);
   this.rows.unshift({id:'stats',label:'Stats',stats:true,enabled:true});
   this.rows.push({id:'drivingSetup',label:'Preset',enabled:true,children:GARAGE_UPGRADE_PRESETS.map(p=>({id:'preset:'+p.id,label:p.label,preset:p.id,enabled:true}))});
   const saved=this.garage.configuration(this.carRef).savedSetups||[];
   for(const action of ['save','load'])this.rows.push({id:action+'Setup',label:action==='save'?'Save':'Load',enabled:true,children:Array.from({length:8},(_,slot)=>({id:action+':'+slot,label:'Slot '+(slot+1),slotAction:action,slotIndex:slot,enabled:action==='save'||!!saved[slot],reason:'This slot is empty.',displayValue:saved[slot]?`${saved[slot].pi} PI · ${saved[slot].tires}`:'Empty'}))});
this.rows.push({id:'revEngine',label:'Rev Engine',rev:true,enabled:true,help:'Rev Engine. Hold A, Enter, Space or this button to rev the installed engine. Release to let it settle.'});
this.repairs=this.garage.repairRows?.(this.carRef,car)||[];}}
 dispose(){this.stopRev();this.active=false;this.pointerDirection=null;this.dragging=false;}
 sectionTree(index=this.index){const section=TUNING_SECTIONS[index];if(!section)return [];return tuningMenu(section.id==='repair'?(this.repairs||[]):this.rows.filter(r=>section.matches(r.id)),section.id);}
 pathLabels(){return menuPathLabels(this.sectionTree(),this.path);}
 sectionRows(index=this.index){return menuAtPath(this.sectionTree(index),index===this.index?this.path:[]).map(row=>this.path?.some(id=>/group:(Front|Rear)$/.test(id))?{...row,label:row.label.replace(/^(Front|Rear) /,'')}:row);}
 enabled(index){return this.ready&&this.sectionTree(index).length>0;}
 get row(){return this.sectionRows()[this.rowIndex];}
 move(direction,multiplier=1){
  if(!this.ready||this.busy)return;
  this.message='';
  if(this.mode==='stats')return;
  if(this.mode==='repair'){
   if(direction==='left')this.repairAction='apply';
   if(direction==='right')this.repairAction='exit';
  }else if(this.mode==='edit'){
   if(direction==='left'||direction==='right')this.draft=stepTuningValue(this.row,this.draft,direction==='left'?-1:1,multiplier);
  }else if(this.mode==='grid'){
   this.index=selectableGridIndex(TUNING_SECTIONS.map((_,i)=>({disabled:!this.enabled(i)})),this.index,direction);
  }else{
   this.rowIndex=selectableGridIndex(this.sectionRows().map(r=>({disabled:!r.enabled&&!r.inspectable&&!r.children})),this.rowIndex,direction);

  }
 }
 async confirm(){
  if(this.busy||!this.active)return;
  if(!this.ready)return;
  if(this.mode==='stats'){this.cancel();return;}
  if(this.mode==='repair'&&this.repairAction==='exit'){this.cancel();return;}
  if(this.mode==='grid'){
   if(!this.enabled(this.index)){this.message=TUNING_SECTIONS[this.index].hint;return;}
   this.mode='list';this.path=[];this.rowIndex=Math.max(0,this.sectionRows().findIndex(r=>r.enabled));this.message='';
  }else if(this.mode==='list'){
   if(!this.row?.enabled&&!this.row?.children){this.message=this.row?.reason||'No available settings';return;}
   if(this.row.children){this.path.push(this.row.id);this.rowIndex=Math.max(0,this.sectionRows().findIndex(r=>r.enabled));return;}
   if(this.row.rev){this.revActive=true;this.revPulse=.15;return;}
   if(this.row.preset||this.row.slotAction){await this.applySetupButton(this.row);return;}
   if(this.row.stats){this.mode='stats';this.message='';return;}
   if(this.row.repair){this.mode='repair';this.repairAction='apply';this.message=this.row.reason;resetMenuRepeatState(this.repeat);return;}
   this.draft=Math.max(this.row.min,Math.min(this.row.max,this.row.value));this.mode='edit';this.message='';resetMenuRepeatState(this.repeat);
  }else{
   const row=this.row,value=this.draft;this.busy=true;
   try{
    let setupMessage='';
    if(row.setup){
     const choice=row.options[value];if(!choice.id)throw Error('Choose a setup first');if(choice.error)throw Error(choice.error);
     const result=await applyGarageSetup(this.garage,this.carRef,this.stock,choice.id);
     setupMessage=`${result.label}: ${result.applied} settings applied${result.skipped?' · '+result.skipped+' locked':''}${result.clamped?' · '+result.clamped+' limited by parts':''}`;
    }
    else if(row.repair)await this.garage.repair(this.carRef,row.id,this.stock);
    else if(row.options)await this.garage.setTireType(this.carRef,row.options[value].id,this.stock);
    else await this.garage.setTune(this.carRef,{[row.id]:value});
    await this.refresh();if(!this.active)return;
    this.mode='list';this.message=setupMessage||'Setting applied';this.onSaved();
   }catch(error){if(this.active)this.message=error.message;}
   finally{this.busy=false;}
  }
 }
 async applySetupButton(row){
  this.busy=true;this.message='';
  try{
   let message;
   if(row.slotAction==='save'){
    await saveGarageSetupSlot(this.garage,this.carRef,this.stock,row.slotIndex,this.evaluate);
    message=`Saved slot ${row.slotIndex+1}`;
   }else if(row.slotAction==='load'){
    await loadGarageSetupSlot(this.garage,this.carRef,this.stock,row.slotIndex);
    message=`Loaded slot ${row.slotIndex+1}`;
   }else if(row.preset==='stock'){
    await this.garage.resetTune(this.carRef);message='Stock tuning restored';
   }else{
    const result=await applyGarageSetup(this.garage,this.carRef,this.stock,row.preset);
    message=`${result.label}: ${result.applied} settings applied${result.skipped?' · '+result.skipped+' locked':''}`;
   }
   await this.refresh();if(this.active){this.message=message;this.onSaved();}
  }catch(error){if(this.active)this.message=error.message;}
  finally{this.busy=false;}
 }
 stopRev(){this.revActive=false;this.revPointer=false;this.revPulse=0;this.enginePreview?.stop();}
 cancel(){
  if(this.busy)return;
  this.stopRev();
  this.message='';this.pointerDirection=null;this.dragging=false;resetMenuRepeatState(this.repeat);
  if(this.mode==='edit'||this.mode==='repair'||this.mode==='stats'){this.mode='list';delete this.draft;}
  else if(this.mode==='list'){if(this.path.length){const id=this.path.pop();this.rowIndex=Math.max(0,this.sectionRows().findIndex(r=>r.id===id));}else this.mode='grid';}else this.onExit();
 }
 update({held={},confirm=false,confirmHeld=false,cancel=false},dt){
  if(!this.active||this.busy)return;
  if(cancel){this.cancel();return;}
  if(this.revActive){
   if(this.mode!=='list'||!this.row?.rev)this.stopRev();
   else{
    const throttle=confirmHeld||this.revPointer||this.revPulse>0?1:0;
    this.revPulse=Math.max(0,(this.revPulse||0)-dt);
    const rpm=this.enginePreview?.update(this.car,throttle,dt);
    this.message=rpm?`${Math.round(rpm)} RPM`:'';
    if(this.enginePreview&&!this.enginePreview.active)this.revActive=false;
   }
  }
  if(confirm){void this.confirm();return;}
  if(this.pointerDirection)held={...held,[this.pointerDirection]:true};
  const direction=getMenuRepeatDirection(this.repeat,held,dt,{initialDelay:.35,repeatInterval:this.mode==='edit'?.06:.12});
  if(direction){this.move(direction,this.repeat.holdTime>=1.8?10:this.repeat.holdTime>=.8?5:1);if(!this.row?.rev)this.stopRev();}
 }
 pointerDown(point){
  if(this.busy)return;
  const hit=this.hitAreas?.find(a=>point.x>=a.x&&point.x<=a.x+a.w&&point.y>=a.y&&point.y<=a.y+a.h);if(!hit)return;
  if(hit.kind==='exit'){this.cancel();return;}
  if(hit.kind==='apply'){if(this.mode==='repair')this.repairAction='apply';void this.confirm();return;}
  if(hit.kind==='category'){if(!this.enabled(hit.index))return;this.index=hit.index;void this.confirm();return;}
  if(hit.kind==='row'){if(!this.sectionRows()[hit.index])return;this.rowIndex=hit.index;this.revPointer=!!this.row?.rev;void this.confirm();return;}
  if(hit.kind==='step'){this.pointerDirection=hit.direction;resetMenuRepeatState(this.repeat);return;}
  if(hit.kind==='slider'){this.dragging=true;this.dragPointer=point.id;this.dragTrack=hit;this.pointerMove(point);}
 }
 pointerMove(point){if(this.dragging&&!this.busy&&(this.dragPointer===undefined||point.id===this.dragPointer)){
  const fraction=Math.max(0,Math.min(1,(point.x-this.dragTrack.x)/this.dragTrack.w)),r=this.row;
  this.draft=Number(Math.min(r.max,r.min+Math.round(fraction*(r.max-r.min)/r.step)*r.step).toFixed(8));
 }}
 pointerUp(){this.revPointer=false;this.dragging=false;this.pointerDirection=null;resetMenuRepeatState(this.repeat);}
}
