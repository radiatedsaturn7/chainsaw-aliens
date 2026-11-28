import test from 'node:test';
import assert from 'node:assert/strict';
import {studioLampLevels} from '../../src/model3d/RaceModelVehicle.js';
import {createMechanicalState,stepMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import {setTurnSignal,advanceTurnSignals} from '../../src/racing/TurnSignals.js';

const day=()=>createMechanicalState({headlights:false,auxLights:false,effects:{lights:0}});
const requests={braking:true,reversing:true};

test('braking and reverse remain powered with head and running off in real daytime state',()=>{
 const mechanical=day();
 stepMechanicalState(mechanical,.1,{headlights:false,rpm:1300,speedMps:7});
 assert.equal(mechanical.effects.lights,0);
 const before=JSON.stringify(mechanical);
 assert.deepEqual(studioLampLevels({mechanical},requests),{
  head:0,running:0,brake:2.7,reverse:1.65,'signal-left':0,'signal-right':0
 });
 assert.equal(JSON.stringify(mechanical),before,'visual evaluation must not mutate simulation state');
});

test('controlled signal indicators follow their authoritative side, phases, hazards and off',()=>{
 const s={mechanical:day()};
 const sides=()=>['signal-left','signal-right'].map(k=>studioLampLevels(s)[k]);
 setTurnSignal(s,'left');assert.deepEqual(sides(),[1.8,0]);
 advanceTurnSignals(s,.45);assert.deepEqual(sides(),[0,0]);
 advanceTurnSignals(s,.36);assert.deepEqual(sides(),[1.8,0]);
 setTurnSignal(s,'right');assert.deepEqual(sides(),[0,1.8]);
 setTurnSignal(s,'hazards');assert.deepEqual(sides(),[1.8,1.8]);
 setTurnSignal(s,'hazards');assert.deepEqual(sides(),[0,0]);
 s.mechanical.turnSignal='left';assert.deepEqual(sides(),[0,0],'authoritative off overrides legacy request');
 delete s.turnSignals;assert.deepEqual(sides(),[1.8,0],'legacy preview signal still works');
});

test('daylight circuit preserves real damage, transient derating and low voltage',()=>{
 const mechanical=day();
 mechanical.components.lights.failed=true;
 const state={mechanical};
 setTurnSignal(state,'hazards');
 let l=studioLampLevels(state,requests);
 assert.ok(Object.values(l).every(x=>x===0));
 mechanical.components.lights.failed=false;mechanical.voltage=8.9;
 l=studioLampLevels(state,requests);assert.ok(Object.values(l).every(x=>x===0));
 mechanical.voltage=10.75;mechanical.components.lights.damage=50;
 mechanical.components.lights.malfunctionUntil=1;
 l=studioLampLevels(state,requests);
 assert.ok(Math.abs(l.brake-2.7*.5*.60*.35)<1e-10);
 assert.ok(Math.abs(l.reverse-1.65*.5*.60*.35)<1e-10);
 assert.ok(Math.abs(l['signal-left']-1.8*.5*.60*.35)<1e-10);
 assert.ok(Math.abs(l['signal-right']-1.8*.5*.60*.35)<1e-10);
});

test('selected head/aux power, explicit legacy zero, manual render off and disabled mechanics retain semantics',()=>{
 const mechanical=day();const s={mechanical};setTurnSignal(s,'left');
 const allOff=(s,opts=requests)=>assert.ok(Object.values(studioLampLevels(s,opts)).every(x=>x===0));
 allOff(s,{...requests,enabled:false});
 allOff({mechanical:{headlights:false,auxLights:false,effects:{lights:0},turnSignal:'left'}});
 mechanical.headlights=true;allOff(s);
 mechanical.effects.lights=.4;mechanical.highBeams=true;
 let l=studioLampLevels(s,requests);
 assert.equal(l.head,2.1*.4);assert.equal(l.running,.4*.75);assert.equal(l.brake,.4*2.7);assert.equal(l.reverse,.4*1.65);
 mechanical.headlights=false;mechanical.auxLights=true;
 l=studioLampLevels(s,requests);
 assert.equal(l.head,0);assert.equal(l.running,0);assert.equal(l.brake,.4*2.7);
 const disabled=createMechanicalState({headlights:false,auxLights:false},{},{enabled:false});
 stepMechanicalState(disabled,.1,{headlights:false});
 assert.equal(disabled.effects.lights,0);
 assert.equal(studioLampLevels({mechanical:disabled},requests).brake,2.7);
});
