import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {planRaceAiControls,syncRaceAiPhysicalTireEffects} from '../../src/racing/RaceAiControls.js';

test('driver-only control decisions match the existing longitudinal model across acceleration, braking and gear changes',()=>{
 const e=new RaceEditor({});e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const car=e.selectedCar,tuning=e.getRaceCarTuning(car),profile=e.getRaceAiDifficultyProfile('hard');
 for(const speed of [0,12,30,50])for(const target of [0,20,60]){
  const ai={speedMps:speed,gear:3,rpm:2500,difficulty:'hard',worldX:0,worldZ:30,carYaw:0,distance:30,projectedDistance:30};
  const expected=planRaceAiControls(e,ai,tuning,target,profile);
  e.getRaceAiLongitudinalPhysicsStep(ai,{car,tuning,targetMps:target,profile,seconds:1/60});
  assert.equal(ai.engineDrive.throttle,expected.throttle);
  assert.equal(ai.engineDrive.brake,expected.brake);
  assert.equal(ai.gear,expected.gear);assert.equal(ai.rpm,expected.rpm);
  assert.equal(ai.engineDrive.automaticOverrevUpshifts,expected.automaticOverrevUpshifts);
 }
});
test('nearby AI runs authoritative physics without also executing the legacy force model',()=>{
 const e=new RaceEditor({});e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const s=e.playtestSession;s.countdownRemainingMs=0;
 const pose=e.getRaceWorldPoseAtDistance(15),car=e.selectedCar;
 const ai={id:'driver-only',runtimeCar:car,carId:car.id,worldX:pose.x,worldZ:pose.z,carYaw:pose.yaw,
  distance:15,projectedDistance:15,speedMps:0,gear:1,rpm:800,lap:1,currentLapMs:0,difficulty:'hard'};
 s.aiRuntime=[ai];e.getRaceAiLongitudinalPhysicsStep=()=>{throw Error('duplicate physical force calculation');};
 let presentationBody=null, suspension=null;
 for(let i=0;i<60;i++){
  s.worldX=ai.worldX;s.worldZ=ai.worldZ-10;
  e.updateRaceAiDrivers(1/60);
  if(i>0){
   assert.strictEqual(ai.vehicle3d,presentationBody,'reuse the full-physics presentation body');
   assert.strictEqual(ai.suspensionTravel,suspension,'reuse compatibility records');
  }
  presentationBody=ai.vehicle3d;suspension=ai.suspensionTravel;
 }
 assert.ok(ai.vehicleDynamicsRunner.stepIndex>=60);
 assert.ok(ai.speedMps>.1);
 assert.ok(Object.values(ai.engineDrive.dynamicNormalLoads).some(load=>load>1));
 assert.ok(Object.values(ai.tireTemperature).every(Number.isFinite));
});
test('physical surface effects use actual support, slip, braking and tire temperature',()=>{
 const ai={engineDrive:{throttle:.5,brake:1},vehicleDynamicsRunner:{config:{wheelRadiusM:.5},state:{
  validTreadContactByWheel:{fl:true,fr:false},contactPatches:{fl:{normalLoadN:1000,slipRatio:-.8,slipAngleRad:0},fr:{normalLoadN:0,slipRatio:2}},
  tireState:{fl:{temperatureF:150}},powertrainState:{telemetry:{appliedBrakeTorqueNm:{fl:100},wheelDriveTorqueNm:{fl:50}}}
 }}};
 syncRaceAiPhysicalTireEffects(ai);
 assert.equal(ai.engineDrive.dynamicNormalLoads.fl,1000);
 assert.equal(ai.engineDrive.combinedBrakeState.appliedByWheel.fl,200);
 assert.equal(ai.engineDrive.combinedBrakeState.lockByWheel.fl,.8);
 assert.equal(ai.engineDrive.tireSlipByWheel.fr,0);
 assert.equal(ai.engineDrive.wheelContactScaleByWheel.fr,0);
 assert.equal(ai.tireTemperature.fl,150);
 assert.equal(ai.engineDrive.throttle,.5);
});

test('traffic stops hold brakes through zero speed and rollback, then release to drive',()=>{
 const e=new RaceEditor({});
 const tuning=e.getRaceCarTuning(e.selectedCar);
 for(const speedMps of [-1,-.01,0,.01,.3])for(const target of [0,.003,.05]) {
  const ai={speedMps,gear:1,difficulty:'hard'};
  const stopped=planRaceAiControls(e,ai,tuning,target);
  assert.equal(stopped.throttle,0);
  assert.equal(stopped.brake,1);
  assert.equal(stopped.braking,true);
  const moving=planRaceAiControls(e,ai,tuning,10);
  assert.equal(moving.brake,0);
  assert.ok(moving.throttle>0);
 }
 const slowing=planRaceAiControls(e,{speedMps:10,gear:1},tuning,0);
 assert.ok(slowing.brake>0&&slowing.brake<1,'approach retains proportional braking');
 const creeping=planRaceAiControls(e,{speedMps:0,gear:1},tuning,.2);
 assert.equal(creeping.brake,0,'a positive creep command is not held');
});

test('tire effect records are reused and fully overwritten through contact loss and handoff',()=>{
 const ai={vehicleDynamicsRunner:{config:{wheelRadiusM:.5},state:{contactPatches:{fl:{normalLoadN:1000,slipRatio:1}},tireState:{fl:{temperatureF:140}}}}};
 syncRaceAiPhysicalTireEffects(ai);
 const loads=ai.engineDrive.dynamicNormalLoads,slip=ai.engineDrive.tireSlipByWheel,brakes=ai.engineDrive.combinedBrakeState,temperature=ai.tireTemperature;
 ai.engineDrive={throttle:.8,combinedBrakeState:{legacyField:true}};
 ai.vehicleDynamicsRunner.state.contactPatches={};
 ai.vehicleDynamicsRunner.state.tireState={};
 syncRaceAiPhysicalTireEffects(ai);
 assert.strictEqual(ai.engineDrive.dynamicNormalLoads,loads);
 assert.strictEqual(ai.engineDrive.tireSlipByWheel,slip);
 assert.strictEqual(ai.engineDrive.combinedBrakeState,brakes);
 assert.strictEqual(ai.tireTemperature,temperature);
 assert.equal(ai.engineDrive.throttle,.8);
 assert.deepEqual(loads,{fl:0,fr:0,rl:0,rr:0});
 assert.deepEqual(slip,{fl:0,fr:0,rl:0,rr:0});
 assert.deepEqual(temperature,{fl:70,fr:70,rl:70,rr:70});
 assert.equal(brakes.legacyField,undefined);
 const other={vehicleDynamicsRunner:ai.vehicleDynamicsRunner};syncRaceAiPhysicalTireEffects(other);
 assert.notStrictEqual(other.engineDrive.dynamicNormalLoads,loads);
});

test('center-slow experiment changes driver intent without teleporting the car',()=>{
 const e=new RaceEditor({});e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const s=e.playtestSession;s.countdownRemainingMs=0;s.debugAiCenterSlow=true;
 const car=e.selectedCar,pose=e.getRaceWorldPoseAtDistance(60);
 const ai={id:'center-experiment',runtimeCar:car,carId:car.id,worldX:pose.x+1,worldZ:pose.z,carYaw:pose.yaw,
  distance:60,projectedDistance:60,speedMps:0,gear:1,rpm:800,lap:1,currentLapMs:0,difficulty:'hard',lineOffset:.6};
 s.aiRuntime=[ai];s.worldX=ai.worldX;s.worldZ=ai.worldZ-10;
 const before={x:ai.worldX,z:ai.worldZ};
 e.updateRaceAiDrivers(1/60);
 assert.equal(ai.lineOffset,0);
 assert.ok(ai.drivingPlan.targetSpeedMps<=8);
 assert.ok(Math.hypot(ai.worldX-before.x,ai.worldZ-before.z)<.5);
 assert.ok(ai.vehicleDynamicsRunner.stepIndex>0);
});
