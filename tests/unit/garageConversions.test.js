import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {buildGarageCar,normalizeCarPart} from '../../src/garage/CarPart.js';
import {GARAGE_ENGINES} from '../../src/garage/GarageConversions.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const part=id=>normalizeItemDocument(catalog.items.find(item=>item.id===id));
const editor=new RaceEditor({}),powertrain=new PowertrainModel();
test('engine conversions reach torque solver, gauges and automatic shift limits for every transmission',()=>{
 for(const stock of createBuiltInRaceCars())for(const [engine,spec] of Object.entries(GARAGE_ENGINES)){
  const original=structuredClone(stock),built=buildGarageCar(stock,{parts:[part('engine-swap-'+engine)]});
  for(const transmissionType of Object.keys(stock.transmissions||{})){
   const tuning=editor.getRaceCarTuning(built,{transmissionType});
   assert.equal(tuning.revLimitRpm,spec.limit);assert.equal(tuning.idleRpm,spec.idle);
   assert.ok(tuning.tachometerMaxRpm>=spec.limit);assert.ok(tuning.autoUpshiftRpm<spec.limit);
   assert.equal(tuning.engineInertiaKgM2,spec.inertia);
   for(const [rpm,torque] of spec.points)assert.ok(Math.abs(powertrain.getTorqueNmAtRpm(rpm,tuning)-torque*1.35582)<.01);
   assert.equal(tuning.weightKg,(stock.transmissions[transmissionType].weightKg??stock.tuning.weightKg)+spec.mass-180);
  }
  assert.deepEqual(stock,original);assert.deepEqual(buildGarageCar(stock),stock);
  assert.ok(Number.isFinite(built.mechanics.fuelMpg));
 }
});
test('drivetrain conversions change authoritative driven wheels and efficiency; engine upgrades apply after swaps',()=>{
 const stock=createBuiltInRaceCars()[0];
 for(const drivetrain of ['fwd','rwd','awd']){
  const parts=[part('engine-swap-six'),part('drive-swap-'+drivetrain),part('race-flywheel'),part('race-intake')];
  const built=buildGarageCar(stock,{parts});
  const tuning=editor.getRaceCarTuning(built),config=createVehicleDynamicsConfigFromTuning(tuning);
  assert.equal(tuning.drivetrain,drivetrain);
  assert.deepEqual(config.drivenWheelIds,powertrain.getDrivenWheelIds(tuning));
  assert.equal(config.drivetrainEfficiency,{fwd:.90,rwd:.88,awd:.84}[drivetrain]);
  assert.ok(tuning.engineInertiaKgM2<GARAGE_ENGINES.six.inertia);
  const bare=editor.getRaceCarTuning(buildGarageCar(stock,{parts:parts.slice(0,2)}));
  assert.ok(powertrain.getTorqueNmAtRpm(6000,tuning)>powertrain.getTorqueNmAtRpm(6000,bare));
  assert.deepEqual(buildGarageCar(stock,{parts:parts.toReversed()}),built);
 }
});
test('conversion definitions reject unknown engines and conflicting installation slots',()=>{
 assert.throws(()=>normalizeCarPart({slot:'engine-swap',engineSwap:'unknown'}));
 assert.throws(()=>normalizeCarPart({slot:'turbo',engineSwap:'v8'}));
 assert.throws(()=>normalizeCarPart({slot:'drive-swap',drivetrainSwap:'4wd'}));
});

test('purchased conversions survive save normalization and stock removal restores the original powertrain',async()=>{
 const {ItemSystem}=await import('../../src/items/ItemSystem.js');
 const parts=catalog.items.map(normalizeItemDocument);
 let saved;
 const items=new ItemSystem({player:{credits:50000},abilities:{}},{load:async()=>({}),save:async(key,value)=>{saved=structuredClone(value);return {ok:true};},library:{load:async id=>parts.find(p=>p.id===id)}});
 await items.garage.load();
 await items.garage.purchase('engine-swap-v8',{carRef:'test'});
 await items.garage.purchase('drive-swap-rwd',{carRef:'test'});
 const stock=createBuiltInRaceCars()[0];
 const converted=await items.garage.build('test',stock);
 assert.equal(editor.getRaceCarTuning(converted).drivetrain,'rwd');
 assert.equal(editor.getRaceCarTuning(converted).revLimitRpm,7000);
 assert.equal(saved.garage.parts['engine-swap-v8'].carPart.engineSwap,'v8');
 assert.equal(saved.garage.parts['drive-swap-rwd'].carPart.drivetrainSwap,'rwd');
 const {createMechanicalState}=await import('../../src/racing/simulation/MechanicalModel.js');
 const damaged=createMechanicalState({components:{waterPump:{failed:true,damage:100}},oil:.4}, {},converted.mechanics);
 await items.garage.saveCondition('test',{mechanical:damaged});
 await items.garage.remove('test','engine-swap');await items.garage.remove('test','drive-swap');
 const stockBuild=await items.garage.build('test',stock);
 const restoredState=createMechanicalState(stockBuild.condition.mechanical,stockBuild.condition.damage,stockBuild.mechanics);
 assert.equal(restoredState.config.engineHeatScale,1);assert.equal(restoredState.config.boostBar,0);
 assert.equal(restoredState.components.waterPump.failed,true);assert.equal(restoredState.oil,.4);
 const restored=editor.getRaceCarTuning(stockBuild),base=editor.getRaceCarTuning(stock);
 for(const key of ['drivetrain','revLimitRpm','engineInertiaKgM2','weightKg','torqueLbFt','powerHp'])assert.equal(restored[key],base[key],key);
});

test('engine swaps update boost instruments and thermal load without healing saved failures',async()=>{
 const {createMechanicalState,stepMechanicalState}=await import('../../src/racing/simulation/MechanicalModel.js');
 const stock=createBuiltInRaceCars()[0];stock.mechanics={...stock.mechanics,boostBar:1};
 for(const engine of ['v8','turbo']){
  const built=buildGarageCar(stock,{parts:[part('engine-swap-'+engine)]});
  assert.equal(built.mechanics.boostBar,engine==='turbo'?1.1:0);
  assert.ok(Number.isFinite(built.mechanics.engineHeatScale));
  const tuning=editor.getRaceCarTuning(built);
  const state=createMechanicalState({components:{waterPump:{failed:true,damage:100}},fuel:.4,oil:.3},{},built.mechanics);
  stepMechanicalState(state,.1,{rpm:5000,maxRpm:tuning.revLimitRpm,throttle:1});
  assert.equal(state.components.waterPump.failed,true);assert.ok(state.oil<=.3);
  assert.equal(state.config.boostBar,built.mechanics.boostBar);
 }
 const hot=buildGarageCar(stock,{parts:[part('engine-swap-v8'),part('race-intake')]});
 assert.ok(hot.mechanics.engineHeatScale>1);
 const baseState=createMechanicalState({}, {},stock.mechanics),hotState=createMechanicalState({}, {},hot.mechanics);
 for(let i=0;i<100;i++)for(const state of [baseState,hotState])stepMechanicalState(state,.1,{rpm:5000,maxRpm:7000,throttle:1});
 assert.ok(hotState.coolantTemperatureC>baseState.coolantTemperatureC);
});
