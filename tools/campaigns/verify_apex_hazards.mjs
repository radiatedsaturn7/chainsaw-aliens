import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {analyzeRaceRecce} from '../../src/racing/RaceRecce.js';
const root='data/server-storage/files/';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const manifest=read(root+'manifest.json'),report=read('data/campaigns/america/layered-roadside-report.json');
let verified=0,relocated=0,removed=0;
for(const row of report){
 if(!row.hazards?.length)continue;
 const file=root+manifest.folders.races[row.name],stored=JSON.parse(fs.readFileSync(file)),doc=read(file),race=doc.race;
 const editor=new RaceEditor({});editor.applyLoadedRaceDocument(race);
 const markers=race.scenery.filter(p=>p.ecologyLayer==='apex-hazard');
 editor.selectedRace.scenery=[];
 const notes=analyzeRaceRecce(editor).filter(n=>Number.isFinite(n.apexAt)&&n.direction);
 const accepted=[];
 editor.withRaceGeometryReadCache(()=>{
  for(const marker of markers){
   const note=notes.filter(n=>Math.abs(n.apexAt-marker.trackDistance)<200).sort((a,b)=>Math.abs(a.apexAt-marker.trackDistance)-Math.abs(b.apexAt-marker.trackDistance))[0];
   let valid=false;
   if(note){
    const p=editor.getRaceWorldPoseAtDistance(note.apexAt),half=marker.widthM/2,side=note.direction==='Left'?1:-1;
    const offset=side*(editor.getRaceRoadHalfWidthWorld(p.segment)+half+.55),x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;
    const q=editor.getRaceRouteProjectionForWorldPoint({x,z}),tile=race.road.tileMap;
    const blocking=race.scenery.some(o=>o!==marker&&o.ecologyLayer!=='verge'&&o.ecologyLayer!=='shrub'&&Math.hypot(o.x-x,o.z-z)<half+Math.min(8,Number(o.widthM||2)/2)+1);
    valid=q&&Math.abs(q.distance-note.apexAt)<12&&Math.abs(q.lateral)>=editor.getRaceRoadHalfWidthWorld(q.segment)+half+.4&&tile?.cells?.[`${Math.floor(x/tile.cellSizeM)},${Math.floor(z/tile.cellSizeM)}`]&&!blocking;
    if(valid){
     if(Math.hypot(marker.x-x,marker.z-z)>1)relocated++;
     Object.assign(marker,{x,z,trackDistance:q.distance,trackLateral:q.lateral});accepted.push(marker);
    }
   }
   if(!valid){
    // Keep the density target, replacing an unsafe obstacle with low verge growth.
    marker.doodadRef='expanded-grass-clump';marker.widthM=.4;marker.heightM=.3;marker.ecologyLayer='verge';delete marker.previewDoodad;removed++;
   }
  }
 });
 editor.selectedRace.scenery=accepted;
 const checked=analyzeRaceRecce(editor);
 for(const marker of accepted){
  const note=checked.find(n=>n.hazardIds?.includes(marker.id));
  if(!note||!note.modifiers.some(m=>m==='tree in'||m==='rock in'))throw Error('Missing hazard call: '+row.name+' '+marker.id);
  verified++;
 }
 row.hazards=row.hazards.filter(h=>accepted.some(p=>p.id===h.id)).map(h=>({...h,distance:accepted.find(p=>p.id===h.id).trackDistance,paceNoteVerified:true}));
 row.layers=Object.fromEntries(['verge','shrub','canopy','apex-hazard'].map(layer=>[layer,race.scenery.filter(p=>p.ecologyLayer===layer).length]));
 race.source.layeredRoadside.hazards=row.hazards;race.source.layeredRoadside.layers=row.layers;
 doc.savedAt=Date.now();stored.data=zlib.gzipSync(JSON.stringify(doc),{level:9}).toString('base64');
 fs.writeFileSync(file,JSON.stringify(stored,null,2)+'\n');
 const meta=file.replace('document.json','metadata.json');if(fs.existsSync(meta)){const m=read(meta);m.savedAt=doc.savedAt;fs.writeFileSync(meta,JSON.stringify(m,null,2)+'\n');}
}
fs.writeFileSync('data/campaigns/america/layered-roadside-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verified,relocated,replacedWithLowVegetation:removed}));
