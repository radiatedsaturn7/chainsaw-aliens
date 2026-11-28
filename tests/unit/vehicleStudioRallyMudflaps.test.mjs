import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';
test('rally mudflaps follow the four visual wheel centers without changing wheels',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/mitsubishi-evo-vi-monte-carlo-1999.json',import.meta.url),'utf8'));
 const make=x=>{const v=structuredClone(g);v.construction.cabin.rallyMudflaps=x;return generateVehicle(v,{quality:'drive',compact:2});};
 const off=make(0),on=make(.191);
 const flaps=v=>v.parts.filter(p=>p.geometry.userData.constructionRole==='rally mudflap');
 assert.equal(createVehicle().construction.cabin.rallyMudflaps,0);
 assert.equal(flaps(off).length,0);
 assert.equal(flaps(on).length,4);
 assert.deepEqual(on.wheels,off.wheels);
 assert.equal(on.diagnostics.issues.length,0);
 for(const p of flaps(on)){
  assert.equal(p.material,'rubber');
  p.geometry.computeBoundingBox();
  assert.ok(p.geometry.boundingBox.max.y-p.geometry.boundingBox.min.y>.18);
 }
});
