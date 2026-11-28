import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('compact pickup cargo well is an editable depth, with a real floor, rails and walls',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/datsun-520.json',import.meta.url),'utf8'));
 assert.equal(loadVehicle(serializeVehicle(g)).body.pickupBedDepth,g.body.pickupBedDepth);
 const flat=updateDesign(g,'body','pickupBedDepth',0);
 const a=generateVehicle(g,{quality:'drive',compact:1}),b=generateVehicle(flat,{quality:'drive',compact:1});
 try{
  assert.deepEqual(a.diagnostics.issues,[]);
  assert.deepEqual(a.wheels,b.wheels);
  assert.deepEqual(a.lampMounts,b.lampMounts);
  const sections=d=>d.parts.filter(p=>p.geometry.userData.section==='pickup-bed');
  const bed=sections(a);
  assert.equal(sections(b).length,0);
  assert.equal(bed.length,13);
  const y=(parts)=>parts.flatMap(p=>Array.from(p.geometry.attributes.position.array).filter((v,i)=>i%3===1));
  const visibleDeck=b.parts.filter(p=>p.component==='trunk'&&p.material==='paint');
  assert.ok(Math.min(...y(visibleDeck))-Math.min(...y(bed))>.16,'the well is recessed below the old deck');
  assert.ok(bed.every(p=>p.geometry.index.count>=6));
 }finally{disposeDesign(a);disposeDesign(b);}
 const out=exportVehicle(g,{quality:'drive'});
 assert.ok(out.metrics.carTriangles<=15000);
});
