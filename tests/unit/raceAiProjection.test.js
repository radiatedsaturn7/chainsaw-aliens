import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {RACE_THREE_ELEVATION_M} from '../../src/racing/simulation/RaceSimulationConfig.js';
const editor=()=>new RaceEditor({},{mode:'race'});

test('randomized saved variants preload and draw their own artwork even with shared stock IDs',()=>{
 const e=editor();const cars=['WRX4','BUSE-019','PZ-24'].map(name=>{
  const car=e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),name);car.art={body:`${name} body`};e.upsertRaceProjectCar(car);return car;
 });
 e.selectedRace.competition.carSelection={availableCarIds:cars.map(c=>c.__playtestId),defaultCarId:cars[1].__playtestId};e.setRaceAiCount(3);
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const refs=e.collectSelectedRaceArtRefs();for(const c of cars)assert.ok(refs.includes(c.art.body));
 const drawn=[];e.drawRaceProjectedCarSprite=(_ctx,_bounds,options)=>drawn.push(options.car.art.body);
 e.projectRaceWorldPointToActiveThreeCamera=point=>({...point,visible:true,screenX:100,screenY:100,cameraZ:20,threeProjected:true});
 e.projectRaceWorldPointToCamera=()=>{throw Error('legacy projection used')};
 e.drawRaceProjectedAiCars({}, {x:0,y:0,w:640,h:480});
 assert.deepEqual(new Set(drawn),new Set(cars.map(c=>c.art.body)));
});

test('AI rendering uses canonical height, position, attitude and active camera instead of route placement',()=>{
 const e=editor(),car=e.selectedCar;
 const ai={carId:car.id,runtimeCar:car,worldX:1,worldZ:20,carYaw:0,vehicleRenderState:{position:{x:7,y:5,z:30},yawRad:0.7,pitchRad:0.2,rollRad:0.3}};
 e.playtestSession={routeLength:1000,routeRuntimeType:'destination',aiRuntime:[ai]};
 e.getRaceWorldPoseAtDistance=()=>({x:0,z:0,elevation:99,yaw:0,segment:{}});
 e.projectRaceWorldPointToActiveThreeCamera=point=>({...point,visible:true,screenX:180,screenY:220,cameraZ:30,threeProjected:true});
 e.projectRaceWorldPointToCamera=()=>{throw Error('legacy projection used')};
 let draw;e.drawRaceProjectedCarSprite=(_ctx,_bounds,options)=>draw=options;
 e.drawRaceProjectedAiCars({}, {x:0,y:0,w:640,h:480});
 assert.equal(draw.projected.x,7);assert.equal(draw.projected.z,30);assert.equal(draw.projected.elevation,5/RACE_THREE_ELEVATION_M);
 assert.equal(draw.yaw,0.7);assert.equal(draw.pitchRad,0.2);assert.equal(draw.rollRad,0.3);assert.equal(draw.projected.threeProjected,true);
});

test('AI art anchors, scale and physical tire centers all use the active camera',()=>{
 const e=editor(),car=structuredClone(e.selectedCar);car.art={body:'AI body',tires:'AI tires'};
 const session={vehicleRenderState:{wheelPoses:Object.fromEntries(['fl','fr','rl','rr'].map((id,i)=>[id,{position:{x:i,y:2,z:20},spinAngleRad:Math.PI}]))}};
 e.projectRaceWorldPointToActiveThreeCamera=point=>({...point,visible:true,screenX:200+point.x*10,screenY:250-point.elevation*10,cameraZ:20,threeProjected:true});
 e.projectRaceWorldPointToCamera=()=>{throw Error('legacy projection used')};
 e.getRaceArtSpriteCanvas=()=>({width:16,height:16});e.drawRaceGeometricDebugOverlay=()=>{};
 let layers;e.drawRaceCarBillboardLayers=(_ctx,options)=>layers=options;
 e.drawRaceProjectedCarSprite({drawImage(){}},{x:0,y:0,w:640,h:480},{car,session,renderState:session.vehicleRenderState,projected:{x:0,z:20,elevation:1,visible:true,screenX:200,screenY:240,cameraZ:20,threeProjected:true},camera:{}});
 assert.ok(layers.bodyBaseWidth>0);assert.equal(layers.tireScroll,0.5);
 for(const [i,id] of ['fl','fr','rl','rr'].entries()){assert.equal(layers.wheelBillboards[id].x,200+i*10);assert.equal(layers.wheelBillboards[id].y,250-2/RACE_THREE_ELEVATION_M*10);}
});

test('browser preparation worker receives selected AI artwork before prepared-only rendering starts',()=>{
 const previous=globalThis.Worker;let request;
 globalThis.Worker=class{postMessage(value){request=value}terminate(){}};
 const e=editor();
 try{
  const car=e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),'Saved AI');car.art={body:'Opponent body'};e.upsertRaceProjectCar(car);
  e.selectedRace.competition.carSelection={availableCarIds:[car.__playtestId],defaultCarId:car.__playtestId};e.setRaceAiCount(1);
  e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
  assert.ok(request?.includeArtAssets);assert.ok(request.artRefs.includes('Opponent body'));
  assert.equal(e.playtestSession.aiRuntime[0].runtimeCar.art.body,'Opponent body');
  assert.ok(e.getRaceRuntimePreparationKey('same-track').includes('Opponent body'));
 }finally{e.cancelRacePlaytestPreparation();globalThis.Worker=previous;}
});
