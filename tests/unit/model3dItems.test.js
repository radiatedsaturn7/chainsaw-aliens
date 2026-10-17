import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {normalizeItemDocument,serializeItemDocument} from '../../src/items/ItemDocument.js';
import ItemEditor from '../../src/ui/ItemEditor.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import World from '../../src/world/World.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {addJoint,assignVerticesToJoint,addAnimation,setKeyframe} from '../../src/model3d/ModelRig.js';
import {modelAssets} from '../../src/model3d/ModelAssets.js';

test('item model, selected animation and transform survive item and level serialization and history',async()=>{
 const item=normalizeItemDocument({name:'Crystal',model:{ref:'Crystal',clip:'Idle',speed:2,scale:[1,2,1]},effects:[{type:'health'}]});
 assert.deepEqual(normalizeItemDocument(JSON.parse(JSON.stringify(serializeItemDocument(item)))),item);
 const world=new World();world.applyData({tileSize:32,width:2,height:1,tiles:['..'],decals:[{id:'crystal',itemType:'item',item,model:item.model,x:0,y:0,w:32,h:48}]});
 const copy=new World();copy.applyData(JSON.parse(JSON.stringify(world.data)));assert.deepEqual(copy.decals[0].model,item.model);
 const editor=new ItemEditor({});editor.loadDoodadDocument(item);await editor.change(()=>{editor.doodad.model.clip='Rise';});editor.undo();assert.equal(editor.doodad.model.clip,'Idle');editor.redo();assert.equal(editor.doodad.model.clip,'Rise');
 assert.ok(editor.getMenuItems('artwork').some(row=>row.id==='item-model-animation'&&!row.disabled));
});
test('race items use the selected clip on real model geometry and disappear after collection',()=>{
 const model=createModelDocument('Crystal'),geometry=addPrimitive(model,'box'),joint=addJoint(model,[0,0,0]);assignVerticesToJoint(model,geometry.vertices,joint);
 const idle=addAnimation(model,'Idle',1),rise=addAnimation(model,'Rise',1);setKeyframe(model,idle,joint,0,{position:[0,0,0]});setKeyframe(model,rise,joint,0,{position:[0,0,0]});setKeyframe(model,rise,joint,1,{position:[0,1,0]});modelAssets.adopt('Item Crystal',model);
 const item=normalizeItemDocument({name:'Crystal',model:{ref:'Item Crystal',clip:rise},widthM:2,heightM:3}),sprite={id:'crystal',presetId:'doodad',itemType:'item',item,x:4,z:9};
 const e=new RaceEditor({});e.ensureRaceScenery=()=>[sprite];e.getSelectedRaceRuntimeType=()=> 'circuit';e.getRaceRouteLength=()=>100;e.getRaceSurfaceGeometryRevisionKey=()=> 'ground';e.getRaceArtSpriteCanvas=()=>null;e.sampleRaceDoodadGroundPoint=(x,z)=>({x,z,elevation:0});e.playtestSession={elapsedMs:0};
 const renderer={scene:new THREE.Scene()};
 try{
  e.addRaceThreeDoodads(renderer);const group=renderer.dynamicDoodadGroup,instance=group.children[0].userData.modelInstance;
  assert.equal(instance.binding.clip,rise);const positions=()=>Array.from(instance.root.children[0].geometry.attributes.position.array);const before=positions();
  e.playtestSession.elapsedMs=500;e.addRaceThreeDoodads(renderer);assert.equal(renderer.dynamicDoodadGroup,group);assert.notDeepEqual(positions(),before);
  e.playtestSession.removedSceneryIds=['crystal'];e.addRaceThreeDoodads(renderer);assert.equal(instance.root,null);
 }finally{modelAssets.entries.delete('Item Crystal');}
});
