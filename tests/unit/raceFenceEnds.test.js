import test from 'node:test';import assert from 'node:assert/strict';
import {flareRoadsideFenceEnds,buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
const roadside={project:p=>({distance:p.z,lateral:p.x}),pose:d=>({x:0,z:d,yaw:0,segment:{roadWidthM:7}})};
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
