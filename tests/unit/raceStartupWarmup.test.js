import test from 'node:test';
import assert from 'node:assert/strict';
import {raceStartupWarmupReady as ready} from '../../src/racing/RaceStartupWarmup.js';
test('late optional art stays behind loading until three completed render frames',()=>{
 const warm={started:0,frames:5},session={deferredArtWorker:{}};
 assert.equal(ready(warm,session,4000),false);assert.equal(ready(warm,session,8000),false);
 session.deferredArtWorker=null;assert.equal(ready(warm,session,8100),false);assert.equal(ready(warm,session,8200),false);assert.equal(ready(warm,session,8300),true);
});
test('normal loading minimum and stalled optional worker escape remain bounded',()=>{
 const warm={started:0,frames:3};assert.equal(ready(warm,{},100),false);assert.equal(ready(warm,{},200),false);assert.equal(ready(warm,{},1000),true);
 assert.equal(ready(warm,{deferredArtWorker:{}},29999),false);assert.equal(ready(warm,{deferredArtWorker:{}},30000),true);
});
