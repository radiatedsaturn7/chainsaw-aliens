import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadRacePerformanceCapture as upload, prepareRacePerformanceReport, serviceRacePerformanceWork, cancelRacePerformanceWork} from '../../src/racing/RacePerformanceUpload.js';
import {RacePerformanceCapture} from '../../src/racing/RacePerformanceCapture.js';
test('upload deduplicates concurrent requests and successful retries',async()=>{
 let calls=0;const capture={active:false,report:()=>({frames:[]})};
 const options={fetchImpl:async(url,request)=>{calls++;assert.equal(url,'/__performance/captures');assert.equal(request.method,'POST');return {ok:true,json:async()=>({ok:true,id:'saved'})};}};
 const first=upload(capture,options);assert.equal(upload(capture,options),first);await first;await upload(capture,options);
 assert.equal(calls,1);assert.equal(capture.uploadState,'saved');
});
test('failed upload preserves capture and allows retry',async()=>{
 const report={frames:[{}]};const capture={active:false,report:()=>report};
 await assert.rejects(upload(capture,{fetchImpl:async()=>({ok:false,status:503})}),/503/);
 assert.equal(capture.uploadState,'failed');assert.equal(capture.report(),report);
 await upload(capture,{fetchImpl:async()=>({ok:true,json:async()=>({ok:true,id:'retry'})})});assert.equal(capture.uploadState,'saved');
});
test('active capture cannot upload; timeout releases retry state',async()=>{
 await assert.rejects(upload({active:true}),/Stop capture/);
 const capture={active:false,report:()=>({})};
 await assert.rejects(upload(capture,{timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout'))))}),/timeout/);
 assert.equal(capture.uploadState,'failed');assert.equal(capture.uploadPromise,null);
});
test('automatic stop notifies once after restoring hooks; timestamps relate to capture start',()=>{
 let at=0,calls=0;const editor={playtestSession:{running:true},update(){},draw(){},lastRaceRenderStats:{threeCarDepthSpriteCount:4}};const original=editor.draw;
 const capture=new RacePerformanceCapture(editor,{now:()=>at,observe:false,maxFrames:1,onStop:c=>{calls++;assert.equal(editor.draw,original);assert.equal(c.active,false);}});
 at=25;editor.update();editor.draw();capture.stop();assert.equal(calls,1);
 assert.equal(capture.frames[0].wallClockMs,capture.metadata.epochStartedMs+25);
 assert.equal(capture.frames[0].context.submittedCarSprites,4);
});

test('failed uploads expose the server reason and retain the capture for retry',async()=>{
 const capture={active:false,report:()=>({version:1})};
 await assert.rejects(upload(capture,{fetchImpl:async()=>({ok:false,status:413,json:async()=>({error:'Capture exceeds 96 MiB'})})}),/Capture exceeds 96 MiB/);
 assert.equal(capture.uploadError,'Capture exceeds 96 MiB');assert.equal(capture.uploadState,'failed');assert.equal(capture.uploadPromise,null);
});

for(const durationMs of [60000,120000])test(`automatic ${durationMs/1000}s completion does no report or upload work while driving`,async()=>{
 let at=0,reports=0,posts=0,pending;
 const editor={playtestSession:{running:true},raceInput:{paused:false},update(){},draw(){}};
 const original=editor.update;
 const capture=new RacePerformanceCapture(editor,{now:()=>at,observe:false,durationMs,
  onStop:c=>{pending=upload(c,{timeoutMs:5,fetchImpl:async()=>{posts++;return {ok:true,json:async()=>({ok:true,id:'saved'})};}});}});
 const report=capture.report.bind(capture);capture.report=()=>{reports++;return report();};
 editor.update();editor.draw();at=durationMs+1;editor.update();editor.draw();
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(capture.active,false);assert.equal(editor.update,original);
 assert.equal(capture.uploadState,'queued');assert.equal(reports,0);assert.equal(posts,0);
 assert.equal(serviceRacePerformanceWork(editor),false);
 editor.raceInput.paused=true;assert.equal(serviceRacePerformanceWork(editor),true);
 await pending;
 assert.equal(reports,1);assert.equal(posts,1);assert.equal(capture.uploadState,'saved');
});

test('simultaneous export/upload and later export share one summary and JSON encoding',async()=>{
 let reports=0,encodes=0;
 const capture={active:false,editor:{raceInput:{paused:true},playtestSession:{running:true}},
  report(){reports++;return {toJSON(){encodes++;return {version:1,frames:[{index:0}]};}};}};
 const exported=prepareRacePerformanceReport(capture);
 const uploaded=upload(capture,{fetchImpl:async(_url,{body})=>{
  assert.equal(JSON.parse(body).version,1);return {ok:true,json:async()=>({ok:true,id:'saved'})};}});
 const first=await exported;await uploaded;
 const again=await prepareRacePerformanceReport(capture);
 assert.equal(again,first);assert.equal(reports,1);assert.equal(encodes,1);
});

test('resuming before deferred preparation executes keeps it off the racing path',async()=>{
 let reports=0;
 const editor={playtestSession:{running:true},raceInput:{paused:false}};
 const capture={active:false,editor,report(){reports++;return {};}};
 const pending=prepareRacePerformanceReport(capture);
 editor.raceInput.paused=true;serviceRacePerformanceWork(editor);
 editor.raceInput.paused=false;
 await new Promise(resolve=>setTimeout(resolve,2));
 assert.equal(reports,0);
 editor.raceInput.paused=true;serviceRacePerformanceWork(editor);await pending;
 assert.equal(reports,1);
});

test('starting another capture cancels the single deferred preparation without a polling timer',async()=>{
 const editor={playtestSession:{running:true},raceInput:{paused:false},update(){},draw(){}};
 const old={active:false,editor,report(){assert.fail('abandoned report built');}};
 const pending=upload(old);const rejection=assert.rejects(pending,{name:'AbortError'});
 const replacement=new RacePerformanceCapture(editor,{observe:false});
 await rejection;assert.equal(old.uploadState,'cancelled');assert.equal(old.uploadPromise,null);
 assert.equal(serviceRacePerformanceWork(editor),false);
 assert.equal(cancelRacePerformanceWork(editor),false);
 replacement.stop();
});

test('exiting the editor releases a completed capture even before the session reference is cleared',async()=>{
 let reports=0;
 const editor={game:{state:'race-editor'},playtestSession:{running:true},raceInput:{paused:false}};
 const pending=prepareRacePerformanceReport({active:false,editor,report(){reports++;return {};}});
 editor.game.state='title';assert.equal(serviceRacePerformanceWork(editor),true);
 await pending;assert.equal(reports,1);
});

test('superseding a released queue entry cancels its continuation before it can requeue',async()=>{
 const editor={playtestSession:{running:true},raceInput:{paused:false},update(){},draw(){}};
 const old={active:false,editor,report(){assert.fail('superseded report built');}};
 const pending=upload(old);const rejection=assert.rejects(pending,{name:'AbortError'});
 editor.raceInput.paused=true;assert.equal(serviceRacePerformanceWork(editor),true);
 const replacement=new RacePerformanceCapture(editor,{observe:false});
 editor.raceInput.paused=false;
 await rejection;
 editor.raceInput.paused=true;
 assert.equal(serviceRacePerformanceWork(editor),false,'old continuation did not requeue');
 assert.equal(old.uploadState,'cancelled');
 replacement.stop();
});

test('car editor test-drive defers its capture and a prior race capture until the active drive pauses',async()=>{
 let reports=0;
 const game={state:'car-editor'};
 const carEditor=game.carEditor={game,mode:'car',playtestSession:{running:true},raceInput:{paused:false}};
 const raceEditor=game.raceEditor={game,mode:'race',playtestSession:null,raceInput:{paused:false}};
 const makeCapture=editor=>({active:false,editor,report(){reports++;return {};}});
 const carPending=prepareRacePerformanceReport(makeCapture(carEditor));
 const racePending=prepareRacePerformanceReport(makeCapture(raceEditor));
 await new Promise(resolve=>setTimeout(resolve,2));
 assert.equal(reports,0);
 assert.equal(serviceRacePerformanceWork(carEditor),false);
 assert.equal(serviceRacePerformanceWork(raceEditor),false);
 carEditor.raceInput.paused=true;
 assert.equal(serviceRacePerformanceWork(carEditor),true);
 assert.equal(serviceRacePerformanceWork(raceEditor),true);
 await Promise.all([carPending,racePending]);
 assert.equal(reports,2);
});
