import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const read=()=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/tamo-racemo.json',import.meta.url),'utf8'));
test('swept bridge cuts and fills a real 3D panel while preserving lamp, exhaust and wheel mounts',()=>{
 const g=read(),old=structuredClone(g);old.fascia.rear.rearSculptDepth=0;
 const a=generateVehicle(g,{quality:'drive',compact:1}),b=generateVehicle(old,{quality:'drive',compact:1});
 try {
  assert.deepEqual(a.diagnostics.issues,[]);assert.deepEqual(a.diagnostics.warnings,[]);
  assert.equal(a.fascia.rear.trimArea.unmatched,0);
  assert(a.fascia.rear.trimArea.holes>b.fascia.rear.trimArea.holes);
  const inset=a.fascia.rear.openings.find(o=>o.id==='swept-rear-bridge');
  const outline=inset.outline;assert(outline.length>=24);
  assert(Math.abs(outline[0][1]-outline[7][1])>.10,'bridge sweeps up toward the housings');
  const trim=a.parts.filter(p=>p.component==='rearBumper'&&p.material==='heatShield');
  assert(trim.length&&trim.some(p=>p.geometry.boundingBox.max.z-p.geometry.boundingBox.min.z>.05));
  assert.deepEqual(a.lampMounts,b.lampMounts);assert.deepEqual(a.aero.outlets,b.aero.outlets);assert.deepEqual(a.wheels,b.wheels);
 }finally{disposeDesign(a);disposeDesign(b);}
 const x=exportVehicle(g,{quality:'drive'});
 assert(x.metrics.carTriangles<=15000);
 assert.deepEqual(x,exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}));
});
