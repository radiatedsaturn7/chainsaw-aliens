import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {resolvePhysicalCenterSteeringAngle} from '../../src/racing/simulation/ContactPatchTireModel.js';
const carDocument=JSON.parse(fs.readFileSync(new URL('../fixtures/aiFieldForgetmenot.json',import.meta.url)));

test('AI physical wheel commands retain countersteer authority without changing player steering',()=>{
 const config={handlingPreset:'sport',maxSteerAngleRad:.52};
 for(const speed of [10,20,40])for(const angle of [-.52,-.2,.1,.52]){
  const controls={steering:angle/.52,centerSteeringAngleRad:angle,steeringInputMode:'ai'};
  assert.equal(resolvePhysicalCenterSteeringAngle(controls,config,{groundSpeedMps:speed}),angle);
 }
 const state={groundSpeedMps:40};
 assert.ok(Math.abs(resolvePhysicalCenterSteeringAngle({steering:1,steeringInputMode:'gamepad'},config,state))<.52);
 assert.equal(resolvePhysicalCenterSteeringAngle({centerSteeringAngleRad:2,steeringInputMode:'ai'},config,state),.52);
});

test('Hard Field Forgetmenot launches with clutch take-up instead of bogging at idle',t=>{
 const e=new RaceEditor({});
 e.applyLoadedCarDocument({kind:'rtg-car',car:structuredClone(carDocument)},{name:carDocument.name});
 const car=e.project.cars.find(c=>c.name===carDocument.name),tuning=e.getRaceCarTuning(car);
 e.startPlaytest(e.getRaceCarProjectIdentity(car),{hydrateCars:false});
 const pose=e.getRaceWorldPoseAtDistance(15);
 const makeAi=()=>({id:'launch',carId:car.id,runtimeCar:car,difficulty:'hard',physicsBudgetDetail:'full',
  worldX:pose.x,worldZ:pose.z,carYaw:pose.yaw,distance:15,projectedDistance:15,speedMps:0,gear:1,rpm:tuning.idleRpm,
  drivingPlan:{steeringAngleRad:0,targetSpeedMps:40},engineDrive:{throttle:1,brake:0}});
 const old=makeAi();
 e.updateRaceAiVehiclePhysics(old,{car,tuning,seconds:0});
 const advance=old.vehicleDynamicsRunner.advance.bind(old.vehicleDynamicsRunner);
 old.vehicleDynamicsRunner.advance=(dt,options)=>advance(dt,{...options,input:{...options.input,assists:{...options.input.assists,autoShift:false}}});
 for(let i=0;i<120;i++)e.updateRaceAiVehiclePhysics(old,{car,tuning,seconds:1/60});
 const ai=makeAi();
 for(let i=0;i<120;i++)e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
 assert.ok(ai.speedMps>old.speedMps*1.3,`new ${ai.speedMps}, old ${old.speedMps}`);
 t.diagnostic(`2 seconds: ${ai.speedMps.toFixed(2)} m/s, ${ai.rpm.toFixed(0)} RPM`);
 assert.ok(ai.speedMps>3,`launch speed ${ai.speedMps}`);
 assert.ok(ai.rpm>tuning.idleRpm*2);
});
