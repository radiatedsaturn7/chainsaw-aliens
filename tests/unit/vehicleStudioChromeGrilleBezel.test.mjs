import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const load=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
test('chrome grille bezel is an optional separate metal flange and preserves stock legacy lip',()=>{
 const g=load('mercury-grand-marquis-gs-2001'),blank=structuredClone(g),omitted=structuredClone(g);
 blank.fascia.front.grilleBezel=0;delete omitted.fascia.front.grilleBezel;
 const a=generateVehicle(g,{quality:'drive',compact:1}),b=generateVehicle(blank,{quality:'drive',compact:1});
 try{
  const triangles=d=>d.parts.filter(p=>p.component==='grille'&&p.material==='chrome').reduce((n,p)=>n+p.geometry.index.count/3,0);
  assert(triangles(a)>triangles(b));
  assert.deepEqual(a.fascia.front.openings,b.fascia.front.openings,'adding a finish must not alter trim/aperture positions');
  assert.deepEqual(a.diagnostics.issues,[]);
 }finally{disposeDesign(a);disposeDesign(b);}
 assert.deepEqual(exportVehicle(omitted,{quality:'drive'}),exportVehicle(blank,{quality:'drive'}),'legacy default equivalent to empty bezel');
});
test('long-body Panther trims round-trip at native length under drive budget',()=>{
 for(const id of ['mercury-marauder-2004','mercury-grand-marquis-gs-2001']){
  const g=load(id),round=loadVehicle(serializeVehicle(g)),d=round.dimensions;
  assert(d.wheelbase+d.front+d.rear>5.38);
  assert(d.front>1.32&&d.front<1.40);
  assert(exportVehicle(round,{quality:'drive'}).metrics.carTriangles<=15000);
 }
});
