import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('rear silver split is editable without moving the lens rim or the lamp attachments',()=>{
 const source=JSON.parse(readFileSync(new URL('../../tools/vehicle-validation/wrx-fit12-genome.json',import.meta.url)));
 const legacy=structuredClone(source);
 delete legacy.optics.rear.silverUpperSplit;
 const before=loadVehicle(JSON.stringify(legacy)),after=loadVehicle(JSON.stringify(source));
 assert.equal(before.optics.rear.silverUpperSplit,-.018);
 assert.equal(loadVehicle(serializeVehicle(after)).optics.rear.silverUpperSplit,.125);
 const [a]=Object.values(exportVehicle(before).models),[b]=Object.values(exportVehicle(after).models);
 assert.deepEqual(a.joints,b.joints);
 const geometry=(model,material)=>{
  const points=new Map(model.vertices.map(v=>[v.id,v.position]));
  return model.faces.filter(f=>f.component==='tails'&&f.material===material).map(f=>f.vertices.map(v=>points.get(v)));
 };
 const area=faces=>faces.reduce((sum,[a,b,c])=>{
  const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
  return sum+Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
 },0);
 const silver='studio-mat-opticSilver',outer='studio-mat-opticCover';
 const old=area(geometry(a,silver)),next=area(geometry(b,silver));
 assert.ok(next>0&&next<old*.90,'Upper silver region should shrink, not disappear');
 assert.ok(geometry(a,outer).length>0,'Lens cover should be present');
 assert.deepEqual(geometry(a,outer),geometry(b,outer));
});
