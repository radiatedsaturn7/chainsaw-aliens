import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceNetworkGeometry} from '../../src/racing/RaceNetworkGeometry.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const root='data/server-storage/files',manifest=read(`${root}/manifest.json`),menu=read(`${root}/menus/Game Menu/document.json`);
const keys=new Set(['silverstone','brands-hatch','spa','suzuka','monza','imola','bathurst','red-bull-ring','interlagos','tsukuba','fuji','donington','lemans','portimao','zandvoort','gilles-villeneuve','phillip-island']);
const rows=read('data/campaigns/america/raceways/catalog.json').filter(r=>keys.has(r.venueKey));
test('38 installed world layouts have finite closed roads, DEM terrain, saved location, previews and valid artwork',()=>{
 assert.equal(rows.length,38);assert.equal(new Set(rows.map(r=>r.raceRef)).size,38);
 for(const row of rows){
  assert.equal(manifest.folders.races[row.raceRef],row.documentPath);
  const r=read(`${root}/${row.documentPath}`).race;
  assert.equal(r.type,'circuit');assert.ok(r.laps>=2);assert.ok(!r.campaign?.hubStage,'do not place foreign circuits in US regions');
  assert.ok(r.location.country&&r.location.country!=='US');assert.ok(r.road.nodes.every(n=>[n.x,n.y,n.elevation].every(Number.isFinite)));
  assert.deepEqual([r.road.nodes[0].x,r.road.nodes[0].y],[r.road.nodes.at(-1).x,r.road.nodes.at(-1).y]);
  assert.ok(Object.keys(r.road.tileMap.cells).length>100);assert.ok(r.source.elevationProvider.includes('Mapzen'));
  assert.ok(menu.parameters.raceIndex.some(e=>e.ref===row.raceRef));assert.ok(menu.parameters.campaignRoutePreviews[row.raceRef].distanceM>500);
  for(const p of r.scenery)if(p.doodadRef)assert.ok(manifest.folders.doodads[p.doodadRef],p.doodadRef);
  for(const ref of [r.skyboxArtRef,r.groundPlaneArtRef,r.roadTextures?.road?.artRef])if(ref)assert.ok(manifest.folders.art[ref],ref);
 }
});
test('native editor resolves every layout to a complete lap, including Suzuka overpass routes',()=>{
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 for(const row of rows){
  const r=read(`${root}/${row.documentPath}`).race;editor.applyLoadedRaceDocument(r);
  const length=editor.getRaceRouteLength();assert.ok(length>row.lengthM*.94&&length<row.lengthM*1.06,`${row.raceRef}: ${length} vs ${row.lengthM}`);
  for(const d of [0,length*.25,length*.5,length*.75,length-.1]){const pose=editor.getRaceWorldPoseAtDistance(d);assert.ok([pose.x,pose.z,pose.yaw].every(Number.isFinite),row.raceRef);}
 }
});
test('Suzuka bridges produce separate layered road geometry with no planar intersection node',()=>{
 for(const key of ['full','west']){
  const row=rows.find(r=>r.id===`raceway-suzuka-${key}`),r=read(`${root}/${row.documentPath}`).race,net=r.road.network;
  const mesh=buildRaceNetworkGeometry(net);assert.ok(mesh.mesh.layered);assert.ok(net.edges.some(e=>e.structure==='bridge'));
  for(const c of r.source.gradeSeparation.crossings){assert.equal(net.edges[c.upperSegment].structure,'bridge');assert.equal(net.edges[c.lowerSegment].structure,'road');assert.notEqual(net.edges[c.upperSegment].from,net.edges[c.lowerSegment].from);}
 }
});
