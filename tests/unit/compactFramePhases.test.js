import test from 'node:test';
import assert from 'node:assert/strict';
import {CompactFramePhases} from '../../src/racing/CompactFramePhases.js';
import {RacePerformanceCapture} from '../../src/racing/RacePerformanceCapture.js';

test('packed frame totals retain exact values across reused records and serialize normally',()=>{
 const pool=new CompactFramePhases();pool.begin(0);
 const p=pool.get('AI');p.inclusiveMs=1.125;p.selfMs=.125;p.calls=3;
 const first={};const packed=pool.finish(first);
 pool.begin(1);const second=pool.get('AI');assert.equal(p,second);
 second.inclusiveMs=12;second.selfMs=10;second.calls=7;pool.get('new');
 const next={};pool.finish(next);
 assert.deepEqual(JSON.parse(JSON.stringify(first)),{phases:{AI:{inclusiveMs:1.125,selfMs:.125,calls:3}}});
 assert.equal(packed.bytes,32);assert.equal(packed.cpu,.125);
 assert.equal(next.phases.AI.calls,7);assert.equal('new' in first.phases,false);
 assert.equal(first.phases,first.phases,'materialization is cached across report and JSON reads');
 assert.equal(Object.getOwnPropertyDescriptor(first,'phases').get,undefined);
});
test('compact capture continues frame aggregates beyond trace capacity and captures slow sprite identity',()=>{
 let now=0;const e={playtestSession:{running:true,aiRuntime:[]},update(){},draw(){}};
 const capture=new RacePerformanceCapture(e,{now:()=>now,observe:false,detailed:true,compactTrace:true,maxSpans:2,maxFrames:100});
 const sprites={draw(){now+=20;}};capture.wrap(sprites,'draw','carSprites.draw');
 for(let i=0;i<5;i++){e.update();sprites.draw('ai-8');e.draw();}
 assert.equal(capture.active,true);assert.equal(capture.spans.length,2);
 assert.ok(capture.droppedSpans>0);
 assert.equal(capture.frames.length,5);assert.equal(capture.frames[4].phases['carSprites.draw'].inclusiveMs,20);
 assert.equal(capture.frames[4].slowCalls[0].spriteKey,'ai-8');
 assert.equal(capture.frames[4].instrumentedCpuMs,20);
 assert.ok(capture.packedPhaseBytes>0);capture.stop();
});
test('compact aggregates match regular recording including nested and thrown calls',()=>{
 function run(compactTrace){
  let now=0;const e={playtestSession:{running:true,aiRuntime:[]}};
  const c=new RacePerformanceCapture(e,{now:()=>now,observe:false,detailed:true,compactTrace});
  for(let i=0;i<3;i++){
   c.begin();assert.throws(()=>c.time('outer',()=>{now+=2;c.time('inner',()=>{now+=3;throw Error('x');});}),/x/);c.finish();
  }
  c.stop();return JSON.parse(JSON.stringify(c.frames.map(f=>({phases:f.phases,cpu:f.instrumentedCpuMs}))));
 }
 assert.deepEqual(run(true),run(false));
});
