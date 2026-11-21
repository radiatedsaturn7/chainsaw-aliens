import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRaceDriftScore,raceDriftScoreVariables} from '../../src/racing/RaceDriftScore.js';
const motion={distanceM:10,longitudinalSpeed:15,lateralSpeed:6,contactCount:4,onCourse:true,active:true};
test('controlled forward slides score consistently per distance, not per frame',()=>{
 const full=advanceRaceDriftScore(null,motion);
 const half=advanceRaceDriftScore(null,{...motion,distanceM:5});
 assert.equal(advanceRaceDriftScore(half,{...motion,distanceM:5}).points,full.points);
 assert.ok(full.points>0);assert.equal(full.sliding,true);
});
test('no points for straight driving, reverse, spins, airborne, off-course or stationary donuts',()=>{
 for(const patch of [{lateralSpeed:0},{longitudinalSpeed:-15},{lateralSpeed:40},{contactCount:0},{onCourse:false},{active:false},{distanceM:0},{distanceM:-2},{distanceM:NaN}]){
  const result=advanceRaceDriftScore({points:123},{...motion,...patch});
  assert.equal(result.points,123);assert.equal(result.sliding,false);
 }
});
test('best drift score is retained separately from campaign completion and only for scored events',()=>{
 const race={campaign:{scoring:'drift',sideEventId:'H11-S08'}};
 assert.deepEqual(raceDriftScoreVariables(race,{points:234.9}),{'raceScore.H11-S08':234});
 assert.deepEqual(raceDriftScoreVariables(race,{points:100},{'raceScore.H11-S08':250}),{'raceScore.H11-S08':250});
 assert.deepEqual(raceDriftScoreVariables({}, {points:100}),{});
});

test('score attacks cannot farm a corner by retracing course progress',()=>{
 const first=advanceRaceDriftScore(null,{...motion,progressM:10});
 const back=advanceRaceDriftScore(first,{...motion,progressM:5});
 const retry=advanceRaceDriftScore(back,{...motion,progressM:10});
 assert.equal(retry.points,first.points);
 assert.ok(advanceRaceDriftScore(retry,{...motion,progressM:20}).points>first.points);
});
test('authoritative supported wheels count for scoring without a nonexistent inContact field',async()=>{
 const {driftContactCount}=await import('../../src/racing/RaceDriftScore.js');
 assert.equal(driftContactCount({fl:{wheelGrounded:true,normalLoadN:3000},fr:{normalLoadN:2800},
 rl:{wheelGrounded:false,normalLoadN:10},rr:{normalLoadN:0}}),2);
 assert.equal(driftContactCount(),0);
});

test('real contact solver output can earn drift points',async()=>{
 const {ContactPatchTireModel}=await import('../../src/racing/simulation/ContactPatchTireModel.js');
 const {createVehicleDynamicsConfig,createVehicleDynamicsState}=await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
 const {driftContactCount}=await import('../../src/racing/RaceDriftScore.js');
 const config=createVehicleDynamicsConfig({massKg:1400});
 const result=new ContactPatchTireModel().step({config,
 state:createVehicleDynamicsState({position:{x:0,y:config.cgHeightM,z:0},speedMps:20,velocity:{x:5,y:0,z:20}}),
 controls:{throttle:0,brake:0,handbrake:0,steering:0,requestedGear:1},environment:{surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0}},dt:1/360});
 assert.ok(advanceRaceDriftScore(null,{...motion,contactCount:driftContactCount(result.contactPatches)}).points>0);
});
