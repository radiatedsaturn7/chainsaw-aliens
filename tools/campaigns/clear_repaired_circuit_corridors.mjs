// Run after repair_circuit_spurs.py. Clear obsolete inferred barriers across
// restored source road; retain unrelated authored scenery and terrain.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {isRecceCutHazard} from '../../src/racing/RaceRecce.js';
const root='data/server-storage/files/',read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const manifest=read(root+'manifest.json');
for(const [name,relative] of Object.entries(manifest.folders.races)){
 if(!/^(Thompson Speedway|Podium Club|Virginia International Raceway.*South Course|Pittsburgh International|Ozarks International|NCM Motorsports)/.test(name))continue;
 const file=root+relative,doc=read(file),r=doc.race;if(!r.source?.circuitSpurRepair)continue;
 if(r.source.circuitSpurRepair.clearance)continue;
 const editor=new RaceEditor({deviceIsMobile:true});editor.applyLoadedRaceDocument({...r,scenery:[],sceneryDefinitions:[]});
 const result=editor.withRaceGeometryReadCache(()=>{
  const groups=new Set();let moved=0;
  const definition=s=>s.previewDoodad||r.sceneryDefinitions?.find?.(d=>d.id===s.doodadRef)||s;
  for(const s of r.scenery||[]){
   const def=definition(s);if(!isRecceCutHazard(s,def))continue;
   const p=editor.getRaceRouteProjectionForWorldPoint({x:s.x,z:s.z??s.y});
   const radius=s.fenceId ? .15 :Math.max(.1,Number(def.hitboxWidthM||s.widthM)||1.5)/2;
   const safe=editor.getRaceRoadHalfWidthWorld(p.segment)+radius+1;
   if(Math.hypot(s.x-p.x,(s.z??s.y)-p.z)>=safe)continue;
   if(s.fenceId){groups.add(s.fenceId);continue;}
   const pose=editor.getRaceWorldPoseAtDistance(p.distance),side=Math.sign(p.lateral)||1,right=editor.getRaceRightVector(pose.yaw);
   s.x=pose.x+right.x*safe*side;s.z=pose.z+right.z*safe*side;delete s.y;delete s.elevation;
   s.trackDistance=p.distance;s.trackLateral=side*safe;moved++;
  }
  const before=r.scenery.length;r.scenery=r.scenery.filter(s=>!groups.has(s.fenceId));
  return {lengthM:editor.getRaceRouteLength(),removedObsoleteFenceGroups:[...groups],removedPanels:before-r.scenery.length,relocatedSolidProps:moved};
 });
 r.source.circuitSpurRepair.clearance=result;doc.savedAt=Date.now();
 fs.writeFileSync(file,JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9}).toString('base64')},null,2)+'\n');
 const meta=file.replace(/document.json$/,'metadata.json');fs.writeFileSync(meta,JSON.stringify({...read(meta),savedAt:doc.savedAt},null,2)+'\n');
 console.log(name,result);
}
execFileSync('python',['tools/campaigns/repair_circuit_spurs.py','--catalogs-only'],{stdio:'inherit'});
