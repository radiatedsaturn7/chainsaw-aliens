// Focused JavaScript benchmark, not browser Canvas/GPU or whole-game FPS.
// node --expose-gc tools/loadtest/benchmark-wheel-glass.mjs
import {execFileSync} from 'node:child_process';
import inspector from 'node:inspector';
import assert from 'node:assert/strict';
import {drawWheelCylinder} from '../../src/racing/CarWheelCylinder.js';
import {drawWheelCylinder as oldDrawWheelCylinder} from '../../tests/fixtures/carWheelCylinderLegacy.js';
import * as glass from '../../src/racing/GlassWeather.js';
import {normalizeCarWipers} from '../../src/racing/CarWipers.js';
const baselineRef='ddb4ad8aaf823cfee894f9aa1b4ec9c712eacece';
const source=execFileSync('git',['show',`${baselineRef}:src/racing/GlassWeather.js`],{encoding:'utf8'})
 .replace("'./CarWipers.js'",JSON.stringify(new URL('../../src/racing/CarWipers.js',import.meta.url).href));
const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const wipers=normalizeCarWipers({artRef:'wipers'});
for(const weather of ['rain','storm','snow','clear']){
 const a={},b={};
 for(let i=0;i<1200;i++){
  const options={weather:{id:weather,precipitationIntensity:.9},wipers,speedMps:i%60,temperatureC:weather==='snow'?-5:20,sheltered:i%200<20};
  baseline.updateGlassWeather(a,1/60,options);glass.updateGlassWeather(b,1/60,options);
  if(i%120===0)assert.deepEqual(a,b);
 }
 assert.deepEqual(a,b);
}
const context={imageSmoothingEnabled:true,save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},fill(){},transform(){},drawImage(){}};
function wheelFixture(){return {tread:{width:128,height:64},wheel:{width:64,height:64},width:20,height:50,bearing:.7,spin:.4};}
const options={weather:{id:'storm',precipitationIntensity:1},wipers,speedMps:0,temperatureC:10};
function glassFixture(){
 const state=glass.createGlassWeather();
 for(const layer of ['lens','windshield'])state[layer]=Array.from({length:96},(_,i)=>({x:.95,y:.01+i*.0001,radius:.004,life:100000,age:0,snow:0,drift:0}));
 return {glassWeather:state,wipers:{enabled:true,moving:true,phase:0},wiperWeatherWet:true};
}
const session=new inspector.Session();session.connect();
const post=(name,args={})=>new Promise((resolve,reject)=>session.post(name,args,(err,result)=>err?reject(err):resolve(result)));
const bytes=node=>node.selfSize+(node.children||[]).reduce((sum,child)=>sum+bytes(child),0);
async function measure(build,step,n,allocation=false) {
 const state=build();for(let i=0;i<100;i++)step(state,i);
 global.gc?.();
 if(allocation)await post('HeapProfiler.startSampling',{samplingInterval:4096,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
 const start=performance.now();for(let i=0;i<n;i++)step(state,i);const ms=performance.now()-start;
 return allocation?bytes((await post('HeapProfiler.stopSampling')).profile.head):ms;
}
const cases=[
 ['textured wheel painter',3000,wheelFixture,s=>oldDrawWheelCylinder(context,s),s=>drawWheelCylinder(context,s)],
 ['windshield/lens update, 96 drops each',3000,glassFixture,s=>baseline.updateGlassWeather(s,1/60,options),s=>glass.updateGlassWeather(s,1/60,options)]
];
const results=[];
for(const [name,n,build,before,after] of cases){
 const timings=[];
 for(let i=0;i<4;i++)timings.push(i%2?{afterMs:await measure(build,after,n),beforeMs:await measure(build,before,n)}:{beforeMs:await measure(build,before,n),afterMs:await measure(build,after,n)});
 results.push({name,iterations:n,timings,sampledAllocatedBytes:{before:await measure(build,before,n,true),after:await measure(build,after,n,true)}});
}
session.disconnect();console.log(JSON.stringify({baselineRef,parity:'passed',kind:'Node microbenchmark, not whole-game performance',results},null,2));
