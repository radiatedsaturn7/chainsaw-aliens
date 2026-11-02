import test from 'node:test';
import assert from 'node:assert/strict';
import {getRaceAiRouteMotion} from '../../src/racing/RaceAiRouteMotion.js';
const pose=s=>({x:280-80*Math.cos(s/80),z:80*Math.sin(s/80),yaw:s/80,segment:{}});
function fixture(){
 const editor={playtestSession:{worldX:0,worldZ:0,routeLength:1000,routeRuntimeType:'destination'},
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
