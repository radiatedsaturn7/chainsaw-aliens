import test from 'node:test';
import assert from 'node:assert/strict';
import {getRaceWheelContactState,getRaceWheelSurfaceState} from '../../src/racing/RaceVehicleSurfaceContact.js';
test('AI contact samples reproduce surface classification without repeating geometry queries and keep live weather state',()=>{
 const ids=['fl','fr','rl','rr'];
 const positions=Object.fromEntries(ids.map((id,i)=>[id,{x:i,z:0}]));
 let queries=0,wet=.8;
 const surfaceModel={sampleWorld:point=>{
  queries++;return {elevation:0,normal:{x:0,y:1,z:0},region:'road',surfaceId:point.x<2?'asphalt':'dirt',
   friction:.9,projection:{segment:{surface:point.x<2?'asphalt':'dirt'}}};
 }};
 const trackState={sample:p=>({cell:{baseSurfaceId:p.x<2?'asphalt':'dirt',baseGrip:1},
  effectiveGrip:wet,effectiveSurfaceId:p.x<2?'wet-asphalt':'mud',effectiveGripMultiplier:wet,rollingResistanceMultiplier:1})};
 const contact=getRaceWheelContactState({positions,surfaceModel,trackState});
 assert.equal(queries,4);
 const reference=getRaceWheelSurfaceState({positions,surfaceModel,trackState});
 assert.equal(queries,8);
 const reused=getRaceWheelSurfaceState({positions:contact.positions,surfaceSamples:contact.surfaceSamples,surfaceModel,trackState});
 assert.equal(queries,8);assert.deepEqual(reused,reference);
 wet=.4;
 const updated=getRaceWheelSurfaceState({positions:contact.positions,surfaceSamples:contact.surfaceSamples,surfaceModel,trackState});
 assert.equal(queries,8);assert.equal(updated.frictionByWheel.fl,.4);
 assert.equal(updated.baseSurfaceByWheel.rr,'dirt');
});
