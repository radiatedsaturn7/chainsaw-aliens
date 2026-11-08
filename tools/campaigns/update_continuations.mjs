import fs from 'node:fs';
import zlib from 'node:zlib';
import {authorRaceContinuations,fixProvidenceStart} from './author_continuations.mjs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {analyzeRaceDrivingRoute,racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';
const catalog=JSON.parse(fs.readFileSync('data/campaigns/america/catalog.json'));
const root='data/server-storage/files/races';
const names=new Set(catalog.map(s=>s.name));
const dirs=fs.readdirSync(root).filter(dir=>names.has(dir)||dir.startsWith('Mount Washington Auto Road'));
for(const dir of dirs){
 const file=`${root}/${dir}/document.json`,stored=JSON.parse(fs.readFileSync(file));
 const doc=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 const race=doc.race,corrected=fixProvidenceStart(race);
 authorRaceContinuations(race);
 if(corrected){
   const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);
   race.codriver.calls=racePaceNotes(race,analyzeRaceDrivingRoute(editor));
   const stage=catalog.find(s=>s.name===dir);if(stage)stage.lengthM=editor.getRaceRouteLength();
 }
 doc.savedAt=Date.now();
 fs.writeFileSync(file,JSON.stringify(stored.__chainsawStorage?{...stored,data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9}).toString('base64')}:doc,null,2)+'\n');
 const metaFile=`${root}/${dir}/metadata.json`,meta=JSON.parse(fs.readFileSync(metaFile));meta.savedAt=doc.savedAt;fs.writeFileSync(metaFile,JSON.stringify(meta,null,2)+'\n');
 const stage=catalog.find(s=>s.name===dir),artifact=stage?`artifacts/campaign-import/america/${stage.id}.json`:null;
 if(artifact&&fs.existsSync(artifact))fs.writeFileSync(artifact,JSON.stringify(race,null,2)+'\n');
 console.log(`${dir}: 400 m approach/runout; bends ${race.road.continuations.startTurnDegrees}/${race.road.continuations.finishTurnDegrees} degrees${corrected?' — start spur removed':''}`);
}
fs.writeFileSync('data/campaigns/america/catalog.json',JSON.stringify(catalog,null,2)+'\n');
