import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
function check(d){
 for(const {trimArea,openings} of Object.values(d.fascia)){
  assert.equal(trimArea.unmatched,0);
  assert.ok(Math.abs(trimArea.mesh-trimArea.expected)<1e-6);
  assert.ok(openings.flatMap(o=>o.outline).flat().every(x=>x>0&&x<1));
 }
}
test('lamp cutoffs straddle the front and side charts on both halves of the car',()=>{
 const g=createFasciaDemo('rally');
 for(const end of ['front','rear']){
  Object.assign(g.optics[end],{sideWrap:1,layout:'factory-split',outboard:.86,width:.94});
 }
 const d=generateVehicle(g,{quality:'drive'});
 try{
  check(d);for(const f of Object.values(d.fascia)){
   assert.equal(f.wrapped,true);
   for(const side of [-1,1]){
    const l=f.openings.find(o=>/^(head|tail)-/.test(o.id)&&Math.sign(o.outline[0][0]-.5)===side);
    assert.ok(l.outline.some(([x])=>side>0?x>.875:x<.125));
    assert.ok(l.outline.some(([x])=>side>0?x<.875:x>.125));
   }
  }
 }finally{disposeDesign(d);}
});
test('deck insert stays closed with multiple optics and valance clears without changing wheel hardware',()=>{
 for(const profile of ['classic','rally','hyper','compound']){
  let g=createFasciaDemo(profile);
  Object.assign(g.fascia.rear,{valanceRise:.11,valanceWidth:.73,deckPanel:.77,deckWidth:1,deckHeight:1});
  Object.assign(g.optics.rear,{sideWrap:.92,outboard:.96,inboardReach:.9,width:.96,angle:-.85});
  const d=generateVehicle(g,{quality:'drive'});
  try{
   check(d);assert.ok(d.fascia.rear.openings.some(o=>o.id==='rear-deck-insert'));
   assert.ok(d.parts.some(o=>o.component==='trunk'&&o.material==='seamDark'));
   assert.ok(d.parts.some(o=>o.component==='rearBumper'&&o.material==='underbody'));
  }finally{disposeDesign(d);}
 }
 let g=createFasciaDemo('rally');
 g=updateDesign(g,'optics','rear',.8,'sideWrap');
 g=updateDesign(g,'fascia','rear',.88,'deckPanel');
 assert.deepEqual(exportVehicle(g,{quality:'drive'}),exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}));
});
test('folded rectangular mirrors keep separate glass, shell and support materials',()=>{
 let g=createFasciaDemo('rally');
 g=updateDesign(g,'components','mirrors','folded rectangle','type');
 const d=generateVehicle(g,{quality:'drive'});
 try {
  const pieces=d.parts.filter(p=>p.component==='mirrors');
  assert.deepEqual(new Set(pieces.map(p=>p.material)),new Set(['paint','chrome','trim']));
  assert.equal(pieces.filter(p=>p.material==='chrome').length,2);
  for(const p of pieces)assert.ok(p.geometry.attributes.position.array.every(Number.isFinite));
 }finally{disposeDesign(d);}
});
