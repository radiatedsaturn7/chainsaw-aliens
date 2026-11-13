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

test('side races save varied lighting and the Pawtucket highway keeps full lane widths',()=>{
 const lighting=new Set();
 for(const event of events){
  const {race}=read('data/server-storage/files/'+event.documentPath);
  lighting.add(race.visualFx.preset);
  assert.equal(race.visualFx.skyBrightness,1);
  assert.equal(race.timeOfDay,race.visualFx.preset==='night'?'night':'day');
 }
 assert.equal(lighting.size,4);
 const event=events.find(e=>e.id==='H01-S01');
 const {race}=read('data/server-storage/files/'+event.documentPath);
 assert.ok(event.lengthM>11000,'fast highway route must be longer than the original 3.7 km');
 assert.equal(race.visualFx.preset,'noon');assert.equal(race.brightness,1);
 assert.ok(race.road.segments.every(s=>s.roadWidthM>11&&s.roadWidthM<20));
 assert.equal(race.roadTextures.surfaceRoads.asphalt.laneWidthM,3.6576);
});

test('Pawtucket sprint runs south through both I-95 curve areas and stays on motorway geometry',()=>{
 const event=events.find(e=>e.id==='H01-S01'),{race}=read('data/server-storage/files/'+event.documentPath);
 const source=read(race.source.sourceSnapshot),ways=source.filter(w=>race.source.osmWayIds.includes(w.id));
 assert.ok(ways.length>20);
 for(const w of ways){assert.equal(w.tags.highway,'motorway');assert.ok(w.tags.ref.split(';').includes('I 95'));}
 assert.ok(event.startGps.lat>41.9);assert.ok(event.finishGps.lat<41.79);
 assert.ok(event.estimatedDrivingSeconds>280&&event.estimatedDrivingSeconds<400);
 const origin=race.source.origin,R=6371008.8,rad=Math.PI/180;
 const xy=p=>({x:(p.lon-origin.lon)*rad*R*Math.cos(origin.lat*rad),y:-(p.lat-origin.lat)*rad*R});
 const edges=ways.flatMap(w=>w.geometry.slice(1).map((p,i)=>[xy(w.geometry[i]),xy(p)]));
 const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
 for(const p of race.road.nodes)assert.ok(Math.min(...edges.map(([a,b])=>distance(p,a,b)))<5,'node remains within 5m of imported I-95');
 for(const lat of [41.876,41.797])assert.ok(race.road.nodes.some(p=>Math.abs(origin.lat-p.y/R/rad-lat)<.001),'covers curve latitude '+lat);
});
