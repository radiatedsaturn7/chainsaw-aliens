import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const load=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
const band=p=>p.material==='chrome'&&p.geometry.userData.constructionRole==='formed chrome bumper / separate component';
test('formed chrome bands are independent, follow body and remain opt-in',()=>{
 for(const id of ['chevrolet-camaro-ss350','chevrolet-chevelle-ss454']){
  const g=load(id),d=generateVehicle(g,{quality:'drive',compact:1});
  try{
   const bands=d.parts.filter(band);
   assert.deepEqual(bands.map(p=>p.component),['frontBumper','rearBumper']);
   for(const p of bands){
    const a=p.geometry.attributes.position,ys=[];
    for(let i=0;i<a.count;i++)ys.push(a.getY(i));
    assert(Math.max(...ys)-Math.min(...ys)>.025);
    assert(p.geometry.index.count/3<=200);
   }
   assert.deepEqual(d.diagnostics.issues,[]);
  }finally{disposeDesign(d);}
  const stock=structuredClone(g);
  for(const f of Object.values(stock.fascia)){delete f.chromeBumperBand;delete f.chromeBandHeight;delete f.chromeBandPosition;}
  const b=generateVehicle(stock,{quality:'drive',compact:1});
  try{assert.equal(b.parts.filter(band).length,0);}finally{disposeDesign(b);}
  assert(exportVehicle(g,{quality:'drive'}).metrics.carTriangles<=15000);
 }
});
test('parked covers retain functional lower headlights without altering default placement',()=>{
 const g=load('pontiac-firebird-ws6'),d=generateVehicle(g,{quality:'drive',compact:1});
 try{
  const heads=d.fascia.front.openings.filter(o=>o.component==='headlights');
  assert.equal(heads.length,2);assert(heads.every(o=>o.outline.every(p=>p[1]>.67)));
  assert.equal(d.parts.filter(p=>p.geometry.userData.constructionRole==='headlamp covers / painted lid').length,2);
  assert(d.parts.some(p=>p.component==='headlights'&&p.material==='projector'));
  assert.deepEqual(d.diagnostics.issues,[]);
 }finally{disposeDesign(d);}
 const defaultFit=structuredClone(g);
 delete defaultFit.construction.hood.parkedPopups;
 const b=generateVehicle(defaultFit,{quality:'drive',compact:1});
 try{
  assert(b.fascia.front.openings.filter(o=>o.component==='headlights').every(o=>o.outline.every(p=>p[1]<.60)));
 }finally{disposeDesign(b);}
 const exp=exportVehicle(g,{quality:'drive'}),[body]=Object.values(exp.models);
 assert.equal(body.joints.filter(j=>j.name.startsWith('HeadlightMount_')).length,2);
 assert(exp.metrics.carTriangles<=15000);
 assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),exp);
});
