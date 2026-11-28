import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';import {normalizeRaceLocation} from '../../src/racing/RaceLocation.js';import {raceIndexEntries,raceIndexScreen} from '../../src/menus/RaceIndex.js';
const root='data/server-storage/files',read=p=>{let d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const rows=read('data/campaigns/planetary/catalog.json'),menu=read(`${root}/menus/Game Menu/document.json`),manifest=read(`${root}/manifest.json`);
test('planetary stages retain real terrain, separate bodies and explicit simulator provenance',()=>{
 assert.equal(rows.length,7);
 for(const row of rows){
  const race=read(`${root}/${row.documentPath}`).race;
  assert.equal(race.source.planetarySimulator,true);assert.equal(race.location.body,row.body);assert.equal(race.location.country,'');assert.equal(race.type,'destination');
  assert.equal(normalizeRaceLocation(race).body,row.body);assert.ok(!race.campaign);assert.equal(race.road.autoExtend,false);
  assert.ok(race.road.nodes.every(n=>[n.x,n.y,n.elevation].every(Number.isFinite)));
  assert.ok(Math.max(...race.road.nodes.map(n=>n.elevation))-Math.min(...race.road.nodes.map(n=>n.elevation))>2);
  assert.ok(Object.keys(race.road.tileMap.cells).length>1500);
  assert.ok(race.source.elevationProvider.includes('.tif')||race.source.elevationProvider.includes('.TIF')||race.source.elevationProvider.includes('.IMG'));
  assert.ok(race.scenery.every(s=>manifest.folders.doodads[s.doodadRef]&&/rock|boulder/.test(s.doodadRef)));
  const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);
  const length=editor.getRaceRouteLength();assert.ok(length>row.lengthM*.94&&length<row.lengthM*1.06);
  assert.ok(editor.getSelectedRaceSkybox().id.endsWith('-simulator'));
 }
});
test('Space filter offers both worlds with previews and excludes terrestrial races',()=>{
 const entries=raceIndexEntries(menu.parameters.raceIndex,'space');assert.equal(entries.length,7);
 assert.deepEqual([...new Set(entries.map(e=>e.location.body))].sort(),['Mars','Moon']);
 assert.ok(menu.screens.find(s=>s.id==='world-map').elements.some(e=>e.id==='world-race-index'));
 assert.ok(raceIndexEntries(menu.parameters.raceIndex,'international').every(e=>!e.location.body));
 for(const [i,e] of entries.entries()){
  assert.ok(menu.parameters.campaignRoutePreviews[e.ref]);
  const {screen}=raceIndexScreen(entries,i,0,()=>({allowed:true}),'space');assert.equal(screen.elements.find(e=>e.id==='heading').label,'Space');
  assert.ok(screen.elements.some(b=>b.action?.value===e.ref));
 }
});
