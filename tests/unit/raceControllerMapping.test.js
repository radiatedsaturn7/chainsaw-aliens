import test from 'node:test';
import assert from 'node:assert/strict';
import Input from '../../src/game/Input.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

const input=()=>Object.assign(Object.create(Input.prototype),{gamepadConnected:true,gamepadAxisMode:null,controlSensitivity:1});
const buttons=(left,right)=>Array.from({length:16},(_,i)=>({value:i===6?left:i===7?right:0}));

test('standard controller trigger buttons are authoritative even with extra axes',()=>{
 const controls=input();
 for(const [left,right] of [[0,0],[0,1],[1,0],[1,1],[0.25,0.75]]){
  assert.deepEqual(controls.resolveGamepadTriggers({mapping:'standard',buttons:buttons(left,right),axes:[0,0,0,0,-1,1]}),{leftTrigger:left,rightTrigger:right});
 }
});

test('moving an unmapped right stick first never swaps camera and steering',()=>{
 const controls=input();
 assert.deepEqual(controls.resolveGamepadAxes({mapping:'',axes:[0,0,1,0]}),{leftX:0,leftY:0,rightX:1,rightY:0});
 assert.deepEqual(controls.resolveGamepadAxes({mapping:'',axes:[-1,0,0,0]}),{leftX:-1,leftY:0,rightX:0,rightY:0});
});

test('legacy signed trigger axes still map released to zero and pressed to full',()=>{
 const controls=input();
 assert.deepEqual(controls.resolveGamepadTriggers({mapping:'',buttons:buttons(0,0),axes:[0,0,0,0,-1,1]}),{leftTrigger:0,rightTrigger:1});
});

test('full controller throttle reaches the pedal and steering stays driver-relative at every camera angle',()=>{
 const controls=input();controls.gamepadAxes={leftX:-1,rightX:0,leftTrigger:0,rightTrigger:1};
 const editor=new RaceEditor({input:controls});
 for(let angle=0;angle<8;angle++){
  editor.raceInput.lookAngle=angle*Math.PI/4;
  editor.applyRaceAnalogInput();editor.updateRacePedalAxes(1/60);
  assert.equal(editor.raceInput.rawThrottleAxis,1);
  assert.equal(editor.raceInput.rawBrakeAxis,0);
  assert.equal(editor.raceInput.analogSteeringIntent,-1);
 }
 assert.ok(editor.raceInput.throttleAxis>0.99);
 controls.gamepadAxes.rightTrigger=0;
 for(let i=0;i<30;i++){editor.applyRaceAnalogInput();editor.updateRacePedalAxes(1/60);}
 assert.equal(editor.raceInput.throttleAxis,0);
});

test('manual orbit centers on the live car and keeps procedural render options at all eight angles',()=>{
 const controls=input(),editor=new RaceEditor({input:controls});
 const car=editor.selectedCar;
 const session={runtimeCar:car,carYaw:0.4,velocityYaw:1.4,speedMps:25,startedAt:1,elapsedMs:1000,worldX:12,worldZ:28,bodyY:0.6,cameraView:'third-person'};
 editor.playtestSession=session;
 for(const mode of ['dynamic','fixed-rear','dynamic-fixed']){
  car.camera={trackingMode:mode};
  for(let i=1;i<=8;i++){
   editor.raceInput.lookAngle=i*Math.PI/4;
   const cameraYaw=editor.getRacePlaytestCameraYaw(session);
   const anchor=editor.getRaceThirdPersonCameraAnchor(session,{carWorldX:12,carWorldZ:28,cameraYaw});
   assert.equal(anchor.x,12);assert.equal(anchor.z,28);
   const camera={x:anchor.x-Math.sin(cameraYaw)*10,z:anchor.z-Math.cos(cameraYaw)*10};
   const projected=editor.transformRaceWorldPointToCameraSpace({x:12,z:28,elevation:0},camera,cameraYaw);
   assert.ok(Math.abs(projected.cameraX)<1e-8);
   assert.ok(projected.cameraZ>9.9);
   assert.ok(editor.getRacePlayerDynamicCarRenderOptions({session,car,cameraYaw}));
  }
 }
});

test('dynamic chase keeps right-stick orbit during a live skid',()=>{
 const controls=input();controls.gamepadAxes={leftX:0,rightX:1,leftTrigger:0,rightTrigger:0};
 const editor=new RaceEditor({input:controls});
 editor.selectedCar.camera={trackingMode:'dynamic'};
 editor.startPlaytest(editor.selectedCar.id);
 const session=editor.playtestSession;
 Object.assign(session,{launchLockMs:0,elapsedMs:1000,speedMps:30,carYaw:0.9,velocityYaw:0,cameraYaw:0.9});
 editor.updatePlaytest(1/60);
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 assert.ok(Math.abs(wrap(session.velocityYaw-session.carYaw))>0.12);
 assert.ok(editor.raceInput.lookAngle<0);
 assert.ok(Math.abs(wrap(session.cameraYaw-session.carYaw-editor.raceInput.lookAngle))<1e-8);
});

test('analog pedals track partial, full and released pressure in one frame at every frame rate',()=>{
 for(const fps of [30,60,120]){
  const controls=input();controls.gamepadAxes={leftX:0,rightX:0,leftTrigger:0,rightTrigger:0};
  const editor=new RaceEditor({input:controls});
  for(const value of [0.35,1,0.42,0]){
   controls.gamepadAxes.rightTrigger=value;controls.gamepadAxes.leftTrigger=value;
   editor.applyRaceAnalogInput();editor.updateRacePedalAxes(1/fps);
   assert.equal(editor.raceInput.throttleAxis,value);
   assert.equal(editor.raceInput.brakeAxis,value);
  }
 }
});

test('lower controller sensitivity preserves full steering and camera travel without scaling pedals',()=>{
 const controls=input();controls.controlSensitivity=0.5;
 for(const value of [-1,-0.5,0,0.5,1]){
  controls.gamepadAxes={leftX:value,leftY:value,rightX:value,rightY:value,leftTrigger:0.4,rightTrigger:1};
  const axes=controls.getGamepadAxes();
  for(const key of ['leftX','leftY','rightX','rightY'])assert.equal(axes[key],Math.sign(value)*value*value);
  assert.equal(axes.leftTrigger,0.4);assert.equal(axes.rightTrigger,1);
 }
});

test('simulated gamepad steering is continuous through center and proportional across its range', () => {
 const controls=input(), editor=new RaceEditor({input:controls});
 controls.gamepadAxes={leftX:0,rightX:0,rightY:0,leftTrigger:0,rightTrigger:0};
 let previous=-1;
 for(let i=-1000;i<=1000;i++){
  controls.gamepadAxes.leftX=i/1000;
  editor.applyRaceAnalogInput();
  const intent=editor.raceInput.analogSteeringIntent;
  assert.ok(intent>=previous-1e-12);
  assert.ok(intent-previous<0.0011,`jump at ${i/1000}: ${intent-previous}`);
  previous=intent;
 }
 controls.gamepadAxes.leftX=.5;editor.applyRaceAnalogInput();
 assert.ok(editor.raceInput.analogSteeringIntent>.47);
 controls.gamepadAxes.leftX=-.5;editor.applyRaceAnalogInput();
 assert.ok(editor.raceInput.analogSteeringIntent<-.47);
});

test('simulated gamepad reaches the live steering rack promptly in both directions', () => {
 const controls=input(), editor=new RaceEditor({input:controls});
 controls.gamepadAxes={leftX:0,rightX:0,rightY:0,leftTrigger:0,rightTrigger:0};
 editor.startPlaytest(editor.selectedCar.id);
 Object.assign(editor.playtestSession,{launchLockMs:0,elapsedMs:3000,countdownRemainingMs:0,startupPhase:'running',startBackDistance:0});
 for(const direction of [1,-1]){
  controls.gamepadAxes.leftX=direction;
  for(let i=0;i<12;i++) editor.updatePlaytest(1/60);
  assert.ok(direction*editor.raceInput.steeringWheel>.85,`rack input ${editor.raceInput.steeringWheel}`);
 }
});


test('on-screen D-pad uses controller response and reverses promptly through the live rack',()=>{
 for(const fps of [30,60,120]){
  const editor=new RaceEditor({input:{getGamepadAxes:()=>({leftX:0})}});
  editor.startPlaytest(editor.selectedCar.id);
  Object.assign(editor.playtestSession,{launchLockMs:0,elapsedMs:3000,countdownRemainingMs:0,startupPhase:'running',startBackDistance:0});
  const hit={playtestControl:'dpad',bounds:{x:0,y:0,w:100,h:100}};
  editor.handleRacePlaytestPointerDown(hit,{id:1,x:95,y:50});
  for(let i=0;i<fps*.2;i++)editor.updatePlaytest(1/fps);
  assert.equal(editor.raceInput.controllerSteeringMode,'gamepad');
  assert.ok(editor.raceInput.steeringWheel>.9);
  editor.handleRaceDpadPoint(hit.bounds,{id:1,x:5,y:50});
  for(let i=0;i<fps*.2;i++)editor.updatePlaytest(1/fps);
  assert.ok(editor.raceInput.steeringWheel<-.85);
  editor.raceInput.activeDpadPointerId=null;editor.raceInput.binarySteer=0;
  for(let i=0;i<fps*.2;i++)editor.updatePlaytest(1/fps);
  assert.ok(Math.abs(editor.raceInput.steeringWheel)<.04);
 }
});

test('touch brake applies and releases fully in one frame with or without gamepad axes',()=>{
 for(const axes of [undefined,{leftX:0,leftTrigger:0}])for(const fps of [30,60,120]){
  const editor=new RaceEditor({input:{getGamepadAxes:()=>axes}});
  editor.handleRacePlaytestPointerDown({playtestControl:'brake'},{id:2});
  editor.applyRaceAnalogInput();editor.updateRacePedalAxes(1/fps);
  assert.equal(editor.raceInput.brakeAxis,1);
  editor.raceInput.activeBrakePointerId=null;
  editor.applyRaceAnalogInput();editor.updateRacePedalAxes(1/fps);
  assert.equal(editor.raceInput.brakeAxis,0);
 }
});
