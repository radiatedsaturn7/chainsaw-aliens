import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {disposeDesign,generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';
const study=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
const fit=g=>generateVehicle(g,{quality:'drive',compact:3});
test('Juke hood pockets survive save/load and replace raised markers without moving wheel attachments',()=>{
 const g=study('nissan-juke-nismo-rs-2015'),d=fit(g);
 g.body.hoodMarkerRecess=0;
 const control=fit(g);
 try{
  assert.equal(d.genome.body.hoodMarkerRecess,.014);
  assert.equal(d.genome.fascia.front.grilleShape,'winged');
  assert.deepEqual(d.wheels,control.wheels);
  assert.deepEqual(d.diagnostics.issues,[]);
  const h=d.parts.find(p=>p.component==='hood'&&p.material==='paint');
  assert.ok(h.geometry.userData.trimArea.expected>0,'expected two trimmed hood holes');
  assert.equal(h.geometry.userData.trimArea.unmatched,0);
  assert.ok(!control.parts.some(p=>p.component==='hood'&&p.geometry.userData.trimArea?.expected>0));
  for(const s of ['L','R'])assert.ok(d.parts.some(p=>p.component==='headlights'&&p.material==='signal'+s));
 }finally{disposeDesign(d);disposeDesign(control);}
});
test('Grand Caravan extends the roof to the rear and moves active tail signals to the towers only',()=>{
 const g=study('dodge-grand-caravan-se-2005'),d=fit(g);
 g.construction.cabin.functionalTailTowers=0;
 g.construction.cabin.rearHatchRoofSetback=0;
 const control=fit(g);
 try{
  assert.ok(d.stations.roofRear<control.stations.roofRear);
  assert.deepEqual(d.wheels,control.wheels);
  assert.deepEqual(d.diagnostics.issues,[]);
  for(const [s,sign] of [['L',-1],['R',1]]){
   const p=d.parts.find(p=>p.component==='tails'&&p.material==='rearSignal'+s);
   assert.ok(p);p.geometry.computeBoundingBox();
   assert.ok(sign*(p.geometry.boundingBox.max.x+p.geometry.boundingBox.min.x)>0);
   assert.ok(d.parts.some(p=>p.component==='headlights'&&p.material==='signal'+s));
   assert.ok(!control.parts.some(p=>p.material==='rearSignal'+s));
  }
 }finally{disposeDesign(d);disposeDesign(control);}
});
