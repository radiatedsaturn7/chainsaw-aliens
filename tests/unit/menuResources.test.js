import test from 'node:test';
import assert from 'node:assert/strict';
import {MenuResources} from '../../src/menus/MenuResources.js';
import {saveProjectFile} from '../../src/ui/projectFiles.js';

test('car selection refreshes a re-saved car without re-normalizing it every frame',()=>{
 let installs=0;const resources=new MenuResources({carEditor:{normalizeLoadedCarDocument(data){installs++;return structuredClone(data)},collectRaceCarArtRefs:()=>[],getRaceCarTuning:car=>({powerHp:car.powerHp})}});
 saveProjectFile('cars','Menu refresh fixture',{name:'Before',powerHp:100});const first=resources.car('Menu refresh fixture');assert.equal(first.name,'Before');assert.equal(resources.car('Menu refresh fixture'),first);assert.equal(installs,1);
 saveProjectFile('cars','Menu refresh fixture',{name:'After',powerHp:200});const second=resources.car('Menu refresh fixture');assert.equal(second.name,'After');assert.notEqual(second,first);assert.equal(resources.tuning(second).powerHp,200);assert.equal(installs,2);
});

test('preview camera contains the whole car through every angle on narrow and wide panels',async()=>{
 const {MenuCarPreview}=await import('../../src/menus/MenuCarPreview.js');const THREE=await import('../../src/vendorBridge/three.js');const prior=globalThis.document;globalThis.document={};
 try{
  let camera;const preview=new MenuCarPreview({getRaceCarDimensions:()=>({lengthM:4.67,widthM:1.83}),addRaceThreeProceduralCar(){}});preview.holder={scene:new THREE.Scene()};preview.renderer={setSize(){},render(_scene,value){camera=value;camera.updateMatrixWorld()},domElement:{}};
  for(const [w,h] of [[170,203],[563,192]])for(let angle=0;angle<8;angle++){
   preview.draw({drawImage(){}},{x:0,y:0,w,h},{tuning:{cgHeightM:0.56}},angle*Math.PI/4,0);
   for(const x of [-1.83/2,1.83/2])for(const y of [0.56-0.75,0.56+0.75])for(const z of [-4.67/2,4.67/2]){
    const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Number.isFinite(p.x+p.y));assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,`${w}x${h}, angle ${angle}: full car stays in frame`);
   }
  }
 }finally{globalThis.document=prior}
});
