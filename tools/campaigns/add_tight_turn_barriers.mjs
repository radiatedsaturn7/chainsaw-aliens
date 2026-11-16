import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {addTightTurnBarriers} from './tight_turn_barriers.mjs';
const root='data/server-storage/files/',apply=process.argv.includes('--apply');
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const manifest=read(root+'manifest.json'),ref='roadside-metal-guardrail-intact';
const definition=read(root+manifest.folders.doodads[ref]).doodad;
if(!definition?.artRef)throw Error('Missing guardrail artwork');
const report=[];
for(const [name,relative] of Object.entries(manifest.folders.races)){
 if(only&&name!==only)continue;
 const file=root+relative,doc=read(file),race=doc.race;
 if(!race?.source?.importVersion||race.road?.network||race.road?.nodes?.length<4)continue;
 const editor=new RaceEditor({});editor.applyLoadedRaceDocument(doc);
 const before=JSON.stringify(race.scenery);
 const barriers=editor.withRaceGeometryReadCache(()=>{
  const sections=editor.getRaceSurfaceBake({step:2.5}).sections;
  return addTightTurnBarriers(race,sections,definition,{ref,roadside:{project:p=>editor.getRaceRouteProjectionForWorldPoint(p),pose:d=>editor.getRaceWorldPoseAtDistance(d),roadWidthM:race.road.width}});
 });
 const changed=JSON.stringify(race.scenery)!==before;
 if(apply&&changed){
  const stored=JSON.parse(fs.readFileSync(file));doc.savedAt=Date.now();
  if(stored.__chainsawStorage)stored.data=zlib.gzipSync(JSON.stringify(doc)).toString('base64');
  fs.writeFileSync(file,JSON.stringify(stored.__chainsawStorage?stored:doc,null,2)+'\n');
 }
 report.push({name,documentPath:relative,changed,barriers});
 console.log(JSON.stringify({name,barriers:barriers.length,panels:barriers.reduce((n,b)=>n+b.panels,0),changed,apply}));
}
fs.writeFileSync('data/campaigns/america/tight-turn-barriers-report.json',JSON.stringify(report,null,2)+'\n');
