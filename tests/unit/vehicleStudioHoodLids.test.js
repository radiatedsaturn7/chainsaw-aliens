import assert from 'node:assert/strict';
import test from 'node:test';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const edit=(g,settings)=>updateDesign(g,'construction','hood',{...g.construction.hood,...settings});
const covers=(d,key)=>d.parts.filter(p=>p.component==='hood'&&p.geometry.userData.constructionRole==='headlamp covers / '+key);
test('flush covers cut real mirrored hood apertures and meet their recessed backing without changing lamps or wheels',()=>{
 const g=createFasciaDemo('rally');
 const a=generateVehicle(g,{quality:'drive',compact:1});
 const b=generateVehicle(edit(g,{lampLids:'flush',lidWidth:.32,lidLength:.39,lidSpread:.36,lidSetback:.31,lidGap:.008}),{quality:'drive',compact:1});
 try{
  assert.deepEqual(b.diagnostics.issues,[]);
  const halo=covers(b,'recessed shutline'),lids=covers(b,'painted lid');
  assert.equal(halo.length,2);assert.equal(lids.length,2);
  const attr=p=>p.geometry.attributes.position;
  assert.equal(covers(a,'painted lid').length,0);
  const [one,two]=lids.map(attr);
  for(let i=0;i<one.count;i++){
   assert.ok(Array.from({length:two.count},(_,j)=>j).some(j=>Math.abs(one.getX(i)+two.getX(j))<1e-5
    && Math.abs(one.getY(i)-two.getY(j))<1e-5&&Math.abs(one.getZ(i)-two.getZ(j))<1e-5),'cover sample mirrored across the centerline');
   assert.ok(one.getX(i)<0&&two.getX(i)>0);
  }
  for(let side=0;side<2;side++){
   const surround=attr(halo[side]),lid=attr(lids[side]);
   for(let i=0;i<8;i++){
    assert.equal(surround.getX(i+16),lid.getX(i));
    assert.equal(surround.getY(i+16),lid.getY(i));
    assert.equal(surround.getZ(i+16),lid.getZ(i));
    assert.ok(Number.isFinite(lid.getY(i)));
   }
  }
  assert.deepEqual(b.wheels,a.wheels);
  assert.deepEqual(b.lampMounts,a.lampMounts);
  assert.deepEqual(b.diagnostics.seams,a.diagnostics.seams);
 }finally {disposeDesign(a);disposeDesign(b);}
});
test('flush covers preserve old off by default designs and survive deterministic capped export',()=>{
 const g=createFasciaDemo('compound');
 for(const key of ['lampLids','lidWidth','lidLength','lidSpread','lidSetback','lidGap'])delete g.construction.hood[key];
 const a=exportVehicle(g);
 assert.equal(a.genome.construction.hood.lampLids,'off');
 assert.deepEqual(a,exportVehicle(edit(g,{lampLids:'off'})));
 const enabled=edit(g,{lampLids:'flush'});
 const b=exportVehicle(enabled);
 assert.equal(b.genome.construction.hood.lampLids,'flush');
 assert.deepEqual(b,exportVehicle(loadVehicle(serializeVehicle(enabled))));
 assert.deepEqual(b.attachments,a.attachments);
 assert.deepEqual(b.car,a.car);
 assert.ok(b.metrics.carTriangles<=15000);
 assert.throws(()=>edit(g,{lampLids:'animated'}),/Hood light covers/);
 assert.throws(()=>edit(g,{lidGap:.015}),/lidGap/);
});
