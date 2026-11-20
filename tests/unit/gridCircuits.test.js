import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const root='data/server-storage/files',manifest=read(`${root}/manifest.json`),menu=read(`${root}/menus/Game Menu/document.json`);
const keys=new Set(['cota','mont-tremblant','jarama','istanbul','yas-marina']);
const rows=read('data/campaigns/america/raceways/catalog.json').filter(r=>keys.has(r.venueKey));
test('20 current GRID layouts have finite closed roads, DEM terrain, saved location, previews and valid artwork',()=>{
 assert.equal(rows.length,20);assert.equal(new Set(rows.map(r=>r.raceRef)).size,20);
 for(const row of rows){
  assert.equal(manifest.folders.races[row.raceRef],row.documentPath);
  const r=read(`${root}/${row.documentPath}`).race;
  assert.equal(r.type,'circuit');assert.ok(r.laps>=2);assert.ok(!r.campaign?.hubStage,'do not place foreign circuits in US regions');
  assert.ok(r.location.country);if(row.venueKey==='cota')assert.equal(r.location.stateCode,'TX');assert.equal(r.source.layoutEra,'current');assert.ok(r.road.nodes.every(n=>[n.x,n.y,n.elevation].every(Number.isFinite)));
  assert.deepEqual([r.road.nodes[0].x,r.road.nodes[0].y],[r.road.nodes.at(-1).x,r.road.nodes.at(-1).y]);
  assert.ok(Object.keys(r.road.tileMap.cells).length>100);assert.ok(r.source.elevationProvider.includes('Mapzen'));
  assert.ok(menu.parameters.raceIndex.some(e=>e.ref===row.raceRef));assert.ok(menu.parameters.campaignRoutePreviews[row.raceRef].distanceM>500);
  for(const p of r.scenery)if(p.doodadRef)assert.ok(manifest.folders.doodads[p.doodadRef],p.doodadRef);
  for(const ref of [r.skyboxArtRef,r.groundPlaneArtRef,r.roadTextures?.road?.artRef])if(ref)assert.ok(manifest.folders.art[ref],ref);
 }
});
test('native editor resolves every layout to a complete lap, without shortcutting connectors',()=>{
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 for(const row of rows){
  const r=read(`${root}/${row.documentPath}`).race;editor.applyLoadedRaceDocument(r);
  const length=editor.getRaceRouteLength();assert.ok(length>row.lengthM*.94&&length<row.lengthM*1.06,`${row.raceRef}: ${length} vs ${row.lengthM}`);
  for(const d of [0,length*.25,length*.5,length*.75,length-.1]){const pose=editor.getRaceWorldPoseAtDistance(d);assert.ok([pose.x,pose.z,pose.yaw].every(Number.isFinite),row.raceRef);}
 }
});
