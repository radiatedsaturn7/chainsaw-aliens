// Install successful imports only; never rewrite existing campaign races.
import fs from 'node:fs';
import {applySideRaceLighting} from './side_race_lighting.mjs';
import path from 'node:path';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {sanitizeProjectFileName} from '../../src/ui/projectFiles.js';
import {createCampaignHubMenus} from '../../src/menus/CampaignHubMenus.js';
import {authorRaceContinuations} from './author_continuations.mjs';
import {analyzeRaceDrivingRoute,racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';
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
 for(const key of ['brightness','visualFx','skyboxArtRef','skyboxSettings','groundPlaneArtRef'])if(parent[key]!==undefined)race[key]=structuredClone(parent[key]);
 const lightingPreset=applySideRaceLighting(race,row.id);
 if(['H08-S08','H11-S07','H11-S08'].includes(row.id))race.campaign.scoring='drift';
 race.margin={marginMode:'hidden'};
 race.road.autoExtend=false;
 race.road.groundTiles=structuredClone(parent.road.groundTiles);
 race.road.tileMap.defaultTileId=parent.road.tileMap.defaultTileId;
 for(const cell of Object.values(race.road.tileMap.cells))cell.tileId=race.road.tileMap.defaultTileId;
 race.roadTextures={builtInLines:false,road:{artRef:'road-asphalt-patched',repeatM:24,filterMode:'balanced',mipmaps:true},
  surfaceRoads:Object.fromEntries([['asphalt','road-asphalt-patched'],['gravel','road-gravel-gray'],['dirt','road-dirt-packed'],['snow','snowroad']].filter(([,ref])=>manifest.folders.art[ref]).map(([surface,artRef])=>[surface,{artRef,repeatM:12,filterMode:'balanced',mipmaps:true}]))};
 if(['H01-S01','H06-S04','H06-S05'].includes(row.id)){
  const highway={artRef:'road-asphalt-worn',repeatM:12,laneWidthM:3.6576,filterMode:'balanced',mipmaps:true};
  race.roadTextures.road={...highway};race.roadTextures.surfaceRoads.asphalt={...highway};
 }
 // A regional art palette is shared, not the boss's scripts or geometry.
 race.weather=row.event_type.toLowerCase().includes('snow')?'snow':'clear';
 if(race.weather==='snow'){
  race.weatherIntensity=.25;race.weatherTemperatureC=-4;
  for(const segment of race.road.segments)segment.surface='snow';
 }
 if(row.id==='H05-S05'){
  for(const [i,segment] of race.road.segments.entries())if(i%5===3){segment.surface='gravel';segment.bumpiness=.09;}
  race.source.campaignConditions='Fictional 2994 damage exposes gravel in intermittent sections of the mapped paved NN access road; geometry is unchanged.';
 }
 race.source.elevationSmoothingRadiusM=45;
 Object.assign(race.source,{shoulderFlatJoinM:8,shoulderBlendWidthM:32,shoulderMaxSlope:.22});
 if(race.type==='destination')authorRaceContinuations(race);
 editor.applyLoadedRaceDocument(race);
 const length=editor.getRaceRouteLength();
 const props=[...new Map((parent.scenery||[]).filter(p=>p.doodadRef&&p.widthM<35).map(p=>[p.doodadRef,p])).values()];
 let seed=row.hubStage*713+Number(row.id.slice(-2));const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let d=40;props.length&&d<length-30;d+=45){
  const pose=editor.getRaceWorldPoseAtDistance(d);
  for(const side of [-1,1]){
   const source=props[Math.floor(random()*props.length)],offset=side*(22+random()*75+source.widthM/2);
   const x=pose.x+Math.cos(pose.yaw)*offset,z=pose.z-Math.sin(pose.yaw)*offset;
   const projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
   if(Math.abs(projection.lateral)<race.road.width/2+8+source.widthM/2)continue;
   const prop={...structuredClone(source),id:`${race.id}-prop-${race.scenery.length}`,x,z,yaw:pose.yaw,trackDistance:projection.distance,trackLateral:projection.lateral,groundOffsetM:0};
   delete prop.y;delete prop.elevation;
   race.scenery.push(prop);
  }
 }
 const asphalt=race.road.segments.filter(s=>s.surface==='asphalt').length>race.road.segments.length/2;
 const decals=(parent.decals||[]).filter(d=>d.artRef&&(asphalt?/crack|patch|tire|oil/:/gravel|dirt|rut/).test(d.artRef));
 for(let d=90;decals.length&&d<length-30;d+=180){
  const pose=editor.getRaceWorldPoseAtDistance(d),decal=decals[Math.floor(random()*decals.length)];
  race.decals.push({...structuredClone(decal),id:`${race.id}-decal-${race.decals.length}`,x:pose.x,z:pose.z,rotation:pose.yaw});
 }
 editor.applyLoadedRaceDocument(race);
 race.codriver={enabled:false,spoken:false,calls:racePaceNotes(race,analyzeRaceDrivingRoute(editor))};
 race.drivingGuide={line:true};
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
const {screens,hubs}=createCampaignHubMenus(catalog,research,installed);
menu.screens=menu.screens.filter(s=>!s.id.startsWith('campaign-hub-')).concat(screens);
menu.parameters.campaignHubs=hubs;
menu.parameters.campaignEventHubs=Object.fromEntries(installed.filter(e=>e.status==='installed').map(e=>[e.raceRef,e.hubRaceRef]));
menu.parameters.campaignSideGates={'campaign-hub-1-core':catalog[0].name,'campaign-hub-1-detours':catalog[0].name};
const heading=menu.screens.find(s=>s.id==='world-map')?.elements.find(e=>e.id==='america-heading');
if(heading)heading.label=`MIDDLE ROUTE · ${catalog.length} LOCATIONS`;
write(menuPath,menu);write(`${root}/menus/Game Menu/metadata.json`,{...read(`${root}/menus/Game Menu/metadata.json`),savedAt});
const latestManifest=read(`${root}/manifest.json`);
for(const event of installed.filter(e=>e.status==='installed'))latestManifest.folders.races[event.raceRef]=event.documentPath;
write(`${root}/manifest.json`,latestManifest);
console.log(`${installed.filter(e=>e.status==='installed').length}/${research.hubs.flatMap(h=>h.races).length} side events installed; all ${catalog.length} main missions preserved.`);
