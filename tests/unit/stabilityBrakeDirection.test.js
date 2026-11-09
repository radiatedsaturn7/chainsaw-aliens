import test from 'node:test';
import assert from 'node:assert/strict';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';

// X points right and Z points forward. A braking force (-Z) at +X
// generates positive yaw: (r cross F).y = -r.x * F.z.
test('stability braking produces a physical yaw moment that reduces yaw error in both turns and countersteering',()=>{
 const model=new PowertrainModel(),ids=['fl','fr','rl','rr'];
 for(const steering of [-.12,0,.12])for(const yawRate of [-1,0,1]){
  const desired=18*Math.tan(steering)/2.67,error=desired-yawRate;
  if(Math.abs(error)<=.18)continue;
  const out=model.stepAuthoritativeWheelTorques({
   tuning:{drivetrain:'awd'},config:{wheelbaseM:2.67,wheelRadiusM:.337,brakeForceN:14500},
   controls:{centerSteeringAngleRad:steering,brake:0,throttle:0,assists:{stabilityControlEnabled:true}},
   state:{groundSpeedMps:18,bodyLongitudinalSpeedMps:18,bodyLateralSpeedMps:4,angularVelocityWorld:{y:yawRate}},
   kinematicsByWheel:Object.fromEntries(ids.map(id=>[id,{longitudinalVelocityMps:18,slipRatio:0,wheelAngularVelocityRadps:18/.337}])),
   capacityByWheel:Object.fromEntries(ids.map(id=>[id,4000])),dt:1/120
  });
  let moment=0;
  for(const id of ids){const x=id.endsWith('l')?-.78:.78;const forceZ=-out.wheelBrakeTorqueNm[id]/.337;moment-=x*forceZ;}
  assert.ok(moment*error>0,`steering=${steering}, yawRate=${yawRate}, error=${error}, moment=${moment}, wheel=${out.telemetry.stabilityBrakeWheelId}`);
 }
});

test('ESC does not add yaw toward an unreachable steering target on low-grip ground',()=>{
 const model=new PowertrainModel(),ids=['fl','fr','rl','rr'];
 for(const sign of [-1,1]){
  const out=model.stepAuthoritativeWheelTorques({
   tuning:{drivetrain:'awd'},config:{massKg:1500,wheelbaseM:2.67,wheelRadiusM:.337},
   controls:{centerSteeringAngleRad:sign*.3,brake:0,throttle:0,assists:{stabilityControlEnabled:true}},
   state:{groundSpeedMps:20,bodyLongitudinalSpeedMps:20,angularVelocityWorld:{y:sign*.6}},
   kinematicsByWheel:Object.fromEntries(ids.map(id=>[id,{longitudinalVelocityMps:20,slipRatio:0,wheelAngularVelocityRadps:20/.337}])),
   capacityByWheel:Object.fromEntries(ids.map(id=>[id,1500])),dt:1/120
  });
  // 6000 N / (1500 kg * 20 m/s) = 0.2 rad/s, below the actual
  // 0.6 rad/s. More steering must not turn this into an understeer command.
  assert.equal(out.telemetry.stabilityClassification,'oversteer');
  const moment=ids.reduce((sum,id)=>sum+(id.endsWith('l')?-.78:.78)*out.wheelBrakeTorqueNm[id]/.337,0);
  assert.ok(moment*sign<0);
 }
});
