import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {studioRoster} from '../../src/model3d/studio-roster/index.js';
import {modelWheelDocumentForAxle} from '../../src/model3d/ModelBinding.js';
import {loadVehicle,createVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const labels=[['honda-s660',.165,.195,15,16,.288],['tamo-racemo',.205,.235,17,18,.33435]];
const bounds=(wheel,role)=>{
 const ids=new Set(wheel.faces.filter(f=>f.material==='studio-mat-'+role).flatMap(f=>f.vertices));
 const points=wheel.vertices.filter(v=>ids.has(v.id)).map(v=>v.position);
 return {width:Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),
  radius:Math.max(...points.map(p=>Math.hypot(p[1],p[2])))};
};
for(const [id,frontW,rearW,frontRim,rearRim,radius] of labels)test(id+' uses real staggered rim/tire sizes and keeps the stock rolling radius',()=>{
 const {body,wheel}=JSON.parse(gunzipSync(readFileSync(studioRoster.find(r=>r.id===id).pack)));
 const rear=modelWheelDocumentForAxle(wheel,'rr');
 assert.equal(modelWheelDocumentForAxle(wheel,'rl'),rear);
 assert.equal(modelWheelDocumentForAxle(wheel,'fl'),wheel);
 assert.notEqual(rear,wheel);
 for(const [m,width,rimIn] of [[wheel,frontW,frontRim],[rear,rearW,rearRim]]){
  const rubber=bounds(m,'rubber'),alloy=bounds(m,'wheel');
  assert.ok(Math.abs(rubber.width-width)<.006,`tire width: ${rubber.width}`);
  assert.ok(Math.abs(rubber.radius-radius)<.002,`rolling radius: ${rubber.radius}`);
  assert.ok(Math.abs(alloy.radius-rimIn*.0254/2)<.003,`rim radius: ${alloy.radius}`);
 }
 assert.ok(body.faces.length+2*(wheel.faces.length+rear.faces.length)<=15000);
 const genome=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
 const design=generateVehicle(genome,{quality:'drive'});
 try{
  assert.deepEqual(design.diagnostics.issues,[]);
  assert.ok(design.structure.wheelLinerInsetM>=.017);
  assert.ok(design.rearWheelParts.length);
 }finally{disposeDesign(design);}
 const clone=loadVehicle(JSON.stringify(genome));
 const a=exportVehicle(genome),b=exportVehicle(clone);
 assert.deepEqual(a,b);
 assert.equal(a.metrics.carTriangles,a.metrics.bodyTriangles+2*(a.metrics.wheelTriangles+a.metrics.rearWheelTriangles));
});
test('legacy designs stay symmetric; invalid rear document falls back to the front',()=>{
 const result=exportVehicle(createVehicle());
 const model=Object.values(result.models)[1];
 assert.equal(model.rearAxleModel,undefined);
 assert.equal(modelWheelDocumentForAxle(model,'rr'),model);
 const invalid={...model,rearAxleModel:{kind:'rtg-model'}};
 assert.equal(modelWheelDocumentForAxle(invalid,'rr'),invalid);
});
