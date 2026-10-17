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

test('all eight AI views use the editor body anchor and retain each saved angle configuration',async()=>{
 const {getCarViewCameraYaw,resolveCarAngleLayers}=await import('../../src/racing/CarDirectionalArt.js');
 const e=editor(),car=structuredClone(e.selectedCar),bounds={x:0,y:0,w:640,h:480};
 const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
 car.art={angleLayers:Object.fromEntries(slots.map((slot,i)=>[slot,{
  body:{artRef:'body',frameIndex:i,fitToCar:true,transforms:{bodyScaleX:1+i/10,bodyScaleY:1+i/20,bodyOffsetX:i/5,bodyOffsetY:-i/10,bodyRotationDeg:i-3}},
  tires:{artRef:'tires',frameIndex:i,tireMode:'auto',transforms:{tireScaleX:1+i/8,tireScaleY:1+i/9,tireSpacingScale:1+i/10,frontTireOffsetX:i/4,frontTireOffsetY:-i/7,rearTireOffsetX:-i/6,rearTireOffsetY:i/3}}
 }]))};
 const saved=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(car)));
 e.getRaceArtSpriteCanvas=()=>({width:16,height:16});e.drawRaceGeometricDebugOverlay=()=>{};
 e.getRaceShadowGroundSurfacePoint=point=>point;
 const project=point=>({...point,visible:true,screenX:320+point.x*8,screenY:240+point.z*2-point.elevation*10,cameraZ:30+point.z,threeProjected:true});
 e.projectRaceWorldPointToActiveThreeCamera=project;
 let layers;e.drawRaceCarBillboardLayers=(_ctx,options)=>layers=options;
 for(const slot of slots){
  const yaw=0.3,cameraYaw=getCarViewCameraYaw(slot,yaw),pose={x:2,z:12,elevation:1,yaw,pitchRad:0.1,rollRad:0.2};
  e.drawRaceProjectedCarSprite({drawImage(){}},bounds,{car:saved,projected:project(pose),yaw,cameraYaw,pitchRad:pose.pitchRad,rollRad:pose.rollRad,camera:{}});
  const resolved=resolveCarAngleLayers(saved,slot),anchor=project(e.getRaceCarRearAxleBodyAnchor(pose,resolved));
  assert.equal(layers.artChoice.viewSlot,slot);assert.equal(layers.artChoice.frameIndex,slots.indexOf(slot));
  assert.equal(layers.bodyAnchorX,anchor.screenX,`${slot} body X anchor`);
  assert.equal(layers.bodyAnchorY,anchor.screenY,`${slot} body Y anchor matches editor`);
  assert.equal(layers.anchorY,project(pose).screenY);
  for(const component of ['body','tires'])for(const [key,value] of Object.entries(saved.art.angleLayers[slot][component].transforms))assert.equal(layers.car.art[key],value,`${slot} ${key}`);
  const aiLayers=layers;
  e.playtestSession={runtimeCar:saved,carYaw:yaw,worldX:pose.x,worldZ:pose.z,bodyY:pose.elevation*RACE_THREE_ELEVATION_M,pitchRad:pose.pitchRad,rollRad:pose.rollRad,tireSlip:{frontTireAngle:0}};
  e.lastRaceRenderCamera={camera:{},cameraYaw,bounds};
  e.getRaceStitchedTerrainElevationAtWorldPoint=()=>0;
  e.drawRaceThirdPersonCar({drawImage(){}},bounds);
  for(const key of ['bodyAnchorX','bodyAnchorY','baseWidth','baseHeight','bodyBaseWidth','bodyBaseHeight','bodyRotationRad'])assert.equal(aiLayers[key],layers[key],`${slot} AI/player ${key} parity`);

 }
});

test('shared tire drawing reads the opponent wheel spins instead of the player while turning',()=>{
 const e=editor(),car=structuredClone(e.selectedCar);car.art={tires:['tires']};
 e.playtestSession={vehicleRenderState:{wheelPoses:{fl:{spinAngleRad:Math.PI},fr:{spinAngleRad:Math.PI}}}};
 const opponent={vehicleRenderState:{wheelPoses:{fl:{spinAngleRad:0},fr:{spinAngleRad:Math.PI/2}}}};
 e.getRaceArtSpriteCanvas=()=>({width:8,height:16});e.getRaceCarBillboardLayerCanvas=canvas=>canvas;
 const scrolls=[];e.drawScrolledCarTireArt=(_ctx,_c,_x,_y,_w,_h,options)=>scrolls.push(options.scroll);
 const ctx={save(){},restore(){},translate(){},rotate(){},drawImage(){}};
 e.drawRaceCarBillboardLayers(ctx,{car,session:opponent,artChoice:{viewSlot:'front',cameraBearing:0},drawBodyLayer:false,drawShadowLayer:false,wheelBillboards:{fl:{x:10,y:10,width:8,height:16},fr:{x:20,y:10,width:8,height:16}}});
 assert.equal(scrolls.length,2);assert.equal(Math.abs(scrolls[0]),0);assert.equal(scrolls[1],-0.25);
});


test('authored wheel rig retains all eight saved layouts across depth and full rollovers',async()=>{
 const {resolveCarAngleLayers}=await import('../../src/racing/CarDirectionalArt.js');
 const e=editor(),car=structuredClone(e.selectedCar);
 const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
 car.art={body:'body',tires:['tires'],angleLayers:Object.fromEntries(slots.map((slot,i)=>[slot,{
  tires:{tireMode:'visible',transforms:{tireScaleX:1+i/8,tireScaleY:1+i/9,tireSpacingScale:1+i/10,frontTireOffsetX:i/4,frontTireOffsetY:-i/7,rearTireOffsetX:-i/6,rearTireOffsetY:i/3}}
 }]))};
 e.getRaceArtSpriteCanvas=()=>({width:8,height:16});e.getRaceCarBillboardLayerCanvas=c=>c;
 const before=JSON.stringify(car);
 for(const slot of slots){
  let baseline;
  for(const width of [20,80,240])for(const roll of [0,0.7,Math.PI/2,Math.PI,Math.PI*1.6]){
   // Track the actual drawing transforms, including saved spacing and offsets.
   let matrix=[1,0,0,1,0,0],stack=[],draws=[];
   const ctx={save(){stack.push([...matrix])},restore(){matrix=stack.pop()},
    translate(x,y){matrix[4]+=matrix[0]*x+matrix[2]*y;matrix[5]+=matrix[1]*x+matrix[3]*y},
    rotate(a){const [a0,b,c,d]=matrix,C=Math.cos(a),S=Math.sin(a);matrix[0]=a0*C+c*S;matrix[1]=b*C+d*S;matrix[2]=c*C-a0*S;matrix[3]=d*C-b*S},drawImage(){}};
   e.drawScrolledCarTireArt=(_ctx,_canvas,_x,_y,w,h)=>draws.push({x:matrix[4],y:matrix[5],w,h});
   e.drawRaceCarBillboardLayers(ctx,{car,artChoice:{artRef:'body',viewSlot:slot},bodyAnchorX:300,bodyAnchorY:200,
    bodyBaseWidth:width,bodyBaseHeight:width*0.74,baseWidth:width*1.9,baseHeight:width*1.4,bodyRotationRad:roll,
    drawShadowLayer:false,drawBodyLayer:false,
    // Deliberately inconsistent physical projections must not drag flat art apart.
    wheelBillboards:{fl:{x:20*width,y:roll*30,width:width*2,height:width*2}}});
   assert.equal(draws.length,4);
   const values=draws.flatMap(p=>{const x=p.x-300,y=p.y-200;return [(x*Math.cos(roll)+y*Math.sin(roll))/width,(-x*Math.sin(roll)+y*Math.cos(roll))/width,p.w/width,p.h/width]});
   if(!baseline)baseline=values;
   else values.forEach((v,i)=>assert.ok(Math.abs(v-baseline[i])<1e-10,`${slot} width ${width}, roll ${roll}, component ${i}`));
  }
  const resolved=resolveCarAngleLayers(car,slot),rig=e.getRaceSpriteWheelRig({car:resolved,viewSlot:slot,bodyBaseWidth:100,tireCanvas:{width:8,height:16}});
  const plain=e.getRaceSpriteWheelRig({car:{...resolved,art:{...resolved.art,tireScaleX:1,tireScaleY:1}},viewSlot:slot,bodyBaseWidth:100,tireCanvas:{width:8,height:16}});
  assert.ok(Math.abs(rig.wheels.fl.width/plain.wheels.fl.width-resolved.art.tireScaleX)<1e-10);
  assert.ok(Math.abs(rig.wheels.fl.height/plain.wheels.fl.height-resolved.art.tireScaleY)<1e-10);
 }
 assert.equal(JSON.stringify(car),before,'rendering does not rewrite saved artwork or physics');
});

test('turning player selects artwork and transforms from the rendered heading at every frame boundary', async () => {
 const {getCarViewCameraYaw, getCarViewSlot} = await import('../../src/racing/CarDirectionalArt.js');
 const e = editor(), car = structuredClone(e.selectedCar);
 const slots = ['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
 car.art = {angleLayers: Object.fromEntries(slots.map((slot, i) => [slot, {
  body: {artRef: `body-${slot}`, frameIndex: i, transforms: {bodyOffsetX: i / 3}},
  tires: {artRef: `tires-${slot}`, transforms: {tireScaleX: 1 + i / 8, frontTireOffsetY: i / 4}}
 }]))};
 const before = JSON.stringify(car);
 const bounds = {x:0,y:0,w:640,h:480};
 e.projectRaceWorldPointToActiveThreeCamera = p => ({...p,visible:true,screenX:320+p.x*8,screenY:240-p.elevation*10,cameraZ:30,threeProjected:true});
 e.getRaceStitchedTerrainElevationAtWorldPoint = () => 0;
 e.getRaceShadowGroundSurfacePoint = p => p;
 e.getRaceArtSpriteCanvas = () => ({width:16,height:16});
 e.drawRaceGeometricDebugOverlay = () => {};
 let layers;
 e.drawRaceCarBillboardLayers = (_ctx, options) => { layers = options; };
 for (const slot of slots) for (const direction of [-1, 1]) {
  const cameraYaw = getCarViewCameraYaw(slot, 0);
  const yaw = direction * (Math.PI / 8 + 0.01);
  const physicsYaw = direction * (Math.PI / 8 - 0.01);
  const expected = getCarViewSlot(yaw, cameraYaw);
  const index = slots.indexOf(expected);
  e.playtestSession = {runtimeCar:car,carYaw:physicsYaw,worldX:0,worldZ:10,bodyY:0.6,
   tireSlip:{frontTireAngle:-0.2},
   vehicleRenderState:{position:{x:0,y:0.6,z:10},yawRad:yaw,pitchRad:0,rollRad:0,wheels:{fl:{steeringAngleRad:0.3}}}};
  e.lastRaceRenderCamera = {camera:{},cameraYaw,bounds};
  e.drawRaceThirdPersonCar({drawImage(){}}, bounds);
  assert.equal(layers.artChoice.viewSlot, expected, `${slot} direction ${direction}: body frame`);
  assert.equal(layers.artChoice.artRef, `body-${expected}`);
  assert.equal(layers.frontTireAngle, 0.3, 'tire steering also follows the rendered pose');
  assert.equal(layers.car.art.bodyOffsetX, index / 3);
  assert.equal(layers.car.art.frontTireOffsetY, index / 4);
  assert.equal(layers.car.art.tireScaleX, 1 + index / 8);
  const dynamic = e.getRacePlayerDynamicCarRenderOptions({session:e.playtestSession,car,cameraView:'third-person',cameraYaw});
  assert.equal(dynamic.car.art.body, `body-${expected}`, 'geometry visibility uses the same view');
  assert.equal(dynamic.car.art.frontTireOffsetY, index / 4);
 }
 assert.equal(JSON.stringify(car), before, 'turning does not alter saved settings');
});
