import test from 'node:test';
import assert from 'node:assert/strict';
import {createMechanicalState,stepMechanicalState,applyMechanicalMission} from '../../src/racing/simulation/MechanicalModel.js';
import {mechanicalLamp} from '../../src/racing/MechanicalInstruments.js';
const full={rpm:7000,maxRpm:7000,throttle:1,speedMps:30,gear:3,ambientTemperatureC:35};
function run(s,seconds,telemetry=full,dt=.1){for(let i=0;i<Math.round(seconds/dt);i++)stepMechanicalState(s,dt,typeof telemetry==='function'?telemetry(i*dt):telemetry);return s;}
test('healthy full-effort ten minute race has no engine warnings or heat damage',()=>{
 for(const speedMps of [5,15,40]){
 const s=createMechanicalState();let peak=0;
 run(s,600,time=>{peak=Math.max(peak,s.coolantTemperatureC);assert.equal(mechanicalLamp('enginelight',s),0);return {...full,speedMps,brake:time%15<3?.8:0};});
 assert.ok(peak<105,`peak ${peak} at ${speedMps} m/s`);assert.ok(s.oilTemperatureC<125);assert.equal(s.engineRunning,true);assert.equal(s.effects.torque,1);
 for(const id of ['pistons','bearings','radiator','turbo'])assert.equal(s.components[id].damage,0,id);
 }
});
test('heat has inertia and does not inherit the accelerated wear clock',()=>{
 const a=createMechanicalState({}, {},{timeScale:1}),b=createMechanicalState({}, {},{timeScale:60});
 run(a,1);run(b,1);assert.ok(Math.abs(a.coolantTemperatureC-85)<.5);assert.ok(Math.abs(a.oilTemperatureC-90)<.2);
 assert.equal(a.coolantTemperatureC,b.coolantTemperatureC);assert.equal(a.oilTemperatureC,b.oilTemperatureC);
 run(a,120);const hot=a.coolantTemperatureC;run(a,1,{...full,throttle:0});assert.ok(Math.abs(a.coolantTemperatureC-hot)<.5);
});
test('actual cooling failure still overheats and low oil still damages bearings',()=>{
 const s=applyMechanicalMission(createMechanicalState(),{components:{waterPump:{failed:true}}});
 run(s,150);assert.ok(s.coolantTemperatureC>115);assert.ok(s.components.pistons.damage>0);assert.equal(mechanicalLamp('enginelight',s),2);
 const oil=applyMechanicalMission(createMechanicalState(),{oil:.02});run(oil,90);assert.ok(oil.components.bearings.damage>0);assert.ok(mechanicalLamp('oillight',oil)>0);
});
test('wear alone does not illuminate engine lamp; actual malfunction does',()=>{
 const s=createMechanicalState();s.components.ignition.damage=75;assert.equal(mechanicalLamp('enginelight',s),0);
 s.components.ignition.malfunctionUntil=s.tick+5;assert.equal(mechanicalLamp('enginelight',s),1);
 s.misfireUntil=s.tick+3;assert.equal(mechanicalLamp('enginelight',s),2);
});
test('thermal evolution stays deterministic across input step sizes and save/resume',()=>{
 const a=createMechanicalState(),b=structuredClone(a);run(a,60,full,.1);run(b,60,full,1/120);assert.equal(a.coolantTemperatureC,b.coolantTemperatureC);assert.equal(a.oilTemperatureC,b.oilTemperatureC);
 const saved=createMechanicalState(JSON.parse(JSON.stringify(a)));run(a,60);run(saved,60);assert.equal(a.coolantTemperatureC,saved.coolantTemperatureC);
});

import {updateRaceWearAndDamage} from '../../src/racing/simulation/DamageModel.js';
test('normal limiter operation causes no engine wear; actual overspeed still does',()=>{
 const hits=[];const e={playtestSession:{rpm:1,engineRpm:7000,speedMps:30,routeLength:1000},raceInput:{throttle:1,gear:3},selectedRace:{hazards:[]},getRaceSessionCar:()=>({id:'car'}),getRaceCarTuning:()=>({revLimitRpm:7000,gearRatios:[3,2,1,.8]}),getRaceRouteLength:()=>1000,updateRaceSceneryCollisions(){},applyRaceDamage:(...args)=>hits.push(args)};
 for(let i=0;i<600;i++)updateRaceWearAndDamage(e,.1);assert.deepEqual(hits,[]);
 e.playtestSession.engineRpm=8400;updateRaceWearAndDamage(e,.1);assert.ok(hits.some(([id,amount])=>id==='engine'&&amount>0));
});

test('minor wear still tolerates racing; an idle start leaves oil and engine lamps off',()=>{
 const s=createMechanicalState({}, {engine:25,panels:{front:25}});
 run(s,30,{...full,rpm:800,throttle:0,speedMps:0});assert.equal(mechanicalLamp('enginelight',s),0);assert.equal(mechanicalLamp('oillight',s),0);
 run(s,600,{...full,speedMps:5});assert.equal(mechanicalLamp('enginelight',s),0);assert.equal(mechanicalLamp('oillight',s),0);assert.ok(s.coolantTemperatureC<105);
});
