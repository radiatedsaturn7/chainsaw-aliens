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
 const before={countdown:s.countdownRemainingMs,elapsed:s.elapsedMs,distance:s.distance};
 initializeRaceVehiclePresentation(e);
 assert.equal(s.vehicleRenderState.position.y,s.vehicleDynamicsRunner.state.position.y);
 assert.equal(s.vehicleDynamicsRunner.stepIndex,0);
 assert.deepEqual({countdown:s.countdownRemainingMs,elapsed:s.elapsedMs,distance:s.distance},before);
 const runner=s.vehicleDynamicsRunner;initializeRaceVehiclePresentation(e);assert.equal(s.vehicleDynamicsRunner,runner);
 const height=s.vehicleRenderState.position.y;s.startupFramePending=false;e.updatePlaytest(.016);
 assert.ok(Math.abs(s.vehicleRenderState.position.y-height)<.002);
});
