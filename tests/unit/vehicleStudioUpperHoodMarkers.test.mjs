import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
test('native hood corner marker surfaces are opt-in and preserve main beam locations',()=>{
 const start=createFasciaDemo('compound');
 assert.equal(start.body.upperHoodMarkers,0);
 const baseline=generateVehicle(start,{quality:'drive'});
 const custom=loadVehicle(serializeVehicle({...start,body:{...start.body,upperHoodMarkers:.33}}));
 const changed=generateVehicle(custom,{quality:'drive'});
 try{
  const count=(g,material)=>g.parts.filter(x=>x.component==='headlights'&&x.material===material).length;
  assert.equal(count(changed,'signalL'),count(baseline,'signalL')+1);
  assert.equal(count(changed,'signalR'),count(baseline,'signalR')+1);
  assert.deepEqual(changed.lampMounts,baseline.lampMounts);
  assert.equal(custom.body.upperHoodMarkers,.33);
 }finally {disposeDesign(baseline);disposeDesign(changed);}
});
