import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle,GAMEPLAY_TRIANGLE_BUDGET} from '../../src/ui/vehicleStudio/export.mjs';
import {normalizeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';

const read=(id)=>JSON.parse(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url)));
const shape=(g)=>generateVehicle(g,{quality:'drive'});
test('split-hatch geometry preserves mounted optics and all four hubs',()=>{
 const input=read('citroen-c4'),flat=structuredClone(input);
 for(const k of ['hatchBridge','hatchQuarterTaper','hatchLampFill'])flat.construction.cabin[k]=0;
 const a=shape(input),b=shape(flat);
 try{
  assert.equal(a.parts.some(p=>p.component==='spoiler'&&p.material==='trim'),true);
  assert.equal(b.parts.some(p=>p.component==='spoiler'),false);
  assert.deepEqual(a.wheels,b.wheels);
  assert.deepEqual(a.lampMounts,b.lampMounts);
  assert.deepEqual(a.diagnostics.issues,[]);
  assert.deepEqual(b.diagnostics.issues,[]);
 }finally{disposeDesign(a);disposeDesign(b);}
 const x=exportVehicle(input),y=exportVehicle(flat);
 assert.deepEqual(x.attachments,y.attachments);
 assert.deepEqual(x.car.tuning,y.car.tuning);
 assert.equal(x.metrics.carTriangles,x.metrics.bodyTriangles+4*x.metrics.wheelTriangles);
 assert.ok(x.metrics.carTriangles<=GAMEPLAY_TRIANGLE_BUDGET);
});
test('optional hatch construction defaults off and round-trips',()=>{
 const other=normalizeVehicle(read('tamo-racemo')),c4=normalizeVehicle(read('citroen-c4'));
 for(const k of ['hatchBridge','hatchQuarterTaper','hatchLampFill'])assert.equal(other.construction.cabin[k],0);
 assert.deepEqual(normalizeVehicle(JSON.parse(JSON.stringify(c4))),c4);
});
