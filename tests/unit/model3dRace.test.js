import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {modelAssets} from '../../src/model3d/ModelAssets.js';
import {resolveCarAngleLayers} from '../../src/racing/CarDirectionalArt.js';

test('Race body and wheels use model geometry, continuous physics orientation and wheel spin',()=>{
  const e=new RaceEditor({},{mode:'car'}),car=e.selectedCar;
  const model=createModelDocument();addPrimitive(model,'box');modelAssets.adopt('Vehicle Model',{data:model});
  car.art.bodyModel={ref:'Vehicle Model',scale:[2,1,4]};car.art.wheelModel={ref:'Vehicle Model',scale:[0.2,0.6,0.6]};
  const renderer={scene:new THREE.Scene()};
  e.getRaceThreeSolidMaterial=()=>{const m=new THREE.MeshBasicMaterial();m.__raceSharedMaterial=true;return m;};
  e.getRaceCompositedSurfaceAtWorldPoint=()=>({elevation:0});
  e.getRaceWheelVisualCenterPositions=()=>({fl:{x:1,z:2},fr:{x:-1,z:2},rl:{x:1,z:-2},rr:{x:-1,z:-2}});
  const session={elapsedMs:500,vehicleRenderState:{wheelPoses:{fl:{spinAngleRad:1.2},rr:{spinAngleRad:-0.4}}}};
  try{
    e.addRaceThreeProceduralCar(renderer,{car,session,yaw:0.31,frontTireAngle:0.12,drawShadow:false});
    const group=renderer.dynamicCarGroup,parts=group.userData.parts;
    assert.ok(parts.body.userData.modelInstance);assert.equal(Object.keys(parts.wheels).length,4);
    assert.deepEqual(parts.body.userData.modelInstance.root.scale.toArray(),[2,1,4]);
    assert.equal(parts.wheels.fl.userData.spin.rotation.x,1.2);assert.equal(parts.wheels.rr.userData.spin.rotation.x,-0.4);
    e.addRaceThreeProceduralCar(renderer,{car,session,yaw:0.42,frontTireAngle:0.1,drawShadow:false});
    assert.equal(renderer.dynamicCarGroup,group);assert.equal(parts.body.rotation.y,0.42);assert.ok(Math.abs(parts.wheels.fl.rotation.y-0.32)<1e-9);
    assert.ok(parts.body.userData.modelInstance.root.children[0].geometry.getAttribute('position').count>0);
    const saved=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument());assert.deepEqual(saved.art.bodyModel.scale,[2,1,4]);
    const instance=parts.body.userData.modelInstance;e.clearRaceThreeDynamicCar(renderer);assert.equal(instance.root,null);
  }finally{modelAssets.entries.delete('Vehicle Model');}
});
test('model artwork suppresses sprites and ignores their directional wheel culling',()=>{
  const e=new RaceEditor({},{mode:'car'}),car=e.selectedCar;
  car.art.body='Old body';car.art.tires=['Old wheels'];car.art.bodyModel={ref:'Body'};car.art.wheelModel={ref:'Wheels'};
  car.art.angleLayers={right:{tires:{artRef:'Old wheels',tireMode:'right'},body:{artRef:'Old body',visible:false}}};
  const resolved=resolveCarAngleLayers(car,'right');const visibility=e.getCarArtLayerVisibility(resolved);
  assert.equal(visibility.body,true);assert.equal(visibility.leftWheels,true);assert.equal(visibility.rightWheels,true);
  assert.equal(e.getRaceCarProjectedArtRef(resolved,0,0).artRef,null);assert.equal(e.hasCarTireArtOverride(resolved),false);
  let draws=0;e.getRaceArtSpriteCanvas=()=>({width:16,height:16});
  const ctx=new Proxy({drawImage(){draws++;}},{get:(o,k)=>k in o?o[k]:()=>{}});
  e.drawRaceCarBillboardLayers(ctx,{car:resolved,artChoice:{artRef:'Old body',viewSlot:'right'},drawShadowLayer:false});
  assert.equal(draws,0);
});

test('looking around keeps the 3D car in the scene and dynamic/fixed camera modes remain available',()=>{
  const e=new RaceEditor({},{mode:'car'}),car=e.selectedCar;
  car.art.bodyModel={ref:'Body'};car.art.wheelModel={ref:'Wheels'};
  const session={runtimeCar:car,carYaw:0.3,velocityYaw:0.7,speedMps:20,cameraView:'third-person',tireSlip:{}};
  e.raceInput.lookAngle=0.9;
  e.getRacePlayerRenderPose=()=>({x:0,z:0,elevation:0,yaw:0.3});
  assert.ok(e.getRacePlayerDynamicCarRenderOptions({car,session}));
  e.raceInput.lookAngle=0;e.activeRootId='drive';
  car.camera={trackingMode:'dynamic'};
  const dynamic=e.getRacePlaytestCameraYaw(session);
  assert.ok(Math.abs((dynamic-session.carYaw)/(Math.PI/4)-Math.round((dynamic-session.carYaw)/(Math.PI/4)))>0.01);
  car.camera.trackingMode='fixed-rear';assert.ok(Math.abs(e.getRacePlaytestCameraYaw(session)-session.carYaw)<1e-9);
});

test('AI models use their own pose and instances, retain mixed artwork, and clean up on removal',()=>{
  const e=new RaceEditor({},{mode:'race'}),car=e.selectedCar;
  const model=createModelDocument();addPrimitive(model,'box');modelAssets.adopt('AI Body',model);
  car.art.bodyModel={ref:'AI Body'};
  const wheelModel=structuredClone(car);wheelModel.id='wheel-only';wheelModel.art.bodyModel=null;
  wheelModel.art.wheelModel={ref:'AI Body'};wheelModel.art.body='Sprite body';e.project.cars.push(wheelModel);
  const ai={carId:car.id,worldX:12,worldZ:6,carYaw:0.31},other={carId:wheelModel.id,worldX:-4,worldZ:8,carYaw:0.9};
  e.playtestSession={aiRuntime:[ai,other],elapsedMs:500,routeRuntimeType:'circuit'};
  e.getRaceWorldPoseAtDistance=()=>({x:0,z:0,yaw:0,elevation:0});
  e.getRaceCompositedSurfaceAtWorldPoint=()=>({elevation:0});
  e.getRaceWheelVisualCenterPositions=({session})=>Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{x:session.worldX,z:session.worldZ,elevation:0}]));
  const renderer={scene:new THREE.Scene()};
  try{
    e.syncRaceThreeAiModels(renderer,0);
    const holder=renderer.aiModelCars.get(ai),parts=holder.dynamicCarGroup.userData.parts;
    assert.ok(parts.body.userData.modelInstance);assert.equal(parts.body.position.x,12);assert.equal(parts.body.rotation.y,0.31);
    const otherParts=renderer.aiModelCars.get(other).dynamicCarGroup.userData.parts;
    assert.equal(otherParts.body,null,'sprite body remains in the 2D pass');assert.ok(otherParts.wheels.fl.userData.modelInstance);
    ai.carYaw=0.43;e.syncRaceThreeAiModels(renderer,0);assert.equal(parts.body.rotation.y,0.43);
    const instance=parts.body.userData.modelInstance;e.playtestSession.aiRuntime=[other];e.syncRaceThreeAiModels(renderer,0);
    assert.equal(instance.root,null);assert.equal(renderer.aiModelCars.size,1);
    e.clearRaceThreeScene(renderer);assert.equal(renderer.aiModelCars.size,0);assert.equal(renderer.scene.userData.rtgModelLights,undefined);
    e.syncRaceThreeAiModels(renderer,0);assert.ok(renderer.scene.userData.rtgModelLights.fill.parent,'lighting returns after a scene rebuild');
  }finally{e.clearRaceThreeScene(renderer);modelAssets.entries.delete('AI Body');}
});

test('completed Three AI pass suppresses procedural duplicates while software fallback still draws',()=>{
  const e=new RaceEditor({},{mode:'race'});let draws=0;
  e.getRaceProjectedCarBillboardSize=()=>({width:20,height:30});
  e.drawRaceProjectedProceduralCar=()=>{draws++;return true;};e.drawRaceGeometricDebugOverlay=()=>{};
  const options={car:e.selectedCar,projected:{visible:true,screenX:30,screenY:40},threeRendered:true};
  e.drawRaceProjectedCarSprite({}, {}, options);assert.equal(draws,0);
  e.drawRaceProjectedCarSprite({}, {}, {...options,threeRendered:false});assert.equal(draws,1);
});
