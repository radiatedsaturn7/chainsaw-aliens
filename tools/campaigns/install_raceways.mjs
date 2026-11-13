// Reuse the side-event dressing and native menu system for reviewed circuit imports.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {sanitizeProjectFileName} from '../../src/ui/projectFiles.js';
import {dressImportedRace} from './dress_imported_race.mjs';
import {createCampaignHubMenus} from '../../src/menus/CampaignHubMenus.js';
const root='data/server-storage/files',base='data/campaigns/america/raceways';
const expansion=process.argv.includes('--state-expansion');
const reportBase=expansion?'data/campaigns/america/state-expansion':base;
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(p,d)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');};
const encode=d=>({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(d)),{level:9,mtime:0}).toString('base64')});
const main=read('data/campaigns/america/catalog.json'),side=read('data/campaigns/america/side-races/catalog.json'),manifest=read(`${root}/manifest.json`);
const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}}),savedAt=Date.now();
const previous=fs.existsSync(`${base}/catalog.json`)?read(`${base}/catalog.json`):[];
const installed=new Map(previous.map(e=>[e.id,e]));
const touchedRaces=new Map(),removedRaces=new Set();
for(const row of read(`${reportBase}/report.json`)){
 if(row.status!=='imported')continue;
 const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
 if(only&&!only.includes(row.venueKey||row.id))continue;
 if(row.city){row.name=`${row.city}, ${row.stateCode} — Landmark Run`;row.displayName=`${row.city}, ${row.stateCode}`;}
 const race=read(row.generatedPath);if(row.city)race.name=row.name;
 const hub=main.find(h=>h.stage===(row.hubStage||row.artHubStage||3));
 const parent=read(`${root}/${manifest.folders.races[hub.name]}`).race;
 if(row.city){
  const urban=[['expanded-abandoned-business-building',18,12],['expanded-unfinished-human-building',20,18],['expanded-robot-building',17,15],['data-center-city-server-building',23,16],['ohio-river-crossing-riverside-building',14,11],['roadside-streetlight',2,8],['data-center-city-shipping-container',6,3]];
  parent.scenery=urban.filter(([ref])=>manifest.folders.doodads[ref]).map(([doodadRef,widthM,heightM])=>({doodadRef,widthM,heightM,groundOffsetM:0}));
 }
 const raceRef=row.replaceRaceRef||sanitizeProjectFileName(sanitizeProjectFileName(race.name));race.name=raceRef;
 const priorPath=manifest.folders.races[raceRef];
 const prior=priorPath?read(`${root}/${priorPath}`).race:null;
 if(prior)race.id=prior.id;
 const {lightingPreset}=dressImportedRace(race,{...row,hubStage:hub.stage},parent,manifest,editor);
 if(prior?.competition)race.competition=structuredClone(prior.competition);
 if(prior?.campaign?.scoring&&race.campaign)race.campaign.scoring=prior.campaign.scoring;
 if(row.existingSideId&&race.campaign)race.campaign.sideEventId=row.existingSideId;
 if(prior&&!row.hubStage&&prior.weather)race.weather=prior.weather;
 // Independent editor/free-race imports must not claim a US campaign location.
 if(!row.hubStage)delete race.campaign;
 if(row.city){
  editor.applyLoadedRaceDocument(race);
  const origin=race.source.origin,R=6371008.8,rad=Math.PI/180;
  const landmarks=race.source.landmarkPlan.map(m=>{
   const x=(m.lon-origin.lon)*rad*R*Math.cos(origin.lat*rad),z=-(m.lat-origin.lat)*rad*R;
   const p=editor.getRaceRouteProjectionForWorldPoint({x,z});
   return {...m,routeDistanceM:Math.round(p.distance),routeMiles:Number((Math.round(p.distance)/1609.344).toFixed(2)),offsetFromRoadM:Math.round(Math.abs(p.lateral)),side:p.lateral<0?'left':'right',worldX:x,worldZ:z,artStatus:'landmark-specific artwork pending',suggestedArtRef:`landmark-${row.id}-${m.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,artBrief:'Recognizable road-facing landmark silhouette/facade, adapted to abandoned 2994 setting; transparent background. GPS position is a reference, not a guaranteed sightline.'};
  }).sort((a,b)=>a.routeDistanceM-b.routeDistanceM);
  race.source.landmarks=landmarks;
  race.source.landmarkNotesPath=`${reportBase}/landmarks/${row.stateCode}.json`;
  write(race.source.landmarkNotesPath,{raceRef,state:row.state,city:row.city,routeLengthM:editor.getRaceRouteLength(),distanceReference:'Native timed route from start line; nearest road projection. Landmark may be set back or obscured.',references:row.references,landmarks});
 }
 const documentPath=priorPath||`races/${encodeURIComponent(raceRef).replace(/%20/g,' ')}/document.json`;
 write(`${root}/${documentPath}`,encode({schemaVersion:1,kind:'race-track',savedAt,selectedRaceId:race.id,race}));
 const metaPath=`${root}/${documentPath.replace(/document.json$/,'metadata.json')}`;
 write(metaPath,{...(fs.existsSync(metaPath)?read(metaPath):{version:1}),name:raceRef,folder:'races',savedAt});
 manifest.folders.races[raceRef]=documentPath;touchedRaces.set(raceRef,documentPath);
 const superseded=installed.get(row.id);
 if(expansion&&/^(city|state)-/.test(row.id)&&superseded?.raceRef!==raceRef&&superseded?.documentPath){
  const oldPath=`${root}/${superseded.documentPath}`;
  // Only retire this importer's own superseded event document, never user races.
  if(fs.existsSync(oldPath)&&read(oldPath).race?.id===row.id){
   delete manifest.folders.races[superseded.raceRef];removedRaces.add(superseded.raceRef);
   fs.unlinkSync(oldPath);
   const oldMeta=oldPath.replace(/document.json$/,'metadata.json');if(fs.existsSync(oldMeta))fs.unlinkSync(oldMeta);
  }
 }
 const entry={...row,...(expansion?{location:{lat:race.source.origin.lat,lon:race.source.origin.lon}}:{}),status:'installed',raceRef,documentPath,lightingPreset,hubRaceRef:row.hubStage?hub.name:null,installedSurfaces:[...new Set(race.road.segments.map(s=>s.surface))],sceneryCount:race.scenery.length};
 if(row.existingSideId){
  const index=side.findIndex(e=>e.id===row.existingSideId);if(index<0)throw Error('Missing existing side event');
  side[index]={...side[index],...entry,id:row.existingSideId};
 }else installed.set(entry.id,entry);
 console.log(`Installed ${raceRef}`);
}
write(`${base}/catalog.json`,[...installed.values()]);
write('data/campaigns/america/side-races/catalog.json',side);
// Preserve assets uploaded while a long import was being dressed.
const latestManifest=read(`${root}/manifest.json`);
for(const [name,file] of touchedRaces)latestManifest.folders.races[name]=file;
for(const name of removedRaces)latestManifest.folders.races[name]&&delete latestManifest.folders.races[name];
write(`${root}/manifest.json`,latestManifest);
const menuPath=`${root}/menus/Game Menu/document.json`,menu=read(menuPath),research=read('AI/last-on-the-grid/last_on_the_grid_99_side_races.json');
const all=[...side,...installed.values()],{screens,hubs,sideGates}=createCampaignHubMenus(main,research,all);
menu.screens=menu.screens.filter(s=>!s.id.startsWith('campaign-hub-')).concat(screens);
Object.assign(menu.parameters,{campaignHubs:hubs,campaignSideGates:sideGates,campaignEventHubs:Object.fromEntries(all.filter(e=>e.status==='installed'&&e.hubRaceRef).map(e=>[e.raceRef,e.hubRaceRef]))});
write(menuPath,menu);
const menuMeta=menuPath.replace(/document.json$/,'metadata.json');write(menuMeta,{...read(menuMeta),savedAt});
