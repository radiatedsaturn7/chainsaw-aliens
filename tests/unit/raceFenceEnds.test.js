import test from 'node:test';import assert from 'node:assert/strict';
import {flareRoadsideFenceEnds,buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
const roadside={project:p=>({distance:p.z,lateral:-p.x}),pose:d=>({x:0,z:d,yaw:0,segment:{roadWidthM:7}})};
test('both terminals flare away from the road on either side, keeping the middle',()=>{
 for(const side of [-1,1]){
  const points=[{x:side*7,z:0},{x:side*7,z:40}],result=flareRoadsideFenceEnds(points,roadside);
  assert.ok(result.changed);assert.equal(result.points[0].x,side*11);assert.equal(result.points.at(-1).x,side*11);
  assert.ok(result.points.filter(p=>p.z>=8&&p.z<=32).every(p=>p.x===side*7));
  const panels=buildRaceFencePlacements(points,{isFence:true,widthM:4,heightM:1},{id:'test',roadside});
  assert.equal(panels[0].fencePath.endFlared,true);assert.ok(panels.every(p=>Math.abs(p.x)>=7));
  const again=buildRaceFencePlacements(panels[0].fencePath.points,{isFence:true,widthM:4,heightM:1},{id:'test',roadside,endFlared:true});assert.deepEqual(again,panels);
 }
});
test('closed, distant, perpendicular and unsafe fence ends remain authored',()=>{
 for(const points of [[{x:50,z:0},{x:50,z:40}],[{x:7,z:0},{x:30,z:0}],[{x:7,z:0},{x:7,z:40},{x:7,z:0}]])assert.equal(flareRoadsideFenceEnds(points,roadside).changed,false);
 assert.equal(flareRoadsideFenceEnds([{x:7,z:0},{x:7,z:40}],{...roadside,validPoint:()=>false}).changed,false);
});

test('fence flares follow the actual editor right vector at arbitrary headings',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 for(const yaw of [0,.8,Math.PI,4.1])for(const side of [-1,1]){
  const right=RaceEditor.prototype.getRaceRightVector(yaw),forward={x:Math.sin(yaw),z:Math.cos(yaw)};
  const point=d=>({x:right.x*side*7+forward.x*d,z:right.z*side*7+forward.z*d});
  const project=p=>({distance:p.x*forward.x+p.z*forward.z,lateral:p.x*right.x+p.z*right.z});
  const result=flareRoadsideFenceEnds([point(0),point(40)],{project,pose:d=>({...point(d),yaw,segment:{roadWidthM:7}})});
  assert.ok(result.changed);
  for(const p of [result.points[0],result.points.at(-1)])assert.ok(Math.abs(project(p).lateral-side*11)<1e-8);
 }
});

test('mirroring a streetlight reverses cropped UVs without moving its geometry',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=Object.create(RaceEditor.prototype);
 editor.getRaceDoodadForScenery=()=>({heightM:8});
 editor.getRaceDoodadVisualLayout=()=>({widthM:4,heightM:8,groundOffsetM:0,u0:.2,u1:.8,v0:.1,v1:.9});
 editor.sampleRaceDoodadGroundPoint=(x,z)=>({x,z,elevation:0});
 const normal=editor.getRaceDoodadWorldQuad({x:8,z:20,yaw:.5}),mirrored=editor.getRaceDoodadWorldQuad({x:8,z:20,yaw:.5,flipX:true});
 assert.deepEqual(mirrored.points.map(({u,...p})=>p),normal.points.map(({u,...p})=>p));
 assert.deepEqual(mirrored.points.map(p=>p.u),[.8,.2,.2,.8]);
});
