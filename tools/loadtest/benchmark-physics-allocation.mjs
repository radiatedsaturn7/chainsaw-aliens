// Short, isolated allocation/timing checks; these are not browser FPS results.
// node --expose-gc tools/loadtest/benchmark-physics-allocation.mjs
import {execFileSync} from 'node:child_process';
import inspector from 'node:inspector';
import assert from 'node:assert/strict';
import * as mechanics from '../../src/racing/simulation/MechanicalModel.js';
import * as steering from '../../src/racing/simulation/ContactPatchTireModel.js';
const baselineRef = process.env.BASELINE_REF || 'ddb4ad8aaf823cfee894f9aa1b4ec9c712eacece';
async function baseline(name) {
 const path = `src/racing/simulation/${name}.js`;
 const source = execFileSync('git',['show',`${baselineRef}:${path}`],{encoding:'utf8'})
  .replace(/from '(\.\/[^']+)'/g,(_,relative)=>`from '${new URL(relative,new URL('../../'+path,import.meta.url)).href}'`);
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const oldMechanics = await baseline('MechanicalModel');
const oldSteering = await baseline('ContactPatchTireModel');
const telemetry={rpm:6200,maxRpm:7000,throttle:.9,speedMps:28,gear:3,brake:.2,impact:.4,headlights:true};
function mechanicalFixture(damaged=false) {
 const damage={engine:damaged?82:0,transmission:damaged?75:0,panels:{front:damaged?88:0}};
 return {state:mechanics.createMechanicalState({seed:'allocation-parity'},damage,{boostBar:1}),damage};
}
for (const damaged of [false,true]) {
 const a=mechanicalFixture(damaged),b=structuredClone(a);
 for(let i=0;i<1200;i++) {
  const input={...telemetry,headlights:i%200<100,impact:i%81===0?3:0};
  oldMechanics.stepMechanicalState(a.state,1/120,input,a.damage);
  mechanics.stepMechanicalState(b.state,1/120,input,b.damage);
  if(i%100===0)assert.deepEqual(a,b);
 }
 assert.deepEqual(a,b);
}
const states=[];
for(const speed of [0,.2,1,10,35,70])for(const load of [0,1,2,100,3500,NaN,Infinity])for(const right of [undefined,{normalLoadN:2500,suspensionNormalLoadN:4000}]) {
 const state={groundSpeedMps:speed,contactPatches:{fl:{normalLoadN:load,suspensionNormalLoadN:4000},fr:right}};
 assert.equal(steering.calculateAuthoritativeSteeringEnvelope(state),oldSteering.calculateAuthoritativeSteeringEnvelope(state));
 states.push(state);
}
const responseCases=[];
for(const use of [undefined,0,.6,.95,NaN,'0.99'])for(const mu of [undefined,.2,.9,NaN,'0.3']) {
 const input={frontUtilization:{fl:use,fr:.4},throttleFrictionCircleUse:{fl:use},frontGripCoefficients:{fl:mu,fr:mu}};
 assert.equal(steering.classifySteeringResponseTelemetry(input),oldSteering.classifySteeringResponseTelemetry(input));
 responseCases.push(input);
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
 ['mechanical updates',3000,()=>mechanicalFixture(),s=>oldMechanics.stepMechanicalState(s.state,1/120,telemetry,s.damage),s=>mechanics.stepMechanicalState(s.state,1/120,telemetry,s.damage)],
 ['steering envelope + telemetry classification',30000,()=>null,(_,i)=>{oldSteering.calculateAuthoritativeSteeringEnvelope(states[i%states.length]);oldSteering.classifySteeringResponseTelemetry(responseCases[i%responseCases.length]);},(_,i)=>{steering.calculateAuthoritativeSteeringEnvelope(states[i%states.length]);steering.classifySteeringResponseTelemetry(responseCases[i%responseCases.length]);}]
];
const results=[];
for(const [name,n,build,before,after] of cases){
 const timings=[];
 for(let i=0;i<4;i++)timings.push(i%2?{afterMs:await measure(build,after,n),beforeMs:await measure(build,before,n)}:{beforeMs:await measure(build,before,n),afterMs:await measure(build,after,n)});
 results.push({name,iterations:n,timings,sampledAllocatedBytes:{before:await measure(build,before,n,true),after:await measure(build,after,n,true)}});
}
session.disconnect();console.log(JSON.stringify({baselineRef,parity:'passed',kind:'Node microbenchmark, not whole-game performance',results},null,2));
