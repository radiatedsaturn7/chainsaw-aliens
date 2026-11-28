import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createVehicle,serializeVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const example=id=>JSON.parse(fs.readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url)));
test('opt-in scalloped sill moves paint/rocker edge while preserving Rally Fighter mounts and tuning',()=>{
 const active=loadVehicle(serializeVehicle(example('rally-fighter'))),plain=structuredClone(active);
 assert.equal(createVehicle().body.sillRelief,0);
 assert.equal(active.body.sillRelief,.126);
 plain.body.sillRelief=0;
 const a=generateVehicle(active),b=generateVehicle(plain);
 try{
  const center=new Map();
  for(const [key,design] of [['a',a],['b',b]]){
   center.set(key, Math.min(...design.parts.filter(p=>p.component==='rockers').map(p=>{
    const pos=p.geometry.attributes.position;
    return Math.min(...Array.from({length:pos.count},(_,i)=>Math.abs(pos.getZ(i))<.12?pos.getY(i):Infinity));
   })));
  }
  assert(center.get('a')-center.get('b')>.11);
  const A=exportVehicle(active),B=exportVehicle(plain);
  assert.deepEqual(A.car.car.tuning,B.car.car.tuning);
  assert.deepEqual(A.attachments,B.attachments);
  assert(A.metrics.carTriangles<=15000);
 }finally{disposeDesign(a);disposeDesign(b);}
});
test('Miata and Forester photo-fit remain valid stock-size Studio Drive exports',()=>{
 for(const [id,family] of [['mazda-miata','fastback'],['subaru-forester','sedan']]){
  const g=loadVehicle(serializeVehicle(example(id))),d=generateVehicle(g);
  try{
   assert.equal(g.family,family);
   assert.deepEqual(d.diagnostics.issues,[]);
   const out=exportVehicle(g);
   assert(out.metrics.carTriangles<=15000);
   for(const wheel of ['FL','FR','RL','RR']) assert.equal(out.attachments['WheelMount_'+wheel].length,3);
  }finally{disposeDesign(d);}
 }
});
test('low Miata hood occludes front wheel liners at both upper arches',async()=>{
 const T=await import('../../src/vendorBridge/three.js');
 const d=generateVehicle(example('mazda-miata'));
 const material=new T.MeshBasicMaterial({side:T.DoubleSide});
 const objects=d.parts.filter(p=>p.component==='hood'||p.component==='frontFenders').map(p=>{
  const o=new T.Mesh(p.geometry,material);o.userData.role=p.material;return o;
 });
 try{
  const cast=new T.Raycaster(),down=new T.Vector3(0,-1,0);
  for(const side of [-1,1])for(const z of [1.10,1.15,1.20,1.25])for(const x of [.59,.63,.67,.71]){
   cast.set(new T.Vector3(x*side,2,z),down);
   assert.equal(cast.intersectObjects(objects)[0]?.object.userData.role,'paint');
  }
 }finally{material.dispose();disposeDesign(d);}
});
