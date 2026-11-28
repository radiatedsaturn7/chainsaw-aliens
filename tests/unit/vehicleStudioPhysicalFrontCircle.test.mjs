import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('single front metric circle is opt-in, reconciles body cutouts, and exports deterministically',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/volvo-pv544-sports.json',import.meta.url),'utf8'));
 const other=structuredClone(g);other.optics.front.frontPhysicalCircle=0;
 const a=generateVehicle(g,{quality:'export'}),b=generateVehicle(other,{quality:'export'});
 const spans=d=>d.features.filter(f=>f.type==='lamp'&&f.end==='front').map(f=>[0,1].map(i=>
  Math.max(...f.points.map(p=>p[i]))-Math.min(...f.points.map(p=>p[i]))));
 try{
  const physical=spans(a),legacy=spans(b);
  assert.equal(physical.length,2); assert.equal(legacy.length,2);
  assert.equal(a.fascia.front.trimArea.unmatched,0);
  for(let i=0;i<2;i++){
   const [x,y]=physical[i];assert.ok(x>.15&&y>.15);
   assert.ok(Math.abs(x-y)<.0001);
   assert.ok(x>legacy[i][0]+.015);
  }
 }finally{disposeDesign(a);disposeDesign(b);}
 const result=exportVehicle(g,{quality:'drive'});
 assert.ok(result.metrics.carTriangles<=15000);
 assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),result);
});
