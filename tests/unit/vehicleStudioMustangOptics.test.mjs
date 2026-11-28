import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const ids=['ford-mustang-gt-1965','ford-mustang-boss-302-1969','ford-mustang-gt-deluxe-2005'];
const load=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
test('Mustang lamp variations retain six roles, no unmatched apertures, and all wheels remain below the cap',()=>{
 for(const id of ids){
  const g=load(id),d=generateVehicle(g,{quality:'drive',compact:2});
  try{
   assert.equal(d.fascia.front.trimArea.unmatched,0);
   assert.equal(d.fascia.rear.trimArea.unmatched,0);
   assert(d.parts.some(p=>p.component==='grille'&&p.material==='head'),'recessed lamps must fit '+id);
   for(const mat of ['opticClear','signalL','signalR','opticRed','runningRed'])assert(d.parts.some(p=>p.component==='tails'&&p.material===mat),id+' missing '+mat);
   assert.deepEqual(d.diagnostics.issues,[]);
  }finally{disposeDesign(d);}
  const exp=exportVehicle(g,{quality:'drive'});
  assert(exp.metrics.carTriangles<=15000);
  assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),exp);
 }
});
test('omitted rear bars and grille lamps keep default meshes unchanged',()=>{
 const g=load(ids[0]),off=structuredClone(g),old=structuredClone(g);
 off.fascia.front.grilleLampPair=0;off.optics.rear.rearTriBars=0;
 delete old.fascia.front.grilleLampPair;delete old.optics.rear.rearTriBars;
 assert.deepEqual(exportVehicle(off,{quality:'drive'}).models,exportVehicle(old,{quality:'drive'}).models);
});
