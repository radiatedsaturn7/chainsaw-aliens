import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {campaignEventCategory} from '../../src/menus/CampaignHubMenus.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const root='data/server-storage/files/';
const sources=read('tools/campaigns/wilderness_sources.json');
const catalog=read('data/campaigns/america/raceways/catalog.json');
const manifest=read(root+'manifest.json');
const menu=read(root+'menus/Game Menu/document.json');
test('eleven wilderness events use imported geometry, saved artwork and reachable campaign buttons',()=>{
 assert.equal(sources.length,11);
 for(const source of sources){
  const entry=catalog.find(r=>r.id===source.id);assert.equal(entry?.status,'installed',source.id);
  assert.equal(manifest.folders.races[entry.raceRef],entry.documentPath);
  const race=read(root+entry.documentPath).race;
  assert.equal(race.id,source.id);assert.equal(race.road.autoExtend,false);
  assert.ok(race.source.osmWayIds.length);assert.ok(race.source.sourceSnapshotSha256);
  assert.ok(race.source.elevationProvider.includes('DEM'));
  assert.ok(!race.source.warnings.some(w=>/unavailable|flat editable/.test(w)));
  assert.ok(race.road.nodes.length>40);assert.ok(race.scenery.length>40);
  assert.ok(race.road.nodes.every(n=>Number.isFinite(n.elevation)));
  const edges=new Set();
  for(let i=1;i<race.road.nodes.length;i++){
   const a=race.road.nodes[i-1],b=race.road.nodes[i];
   const key=[`${a.x.toFixed(3)},${a.y.toFixed(3)}`,`${b.x.toFixed(3)},${b.y.toFixed(3)}`].sort().join(':');
   assert.ok(!edges.has(key),`${source.id}: repeated segment`);edges.add(key);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<85,`${source.id}: route gap`);
  }
  for(const prop of race.scenery)assert.ok(manifest.folders.doodads[prop.doodadRef],prop.doodadRef);
  assert.ok(manifest.folders.art[race.skyboxArtRef]);assert.ok(manifest.folders.art[race.groundPlaneArtRef]);
  const category=campaignEventCategory(entry);
  const pages=menu.screens.filter(s=>s.id.startsWith(`campaign-hub-${entry.hubStage}-${category}`));
  assert.ok(pages.some(s=>s.elements.some(e=>e.action?.value===entry.raceRef)),`${source.id}: menu link`);
  assert.ok(pages.every(s=>s.elements.filter(e=>e.type==='button').length<=8));
  if(source.finishElevation==='highest')assert.ok(race.road.nodes.at(-1).elevation>race.road.nodes[0].elevation);
  if(source.finishElevation==='lowest')assert.ok(race.road.nodes.at(-1).elevation<race.road.nodes[0].elevation);
 }
});
test('regional conditions preserve the intended variety instead of covering every road in snow',()=>{
 const race=id=>read(root+catalog.find(e=>e.id===`detour-${id}`).documentPath).race;
 assert.ok(race('thompson').road.segments.every(s=>s.surface==='snow'));
 const denali=new Set(race('denali').road.segments.map(s=>s.surface));
 assert.ok(denali.has('snow'));assert.ok(denali.has('gravel'));
 assert.equal(race('tantalus').weather,'rain');
 for(const id of ['diamond-creek','desert-view','sandhills','haleakala'])assert.ok(race(id).road.segments.every(s=>s.surface!=='snow'));
 assert.ok(race('maunakea').road.segments.some(s=>s.surface==='snow'));
});
