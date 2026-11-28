import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {convertGLTFScene,importGLTFFiles} from '../../src/model3d/ModelGLTF.js';
import {buildModelObject,modelMaterialNeedsBlending} from '../../src/model3d/ModelRender.js';
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

test('binary GLB imports geometry and an animation clip through the file loader',async()=>{
  const bin=Buffer.from(new Float32Array([
    0,0,0,1,0,0,0,1,0, // triangle
    0,1, // key times
    0,0,0,0,2,0 // translations
  ]).buffer);
  const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Moving triangle',mesh:0}],
    extensionsUsed:['KHR_materials_clearcoat'],
    materials:[{name:'Imported coat',pbrMetallicRoughness:{baseColorFactor:[.05,.18,.4,1],metallicFactor:.43,roughnessFactor:.24},
      extensions:{KHR_materials_clearcoat:{clearcoatFactor:.81,clearcoatRoughnessFactor:.07}}}],
    meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],buffers:[{byteLength:bin.length}],
    bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:8},{buffer:0,byteOffset:44,byteLength:24}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]},
      {bufferView:1,componentType:5126,count:2,type:'SCALAR',min:[0],max:[1]},
      {bufferView:2,componentType:5126,count:2,type:'VEC3'}],
    animations:[{name:'Rise',samplers:[{input:1,output:2,interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:0,path:'translation'}}]}]};
  const json=Buffer.from(JSON.stringify(doc));const padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(padded);
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+padded.length+8+bin.length,8);
  const chunk=(data,type)=>{const h=Buffer.alloc(8);h.writeUInt32LE(data.length,0);h.writeUInt32LE(type,4);return Buffer.concat([h,data]);};
  const glb=Buffer.concat([header,chunk(padded,0x4e4f534a),chunk(bin,0x004e4942)]);
  const model=await importGLTFFiles([{name:'animated.glb',arrayBuffer:async()=>glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength)}]);
  assert.equal(model.faces.length,1);assert.equal(model.animations[0].name,'Rise');
  const spec=model.materials.find(m=>m.name==='Imported coat').automotive;
  assert.equal(spec.preset,'gltf-pbr');assert.equal(spec.roughness,.24);assert.equal(spec.metalness,.43);
  assert.equal(spec.clearcoat,.81);assert.equal(spec.clearcoatRoughness,.07);
  const before=skinVertices(model),after=skinVertices(model,sampleAnimation(model,model.animations[0].id,0.5));
  assert.ok(Math.abs(after[0].position[1]-before[0].position[1]-1)<1e-6);
});


test('compatible glTF materials survive native JSON round-trip and vehicle material assignment',()=>{
  const tex=rgba=>new THREE.DataTexture(new Uint8Array(rgba),2,1);
  const base=tex([18,75,154,0,18,75,154,255]);
  const orm=tex([64,128,192,255,32,96,160,255]);
  const ao=tex([22,5,10,255,220,50,100,255]);
  const normal=tex([129,147,250,255,128,128,255,255]);
  const input=new THREE.MeshPhysicalMaterial({name:'Paint with cutouts',color:'#124b9a',map:base,
    metalness:.42,roughness:.29,clearcoat:.9,clearcoatRoughness:.067,ior:1.44,
    alphaTest:.53,emissive:'#002244',emissiveIntensity:.61,
    roughnessMap:orm,metalnessMap:orm,aoMap:ao,aoMapIntensity:.66,
    normalMap:normal,normalScale:new THREE.Vector2(.6,-.8)});
  const scene=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(),input);
  mesh.scale.x=-1;scene.add(mesh);
  const model=JSON.parse(JSON.stringify(convertGLTFScene({scene})));
  const m=model.materials.find(m=>m.name===input.name);
  assert.equal(m.color,'#124b9a');
  assert.deepEqual(m.texture.pixels,['#124b9a00','#124b9aff']);
  assert.deepEqual(m.automotive.orm.pixels,['#1680c0','#dc60a0']);
  assert.deepEqual(m.automotive.normal.pixels,['#8193faff','#8080ffff']);
  assert.deepEqual(m.automotive.normalScale,[.6,.8]);
  const meshGeo=buildModelObject(model,{automotive:true}).children.find(n=>n.material.name===input.name);
  const actual=meshGeo.material;
  for(const key of ['metalness','roughness','clearcoat','clearcoatRoughness','ior','alphaTest','emissiveIntensity','aoMapIntensity'])
    assert.equal(actual[key],input[key]);
  assert.equal(actual.emissive.getHexString(),input.emissive.getHexString());
  assert.equal(actual.map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(actual.normalMap.colorSpace,THREE.NoColorSpace);
  assert.equal(actual.aoMap.colorSpace,THREE.NoColorSpace);
  assert.equal(actual.transparent,false);
  assert.equal(actual.depthWrite,true);
  assert.equal(actual.side,THREE.FrontSide);
  const {position,normal:n}=meshGeo.geometry.attributes;
  const vertex=i=>new THREE.Vector3().fromBufferAttribute(position,i);
  assert.ok(vertex(1).sub(vertex(0)).cross(vertex(2).sub(vertex(0))).dot(new THREE.Vector3().fromBufferAttribute(n,0))>0);
});

test('glTF authored float alpha is preserved while legacy binary pixel cutouts stay opaque',()=>{
  const doc=convertGLTFScene({scene:new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({
    color:'#aabeff',name:'Blend panel',transparent:true,opacity:.63,side:THREE.DoubleSide
  }))});
  const material=doc.materials.find(m=>m.name==='Blend panel');
  const native=buildModelObject(doc,{automotive:true}).children[0].material;
  assert.equal(modelMaterialNeedsBlending(material),true);
  assert.equal(native.opacity,.63);assert.equal(native.transparent,true);assert.equal(native.depthWrite,false);
  assert.equal(native.side,THREE.DoubleSide);
  assert.equal(modelMaterialNeedsBlending({texture:{pixels:['#12345600','#123456ff']}}),false);
});
