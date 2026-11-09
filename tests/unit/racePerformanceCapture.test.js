import test from 'node:test';
import assert from 'node:assert/strict';
import {RacePerformanceCapture} from '../../src/racing/RacePerformanceCapture.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {PhysicsCostAccounting} from '../../src/racing/simulation/PhysicsCostAccounting.js';
function fixture(options={}){
 let t=0;const advance=ms=>t+=ms;
 const e={selectedRace:{name:'P1',weather:'storm',weatherIntensity:1},raceInput:{},playtestSession:{running:true,elapsedMs:0,aiRuntime:[]},
 update(){advance(1);this.updateRaceAiDrivers();advance(1);},updateRaceAiDrivers(){advance(4);},
 draw(){advance(3);},lastRaceRenderStats:{threeCarDepthSpriteCount:12,threeCarSpriteUploadedPixels:2400}};
 const original={update:e.update,draw:e.draw,ai:e.updateRaceAiDrivers};
 const c=new RacePerformanceCapture(e,{now:()=>t,observe:false,...options});return {e,c,advance,original};
}
test('capture separates inclusive/self CPU scopes and attributes frame intervals to preceding work',()=>{
 const {e,c,advance}=fixture();e.update();e.draw();advance(11);e.update();e.draw();
 const r=c.report(),f=r.frames[0];assert.equal(f.intervalMs,20);assert.equal(f.phases.update.inclusiveMs,6);assert.equal(f.phases.update.selfMs,2);assert.equal(f.phases.AI.selfMs,4);assert.equal(f.instrumentedCpuMs,9);assert.equal(f.context.submittedCarSprites,12);assert.equal(f.work.uploadedPixels,2400);assert.equal(r.phases.AI.calls,2);c.stop();
});
test('pause gaps are excluded, capture bounded, and all hooks restored',()=>{
 const {e,c,advance,original}=fixture({maxFrames:2});e.update();e.draw();e.raceInput.paused=true;advance(1000);e.update();e.draw();e.raceInput.paused=false;e.update();e.draw();
 assert.equal(c.frames.length,2);assert.equal(c.frames[0].intervalMs,null);assert.equal(c.active,false);assert.equal(c.reason,'frame-limit');assert.equal(e.update,original.update);assert.equal(e.draw,original.draw);assert.equal(e.updateRaceAiDrivers,original.ai);
});
test('wall duration automatically stops on next update and does not instrument future work',()=>{
 const {e,c,advance}=fixture({durationMs:20});e.update();e.draw();advance(30);e.update();e.draw();assert.equal(c.frames.length,1);assert.equal(c.reason,'duration');
});
test('exceptions retain original behavior and unwind timing stack',()=>{
 const {e,c}=fixture();e.updateRaceAiDrivers=()=>{throw Error('physics fault');};assert.throws(()=>e.update(),/physics fault/);assert.equal(c.stack.length,0);c.stop();assert.throws(()=>e.update(),/physics fault/);
});
function fakeGPU(){let available=false,disjoint=false,deleted=0,resultReads=0,active=null;let id=0;
 const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,CURRENT_QUERY:3,getExtension:()=>({TIME_ELAPSED_EXT:4,GPU_DISJOINT_EXT:5}),getParameter:()=>disjoint,getQuery:()=>active,createQuery:()=>++id,beginQuery:(target,q)=>{active=q;},endQuery:()=>{active=null;},getQueryParameter:(q,p)=>{if(p===1)return available;resultReads++;return 2000000;},deleteQuery:()=>{deleted++;}};
 return {gl,set available(v){available=v;},set disjoint(v){disjoint=v;},get deleted(){return deleted;},get resultReads(){return resultReads;}};
}
test('GPU queries are asynchronous, bounded, and clean up on stop',()=>{
 const {e,c}=fixture();const gpu=fakeGPU();const renderer={getContext:()=>gpu.gl,render(){}};e.raceThreeWorldRenderer={threeRenderer:renderer};
 for(let i=0;i<12;i++){e.update();renderer.render();e.draw();}
 assert.equal(c.gpuPending.length,8);assert.equal(gpu.resultReads,0,'never read a result before it is available');
 gpu.available=true;c.pollGPU();assert.equal(c.frames[0].gpuMs,2);assert.equal(c.frames[0].gpuSamples,1);assert.equal(gpu.deleted,8);c.stop();
});
test('GPU disjoint readings are discarded, unsupported browsers still record CPU',()=>{
 const {e,c}=fixture();const gpu=fakeGPU();e.raceThreeWorldRenderer={threeRenderer:{getContext:()=>gpu.gl,render(){}}};e.update();e.raceThreeWorldRenderer.threeRenderer.render();e.draw();gpu.disjoint=true;c.pollGPU();assert.equal(c.frames[0].gpuMs,null);assert.equal(c.frames[0].gpuInvalid,true);assert.equal(gpu.deleted,1);c.stop();
 const f=fixture();f.e.raceThreeWorldRenderer={threeRenderer:{getContext:()=>({}),render(){}}};f.e.update();f.e.raceThreeWorldRenderer.threeRenderer.render();f.e.draw();assert.equal(f.c.report().gpuStatus,'unavailable');assert.equal(f.c.frames[0].gpuMs,null);f.c.stop();
});
test('debug menu uses existing rows to start, stop and export capture',async()=>{
 const e=new RaceEditor({});e.playtestSession={running:true,aiRuntime:[]};e.raceInput.paused=true;e.raceInput.pauseMenuMode='debug-performance';let resumed=false;e.toggleRacePause=()=>{resumed=true;e.raceInput.paused=false;};
 e.uploadRacePerformanceCapture=async()=>{};
 const rows=e.getRacePauseMenuRows();assert.ok(rows.find(r=>r.id==='race-perf-export').disabled);rows.find(r=>r.id==='race-perf-start').onClick();assert.equal(resumed,true);assert.equal(e.racePerformanceCapture.active,true);e.raceInput.paused=true;e.stopRacePerformanceCapture();assert.equal((await e.exportRacePerformanceCapture()).version,1);
});

test('GPU driver/query errors do not interrupt gameplay or capture cleanup',()=>{
 const {e,c}=fixture();const gpu=fakeGPU();e.raceThreeWorldRenderer={threeRenderer:{getContext:()=>gpu.gl,render(){}}};e.update();e.raceThreeWorldRenderer.threeRenderer.render();e.draw();gpu.gl.getQueryParameter=()=>{throw Error('lost GPU');};assert.doesNotThrow(()=>c.report());assert.equal(c.gpuStatus,'query-error');assert.equal(c.frames[0].gpuMs,null);c.stop();
});
test('capture cleanup restores prototype methods without leaving instance overrides',()=>{
 const base={update(){},draw(){}};const e=Object.assign(Object.create(base),{playtestSession:{running:true},raceInput:{},selectedRace:{}});
 const c=new RacePerformanceCapture(e,{observe:false});e.update();e.draw();assert.ok(Object.hasOwn(e,'update'));c.stop();assert.ok(!Object.hasOwn(e,'update'));assert.ok(!Object.hasOwn(e,'draw'));
});

test('recording retains frame-budget debt and deferred work as frame-local values', () => {
 const {e,c}=fixture();
 e.playtestSession.frameBudget={stats:{frames:1,pending:3,deferred:2,overruns:1}};
 e.playtestSession.frameSimulationClock={debtSeconds:.02,discardedSeconds:.4};
 e.playtestSession.frameAdmittedSeconds=1/30;
 e.update();e.draw();
 e.playtestSession.frameBudget.stats.pending=0;
 const budget=c.frames[0].context.frameBudget;
 assert.equal(budget.pending,3);assert.equal(budget.debtSeconds,.02);
 assert.equal(budget.discardedSeconds,.4);c.stop();
});

test('recording snapshots ahead-weather preparation work for each frame',()=>{
 const {e,c}=fixture();
 e.playtestSession.trackState={performanceCounters:{aheadWeatherPreparationSteps:32,aheadWeatherPreparationSlices:1}};
 e.update();e.draw();
 e.playtestSession.trackState.performanceCounters.aheadWeatherPreparationSteps=64;
 assert.equal(c.frames[0].work.aheadWeatherPreparationSteps,32);
 assert.equal(c.frames[0].work.aheadWeatherPreparationSlices,1);
 c.stop();
});

test('recorder setup and finalization are measured separately from game CPU and included before stop',()=>{
 const {e,c,advance}=fixture({maxFrames:1});
 const attach=c.attachHooks.bind(c);
 c.attachHooks=()=>{advance(2);return attach();};
 c.memoryCapture.sample=()=>advance(3);
 let stopped;
 c.onStop=()=>{stopped=c.report().frames[0];};
 e.update();e.draw();
 assert.equal(c.active,false);
 assert.equal(stopped.recorderSetupMs,4,'update and draw each check hooks');
 assert.equal(stopped.recorderFinalizeMs,3);
 assert.equal(stopped.instrumentedCpuMs,9,'bookkeeping does not inflate game phases');
 assert.equal(stopped.phases.update.inclusiveMs,6);
 assert.equal(stopped.phases.draw.inclusiveMs,3);
 const serialized=JSON.parse(JSON.stringify(c.report()));
 assert.equal(serialized.frames[0].recorderFinalizeMs,3);
});

test('detailed exports retain wheel-cylinder and static-collider timings for player and AI',()=>{
 const {e,c}=fixture({detailed:true});
 const names=['wheelCylinderActivation','wheelCylinderTriangleSweep','wheelCylinderHeightSweep','staticColliderBroadphase','staticColliderContinuousSweep','staticColliderManifoldSolve'];
 const timings=Object.fromEntries(names.map(name=>[name,{inclusiveMs:2,exclusiveMs:1,calls:3}]));
 const makeRunner=()=>({physicsCostAccounting:{enabled:true,getLatestFrame:()=>({metadata:{sequence:1},counters:{},timings})}});
 e.playtestSession.vehicleDynamicsRunner=makeRunner();
 e.playtestSession.aiRuntime=[{id:'ai-test',vehicleDynamicsRunner:makeRunner()}];
 try {
  e.update();e.draw();
  const frame=c.report().frames[0];
  for(const name of names){
   assert.deepEqual(frame.physicsDetail.timings[name],{inclusiveMs:2,exclusiveMs:1,calls:3});
   assert.deepEqual(frame.aiPhysicsDetail[0].timings[name],{inclusiveMs:2,exclusiveMs:1,calls:3});
  }
  timings.wheelCylinderActivation.inclusiveMs=999;
  assert.equal(frame.physicsDetail.timings.wheelCylinderActivation.inclusiveMs,2);
 } finally {c.stop();}
});

test('event queue probe is detailed-only, restored at stop and retained in export',()=>{
 const normal=fixture();normal.e.playtestSession.trackState={};normal.e.update();normal.e.draw();
 assert.equal(normal.e.playtestSession.trackState.eventQueueProbe,undefined);normal.c.stop();
 const {e,c}=fixture({detailed:true});const previous={custom:true};const track=e.playtestSession.trackState={eventQueueProbe:previous};
 e.update();e.draw();assert.notEqual(track.eventQueueProbe,previous);
 c.stop();assert.equal(track.eventQueueProbe,previous);assert.equal(c.report().eventQueue.length,1);
});


test('repeated wrap requests skip factories while newly created targets remain instrumented',()=>{
 const {e,c,advance}=fixture();
 const target={work(value){advance(2);return value+1;}};
 const original=target.work;
 let attempts=0;const hook=c.hook.bind(c);
 c.hook=(...args)=>{attempts++;return hook(...args);};
 c.wrap(target,'work','probe');
 for(let i=0;i<100;i++)c.wrap(target,'work','probe');
 c.wrap(null,'work','probe');c.wrap({},'work','probe');
 assert.equal(attempts,1);
 const replacement={work:original};c.wrap(replacement,'work','probe');
 assert.equal(attempts,2);
 e.update();assert.equal(target.work(4),5);assert.equal(replacement.work(8),9);e.draw();
 assert.equal(c.frames[0].phases.probe.calls,2);
 assert.equal(c.frames[0].phases.probe.selfMs,4);
 c.stop();assert.equal(target.work,original);assert.equal(replacement.work,original);
});

test('capture stops on session replacement without reattaching to the new race',()=>{
 const {e,c,original}=fixture();
 e.playtestSession.vehicleDynamicsWorkerMetrics={owner:'original'};
 e.update();e.draw();
 e.playtestSession={running:true,aiRuntime:[],vehicleDynamicsWorkerMetrics:{owner:'replacement'}};
 e.update();e.draw();
 assert.equal(c.active,false);assert.equal(c.reason,'session-changed');assert.equal(c.frames.length,1);
 assert.equal(e.update,original.update);assert.equal(e.draw,original.draw);assert.equal(c.restores.length,0);
 assert.equal(c.session,null);assert.deepEqual(c.report().latestWorkerSummary,{owner:'original'});
 assert.equal(c.report(),c.report(),'a completed summary is cached');
});

test('race clock reports raw, admitted, excluded and cumulative time without reading later mutable values',()=>{
 const {e,c}=fixture();
 Object.assign(e.playtestSession,{frameRawSeconds:.095,frameObservedRawSeconds:.095,frameAdmittedSeconds:1/30,
  frameExcludedSeconds:0,frameClockMode:'bounded',
  frameSimulationClock:{rawSeconds:.095,admittedSeconds:1/30,debtSeconds:.095-1/30,discardedSeconds:0,excludedSeconds:0}});
 e.update();e.draw();
 e.playtestSession.frameSimulationClock.rawSeconds=100;
 const clock=c.frames[0].context.raceClock;
 assert.equal(clock.rawSeconds,.095);assert.equal(clock.totalRawSeconds,.095);
 assert.ok(Math.abs(clock.totalRawSeconds-clock.totalAdmittedSeconds-clock.debtSeconds-clock.discardedSeconds)<1e-10);
 c.stop();
});

test('stopped summaries remain detached when the physics frame pool wraps before deferred export',()=>{
 const {e,c}=fixture();let now=0;
 const accounting=new PhysicsCostAccounting({now:()=>now,frameHistoryLimit:30});
 const step=sequence=>{
  accounting.beginFrame();accounting.count('completedSteps',sequence);
  const token=accounting.start('bodyBroadphase');now+=sequence;accounting.end(token);accounting.finishFrame();
 };
 step(1);step(2);
 const summary=e.playtestSession.physicsPerformance=accounting.getSummary({force:true});
 e.playtestSession.vehicleDynamicsWorkerMetrics={worker:{samples:2,p95:4},backlog:{current:0,peak:1}};
 const expected=structuredClone(summary);
 c.stop();
 for(let i=3;i<=40;i++)step(i);
 assert.notEqual(summary.latestFrame.metadata.sequence,2,'the source frame really was reused');
 e.playtestSession.vehicleDynamicsWorkerMetrics.worker.p95=999;
 assert.deepEqual(c.report().latestPhysicsSummary,expected);
 assert.equal(c.report().latestWorkerSummary.worker.p95,4);
});

test('detailed handling samples retain inputs and wheel evidence without live references',()=>{
 const {e,c,advance}=fixture({detailed:true});
 e.raceInput.brakeAxis=1;
 e.playtestSession.vehicleDynamicsRunner={config:{massKg:1495,tuning:{brakeBalance:.7}},state:{groundSpeedMps:44.7,wheelLoadsN:{rl:300},contactPatches:{rl:{rawSlipRatio:-.8,absModulation:.2}},powertrainState:{stabilityClassification:'oversteer'}}};
 e.update();e.draw();
 e.raceInput.brakeAxis=0;e.playtestSession.vehicleDynamicsRunner.state.contactPatches.rl.rawSlipRatio=0;
 e.update();e.draw();advance(110);e.update();e.draw();
 assert.equal(c.frames[0].handling.inputs.brakeAxis,1);
 assert.equal(c.frames[0].handling.state.wheels.rl.rawSlipRatio,-.8);
 assert.equal(c.frames[0].handling.state.wheels.rl.loadN,300);
 assert.equal(c.frames[1].handling,undefined);
 assert.equal(c.frames[2].handling.inputs.brakeAxis,0);
 assert.equal(c.metadata.handlingSetup.tuning.brakeBalance,.7);
 c.stop();assert.doesNotThrow(()=>JSON.stringify(c.report()));
});
test('standard capture omits handling payload and missing physics stays explicit',()=>{
 const standard=fixture({detailed:false});standard.e.update();standard.e.draw();
 assert.equal(standard.c.frames[0].handling,undefined);standard.c.stop();
 const detailed=fixture({detailed:true});detailed.e.update();detailed.e.draw();
 assert.equal(detailed.c.frames[0].handling.source,'unavailable');
 assert.equal(detailed.c.frames[0].handling.state,null);detailed.c.stop();
});
test('worker recordings use delivered state rather than stale local runner',()=>{
 const {e,c}=fixture({detailed:true});e.vehicleDynamicsAuthority={workerBridge:{}};
 e.playtestSession.vehicleDynamicsRunner={state:{groundSpeedMps:0}};
 e.playtestSession.vehicleDynamicsPresentationState={groundSpeedMps:40,wheelLoadsN:{fl:4000},contactPatches:{fl:{steeringAngleRad:.04}}};
 e.update();e.draw();const sample=c.frames[0].handling;
 assert.equal(sample.source,'worker-presentation');assert.equal(sample.state.groundSpeedMps,40);
 assert.equal(sample.state.wheels.fl.loadN,4000);assert.equal(sample.state.wheels.fl.rawSlipRatio,null);
 c.stop();
});
