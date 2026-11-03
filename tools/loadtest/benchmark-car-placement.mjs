// Placement math microbenchmark, not GPU performance or whole-game FPS.
// node --expose-gc tools/loadtest/benchmark-car-placement.mjs
import {execFileSync} from 'node:child_process';
import inspector from 'node:inspector';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import * as current from '../../src/racing/RaceCarDepthSprites.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const baselineRef='ddb4ad8aaf823cfee894f9aa1b4ec9c712eacece';
const source=execFileSync('git',['show',`${baselineRef}:src/racing/RaceCarDepthSprites.js`],{encoding:'utf8'})
 .replace("'../vendorBridge/three.js'",JSON.stringify(new URL('../../src/vendorBridge/three.js',import.meta.url).href));
const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(){
 const camera=new THREE.PerspectiveCamera(62,1.6,.1,2600);
 camera.position.set(0,8,20);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
 return {camera,world:{x:0,y:1,z:0},footprint:{x:0,z:0,yaw:.6,lengthM:4.5,widthM:1.8},
  ground:{x:0,y:0,z:0,normal:{x:.1,y:1,z:.2}},bottom:{xs:[-.1,.1],y:-.4},scratch:current.createCarSpritePlacementScratch()};
}
function oldStep(s){const depth=baseline.carSpriteFootprintDepthAnchor(s.camera,s.world,s.footprint);return baseline.carSpritePaintDepthAnchor(s.camera,depth,s.ground,s.bottom,s.footprint);}
function newStep(s){const depth=current.carSpriteFootprintDepthAnchor(s.camera,s.world,s.footprint,s.scratch);return current.carSpritePaintDepthAnchor(s.camera,depth,s.ground,s.bottom,s.footprint,s.scratch);}
const check=fixture();for(let i=0;i<300;i++){
 check.camera.position.set(Math.sin(i)*20,2+i%12,20);check.camera.lookAt(0,1,0);check.camera.updateMatrixWorld(true);
 check.footprint.yaw=i*.3;
 assert.deepEqual(newStep(check),oldStep(check));
}
function poseFixture(){
 const editor=Object.create(RaceEditor.prototype);editor.raceInput={steeringWheel:0};
 editor.getRacePhysicalTireAngleForSteering=()=>0;
 const ai={id:'opponent',carId:'test',difficulty:'medium',worldX:10,worldZ:20,carYaw:.4,
  projectedDistance:100,distance:100,lineOffset:0,bodyY:1,bodyX:10,bodyZ:20,
  speedMps:20,rpm:4500,gear:3,pitchRad:.05,rollRad:.02,tireSlip:{frontTireAngle:.1},
  damage:{},mechanical:{},engineDrive:{},runtimeCar:{},vehicleDynamicsRunner:{},vehicleRenderState:null};
 return {editor,ai,car:{},options:{fallbackElevation:0,fallbackPose:{x:10,z:20,yaw:.4}}};
}
function copiedPose(s){return s.editor.getRacePlayerRenderPose({...s.ai,worldX:10,worldZ:20,carYaw:s.ai.carYaw??.4,tireSlip:s.ai.tireSlip||{frontTireAngle:0}},s.car,{fallbackElevation:0});}
function directPose(s){return s.editor.getRacePlayerRenderPose(s.ai,s.car,{fallbackElevation:0,fallbackPose:{x:10,z:20,yaw:.4}});}
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
const cases=[['car footprint and painted-ground depth placement',30000,fixture,oldStep,newStep],['AI render pose (24-field fixture)',30000,poseFixture,copiedPose,directPose]];
const results=[];
for(const [name,n,build,before,after] of cases){
 const timings=[];
 for(let i=0;i<4;i++)timings.push(i%2?{afterMs:await measure(build,after,n),beforeMs:await measure(build,before,n)}:{beforeMs:await measure(build,before,n),afterMs:await measure(build,after,n)});
 results.push({name,iterations:n,timings,sampledAllocatedBytes:{before:await measure(build,before,n,true),after:await measure(build,after,n,true)}});
}
session.disconnect();console.log(JSON.stringify({baselineRef,parity:'passed',kind:'Node microbenchmark, not whole-game performance',results},null,2));
