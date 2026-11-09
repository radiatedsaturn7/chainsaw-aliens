import test from 'node:test';
import assert from 'node:assert/strict';
import {HandlingAssist} from '../../src/racing/simulation/HandlingAssist.js';
import {quaternionFromEuler,rotateVectorByQuaternion,rotateVectorToBody} from '../../src/racing/simulation/RigidBodyMath.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('roll damping follows the car body on every heading and slope without damping pitch or yaw',()=>{
 const assist=new HandlingAssist(),config={rollInertiaKgM2:690};
 for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5])for(const pitch of [-.3,0,.3])for(const roll of [-.2,0,.2]){
  const orientation=quaternionFromEuler({yaw,pitch,roll});
  const angularVelocityWorld=rotateVectorByQuaternion({x:.7,y:-.3,z:1},orientation);
  const interventions=assist.calculatePhysicalInterventions({state:{orientation,angularVelocityWorld},config,supportScale:1});
  assert.equal(interventions.length,1);
  const moment=rotateVectorToBody(interventions[0].momentWorldNm,orientation);
  near(moment.x,0);near(moment.y,0);near(moment.z,-690*.45*.12);
 }
});
test('roll damping never turns pitch/yaw into roll and retains existing airborne and simulation exclusions',()=>{
 const assist=new HandlingAssist(),config={rollInertiaKgM2:690};
 for(const yaw of [0,Math.PI/2,Math.PI]){
  const orientation=quaternionFromEuler({yaw,pitch:.3});
  const angularVelocityWorld=rotateVectorByQuaternion({x:1,y:1,z:0},orientation);
  assert.equal(assist.calculatePhysicalInterventions({state:{orientation,angularVelocityWorld},config}).length,0);
 }
 const state={orientation:quaternionFromEuler({yaw:Math.PI/2}),angularVelocityWorld:{x:1,y:0,z:0}};
 assert.equal(assist.calculatePhysicalInterventions({state,config,preset:'simulation'}).length,0);
 assert.equal(assist.calculatePhysicalInterventions({state,config,controls:{assists:{stabilityControlEnabled:false}}}).length,0);
 const airborne=assist.calculatePhysicalInterventions({state,config,supportScale:0});
 assert.equal(airborne.length,1);assert.equal(airborne[0].appliedValue,0);assert.equal(airborne[0].suppressionReason,'airborne-contact');
});
