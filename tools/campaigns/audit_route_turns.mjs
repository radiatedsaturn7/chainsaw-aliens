// Read-only catalog-wide recce checks plus road contact for repaired circuits.
import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {analyzeRaceRecce} from '../../src/racing/RaceRecce.js';
import {buildRaceCanonicalSurfaceMesh} from '../../src/racing/RaceCanonicalSurfaceMesh.js';
import {buildRaceBakedSurfaceSampler,sampleRaceBakedSurface} from '../../src/racing/RaceBakedSurfaceSampler.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const root='data/server-storage/files/',rows=[];
for(const [name,path] of Object.entries(read(root+'manifest.json').folders.races)){
 try{
  const r=read(root+path).race;if(!r)continue;
  const editor=new RaceEditor({deviceIsMobile:true});
  editor.applyLoadedRaceDocument({...r,scenery:[],sceneryDefinitions:[]});
  const row=editor.withRaceGeometryReadCache(()=>{
   const length=editor.getRaceRouteLength(),notes=analyzeRaceRecce(editor),errors=[];
   for(const n of notes)if(!Number.isFinite(n.at)||n.at<0||n.at>length+1||n.direction&&(!Number.isFinite(n.recce?.steeringDeg)||n.severity<1||n.severity>6))errors.push('Invalid recce call');
   let probes=0,triangles=0;
   if(r.source?.circuitSpurRepair){
    const mesh=buildRaceCanonicalSurfaceMesh({surfaceBake:editor.getRaceSurfaceBake()}),sampler=buildRaceBakedSurfaceSampler({mesh});triangles=mesh.triangles.length;
    for(let d=.1;d<length;d+=7.31){probes++;if(!sampleRaceBakedSurface(sampler,editor.getRaceWorldPoseAtDistance(d)))errors.push(`No road at ${d}`);}
    if(mesh.triangles.some(t=>t.vertices.some(v=>![v.x,v.z,v.elevation].every(Number.isFinite))))errors.push('Nonfinite road');
   }
   return {name,length,notes:notes.length,turns:notes.filter(n=>n.direction).length,probes,triangles,errors};
  });rows.push(row);console.log(JSON.stringify(row));
 }catch(e){rows.push({name,errors:[e.stack]});console.log(name,e.message);}
 fs.mkdirSync('artifacts/route-review',{recursive:true});fs.writeFileSync('artifacts/route-review/runtime-audit.json',JSON.stringify({scope:'All saved races, scenery-free recce; repaired circuit road-mesh contact. Not a driven-lap test.',count:rows.length,failures:rows.filter(r=>r.errors.length).length,rows},null,2));
}
if(rows.some(r=>r.errors.length))process.exitCode=1;
