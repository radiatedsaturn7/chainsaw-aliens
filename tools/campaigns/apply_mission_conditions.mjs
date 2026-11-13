// Reapply event authoring without re-importing GPS or overwriting editor assets.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {analyzeRaceDrivingRoute,racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';
import {applyMissionConditions} from './mission_conditions.mjs';
const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;
const read=p=>decode(JSON.parse(fs.readFileSync(p)));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
export async function applySavedMissionConditions(){
 const catalogPath='data/campaigns/america/catalog.json',catalog=read(catalogPath);
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 const report=[];
 for(const stage of catalog){
  const file=path.join('data/server-storage/files',stage.documentPath),doc=read(file),race=doc.race;
  if(!applyMissionConditions(race))continue;
  editor.applyLoadedRaceDocument(race);
  race.codriver={...race.codriver,calls:racePaceNotes(race,analyzeRaceDrivingRoute(editor))};
  if(race.id==='america-middle-pikes'&&race.campaign){stage.startGps=race.campaign.startGps;stage.finishGps=race.campaign.finishGps;}
  stage.weather=race.weather;stage.recommendedParts=race.campaignChallenge.recommendedParts;
  stage.conditionBriefing=race.campaignChallenge.briefing;
  stage.conditionsAuthored=true;
  const surfaces={};for(const s of race.road.segments)surfaces[s.surface]=(surfaces[s.surface]||0)+s.length;
  stage.surface=Object.keys(surfaces).join(' / ');
  stage.durationMethod='Original geometry-based planning estimate; mission weather and damaged-road sections change actual pace. No measured lap time.';
  // Do not represent the condition-adjusted Mount Washington document as byte-preserved.
  if(stage.preserveExisting)stage.preservationNote='Existing geometry, scenery and race behavior retained; mission conditions and recce updated.';
  if(race.campaign)Object.assign(race.campaign,{weather:stage.weather,surface:stage.surface,durationMethod:stage.durationMethod});
  doc.savedAt=Date.now();
  write(file,{__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9,mtime:0}).toString('base64')});
  const metadata=file.replace(/document.json$/,'metadata.json');
  write(metadata,{...read(metadata),savedAt:doc.savedAt});
  report.push({stage:stage.stage,name:stage.label||stage.name,weather:race.weather,recommendedParts:stage.recommendedParts,
   briefing:stage.conditionBriefing,surfaceMeters:surfaces,roughnessRange:[Math.min(...race.road.segments.map(s=>s.bumpiness)),Math.max(...race.road.segments.map(s=>s.bumpiness))]});
  console.log(`Prepared ${stage.stage}: ${stage.name}`);
 }
 write(catalogPath,catalog);
 write('data/campaigns/america/mission-conditions-report.json',{limitations:[
  'Conditions use existing tire, suspension and wear physics. No equipment gates, artificial grip bonuses, or new damage multipliers.',
  'Recommendations are shop-available parts; this tool does not grant inventory or change purchase prices.',
  'Cooling, brake fade and skid-plate-only boss checks are not implemented. These stages use tire/suspension challenges that the current simulation supports.',
  'Geometry-based duration estimates predate these conditions. Full player laps are needed for final difficulty and timing balance.'
 ],stages:report});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await applySavedMissionConditions();
