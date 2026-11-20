import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {motorsportCatalog} from '../../src/menus/MotorsportEvents.js';
const root='data/server-storage/files/';
const report=JSON.parse(fs.readFileSync('data/campaigns/america/raceways/rally-sections.json'));
const manifest=JSON.parse(fs.readFileSync(root+'manifest.json'));
const read=ref=>{const d=JSON.parse(fs.readFileSync(root+manifest.folders.races[ref]));return (d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d).race;};
test('installed rally sections retain parent geometry, surfaces, and disjoint timed ranges',()=>{
 const parents=new Map();let checked=0;
 for(const collection of report.collections){
  const ends=new Map();
  for(const entry of collection.sections){
   const folder=encodeURIComponent(entry.ref).replace(/%20/g,' ').replace(/[!'*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
   assert.equal(manifest.folders.races[entry.ref],`races/${folder}/document.json`,'must match development server storage naming');
   const race=read(entry.ref);if(!parents.has(entry.parentRef))parents.set(entry.parentRef,read(entry.parentRef));
   const parent=parents.get(entry.parentRef),source=race.source.rallySection;
   assert.ok(entry.lengthM>=report.minimumTimedSectionM);
   assert.ok(source.startDistanceM>=(ends.get(entry.parentRef)||0));ends.set(entry.parentRef,source.endDistanceM);
   assert.equal(race.road.nodes.length,source.lastNode-source.firstNode+1);
   assert.equal(race.road.segments.length,race.road.nodes.length-1);
   for(let i=0;i<race.road.nodes.length;i++){
    const a=race.road.nodes[i],b=parent.road.nodes[i+source.firstNode];
    assert.deepEqual([a.x,a.y,a.elevation],[b.x,b.y,b.elevation]);
   }
   for(let i=0;i<race.road.segments.length;i++){
    const a=race.road.segments[i],b=parent.road.segments[i+source.firstNode];
    assert.equal(a.surface,b.surface);assert.equal(a.roadWidthM,b.roadWidthM);assert.equal(a.banking,b.banking);
   }
   assert.equal(race.road.nodes[0].role,'start');assert.equal(race.road.nodes.at(-1).role,'finish');
   assert.equal(race.road.autoExtend,false);assert.equal(source.direction,'forward');
   checked++;
  }
 }
 assert.ok(checked>=90);
});
test('Monte Carlo full event contains six unique saved sections exactly twice',()=>{
 const menu=JSON.parse(fs.readFileSync(root+'menus/Game Menu/document.json'));
 const catalog=motorsportCatalog(menu.parameters.raceIndex);
 const full=catalog.rallies.find(r=>r.id==='rally-monte-carlo-full');
 assert.equal(full.rounds.length,12);assert.equal(new Set(full.rounds.map(r=>r.ref)).size,6);
 assert.deepEqual(full.rounds.slice(0,6).map(r=>r.ref),full.rounds.slice(6).map(r=>r.ref));
 for(const r of full.rounds)assert.ok(manifest.folders.races[r.ref]);
 const short=catalog.rallies.find(r=>r.id==='rally-monte-carlo-short');
 assert.equal(new Set(short.rounds.map(r=>r.ref)).size,4);
 for(const c of report.collections.filter(c=>c.status==='needs-additional-roads'))assert.ok(!catalog.rallies.some(r=>r.rallyId===c.id));
});

test('every advertised rally offers four unique sections and six sections twice',()=>{
 const menu=JSON.parse(fs.readFileSync(root+'menus/Game Menu/document.json'));
 const catalog=motorsportCatalog(menu.parameters.raceIndex);
 assert.equal(report.collections.length,30);
 for(const c of report.collections){
  assert.equal(c.status,'installed',c.id);assert.equal(c.sections.length,6,c.id);
  assert.deepEqual(c.formats,[4,12],c.id);
  const full=catalog.rallies.find(r=>r.id===`rally-${c.id}-full`);
  const short=catalog.rallies.find(r=>r.id===`rally-${c.id}-short`);
  assert.equal(full.rounds.length,12,c.id);assert.equal(new Set(full.rounds.map(r=>r.ref)).size,6,c.id);
  assert.deepEqual(full.rounds.slice(0,6).map(r=>r.ref),full.rounds.slice(6).map(r=>r.ref));
  assert.equal(short.rounds.length,4,c.id);assert.equal(new Set(short.rounds.map(r=>r.ref)).size,4,c.id);
  for(const r of [...full.rounds,...short.rounds])assert.ok(manifest.folders.races[r.ref]);
 }
});
