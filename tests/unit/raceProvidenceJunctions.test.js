import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {buildRaceTransferPackage} from '../../src/ui/raceWorldBakeWorker.js';
import {sampleRaceBakedSurface} from '../../src/racing/RaceBakedSurfaceSampler.js';
import {getRaceTerrainTriangleArea} from '../../src/racing/RaceTerrainClipping.js';

test('Providence worker preserves junction rendering and driveable shared height',async()=>{
 const root=new URL('../../data/server-storage/files/races/',import.meta.url);
 const folder=fs.readdirSync(root).find(n=>n.startsWith('Providence'));
 const stored=JSON.parse(fs.readFileSync(new URL(`${encodeURIComponent(folder)}/document.json`,root)));
 const document=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 const before=JSON.stringify(document.race.road.nodes);
 const result=await buildRaceTransferPackage(document.race,{includeArtAssets:false});
 const {header,packedSampler}=result;
 assert.equal(header.surfaceBake.junctions.length,2);
 assert.ok(header.mesh.triangles.length,'worker must transfer clipped geometry, not rebuild overlapping strips');
 for(const junction of header.surfaceBake.junctions){
  for(const dx of [-1.17,.37,1.23])for(const dz of [-1.31,.19,1.07]){
   const point={x:junction.x+dx,z:junction.z+dz};
   const surface=sampleRaceBakedSurface(packedSampler,point);
   assert.ok(surface,'physics coverage');
   assert.ok(Math.abs(surface.elevation-junction.elevation)*12<.01,'shared level crossing');
   const hits=header.mesh.triangles.filter(t=>{
    const points=t.vertices,area=getRaceTerrainTriangleArea(points);
    return Math.abs(points.reduce((sum,p,i)=>sum+getRaceTerrainTriangleArea([point,p,points[(i+1)%3]]),0)-area)<1e-7;
   });
   assert.equal(hits.length,1,'one visible road face, no overlapping shoulder');
   assert.equal(hits[0].region,'road');
  }
 }
 assert.equal(JSON.stringify(document.race.road.nodes),before,'race route and progression unchanged');
});
