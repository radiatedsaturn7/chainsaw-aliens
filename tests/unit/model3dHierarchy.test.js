import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {addJoint,addAnimation,setKeyframe,sampleAnimation,jointMatrices,reparentJoint,deleteJoint,assignVerticesToJoint} from '../../src/model3d/ModelRig.js';

test('reparenting preserves bind position and animated world motion while rejecting cycles',()=>{
  const model=createModelDocument(),root=addJoint(model,[1,0,0]),child=addJoint(model,[1,2,0],root),other=addJoint(model,[-2,0,0]);
  const clip=addAnimation(model,'Motion',1);setKeyframe(model,clip,root,0,{position:[1,0,0]});setKeyframe(model,clip,root,1,{position:[3,0,0]});
  const times=[0,0.25,0.5,0.75,1];
  const before=times.map(t=>jointMatrices(model,sampleAnimation(model,clip,t,{loop:false})).get(child).elements.slice());
  reparentJoint(model,child,other);
  for(const [i,t] of times.entries()){
    const after=jointMatrices(model,sampleAnimation(model,clip,t,{loop:false})).get(child).elements;
    after.forEach((n,index)=>assert.ok(Math.abs(n-before[i][index])<1e-6));
  }
  assert.throws(()=>reparentJoint(model,other,child),/descendant/);
  assert.equal(model.joints.find(j=>j.id===other).parent,null);
});
test('deleting a parent preserves children and removes invalid weights and tracks',()=>{
  const model=createModelDocument();addPrimitive(model,'box');const root=addJoint(model,[0,0,0]),child=addJoint(model,[0,2,0],root);
  const vertex=model.vertices[0];assignVerticesToJoint(model,[vertex.id],root,0.5);assignVerticesToJoint(model,[vertex.id],child,0.5);
  const clip=addAnimation(model,'Pose',1);setKeyframe(model,clip,root,0,{position:[0,0,0]});setKeyframe(model,clip,root,1,{position:[1,0,0]});
  deleteJoint(model,root);
  assert.equal(model.joints[0].parent,null);assert.deepEqual(model.joints[0].position,[0,2,0]);assert.deepEqual(vertex.weights,[{joint:child,weight:1}]);
  assert.equal(model.animations[0].tracks[root],undefined);assert.ok(model.animations[0].tracks[child].length>1);
});
