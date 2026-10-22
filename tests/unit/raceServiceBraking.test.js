import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {getRaceServiceBrakeForceN} from '../../src/racing/simulation/RaceSimulationConfig.js';

test('service brake configuration honors authored force and scales the default with mass',()=>{
 const e=new RaceEditor({});
 for(const mass of [1000,1600,2400]){
  assert.equal(getRaceServiceBrakeForceN({weightKg:mass}),mass*12.5);
  for(const force of [6000,22000,32000]){
   const car=structuredClone(e.selectedCar);car.tuning.brakeForceN=force;
   const tuning=e.getRaceCarTuning(car);
   assert.equal(tuning.brakeForceN,force);
   assert.equal(createVehicleDynamicsConfigFromTuning({...tuning,weightKg:mass}).brakeForceN,force);
  }
 }
 for(const force of [undefined,0,-1,NaN,Infinity])assert.equal(getRaceServiceBrakeForceN({weightKg:1600,brakeForceN:force}),20000);
});

function brakeRun(mode,brakeForceN,brakePressure=1){
 const input={gamepadAxes:{leftX:0,leftTrigger:0,rightTrigger:0}};
 const e=new RaceEditor({input});
 e.selectedRace.hazards=[];e.selectedRace.weather='clear';e.selectedRace.margin={collisionEdge:'none',collisionMode:'none'};
 e.selectedRace.road.segments=[{length:1600,curve:0,elevation:0,surface:'asphalt',turn:'smooth',hazardIds:[]}];
 e.selectedCar.setup={...e.selectedCar.setup,defaultTireCompound:'tarmac',tireCompoundByWheel:{fl:'tarmac',fr:'tarmac',rl:'tarmac',rr:'tarmac'}};
 if(brakeForceN)e.selectedCar.tuning.brakeForceN=brakeForceN;
 e.selectedCar.tuning.brakePressure=brakePressure;
 e.startPlaytest(e.selectedCar.id);e.updatePlaytest(0);
 const s=e.playtestSession,r=s.vehicleDynamicsRunner; e.raceInput.gear=3;r.state.gear=3;r.state.powertrainState={...r.state.powertrainState,gear:3,targetGear:3};
 Object.assign(s,{launchLockMs:0,countdownRemainingMs:0,elapsedMs:3000,groundSpeedMps:26.8224,speedMps:26.8224,velocityYaw:0,carYaw:0});
 Object.assign(r.state,{velocity:{x:0,y:0,z:26.8224},speedMps:26.8224,groundSpeedMps:26.8224,bodyLongitudinalSpeedMps:26.8224,bodyLateralSpeedMps:0,signedTravelSpeedMps:26.8224,wheelAngularVelocityRadps:Object.fromEntries(['fl','fr','rl','rr'].map(k=>[k,26.8224/r.config.wheelRadiusM]))});
 if(mode==='trigger')input.gamepadAxes.leftTrigger=1;
 if(mode!=='trigger')e.raceInput.activeBrakePointerId=2;
 const samples=[];for(let i=0;i<180;i++){e.updatePlaytest(1/60);if(i%60===59)samples.push({t:(i+1)/60,speed:s.speedMps,brake:e.raceInput.brakeAxis,throttle:e.raceInput.throttleAxis});}

 assert.equal(e.raceInput.brakeAxis,1);
 assert.equal(e.raceInput.throttleAxis,0);
 return {speed:s.speedMps,samples,force:r.config.brakeForceN};
}

test('full touch braking uses available dry-road grip and matches a physical trigger',()=>{
 const prior=brakeRun('touch',16030),touch=brakeRun('touch'),trigger=brakeRun('trigger');
 assert.ok(prior.speed>3,`reference speed ${prior.speed}`);
 assert.ok(touch.speed<1.5,`speed after three seconds ${touch.speed}`);
 assert.ok(touch.speed<prior.speed-2);
 assert.deepEqual(touch.samples,trigger.samples);
 assert.ok(touch.samples.every((s,i,a)=>i===0||s.speed<a[i-1].speed));
});

test('brake pressure changes actual touch braking response',()=>{
 const low=brakeRun('touch',undefined,0.7);
 const normal=brakeRun('touch',undefined,1);
 const high=brakeRun('touch',undefined,1.35);
 assert.ok(low.speed>normal.speed);
 assert.ok(high.speed<=normal.speed+0.1);
 assert.ok(low.samples[0].speed>normal.samples[0].speed);
 assert.ok(high.samples[0].speed<normal.samples[0].speed);
});
