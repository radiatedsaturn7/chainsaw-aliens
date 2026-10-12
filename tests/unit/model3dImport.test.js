import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {convertGLTFScene,importGLTFFiles} from '../../src/model3d/ModelGLTF.js';
import {skinVertices,sampleAnimation} from '../../src/model3d/ModelRig.js';

test('glTF scene conversion preserves transformed meshes and object animation',()=>{
  const scene=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#7799bb'}));mesh.name='Box';mesh.position.x=2;scene.add(mesh);
  const clip=new THREE.AnimationClip('Move',1,[new THREE.VectorKeyframeTrack('Box.position',[0,1],[2,0,0,4,0,0])]);
  const model=convertGLTFScene({scene,animations:[clip]},'Box');assert.equal(model.animations.length,1);assert.equal(model.faces.length,12);
  const rest=skinVertices(model),posed=skinVertices(model,sampleAnimation(model,model.animations[0].id,0.5));
  for(let i=0;i<rest.length;i++)assert.ok(Math.abs(posed[i].position[0]-rest[i].position[0]-1)<1e-6);
});
test('glTF scene conversion preserves skin weights and bone animation',()=>{
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([1,0,0,2,0,0,1,1,0],3));geometry.setIndex([0,1,2]);
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const scene=new THREE.Group(),mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial()),bone=new THREE.Bone();bone.name='RootBone';mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));scene.add(mesh);
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
  const clip=new THREE.AnimationClip('Turn',1,[new THREE.QuaternionKeyframeTrack('RootBone.quaternion',[0,1],[0,0,0,1,...rotation.toArray()])]);
  const model=convertGLTFScene({scene,animations:[clip]});const posed=skinVertices(model,sampleAnimation(model,model.animations[0].id,1,{loop:false}));
  assert.ok(Math.abs(posed[0].position[0])<1e-5);assert.ok(Math.abs(posed[0].position[1]-1)<1e-5);
});
test('self-contained glTF input parses into editable triangles',async()=>{
  const bytes=new Float32Array([0,0,0,1,0,0,0,1,0]);
  const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:'data:application/octet-stream;base64,'+Buffer.from(bytes.buffer).toString('base64'),byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]};
  const old=globalThis.ProgressEvent;globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,values);}};
  try{const model=await importGLTFFiles([{name:'triangle.gltf',arrayBuffer:async()=>new TextEncoder().encode(JSON.stringify(doc)).buffer}]);assert.equal(model.faces.length,1);assert.equal(model.vertices.length,3);}finally{globalThis.ProgressEvent=old;}
});
