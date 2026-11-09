import test from 'node:test';
import assert from 'node:assert/strict';
import {runBrakeTurnCase} from '../../tools/vehicle-validation/brake-turn-audit.mjs';

for(const steering of [-.3,.3])test(`stock RTG brake taps remain controllable turning ${steering<0?'right':'left'}`,()=>{
 const single=runBrakeTurnCase({mode:'single-touch',steering});
 const touch=runBrakeTurnCase({mode:'double-touch',steering});
 const trigger=runBrakeTurnCase({mode:'double-trigger',steering});
 for(const result of [single,touch,trigger]){
  assert.equal(result.handbrakeFrames,0,'service brakes must never pulse the handbrake');
  assert.ok(result.maxSlip<12,`${result.mode}: ${result.maxSlip.toFixed(2)} degrees of sideslip`);
  assert.ok(result.maxYaw<.8,`${result.mode}: yaw rate ${result.maxYaw}`);
 }
 assert.ok(Math.abs(touch.maxSlip-trigger.maxSlip)<.001,'touch taps deliver the same braking as trigger pulses');
 assert.ok(Math.abs(touch.maxYaw-trigger.maxYaw)<.001);
});
