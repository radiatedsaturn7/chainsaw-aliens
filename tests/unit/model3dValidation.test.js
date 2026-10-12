import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelDocument,addPrimitive,addVertex,validateModelDocument} from '../../src/model3d/ModelDocument.js';
import {addJoint,addAnimation,setKeyframe} from '../../src/model3d/ModelRig.js';

test('native import repairs stale id allocation without colliding with existing topology',()=>{
  const model=createModelDocument();addPrimitive(model,'box');delete model.nextId;validateModelDocument(model);
  const previous=new Set(model.vertices.map(v=>v.id));assert.equal(previous.has(addVertex(model,[2,3,4])),false);
});
test('native validation rejects broken topology, cyclic rigs, invalid animation and texture data',()=>{
  const base=createModelDocument();addPrimitive(base,'box');const a=addJoint(base,[0,0,0]),b=addJoint(base,[0,1,0],a),clip=addAnimation(base,'Pose',1);setKeyframe(base,clip,a,0,{});
  for(const mutate of [m=>m.faces[0].vertices[0]='missing',m=>m.faces[0].material='missing',m=>m.faces[0].uv[0][0]=NaN,m=>m.joints[0].parent=b,m=>m.vertices[0].weights=[{joint:'missing',weight:1}],m=>m.animations[0].tracks[a][0].time=5,m=>m.materials[0].texture={width:2,height:2,pixels:[]}]){
    const model=structuredClone(base);mutate(model);assert.throws(()=>validateModelDocument(model));
  }
});
