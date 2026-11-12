import test from 'node:test';
import assert from 'node:assert/strict';
import {runClimb} from '../../tools/vehicle-validation/low-speed-traction-audit.mjs';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {calculateBrushTireForce} from '../../src/racing/simulation/ContactPatchTireModel.js';
const ids=['fl','fr','rl','rr'],each=v=>Object.fromEntries(ids.map(id=>[id,{...v}]));
function drive({gear=1,omega=-80,speed=-3,throttle=.5,tc=true,brake=0,abs=true}={}){
 const model=new PowertrainModel();let previous={gear,targetGear:gear,engineRpm:850};let result;
 for(let i=0;i<60;i++){
 result=model.stepAuthoritativeWheelTorques({tuning:{drivetrain:'awd',gearRatios:[4,2.5],reverseRatio:3.5,finalDrive:4,torqueLbFt:200,torqueConverterSlip:.15},config:{idleRpm:850,maxRpm:6500,wheelRadiusM:.33,brakeForceN:12000},controls:{requestedGear:gear,throttle,brake,assists:{autoShift:true,tractionControlEnabled:tc,absEnabled:abs}},previous,kinematicsByWheel:each({wheelAngularVelocityRadps:omega,longitudinalVelocityMps:speed,effectiveRollingRadiusM:.33,slipRatio:(omega*.33-speed)/Math.max(.5,Math.abs(speed)),peakLongitudinalSlipRatio:.18,snowResponseWeight:1}),capacityByWheel:Object.fromEntries(ids.map(id=>[id,1000])),driveShareByWheel:Object.fromEntries(ids.map(id=>[id,.25])),state:{groundSpeedMps:Math.abs(speed)},dt:1/120});previous=result.state;
 }
 return result;
}
test('rollback shaft speed cannot drive engine to redline or trigger an upshift',()=>{
 for(const gear of [1,-1]){
 const r=drive({gear,omega:gear===1?-80:80,speed:gear===1?-3:3});
 assert.ok(r.state.engineRpm<3000,JSON.stringify(r.state));assert.equal(r.state.gear,gear);
 }
 assert.ok(drive({omega:80,speed:10}).state.engineRpm>5000,'genuine forward shaft speed still raises RPM');
});
test('TC does not treat opposition to rollback as full powered wheelspin',()=>{
 const r=drive({omega:.1,speed:-1});assert.ok(r.state.tractionTorqueScale>.9);
 assert.ok(drive({omega:40,speed:-1}).state.tractionTorqueScale<.3,'actual powered wheelspin is still limited');
});
test('ABS retains brake hold at walking speed, but still releases a moving locked wheel',()=>{
 assert.equal(drive({omega:0,speed:-.2,brake:1,throttle:0}).state.absModulationByWheel.fl,1);
 assert.ok(drive({omega:0,speed:-5,brake:1,throttle:0}).state.absModulationByWheel.fl<.3);
});
test('snow changes slip response without increasing the peak friction envelope',()=>{
 const material={baseSurfaceId:'snow',surfaceId:'snow',surfaceGripScale:.4,snowDepthMm:25.4};
 const tire={compound:{surfaceGrip:{snow:1.08}},referenceLoadN:3500,treadTemperatureC:-12};
 const f=(slip,extra={})=>calculateBrushTireForce({normalLoadN:3500,tire:{...tire,...extra},material,kinematics:{slipRatio:slip,slipAngleRad:0,longitudinalVelocityMps:3}});
 const peak=f(.18),sliding=f(1),old=f(.04,{peakSlip:.06,slidingFrictionRatio:.66});
 assert.equal(peak.peakLongitudinalSlipRatio,.18);assert.equal(peak.combinedSlipLimitN,old.combinedSlipLimitN);
 assert.ok(sliding.longitudinalForceN/peak.combinedSlipLimitN>.85);
 for(const slip of [0,.01,.03,.1,.18,.3,1,5])assert.ok(f(slip).longitudinalForceN<=peak.combinedSlipLimitN+.00001);
 const asphalt=calculateBrushTireForce({normalLoadN:3500,tire,material:{surfaceGripScale:1,baseSurfaceId:'asphalt'},kinematics:{slipRatio:1,slipAngleRad:0,longitudinalVelocityMps:3}});
 assert.equal(asphalt.snowResponseWeight,0);assert.ok(Math.abs(asphalt.longitudinalForceN/asphalt.combinedSlipLimitN-.66)<.001);
});

test('brakes hold a supported snowy hill but cannot hold beyond available friction',()=>{
 const common={carName:'RTG-001',tireName:'Snow',snowMm:25.4,temperatureC:-12,slope:.18,tc:true,seconds:3,initialSpeedMps:0,sampleEverySeconds:.5,controlAt:()=>({throttle:0,brake:1})};
 const snow=runClimb({...common,surfaceGrip:.4}),slippery=runClimb({...common,surfaceGrip:.06});
 assert.ok(Math.abs(snow.mph)<.03,JSON.stringify(snow));
 assert.ok(slippery.mph<-1,JSON.stringify(slippery));
});
