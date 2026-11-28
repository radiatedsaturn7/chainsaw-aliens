import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';

test('metal roof insert is an independent painted skin with a seal, preserving existing glazed modes', async()=>{
 const g=loadVehicle(await readFile(new URL('../../src/ui/vehicleStudio/examples/honda-crx-si-ed9-us.json',import.meta.url),'utf8'));
 const generate=mode=>{const h=structuredClone(g);h.construction.cabin.roofGlazing=mode;return generateVehicle(h,{quality:'drive',compact:1});};
 const [plain,glass,metal]=[0,1,3].map(generate);
 const role=(d,id)=>d.parts.filter(p=>p.component==='roof'&&p.geometry.userData.constructionRole===id);
 assert.equal(createVehicle().construction.cabin.roofGlazing,0);
 assert.equal(role(plain,'roof seal').length,0);
 assert.equal(role(glass,'roof glazing').length,1);
 assert.equal(role(metal,'roof glazing').length,0);
 const [insert]=role(metal,'metal sunroof insert');assert.equal(insert.material,'paint');
 assert.deepEqual(insert.geometry.attributes.position.array,role(glass,'roof glazing')[0].geometry.attributes.position.array);
 assert.ok(role(metal,'roof seal').length>=4);
 assert.equal(metal.diagnostics.issues.length,0);
});
