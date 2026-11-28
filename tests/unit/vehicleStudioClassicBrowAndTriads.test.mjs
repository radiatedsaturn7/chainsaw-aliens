import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const load=name=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+name+'.json',import.meta.url),'utf8'));
const build=v=>generateVehicle(v,{quality:'drive',compact:2});
const count=(a,component,material)=>a.parts.filter(p=>p.component===component&&p.material===material).reduce((sum,p)=>sum+p.geometry.index.count/3,0);
const assertCap=g=>{
 const [body,wheel]=Object.values(exportVehicle(g,{quality:'drive'}).models);
 assert.ok(body.faces.length+2*(wheel.faces.length+(wheel.rearAxleModel?.faces.length??wheel.faces.length))<=15000);
};

test('mirrored fitted headlight brows add paint without moving primary mounts',()=>{
 const g=load('lamborghini-jarama-gts-eu-1972'),old=structuredClone(g);old.optics.front.headlampBrow=0;
 assert.equal(createVehicle().optics.front.headlampBrow,0);
 const a=build(g),b=build(old);
 assert.deepEqual(a.lampMounts,b.lampMounts);
 assert.deepEqual(a.diagnostics.issues,[]);
 assert.ok(count(a,'headlights','paint')>count(b,'headlights','paint'));
 assert.equal(count(a,'headlights','head'),count(b,'headlights','head'));
 assertCap(g);
});
test('optional chevron taillights retain three segments and independent running/brake, direction and reverse roles',()=>{
 const g=load('lamborghini-reventon-eu-2008'),old=structuredClone(g);old.optics.rear.rearTriBars=1;
 assert.equal(createVehicle().optics.rear.rearTriBars,0);
 const a=build(g),b=build(old);
 assert.deepEqual(a.lampMounts,b.lampMounts);
 assert.deepEqual(a.diagnostics.issues,[]);
 assert.ok(count(a,'tails','runningRed')>0);
 assert.equal(count(a,'tails','runningRed')*4,count(b,'tails','runningRed')*3);
 for(const m of ['opticRed','signalL','signalR','opticClear'])assert.ok(count(a,'tails',m)>0);
 assertCap(g);
});
