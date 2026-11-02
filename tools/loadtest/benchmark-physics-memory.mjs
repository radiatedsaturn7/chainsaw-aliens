// Constructor allocation probe, separate from timed driving; estimates only.
// node --expose-gc tools/loadtest/benchmark-physics-memory.mjs
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {createPhysicsTerrainQueryFrameCache} from '../../src/racing/simulation/PhysicsTerrainQueryFrame.js';
if(!global.gc)throw Error('Run with --expose-gc');
const retained=[],rows=[];
for(const [name,build] of [
 ['runner',()=>new VehicleDynamicsRunner({config:{chassisHz:60,tireHz:60,telemetryRetention:'none'}})],
 ['aiTerrainCache128',()=>createPhysicsTerrainQueryFrameCache({resultCapacity:128})],
 ['defaultTerrainCache256',()=>createPhysicsTerrainQueryFrameCache()]
]){
 global.gc();const before=process.memoryUsage();
 for(let i=0;i<20;i++)retained.push(build());
 global.gc();const after=process.memoryUsage();
 rows.push({name,count:20,perInstance:Object.fromEntries(['heapUsed','external','arrayBuffers'].map(k=>[k,(after[k]-before[k])/20]))});
}
console.log(JSON.stringify(rows,null,2));
