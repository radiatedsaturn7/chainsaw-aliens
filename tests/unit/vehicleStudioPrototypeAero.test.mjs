import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';

test('dark composite wing, optional endplates and exhaust off do not affect default road geometry',()=>{
 const baseline=createFasciaDemo('compound'); baseline.components.spoiler.type='wing';
 const legacy=generateVehicle(baseline,{quality:'drive'});
 const edited=structuredClone(baseline);
 Object.assign(edited.construction.wing,{darkWing:1,endPlateHeight:.14});
 edited.components.exhaust.type='off';edited.construction.exhaust=[];
 const revived=loadVehicle(serializeVehicle(edited));
 const custom=generateVehicle(revived,{quality:'drive'});
 try{
  const spoilers=d=>d.parts.filter(p=>p.component==='spoiler');
  assert.ok(spoilers(legacy).length>0);
  assert.ok(spoilers(legacy).every(p=>p.material==='paint'));
  assert.equal(spoilers(custom).length,spoilers(legacy).length+2);
  assert.ok(spoilers(custom).every(p=>p.material==='trim'));
  assert.ok(legacy.parts.some(p=>p.component==='exhaust'));
  assert.ok(!custom.parts.some(p=>p.component==='exhaust'));
 } finally {disposeDesign(legacy);disposeDesign(custom);}
});
