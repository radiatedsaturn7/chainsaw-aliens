import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAbsPressure} from '../../src/racing/simulation/AbsPressure.js';
for(const hz of [60,120,240])test(`ABS keeps releasing persistent lock and recovers progressively at ${hz} Hz`,()=>{
 let pressure=1;
 for(let i=0;i<hz/4;i++)pressure=advanceAbsPressure(pressure,{slip:.8,dt:1/hz});
 assert.ok(pressure<.02);
 let next=advanceAbsPressure(pressure,{slip:0,dt:1/hz});assert.ok(next>pressure&&next<.12);
 for(let i=0;i<hz;i++)next=advanceAbsPressure(next,{slip:0,dt:1/hz});assert.equal(next,1);
 assert.equal(advanceAbsPressure(.2,{slip:1,dt:1/hz,enabled:false}),1);
});
test('ABS holds pressure inside its target band rather than reapplying toward full demand',()=>{
 assert.equal(advanceAbsPressure(.3,{slip:.12,target:.13,dt:.05}),.3);
 assert.equal(advanceAbsPressure(.3,{slip:.5,dt:0}),.3);
});

test('powertrain ABS follows each tire peak and respects an explicit target override',async()=>{
 const {PowertrainModel}=await import('../../src/racing/simulation/PowertrainModel.js');
 const run=(peak,override)=>{
  const model=new PowertrainModel(),ids=['fl','fr','rl','rr'];let previous={gear:1,engineRpm:900};
  for(let i=0;i<20;i++)previous=model.stepAuthoritativeWheelTorques({
   tuning:{drivetrain:'awd',gearRatios:[4,2],finalDrive:4,absSlipTarget:override},
   config:{idleRpm:900,maxRpm:6500,wheelRadiusM:.33,brakeForceN:15000},
   controls:{requestedGear:1,throttle:0,brake:1,assists:{absEnabled:true}},previous,
   kinematicsByWheel:Object.fromEntries(ids.map(id=>[id,{wheelAngularVelocityRadps:50,longitudinalVelocityMps:20,slipRatio:-.12,peakLongitudinalSlipRatio:peak}])),
   state:{groundSpeedMps:20},dt:1/120}).state;
  return previous.absModulationByWheel.fl;
 };
 assert.ok(run(.05)<run(.18));
 assert.equal(run(.05,.18),run(.18,.18));
});
