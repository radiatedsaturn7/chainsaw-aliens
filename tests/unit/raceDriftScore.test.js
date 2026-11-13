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
