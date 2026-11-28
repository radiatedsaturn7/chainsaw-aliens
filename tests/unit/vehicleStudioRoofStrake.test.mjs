import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
test('two roof strakes are flush partitions of the roof and do not leak into glazing modes',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/aston-martin-db11-v12-uk-2017.json',import.meta.url),'utf8'));
 assert.equal(createVehicle().construction.cabin.roofStrake,0);
 const built=v=>generateVehicle(v,{quality:'drive',compact:2});
 const role=(v,tag)=>v.parts.filter(p=>p.geometry.userData.constructionRole===tag);
 const out=built(g),strakes=role(out,'contrast roof strake'),skin=role(out,'roof center skin');
 assert.equal(strakes.length,2);
 assert.equal(skin.length,1);
 assert.equal(skin[0].material,'paint');
 assert.ok(strakes.every(p=>p.material==='roofPaint'));
 const points=g=>{const out=new Set,a=g.attributes.position;for(let i=0;i<a.count;i++)out.add([a.getX(i),a.getY(i),a.getZ(i)].map(x=>x.toFixed(6)).join(','));return out;};
 const c=points(skin[0].geometry);
 for(const p of strakes){const s=points(p.geometry);assert.equal([...s].filter(k=>c.has(k)).length,s.size/2);}
 const glazed=structuredClone(g);glazed.construction.cabin.roofGlazing=1;
 assert.equal(role(built(glazed),'contrast roof strake').length,0);
 assert.deepEqual(out.diagnostics.issues,[]);
 const [body,wheel]=Object.values(exportVehicle(g,{quality:'drive'}).models);
 assert.ok(body.faces.length+2*(wheel.faces.length+(wheel.rearAxleModel?.faces.length??wheel.faces.length))<=15000);
});
