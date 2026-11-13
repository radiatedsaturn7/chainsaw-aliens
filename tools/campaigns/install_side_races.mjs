import {dressImportedRace} from './dress_imported_race.mjs';
// Install successful imports only; never rewrite existing campaign races.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {sanitizeProjectFileName} from '../../src/ui/projectFiles.js';
import {createCampaignHubMenus} from '../../src/menus/CampaignHubMenus.js';
const root='data/server-storage/files',base='data/campaigns/america/side-races';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(p,d)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');};
const encode=d=>({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(d)),{level:9,mtime:0}).toString('base64')});
const catalog=read('data/campaigns/america/catalog.json'),research=read('AI/last-on-the-grid/last_on_the_grid_99_side_races.json');
const report=fs.existsSync(`${base}/report.json`)?read(`${base}/report.json`):[];
const manifest=read(`${root}/manifest.json`),installed=[],editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
const onlyArg=process.argv.find(a=>a.startsWith('--only='));
const only=onlyArg?new Set(onlyArg.slice(7).split(',')):null;
const previous=new Map(fs.existsSync(`${base}/catalog.json`)?read(`${base}/catalog.json`).map(e=>[e.id,e]):[]);
const savedAt=Date.now();
for(const row of report){
 if(row.status!=='imported'){installed.push(row);continue;}
 if(only&&!only.has(row.id)){const existing=previous.get(row.id);if(existing?.status!=='installed')throw Error(`Install ${row.id} before a partial refresh`);installed.push(existing);continue;}
 const race=read(row.generatedPath),hub=catalog.find(h=>h.stage===row.hubStage);
 const displayName=race.name;race.name=sanitizeProjectFileName(sanitizeProjectFileName(race.name));
 const parent=read(`${root}/${manifest.folders.races[hub.name]}`).race;
 const {lightingPreset}=dressImportedRace(race,row,parent,manifest,editor);
 const raceRef=race.name,folder=`races/${encodeURIComponent(raceRef).replace(/%20/g,' ').replace(/[!'*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`,documentPath=`${folder}/document.json`;
 const legacyFolder=`${root}/races/${encodeURIComponent(raceRef)}`;
 if(legacyFolder!==`${root}/${folder}`&&fs.existsSync(legacyFolder)&&!fs.existsSync(`${root}/${folder}`))fs.renameSync(legacyFolder,`${root}/${folder}`);
 write(`${root}/${documentPath}`,encode({schemaVersion:1,kind:'race-track',savedAt,selectedRaceId:race.id,race}));
 write(`${root}/${folder}/metadata.json`,{name:raceRef,folder:'races',savedAt,version:1});
 manifest.folders.races[raceRef]=documentPath;
 installed.push({...row,status:'installed',lightingPreset,raceRef,displayName,documentPath,hubRaceRef:hub.name,sceneryCount:race.scenery.length,installedSurfaces:[...new Set(race.road.segments.map(s=>s.surface))],conditionNotes:race.source.campaignConditions||''});
 console.log(`Installed ${row.id}: ${raceRef}`);
}
write(`${base}/catalog.json`,installed);
const menuPath=`${root}/menus/Game Menu/document.json`,menu=read(menuPath);
const racewaysPath='data/campaigns/america/raceways/catalog.json';
const allEvents=[...installed,...(fs.existsSync(racewaysPath)?read(racewaysPath):[])];
const {screens,hubs,sideGates}=createCampaignHubMenus(catalog,research,allEvents);
menu.screens=menu.screens.filter(s=>!s.id.startsWith('campaign-hub-')).concat(screens);
menu.parameters.campaignHubs=hubs;
menu.parameters.campaignEventHubs=Object.fromEntries(allEvents.filter(e=>e.status==='installed').map(e=>[e.raceRef,e.hubRaceRef]));
menu.parameters.campaignSideGates=sideGates;
const heading=menu.screens.find(s=>s.id==='world-map')?.elements.find(e=>e.id==='america-heading');
if(heading)heading.label=`MIDDLE ROUTE · ${catalog.length} LOCATIONS`;
write(menuPath,menu);write(`${root}/menus/Game Menu/metadata.json`,{...read(`${root}/menus/Game Menu/metadata.json`),savedAt});
const latestManifest=read(`${root}/manifest.json`);
for(const event of installed.filter(e=>e.status==='installed'))latestManifest.folders.races[event.raceRef]=event.documentPath;
write(`${root}/manifest.json`,latestManifest);
console.log(`${installed.filter(e=>e.status==='installed').length}/${research.hubs.flatMap(h=>h.races).length} side events installed; all ${catalog.length} main missions preserved.`);
