import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
import {createTrackEventQueueProbe} from '../../src/racing/TrackEventQueueProbe.js';
function track(){return Object.assign(Object.create(TrackState.prototype),{historyBaseStepIndex:0,historyBaseSequence:0,nextSequence:1,stepIndex:0,eventIds:new Set(),staleEventIds:new Set(),pendingEvents:[],eventHistory:[],cells:new Map()});}
test('queue probe preserves normalized events and duplicate rejection',()=>{
 let time=0;const a=track(),b=track();b.eventQueueProbe=createTrackEventQueueProbe(()=>time+=5);
 const input={vehicleId:'player',wheelId:'fl',cellKey:'0,0',stepIndex:1};
 assert.deepEqual(a.queueAccumulatedTireContact(input),b.queueAccumulatedTireContact(input));
 assert.equal(a.queueAccumulatedTireContact(input),null);assert.equal(b.queueAccumulatedTireContact(input),null);
 assert.deepEqual(a.pendingEvents,b.pendingEvents);assert.deepEqual(a.eventIds,b.eventIds);
 const report=b.eventQueueProbe.snapshot();assert.equal(report.stages.normalize.calls,2);assert.equal(report.stages.lookup.calls,2);
 assert.equal(report.stages.idInsert.calls,1);assert.equal(report.stages.queueInsert.calls,1);
 assert.equal(report.slow[0].stage,'normalize');assert.equal(report.slow[0].durationMs,5);
});
test('probe slow samples are bounded and reports detached',()=>{
 let time=0;const p=createTrackEventQueueProbe(()=>time+=5),t=track();
 for(let i=0;i<100;i++)p.end('lookup',p.now(),t);
 const snapshot=p.snapshot();assert.equal(snapshot.slow.length,48);assert.equal(snapshot.stages.lookup.calls,100);
 p.end('lookup',p.now(),t);assert.equal(snapshot.stages.lookup.calls,100);
});
