// Tire particle painting microbenchmark, not browser GPU or whole-game FPS.
// node --expose-gc tools/loadtest/benchmark-tire-projection.mjs
import inspector from 'node:inspector';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {drawRaceTireFxParticles as legacy} from '../../tests/fixtures/tireFxPainterLegacy.js';
const baselineRef='ddb4ad8aaf823cfee894f9aa1b4ec9c712eacece';
const ctx={imageSmoothingEnabled:true,save(){},restore(){},beginPath(){},ellipse(){},fill(){}};
const bounds={x:0,y:0,w:390,h:240},options={camera:{},cameraYaw:0,layer:'all'};
function fixture(){
 const editor=Object.create(RaceEditor.prototype);
 editor.playtestSession={tireFxParticles:Array.from({length:140},(_,i)=>({id:i,slotId:i%3?'skidSmoke':'asphaltSkid',x:i,z:i%7,ageMs:i*5,lifetimeMs:700,sizeM:.4,alpha:.6,color:'#abc'}))};
 editor.projectRaceWorldVisualPoint=p=>({screenX:p.x,screenY:50,visible:true,cameraZ:p.z,renderZ:p.z});
 return editor;
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
const cases=[['140 tire particles: projection, sort and paint',3000,fixture,e=>legacy.call(e,ctx,bounds,options),e=>e.drawRaceTireFxParticles(ctx,bounds,options)]];
const results=[];
for(const [name,n,build,before,after] of cases){
 const timings=[];
 for(let i=0;i<4;i++)timings.push(i%2?{afterMs:await measure(build,after,n),beforeMs:await measure(build,before,n)}:{beforeMs:await measure(build,before,n),afterMs:await measure(build,after,n)});
 results.push({name,iterations:n,timings,sampledAllocatedBytes:{before:await measure(build,before,n,true),after:await measure(build,after,n,true)}});
}
session.disconnect();console.log(JSON.stringify({baselineRef,kind:'Node microbenchmark, not whole-game performance',results},null,2));
