import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const load=()=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/tamo-racemo.json',import.meta.url),'utf8'));
test('a raised pair shares a true rear aperture, and slider zero restores its floor mount',()=>{
 const g=load(),collapsed=structuredClone(g);collapsed.construction.exhaust[0].fasciaHeight=0;
 const a=generateVehicle(g,{quality:'drive',compact:1}),b=generateVehicle(collapsed,{quality:'drive',compact:1});
 try{
  assert.deepEqual(a.diagnostics.issues,[]);assert.deepEqual(a.diagnostics.warnings,[]);
  const pocket=a.fascia.rear.openings.find(o=>o.id==='raised-exhaust-center-tip');
  assert.equal(a.fascia.rear.trimArea.unmatched,0);
  assert.equal(pocket.component,'exhaust');
  assert(!b.fascia.rear.openings.some(o=>o.component==='exhaust'));
  assert.equal(a.aero.outlets.length,2);
  for(const [i,o] of a.aero.outlets.entries()){
   assert.ok(o.center[1]>b.aero.outlets[i].center[1]+.060);
   assert.equal(o.center[0],b.aero.outlets[i].center[0]);
  }
  assert.deepEqual(a.wheels,b.wheels);assert.deepEqual(a.lampMounts,b.lampMounts);
  assert.ok(a.parts.some(p=>p.component==='exhaust'&&p.material==='heatShield'));
 }finally{disposeDesign(a);disposeDesign(b);}
 const x=exportVehicle(g,{quality:'drive'});
 assert(x.metrics.carTriangles<=15000);
 assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),x);
});
test('crowded placement keeps the floor exhaust instead of cutting through a rear lamp',()=>{
 const g=load();g.construction.exhaust[0].x=.64;g.construction.exhaust[0].fasciaHeight=1;
 const d=generateVehicle(g,{quality:'drive',compact:1});
 try {
  assert(!d.fascia.rear.openings.some(o=>o.id==='raised-exhaust-center-tip'));
  assert(d.diagnostics.warnings.some(s=>s.includes('floor mount retained')));
  assert.equal(d.aero.outlets.length,2);
  assert.deepEqual(d.diagnostics.issues,[]);
 }finally{disposeDesign(d);}
});
