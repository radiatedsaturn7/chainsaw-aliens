import test from 'node:test';
import assert from 'node:assert/strict';
import {getRaceStickLook,stepRaceLookAngle} from '../../src/racing/RaceCameraInput.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

test('right stick maps all eight directions to a car-relative view',()=>{
 const editor=new RaceEditor({input:{gamepadConnected:true}});
 const car=editor.selectedCar;
 const session={runtimeCar:car,carYaw:0.7,velocityYaw:-1.1,speedMps:25,launchLockMs:0};
 for(const mode of ['dynamic','fixed-rear','dynamic-fixed']){
  car.camera={trackingMode:mode};
  for(const [x,y,angle] of [[0,-1,0],[1,-1,Math.PI/4],[1,0,Math.PI/2],[1,1,3*Math.PI/4],[0,1,Math.PI],[-1,1,-3*Math.PI/4],[-1,0,-Math.PI/2],[-1,-1,-Math.PI/4]]){
   const look=getRaceStickLook(x,y);
   assert.equal(look.active,true);
   assert.ok(Math.abs(wrap(look.angle+angle))<1e-10);
   editor.raceInput.lookAngle=look.angle;editor.raceInput.lookStickActive=true;
   const yaw=editor.getRacePlaytestCameraYaw(session);
   assert.ok(Math.abs(wrap(yaw-session.carYaw+angle))<1e-10,`${mode}: ${x},${y}`);
  }
 }
});

test('look direction depends on stick direction, not how far it is pushed',()=>{
 assert.equal(getRaceStickLook(0.3,0).angle,-Math.PI/2);
 assert.ok(Math.abs(getRaceStickLook(0,0.3).angle)===Math.PI);
 assert.deepEqual(getRaceStickLook(0.04,0.04),{active:false,angle:0});
});

test('crossing behind the car takes the short arc instead of sweeping through the front',()=>{
 const before=179*Math.PI/180,target=-179*Math.PI/180;
 const next=stepRaceLookAngle(before,target,1/60,true);
 assert.ok(Math.abs(wrap(next-before))<Math.PI/180);
 assert.ok(wrap(next-before)>0);
});

test('releasing the stick recenters smoothly and response is frame-rate independent',()=>{
 const run=fps=>{let angle=Math.PI/2;for(let i=0;i<fps;i++)angle=stepRaceLookAngle(angle,0,1/fps,false);return angle;};
 assert.ok(run(60)<0.025);
 for(const fps of [30,120,144])assert.ok(Math.abs(run(fps)-run(60))<1e-10);
});

test('all diagonal inputs place the camera in the correct car-local corner at any sensitivity', async()=>{
 const {default:Input}=await import('../../src/game/Input.js');
 const controls=Object.assign(Object.create(Input.prototype),{gamepadConnected:true,virtualGamepadActive:false});
 const editor=new RaceEditor({input:controls});
 const car=editor.selectedCar;car.camera={trackingMode:'dynamic-fixed'};
 editor.getRaceCameraSafeTerrainElevation=()=>0;
 for(const mode of ['dynamic-fixed','dynamic','fixed-rear'])for(const sensitivity of [0.2,0.5,1,3])for(const yaw of [0,0.7,-2.1]){
  car.camera.trackingMode=mode;
  controls.controlSensitivity=sensitivity;
  for(const [x,y,left,behind,slot] of [[0.6,-0.8,-1,-1,'rearRight'],[-0.6,-0.8,1,-1,'rearLeft'],[0.6,0.8,-1,1,'frontRight'],[-0.6,0.8,1,1,'frontLeft']]){
   controls.gamepadAxes={leftX:0,rightX:x,rightY:y,leftTrigger:0,rightTrigger:0};
   editor.applyRaceAnalogInput();
   const session={runtimeCar:car,carYaw:yaw,velocityYaw:yaw+1,speedMps:25,pixelArtCameraBearing:Math.PI/2};
   // The previous smoothed orbit is deliberately still on a different side.
   editor.raceInput.lookAngle=Math.PI/2;
   if(mode!=='dynamic-fixed'){
    const requested=getRaceStickLook(editor.raceInput.lookIntentX,editor.raceInput.lookIntentY);
    for(let frame=0;frame<120;frame++)editor.raceInput.lookAngle=stepRaceLookAngle(editor.raceInput.lookAngle,requested.angle,1/60,true);
   }
   const cameraYaw=editor.getRacePlaytestCameraYaw(session,{seconds:1/60,smooth:true});
   const {camera}=editor.getRaceThirdPersonSafeCameraPlacement({carWorldX:0,carWorldZ:0,carYaw:cameraYaw,desiredChaseDistance:10,roadElevation:0,eyeHeight:3,car});
   const right=editor.getRaceRightVector(yaw),forward=editor.getRaceForwardVector(yaw);
   const localX=camera.x*right.x+camera.z*right.z;
   const localZ=camera.x*forward.x+camera.z*forward.z;
   assert.equal(Math.sign(localX),left,`${x},${y} camera side`);
   assert.equal(Math.sign(localZ),behind,`${x},${y} front/rear`);
   if(mode==='dynamic-fixed')assert.ok(Math.abs(Math.abs(localX)-Math.abs(localZ))<1e-8);
   const {getCarViewSlot}=await import('../../src/racing/CarDirectionalArt.js');
   assert.equal(getCarViewSlot(yaw,cameraYaw),slot);
   const lookForward=editor.getRaceForwardVector(cameraYaw);
   assert.equal(Math.sign(lookForward.x*right.x+lookForward.z*right.z),-left);
   assert.equal(Math.sign(Math.cos(cameraYaw-yaw)),-behind);
  }
 }
});
