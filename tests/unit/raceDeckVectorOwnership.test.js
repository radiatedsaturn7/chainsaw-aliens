import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSurfaceModel } from '../../src/racing/RaceSurfaceModel.js';
import { sampleDeckAtDistance as before } from './fixtures/deckSampleBeforeScalarVectors.js';

test('deck scalar vectors preserve exact geometry, live edits and independent results',()=>{
 let pose, forward, side;
 const model=new RaceSurfaceModel({
  getWorldPoseAtDistance:()=>pose,
  getForwardVector:()=>forward,
  getRightVector:()=>side
 });
 const retained=[];
 for(let i=0;i<1000;i++) {
  pose={x:i,z:-i,yaw:i/17,grade:(i%41-20)/35,elevation:i/9,
   roadHalfWidth:2+i%5,segment:{banking:i%36,curve:i%2?1:-1}};
  forward=Object.freeze({x:Math.sin(pose.yaw)*2,z:-Math.cos(pose.yaw)*2,y:99});
  side=Object.freeze({x:Math.cos(pose.yaw)*3,z:Math.sin(pose.yaw)*3,y:99});
  if(i%37===0)forward=Object.freeze({x:0,z:0});
  const actual=model.sampleDeckAtDistance(i);
  assert.deepEqual(actual,before.call(model,i));
  assert.notEqual(actual.tangent,forward);
  assert.notEqual(actual.right,side);
  retained.push([actual,structuredClone(actual)]);
 }
 for(const [actual,expected] of retained)assert.deepEqual(actual,expected);
});
