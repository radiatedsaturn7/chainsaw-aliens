import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const honda=()=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/honda-s660.json',import.meta.url),'utf8'));
test('recessed rear valance and running bridge cut the rear surface without a competing plate opening',()=>{
 const g=honda(),old=updateDesign(updateDesign(g,'fascia','rear',0,'rearTrayDepth'),'fascia','rear',0,'tailBridge');
 const a=generateVehicle(old,{quality:'drive',compact:1}),b=generateVehicle(g,{quality:'drive',compact:1});
 try{
  assert.deepEqual(b.diagnostics.issues,[]);
  const names=x=>x.fascia.rear.openings.map(o=>o.id);
  assert(names(a).includes('rear-plate-recess'));
  assert(!names(b).includes('rear-plate-recess'));
  assert(names(b).includes('rear-recessed-valance'));
  assert(names(b).includes('rear-running-bridge'));
  assert.equal(b.fascia.rear.trimArea.unmatched,0);
  const boundary=b.features.find(f=>f.id==='rear-recessed-valance');
  const rearward=Math.min(...boundary.points.map(p=>p[2]));
  const trim=b.parts.find(p=>p.component==='rearBumper'&&p.material==='trim');
  assert(trim.geometry.boundingBox.max.z>rearward+.028,'valance must extend inward from visible rim');
  assert.deepEqual(a.wheels,b.wheels);
  assert.deepEqual(a.lampMounts,b.lampMounts);
  assert.deepEqual(a.fascia.front,b.fascia.front);
 }finally{disposeDesign(a);disposeDesign(b);}
 const first=exportVehicle(g,{quality:'drive'});
 assert.ok(first.metrics.carTriangles<=15000);
 const copy=exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'});
 assert.deepEqual(copy,first);
});
