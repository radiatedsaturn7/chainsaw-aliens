import test from 'node:test';
import assert from 'node:assert/strict';
import {canUseRaceAiDistantPhysics,advanceRaceAiDistantPhysics,restoreRaceAiDetailedPhysics,getReusableRaceAiDistantContacts} from '../../src/racing/RaceAiDistantPhysics.js';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {syncVehicleDynamicsCompatibilityOutputs} from '../../src/racing/simulation/VehicleState.js';
import {createMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
const wheels=['fl','fr','rl','rr'];
function fixture(){
 const runner=new VehicleDynamicsRunner({initialState:{worldX:200,worldZ:0,heightM:.55,speedMps:10,gear:2,engineRpm:2500}});
 runner.state.mechanical=createMechanicalState({}, {}, {fuelTankGallons:12,mpg:25});
 const ai={id:'far',vehicleDynamicsRunner:runner,engineDrive:{throttle:.5,brake:0},drivingPlan:{steeringAngleRad:0},rpm:2500,gear:2};
 syncVehicleDynamicsCompatibilityOutputs(runner,ai);
 const contacts={averageHeightM:0,terrainPitchRad:0,terrainRollRad:0,
  contacts:Object.fromEntries(wheels.map(id=>[id,{valid:true,region:'road'}]))};
 const editor={playtestSession:{worldX:0,worldZ:0,aiRuntime:[ai],routeRuntimeType:'destination'},
  vehicleDynamicsAuthority:{raceEnvironmentProviderContext:{staticColliderWorld:{querySweptAabb:()=>[]}}},
  getRaceWheelContactState:()=>contacts,getRaceWeatherState:()=>({id:'storm'})};
 const options={car:{},tuning:{wheelbaseM:2.6},contactState:{contacts,averageSurfaceGrip:.7},physics:{speedMps:10},seconds:1/60};
 return {runner,ai,editor,options};
}
test('distant AI moves continuously, preserves race state and returns to full physics with speed and clock intact',()=>{
 const {runner,ai,editor,options}=fixture();ai.lap=3;ai.currentLapMs=1234;
 const fuel=runner.state.mechanical.fuel;
 for(let i=0;i<120;i++) assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),true);
 assert.ok(Math.abs(ai.worldZ-20)<1e-8);
 assert.ok(Math.abs(ai.worldX-200)<1e-8);
 assert.equal(ai.lap,3);assert.equal(ai.currentLapMs,1234);
 assert.ok(runner.state.mechanical.tick>=19);
 assert.ok(runner.state.mechanical.fuel<fuel);
 assert.equal(runner.stepIndex,240);
 const snapshot=runner.createStateSnapshot(),oldPosition={...snapshot.position};
 restoreRaceAiDetailedPhysics(editor,ai);
 assert.notEqual(ai.vehicleDynamicsRunner,runner);
 assert.deepEqual(ai.vehicleDynamicsRunner.state.position,oldPosition);
 assert.equal(ai.speedMps,10);
 assert.equal(ai.vehicleDynamicsRunner.stepIndex,240);
 assert.deepEqual(ai.vehicleDynamicsRunner.state.mechanical,snapshot.mechanical);
 assert.equal(ai.simulationDetail,'full');
});
test('distance hysteresis and unsafe physical states retain detailed physics',()=>{
 const {ai,editor,options,runner}=fixture();
 editor.playtestSession.worldX=185;
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 ai.simulationDetail='distant';assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),true);
 editor.playtestSession.worldX=190;assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 editor.playtestSession.worldX=0;
 for(const [key,value] of [['grounded',false],['rollRad',.5],['bodyLateralSpeedMps',2]]){
  const old=runner.state[key];runner.state[key]=value;
  assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
  runner.state[key]=old;
 }
 runner.state.mechanical.components.radiator.failed=true;
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
});
test('obstacles, traffic, missing support and road steps reject cheap integration without moving the car',()=>{
 for(const type of ['obstacle','traffic','unsupported','step','worker','no-colliders']){
  const {ai,editor,options}=fixture();const before={...ai.vehicleDynamicsRunner.state.position};
  if(type==='obstacle') editor.vehicleDynamicsAuthority.raceEnvironmentProviderContext.staticColliderWorld.querySweptAabb=()=>[{}];
  if(type==='traffic') editor.playtestSession.aiRuntime.push({worldX:200,worldZ:2});
  if(type==='unsupported') editor.getRaceWheelContactState=()=>({contacts:{},averageHeightM:null});
  if(type==='step') editor.getRaceWheelContactState=()=>({...options.contactState.contacts,averageHeightM:1});
  if(type==='worker') editor.vehicleDynamicsAuthority.workerBridge={};
  if(type==='no-colliders') editor.vehicleDynamicsAuthority={};
  assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),false,type);
  assert.deepEqual(ai.vehicleDynamicsRunner.state.position,before,type);
 }
});

test('real editor AI advances in distant mode then resumes the full runner near the player',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const e=new RaceEditor({},{mode:'race'});
 e.selectedRace.road.network.nodes[1].z=1500;
 e.selectedRace.road.network.edges[0].widthM=12;
 e.selectedRace.road.network.finishNodeId='end';
 e.selectedRace.road.nodes=[];
 e.selectedRace.road.segments=[{length:1500,curve:0,elevation:0,surface:'asphalt',roadWidthM:12,hazardIds:[]}];
 e.selectedRace.hazards=[];e.selectedRace.scenery=[];
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const session=e.playtestSession;
 Object.assign(session,{countdownRemainingMs:0,startupFramePending:false,preparing:false,running:true,launchLockMs:0});
 if(session.raceIntro)session.raceIntro.active=false;
 e.updatePlaytest(1/60);
 const car=e.selectedCar,tuning=e.getRaceCarTuning(car);
 const pose=e.getRaceWorldPoseAtDistance(200);
 const ai={id:'distant-integration',carId:car.id,runtimeCar:car,worldX:pose.x,worldZ:pose.z??pose.y,carYaw:pose.yaw,
  speedMps:5,projectedDistance:200,distance:200,gear:1,rpm:2200,lap:1,currentLapMs:0,
  engineDrive:{throttle:.5,brake:0},difficulty:'hard',lineOffset:0};
 e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
 const nearby=Array.from({length:4},(_,i)=>{
  const d=20+i*15,p=e.getRaceWorldPoseAtDistance(d);
  return {...ai,id:`near-${i}`,worldX:p.x,worldZ:p.z??p.y,carYaw:p.yaw,distance:d,projectedDistance:d,
    vehicleDynamicsRunner:null,engineDrive:{throttle:.5,brake:0}};
 });
 session.aiRuntime=[...nearby,ai];
 let distantFrames=0;
 for(let i=0;i<120;i++){
  e.updateRaceAiDrivers(1/60);
  if(ai.simulationDetail==='distant')distantFrames++;
 }
 assert.ok(distantFrames>60,`expected distant model; saw ${distantFrames} frames`);
 assert.ok(ai.distance>205,`opponent must progress: ${JSON.stringify({distance:ai.distance,worldX:ai.worldX,worldZ:ai.worldZ,pose,routeLength:session.routeLength,speed:ai.speedMps,projection:e.getRaceRouteProjectionForWorldPoint({x:ai.worldX,z:ai.worldZ,heightM:ai.heightM})})}`);
 assert.ok(ai.currentLapMs>1999 && ai.currentLapMs<2001);
 const before={x:ai.worldX,z:ai.worldZ,speed:ai.speedMps,step:ai.vehicleDynamicsRunner.stepIndex};
 session.worldX=ai.worldX;session.worldZ=ai.worldZ-10;
 e.updateRaceAiDrivers(1/60);
 assert.equal(ai.simulationDetail,'full');
 assert.ok(Math.hypot(ai.worldX-before.x,ai.worldZ-before.z)<1,'no promotion teleport');
 assert.ok(ai.speedMps>before.speed*.7,'no promotion stop');
 assert.ok(ai.vehicleDynamicsRunner.stepIndex>before.step,'physics clock advances');
});

test('fast closing traffic is promoted early and small abrupt road steps retain collision physics',()=>{
 const {ai,runner,editor,options}=fixture();ai.simulationDetail='distant';
 editor.playtestSession.worldX=120;
 editor.playtestSession.velocityX=40;
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 editor.playtestSession.worldX=0;editor.playtestSession.velocityX=0;
 editor.getRaceWheelContactState=()=>({...options.contactState.contacts,averageHeightM:.1});
 const before={...runner.state.position};
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),false);
 assert.deepEqual(runner.state.position,before);
});


test('distant contact reuse requires the exact same pose, baked world and track state',()=>{
 const {ai,editor,options}=fixture();
 const bake={},track={};
 editor.playtestSession.worldBake=bake;editor.playtestSession.trackState=track;
 options.contactState.contacts.surfaceSamples={};
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),true);
 assert.equal(getReusableRaceAiDistantContacts(editor,ai),options.contactState.contacts);
 ai.vehicleDynamicsRunner.state.position.x+=1;
 assert.equal(getReusableRaceAiDistantContacts(editor,ai),null);
 ai.vehicleDynamicsRunner.state.position.x-=1;
 editor.playtestSession.worldBake={};
 assert.equal(getReusableRaceAiDistantContacts(editor,ai),null);
 editor.playtestSession.worldBake=bake;editor.playtestSession.trackState={};
 assert.equal(getReusableRaceAiDistantContacts(editor,ai),null);
 editor.playtestSession.trackState=track;
 restoreRaceAiDetailedPhysics(editor,ai);
 assert.equal(ai.distantContactState,null,'promotion invalidates the old cheap contact record');
 assert.equal(getReusableRaceAiDistantContacts(editor,ai),null);
 ai.simulationDetail='distant';
 assert.equal(getReusableRaceAiDistantContacts(editor,ai),null);
});

test('a distant supported stopped queue ignores tiny rollback without skipping mechanical time',()=>{
 const {ai,editor,options,runner}=fixture();
 ai.speedMps=-.2;ai.drivingPlan.targetSpeedMps=0;ai.engineDrive={throttle:0,brake:1};
 options.physics.speedMps=0;
 editor.playtestSession.aiRuntime.push({worldX:ai.worldX,worldZ:ai.worldZ+2});
 editor.vehicleDynamicsAuthority.raceEnvironmentProviderContext.staticColliderWorld.querySweptAabb=()=>[{}];
 const before={x:ai.worldX,z:ai.worldZ},time=runner.observedTimeSeconds;
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),true);
 assert.equal(ai.speedMps,0);assert.equal(ai.worldX,before.x);assert.equal(ai.worldZ,before.z);
 assert.ok(runner.observedTimeSeconds>time);
 // Real reversing, attempting to drive, and near-player queues stay physical.
 ai.speedMps=-1;assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 ai.speedMps=-.2;ai.drivingPlan.targetSpeedMps=5;
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 ai.drivingPlan.targetSpeedMps=0;editor.playtestSession.worldX=ai.worldX-5;
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
});

test('far road-following yields before traffic without full physics and resumes after it clears',()=>{
 const {ai,editor,options,runner}=fixture();ai.distance=0;ai.drivingPlan.targetSpeedMps=10;
 editor.getRaceWorldPoseAtDistance=d=>({x:200,z:d,yaw:0,segment:{}});
 editor.getRaceRoadHalfWidthWorld=()=>6;
 editor.playtestSession.aiRuntime.push({worldX:200,worldZ:(runner.config.bodyLengthM+4.5)/2+.05,speedMps:0});
 const before={x:ai.worldX,z:ai.worldZ},mechanical=runner.state.mechanical;
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),true);
 assert.equal(ai.distantPhysicsReason,'route-yield');assert.equal(ai.speedMps,0);
 assert.equal(ai.worldX,before.x);assert.equal(ai.worldZ,before.z);
 assert.equal(ai.vehicleDynamicsRunner,runner);assert.equal(runner.state.mechanical,mechanical);
 editor.playtestSession.aiRuntime.pop();
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),true);
 assert.equal(ai.distantPhysicsReason,'route');assert.ok(ai.worldZ>before.z);
});
test('smooth steep uphill motion is distinguished from an abrupt terrain step',()=>{
 const {ai,editor,options,runner}=fixture();ai.speedMps=30;options.physics.speedMps=30;options.seconds=.05;
 for(const contact of Object.values(options.contactState.contacts.contacts))contact.normal={x:0,y:1,z:-.2};
 editor.getRaceWheelContactState=()=>({...options.contactState.contacts,averageHeightM:.3,terrainPitchRad:.2});
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),true);
 assert.ok(Math.abs(runner.state.position.y-(.3+runner.config.cgHeightM))<1e-8);
});


test('far leader can leave conservative rear clearance while real overlap requests collision resolution',()=>{
 for(const overlap of [false,true]) {
  const {ai,editor,options,runner}=fixture();ai.distance=0;ai.drivingPlan.targetSpeedMps=10;
  editor.getRaceWorldPoseAtDistance=d=>({x:200,z:d,yaw:0,segment:{}});
  editor.getRaceRoadHalfWidthWorld=()=>6;
  const halfLengths=(runner.config.bodyLengthM+4.5)/2;
  editor.playtestSession.aiRuntime.push({id:'rear',worldX:200,worldZ:-halfLengths+(overlap?.1:-.1),speedMps:0});
  const moved=advanceRaceAiDistantPhysics(editor,ai,options);
  if(overlap) {
   assert.equal(moved,false);assert.equal(ai.distantPhysicsReason,'traffic-overlap');
   assert.equal(ai.distantTrafficBlocker,'rear');assert.equal(ai.worldZ,0);
  } else {
   assert.equal(moved,true);assert.equal(ai.distantPhysicsReason,'route');assert.ok(ai.worldZ>0);
  }
 }
});

test('a crawl-speed leader defers merging into a follower and takes the collision-clear straight path',()=>{
 const {ai,editor,options,runner}=fixture();
 ai.distance=0;ai.lineOffset=.5;ai.speedMps=0;ai.carYaw=0;
 runner.state.velocity={x:0,y:0,z:0};runner.state.speedMps=0;
 ai.drivingPlan.targetSpeedMps=10;options.physics.speedMps=1;options.seconds=.05;
 editor.getRaceWorldPoseAtDistance=d=>({x:200,z:d,yaw:0,segment:{}});
 editor.getRaceRoadHalfWidthWorld=()=>6;
 editor.playtestSession.aiRuntime.push({id:'rear',worldX:198.195,worldZ:-3.5,carYaw:0,speedMps:0});
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),true);
 assert.equal(ai.distantPhysicsReason,'route');
 assert.equal(ai.worldX,200,'defer the blocked sideways movement');
 assert.ok(ai.worldZ>0,'move into verified forward clearance');
 assert.equal(ai.distantTrafficBlocker,null);
});


test('promotion retains the queued collision impulse instead of swallowing the player hit',()=>{
 const {runner,ai,editor,options}=fixture();
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),true);
 runner.queueCollisionImpulse({impulseWorldNs:{x:1500,y:0,z:0},source:'player'});
 const pending=structuredClone(runner.pendingCollisionImpulses);
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 restoreRaceAiDetailedPhysics(editor,ai);
 assert.deepEqual(ai.vehicleDynamicsRunner.pendingCollisionImpulses,pending);
 assert.notEqual(ai.vehicleDynamicsRunner.pendingCollisionImpulses,runner.pendingCollisionImpulses);
});

test('steady convoy can simplify at a safe gap but closing, turning and close contact retain full physics',()=>{
 const {ai,editor,options,runner}=fixture();
 Object.assign(editor.playtestSession,{worldX:200,worldZ:-11,carYaw:0,speedMps:10,
  velocityX:0,velocityZ:10,grounded:true});
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),true);
 editor.playtestSession.worldZ=-6;
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 editor.playtestSession.worldZ=-11;editor.playtestSession.velocityZ=15;
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 editor.playtestSession.velocityZ=10;editor.playtestSession.yawVelocityRadps=.5;
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
 editor.playtestSession.yawVelocityRadps=0;runner.pendingCollisionImpulses.push({});
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,1/60),false);
});

test('budgeted cheap cars yield safely instead of escalating physics and resume when obstacle clears',async()=>{
 const {holdRaceAiCheapPhysics}=await import('../../src/racing/RaceAiDistantPhysics.js');
 const {ai,editor,options,runner}=fixture();ai.physicsBudgetDetail='cheap';
 editor.playtestSession.worldX=195; // proximity cannot defeat the budget
 editor.vehicleDynamicsAuthority.raceEnvironmentProviderContext.staticColliderWorld.querySweptAabb=()=>[{}];
 const pose={...runner.state.position};
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),false);
 holdRaceAiCheapPhysics(editor,ai,.05);
 assert.deepEqual(runner.state.position,pose);assert.equal(ai.speedMps,0);
 assert.equal(runner.observedTimeSeconds,.05);assert.equal(ai.cheapPhysicsHeld,true);
 editor.vehicleDynamicsAuthority.raceEnvironmentProviderContext.staticColliderWorld.querySweptAabb=()=>[];
 editor.playtestSession.worldX=190;
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,{...options,physics:{speedMps:.1}}),true);
 assert.equal(ai.cheapPhysicsHeld,false);assert.ok(ai.worldZ>pose.z);
});

test('budgeted full cars never take cheap path, and demotion does not snap an overturned car upright',()=>{
 const {ai,editor,options,runner}=fixture();ai.physicsBudgetDetail='full';
 assert.equal(canUseRaceAiDistantPhysics(editor,ai,options.contactState,.05),false);
 ai.physicsBudgetDetail='cheap';runner.state.rollRad=2;
 const before=runner.createStateSnapshot();
 assert.equal(advanceRaceAiDistantPhysics(editor,ai,options),false);
 assert.deepEqual(runner.state.position,before.position);
 assert.deepEqual(runner.state.orientation,before.orientation);
});

