import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
import {makeOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
import {buildRearSpare} from '../../src/ui/vehicleStudio/utility9.mjs';

const design=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
test('period pair geometry and asymmetric unbranded stripes are separate authoring controls',()=>{
 const g=design('renault-r8-gordini-1967');
 const face=(x,y)=>[x,-y,1];
 const rounds=()=>makeOpenings({end:'front',g,face}).filter(o=>o.kind==='lamp');
 const stripe=()=>Object.values(exportVehicle(g,{quality:'drive'}).models)[0].materials.find(m=>m.id==='studio-mat-bonnet-stripes').texture;
 const configured=rounds();
 const offCenter=stripe();
 assert.equal(configured.length,4);
 assert.notEqual(g.construction.hood.stripeOffset,0);
 const center=({width,height,pixels})=>{
  const rows=pixels.flatMap((p,i)=>p===g.materials.roofPaint?[(Math.floor(i/width)+.5)/height]:[]);
  assert.ok(rows.length>0);
  return rows.reduce((a,b)=>a+b,0)/rows.length;
 };
 g.construction.hood.stripeOffset=0;
 assert.ok(Math.abs(center(stripe())-.5)<1e-7);
 assert.ok(Math.abs(center(offCenter)-.5)>.06);
 assert.deepEqual(configured,rounds());
 g.optics.front.periodRoundSpread=0;
 const legacy=rounds();
 assert.equal(legacy.length,4);
 assert.notDeepEqual(legacy.map(o=>o.center),configured.map(o=>o.center));
});

test('spare cover styles preserve a separate carrier or produce one closed hatch blister',()=>{
 function parts(style){
  const result=[];
  buildRearSpare({put:(component,material,geometry)=>{
   geometry.computeBoundingBox();
   result.push({component,material,role:geometry.userData.constructionRole,min:geometry.boundingBox.min.z,max:geometry.boundingBox.max.z});
   geometry.dispose();
  },dims:{Lr:-2.02},compact:true,tireWidth:.2,finish:'chrome',cfg:{rearSpareRadius:.32,rearSpareHeight:.9,rearSpareOffset:0,rearSpareCover:style}});
  return result;
 }
 assert.deepEqual(parts(0).map(p=>p.material),['rubber','chrome','trim']);
 assert.deepEqual(parts(1).map(p=>p.material),['rubber','paint','trim']);
 const [hatch]=parts(2);
 assert.equal(parts(2).length,1);
 assert.equal(hatch.material,'paint');
 assert.equal(hatch.role,'hatch / closed molded spare cover');
 assert.ok(hatch.min<-2.02&&hatch.max>-2.02);
});
