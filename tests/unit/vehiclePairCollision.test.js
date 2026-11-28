import test from 'node:test';
import assert from 'node:assert/strict';
import {queueVehiclePairCollision,queueVehicleFleetCollisions} from '../../src/racing/simulation/VehiclePairCollision.js';
function car(x,z,vx=0,vz=0,y=0){return {state:{position:{x,y,z},velocity:{x:vx,y:0,z:vz},yawRad:0},
 config:{massKg:1400,bodyWidthM:2,bodyLengthM:4,bodyHeightM:1.5,yawInertiaKgM2:2000},
 impulses:[],queueCollisionImpulse(c){this.impulses.push(c);}};}
test('rear impact transfers equal opposite momentum rather than ghosting',()=>{
 const a=car(0,0,0,20),b=car(0,4.2,0,5);
 assert.ok(queueVehiclePairCollision(a,b,.02));
 const x=a.impulses[0].impulseWorldNs,y=b.impulses[0].impulseWorldNs;
 assert.ok(x.z<0&&y.z>0);assert.equal(x.z+y.z,0);
 assert.equal(x.x+y.x,0);
});
test('swept response catches high relative speed and rejects a near miss',()=>{
 assert.ok(queueVehiclePairCollision(car(0,0,0,100),car(0,8),.05));
 assert.equal(queueVehiclePairCollision(car(2.1,0,0,100),car(0,8),.05),false);
});
test('bridge separation, clear side-by-side rows and departing cars do not collide',()=>{
 assert.equal(queueVehiclePairCollision(car(0,0),car(0,0,0,0,5),.02),false);
 assert.equal(queueVehiclePairCollision(car(-1.4,0),car(1.4,0),.02),false);
 assert.equal(queueVehiclePairCollision(car(0,0,0,-10),car(0,4.2,0,10),.02),false);
});
test('side contact produces a lateral impulse and fleet resolves each pair only once',()=>{
 const a=car(0,0,4,0),b=car(2.1,0);
 assert.equal(queueVehicleFleetCollisions([a,b],.05),1);
 assert.ok(a.impulses[0].impulseWorldNs.x<0);
 assert.equal(a.impulses.length,1);assert.equal(b.impulses.length,1);
});

test('pair impulses actually change both authoritative chassis velocities',async()=>{
 const {VehicleDynamicsRunner}=await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
 const a=new VehicleDynamicsRunner({initialState:{worldX:0,worldZ:0,speedMps:20}});
 const b=new VehicleDynamicsRunner({initialState:{worldX:0,worldZ:4.5,speedMps:5}});
 const gap=a.config.bodyLengthM/2+b.config.bodyLengthM/2+.1;
 b.state.position.z=gap;
 assert.ok(queueVehiclePairCollision(a,b,1/60));
 a.advance(1/60,{input:{throttle:0,brake:0}});
 b.advance(1/60,{input:{throttle:0,brake:0}});
 assert.ok(a.state.velocity.z<19,'rear car loses forward speed');
 assert.ok(b.state.velocity.z>6,'front car receives momentum');
});

test('worker queues pair response before advancing its owned vehicles',async()=>{
 const {VehicleDynamicsWorkerAuthority}=await import('../../src/racing/simulation/VehicleDynamicsWorkerAuthority.js');
 const a=car(0,0,0,20),b=car(0,4.2,0,5);
 for(const runner of [a,b])runner.advance=()=>{
  assert.equal(runner.impulses.length,1);
  return {completedSteps:0,backlogSteps:0};
 };
 const authority=new VehicleDynamicsWorkerAuthority({runners:[{id:'player',runner:a,player:true},{id:'ai',runner:b}],now:()=>0});
 authority.tick(0);authority.tick(20);
});
