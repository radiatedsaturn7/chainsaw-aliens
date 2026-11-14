import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichRaceScenery} from '../../tools/campaigns/enrich_race_scenery.mjs';
const definition=ref=>ref==='fenceguardrail'?{name:'Guardrail',isFence:true,widthM:4,heightM:1,artRef:'rail',defaultRule:{behavior:'collide'}}:{widthM:4,heightM:6};
function helpers(){
 return {length:500,definition,pose:d=>({x:0,z:d,yaw:0,elevation:0,segment:{roadWidthM:7}}),project:p=>({distance:p.z,lateral:p.x}),ground:()=>0,hasGround:()=>true};
}
test('regional gap fill keeps original props, clears the road and is repeatable',()=>{
 const original={id:'authored',doodadRef:'desert-scrub',x:30,z:10,widthM:4,heightM:2,trackDistance:10,trackLateral:30};
 const r={id:'desert',name:'Desert',road:{width:7},scenery:[original]},h=helpers();
 const a=enrichRaceScenery(r,h);assert.ok(a.addedProps>0);assert.equal(r.scenery[0],original);
 for(const p of r.scenery.slice(1)){assert.equal(p.doodadRef,'desert-scrub');assert.ok(Math.abs(p.x)>3.5+p.widthM/2+7);}
 const first=structuredClone(r.scenery);enrichRaceScenery(r,h);assert.deepEqual(r.scenery,first);
});
test('no props are placed outside known terrain or on a steep building footprint',()=>{
 const r={id:'city',name:'Test Landmark Run',road:{width:7},scenery:[{doodadRef:'local-building',x:20,z:0,trackDistance:0,widthM:15,heightM:10}]};
 const h=helpers();h.hasGround=()=>false;
 assert.equal(enrichRaceScenery(r,h).addedProps,0);
 h.hasGround=()=>true;h.ground=p=>p.x;
 assert.equal(enrichRaceScenery(r,h).addedProps,0);
});
test('guardrail follows the outside of a sharp bend; ordinary city turns remain open',()=>{
 const h=helpers();h.length=300;
 h.pose=d=>({x:100*Math.sin(d/100),z:100*(1-Math.cos(d/100)),yaw:Math.PI/2-d/100,elevation:0,segment:{roadWidthM:7}});
 h.project=p=>({distance:100*Math.atan2(p.x,100-p.z),lateral:Math.hypot(p.x,100-p.z)-100});
 const r={id:'bend',name:'Mountain bend',road:{width:7},scenery:[]};
 const report=enrichRaceScenery(r,h);assert.ok(report.railSections>0);
 for(const p of r.scenery){assert.ok(p.fenceId);assert.ok(h.project(p).lateral>5);assert.equal(p.solid,true);}
 const city={id:'city',name:'City Landmark Run',road:{width:7},scenery:[]};
 assert.equal(enrichRaceScenery(city,h).railSections,0);
});
