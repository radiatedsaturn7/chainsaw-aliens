import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=slug=>JSON.parse(fs.readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+slug+'.json',import.meta.url)));
const budget=o=>assert(o.metrics.carTriangles>0&&o.metrics.carTriangles<=15000);
test('Rally Fighter suspensions change visible body geometry without altering collider, tire anchors, or tuning',async()=>{
 const {generateVehicle,disposeDesign}=await import('../../src/ui/vehicleStudio/geometry.mjs');
 const {exportVehicle}=await import('../../src/ui/vehicleStudio/export.mjs');
 const g=source('rally-fighter'),off=structuredClone(g);off.construction.cabin.rallyTubework=0;
 const a=generateVehicle(g),b=generateVehicle(off);
 try{
  assert.deepEqual(a.diagnostics.issues,[]);assert.deepEqual(a.wheels,b.wheels);
  assert(a.parts.filter(p=>p.component==='suspension').length>20);assert(!b.parts.some(p=>p.component==='suspension'));
  const A=exportVehicle(g),B=exportVehicle(off);
  assert.deepEqual(A.car.car.tuning,B.car.car.tuning);assert.deepEqual(A.attachments,B.attachments);budget(A);
 }finally{disposeDesign(a);disposeDesign(b);}
});
test('Forester shared upright hatch keeps enough deck, near-vertical rear glass, and editable roof rails',async()=>{
 const {generateVehicle,disposeDesign}=await import('../../src/ui/vehicleStudio/geometry.mjs');
 const {exportVehicle}=await import('../../src/ui/vehicleStudio/export.mjs');
 const g=source('subaru-forester'),off=structuredClone(g);off.construction.cabin.rearHatchUpright=0;off.construction.cabin.utilityRoofRails=0;
 const a=generateVehicle(g),b=generateVehicle(off);
 try{
  assert.deepEqual(a.diagnostics.issues,[]);
  const {roofRear,cabinRear,bumperRear}=a.stations;
  assert(roofRear-cabinRear<.1);assert(cabinRear-bumperRear>=.025-1e-8);
  assert(b.stations.roofRear-roofRear>.30);assert(a.parts.some(p=>p.component==='roof'&&p.material==='trim'));
  assert(a.parts.filter(p=>p.component==='trunk').length>b.parts.filter(p=>p.component==='trunk').length);
  budget(exportVehicle(g));
 }finally{disposeDesign(a);disposeDesign(b);}
});
