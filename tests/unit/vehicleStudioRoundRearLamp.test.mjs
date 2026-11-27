import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const load=()=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/tamo-racemo.json',import.meta.url),'utf8'));
test('round rear lamp remains circular in physical XY, not just in the fascia chart',()=>{
 const g=load(),d=generateVehicle(g,{quality:'drive',compact:1});
 try{
  const lamps=d.features.filter(f=>f.type==='lamp'&&f.end==='rear');
  assert.equal(lamps.length,2);assert.equal(d.fascia.rear.trimArea.unmatched,0);
  assert(d.fascia.rear.openings.some(o=>o.id==='raised-exhaust-center-tip'));
  for(const l of lamps){
   const span=i=>Math.max(...l.points.map(p=>p[i]))-Math.min(...l.points.map(p=>p[i]));
   assert(span(0)>.11&&span(1)>.11);
   assert(Math.abs(span(0)-span(1))<.006);
  }
  for(const key of ['runningRed','opticRed','opticClear','opticCover','signalR','signalL'])
   assert(d.parts.some(p=>p.component==='tails'&&p.material===key),'missing '+key);
  assert.deepEqual(d.diagnostics.issues,[]);assert.deepEqual(d.diagnostics.warnings,[]);
 }finally{disposeDesign(d);}
 const exp=exportVehicle(g,{quality:'drive'});
 assert(exp.metrics.carTriangles<=15000);
 assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),exp);
});
