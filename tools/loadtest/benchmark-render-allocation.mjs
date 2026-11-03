// Short renderer microbenchmark: allocation and CPU time, not browser FPS.
// node --expose-gc tools/loadtest/benchmark-render-allocation.mjs
import {execFileSync} from 'node:child_process';
import inspector from 'node:inspector';
import assert from 'node:assert/strict';
import * as current from '../../src/racing/RaceProjectedPolygon.js';
import * as legacy from '../../tests/fixtures/raceProjectedPolygonLegacy.js';
import {createVehicleRenderStateFromRunner} from '../../src/racing/simulation/VehicleRenderState.js';
const baselineRef='ddb4ad8aaf823cfee894f9aa1b4ec9c712eacece';
const moduleUrl=new URL('../../src/racing/simulation/VehicleRenderState.js',import.meta.url);
const source=execFileSync('git',['show',`${baselineRef}:src/racing/simulation/VehicleRenderState.js`],{encoding:'utf8'})
 .replace(/from '(\.\/[^']+)'/g,(_,relative)=>`from '${new URL(relative,moduleUrl).href}'`);
const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const bounds={x:0,y:0,w:800,h:400};
const polygons=Array.from({length:12},(_,i)=>Array.from({length:4},(_,j)=>({screenX:100+(j===1||j===2?40:0)+i*5,screenY:100+(j>=2?40:0),visible:true,clippedToNearPlane:i===0})));
const context={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}};
function fixture(){return {state:{},config:{massKg:1400},terrainImpactHistory:Array.from({length:128},(_,i)=>({terrainImpact:i%3===0,sequence:i,impactPointWorld:{x:i,y:2,z:3}}))};}
assert.deepEqual(createVehicleRenderStateFromRunner(fixture()),baseline.createVehicleRenderStateFromRunner(fixture()));
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
 ['projected polygon painting',50000,()=>null,(_,i)=>{legacy.appendRaceProjectedQuadPath(context,bounds,polygons[i%12]);legacy.drawRaceProjectedVehicleQuad(context,bounds,polygons[i%12]);},(_,i)=>{current.appendRaceProjectedQuadPath(context,bounds,polygons[i%12]);current.drawRaceProjectedVehicleQuad(context,bounds,polygons[i%12]);}],
 ['vehicle render snapshot, 128 historical impacts',2000,fixture,s=>baseline.createVehicleRenderStateFromRunner(s),s=>createVehicleRenderStateFromRunner(s)]
];
const results=[];
for(const [name,n,build,before,after] of cases){
 const timings=[];
 for(let i=0;i<4;i++)timings.push(i%2?{afterMs:await measure(build,after,n),beforeMs:await measure(build,before,n)}:{beforeMs:await measure(build,before,n),afterMs:await measure(build,after,n)});
 results.push({name,iterations:n,timings,sampledAllocatedBytes:{before:await measure(build,before,n,true),after:await measure(build,after,n,true)}});
}
session.disconnect();console.log(JSON.stringify({baselineRef,parity:'passed',kind:'Node microbenchmark, not whole-game performance',results},null,2));
