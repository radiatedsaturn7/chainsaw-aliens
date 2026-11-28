import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
import {loadVehicle,createVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {buildFit12} from '../../tools/vehicle-validation/build-wrx-fit12.mjs';
const g=loadVehicle(fs.readFileSync(new URL('../../tools/vehicle-validation/wrx-fit12-genome.json',import.meta.url),'utf8'));
test('WRX corner bypasses fit between the fog blank and bumper perimeter; have actual dark material backing',()=>{
 const all=makeOpenings({end:'front',g}), vents=all.filter(o=>o.kind==='bypass');
 const bounds=o=>[0,1].map(k=>[Math.min(...o.outline.map(x=>x[k])),Math.max(...o.outline.map(x=>x[k]))]);
 assert.equal(vents.length,2);
 for(const v of vents){
  const f=all.find(o=>o.kind==='blank'&&(o.center[0]-.5)*(v.center[0]-.5)>0);
  assert(bounds(v)[1][0]>bounds(f)[1][1]);
  assert(bounds(v)[1][1]<.985);
  assert(v.outline.length<=8);
 }
 const duct=all.find(o=>o.id==='lower-duct');assert(duct.opt.upperBar>0);
 assert(!makeOpenings({end:'front',g:createVehicle()}).some(o=>o.kind==='bypass'));
 const {body,wheel}=buildFit12();
 assert(body.faces.some(x=>x.component==='frontBumper'&&x.material==='studio-mat-seamDark'));
 assert(body.faces.length+4*wheel.faces.length<=15000);
 assert.deepEqual(body.joints.find(j=>j.name==='HeadlightMount_R').position,[-0.5898652633888343,0.5234587853050632,2.0889925668069136]);
});
