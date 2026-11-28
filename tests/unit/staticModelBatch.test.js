import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {buildModelObject,disposeModelObject} from '../../src/model3d/ModelRender.js';
import {ModelAssetInstance,modelAssets} from '../../src/model3d/ModelAssets.js';
import {batchStaticDoodadModels} from '../../src/model3d/StaticModelBatch.js';
import {getRaceSceneryMeshStats} from '../../src/racing/RaceSceneryChunks.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
test('solid and binary-alpha model textures use opaque cutouts; fractional alpha retains blending',()=>{
 for(const [pixels,transparent] of [[null,false],[['#ffffff','#00000000',null],false],[['#ffffff80'],true]]){
  const m=createModelDocument();addPrimitive(m,'box');m.materials[0].texture=pixels?{width:pixels.length,height:1,pixels}:null;
  const root=buildModelObject(m);assert.equal(root.children[0].material.transparent,transparent);assert.equal(root.children[0].material.side,THREE.DoubleSide);assert.equal(root.children[0].material.alphaTest,.01);disposeModelObject(root);
 }
});
test('repeated static models share draws while preserving every world transform and triangle',()=>{
 const model=createModelDocument();addPrimitive(model,'box');const group=new THREE.Group();const placements=[];
 for(let i=0;i<4;i++){
  const instance=new ModelAssetInstance();instance.setModel(model,{ref:'tree',position:[1,0,0],rotation:[0,.1,0]});
  const p=new THREE.Group();p.position.set(i*10,i,5);p.rotation.y=i*.2;p.scale.set(2,3,2);p.add(instance.object);p.userData={modelInstance:instance,staticDoodadModel:true,spriteId:`p${i}`};group.add(p);placements.push(p);
 }
 group.updateMatrixWorld(true);const matrices=placements.map(p=>p.userData.modelInstance.root.children[0].matrixWorld.clone());
 const before=getRaceSceneryMeshStats(group);batchStaticDoodadModels(group);const after=getRaceSceneryMeshStats(group);
 assert.equal(after.drawCalls,1);assert.equal(before.drawCalls,4);assert.equal(after.polygons,before.polygons);
 const batch=group.children.find(c=>c.isInstancedMesh);assert.equal(batch.count,4);assert.deepEqual(batch.userData.spriteIds,['p0','p1','p2','p3']);
 for(let i=0;i<4;i++){const actual=new THREE.Matrix4();batch.getMatrixAt(i,actual);actual.elements.forEach((v,j)=>assert.ok(Math.abs(v-matrices[i].elements[j])<1e-5));}
 const renderer={scene:new THREE.Scene(),dynamicDoodadGroup:group};renderer.scene.add(group);RaceEditor.prototype.clearRaceThreeDynamicDoodads.call({},renderer);assert.ok(placements.every(p=>p.userData.modelInstance.root===null));
});
test('animated, transparent and reflected models remain separate',()=>{
 for(const mode of ['animated','transparent','reflected']){
  const model=createModelDocument();addPrimitive(model,'box');if(mode==='transparent')model.materials[0].texture={width:1,height:1,pixels:['#ffffff80']};
  const group=new THREE.Group();for(let i=0;i<2;i++){const instance=new ModelAssetInstance();instance.setModel(model,{ref:'prop'});const p=new THREE.Group();p.add(instance.object);if(mode==='reflected')p.scale.x=-1;p.userData={modelInstance:instance,staticDoodadModel:mode!=='animated'};group.add(p);}
  batchStaticDoodadModels(group);assert.equal(group.children.some(c=>c.isInstancedMesh),false);for(const p of group.children)p.userData.modelInstance.dispose();
 }
});
test('flat scenery sprites render both sides in one pass',()=>{
 const e=Object.create(RaceEditor.prototype);e.getRaceThreeTexture=()=>new THREE.Texture();const material=e.getRaceThreeDoodadMaterial({},'tree');assert.equal(material.forceSinglePass,true);assert.equal(material.side,THREE.DoubleSide);assert.equal(material.transparent,true);
});
test('removing a batched prop rebuilds remaining instances without leaving a ghost',()=>{
 const model=createModelDocument();addPrimitive(model,'box');modelAssets.adopt('Batch test prop',{data:model});
 const e=new RaceEditor({});const sprites=Array.from({length:4},(_,i)=>({id:`prop${i}`,presetId:'doodad',x:i*10,z:9,yaw:.2,previewDoodad:{model:{ref:'Batch test prop'},artRef:'fallback',widthM:3,heightM:5}}));
 e.ensureRaceScenery=()=>sprites;e.getSelectedRaceRuntimeType=()=> 'circuit';e.getRaceRouteLength=()=>100;e.getRaceSurfaceGeometryRevisionKey=()=> 'ground';e.getRaceArtSpriteCanvas=()=>null;
 e.sampleRaceDoodadGroundPoint=(x,z)=>({x,z,elevation:0});const renderer={scene:new THREE.Scene()};
 try {
  assert.equal(e.addRaceThreeDoodads(renderer),true);
  const oldGroup=renderer.dynamicDoodadGroup;const oldBatch=oldGroup.children.find(c=>c.isInstancedMesh);assert.equal(oldBatch.count,4);
  let disposed=0;oldBatch.addEventListener('dispose',()=>disposed++);
  e.playtestSession={removedSceneryIds:['prop0']};assert.equal(e.addRaceThreeDoodads(renderer),true);
  const batch=renderer.dynamicDoodadGroup.children.find(c=>c.isInstancedMesh);assert.equal(batch.count,3);assert.deepEqual(batch.userData.spriteIds,['prop1','prop2','prop3']);assert.equal(disposed,1);
  assert.equal(renderer.scene.children.includes(oldGroup),false);assert.equal(renderer.dynamicDoodadDrawCalls,1);
 } finally {e.clearRaceThreeDynamicDoodads(renderer);modelAssets.entries.delete('Batch test prop');}
});
