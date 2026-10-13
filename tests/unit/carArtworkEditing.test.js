import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createTireDefinition, normalizeTireDefinition, applyTireDefinition} from '../../src/racing/raceTires.js';
import {buildWheelCylinder} from '../../src/racing/CarWheelCylinder.js';

const editor=()=>new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
const roundTrip=e=>e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())));

test('car save/load retains tire physics, texture crops, modes and all eight angle adjustments',()=>{
  const e=editor(),tire=createTireDefinition('snow');
  tire.compound.surfaceGrip.snow=1.7;tire.pressurePsi=27;
  tire.graphics.tireSurfaces={tread:{artRef:'tread',frameIndex:0,bounds:{x:3,y:4,width:12,height:20}},wheel:{artRef:'rim',frameIndex:2,bounds:{x:1,y:2,width:10,height:10}}};
  tire.graphics.tireTreads={snow:{artRef:'tread',frameIndex:0,cylinder:false,bounds:{x:3,y:4,width:12,height:20}}};
  applyTireDefinition(e.selectedCar,tire,'Saved Snow');
  const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
  e.selectedCar.art.mirrorAngleEdits=false;
  for(const [i,slot] of slots.entries()){
    e.selectedCarShellFrameSlot=slot;e.setCarArtScaleValue('tire-x',1+i/10);
    e.setCarArtScaleValue('front-offset-x',i);e.setCarArtScaleValue('rear-offset-y',-i || 0);
    e.setCarArtScaleValue('tire-spacing',1+i/5);e.setCarTireVisibilityMode(i%2?'left':'right');
  }
  const saved=roundTrip(e);
  assert.deepEqual(saved.art.angleLayers,e.selectedCar.art.angleLayers);
  assert.deepEqual(saved.art.tireSurfaces,e.selectedCar.art.tireSurfaces);
  assert.deepEqual(saved.art.tireTreads.snow,e.selectedCar.art.tireTreads.snow);
  assert.deepEqual(saved.setup.tireDefinition,e.selectedCar.setup.tireDefinition);
  assert.deepEqual(saved.setup.tirePressurePsi,e.selectedCar.setup.tirePressurePsi);
  e.applyLoadedCarDocument(saved,{name:'Saved Car'});
  assert.deepEqual(e.selectedCar.art.angleLayers,saved.art.angleLayers);
});

test('standalone tire normalization retains graphic placement and visibility',()=>{
  const tire=createTireDefinition();Object.assign(tire.graphics,{tireScaleX:2,tireSpacingScale:1.5,frontTireOffsetX:3,rearTireOffsetY:-2,mirrorAngleEdits:false,layerVisibility:{leftWheels:false}});
  assert.deepEqual(normalizeTireDefinition(JSON.parse(JSON.stringify(tire))).graphics,{...tire.graphics,angleLayers:{}});
});

test('a scale or position drag is one undo step and updates live mirrored art on undo/redo',()=>{
  const e=editor();
  e.carEditorPreviewPlaytest={carId:e.selectedCar.id,session:{runtimeCar:structuredClone(e.selectedCar)}};
  for(const id of ['tire-x','front-offset-x','tire-spacing']){
    const before=structuredClone(e.selectedCar.art);const count=e.raceHistory.length;
    const region={id,min:0.1,max:3,track:{x:0,w:100}};
    e.carArtSliderDrag={id:'drag',region};
    for(let x=10;x<=90;x+=10)e.updateCarArtSlider(region,x);
    e.handlePointerUp({id:'drag'});
    assert.equal(e.raceHistory.length,count+1);
    const after=structuredClone(e.selectedCar.art);
    e.undoRaceHistory();assert.deepEqual(e.selectedCar.art,before);
    assert.deepEqual(e.carEditorPreviewPlaytest.session.runtimeCar.art,before);
    e.redoRaceHistory();assert.deepEqual(e.selectedCar.art,after);
    assert.deepEqual(e.carEditorPreviewPlaytest.session.runtimeCar.art,after);
  }
});

test('dynamic-fixed camera retains authored bearings while following drift, persists and undoes',()=>{
  const e=editor();e.setCarCameraTrackingMode('dynamic-fixed');
  assert.equal(roundTrip(e).camera.trackingMode,'dynamic-fixed');
  const session={carId:e.selectedCar.id,runtimeCar:e.selectedCar,speedMps:25,carYaw:0,velocityYaw:0};
  for(let i=-24;i<=24;i++){
    session.carYaw=i/9;session.velocityYaw=session.carYaw+i/12;
    const yaw=e.getRacePlaytestCameraYaw(session,{smooth:true,seconds:1/60});
    const steps=(yaw-session.carYaw)/(Math.PI/4);
    assert.ok(Math.abs(steps-Math.round(steps))<1e-9);
  }
  session.carYaw=0;session.velocityYaw=0.35;delete session.pixelArtCameraBearing;
  const first=e.getRacePlaytestCameraYaw(session);
  session.velocityYaw=0.37;assert.equal(e.getRacePlaytestCameraYaw(session),first);
  session.velocityYaw=1;assert.notEqual(e.getRacePlaytestCameraYaw(session),first);
  e.undoRaceHistory();assert.equal(e.getCarCameraTrackingMode(),'dynamic');
});

test('tire animation uses signed wheel spin instead of route progress',()=>{
  const e=editor();e.playtestSession={projectedDistance:999,vehicleRenderState:{wheelPoses:{fl:{spinAngleRad:Math.PI},rr:{spinAngleRad:-Math.PI}}}};
  assert.equal(e.getRaceTireTextureScroll(e.selectedCar,'fl'),0.5);
  assert.equal(e.getRaceTireTextureScroll(e.selectedCar,'rr'),-0.5);
  // The cylinder's parameter increases Y at the front; forward rolling must
  // instead move its front tread downward (negative parameter).
  const point=spin=>buildWheelCylinder({bearing:0,spin,segments:24}).flatMap(t=>t.points).find(p=>Math.abs(p.x-10)<1e-8&&Math.abs(p.z-25*Math.cos(spin))<1e-8);
  assert.ok(point(-0.01).y>point(0).y);
});

test('graphic tire spacing expands both projected axles without resizing tires or changing physics',()=>{
  const e=editor();e.setCarArtScaleValue('tire-spacing',2);
  e.setCarAngleArt('tires','front','tread');e.setCarTireVisibilityMode('visible');
  const setup=structuredClone(e.selectedCar.setup),positions=[],sizes=[];let position;
  const ctx=new Proxy({translate:(x,y)=>{position=[x,y];},drawImage(){},measureText:()=>({width:0})},{get:(o,k)=>k in o?o[k]:()=>{}});
  e.getRaceArtSpriteCanvas=()=>({width:10,height:20});e.getRaceCarBillboardLayerCanvas=c=>c;
  e.drawScrolledCarTireArt=(ctx,canvas,x,y,w,h)=>{positions.push(position);sizes.push([w,h]);return true;};
  e.drawRaceCarBillboardLayers(ctx,{car:e.selectedCar,artChoice:{viewSlot:'front'},drawBodyLayer:false,drawShadowLayer:false,
    wheelBillboards:{fl:{x:10,y:20,width:5,height:10},fr:{x:30,y:30,width:5,height:10},rl:{x:10,y:40,width:5,height:10},rr:{x:30,y:50,width:5,height:10}}});
  assert.deepEqual(positions,[[0,15],[40,35],[0,35],[40,55]]);
  assert.deepEqual(sizes,Array(4).fill([5,10]));assert.deepEqual(e.selectedCar.setup,setup);
});

test('dynamic-fixed camera stays quantized in the live simulation during a slide',()=>{
  const e=editor();e.setCarCameraTrackingMode('dynamic-fixed');
  e.startPlaytest(e.selectedCar.id);
  e.playtestSession.launchLockMs=0;e.playtestSession.speedMps=24;
  e.playtestSession.velocityYaw=e.playtestSession.carYaw+0.6;
  e.raceInput.gear=2;e.raceInput.steeringTarget=1;e.raceInput.steeringWheel=1;
  e.updatePlaytest(0.1);
  const steps=(e.playtestSession.cameraYaw-e.playtestSession.carYaw)/(Math.PI/4);
  assert.ok(Math.abs(steps-Math.round(steps))<1e-8,`bearing ${steps}`);
});

test('dynamic-fixed camera rejects noisy 45/90 boundary samples but follows a sustained drift',()=>{
  const e=editor();e.setCarCameraTrackingMode('dynamic-fixed');
  const session={carId:e.getRaceCarProjectIdentity(e.selectedCar),runtimeCar:e.selectedCar,speedMps:25,carYaw:0,velocityYaw:Math.PI/4,pixelArtCameraBearing:Math.PI/4};
  const sample=degrees=>{session.velocityYaw=degrees*Math.PI/180/0.995;return e.getRacePlaytestCameraYaw(session,{smooth:true,seconds:1/60});};
  for(let i=0;i<120;i++)assert.equal(sample(i%2?57:78),Math.PI/4);
  for(let i=0;i<9;i++)sample(85);
  assert.equal(session.pixelArtCameraBearing,Math.PI/2);
  for(let i=0;i<120;i++)assert.equal(sample(i%2?57:78),Math.PI/2);
  for(let i=0;i<9;i++)sample(45);
  assert.equal(session.pixelArtCameraBearing,Math.PI/4);
});

test('dynamic-fixed camera keeps authored wheel perspective centered throughout a sideways drift',()=>{
  const e=editor();e.setCarCameraTrackingMode('dynamic-fixed');
  const session={carId:e.getRaceCarProjectIdentity(e.selectedCar),runtimeCar:e.selectedCar,startedAt:1,elapsedMs:0,speedMps:25,carYaw:0,velocityYaw:1.2,tireSlip:{rearBreakaway:1}};
  for(let i=0;i<90;i++){
    session.elapsedMs=i*1000/60;
    const x=i*0.3,z=i*0.1;
    const anchor=e.getRaceThirdPersonCameraAnchor(session,{carWorldX:x,carWorldZ:z,cameraYaw:Math.PI/4,cameraView:'third-person',routeCamera:{x:0,z:0}});
    assert.equal(anchor.x,x);assert.equal(anchor.z,z);
    assert.equal(anchor.lateralOffsetM,0);assert.equal(anchor.forwardOffsetM,0);
  }
  session.runtimeCar.camera.trackingMode='dynamic';session.elapsedMs+=1000/60;
  const dynamic=e.getRaceThirdPersonCameraAnchor(session,{carWorldX:30,carWorldZ:9,cameraYaw:Math.PI/4,cameraView:'third-person',routeCamera:{x:0,z:0}});
  assert.notEqual(dynamic.lateralOffsetM,0,'continuous dynamic camera retains its intended drift lag');
});

test('all eight dynamic-fixed views retain wheel-to-body projected placement under lateral travel',()=>{
  const e=editor();e.setCarCameraTrackingMode('dynamic-fixed');
  const car=e.selectedCar,bounds={x:0,y:0,w:800,h:600};
  e.getRaceArtSpriteCanvas=()=>({width:16,height:32});
  const dimensions=e.getRaceCarDimensions(car);
  for(let view=0;view<8;view++){
    const cameraYaw=view*Math.PI/4;
    const session={runtimeCar:car,carYaw:0,speedMps:25,velocityYaw:1.2,startedAt:1,tireSlip:{rearBreakaway:1},elapsedMs:0};
    let baseline;
    for(let frame=0;frame<20;frame++){
      session.elapsedMs=frame*1000/60;
      const x=frame*0.25,z=frame*0.05;
      const anchor=e.getRaceThirdPersonCameraAnchor(session,{carWorldX:x,carWorldZ:z,cameraYaw,cameraView:'third-person',routeCamera:{x:0,z:0}});
      const distance=e.getRaceThirdPersonChaseDistance(car);
      const camera={x:anchor.x-Math.sin(cameraYaw)*distance,z:anchor.z-Math.cos(cameraYaw)*distance,elevation:0.2};
      const projectPoint=point=>e.projectRaceWorldPointToCamera(point,camera,cameraYaw,bounds);
      const body=e.getRaceCarRearAxleBodyAnchor({x,z,elevation:0.05,yaw:0},car);
      const bodyPoint=projectPoint(body);
      const bodyWidth=e.getRaceProjectedPhysicalBodyBillboardWidth({car,...body,cameraYaw,projectPoint,bounds});
      const wheelCenters=Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{x:x+(id.endsWith('r')?1:-1)*dimensions.trackWidthM/2,z:z+(id.startsWith('f')?1:-1)*dimensions.wheelbaseM/2,elevation:0.025}]));
      const wheels=e.getRaceProjectedPhysicalWheelBillboards({car,wheelCenters,projectPoint});
      const actual=Object.values(wheels).flatMap(w=>[(w.x-bodyPoint.screenX)/bodyWidth,(w.y-bodyPoint.screenY)/bodyWidth,w.width/bodyWidth,w.height/bodyWidth]);
      assert.equal(actual.length,16);
      if(!baseline)baseline=actual;
      else actual.forEach((n,i)=>assert.ok(Math.abs(n-baseline[i])<1e-9,`view ${view}, wheel component ${i} shifted while drifting`));
    }
  }
});
