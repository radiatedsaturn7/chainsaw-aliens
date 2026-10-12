import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelDocument,addPrimitive,addVertex,joinPolygon,moveVertices,extrudeFaces,weldVertices,copyGeometry,pasteGeometry,deleteGeometry,generateUVMap,paintTexture,validateModelDocument,ModelHistory} from '../../src/model3d/ModelDocument.js';
import {addJoint,assignVerticesToJoint,addAnimation,setKeyframe,sampleAnimation,skinVertices,solveIK,jointMatrices} from '../../src/model3d/ModelRig.js';
import * as THREE from '../../src/vendorBridge/three.js';

test('all primitives produce editable indexed geometry that survives JSON serialization',()=>{
  for(const shape of ['box','sphere','cylinder','cone','plane','torus']){
    const model=createModelDocument();const selection=addPrimitive(model,shape);
    assert.ok(selection.vertices.length>=4);assert.ok(selection.faces.length>=2);validateModelDocument(JSON.parse(JSON.stringify(model)));
    if(shape==='box')assert.equal(model.vertices.length,8);
  }
});
test('extruding a connected face region preserves one cap and creates only boundary walls',()=>{
  const model=createModelDocument();const ids=[[0,0,0],[1,0,0],[1,1,0],[0,1,0]].map(p=>addVertex(model,p));
  const a=joinPolygon(model,[ids[0],ids[1],ids[2]]),b=joinPolygon(model,[ids[0],ids[2],ids[3]]);
  const result=extrudeFaces(model,[a,b],2);assert.equal(result.vertices.length,4);assert.equal(model.faces.length,6);
  for(const id of result.vertices)assert.equal(model.vertices.find(v=>v.id===id).position[2],2);
  assert.equal(model.faces.filter(f=>f.vertices.length===4).length,4);
});
test('weld merges vertices and removes degenerate faces without dangling references',()=>{
  const model=createModelDocument(),ids=addPrimitive(model,'box').vertices;
  const keep=weldVertices(model,ids.slice(0,2));assert.equal(model.vertices.length,7);assert.equal(keep,ids[0]);validateModelDocument(model);
});
test('symmetry applies X/Y/Z reflections and keeps center-plane vertices on their plane',()=>{
  const m=createModelDocument();m.symmetry={x:true,y:true,z:true};
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])addVertex(m,[x,y,z]);
  moveVertices(m,[m.vertices[0].id],[0.2,0.3,0.4]);
  for(const v of m.vertices)assert.deepEqual(v.position.map(Math.abs),[0.8,0.7,0.6]);
  const center=addVertex(m,[0,2,0]);moveVertices(m,[center],[1,1,1]);assert.deepEqual(m.vertices.at(-1).position,[0,3,0]);
});
test('copy cut mirror and history preserve topology and isolate snapshots',()=>{
  let m=createModelDocument();const history=new ModelHistory();const selection=history.apply(m,'Box',()=>addPrimitive(m,'box'));
  const clipboard=copyGeometry(m,selection);history.apply(m,'Cut',()=>deleteGeometry(m,selection));assert.equal(m.vertices.length,0);
  history.apply(m,'Mirror paste',()=>pasteGeometry(m,clipboard,{mirror:'x',offset:[2,0,0]}));assert.equal(m.vertices.length,8);
  m=history.restore(m);assert.equal(m.vertices.length,0);m=history.restore(m);assert.equal(m.vertices.length,8);
  const before=JSON.stringify(m);assert.throws(()=>history.apply(m,'Invalid',()=>joinPolygon(m,['missing','a','b'])));assert.equal(JSON.stringify(m),before);
});
test('UV atlas separates faces and painting edits the selected texture pixel',()=>{
  const m=createModelDocument();addPrimitive(m,'box');generateUVMap(m);
  for(const face of m.faces)for(const uv of face.uv)assert.ok(uv.every(n=>n>0&&n<1));
  paintTexture(m,'material-0',0,1,'#ff0000',0);assert.equal(m.materials[0].texture.pixels[0],'#ff0000');assert.equal(m.materials[0].texture.pixels[1],'#ffffff');
});
test('joint weights and quaternion animation deform vertices with the bind pose removed',()=>{
  const m=createModelDocument(),root=addJoint(m,[0,0,0]),child=addJoint(m,[1,0,0],root),vertex=addVertex(m,[2,0,0]);assignVerticesToJoint(m,[vertex],child);
  const clip=addAnimation(m);setKeyframe(m,clip,root,0,{});setKeyframe(m,clip,root,1,{rotation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI).toArray()});
  const point=skinVertices(m,sampleAnimation(m,clip,0.5))[0].position;assert.ok(Math.abs(point[0])<1e-6);assert.ok(Math.abs(point[1]-2)<1e-6);
  assert.deepEqual(skinVertices(m)[0].position,[2,0,0]);
});
test('optional IK solves a two-bone chain without changing its bind pose',()=>{
  const m=createModelDocument(),root=addJoint(m,[0,0,0]),mid=addJoint(m,[1,0,0],root),tip=addJoint(m,[2,0,0],mid);const before=JSON.stringify(m.joints);
  const pose=solveIK(m,{},tip,[1,1,0]);const point=new THREE.Vector3().setFromMatrixPosition(jointMatrices(m,pose).get(tip));
  assert.ok(point.distanceTo(new THREE.Vector3(1,1,0))<0.01);assert.equal(JSON.stringify(m.joints),before);
});

test('render meshes triangulate concave polygons and preserve UVs and animated vertex IDs',async()=>{
  const {buildModelObject,updateModelPose,disposeModelObject}=await import('../../src/model3d/ModelRender.js');
  const m=createModelDocument();const vertices=[[0,0,0],[2,0,0],[2,2,0],[1,1,0],[0,2,0]].map(p=>addVertex(m,p));joinPolygon(m,vertices);generateUVMap(m);
  const root=addJoint(m,[0,0,0]);assignVerticesToJoint(m,vertices,root);
  const mesh=buildModelObject(m);assert.equal(mesh.children[0].geometry.getAttribute('position').count,9);
  assert.equal(mesh.children[0].geometry.getAttribute('uv').count,9);
  updateModelPose(mesh,m,{pose:{[root]:{position:[0,0,3]}}});
  const positions=mesh.children[0].geometry.getAttribute('position');for(let i=0;i<positions.count;i++)assert.equal(positions.getZ(i),3);
  disposeModelObject(mesh);
});
