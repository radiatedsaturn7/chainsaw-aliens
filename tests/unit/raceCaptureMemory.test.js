import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceCaptureMemory,readBrowserHeap} from '../../src/racing/RaceCaptureMemory.js';
import {RacePerformanceCapture} from '../../src/racing/RacePerformanceCapture.js';

test('memory samples are rate limited, bounded and retain independent heap readings',()=>{
 let reads=0;const heap={usedBytes:100,committedBytes:200,limitBytes:300};
 const sampler=new RaceCaptureMemory({readHeap:()=>{reads++;return heap;},maxSamples:2});
 sampler.sample(0,{recorder:{frames:1}});heap.usedBytes=60;
 sampler.sample(20,{});sampler.sample(500,{});sampler.sample(1000,{});
 assert.equal(reads,2);assert.equal(sampler.samples.length,2);
 assert.equal(sampler.samples[0].heap.usedBytes,100);assert.equal(sampler.samples[1].heap.usedBytes,60);
 assert.equal(sampler.report().heapStatus,'available');
 assert.equal('gcEvents' in sampler.report(),false);
});
test('unsupported or rejected heap reads retain useful resource counts',()=>{
 for(const readHeap of [()=>null,()=>{throw Error('blocked');}]){
  const sampler=new RaceCaptureMemory({readHeap});sampler.sample(0,{trackCells:42});
  assert.equal(sampler.report().heapStatus,'unavailable');
  assert.equal(sampler.samples[0].heap,null);assert.equal(sampler.samples[0].trackCells,42);
 }
 assert.doesNotThrow(()=>readBrowserHeap());
});
test('capture includes memory/resource trends without timing changes or post-stop reads',()=>{
 let now=0,reads=0;
 const editor={playtestSession:{running:true,aiRuntime:[],trackState:{cells:new Map([['one',{}]]),eventHistory:[]}},
  lastRaceRenderStats:{carRestFramePixels:20},
  raceThreeWorldRenderer:{threeRenderer:{info:{memory:{geometries:5,textures:7}}}},
  update(){now+=2;},draw(){now+=3;}};
 const capture=new RacePerformanceCapture(editor,{now:()=>now,observe:false});
 capture.memoryCapture.readHeap=()=>{reads++;return null;};
 for(let i=0;i<4;i++){editor.update();editor.draw();}
 const report=capture.report(),sample=report.memory.samples[0];
 assert.equal(reads,1);assert.equal(report.frames[0].instrumentedCpuMs,5);
 assert.deepEqual(sample.renderer,{geometries:5,textures:7});
 assert.equal(sample.cachedCarArtRgbaBytesEstimate,80);assert.equal(sample.trackCells,1);
 assert.equal(sample.recorder.frames,1);assert.equal(sample.recorder.phaseRecords,2);
 capture.stop();now+=1000;editor.update();editor.draw();assert.equal(reads,1);
});
