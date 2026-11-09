import {normalizeFuelConfig,fuelBurnGallons,startingFuelFraction} from './FuelModel.js';
// Arcade time scaling wraps physical relationships; all evolution uses fixed 100 ms ticks.
// No wall clock, Math.random, render-rate state, or replacement vehicle physics.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
const number=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
export const MECHANICAL_WHEELS=['fl','fr','rl','rr'];
const definitions=[
 ['ignition','Ignition','engine',90],['pistons','Pistons','engine',300],['bearings','Engine bearings','engine',280],
 ['radiator','Radiator','panels.front',160],['thermostat','Thermostat','engine',60],['waterPump','Water pump','engine',120],['fans','Cooling fans','panels.front',70],
 ['oilPump','Oil pump','engine',140],['oilSeals','Oil seals','engine',70],
 ['alternator','Alternator','engine',160],['battery','Battery','engine',110],['starter','Starter','engine',100],['wiring','Wiring','panels.front',80],['ecu','ECU','engine',200],
 ['fuelTank','Fuel tank','panels.rear',150],['fuelPump','Fuel pump','engine',100],['turbo','Turbocharger','engine',260],
 ['clutch','Clutch','transmission',180],['gearbox','Gearbox','transmission',320],['differential','Differential','transmission',220],['axles','Axles','transmission',180],
 ['panels','Front body panels','panels.front',100],...['left','right','rear'].map(side=>['panel_'+side,side[0].toUpperCase()+side.slice(1)+' body panels','panels.'+side,100]),['lights','Lights','panels.front',60],
 ...MECHANICAL_WHEELS.flatMap(w=>[[`tire_${w}`,`${w.toUpperCase()} tire`,`tires.${w}`,80],[`damper_${w}`,`${w.toUpperCase()} damper`,`suspension.${w}`,110],[`spring_${w}`,`${w.toUpperCase()} spring`,`suspension.${w}`,100],[`alignment_${w}`,`${w.toUpperCase()} alignment`,`suspension.${w}`,45],[`pads_${w}`,`${w.toUpperCase()} brake pads`,`brakes.${w}`,60],[`hydraulics_${w}`,`${w.toUpperCase()} brake hydraulics`,`brakes.${w}`,100]])
];
export const MECHANICAL_COMPONENTS=Object.freeze(definitions.map(([id,label,damagePath,cost])=>({id,label,damagePath,cost})));
const get=(obj,path)=>path.split('.').reduce((o,k)=>o?.[k],obj);
// Damage paths are fixed by the component catalog. Compile once instead of
// splitting all component paths on every player/AI physics update.
const damageBindings = MECHANICAL_COMPONENTS.map(({id, damagePath}) => {
 const keys = damagePath.split('.');
 const read = keys.length === 1
  ? object => object?.[keys[0]]
  : keys.length === 2 ? object => object?.[keys[0]]?.[keys[1]]
  : object => { for (const key of keys) object = object?.[key]; return object; };
 return {id, read};
});
function hash(text){let h=2166136261;for(const ch of text)h=Math.imul(h^ch.charCodeAt(0),16777619);return ((h>>>0)+1)/4294967297;}
export function normalizeMechanicalConfig(value={}){
 value ||= {};
 return {enabled:value.enabled!==false,timeScale:clamp(value.timeScale??8,.1,60),failureRate:clamp(value.failureRate??1,0,10),
 engineHeatScale:clamp(value.engineHeatScale??1,.25,4),coolingEfficiency:clamp(value.coolingEfficiency??1,.5,3),oilCoolingEfficiency:clamp(value.oilCoolingEfficiency??1,.5,3),
 batteryAh:clamp(value.batteryAh??45,5,150),...normalizeFuelConfig(value),boostBar:clamp(value.boostBar??0,0,4),
 components:Object.fromEntries(MECHANICAL_COMPONENTS.map(({id,cost})=>[id,{durability:clamp(value.components?.[id]?.durability??1,.1,10),
 requiredPart:typeof value.components?.[id]?.requiredPart==='string'?value.components[id].requiredPart.slice(0,100):'',
 repairCost:clamp(value.components?.[id]?.repairCost??cost,0,100000)}]))};
}
export function createMechanicalState(source={},damage={},config={}){
 source ||= {};damage ||= {};config ||= {};
 const cfg=normalizeMechanicalConfig(Object.keys(config).length?config:source.config||config),components={};
 for(const {id,damagePath} of MECHANICAL_COMPONENTS){const old=source.components?.[id]||{};components[id]={damage:clamp(old.damage??get(damage,damagePath),0,100),failed:old.failed===true,hazard:clamp(old.hazard??0,0,1e8),events:Math.floor(clamp(old.events??0,0,1e8)),malfunctionUntil:clamp(old.malfunctionUntil??0,0,1e10),symptom:typeof old.symptom==='string'?old.symptom.slice(0,100):''};}
 return {version:1,config:cfg,seed:String(source.seed??'mechanical'),tick:Math.floor(clamp(source.tick??0,0,1e10)),remainder:clamp(source.remainder??0,0,.1),components,
 observedDamage:Object.fromEntries(MECHANICAL_COMPONENTS.map(c=>[c.id,clamp(source.observedDamage?.[c.id]??get(damage,c.damagePath),0,100)])),
 coolant:clamp(source.coolant??1),oil:clamp(source.oil??1),fuel:clamp(source.fuel??1),charge:clamp(source.charge??1),
 coolantTemperatureC:clamp(source.coolantTemperatureC??85,-50,250),oilTemperatureC:clamp(source.oilTemperatureC??90,-50,260),
 voltage:clamp(source.voltage??14.2,0,16),oilPressureBar:clamp(source.oilPressureBar??3,0,10),fuelPressureBar:clamp(source.fuelPressureBar??3,0,5),boostBar:clamp(source.boostBar??0,0,4),
 headlights:source.headlights!==false,highBeams:source.highBeams===true,auxLights:source.auxLights===true,engineRunning:!cfg.enabled||source.engineRunning!==false,misfireUntil:clamp(source.misfireUntil??0,0,1e10),
 lostGears:Array.isArray(source.lostGears)?source.lostGears.filter(n=>Number.isInteger(n)&&n>=-1&&n<=12):[],
 tires:Object.fromEntries(MECHANICAL_WHEELS.map(w=>[w,{pressureRatio:clamp(source.tires?.[w]?.pressureRatio??1,0,1.5),pressurePsi:clamp(source.tires?.[w]?.pressurePsi??32,0,100),temperatureC:clamp(source.tires?.[w]?.temperatureC??25,-50,250),tread:clamp(source.tires?.[w]?.tread??1),brakeTemperatureC:clamp(source.tires?.[w]?.brakeTemperatureC??25,-50,1200)}])),
 effects:cfg.enabled?{torque:clamp(source.effects?.torque??1),drive:clamp(source.effects?.drive??1),brakes:Object.fromEntries(MECHANICAL_WHEELS.map(w=>[w,clamp(source.effects?.brakes?.[w]??1)])),pull:clamp(source.effects?.pull??0,-.2,.2),lights:clamp(source.effects?.lights??1),instruments:clamp(source.effects?.instruments??1)}:{torque:1,drive:1,brakes:{},pull:0,lights:1,instruments:1},warnings:[],pendingImpact:clamp(source.pendingImpact??0,0,10),batteryCurrentA:0,fuelLitersRemaining:clamp(source.fuel??1)*cfg.fuelLiters};
}
export function applyMechanicalMission(state,mission={}){
 mission ||= {};
 for(const [id,value] of Object.entries(mission.components||{}))if(Object.hasOwn(state.components,id)){const c=state.components[id];c.damage=clamp(value.damage??(value.failed?100:c.damage),0,100);c.failed=value.failed===true;}
 for(const key of ['charge','fuel','oil','coolant'])if(Number.isFinite(mission[key]))state[key]=clamp(mission[key]);
 state.fuel=startingFuelFraction(mission.startingFuel,state.config.fuelTankGallons,state.fuel);
 // Optional opening-mission allowance: consume the small reserve above the
 // warning threshold by distance, then resume the ordinary load-based model.
 const warningDistance=Number(mission.fuelWarningAfterDistanceM);
 state.fuelWarningRun=warningDistance>0&&Number.isFinite(warningDistance)&&state.fuel>.15
  ?{distanceM:0,targetDistanceM:warningDistance,startFuel:state.fuel}:null;
 state.fuelLitersRemaining=state.fuel*state.config.fuelLiters;
 if(typeof mission.headlights==='boolean')state.headlights=mission.headlights;
 for(const [id,part] of Object.entries(mission.requiredParts||{}))if(Object.hasOwn(state.config.components,id)&&typeof part==='string')state.config.components[id].requiredPart=part.slice(0,100);
 return state;
}
export function mechanicalConditionsMet(state,conditions=[]){return conditions.every(c=>{
 if(c.component){const part=state?.components?.[c.component];return !!part&&(!c.operational||!part.failed)&&part.damage<=number(c.maxDamage,100);}
 const value=get(state,c.measurement);return Number.isFinite(value)&&value>=number(c.min,-Infinity)&&value<=number(c.max,Infinity);
});}
export function stepMechanicalState(s,dt,telemetry={},damage={}){
 if(!s||!Number.isFinite(dt)||dt<=0)return s;
 for(const key of ['headlights','highBeams','auxLights'])if(typeof telemetry[key]==='boolean')s[key]=telemetry[key];
 if(!s.config.enabled){if(typeof telemetry.headlights==='boolean')s.headlights=telemetry.headlights;s.effects.lights=(s.headlights||s.auxLights)?1:0;return s;}
 // Positive external changes only: normalizing or repairing a health bar cannot heal failures.
 for(const c of damageBindings){const d=clamp(c.read(damage),0,100),old=s.observedDamage[c.id]||0;if(d>old)s.components[c.id].damage=clamp(s.components[c.id].damage+(d-old)/s.config.components[c.id].durability,0,100);s.observedDamage[c.id]=d;}
 s.pendingImpact=Math.max(s.pendingImpact,clamp(telemetry.impact??0,0,10));
 s.remainder+=Math.min(dt,1);
 while(s.remainder>=.1-1e-9){s.remainder=Math.max(0,s.remainder-.1);mechanicalTick(s,{...telemetry,impact:s.pendingImpact});s.pendingImpact=0;}
 return s;
}
function mechanicalTick(s,t){
 s.tick++;const dt=.1,scaled=dt*s.config.timeScale,c=s.components;
 const failed=id=>c[id].failed,malfunction=id=>failed(id)||c[id].malfunctionUntil>s.tick,health=id=>failed(id)?0:(1-c[id].damage/125)*(malfunction(id)?.35:1);
 const rpm=clamp(t.rpm??900,0,20000),rpmRatio=clamp(rpm/Math.max(1000,number(t.maxRpm,7000)),0,1.5),load=clamp(t.throttle),speed=Math.abs(number(t.speedMps,0)),brake=clamp(t.brake),ambient=clamp(t.ambientTemperatureC??20,-50,60);
 if(typeof t.headlights==='boolean')s.headlights=t.headlights;
 const wear=(id,amount)=>{c[id].damage=clamp(c[id].damage+Math.max(0,amount)/s.config.components[id].durability,0,100);};
 const fanOn=s.coolantTemperatureC>95&&!failed('fans');
 const lamps=(s.headlights?(s.highBeams?12:10):0)+(s.auxLights?20:0);
 const electricalLoad=(s.engineRunning?9:1)+(fanOn?18:0)+lamps+(s.engineRunning?6:0);
 const generated=s.engineRunning?65*health('alternator')*health('wiring')*clamp(rpm/1200):0;
 s.batteryCurrentA=generated-electricalLoad;
 const capacity=s.config.batteryAh*Math.max(.15,health('battery'));
 s.charge=failed('battery')?0:clamp(s.charge+s.batteryCurrentA*scaled/(3600*capacity));
 s.voltage=failed('wiring')?0:generated>electricalLoad?14.2:clamp(9+3.6*Math.sqrt(s.charge)-electricalLoad*.012,0,13);
 const ignitionOK=s.voltage>9.7&&!failed('ecu')&&!failed('ignition');
 s.coolant=clamp(s.coolant-scaled*(failed('radiator')?.003:Math.max(0,c.radiator.damage-50)*.000008));
 s.oil=clamp(s.oil-scaled*(failed('oilSeals')?.002:Math.max(0,c.oilSeals.damage-65)*.000004));
 const fuelBurn=fuelBurnGallons(s.config,dt,{engineRunning:s.engineRunning,speedMps:speed,rpm,maxRpm:t.maxRpm,throttle:load});
 let fuelUsed=fuelBurn/s.config.fuelTankGallons;
 const allowance=s.fuelWarningRun;
 if(allowance && allowance.distanceM<allowance.targetDistanceM){
  const traveled=Math.abs(number(t.distanceSpeedMps,speed))*dt,remaining=allowance.targetDistanceM-allowance.distanceM;
  allowance.distanceM=Math.min(allowance.targetDistanceM,allowance.distanceM+traveled);
  const scheduled=allowance.startFuel-(allowance.startFuel-.15)*(allowance.distanceM/allowance.targetDistanceM);
  fuelUsed=Math.max(0,s.fuel-scheduled);
  if(traveled>remaining)fuelUsed+=fuelBurn/s.config.fuelTankGallons*(traveled-remaining)/traveled;
 }
 s.fuel=clamp(s.fuel-fuelUsed-scaled*(failed('fuelTank')?.001:Math.max(0,c.fuelTank.damage-60)*.000002));
 // Thermal mass follows real seconds, not the accelerated wear/leak clock.
 // A healthy radiator/fan can reject full-load heat; the thermostat prevents
 // overcooling. Loss of circulation/coolant still removes that reserve.
 const thermalHealth=id=>failed(id)?0:(1-Math.max(0,c[id].damage-25)/100)*(malfunction(id)?.35:1);
 const airflow=.45+Math.min(2,speed/15)+(fanOn&&s.voltage>10?.9*thermalHealth('fans'):0);
 const thermostatOpening=clamp((s.coolantTemperatureC-80)/15);
 const circulation=thermalHealth('waterPump')*thermalHealth('thermostat');
 const cooling=s.config.coolingEfficiency*circulation*Math.max(.02,thermalHealth('radiator'))*Math.max(.02,s.coolant)*airflow*thermostatOpening;
 const heat=s.engineRunning?(3+load*rpmRatio*12)*s.config.engineHeatScale:0;
 const thermalMass=25+20*s.coolant;
 s.coolantTemperatureC=clamp(s.coolantTemperatureC+dt*(heat-cooling*Math.max(0,s.coolantTemperatureC-ambient)*.16)/thermalMass,ambient,240);
 const oilTarget=s.coolantTemperatureC+(s.engineRunning?load*rpmRatio*12:0)/s.config.oilCoolingEfficiency;
 s.oilTemperatureC=clamp(s.oilTemperatureC+(oilTarget-s.oilTemperatureC)*dt/90,ambient,250);
 s.oilPressureBar=s.engineRunning?clamp((1+rpm/1800)*health('oilPump')*Math.min(1,s.oil*2)*clamp(1-(s.oilTemperatureC-110)*.009,.05,1),0,6):0;
 const fuelSlosh=s.fuel<.06?clamp(1-Math.abs(number(t.lateralAccelerationMps2,0))/12,.1,1):1;
 s.fuelPressureBar=s.fuel>0?3*health('fuelPump')*clamp((s.voltage-8)/4)*fuelSlosh:0;
 s.fuelLitersRemaining=s.fuel*s.config.fuelLiters;
 s.boostBar=s.engineRunning?s.config.boostBar*load*clamp((rpmRatio-.2)*1.8)*health('turbo'):0;
 if(s.engineRunning){
  const coupling=clamp(t.clutchCoupling??1);
  if(coupling>.05&&coupling<.95&&Math.abs(number(t.gear,0))>0)wear('clutch',scaled*load*rpmRatio*(1-coupling)*.005);
  if(s.coolantTemperatureC>115){wear('pistons',(s.coolantTemperatureC-115)*scaled*.012);wear('radiator',(s.coolantTemperatureC-115)*scaled*.004);}
  if(s.oilPressureBar<.7&&rpm>1200)wear('bearings',(.7-s.oilPressureBar)*scaled*(.8+rpmRatio));
  if(s.oilTemperatureC>135&&s.config.boostBar>0)wear('turbo',(s.oilTemperatureC-135)*scaled*.008*load);
 }
 for(const w of MECHANICAL_WHEELS){const tire=s.tires[w],actual=t.tires?.[w];
  tire.temperatureC=number(actual?.treadTemperatureC,tire.temperatureC);
  tire.pressurePsi=clamp((actual?.effectivePressurePsi??32)*tire.pressureRatio,0,100);
  tire.tread=Math.min(tire.tread,clamp(1-number(actual?.wear,0)));
  tire.pressureRatio=clamp(tire.pressureRatio-scaled*(failed(`tire_${w}`)?.02:Math.max(0,c[`tire_${w}`].damage-60)*.00002));
  const brakeHeat=Number.isFinite(actual?.brakeTorqueNm)&&Number.isFinite(t.wheelAngularVelocityRadps?.[w])?Math.abs(actual.brakeTorqueNm*t.wheelAngularVelocityRadps[w])/4000:brake*speed*1.3;
  tire.brakeTemperatureC=clamp(tire.brakeTemperatureC+dt*(brakeHeat-(tire.brakeTemperatureC-ambient)*(.015+speed*.002)),ambient,1100);
  if(tire.brakeTemperatureC>500)wear(`pads_${w}`,(tire.brakeTemperatureC-500)*scaled*.0001);
  if(tire.pressureRatio<.35&&speed>5)wear(`tire_${w}`,scaled*.1);
 }
 // Integrated hazard and seeded exponential thresholds give repeatable time-based events.
 for(const def of MECHANICAL_COMPONENTS){const part=c[def.id];if(part.failed)continue;
  if(part.damage>25&&!part.symptom)part.symptom=part.damage>70?'Severe wear':'Worn';
  let stress=.05+load*rpmRatio;
  if(def.id.startsWith('pads_')||def.id.startsWith('hydraulics_'))stress=.02+brake*speed/20;
  else if(/^(tire_|damper_|spring_|alignment_)/.test(def.id))stress=speed/30+Math.abs(number(t.impact,0));
  else if(['radiator','waterPump','thermostat','fans'].includes(def.id))stress=Math.max(0,(s.coolantTemperatureC-70)/35);
  else if(['bearings','oilPump','oilSeals'].includes(def.id))stress=rpmRatio+(s.oilPressureBar<.7?2:0);
  else if(def.id==='turbo')stress=s.config.boostBar>0?load*rpmRatio:0;
  else if(def.id==='starter')stress=s.engineRunning?0:load;
  else if(['battery','alternator','wiring','lights'].includes(def.id))stress=electricalLoad/30;
  if(part.damage<50||stress<=0)continue;
  const hazard=Math.pow((part.damage-50)/50,3)*stress*scaled*s.config.failureRate*.025;
  part.hazard+=hazard;
  const threshold=-Math.log(hash(`${s.seed}:${def.id}:${part.events}`));
  if(part.hazard>=threshold||part.damage>=100){
   part.hazard=0;part.events++;
   if(part.damage>=90||hash(`${s.seed}:${def.id}:severity:${part.events}`)<(part.damage-45)/75){part.failed=true;part.symptom='Failed — repair required';}
   else{part.symptom='Intermittent malfunction';part.malfunctionUntil=s.tick+5;if(['ignition','ecu','fuelPump'].includes(def.id))s.misfireUntil=s.tick+3;}
   if(def.id==='gearbox'&&part.failed){const gear=Math.round(number(t.gear,1));if(gear!==0&&!s.lostGears.includes(gear))s.lostGears.push(gear);}
  }
 }
 const seized=failed('bearings')||failed('pistons');
 const canRun=!seized&&ignitionOK&&s.fuelPressureBar>.5;
 if(!canRun)s.engineRunning=false;
 // Automatic restart is an arcade assist; a broken starter prevents it.
 else if(!s.engineRunning&&load>.05&&!failed('starter')&&s.charge>.02){s.charge=clamp(s.charge-.001);s.engineRunning=true;}
 const torque=s.engineRunning?(s.tick<s.misfireUntil?.35:1)*clamp((s.voltage-9.5)/2.5,.15,1)*(s.config.boostBar>0?(1+s.config.boostBar*health('turbo'))/(1+s.config.boostBar):1):0;
 s.effects={torque,drive:!s.engineRunning||malfunction('axles')||malfunction('differential')||c.gearbox.malfunctionUntil>s.tick||s.lostGears.includes(Math.round(number(t.gear,1)))?0:failed('clutch')?.08:1-Math.max(0,c.clutch.damage-50)*.008*load,
 brakes:Object.fromEntries(MECHANICAL_WHEELS.map(w=>[w,malfunction(`hydraulics_${w}`)?0:(failed(`pads_${w}`)?.15:1)*clamp(1-(s.tires[w].brakeTemperatureC-400)/700,.2,1)])),
 pull:clamp((c.alignment_fl.damage+c.spring_fl.damage-c.alignment_fr.damage-c.spring_fr.damage)*.0006,-.2,.2),
 lights:health('lights')*clamp((s.voltage-9)/3.5)*((s.headlights||s.auxLights)?1:0),instruments:clamp((s.voltage-9)/3)};
 s.warnings=[];
 if(!s.engineRunning)s.warnings.push(seized?'ENGINE SEIZED':'ENGINE STALLED');
 if(Object.values(s.tires).some(t=>t.brakeTemperatureC>500))s.warnings.push('BRAKES HOT');
 if(s.coolantTemperatureC>110)s.warnings.push('COOLANT HOT');if(s.coolant<.25)s.warnings.push('COOLANT LOW');
 if(s.oilPressureBar<.7&&s.engineRunning)s.warnings.push('OIL PRESSURE');if(s.voltage<12)s.warnings.push('BATTERY');if(s.fuel<.1)s.warnings.push('FUEL LOW');
 for(const w of MECHANICAL_WHEELS)if(s.tires[w].pressureRatio<.6)s.warnings.push(`${w.toUpperCase()} TIRE LOW`);
}
export function repairMechanicalComponent(state,id){
 const c=Object.hasOwn(state.components,id)?state.components[id]:null;if(!c)throw Error('Unknown mechanical component');
 c.damage=0;c.failed=false;c.hazard=0;c.malfunctionUntil=0;c.symptom='';
 if(id==='gearbox')state.lostGears=[];
 if(id.startsWith('tire_'))state.tires[id.slice(5)]={...state.tires[id.slice(5)],pressureRatio:1,tread:1,temperatureC:25};
 if(['radiator','waterPump','thermostat'].includes(id))state.coolant=1;
 if(['oilPump','oilSeals','bearings'].includes(id))state.oil=1;
 if(id==='battery')state.charge=1;
 return state;
}

export function mechanicalMissionVariables(state,mission={},inventory={}){
 mission ||= {};inventory ||= {};
 const prefix=String(mission.outputPrefix||'mechanical').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,60)||'mechanical';
 const success=mechanicalConditionsMet(state,mission.completionConditions||[])&&(!mission.requiredInventory||Number(inventory[mission.requiredInventory])>0)&&number(state?.voltage,0)>=number(mission.minimumVoltage,0);
 const variables={[prefix+'.success']:success};
 for(const id of ['voltage','charge','fuel','coolant','oil','coolantTemperatureC','oilPressureBar','boostBar'])variables[prefix+'.'+id]=number(state?.[id],0);
 for(const def of MECHANICAL_COMPONENTS){variables[prefix+'.'+def.id+'.failed']=state?.components?.[def.id]?.failed===true;variables[prefix+'.'+def.id+'.damage']=number(state?.components?.[def.id]?.damage,0);}
 return {success,variables};
}
