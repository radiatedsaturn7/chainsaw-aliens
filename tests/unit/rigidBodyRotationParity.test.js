import test from 'node:test';
import assert from 'node:assert/strict';
import {rotateVectorByQuaternion,normalizeQuaternion,addVector3,scaleVector3,crossVector3} from '../../src/racing/simulation/RigidBodyMath.js';
function reference(value={},orientation={}) {
 const q=normalizeQuaternion(orientation);
  const vector = {
    x: Number(value.x || 0),
    y: Number(value.y || 0),
    z: Number(value.z || 0)
  };
  const quaternionVector = { x: q.x, y: q.y, z: q.z };
  const twiceCross = scaleVector3(crossVector3(quaternionVector, vector), 2);
  return addVector3(
    vector,
    addVector3(
      scaleVector3(twiceCross, q.w),
      crossVector3(quaternionVector, twiceCross)
    )
  );
}
test('scalar quaternion rotation exactly preserves vector reference results',()=>{
 let seed=193;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296-.5;};
 for(let i=0;i<20000;i++){
  const v={x:random()*100,y:random()*100,z:random()*100};
  const q={x:random(),y:random(),z:random(),w:random()};
  assert.deepEqual(rotateVectorByQuaternion(v,q),reference(v,q));
 }
 for(const v of [{},{x:0,y:-0,z:0},{x:Infinity},{y:NaN},{z:'bad'},{x:1e300,y:1e300,z:1e300}]){
  for(const q of [{},{x:0,y:0,z:0,w:0},{x:Infinity},{w:NaN},{x:1e300,y:1e300,z:1e300,w:1e300}]){
   assert.deepEqual(rotateVectorByQuaternion(v,q),reference(v,q));
  }
 }
});

test('rotation can reuse an output vector, including aliasing and invalid inputs',()=>{
 const target={};
 for(const value of [{x:1,y:2,z:3},{x:0,y:-0,z:1},{x:NaN,y:Infinity,z:3}]){
  for(const orientation of [{x:.2,y:.5,z:.7,w:1},{x:Infinity},{w:0}]){
   const expected=reference(value,orientation);
   assert.strictEqual(rotateVectorByQuaternion(value,orientation,target),target);
   assert.deepEqual(target,expected);
   const alias={...value};
   assert.strictEqual(rotateVectorByQuaternion(alias,orientation,alias),alias);
   assert.deepEqual(alias,expected);
  }
 }
});
