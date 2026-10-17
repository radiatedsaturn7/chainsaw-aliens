import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { recoverUpsideDownRaceAi } from '../../src/racing/RaceAiSimulation.js';
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
