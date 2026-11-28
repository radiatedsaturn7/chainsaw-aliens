import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {studioRoster} from '../../src/model3d/studio-roster/index.js';
import {placeOutboardWheelFace} from '../../src/model3d/ModelBinding.js';
import {studioRosterModelUrl,createStudioRosterLoader,isStudioRosterWheel} from '../../src/model3d/StudioRosterModels.js';
import {buildStudioRoster} from '../../tools/vehicle-validation/build-studio-roster.mjs';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const hardpoints=json('../../tools/vehicle-validation/studio-roster-hardpoints.json');
const packed=e=>JSON.parse(gunzipSync(readFileSync(e.pack)));
test('only the nineteen enumerated 3D roster pairs route to the Studio studies',()=>{
 const refs=studioRoster.flatMap(r=>[r.bodyRef,r.wheelRef]);
 assert.equal(studioRoster.length,19);
 assert.equal(new Set(refs).size,38);
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
 assert.equal(JSON.stringify(pair),JSON.stringify(packed(r)));
 assert.ok(metrics.triangles<=15000);
 assert.ok(body.joints.find(j=>j.name==='WheelMount_FL').position[2]>body.joints.find(j=>j.name==='WheelMount_RL').position[2]);
 for(const [i,axle] of ['F','R'].entries())for(const [side,sign] of [['L',-1],['R',1]]){
  const at=t.axles[i],h=body.joints.find(j=>j.name==='WheelMount_'+axle+side);
  assert.deepEqual(h.position,[sign*at.track/2,at.y,at.z]);
 }
 const wheels=wheel.vertices.map(({position:[,y,z]})=>Math.hypot(y,z));
 assert.ok(Math.abs(Math.max(...wheels)-t.radius)<.005);
 for(const role of ['head','brake','reverse'])assert.ok(body.materials.some(m=>m.name.startsWith('[studio9:'+role+']')));
});
