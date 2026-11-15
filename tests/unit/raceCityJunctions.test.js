import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceTransferPackage} from '../../src/ui/raceWorldBakeWorker.js';
import {sampleRaceBakedSurface} from '../../src/racing/RaceBakedSurfaceSampler.js';
import {getRaceTerrainTriangleArea} from '../../src/racing/RaceTerrainClipping.js';

function loadCity(id){
 const catalog=JSON.parse(fs.readFileSync(new URL('../../data/campaigns/america/raceways/catalog.json',import.meta.url)));
 const row=catalog.find(r=>r.id===id);
 let doc=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/',import.meta.url).pathname+row.documentPath));
 if(doc.__chainsawStorage)doc=JSON.parse(zlib.gunzipSync(Buffer.from(doc.data,'base64')));
 return doc;
}
function contains(point,triangle){
 const a=getRaceTerrainTriangleArea(triangle);
 return Math.abs(triangle.reduce((sum,p,i)=>sum+getRaceTerrainTriangleArea([point,p,triangle[(i+1)%3]]),0)-a)<1e-7;
}
test('Burlington rounded shared intersection has one level rendered and physical road through worker transfer',async()=>{
 const document=loadCity('city-vt'),editor=new RaceEditor({});editor.applyLoadedRaceDocument(document);
 const originalNodes=JSON.stringify(document.race.road.nodes);
 const before=editor.withRaceGeometryReadCache(()=>[2555,6245].map(d=>editor.getRaceRoadSurfaceProfileAtDistance(d).elevation*12));
 assert.ok(Math.abs(before[0]-before[1])>.5,'fixture reproduces the mismatched road heights');
 // Scenery is irrelevant to this geometry regression; omit its external artwork requests.
 const race=structuredClone(document.race);race.scenery=[];race.sceneryDefinitions=[];
 const {header,packedSampler}=await buildRaceTransferPackage(race,{includeArtAssets:false});
 const junction=header.surfaceBake.junctions.find(n=>n.kind==='shared-turn'&&Math.hypot(n.x-818,n.z-71)<8);
 assert.ok(junction,'non-crossing turn footprints form a junction');
 assert.equal(junction.branches.length,2);
 const local=header.mesh.triangles.filter(t=>t.vertices.some(p=>Math.hypot(p.x-junction.x,p.z-junction.z)<18));
 for(let dx=-3.17;dx<3;dx+=.5)for(let dz=-3.11;dz<3;dz+=.5){
  const point={x:junction.x+dx,z:junction.z+dz};
  const hits=local.filter(t=>contains(point,t.vertices));
  assert.equal(hits.length,1,'one visible triangle; no buried road/shoulder duplicates');
  assert.equal(hits[0].region,'road');
  const surface=sampleRaceBakedSurface(packedSampler,point);
  assert.ok(surface,'continuous physics coverage');
  assert.ok(Math.abs(surface.elevation-junction.elevation)*12<.01,'no vertical step between visits');
  assert.ok(surface.normal.y>.999,'no contact-normal kick inside junction');
 }
 // Follow both passages, including the smoothed approaches. Junction repair
 // must not create an abrupt height seam where the flattened patch ends.
 for(const [start,end] of [[2510,2600],[6200,6290]]){
  let last;
  editor.withRaceGeometryReadCache(()=>{
   for(let d=start;d<=end;d+=.25){
    const p=editor.getRaceWorldPoseAtDistance(d),hit=sampleRaceBakedSurface(packedSampler,p);
    assert.ok(hit,`surface at ${d}m`);
    if(last!=null)assert.ok(Math.abs(hit.elevation-last)*12<.1,`height seam at ${d}m`);
    last=hit.elevation;
   }
  });
 }
 assert.equal(JSON.stringify(document.race.road.nodes),originalNodes);
});

test('Miami folded turn uses identical triangulation for clipping, render faces and physics',async()=>{
 const race=loadCity('city-fl').race;race.scenery=[];race.sceneryDefinitions=[];
 const {header,packedSampler}=await buildRaceTransferPackage(race,{includeArtAssets:false});
 const junction=header.surfaceBake.junctions.find(n=>n.kind==='shared-turn');assert.ok(junction);
 const point={x:391.1831325197824,z:-1285.90659367969};
 const hits=header.mesh.triangles.filter(t=>contains(point,t.vertices));
 assert.equal(hits.length,1,'regression point previously had three road faces');
 assert.equal(hits[0].region,'road');
 for(let dx=-1.13;dx<=1;dx+=.2)for(let dz=-1.17;dz<=1;dz+=.2){
  const p={x:point.x+dx,z:point.z+dz},hit=sampleRaceBakedSurface(packedSampler,p);
  assert.ok(hit);assert.ok(Math.abs(hit.elevation-junction.elevation)*12<.01);
  assert.ok(hit.normal.y>.999);
 }
});
