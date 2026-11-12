import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {sanitizeProjectFileName} from '../../src/ui/projectFiles.js';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>{const v=JSON.parse(fs.readFileSync(path.join(root,p)));return v.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(v.data,'base64'))):v;};
const catalog=read('data/campaigns/america/side-races/catalog.json');
const manifest=read('data/server-storage/files/manifest.json');
const mains=read('data/campaigns/america/catalog.json');
const events=catalog.filter(e=>e.status==='installed');

test('installed side races resolve to distinct saved race documents with real source geometry',()=>{
 const ids=new Set(),names=new Set();
 for(const event of events){
  assert.equal(sanitizeProjectFileName(event.raceRef),event.raceRef,'race references survive the editor storage sanitizer');
  assert.equal(manifest.folders.races[event.raceRef],event.documentPath);
  const {race}=read('data/server-storage/files/'+event.documentPath);
  assert.equal(race.name,event.raceRef);assert.ok(!ids.has(race.id));ids.add(race.id);
  assert.ok(!names.has(race.name));names.add(race.name);
  assert.ok(race.source.osmWayIds.length>0||race.source.geometryMethod==='hand-authored-fictional',event.id+' has mapped IDs or explicit fictional provenance');
  assert.ok(race.road.nodes.length>=2);
  assert.equal(race.road.segments.length,race.road.nodes.length-1);
  for(const p of race.road.nodes)for(const key of ['x','y','elevation'])assert.ok(Number.isFinite(p[key]),event.id+' finite '+key);
  for(const p of race.road.segments){assert.ok(p.length>0);assert.ok(p.roadWidthM>=3&&p.roadWidthM<=30);}
  assert.equal(race.campaign.optional,true);
  assert.equal(race.campaign.hubStage,event.hubStage);
  assert.equal(race.finishBehavior.menuScreen,'world-map');
  assert.equal(race.mechanicalMission,undefined,'no cold-open mechanical script');
  assert.equal(race.raceStart,undefined,'no cold-open fuel/cutscene script');
  assert.deepEqual(race.triggers,[]);
  if(race.type==='destination')assert.equal(race.road.autoExtend,false);
  if(race.skyboxArtRef)assert.ok(manifest.folders.art[race.skyboxArtRef]);
  for(const t of [race.roadTextures.road,...Object.values(race.roadTextures.surfaceRoads||{})])assert.ok(manifest.folders.art[t.artRef],t.artRef);
  assert.ok(!mains.some(m=>m.name===race.name));
 }
});
