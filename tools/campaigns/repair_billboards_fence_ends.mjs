import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {hydrateSceneryDefinitions,collectSceneryArtRefs} from '../../src/racing/RaceSceneryAssets.js';
import {buildRaceFencePlacements,flareRoadsideFenceEnds} from '../../src/racing/RaceFences.js';
const root='data/server-storage/files/';
const restoreRef=process.argv.find(a=>a.startsWith('--restore-fences-from='))?.split('=')[1];
const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;
const read=file=>{const d=JSON.parse(fs.readFileSync(file));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const manifest=read(root+'manifest.json'),definitions=new Map(),missing=new Map(),report=[];
const definition=ref=>{if(!definitions.has(ref))definitions.set(ref,manifest.folders.doodads[ref]?read(root+manifest.folders.doodads[ref]):null);return definitions.get(ref);};
const write=(file,doc)=>{const old=JSON.parse(fs.readFileSync(file));fs.writeFileSync(file,JSON.stringify(old.__chainsawStorage?{...old,data:zlib.gzipSync(JSON.stringify(doc),{level:9}).toString('base64')}:doc,null,2)+'\n');};
function reconstruct(panels){
 const points=[];
 for(const p of panels){const dx=-Math.cos(p.yaw)*p.widthM/2,dz=Math.sin(p.yaw)*p.widthM/2,a={x:p.x-dx,z:p.z-dz},b={x:p.x+dx,z:p.z+dz};
  if(points.length&&Math.hypot(points.at(-1).x-a.x,points.at(-1).z-a.z)>.1)return null;
  if(!points.length)points.push(a);points.push(b);
 }return points;
}
for(const [name,relative] of Object.entries(manifest.folders.races)){
 const file=root+relative,doc=read(file),race=doc.race;if(!race?.scenery)continue;
 let restored=0,mirroredLights=0;
 if(restoreRef&&race.source?.roadsideOrientationVersion!==2&&race.scenery.some(p=>p.fencePath?.endFlared)){
  const previous=decode(JSON.parse(execFileSync('git',['show',`${restoreRef}:${file}`],{maxBuffer:100*1024*1024}))).race;
  const ids=new Set(race.scenery.filter(p=>p.fencePath?.endFlared).map(p=>p.fenceId));
  const oldGroups=new Map();for(const p of previous.scenery||[])if(ids.has(p.fenceId)){if(!oldGroups.has(p.fenceId))oldGroups.set(p.fenceId,[]);oldGroups.get(p.fenceId).push(p);}
  for(const id of ids)if(!oldGroups.has(id))throw new Error(`Missing original fence ${name}: ${id}`);
  race.scenery=race.scenery.filter(p=>!ids.has(p.fenceId));for(const panels of oldGroups.values())race.scenery.push(...panels);
  restored=ids.size;
 }
 const before=race.sceneryDefinitions?.length||0;
 const missingDefs=await hydrateSceneryDefinitions(race,ref=>definition(ref));
 for(const ref of missingDefs){if(!missing.has('doodad:'+ref))missing.set('doodad:'+ref,[]);missing.get('doodad:'+ref).push(name);}
 for(const ref of collectSceneryArtRefs(race))if(!manifest.folders.art[ref]||!fs.existsSync(root+manifest.folders.art[ref])){if(!missing.has(ref))missing.set(ref,[]);missing.get(ref).push(name);}
 const addedDefinitions=race.sceneryDefinitions.length-before,groups=new Map(),changed=new Map();let skipped=0;
 for(const p of race.scenery)if(p.fenceId){if(!groups.has(p.fenceId))groups.set(p.fenceId,[]);groups.get(p.fenceId).push(p);}
 if((groups.size||race.scenery.some(p=>/streetlight/.test(p.doodadRef||p.artRef||'')))&&(race.road?.nodes?.length||0)>1){
  const editor=new RaceEditor({});editor.applyLoadedRaceDocument(race);
  editor.withRaceGeometryReadCache(()=>{
   const tile=race.road.tileMap,hasTiles=Object.keys(tile?.cells||{}).length>0,project=p=>editor.getRaceRouteProjectionForWorldPoint(p),pose=d=>editor.getRaceWorldPoseAtDistance(d);
   const roadside={project,pose,roadWidthM:race.road.width,validPoint:(p,base)=>{
    if(Math.hypot(p.x-base.x,p.z-base.z)<.01)return true;
    const q=project(p);if(pose(q.distance)?.segment?.bridge)return false;
    const cell=tile?.cells?.[`${Math.floor(p.x/tile.cellSizeM)},${Math.floor(p.z/tile.cellSizeM)}`];
    if(hasTiles&&!cell)return false;
    if(/water|river|lake/.test(cell?.tileId||tile?.defaultTileId||''))return false;
    const a=editor.getRaceRawGroundElevationAtWorldPoint(base,0),b=editor.getRaceRawGroundElevationAtWorldPoint(p,a);
    return Math.abs(a-b)*12<=Math.max(.5,Math.hypot(p.x-base.x,p.z-base.z)*.6);
   }};
   for(const p of race.scenery)if(/streetlight/.test(p.doodadRef||p.artRef||'')){
    const q=project(p),flipX=q.lateral<0;if(p.flipX!==flipX){p.flipX=flipX;mirroredLights++;}
   }
   for(const [id,panels] of groups){
    const first=panels.find(p=>p.fencePath)||panels[0],path=first.fencePath;
    if(path?.endFlared)continue;
    const points=path?.points||reconstruct(panels);if(!points){skipped++;continue;}
    const flared=flareRoadsideFenceEnds(points,roadside);if(!flared.changed)continue;
    const def=path?.definition||{...editor.getRaceDoodadForScenery(first),widthM:first.widthM/Math.max(.00001,first.fenceU1-first.fenceU0)};
    const rebuilt=buildRaceFencePlacements(flared.points,def,{id,ref:path?.ref||first.doodadRef,endFlared:true});
    for(const p of rebuilt){const q=project(p);p.trackDistance=q.distance;p.trackLateral=q.lateral;}
    changed.set(id,rebuilt);
   }
  });
 }
 if(changed.size){race.scenery=race.scenery.filter(p=>!changed.has(p.fenceId));for(const panels of changed.values())for(const p of panels)race.scenery.push(p);}
 if(addedDefinitions||changed.size||restored||mirroredLights){race.source||={};race.source.roadsideOrientationVersion=2;doc.savedAt=Date.now();write(file,doc);const meta=file.replace('document.json','metadata.json');if(fs.existsSync(meta)){const d=read(meta);d.savedAt=doc.savedAt;write(meta,d);}}
 report.push({name,addedDefinitions,restored,mirroredLights,flaredFences:race.scenery.filter(p=>p.fencePath?.endFlared).length,disconnectedLegacyFences:skipped});if(report.length%10===0)console.log('Checked '+report.length+' races');
}
fs.mkdirSync('ai',{recursive:true});
fs.writeFileSync('ai/needed-graphics.txt',missing.size?['Missing scenery graphics / definitions',...Array.from(missing,([ref,races])=>`\n${ref}\nUsed by: ${races.join('; ')}\nCreate transparent-background roadside scenery artwork using this exact saved asset name.`)].join('\n')+'\n':'No missing scenery artwork references found in the saved race library.\nThe green rectangles were caused by artwork preloading missing indirect doodad references, not absent images.\nNo new graphics are requested by this audit.\n');
fs.writeFileSync('data/campaigns/america/scenery-art-fence-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({races:report.length,missing:missing.size,definitions:report.reduce((n,r)=>n+r.addedDefinitions,0),flaredFences:report.reduce((n,r)=>n+r.flaredFences,0)}));
