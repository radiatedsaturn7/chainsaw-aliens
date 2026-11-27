import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {createEndSurface} from '../../src/ui/vehicleStudio/fascia.mjs';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {exportVehicle,GAMEPLAY_TRIANGLE_BUDGET} from '../../src/ui/vehicleStudio/export.mjs';

const genome=()=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/honda-s660.json',import.meta.url),'utf8'));
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));

test('fairing shares both actual boundary rails and approaches the fascia without a jump',()=>{
 const g=genome();
 const sideAt=(z,v,s)=>[s*(.7-.03*v),.72-.54*v+Math.max(0,1-Math.abs(z+1.19)*4)*.1*v,z];
 const surf=createEndSurface({settings:g.fascia.rear,end:'rear',tip:-1.63,seam:-1.39,archEnd:1.45,cabin:-.39,floor:.125,
  deckAt:(z,u)=>[(2*u-1)*.7,.72,z],sideAt,bumper:g.components.rearBumper});
 for(const s of [-1,1]){
  for(const v of [.13,.25,.5,.75,.91,1]){
   assert.ok(dist(surf.bumperSide(0,v,s),surf.quarter(-1.39,v,s,sideAt(-1.39,v,s)))<1e-10);
   assert.ok(dist(surf.bumperSide(.99999,v,s),surf.face(s===1?1:0,v))<.00003);
  }
  for(const t of [0,.25,.5,.75,1])assert.ok(dist(surf.bumperSide(t,0,s),surf.bridge(s===1?1:0,t))<1e-10);
 }
});
test('S660 fairing changes the body and inset liner, not the lamps or wheel mounts',()=>{
 const g=genome(),before=structuredClone(g);
 before.fascia.rear.sideRailFairing=0;
 const a=generateVehicle(before,{quality:'drive',compact:1}),b=generateVehicle(g,{quality:'drive',compact:1});
 try{
  assert.deepEqual(b.diagnostics.issues,[]);
  assert.deepEqual(b.lampMounts,a.lampMounts);
  assert.deepEqual(b.wheels,a.wheels);
  assert.ok(b.structure.wheelLinerInsetM>=.017);
  assert.ok(b.diagnostics.seams.filter(s=>s.id.startsWith('rearFenderSeam')).every(s=>s.flags.length===0));
  const liner=x=>x.parts.filter(p=>p.component==='rearFenders'&&p.material==='trim')
   .flatMap(p=>Array.from(p.geometry.attributes.position.array));
  assert.notDeepEqual(liner(a),liner(b));
 }finally{disposeDesign(a);disposeDesign(b);}
 const e=exportVehicle(g);
 assert.ok(e.metrics.carTriangles<=GAMEPLAY_TRIANGLE_BUDGET);
});
