// Replace a reviewed import's geometry while preserving installed art, conditions
// and gameplay settings. Re-anchor existing scenery/decals to the new route.
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {authorRaceContinuations} from './author_continuations.mjs';
const root='data/server-storage/files',base='data/campaigns/america/side-races';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const key=process.argv[2];if(!key)throw Error('Supply a reviewed side-event ID');
const catalog=read(`${base}/catalog.json`),row=catalog.find(e=>e.id===key),imported=read(`${base}/report.json`).find(e=>e.id===key);
if(!row||imported?.status!=='imported')throw Error('Installed event and successful import required');
const file=`${root}/${row.documentPath}`,doc=read(file),race=doc.race,fresh=read(imported.generatedPath);
const editor=new RaceEditor({});editor.applyLoadedRaceDocument(race);
const oldLength=editor.getRaceRouteLength();
const anchors=[...(race.scenery||[]),...(race.decals||[])].map(item=>({item,p:editor.getRaceRouteProjectionForWorldPoint({x:item.x,z:item.z??item.y})}));
const oldRoad=race.road;race.road=fresh.road;
race.road.groundTiles=oldRoad.groundTiles;race.road.selectedGroundTileId=oldRoad.selectedGroundTileId;
race.road.tileMap.defaultTileId=oldRoad.tileMap.defaultTileId;
for(const cell of Object.values(race.road.tileMap.cells))cell.tileId=race.road.tileMap.defaultTileId;
race.source={...race.source,...fresh.source};race.road.autoExtend=false;
authorRaceContinuations(race);editor.applyLoadedRaceDocument(race);
const newLength=editor.getRaceRouteLength();
for(const {item,p} of anchors){
 const d=Math.max(0,Math.min(newLength,p.distance/oldLength*newLength)),pose=editor.getRaceWorldPoseAtDistance(d),offset=p.lateral;
 item.x=pose.x+Math.cos(pose.yaw)*offset;item.z=pose.z-Math.sin(pose.yaw)*offset;
 delete item.y;delete item.elevation;
 if('trackDistance' in item)item.trackDistance=d;
 if('trackLateral' in item)item.trackLateral=offset;
 if('yaw' in item)item.yaw=pose.yaw;
 if('rotation' in item)item.rotation=pose.yaw;
}
race.codriver={...race.codriver,calls:[]};
race.description= fresh.source.routeSelection?.description||race.description;
doc.savedAt=Date.now();
const metadataPath=file.replace(/document\.json$/,'metadata.json');
if(fs.existsSync(metadataPath))fs.writeFileSync(metadataPath,JSON.stringify({...read(metadataPath),savedAt:doc.savedAt},null,2)+'\n');
const wrapped={__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9,mtime:0}).toString('base64')};
fs.writeFileSync(file,JSON.stringify(wrapped,null,2)+'\n');
Object.assign(row,imported,{status:'installed',displayName:key==='H01-S01'?'Pawtucket S-curves — I-95 south through Thurbers Avenue':row.displayName});
fs.writeFileSync(`${base}/catalog.json`,JSON.stringify(catalog,null,2)+'\n');
console.log({id:key,lengthM:newLength,startGps:row.startGps,finishGps:row.finishGps,estimatedDrivingSeconds:row.estimatedDrivingSeconds});
const menuFile=`${root}/menus/Game Menu/document.json`,menu=read(menuFile);
const relabel=value=>{
 if(!value||typeof value!=='object')return;
 if(value.action?.parameter==='raceRef'&&value.action.value===row.raceRef&&typeof value.label==='string')value.label=row.displayName;
 for(const child of Object.values(value))if(child&&typeof child==='object')relabel(child);
};
relabel(menu);fs.writeFileSync(menuFile,JSON.stringify(menu,null,2)+'\n');

const menuMetadata=menuFile.replace(/document\.json$/,'metadata.json');
if(fs.existsSync(menuMetadata))fs.writeFileSync(menuMetadata,JSON.stringify({...read(menuMetadata),savedAt:Date.now()},null,2)+'\n');
