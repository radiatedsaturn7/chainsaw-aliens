import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {racingLineTrack} from '../fixtures/racingLineTrack.js';
import {buildRaceAiRoadPlan,getRaceAiPlannedSpeed} from '../../src/racing/RaceAiRoadPlan.js';
import {sampleRaceRacingLine} from '../../src/racing/RaceRacingLine.js';
import {prepareRaceAiRoadPlan} from '../../src/racing/RaceAiDirector.js';
import {planRaceAiDriving} from '../../src/racing/RaceAiDriving.js';
import {createRaceAiSurfaceProbe} from '../../src/racing/RaceAiSurfaceProbe.js';
import {buildRaceGuideArrows,drawRaceDrivingAssistHud} from '../../src/racing/RaceDrivingGuideRenderer.js';
import {updateRaceDrivingAssists} from '../../src/racing/RaceDrivingAssists.js';
import {analyzeRaceRecce} from '../../src/racing/RaceRecce.js';
const planFor=t=>buildRaceAiRoadPlan(t.editor,{routeLength:t.length,runtimeType:'destination'});

test('optimized path uses outside entry, inside apex and outside exit in both directions',()=>{
 for(const sign of [-1,1]){
  const t=racingLineTrack({angle:sign*Math.PI/2}),p=planFor(t);assert.ok(p.racingLine);
  assert.ok(sampleRaceRacingLine(p,t.entry-25).offset*sign<-2);
  assert.ok(sampleRaceRacingLine(p,(t.entry+t.end)/2).offset*sign>2);
  assert.ok(sampleRaceRacingLine(p,t.end+25).offset*sign<-2);
  assert.ok(Math.max(...p.curvature)<1/t.radius*.85,'actual path curvature, not an inflated speed hint');
  for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.racingLine.offsets[i])+p.racingLine.vehicleWidth/2+p.racingLine.margin<=p.halfWidth[i]+1e-8);
 }
});
test('optimized curvature delays braking while low grip and brake damage still lower the limit',()=>{
 const t=racingLineTrack(),p=planFor(t);
 const center={...p,racingLine:null,curvature:p.centerCurvature,segmentLength:null,profiles:new Map()};
 const firstBrake=plan=>{for(let d=0;d<t.end;d++)if(getRaceAiPlannedSpeed(plan,d,30,7,7)<29)return d;};
 assert.ok(firstBrake(p)>firstBrake(center)+5,`${firstBrake(p)} vs ${firstBrake(center)}`);
 const d=t.entry-20,dry=getRaceAiPlannedSpeed(p,d,30,7,7);
 assert.ok(getRaceAiPlannedSpeed(p,d,30,3,3)<dry);assert.ok(getRaceAiPlannedSpeed(p,d,30,7,2)<dry);
});
test('hairpins, narrow roads and roadside apex objects keep vehicle clearance',()=>{
 for(const width of [3.5,8]){
  const t=racingLineTrack({radius:12,angle:Math.PI,width}),p=planFor(t);assert.ok(p.racingLine);
  assert.ok(p.curvature.every(Number.isFinite));
  assert.ok(p.racingLine.offsets.every((o,i)=>o>=p.racingLine.lower[i]-1e-8&&o<=p.racingLine.upper[i]+1e-8));
 }
 const t=racingLineTrack(),at=(t.entry+t.end)/2,pose=t.pose(at),base=planFor(t),before=sampleRaceRacingLine(base,at);
 t.editor.selectedRace.scenery=[{id:'apex-rock',presetId:'doodad',x:pose.x+Math.cos(pose.yaw)*5,z:pose.z-Math.sin(pose.yaw)*5,previewDoodad:{widthM:2}}];
 const constrained=sampleRaceRacingLine(planFor(t),at);assert.ok(constrained.offset<before.offset-.5);
});
test('closed circuit path and steering are continuous at the finish seam',()=>{
 const radius=35,length=2*Math.PI*radius;
 const editor={getRaceWorldPoseAtDistance:d=>({x:radius*(1-Math.cos(d/radius)),z:radius*Math.sin(d/radius),yaw:d/radius}),getRaceRoadHalfWidthWorld:()=>5};
 const p=buildRaceAiRoadPlan(editor,{routeLength:length,runtimeType:'circuit'});assert.ok(p.racingLine);
 const a=sampleRaceRacingLine(p,length-.01),b=sampleRaceRacingLine(p,.01);
 assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.04);assert.ok(Math.abs(Math.atan2(Math.sin(a.yaw-b.yaw),Math.cos(a.yaw-b.yaw)))<.01);
});
test('guide, AI steering and surface choices follow the same optimized apex with engine lateral signs',()=>{
 const t=racingLineTrack(),e=t.editor,p=prepareRaceAiRoadPlan(e),distance=t.entry+10;
 const position=sampleRaceRacingLine(p,distance),ai={worldX:position.x,worldZ:position.z,carYaw:position.yaw,projectedDistance:distance,speedMps:12,lineOffset:0};
 const controls=planRaceAiDriving(e,ai,{wheelbaseM:2.65,widthM:1.8});
 const target=sampleRaceRacingLine(p,distance+controls.lookahead);
 assert.ok(Math.hypot(controls.targetX-target.x,controls.targetZ-target.z)<.12,'AI must not mirror the line through the center');
 const probe=createRaceAiSurfaceProbe(e,e.playtestSession,t.length),surfaceTarget=probe(distance+controls.lookahead,0);
 assert.ok(Math.hypot(surfaceTarget.x-target.x,surfaceTarget.z-target.z)<.12);
 Object.assign(e.playtestSession,{distance,speedMps:12,drivingAssists:{active:true,plan:p}});
 const arrows=buildRaceGuideArrows(e);assert.ok(arrows.length>0);
 const firstDistance=Math.ceil((distance+8)/8)*8+2,tip=arrows[0].points[1],expected=sampleRaceRacingLine(p,firstDistance);
 assert.ok(Math.hypot(tip.x-expected.x,tip.z-expected.z)<1e-8);
});
test('turn analysis remains available with pace notes disabled while the optional HUD stays hidden',()=>{
 const t=racingLineTrack(),e=t.editor;e.selectedRace.codriver={enabled:false};
 e.raceInput={paused:false};e.getRaceSessionCar=()=>null;e.getRaceCarTuning=()=>({});
 Object.assign(e.playtestSession,{distance:0,worldX:0,worldZ:0,speedMps:5,codriverCalls:analyzeRaceRecce(e)});
 updateRaceDrivingAssists(e,.016);assert.ok(e.playtestSession.drivingAssists.upcomingTurn);
 const text=[],ctx=new Proxy({fillText:t=>text.push(t)},{get:(o,k)=>o[k]||(()=>{})});
 drawRaceDrivingAssistHud(e,ctx,{x:0,y:0,w:390,h:844});
 assert.deepEqual(text,[]);
 e.playtestSession.distance=t.length;updateRaceDrivingAssists(e,.016);text.length=0;drawRaceDrivingAssistHud(e,ctx,{x:0,y:0,w:390,h:844});assert.equal(text.length,0);
});
test('pace-note left/right agrees with the actual Three camera rather than the opposite lateral convention',()=>{
 const t=racingLineTrack(),note=analyzeRaceRecce(t.editor)[0];
 const camera=new THREE.PerspectiveCamera(58,1,.1,500);camera.position.set(0,2,t.entry-20);camera.lookAt(0,2,t.entry+20);camera.updateMatrixWorld(true);
 const apex=t.pose((t.entry+t.end)/2),projected=new THREE.Vector3(apex.x,0,apex.z).project(camera);
 assert.ok(projected.x<0);assert.equal(note.direction,'Left');
});
