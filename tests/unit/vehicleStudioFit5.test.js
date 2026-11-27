import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
import {automotiveEnvironment,automotiveMaterial} from '../../src/model3d/AutomotiveMaterials.js';
test('paint finish numbers survive project export and the gloss booth is a separate HDR environment',()=>{
 const d=createFasciaDemo('rally'),g=updateDesign(d,'construction','finish',{paintRoughness:.285,coatRoughness:.077});
 const [m]=Object.values(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}).models);
 const t=m.materials.find(r=>r.id==='studio-mat-paint').automotive;
 assert.equal(t.roughness,.285);assert.equal(t.paintClearcoatRoughness,.077);
 const mat=automotiveMaterial({color:'#124b9a'},t);
 try{ assert.equal(mat.roughness,.285);assert.equal(mat.clearcoatRoughness,.077);assert.equal(mat.metalness,0); }
 finally{mat.dispose();}
 const p=automotiveEnvironment('studio-strips'),old=automotiveEnvironment('studio');
 assert.notEqual(p,old);assert.notDeepEqual(p.image.data,old.image.data);assert.equal(p,automotiveEnvironment('studio-strips'));
});
test('slim arch, door line and tucked rear do not move wheels; silvery upper lens has a separate reverse function',()=>{
 const base=createFasciaDemo('rally'),g=structuredClone(base);
 Object.assign(g.body,{frontFlareScale:.38,rearFlareScale:.34,lipScale:.5,doorStamp:.0175,doorStampHeight:.49});
 Object.assign(g.fascia.rear,{plateMount:.86,paintedPocket:1,cornerTuck:.057});
 Object.assign(g.optics.rear,{layout:'factory-split',silverUpper:1});
 const a=generateVehicle(base,{quality:'drive'}),b=generateVehicle(g,{quality:'drive'});
 try{
  assert.deepEqual(a.wheels,b.wheels);
  const names=new Set(b.parts.filter(v=>v.component==='tails').map(x=>x.material));
  for(const k of ['opticSilver','opticRed','opticClear'])assert.ok(names.has(k));
  assert.ok(!b.parts.some(p=>p.component==='rearBumper'&&p.material==='floor'));
  assert.ok(b.parts.some(p=>p.component==='rearBumper'&&p.material==='chrome'));
  assert.equal(b.fascia.front.trimArea.unmatched,0);assert.equal(b.fascia.rear.trimArea.unmatched,0);
  for(const k of ['doors','frontFenders','rearFenders','rearBumper']){
   const read=t=>t.parts.find(p=>p.component===k&&p.material==='paint').geometry.attributes.position.array;
   assert.notDeepEqual(read(a),read(b));
  }
 }finally{disposeDesign(a);disposeDesign(b);}
});
