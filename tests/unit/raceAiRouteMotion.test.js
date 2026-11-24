import test from 'node:test';
import assert from 'node:assert/strict';
import {getRaceAiDirector} from '../../src/racing/RaceAiDirector.js';
import {getRaceAiRouteMotion} from '../../src/racing/RaceAiRouteMotion.js';
const pose=s=>({x:280-80*Math.cos(s/80),z:80*Math.sin(s/80),yaw:s/80,segment:{}});
function fixture(){
 const editor={playtestSession:{debugAiNoRoadPlan:true,worldX:0,worldZ:0,routeLength:1000,routeRuntimeType:'destination'},
 getRaceWorldPoseAtDistance:pose,getRaceRoadHalfWidthWorld:()=>6};
 const ai={worldX:200,worldZ:0,carYaw:0,distance:0,lineOffset:0};
 return {editor,ai,options:{tuning:{widthM:2},averageSpeed:15,seconds:.05}};
}
test('far trajectory follows a sustained bend without accumulating steering error',()=>{
 const {editor,ai,options}=fixture();
 for(let i=0;i<200;i++){
  const before={x:ai.worldX,z:ai.worldZ};
  const result=getRaceAiRouteMotion(editor,ai,options);assert.ok(result);
  ai.distance+=options.averageSpeed*options.seconds;
  ai.worldX=result.x;ai.worldZ=result.z;ai.carYaw=result.yaw;
  const expected=pose(ai.distance);
  assert.ok(Math.hypot(ai.worldX-expected.x,ai.worldZ-expected.z)<1e-8);
  assert.ok(Math.hypot(ai.worldX-before.x,ai.worldZ-before.z)<=.751);
 }
});
test('lane changes begin at the physical position and have a bounded lateral rate',()=>{
 const {editor,ai,options}=fixture();ai.worldX+=2;ai.lineOffset=.5;
 const result=getRaceAiRouteMotion(editor,ai,options);assert.ok(result);
 const next=pose(.75);
 const offset=(result.x-next.x)*Math.cos(next.yaw)-(result.z-next.z)*Math.sin(next.yaw);
 assert.ok(Math.abs(offset-1.96)<1e-8);
});
test('near-player, wrong-branch, off-road and reverse-facing cars never snap onto the route',()=>{
 for(const mode of ['near','branch','off-road','reverse','disabled','gap']){
  const {editor,ai,options}=fixture();
  if(mode==='near')editor.playtestSession.worldX=190;
  if(mode==='branch')ai.worldZ=30;
  if(mode==='off-road')ai.worldX+=20;
  if(mode==='reverse')ai.carYaw=Math.PI;
  if(mode==='disabled')editor.playtestSession.debugAiBicycleOnly=true;
  if(mode==='gap')editor.getRaceWorldPoseAtDistance=s=>({...pose(s),x:200+(s>0?100:0)});
  assert.equal(getRaceAiRouteMotion(editor,ai,options),null,mode);
 }
});

test('crawl launch preserves projection residual instead of jumping back into the queue',()=>{
 const {editor,ai,options}=fixture();
 editor.getRaceWorldPoseAtDistance=d=>({x:200,z:d,yaw:0,segment:{}});
 ai.worldZ=.1;options.averageSpeed=.02;options.seconds=.05;
 const moved=getRaceAiRouteMotion(editor,ai,options);
 assert.ok(moved);
 assert.ok(Math.abs(moved.z-.101)<1e-10,'advance 1 mm from the real pose, not 99 mm backwards');
 assert.equal(moved.x,ai.worldX);
});

test('crawl launch cannot rotate in place toward a lane and sweep into a clear follower',()=>{
 const {editor,ai,options}=fixture();
 editor.getRaceWorldPoseAtDistance=d=>({x:200,z:d,yaw:0,segment:{}});
 ai.carYaw=.2;ai.lineOffset=.5;
 options.averageSpeed=.02;options.seconds=.05;
 const moved=getRaceAiRouteMotion(editor,ai,options);
 assert.ok(moved);
 assert.ok(Math.abs(moved.yaw-ai.carYaw)<.001,'1 mm of travel cannot rotate a car by degrees');
 assert.ok(moved.z>ai.worldZ);
});

test('deferring a merge holds lateral position along the bend instead of driving straight off it',()=>{
 const {editor,ai,options}=fixture();ai.worldX=202;ai.lineOffset=.5;
 const moved=getRaceAiRouteMotion(editor,ai,{...options,holdLane:true});
 const next=pose(.75);
 const lateral=-(moved.x-next.x)*Math.cos(next.yaw)+(moved.z-next.z)*Math.sin(next.yaw);
 assert.ok(Math.abs(lateral+2)<1e-8);
 assert.ok(moved.z>ai.worldZ);
});

test('distant motion follows the same offset racing line as detailed steering',()=>{
 const {editor,ai,options}=fixture();
 editor.getRaceWorldPoseAtDistance=d=>({x:200,z:d,yaw:0,segment:{}});
 const points=[0,1000].map(z=>({x:202,z,yaw:0,offset:2,elevation:0}));
 editor.playtestSession.debugAiNoRoadPlan=false;
 getRaceAiDirector(editor).planPrepared=true;
 getRaceAiDirector(editor).plan={count:2,step:1000,length:1000,circuit:false,
  halfWidth:[6,6],racingLine:{points,centers:points.map(p=>({...p,x:200}))}};
 const result=getRaceAiRouteMotion(editor,ai,options);
 assert.ok(result.x>200,'move toward optimized line, not center');
 assert.ok(result.x<=200.04+1e-8,'retain bounded lateral motion');
 ai.worldX=202;
 const settled=getRaceAiRouteMotion(editor,ai,options);
 assert.ok(Math.abs(settled.x-202)<1e-8,'do not pull a car off its racing line before promotion');
});

test('distant cars continue along authored road after the timing line',()=>{
 const {editor,ai,options}=fixture();
 editor.selectedRace={road:{autoExtend:false,continuations:{finish:[{offset:137}]}}};
 ai.distance=1000;Object.assign(ai,{worldX:pose(1000).x,worldZ:pose(1000).z,carYaw:pose(1000).yaw,physicsBudgetDetail:'cheap'});
 const result=getRaceAiRouteMotion(editor,ai,options);assert.ok(result);
 const expected=pose(1000.75);
 assert.ok(Math.hypot(result.x-expected.x,result.z-expected.z)<1e-8);
});
