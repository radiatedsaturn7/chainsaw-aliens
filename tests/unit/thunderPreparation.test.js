import test from 'node:test';
import assert from 'node:assert/strict';
import { createThunderSamples, fillThunderSamples } from '../../src/audio/ThunderSamples.js';
import { ThunderPreparation } from '../../src/audio/ThunderPreparation.js';
import { createThunderstorm, advanceThunderstorm } from '../../src/racing/Thunderstorm.js';
const options={sampleRate:44100,durationSeconds:.2,near:.3,seed:123,pulseDelays:[0,.1]};

test('worker and yielded synthesis produce identical seeded samples',async()=>{
 const reference=createThunderSamples(options);fillThunderSamples(reference);
 const chunks=createThunderSamples(options);while(!fillThunderSamples(chunks,127)){}
 assert.deepEqual(chunks.samples,reference.samples);
 const scheduled=[];
 const prep=new ThunderPreparation({workerFactory(){throw Error('unsupported');},schedule:fn=>scheduled.push(fn)});
 const promise=prep.prepare(options);
 assert.equal(scheduled.length,1,'fallback never synthesizes synchronously');
 let slices=0;while(scheduled.length){scheduled.shift()();slices++;}
 assert.ok(slices>=4);assert.deepEqual(await promise,reference.samples);prep.dispose();
});
test('worker results are matched to their request, and cancellation suppresses late playback',async()=>{
 const worker={postMessage(v){this.request=v;},terminate(){this.terminated=true;}};
 const prep=new ThunderPreparation({workerFactory:()=>worker});
 const first=prep.prepare(options),id=worker.request.id;
 worker.onmessage({data:{id,samples:new Float32Array([.25])}});
 assert.deepEqual(await first,new Float32Array([.25]));
 const pending=prep.prepare(options);prep.dispose();assert.equal(await pending,null);
 assert.equal(worker.terminated,true);assert.equal(prep.jobs.size,0);
 worker.onmessage({data:{id:worker.request.id,samples:new Float32Array([1])}});
});
test('worker errors yield to fallback without blocking or losing sound',async()=>{
 const scheduled=[],worker={postMessage(){},terminate(){}};
 const prep=new ThunderPreparation({workerFactory:()=>worker,schedule:fn=>scheduled.push(fn)});
 const promise=prep.prepare(options);worker.onerror();while(scheduled.length)scheduled.shift()();
 assert.equal((await promise).length,8820);prep.dispose();
});
test('thunder is prepared at the flash and played only after sound travel delay',()=>{
 const state=createThunderstorm(7),prepared=[],heard=[];state.hazard=0;
 const callbacks={onPrepareThunder:e=>prepared.push(e),onThunder:e=>heard.push(e)};
 advanceThunderstorm(state,1/120,callbacks);
 assert.equal(prepared.length,1);assert.equal(heard.length,0);
 const event=prepared[0];assert.ok(event.at>state.time);
 while(state.time<event.at)advanceThunderstorm(state,1/120,{...callbacks,intensity:0});
 assert.equal(heard[0],event);
});
