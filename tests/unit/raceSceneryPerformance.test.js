import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
import * as THREE from '../../src/vendorBridge/three.js';

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
