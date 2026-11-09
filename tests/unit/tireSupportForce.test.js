import test from 'node:test';
import assert from 'node:assert/strict';
import {ContactPatchTireModel} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {createVehicleDynamicsConfig,createVehicleDynamicsState} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

test('hard-stop tire grip cannot exceed delivered contact support',()=>{
 const config=createVehicleDynamicsConfig({massKg:1450,cgHeightM:.54,suspensionTravelM:.15});
 const model=new ContactPatchTireModel();
 const ids=['fl','fr','rl','rr'];
 let state=createVehicleDynamicsState({position:{x:0,y:.54,z:0},velocity:{x:1,y:-1,z:25},groundSpeedMps:25});
 const environment={surfaceHeightByWheel:Object.fromEntries(ids.map(id=>[id,0])),surfaceNormalByWheel:Object.fromEntries(ids.map(id=>[id,{x:0,y:1,z:0}]))};
 let supported=0;
 for(let step=0;step<60;step++){
  state.position.y=.54-step*.002;
  const result=model.step({state,config,environment,controls:{steering:.2,brake:.7,throttle:0},dt:1/120});
  for(const patch of Object.values(result.contactPatches||{})){
   if(patch.normalLoadN>1 && patch.hardStopForceN>0){supported++;assert.ok(patch.normalLoadN <= patch.chassisSupportLoadN+.001,`grip load ${patch.normalLoadN} vs support ${patch.chassisSupportLoadN}`);}
  }
  state={...state,suspensionState:result.suspensionState,contactPatches:result.contactPatches,wheelAngularVelocityRadps:result.wheelAngularVelocityRadps};
 }
 assert.ok(supported>20,`exercise loaded contacts: ${supported}`);
});
