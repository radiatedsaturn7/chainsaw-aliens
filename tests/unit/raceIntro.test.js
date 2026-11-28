import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureRaceIntro,advanceRaceIntro,raceIntroShot,raceIntroFade} from '../../src/racing/RaceIntro.js';
import {updateRaceSimulation} from '../../src/racing/RaceSimulation.js';
import {RaceRadioDirector} from '../../src/radio/RaceRadioDirector.js';
test('intro waits for presentation, covers three angles and restores the selected view before countdown',()=>{
 const s={running:true,startupFramePending:true,countdownRemainingMs:4000,cameraView:'first-person'};
 ensureRaceIntro(s);advanceRaceIntro(s,1);assert.equal(s.raceIntro.elapsed,0);
 s.startupFramePending=false;
 const shots=new Set();for(let i=0;i<60;i++){if(raceIntroFade(s)===1)s.raceIntro.handoffBlackDrawn=true;const shot=raceIntroShot(s);if(shot)shots.add(shot.shot);advanceRaceIntro(s,.1);}
 assert.deepEqual([...shots],[0,1,2]);assert.equal(s.raceIntro.active,false);
 assert.equal(s.countdownRemainingMs,4000);assert.equal(s.cameraView,'first-person');assert.equal(s.startupPhase,'countdown');
});
test('intro cannot be skipped and fades through black into driving view',()=>{
 const s={running:true,startupFramePending:true,countdownRemainingMs:4000};ensureRaceIntro(s);s.startupFramePending=false;
 advanceRaceIntro(s,0,true);assert.equal(s.raceIntro.elapsed,0);
 s.raceIntro.elapsed=5.4;assert.equal(raceIntroShot(s),null);assert.equal(raceIntroFade(s),1);
 s.raceIntro.handoffBlackDrawn=true;
 for(let i=0;i<4;i++)advanceRaceIntro(s,.1);ensureRaceIntro(s);assert.equal(s.raceIntro.active,false);
});
test('car editor previews and sessions without a countdown have no intro',()=>{
 for(const s of [{running:true,startupFramePending:true,countdownRemainingMs:0},{running:true,startupFramePending:true,countdownRemainingMs:4000,carEditorPreview:true}])assert.equal(ensureRaceIntro(s),undefined);
});
test('intro holds physics and music stays silent until the camera is visible',()=>{
 const session={running:true,startupFramePending:true,raceIntro:{active:true},countdownRemainingMs:4000};
 updateRaceSimulation({editor:{playtestSession:session},systems:{},dt:1});
 const director=new RaceRadioDirector({});director.session=session;
 director.update(session,{dt:1});assert.ok(!director.starting);assert.equal(session.countdownRemainingMs,4000);
});

test('physical controller A does not skip the intro or advance simulation',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});
 editor.playtestSession={running:true,raceIntro:{active:true,elapsed:.5},countdownRemainingMs:4000};
 editor.syncRacePhysicalGamepad=()=>{};editor.updateRacePlaytestFps=()=>{};editor.isLivePlaytestSession=()=>true;
 editor.updatePlaytestSafely=()=>{throw Error('simulation must be held');};
 editor.update({wasGamepadPressed:action=>action==='gamepadA'},.016);
 assert.equal(editor.playtestSession.raceIntro.elapsed,.516);
 assert.equal(editor.playtestSession.countdownRemainingMs,4000);
});

test('Escape can pause the intro without advancing its timeline',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});editor.playtestSession={running:true,raceIntro:{active:true,elapsed:.5}};
 editor.syncRacePhysicalGamepad=()=>{};editor.updateRacePlaytestFps=()=>{};editor.isLivePlaytestSession=()=>true;
 editor.toggleRacePause=()=>{editor.raceInput.paused=true;};
 editor.update({wasPressedCode:code=>code==='Escape'},.016);
 assert.equal(editor.raceInput.paused,true);assert.equal(editor.playtestSession.raceIntro.elapsed,.5);
});


test('slow frames cannot reveal the new camera before a fully black frame is presented',()=>{
 const s={raceIntro:{active:true,elapsed:5.37}};
 advanceRaceIntro(s,.1);assert.equal(s.raceIntro.elapsed,5.4);assert.equal(raceIntroFade(s),1);
 for(let i=0;i<10;i++)advanceRaceIntro(s,.1);
 assert.equal(s.raceIntro.elapsed,5.4);assert.equal(s.raceIntro.active,true);
 s.raceIntro.handoffBlackDrawn=true;advanceRaceIntro(s,.1);
 assert.ok(s.raceIntro.elapsed>5.4);assert.ok(raceIntroFade(s)<1);
});

test('intro presentation initializes grounded physics height without advancing the race',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const {initializeRaceVehiclePresentation}=await import('../../src/racing/RaceSimulation.js');
 const e=new RaceEditor({});e.preloadSelectedRaceArtRefs=()=>{};e.prewarmRacePlaytestRenderResources=()=>{};
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});const s=e.playtestSession;
 assert.equal(s.countdownRemainingMs,4000,'three seconds after the showcase plus the GO display second');
 const before={countdown:s.countdownRemainingMs,elapsed:s.elapsedMs,distance:s.distance};
 initializeRaceVehiclePresentation(e);
 assert.equal(s.vehicleRenderState.position.y,s.vehicleDynamicsRunner.state.position.y);
 assert.equal(s.vehicleDynamicsRunner.stepIndex,0);
 assert.deepEqual({countdown:s.countdownRemainingMs,elapsed:s.elapsedMs,distance:s.distance},before);
 const runner=s.vehicleDynamicsRunner;initializeRaceVehiclePresentation(e);assert.equal(s.vehicleDynamicsRunner,runner);
 const height=s.vehicleRenderState.position.y;s.startupFramePending=false;e.updatePlaytest(.016);
 assert.ok(Math.abs(s.vehicleRenderState.position.y-height)<.002);
});

test('countdown HUD hides five/four and the showcase, then draws three through GO',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=Object.create(RaceEditor.prototype),labels=[];
 const ctx={save(){},restore(){},fillRect(){},fillText(text){labels.push(text);}};
 editor.playtestSession={countdownRemainingMs:6000};
 for(const ms of [6000,5000,4000,3000,2000,1000,0]){editor.playtestSession.countdownRemainingMs=ms;editor.drawRaceCountdown(ctx,{x:0,y:0,w:800,h:600});}
 assert.deepEqual(labels,['3','2','1','GO!']);
 editor.playtestSession={countdownRemainingMs:4000,raceIntro:{active:true}};
 editor.drawRaceCountdown(ctx,{x:0,y:0,w:800,h:600});assert.equal(labels.length,4);
});

test('showcase initializes every opponent wheel pose before countdown without stepping physics',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const {initializeRaceVehiclePresentation}=await import('../../src/racing/RaceSimulation.js');
 const e=new RaceEditor({});e.preloadSelectedRaceArtRefs=()=>{};e.prewarmRacePlaytestRenderResources=()=>{};
 const id=e.selectedCar.id;
 e.selectedRace.competition={aiDrivers:[0,1,2].map(i=>({id:`intro-${i}`,carId:id,enabled:true,difficulty:'hard'}))};
 e.startPlaytest(id,{hydrateCars:false,preparedAiCarIds:[id,id,id]});
 const s=e.playtestSession,before=s.aiRuntime.map(ai=>({x:ai.worldX,z:ai.worldZ,d:ai.distance}));
 initializeRaceVehiclePresentation(e);
 const runners=s.aiRuntime.map(ai=>ai.vehicleDynamicsRunner);
 for(const [i,ai] of s.aiRuntime.entries()){
  assert.equal(ai.vehicleDynamicsRunner.stepIndex,0);
  assert.ok(ai.vehicleRenderState.wheelPoses.fl);
  assert.ok(Math.hypot(ai.worldX-before[i].x,ai.worldZ-before[i].z)<1e-9);
  assert.equal(ai.distance,before[i].d);
  for(const wheel of ['fl','fr','rl','rr']){
   const hub=ai.vehicleRenderState.wheelPoses[wheel].position;
   assert.ok(Number.isFinite(hub.y));
   assert.ok(hub.y>ai.heightM+.15,'wheel hub should be above the road, not at road height');
  }
 }
 initializeRaceVehiclePresentation(e);
 assert.deepEqual(s.aiRuntime.map(ai=>ai.vehicleDynamicsRunner),runners);
 assert.equal(s.elapsedMs,0);
});

test('showcase and AI driver resolve the same gearbox independently of player shift mode',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const {initializeRaceVehiclePresentation}=await import('../../src/racing/RaceSimulation.js');
 const {getRaceAiRuntimeTuning}=await import('../../src/racing/RaceAiSimulation.js');
 for(const shiftMode of ['automatic','manual']){
  const e=new RaceEditor({});e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
  e.playtestSession.transmissionType=shiftMode==='automatic'?'manual':'automatic';
  const car=structuredClone(e.selectedCar);
  car.transmissions={manual:{launchRpm:1800,gearRatios:[3.8,2.1,1.4,1]},automatic:{launchRpm:3800,gearRatios:[3.1,1.9,1.3,1]}};
  const pose=e.getRaceWorldPoseAtDistance(15);
  const ai={id:'consistent-launch',runtimeCar:car,carId:car.id,shiftMode,difficulty:'hard',
   worldX:pose.x,worldZ:pose.z,carYaw:pose.yaw,distance:15,projectedDistance:15,speedMps:0,gear:1,rpm:800,lap:1,currentLapMs:0};
  e.playtestSession.aiRuntime=[ai];
  initializeRaceVehiclePresentation(e);
  const expected=getRaceAiRuntimeTuning(e,ai,car),runner=ai.vehicleDynamicsRunner;
  assert.equal(runner.config.powertrainTuning.launchRpm,expected.launchRpm);
  assert.deepEqual(runner.config.powertrainTuning.gearRatios,expected.gearRatios);
  for(let i=0;i<120;i++)e.updateRaceAiDrivers(1/60,{preStartMode:'standing'});
  assert.strictEqual(ai.vehicleDynamicsRunner,runner,'countdown must retain the correctly initialized runner');
  assert.ok(Math.abs(ai.rpm-expected.launchRpm)<10);
  assert.ok(ai.speedMps<.1,'rev staging must not move the grid');
  const direct={...ai,vehicleDynamicsRunner:null,vehicleRenderState:null};
  e.updateRaceAiVehiclePhysics(direct,{seconds:0});
  assert.equal(direct.vehicleDynamicsRunner.config.powertrainTuning.launchRpm,expected.launchRpm,'direct initialization must use the AI car and transmission too');
 }
});
