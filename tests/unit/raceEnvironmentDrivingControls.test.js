import test from 'node:test';import assert from 'node:assert/strict';
import{steeringIntent}from'../../tools/race-environments/driving-controls.mjs';
const s={yaw:0,targetYaw:0,speed:2,lateral:0,width:8};
test('route steering chooses left/right and shortest wrapped heading',()=>{assert.equal(steeringIntent({...s,targetYaw:.3}).steer,-1);assert.equal(steeringIntent({...s,targetYaw:-.3}).steer,1);assert.equal(steeringIntent({...s,yaw:Math.PI-.1,targetYaw:-Math.PI+.1}).steer,-1);assert.equal(steeringIntent(s).steer,0);});
test('normal inputs slow for bends without modifying vehicle tuning',()=>{assert.equal(steeringIntent({...s,speed:7}).throttle,false);assert.equal(steeringIntent({...s,targetYaw:.5,speed:6}).brake,true);assert.equal(steeringIntent(s).throttle,true);});
test('off-road or invalid telemetry cannot be accepted as a steered drive',()=>{assert.throws(()=>steeringIntent({...s,lateral:3.1}),/left road/);assert.throws(()=>steeringIntent({...s,yaw:NaN}),/Invalid/);assert.throws(()=>steeringIntent({...s,width:2}),/narrower/);});
