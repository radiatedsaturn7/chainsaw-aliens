import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {buildGarageCar,garageTuningRanges} from '../../src/garage/CarPart.js';
import {GarageTuner,tuningRows} from '../../src/garage/GarageTuning.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {PowertrainModel,mapThrottlePedal} from '../../src/racing/simulation/PowertrainModel.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const parts=catalog.items.map(normalizeItemDocument),part=id=>parts.find(p=>p.id===id),stock=createBuiltInRaceCars()[0],engine=new PowertrainModel();
const torque=car=>engine.getTorqueNmAtRpm(5000,car.tuning);

test('boost scales only installed turbo gains; power map changes output, heat and fuel without mutating stock',()=>{
 const original=structuredClone(stock),ecu=part('race-ecu'),turbo=part('race-turbo');
 const base=buildGarageCar(stock,{parts:[ecu]}),low=buildGarageCar(stock,{parts:[ecu,turbo],tune:{boostLevel:0}}),mid=buildGarageCar(stock,{parts:[ecu,turbo],tune:{boostLevel:.5}}),high=buildGarageCar(stock,{parts:[ecu,turbo],tune:{boostLevel:1}});
 assert.ok(Math.abs(torque(base)-torque(low))<1e-8);
 assert.ok(torque(low)<torque(mid)&&torque(mid)<torque(high));
 assert.ok(high.mechanics.engineHeatScale>low.mechanics.engineHeatScale);
 assert.ok(high.mechanics.fuelMpg<low.mechanics.fuelMpg);
 const economy=buildGarageCar(stock,{parts:[ecu,turbo],tune:{torqueScale:.7}}),performance=buildGarageCar(stock,{parts:[ecu,turbo],tune:{torqueScale:1.2}});
 assert.ok(torque(economy)<torque(performance));assert.ok(economy.mechanics.fuelMpg>performance.mechanics.fuelMpg);
 assert.deepEqual(stock,original);
 assert.throws(()=>buildGarageCar(stock,{parts:[turbo],tune:{boostLevel:1.1}}),/outside/);
 assert.deepEqual(buildGarageCar(stock,{tune:{boostLevel:0,pedalResponse:1.5}}),buildGarageCar(stock));
});
test('pedal reaches runtime input once per frame, shapes partial throttle and preserves full output',()=>{
 const seen=[];
 const car=buildGarageCar(stock,{parts:[part('race-ecu')],tune:{pedalResponse:1.5}});
 const tuning=new RaceEditor({}).getRaceCarTuning(car);
 assert.equal(tuning.pedalResponse,1.5);
 const runner=new VehicleDynamicsRunner({config:{...createVehicleDynamicsConfigFromTuning(tuning),telemetryRetention:'none'},inputTimeline:[{timeSeconds:0,input:{throttle:.25}}],tireContactSubsystem:{step({controls}){seen.push(controls.throttle);return {worldForceN:{},worldMomentNm:{},suspensionForceWorldN:{},wheelLoadsN:{},wheelSlip:{},suspensionTravel:{},tireForcesN:{},wheelAngularVelocityRadps:{},contactPatches:{},suspensionState:{},grounded:false};}}});
 for(let i=0;i<3;i++)runner.advance(1/120);
 assert.ok(seen.length>=3);assert.ok(seen.every(value=>Math.abs(value-.5)<1e-8));
 assert.ok(mapThrottlePedal(.25,.5)<.25);assert.equal(mapThrottlePedal(.25,1),.25);
 for(const response of [.5,1,1.5]){assert.equal(mapThrottlePedal(0,response),0);assert.equal(mapThrottlePedal(1,response),1);}
 const gentle=buildGarageCar(stock,{parts:[part('race-ecu')],tune:{pedalResponse:.5}});
 assert.equal(torque(car),torque(gentle));
});
test('ballast and axle submenus stay reachable; legacy adjustable differential grants independent axle settings',async()=>{
 const items=new ItemSystem({player:{credits:100000},abilities:{}},{load:async()=>({}),save:async()=>({ok:true}),library:{load:async id=>part(id)}});await items.load();
 for(const id of ['street-ballast','race-ecu','sport-turbo','sport-differential','race-alignment'])await items.garage.purchase(id,{carRef:'car'});
 const tuner=new GarageTuner({garage:items.garage,carRef:'car',resolveCar:async()=>stock});await tuner.readyTask;
 assert.deepEqual(tuner.sectionRows(2).map(r=>r.label),['Power Map','Boost','Pedal']);
 assert.deepEqual(tuner.sectionRows(4).map(r=>r.label),['Front','Rear','Brakes','Ballast']);
 tuner.index=4;await tuner.confirm();tuner.rowIndex=3;await tuner.confirm();assert.deepEqual(tuner.sectionRows().map(r=>r.label),['Weight (kg)','Placement']);
 tuner.cancel();tuner.cancel();assert.equal(tuner.mode,'grid');
 assert.deepEqual(tuner.sectionRows(5).map(r=>r.label),['Front','Rear']);
 assert.deepEqual(tuner.sectionRows(7).map(r=>r.label),['Front','Rear','Center']);
 await items.garage.setTune('car',{frontDifferentialAccel:.2,rearDifferentialAccel:.7});
 const car=await items.garage.build('car',stock);assert.equal(car.tuning.frontDifferentialAccel,.2);assert.equal(car.tuning.rearDifferentialAccel,.7);
 assert.equal(garageTuningRanges([part('sport-differential')]).frontDifferentialAccel.max,.8);
 for(const drive of ['fwd','rwd']){
  const driven={...car,tuning:{...car.tuning,drivetrain:drive}},rows=tuningRows(items.garage,'car',stock,driven);
  assert.ok(!rows.find(r=>r.id==='centerDifferentialLock').enabled);
  assert.equal(rows.find(r=>r.id==='frontDifferentialAccel').enabled,drive==='fwd');
  assert.equal(rows.find(r=>r.id==='rearDifferentialAccel').enabled,drive==='rwd');
 }
});
