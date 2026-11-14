import test from 'node:test';
import assert from 'node:assert/strict';
import {repairRoadsideInfrastructure,infrastructureKind} from '../../tools/campaigns/roadside_infrastructure.mjs';
import {layerRoadside} from '../../tools/campaigns/layered_roadside.mjs';
import {enrichRaceScenery} from '../../tools/campaigns/enrich_race_scenery.mjs';
const defs={
 'roadside-streetlight':{widthM:4,heightM:8,artRef:'light'},
 'expanded-tree-white-oak-young-01':{widthM:4,heightM:8,artRef:'oak'},
 'roadside-wooden-fence-intact':{widthM:3,heightM:1.2,artRef:'wood'},
 'fencebushes':{widthM:8,heightM:2,artRef:'hedge',isFence:true},
 'roadside-metal-guardrail-intact':{widthM:4,heightM:.8,artRef:'rail'},
};
const helpers=()=>({length:1000,pose:d=>({x:0,z:d,yaw:0,elevation:0,segment:{roadWidthM:7}}),project:p=>({distance:p.z,lateral:-p.x}),ground:()=>0,hasGround:()=>true,definition:r=>defs[r]});
const race=scenery=>({id:'test',name:'Providence Landmark Run',road:{width:7,segments:[{surface:'asphalt'}]},scenery});
test('streetlights are infrastructure, never tree seeds for either vegetation pass',()=>{
 assert.equal(infrastructureKind('roadside-streetlight'),'light');
 for(const enrich of [layerRoadside,enrichRaceScenery]){
  const r=race([{id:'authored',doodadRef:'roadside-streetlight',x:40,z:100,widthM:4,heightM:8,trackDistance:100,trackLateral:40}]);
  enrich(r,helpers());assert.equal(r.scenery.filter(p=>p.doodadRef==='roadside-streetlight').length,1);
 }
});
test('accidental vegetation lights become trees; true lights form readable spaced roadside rows',()=>{
 const r=race([{id:'ecology-v2-1',doodadRef:'roadside-streetlight',x:80,z:100,trackDistance:100}, {id:'original',doodadRef:'roadside-streetlight',x:60,z:200,trackDistance:200}]);
 const report=repairRoadsideInfrastructure(r,helpers());assert.equal(report.replacedVegetation,1);
 assert.equal(r.scenery.find(p=>p.id==='ecology-v2-1').doodadRef,'expanded-tree-white-oak-young-01');
 const lights=r.scenery.filter(p=>p.doodadRef==='roadside-streetlight');assert.ok(lights.length>1);
 for(const p of lights){assert.ok(Math.abs(p.trackLateral)<=11.5);assert.equal(p.previewDoodad.hitboxWidthM,.4);assert.equal(p.flipX,p.trackLateral<0);}
 for(let i=1;i<lights.length;i++)assert.ok(lights[i].trackDistance-lights[i-1].trackDistance>=45);
});
test('loose fence sprites become connected native fence strokes',()=>{
 const r=race([{id:'loose',doodadRef:'roadside-wooden-fence-intact',x:90,z:500,trackDistance:500,trackLateral:90}]);
 const report=repairRoadsideInfrastructure(r,helpers());assert.ok(report.fenceSections>0);
 const panels=r.scenery.filter(p=>p.doodadRef==='roadside-wooden-fence-intact');assert.ok(panels.length>10);assert.ok(panels[0].fencePath);
 for(const p of panels){assert.ok(p.fenceId);assert.ok(Math.abs(p.x)<20);assert.ok(p.previewDoodad.isFence);}
});
test('water and crossings reject proposed roadside infrastructure',()=>{
 const r=race([{id:'original',doodadRef:'roadside-streetlight',x:60,z:200,trackDistance:200}]);
 const h=helpers();h.hasGround=()=>false;const report=repairRoadsideInfrastructure(r,h);assert.equal(report.placedInfrastructure,0);assert.equal(report.fenceSections,0);
});
test('safety rail replacement keeps native texture repeats and leaves authored rails intact',async()=>{
 const {buildRaceFencePlacements}=await import('../../src/racing/RaceFences.js');
 const {rebuildSafetyRails}=await import('../../tools/campaigns/roadside_infrastructure.mjs');
 const old={isFence:true,widthM:12.5,heightM:2.2,artRef:'old'};
 const points=[{x:8,z:100},{x:8,z:132}];
 const authored=buildRaceFencePlacements(points,old,{id:'tower-guardrail-0',ref:'fenceguardrail'});
 const r=race([...authored,...buildRaceFencePlacements(points,old,{id:'coverage-v1-rail-0',ref:'fenceguardrail'})]);
 assert.ok(rebuildSafetyRails(r,helpers())>0);
 assert.deepEqual(r.scenery.filter(p=>p.fenceId==='tower-guardrail-0'),authored);
 for(const p of r.scenery.filter(p=>p.fenceId==='coverage-v1-rail-0')){
  assert.equal(p.heightM,.8);assert.ok(Math.abs(p.widthM/(p.fenceU1-p.fenceU0)-4)<1e-6);
 }
 const first=structuredClone(r.scenery);rebuildSafetyRails(r,helpers());assert.deepEqual(r.scenery,first);
});
