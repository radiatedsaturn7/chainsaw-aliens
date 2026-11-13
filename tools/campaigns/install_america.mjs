import {applySavedMissionConditions} from './apply_mission_conditions.mjs';
// Install the single Middle Route, preserving the two existing opening races.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {prepareAmericaRace} from './prepare_america.mjs';
import {raceFxPreset} from '../../src/racing/RaceVisualFx.js';
import {createAmericaWorldMap, AMERICA_ROUTE_NAME} from '../../src/menus/AmericaWorldMap.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {analyzeRaceDrivingRoute,racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';
const source='data/campaigns/america',generated='artifacts/campaign-import/middle',root='data/server-storage/files';
const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;
const read=p=>decode(JSON.parse(fs.readFileSync(p)));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const encode=d=>({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(d)),{level:9,mtime:0}).toString('base64')});
const imported=read(`${source}/imported-middle.json`);
const specs=read('tools/campaigns/middle_route.json');
if(imported.length!==specs.length || imported.some((stage,i)=>stage.sourceKey!==specs[i].key))throw Error('Import every configured Middle Route stage in order before installation');
const manifestPath=`${root}/manifest.json`,manifest=read(manifestPath);
const existing=[['Tower Hill Road','Tower Hill Road',41.9964,-71.437],['Mount Washington Auto Road — point-to-point','Mount Washington Auto Road',44.271,-71.303]];
const opening=existing.map(([name,label,lat,lon],i)=>{
 const relative=manifest.folders.races[name];if(!relative)throw Error(`Missing preserved race ${name}`);
 const doc=read(`${root}/${relative}`),race=doc.race;
 return {id:race.id,branch:'middle',stage:i+1,difficulty:i+1,name,label,documentPath:relative,
  location:{lat,lon,place:i?'Mount Washington, New Hampshire':'Cumberland, Rhode Island'},lengthM:race.source.mappedLengthM,
  preserveExisting:true,estimatedDrivingSeconds:i?null:210,
  durationMethod:i?'Existing Mount Washington implementation retained; no new lap-time measurement.':'Existing opening ends at completion or 210 seconds, whichever comes first.'};
});
const catalog=[...opening,...imported];
const savedAt=Date.parse('2026-11-10T12:00:00Z');
const definitions=Object.fromEntries(['tree','frozenbush','frozenrock','Factory'].map(ref=>[ref,read(`${root}/doodads/${ref}/document.json`).doodad]));
const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
for(const stage of imported){
 const race=read(`${generated}/${stage.id}.json`);
 Object.assign(race,raceFxPreset(stage.timeOfDay==='night'?'night':'evening'));
 prepareAmericaRace(race,stage);
 editor.applyLoadedRaceDocument(race);
 const length=editor.getRaceRouteLength();
 let seed=stage.stage*733;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 race.scenery=[];
 const industrial=stage.sceneryTheme==='industrial',forest=['forest','river','canyon'].includes(stage.sceneryTheme);
 for(let d=30;d<length-30;d+=industrial?85:forest?35:70){
  const pose=editor.getRaceWorldPoseAtDistance(d);
  for(const side of [-1,1]){
   const ref=industrial&&random()<.55?'Factory':forest&&random()<.65?'tree':random()<.5?'frozenrock':'frozenbush';
   const def=definitions[ref],width=ref==='Factory'?38:def.widthM,height=ref==='Factory'?27:def.heightM;
   const offset=side*(ref==='Factory'?55+random()*35:14+random()*24);
   const x=pose.x+Math.cos(pose.yaw)*offset,z=pose.z-Math.sin(pose.yaw)*offset;
   const projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
   // Protect the complete road corridor, including adjacent switchback legs.
   if(Math.abs(projection.lateral)<10+width/2)continue;
   race.scenery.push({id:`${stage.id}-scenery-${race.scenery.length}`,presetId:'doodad',definitionId:def.id,doodadRef:ref,artRef:def.artRef,
    label:ref==='Factory'?'Automated data-center cooling block':def.name,x,z,yaw:pose.yaw,trackDistance:projection.distance,trackLateral:projection.lateral,
    widthM:width,heightM:height,groundOffsetM:ref==='Factory'?0:def.groundOffsetM,behavior:ref==='Factory'?'collide':def.defaultRule.behavior,
    weightKg:ref==='Factory'?100000:def.weightKg,state:'standing',
    ...(ref==='Factory'?{previewDoodad:{...def,widthM:width,heightM:height,hitboxWidthM:width,hitboxHeightM:height,groundOffsetM:0,weightKg:100000}}:{})});
  }
 }
 // Re-run notes after scenery placement so apex hazards are considered.
 editor.applyLoadedRaceDocument(race);
 race.codriver.calls=racePaceNotes(race,analyzeRaceDrivingRoute(editor));
 race.description=`Middle Route · ${stage.stage}/${catalog.length} · ${(stage.lengthM/1000).toFixed(1)} km · ~${(stage.estimatedDrivingSeconds/60).toFixed(1)} min\n${stage.segmentDescription}`;
 race.source.sceneryDescription='Fictional frozen-world roadside scenery; trees, rocks, snow patches and abandoned industrial structures are authored, not imported building footprints.';
 const folder=path.join(root,'races',stage.name);fs.mkdirSync(folder,{recursive:true});
 stage.documentPath=`races/${stage.name}/document.json`;
 write(`${folder}/document.json`,encode({schemaVersion:1,kind:'race-track',savedAt,selectedRaceId:race.id,race}));
 write(`${folder}/metadata.json`,{name:stage.name,folder:'races',savedAt,version:1});
 manifest.folders.races[stage.name]=stage.documentPath;
 console.log(`Installed ${stage.stage}: ${stage.name}, ${race.scenery.length} roadside props`);
}
// Retire precisely the previous campaign stages. Their documents, assets and
// source snapshots remain archived outside the playable project asset folders.
for(const old of read(`${source}/legacy-catalog.json`)){
 const relative=manifest.folders.races[old.name];
 if(relative){
  const oldFolder=path.dirname(`${root}/${relative}`),archive=`${source}/retired-races/${old.name}`;
  if(fs.existsSync(oldFolder)&&!fs.existsSync(archive)){fs.mkdirSync(path.dirname(archive),{recursive:true});fs.renameSync(oldFolder,archive);}
  delete manifest.folders.races[old.name];
 }
}
write(`${source}/catalog.json`,catalog);
const menuPath=`${root}/menus/Game Menu/document.json`,menu=read(menuPath);
menu.parameters.campaignOpeningRace='Tower Hill Road';
const screen=menu.screens.find(s=>s.id==='world-map');
if(!screen)throw Error('Game Menu world-map screen is missing');
const map=screen.elements.find(e=>e.type==='world-map');
Object.assign(map,createAmericaWorldMap(catalog),{showSelectedLabel:true,fontSize:16});
screen.elements=screen.elements.filter(e=>!e.id.startsWith('america-'));
screen.elements.push({id:'america-heading',type:'text',label:`${AMERICA_ROUTE_NAME.toUpperCase()} · ${catalog.length} RACES`,x:.08,y:.07,w:.84,h:.035,fontSize:16,color:'#ffffff',visible:true,useDefaultFont:true});
write(menuPath,menu);
write(`${root}/menus/Game Menu/metadata.json`,{...read(`${root}/menus/Game Menu/metadata.json`),savedAt});
write(manifestPath,manifest);
console.log('Installed single Middle Route; applying mission conditions while retaining the existing opening tracks.');

await applySavedMissionConditions();

if(fs.existsSync('data/campaigns/america/art-imports.json'))await import('./apply_campaign_art.mjs');
