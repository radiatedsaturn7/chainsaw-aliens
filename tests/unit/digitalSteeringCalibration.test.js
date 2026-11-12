import test from 'node:test';
import assert from 'node:assert/strict';
import {HandlingAssist} from '../../src/racing/simulation/HandlingAssist.js';
import {RACE_CONTROLLER_STEERING} from '../../src/racing/simulation/RaceSimulationConfig.js';
import {loadCalibrationVehicle,measureDigitalManeuver,measureRecoveryOverhold} from '../../tools/vehicle-validation/calibrate-digital-steering.mjs';
const assist=new HandlingAssist(RACE_CONTROLLER_STEERING);
test('digital phases preserve timing across frame rates, including zero-crossing reversals',()=>{
 const step=(current,intent,time,fps)=>{
  for(let i=0;i<Math.round(time*fps);i++)current=assist.stepDigitalSteering({currentOutput:current,intent,seconds:1/fps,speedMps:45});
  return current;
 };
 for(const sign of [-1,1]){
  const expected=step(step(0,sign,.2,120),-sign,.1,120);
  for(const fps of [30,60,90,120]){
   const press=step(0,sign,.2,fps);
   const reverse=step(press,-sign,.1,fps);
   assert.ok(Math.abs(reverse-expected)<1e-12);
   assert.equal(step(reverse,0,1,fps),0);
   assert.equal(step(0,sign,2,fps),sign);
  }
 }
});
test('high-speed taps are smaller than parking taps without removing sustained steering authority',()=>{
 const tap=speedMps=>assist.stepDigitalSteering({intent:1,seconds:.1,speedMps});
 assert.ok(tap(70)<tap(0));assert.ok(tap(70)>0);
 assert.ok(tap(70)<.25);
 assert.equal(assist.stepDigitalSteering({intent:1,seconds:2,speedMps:70}),1);
});
test('saved RTG binary taps reduce skid excitation while retaining turn-in and prompt reversal',()=>{
 const vehicle=loadCalibrationVehicle();
 for(const speed of [25,45])for(const grip of [1,.65]){
  const previous=measureDigitalManeuver({...vehicle,speed,grip,maneuver:'tap',legacy:true});
  const calibrated=measureDigitalManeuver({...vehicle,speed,grip,maneuver:'tap'});
  assert.ok(calibrated.maxRackDeg<previous.maxRackDeg*.6,JSON.stringify({previous,calibrated}));
  assert.ok(calibrated.maxSlipDeg<previous.maxSlipDeg,JSON.stringify({previous,calibrated}));
  const reversal=measureDigitalManeuver({...vehicle,speed,grip,maneuver:'reverse'});
  assert.ok(reversal.centerTime<=.15);
 }
 const left=measureDigitalManeuver({...vehicle,speed:10,grip:1,maneuver:'hold',sign:-1});
 const right=measureDigitalManeuver({...vehicle,speed:10,grip:1,maneuver:'hold'});
 assert.ok(left.maxYaw>.25&&right.maxYaw>.25);
 assert.ok(Math.abs(left.maxYaw-right.maxYaw)<.02);
});
test('digital release is not rewritten by tire-aligning torque',()=>{
 for(const mode of ['digital','keyboard'])for(const rackAngleRad of [-.3,.3]){
  assert.equal(assist.getSelfAligningSteeringCorrection({steeringInputMode:mode,rackAngleRad,
   contactPatches:{fl:{normalLoadN:4000,lateralForceN:2000,selfAligningMomentNm:200}},
   casterRad:.1,seconds:1/60,activeTurnInput:false}),0);
 }
});

test('late countersteer release does not cause a second large skid across ABS/TC combinations',()=>{
 const vehicle=loadCalibrationVehicle();
 for(const absEnabled of [true,false])for(const tractionControlEnabled of [true,false]){
  const options={...vehicle,absEnabled,tractionControlEnabled,delay:.2,speed:25,grip:.65};
  const before=measureRecoveryOverhold({...options,recoveryGuard:false});
  const after=measureRecoveryOverhold(options);
  assert.ok(before.correctedAt!==null&&after.correctedAt!==null);
  assert.ok(after.correctedAt<=before.correctedAt+1/120,'must not buy stability by delaying recovery');
  assert.ok(after.oppositeSlipDeg<before.oppositeSlipDeg*.3,JSON.stringify({before,after}));
  assert.ok(after.oppositeSlipDeg<5);
 }
 for(const sign of [-1,1]){
  const result=measureRecoveryOverhold({...vehicle,delay:.2,sign,absEnabled:false,tractionControlEnabled:false,stabilityControlEnabled:false});
  assert.ok(result.correctedAt!==null);
  assert.ok(result.oppositeSlipDeg<5,JSON.stringify(result));
 }
});
test('calibration actually exercises ABS and TC rather than only changing menu flags',()=>{
 const vehicle=loadCalibrationVehicle();
 const braking=measureDigitalManeuver({...vehicle,speed:25,grip:.35,maneuver:'brake-turn'});
 const noAbs=measureDigitalManeuver({...vehicle,speed:25,grip:.35,maneuver:'brake-turn',absEnabled:false});
 const powered=measureDigitalManeuver({...vehicle,speed:10,grip:.35,maneuver:'power-turn'});
 const noTc=measureDigitalManeuver({...vehicle,speed:10,grip:.35,maneuver:'power-turn',tractionControlEnabled:false});
 assert.ok(braking.absInterventions>0,JSON.stringify(braking));assert.equal(noAbs.absInterventions,0);
 assert.ok(powered.tcInterventions>0,JSON.stringify(powered));assert.equal(noTc.tcInterventions,0);
});
test('digital recovery envelope preserves driver direction, neutral, and direct wheel control',async()=>{
 const {resolvePhysicalCenterSteeringAngle}=await import('../../src/racing/simulation/ContactPatchTireModel.js');
 const config={handlingPreset:'sport',maxSteerAngleRad:.52};
 for(const sign of [-1,1]){
  const state={groundSpeedMps:25,bodyLongitudinalSpeedMps:25,bodyLateralSpeedMps:-sign*.2,
   yawRateRadps:-sign*.1,countersteerRangeLeft:sign===1?1:0,countersteerRangeRight:sign===-1?1:0};
  assert.equal(resolvePhysicalCenterSteeringAngle({steering:0,steeringInputMode:'digital'},config,state),0);
  for(const amount of [.1,.5,1]){
   const actual=resolvePhysicalCenterSteeringAngle({steering:-sign*amount,steeringInputMode:'digital'},config,state);
   assert.equal(Math.sign(actual),-sign);assert.ok(Math.abs(actual)<=.52);
  }
  assert.equal(resolvePhysicalCenterSteeringAngle({steering:-sign,steeringInputMode:'simulation-wheel'},config,state),-sign*.52);
  assert.equal(resolvePhysicalCenterSteeringAngle({steering:sign,steeringInputMode:'digital'},config,state),
   resolvePhysicalCenterSteeringAngle({steering:sign,steeringInputMode:'normalized'},config,state),'unrelated turn direction retains its range');
 }
});
