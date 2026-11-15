import test from 'node:test';
import assert from 'node:assert/strict';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {runClimb} from '../../tools/vehicle-validation/low-speed-traction-audit.mjs';
const ids=['fl','fr','rl','rr'];
const each=v=>Object.fromEntries(ids.map(id=>[id,structuredClone(v)]));
const model=new PowertrainModel();
function step(previous={},options={}){
 const {dt=1/120,drivetrain='fwd',gear=1,clutch=0,brake=0,handbrake=0,throttle=1,autoShift=true,converterSlip=0,tc=false,capacity=4000}=options;
 const driven=model.getDrivenWheelIds({drivetrain});
 return model.stepAuthoritativeWheelTorques({previous:{gear,targetGear:gear,engineRpm:800,...previous},
  tuning:{drivetrain,gearRatios:[3,2],reverseRatio:3.6,finalDrive:3.15,launchRpm:2200,torqueLbFt:283,torqueConverterSlip:converterSlip,idleRpm:800,revLimitRpm:6500,torquePeakStartRpm:1620,torquePeakEndRpm:4000,torqueFalloffRpm:6500},
  config:{idleRpm:800,maxRpm:6500,wheelRadiusM:.3479,massKg:1332,drivetrainEfficiency:.94},
  controls:{requestedGear:gear,throttle,brake,handbrake,clutch,assists:{autoShift,tractionControlEnabled:tc}},
  kinematicsByWheel:each({wheelAngularVelocityRadps:0,longitudinalVelocityMps:0,effectiveRollingRadiusM:.3479,slipRatio:0,peakLongitudinalSlipRatio:.03}),
  capacityByWheel:each(capacity),driveShareByWheel:Object.fromEntries(ids.map(id=>[id,driven.includes(id)?1/driven.length:0])),state:{groundSpeedMps:0},dt});
}
function hold(options,seconds=2){let result;for(let i=0;i<Math.round(seconds/(options.dt||1/120));i++)result=step(result?.state,options);return result;}

test('automatic clutch supplies sustained launch torque without requiring wheel speed, FWD/RWD/AWD and reverse',()=>{
 for(const drivetrain of ['fwd','rwd','awd'])for(const gear of [1,-1])for(const dt of [1/60,1/120,1/360]){
  const result=hold({drivetrain,gear,dt});
  assert.equal(result.state.clutchCoupling,1);
  assert.ok(Math.abs(result.state.engineRpm-2200)<2);
  assert.ok(Math.abs(Object.values(result.wheelDriveTorqueNm).reduce((a,b)=>a+b,0))>2000);
 }
});
test('clutch take-up is progressive, releases on pedal lift/braking, and restarts gently',()=>{
 const early=hold({},.25),late=hold({},2);
 assert.ok(early.state.clutchCoupling>=.35&&early.state.clutchCoupling<.7);
 assert.equal(late.state.clutchCoupling,1);
 for(const controls of [{throttle:0},{brake:1},{handbrake:1},{clutch:1}]){
  const release=step(late.state,controls);
  assert.equal(release.state.automaticClutchTakeup,0);
  const restart=step(release.state);
  assert.ok(restart.state.clutchCoupling<.4);
 }
});
test('manual clutch and torque converters do not inherit automatic take-up; low grip remains TC-limited',()=>{
 for(const clutch of [0,.5,1]){
  const result=hold({autoShift:false,clutch});
  assert.equal(result.state.clutchCoupling,1-clutch);
  assert.equal(result.state.automaticClutchTakeup,0);
 }
 assert.equal(hold({converterSlip:.15}).state.automaticClutchTakeup,0);
 const on=hold({tc:true,capacity:150}),off=hold({tc:false,capacity:150});
 assert.equal(on.state.clutchCoupling,1);
 assert.ok(on.telemetry.contactTorqueScale<.2);
 assert.ok(Math.abs(on.wheelDriveTorqueNm.fl)<Math.abs(off.wheelDriveTorqueNm.fl)*.2);
});

test('saved cars pull away on a dry 11% hill with aids on and off',()=>{
 for(const carName of ['Silverleaf 200 2018','RTG-001','RTG-S','STI Airslayer'])for(const tc of [true,false]){
  const result=runClimb({carName,tireName:'Stock',surface:'asphalt',snowMm:0,slope:.11,temperatureC:20,throttle:1,tc,seconds:3});
  assert.ok(result.mph>5,JSON.stringify(result));
  assert.ok(result.travelM>2,JSON.stringify(result));
  assert.ok(Math.abs(result.lateralM)<.5,JSON.stringify(result));
 }
});


test('take-up state resumes deterministically and neutral clears the engagement ramp',()=>{
 const partial=hold({},.4);
 assert.deepEqual(step(partial.state),step(JSON.parse(JSON.stringify(partial.state))));
 const neutral=step({...partial.state,gear:0,targetGear:0},{gear:0});
 assert.equal(neutral.state.automaticClutchTakeup,0);
 assert.ok(Object.values(neutral.wheelDriveTorqueNm).every(t=>t===0));
 const light=hold({throttle:.25});
 assert.ok(light.wheelDriveTorqueNm.fl<hold({}).wheelDriveTorqueNm.fl*.5);
});

test('Silverleaf arrests rollback and resumes climbing after a brake-held stop',()=>{
 for(const tc of [true,false]){
  const options={carName:'Silverleaf 200 2018',tireName:'Stock',surface:'asphalt',snowMm:0,slope:.11,temperatureC:20,tc};
  const rollback=runClimb({...options,initialSpeedMps:-1,throttle:1,seconds:3});
  assert.ok(rollback.mph>3,JSON.stringify(rollback));
  const restart=runClimb({...options,seconds:4,controlAt:t=>({throttle:t<1?0:1,brake:t<1?1:0})});
  assert.ok(restart.mph>5,JSON.stringify(restart));
 }
});
