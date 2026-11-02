import test from 'node:test';
import assert from 'node:assert/strict';
import {raceAiTrafficNeedsDetailedPhysics as risk,createRaceAiTrafficProbe} from '../../src/racing/RaceAiTrafficBounds.js';
const car=(x,z,yaw=0,speed=0)=>({worldX:x,worldZ:z,carYaw:yaw,speedMps:speed,
 vehicleDynamicsRunner:{config:{bodyWidthM:1.8,bodyLengthM:4.5}}});
test('parallel traffic with physical clearance does not require full collision physics',()=>{
 const ai=car(0,0);
 assert.equal(risk(ai,car(2.8,0),0,.2,0,1/60),false);
 assert.equal(risk(ai,car(0,7),0,.2,0,1/60),false);
 assert.equal(risk(ai,car(1.8,0),0,.2,0,1/60),true);
 assert.equal(risk(ai,car(0,3),0,.2,0,1/60),true);
});
test('traffic bounds account for heading, both cars movement, and rotation',()=>{
 const ai=car(0,0);
 assert.equal(risk(ai,car(4,0,-Math.PI/2,30),0,0,0,.05),true);
 assert.equal(risk(ai,car(4,0,-Math.PI/2,0),0,0,0,.05),false);
 assert.equal(risk(ai,car(0,6,Math.PI,40),0,1,0,.05),true);
 assert.equal(risk(ai,car(2.7,0),0,0,Math.PI/4,.05),true);
 assert.equal(risk(ai,ai,0,1,0,.05),false);
});
test('the selection is invariant under a world rotation',()=>{
 for(const angle of [0,.4,1.5,2.8]){
  const x=2.8*Math.cos(angle),z=-2.8*Math.sin(angle);
  const ai=car(0,0,angle);
  assert.equal(risk(ai,car(x,z,angle),Math.sin(angle)*.2,Math.cos(angle)*.2,angle,1/60),false);
 }
});

test('shared traffic probe matches original swept rectangles across motion and dense traffic',async()=>{
 const {createRaceAiTrafficProbe}=await import('../../src/racing/RaceAiTrafficBounds.js');
 const {raceAiTrafficNeedsDetailedPhysics:reference}=await import('./fixtures/raceAiTrafficBoundsReference.js');
 let seed=761;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(let i=0;i<2000;i++){
  const ai=car((random()-.5)*1e4,(random()-.5)*1e4,(random()-.5)*Math.PI*8);
  const dt=random()*.1,x=ai.worldX+(random()-.5)*20,z=ai.worldZ+(random()-.5)*20,yaw=ai.carYaw+(random()-.5)*7;
  const probe=createRaceAiTrafficProbe(ai,x,z,yaw,dt);
  for(let j=0;j<30;j++){
   const spread=j%2?10:200;
   const other=car(ai.worldX+(random()-.5)*spread,ai.worldZ+(random()-.5)*spread,(random()-.5)*Math.PI*8);
   const cfg=other.vehicleDynamicsRunner.config;
   cfg.bodyWidthM=.5+random()*3;cfg.bodyLengthM=1+random()*10;
   other.vehicleDynamicsRunner.state={velocity:{x:(random()-.5)*300,z:(random()-.5)*300},angularVelocityWorld:{y:(random()-.5)*20}};
   assert.equal(probe(other),reference(ai,other,x,z,yaw,dt),`scene ${i}, car ${j}`);
  }
 }
});

test('recorded mountain queue can separate without speculative padding or ignoring real hulls',()=>{
 const config={bodyWidthM:1.83,bodyLengthM:4.67};
 const lead={worldX:1370.7651103430067,worldZ:-926.9728343428682,carYaw:-1.3389034285811319,vehicleDynamicsRunner:{config}};
 const rear={worldX:1375.403324,worldZ:-925.755484,carYaw:-1.517228,vehicleDynamicsRunner:{config}};
 const x=lead.worldX+Math.sin(lead.carYaw)*.01,z=lead.worldZ+Math.cos(lead.carYaw)*.01;
 assert.equal(createRaceAiTrafficProbe(lead,x,z,lead.carYaw,.05,{clearance:.01})(rear),true);
 assert.equal(createRaceAiTrafficProbe(lead,x,z,lead.carYaw,.05,{clearance:0})(rear),false);
 assert.equal(createRaceAiTrafficProbe(lead,x,z,lead.carYaw,.05,{clearance:0})({...rear,worldX:lead.worldX,worldZ:lead.worldZ}),true);
});
