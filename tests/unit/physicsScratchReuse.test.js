import test from 'node:test';
import assert from 'node:assert/strict';
import {ContactPatchTireModel} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {createVehicleDynamicsConfig,createVehicleDynamicsState} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

test('reused tire scratch removes obsolete tuning and controls without changing fresh-step results',()=>{
 const reused=new ContactPatchTireModel();
 for(let i=0;i<6;i++){
  const config=createVehicleDynamicsConfig({powertrainTuning:{gearRatios:[3,2,1],finalDrive:4,...(i%2?{}:{autoUpshiftRpm:5700,customSetting:12})},
   tireByWheel:{fl:i%2?{}:{pressurePsi:24,compoundId:'rain',customGrip:.6}}});
  const state=createVehicleDynamicsState({speedMps:12,velocity:{x:0,y:0,z:12},engineRpm:3000,gear:1});
  const controls={steering:.1,throttle:.4,brake:0,handbrake:0,requestedGear:1,assists:{autoShift:true},...(i%2?{}:{customControl:3})};
  const environment={surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},tireByWheel:{fl:i%2?{}:{pressurePsi:18,wear:.2}}};
  const req={config,state,controls,environment,dt:1/120,stepIndex:1,substepIndex:0,timeSeconds:1/120};
  const result=reused.step(structuredClone(req));
  const expected=new ContactPatchTireModel().step(structuredClone(req));
  assert.deepEqual(result,expected,`request ${i}`);
 }
});

test('explicit powertrain overrides equal copied tuning and preserve missing-ratio fallback',()=>{
 const p=new PowertrainModel();
 for(const idle of [0,850,1200])for(const limit of [6000,8000]){
  const tuning={idleRpm:700,revLimitRpm:5000,redlineRpm:5500,gearRatios:[3,2,1]};
  const copy={...tuning,idleRpm:idle,revLimitRpm:limit};
  assert.equal(p.getAutomaticUpshiftRpm(tuning,idle,limit),p.getAutomaticUpshiftRpm(copy));
  assert.equal(p.getAutomaticDownshiftRpm(tuning,idle,limit),p.getAutomaticDownshiftRpm(copy));
  for(const gear of [-1,0,1,4])assert.equal(p.getGearRatio(tuning,gear,[4,2]),p.getGearRatio({...tuning,gearRatios:[4,2]},gear));
 }
 assert.equal(p.getGearRatio({},1),1);
});
