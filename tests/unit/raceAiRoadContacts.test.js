import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleRaceAiWheelContacts} from '../../src/racing/RaceAiRoadContacts.js';

test('AI road contacts use authoritative geometry and retain live grip and individual surfaces',()=>{
 const ids=['fl','fr','rl','rr'];let grip=.8,queries=0;
 const positions=Object.fromEntries(ids.map((id,i)=>[id,{x:i,y:1,z:0}]));
 const editor={playtestSession:{worldBake:{surfaceSampler:{}}},
  getRaceWheelWorldPositions:()=>positions,getRaceCarDimensions:()=>({wheelbaseM:2.7,trackWidthM:1.6}),
  getRaceWeatherState:()=>({id:'storm'}),getRaceWheelContactState:()=>{throw Error('visual terrain sampler should not run');},
  getRaceSurfaceModel:()=>({samplePhysicsGeometry:p=>{queries++;return {valid:true,heightM:0,normal:{x:0,y:1,z:0},
   region:p.x===3?'terrain':'road',surfaceId:p.x===3?'dirt':'asphalt',friction:.9};}})};
 const session={routeRuntimeType:'destination',trackState:{sample:()=>({effectiveGrip:grip,effectiveSurfaceId:'wet-asphalt',cell:{baseSurfaceId:'asphalt',baseGrip:1}})}};
 const options={car:{},tuning:{},session};
 let result=sampleRaceAiWheelContacts(editor,{},options);
 assert.equal(queries,4);assert.equal(result.contacts.fl.friction,.8);assert.equal(result.contacts.rr.region,'terrain');
 grip=.3;result=sampleRaceAiWheelContacts(editor,{},options);
 assert.equal(result.contacts.fl.friction,.3);assert.equal(result.averageHeightM,0);
 assert.equal(Object.keys(result.surfaceSamples).length,4);
});
test('unprepared races retain the existing contact path',()=>{
 let calls=0;const editor={getRaceWheelContactState:()=>{calls++;return 'legacy';}};
 assert.equal(sampleRaceAiWheelContacts(editor,{},{}),'legacy');assert.equal(calls,1);
});

test('shared contact geometry matches original samples across movement, materials and bake replacement',async()=>{
 const {RaceSurfaceModel}=await import('../../src/racing/RaceSurfaceModel.js');
 const {buildRaceBakedSurfaceSampler,packRaceBakedSurfaceSampler,sampleRaceBakedSurface}=await import('../../src/racing/RaceBakedSurfaceSampler.js');
 const bake=height=>packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({mesh:{triangles:[
  {region:'road',vertices:[{x:0,z:0,elevation:height},{x:100,z:0,elevation:height},{x:0,z:100,elevation:height}]},
  {region:'road',vertices:[{x:100,z:0,elevation:height},{x:100,z:100,elevation:height},{x:0,z:100,elevation:height}]}]}}));
 const editor={playtestSession:{worldBake:{surfaceSampler:bake(1)}},getRaceWeatherState:()=>({}),
  getRaceWheelWorldPositions:({session})=>Object.fromEntries(['fl','fr','rl','rr'].map((id,i)=>[id,{x:session.worldX+(i%2),z:session.worldZ+Math.floor(i/2)}])),
  getRaceCarDimensions:()=>({}),getRaceSurfaceModel:()=>model};
 const model=new RaceSurfaceModel({elevationScaleM:12,getRoadHalfWidth:()=>50,
  projectWorldToTrack:p=>({distance:p.z,lateral:p.x-50,segment:{surface:p.z>40?'dirt':'asphalt'}}),
  getWorldPoseAtDistance:d=>({x:50,z:d,segment:{surface:d>40?'dirt':'asphalt'}}),
  sampleBakedSurface:(point,opts)=>sampleRaceBakedSurface(editor.playtestSession.worldBake.surfaceSampler,point,opts)});
 let retained;
 for(const [x,z,h] of [[10,10,1],[11,11,1],[40,45,1],[98,98,1],[10,10,2]]) {
  if(h===2)editor.playtestSession.worldBake={surfaceSampler:bake(h)};
  const options={car:{},tuning:{},session:{worldX:x,worldZ:z}};
  editor.playtestSession.debugAiNoContactCache=true;
  const expected=sampleRaceAiWheelContacts(editor,{},options);
  editor.playtestSession.debugAiNoContactCache=false;
  const actual=sampleRaceAiWheelContacts(editor,{},options);
  assert.deepEqual(actual,expected);
  if(!retained)retained=actual;
 }
 assert.equal(retained.averageHeightM,12,'later cache reuse must not mutate retained contacts');
});

test('AI wheel batches prepare one current road profile with exact uncached contact parity',async()=>{
 const {RaceSurfaceModel}=await import('../../src/racing/RaceSurfaceModel.js');
 let profileReads=0,revision=1,grip=.8;
 const segment={surface:'asphalt'};
 const model=new RaceSurfaceModel({elevationScaleM:12,getRouteLength:()=>100,
  getRuntimeType:()=> 'destination',getRoadHalfWidth:()=>8,
  getRoadbedProfile:()=>{profileReads++;return {revision};},
  sampleRoadbedProfileAtDistance:(distance,profile)=>({x:0,z:distance,elevation:profile.revision,
   grade:.1,yaw:0,segment,roadHalfWidth:8}),
  projectWorldToTrack:p=>({distance:p.z,lateral:p.x,segment})});
 const editor={playtestSession:{worldBake:{surfaceSampler:{},surfaceRevision:1}},
  getRaceSurfaceModel:()=>model,getRaceWeatherState:()=>({id:'rain'}),
  getRaceCarDimensions:()=>({}),getRaceWheelWorldPositions:()=>({
   fl:{x:-1,z:10},fr:{x:1,z:10},rl:{x:-1,z:8},rr:{x:1,z:8}})};
 const session={routeRuntimeType:'destination',trackState:{sample:()=>({effectiveGrip:grip,
  effectiveSurfaceId:'wet-asphalt',cell:{baseSurfaceId:'asphalt',baseGrip:1}})}};
 const options={car:{},tuning:{},session};
 const prepare=model.createPhysicsQueryContext;
 let retained;
 for(const next of [1,2,3]) {
  revision=next;grip=.9-next*.1;
  editor.playtestSession.worldBake={surfaceSampler:{},surfaceRevision:next};
  model.createPhysicsQueryContext=undefined;profileReads=0;
  const reference=sampleRaceAiWheelContacts(editor,{},options);
  assert.equal(profileReads,4);
  model.createPhysicsQueryContext=prepare;profileReads=0;
  const batched=sampleRaceAiWheelContacts(editor,{},options);
  assert.equal(profileReads,1);
  assert.deepEqual(batched,reference);
  assert.equal(batched.contacts.fl.friction,grip);
  assert.equal(batched.averageHeightM,next*12);
  retained ||= batched;
 }
 assert.equal(retained.averageHeightM,12);
});
