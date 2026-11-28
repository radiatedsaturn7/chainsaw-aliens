import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {buildWheels} from '../../src/ui/vehicleStudio/wheels9.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const load=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
test('period sidewalls have configurable thickness, cannot change rolling radius, and face outboard',()=>{
 const radii=[];
 for(const id of ['chevrolet-corvette-c1-1953','chevrolet-corvette-c1-1960']){
  const g=load(id),parts=buildWheels(g,{quality:'drive',compact:1});
  try {
   const side=parts.find(p=>p.material==='whitewall').geometry,tire=parts.find(p=>p.material==='rubber').geometry;
   const radial=mesh=>{const {position:a}=mesh.attributes;return Array.from({length:a.count},(_,i)=>Math.hypot(a.getY(i),a.getZ(i)));};
   const rr=radial(side),radius=g.dimensions.diameter/2;
   assert(Math.abs(Math.max(...radial(tire))-radius)<1e-6);
   assert(Math.max(...rr)<radius-.015,'the bright band must not touch the tread');
   assert(side.attributes.normal.getX(0)>.98);
   assert(Math.abs(Math.max(...rr)-Math.min(...rr)-g.dimensions.whitewallWidth)<1e-6);
   radii.push(Math.max(...rr)-Math.min(...rr));
  }finally{parts.forEach(p=>p.geometry.dispose());}
  const exp=exportVehicle(g,{quality:'drive'});assert(exp.metrics.carTriangles<=15000);
  const [,wheel]=Object.values(exp.models);
  assert(wheel.materials.some(m=>m.id==='studio-mat-whitewall'&&m.automotive.roughness===.94));
 }
 assert(radii[0]>radii[1]);
});
test('absent whitewall leaves the legacy mesh/packed materials untouched',()=>{
 const g=load('chevrolet-corvette-c2-427-1967'),old=structuredClone(g);delete old.dimensions.whitewallWidth;delete old.materials.whitewall;
 const a=exportVehicle(g,{quality:'drive'}),b=exportVehicle(old,{quality:'drive'});
 assert.deepEqual(a.models,b.models);
 for(const m of Object.values(b.models))assert(!m.materials.some(x=>x.name.includes('white sidewall')));
});
