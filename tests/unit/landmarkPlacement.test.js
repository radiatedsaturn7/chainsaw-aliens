import test from 'node:test';
import assert from 'node:assert/strict';
import {roadClearance,landmarkRadius,chooseLandmarkPosition,rankLandmarkPositions,assertAdditiveRace,landmarkApproachYaw} from '../../tools/campaigns/landmarkPlacement.mjs';
const def={widthM:20,hitboxWidthM:20};
const line=(ax,az,bx,bz)=>({a:{x:ax,z:az},b:{x:bx,z:bz},halfWidth:3.5,samplingPaddingM:1});
test('square collider corners count, not just billboard half width',()=>{
 assert.equal(landmarkRadius(def),Math.SQRT2*10);
 assert.ok(roadClearance({x:16,z:0},def,[line(0,-100,0,100)])<0);
});
test('all crossing roads are checked even when the timed road looks clear',()=>{
 const segments=[line(0,-100,0,100),line(-1000,0,1000,0)];
 assert.ok(roadClearance({x:50,z:0},def,segments)<0);
 const p=chooseLandmarkPosition({routeDistanceM:0,offsetFromRoadM:30,side:'right',suggestedArtRef:'crossing'},def,{segments,poseAt:d=>({x:0,z:d,yaw:0})});
 assert.ok(p.routeDistanceM>=30);assert.ok(p.roadClearanceM>=5);
});
test('zero GPS offset is a reference, never an instruction to block road',()=>{
 const p=chooseLandmarkPosition({routeDistanceM:50,offsetFromRoadM:0,side:'left'},def,{segments:[line(0,-100,0,100)],poseAt:d=>({x:0,z:d,yaw:0})});
 assert.ok(p.lateralM<0);assert.ok(p.roadClearanceM>=5);
});
test('large GPS offset is brought into a candidate visible corridor, not blindly used',()=>{
 const p=chooseLandmarkPosition({routeDistanceM:50,offsetFromRoadM:646,side:'right'},def,{segments:[line(0,-100,0,100)],poseAt:d=>({x:0,z:d,yaw:0})});
 assert.equal(p.lateralM,100);
});
test('guard preserves all geometry, textures, existing scenery and properties',()=>{
 const a={road:{nodes:[{x:1,y:2}]},scenery:[{id:'old',x:2}],other:'kept'};
 const b=structuredClone(a);b.scenery.push({id:'new'});assertAdditiveRace(a,b,new Set(['new']));
 b.road.nodes[0].x++;assert.throws(()=>assertAdditiveRace(a,b,new Set(['new'])),/pre-existing/);
});

test('landmark lateral sign follows engine projection convention',()=>{
 const p=chooseLandmarkPosition({routeDistanceM:50,offsetFromRoadM:30,side:'left'},def,{segments:[line(0,-100,0,100)],poseAt:d=>({x:0,z:d,yaw:0})});
 assert.ok(p.x>0);assert.ok(p.lateralM<0);
});

test('review ranking stays a safe shortlist and avoids a different closest road branch',()=>{
 const mark={routeDistanceM:300,offsetFromRoadM:0,side:'left',suggestedArtRef:'test'};
 const context={segments:[line(0,-1000,0,1000)],scenery:[],poseAt:d=>({x:0,z:d,yaw:0}),project:p=>({distance:p.z,lateral:-p.x})};
 const a=rankLandmarkPositions(mark,def,context,{distanceOffsets:[0]});
 assert.ok(a.length>0);assert.ok(a.every(p=>p.roadClearanceM>=5 && p.lateralM<0));
 const custom=rankLandmarkPositions(mark,def,context,{approachOffsetsM:[85,105,195],occlusionWidthFactor:.75});
 assert.deepEqual(custom[0].views.map(v=>v.beforeM),[85,105,195]);
 assert.ok(a.every(p=>p.views.length===6));assert.ok(a[0].score>=a.at(-1).score);
 assert.throws(()=>rankLandmarkPositions(mark,def,{...context,project:()=>({distance:1000})}),/No safe ranked/);
});

test('approach-facing plane is perpendicular to the selected sightline',()=>{
 const prop={x:-518.369,z:-804.725},camera={x:-290.1295,z:-745.4151};
 const yaw=landmarkApproachYaw(prop,camera);
 assert.ok(Math.abs(Math.cos(yaw)*(prop.x-camera.x)-Math.sin(yaw)*(prop.z-camera.z))<1e-10);
 assert.ok(Math.abs(yaw+1.8250315)<1e-6);
});
