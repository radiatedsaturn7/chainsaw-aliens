import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const arc=(d,k)=>d.features.find(f=>f.id===k+'-arch-R').points;
const peak=(d,k)=>Math.max(...arc(d,k).map(p=>p[1]));
test('front and rear arch crown adjustments hug tires without moving their mount coordinates',()=>{
 const base=createFasciaDemo('rally');let g=updateDesign(base,'body','frontArchUpper',.023);
 g=updateDesign(g,'body','rearArchUpper',.028);
 g=updateDesign(g,'body','frontArchFore',.031);
 g=updateDesign(g,'body','rearArchFore',.035);
 const a=generateVehicle(base,{quality:'drive'}),b=generateVehicle(g,{quality:'drive'});
 try{
  assert.deepEqual(a.wheels,b.wheels);
  assert.deepEqual(a.metadata,b.metadata);
  assert.ok(peak(a,'frontFenders')-peak(b,'frontFenders')>.019);
  assert.ok(peak(a,'rearFenders')-peak(b,'rearFenders')>.014);
  for(const key of ['frontFenders','rearFenders']){
   const end=arc(b,key),before=arc(a,key);
   assert.ok(Math.abs(end[0][2]-end.at(-1)[2])<Math.abs(before[0][2]-before.at(-1)[2]));
  }
  assert.equal(b.diagnostics.issues.length,0);
 }finally{disposeDesign(a);disposeDesign(b);}
});
test('swept rear glass, boxed wing and recessed plate preserve trim closure',()=>{
 const base=createFasciaDemo('rally');
 const g=updateDesign(base,'components','spoiler','boxed wing','type');
 Object.assign(g.construction.cabin,{rearPillarFoot:.23,rearRoofShift:.031,rearPillarWidth:.04});
 Object.assign(g.fascia.rear,{terminalTuck:.07,plateMount:.85,platePosition:.66,plateHeight:.98,plateWidth:.94,deckPanel:.70});
 const a=generateVehicle(base,{quality:'drive'}),b=generateVehicle(g,{quality:'drive'});
 try{
  assert.ok(a.stations.cabinRear-b.stations.cabinRear>.16);
  assert.equal(b.aero.wing.boxed,true);assert.equal(b.aero.wing.supports,2);
  const pocket=b.fascia.rear.openings.find(x=>x.id==='rear-plate-recess');
  assert.ok(Math.max(...pocket.outline.map(x=>x[1]))>.75);
  assert.ok(b.parts.some(p=>p.component==='rearBumper'&&p.material==='chrome'));
  assert.equal(b.fascia.rear.trimArea.unmatched,0);
  assert.deepEqual(b.diagnostics.issues,[]);
  assert.deepEqual(exportVehicle(g,{quality:'drive'}),exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}));
 }finally{disposeDesign(a);disposeDesign(b);}
});
