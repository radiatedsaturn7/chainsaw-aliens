import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {createEndSurface} from '../../src/ui/vehicleStudio/fascia.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const make=(f,end)=>createEndSurface({
 settings:f,end,tip:end==='rear'?-2.15:2.15,seam:end==='rear'?-1.68:1.68,
 archEnd:1.64,cabin:end==='rear'?-1.37:1.37,floor:.145,
 deckAt:(z,u)=>[(2*u-1)*.83,.84+.032*Math.sin(u*Math.PI),z],
 sideAt:(z,v,s)=>[s*(.857-.025*v),.85-.70*v,z],bumper:{shape:.5,size:1,depth:1,type:'sport'}
});
test('rear lamp shoulder rolls in both axes, co-locates with the quarter terminal and leaves hood and deck rails alone',()=>{
 const f=createFasciaDemo('rally').fascia.rear,a=make(f,'rear'),b=make({...f,lampShoulderRoll:.04},'rear');
 for(const v of [0,.18,.4,.55,.8,1]){
  assert.deepEqual(a.face(.5,v),b.face(.5,v));
  assert.deepEqual(b.bumperSide(1,v,1),b.face(1,v));
  assert.deepEqual(b.bumperSide(1,v,-1),b.face(0,v));
 }
 for(const u of [0,.1,.5,.9,1]){
  assert.deepEqual(a.face(u,0),b.face(u,0));assert.deepEqual(a.face(u,1),b.face(u,1));
  assert.deepEqual(make(f,'front').face(u,.32),make({...f,lampShoulderRoll:.04},'front').face(u,.32));
 }
 for(const u of [.06,.94]){
  assert.ok(Math.abs(b.face(u,.32)[0])<Math.abs(a.face(u,.32)[0])-.004);
  assert.ok(b.face(u,.32)[2]>a.face(u,.32)[2]+.008);
 }
});
test('editable upright taillights share mirrored sealed apertures and survive deterministic budgeted export',()=>{
 const old=createFasciaDemo('rally'),g=structuredClone(old);
 Object.assign(g.fascia.rear,{lampShoulderRoll:.04,deckPanel:.32,deckSurfaceBlend:.91,bumperFaceBlend:.82,plateOpeningStretch:.27});
 Object.assign(g.optics.rear,{housing:'upright-wrap',position:.255,outboard:.775,sideWrap:.66,tallHousing:.25,layout:'factory-split',silverUpper:1,rearCells:1});
 for(const quality of ['drive','export']){
  const d=generateVehicle(g,{quality});try{
   assert.equal(d.fascia.rear.trimArea.unmatched,0);assert.deepEqual(d.diagnostics.issues,[]);
   const [l,r]=d.fascia.rear.openings.filter(o=>o.component==='tails');
   assert.ok(l.outline.every(([u,v],i)=>Math.abs(u+r.outline[i][0]-1)<1e-9&&Math.abs(v-r.outline[i][1])<1e-9));
  }finally{disposeDesign(d);}
 }
 const a=exportVehicle(g),b=exportVehicle(loadVehicle(serializeVehicle(g)));
 assert.deepEqual(a,b);assert.ok(a.metrics.carTriangles<=15000);
});
