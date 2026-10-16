import {PowertrainModel} from '../racing/simulation/PowertrainModel.js';
import {applyTireDefinition} from '../racing/raceTires.js';

// These are engine capabilities, not a catalog of upgrades. Item files supply
// names, slots, prices, compatibility, effects and the tuning ranges they unlock.
const field=(id,label,min,max,step=0.01)=>({id,label,min,max,step});
export const CAR_PART_FIELDS=[
 field('weightKg','Weight (kg)',450,20000,1),
 field('gearFinalDrive','Final drive',0.5,12),
 ...Array.from({length:10},(_,i)=>field(`gearRatios.${i}`,`Gear ${i+1} ratio`,0.1,12)),
 ...['Front','Rear'].flatMap(axle=>[
  field(`spring${axle}`,`${axle} springs`,0.1,1),field(`rideHeight${axle}`,`${axle} ride height`,0.1,1),
  field(`damping${axle}`,`${axle} damping`,0.1,1),field(`bump${axle}`,`${axle} bump`,0.1,1),
  field(`rebound${axle}`,`${axle} rebound`,0.1,1),field(`antiRoll${axle}`,`${axle} anti-roll`,0.1,1),
  field(`camber${axle}`,`${axle} camber`,-5,1,0.1),field(`toe${axle}`,`${axle} toe`,-1,1,0.1)]),
 ...['fl','fr','rl','rr'].map(wheel=>field(`pressure.${wheel}`,`${{fl:'Front left',fr:'Front right',rl:'Rear left',rr:'Rear right'}[wheel]} pressure (PSI)`,5,80,0.5)),
 field('brakeBalance','Brake balance',0,1),field('brakePressure','Brake pressure',0.1,2),
 field('differentialAccel','Differential acceleration',0,1),field('differentialDecel','Differential deceleration',0,1),
 field('aeroFront','Front aero',0,1),field('aeroRear','Rear aero',0,1),
 field('torqueScale','Torque curve multiplier',0.1,5),
];
const fields=new Map(CAR_PART_FIELDS.map(f=>[f.id,f]));
export const safeGarageKey=value=>typeof value==='string'&&value.trim()&&!['__proto__','constructor','prototype'].includes(value)?value.trim():'';
const text=value=>typeof value==='string'?value.trim():'';
const list=value=>[...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))];
function finite(value,label){const n=Number(value);if(!Number.isFinite(n))throw Error(`${label} must be a number`);return n;}
function target(id){const f=fields.get(id);if(!f)throw Error('Choose a supported car setting');return f;}
export function normalizeCarPart(value){
 if(!value)return null;
 const slot=safeGarageKey(value.slot);if(!slot)throw Error('Enter a part slot');
 return {slot,price:Math.max(0,finite(value.price??0,'Price')),forSale:value.forSale!==false,
  unlockKey:safeGarageKey(value.unlockKey)||'',compatibleCars:list(value.compatibleCars),requires:list(value.requires),
  modifiers:(value.modifiers||[]).map(m=>{target(m.field);if(!['add','multiply','set'].includes(m.operation))throw Error('Choose a part operation');return {field:m.field,operation:m.operation,value:finite(m.value,'Change')};}),
  tuning:(value.tuning||[]).map(t=>{const f=target(t.field),min=finite(t.min,'Minimum'),max=finite(t.max,'Maximum'),step=finite(t.step??f.step,'Step');if(min<f.min||max>f.max||min>max||step<=0)throw Error(`Invalid tuning range for ${f.label}`);return {field:f.id,min,max,step};}),
  torqueCurve:(value.torqueCurve||[]).map(p=>({rpm:Math.max(0,finite(p.rpm,'RPM')),multiplier:Math.max(0.1,Math.min(5,finite(p.multiplier,'Torque multiplier')))})).sort((a,b)=>a.rpm-b.rpm),
  tireRef:text(value.tireRef)
 };
}
export function partFits(part,carRef){return !part.compatibleCars.length||part.compatibleCars.includes(carRef);}
export function garageTuningRanges(parts){
 const result={};
 for(const item of parts)for(const range of item.carPart.tuning){
  const previous=result[range.field];
  result[range.field]=previous?{...range,min:Math.max(previous.min,range.min),max:Math.min(previous.max,range.max),step:Math.max(previous.step,range.step)}:{...range};
  if(result[range.field].min>result[range.field].max)throw Error('Installed parts have conflicting tuning ranges');
 }
 return result;
}
function applyNumber(value,change){return change.operation==='set'?change.value:change.operation==='multiply'?value*change.value:value+change.value;}
function curveMultiplier(points,rpm){
 if(!points.length)return 1;
 const upper=points.findIndex(p=>p.rpm>=rpm);
 if(upper===0)return points[0].multiplier;if(upper<0)return points.at(-1).multiplier;
 const a=points[upper-1],b=points[upper],t=(rpm-a.rpm)/(b.rpm-a.rpm||1);return a.multiplier+(b.multiplier-a.multiplier)*t;
}
function scaleTorque(tuning,fn){
 tuning.garageEngineCurve=true;
 if(!tuning.engineCurve?.torquePoints?.length){
  const source={idleRpm:850,revLimitRpm:6500,torquePeakStartRpm:2200,torquePeakEndRpm:5200,torqueFalloffRpm:6500,torqueLbFt:258,...tuning};
  const engine=new PowertrainModel(),points=[];
  for(let rpm=source.idleRpm;rpm<source.revLimitRpm;rpm+=250)points.push({rpm,torqueLbFt:engine.getTorqueNmAtRpm(rpm,source)/1.35582});
  points.push({rpm:source.revLimitRpm,torqueLbFt:engine.getTorqueNmAtRpm(source.revLimitRpm,source)/1.35582});
  tuning.engineCurve={rpmMin:source.idleRpm,rpmMax:source.revLimitRpm,torquePoints:points};
 }
 if(tuning.engineCurve?.torquePoints?.length){
  const points=tuning.engineCurve.torquePoints;
  for(const point of points)point.torqueLbFt=Math.max(0,point.torqueLbFt*fn(point.rpm));
  tuning.torqueLbFt=Math.max(...points.map(p=>p.torqueLbFt));
  tuning.powerHp=Math.max(...points.map(p=>p.torqueLbFt*p.rpm/5252));
 }else{
  const ratio=fn(Number(tuning.torquePeakEndRpm)||5000);
  tuning.torqueLbFt=(Number(tuning.torqueLbFt)||258)*ratio;tuning.powerHp=(Number(tuning.powerHp)||271)*ratio;
 }
}
export function readCarSetting(car,id){
 target(id);
 if(id==='torqueScale')return 1;
 if(id.startsWith('pressure.'))return car.setup?.tirePressurePsi?.[id.split('.')[1]]??32;
 if(id.startsWith('gearRatios.'))return car.tuning?.gearRatios?.[Number(id.split('.')[1])];
 return car.tuning?.[id];
}
function changeSetting(car,change){
 const f=target(change.field),id=f.id;
 if(id==='torqueScale'){
  if(change.operation==='add')throw Error('Use Set or Multiply for torque scale');
  scaleTorque(car.tuning,()=>Math.max(f.min,Math.min(f.max,change.value)));return;
 }
 if(id.startsWith('pressure.')){
  car.setup||={};car.setup.tirePressurePsi||={};const key=id.split('.')[1];
  car.setup.tirePressurePsi[key]=Math.max(f.min,Math.min(f.max,applyNumber(readCarSetting(car,id),change)));return;
 }
 // Transmission-specific values take priority in the simulator; modify both
 // the base tune and every authored transmission variant independently.
 const oldValue=readCarSetting(car,id);
 for(const tuning of [car.tuning,...Object.values(car.transmissions||{})]){
  if(id.startsWith('gearRatios.')){
   const index=Number(id.split('.')[1]);if(tuning.gearRatios?.[index]===undefined)continue;
   tuning.gearRatios[index]=Math.max(f.min,Math.min(f.max,applyNumber(tuning.gearRatios[index],change)));
  }else if(Number.isFinite(tuning[id]))tuning[id]=Math.max(f.min,Math.min(f.max,applyNumber(tuning[id],change)));
  else if(tuning===car.tuning&&change.operation==='set')tuning[id]=Math.max(f.min,Math.min(f.max,change.value));
 }
 const profile=car.tuning.physicalVehicleProfile||car.physicalVehicleProfile;
 if(profile){
  for(const axle of ['Front','Rear']){
   const physical={['spring'+axle]:[`suspensionSpringRate${axle}Npm`,12,20],['bump'+axle]:[`suspensionBumpDamper${axle}NsM`,1.7,3.1],['rebound'+axle]:[`suspensionReboundDamper${axle}NsM`,1.7,3.1]}[id];
   if(physical&&Number.isFinite(profile[physical[0]]))profile[physical[0]]*=(physical[1]+car.tuning[id]*physical[2])/(physical[1]+(oldValue??0.5)*physical[2]);
  }
 }
}
export function buildGarageCar(stock,{parts=[],tune={},tires={}}={}){
 const car=structuredClone(stock);car.tuning||={};
 const installed=parts.slice().sort((a,b)=>a.carPart.slot.localeCompare(b.carPart.slot));
 for(const item of installed){
  const part=normalizeCarPart(item.carPart);
  if(part.tireRef){if(!tires[part.tireRef])throw Error(`Tire unavailable: ${part.tireRef}`);applyTireDefinition(car,tires[part.tireRef],part.tireRef);}
  for(const change of part.modifiers)changeSetting(car,change);
  if(part.torqueCurve.length)scaleTorque(car.tuning,rpm=>curveMultiplier(part.torqueCurve,rpm));
 }
 const ranges=garageTuningRanges(installed);
 for(const [id,value] of Object.entries(tune)){
  const range=ranges[id];if(!range)continue; // Removed parts also remove their tuning permissions.
  const number=finite(value,'Tune');if(number<range.min||number>range.max)throw Error(`Tune is outside the installed part range: ${target(id).label}`);
  changeSetting(car,{field:id,operation:'set',value:number});
 }
 return car;
}
