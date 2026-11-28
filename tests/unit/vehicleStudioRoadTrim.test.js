import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const materials=(d,k)=>new Set(d.parts.filter(p=>p.component===k).map(p=>p.material));
test('factory split lights share both mirrored housing rims, retain optical material zones and export deterministically',()=>{
 let g=createFasciaDemo('rally');
 for(const end of ['front','rear'])g=updateDesign(g,'optics',end,'factory-split','layout');
 g=updateDesign(g,'fascia','rear',.95,'plateHeight');
 const d=generateVehicle(g,{quality:'drive'});
 try{
  assert.deepEqual(d.diagnostics.issues,[]);
  for(const k of ['front','rear'])assert.equal(d.fascia[k].trimArea.unmatched,0);
  assert.ok(materials(d,'headlights').has('signalL'));
  assert.ok(materials(d,'headlights').has('signalR'));
  for(const m of ['opticCover','opticRed','opticClear','runningRed'])assert.ok(materials(d,'tails').has(m),m);
  assert.deepEqual(exportVehicle(g,{quality:'drive'}),exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}));
 }finally{disposeDesign(d);}
});
test('painted lever and painted outer frame keep trim separate and cabin controls do not shift wheel metadata',()=>{
 let g=createFasciaDemo('rally');
 const old=generateVehicle(g,{quality:'drive'});
 g=updateDesign(g,'components','pillars','painted frame','type');
 g=updateDesign(g,'components','handles','painted lever','type');
 g=updateDesign(g,'construction','cabin',{...g.construction.cabin,rearGlassArc:.075});
 const d=generateVehicle(g,{quality:'drive'});
 try{
  assert.deepEqual(materials(d,'handles'),new Set(['seamDark','paint']));
  for(const m of ['seamDark','paint','trim'])assert.ok(materials(d,'pillars').has(m),m);
  assert.deepEqual(d.metadata,old.metadata);assert.deepEqual(d.diagnostics.issues,[]);
 }finally{disposeDesign(old);disposeDesign(d);}
});
