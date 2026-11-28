import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const load=()=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/chevrolet-corvette-c6.json',import.meta.url),'utf8'));
test('dual round rear lights leave painted land between separately mounted optical cavities',()=>{
 const g=load(),d=generateVehicle(g,{quality:'drive',compact:1});
 try{
  const lamps=d.features.filter(f=>f.type==='lamp'&&f.end==='rear');
  assert.equal(lamps.length,4);assert.equal(new Set(lamps.map(l=>l.id)).size,4);
  assert.equal(d.fascia.rear.trimArea.unmatched,0);
  const bounds=lamps.map(l=>[Math.min(...l.points.map(p=>p[0])),Math.max(...l.points.map(p=>p[0]))]).sort((a,b)=>a[0]-b[0]);
  assert(bounds.every((p,i)=>!i||p[0]-bounds[i-1][1]>.012));
  for(const l of lamps){
   const span=i=>Math.max(...l.points.map(p=>p[i]))-Math.min(...l.points.map(p=>p[i]));
   assert(span(0)>.075&&span(1)>.075,'Undersized round lamp');
   assert(Math.abs(span(0)-span(1))<.013,'Projected lamp should remain round');
  }
  for(const key of ['runningRed','opticRed','opticClear','opticCover','signalR','signalL'])
   assert(d.parts.some(p=>p.component==='tails'&&p.material===key),'Missing '+key);
  assert.deepEqual(d.diagnostics.issues,[]);
 }finally{disposeDesign(d);}
 const exp=exportVehicle(g,{quality:'drive'});
 assert(exp.metrics.carTriangles<=15000);
 const [body]=Object.values(exp.models);
 assert.equal(body.joints.filter(j=>j.name.startsWith('TaillightMount_')).length,2,'Canonical paired gameplay mounts should remain stable');
 assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),exp);
});
