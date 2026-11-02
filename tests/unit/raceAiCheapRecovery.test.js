import test from 'node:test';
import assert from 'node:assert/strict';
import {tryRecoverRaceAiCheap,shouldRetryRaceAiCheap} from '../../src/racing/RaceAiCheapRecovery.js';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
function fixture(){
 const runner=new VehicleDynamicsRunner({initialState:{worldX:200,worldZ:20,heightM:.55}});
 const ai={id:'stuck',worldX:200,worldZ:20,carYaw:0,projectedDistance:20,lap:2,
  vehicleDynamicsRunner:runner,physicsBudgetDetail:'cheap',cheapPhysicsHeld:true,cheapHeldSeconds:4,distantPhysicsReason:'unsupported-pose'};
 const contacts={averageHeightM:0,terrainPitchRad:0,terrainRollRad:0,contacts:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{valid:true,region:'road'}]))};
 const e={playtestSession:{worldX:0,worldZ:0,aiRuntime:[ai]},vehicleDynamicsAuthority:{staticColliderWorldCache:{world:null}},
  getRaceWorldPoseAtDistance:d=>({x:200,z:d,yaw:0}),getRaceWheelContactState:()=>contacts};
 return {e,ai,runner,contacts};
}
test('distant held car recovers with bounded road checks, retaining mechanics and time',()=>{
 const {e,ai,runner}=fixture();runner.state.rollRad=3;runner.observedTimeSeconds=12;
 const mechanical=structuredClone(runner.state.mechanical);
 assert.equal(tryRecoverRaceAiCheap(e,ai,{car:{},tuning:{}}),true);
 assert.equal(ai.cheapPhysicsHeld,false);assert.equal(runner.state.rollRad,0);
 assert.equal(runner.observedTimeSeconds,12);assert.equal(ai.lap,2);
 assert.deepEqual(runner.state.mechanical,mechanical);
 assert.equal(ai.cheapRecoveryCount,1);
});
test('queues, nearby cars, occupied roads and unsupported candidates do not teleport',()=>{
 for(const mode of ['queue','near','traffic','ground','scenery']){
  const {e,ai,runner,contacts}=fixture();let probes=0;
  e.getRaceWorldPoseAtDistance=d=>{probes++;return {x:200,z:d,yaw:0};};
  if(mode==='queue')ai.distantPhysicsReason='traffic';
  if(mode==='near')e.playtestSession.worldX=195;
  if(mode==='ground')contacts.contacts.fl.region='grass';
  if(mode==='scenery')e.vehicleDynamicsAuthority.staticColliderWorldCache.world={querySweptAabb:()=>[{}]};
  if(mode==='traffic')e.playtestSession.aiRuntime.push(...[20,14,8].map(z=>({worldX:200,worldZ:z,carYaw:0})));
  const pose={...runner.state.position};
  assert.equal(tryRecoverRaceAiCheap(e,ai,{car:{},tuning:{}}),false,mode);
  assert.deepEqual(runner.state.position,pose);assert.ok(probes<=3);
  if(probes){assert.equal(tryRecoverRaceAiCheap(e,ai,{car:{},tuning:{}}),false);assert.equal(probes,3);}
 }
});
test('held retries are bounded in simulation time and promotion is immediate',()=>{
 const {ai}=fixture();let retries=0;
 for(let i=0;i<100;i++)if(shouldRetryRaceAiCheap(ai,.05))retries++;
 assert.equal(retries,5);
 ai.distantPhysicsReason='traffic';retries=0;
 for(let i=0;i<100;i++)if(shouldRetryRaceAiCheap(ai,.05))retries++;
 assert.equal(retries,20);
 ai.physicsBudgetDetail='full';assert.equal(shouldRetryRaceAiCheap(ai,.001),true);
});
