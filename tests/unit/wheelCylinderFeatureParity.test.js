import test from 'node:test';
import assert from 'node:assert/strict';
import {pointForFeature} from '../../src/racing/simulation/WheelCylinderCollision.js';
import {addVector3,scaleVector3} from '../../src/racing/simulation/RigidBodyMath.js';
test('wheel feature scalar construction preserves vector arithmetic exactly',()=>{
 let seed=597;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296-.5;};
 const vector=()=>({x:random()*10,y:random()*10,z:random()*10});
 for(let i=0;i<20000;i++){
  const cylinder={previousHubPositionWorld:vector(),hubPositionWorld:vector(),previousWheelForwardWorld:vector(),wheelForwardWorld:vector(),previousWheelLateralWorld:vector(),wheelLateralWorld:vector(),previousSuspensionAxisWorld:vector(),suspensionAxisWorld:vector(),radiusM:Math.abs(random())+.1};
  const feature={angleRad:random()*7,widthOffsetM:random()*.3};
  const actual=pointForFeature(cylinder,feature,random()+.5),pose=actual.pose;
  const radial=addVector3(scaleVector3(pose.forward,Math.cos(feature.angleRad)*cylinder.radiusM),scaleVector3(pose.suspension,Math.sin(feature.angleRad)*cylinder.radiusM));
  const point=addVector3(addVector3(pose.hub,radial),scaleVector3(pose.lateral,feature.widthOffsetM));
  assert.deepEqual(actual.radial,radial);assert.deepEqual(actual.point,point);
 }
});
