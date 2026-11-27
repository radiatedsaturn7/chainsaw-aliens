import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle,materialDoc} from '../../src/ui/vehicleStudio/export.mjs';
import {sideDuctMask,cowlDuctMask} from '../../src/ui/vehicleStudio/sideDuct.mjs';

const example=()=>JSON.parse(readFileSync(new URL('../../src/ui/vehicleStudio/examples/tamo-racemo.json',import.meta.url)));
test('recess charts remain outside adjacent seams and the hood recess is symmetric',()=>{
 const {body}=example();
 for(let i=0;i<=20;i++){
  const t=i/20;
  assert.equal(sideDuctMask(body,0,t),0);
  assert.equal(sideDuctMask(body,1,t),0);
  assert.equal(sideDuctMask(body,t,0),0);
  assert.equal(sideDuctMask(body,t,1),0);
  assert.equal(cowlDuctMask(body,0,t),0);
  assert.equal(cowlDuctMask(body,1,t),0);
  assert.equal(cowlDuctMask(body,t,.5),0);
  assert.ok(Math.abs(cowlDuctMask(body,.35,t)-cowlDuctMask(body,.35,1-t))<1e-9);
 }
});
test('duct edits change the body skin, not wheel positions, physics or polygon budget',()=>{
 const g=example(),flat=example();
 for(const key of ['cowlDuct','sideDuct','darkArchLips'])flat.body[key]=0;
 const a=generateVehicle(g,{quality:'drive'}),b=generateVehicle(flat,{quality:'drive'});
 try{
  assert.deepEqual(a.diagnostics.issues,[]);
  assert.deepEqual(b.diagnostics.issues,[]);
  const pos=(d,name,mat)=>d.parts.find(p=>p.component===name&&p.material===mat)?.geometry.attributes.position.array;
  for(const [k,mat] of [['doors','side-duct'],['hood','cowl-duct']]){
   const first=a.parts.find(p=>p.material===mat),positions=first.geometry.attributes.position.array;
   assert.ok(positions.length);
   const flatPositions=pos(b,k,'paint');assert.ok(flatPositions?.length);assert.notDeepEqual(positions,flatPositions);
   assert.ok(new Set(materialDoc(a.genome,mat).texture.pixels).size>3);
  }
 }finally{disposeDesign(a);disposeDesign(b);}
 const x=exportVehicle(g),y=exportVehicle(flat);
 assert.deepEqual(x.attachments,y.attachments);
 assert.deepEqual(x.car.tuning,y.car.tuning);
 assert.equal(x.metrics.carTriangles,x.metrics.bodyTriangles+4*x.metrics.wheelTriangles);
 assert.equal(x.metrics.carTriangles,y.metrics.carTriangles);
 assert.ok(x.metrics.carTriangles<=15000);
});
