// Audit the saved city runs through the runtime road bake, without rewriting
// imported route nodes, artwork, or progression data.
import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {getRaceTerrainTriangleArea} from '../../src/racing/RaceTerrainClipping.js';
import {buildRaceCanonicalSurfaceMesh} from '../../src/racing/RaceCanonicalSurfaceMesh.js';
import {buildRaceBakedSurfaceSampler,sampleRaceBakedSurface} from '../../src/racing/RaceBakedSurfaceSampler.js';
const root=new URL('../../',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('data/campaigns/america/raceways/catalog.json',root)));
const selected=process.argv.find(a=>a.startsWith('--city='))?.slice(7);
const results=[];
for(const row of catalog.filter(r=>r.id.startsWith('city-')&&(!selected||r.id===selected))){
 let doc=JSON.parse(fs.readFileSync(new URL(`data/server-storage/files/${row.documentPath.replaceAll('%','%25')}`,root)));
 if(doc.__chainsawStorage)doc=JSON.parse(zlib.gunzipSync(Buffer.from(doc.data,'base64')));
 const editor=new RaceEditor({});editor.applyLoadedRaceDocument(doc);
 const before=JSON.stringify(editor.selectedRace.road.nodes);
 const result=editor.withRaceGeometryReadCache(()=>{
  const bake=editor.getRaceSurfaceBake(),mesh=buildRaceCanonicalSurfaceMesh({surfaceBake:bake});
  const sampler=buildRaceBakedSurfaceSampler({mesh});
  const junctions=bake.junctions.map(j=>{
   let samples=0,largestHeightErrorM=0,lowestNormalY=1,maxSurfaceLayers=0;
   const local=mesh.triangles.filter(t=>t.vertices.some(p=>Math.hypot(p.x-j.x,p.z-j.z)<j.radius+10));
   for(let x=-3.17;x<3;x+=1)for(let z=-3.11;z<3;z+=1){
    const hit=sampleRaceBakedSurface(sampler,{x:j.x+x,z:j.z+z});
    if(!hit)continue; // Not every skewed/T junction covers a square footprint.
    samples++;
    const point={x:j.x+x,z:j.z+z};
    const layers=local.filter(t=>{
     const p=t.vertices,area=getRaceTerrainTriangleArea(p);
     return Math.abs(p.reduce((sum,v,i)=>sum+getRaceTerrainTriangleArea([point,v,p[(i+1)%3]]),0)-area)<1e-7;
    }).length;
    maxSurfaceLayers=Math.max(maxSurfaceLayers,layers);
    largestHeightErrorM=Math.max(largestHeightErrorM,Math.abs(hit.elevation-j.elevation)*12);
    lowestNormalY=Math.min(lowestNormalY,hit.normal?.y??1);
   }
   return {kind:j.kind,x:j.x,z:j.z,heightM:j.elevation*12,branches:j.branches.length,
    routeDistancesM:j.branches.map(b=>bake.sections[b.first].center.distance),samples,largestHeightErrorM,lowestNormalY,maxSurfaceLayers};
  });
  assert.equal(JSON.stringify(editor.selectedRace.road.nodes),before,'Imported road/progression geometry must remain unchanged');
  return {id:row.id,name:row.name,junctions};
 });
 results.push(result);
 console.log(`${row.id}: ${result.junctions.length} junctions (${result.junctions.filter(j=>j.kind==='shared-turn').length} shared turns)`);
}
const report={cityCount:results.length,junctionCount:results.reduce((n,r)=>n+r.junctions.length,0),
 sharedTurnCount:results.reduce((n,r)=>n+r.junctions.filter(j=>j.kind==='shared-turn').length,0),races:results};
const failures=results.flatMap(r=>r.junctions.flatMap(j=>
 j.samples===0||j.maxSurfaceLayers>1||j.largestHeightErrorM>.01||j.lowestNormalY<.99
 ?[{city:r.id,x:j.x,z:j.z,...j}]:[]));
report.passed=failures.length===0;
report.failures=failures;
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cities:report.cityCount,junctions:report.junctionCount,sharedTurns:report.sharedTurnCount}));

assert.equal(failures.length,0,JSON.stringify(failures));
