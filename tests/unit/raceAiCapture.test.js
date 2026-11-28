import test from 'node:test';
import assert from 'node:assert/strict';
import {captureRaceAi} from '../../src/racing/RaceAiCapture.js';
function fixture(){
 const ai={id:'rival',carId:'car-a',difficulty:'hard',skill:.8,lap:1,distance:980,
  awaitingStartLine:true,worldX:0,bodyY:.5,worldZ:-20,physicsBudgetDetail:'cheap',
  engineDrive:{throttle:.3,brake:0},drivingPlan:{targetSpeedMps:20,steeringAngleRad:.2}};
 return {selectedCar:{id:'player-car'},playtestSession:{routeRuntimeType:'circuit',routeLength:1000,
  lap:1,distance:2,worldX:0,bodyY:.5,worldZ:2,elapsedMs:100,aiRuntime:[ai]}};
}
test('AI capture distinguishes pre-start wrapped positions, lap gaps and physical distance',()=>{
 const e=fixture();let rows=captureRaceAi(e).cars;
 assert.equal(rows[1].progressM,-20);assert.equal(rows[1].gapAheadM,22);
 assert.equal(rows[1].distanceToPlayerM,22);assert.equal(rows[1].aheadId,'player');
 e.playtestSession.aiRuntime[0].awaitingStartLine=false;
 e.playtestSession.aiRuntime[0].distance=998;e.playtestSession.lap=2;
 rows=captureRaceAi(e).cars;
 assert.equal(rows[1].gapAheadM,4);assert.equal(rows[1].distanceToPlayerM,22);
 e.playtestSession.aiRuntime[0].distance=4;e.playtestSession.aiRuntime[0].lap=2;
 rows=captureRaceAi(e).cars;
 assert.equal(rows[0].aheadId,'rival');assert.equal(rows[0].gapAheadM,2);
 assert.equal(rows[1].progressRelativeToPlayerM,2);
});
test('destination start offsets and unknown progress are not invented as zero',()=>{
 const e=fixture();e.playtestSession.routeRuntimeType='destination';
 e.playtestSession.aiRuntime[0].distance=-12;
 assert.equal(captureRaceAi(e).cars[1].progressM,-12);
 delete e.playtestSession.aiRuntime[0].distance;
 const car=captureRaceAi(e).cars[1];assert.equal(car.progressM,null);assert.equal(car.gapAheadM,null);
 assert.equal(car.progressRank,null);
});
test('snapshots detach controls and wheel state and flag stale cheap-mode telemetry',()=>{
 const e=fixture(),ai=e.playtestSession.aiRuntime[0];
 ai.vehicleDynamicsRunner={state:{position:{x:1,y:2,z:3},velocity:{x:0,y:0,z:4},
  contactPatches:{fl:{normalLoadN:1234,overtravelM:.1}},suspensionState:{fl:{compressionM:.08}}}};
 const out=captureRaceAi(e,{detailed:true});
 ai.engineDrive.throttle=1;ai.vehicleDynamicsRunner.state.position.x=9;
 ai.vehicleDynamicsRunner.state.contactPatches.fl.normalLoadN=0;
 assert.equal(out.cars[1].position.x,1);assert.equal(out.cars[1].controls.throttle,.3);
 assert.equal(out.cars[1].wheels.fl.loadN,1234);assert.equal(out.cars[1].wheelTelemetryCurrent,false);
 assert.equal(captureRaceAi(e).cars[1].wheels,undefined);
 assert.doesNotThrow(()=>JSON.stringify(out));
});

test('worker snapshots prefer delivered state over stale local runners',()=>{
 const e=fixture();e.vehicleDynamicsAuthority={workerBridge:{}};
 const ai=e.playtestSession.aiRuntime[0];
 ai.vehicleDynamicsRunner={state:{position:{x:99,y:99,z:99}}};
 ai.vehicleDynamicsPresentationState={position:{x:1,y:2,z:3}};
 const row=captureRaceAi(e,{detailed:true}).cars[1];
 assert.deepEqual(row.position,{x:1,y:2,z:3});assert.equal(row.stateSource,'worker-presentation');
 assert.equal(row.wheelTelemetryCurrent,false);
});
