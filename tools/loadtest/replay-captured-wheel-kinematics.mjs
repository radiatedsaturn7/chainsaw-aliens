// Fixed recorded poses/controls, not a full simulation or GPU/FPS replay.
// node --expose-gc tools/loadtest/replay-captured-wheel-kinematics.mjs CAPTURE.json [BASELINE_REF]
import fs from 'node:fs';
import crypto from 'node:crypto';
import inspector from 'node:inspector';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import * as current from '../../src/racing/simulation/ContactPatchTireModel.js';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';
const path=process.argv[2];if(!path)throw Error('Provide a performance capture JSON path');
const raw=fs.readFileSync(path),capture=JSON.parse(raw),ref=execFileSync('git',['rev-parse',process.argv[3]||'HEAD'],{encoding:'utf8'}).trim();
const modulePath='src/racing/simulation/ContactPatchTireModel.js';
const source=execFileSync('git',['show',`${ref}:${modulePath}`],{encoding:'utf8'}).replace(/from '([^']+)'/g,(_,p)=>`from '${new URL(p,new URL('../../'+modulePath,import.meta.url)).href}'`);
const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const runner=new VehicleDynamicsRunner({config:{...capture.metadata.handlingSetup.config,telemetryRetention:'none'}});
const cases=[];
for(const frame of capture.frames){
 for(const car of frame.ai?.cars||[]){
  if(!car.position||!car.velocity||!car.wheels||!car.controls||car.name==='You')continue;
  // This capture's metadata describes the player's car. Do not substitute it
  // for a differently configured opponent.
  if(!car.carId?.toLowerCase().includes(capture.metadata.handlingSetup.carName.toLowerCase()))continue;
  const state=structuredClone(runner.state);
  state.position={...car.position};state.velocity={...car.velocity};state.angularVelocity={...car.angularVelocity};
  state.yawRad=car.yawRad;state.orientation=quaternionFromEuler(car.yawRad,car.pitchRad,car.rollRad);
  for(const id of ['fl','fr','rl','rr']){
   const wheel=car.wheels[id];if(!wheel)continue;
   const request={state,config:runner.config,controls:{...car.controls},environment:{},wheelId:id,
    suspensionCompressionOverrideM:wheel.compressionM,
    camberOverrideRad:id[0]==='f'?runner.config.camberFrontRad:runner.config.camberRearRad,
    toeOverrideRad:id[0]==='f'?runner.config.toeFrontRad:runner.config.toeRearRad};
   cases.push(request);
  }
 }
}
if(!cases.length)throw Error('Capture needs detailed AI snapshots of the metadata car');
const scratch=current.createWheelContactKinematicsScratch();
for(const request of cases){
 const expected=baseline.calculateWheelContactKinematics(request);
 const actual=current.calculateWheelContactKinematics({...request,target:scratch.target,computationScratch:scratch.computation});
 assert.deepEqual(actual,expected);
 // Also preserve the alignment fallback used when overrides are absent.
 const fallback={...request,camberOverrideRad:null,toeOverrideRad:null};
 assert.deepEqual(current.calculateWheelContactKinematics(fallback),baseline.calculateWheelContactKinematics(fallback));
}
const session=new inspector.Session();session.connect();
const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(e,r)=>e?reject(e):resolve(r)));
const bytes=n=>n.selfSize+(n.children||[]).reduce((sum,c)=>sum+bytes(c),0);
async function run(mod,alloc=false){
 const scratch=mod.createWheelContactKinematicsScratch();
 const requests=cases.map(r=>({...r,target:scratch.target,computationScratch:scratch.computation}));
 const step=()=>{for(const r of requests)mod.calculateWheelContactKinematics(r);};
 step();step();global.gc?.();
 if(alloc)await post('HeapProfiler.startSampling',{samplingInterval:1024,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
 const start=performance.now();for(let i=0;i<10;i++)step();const ms=performance.now()-start;
 return alloc?bytes((await post('HeapProfiler.stopSampling')).profile.head):ms;
}
const timings=[];for(let i=0;i<4;i++)timings.push(i%2?{afterMs:await run(current),beforeMs:await run(baseline)}:{beforeMs:await run(baseline),afterMs:await run(current)});
const allocated={before:await run(baseline,true),after:await run(current,true)};session.disconnect();
console.log(JSON.stringify({scope:'Recorded wheel-kinematics CPU/allocation replay; not browser FPS, GPU or full vehicle simulation',captureSha256:crypto.createHash('sha256').update(raw).digest('hex'),baselineRef:ref,nodeVersion:process.version,race:capture.metadata.race,car:capture.metadata.handlingSetup.carName,cases:cases.length,queriesPerRun:cases.length*10,parity:'exact',timings,sampledAllocatedBytes:allocated},null,2));
