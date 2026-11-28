import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {disposeDesign,generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';

test('period fender mirrors move both housings ahead of the cabin without moving stock lamp or tire anchors',()=>{
 for(const id of ['nissan-laurel-gx-kpc30-1970','nissan-cedric-k430-brougham-1982']){
  const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
  assert.ok(g.construction.hood.fenderMirrorReach>0);
  const on=generateVehicle(g,{quality:'drive',compact:3});
  g.construction.hood.fenderMirrorReach=0;
  const off=generateVehicle(g,{quality:'drive',compact:3});
  try{
   const mirrors=v=>v.parts.filter(p=>p.component==='mirrors'&&p.material==='chrome').map(p=>{
    p.geometry.computeBoundingBox();
    return p.geometry.boundingBox;
   });
   const forward=mirrors(on),door=mirrors(off);
   assert.ok(forward.some(a=>a.min.x>0)&&forward.some(a=>a.max.x<0));
   assert.ok(forward.every(a=>a.min.z>on.stations.cabinFront+.10));
   assert.ok(door.every(a=>a.max.z<off.stations.cabinFront));
   assert.deepEqual(on.wheels,off.wheels);
   assert.deepEqual(on.lampMounts,off.lampMounts);
  }finally{disposeDesign(on);disposeDesign(off);}
 }
});
