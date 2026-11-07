import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {buildRaceAiRoadPlan} from '../../src/racing/RaceAiRoadPlan.js';
import {buildRaceGuideArrows,syncRaceThreeDrivingLine,disposeRaceThreeDrivingLine,drawRaceDrivingLine} from '../../src/racing/RaceDrivingGuideRenderer.js';
const editor={selectedRace:{},getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0,elevation:1}),getRaceRoadHalfWidthWorld:()=>4,
 getRaceRightVector:()=>({x:1,z:0}),getRaceRoadSurfaceProfileAtDistance:()=>({elevation:1}),
 getRaceBakedSurfaceAtWorldPoint:p=>({elevation:1+p.x*.02})};
const setup=()=>{
 const plan=buildRaceAiRoadPlan(editor,{routeLength:200,runtimeType:'destination'});
 return {...editor,playtestSession:{distance:0,routeLength:200,routeRuntimeType:'destination',speedMps:15,drivingAssists:{active:true,plan}}};
};
test('guide is depth-tested world geometry sharing the actual road camera',()=>{
 const e=setup(),renderer={scene:new THREE.Scene()};syncRaceThreeDrivingLine(e,renderer);
 const mesh=renderer.drivingGuideMesh;assert.ok(mesh.isMesh);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,false);
 const position=mesh.geometry.getAttribute('position');assert.ok(mesh.geometry.drawRange.count>0);
 const arrows=buildRaceGuideArrows(e),first=arrows[0].points[0];
 assert.ok(Math.abs(position.getY(0)-first.elevation*12)<.00001); // metres and banking
 for(const [w,h] of [[390,844],[844,390],[1280,800]]) {
   const camera=new THREE.PerspectiveCamera(58,w/h,.1,500);camera.position.set(2,14,-4);camera.lookAt(0,12,30);camera.rotateZ(.12);
   camera.setViewOffset(w,h,0,12,w,h);camera.updateMatrixWorld(true);
   const vertex=new THREE.Vector3().fromBufferAttribute(position,0);
   const projected=vertex.clone().project(camera);
   const manual=vertex.clone().applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
   assert.ok(projected.distanceTo(manual)<1e-10);assert.ok(projected.z>-1&&projected.z<1);
 }
 const geometry=mesh.geometry;syncRaceThreeDrivingLine(e,renderer);assert.equal(renderer.drivingGuideMesh.geometry,geometry);
 e.selectedRace={drivingGuide:{line:false}};syncRaceThreeDrivingLine(e,renderer);assert.equal(mesh.visible,false);
 disposeRaceThreeDrivingLine(renderer);assert.equal(renderer.drivingGuideMesh,null);assert.equal(renderer.scene.children.length,0);
});
test('Three renderer never receives the incompatible legacy canvas projection',()=>{
 const e=setup();e.lastRaceRenderStats={threeTerrainRenderer:1};
 e.projectRaceWorldPointToCamera=()=>{throw Error('Wrong projection used');};
 drawRaceDrivingLine(e,{},{});
});
