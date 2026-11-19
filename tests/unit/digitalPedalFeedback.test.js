import test from 'node:test';
import assert from 'node:assert/strict';
import {digitalPedalFeedback} from '../../src/racing/DigitalPedalFeedback.js';
import {advanceDigitalThrottle} from '../../src/racing/DigitalThrottle.js';
import {advanceDigitalBrake} from '../../src/racing/DigitalBrake.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const patches = slip => Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{normalLoadN:3500,validTreadContact:true,rawSlipRatio:slip}]));
test('feedback uses grounded driven wheels and respects reverse travel',()=>{
 const state={bodyLongitudinalSpeedMps:10,contactPatches:patches(.8)};
 assert.equal(digitalPedalFeedback(state,{drivetrain:'awd'}).spin,.8*10/Math.hypot(10,3));
 state.contactPatches.fl.rawSlipRatio=2;state.contactPatches.fr.rawSlipRatio=2;
 assert.equal(digitalPedalFeedback(state,{drivetrain:'rwd'}).spin,.8*10/Math.hypot(10,3));
 state.bodyLongitudinalSpeedMps=-10;
 assert.equal(digitalPedalFeedback(state).lock,2);
 for(const p of Object.values(state.contactPatches))p.validTreadContact=false;
 assert.equal(digitalPedalFeedback(state).feedbackValid,false);
});
test('brake feathers locking wheels then reapplies gently, never alters analog pedals',()=>{
 let s={output:1};
 for(let i=0;i<12;i++)s=advanceDigitalBrake(s,{enabled:true,raw:1,feedbackValid:true,lock:1,dt:1/60});
 assert.ok(s.output>.4 && s.output<.7);
 const next=advanceDigitalBrake(s,{enabled:true,raw:1,feedbackValid:true,lock:0,dt:.1});
 assert.ok(next.output>s.output && next.output-s.output<.15);
 assert.equal(advanceDigitalBrake(s,{enabled:true,raw:0,feedbackValid:true,lock:1,dt:.1}).output,0);
 assert.equal(advanceDigitalBrake(s,{enabled:true,analog:true,legacy:.7,lock:1,feedbackValid:true}).output,.7);
 assert.equal(advanceDigitalThrottle({output:.2},{mode:'on',analog:true,legacy:.7,spin:2,feedbackValid:true}).output,.7);
});
test('editor feeds live contact telemetry into pedals independently of ABS and TC',()=>{
 for(const abs of [false,true])for(const tc of [false,true]){
  const e=new RaceEditor({});
  e.playtestSession={vehicleDynamicsRunner:{state:{bodyLongitudinalSpeedMps:10,contactPatches:patches(1.7)}},digitalThrottle:{output:1}};
  Object.assign(e.raceInput,{rawThrottleAxis:1,rawBrakeAxis:0,digitalThrottleMode:'on',brakeAssistEnabled:true,absEnabled:abs,tractionControlEnabled:tc});
  e.updateRacePedalAxes(.1,{tuning:{drivetrain:'awd'}});assert.ok(e.raceInput.throttleAxis>0 && e.raceInput.throttleAxis<1);
  e.playtestSession.vehicleDynamicsRunner.state.contactPatches=patches(-1);
  e.playtestSession.digitalBrake={output:1};e.raceInput.rawBrakeAxis=1;
  e.updateRacePedalAxes(.1);
  if(abs)assert.equal(e.raceInput.brakeAxis,1);
  else assert.ok(e.raceInput.brakeAxis<.5 && e.raceInput.brakeAxis>.3);
  assert.equal(e.raceInput.absEnabled,abs);assert.equal(e.raceInput.tractionControlEnabled,tc);
  e.raceInput.handbrake=true;e.raceInput.activeBrakePointerId='r';
  e.updateRacePedalAxes(.1);assert.equal(e.raceInput.brakeAxis,0);assert.equal(e.raceInput.handbrake,true);
 }
});
test('double tap removes service braking even when both pedal assists are off',()=>{
 const e=new RaceEditor({});e.playtestSession={};e.raceInput.rawBrakeAxis=1;
 e.raceInput.handbrake=true;e.raceInput.activeBrakePointerId='r';e.raceInput.brakeAxis=1;
 e.updateRacePedalAxes(.02);assert.equal(e.raceInput.brakeAxis,0);
 // A separately operated physical handbrake can still be combined with service brakes.
 e.raceInput.activeBrakePointerId=null;e.updateRacePedalAxes(.1);assert.ok(e.raceInput.brakeAxis>0);
});

test('wheel-speed feedback stays continuous through the old 1.5 m/s cutoff and a stop',()=>{
 const samples=[];
 for(const speed of [0,1.49,1.5,1.51]){
  const contactPatches=patches(8);
  for(const p of Object.values(contactPatches))Object.assign(p,{longitudinalVelocityMps:speed,wheelAngularVelocityRadps:10,effectiveRollingRadiusM:.33});
  const f=digitalPedalFeedback({bodyLongitudinalSpeedMps:speed,contactPatches});
  assert.equal(f.feedbackValid,true);samples.push(f.spin);
 }
 assert.ok(samples[0]>1);
 assert.ok(Math.abs(samples[1]-samples[3])<.02);
});

test('braking feedback weights supported wheels instead of following one lightly loaded wheel',()=>{
 const state={bodyLongitudinalSpeedMps:20,contactPatches:patches(-.05)};
 Object.assign(state.contactPatches.rr,{normalLoadN:200,rawSlipRatio:-1});
 const light=digitalPedalFeedback(state);
 assert.equal(light.lock,1);
 assert.ok(light.brakeLock<.08);
 state.contactPatches=patches(-1);
 assert.equal(digitalPedalFeedback(state).brakeLock,1);
 state.contactPatches=patches(-.05);
 Object.assign(state.contactPatches.fl,{normalLoadN:6000,rawSlipRatio:-1});
 assert.ok(digitalPedalFeedback(state).brakeLock>.35);
});

test('axle feedback detects unloaded rear pair lock without letting one light wheel dominate',()=>{
 const state={bodyLongitudinalSpeedMps:30,contactPatches:patches(-.12)};
 for(const id of ['fl','fr'])state.contactPatches[id].normalLoadN=6000;
 for(const id of ['rl','rr'])Object.assign(state.contactPatches[id],{normalLoadN:1200,rawSlipRatio:-.85});
 const pair=digitalPedalFeedback(state);
 assert.ok(pair.brakeLock<.25);
 assert.ok(pair.rearBrakeLock>.8);
 assert.equal(pair.rearPairLock,.85);
 assert.ok(Math.abs(pair.frontBrakeLock-.12)<1e-9);
 Object.assign(state.contactPatches.rl,{normalLoadN:200,rawSlipRatio:-1});
 Object.assign(state.contactPatches.rr,{normalLoadN:3500,rawSlipRatio:-.05});
 const single=digitalPedalFeedback(state);
 assert.ok(single.rearBrakeLock<.11);
 assert.equal(single.rearPairLock,.05);
 for(const id of ['rl','rr'])state.contactPatches[id].validTreadContact=false;
 assert.equal(digitalPedalFeedback(state).rearBrakeLock,0);
});

test('tire peak-slip feedback anticipates loose-surface lock without changing physical diagnostics',()=>{
 const patch=(peak)=>({normalLoadN:3000,rawSlipRatio:-.08,peakLongitudinalSlipRatio:peak,validTreadContact:true});
 const chassis={bodyLongitudinalSpeedMps:15,contactPatches:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,patch(.06)]))};
 const loose=digitalPedalFeedback(chassis);
 assert.equal(loose.brakeLock,.08);
 assert.ok(Math.abs(loose.brakeControlLock-.24)<1e-12);
 assert.ok(Math.abs(loose.rearPairControlLock-.24)<1e-12);
 for(const p of Object.values(chassis.contactPatches))p.peakLongitudinalSlipRatio=.25;
 const road=digitalPedalFeedback(chassis);
 assert.equal(road.brakeControlLock,road.brakeLock,'never increase allowed pressure beyond existing slip thresholds');
 for(const p of Object.values(chassis.contactPatches))delete p.peakLongitudinalSlipRatio;
 assert.equal(digitalPedalFeedback(chassis).brakeControlLock,.08);
 chassis.contactPatches.rr.validTreadContact=false;
 assert.equal(digitalPedalFeedback(chassis).rearPairControlLock,0);
});

test('one unloaded low-peak tire cannot change otherwise dry-road brake feedback',()=>{
 const state={bodyLongitudinalSpeedMps:20,contactPatches:{
  fl:{normalLoadN:6000,rawSlipRatio:-.08,peakLongitudinalSlipRatio:.18},
  fr:{normalLoadN:6000,rawSlipRatio:-.08,peakLongitudinalSlipRatio:.18},
  rl:{normalLoadN:150,rawSlipRatio:-.08,peakLongitudinalSlipRatio:.03},
  rr:{normalLoadN:1500,rawSlipRatio:-.08,peakLongitudinalSlipRatio:.18}
 }};
 const feedback=digitalPedalFeedback(state);
 assert.ok(feedback.brakePeakSlip>.12);
 assert.equal(feedback.brakeControlLock,feedback.brakeLock);
 assert.equal(feedback.rearPairControlLock,feedback.rearPairLock);
});

test('powered slip follows gear through opposite travel without changing brake feedback',()=>{
 for(const drivetrain of ['awd','fwd','rwd'])for(const gear of [1,-1]){
  const contactPatches=patches(8*gear);
  for(const p of Object.values(contactPatches))Object.assign(p,{longitudinalVelocityMps:-2*gear,wheelAngularVelocityRadps:30*gear,effectiveRollingRadiusM:.33});
  const state={gear,bodyLongitudinalSpeedMps:-2*gear,contactPatches};
  const f=digitalPedalFeedback(state,{drivetrain});
  assert.ok(f.spin>3,'opposing motion must not conceal powered wheelspin');
  const moving=digitalPedalFeedback({...state,gear:undefined},{drivetrain});
  assert.equal(f.brakeLock,moving.brakeLock);
  assert.equal(f.rearPairControlLock,moving.rearPairControlLock);
  for(const p of Object.values(contactPatches))delete p.wheelAngularVelocityRadps;
  assert.ok(digitalPedalFeedback(state,{drivetrain}).spin>4,'slip-only fallback must use gear too');
 }
 const samples=[-.01,0,.01].map(speed=>digitalPedalFeedback({gear:1,bodyLongitudinalSpeedMps:speed,contactPatches:{fl:{normalLoadN:3000,rawSlipRatio:8,longitudinalVelocityMps:speed,wheelAngularVelocityRadps:30,effectiveRollingRadiusM:.33}}},{drivetrain:'fwd'}).spin);
 assert.ok(Math.max(...samples)-Math.min(...samples)<.01);
});
