import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRefreshRaceAiSurfacePlan } from '../../src/racing/RaceAiScheduling.js';
function simulate(hz, distance) {
  const ai={worldX:distance,worldZ:0},s={worldX:0,worldZ:0,trackState:{}};
  let count=0;
  for(let i=0;i<hz*10;i++) {
    if(shouldRefreshRaceAiSurfacePlan(ai,s,1/hz)) count++;
    ai.trackStateLineDecision={chosenOffset:0};
  }
  return count;
}
test('surface plan schedule follows simulated time at 30, 60 and 120 FPS',()=>{
  for(const distance of [10,100,300]) {
    const counts=[30,60,120].map(hz=>simulate(hz,distance));
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1,JSON.stringify(counts));
  }
  assert.ok(simulate(60,10)>simulate(60,100));
  assert.ok(simulate(60,100)>simulate(60,300));
  assert.ok(simulate(60,300)<=21);
});
test('approaching traffic and replaced track state force immediate reconsideration',()=>{
  const ai={worldX:300,worldZ:0},s={worldX:0,worldZ:0,trackState:{}};
  assert.equal(shouldRefreshRaceAiSurfacePlan(ai,s,1/60),true);
  ai.trackStateLineDecision={};
  assert.equal(shouldRefreshRaceAiSurfacePlan(ai,s,1/60),false);
  ai.worldX=20;
  assert.equal(shouldRefreshRaceAiSurfacePlan(ai,s,1/60),true);
  s.trackState={};
  assert.equal(shouldRefreshRaceAiSurfacePlan(ai,s,0),true);
  assert.equal(shouldRefreshRaceAiSurfacePlan(ai,{},1),false);
});
test('zero and negative time do not generate extra decisions; schedules are staggered',()=>{
  const s={worldX:0,worldZ:0,trackState:{}};
  const ais=Array.from({length:7},()=>({worldX:300,worldZ:0}));
  ais.forEach((ai,index)=>{
    shouldRefreshRaceAiSurfacePlan(ai,s,1/60,index);ai.trackStateLineDecision={};
    assert.equal(shouldRefreshRaceAiSurfacePlan(ai,s,-1,index),false);
    assert.equal(shouldRefreshRaceAiSurfacePlan(ai,s,0,index),false);
  });
  assert.equal(new Set(ais.map(ai=>ai.surfacePlanElapsed)).size,7);
});

import { consumeRaceAiSimulationStep } from '../../src/racing/RaceAiScheduling.js';
test('distant simulation batches elapsed time and staggers work without speeding or freezing cars', () => {
  for (const hz of [30, 60, 120]) {
    const session={worldX:0,worldZ:0,speedMps:10};
    const ais=Array.from({length:3},()=>({worldX:300,worldZ:0,speedMps:10}));
    const totals=[0,0,0],counts=[0,0,0],first=[];
    for(let frame=0;frame<hz*10;frame++) ais.forEach((ai,i)=>{
      const dt=consumeRaceAiSimulationStep(ai,session,1/hz,i);
      totals[i]+=dt;if(dt){counts[i]++;first[i]??=frame;}
      assert.ok(dt<=.067,'bounded batch');
    });
    ais.forEach((ai,i)=>{
      ai.worldX=5;totals[i]+=consumeRaceAiSimulationStep(ai,session,1/hz,i);
      assert.ok(Math.abs(totals[i]-(10+1/hz))<1e-10,'all accumulated time flushed near player');
      assert.ok(counts[i]<=201 && counts[i]>=149,'reduced updates');
    });
    if(hz===60)assert.equal(new Set(first).size,3);
  }
});
test('nearby, fast approaching, collision-pending and worker cars update immediately',()=>{
  for(const reason of ['near','fast','collision','worker','invalid']){
    const session={worldX:0,worldZ:0,speedMps:0};
    const ai={worldX:300,worldZ:0,speedMps:0};
    consumeRaceAiSimulationStep(ai,session,1/60,0);
    if(reason==='near')ai.worldX=10;
    if(reason==='fast'){session.speedMps=150;session.carYaw=Math.PI/2;}
    if(reason==='collision')ai.vehicleDynamicsRunner={pendingCollisionImpulses:[{}]};
    if(reason==='invalid')ai.worldX=NaN;
    assert.equal(consumeRaceAiSimulationStep(ai,session,1/60,0,{worker:reason==='worker'}),1/60,reason);
  }
});
test('paused and invalid durations do not advance scheduling; a fresh race discards old pending time',()=>{
 const ai={worldX:300,worldZ:0},session={worldX:0,worldZ:0};
 consumeRaceAiSimulationStep(ai,session,1/60,2);
 for(const dt of [0,-1,NaN,Infinity]) assert.equal(consumeRaceAiSimulationStep(ai,session,dt),0);
 assert.equal(consumeRaceAiSimulationStep(ai,{worldX:299,worldZ:0},1/60),1/60);
});

test('fast same-direction traffic remains reduced-rate when it is not approaching',()=>{
 const ai={worldX:0,worldZ:80,speedMps:60,carYaw:0};
 const session={worldX:0,worldZ:0,speedMps:60,carYaw:0};
 consumeRaceAiSimulationStep(ai,session,1/60,0);
 assert.equal(consumeRaceAiSimulationStep(ai,session,1/60,0),0);
 assert.equal(ai.simulationPipelineHz,20);
 session.speedMps=100;
 assert.ok(consumeRaceAiSimulationStep(ai,session,1/60,0)>0);
 assert.equal(ai.simulationPipelineHz,60);
});

test('a slow frame does not promote distant cars to full rate and queued time is retained',()=>{
 const ai={worldX:300,worldZ:0},session={worldX:0,worldZ:0};
 let total=consumeRaceAiSimulationStep(ai,session,.12,2);
 assert.equal(ai.simulationPipelineHz,20);assert.ok(total<=.05);
 ai.worldX=5;total+=consumeRaceAiSimulationStep(ai,session,.01,2);
 assert.ok(Math.abs(total-.13)<1e-10);
});

import {getRaceAiSurfaceObservationCache} from '../../src/racing/RaceAiScheduling.js';
import {evaluateRaceAiTrackStateCandidates} from '../../src/racing/trackState/TrackStateIntegration.js';
test('nearby AI share advisory cell observations until the next weather tick',()=>{
 let calls=0;const session={trackState:{stepIndex:4,cellSizeM:10,sample(){calls++;return {cellKey:'road',effectiveGrip:1,risk:0};}}};
 const run=()=>evaluateRaceAiTrackStateCandidates({trackState:session.trackState,observationCache:getRaceAiSurfaceObservationCache(session),getWorldPoint:()=>({x:1,z:1})});
 const first=run();for(let i=0;i<29;i++)assert.deepEqual(run(),first);
 assert.equal(calls,1);session.trackState.stepIndex++;run();assert.equal(calls,2);
 const other={trackState:{...session.trackState}};assert.notEqual(getRaceAiSurfaceObservationCache(other),getRaceAiSurfaceObservationCache(session));
});
