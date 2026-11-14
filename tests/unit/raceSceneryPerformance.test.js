import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
import * as THREE from '../../src/vendorBridge/three.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {modelAssets} from '../../src/model3d/ModelAssets.js';
import {RaceCarRestFrames} from '../../src/racing/RaceCarRestFrames.js';
import {RaceCarDepthSprites} from '../../src/racing/RaceCarDepthSprites.js';

test('playtest scenery caches definitions and keys but invalidates transforms, assets and sessions',()=>{
 const e=new RaceEditor({});
 const sprites=buildRaceFencePlacements([{x:0,z:0},{x:400,z:0}],{isFence:true,widthM:10,heightM:4,artRef:'tree'});
 e.playtestSession={routeRuntimeType:'network',routeLength:1000,worldBake:{surfaceRevision:'surface'}};
 let revision='art-1',lookups=0;e.getRaceArtSpriteCanvas=()=>{lookups++;return{__raceArtCacheKey:revision};};
 const a=e.getRaceThreeDoodadSceneKey(sprites),definition=e.getRaceDoodadForScenery(sprites[0]);
 lookups=0;assert.equal(e.getRaceThreeDoodadSceneKey(sprites),a);assert.equal(lookups,1);
 assert.equal(e.getRaceDoodadForScenery(sprites[0]),definition);
 sprites[0].x+=5;const b=e.getRaceThreeDoodadSceneKey(sprites);assert.notEqual(a,b);
 revision='art-2';assert.notEqual(e.getRaceThreeDoodadSceneKey(sprites),b);
 assert.notEqual(e.getRaceThreeDoodadSceneKey(sprites.slice(1)),e.getRaceThreeDoodadSceneKey(sprites));
 e.playtestSession={...e.playtestSession};assert.notEqual(e.getRaceDoodadForScenery(sprites[0]),definition);
 e.playtestSession=null;sprites[0].previewDoodad.heightM=9;assert.equal(e.getRaceDoodadForScenery(sprites[0]).heightM,9);
});

test('long fences use bounded spatial meshes with all panels retained',()=>{
 const e=new RaceEditor({});
 const sprites=buildRaceFencePlacements([{x:0,z:0},{x:1000,z:0}],{isFence:true,widthM:10,heightM:4,artRef:'tree'});
 e.ensureRaceScenery=()=>sprites;e.getRaceSurfaceModel=()=>({sampleWorld:()=>({elevation:0})});
 e.getRaceThreeDoodadSceneKey=()=> 'test';e.getRaceThreeDoodadMaterial=()=>new THREE.MeshBasicMaterial();
 e.addRaceThreeDoodadHitboxMeshes=()=>{};
 const renderer={scene:new THREE.Scene()};assert.equal(e.addRaceThreeDoodads(renderer),true);
 const meshes=renderer.dynamicDoodadGroup.children;
 assert.ok(meshes.length>=8);assert.equal(meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),sprites.length*6);
 for(const mesh of meshes)assert.ok(mesh.geometry.boundingSphere.radius<70);
});

test('indexed road clearance matches exhaustive tests at bends, crossings and elevations',async()=>{
 const {roadEdgeOverlapsRoad,createRoadCorridorIndex}=await import('../../src/racing/RaceRoadEdgeClearance.js');
 const corridors=Array.from({length:500},(_,i)=>({from:{x:Math.sin(i)*300,z:Math.cos(i*1.7)*300,y:i%3*8},to:{x:Math.sin(i+.02)*300,z:Math.cos((i+.02)*1.7)*300,y:i%3*8},halfWidth:2+i%10}));
 const index=createRoadCorridorIndex(corridors);
 for(let i=0;i<1000;i++){
  const wall={center:{x:Math.sin(i*3.1)*320,z:Math.cos(i*1.3)*320,y:i%4*6},yaw:i*.7,size:{x:.4,y:6,z:4+i%12}};
  assert.equal(roadEdgeOverlapsRoad(wall,index),roadEdgeOverlapsRoad(wall,corridors),`wall ${i}`);
 }
});

test('editor map projections share a draw cache but refresh after panning and geometry edits',()=>{
 const e=new RaceEditor({});const bounds={x:10,y:20,w:960,h:540};
 e.selectedRace.road.network={nodes:[{x:0,z:0,heightM:0},{x:100,z:100,heightM:0}],edges:[]};
 let results=[];
 e.drawRaceTopDownEditorContents=()=>{
  const points=e.getRaceRawMapPoints();assert.equal(e.getRaceRawMapPoints(),points);
  assert.equal(e.getRaceMapTransform(bounds),e.getRaceMapTransform(bounds));
  results.push(e.raceMapWorldToScreenPoint({x:50,y:50},bounds));
 };
 e.raceMapPan={x:0,y:0};e.drawRaceTopDownEditor({},bounds);assert.equal(e.raceMapDrawFrame,undefined);
 e.raceMapPan={x:40,y:20};e.drawRaceTopDownEditor({},bounds);
 assert.equal(results[1].screenX-results[0].screenX,40);assert.equal(results[1].screenY-results[0].screenY,20);
 e.selectedRace.road.network.nodes[0].x=7;
 e.drawRaceTopDownEditorContents=()=>assert.equal(e.getRaceRawMapPoints()[0].x,7);
 e.drawRaceTopDownEditor({},bounds);
 e.drawRaceTopDownEditorContents=()=>{throw Error('draw failed');};
 assert.throws(()=>e.drawRaceTopDownEditor({},bounds));assert.equal(e.raceMapDrawFrame,undefined);
});

test('map draws a long authored fence as one path and retains legacy panels and removed gaps',()=>{
 const e=new RaceEditor({});const points=[{x:0,z:0},{x:1000,z:0},{x:1000,z:1000}];
 e.selectedRace.scenery=buildRaceFencePlacements(points,{isFence:true,widthM:10,heightM:4},{id:'long'});
 let strokes=0,lines=0;
 const ctx=new Proxy({stroke(){strokes++;},lineTo(){lines++;}},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 e.raceMapWorldToScreenPoint=p=>({screenX:p.x,screenY:p.y,scale:1});
 e.drawRaceTopDownScenerySprites(ctx,{x:0,y:0,w:960,h:540});
 assert.equal(strokes,1);assert.equal(lines,2);
 e.selectedRace.scenery[1].state='removed';strokes=0;
 e.drawRaceTopDownScenerySprites(ctx,{x:0,y:0,w:960,h:540});assert.equal(strokes,e.selectedRace.scenery.length-1);
 delete e.selectedRace.scenery[0].fencePath;strokes=0;
 e.drawRaceTopDownScenerySprites(ctx,{x:0,y:0,w:960,h:540});assert.equal(strokes,e.selectedRace.scenery.length-1);
});

test('dense stationary trees share spatial batches while rotating items stay separate',()=>{
 const e=new RaceEditor({});
 const sprites=Array.from({length:500},(_,i)=>({id:`tree-${i}`,presetId:'doodad',x:i%25*8,z:Math.floor(i/25)*8,previewDoodad:{artRef:'tree',widthM:5,heightM:12,itemType:'scenery'}}));
 sprites.push({id:'item',presetId:'doodad',x:0,z:0,previewDoodad:{artRef:'item',widthM:2,heightM:2,itemType:'mix-tape'}});
 e.ensureRaceScenery=()=>sprites;e.getRaceSurfaceModel=()=>({sampleWorld:()=>({elevation:0})});
 e.getRaceThreeDoodadSceneKey=()=> 'trees';e.getRaceThreeDoodadMaterial=()=>new THREE.MeshBasicMaterial();e.addRaceThreeDoodadHitboxMeshes=()=>{};
 const renderer={scene:new THREE.Scene()};e.addRaceThreeDoodads(renderer);
 assert.ok(renderer.dynamicDoodadGroup.children.length<10);
 assert.equal(renderer.dynamicDoodadGroup.children.reduce((n,m)=>n+m.geometry.attributes.position.count,0),sprites.length*6);
 assert.equal(renderer.dynamicDoodadGroup.children.filter(m=>m.userData.mixTape).length,1);
});

import {getVisibleRaceDoodadSprites} from '../../src/racing/RaceVisibleScenery.js';
import {
 prepareManagedRaceScenery,getManagedRaceScenery,getProjectedRaceScenerySprites,
 invalidateRaceSceneryPresentation,releaseManagedRaceScenery,getManagedRaceSceneryVersion
} from '../../src/racing/RaceVisibleScenery.js';
test('visible scenery reuses its list without hiding in-place edits or collected items',()=>{
 const sprites=Array.from({length:18000},(_,i)=>({id:String(i),presetId:'doodad',state:'standing'}));
 const session={removedSceneryIds:[],flattenedSceneryIds:[]};
 const list=getVisibleRaceDoodadSprites(sprites,session);
 assert.equal(getVisibleRaceDoodadSprites(sprites,session),list);assert.equal(list.length,18000);
 sprites[5].state='removed';session.removedSceneryIds.push('6');session.flattenedSceneryIds.push('7');
 getVisibleRaceDoodadSprites(sprites,session);assert.equal(list.length,17997);
 assert.ok(!list.includes(sprites[5])&&!list.includes(sprites[6])&&!list.includes(sprites[7]));
 sprites[5].state='standing';session.removedSceneryIds[0]='8';
 getVisibleRaceDoodadSprites(sprites,session);assert.ok(list.includes(sprites[5])&&list.includes(sprites[6]));assert.ok(!list.includes(sprites[8]));
 assert.notEqual(getVisibleRaceDoodadSprites(sprites,{}),list);
});

test('cached static doodad batches skip animation traversal while rotating items still animate',()=>{
 const e=new RaceEditor({});e.playtestSession={elapsedMs:0};
 const sprites=[{id:'bush',presetId:'doodad',x:5,z:5,previewDoodad:{artRef:'bush',widthM:2,heightM:2}},
 {id:'tape',presetId:'doodad',x:0,z:0,previewDoodad:{artRef:'tape',widthM:1,heightM:1,itemType:'mix-tape'}}];
 e.ensureRaceScenery=()=>sprites;e.getRaceSurfaceModel=()=>({sampleWorld:()=>({elevation:0})});
 e.getRaceThreeDoodadSceneKey=()=> 'stable';e.getRaceThreeDoodadMaterial=()=>new THREE.MeshBasicMaterial();e.addRaceThreeDoodadHitboxMeshes=()=>{};
 const renderer={scene:new THREE.Scene()};e.addRaceThreeDoodads(renderer);
 assert.equal(renderer.dynamicDoodadAnimations.length,1);
 const animated=renderer.dynamicDoodadAnimations[0],before=animated.rotation.y;
 renderer.dynamicDoodadGroup.traverse=()=>{throw Error('static tree traversed on cache hit');};
 e.playtestSession.elapsedMs=1000;e.addRaceThreeDoodads(renderer);assert.notEqual(animated.rotation.y,before);
});

test('scene-key validation still detects every tracked placement mutation without asset churn',()=>{
 const e=new RaceEditor({});
 e.playtestSession={routeRuntimeType:'network',routeLength:1000,worldBake:{surfaceRevision:'surface'}};
 e.getRaceArtSpriteCanvas=()=>({__raceArtCacheKey:'art'});
 let definitions=0;
 e.getRaceDoodadForScenery=s=>{definitions++;return {...s,itemType:'scenery'};};
 const sprites=[{id:'a',x:0,z:0,yaw:0,widthM:2,heightM:3,artRef:'tree'}];
 e.getRaceThreeDoodadSceneKey(sprites);
 const edits=[s=>s.state='flattened',s=>s.x=2,s=>s.z=3,s=>s.yaw=.2,
  s=>s.widthM=4,s=>s.heightM=5,s=>s.previewDoodad={},s=>s.doodadRef='saved',
  s=>s.artRef='rock',s=>s.previewHitbox=true];
 for(const edit of edits){
  definitions=0;e.getRaceThreeDoodadSceneKey(sprites);assert.equal(definitions,0);
  edit(sprites[0]);e.getRaceThreeDoodadSceneKey(sprites);assert.equal(definitions,1);
 }
 definitions=0;sprites[0]={...sprites[0]};e.getRaceThreeDoodadSceneKey(sprites);assert.equal(definitions,1);
 definitions=0;e.playtestSession={...e.playtestSession};e.getRaceThreeDoodadSceneKey(sprites);assert.equal(definitions,1);
 definitions=0;e.playtestSession.worldBake.surfaceRevision='new';e.getRaceThreeDoodadSceneKey(sprites);assert.equal(definitions,1);
});

function managedSceneryEditor(sprites) {
 const e=new RaceEditor({});
 e.selectedRace.scenery=sprites;
 e.playtestSession={routeRuntimeType:'network',routeLength:1000,elapsedMs:0,
  worldBake:{surfaceRevision:'surface'},removedSceneryIds:[],flattenedSceneryIds:[],triggerSprites:[]};
 e.getRaceSurfaceModel=()=>({sampleWorld:()=>({elevation:0})});
 e.getRaceArtSpriteCanvas=()=>({__raceArtCacheKey:'art'});
 const material=new THREE.MeshBasicMaterial();
 e.getRaceThreeDoodadMaterial=()=>material;
 e.addRaceThreeDoodadHitboxMeshes=()=>{};
 const renderer={scene:new THREE.Scene(),doodadMaterialCache:new Map([['art',material]])};
 const state=prepareManagedRaceScenery(sprites,e.playtestSession);
 return {e,renderer,state,material};
}

test('managed fences retain bounded panel meshes under chunk groups and rebuild only a removed panel chunk',()=>{
 const sprites=buildRaceFencePlacements([{x:0,z:0},{x:1000,z:0},{x:1000,z:384}],
  {isFence:true,widthM:10,heightM:4,artRef:'fence'},{id:'managed-fence'});
 const {e,renderer,state}=managedSceneryEditor(sprites);
 assert.equal(e.addRaceThreeDoodads(renderer),true);
 const root=renderer.dynamicDoodadGroup;
 assert.equal(root.parent,renderer.scene);
 assert.ok(renderer.dynamicDoodadChunks.size>6,'the real fence spans several 128m chunks');
 assert.ok(root.children.every(child=>child.isGroup),'the managed root contains chunk groups');
 const collectFenceMeshes=group=>{
  const meshes=[];
  group.traverse(object=>{
   if(object.isMesh&&object.name.startsWith('raceFence:'))meshes.push(object);
  });
  return meshes;
 };
 const panelCenters=meshes=>meshes.flatMap(mesh=>{
  const positions=mesh.geometry.getAttribute('position'),centers=[];
  assert.equal(positions.count%6,0,'each rendered fence panel retains both triangles');
  assert.equal(mesh.geometry.getAttribute('uv').count,positions.count);
  assert.ok(Number.isFinite(mesh.geometry.boundingSphere.radius));
  assert.ok(mesh.geometry.boundingSphere.radius<200,'fence batches retain bounded culling geometry');
  for(let start=0;start<positions.count;start+=6){
   let x=0,z=0;
   for(let vertex=start;vertex<start+6;vertex++){x+=positions.getX(vertex);z+=positions.getZ(vertex);}
   centers.push(`${(x/6).toFixed(4)},${(z/6).toFixed(4)}`);
  }
  return centers;
 }).sort();
 const expectedCenters=panels=>panels.map(panel=>`${panel.x.toFixed(4)},${panel.z.toFixed(4)}`).sort();
 const beforeMeshes=collectFenceMeshes(root);
 assert.ok(beforeMeshes.length>6,'recursive inspection reaches the nested fence meshes');
 assert.ok(beforeMeshes.every(mesh=>mesh.parent!==root&&mesh.parent.parent===root));
 assert.deepEqual(panelCenters(beforeMeshes),expectedCenters(sprites),'every authored panel is present once');
 const originalChunks=new Map([...renderer.dynamicDoodadChunks].map(([key,holder])=>[key,{
  group:holder.dynamicDoodadGroup,meshes:collectFenceMeshes(holder.dynamicDoodadGroup)
 }]));
 const removed=sprites[20],affectedKey=`${Math.floor(removed.x/128)},${Math.floor(removed.z/128)}`;
 e.playtestSession.removedSceneryIds.push(removed.id);
 const stats={};e.addRaceThreeDoodads(renderer,{stats});
 assert.equal(stats.dynamicDoodadChunkRebuilds,1);
 assert.equal(renderer.dynamicDoodadGroup,root);
 assert.equal(renderer.dynamicDoodadCount,sprites.length-1);
 assert.deepEqual(panelCenters(collectFenceMeshes(root)),expectedCenters(sprites.filter(panel=>panel!==removed)),
  'removing one panel opens exactly its gap without losing distant fence panels');
 for(const [key,previous] of originalChunks){
  const current=renderer.dynamicDoodadChunks.get(key).dynamicDoodadGroup;
  if(key===affectedKey)assert.notEqual(current,previous.group);
  else{
   assert.equal(current,previous.group,`unaffected chunk ${key} survives`);
   const currentMeshes=collectFenceMeshes(current);
   assert.equal(currentMeshes.length,previous.meshes.length);
   currentMeshes.forEach((mesh,index)=>assert.equal(mesh,previous.meshes[index]));
  }
 }
 assert.equal(state.statistics.preparations,1,'a runtime removal does not re-prepare authored fences');
});

test('managed dense scenery performs no placement validation or projected scan on warm Three frames',()=>{
 let placementReads=0;
 const sprites=Array.from({length:18419},(_,i)=>new Proxy({id:`tree-${i}`,presetId:'doodad',
  x:i%128*8,z:Math.floor(i/128)*8,previewDoodad:{artRef:'tree',widthM:4,heightM:10}},
  {get(target,key){placementReads++;return target[key];}}));
 const {e,renderer,state}=managedSceneryEditor(sprites);
 e.addRaceThreeDoodads(renderer);
 assert.equal(renderer.dynamicDoodadCount,18419);
 const preparedScans=state.statistics.placementScans;
 placementReads=0;
 for(let frame=0;frame<10;frame++){
  const stats={};e.addRaceThreeDoodads(renderer,{stats});
  assert.equal(stats.dynamicDoodadCacheHits,1);
  e.drawRaceProjectedScenerySprites({}, {x:0,y:0,w:960,h:540},{skipDoodads:true});
 }
 assert.equal(placementReads,0,'managed warm frames read no authored placement fields');
 assert.equal(state.statistics.placementScans,preparedScans);
 assert.equal(state.statistics.preparations,1);
});

test('pickup and flattened-ID changes rebuild only affected chunks, preserve shared materials and restore gaps',()=>{
 const sprites=Array.from({length:96},(_,i)=>({id:`tree-${i}`,presetId:'doodad',
  x:Math.floor(i/32)*256+i%8*4,z:Math.floor(i%32/8)*4,
  previewDoodad:{artRef:'tree',widthM:2,heightM:4}}));
 const {e,renderer,state,material}=managedSceneryEditor(sprites);
 let materialDisposals=0;material.addEventListener('dispose',()=>materialDisposals++);
 let quads=0;const getQuad=e.getRaceDoodadWorldQuad.bind(e);
 e.getRaceDoodadWorldQuad=sprite=>{quads++;return getQuad(sprite);};
 e.addRaceThreeDoodads(renderer);
 const originalGroups=new Map([...renderer.dynamicDoodadChunks].map(([key,holder])=>[key,holder.dynamicDoodadGroup]));
 let disposedGeometry=0;originalGroups.get('0,0').traverse(object=>object.geometry?.addEventListener('dispose',()=>disposedGeometry++));
 quads=0;e.playtestSession.removedSceneryIds.push('tree-0');
 const removalStats={};e.addRaceThreeDoodads(renderer,{stats:removalStats});
 assert.equal(removalStats.dynamicDoodadChunkRebuilds,1);
 assert.equal(quads,31,'only the 31 remaining placements in the affected chunk rebuild');
 assert.equal(renderer.dynamicDoodadCount,95);
 assert.notEqual(renderer.dynamicDoodadChunks.get('0,0').dynamicDoodadGroup,originalGroups.get('0,0'));
 assert.equal(renderer.dynamicDoodadChunks.get('2,0').dynamicDoodadGroup,originalGroups.get('2,0'));
 assert.equal(renderer.dynamicDoodadChunks.get('4,0').dynamicDoodadGroup,originalGroups.get('4,0'));
 assert.ok(disposedGeometry>0);
 assert.equal(materialDisposals,0,'renderer-owned materials survive local geometry disposal');

 e.playtestSession.removedSceneryIds[0]='tree-32';
 const replacementStats={};e.addRaceThreeDoodads(renderer,{stats:replacementStats});
 assert.equal(replacementStats.dynamicDoodadChunkRebuilds,2,'in-place ID replacement restores the old chunk and removes from the new one');
 assert.equal(renderer.dynamicDoodadCount,95);
 e.playtestSession.flattenedSceneryIds.push('tree-32');
 const duplicateStats={};e.addRaceThreeDoodads(renderer,{stats:duplicateStats});
 assert.equal(duplicateStats.dynamicDoodadCacheHits,1,'moving the same hidden ID between lists does not rebuild geometry');
 e.playtestSession.removedSceneryIds=[];e.playtestSession.flattenedSceneryIds=[];
 e.addRaceThreeDoodads(renderer);assert.equal(renderer.dynamicDoodadCount,96);
 assert.equal(state.statistics.preparations,1,'pickups never re-prepare the authored list');
 e.clearRaceThreeDynamicDoodads(renderer);
 assert.equal(renderer.dynamicDoodadChunks,null);
 assert.equal(renderer.dynamicDoodadManagedState,null);
 assert.equal(materialDisposals,0);
});

test('managed authoring edits, asset revisions, array replacements and sessions invalidate presentation',()=>{
 const sprites=[{id:'tree',presetId:'doodad',x:0,z:0,yaw:0,
  previewDoodad:{artRef:'tree',widthM:2,heightM:4}}];
 const {e,renderer,state}=managedSceneryEditor(sprites);
 let art='one';e.getRaceArtSpriteCanvas=()=>({__raceArtCacheKey:art});
 e.addRaceThreeDoodads(renderer);const first=renderer.dynamicDoodadGroup;
 e.rotateRaceSceneryGroup(sprites[0],0.5);
 e.addRaceThreeDoodads(renderer);assert.notEqual(renderer.dynamicDoodadGroup,first);
 assert.equal(state.statistics.preparations,2);
 const rotated=renderer.dynamicDoodadGroup;
 sprites[0].previewDoodad.heightM=9;invalidateRaceSceneryPresentation(e);
 e.addRaceThreeDoodads(renderer);assert.notEqual(renderer.dynamicDoodadGroup,rotated);
 assert.equal(e.getRaceDoodadForScenery(sprites[0]).heightM,9,'explicit edits invalidate normalized definitions too');
 const edited=renderer.dynamicDoodadGroup;
 const oldMesh=edited.children[0].children[0];
 art='two';e.addRaceThreeDoodads(renderer);assert.equal(renderer.dynamicDoodadGroup,edited);assert.notEqual(edited.children[0].children[0],oldMesh);
 const asset=renderer.dynamicDoodadGroup;
 e.playtestSession.worldBake.surfaceRevision='new';e.addRaceThreeDoodads(renderer);
 assert.notEqual(renderer.dynamicDoodadGroup,asset);
 e.selectedRace.scenery=[{...sprites[0],x:300}];e.addRaceThreeDoodads(renderer);
 assert.equal(renderer.dynamicDoodadChunks.has('2,0'),true);
 const previousSession=e.playtestSession;
 e.playtestSession={...previousSession};prepareManagedRaceScenery(e.selectedRace.scenery,e.playtestSession);
 const beforeSession=renderer.dynamicDoodadGroup;e.addRaceThreeDoodads(renderer);
 assert.notEqual(renderer.dynamicDoodadGroup,beforeSession);
 assert.notEqual(getManagedRaceScenery(e.selectedRace.scenery,e.playtestSession),state);
});

test('projected managed scenery preserves transient effects, authored sprites, hidden IDs and fallback doodads',()=>{
 const sprites=[
  {id:'tree',presetId:'doodad',x:0,z:0,previewDoodad:{artRef:'tree'}},
  {id:'sign',presetId:'sign',x:4,z:0},
  {id:'removed',presetId:'sign',state:'removed',x:8,z:0}
 ];
 const {e}=managedSceneryEditor(sprites);
 const effect={id:'effect',artRef:'spark',animated:true,x:1,z:1};
 e.playtestSession.triggerSprites.push(effect);
 assert.deepEqual(getProjectedRaceScenerySprites(sprites,e.playtestSession,true),[sprites[1],effect]);
 assert.deepEqual(getProjectedRaceScenerySprites(sprites,e.playtestSession,false),[sprites[0],sprites[1],effect]);
 e.playtestSession.removedSceneryIds.push('sign');
 assert.deepEqual(getProjectedRaceScenerySprites(sprites,e.playtestSession,true),[effect]);
 e.playtestSession.triggerSprites=[];
 assert.deepEqual(getProjectedRaceScenerySprites(sprites,e.playtestSession,true),[]);
 e.playtestSession.removedSceneryIds.length=0;
 assert.deepEqual(getProjectedRaceScenerySprites(sprites,e.playtestSession,true),[sprites[1]]);
});

test('managed models retain fitting, root lighting and animation, and refresh after asset revisions',()=>{
 const ref='Managed performance scenery model';
 const model=createModelDocument();addPrimitive(model,'box');modelAssets.adopt(ref,{data:model});
 const sprites=[
  {id:'model',presetId:'doodad',x:4,z:9,yaw:0.3,previewDoodad:{widthM:3,heightM:5,model:{ref}}},
  {id:'tree',presetId:'doodad',x:260,z:0,previewDoodad:{widthM:2,heightM:4,artRef:'tree'}}
 ];
 const {e,renderer}=managedSceneryEditor(sprites);
 try {
  e.addRaceThreeDoodads(renderer);
  const placement=renderer.dynamicDoodadChunks.get('0,0').dynamicDoodadGroup.children[0];
  const instance=placement.userData.modelInstance;
  assert.ok(renderer.scene.userData.rtgModelLights);
  const size=new THREE.Box3().setFromObject(instance.object).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-3)<1e-6);assert.ok(Math.abs(size.y-5)<1e-6);
  e.playtestSession.elapsedMs=1000;e.addRaceThreeDoodads(renderer);
  assert.equal(instance.time,1);
  const before=renderer.dynamicDoodadGroup;
  modelAssets.adopt(ref,{data:structuredClone(model)});e.addRaceThreeDoodads(renderer);
  assert.equal(renderer.dynamicDoodadGroup,before);
  assert.equal(instance.root,null,'a changed model releases the old instance');
  const treeGroup=renderer.dynamicDoodadChunks.get('2,0').dynamicDoodadGroup;
  const replacement=renderer.dynamicDoodadChunks.get('0,0').dynamicDoodadGroup.children[0].userData.modelInstance;
  e.playtestSession.removedSceneryIds.push('model');e.addRaceThreeDoodads(renderer);
  assert.equal(replacement.root,null);
  assert.equal(renderer.dynamicDoodadChunks.get('2,0').dynamicDoodadGroup,treeGroup);
 } finally {e.clearRaceThreeDynamicDoodads(renderer);modelAssets.entries.delete(ref);}
});

test('ordinary race start registers managed scenery while car previews keep mutable validation',()=>{
 const e=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 e.selectedRace.scenery=[{id:'tree',presetId:'doodad',x:0,z:0,previewDoodad:{artRef:'tree',widthM:2,heightM:4}}];
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 assert.ok(getManagedRaceScenery(e.ensureRaceScenery(),e.playtestSession));
 assert.equal(prepareManagedRaceScenery(e.ensureRaceScenery(),{carEditorPreview:true}),null);
});

test('managed scenery release is idempotent and cannot invalidate a replacement session',()=>{
 const sprites=[{id:'tree',presetId:'doodad',x:0,z:0}];
 const old={},current={};
 const first=prepareManagedRaceScenery(sprites,old);
 const replacement=prepareManagedRaceScenery(sprites,current);
 assert.equal(releaseManagedRaceScenery(old),true);
 assert.equal(releaseManagedRaceScenery(old),false);
 assert.equal(getManagedRaceScenery(sprites,old),null);
 assert.equal(getManagedRaceSceneryVersion(first.doodads,old),null);
 assert.equal(getManagedRaceScenery(sprites,current),replacement);
 assert.equal(getManagedRaceSceneryVersion(replacement.doodads,current),replacement.generation);
});

test('chunk removal preserves materials still used by other chunks after material-cache eviction',()=>{
 const sprites=[0,256].map((x,index)=>({id:`tree-${index}`,presetId:'doodad',x,z:0,
  previewDoodad:{artRef:'tree',widthM:2,heightM:4}}));
 const {e,renderer}=managedSceneryEditor(sprites);
 delete e.getRaceThreeDoodadMaterial;
 renderer.doodadMaterialCache=new Map();
 const textures=new Map();
 e.getRaceThreeTexture=(_renderer,ref)=>{
  if(!textures.has(ref))textures.set(ref,new THREE.Texture());
  return textures.get(ref);
 };
 e.addRaceThreeDoodads(renderer);
 const material=renderer.dynamicDoodadChunks.get('0,0').dynamicDoodadGroup.children[0].material;
 assert.equal(renderer.dynamicDoodadChunks.get('2,0').dynamicDoodadGroup.children[0].material,material);
 let disposals=0;material.addEventListener('dispose',()=>disposals++);
 for(let index=0;index<32;index++)e.getRaceThreeDoodadMaterial(renderer,`other-${index}`);
 assert.equal([...renderer.doodadMaterialCache.values()].includes(material),false);
 const cacheEvictionDisposals=disposals;
 e.playtestSession.removedSceneryIds.push('tree-0');e.addRaceThreeDoodads(renderer);
 assert.equal(disposals,cacheEvictionDisposals,'local cleanup adds no disposal while another chunk uses the evicted material');
 e.playtestSession.removedSceneryIds.push('tree-1');e.addRaceThreeDoodads(renderer);
 assert.equal(disposals,cacheEvictionDisposals+1,'the last live owner releases the uncached material');
});

function addOwnedCarGroup(scene) {
 const group=new THREE.Group();
 group.add(new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial()));
 scene.add(group);
 return group;
}

test('actual session disposer releases scenery and renderer session references exactly once',()=>{
 const sprites=[{id:'tree',presetId:'doodad',x:0,z:0,previewDoodad:{artRef:'tree',widthM:2,heightM:4}}];
 const {e,renderer,state}=managedSceneryEditor(sprites);
 e.raceThreeWorldRenderer=renderer;e.addRaceThreeDoodads(renderer);
 const session=e.playtestSession,ai={id:'old-ai'};session.aiRuntime=[ai];
 let closed=0;e.vehicleDynamicsAuthority={session,workerBridge:{close(){closed++;}}};
 renderer.carRestFrames=new RaceCarRestFrames();renderer.carRestFrames.session=session;
 renderer.carRestFrames.frames.set('old-frame',{pixels:1});
 const batch=renderer.carDepthSprites=Object.create(RaceCarDepthSprites.prototype);
 Object.assign(batch,{scene:renderer.scene,entries:new Map(),active:new Set([session,ai]),now:0});
 for(const key of [session,ai]){
  const mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());
  renderer.scene.add(mesh);
  batch.entries.set(key,{mesh,texture:new THREE.Texture(),canvas:{width:1,height:1},lastSeen:0});
 }
 renderer.dynamicCarGroup=addOwnedCarGroup(renderer.scene);
 const aiHolder={scene:renderer.scene,dynamicCarGroup:addOwnedCarGroup(renderer.scene)};
 renderer.aiModelCars=new Map([[ai,aiHolder]]);
 renderer.trackStateHeights={session,bake:session.worldBake,values:new Map()};
 renderer.trackStateCells=[{key:'old-cell'}];
 let cancelled=0;
 const iterator=(function*(){try{yield;}finally{cancelled++;}})();iterator.next();
 renderer.trackStateBuild={iterator,cells:renderer.trackStateCells};
 renderer.trackStateMesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());
 const result=e.disposeRacePlaytestSession(session,'test-ended');
 assert.equal(result.disposed,true);assert.deepEqual(result.errors,[]);
 assert.equal(closed,1);assert.equal(e.vehicleDynamicsAuthority,null);
 assert.equal(getManagedRaceScenery(sprites,session),null);
 assert.equal(getManagedRaceSceneryVersion(state.doodads,session),null);
 assert.equal(e.raceDoodadSceneSnapshot,null);
 assert.equal(e.raceDoodadDefinitionSession,null);assert.equal(e.raceDoodadDefinitionCache,null);
 assert.equal(renderer.dynamicDoodadGroup,null);assert.equal(renderer.dynamicDoodadChunks,null);
 assert.equal(renderer.dynamicDoodadManagedState,null);
 assert.equal(renderer.carRestFrames.session,null);assert.equal(renderer.carRestFrames.frames.size,0);
 assert.equal(batch.entries.size,0);assert.equal(batch.active.size,0);
 assert.equal(renderer.dynamicCarGroup,null);assert.equal(renderer.aiModelCars.size,0);
 assert.equal(aiHolder.dynamicCarGroup,null);
 assert.equal(cancelled,1);assert.equal(renderer.trackStateBuild,null);
 assert.equal(renderer.trackStateHeights,null);assert.equal(renderer.trackStateCells,null);
 assert.equal(renderer.trackStateMesh.visible,false);
 assert.equal(e.disposeRacePlaytestSession(session).disposed,false);
 assert.equal(closed,1);assert.equal(cancelled,1);
});

test('disposing a previous session preserves all replacement renderer owners and caches',()=>{
 const sprites=[{id:'tree',presetId:'doodad',x:0,z:0,previewDoodad:{artRef:'tree',widthM:2,heightM:4}}];
 const {e,renderer,state}=managedSceneryEditor(sprites);
 e.raceThreeWorldRenderer=renderer;e.addRaceThreeDoodads(renderer);
 const current=e.playtestSession,oldAi={},newAi={},old={aiRuntime:[oldAi]};current.aiRuntime=[newAi];
 prepareManagedRaceScenery(sprites,old);
 const snapshot=e.raceDoodadSceneSnapshot,definitions=e.raceDoodadDefinitionCache,scenery=renderer.dynamicDoodadGroup;
 e.vehicleDynamicsAuthority={session:current,workerBridge:{close(){assert.fail('closed replacement worker');}}};
 const authority=e.vehicleDynamicsAuthority;
 renderer.carRestFrames=new RaceCarRestFrames();renderer.carRestFrames.session=current;
 renderer.carRestFrames.frames.set('current',{pixels:1});
 renderer.carDepthSprites={dispose(){assert.fail('disposed replacement sprites');}};
 const player=renderer.dynamicCarGroup=addOwnedCarGroup(renderer.scene);
 const oldHolder={scene:renderer.scene,dynamicCarGroup:addOwnedCarGroup(renderer.scene)};
 const newHolder={scene:renderer.scene,dynamicCarGroup:addOwnedCarGroup(renderer.scene)};
 renderer.aiModelCars=new Map([[oldAi,oldHolder],[newAi,newHolder]]);
 const heights=renderer.trackStateHeights={session:current,values:new Map()};
 const build=renderer.trackStateBuild={iterator:{return(){assert.fail('cancelled replacement geometry');}}};
 const cells=renderer.trackStateCells=[];
 const result=e.disposeRacePlaytestSession(old,'late-old-disposal');
 assert.equal(result.disposed,true);assert.deepEqual(result.errors,[]);
 assert.equal(e.playtestSession,current);assert.equal(e.vehicleDynamicsAuthority,authority);
 assert.equal(e.raceDoodadSceneSnapshot,snapshot);assert.equal(e.raceDoodadDefinitionCache,definitions);
 assert.equal(e.raceDoodadDefinitionSession,current);
 assert.equal(renderer.dynamicDoodadGroup,scenery);assert.equal(renderer.dynamicDoodadManagedState,state);
 assert.equal(getManagedRaceScenery(sprites,current),state);assert.equal(getManagedRaceScenery(sprites,old),null);
 assert.equal(renderer.carRestFrames.session,current);assert.equal(renderer.carRestFrames.frames.size,1);
 assert.equal(renderer.dynamicCarGroup,player);
 assert.equal(renderer.aiModelCars.has(oldAi),false);assert.equal(oldHolder.dynamicCarGroup,null);
 assert.equal(renderer.aiModelCars.get(newAi),newHolder);assert.ok(newHolder.dynamicCarGroup);
 assert.equal(renderer.trackStateHeights,heights);assert.equal(renderer.trackStateBuild,build);assert.equal(renderer.trackStateCells,cells);
});


test('deferred artwork arriving after a placeholder rebuilds the managed scenery batches',()=>{
 const sprites=[{id:'pending-tree',presetId:'doodad',x:0,z:0,yaw:0,previewDoodad:{artRef:'tree',widthM:2,heightM:4}}];
 const {e,renderer}=managedSceneryEditor(sprites);let canvas=null;
 e.getRaceArtSpriteCanvas=()=>canvas;
 e.addRaceThreeDoodads(renderer);const pending=renderer.dynamicDoodadGroup,oldMesh=pending.children[0].children[0];
 canvas={__raceArtCacheKey:'prepared:tree:1:0'};
 e.addRaceThreeDoodads(renderer);assert.equal(renderer.dynamicDoodadGroup,pending);assert.notEqual(pending.children[0].children[0],oldMesh);
 const loaded=renderer.dynamicDoodadGroup;e.addRaceThreeDoodads(renderer);assert.equal(renderer.dynamicDoodadGroup,loaded);
});


test('art arrival rebuilds only that art, even among other trees in the same chunk',()=>{
 const sprites=[{id:'tree',presetId:'doodad',x:0,z:0,previewDoodad:{artRef:'tree',widthM:2,heightM:4}},
 {id:'light',presetId:'doodad',x:10,z:0,previewDoodad:{artRef:'light',widthM:2,heightM:4}},
 {id:'far-tree',presetId:'doodad',x:260,z:0,previewDoodad:{artRef:'tree',widthM:2,heightM:4}}];
 const {e,renderer}=managedSceneryEditor(sprites);let light=null;
 e.getRaceArtSpriteCanvas=ref=>ref==='light'?light:{__raceArtCacheKey:'tree'};
 const material=new THREE.MeshBasicMaterial();e.getRaceThreeDoodadMaterial=(owner,ref)=>ref==='light'&&!light?null:material;
 e.addRaceThreeDoodads(renderer);
 const near=renderer.dynamicDoodadChunks.get('0,0').dynamicDoodadGroup,tree=near.children[0],far=renderer.dynamicDoodadChunks.get('2,0').dynamicDoodadGroup;
 let queries=0;e.getRaceSurfaceModel=()=>({sampleWorld:()=>{queries++;return {elevation:0};}});
 light={__raceArtCacheKey:'light-1'};const stats={};e.addRaceThreeDoodads(renderer,{stats});
 assert.equal(stats.dynamicDoodadRebuiltPlacements,1);assert.equal(stats.dynamicDoodadChunkRebuilds,1);
 assert.ok(queries<=5);assert.equal(near.children[0],tree);assert.equal(near.children.length,2);
 assert.equal(renderer.dynamicDoodadChunks.get('2,0').dynamicDoodadGroup,far);
 const unchanged={};e.addRaceThreeDoodads(renderer,{stats:unchanged});assert.equal(unchanged.dynamicDoodadCacheHits,1);
 for(let i=2;i<12;i++){
  const old=near.children.find(m=>m.userData.sceneryArtRef==='light');let disposed=0;old.geometry.addEventListener('dispose',()=>disposed++);
  light={__raceArtCacheKey:`light-${i}`};e.addRaceThreeDoodads(renderer);
  assert.equal(disposed,1);assert.equal(near.children.length,2);assert.equal(near.children[0],tree);
  assert.equal(renderer.dynamicDoodadDrawCalls,3);
 }
 e.playtestSession.removedSceneryIds.push('light');e.addRaceThreeDoodads(renderer);assert.equal(renderer.dynamicDoodadCount,2);
});
