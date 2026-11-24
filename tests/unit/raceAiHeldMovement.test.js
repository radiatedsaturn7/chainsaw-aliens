import test from 'node:test';
import assert from 'node:assert/strict';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';
import {syncVehicleDynamicsCompatibilityOutputs} from '../../src/racing/simulation/VehicleState.js';
import {advanceRaceAiDistantPhysics,holdRaceAiCheapPhysics,restoreRaceAiDetailedPhysics} from '../../src/racing/RaceAiDistantPhysics.js';
import {shouldRetryRaceAiCheap,tryRecoverRaceAiCheap} from '../../src/racing/RaceAiCheapRecovery.js';
import {createRaceAiTrafficProbe} from '../../src/racing/RaceAiTrafficBounds.js';
const wheels=['fl','fr','rl','rr'],dt=1/60;
const tuning={wheelbaseM:2.6,widthM:1.8};
const contacts=(region='road')=>({averageHeightM:0,terrainPitchRad:0,terrainRollRad:0,
 contacts:Object.fromEntries(wheels.map(id=>[id,{valid:true,region:id==='fr'?region:'road',normal:{x:0,y:1,z:0},heightM:0}]))});
function car(id,x,z,yaw){
 const r=new VehicleDynamicsRunner({config:{bodyWidthM:1.8,bodyLengthM:4.5},
 initialState:{position:{x,y:.55,z},orientation:quaternionFromEuler({yaw}),yawRad:yaw,grounded:true,gear:1}});
 const ai={id,vehicleDynamicsRunner:r,physicsBudgetDetail:'cheap',distance:z,projectedDistance:z,
 engineDrive:{throttle:.4,brake:0},drivingPlan:{steeringAngleRad:0,targetSpeedMps:5},rpm:1500,gear:1};
 syncVehicleDynamicsCompatibilityOutputs(r,ai);return ai;
}
function editor(cars){
 const world={querySweptAabb:()=>[]};
 return {playtestSession:{worldX:0,worldZ:0,aiRuntime:cars,routeLength:1000,routeRuntimeType:'destination'},
 vehicleDynamicsAuthority:{raceEnvironmentProviderContext:{staticColliderWorld:world},staticColliderWorldCache:{world}},
 getRaceWorldPoseAtDistance:d=>({x:200,z:d,yaw:0,segment:{}}),getRaceRoadHalfWidthWorld:()=>6,
 getRaceWheelContactState:()=>contacts(),getRaceWeatherState:()=>({id:'clear'})};
}
function step(e,ai){
 if(!shouldRetryRaceAiCheap(ai,dt)){holdRaceAiCheapPhysics(e,ai,dt);return false;}
 if(ai.cheapPhysicsHeld)tryRecoverRaceAiCheap(e,ai,{car:{},tuning});
 // A driver continues to request forward acceleration; the real movement,
 // hold, retry and recovery functions decide whether that motion is allowed.
 ai.engineDrive={throttle:.4,brake:0};
 const ok=advanceRaceAiDistantPhysics(e,ai,{car:{},tuning,contactState:{contacts:contacts(),averageSurfaceGrip:1},
 physics:{speedMps:ai.speedMps+.5*dt},seconds:dt});
 if(!ok)holdRaceAiCheapPhysics(e,ai,dt);
 else ai.distance=ai.projectedDistance=ai.worldZ;
 return ok;
}

test('separate angled AI cars accelerate out of a conservative traffic overlap without teleporting',()=>{
 const yaw=.4,a=car('a',200,20,yaw),b=car('b',200+Math.cos(yaw)*2,20-Math.sin(yaw)*2,yaw),e=editor([a,b]);
 assert.equal(createRaceAiTrafficProbe(a,a.worldX,a.worldZ,a.carYaw,0,{clearance:0})(b),false);
 const before=[a,b].map(c=>({x:c.worldX,z:c.worldZ}));
 for(let i=0;i<120;i++){
  e.playtestSession.cheapRecoveryAttempted=false;step(e,a);step(e,b);
  assert.equal(createRaceAiTrafficProbe(a,a.worldX,a.worldZ,a.carYaw,0,{clearance:0})(b),false);
 }
 for(const [i,c] of [a,b].entries()){
  assert.ok(c.speedMps>.5);assert.ok(Math.hypot(c.worldX-before[i].x,c.worldZ-before[i].z)>.5);
  assert.equal(c.cheapRecoveryCount||0,0);assert.equal(c.cheapPhysicsHeld,false);
 }
});
test('level road-edge contacts advance continuously without terrain holds or repositioning',()=>{
 for(const region of ['margin','shoulder','transition']) {
 const a=car('edge',202,20,0),e=editor([a]);
 e.getRaceWheelContactState=()=>contacts(region);
 for(let i=0;i<7*60;i++){
  e.playtestSession.cheapRecoveryAttempted=false;
  const previousX=a.worldX;
  assert.equal(step(e,a),true);
  assert.ok(Math.abs(a.worldX-previousX)<.02);assert.equal(a.cheapRecoveryCount||0,0);
 }
 assert.ok(a.worldZ>25);
 }
});
test('road-edge permission does not bypass missing support, real steps, steep banks or off-road contacts',()=>{
 for(const mode of ['missing','step','bank','off-road','all-transition']){
  const a=car('edge',202,20,0),e=editor([a]);
  e.getRaceWheelContactState=()=>{
   const c=contacts('transition');
   if(mode==='missing')c.contacts.fr.valid=false;
   if(mode==='step')c.contacts.fr.heightM=.2;
   if(mode==='bank')c.contacts.fr.normal={x:.8,y:.6,z:0};
   if(mode==='off-road')c.contacts.fr.region='terrain';
   if(mode==='all-transition')for(const w of wheels)c.contacts[w].region='transition';
   return c;
  };
  assert.equal(step(e,a),false,mode);assert.equal(a.worldZ,20,mode);
 }
});
test('tight traffic check still rejects actual current and swept body collisions',()=>{
 for(const gap of [0,1]){
  const a=car('a',200,20,.4),b=car('b',200,20+gap,.4),e=editor([a,b]);
  assert.equal(step(e,a),false);assert.equal(a.worldZ,20);
  assert.ok(['traffic','traffic-overlap'].includes(a.distantPhysicsReason));
 }
});

test('Red Bull capture: physical recovery promotions cannot starve distant road recovery',async(t)=>{
 const {assignRaceAiPhysicsBudget}=await import('../../src/racing/RaceAiPhysicsBudget.js');
 const a=car('mica',200,479,-2.775),e=editor([a]);
 // Capture at 31s: stopped sideways, then alternating two-second holds
 // and one-second physical escape attempts that move only centimetres.
 a.distantPhysicsReason='terrain-step';
 let recoveredAt=null,promotions=0;
 for(let i=0;i<12*60;i++){
  e.playtestSession.cheapRecoveryAttempted=false;
  assignRaceAiPhysicsBudget(e.playtestSession,{seconds:dt});
  shouldRetryRaceAiCheap(a,dt);
  if(a.physicsBudgetDetail==='full'){
   if(a.simulationDetail==='distant')promotions++;
   restoreRaceAiDetailedPhysics(e,a);
   a.engineDrive={throttle:.239,brake:0};
  }else{
   if(tryRecoverRaceAiCheap(e,a,{car:{},tuning})){recoveredAt=i*dt;break;}
   holdRaceAiCheapPhysics(e,a,dt);
  }
 }
 assert.ok(promotions>0,'give physical escape a chance first');
 assert.ok(recoveredAt!==null&&recoveredAt<8,`still stuck after ${recoveredAt??12}s`);
 t.diagnostic(`Recovered after ${recoveredAt.toFixed(2)} simulated seconds`);
 assert.equal(a.carYaw,0,'recover aligned with the road');
 for(let i=0;i<120;i++)step(e,a);
 assert.ok(a.worldZ>479.5,'resumes driving after recovery');
});

test('blocked high-speed lane merge holds its lane instead of stopping a clear side-by-side car',()=>{
 const a=car('a',200,40,0),b=car('b',201.83,40,0),e=editor([a,b]);
 a.lineOffset=-.5;a.speedMps=20;a.drivingPlan.targetSpeedMps=25;
 const ok=advanceRaceAiDistantPhysics(e,a,{car:{},tuning,contactState:{contacts:contacts(),averageSurfaceGrip:1},
  physics:{speedMps:20},seconds:dt});
 assert.equal(ok,true);assert.equal(a.distantPhysicsReason,'route');
 assert.ok(a.speedMps>19);assert.ok(a.worldZ>40);
 assert.ok(Math.abs(a.worldX-200)<1e-9,'blocked merge must preserve the current lane');
 assert.equal(createRaceAiTrafficProbe(a,a.worldX,a.worldZ,a.carYaw,0,{clearance:0})(b),false);
});
