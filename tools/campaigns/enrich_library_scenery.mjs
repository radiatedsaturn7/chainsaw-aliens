import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {layerRoadside} from './layered_roadside.mjs';
import {enrichRaceScenery} from './enrich_race_scenery.mjs';
const layered=process.argv.includes('--layered');
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const root='data/server-storage/files/';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const manifest=read(root+'manifest.json'),defs=new Map(),report=[];
const definition=ref=>{if(!defs.has(ref))defs.set(ref,manifest.folders.doodads[ref]?read(root+manifest.folders.doodads[ref]).doodad:null);return defs.get(ref);};
const write=(file,doc)=>{
 const old=JSON.parse(fs.readFileSync(file));
 fs.writeFileSync(file,JSON.stringify(old.__chainsawStorage?{...old,data:zlib.gzipSync(JSON.stringify(doc),{level:9}).toString('base64')}:doc,null,2)+'\n');
};
for(const [name,relative] of Object.entries(manifest.folders.races)){
 if(only&&name!==only)continue;
 const file=root+relative,doc=read(file),race=doc.race;
 if((race.road?.nodes?.length||0)<4){report.push({name,status:'no-mapped-route'});continue;}
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);
 const result=editor.withRaceGeometryReadCache(()=>{
  const tile=race.road.tileMap,length=editor.getRaceRouteLength(),planeOnly=Object.keys(tile?.cells||{}).length===0;
  return (layered?layerRoadside:enrichRaceScenery)(race,{length,definition,pose:d=>editor.getRaceWorldPoseAtDistance(d),project:p=>editor.getRaceRouteProjectionForWorldPoint(p),ground:(p,h)=>editor.getRaceRawGroundElevationAtWorldPoint(p,h),hasGround:(x,z)=>{
   const cell=tile?.cells?.[`${Math.floor(x/tile.cellSizeM)},${Math.floor(z/tile.cellSizeM)}`];
   return (Boolean(cell)||planeOnly)&&!/water|river|lake/.test(cell?.tileId||tile?.defaultTileId||'');
  }});
 });
 if(result.added||result.addedProps||result.railPanels){
  race.source||={};race.source[layered?'layeredRoadside':'sceneryCoverage']={version:layered?2:1,description:layered?'Fourfold roadside coverage: cleared verge, shrub transition and clustered regional canopy; sparse inside-apex hazards.':'Regional gap filling and inferred safety rails, not a survey of actual roadside barriers.',...result};
  doc.savedAt=Date.now();write(file,doc);
  const meta=file.replace('document.json','metadata.json');if(fs.existsSync(meta)){const m=read(meta);m.savedAt=doc.savedAt;write(meta,m);}
 }
 report.push({name,...result});
 if(report.length%10===0)console.log(`Checked ${report.length} races`);
}
fs.writeFileSync(`data/campaigns/america/${layered?'layered-roadside':'scenery-coverage'}${only?'-sample':''}-report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({races:report.length,changed:report.filter(r=>r.added||r.addedProps||r.railPanels).length,props:report.reduce((n,r)=>n+(r.added||r.addedProps||0),0),rails:report.reduce((n,r)=>n+(r.railSections||0),0)}));

if(layered&&!only)execFileSync(process.execPath,['tools/campaigns/verify_apex_hazards.mjs'],{stdio:'inherit'});
