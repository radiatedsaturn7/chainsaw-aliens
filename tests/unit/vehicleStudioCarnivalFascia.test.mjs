import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {materialDoc,GAMEPLAY_TRIANGLE_BUDGET} from '../../src/ui/vehicleStudio/export.mjs';
import {buildStudioRoster} from '../../tools/vehicle-validation/build-studio-roster.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const genome=()=>loadVehicle(read('../../src/ui/vehicleStudio/examples/kia-carnival.json'));
const legacy=g=>{const baseline=structuredClone(g);Object.assign(baseline.construction.cabin,{frontScreenRake:0,sideGlassRise:0,darkWindscreenFrame:0});baseline.fascia.front.insertStep=0;return baseline;};

test('Canopy and stepped fascia controls round-trip and change the visible chart without touching the cabin package',()=>{
 const g=genome();
 const loaded=loadVehicle(serializeVehicle(g));
 assert.deepEqual(loaded.construction.cabin,g.construction.cabin);
 assert.equal(loaded.fascia.front.insertStep,g.fascia.front.insertStep);
 const before=legacy(g),T=generateVehicle(g),B=generateVehicle(before);
 try{
  assert.deepEqual(T.diagnostics.issues,[]);
  assert.deepEqual(T.diagnostics.warnings,[]);
  assert(Math.abs(T.stations.roofFront-B.stations.roofFront+g.construction.cabin.frontScreenRake)<1e-7);
  assert.equal(T.stations.cabinFront,B.stations.cabinFront,'lower glass join stays at the same hardpoint');
  assert.equal(T.stations.roofRear,B.stations.roofRear,'rear hatch is not dragged with the windshield');
  const left=d=>d.features.find(f=>f.id==='glass-base-L').points;
  assert(left(T).some(([x,y,z],i)=>y-left(B)[i][1]>.018));
  assert(Math.abs(left(T).at(0)[1]-left(B).at(0)[1])<1e-9);
  assert(Math.abs(left(T).at(-1)[1]-left(B).at(-1)[1])<1e-9);
  assert.deepEqual(T.cabin.rows.map(r=>r.count),[2,2,3]);
  assert.equal(T.cabin.capacity,7);
  assert.equal(T.fascia.front.openings.filter(o=>o.component==='headlights').length,2);
  assert.equal(T.fascia.front.openings.filter(o=>o.component==='grille').length,1);
  for(const o of T.fascia.front.openings.filter(o=>o.component==='headlights')){
   const extent=axis=>Math.max(...o.outline.map(p=>p[axis]))-Math.min(...o.outline.map(p=>p[axis]));
   assert(extent(1)<extent(0)*.68,'headlight chart remains slim rather than circular');
  }
 } finally {disposeDesign(T);disposeDesign(B);}
 const old=materialDoc(before,'fascia-front').texture,p=materialDoc(g,'fascia-front').texture;
 const pixel=(t,x,y)=>t.pixels[Math.floor(x*t.width)+t.width*Math.floor((1-y)*t.height)];
 assert.equal(pixel(p,.5,.49),g.materials.trim);
 assert.equal(pixel(old,.5,.49),g.materials.paint);
 assert.equal(pixel(p,.87,.49),g.materials.paint,'the outer insert stays raised');
});

test('Caravan-9 production export keeps all four stock wheel hardpoints and the gameplay triangle budget',()=>{
 const row=JSON.parse(read('../../tools/vehicle-validation/studio-roster-hardpoints.json')).find(r=>r.id==='kia-carnival');
 const {pair,metrics}=buildStudioRoster(row);
 assert.equal(metrics.triangles,pair.body.faces.length+4*pair.wheel.faces.length);
 assert(metrics.triangles<=GAMEPLAY_TRIANGLE_BUDGET);
 for(const [i,axle] of ['F','R'].entries())for(const side of ['L','R']){
  const {z,y,track}=row.axles[i],j=pair.body.joints.find(k=>k.name===`WheelMount_${axle}${side}`);
  assert.deepEqual(j.position,[(side==='L'?-1:1)*track/2,y,z]);
 }
});
