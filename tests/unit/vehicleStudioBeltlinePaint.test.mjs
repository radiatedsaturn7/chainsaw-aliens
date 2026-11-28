import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('unbranded beltline stripe and contrasting scoop do not recolor the body or move hardware',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/amc-rebel-machine-1970.json',import.meta.url),'utf8'));
 assert.ok(g.body.waistStripe>0);
 assert.equal(g.construction.hood.scoopMatchBonnet,1);
 const [body]=Object.values(exportVehicle(g,{quality:'drive'}).models);
 const texture=body.materials.find(m=>m.id==='studio-mat-lower-clad').texture;
 assert.ok(texture.pixels.includes(g.materials.stripePaint));
 assert.ok(texture.pixels.includes(g.materials.paint));
 assert.notEqual(g.materials.stripePaint,g.materials.roofPaint);
 const active=generateVehicle(g,{quality:'drive',compact:3});
 g.body.waistStripe=0;
 g.construction.hood.scoopMatchBonnet=0;
 const inactive=generateVehicle(g,{quality:'drive',compact:3});
 try{
  assert.ok(active.parts.some(p=>p.component==='scoop'&&p.material==='roofPaint'));
  assert.ok(inactive.parts.some(p=>p.component==='scoop'&&p.material==='paint'));
  assert.deepEqual(active.wheels,inactive.wheels);
  assert.deepEqual(active.lampMounts,inactive.lampMounts);
 }finally{disposeDesign(active);disposeDesign(inactive);}
});
