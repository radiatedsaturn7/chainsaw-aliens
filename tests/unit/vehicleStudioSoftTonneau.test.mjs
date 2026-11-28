import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {disposeDesign,generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';

test('soft tonneau is one continuous surface over the separate closed bed floor',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/gmc-syclone-1991.json',import.meta.url),'utf8'));
 assert.equal(g.body.pickupBedCover,1);
 assert.equal(g.body.pickupSoftCover,1);
 const create=()=>generateVehicle(g,{quality:'drive',compact:3});
 const soft=create();
 g.body.pickupSoftCover=0;
 const legacy=create();
 try{
  const roles=v=>v.parts.map(p=>p.geometry.userData.section).filter(Boolean);
  const actual=roles(soft),old=roles(legacy);
  assert.equal(actual.filter(r=>r==='pickup continuous soft tonneau').length,1);
  assert.ok(!old.includes('pickup continuous soft tonneau'));
  assert.ok(actual.includes("pickup cover closed backing"));
  assert.equal(old.filter(r=>r==='pickup cover removable leaf').length,3);
  const upper=soft.parts.find(p=>p.geometry.userData.section==='pickup continuous soft tonneau');
  const top=upper.geometry.attributes.position;
  assert.ok(top.count>32);
  assert.deepEqual(soft.wheels,legacy.wheels);
  assert.deepEqual(soft.lampMounts,legacy.lampMounts);
 }finally{disposeDesign(soft);disposeDesign(legacy);}
});
