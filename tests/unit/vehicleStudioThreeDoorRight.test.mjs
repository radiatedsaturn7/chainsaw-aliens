import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {disposeDesign,generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('right three-door body uses the positive-X passenger seam and high pull only',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/hyundai-veloster-base-2012.json',import.meta.url),'utf8'));
 const view=generateVehicle(g,{quality:'drive',compact:3});
 try{
  const seams=view.features.filter(x=>x.id.startsWith('centerDoorSeam'));
  assert.deepEqual(seams.map(x=>x.id),['centerDoorSeam-R']);
  assert.ok(seams[0].points.every(p=>p[0]>0));
  const grips=view.parts.filter(p=>p.geometry.userData.constructionRole==='right rear hidden door pull');
  assert.equal(grips.length,1);
  assert.ok(grips[0].geometry.attributes.position.getX(0)>0);
  assert.ok(grips[0].geometry.attributes.normal.getX(0)>0);
  assert.equal(view.parts.filter(p=>p.component==='handles'&&p.material==='paint').length,2);
 }finally{disposeDesign(view);}
 const p=exportVehicle(g,{quality:'drive'});
 const restored=loadVehicle(serializeVehicle(g));
 assert.equal(restored.components.doors.type,'three door right');
 assert.deepEqual(exportVehicle(restored,{quality:'drive'}),p);
 assert.ok(p.metrics.carTriangles<=15000);
});
