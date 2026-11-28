import test from 'node:test';
import assert from 'node:assert/strict';
import {raceAiPassingOffset} from '../../src/racing/RaceAiOvertaking.js';
const setup=()=>({ai:{id:'follower',worldX:0,worldZ:0,carYaw:0,difficulty:'hard'},leader:{id:'leader',worldX:0,worldZ:15,carYaw:0,speedMps:18}});
const options={desired:0,ownOffset:0,right:{x:1,z:0},pose:{x:0,z:10},laneLimit:4,width:1.8,speed:22,seconds:1/60};
const traffic=cars=>cars.map(car=>({...car,car}));
test('faster racer chooses and holds a passing side, then returns gradually after clearing',()=>{
 const {ai,leader}=setup();let last=0;
 for(let i=0;i<120;i++){
  const offset=raceAiPassingOffset(ai,traffic([leader]),options);
  assert.ok(Math.abs(offset-last)<=.020001);last=offset;
 }
 assert.ok(Math.abs(last)>2);const side=ai.overtakePlan.side;
 leader.worldX=.1;
 raceAiPassingOffset(ai,traffic([leader]),options);assert.equal(ai.overtakePlan.side,side);
 leader.worldZ=-12;
 const returning=raceAiPassingOffset(ai,traffic([leader]),options);
 assert.equal(ai.overtakePlan.active,false);assert.ok(Math.abs(returning)>2);
 for(let i=0;i<130;i++)raceAiPassingOffset(ai,traffic([leader]),options);
 assert.equal(ai.overtakePlan.offsetM,0);
});
test('no passing through occupied corridors, narrow roads or a dangerous section',()=>{
 for(const extras of [{laneLimit:1},{risk:.8},{enabled:false}]){
  const {ai,leader}=setup();assert.equal(raceAiPassingOffset(ai,traffic([leader]),{...options,...extras}),0);
 }
 const {ai,leader}=setup();
 const cars=[leader,{...leader,id:'left',worldX:-2.3,worldZ:3},{...leader,id:'right',worldX:2.3,worldZ:3}];
 assert.equal(raceAiPassingOffset(ai,traffic(cars),options),0);assert.equal(ai.overtakePlan.active,false);
});
test('a car on another bridge level cannot trigger a pass',()=>{
 const {ai,leader}=setup();ai.vehicleDynamicsRunner={state:{position:{y:0}}};leader.vehicleDynamicsRunner={state:{position:{y:10}}};
 assert.equal(raceAiPassingOffset(ai,traffic([leader]),options),0);
});
