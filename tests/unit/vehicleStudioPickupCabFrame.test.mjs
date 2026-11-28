import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const id='nissan-frontier-xe-2010';
const load=()=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
test('painted pickup cab, seals and glass all use their own pieces of the cab chart',()=>{
 const g=load(),d=generateVehicle(g,{quality:'drive',compact:1});
 const pick=p=>p.geometry.userData.constructionRole?.startsWith('pickup cab frame / ');
 try{
  const panes=d.parts.filter(pick);
  assert.equal(panes.filter(p=>p.material==='glass').length,6,'two side panes per side plus front and rear glass');
  for(const m of ['glass','paint','seamDark'])assert(panes.some(p=>p.material===m&&p.geometry.index.count>0));
  for(const p of panes){
   assert.equal(p.geometry.attributes.position.count,p.geometry.attributes.normal.count);
   assert(p.geometry.attributes.normal.array.every(Number.isFinite));
  }
  assert.deepEqual(d.diagnostics.issues,[]);
 }finally{disposeDesign(d);}
 const legacy=structuredClone(g);delete legacy.construction.cabin.pickupCabFrame;
 const a=generateVehicle(legacy,{quality:'drive',compact:1});
 try{assert.equal(a.parts.filter(pick).length,0);}finally{disposeDesign(a);}
 const built=exportVehicle(g,{quality:'drive'});assert(built.metrics.carTriangles<=15000);
 assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),built);
});
