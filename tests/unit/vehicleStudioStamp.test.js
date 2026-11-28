import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
test('stamped belt and reflector bowls preserve mount hardware and export separate optical maps',()=>{
 const old=createFasciaDemo('rally');
 let g=updateDesign(old,'optics','front','factory-split','layout');
 g=updateDesign(g,'optics','front',.85,'roundBowls');
 g=updateDesign(g,'optics','front',.70,'flutedBowls');
 g=updateDesign(g,'fascia','front',.016,'bumperBeltRise');
 const d=generateVehicle(g,{quality:'drive'}),was=generateVehicle(old,{quality:'drive'});
 try {
  assert.deepEqual(d.metadata,was.metadata);assert.deepEqual(d.wheels,was.wheels);
  for(const v of Object.values(d.fascia))assert.equal(v.trimArea.unmatched,0);
  assert.ok(d.parts.some(o=>o.component==='headlights'&&o.material==='reflectorFluted'));
  assert.notDeepEqual(d.parts.find(p=>p.component==='frontBumper').geometry.attributes.position.array,was.parts.find(p=>p.component==='frontBumper').geometry.attributes.position.array);
  const e=exportVehicle(g,{quality:'drive'}),[body]=Object.values(e.models);
  const r=body.materials.find(m=>m.id==='studio-mat-reflectorFluted');
  assert.equal(r.automotive.normal.width,32);assert.equal(r.automotive.orm.width,32);
  assert.deepEqual(e,exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}));
 }finally{disposeDesign(d);disposeDesign(was);}
});
