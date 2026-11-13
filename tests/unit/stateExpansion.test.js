import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {createCampaignHubMenus,campaignEventCategory} from '../../src/menus/CampaignHubMenus.js';
const rootPath=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.resolve(rootPath,p)));
const root='data/campaigns/america/';
const extras=()=>read(root+'raceways/catalog.json').filter(e=>/^(city|state)-/.test(e.id));
test('50 city runs and 29 missing-state events are installed',()=>{
 const all=extras(),cities=all.filter(e=>e.city),gaps=all.filter(e=>e.id.startsWith('state-'));
 assert.equal(all.length,79);assert.equal(cities.length,50);assert.equal(gaps.length,29);
 assert.equal(new Set(cities.map(e=>e.stateCode)).size,50);
 assert.equal(new Set(gaps.map(e=>e.stateCode)).size,29);
});
test('installed expansion events have native terrain, scenery, textures and landmark notes',()=>{
 const all=extras();
 const manifest=read('data/server-storage/files/manifest.json');
 for(const e of all){
  assert.equal(e.status,'installed');assert.equal(manifest.folders.races[e.raceRef],e.documentPath);
  const packed=read('data/server-storage/files/'+e.documentPath);
  const {race}=packed.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(packed.data,'base64'))):packed;
  assert.ok(race.road.nodes.length>20,e.id);assert.ok(Object.keys(race.road.tileMap.cells).length>0,e.id);
  assert.equal(race.road.autoExtend,false);assert.equal(race.campaign.optional,true);
  assert.ok(race.scenery.length>20,e.id);assert.ok(race.roadTextures.road.artRef);
  assert.ok(race.road.nodes.every(n=>Number.isFinite(n.elevation)),e.id);
  assert.ok(!race.source.warnings.some(w=>/flat editable|unavailable/i.test(w)),e.id);
  for(const prop of race.scenery)assert.ok(manifest.folders.doodads[prop.doodadRef],e.id+': '+prop.doodadRef);
  if(e.city){
   assert.equal(campaignEventCategory(e),'cities');
   const notes=read(race.source.landmarkNotesPath);
   assert.equal(notes.landmarks.length,4,e.id);
   for(const mark of notes.landmarks){
    assert.ok(Number.isFinite(mark.routeDistanceM),e.id);assert.ok(mark.routeDistanceM>=0 && mark.routeDistanceM<=notes.routeLengthM+1,e.id);
    assert.ok(mark.coordinateSource.startsWith('https://www.openstreetmap.org/'));
    assert.equal(mark.routeMiles,Number((mark.routeDistanceM/1609.344).toFixed(2)));
   }
  }
 }
});
test('new events appear exactly once under campaign hubs and never exceed eight menu buttons',()=>{
 const all=[...read(root+'side-races/catalog.json'),...read(root+'raceways/catalog.json')];
 const {screens}=createCampaignHubMenus(read(root+'catalog.json'),read('AI/last-on-the-grid/last_on_the_grid_99_side_races.json'),all);
 for(const s of screens)assert.ok(s.elements.filter(e=>e.type==='button').length<=8,s.id);
 const selected=screens.flatMap(s=>s.elements).filter(e=>e.action?.parameter==='raceRef');
 for(const e of extras())assert.equal(selected.filter(s=>s.action.value===e.raceRef).length,1,e.id);
 for(const screen of screens.filter(s=>/^campaign-hub-\d+$/.test(s.id)))assert.ok(screen.elements.some(e=>e.label==='City Runs'));
});

test('the complete saved campaign menu retains every linked page beyond 100 screens',()=>{
 const stored=read('data/server-storage/files/menus/Game Menu/document.json');
 const source=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 assert.ok(source.screens.length>100);
 const normalized=normalizeMenuDocument(source);
 assert.equal(normalized.screens.length,source.screens.length);
 assert.ok(normalized.screens.some(s=>s.id==='campaign-hub-11-raceways'));
 assert.throws(()=>normalizeMenuDocument({screens:Array.from({length:2049},(_,i)=>({id:`screen-${i}`,elements:[]}))}),/at most 2048/);
});
