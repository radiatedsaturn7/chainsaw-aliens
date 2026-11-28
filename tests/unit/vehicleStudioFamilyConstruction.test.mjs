import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {makeOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
import {disposeDesign,generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';

const load=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
const make=g=>generateVehicle(g,{quality:'drive',compact:3});

test('broad chrome grille uses a single recessed opening alongside the original lamp pair',()=>{
 const g=load('ford-fusion-s-2012');
 const openings=makeOpenings({end:'front',g});
 const grille=openings.find(o=>o.component==='grille');
 assert.equal(grille.style,'broad-bars');
 const extent=o=>o.outline.map(([x])=>x);
 const lamps=openings.filter(o=>o.kind==='lamp').sort((a,b)=>a.center[0]-b.center[0]);
 assert.equal(lamps.length,2);
 assert.ok(Math.max(...extent(lamps[0]))<Math.min(...extent(grille)));
 assert.ok(Math.max(...extent(grille))<Math.min(...extent(lamps[1])));
 const v=make(g);
 try{
  assert.deepEqual(v.diagnostics.issues,[]);
  assert.ok(v.parts.some(p=>p.component==='grille'&&p.material==='chrome'));
 }finally{disposeDesign(v);}
});

test('polymer body wings change fender finish without replacing the hood or moving lamp mounts',()=>{
 const g=load('honda-element-ex-2006');
 assert.equal(g.body.polymerUtilityWings,1);
 const on=make(g);
 g.body.polymerUtilityWings=0;
 const off=make(g);
 try{
  for(const key of ['frontFenders','rearFenders']){
   assert.ok(on.parts.some(p=>p.component===key&&p.material==='trim'));
   assert.ok(!on.parts.some(p=>p.component===key&&p.material==='lower-clad'));
   assert.ok(off.parts.some(p=>p.component===key&&p.material==='lower-clad'));
  }
  assert.ok(on.parts.some(p=>p.component==='hood'&&p.material==='paint'));
  assert.deepEqual(on.lampMounts,off.lampMounts);
 }finally{disposeDesign(on);disposeDesign(off);}
});

test('pillarless roof keeps glass and omits only the side middle-pillar shells on activation',()=>{
 const g=load('oldsmobile-toronado-1966');
 assert.equal(g.construction.cabin.pillarlessHardtop,1);
 const on=make(g);
 g.construction.cabin.pillarlessHardtop=0;
 const off=make(g);
 try{
  const count=(v,key)=>v.parts.filter(p=>p.component===key).length;
  assert.equal(count(off,'pillars')-count(on,'pillars'),2);
  for(const key of ['glass','roof','doors'])assert.equal(count(on,key),count(off,key));
  assert.deepEqual(on.lampMounts,off.lampMounts);
 }finally{disposeDesign(on);disposeDesign(off);}
});
