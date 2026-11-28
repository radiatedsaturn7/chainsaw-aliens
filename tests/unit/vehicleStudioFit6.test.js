import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
import {featureControls,proposeFeatureEdit,dragFeature} from '../../src/ui/vehicleStudio/features.mjs';
test('top edge setback, quarter roll and taller lamp share the existing safe trim and gameplay budget',()=>{
 const a=createFasciaDemo('rally'),g=structuredClone(a);
 Object.assign(g.fascia.rear,{upperEndSweep:.077,quarterWaist:.044,quarterBlend:.33,deckPanel:.65,plateMount:.87});
 Object.assign(g.optics.rear,{sideWrap:.77,tallHousing:.23,layout:'factory-split',silverUpper:1});
 const before=generateVehicle(a,{quality:'drive'}),after=generateVehicle(g,{quality:'drive'});
 try{
  assert.ok(after.fascia.rear.samples[4][2]>before.fascia.rear.samples[4][2]+.035);
  assert.equal(after.fascia.rear.trimArea.unmatched,0);
  assert.equal(after.fascia.front.trimArea.unmatched,0);
  assert.deepEqual(before.wheels,after.wheels);
  assert.deepEqual(after.diagnostics.issues,[]);
  const x=exportVehicle(g),y=exportVehicle(loadVehicle(serializeVehicle(g)));assert.deepEqual(x,y);assert.ok(x.metrics.carTriangles<=15000);
 }finally{disposeDesign(before);disposeDesign(after);}
});
test('the stamped door line controls, drag and wizard operate on the same visible ridge',()=>{
 const old=createFasciaDemo('rally'),g=structuredClone(old);
 Object.assign(g.body,{doorStamp:.021,doorStampWidth:.052,doorStampFront:.16,doorStampRear:.08,doorStampFade:.205});
 const d=generateVehicle(g,{quality:'drive'});
 try{
  const f=d.features.find(f=>f.id==='door-crease-R');
  const keys=featureControls(g,f,'advanced').map(k=>k.key);
  assert.ok(keys.includes('doorStampFade')&&keys.includes('doorStampHeight'));
  const next=dragFeature(g,f,.019);
  assert.notEqual(next.body.doorStampHeight,g.body.doorStampHeight);assert.equal(next.body.creaseHeight,g.body.creaseHeight);
  const blend=proposeFeatureEdit(g,f,'blend',1).genome;
  assert.ok(blend.body.doorStampFade>g.body.doorStampFade&&blend.body.doorStamp<g.body.doorStamp);
  assert.equal(blend.body.creaseStrength,g.body.creaseStrength);
  assert.ok(featureControls(old,f).some(k=>k.key==='creaseHeight'));
 }finally{disposeDesign(d);}
});
