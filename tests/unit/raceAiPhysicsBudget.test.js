import test from 'node:test';
import assert from 'node:assert/strict';
import {assignRaceAiPhysicsBudget} from '../../src/racing/RaceAiPhysicsBudget.js';
import {consumeRaceAiSimulationStep} from '../../src/racing/RaceAiScheduling.js';

test('exactly three nearest world positions receive physics, independent of camera and route progress',()=>{
 const session={worldX:0,worldZ:0,aiRuntime:Array.from({length:30},(_,i)=>({id:i,worldX:i*10,worldZ:0,distance:1000-i}))};
 assignRaceAiPhysicsBudget(session);
 assert.deepEqual(session.aiRuntime.filter(a=>a.physicsBudgetDetail==='full').map(a=>a.id),[0,1,2]);
 session.worldX=290;assignRaceAiPhysicsBudget(session);
 assert.deepEqual(session.aiRuntime.filter(a=>a.physicsBudgetDetail==='full').map(a=>a.id),[27,28,29]);
 assert.equal(session.aiDetailedPhysicsCount,3);assert.equal(session.aiCheapPhysicsCount,27);
 session.aiRuntime.splice(2);assignRaceAiPhysicsBudget(session);assert.equal(session.aiDetailedPhysicsCount,2);
});
test('equal-distance ties are stable and a dense grid never expands the budget',()=>{
 const session={worldX:0,worldZ:0,aiRuntime:Array.from({length:30},(_,i)=>({id:i,worldX:1,worldZ:1}))};
 assignRaceAiPhysicsBudget(session);session.aiRuntime.reverse();assignRaceAiPhysicsBudget(session);
 assert.deepEqual(session.aiRuntime.filter(a=>a.physicsBudgetDetail==='full').map(a=>a.id).sort(),[0,1,2]);
 const cheap=session.aiRuntime[0];cheap.vehicleDynamicsRunner={pendingCollisionImpulses:[{}]};
 consumeRaceAiSimulationStep(cheap,session,1/60,0);
 assert.equal(cheap.simulationPipelineHz,20,'nearby traffic does not promote every cheap car');
});

test('real 30-car race runs at most three full vehicle solvers and the cheap fleet still advances',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const e=new RaceEditor({},{mode:'race'});
 e.selectedRace.road.network.nodes[1].z=2000;
 e.selectedRace.road.network.edges[0].widthM=12;
 e.selectedRace.road.network.finishNodeId='end';
 e.selectedRace.road.nodes=[];
 e.selectedRace.road.segments=[{length:2000,curve:0,elevation:0,surface:'asphalt',roadWidthM:12,hazardIds:[]}];
 e.selectedRace.hazards=[];e.selectedRace.scenery=[];
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const session=e.playtestSession;
 Object.assign(session,{countdownRemainingMs:0,startupFramePending:false,preparing:false,running:true,launchLockMs:0});
 if(session.raceIntro)session.raceIntro.active=false;
 e.updatePlaytest(1/60);
 const car=e.selectedCar;
 session.aiRuntime=Array.from({length:30},(_,i)=>{
  const distance=20+i*20,pose=e.getRaceWorldPoseAtDistance(distance);
  return {id:`budget-${i}`,carId:car.id,runtimeCar:car,worldX:pose.x,worldZ:pose.z??pose.y,carYaw:pose.yaw,
   speedMps:5,projectedDistance:distance,distance,gear:1,rpm:2200,lap:1,currentLapMs:0,
   engineDrive:{throttle:.5,brake:0},difficulty:'hard',lineOffset:0};
 });
 const update=e.updateRaceAiVehiclePhysics.bind(e);let active=new Set(),fullCalls=0;
 e.updateRaceAiVehiclePhysics=(ai,options)=>{
  if(options.seconds>0){active.add(ai.id);fullCalls++;assert.equal(ai.physicsBudgetDetail,'full');}
  return update(ai,options);
 };
 for(let i=0;i<90;i++){
  active.clear();e.updateRaceAiDrivers(1/60);assert.ok(active.size<=3);
 }
 assert.equal(fullCalls,270);
 for(let i=3;i<30;i++){
  const ai=session.aiRuntime[i];
  assert.equal(ai.simulationDetail,'distant');
  assert.ok(ai.distance>20+i*20+1,`cheap car ${i} did not progress: ${ai.distantPhysicsReason}`);
  assert.ok(ai.vehicleDynamicsRunner.observedTimeSeconds>1.4);
 }
 // Standing countdown also obeys the budget, without rolling the cheap fleet.
 const before=session.aiRuntime.slice(3).map(a=>({x:a.worldX,z:a.worldZ}));
 active.clear();e.updateRaceAiDrivers(1/60,{preStartMode:'standing'});assert.equal(active.size,3);
 session.aiRuntime.slice(3).forEach((a,i)=>assert.deepEqual({x:a.worldX,z:a.worldZ},before[i]));
});
