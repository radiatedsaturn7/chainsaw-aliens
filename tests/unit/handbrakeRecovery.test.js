import test from 'node:test';
import assert from 'node:assert/strict';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
const ids=['fl','fr','rl','rr'];
const tuning={idleRpm:850,revLimitRpm:6500,launchRpm:2600,torqueConverterSlip:.12,torqueLbFt:300,torquePeakStartRpm:2000,torquePeakEndRpm:5200,torqueFalloffRpm:6500,gearRatios:[3.5,2.2,1.5,1.1],finalDrive:4,reverseRatio:3.3,drivetrain:'awd'};
function run({omega=0,slip=0,gear=1,clutch=0,handbrake=0,initialRpm=5000,converter=.12}={}){
 const model=new PowertrainModel();let previous={gear,targetGear:gear,engineRpm:initialRpm,tractionTorqueScale:.08},out;
 for(let i=0;i<360;i++){
  out=model.stepAuthoritativeWheelTorques({tuning:{...tuning,torqueConverterSlip:converter},config:{maxRpm:6500,wheelRadiusM:.33,handbrakeForceN:8000},previous,
   state:{groundSpeedMps:Math.abs(omega*.33)},controls:{requestedGear:gear,throttle:1,clutch,handbrake,assists:{tractionControlEnabled:true}},
   kinematicsByWheel:Object.fromEntries(ids.map(id=>[id,{wheelAngularVelocityRadps:omega,slipRatio:slip,longitudinalVelocityMps:omega*.33}])),
   capacityByWheel:Object.fromEntries(ids.map(id=>[id,4000])),driveShareByWheel:Object.fromEntries(ids.map(id=>[id,.25])),dt:1/120});previous=out.state;
 }
 return out;
}
test('loaded converter settles at launch stall RPM instead of sustaining a 5000 RPM flare',()=>{
 for(const initialRpm of [850,5000,6400]){
  const out=run({initialRpm});assert.ok(Math.abs(out.state.engineRpm-2600)<1);assert.ok(out.wheelDriveTorqueNm.fl>0);
 }
 assert.ok(run({clutch:1}).state.engineRpm>6400,'disengaged clutch can free-rev');
 assert.ok(run({gear:0}).state.engineRpm>6400,'neutral can free-rev');
 assert.ok(run({converter:0}).state.engineRpm<900,'manual remains coupled');
});
test('traction control restores forward drive while rolling backwards after a spin',()=>{
 const out=run({omega:-12,slip:.8});assert.ok(out.telemetry.tractionTorqueScale>.99);assert.ok(out.wheelDriveTorqueNm.fl>0);
});
test('traction control still limits real forward and reverse wheelspin',()=>{
 assert.ok(run({omega:40,slip:1}).telemetry.tractionTorqueScale<.2);
 assert.ok(run({omega:-40,slip:-1,gear:-1}).telemetry.tractionTorqueScale<.2);
 assert.ok(run({omega:12,slip:-.8,gear:-1}).telemetry.tractionTorqueScale>.99,'reverse recovery while rolling forward');
});
test('releasing handbrake restores drive torque and clears rear brake torque',()=>{
 const held=run({handbrake:1}),released=run();
 assert.ok(held.wheelBrakeTorqueNm.rl>0);assert.equal(released.wheelBrakeTorqueNm.rl,0);
 assert.ok(released.wheelDriveTorqueNm.fl>held.wheelDriveTorqueNm.fl*10);
});


import {getWheelSlipPresentation} from '../../src/racing/simulation/WheelSlipPresentation.js';
test('counter-rotating tires produce feedback instead of cancelling equal speed magnitudes',()=>{
 for(const sign of [-1,1]){
  const feedback=getWheelSlipPresentation({contactPatches:{fl:{normalLoadN:3500,validTreadContact:true,wheelAngularVelocityRadps:sign*10/.33,effectiveRollingRadiusM:.33,longitudinalVelocityMps:-sign*10,lateralVelocityMps:0}}});
  assert.ok(feedback.wheelSpinByWheel.fl>1);assert.ok(feedback.audibleSlip>.9);assert.equal(feedback.slipSpeedMps,20);
 }
});
