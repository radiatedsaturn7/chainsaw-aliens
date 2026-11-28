import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {studioRoster} from '../../src/model3d/studio-roster/index.js';
import {placeOutboardWheelFace} from '../../src/model3d/ModelBinding.js';
import {studioRosterModelUrl,createStudioRosterLoader,isStudioRosterWheel} from '../../src/model3d/StudioRosterModels.js';
import {decodeStudioRosterPair,encodeStudioRosterPair} from '../../src/model3d/StudioRosterPack.js';
import {buildStudioRoster} from '../../tools/vehicle-validation/build-studio-roster.mjs';
import * as THREE from '../../src/vendorBridge/three.js';
import {buildModelObject,disposeModelObject} from '../../src/model3d/ModelRender.js';
import {syncRaceModelLamps} from '../../src/model3d/RaceModelVehicle.js';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const hardpoints=json('../../tools/vehicle-validation/studio-roster-hardpoints.json');
const packedRaw=e=>JSON.parse(gunzipSync(readFileSync(e.pack)));
const packed=e=>decodeStudioRosterPair(packedRaw(e));
test('only unique, enumerated 3D roster pairs route to Studio studies',()=>{
 const refs=studioRoster.flatMap(r=>[r.bodyRef,r.wheelRef]);
 assert.equal(studioRoster.length,hardpoints.length);
 assert.ok(studioRoster.length>=19);
 assert.equal(new Set(studioRoster.map(r=>r.id)).size,studioRoster.length);
 assert.equal(new Set(hardpoints.map(r=>r.carId)).size,hardpoints.length);
 assert.equal(new Set(refs).size,studioRoster.length*2);
 for(const ref of refs)assert.ok(studioRosterModelUrl(ref));
 assert.equal(studioRosterModelUrl('Field-Forgetmenot'),null);
 assert.equal(studioRosterModelUrl('RTG-001'),null);
});
test('roster wheels show the outboard face on both sides without flipping legacy wheels',()=>{
 const r=studioRoster[0],{wheel}=packed(r),binding={ref:r.wheelRef,rotation:[0,0,0]};
 assert.equal(isStudioRosterWheel(wheel,r.wheelRef),true);
 assert.equal(isStudioRosterWheel(wheel,'RTG-001'),false);
 assert.equal(placeOutboardWheelFace(binding,-1),binding);
 assert.equal(placeOutboardWheelFace(binding,1,true),binding);
 assert.equal(placeOutboardWheelFace(binding,-1,true).rotation[1],Math.PI);
});
test('concurrent body and wheel loads share one download and fail together',async()=>{
 const r=studioRoster[0];let calls=0;
 const load=createStudioRosterLoader({fetchPair:()=>{calls++;return packed(r);}});
 const [body,wheel]=await Promise.all([load(r.bodyRef),load(r.wheelRef)]);
 assert.equal(calls,1);
 assert.match(body.name,/Studio body$/);
 assert.match(wheel.name,/Studio wheel$/);
 const invalid=createStudioRosterLoader({fetchPair:()=>({body})});
 assert.deepEqual(await Promise.all([invalid(r.bodyRef),invalid(r.wheelRef)]),[null,null]);
});
for(const r of studioRoster)test(r.label+' keeps exact hubs and builds a deterministic <=15k roster pair',()=>{
 const t=hardpoints.find(h=>h.id===r.id);
 assert.ok(t.carId.startsWith('3d-'));
 const {pair,metrics}=buildStudioRoster(t),{body,wheel}=pair;
 const raw=packedRaw(r),codec=raw.format==='lotg-studio-pack-2';
 if(codec){
  assert.deepEqual(raw,encodeStudioRosterPair(pair));
  for(const key of ['body','wheel'])assertCompactEquivalent(pair[key],decodeStudioRosterPair(raw)[key]);
 }else assert.equal(JSON.stringify(pair),JSON.stringify(raw));
 assert.ok(metrics.triangles<=15000);
 assert.ok(body.joints.find(j=>j.name==='WheelMount_FL').position[2]>body.joints.find(j=>j.name==='WheelMount_RL').position[2]);
 for(const [i,axle] of ['F','R'].entries())for(const [side,sign] of [['L',-1],['R',1]]){
  const at=t.axles[i],h=body.joints.find(j=>j.name==='WheelMount_'+axle+side);
  const symmetric=[sign*at.track/2,at.y,at.z];
  const pinned=t.stockWheelPositions?.[axle+side];
  if(t.stockWheelPositions)assert.ok(pinned.every((value,i)=>Math.abs(value-symmetric[i])<.001));
  assert.deepEqual(h.position,pinned??symmetric);
 }
 const wheels=wheel.vertices.map(({position:[,y,z]})=>Math.hypot(y,z));
 assert.ok(Math.abs(Math.max(...wheels)-t.radius)<.005);
 const usedMaterials=new Set(body.faces.map(face=>face.material));
 for(const role of ['head','brake','reverse','running','signal-left','signal-right']){
  assert.ok(body.materials.some(m=>usedMaterials.has(m.id)&&m.name.startsWith('[studio9:'+role+']')),'Missing functional geometry for '+role);
 }
 // A model can have all six named roles and still light the wrong flank.
 const indicatorSides=new Map(body.materials.flatMap(m=>{
  const role=/^\[studio9:signal-(left|right)\]/.exec(m.name)?.[1];
  return role?[[m.id,role==='left'?-1:1]]:[];
 }));
 const byId=new Map(body.vertices.map(v=>[v.id,v.position[0]]));
 for(const face of body.faces){
  const sign=indicatorSides.get(face.material);
  if(sign)assert.ok(sign*face.vertices.reduce((sum,id)=>sum+byId.get(id),0)>=-.0001*face.vertices.length,
   'Indicator geometry is on the wrong signed chassis side: '+face.id);
 }
});

function assertCompactEquivalent(before, after){
 const {vertices:v0,faces:f0,rearAxleModel:r0,...meta0}=before;
 const {vertices:v1,faces:f1,rearAxleModel:r1,...meta1}=after;
 assert.deepEqual(meta1,meta0);
 assert.equal(v1.length,v0.length);
 assert.equal(f1.length,f0.length);
 const near=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b} (tolerance ${t})`);
 v0.forEach((vertex,k)=>{
  assert.equal(v1[k].id,vertex.id);assert.deepEqual(v1[k].weights,vertex.weights);
  vertex.position.forEach((x,i)=>near(x,v1[k].position[i],.000005000001));
 });
 const positions=vs=>new Map(vs.map(v=>[v.id,v.position]));
 const a=positions(v0),b=positions(v1);
 const area=(mesh,ids)=>{
  const [p,q,r]=ids.map(id=>mesh.get(id));
  const [ux,uy,uz]=q.map((x,i)=>x-p[i]),[vx,vy,vz]=r.map((x,i)=>x-p[i]);
  return Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx);
 };
 f0.forEach((f,k)=>{
  const {uv,cornerNormals:n,...face}=f,{uv:t,cornerNormals:m,...decoded}=f1[k];
  assert.deepEqual(decoded,face);
  uv.forEach((at,i)=>at.forEach((x,j)=>near(x,t[i][j],.00001526)));
  n.forEach((at,i)=>at.forEach((x,j)=>near(x,m[i][j],.00001526)));
  if(area(a,f.vertices)>1e-12)assert.ok(area(b,f.vertices)>1e-12,'Packing collapsed face '+f.id);
 });
 if(r0){assert.ok(r1);assertCompactEquivalent(r0,r1);}else assert.equal(r1,undefined);
}

test('compact packs reject truncated binary attributes while legacy packs remain readable',()=>{
 const raw=encodeStudioRosterPair(packed(studioRoster[0]));
 const body={...raw.body,vi:raw.body.vi.slice(4)};
 assert.throws(()=>decodeStudioRosterPair({...raw,body}),/attribute length/);
 const before=packed(studioRoster[0]);
 assert.equal(decodeStudioRosterPair(before),before);
});

test('a rejected shared pair can recover without reloading the page',async()=>{
 const r=studioRoster[0];let calls=0;
 const load=createStudioRosterLoader({fetchPair:()=>{
  if(++calls===1)throw new DOMException('Request timed out','TimeoutError');
  return packed(r);
 }});
 assert.deepEqual(await Promise.all([load(r.bodyRef),load(r.wheelRef)]),[null,null]);
 const [body,wheel]=await Promise.all([load(r.bodyRef),load(r.wheelRef)]);
 assert.equal(body.name,r.label+' · Studio body');
 assert.equal(wheel.name,r.label+' · Studio wheel');
 assert.equal(calls,2);
});

test('left-only and right-only commands illuminate the corresponding physical sides in the race renderer',()=>{
 const entry=studioRoster.find(r=>r.id==='mini-r56-jcw-2009');
 const model=packed(entry).body,root=buildModelObject(model),object=new THREE.Group();
 object.add(root);
 const instance={model,root,object,binding:{ref:entry.bodyRef}},part={userData:{modelInstance:instance}};
 try{
  for(const [side,sign] of [['left',-1],['right',1]]){
   assert.equal(syncRaceModelLamps(part,{mechanical:{turnSignal:side,headlights:false},elapsedMs:0}),true);
   const lit=instance.raceStudioLights.filter(lamp=>lamp.mat.emissiveIntensity>0);
   assert.ok(lit.length>0);
   for(const {mat,role} of lit){
    assert.equal(role,'signal-'+side);
    const meshes=root.children.filter(mesh=>mesh.material===mat);
    assert.ok(meshes.length>0);
    for(const mesh of meshes)assert.ok(new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()).x*sign>0);
   }
   syncRaceModelLamps(part,{mechanical:{turnSignal:side,headlights:false},elapsedMs:400});
   assert.ok(instance.raceStudioLights.every(lamp=>lamp.mat.emissiveIntensity===0));
  }
 }finally{disposeModelObject(root);}
});
