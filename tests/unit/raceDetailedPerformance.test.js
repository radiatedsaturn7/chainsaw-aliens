import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RacePerformanceCapture} from '../../src/racing/RacePerformanceCapture.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
function fixture(options={}){
 let now=0;const runner={advance(){this.runStep();},runStep(){now+=2;this.integrateChassis();now+=1;},integrateChassis(){now+=4;return 42;}};
 const editor={playtestSession:{running:true,vehicleDynamicsRunner:runner,aiRuntime:[]},update(){runner.advance();},draw(){now+=1;}};
 const capture=new RacePerformanceCapture(editor,{now:()=>now,detailed:true,observe:false,...options});
 return {editor,runner,capture};
}
test('detailed capture records real nested starts, durations, self times, and frame identity',()=>{
 const {editor,capture,runner}=fixture();const original=runner.runStep;editor.update();editor.draw();capture.stop();
 const trace=capture.report().trace;const named=name=>trace.spans.find(s=>trace.names[s[0]]===name);
 assert.deepEqual(named('player.runStep').slice(1),[0,7,3,0,2]);
 assert.deepEqual(named('player.integrateChassis').slice(1),[2,4,4,0,3]);
 assert.equal(runner.runStep,original);assert.equal(capture.stack.length,0);
});
test('span limit preserves open parent durations, bounds memory, uploads once',()=>{
 let stops=0;const {editor,capture}=fixture({maxSpans:2,onStop:()=>stops++});
 editor.update();editor.draw();assert.equal(capture.active,false);assert.equal(capture.reason,'span-limit');assert.equal(stops,1);
 assert.equal(capture.spans.length,2);assert.ok(capture.droppedSpans>0);assert.equal(capture.spans[0][2],7);
 editor.update();editor.draw();assert.equal(capture.spans.length,2);
});
test('standard mode adds no detailed wrappers or spans',()=>{
 const {editor,runner,capture}=fixture({detailed:false});const original=runner.runStep;editor.update();editor.draw();
 assert.equal(runner.runStep,original);assert.equal(capture.report().trace,null);capture.stop();
});
test('detailed wrapper preserves thrown error and unwinds nested calls',()=>{
 const {editor,runner,capture}=fixture();runner.integrateChassis=()=>{throw new Error('original failure');};
 assert.throws(()=>editor.update(),/original failure/);assert.equal(capture.stack.length,0);capture.stop();
 assert.ok(capture.spans.every(s=>s[2]>=0));
});
test('phone debug action resumes race in short detailed mode',()=>{
 const editor=new RaceEditor({});editor.playtestSession={running:true,aiRuntime:[]};editor.raceInput.paused=true;editor.raceInput.pauseMenuMode='debug-performance';
 editor.toggleRacePause=()=>{editor.raceInput.paused=false;};editor.uploadRacePerformanceCapture=()=>{};
 editor.getRacePauseMenuRows().find(r=>r.id==='race-perf-start').onClick();
 assert.equal(editor.racePerformanceCapture.detailed,true);assert.equal(editor.racePerformanceCapture.durationMs,60000);assert.equal(editor.raceInput.paused,false);editor.stopRacePerformanceCapture();
});

test('minute capture continues past 15 seconds and stops/uploads at 60 seconds',()=>{
 let now=0,stops=0;const editor={playtestSession:{running:true},update(){},draw(){}};
 const capture=new RacePerformanceCapture(editor,{detailed:true,durationMs:60000,maxSpans:400000,now:()=>now,observe:false,onStop:()=>stops++});
 for(now=0;now<60000;now+=1000){editor.update();editor.draw();}
 assert.equal(capture.active,true);assert.equal(capture.frames.length,60);
 editor.update();editor.draw();assert.equal(capture.active,false);assert.equal(capture.reason,'duration');assert.equal(stops,1);
});

test('short recording menu defaults to detailed and switches mode with tap or direction',()=>{
 const editor=new RaceEditor({});editor.playtestSession={running:true};editor.raceInput.pauseMenuMode='debug-performance';editor.uploadRacePerformanceCapture=()=>{};
 let rows=editor.getRacePauseMenuRows();assert.equal(rows.find(r=>r.id==='race-perf-mode').value,'Detailed');
 assert.deepEqual(rows.map(r=>r.label),['Mode','Record','Stop','Upload','Export','Back']);
 rows.find(r=>r.id==='race-perf-mode').onClick();rows=editor.getRacePauseMenuRows();assert.equal(rows[0].value,'Standard');assert.equal(rows[1].value,'120s');
 rows[1].onClick();assert.equal(editor.racePerformanceCapture.detailed,false);editor.stopRacePerformanceCapture();
 editor.getRacePauseMenuRows()[0].onAdjust(1);assert.equal(editor.getRacePauseMenuRows()[0].value,'Detailed');
});

test('high-frequency aggregate scopes retain timings without filling span buffer',()=>{
 let now=0;const editor={playtestSession:{running:true},update(){},draw(){}};
 const capture=new RacePerformanceCapture(editor,{detailed:true,observe:false,now:()=>now});
 const cells={step(){now++;}};capture.wrap(cells,'step','cellWork',{trace:false});
 editor.update();for(let i=0;i<100;i++)cells.step();editor.draw();capture.stop();
 assert.equal(capture.frames[0].phases.cellWork.selfMs,100);assert.equal(capture.frames[0].phases.cellWork.calls,100);
 assert.equal(capture.spanNames.includes('cellWork'),false);
});

test('spaced traces retain every frame summary and declare their sampling stride',()=>{
 const {editor,capture}=fixture({traceFrameStride:2});for(let i=0;i<4;i++){editor.update();editor.draw();}capture.stop();
 assert.equal(capture.frames.length,4);assert.equal(capture.report().trace.frameStride,2);
 assert.ok(capture.spans.every(span=>span[4]%2===0));assert.ok(capture.frames[1].phases['player.runStep'].calls>0);
});

test('detailed frames retain collision drill-down from the current frame without pooled aliases',()=>{
 const {editor,runner,capture}=fixture();
 const frame={metadata:{sequence:7},counters:{bodySweepSlices:128},timings:{bodyContinuousSweep:{inclusiveMs:20,exclusiveMs:4,calls:1}}};
 runner.physicsCostAccounting={getLatestFrame:()=>frame};
 editor.update();editor.draw();capture.stop();
 frame.counters.bodySweepSlices=0;frame.timings.bodyContinuousSweep.exclusiveMs=0;
 const detail=capture.frames[0].physicsDetail;
 assert.equal(detail.sequence,7);assert.equal(detail.counters.bodySweepSlices,128);
 assert.equal(detail.timings.bodyContinuousSweep.exclusiveMs,4);
});

test('detailed capture keeps cost counters requested and does not repeat stale physics frames',()=>{
 const {editor,runner,capture}=fixture();
 const frame={metadata:{sequence:90},counters:{bodySweepSlices:12},timings:{}};
 const accounting=runner.physicsCostAccounting={enabled:true,getLatestFrame:()=>frame};
 editor.update();editor.draw();
 assert.equal(accounting.detailedCaptureActive,true);
 editor.update();editor.draw();
 assert.equal(capture.frames[1].physicsDetail,undefined,'no stale counters on frames without a physics update');
 frame.metadata.sequence++;editor.update();editor.draw();
 assert.equal(capture.frames[2].physicsDetail.sequence,91);
 capture.stop();assert.equal(Object.hasOwn(accounting,'detailedCaptureActive'),false);
});

test('AI tier totals include per-car work without double-counting self time and follow promotions',()=>{
 let now=0;const e={playtestSession:{running:true,aiRuntime:[]}};
 const c=new RacePerformanceCapture(e,{now:()=>now,observe:false,detailed:true});
 c.begin();const ai={physicsBudgetDetail:'cheap'};
 assert.equal(c.timeAiDriver(ai,2,()=>{now+=3;return 42;}),42);
 ai.physicsBudgetDetail='full';c.timeAiDriver(ai,2,()=>{now+=5;});
 assert.equal(c.current.phases['AI.lightweightCars'].inclusiveMs,3);
 assert.equal(c.current.phases['AI.detailedCars'].inclusiveMs,5);
 assert.equal(c.current.phases['AIcar[2].lightweight'].selfMs,3);
 assert.equal(c.current.phases['AIcar[2].detailed'].selfMs,5);
 assert.equal(c.current.phases['AI.detailedCars'].selfMs,0);
 assert.equal(c.spanNames.some(name=>name.startsWith('AIcar[')),false,'per-car aggregates do not flood traces');
 c.stop();assert.equal(c.timeAiDriver(ai,2,()=>7),7);
});

test('detailed capture times scenery, audio, tire effects and route work and restores them',()=>{
 let now=0;const methods=['updateRaceSceneryCollisions','updateRaceWearAndDamage','stepRaceTireFxParticles','updateRaceEngineAudio','updateRaceTireAudio','getRaceRouteProjectionForWorldPoint'];
 const e={playtestSession:{running:true,aiRuntime:[]}};
 const originals=methods.map(key=>e[key]=()=>{now++;return key;});
 const c=new RacePerformanceCapture(e,{now:()=>now,observe:false,detailed:true});c.begin();
 for(const key of methods){assert.equal(e[key](),key);assert.equal(c.current.phases[`editor.${key}`].inclusiveMs,1);}
 c.stop();methods.forEach((key,i)=>assert.equal(e[key],originals[i]));
});

test('compact capture keeps every physics aggregate while avoiding substep trace arrays',()=>{
 const {editor,capture}=fixture({compactTrace:true});
 for(let i=0;i<100;i++){editor.update();editor.draw();}
 capture.stop();const report=capture.report();
 assert.equal(report.phases['player.runStep'].calls,100);
 assert.equal(report.phases['player.integrateChassis'].calls,100);
 assert.equal(report.trace.names.includes('player.runStep'),false);
 assert.equal(report.frames[99].phases['player.runStep'].inclusiveMs,7);
 assert.ok(capture.timingEntries.length<=4,'timing entries scale with nesting depth, not calls');
});

test('reused timing entries preserve receivers, arguments, nesting and thrown errors',()=>{
 let now=0;const object={value:3,inner(x){now+=2;return this.value+x;},outer(x){now++;const y=this.inner(x);now++;return y;},bad(){now++;throw Error('expected');}};
 const c=new RacePerformanceCapture({playtestSession:{running:true}},{now:()=>now,observe:false});
 for(const key of ['inner','outer','bad'])c.wrap(object,key,key);c.begin();
 for(let i=0;i<100;i++){assert.equal(object.outer(i),3+i);assert.throws(()=>object.bad(),/expected/);}
 assert.equal(c.current.phases.outer.inclusiveMs,400);assert.equal(c.current.phases.outer.selfMs,200);
 assert.equal(c.current.phases.inner.selfMs,200);assert.equal(c.current.phases.bad.calls,100);
 assert.equal(c.stack.length,0);assert.equal(c.timingEntries.length,2);c.stop();
});

test('AI contact detail is fresh, copied, and restores accounting on stop',()=>{
 const {editor,capture}=fixture();
 const frame={metadata:{sequence:3},counters:{completedSteps:2},timings:{tireContactSetup:{inclusiveMs:87,exclusiveMs:80,calls:2}}};
 const accounting={enabled:false,stepHistoryMode:'records',detailedStepRecords:true,getLatestFrame:()=>frame};
 editor.playtestSession.aiRuntime=[{id:'ai-28',vehicleDynamicsRunner:{physicsCostAccounting:accounting}}];
 editor.update();editor.draw();
 assert.equal(accounting.enabled,true);assert.equal(accounting.detailedStepRecords,false);
 const detail=capture.frames[0].aiPhysicsDetail[0];
 assert.equal(detail.id,'ai-28');assert.equal(detail.timings.tireContactSetup.inclusiveMs,87);
 frame.timings.tireContactSetup.inclusiveMs=0;
 editor.update();editor.draw();
 assert.equal(capture.frames[1].aiPhysicsDetail,undefined);
 assert.equal(detail.timings.tireContactSetup.inclusiveMs,87);
 capture.stop();assert.equal(accounting.enabled,false);
 assert.equal(accounting.detailedStepRecords,true);assert.equal(accounting.stepHistoryMode,'records');
 assert.equal(Object.hasOwn(accounting,'detailedCaptureActive'),false);
});

test('only AI diagnostic history uses latest-frame retention and stop restores it',()=>{
 const {editor,runner,capture}=fixture();
 runner.physicsCostAccounting={enabled:false,getLatestFrame:()=>null};
 const accounting={enabled:false,getLatestFrame:()=>null};
 editor.playtestSession.aiRuntime=[{vehicleDynamicsRunner:{physicsCostAccounting:accounting}}];
 editor.update();editor.draw();
 assert.equal(accounting.latestFrameOnly,true);
 assert.equal(runner.physicsCostAccounting.latestFrameOnly,undefined);
 capture.stop();assert.equal(Object.hasOwn(accounting,'latestFrameOnly'),false);
});

test('detailed capture separates GL uploads from submission and restores host methods',()=>{
 let now=0;
 const gl={texSubImage2D(value){assert.equal(this,gl);now+=12;return value;},bufferData(){now+=3;}};
 const original=gl.texSubImage2D;
 const renderer={getContext:()=>gl,render(){assert.equal(gl.texSubImage2D(42),42);gl.bufferData();now+=2;}};
 const editor={playtestSession:{running:true},raceThreeWorldRenderer:{threeRenderer:renderer},update(){},draw(){renderer.render();}};
 const capture=new RacePerformanceCapture(editor,{now:()=>now,detailed:true,observe:false});
 editor.update();editor.draw();capture.stop();
 const phases=capture.frames[0].phases;
 assert.equal(phases['webgl.texSubImage2D'].selfMs,12);
 assert.equal(phases['webgl.bufferData'].selfMs,3);
 assert.equal(phases.webglSubmit.inclusiveMs,17);
 assert.equal(phases.webglSubmit.selfMs,2);
 assert.equal(gl.texSubImage2D,original);
 assert.ok(capture.frames[0].slowCalls.some(c=>c.name==='webgl.texSubImage2D'));
});

test('car paint diagnostics separate clearing, artwork and layers on every recorded frame',()=>{
 let now=0;
 const layers=()=>{now+=3;};
 const sprites={stats:{repaintReasons:{camera:1}},clearScratch(){now+=2;},
  paintArtwork(){editor.drawRaceProjectedCarSprite();},
  paintScratch(){this.clearScratch();this.paintArtwork();}};
 const editor={playtestSession:{running:true},raceThreeWorldRenderer:{carDepthSprites:sprites},
  drawRaceCarBillboardLayers:layers,drawRaceProjectedCarSprite(){this.drawRaceCarBillboardLayers();},
  update(){},draw(){sprites.paintScratch();}};
 const original=sprites.clearScratch;
 const c=new RacePerformanceCapture(editor,{detailed:true,observe:false,now:()=>now,traceFrameStride:4});
 for(let i=0;i<2;i++){editor.update();editor.draw();}
 c.stop();
 for(const f of c.frames){
  assert.equal(f.phases['carSprites.clearScratch'].inclusiveMs,2);
  assert.equal(f.phases['carSprites.paintArtwork'].inclusiveMs,3);
  assert.equal(f.phases['editor.drawRaceCarBillboardLayers'].selfMs,3);
  assert.equal(f.phases['carSprites.paintScratch'].selfMs,0);
  assert.equal(f.work.carPaintReasons.camera,1);
 }
 sprites.stats.repaintReasons.camera=0;
 assert.equal(c.frames[0].work.carPaintReasons.camera,1);
 assert.equal(sprites.clearScratch,original);
});


test('general wheel lookup attributes surface and track state work separately from physics',()=>{
 let now=0;
 const trackState={sample(){now+=3;return {grip:1};}};
 const model={sampleBakedSurface(){now+=2;return {height:0};},sampleWorld(){now++;return this.sampleBakedSurface();}};
 const surface={getWheelContactState(){model.sampleWorld();return trackState.sample();}};
 const original=model.sampleWorld;
 const editor={raceSurfaceModel:model,raceSimulationSystems:{surface},
  playtestSession:{running:true,trackState,aiRuntime:[]},
  getRaceWheelContactState(){return surface.getWheelContactState();},
  update(){assert.deepEqual(this.getRaceWheelContactState(),{grip:1});},draw(){}};
 const capture=new RacePerformanceCapture(editor,{now:()=>now,detailed:true,observe:false});
 editor.update();editor.draw();capture.stop();
 const phases=capture.frames[0].phases;
 assert.equal(phases['editor.getRaceWheelContactState'].inclusiveMs,6);
 assert.equal(phases['surfaceLookup.getWheelContactState'].inclusiveMs,6);
 assert.equal(phases['surfaceLookup.sampleWorld'].inclusiveMs,3);
 assert.equal(phases['surfaceLookup.sampleWorld'].selfMs,1);
 assert.equal(phases['surfaceLookup.sampleBakedSurface'].inclusiveMs,2);
 assert.equal(phases['trackState.sample'].inclusiveMs,3);
 assert.equal(model.sampleWorld,original);
});
