import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {loadVehicle,createVehicle,normalizeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';

test('rally auxiliary array is opt-in and separate from primary lamp mounts',async()=>{
 const g=loadVehicle(await readFile(new URL('../../src/ui/vehicleStudio/examples/lancia-stratos-group4.json',import.meta.url),'utf8'));
 assert.equal(createVehicle().fascia.front.rallyAuxiliary,0);
 assert.equal(normalizeVehicle(g).fascia.front.rallyAuxiliary,4);
 const withArray=generateVehicle(g,{quality:'drive',compact:1});
 const stock=structuredClone(g);stock.fascia.front.rallyAuxiliary=0;
 const withoutArray=generateVehicle(stock,{quality:'drive',compact:1});
 const aux=a=>a.parts.filter(x=>x.component==='fogs'&&x.material==='head');
 assert.equal(aux(withArray).length-aux(withoutArray).length,4);
 const [shell]=withArray.parts.filter(x=>x.component==='frontBumper');
 const [shellOff]=withoutArray.parts.filter(x=>x.component==='frontBumper');
 assert.deepEqual(shell.geometry.attributes.position.array,shellOff.geometry.attributes.position.array);
 assert.deepEqual(withArray.lampMounts,withoutArray.lampMounts);
 assert.deepEqual(withArray.diagnostics.issues,[]);
});
