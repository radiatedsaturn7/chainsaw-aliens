import { getRaceAiDirector } from '../../src/racing/RaceAiDirector.js';
import {RACE_THREE_ELEVATION_M} from '../../src/racing/simulation/RaceSimulationConfig.js';
import {createMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { recoverUpsideDownRaceAi, waitForRaceAiRecovery } from '../../src/racing/RaceAiSimulation.js';
import { quaternionFromEuler, rotateVectorByQuaternion } from '../../src/racing/simulation/RigidBodyMath.js';
import { VehicleDynamicsWorkerAuthority } from '../../src/racing/simulation/VehicleDynamicsWorkerAuthority.js';

function fixture() {
 const e=new RaceEditor({},{mode:'race'});
 e.selectedRace.road.segments=[{length:1200,curve:0,elevation:0,surface:'asphalt',roadWidthM:10,hazardIds:[]}];
 e.selectedRace.road.nodes=[];e.selectedRace.hazards=[];e.selectedRace.scenery=[];
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});e.playtestSession.countdownRemainingMs=0;
 const car=e.selectedCar,tuning=e.getRaceCarTuning(car);
 const ai={id:'recovery',carId:car.id,runtimeCar:car,worldX:0,worldZ:60,carYaw:0,
  speedMps:0,projectedDistance:60,distance:60,gear:1,rpm:800,lap:2,currentLapMs:1234,
  engineDrive:{throttle:0,brake:0},difficulty:'hard'};
 e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/120});
 return {e,ai,car,tuning};
}
const invert=state=>{state.orientation=quaternionFromEuler({roll:Math.PI});};

test('sustained inverted AI resets through the real authority and resumes driving without changing player or lap',()=>{
 const {e,ai,car,tuning}=fixture(),runner=ai.vehicleDynamicsRunner;
 const player=JSON.stringify([e.playtestSession.worldX,e.playtestSession.worldZ,e.playtestSession.carYaw,e.playtestSession.gear,e.playtestSession.vehicleRenderState]);
 invert(runner.state);
 for(let i=0;i<14;i++)assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:0.1}),false);
 runner.state.position.y=4;
 e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:0.11});
 assert.equal(ai.lastVehicleResetReason,'ai-upside-down');
 assert.ok(rotateVectorByQuaternion({x:0,y:1,z:0},runner.state.orientation).y>0.9);
 assert.ok(Math.abs(runner.state.position.x)<0.01);
 assert.ok(Math.abs(runner.state.position.z-60)<0.01);
 assert.ok(Math.hypot(...Object.values(runner.state.velocity))<0.001);
 assert.equal(ai.vehicleRenderState.resetGeneration,ai.vehicleResetGeneration);
 assert.equal(ai.automaticVehicleResetCount,1);assert.equal(ai.lap,2);assert.equal(ai.currentLapMs,1234);
 assert.equal(JSON.stringify([e.playtestSession.worldX,e.playtestSession.worldZ,e.playtestSession.carYaw,e.playtestSession.gear,e.playtestSession.vehicleRenderState]),player);
 ai.engineDrive={throttle:0.5,brake:0};
 for(let i=0;i<120;i++)e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
 assert.ok(ai.speedMps>0.5,`AI must leave reset hold: ${ai.speedMps}`);
 assert.ok(ai.worldZ>60.2);assert.equal(ai.automaticVehicleResetCount,1);
});

test('ordinary banking, brief inversion and zero simulation time do not reset AI',()=>{
 const {e,ai,car,tuning}=fixture(),state=ai.vehicleDynamicsRunner.state;
 state.orientation=quaternionFromEuler({roll:1});
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:3}),false);
 invert(state);assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1}),false);
 state.orientation=quaternionFromEuler({roll:0});recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:0.1});
 invert(state);assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1}),false);
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:0}),false);
 assert.equal(ai.automaticVehicleResetCount,undefined);
});

test('worker AI recovery addresses only that vehicle, waits for acknowledgment and resets real worker state',()=>{
 const {e,ai,car,tuning}=fixture(),runner=ai.vehicleDynamicsRunner;
 const authority=new VehicleDynamicsWorkerAuthority({runners:[{id:'opponent',runner}]});
 ai.workerVehicleId='opponent';ai.vehicleRenderState={orientation:quaternionFromEuler({roll:Math.PI}),resetGeneration:0};
 let requests=0,reset;
 e.vehicleDynamicsAuthority={workerBridge:{resetVehicle(state,id,session,reason){
  requests++;assert.equal(id,'opponent');assert.equal(session,ai);assert.equal(reason,'ai-upside-down');
  reset=authority.resetVehicle(id,state,{sequence:7,reason});return 7;
 }}};
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),true);
 for(let i=0;i<20;i++)recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:0.1});
 assert.equal(requests,1,'stale inverted snapshot must not flood worker resets');
 ai.vehicleRenderState=reset.renderState;
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:0.1}),false);
 assert.equal(ai.upsideDownResetPending,null);
 assert.ok(rotateVectorByQuaternion({x:0,y:1,z:0},runner.state.orientation).y>0.9);
 assert.equal(reset.resetGeneration,7);
});

test('a rejected reset is retried after another dwell instead of crashing the AI loop',()=>{
 const {e,ai,car,tuning}=fixture();invert(ai.vehicleDynamicsRunner.state);
 const original=ai.vehicleDynamicsRunner.resetAuthoritativeState.bind(ai.vehicleDynamicsRunner);
 ai.vehicleDynamicsRunner.resetAuthoritativeState=()=>{throw Error('no support')};
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),false);
 assert.equal(ai.lastUpsideDownResetError,'no support');
 ai.vehicleDynamicsRunner.resetAuthoritativeState=original;
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),true);
 assert.equal(ai.lastUpsideDownResetError,null);
});

test('failed static support tries a clear position behind instead of retrying the same point',()=>{
 const {e,ai,car,tuning}=fixture();invert(ai.vehicleDynamicsRunner.state);
 const original=ai.vehicleDynamicsRunner.resetAuthoritativeState.bind(ai.vehicleDynamicsRunner);
 const positions=[];
 ai.vehicleDynamicsRunner.resetAuthoritativeState=(state,options)=>{
  positions.push({...state.position});
  if(state.position.z>55)throw Error('Unable to converge static vehicle support');
  return original(state,options);
 };
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),false);
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),true);
 assert.equal(positions[0].z,60);assert.equal(positions[1].z,52);
 assert.equal(ai.upsideDownRecoveryAttempt,0);
 assert.equal(ai.lap,2);
 assert.ok(ai.vehicleDynamicsRunner.state.position.z<60,'recovery must not award forward progress');
});

test('recovery avoids occupied road positions and waits another dwell',()=>{
 const {e,ai,car,tuning}=fixture();invert(ai.vehicleDynamicsRunner.state);
 e.playtestSession.aiRuntime=[ai,{worldX:0,worldZ:60}];
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),false);
 assert.equal(ai.lastUpsideDownResetError,'Recovery location occupied');
 assert.equal(ai.automaticVehicleResetCount,undefined);
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),true);
 assert.equal(ai.vehicleDynamicsRunner.state.position.z,52);
});

test('upright AI below the road recovers through authority without replenishing fuel or damage',()=>{
 const {e,ai,car,tuning}=fixture(),runner=ai.vehicleDynamicsRunner;
 runner.state.position.y=-12;
 runner.state.mechanical=createMechanicalState({}, {}, {fuelTankGallons:12,mpg:25});
 runner.state.mechanical.fuel=.42;
 const fuel=runner.state.mechanical.fuel;
 const damage=JSON.stringify(runner.state.damage);
 const pose=e.getRaceWorldPoseAtDistance(60);
 const options={car,tuning,seconds:.5,contactState:{pose}};
 assert.equal(recoverUpsideDownRaceAi(e,ai,options),false);
 assert.equal(recoverUpsideDownRaceAi(e,ai,options),true);
 assert.equal(ai.lastVehicleResetReason,'ai-below-road');
 assert.ok(runner.state.position.y>-1);
 assert.equal(runner.state.mechanical.fuel,fuel);
 assert.equal(JSON.stringify(runner.state.damage),damage);
 assert.equal(ai.lap,2);
 assert.ok(ai.vehicleRenderState.resetGeneration>0);
});

test('failed below-road reset retries at a bounded cadence rather than every physics update',()=>{
 const {e,ai,car,tuning}=fixture(),runner=ai.vehicleDynamicsRunner;
 runner.state.position.y=-12;
 let attempts=0;
 runner.resetAuthoritativeState=()=>{attempts++;throw Error('No valid road support');};
 const pose=e.getRaceWorldPoseAtDistance(60);
 for(let i=0;i<100;i++)recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:.1,contactState:{pose}});
 assert.ok(attempts>=2&&attempts<=3,`expected bounded retries, got ${attempts}`);
 assert.equal(ai.automaticVehicleResetCount,undefined);
 assert.equal(ai.lastUpsideDownResetError,'No valid road support');
});

test('recovery contact queries carry the road altitude instead of searching from sea level',()=>{
 const {e,ai,car,tuning}=fixture();invert(ai.vehicleDynamicsRunner.state);
 const getPose=e.getRaceWorldPoseAtDistance.bind(e);
 e.getRaceWorldPoseAtDistance=(d,o)=>({...getPose(d,o),elevation:-200});
 let height;
 const getContact=e.getRaceWheelContactState.bind(e);
 e.getRaceWheelContactState=options=>{height=options.session.heightM;return getContact(options);};
 ai.vehicleDynamicsRunner.resetAuthoritativeState=()=>{throw Error('Test stops before changing physical terrain');};
 recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5});
 assert.ok(height<0);
 assert.equal(height,-200*RACE_THREE_ELEVATION_M);
});

test('normal AI update invokes the stuck watchdog and the real reset authority',()=>{
 const {e,ai,car,tuning}=fixture();
 e.playtestSession.worldZ=-500;
 ai.drivingPlan={targetSpeedMps:2.4,steeringAngleRad:0};
 ai.engineDrive={throttle:.18,brake:0};
 // Model an immovable contact solver: the real update still prepares controls,
 // publishes the stationary state and must invoke authoritative recovery.
 ai.vehicleDynamicsRunner.advance=()=>({});
 for(let i=0;i<81;i++)e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:.1});
 assert.equal(ai.lastVehicleResetReason,'ai-stuck');
 assert.equal(ai.automaticVehicleResetCount,1);
 assert.equal(ai.lap,2);
 assert.ok(ai.vehicleRenderState.resetGeneration>0);
});


test('rejected equilibrium retries grounded road support without restoring resources',()=>{
 const {e,ai,car,tuning}=fixture(),runner=ai.vehicleDynamicsRunner;
 invert(runner.state);
 runner.state.mechanical=createMechanicalState({}, {}, {fuelTankGallons:12,mpg:25});
 runner.state.mechanical.fuel=.42;
 const damage=JSON.stringify(runner.state.damage);
 const reset=runner.resetAuthoritativeState.bind(runner);
 let calls=0;
 runner.resetAuthoritativeState=(state,options)=>{
   calls++;
   if(calls===1)throw Error('Unable to converge static vehicle support');
   return reset(state,options);
 };
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),false);
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),true);
 assert.equal(calls,2);
 assert.equal(runner.state.grounded,true);
 assert.equal(runner.state.mechanical.fuel,.42);
 assert.equal(JSON.stringify(runner.state.damage),damage);
 assert.equal(ai.recoveryWait,null);
 for(let i=0;i<180;i++)e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
 assert.ok(runner.state.grounded,'real suspension must settle on terrain');
 assert.ok(Math.abs(runner.state.rollRad)<.1);
 assert.equal(ai.lap,2);
});

test('failed distant recovery waits without advancing physics and wakes when the player approaches',()=>{
 const {e,ai,car,tuning}=fixture();
 e.playtestSession.worldZ=-500;
 ai.recoveryWait={seconds:4,reason:'ai-stuck'};
 const before=ai.vehicleDynamicsRunner.stepIndex;
 let resets=0;
 ai.vehicleDynamicsRunner.resetAuthoritativeState=()=>{resets++;throw Error('No valid support');};
 for(let i=0;i<30;i++)assert.equal(waitForRaceAiRecovery(e,ai,.1,car,tuning),true);
 assert.equal(resets,0);assert.equal(ai.vehicleDynamicsRunner.stepIndex,before);
 for(let i=0;i<11;i++)waitForRaceAiRecovery(e,ai,.1,car,tuning);
 assert.equal(resets,1);
 assert.ok(ai.recoveryWait.seconds>3);
 e.playtestSession.worldZ=50;
 assert.equal(waitForRaceAiRecovery(e,ai,.1,car,tuning),false);
 assert.equal(ai.recoveryWait,null);
});

test('worker static-support rejection retries grounded support after acknowledgment timeout',()=>{
 const {e,ai,car,tuning}=fixture();
 ai.workerVehicleId='opponent';
 ai.vehicleRenderState={orientation:quaternionFromEuler({roll:Math.PI}),resetGeneration:0};
 const commands=[];
 const bridge={client:{},resetVehicle(state){commands.push(state);return commands.length;}};
 e.vehicleDynamicsAuthority={workerBridge:bridge};
 recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5});
 bridge.client.lastError={requestType:'resetVehicle',vehicleId:'opponent',message:'Unable to converge static vehicle support'};
 recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1});
 assert.equal(commands.length,1,'do not flood an unacknowledged reset');
 recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:2});
 assert.equal(commands.length,2);
 assert.equal(commands[1].grounded,true);
 assert.ok(commands[1].position.z<commands[0].position.z);
});


test('road reset rejects a stable terrain wheel and searches a different road pose',()=>{
 const {e,ai,car,tuning}=fixture(),runner=ai.vehicleDynamicsRunner;
 const provider=runner.environmentProvider;
 runner.environmentProvider=request=>{
   const env=provider(request),sample=env.sampleTerrainAtWorldPoint;
   return {...env,sampleTerrainAtWorldPoint:(point,...args)=>{
     const result=sample(point,...args);
     // One side of the original destination has fallen away to terrain.
     return point.z>55 && point.x>0 ? {...result,region:'terrain'} : result;
   }};
 };
 invert(runner.state);
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5}),false);
 assert.match(ai.lastUpsideDownResetError,/all four wheels/);
 const recovered = recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1.5});
 assert.equal(recovered,true,ai.lastUpsideDownResetError);
 assert.ok(runner.state.position.z<55,'must move back to a fully supported road section');
 assert.equal(runner.state.supportedWheelCount,4);
 for(const patch of Object.values(runner.state.contactPatches)) {
   assert.equal(patch.validTreadContact,true);
   assert.ok(patch.normalLoadN>1);
 }
});

test('AI returns to its last verified road pose rather than repeatedly trying the crash location',async()=>{
 const {getRaceRecoveryHistoryCandidates}=await import('../../src/racing/RaceRecoveryHistory.js');
 const {e,ai,car,tuning}=fixture();
 for(let i=0;i<120;i++)e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
 const safe=getRaceRecoveryHistoryCandidates(ai)[0];assert.ok(safe,'AI records supported road history');
 const runner=ai.vehicleDynamicsRunner;
 runner.state.position.z+=35;ai.worldZ+=35;ai.distance+=35;ai.projectedDistance+=35;
 invert(runner.state);
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:2}),true);
 assert.ok(Math.abs(runner.state.position.z-safe.verifiedRoadPose.position.z)<1e-6);
 assert.ok(rotateVectorByQuaternion({x:0,y:1,z:0},runner.state.orientation).y>.8);
 assert.equal(runner.state.supportedWheelCount,4);
});

test('inverted recovery respects the shared reset budget without losing the request',()=>{
 const {e,ai,car,tuning}=fixture();invert(ai.vehicleDynamicsRunner.state);
 const director=getRaceAiDirector(e);director.recoveryAttemptsThisUpdate=1;
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:2}),false);
 assert.equal(ai.recoveryRetryReason,'ai-upside-down');
 assert.equal(ai.automaticVehicleResetCount,undefined);
 director.recoveryAttemptsThisUpdate=0;
 assert.equal(recoverUpsideDownRaceAi(e,ai,{car,tuning,seconds:1/60}),true);
 assert.equal(director.recoveryAttemptsThisUpdate,1);
 assert.equal(ai.recoveryRetryReason,null);
 assert.ok(rotateVectorByQuaternion({x:0,y:1,z:0},ai.vehicleDynamicsRunner.state.orientation).y>.8);
});
