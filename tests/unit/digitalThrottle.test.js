import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAggressiveDigitalThrottle as advanceDigitalThrottle,observeDrivingIntent,DIGITAL_THROTTLE_MODES} from '../../src/racing/DigitalThrottle.js';
import {restoreRaceDrivingPreferences} from '../../src/racing/RaceDrivingPreferences.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
function pedal(seconds,{dt=1/120,...input}={}) {
 let state={};for(let i=0;i<Math.round(seconds/dt);i++)state=advanceDigitalThrottle(state,{mode:'on',raw:1,dt,...input});return state;
}
function observe(input,previous={},seconds=.3){for(let i=0;i<seconds*120;i++)previous=observeDrivingIntent(previous,{dt:1/120,...input});return previous;}
test('sideways motion with throttle alone remains uncertain, not an assumed drift',()=>{
 const input={longitudinalSpeed:15,lateralSpeed:4,steering:-.4,throttle:1};
 const uncertain=observe(input);assert.equal(uncertain.label,'Uncertain slide');
 const entry=observe({...input,handbrake:1});
 const slide=observe(input,entry);assert.equal(slide.label,'Slide likely');
 const recovery=observe({...input,throttle:0},slide);assert.equal(recovery.label,'Recovery');
 assert.equal(observe({...input,lateralSpeed:0,steering:0},recovery).label,'Accelerating');
});
test('intent labels debounce and expire deliberate-slide evidence',()=>{
 const input={longitudinalSpeed:15,lateralSpeed:4,steering:-.4,throttle:1};
 const entry=observe({...input,handbrake:1});
 const slide=observe(input,entry);
 assert.equal(observe({...input,throttle:0},slide,.05).label,'Slide likely');
 assert.equal(observe(input,slide,3).label,'Uncertain slide');
});
test('intent preference never changes digital pedal output',()=>{
 for(const style of ['grip','rally','drift']){
  const intent=observe({style,longitudinalSpeed:15,lateralSpeed:4,throttle:1});
  assert.deepEqual(pedal(.5,{intent,style}),pedal(.5));
 }
});

test('held button can still reach full throttle through sustained spin without a permanent ceiling',()=>{
 for(const dt of [1/30,1/60,1/120]){
  assert.ok(Math.abs(pedal(.2,{dt}).output-.2)<1e-10);
  assert.ok(pedal(3,{dt,spin:8,feedbackValid:true}).output>1-1e-9);
 }
 let s={output:.02,pedalLimit:.02,filteredSpin:8};
 for(let i=0;i<180;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,spin:8,feedbackValid:true,dt:1/60});
 assert.equal(s.output,1);
});
test('release cuts immediately while memory decays, brake erases both',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s=pedal(.4,{dt});
  s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt});
  assert.equal(s.output,0);assert.ok(s.pedalPosition>0 && s.pedalPosition<.4);
  for(let i=0;i<Math.round(2/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt});
  assert.equal(s.pedalPosition,0);
 }
 const s=advanceDigitalThrottle({output:1,pedalPosition:1},{mode:'on',raw:1,brake:1,dt:1/120});
 assert.equal(s.output,0);assert.equal(s.pedalPosition,0);
});
test('re-press continuously builds from the decayed position at a gradually increasing rate',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s=pedal(.4,{dt});
  for(let i=0;i<Math.round(.2/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt});
  const remembered=s.pedalPosition;assert.ok(Math.abs(remembered-(.4*Math.exp(-.2/.35)))<1e-9);
  for(let i=0;i<Math.round(.3/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt});
  assert.ok(Math.abs(s.output-(remembered+.132))<1e-9);
  for(let i=0;i<Math.round(1.2/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt});
  assert.equal(s.output,1);
 }
});
test('slow correction rhythm stays partial rather than ratcheting to full throttle',()=>{
 const dt=1/120;let s=pedal(.5);
 for(let cycle=0;cycle<15;cycle++){
  for(let i=0;i<24;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt});
  for(let i=0;i<54;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt});
  assert.ok(s.output>.15 && s.output<.85);
 }
});
test('analog, off and staging bypass gestures; launch choice remains respected',()=>{
 for(const extra of [{mode:'off'},{analog:true},{staging:true}])assert.equal(advanceDigitalThrottle({}, {mode:'on',legacy:.73,...extra}).output,.73);
 const s=advanceDigitalThrottle({}, {mode:'on',staging:true,legacy:1});
 assert.equal(advanceDigitalThrottle(s,{mode:'on',raw:1,launchEnabled:true,dt:1/60}).output,1);
 assert.ok(advanceDigitalThrottle(s,{mode:'on',raw:1,launchEnabled:false,dt:1/60}).output<.11);
});
test('menus expose only on/off and old profiles migrate enabled modes',()=>{
 assert.deepEqual(DIGITAL_THROTTLE_MODES,['off','on']);
 const e=new RaceEditor({});const saved=[];e.saveDrivingPreference=p=>saved.push(p);
 for(const old of ['progressive','adaptive']){
  restoreRaceDrivingPreferences(e.raceInput,{raceDigitalThrottle:old});assert.equal(e.raceInput.digitalThrottleMode,'on');
 }
 for(const menu of ['car-assists','debug-input']){
  e.raceInput.pauseMenuMode=menu;
  const row=e.getRacePauseMenuRows().find(r=>r.id==='race-throttle-assist'||r.id==='race-debug-input-pedal');
  assert.equal(row.value,'On');row.onClick();assert.equal(e.raceInput.digitalThrottleMode,'off');
  row.onAdjust(-1);assert.equal(e.raceInput.digitalThrottleMode,'on');
 }
 assert.deepEqual(saved.at(-1),{raceDigitalThrottle:'on'});
});

test('simulated go button can feather, then demand full power with ABS/TC off',()=>{
 const e=new RaceEditor({});e.playtestSession={running:true};e.isLivePlaytestSession=()=>true;
 Object.assign(e.raceInput,{digitalThrottleMode:'on',absEnabled:false,tractionControlEnabled:false});
 const step=n=>{for(let i=0;i<n;i++){e.applyRaceAnalogInput();e.updateRacePedalAxes(1/60);}};
 const press=()=>e.handleRacePlaytestPointerDown({playtestControl:'go'},{id:'g'});
 press();step(18);const partial=e.raceInput.throttleAxis;
 e.handlePointerUp({id:'g'});step(3);assert.equal(e.raceInput.throttleAxis,0);
 press();step(6);assert.ok(e.raceInput.throttleAxis>0 && e.raceInput.throttleAxis<1);
 step(60);assert.equal(e.raceInput.throttleAxis,1);
 e.handlePointerUp({id:'g'});step(30);assert.equal(e.playtestSession.digitalThrottle.output,0);
});


test('fresh hold gradually reaches full power in one second',()=>{
 assert.ok(Math.abs(pedal(.2).output-.2)<1e-9);
 assert.ok(Math.abs(pedal(.5).output-.5)<1e-9);
 assert.equal(pedal(1.1).output,1);
});


test('a brief lift substantially lowers a high remembered position without leaving power on',()=>{
 const s=advanceDigitalThrottle({output:.9,pedalPosition:.9,wasPressed:true},{mode:'on',raw:0,dt:.1});
 assert.equal(s.output,0);assert.ok(s.pedalPosition>.65 && s.pedalPosition<.7);
});
test('rolling wheelspin slows only added pedal travel, while holding still reaches full demand',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const low=pedal(.4,{dt,speedMps:0,spin:3,feedbackValid:true});
  const rolling=pedal(.4,{dt,speedMps:12,spin:3,feedbackValid:true});
  assert.ok(rolling.output<low.output && rolling.output>0);
  let s={output:.6,pedalPosition:.6,wasPressed:true};
  for(let i=0;i<Math.round(2/dt);i++){
   const before=s.output;
   s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps:12,spin:3,feedbackValid:true});
   assert.ok(s.output>=before,'feedback must never cut existing pedal demand');
  }
  assert.equal(s.output,1);
 }
});
test('handbrake intent allows more slip and feedback bypasses physical pedals',()=>{
 const input={mode:'on',raw:1,dt:.1,spin:.6,feedbackValid:true,speedMps:12};
 const grip=advanceDigitalThrottle({output:.4,pedalPosition:.4,filteredSpin:.6},input);
 const slide=advanceDigitalThrottle({output:.4,pedalPosition:.4,filteredSpin:.6},{...input,handbrake:true});
 assert.ok(slide.output>grip.output);
 assert.equal(advanceDigitalThrottle({}, {...input,analog:true,legacy:.8}).output,.8);
});

test('editor passes moving-wheel feedback to the pedal without changing ABS or TC',()=>{
 for(const aids of [false,true]){
  const e=new RaceEditor({});
  const patches=Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{normalLoadN:3500,validTreadContact:true,rawSlipRatio:2}]));
  e.playtestSession={vehicleDynamicsRunner:{state:{bodyLongitudinalSpeedMps:12,contactPatches:patches}},digitalThrottle:{output:.4,pedalPosition:.4,wasPressed:true}};
  Object.assign(e.raceInput,{digitalThrottleMode:'on',rawThrottleAxis:1,absEnabled:aids,tractionControlEnabled:aids});
  e.updateRacePedalAxes(.1,{tuning:{drivetrain:'awd'}});
  assert.ok(e.playtestSession.digitalThrottle.pressRate<1);
  assert.ok(e.raceInput.throttleAxis>0 && e.raceInput.throttleAxis<.4);
  assert.equal(e.raceInput.absEnabled,aids);assert.equal(e.raceInput.tractionControlEnabled,aids);
 }
});


test('short repeated corrections do not starve the pedal or ratchet it to full',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s=pedal(.6,{dt});
  for(let cycle=0;cycle<20;cycle++){
   for(let i=0;i<Math.round(.1/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt});
   assert.equal(s.output,0);
   const remembered=s.pedalPosition;
   for(let i=0;i<Math.round(.3/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt});
   assert.ok(s.output>remembered,'each press must add power without a waiting period');
   assert.ok(s.output>.45 && s.output<.65,'corrections should retain useful partial throttle');
  }
 }
});
test('reapplication starts adding travel immediately and eases into a sustained hold',()=>{
 const dt=1/120;
 let s=pedal(.6);
 for(let i=0;i<12;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt});
 let priorTravel=0;
 for(let i=0;i<60;i++){
  const before=s.pedalPosition;
  s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt});
  const travel=s.pedalPosition-before;
  assert.ok(travel>0);
  assert.ok(travel>=priorTravel-1e-9);
  assert.ok(travel<=dt+1e-9);
  priorTravel=travel;
 }
 for(let i=0;i<120;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps:12,spin:3,feedbackValid:true});
 assert.equal(s.output,1);
});


test('rolling corrections leave time at partial power without requiring rapid taps',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const input={mode:'on',dt,speedMps:12};
  let s=pedal(.75,{dt});
  for(let cycle=0;cycle<12;cycle++){
   for(let i=0;i<Math.round(.1/dt);i++)s=advanceDigitalThrottle(s,{...input,raw:0});
   assert.equal(s.output,0);
   const remembered=s.pedalPosition;
   for(let i=0;i<Math.round(.5/dt);i++)s=advanceDigitalThrottle(s,{...input,raw:1});
   assert.ok(s.output>remembered,'no dead interval on reapplication');
   assert.ok(s.output>.6 && s.output<.8,'moderate cadence should retain useful partial power');
  }
  for(let i=0;i<Math.round(2/dt);i++)s=advanceDigitalThrottle(s,{...input,raw:1,feedbackValid:true,spin:3});
  assert.equal(s.output,1,'sustained hold must still reach full throttle');
 }
});
test('rolling reapplication adds less power than a launch, with no speed-change discontinuity',()=>{
 const dt=1/120;
 function repress(speedMps){
  let s=pedal(.75);
  for(let i=0;i<12;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt,speedMps});
  for(let i=0;i<60;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps});
  return s;
 }
 const rolling=repress(12),slow=repress(0);
 assert.ok(rolling.output<slow.output-.1);
 const next=advanceDigitalThrottle(rolling,{mode:'on',raw:1,dt,speedMps:0});
 assert.equal(next.reapplyDuration,rolling.reapplyDuration);
 assert.ok(next.output>rolling.output && next.output-rolling.output<=dt);
});


test('long rolling lift resumes normal acceleration instead of slow fine correction',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s=pedal(1,{dt});
  for(let i=0;i<Math.round(1.1/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt,speedMps:15});
  const memory=s.pedalPosition;
  for(let i=0;i<Math.round(.2/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps:15});
  assert.ok(Math.abs(s.output-(memory+.2))<1e-9);
 }
});
test('nearly empty pedal memory does not impose a slow correction ramp',()=>{
 let s={output:0,pedalPosition:.03,wasPressed:false,releaseSeconds:.2};
 for(let i=0;i<24;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt:1/120,speedMps:15});
 assert.ok(s.output>.22);
});
test('long-lift response blends smoothly across release duration',()=>{
 let previousOutput;
 for(let release=.25;release<=1.15;release+=.01){
  let s={output:0,pedalPosition:.5,wasPressed:false,releaseSeconds:release};
  for(let i=0;i<24;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt:1/120,speedMps:15});
  if(previousOutput!==undefined){assert.ok(s.output>=previousOutput-1e-9);assert.ok(s.output-previousOutput<.01);}
  previousOutput=s.output;
 }
});
test('race launch resets normal pedal ramp but preserves an enabled staged launch',()=>{
 for(const dt of [1/30,1/60,1/120])for(const launchEnabled of [false,true]){
  let s=advanceDigitalThrottle({settleSeconds:1,correctionStrength:1},{mode:'on',raw:1,legacy:1,staging:true,dt});
  s=advanceDigitalThrottle(s,{mode:'on',raw:1,launchEnabled,dt});
  assert.ok(Math.abs(s.output-(launchEnabled?1:dt))<1e-9);
  s=advanceDigitalThrottle(s,{mode:'on',raw:0,launchEnabled,dt});
  assert.equal(s.output,0);
 }
});


test('high remembered throttle returns progressively without an initial power step',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s={output:0,pedalPosition:.75,wasPressed:false,releaseSeconds:.1};
  for(let i=0;i<Math.round(.1/dt);i++){
   const before=s.output;
   s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps:12});
   assert.ok(s.output>before);
   assert.ok(s.output-before<=3.5*dt+1e-9);
  }
  assert.ok(Math.abs(s.output-.35)<1e-9,'first 100ms must not restore 75% demand');
  for(let i=0;i<Math.round(.2/dt);i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps:12});
  assert.ok(s.output>.8 && s.output<.9,'recover the requested position promptly');
  assert.equal(s.output,s.pedalPosition);
 }
});
test('lifting during restoration cuts immediately and remembers only delivered demand',()=>{
 const dt=1/120;
 let s={output:0,pedalPosition:.9,wasPressed:false,releaseSeconds:.1};
 for(let i=0;i<6;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps:12});
 const delivered=s.output;
 s=advanceDigitalThrottle(s,{mode:'on',raw:0,dt,speedMps:12});
 assert.equal(s.output,0);
 assert.ok(s.pedalPosition<delivered && s.pedalPosition>0);
 const resumed=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps:12});
 assert.ok(resumed.output<=3.5*dt+1e-9);
 const braked=advanceDigitalThrottle(resumed,{mode:'on',raw:1,brake:1,dt});
 assert.equal(braked.output,0);assert.equal(braked.pedalPosition,0);
});

test('low-speed spinning reapplications leave a longer partial-throttle window',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const run=spin=>{
   let s={output:0,pedalPosition:.6,wasPressed:false,releaseSeconds:.1,filteredSpin:spin};
   const input={mode:'on',raw:1,dt,speedMps:3,spin,feedbackValid:true};
   for(let i=0;i<Math.round(.5/dt);i++)s=advanceDigitalThrottle(s,input);
   return {s,input};
  };
  const clean=run(0),spinning=run(3);
  assert.ok(spinning.s.output<clean.s.output-.08);
  assert.ok(spinning.s.output>.6,'must retain useful exit power');
  let {s,input}=spinning;
  for(let i=0;i<Math.round(2/dt);i++)s=advanceDigitalThrottle(s,input);
  assert.equal(s.output,1,'holding must override recovery softening');
  assert.equal(advanceDigitalThrottle(s,{...input,raw:0}).output,0);
 }
});
test('spinning on the limiter stops windup even during a sustained hold',()=>{
 for(const dt of [1/30,1/60,1/120]){
  const input={mode:'on',raw:1,dt,revLimiterActive:true,spin:3,feedbackValid:true};
  let s={output:.7,pedalPosition:.9,wasPressed:true,filteredSpin:3};
  for(let i=0;i<Math.round(.5/dt);i++)s=advanceDigitalThrottle(s,input);
  assert.ok(Math.abs(s.output-.7)<1e-9);
  assert.ok(Math.abs(s.pedalPosition-.7)<1e-9,'no hidden demand accumulated');
  const resumed=advanceDigitalThrottle(s,{...input,revLimiterActive:false});
  assert.equal(resumed.output,.7,'brief limiter gaps must not add pedal');
  for(let i=0;i<Math.round(2/dt);i++)s=advanceDigitalThrottle(s,input);
  assert.equal(s.output,.7);
  assert.equal(advanceDigitalThrottle(s,{...input,raw:0}).output,0);
  let recovered=s;
  for(let i=0;i<Math.round(1/dt);i++)recovered=advanceDigitalThrottle(recovered,{...input,revLimiterActive:false,spin:0});
  assert.equal(recovered.output,1);
  for(const bypass of [{analog:true},{mode:'off'},{staging:true}]){
   assert.equal(advanceDigitalThrottle(s,{...input,...bypass,legacy:.93}).output,.93);
  }
 }
});
test('editor forwards authoritative limiter feedback with either ABS/TC setting',()=>{
 for(const aids of [false,true]){
  const e=new RaceEditor({});
  e.playtestSession={vehicleDynamicsRunner:{state:{bodyLongitudinalSpeedMps:12,contactPatches:{fl:{normalLoadN:3500,rawSlipRatio:3}},powertrainState:{revLimiterActive:true}}},digitalThrottle:{output:.7,pedalPosition:.7,wasPressed:true}};
  Object.assign(e.raceInput,{digitalThrottleMode:'on',rawThrottleAxis:1,absEnabled:aids,tractionControlEnabled:aids});
  e.updateRacePedalAxes(.1,{tuning:{drivetrain:'awd'}});
  assert.ok(e.raceInput.throttleAxis>0 && e.raceInput.throttleAxis<=.7);
  assert.equal(e.playtestSession.digitalThrottle.limiterResistance,1);
  assert.equal(e.raceInput.absEnabled,aids);assert.equal(e.raceInput.tractionControlEnabled,aids);
 }
});

test('limiter alone or wheelspin alone does not block sustained throttle',()=>{
 for(const input of [{revLimiterActive:true,spin:0,feedbackValid:true},
  {revLimiterActive:false,spin:3,feedbackValid:true},
  {revLimiterActive:true,spin:3,feedbackValid:false}]){
  assert.equal(pedal(3,input).output,1);
 }
});
test('limiter pulses cannot ratchet demand, and lifting permits a useful reapplication',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s={output:.65,pedalPosition:.65,wasPressed:true,filteredSpin:3};
  const input={mode:'on',raw:1,dt,spin:3,feedbackValid:true};
  for(let i=0;i<Math.round(3/dt);i++){
   s=advanceDigitalThrottle(s,{...input,revLimiterActive:i%3===0});
   assert.equal(s.output,.65);
   assert.equal(s.pedalPosition,.65);
  }
  for(let i=0;i<Math.round(.1/dt);i++)s=advanceDigitalThrottle(s,{...input,raw:0,revLimiterActive:true});
  assert.equal(s.output,0);
  const memory=s.pedalPosition;
  for(let i=0;i<Math.round(.4/dt);i++)s=advanceDigitalThrottle(s,{...input,revLimiterActive:true});
  assert.ok(Math.abs(s.output-memory)<1e-9,'repress restores decayed demand without freezing at zero');
  let last=s.output;
  for(let i=0;i<Math.round(1/dt);i++){
   s=advanceDigitalThrottle(s,{...input,revLimiterActive:false,spin:0});
   assert.ok(s.output>=last && s.output-last<=dt+1e-9);
   last=s.output;
  }
  assert.ok(s.output>.9);
 }
});

test('live powertrain limiter reaches editor throttle assist during a low-grip launch',async()=>{
 const {loadCalibrationVehicle}=await import('../../tools/vehicle-validation/calibrate-digital-steering.mjs');
 const {installVehicleValidationInitialState}=await import('../../tools/vehicle-validation/VehicleValidationHarness.mjs');
 const {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning}=await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
 const {tuning:base}=loadCalibrationVehicle();
 const tuning={...base,torqueLbFt:643,powerHp:627};
 const config=createVehicleDynamicsConfigFromTuning(tuning,{chassisHz:120,tireHz:120,telemetryRetention:'transient'});
 const runner=new VehicleDynamicsRunner({config,initialState:{heightM:config.cgHeightM},environmentProvider:()=>({groundHeightM:0,sampleTerrainAtWorldPoint:()=>({heightM:0,normal:{x:0,y:1,z:0}}),surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},gripByWheel:{fl:.45,fr:.45,rl:.45,rr:.45}})});
 installVehicleValidationInitialState({runner,tuning,speedMps:0});
 const e=new RaceEditor({});e.playtestSession={vehicleDynamicsRunner:runner,digitalThrottle:{aggressiveHold:true,gesturePressed:true}};
 Object.assign(e.raceInput,{digitalThrottleMode:'on',rawThrottleAxis:1,absEnabled:false,tractionControlEnabled:false});
 let gated=0,limited=0,previousOutput=0;
 for(let i=0;i<360;i++){
  if(runner.state.powertrainState.revLimiterActive)limited++;
  e.updateRacePedalAxes(1/120,{tuning});
  const p=e.playtestSession.digitalThrottle;
  if(p.limiterResistance===1){
   gated++;assert.ok(p.output<=previousOutput+1e-9,'live limiter must prevent further buildup');
  }
  previousOutput=p.output;
  runner.addInputSample(runner.simulationTimeSeconds,{requestedGear:runner.state.gear,throttle:p.output,brake:0,assists:{autoShift:true,absEnabled:false,tractionControlEnabled:false}});
  runner.advance(1/120);
 }
 assert.ok(limited>20,'production powertrain must actually encounter its limiter');
 assert.ok(gated>20,'the editor must consume actual limiter telemetry');
 assert.ok(runner.state.groundSpeedMps>4,'assistance must not stall the launch');
 e.raceInput.rawThrottleAxis=0;e.updateRacePedalAxes(1/120,{tuning});
 assert.equal(e.raceInput.throttleAxis,0);
});

test('sustained low-speed spin slows pedal travel before redline, without cutting delivered power',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let s={output:.4,pedalPosition:.4,wasPressed:true,filteredSpin:3};
  const input={mode:'on',raw:1,dt,speedMps:2,spin:3,feedbackValid:true,revLimiterActive:false};
  for(let i=0;i<Math.round(.4/dt);i++){
   const before=s.output;s=advanceDigitalThrottle(s,input);
   assert.ok(s.output>=before);
  }
  assert.ok(s.output>.5 && s.output<.64,'leave room to hold useful partial throttle');
  assert.equal(s.limiterResistance,0,'buildup must slow before the rev limiter');
  assert.ok(s.pressRate<.4);
  s=advanceDigitalThrottle(s,{...input,raw:0});assert.equal(s.output,0);
  for(let i=0;i<Math.round(4/dt);i++)s=advanceDigitalThrottle(s,input);
  assert.equal(s.output,1,'still permit deliberate wheelspin');
 }
});
test('good grip and modest slip preserve the existing travel rate, including long holds',()=>{
 for(const speedMps of [0,3,15])for(const spin of [0,.2,.4]){
  let s={};const dt=1/120;
  for(let i=0;i<240;i++){
   s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt,speedMps,spin,feedbackValid:true});
   const blend=Math.max(0,Math.min(1,(Math.abs(speedMps)-2)/8));
   const severity=Math.max(0,Math.min(1,(s.filteredSpin-s.slipAllowance)/.75));
   const insistence=Math.max(0,Math.min(1,(s.holdSeconds-1)/.5));
   assert.ok(Math.abs(s.pressRate-(1-.5*blend*severity*(1-insistence)))<1e-9);
  }
 }
});
test('spin feedback releases promptly after grip recovers and cannot hold analog demand',()=>{
 let s={output:.4,pedalPosition:.4,wasPressed:true,filteredSpin:3,spinTravelResistance:.65};
 for(let i=0;i<60;i++)s=advanceDigitalThrottle(s,{mode:'on',raw:1,dt:1/120,speedMps:2,spin:0,feedbackValid:true});
 assert.ok(s.pressRate>.95);
 assert.equal(advanceDigitalThrottle(s,{mode:'on',raw:0,dt:1/120}).output,0);
 for(const bypass of [{analog:true},{mode:'off'},{staging:true}]){
  assert.equal(advanceDigitalThrottle(s,{mode:'on',raw:1,legacy:.8,spin:3,feedbackValid:true,...bypass}).output,.8);
 }
});
