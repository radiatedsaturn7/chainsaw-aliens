import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';
test('gullwing glass replaces only the two partitioned roof leaves',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/toyota-sera-exy10-base.json',import.meta.url),'utf8'));
 assert.equal(createVehicle().construction.cabin.gullwingRoofGlass,0);
 const role=(d,s)=>d.parts.filter(x=>x.component==='roof'&&x.geometry.userData.constructionRole===s);
 const type=flag=>{const t=structuredClone(g);t.construction.cabin.gullwingRoofGlass=flag;return generateVehicle(t,{quality:'drive',compact:1});};
 const a=type(0),b=type(1);
 const skin='gullwing / closed roof section',seal='gullwing / recessed roof seal';
 assert.deepEqual(role(a,skin).map(x=>x.material),['paint','paint','paint']);
 assert.deepEqual(role(b,skin).map(x=>x.material),['glass','paint','glass']);
 assert.deepEqual(role(a,seal).map(x=>x.material),['seamDark','seamDark']);
 assert.deepEqual(role(b,seal).map(x=>x.material),['seamDark','seamDark']);
 assert.deepEqual(role(a,skin).map(x=>x.geometry.attributes.position.array),role(b,skin).map(x=>x.geometry.attributes.position.array));
 assert.equal(b.diagnostics.issues.length,0);
});
