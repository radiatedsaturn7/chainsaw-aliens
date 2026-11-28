import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HandlingAssist} from '../../src/racing/simulation/HandlingAssist.js';
import {measureRecoveryOverhold} from '../../tools/vehicle-validation/calibrate-digital-steering.mjs';
const assist=new HandlingAssist();
// Alchemilla setup from capture 89a59d2d, Blue Hills, 2026-11-23.
// Flat ground isolates input response; this is not a full recording replay.
const vehicle=JSON.parse(fs.readFileSync(new URL('../fixtures/alchemillaCaptureSetup.json',import.meta.url)));
const slide={groundSpeedMps:27,bodyLongitudinalSpeedMps:27,bodyLateralSpeedMps:-7.74,yawRateRadps:1};
test('faster digital input is directional and does not change ordinary turns, release or reverse',()=>{
 const base={speedMps:27,seconds:.1,vehicleConfig:vehicle.config};
 const ordinary=assist.stepDigitalSteering({...base,intent:1});
 assert.equal(assist.stepDigitalSteering({...base,intent:1,state:slide}),ordinary);
 assert.ok(Math.abs(assist.stepDigitalSteering({...base,intent:-1,state:slide}))>ordinary*2);
 for(const state of [{...slide,bodyLateralSpeedMps:0,yawRateRadps:0},
   {...slide,bodyLongitudinalSpeedMps:-27}, {...slide,bodyLongitudinalSpeedMps:0,bodyLateralSpeedMps:0}]){
  assert.equal(assist.stepDigitalSteering({...base,intent:-1,state}),-ordinary);
 }
 assert.equal(assist.stepDigitalSteering({...base,intent:0,state:slide}),0);
 assert.equal(assist.stepDigitalSteering({...base,intent:0,currentOutput:.5,state:slide}),
   assist.stepDigitalSteering({...base,intent:0,currentOutput:.5}));
 // UI sign differs from physical wheel sign; use the same recovery direction.
 assert.equal(assist.stepDigitalSteering({...base,intent:1,physicalIntent:-1,state:slide}),
   -assist.stepDigitalSteering({...base,intent:-1,state:slide}));
});
test('recovery reversal timing remains consistent across frame rates',()=>{
 const run=hz=>{let current=.3;for(let i=0;i<hz/5;i++)current=assist.stepDigitalSteering({
  intent:-1,currentOutput:current,speedMps:27,seconds:1/hz,state:slide,vehicleConfig:vehicle.config});return current;};
 for(const hz of [30,60,90,120])assert.ok(Math.abs(run(hz)-run(120))<1e-10);
});
test('captured high-power setup catches a severe slide without changing physical grip or producing a second skid',t=>{
 const options={...vehicle,speed:27,grip:1.2,initialSlipDeg:16,initialYawRate:1,delay:.2};
 const before=measureRecoveryOverhold({...options,recoveryResponse:false,absEnabled:false,tractionControlEnabled:false,stabilityControlEnabled:false});
 assert.equal(before.correctedAt,null,'old response reproduces the spin');
 for(const sign of [-1,1])for(const stabilityControlEnabled of [false,true])for(const aids of [false,true]){
  const after=measureRecoveryOverhold({...options,sign,stabilityControlEnabled,absEnabled:aids,tractionControlEnabled:aids});
  assert.ok(after.correctedAt!==null&&after.correctedAt<.4,JSON.stringify(after));
  assert.ok(after.maxSlipDeg<30,JSON.stringify(after));
  assert.ok(after.oppositeSlipDeg<5,JSON.stringify(after));
  t.diagnostic(JSON.stringify({sign,stabilityControlEnabled,aids,catchSeconds:after.correctedAt,maxSlipDeg:after.maxSlipDeg,oppositeSlipDeg:after.oppositeSlipDeg}));
 }
});

test('live race buttons pass authoritative motion and the inverted physical direction',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const {updateRaceSimulation}=await import('../../src/racing/RaceSimulation.js');
 const e=new RaceEditor({});
 e.preloadSelectedRaceArtRefs=()=>{};e.prewarmRacePlaytestRenderResources=()=>{};
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const session=e.playtestSession;
 Object.assign(session,{running:true,countdownRemainingMs:0,launchLockMs:0,elapsedMs:5000,startupFramePending:false,raceMusicPending:false});
 if(session.raceIntro)session.raceIntro.active=false;
 e.isRaceLaunchSteeringLocked=()=>false;
 Object.assign(e.raceInput,{binarySteer:1,steeringWheel:0,analogSteeringActive:false,paused:false});
 const controller=e.raceSimulationSystems.handlingAssist;
 const original=controller.stepDigitalSteering;
 let observed;
 controller.stepDigitalSteering=function(options){observed=options;return original.call(this,options);};
 try{
  updateRaceSimulation({editor:e,systems:e.raceSimulationSystems,dt:1/60});
  assert.ok(observed,'live simulation uses the digital controller');
  assert.equal(observed.intent,1);assert.equal(observed.physicalIntent,-1);
  assert.equal(observed.state,session.vehicleDynamicsRunner.state);
  assert.equal(observed.vehicleConfig,session.vehicleDynamicsRunner.config);
 }finally{controller.stepDigitalSteering=original;e.disposeRacePlaytestSession(session,'countersteer-test');}
});
