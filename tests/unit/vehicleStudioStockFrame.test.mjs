import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeStockFrame,buildStudioRoster} from '../../tools/vehicle-validation/build-studio-roster.mjs';
const w=JSON.parse(fs.readFileSync(new URL('../../tools/vehicle-validation/studio-roster-hardpoints.json',import.meta.url))).find(r=>r.id==='renault-clio-williams');
test('untagged negative-Z stock targets fail closed; a mirrored or incomplete frame is rejected',()=>{
 assert.equal(normalizeStockFrame(undefined),null);
 const negative={...w,axles:w.axles.map(a=>({...a,z:-a.z}))};delete negative.stockFrame;
 assert.throws(()=>buildStudioRoster(negative),/Unreasonable stock wheel alignment/);
 assert.throws(()=>normalizeStockFrame({...w.stockFrame,forward:'+z'}));
 const bad=structuredClone(w.stockFrame);bad.joints[0].position[0]*=-1;
 assert.throws(()=>normalizeStockFrame(bad),/Duplicate stock anchor destination/);
});
test('Williams stock right and left rotate into signed chassis landmarks by basis, without mutation',()=>{
 const f=structuredClone(w.stockFrame),frames=normalizeStockFrame(f);
 assert.deepEqual(w.stockFrame,f);
 const built=buildStudioRoster(w).pair.body;
 for(const [key,expected] of frames){
  assert.equal(expected.source.at(-1),key.endsWith('L')?'R':'L');
  assert.deepEqual(built.joints.find(j=>j.name===key).position,expected.position);
  if(!key.startsWith('Wheel'))assert.deepEqual(built.joints.find(j=>j.name===key).rotation,expected.rotation);
 }
 const sameFrame=structuredClone(w);sameFrame.axles[0].z+=.01;
 assert.throws(()=>buildStudioRoster(sameFrame),/normalized axles disagree/);
});
