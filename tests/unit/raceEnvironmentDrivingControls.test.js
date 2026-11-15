import test from 'node:test';import assert from 'node:assert/strict';
import{steeringIntent}from'../../tools/race-environments/driving-controls.mjs';
const s={yaw:0,targetYaw:0,speed:2,lateral:0,width:8};
test('route steering chooses left/right and shortest wrapped heading',()=>{assert.equal(steeringIntent({...s,targetYaw:.3}).steer,-1);assert.equal(steeringIntent({...s,targetYaw:-.3}).steer,1);assert.equal(steeringIntent({...s,yaw:Math.PI-.1,targetYaw:-Math.PI+.1}).steer,-1);assert.equal(steeringIntent(s).steer,0);});
test('normal inputs slow for bends without modifying vehicle tuning',()=>{assert.equal(steeringIntent({...s,speed:7}).throttle,false);assert.equal(steeringIntent({...s,targetYaw:.5,speed:6}).brake,true);assert.equal(steeringIntent(s).throttle,true);});
test('off-road or invalid telemetry cannot be accepted as a steered drive',()=>{assert.throws(()=>steeringIntent({...s,lateral:3.1}),/left road/);assert.throws(()=>steeringIntent({...s,yaw:NaN}),/Invalid/);assert.throws(()=>steeringIntent({...s,width:2}),/narrower/);});

import {routeProgressDelta} from '../../tools/race-environments/driving-controls.mjs';
const p={distance:99,x:0,z:0,elapsed:1000,speed:2,routeLength:100,runtimeType:'circuit'};
test('circuit seam progress unwraps forward and reverse travel without counting a lap jump',()=>{
 assert.equal(routeProgressDelta(p,{...p,distance:1,x:2,elapsed:2000}),2);
 assert.equal(routeProgressDelta({...p,distance:1},{...p,distance:99,x:-2,elapsed:2000}),-2);
 assert.equal(routeProgressDelta(p,{...p,elapsed:2000}),0);
});
test('open routes never unwrap and discontinuous projections or resets cannot earn progress',()=>{
 assert.throws(()=>routeProgressDelta({...p,runtimeType:'destination'},{...p,runtimeType:'destination',distance:1,x:2,elapsed:2000}),/projection jumped/);
 assert.throws(()=>routeProgressDelta(p,{...p,distance:30,x:2,elapsed:2000}),/projection jumped/);
 assert.throws(()=>routeProgressDelta(p,{...p,distance:1,x:40,elapsed:1100}),/teleport/);
 assert.throws(()=>routeProgressDelta(p,{...p,elapsed:0}),/clock reset/);
 assert.throws(()=>routeProgressDelta(p,{...p,distance:NaN}),/Invalid/);
});
