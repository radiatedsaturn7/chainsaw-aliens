import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const widths=(parts,k)=>Math.max(...parts.filter(p=>p.component===k).map(p=>{
 p.geometry.computeBoundingBox();const b=p.geometry.boundingBox;return b.max.x-b.min.x;
}));
const pick=(a,k)=>a.parts.find(p=>p.component===k).geometry.getAttribute('position').array;
test('formed shoulders and independent scoop dimensions preserve shared hood edges and attachment points',()=>{
 const old=createFasciaDemo('rally');
 const g=updateDesign(old,'construction','hood',{...old.construction.hood,shoulderRise:.034,shoulderAt:.70,shoulderSweep:.12,scoopWidth:.615,scoopHeight:.105,scoopCorner:.77});
 assert.deepEqual(g,loadVehicle(serializeVehicle(g)));
 const a=generateVehicle(old,{quality:'drive'}),b=generateVehicle(g,{quality:'drive'});
 try {
  assert.deepEqual(b.diagnostics.issues,[]);
  assert.deepEqual(a.metadata,b.metadata);
  assert.ok(widths(b.parts,'scoop')>widths(a.parts,'scoop')+.04);
  const A=pick(a,'hood'),B=pick(b,'hood'),stride=(22+1)*3;
  assert.equal(A.length,B.length);assert.notDeepEqual(A,B);
  assert.deepEqual(A.slice(0,stride),B.slice(0,stride));
  assert.deepEqual(A.slice(-stride),B.slice(-stride));
  const exp=exportVehicle(g,{quality:'drive'});
  assert.deepEqual(exp,exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}));
 }finally{disposeDesign(a);disposeDesign(b);}
});
test('older design records preserve neutral hood controls, invalid dimensions are rejected',()=>{
 const old=createFasciaDemo('rally');delete old.construction.hood;
 const current=loadVehicle(JSON.stringify(old));assert.equal(current.construction.hood.scoopWidth,0);assert.equal(current.construction.hood.shoulderRise,0);
 assert.throws(()=>updateDesign(current,'construction','hood',{...current.construction.hood,scoopWidth:.92}),/Out of range/);
});
