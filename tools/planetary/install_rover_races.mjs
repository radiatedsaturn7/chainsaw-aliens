import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {authorRaceContinuations} from '../campaigns/author_continuations.mjs';
import {attachCampaignRoutePreviews} from '../campaigns/route_previews.mjs';
import {analyzeRaceDrivingRoute,racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';
const root='data/server-storage/files',read=p=>JSON.parse(fs.readFileSync(p));
const manifest=read(`${root}/manifest.json`),rows=read('data/campaigns/planetary/report.json'),editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
const only=new Set((process.argv.find(a=>a.startsWith('--only='))?.slice(7)||'').split(',').filter(Boolean));
const selectedRows=rows.filter(row=>!only.size||only.has(row.id));
const selectedIds=new Set(selectedRows.map(row=>row.id));
const catalog=fs.existsSync('data/campaigns/planetary/catalog.json')?read('data/campaigns/planetary/catalog.json').filter(row=>!selectedIds.has(row.id)):[];const write=(p,d)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');};
for(const row of selectedRows){
 const race=read(row.generatedPath),moon=row.body==='Moon';
 race.skybox=moon?'lunar-simulator':'martian-simulator';race.skyboxArtRef='';race.skyboxSettings={artRef:''};
 race.visualFx={enabled:true,preset:'custom',skyBrightness:1,sunEnabled:true,sunDisc:true,sunColor:moon?'#ffffff':'#ffe7ce',sunX:.7,sunY:.2,sunIntensity:.4,lensFlare:0,sunGlare:0,motionBlur:0,tintAmount:0};
 const ground=moon?'ground-gray-gravel-v2':'ground-red-gravel-v2',road=moon?'road-gravel-gray':'road-gravel-red';
 for(const ref of [ground,road])if(!manifest.folders.art[ref])throw Error(`Missing saved art ${ref}`);
 race.groundPlaneArtRef=ground;
 const texture={artRef:road,repeatM:10,filterMode:'balanced',mipmaps:true};
 race.roadTextures={builtInLines:false,road:texture,surfaceRoads:{gravel:texture},shoulder:{artRef:ground,repeatM:12,filterMode:'balanced',mipmaps:true}};
 authorRaceContinuations(race);
 race.road.continuations.description='Short fictional untimed simulator extensions; not part of the recorded rover traverse.';
 editor.applyLoadedRaceDocument(race);
 const length=editor.getRaceRouteLength();
 // Sparse decorative rocks, never a claim to mapped individual boulder positions.
 const rock=moon?'gray-rock-01':'red-sandstone-boulder-01';
 if(!manifest.folders.doodads[rock])throw Error(`Missing ${rock}`);
 editor.withRaceGeometryReadCache(()=>{
  for(let d=60,i=0;d<length-50;d+=75,i++){
   const pose=editor.getRaceWorldPoseAtDistance(d),offset=(i%2?-1:1)*(14+(i*17)%45);
   const x=pose.x+Math.cos(pose.yaw)*offset,z=pose.z-Math.sin(pose.yaw)*offset,projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
   if(Math.abs(projection.lateral)<10)continue;
   race.scenery.push({id:`${race.id}-rock-${i}`,doodadRef:rock,x,z,yaw:i,widthM:2+(i%4),heightM:1+(i%3),groundOffsetM:0,trackDistance:projection.distance,trackLateral:projection.lateral});
  }
 });
 race.codriver={enabled:false,spoken:false,calls:racePaceNotes(race,analyzeRaceDrivingRoute(editor))};
 race.source.sceneryLimitations='Reused gray/red rock and gravel artwork; decorative rocks are fictional. Orbital terrain is sampled at 40 m. Dedicated planetary art pending.';
 const savedAt=Date.now(),documentPath=`races/${encodeURIComponent(row.raceRef).replace(/%20/g,' ')}/document.json`;
 const doc={schemaVersion:1,kind:'race-track',savedAt,selectedRaceId:race.id,race};
 write(`${root}/${documentPath}`,{__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9,mtime:0}).toString('base64')});
 write(`${root}/${documentPath.replace('document.json','metadata.json')}`,{version:1,name:row.raceRef,folder:'races',savedAt});
 manifest.folders.races[row.raceRef]=documentPath;catalog.push({...row,documentPath,status:'installed'});console.log(`Installed ${row.raceRef}`);
}
write(`${root}/manifest.json`,manifest);write('data/campaigns/planetary/catalog.json',catalog);
const menuPath=`${root}/menus/Game Menu/document.json`,menu=read(menuPath);attachCampaignRoutePreviews(menu);write(menuPath,menu);

const menuMetadata=menuPath.replace('document.json','metadata.json');write(menuMetadata,{...read(menuMetadata),savedAt:Date.now()});
