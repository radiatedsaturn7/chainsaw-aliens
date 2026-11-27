import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,createVehicle,updateDesign,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {featureControls,proposeFeatureEdit,dragFeature} from '../../src/ui/vehicleStudio/features.mjs';
const build=(g,fn,q='preview')=>{const m=generateVehicle(g,{quality:q});try{return fn(m)}finally{disposeDesign(m)}};
const pos=(d,k)=>d.parts.filter(p=>p.component===k).map(p=>Array.from(p.geometry.attributes.position.array));
const f=(d,id)=>d.features.find(x=>x.id===id);
test('bumper/fender backing tracks a wider seam; joining commands repair tangent and flushness on the genome',()=>{
 let before=createFasciaDemo('rally');const k='frontFenderSeam';
 for(const [p,v] of Object.entries({gap:.009,flush:.004,tangent:.02,align:.18,curvature:.04}))
  before=updateDesign(before,'seams',k,v,p);
 build(before,a=>{
  const seam=f(a,k+'-R');
  const controls=featureControls(before,seam,'advanced');
  assert.ok(controls.some(c=>c.property==='gap')&&controls.some(c=>c.domain==='fascia'&&c.property==='wrap'));
  assert.ok(featureControls(before,seam,'expert').length>controls.length);
  const blend=proposeFeatureEdit(before,seam,'blend',1),gap=proposeFeatureEdit(blend.genome,seam,'gap',1);
  assert.equal(before.seams[k].flush,.004);assert.equal(gap.genome.seams[k].gap,.0025);
  assert.equal(blend.genome.seams[k].curvature,1);assert.equal(blend.genome.seams[k].tangent,1);
  build(gap.genome,b=>{
   const next=f(b,k+'-R');
   assert.ok(next.metrics.positionMm<seam.metrics.positionMm);
   assert.ok(next.metrics.tangentDeg<seam.metrics.tangentDeg);
   assert.ok(next.metrics.gapMm<seam.metrics.gapMm);
   assert.ok(next.metrics.gapMaxMm<8);
   assert.ok(b.parts.some(p=>p.component==='frontFenders'&&p.material==='trim'));
   assert.deepEqual(b.wheels,a.wheels);
  });
 });
});
test('dragging seams, headlight perimeter, roof rail and crease changes owned fields and connected parts',()=>{
 const start=createVehicle();
 build(start,a=>{
  const edit=(id,amount)=>dragFeature(start,f(a,id),amount);
  const moved=edit('frontFenderSeam-R',.015);
  assert.equal(moved.seams.frontFenderSeam.offset,.015);
  build(moved,b=>assert.notDeepEqual(f(a,'frontFenderSeam-R').points,f(b,'frontFenderSeam-R').points));
  const lamp=edit('front-lamp-R',.026);
  assert.ok(lamp.optics.front.width>start.optics.front.width);
  build(lamp,b=>{
   assert.notDeepEqual(a.fascia.front.openings,b.fascia.front.openings);
   assert.equal(b.fascia.front.trimArea.unmatched,0);
   assert.deepEqual(a.fascia.rear.openings,b.fascia.rear.openings);
  });
  build(edit('roof-R',-.023),b=>{
   for(const part of ['roof','glass','pillars'])assert.notDeepEqual(pos(a,part),pos(b,part));
   assert.deepEqual(a.wheels,b.wheels);
  });
  build(edit('door-crease-R',-.044),b=>{
   assert.notDeepEqual(f(a,'door-crease-R').points,f(b,'door-crease-R').points);
   assert.notDeepEqual(pos(a,'doors'),pos(b,'doors'));
  });
 });
});
test('LOD uses thinner tessellation without changing wheel or light mounts, and v2 fascia migrates',()=>{
 const k=createFasciaDemo('hyper'),v2={...k,generatorVersion:2};delete v2.seams;delete v2.body;
 const g=loadVehicle(JSON.stringify(v2));
 assert.equal(g.generatorVersion,3);assert.deepEqual(g.fascia,k.fascia);
 assert.deepEqual(loadVehicle(serializeVehicle(g)),g);
 build(g,hi=>build(g,low=>{
  assert.deepEqual(hi.diagnostics.issues,[]);assert.deepEqual(low.diagnostics.issues,[]);
  assert.ok(low.diagnostics.bodyTriangles<hi.diagnostics.bodyTriangles*.87);
  assert.deepEqual(low.wheels,hi.wheels);assert.deepEqual(low.lampMounts,hi.lampMounts);
 },'lod'),'export');
});
