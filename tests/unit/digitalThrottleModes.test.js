import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceDigitalThrottle as step,advanceAggressiveDigitalThrottle as aggressive} from '../../src/racing/DigitalThrottle.js';
import {digitalPedalFeedback} from '../../src/racing/DigitalPedalFeedback.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const input={mode:'on',raw:1,dt:1/60,feedbackValid:true,spin:0};
function run(state,seconds,options={}){for(let i=0;i<Math.round(seconds/(options.dt||input.dt));i++)state=step(state,{...input,...options});return state;}
test('first press responds now; two short presses latch aggressive only until release',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s=step({}, {...input,dt});assert.ok(s.output>0);assert.equal(s.throttleStyle,'traction');
  s=run(s,.08,{dt});s=run(s,.05,{dt,raw:0});assert.equal(s.output,0);
  s=step(s,{...input,dt});assert.equal(s.throttleStyle,'aggressive');
  s=run(s,2,{dt,spin:4});assert.equal(s.throttleStyle,'aggressive');
  s=step(s,{...input,dt,raw:0});assert.equal(s.output,0);assert.equal(s.aggressiveHold,false);
  s=step(s,{...input,dt});assert.equal(s.throttleStyle,'traction');
 }
});
test('long holds and delayed reapplication are not double taps; brake and bypass cancel gesture',()=>{
 let s=run({},.5);s=step(s,{...input,raw:0});s=step(s,input);assert.equal(s.aggressiveHold,false);
 s=run({},.05);s=run(s,.4,{raw:0});assert.equal(step(s,input).aggressiveHold,false);
 for(const bypass of [{analog:true},{staging:true},{mode:'off'},{brake:1}]){
  let state={aggressiveHold:true,gesturePressed:true,tapAge:.1,output:.6,pedalPosition:.6};
  state=step(state,{...input,...bypass,legacy:.7});assert.equal(state.aggressiveHold,false);assert.equal(state.tapAge,null);
  assert.equal(state.output,bypass.brake?0:.7);
 }
});
test('traction hold reduces sustained spin, prevents demand buildup and recovers smoothly',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s=run({},.6,{dt});const before=s.output;
  s=run(s,.3,{dt,spin:2});assert.ok(s.output<before*.9);assert.ok(s.output>before*.45);assert.equal(s.output,s.pedalPosition);
  let previous=s.output;
  for(let i=0;i<2/dt;i++){
   s=step(s,{...input,dt,spin:0});assert.ok(s.output-previous<=dt+1e-9);previous=s.output;
  }
  assert.ok(s.output>.95,'holding should recover full demand when grip returns');
  assert.equal(step(s,{...input,raw:0,dt}).output,0);
 }
});
test('aggressive hold matches old algorithm and normal hold permits small useful slip',()=>{
 let old={},s={aggressiveHold:true,gesturePressed:true};
 for(let i=0;i<180;i++){
  const args={...input,spin:2};old=aggressive(old,args);s=step(s,args);
  assert.equal(s.output,old.output);assert.equal(s.pedalPosition,old.pedalPosition);
 }
 assert.equal(run({},2,{spin:.08,throttleSlipAllowance:.15}).output,1);
 assert.equal(run({},3.1,{spin:4,throttleFeedbackValid:false}).output,1);
});
test('tire feedback ignores non-driven contacts for traction control',()=>{
 const patches=Object.fromEntries(['fl','fr'].map(id=>[id,{normalLoadN:3000,rawSlipRatio:0,peakLongitudinalSlipRatio:.08}]));
 const rear=digitalPedalFeedback({contactPatches:patches},{drivetrain:'rwd'});
 assert.equal(rear.feedbackValid,true);assert.equal(rear.throttleFeedbackValid,false);
 const front=digitalPedalFeedback({contactPatches:patches},{drivetrain:'fwd'});
 assert.equal(front.throttleFeedbackValid,true);assert.equal(front.throttleSlipAllowance,.12);
});
test('simulated go button gesture flows through editor to assisted throttle',()=>{
 const e=new RaceEditor({});e.playtestSession={running:true};e.isLivePlaytestSession=()=>true;
 e.raceInput.digitalThrottleMode='on';
 const tick=n=>{for(let i=0;i<n;i++){e.applyRaceAnalogInput();e.updateRacePedalAxes(1/60);}};
 const press=()=>e.handleRacePlaytestPointerDown({playtestControl:'go'},{id:'g'});
 press();tick(5);assert.equal(e.playtestSession.digitalThrottle.throttleStyle,'traction');
 e.handlePointerUp({id:'g'});tick(3);assert.equal(e.raceInput.throttleAxis,0);
 press();tick(1);assert.equal(e.playtestSession.digitalThrottle.throttleStyle,'aggressive');
 tick(60);assert.equal(e.raceInput.throttleAxis,1);
 e.handlePointerUp({id:'g'});tick(1);assert.equal(e.playtestSession.digitalThrottle.aggressiveHold,false);
});


test('ordinary hold permits mild wheelspin and blends smoothly into relief',()=>{
 for(const dt of [1/30,1/60,1/120]){
  assert.equal(run({},2,{dt,spin:.18,throttleSlipAllowance:.15}).output,1);
  const state={output:.4,pedalPosition:.4,wasPressed:true,gesturePressed:true,tractionFilteredSpin:.20};
  const args={...input,dt,throttleSlipAllowance:.16};
  const below=step({...state,tractionFilteredSpin:.199},{...args,spin:.199});
  const above=step({...state,tractionFilteredSpin:.201},{...args,spin:.201});
  assert.ok(above.output>.4,'a tiny threshold crossing must not stall pedal travel');
  assert.ok(Math.abs(above.output-below.output)<.001);
  assert.equal(step(above,{...args,raw:0}).output,0);
 }
});

test('soft half-redline target restores driver ramp below target without a pedal floor',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const previous={output:.2,pedalPosition:.2,wasPressed:true,gesturePressed:true,tractionFilteredSpin:.6};
  const args={...input,dt,spin:.6,engineRpm:2100,maxRpm:7000,gear:1};
  const low=step(previous,args),high=step(previous,{...args,engineRpm:4000});
  assert.equal(low.rpmTarget,3500);assert.ok(low.rpmRecovery>.8);
  assert.equal(step({...previous,output:.35,pedalPosition:.35},args).rpmRecovery,0,
   'low revs alone must not relax grip control once delivered power is up');
  assert.ok(low.output>.2&&low.output<=.2+dt);
  assert.ok(high.output<.2);assert.equal(high.rpmRecovery,0);
  assert.ok(step({},args).output<=dt,'initial press must still ramp from zero');
  assert.equal(step(low,{...args,raw:0}).output,0);
  assert.equal(step(low,{...args,brake:1}).output,0);
  const near=step(previous,{...args,engineRpm:3499});
  assert.ok(Math.abs(near.output-step(previous,{...args,engineRpm:3501}).output)<.001);
 }
});
test('RPM recovery leaves neutral, shifts, limiter, invalid telemetry and excessive spin protected',()=>{
 const previous={output:.4,pedalPosition:.4,wasPressed:true,gesturePressed:true,tractionFilteredSpin:.6};
 const args={...input,spin:.6,engineRpm:1800,maxRpm:7000,gear:1};
 assert.equal(step({...previous,tractionFilteredSpin:4},{...args,spin:4}).rpmRecovery,0);
 for(const change of [{lateralSpeedMps:3,speedMps:10},{gear:0},{shifting:true},{revLimiterActive:true},{engineRpm:NaN},{maxRpm:0},{throttleFeedbackValid:false}]){
  const s=step(previous,{...args,...change});assert.equal(s.rpmRecovery,0);
 }
 for(const change of [{analog:true},{mode:'off'},{staging:true}]){
  const s=step(previous,{...args,spin:.5,legacy:.37,...change});assert.equal(s.output,.37);assert.equal(s.rpmRecovery,0);
 }
 const s=step({...previous,aggressiveHold:true},{...args,spin:.5});
 assert.equal(s.rpmRecovery,0);assert.equal(s.output,aggressive(previous,{...args,spin:.5}).output);
});
test('race editor supplies the live engine speed and configured rev limit',()=>{
 const e=new RaceEditor({});
 e.playtestSession={vehicleDynamicsRunner:{config:{maxRpm:8000},state:{engineRpm:2200,gear:1,bodyLongitudinalSpeedMps:5,contactPatches:{fl:{normalLoadN:3000,rawSlipRatio:.4,peakLongitudinalSlipRatio:.16}}}}};
 Object.assign(e.raceInput,{digitalThrottleMode:'on',rawThrottleAxis:1,rawBrakeAxis:0});
 e.updateRacePedalAxes(1/60,{tuning:{drivetrain:'fwd',revLimitRpm:7000}});
 assert.equal(e.playtestSession.digitalThrottle.rpmTarget,4000);
 assert.ok(e.playtestSession.digitalThrottle.rpmRecovery>0);
});

test('settling wheelspin holds delivered power through a slide without adding demand',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const previous={output:.24,pedalPosition:.24,wasPressed:true,gesturePressed:true,tractionFilteredSpin:.65};
  const args={...input,dt,spin:.4,engineRpm:1800,maxRpm:6300,gear:1,speedMps:5,lateralSpeedMps:8};
  const settling=step(previous,args);
  assert.equal(settling.rpmRecovery,0);
  assert.equal(settling.settlingRelief,1);
  assert.equal(settling.output,.24,'hold, not a fresh power surge');
  assert.equal(settling.pedalPosition,settling.output);
  const growing=step(previous,{...args,spin:.8});
  assert.equal(growing.settlingRelief,0);assert.ok(growing.output<.24);
  const steady=step(previous,{...args,spin:.65});
  assert.equal(steady.settlingRelief,0);assert.ok(steady.output<.24);
  assert.equal(step(settling,{...args,raw:0}).output,0);
  assert.equal(step(settling,{...args,brake:1}).output,0);
  assert.equal(step(previous,{...args,revLimiterActive:true}).settlingRelief,0);
  assert.equal(step({...previous,tractionFilteredSpin:4},{...args,spin:3}).settlingRelief,0);
  assert.equal(step(previous,{...args,throttleFeedbackValid:false}).settlingRelief,0);
 }
});

test('reapplication cannot stick at zero while residual wheelspin is reported',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const args={...input,dt,spin:.8,engineRpm:900,maxRpm:6300,gear:1,speedMps:-2,lateralSpeedMps:8};
  let s={output:.2,pedalPosition:.2,wasPressed:true,gesturePressed:true,tractionFilteredSpin:.8};
  s=step(s,{...args,raw:0});assert.equal(s.output,0);
  const first=step(s,args);assert.ok(first.output>0&&first.output<=3.5*dt);
  s=run(s,.4,args);assert.ok(s.output>.04&&s.output<.1);
  assert.equal(s.throttleStyle,'traction');assert.equal(s.output,s.pedalPosition);
  assert.equal(step(s,{...args,raw:0}).output,0);
  assert.equal(step(s,{...args,brake:1}).output,0);
  const limited=step({output:0,pedalPosition:0,gesturePressed:true,wasPressed:true,filteredSpin:3,tractionFilteredSpin:3},{...args,spin:3,revLimiterActive:true});
  assert.equal(limited.output,0,'restart must not bypass the core limiter');
 }
});
