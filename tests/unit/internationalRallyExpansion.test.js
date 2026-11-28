import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {isInternationalRace} from '../../src/menus/RaceIndex.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const root='data/server-storage/files',manifest=read(`${root}/manifest.json`),menu=read(`${root}/menus/Game Menu/document.json`);
const keys=new Set(['nordschleife','hockenheim','hungaroring','sepang','fafe','condor','sisteron','fontbelle','ruuhimaki']);
const rows=read('data/campaigns/america/raceways/catalog.json').filter(r=>keys.has(r.venueKey));
test('expanded international circuits and rally roads are selectable, finite and correctly timed',()=>{
 assert.equal(rows.length,17); // Existing Nordschleife + eleven circuits + five rally sections.
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 for(const row of rows){
  assert.equal(manifest.folders.races[row.raceRef],row.documentPath);
  const race=read(`${root}/${row.documentPath}`).race;
  const entry=menu.parameters.raceIndex.find(e=>e.ref===row.raceRef);assert.ok(entry,row.raceRef);assert.ok(isInternationalRace(entry));
  assert.ok(menu.parameters.campaignRoutePreviews[row.raceRef].distanceM>1000);
  assert.ok(race.source.elevationProvider.includes('Mapzen'));assert.ok(Object.keys(race.road.tileMap.cells).length>100);
  for(const n of race.road.nodes)assert.ok([n.x,n.y,n.elevation].every(Number.isFinite));
  const heights=race.road.nodes.map(n=>n.elevation*12);assert.ok(Math.max(...heights)-Math.min(...heights)>1);
  assert.equal(race.road.autoExtend,false);assert.ok(!race.campaign?.hubStage);
  for(const s of race.scenery)if(s.doodadRef)assert.ok(manifest.folders.doodads[s.doodadRef],s.doodadRef);
  for(const texture of Object.values(race.roadTextures.surfaceRoads))assert.ok(manifest.folders.art[texture.artRef]);
  editor.applyLoadedRaceDocument(race);const length=editor.getRaceRouteLength();
  const expected=race.source.linePlacement?.lengthAfterM||row.lengthM;
  assert.ok(length>expected*.94&&length<expected*1.06,`${row.raceRef} ${length}/${expected}`);
  for(const d of [0,length*.25,length*.5,length*.75,length-.1]){const p=editor.getRaceWorldPoseAtDistance(d);assert.ok([p.x,p.z,p.yaw].every(Number.isFinite));}
 }
});
test('rally surfaces and geographic limitations survive installation',()=>{
 for(const key of ['fafe','condor','sisteron','fontbelle','ruuhimaki']){
  const row=rows.find(r=>r.venueKey===key),race=read(`${root}/${row.documentPath}`).race;
  assert.equal(race.type,'destination');assert.equal(race.laps,1);assert.ok(race.source.sourceSha256);assert.ok(race.source.geometryMethod);
  const surfaces=new Set(race.road.segments.map(s=>s.surface));
  assert.ok(surfaces.has(['sisteron','fontbelle'].includes(key)?'asphalt':'gravel'));
  if(key==='fafe')assert.ok(surfaces.has('asphalt'),'official Fafe includes short tarmac sections');
  if(key==='ruuhimaki')assert.match(race.source.geometryMethod,/Not the full/);
 }
});
