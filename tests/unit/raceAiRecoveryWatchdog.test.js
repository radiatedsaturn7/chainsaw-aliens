import test from 'node:test';
import assert from 'node:assert/strict';
import {observeRaceAiRecovery as observe} from '../../src/racing/RaceAiRecoveryWatchdog.js';
function fixture(){return {ai:{drivingPlan:{targetSpeedMps:10},engineDrive:{throttle:1,brake:0}},
 session:{worldX:0,worldZ:0},state:{position:{x:200,y:0,z:0},mechanical:{engineRunning:true,components:{}}}};}
test('upright below-road car triggers timed recovery and cannot flood reset requests',()=>{
 const {ai,session,state}=fixture();const opts={roadHeightM:10,onRoadCorridor:true};
 assert.equal(observe(ai,session,state,.9,opts),null);
 assert.equal(observe(ai,session,state,.11,opts),'ai-below-road');
 for(let i=0;i<39;i++)assert.equal(observe(ai,session,state,.1,opts),null);
 assert.equal(observe(ai,session,state,.2,opts),'ai-below-road');
});
test('normal lower terrain, a brief fall, nearby cars, queues and mechanical failures do not trigger stuck recovery',()=>{
 for(const kind of ['off-corridor','brief','near','queue','broken','moving']) {
  const {ai,session,state}=fixture();const opts={roadHeightM:10,onRoadCorridor:false};
  if(kind==='near')state.position.x=5;
  if(kind==='queue')ai.engineDrive={throttle:0,brake:1};
  if(kind==='broken')state.mechanical.components.engine={failed:true};
  for(let i=0;i<100;i++){
   if(kind==='off-corridor'||kind==='brief'||kind==='moving')state.position.z+=1;
   opts.onRoadCorridor=kind==='brief'&&i<5;
   assert.equal(observe(ai,session,state,.1,opts),null,kind);
  }
 }
});
test('far stalled driving is based on actual position and a director may defer one attempt without losing its timer',()=>{
 const {ai,session,state}=fixture();
 for(let i=0;i<90;i++)assert.equal(observe(ai,session,state,.1,{canAttempt:false}),null);
 assert.equal(observe(ai,session,state,.1,{canAttempt:true}),'ai-stuck');
 state.position.z+=1;
 assert.equal(observe(ai,session,state,5),null);
 for(const seconds of [0,-1,Infinity,NaN])assert.equal(observe(ai,session,state,seconds),null);
});

test('low throttle recovery covers a stalled car trying to crawl uphill',()=>{
 const {ai,session,state}=fixture();ai.engineDrive.throttle=.18;ai.drivingPlan.targetSpeedMps=2.4;
 for(let i=0;i<79;i++)assert.equal(observe(ai,session,state,.1),null);
 assert.equal(observe(ai,session,state,.2),'ai-stuck');
 assert.equal(ai.recoveryWatchdog.attempting,true);
});
