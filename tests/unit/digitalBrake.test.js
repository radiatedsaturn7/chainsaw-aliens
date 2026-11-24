import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceDigitalBrake} from '../../src/racing/DigitalBrake.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {captureRaceDrivingPreferences,restoreRaceDrivingPreferences} from '../../src/racing/RaceDrivingPreferences.js';

test('digital brake allows light presses, full held braking and immediate release',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let state={};
  for(let i=0;i<Math.round(.1/dt);i++)state=advanceDigitalBrake(state,{enabled:true,raw:1,dt});
  assert.ok(Math.abs(state.output-2/7)<1e-10);
  for(let i=0;i<Math.round(.3/dt);i++)state=advanceDigitalBrake(state,{enabled:true,raw:1,dt});
  assert.equal(state.output,1);
  state=advanceDigitalBrake(state,{enabled:true,raw:0,dt});assert.equal(state.output,0);
  assert.ok(advanceDigitalBrake(state,{enabled:true,raw:1,dt}).output<=3*dt+1e-9);
 }
});
test('disabled assist preserves existing pedal and analog triggers bypass assistance',()=>{
 assert.equal(advanceDigitalBrake({output:1},{legacy:.63}).output,.63);
 assert.equal(advanceDigitalBrake({output:1},{enabled:true,analog:true,legacy:.24}).output,.24);
});
test('assists menu is accessible, bounded, saves and returns to its parent',()=>{
 const e=new RaceEditor({});const saved=[];e.saveDrivingPreference=p=>saved.push(p);
 e.raceInput.pauseMenuMode='car-controls';
 assert.ok(e.getRacePauseMenuRows().length<=8);
 e.getRacePauseMenuRows().find(r=>r.id==='race-car-assists').onClick();
 assert.equal(e.raceInput.pauseMenuMode,'car-assists');
 e.getRacePauseMenuRows().find(r=>r.id==='race-brake-assist').onClick();
 assert.equal(e.raceInput.brakeAssistEnabled,true);assert.deepEqual(saved.at(-1),{raceBrakeAssist:true});
 e.getRacePauseMenuRows().find(r=>r.id==='race-throttle-assist').onAdjust(1);
 assert.equal(e.raceInput.digitalThrottleMode,'on');
 const profile=captureRaceDrivingPreferences(e.raceInput);
 restoreRaceDrivingPreferences(e.raceInput,{});assert.equal(e.raceInput.brakeAssistEnabled,false);
 restoreRaceDrivingPreferences(e.raceInput,JSON.parse(JSON.stringify(profile)));
 assert.equal(e.raceInput.brakeAssistEnabled,true);assert.equal(e.raceInput.digitalThrottleMode,'on');
 e.backRacePauseMenu();assert.equal(e.raceInput.pauseMenuMode,'car-controls');
 assert.equal(e.getRacePauseMenuRows()[e.raceInput.pauseMenuIndex].id,'race-car-assists');
});
test('assisted simulated brake preserves double-tap hold/release handbrake with ABS and TC on or off',()=>{
 for(const assists of [false,true]){
  const e=new RaceEditor({});e.playtestSession={running:true};e.isLivePlaytestSession=()=>true;
  Object.assign(e.raceInput,{brakeAssistEnabled:true,absEnabled:assists,tractionControlEnabled:assists});
  const tap=t=>{e.raceInput.inputClockMs=t;e.handleRacePlaytestPointerDown({playtestControl:'brake'},{id:'r'});};
  const step=()=>{e.applyRaceAnalogInput();e.updateRacePedalAxes(1/60);};
  tap(1000);step();assert.ok(e.raceInput.brakeAxis>0&&e.raceInput.brakeAxis<.1);assert.equal(e.raceInput.handbrake,false);
  tap(1050);assert.equal(e.raceInput.handbrake,false,'duplicate down during a light press is not a second tap');
  e.handlePointerUp({id:'r'});step();assert.equal(e.raceInput.brakeAxis,0);
  tap(1200);step();assert.equal(e.raceInput.handbrake,true);
  for(let i=0;i<60;i++)step();
  assert.equal(e.raceInput.handbrake,true);assert.equal(e.raceInput.brakeAxis,0);
  e.handlePointerUp({id:'r'});step();assert.equal(e.raceInput.handbrake,false);assert.equal(e.raceInput.brakeAxis,0);
 }
});

test('brief lift remembers delivered pressure, restores smoothly, and long lift resets',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s={output:.65,pedalPosition:.65,wasPressed:true};
  for(let i=0;i<Math.round(.1/dt);i++)s=advanceDigitalBrake(s,{enabled:true,raw:0,dt});
  assert.equal(s.output,0);
  assert.ok(Math.abs(s.pedalPosition-.65*Math.exp(-.1/.35))<1e-9);
  for(let i=0;i<Math.round(.4/dt);i++)s=advanceDigitalBrake(s,{enabled:true,raw:1,dt});
  assert.ok(s.output>.5 && s.output<.8);
  for(let i=0;i<Math.round(1.3/dt);i++)s=advanceDigitalBrake(s,{enabled:true,raw:0,dt});
  assert.equal(s.pedalPosition,0);
  for(let i=0;i<Math.round(.4/dt);i++)s=advanceDigitalBrake(s,{enabled:true,raw:1,dt});
  assert.equal(s.output,1);
 }
});
test('incipient lock holds pressure; severe lock relieves it and recovered grip promptly restores it',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const input={enabled:true,raw:1,dt,feedbackValid:true};
  let s={output:.6,pedalPosition:.6,filteredLock:.16};
  for(let i=0;i<Math.round(.5/dt);i++)s=advanceDigitalBrake(s,{...input,brakeLock:.16});
  assert.equal(s.output,.6);
  for(let i=0;i<Math.round(.2/dt);i++)s=advanceDigitalBrake(s,{...input,brakeLock:1});
  assert.ok(s.output>.25 && s.output<.4);
  for(let i=0;i<Math.round(.5/dt);i++)s=advanceDigitalBrake(s,{...input,brakeLock:0});
  assert.ok(s.output>.85,'no lingering slow-rebuild timer');
  assert.equal(advanceDigitalBrake(s,{...input,raw:0,brakeLock:1}).output,0);
 }
});
test('ABS retains pedal demand despite wheel slip; assist off and analog remain unchanged',()=>{
 for(const absEnabled of [true,false]){
  const s=advanceDigitalBrake({output:.8,pedalPosition:.8},{enabled:true,raw:1,dt:.1,feedbackValid:true,brakeLock:1,absEnabled});
  assert.ok(absEnabled?s.output>.8:s.output<.8);
 }
});

test('rear axle lock receives timely relief even when the whole-car average is modest',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const input={enabled:true,raw:1,dt,feedbackValid:true,brakeLock:.22,frontBrakeLock:.12,rearBrakeLock:.85,rearPairLock:.85};
  let s={output:.7,pedalPosition:.7};
  for(let i=0;i<Math.round(.15/dt);i++)s=advanceDigitalBrake(s,input);
  assert.ok(s.output>.1 && s.output<.35,'relieve sustained rear lock without zeroing the pedal');
  for(let i=0;i<Math.round(.6/dt);i++)s=advanceDigitalBrake(s,{...input,brakeLock:.01,frontBrakeLock:.01,rearBrakeLock:.01,rearPairLock:.01});
  assert.ok(s.output>.8,'recovered wheels must regain usable braking promptly');
  const released=advanceDigitalBrake(s,{...input,raw:0});
  assert.equal(released.output,0);
  const abs=advanceDigitalBrake({output:.7,pedalPosition:.7},{...input,absEnabled:true});
  assert.ok(abs.output>.7);
 }
});
test('isolated lightly loaded wheel slip does not suppress the entire brake pedal',()=>{
 let s={output:.4,pedalPosition:.4};
 for(let i=0;i<30;i++)s=advanceDigitalBrake(s,{enabled:true,raw:1,dt:1/60,feedbackValid:true,lock:1,brakeLock:.06,frontBrakeLock:.05,rearBrakeLock:.1});
 assert.ok(s.output>.6);
});

test('tire-normalized brake feedback reduces pressure earlier but ABS and release retain authority',()=>{
 const previous={output:.5,pedalPosition:.5,wasPressed:true};
 const inputs={enabled:true,raw:1,dt:1/60,feedbackValid:true,brakeLock:.08};
 let road=previous,loose=previous;
 for(let i=0;i<20;i++){
  road=advanceDigitalBrake(road,inputs);
  loose=advanceDigitalBrake(loose,{...inputs,brakeControlLock:.3,rearPairControlLock:.3});
 }
 assert.ok(loose.output<road.output);
 assert.equal(advanceDigitalBrake(loose,{...inputs,raw:0}).output,0);
 assert.equal(advanceDigitalBrake(previous,{...inputs,absEnabled:true}).output,advanceDigitalBrake(previous,{...inputs,absEnabled:true,brakeControlLock:.9,rearPairControlLock:.9}).output);
});

test('ABS-on pedal history is identical across peak-slip feedback, including repeated releases',()=>{
 let plain={},normalized={};
 for(let i=0;i<600;i++){
  const input={enabled:true,absEnabled:true,feedbackValid:true,raw:i%85<60?1:0,dt:1/60,brakeLock:(i%100)/100,rearPairLock:(i%77)/77};
  plain=advanceDigitalBrake(plain,input);
  normalized=advanceDigitalBrake(normalized,{...input,brakeControlLock:1,rearPairControlLock:1});
  for(const key of ['output','pedalPosition','releaseSeconds','holdSeconds','reapplying','correction'])assert.equal(normalized[key],plain[key]);
 }
});


test('ABS permits a prompt smooth brake application without speeding the non-ABS ramp',()=>{
 for(const hz of [30,60,120]){
  let abs={},normal={};const dt=1/hz;
  for(let i=0;i<hz*.2;i++){
   abs=advanceDigitalBrake(abs,{enabled:true,raw:1,absEnabled:true,dt});
   normal=advanceDigitalBrake(normal,{enabled:true,raw:1,absEnabled:false,dt});
  }
  assert.ok(Math.abs(abs.output-1)<1e-9);
  assert.ok(Math.abs(normal.output-4/7)<1e-9);
  assert.equal(advanceDigitalBrake(abs,{enabled:true,raw:0,absEnabled:true,dt}).output,0);
 }
});

test('ABS reapplication keeps its prompt ramp instead of inheriting the slow non-ABS correction rate',()=>{
 for(const hz of [30,60,120]){
  const dt=1/hz;let s={output:.4,pedalPosition:.4,wasPressed:true};
  s=advanceDigitalBrake(s,{enabled:true,absEnabled:true,raw:0,dt});assert.equal(s.output,0);
  for(let i=0;i<Math.ceil(.22*hz);i++)s=advanceDigitalBrake(s,{enabled:true,absEnabled:true,raw:1,dt});
  assert.equal(s.output,1);
 }
});
