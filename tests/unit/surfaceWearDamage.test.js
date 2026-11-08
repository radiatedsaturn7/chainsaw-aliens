import test from 'node:test';
import assert from 'node:assert/strict';
import {contactTireWear,suspensionOverloadDamage,roughRoadSuspensionDamage,applySuspensionContactDamage} from '../../src/racing/simulation/SurfaceWearModel.js';
import {createMechanicalState,stepMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import {buildGarageCar} from '../../src/garage/CarPart.js';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {applyAmericaRoughness} from '../../tools/campaigns/america_roughness.mjs';
const tire=(surface,id='tarmac',extra={})=>contactTireWear({dt:1,patch:{normalLoadN:4000,longitudinalVelocityMps:25,wheelGrounded:true,material:{surfaceId:surface},tireParameters:{compound:{id,wearRate:1},pressurePsi:32,targetPressurePsi:32},...extra},thermal:{frictionHeatingWorkJ:7800,treadTemperatureC:80}});
test('snow reduces abrasion rather than punishing the wrong compound; gravel rewards reinforced tires',()=>{
 assert.ok(tire('snow').wear<tire('asphalt').wear*.1);assert.ok(tire('gravel').wear>tire('asphalt').wear);
 assert.ok(tire('gravel','dirt').wear<tire('gravel').wear);
 assert.equal(tire('snow','tarmac',{normalLoadN:15000}).damage,0);
 assert.ok(tire('gravel','tarmac',{normalLoadN:15000}).damage>tire('gravel','dirt',{normalLoadN:15000}).damage);
 assert.deepEqual(tire('gravel','tarmac',{wheelGrounded:false}),{wear:0,damage:0});
 assert.ok(tire('gravel','tarmac',{tireParameters:{compound:{id:'tarmac'},pressurePsi:12,targetPressurePsi:32}}).damage>0);
});
test('suspension has a no-damage load threshold; stronger parts and travel raise capacity but are not invulnerable',()=>{
 const suspension={suspensionTravelM:.15,springRateNpm:30000};
 const stock=suspensionOverloadDamage({loadN:20000,staticLoadN:3500,suspension,dt:.1});
 const rally=suspensionOverloadDamage({loadN:20000,staticLoadN:3500,suspension:{...suspension,suspensionTravelM:.3},strength:1.8,dt:.1});
 assert.ok(stock.damage>0);assert.equal(rally.damage,0);
 assert.ok(suspensionOverloadDamage({loadN:40000,staticLoadN:3500,suspension:{...suspension,suspensionTravelM:.3},strength:1.8,dt:.1}).damage>0);
 assert.equal(suspensionOverloadDamage({loadN:3500,staticLoadN:3500,suspension,dt:30}).damage,0);
 const long=suspensionOverloadDamage({loadN:20000,staticLoadN:3500,suspension,dt:1}).damage;
 assert.ok(Math.abs(stock.damage*10-long)<1e-10);
 const base={roughness:.3,speed:45,staticLoadN:3500,suspension:{suspensionTravelM:.15,bumpTravelM:.075,springRateNpm:30000,damperRateNsM:2500},dt:1};
 assert.ok(roughRoadSuspensionDamage(base)>0);
 assert.equal(roughRoadSuspensionDamage({...base,roughness:.015}),0);
 assert.equal(roughRoadSuspensionDamage({...base,strength:1.8,suspension:{...base.suspension,bumpTravelM:.2}}),0);
});
test('contact overload wears only loaded wheel components; reinforcement survives garage and runtime tuning',()=>{
 const state={mechanical:createMechanicalState(),contactPatches:{fl:{normalLoadN:25000,wheelGrounded:true}},suspensionState:{fl:{suspensionTravelM:.15,springRateNpm:30000}}};
 applySuspensionContactDamage(state,{massKg:1450,frontWeightDistribution:.5,powertrainTuning:{}},.1);
 assert.ok(state.mechanical.components.damper_fl.damage>0);assert.equal(state.mechanical.components.damper_fr.damage,0);
 const part=normalizeItemDocument(catalog.items.find(p=>p.id==='rally-suspension'));
 const stock=createBuiltInRaceCars()[0],built=buildGarageCar(stock,{parts:[part]});
 assert.equal(new RaceEditor({}).getRaceCarTuning(built).suspensionImpactStrength,1.8);
});
test('healthy sustained output is safe; excessive heat with inadequate cooling damages engine after thermal buildup',()=>{
 const run=config=>{const state=createMechanicalState({}, {},{timeScale:1,...config});state.peakCoolant=state.coolantTemperatureC;for(let n=0;n<6000;n++){stepMechanicalState(state,.1,{rpm:6500,maxRpm:7000,throttle:1,speedMps:15});state.peakCoolant=Math.max(state.peakCoolant,state.coolantTemperatureC);}return state;};
 const healthy=run({}),overheated=run({engineHeatScale:3,coolingEfficiency:.5,oilCoolingEfficiency:.5});
 assert.equal(healthy.components.pistons.damage,0);assert.ok(overheated.peakCoolant>115);assert.ok(overheated.components.pistons.damage>0);
 const cooled=run({engineHeatScale:3,coolingEfficiency:3,oilCoolingEfficiency:3});assert.equal(cooled.components.pistons.damage,0);
});
test('campaign roughness varies deterministically within stages and by surface without changing GPS geometry',()=>{
 const race={id:'test',road:{segments:Array.from({length:20},(_,i)=>({surface:i<10?'asphalt':'gravel',length:100,curve:i/100}))}};
 const original=structuredClone(race);applyAmericaRoughness(race,{id:'america-north-04',stage:4});
 assert.ok(new Set(race.road.segments.map(s=>s.bumpiness)).size>15);
 assert.ok(Math.min(...race.road.segments.slice(10).map(s=>s.bumpiness))>Math.max(...race.road.segments.slice(0,10).map(s=>s.bumpiness)));
 const copy=structuredClone(original);applyAmericaRoughness(copy,{id:'america-north-04',stage:4});assert.deepEqual(race,copy);
 race.road.segments.forEach((segment,i)=>{assert.equal(segment.curve,original.road.segments[i].curve);assert.equal(segment.length,100);});
});

test('actual drop contacts: reinforcement absorbs a modest landing, larger falls exceed capacity, and render FPS does not change damage',async()=>{
 const {VehicleDynamicsRunner,createVehicleDynamicsConfig}=await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
 const run=(height,strength,fps=120)=>{
  const config=createVehicleDynamicsConfig({chassisHz:120,tireHz:240,telemetryRetention:'none',powertrainTuning:{suspensionImpactStrength:strength}});
  const runner=new VehicleDynamicsRunner({config,initialState:{position:{x:0,y:config.cgHeightM+height,z:0},mechanical:createMechanicalState()},environmentProvider:()=>({grounded:true,surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},sampleTerrainAtWorldPoint:()=>({heightM:0,normal:{x:0,y:1,z:0},friction:1})})});
  for(let i=0;i<fps*1.5;i++)runner.advance(1/fps);
  return runner.state.mechanical.components.damper_fl.damage;
 };
 assert.equal(run(0,1),0);assert.equal(run(.9,1.8),0);
 const severe=run(1.8,1.8);assert.ok(severe>0);assert.ok(run(1.8,1)>severe);
 assert.equal(run(1.8,1.8,30),severe);
});
test('crossing an authored jump marker does not inflict height-based damage',async()=>{
 const {updateRaceWearAndDamage}=await import('../../src/racing/simulation/DamageModel.js');const changes=[];
 const editor={playtestSession:{previousDistance:0,distance:10,routeLength:100,speedMps:20,engineRpm:3000,triggeredHazardIds:[]},raceInput:{},selectedRace:{hazards:[{id:'jump',at:5,type:'jump',height:100}]},getRaceSessionCar:()=>({}),getRaceCarTuning:()=>({revLimitRpm:7000}),applyRaceDamage:(...args)=>changes.push(args),updateRaceSceneryCollisions(){}};
 updateRaceWearAndDamage(editor,.1);assert.equal(changes.length,0);assert.deepEqual(editor.playtestSession.triggeredHazardIds,['jump']);
});
