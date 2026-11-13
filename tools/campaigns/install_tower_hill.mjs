// Install only the opening stage and its campaign/menu links.
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {raceFxPreset} from '../../src/racing/RaceVisualFx.js';
import {configureTowerHillEvent} from './tower_hill_event.mjs';
import {prepareAmericaRace} from './prepare_america.mjs';
import {createAmericaWorldMap,AMERICA_OPENING_RACE} from '../../src/menus/AmericaWorldMap.js';
const root='data/server-storage/files';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const encode=d=>({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(d)),{level:9,mtime:0}).toString('base64')});
const race=read('artifacts/campaign-import/america/tower-hill.json');
Object.assign(race,raceFxPreset('night'),{name:AMERICA_OPENING_RACE,timeOfDay:'night',weather:'snow',weatherIntensity:1,weatherTemperatureC:-8,
 weatherRamp:{enabled:true,startIntensity:.05,endIntensity:1,durationSeconds:120},
 groundPlaneArtRef:'providenceGround',description:'Tower Hill Road, Cumberland, Rhode Island. A snowy night opening stage; the storm builds from light flurries to full intensity over two minutes. Low fuel after half a mile; return to the world map at the finish or 3:30.',
 mechanicalMission:{startingFuel:{mode:'percent',value:9},headlights:true}});
race.campaign={id:race.id,branch:'opening',stage:0,name:race.name,lengthM:race.source.mappedLengthM,location:{name:'Tower Hill Road, Cumberland, RI',lat:41.9964,lon:-71.437}};
race.road.width=7;
for(const s of race.road.segments){s.roadWidthM=7;s.surface='asphalt';}
prepareAmericaRace(race,{id:race.id,stage:1});
for(const cell of Object.values(race.road.tileMap.cells))cell.artRef='providenceGround';
const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
editor.applyLoadedRaceDocument(race);
const samples=editor.getRacePathSamplesCached({step:5}),length=samples.at(-1).distance;
const defs=Object.fromEntries(['tree','frozenbush','frozenrock'].map(ref=>[ref,read(`${root}/doodads/${ref}/document.json`).doodad]));
let seed=7351;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
// Deterministic roadside clusters; retain a clear shoulder and test against the
// whole road, so inside bends cannot put props on a neighboring road section.
race.scenery=[];
for(let d=0;d<length;d+=8){
 const pose=editor.getRaceWorldPoseAtDistance(d);
 for(const side of [-1,1])for(const band of [0,1,2]){
  const ref=band===2||random()<.48?'tree':random()<.55?'frozenbush':'frozenrock';
  const def=defs[ref],offset=side*(10+band*14+random()*9);
  const x=pose.x+Math.cos(pose.yaw)*offset,z=pose.z-Math.sin(pose.yaw)*offset;
  const projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
  if(Math.abs(projection.lateral)<9+def.widthM/2)continue;
  race.scenery.push({id:`tower-scenery-${race.scenery.length}`,presetId:'doodad',definitionId:def.id,doodadRef:ref,artRef:def.artRef,label:def.name,x,z,yaw:pose.yaw,trackDistance:projection.distance,trackLateral:projection.lateral,widthM:def.widthM,heightM:def.heightM,groundOffsetM:def.groundOffsetM,behavior:def.defaultRule.behavior,weightKg:def.weightKg,state:'standing'});
 }
}
configureTowerHillEvent(race);
const savedAt=Date.now(),folder=`${root}/races/${race.name}`;fs.mkdirSync(folder,{recursive:true});
write(`${folder}/document.json`,encode({schemaVersion:1,kind:'race-track',savedAt,selectedRaceId:race.id,race}));
write(`${folder}/metadata.json`,{name:race.name,folder:'races',savedAt,version:1});
const manifest=read(`${root}/manifest.json`);manifest.folders.races[race.name]=`races/${race.name}/document.json`;write(`${root}/manifest.json`,manifest);
const menuPath=`${root}/menus/Game Menu/document.json`,menu=read(menuPath);
menu.parameters.campaignOpeningRace=race.name;menu.parameters.campaignStartingCar='RTG-001';
const map=menu.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map');
Object.assign(map,createAmericaWorldMap(read('data/campaigns/america/catalog.json')));
const heading=menu.screens.find(s=>s.id==='world-map').elements.find(e=>e.id==='america-heading');
if(heading)heading.label=`MIDDLE ROUTE · ${read('data/campaigns/america/catalog.json').length} RACES`;
write(menuPath,menu);
const metaPath=`${root}/menus/Game Menu/metadata.json`;write(metaPath,{...read(metaPath),savedAt});
console.log(JSON.stringify({name:race.name,length,scenery:race.scenery.length,weatherRamp:race.weatherRamp}));
