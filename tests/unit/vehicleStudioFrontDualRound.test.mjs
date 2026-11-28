import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {loadVehicle,createVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {makeOpenings,emitOpenings} from '../../src/ui/vehicleStudio/optics.mjs';

test('opt-in front dual-round keeps four individual trims and two primary light mounts',async()=>{
 const g=loadVehicle(await readFile(new URL('../../src/ui/vehicleStudio/examples/acura-integra-type-r-dc2.json', import.meta.url),'utf8'));
 const surface=(u,v)=>[(u-.5)*g.dimensions.width,1-v*.56,2-(u-.5)**2*.18];
 const base=makeOpenings({end:'front',g:createVehicle('coupe'),face:surface});
 assert.equal(base.filter(o=>o.component==='headlights').length,2);
 const apertures=()=>makeOpenings({end:'front',g,face:surface}).filter(o=>o.component==='headlights');
 const lights=apertures();
 assert.equal(lights.length,4);
 const bands=lights.map(x=>x.outline.map(p=>p[0])).map(x=>[Math.min(...x),Math.max(...x)]).sort((x,y)=>x[0]-y[0]);
 for(let i=1;i<bands.length;i++)assert.ok(bands[i][0]-bands[i-1][1]>.01);
 const geometry=[];
 const result=emitOpenings({end:'front',openings:lights,surface,put:(part,material,mesh)=>geometry.push({part,material,mesh})});
 const prim=emitOpenings({end:'front',openings:lights.filter(x=>!x.opt.secondaryLamp),surface,put:()=>{}});
 assert.deepEqual(result.mounts,prim.mounts);
 assert.deepEqual(Object.keys(result.mounts).sort(),['HeadlightMount_L','HeadlightMount_R']);
 assert.equal(result.issues.length,0);
 assert.equal(geometry.filter(x=>x.material==='opticCover').length,4);
});
