import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('scoped elevation bounds preserve all clamping and fallback values',()=>{
 const editor=Object.create(RaceEditor.prototype);
 let reads=0,race={road:{}};
 Object.defineProperty(editor,'selectedRace',{get(){reads++;return race;}});
 const values=[undefined,null,NaN,Infinity,-Infinity,'abc','23',false,true,0,-0,-2000,2000];
 for(let i=0;i<200;i++)values.push(Math.sin(i*1.37)*3000);
 for(const range of [undefined,{}, {min:-600,max:950},{min:-2000,max:2000},{min:5,max:-5},{min:'-25',max:'25'},{min:NaN,max:Infinity}]){
  race.road.elevationRange=range;
  // Unscoped evaluation remains the uncached behavior.
  const expected=values.map(v=>values.slice(0,13).map(f=>editor.clampRaceElevation(v,f)));
  reads=0;
  editor.withRaceGeometryReadCache(()=>{
   for(let i=0;i<values.length;i++)for(let f=0;f<13;f++)
    assert.equal(editor.clampRaceElevation(values[i],values[f]),expected[i][f]);
  });
  assert.equal(reads,1);
 }
});
test('elevation cache follows scope boundaries, explicit invalidation, and exceptions',()=>{
 const editor=Object.create(RaceEditor.prototype);
 const race={road:{elevationRange:{min:-50,max:50}}};
 Object.defineProperty(editor,'selectedRace',{value:race});
 editor.withRaceGeometryReadCache(()=>{
  assert.equal(editor.clampRaceElevation(100),50);
  editor.withRaceGeometryReadCache(()=>assert.equal(editor.clampRaceElevation(-100),-50));
  race.road.elevationRange={min:-80,max:80};
  editor.clearRaceRuntimeSurfaceCaches();
  assert.equal(editor.clampRaceElevation(100),80);
 });
 race.road.elevationRange.max=90;
 assert.throws(()=>editor.withRaceGeometryReadCache(()=>{
  assert.equal(editor.clampRaceElevation(100),90);throw Error('test');
 }));
 assert.equal(editor.raceGeometryReadCache,undefined);
 race.road.elevationRange.max=95;
 assert.equal(editor.clampRaceElevation(100),95);
});
