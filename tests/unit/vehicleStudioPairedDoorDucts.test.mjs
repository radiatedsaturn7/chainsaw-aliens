import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVehicle,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {sideDuctMask} from '../../src/ui/vehicleStudio/sideDuct.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';

test('paired duct layout is opt-in and keeps a solid center between the two openings',()=>{
 const d=createVehicle();
 assert.equal(d.body.pairedSideDucts,0);
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/honda-s660.json',import.meta.url),'utf8'));
 assert.equal(loadVehicle(serializeVehicle(g)).body.pairedSideDucts,1);
 assert.ok(sideDuctMask(g.body,.805,.398)>.8);
 assert.ok(sideDuctMask(g.body,.12,.793)>.8);
 for(const [u,v] of [[.5,.4],[.48,.85],[.90,.82],[.2,.25],[0,.81],[1,.5]])assert.equal(sideDuctMask(g.body,u,v),0);
});
test('paired duct and painted reference use a common shell and untouched lamp and wheel mounts',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/honda-s660.json',import.meta.url),'utf8'));
 const enabled=generateVehicle(g,{quality:'drive',compact:1}),disabled=generateVehicle(updateDesign(g,'body','sideDuct',0),{quality:'drive',compact:1});
 try{
  assert.deepEqual(enabled.diagnostics.issues,[]);
  assert.deepEqual(enabled.wheels,disabled.wheels);
  assert.deepEqual(enabled.lampMounts,disabled.lampMounts);
  assert.equal(enabled.parts.filter(p=>p.component==='doors'&&p.material==='side-duct').length,2);
  assert.equal(disabled.parts.some(p=>p.material==='side-duct'),false);
 }finally{disposeDesign(enabled);disposeDesign(disabled);}
});
