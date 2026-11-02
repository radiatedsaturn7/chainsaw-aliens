import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import * as THREE from '../../src/vendorBridge/three.js';
test('car diagnostic replacements retain pass guard and counts in caller stats',()=>{
 const e=Object.create(RaceEditor.prototype),stats={};
 e.playtestSession={};e.getNowMs=()=>1;e.getRaceSessionCar=()=>({});e.getRacePlayerRenderPose=()=>({});e.getRaceCarRearAxleBodyAnchor=()=>({x:0,z:0,elevation:0});
 e.drawRaceProjectedAiCars=()=>{};
 e.drawRaceThirdPersonCar=()=>{e.lastRaceRenderStats={...e.lastRaceRenderStats,thirdPersonCarPlanarSource:'world'};};
 const batch={active:new Set(),stats:{paints:1,reuses:0,uploadedPixels:100,textureResizes:0},begin(){},draw(key,world,camera,paint){this.active.add(key);paint({});},end(){}};
 e.syncRaceThreeCarSprites({carDepthSprites:batch,camera:{updateMatrixWorld(){}}},{},{camera:{},cameraYaw:0,cameraView:'third-person',stats});
 assert.equal(e.lastRaceRenderStats,stats);assert.equal(stats.threeCarDepthSprites,true);assert.equal(stats.threeCarDepthSpriteCount,1);assert.equal(stats.threeCarSpriteUploadedPixels,100);
 // The post-WebGL pass must return before touching any AI or painting.
 e.playtestSession={get aiRuntime(){throw Error('duplicate AI pass');}};
 RaceEditor.prototype.drawRaceProjectedAiCars.call(e,{},{});
});
test('static rebuild disposes only static geometry; preserves scenery and car caches',()=>{
 const e=Object.create(RaceEditor.prototype);const scene=new THREE.Scene();
 const geometry=new THREE.BufferGeometry();let disposed=0;geometry.dispose=()=>disposed++;
 const road=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());const scenery=new THREE.Group();const car=new THREE.Group();scene.add(road,scenery,car);
 const renderer={scene,staticWorldObjects:[road],dynamicDoodadGroup:scenery,carDepthSprites:{dispose(){throw Error('car cache destroyed');}}};
 e.clearRaceThreeStaticWorld(renderer);assert.equal(disposed,1);assert.deepEqual(scene.children,[scenery,car]);assert.equal(renderer.dynamicDoodadGroup,scenery);assert.equal(road.parent,null);
 e.clearRaceThreeStaticWorld(renderer);assert.equal(disposed,1);
});

test('static-world invalidations identify which input changed',async()=>{
 const {staticWorldKeyChanges}=await import('../../src/racing/RaceStaticWorldCache.js');
 const before=Array.from({length:10},(_,i)=>String(i));
 assert.deepEqual(staticWorldKeyChanges(null,before.join('::three-static::')),['initial']);
 const after=[...before];after[4]='ready';after[9]='new-road';
 assert.deepEqual(staticWorldKeyChanges(before.join('::three-static::'),after.join('::three-static::')),['artworkReady','trackMeshes']);
});
