// Focused allocation/timing comparison; not an FPS benchmark.
// Run: node --expose-gc tools/loadtest/benchmark-hot-loop-reuse.mjs
import inspector from 'node:inspector';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {updateWeatherParticleMotion} from '../../src/shared/weatherEffects.js';
import {advanceRaceTireFxParticles} from '../../src/racing/RaceTireFxParticles.js';
const iterations=3000;
function tireFixture(){return {tireFxParticles:Array.from({length:140},(_,id)=>({id,ageMs:0,lifetimeMs:1e9,x:id,z:-id,elevation:0,vx:.3,vz:.2,vy:.01,artRef:'smoke'}))};}
function legacyTire(s){const dt=1/60;s.tireFxParticles=s.tireFxParticles.map(p=>({...p,ageMs:Number(p.ageMs||0)+dt*1000,x:Number(p.x||0)+Number(p.vx||0)*dt,z:Number(p.z||0)+Number(p.vz||0)*dt,elevation:Number(p.elevation||0)+Number(p.vy||0)*dt})).filter(p=>Number(p.ageMs||0)<Number(p.lifetimeMs||1));}
function weatherFixture(){return {particles:Array.from({length:900},(_,i)=>({life:1e9,x:i,y:-i,vx:-8,vy:40,angle:0,spin:2,sway:i,style:i%2?{kind:'weather',swayAmplitude:16,swaySpeed:2}:{gravity:true,gravityScale:.7}}))};}
function legacyWeather(state){
 const dt=1/60;
 state.particles.forEach(p=>{
  p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;
  if(p.style.kind==='weather')p.x+=-30*dt;
  if(p.style.gravity)p.vy+=900*Math.max(0,Number(p.style.gravityScale??1))*dt;
  if(p.style.swayAmplitude){p.sway+=dt*(p.style.swaySpeed||3);p.x+=Math.sin(p.sway)*p.style.swayAmplitude*dt;}
 });state.particles=state.particles.filter(p=>p.life>0);
}
function bytes(node){return node.selfSize+(node.children||[]).reduce((n,c)=>n+bytes(c),0);}
const session=new inspector.Session();session.connect();
const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,data)=>error?reject(error):resolve(data)));
async function sample(build,step){
 const state=build();for(let i=0;i<100;i++)step(state);global.gc?.();
 await post('HeapProfiler.startSampling',{samplingInterval:4096,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
 for(let i=0;i<iterations;i++)step(state);
 const result=await post('HeapProfiler.stopSampling');return bytes(result.profile.head);
}
function time(build,step){
 const s=build();for(let i=0;i<100;i++)step(s);const start=performance.now();
 for(let i=0;i<iterations;i++)step(s);return performance.now()-start;
}
const rows=[];
for(const [name,build,before,after] of [['tire particle updates',tireFixture,legacyTire,s=>advanceRaceTireFxParticles(s,1/60)],['weather particle updates',weatherFixture,legacyWeather,s=>{updateWeatherParticleMotion(s.particles,1/60,-30);}]]){
 const a=build(),b=build();for(let i=0;i<300;i++)assert.deepEqual(before(a),after(b));
 assert.deepEqual(a,b);
 const timings=[];for(let i=0;i<4;i++)timings.push(i%2?{afterMs:time(build,after),beforeMs:time(build,before)}:{beforeMs:time(build,before),afterMs:time(build,after)});
 const beforeBytes=await sample(build,before),afterBytes=await sample(build,after);
 rows.push({name,iterations,timings,sampledAllocatedBytes:{before:beforeBytes,after:afterBytes,reductionPercent:100*(1-afterBytes/beforeBytes)}});
}
session.disconnect();console.log(JSON.stringify({kind:'focused Node microbenchmark; not browser FPS or full-game allocation',rows},null,2));
