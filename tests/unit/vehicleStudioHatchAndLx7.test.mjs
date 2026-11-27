import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const load=key=>loadVehicle(fs.readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+key+'.json',import.meta.url),'utf8'));
function gameplay(g){
 const e=exportVehicle(g,{quality:'drive'});
 assert(e.metrics.carTriangles<=15000);
 assert.equal(e.metrics.carTriangles,e.metrics.bodyTriangles+4*e.metrics.wheelTriangles);
 return e;
}
test('C4 split hatch with joined divider survives exact production export',()=>{
 const g=load('citroen-c4');
 assert.equal(loadVehicle(serializeVehicle(g)).construction.cabin.rearHatchFold,1);
 const d=generateVehicle(g);
 try{
  assert.deepEqual(d.diagnostics.issues,[]);
  const split=d.parts.filter(p=>p.geometry.userData.section?.includes('hatch-'));
  assert.equal(split.length,3);
  assert.deepEqual(split.map(p=>p.material),['glass','seamDark','glass']);
  for(const [left,right] of [[split[0],split[1]],[split[1],split[2]]]){
   const a=left.geometry.attributes.position,b=right.geometry.attributes.position;
   for(let i=0;i<17;i++)assert(Math.hypot(a.getX(a.count-17+i)-b.getX(i),a.getY(a.count-17+i)-b.getY(i),a.getZ(a.count-17+i)-b.getZ(i))<1e-6,'pane and divider physically join');
  }
 }finally{disposeDesign(d);}
 const e=gameplay(g);
 assert(Object.values(e.models)[0].faces.some(f=>f.component==='glass'&&f.material==='studio-mat-seamDark'));
});
test('Carnival LX7 has seven physical seating positions and three third-row headrests',()=>{
 const g=load('kia-carnival'),d=generateVehicle(g);
 try{
  assert.deepEqual(d.diagnostics.issues,[]);
  assert(d.stations.roofRear < -2.16,'upright hatch extends the roof rather than stretching the deck');
  assert(d.stations.cabinRear-d.stations.bumperRear>=.0249,'hatch sill clears rear bumper seam');
  assert.deepEqual(d.cabin.rows.map(row=>row.count),[2,2,3]);
  assert.equal(d.cabin.capacity,7);
  assert.equal(d.cabin.seats.find(p=>p.row===2).headrests,3);
 }finally{disposeDesign(d);}
 gameplay(g);
 assert.throws(()=>updateDesign(g,'construction','cabin',{...g.construction.cabin,rearBenchSeats:2.5}),/must be 2 or 3/);
});
