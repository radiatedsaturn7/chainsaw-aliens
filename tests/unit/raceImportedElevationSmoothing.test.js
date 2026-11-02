import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRaceRoadbedProfile} from '../../src/racing/RaceRoadDeckProfile.js';
const build=(radius,height)=>buildRaceRoadbedProfile({routeLength:200,absoluteRouteElevation:true,elevationSmoothingRadiusM:radius,adapter:{clampElevation:v=>v,getWorldPoseAtDistance:d=>({x:d,z:0,elevation:height(d)/12}),sampleTerrain:()=>0}});
test('import smoothing rounds crests and troughs without moving endpoints or flattening grades',()=>{
 for(const sign of [-1,1]){
 const h=d=>sign*(d<=100?d*.15:30-d*.15);
 const before=build(0,h),after=build(20,h);
 const peak=p=>Math.max(...p.samples.slice(1,-1).map((s,i)=>Math.abs((p.samples[i+2].elevation-2*s.elevation+p.samples[i].elevation)*12/2.5**2)));
 assert.ok(peak(after)<peak(before)*.75, `${peak(after)} vs ${peak(before)}`);
 assert.equal(after.samples[0].elevation,before.samples[0].elevation);
 assert.equal(after.samples.at(-1).elevation,before.samples.at(-1).elevation);
 }
 const slope=build(20,d=>d*.1);
 for(const s of slope.samples)assert.ok(Math.abs(s.elevation*12-s.distance*.1)<1e-8);
});
