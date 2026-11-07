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
test('campaign smoothing rounds crests more than the old 20 m setting',()=>{
 const h=d=>d<=100?d*.15:30-d*.15;
 const old=build(20,h),smooth=build(45,h);
 const curvature=p=>Math.max(...p.samples.slice(1,-1).map((s,i)=>Math.abs(p.samples[i+2].elevation-2*s.elevation+p.samples[i].elevation)));
 assert.ok(curvature(smooth)<curvature(old)*.8);
 assert.equal(smooth.samples[0].elevation,old.samples[0].elevation);
 assert.equal(smooth.samples.at(-1).elevation,old.samples.at(-1).elevation);
});
test('campaign shoulder parameters reach the shared visual and physical corridor',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});
 const before=editor.getRaceSurfaceModel();
 const sample={roadHalfWidth:5,shoulderWidth:12,marginWidth:.2,elevation:0,leftTerrainElevation:2,rightTerrainElevation:-2};
 const old=before.getCorridorMetrics(sample);
 editor.selectedRace.source={shoulderFlatJoinM:8,shoulderBlendWidthM:32,shoulderMaxSlope:.22};
 editor.clearRaceRuntimeSurfaceCaches();
 const model=editor.getRaceSurfaceModel();
 const smooth=model.getCorridorMetrics(sample);
 assert.equal(smooth.flatJoinWidth,8);
 assert.ok(smooth.transitionWidth>old.transitionWidth);
 assert.equal(model.maxCutSideSlope,.22);assert.equal(model.maxFillSideSlope,.22);
 assert.equal(smooth.roadHalfWidth,old.roadHalfWidth);
});
