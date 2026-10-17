import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {normalizeRaceDoodadDocument,serializeRaceDoodadDocument} from '../../src/racing/raceDoodads.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {modelAssets} from '../../src/model3d/ModelAssets.js';

test('model doodads persist, fit authored dimensions, cache geometry and disappear after collisions',()=>{
  const model=createModelDocument();addPrimitive(model,'box');modelAssets.adopt('Doodad Model',{data:model});
  const doodad=normalizeRaceDoodadDocument({name:'Model tree',widthM:3,heightM:5,model:{ref:'Doodad Model'}});
  assert.deepEqual(normalizeRaceDoodadDocument(JSON.parse(JSON.stringify(serializeRaceDoodadDocument(doodad)))).model,doodad.model);
  const e=new RaceEditor({}),sprite={id:'tree',presetId:'doodad',x:4,z:9,yaw:0.3,previewDoodad:doodad};
  e.ensureRaceScenery=()=>[sprite];e.getSelectedRaceRuntimeType=()=> 'circuit';e.getRaceRouteLength=()=>100;
  e.getRaceSurfaceGeometryRevisionKey=()=> 'ground';e.getRaceArtSpriteCanvas=()=>null;
  e.sampleRaceDoodadGroundPoint=(x,z)=>({x,z,elevation:0});
  const renderer={scene:new THREE.Scene()};
  try{
    assert.equal(e.addRaceThreeDoodads(renderer),true);
    const group=renderer.dynamicDoodadGroup,placement=group.children[0],instance=placement.userData.modelInstance;
    assert.ok(instance);assert.equal(placement.position.x,4);assert.equal(placement.position.z,9);assert.equal(placement.rotation.y,0.3);
    assert.ok(renderer.scene.userData.rtgModelLights,'lit materials have scene lighting');
    const size=new THREE.Box3().setFromObject(instance.object).getSize(new THREE.Vector3());assert.ok(Math.abs(size.x-3)<1e-6);assert.ok(Math.abs(size.y-5)<1e-6);
    e.addRaceThreeDoodads(renderer);assert.equal(renderer.dynamicDoodadGroup,group);
    e.playtestSession={removedSceneryIds:['tree']};assert.equal(e.addRaceThreeDoodads(renderer),false);assert.equal(instance.root,null);
  }finally{modelAssets.entries.delete('Doodad Model');}
});

test('mix tape artwork rotates around its placement without rebuilding cached WebGL geometry',()=>{
  const e=new RaceEditor({}),sprite={id:'tape',presetId:'doodad',x:4,z:9,yaw:0,previewDoodad:{itemType:'mix-tape',artRef:'Cassette',widthM:2,heightM:1,unlockTrackId:'song'}};
  e.ensureRaceScenery=()=>[sprite];e.getSelectedRaceRuntimeType=()=> 'circuit';e.getRaceRouteLength=()=>100;e.getRaceSurfaceGeometryRevisionKey=()=> 'ground';e.getRaceArtSpriteCanvas=()=>null;
  e.sampleRaceDoodadGroundPoint=(x,z)=>({x,z,elevation:0});e.getRaceThreeDoodadMaterial=()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide});e.playtestSession={elapsedMs:0};
  const renderer={scene:new THREE.Scene()};assert.equal(e.addRaceThreeDoodads(renderer),true);const group=renderer.dynamicDoodadGroup,mesh=group.children[0],geometry=mesh.geometry;
  assert.equal(mesh.position.x,4);assert.equal(mesh.position.z,9);assert.equal(mesh.rotation.y,0);
  e.playtestSession.elapsedMs=1000;e.addRaceThreeDoodads(renderer);assert.equal(renderer.dynamicDoodadGroup,group);assert.equal(mesh.geometry,geometry);assert.equal(mesh.rotation.y,Math.PI*0.75);
  e.playtestSession.removedSceneryIds=['tape'];assert.equal(e.addRaceThreeDoodads(renderer),false);
});
