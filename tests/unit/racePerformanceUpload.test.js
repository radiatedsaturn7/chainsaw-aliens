import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadRacePerformanceCapture as upload} from '../../src/racing/RacePerformanceUpload.js';
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
