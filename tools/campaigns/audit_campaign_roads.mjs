// Read-only runtime road mesh/surface coverage for every catalogued event.
// Full terrain baking is separately exercised by validate_loading.mjs.
import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceCanonicalSurfaceMesh} from '../../src/racing/RaceCanonicalSurfaceMesh.js';
import {buildRaceBakedSurfaceSampler,sampleRaceBakedSurface} from '../../src/racing/RaceBakedSurfaceSampler.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
fs.mkdirSync('artifacts/campaign-quality',{recursive:true});
const root='data/server-storage/files/',manifest=read(root+'manifest.json');
const names=[...new Set(['catalog.json','side-races/catalog.json','raceways/catalog.json'].flatMap(p=>read('data/campaigns/america/'+p)).map(r=>r.raceRef||r.name))];
const output='artifacts/campaign-quality/road-runtime.json',results=[];
for(const name of names){
 try{
  const doc=read(root+manifest.folders.races[name]);
  // Scenery has its own dependency/collision audit; don't load art or copy
  // tens of thousands of sprites just to inspect the road mesh.
  const race={...doc.race,scenery:[],sceneryDefinitions:[]};
  const editor=new RaceEditor({deviceIsMobile:true});editor.applyLoadedRaceDocument(race);
  const result=editor.withRaceGeometryReadCache(()=>{
   const bake=editor.getRaceSurfaceBake(),mesh=buildRaceCanonicalSurfaceMesh({surfaceBake:bake}),sampler=buildRaceBakedSurfaceSampler({mesh});
   const length=editor.getRaceRouteLength(),errors=[],misses=[];let probes=0;
   if(!(length>0))errors.push('No timed route');
   if(!mesh.triangles.length)errors.push('No road triangles');
   if(mesh.triangles.some(t=>t.vertices.some(v=>![v.x,v.z,v.elevation].every(Number.isFinite))))errors.push('Non-finite road geometry');
   // Non-grid positions avoid sitting exactly on triangle boundaries. Include
   // start/finish approaches and evenly spaced points throughout the course.
   const distances=[.1,Math.max(.1,length-.1)];for(let d=12.37;d<length;d+=83.17)distances.push(d);
   for(const d of distances){const p=editor.getRaceWorldPoseAtDistance(d),hit=sampleRaceBakedSurface(sampler,p);probes++;if(!hit)misses.push(d);}
   if(misses.length)errors.push(`No road contact at ${misses.length} sampled centerline positions`);
   return {name,lengthM:length,triangles:mesh.triangles.length,junctions:bake.junctions.length,probes,misses,errors};
  });results.push(result);console.log(JSON.stringify({name,errors:result.errors,probes:result.probes}));
 }catch(e){results.push({name,errors:[e.stack]});console.log(JSON.stringify({name,error:e.message}));}
 fs.writeFileSync(output,JSON.stringify({scope:'Runtime road-only render/physics mesh and sampled centerline coverage, not a full terrain or driven-lap test.',count:results.length,errors:results.filter(r=>r.errors.length).length,results},null,2)+'\n');
}
if(results.some(r=>r.errors.length))process.exitCode=1;
