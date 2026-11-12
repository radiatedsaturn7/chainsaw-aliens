// Rebuild only the authored distant layer; retain all roadside/user scenery.
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildDistantScenery} from './distant_scenery.mjs';
const root='data/server-storage/files/';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const manifest=read(root+'manifest.json'),catalog=read('data/campaigns/america/catalog.json'),configs=read('data/campaigns/america/distant-scenery.json');
const definitions=new Map();
const definition=name=>{if(!definitions.has(name))definitions.set(name,read(root+manifest.folders.doodads[name]).doodad);return definitions.get(name);};
const report=[];
for(const [ordinal,entry] of catalog.entries()){
 const key=entry.sourceKey||(ordinal===0?'tower':'mount'),config=configs[key];
 if(!config)throw Error(`Missing scenery configuration: ${key}`);
 const path=root+entry.documentPath,doc=read(path),r=doc.race;
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(r);
 const tile=r.road.tileMap,cell=tile.cellSizeM;
 const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(const id of Object.keys(tile.cells)){
  const [x,z]=id.split(',').map(Number);
  bounds.minX=Math.min(bounds.minX,x*cell);bounds.maxX=Math.max(bounds.maxX,(x+1)*cell);
  bounds.minZ=Math.min(bounds.minZ,z*cell);bounds.maxZ=Math.max(bounds.maxZ,(z+1)*cell);
 }
 const placements=buildDistantScenery({key,config,bounds,definition,length:editor.getRaceRouteLength(),pose:d=>editor.getRaceWorldPoseAtDistance(d),project:p=>editor.getRaceRouteProjectionForWorldPoint(p)});
 // Reject gaps in nonrectangular authored terrain as well as its outer boundary.
 const valid=placements.filter(p=>tile.cells[`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`]);
 const previous=r.scenery.filter(p=>p.id?.startsWith(`campaign-distant-${key}-`));
 if(JSON.stringify(previous)!==JSON.stringify(valid)){
  r.scenery=r.scenery.filter(p=>!p.id?.startsWith(`campaign-distant-${key}-`)).concat(valid);
  doc.savedAt=Date.now();
  write(path,{__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9}).toString('base64')});
  const meta=path.replace('document.json','metadata.json');write(meta,{...read(meta),savedAt:doc.savedAt});
 }
 const result={race:entry.name,added:valid.length,bands:config.bands.map((_,i)=>valid.filter(p=>p.campaignDistanceLayer.band===i).length),minimumRoadDistanceM:Math.round(Math.min(...valid.map(p=>Math.abs(p.trackLateral)))),maximumRoadDistanceM:Math.round(Math.max(...valid.map(p=>Math.abs(p.trackLateral))))};
 report.push(result);console.log(JSON.stringify(result));
}
write('data/campaigns/america/distant-scenery-report.json',report);
