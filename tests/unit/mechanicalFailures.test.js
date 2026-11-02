import test from 'node:test';
import assert from 'node:assert/strict';
import {createMechanicalState,stepMechanicalState,repairMechanicalComponent,applyMechanicalMission,mechanicalConditionsMet} from '../../src/racing/simulation/MechanicalModel.js';
import {normalizeCarCondition} from '../../src/garage/GarageRepairs.js';
const telemetry={rpm:4000,maxRpm:7000,throttle:.6,speedMps:25,gear:3};
const run=(state,seconds,t=telemetry,dt=.1)=>{for(let n=0;n<Math.round(seconds/dt);n++)stepMechanicalState(state,dt,t);return state;};
test('healthy operation retains torque and finite measurements',()=>{const s=run(createMechanicalState(),300);assert.equal(s.effects.torque,1);assert.equal(s.effects.drive,1);assert.equal(s.engineRunning,true);assert.ok(s.coolantTemperatureC<115);assert.ok(s.oilPressureBar>1);});
test('fixed-time failures match across step sizes and serialized restores',()=>{const a=createMechanicalState({}, {engine:80}),b=structuredClone(a);run(a,30,telemetry,.1);run(b,30,telemetry,1/120);assert.equal(a.tick,b.tick);assert.deepEqual(a.components,b.components);const restored=createMechanicalState(JSON.parse(JSON.stringify(a)));run(a,10);run(restored,10);assert.deepEqual(a.components,restored.components);assert.equal(a.charge,restored.charge);});
test('alternator failure: lights off extends battery life, low voltage stalls',()=>{const a=applyMechanicalMission(createMechanicalState(),{components:{alternator:{failed:true}},charge:.07}),b=structuredClone(a);run(a,120,{...telemetry,headlights:true});run(b,120,{...telemetry,headlights:false});assert.ok(b.charge>a.charge);run(a,1800,{...telemetry,headlights:true,throttle:0});assert.equal(a.engineRunning,false);assert.equal(a.effects.torque,0);assert.equal(a.effects.drive,0);});
test('radiator leak drains coolant and overheats engine; oil pump destroys bearings',()=>{const a=applyMechanicalMission(createMechanicalState(),{components:{radiator:{failed:true}}});run(a,600,{...telemetry,throttle:1,rpm:6500,speedMps:5});assert.equal(a.coolant,0);assert.ok(a.coolantTemperatureC>115);assert.ok(a.components.pistons.damage>0);const b=applyMechanicalMission(createMechanicalState(),{components:{oilPump:{failed:true}}});run(b,180);assert.ok(b.components.bearings.damage>90);assert.equal(b.engineRunning,false);});
test('specific repair preserves unrelated damage and lost gears only gearbox clears',()=>{const s=applyMechanicalMission(createMechanicalState(),{components:{alternator:{failed:true},radiator:{failed:true}}});s.lostGears=[3];repairMechanicalComponent(s,'alternator');assert.equal(s.components.alternator.failed,false);assert.equal(s.components.radiator.failed,true);assert.deepEqual(s.lostGears,[3]);assert.equal(mechanicalConditionsMet(s,[{component:'alternator',operational:true,maxDamage:25}]),true);assert.equal(mechanicalConditionsMet(s,[{component:'radiator',operational:true}]),false);});
test('backwards compatible condition and invalid data stays finite',()=>{const s=normalizeCarCondition({damage:{engine:40,tires:20}});assert.equal(s.damage.tires.fl,20);assert.equal(s.mechanical.components.ignition.damage,40);const m=createMechanicalState({charge:NaN,oil:Infinity});stepMechanicalState(m,NaN,{});assert.ok(Number.isFinite(m.charge));assert.ok(Number.isFinite(m.oil));});
test('failed hydraulics and punctures physically lower braking and pressure',()=>{const s=applyMechanicalMission(createMechanicalState(),{components:{hydraulics_fl:{failed:true},tire_fr:{failed:true}}});run(s,10);assert.equal(s.effects.brakes.fl,0);assert.ok(s.tires.fr.pressureRatio<.5);assert.equal(s.effects.brakes.fr,1);});
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {VehicleDynamicsRunner,createVehicleDynamicsState} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {GarageTuner} from '../../src/garage/GarageTuning.js';
import {createVehicleControlInputBuffer,readVehicleControlInput,createVehicleEnvironmentUpdateBuffer,readVehicleEnvironmentUpdate} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';
import {mechanicalMissionVariables} from '../../src/racing/simulation/MechanicalModel.js';

test('production powertrain cuts drive and brake torque without changing chassis velocity',()=>{
 const mechanics=applyMechanicalMission(createMechanicalState(),{components:{bearings:{failed:true},hydraulics_fl:{failed:true}}});run(mechanics,.2);
 const state={mechanical:mechanics,velocity:{x:0,z:20},groundSpeedMps:20,engineRpm:4000};
 const common={state,config:{gearRatios:[3,2,1],finalDrive:4,idleRpm:800,maxRpm:7000,brakeForceN:12000},tuning:{drivetrain:'awd',torqueLbFt:200,idleRpm:800,torquePeakStartRpm:2000,torquePeakEndRpm:5000,revLimitRpm:7000,gearRatios:[3,2,1],finalDrive:4},controls:{requestedGear:1,throttle:1,brake:1,assists:{absEnabled:false}},previous:{gear:1,targetGear:1,engineRpm:4000},driveShareByWheel:{fl:.25,fr:.25,rl:.25,rr:.25},dt:.1};
 const model=new PowertrainModel(),broken=model.stepAuthoritativeWheelTorques(common),healthy=model.stepAuthoritativeWheelTorques({...common,state:{...state,mechanical:null}});
 assert.equal(broken.state.engineRpm,0);assert.equal(broken.wheelDriveTorqueNm.fl,0);assert.equal(broken.wheelBrakeTorqueNm.fl,0);assert.ok(healthy.wheelDriveTorqueNm.fl>0);assert.ok(healthy.wheelBrakeTorqueNm.fl>0);assert.equal(state.velocity.z,20);
});
test('runner owns mechanical ticks and snapshots; pose resets do not repair faults',()=>{
 const mechanical=applyMechanicalMission(createMechanicalState(),{components:{alternator:{failed:true}}});
 const runner=new VehicleDynamicsRunner({config:{chassisHz:120,tireHz:120,telemetryRetention:'none'},initialState:{mechanical},environmentProvider:()=>({})});
 runner.advance(.05);runner.advance(.05);assert.equal(runner.state.mechanical.tick,1);
 const snapshot=runner.createSnapshot();assert.equal(snapshot.state.mechanical.components.alternator.failed,true);
 runner.replaceAuthoritativeState({position:{x:5,y:1,z:5}});assert.equal(runner.state.mechanical.components.alternator.failed,true);
 const normalized=createVehicleDynamicsState(snapshot.state);assert.deepEqual(normalized.mechanical,snapshot.state.mechanical);
});
test('repair transaction charges scrap and consumes compatible salvage only on successful save',async()=>{
 let saved,fail=false;const game={player:{credits:1000},abilities:{}};
 const items=new ItemSystem(game,{load:async()=>({}),save:async(k,v)=>{if(fail)return {ok:false,reason:'disk full'};saved=structuredClone(v);return {ok:true};}});await items.load();
 const m=applyMechanicalMission(createMechanicalState(),{components:{alternator:{failed:true},radiator:{failed:true}},requiredParts:{alternator:'wrx-alternator'}});
 await items.garage.saveCondition('WRX',{mechanical:m});
 await assert.rejects(items.garage.repair('WRX','alternator',{}),/replacement part/);
 await items.collect({id:'salvage',effects:[{type:'inventory',target:'wrx-alternator',amount:1}]},'found-alternator');
 fail=true;const before=structuredClone(items.progress);await assert.rejects(items.garage.repair('WRX','alternator',{}),/disk full/);assert.deepEqual(items.progress,before);assert.equal(game.player.credits,1000);
 fail=false;await items.garage.repair('WRX','alternator',{});assert.equal(game.player.credits,840);assert.equal(items.progress.bags.items['wrx-alternator'],0);assert.equal(items.garage.configuration('WRX').condition.mechanical.components.radiator.failed,true);
 const reload=new ItemSystem({player:{credits:840},abilities:{}},{load:async k=>k==='rtg-item-progress'?saved:{},save:async()=>({ok:true})});await reload.load();assert.equal(reload.garage.configuration('WRX').condition.mechanical.components.alternator.failed,false);
});
test('repair all cannot partially debit or consume parts when resources are insufficient',async()=>{
 const game={player:{credits:1},abilities:{}};const items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:true})});await items.load();
 const m=applyMechanicalMission(createMechanicalState(),{components:{alternator:{failed:true},radiator:{failed:true}}});await items.garage.saveCondition('car',{mechanical:m});const before=structuredClone(items.progress);
 await assert.rejects(items.garage.repair('car','all',{}),/scrap/);assert.deepEqual(items.progress,before);assert.equal(game.player.credits,1);
});
test('Tires retains pressure and type; Repair has confirmation, condition and costs',async()=>{
 const game={player:{credits:1000},abilities:{}};const items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:true})});await items.load();
 await items.garage.saveCondition('car',{mechanical:applyMechanicalMission(createMechanicalState(),{components:{alternator:{failed:true}}})});
 const tuner=new GarageTuner({garage:items.garage,carRef:'car',resolveCar:async()=>({setup:{tirePressurePsi:{fl:32,fr:32,rl:32,rr:32}}})});await tuner.readyTask;
 assert.ok(tuner.sectionRows(0).some(r=>r.id==='pressure.fl'));assert.ok(tuner.sectionRows(0).some(r=>r.id==='tireType'));
 tuner.index=1;await tuner.confirm();tuner.rowIndex=tuner.sectionRows().findIndex(r=>r.id==='alternator');await tuner.confirm();assert.equal(tuner.mode,'repair');assert.equal(game.player.credits,1000);await tuner.confirm();assert.equal(game.player.credits,840);assert.equal(tuner.mode,'list');
});
test('mission results publish real measurements and require the correct salvaged item',()=>{
 const s=createMechanicalState(),mission={requiredInventory:'m3-alternator',minimumVoltage:10,completionConditions:[{component:'bearings',operational:true}]};
 assert.equal(mechanicalMissionVariables(s,mission,{'wrx-alternator':1}).success,false);
 const result=mechanicalMissionVariables(s,mission,{'m3-alternator':1});assert.equal(result.success,true);assert.equal(result.variables['mechanical.voltage'],s.voltage);
});

test('worker protocol preserves headlights and mechanical damage inputs',()=>{
 for(const headlights of [true,false,null]){const decoded=readVehicleControlInput(createVehicleControlInputBuffer({headlights}));assert.equal(decoded.headlights,headlights);}
 const result=readVehicleEnvironmentUpdate(createVehicleEnvironmentUpdateBuffer({damage:{suspension:{fl:82},panels:{front:65,rear:75}}}));assert.equal(result.damage.suspension.fl,82);assert.ok(Math.abs(result.damage.panels.front-65)<.001);assert.ok(Math.abs(result.damage.panels.rear-75)<.001);
});
import {editCarMechanics,editMechanicalMission} from '../../src/ui/MechanicalForms.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {gaugeValue,normalizeGauge} from '../../src/racing/CarGauges.js';
test('authoring exposes car configuration and race faults without modifying saved cars during play',async()=>{
 const editor=new RaceEditor({});
 await editCarMechanics(editor,async(_title,fields)=>({...Object.fromEntries(fields.filter(f=>f.type!=='button').map(f=>[f.id,f.value])),batteryAh:35,boostBar:1.2}));
 assert.equal(editor.serializeSelectedCarDocument().car.mechanics.batteryAh,35);
 await editMechanicalMission(editor,async(title,fields)=>{
  if(title==='Mechanical mission'){
   await fields.find(f=>f.id==='fault').onClick({component:'alternator'});
   return {...Object.fromEntries(fields.filter(f=>f.type!=='button').map(f=>[f.id,f.value])),overrideFluids:true,charge:25,requiredInventory:'wrx-alternator',minimumVoltage:10};
  }
  return {override:true,damage:100,failed:true,part:'wrx-alternator'};
 });
 const mission=editor.serializeSelectedRaceDocument().race.mechanicalMission;assert.equal(mission.components.alternator.failed,true);assert.equal(mission.charge,.25);
 const carBefore=JSON.stringify(editor.selectedCar);editor.preloadSelectedRaceArtRefs=()=>{};editor.prewarmRacePlaytestRenderResources=()=>{};editor.startPlaytest(editor.selectedCar.id,{hydrateCars:false});
 assert.equal(editor.playtestSession.mechanical.components.alternator.failed,true);assert.equal(editor.playtestSession.mechanical.charge,.25);assert.equal(JSON.stringify(editor.selectedCar),carBefore);
 const gauge=normalizeGauge({source:'mechanical.voltage'});assert.equal(gaugeValue(gauge,{session:editor.playtestSession}),14.2);
});
test('healthy turbo configuration preserves existing engine torque; disabled mechanics are neutral',()=>{
 const s=createMechanicalState({}, {},{boostBar:1.5});run(s,10,{...telemetry,rpm:1000,throttle:.2});assert.equal(s.effects.torque,1);
 const disabled=createMechanicalState({...s,effects:{torque:NaN,drive:NaN,pull:Infinity}}, {},{enabled:false});run(disabled,10);assert.equal(disabled.effects.torque,1);assert.equal(disabled.effects.pull,0);
});
test('mission and repair input cannot modify inherited object keys',()=>{
 const s=createMechanicalState();applyMechanicalMission(s,{components:JSON.parse('{"__proto__":{"damage":100,"failed":true}}'),requiredParts:JSON.parse('{"__proto__":"part"}')});assert.equal({}.failed,undefined);assert.equal({}.requiredPart,undefined);
});
import {VehicleControlInputTimeline} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
test('headlight changes are discrete timeline events and survive held-input compression',()=>{
 const timeline=new VehicleControlInputTimeline([{timeSeconds:0,input:{headlights:true}},{timeSeconds:1,input:{headlights:true}},{timeSeconds:2,input:{headlights:false}},{timeSeconds:3,input:{headlights:false}}]);
 assert.equal(timeline.sampleAt(1.5).headlights,true);assert.equal(timeline.sampleAt(2.5).headlights,false);
});
test('repair everything restores all panel groups, worn tread and fluids while preserving tune/upgrades',async()=>{
 const game={player:{credits:10000},abilities:{}};const items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:true})});await items.load();
 const damage={panels:{front:20,left:35,right:40,rear:45},engine:20,transmission:30,suspensionPull:.2};
 const m=createMechanicalState({},damage);m.tires.fl.tread=.4;m.coolantTemperatureC=150;m.coolant=.1;m.charge=.1;
 await items.garage.saveCondition('car',{damage,mechanical:m});await items.garage.setTune('car',{'pressure.fl':30});
 const before=structuredClone(items.garage.configuration('car'));
 assert.equal(items.garage.repairRows('car',{}).find(r=>r.id==='tire_fl').enabled,true);
 await items.garage.repair('car','all',{});const after=items.garage.configuration('car');
 assert.equal(after.condition.damage.suspensionPull,0);assert.deepEqual(after.tune,before.tune);assert.deepEqual(after.installed,before.installed);assert.ok(Object.values(after.condition.damage.panels).every(v=>v===0));
 assert.ok(Object.values(after.condition.mechanical.components).every(c=>c.damage===0&&!c.failed));assert.equal(after.condition.mechanical.tires.fl.tread,1);assert.equal(after.condition.mechanical.coolant,1);assert.equal(after.condition.mechanical.coolantTemperatureC,85);
});
