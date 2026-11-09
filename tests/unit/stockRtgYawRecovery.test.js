import test from 'node:test';
import assert from 'node:assert/strict';
import {runBrakeTurnCase} from '../../tools/vehicle-validation/brake-turn-audit.mjs';

for(const sign of [-1,1])test(`RTG recovers from a highway steering pulse and corner braking (${sign})`,()=>{
 for(const stability of [false,true])for(const braking of [false,true]){
  const result=runBrakeTurnCase({speedMps:34,mode:'coast',duration:6,stability,
   driver:(t,state)=>({
    steering:t<.3?0:t<1?sign*.3:
      // A test driver supplies a modest correction after braking. This is
      // deliberately outside game code: no steering assistance is installed.
      braking&&Math.abs(state.bodyLateralSpeedMps)>1?-Math.sign(state.bodyLateralSpeedMps)*.25:0,
    throttle:0,brake:braking&&t>=.5&&t<.8?1:0
   })});
  assert.ok(result.maxSlip<8,`stability=${stability}, braking=${braking}: peak slip ${result.maxSlip}`);
  const end=result.trace.at(-1);
  assert.ok(end.slip<1,`recover instead of developing a spin: ${end.slip}`);
  assert.ok(Math.abs(end.yawRate)<.02,`residual rotation ${end.yawRate}`);
  assert.equal(result.handbrakeFrames,0);
 }
});
