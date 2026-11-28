// Reposition existing low verge plants; no new drawables or rigid hazards.
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
const root='data/server-storage/files/',apply=process.argv.includes('--apply');
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(path,doc)=>{const old=JSON.parse(fs.readFileSync(path));fs.writeFileSync(path,JSON.stringify(old.__chainsawStorage?{...old,data:zlib.gzipSync(JSON.stringify(doc),{level:9}).toString('base64')}:doc,null,2)+'\n');};
const manifest=read(root+'manifest.json'),report=[];
for(const [ref,path] of Object.entries(manifest.folders.races)){
 const doc=read(root+path),race=doc.race;if(!race?.road?.segments?.length)continue;
 const widths=race.road.segments.map(s=>Number(s.roadWidthM||race.road.width)||7).sort((a,b)=>a-b);
 const row={ref,medianWidthM:widths[Math.floor(widths.length/2)],moved:0};report.push(row);
 const blue=/blue.hills/i.test(ref)||/^Blue Hills/.test(race.name);
 if(blue&&!race.source?.roadWidthReview){
  for(const s of race.road.segments)s.roadWidthM=7;
  race.road.width=7;
  race.source||={};race.source.roadWidthReview={widthM:7,basis:'Estimated two-lane pavement (2 x 3.2m plus 0.6m edge allowance). Replaces legacy MassGIS 15.2m import; not a measured survey.',reference:'https://www.mass.gov/doc/milton-route-28-corridor-road-diet-memo/download'};
  row.widthCorrected=true;
 }
 if(race.source?.nearVergeReview===1&&!row.widthCorrected)continue;
 const candidates=(race.scenery||[]).filter(p=>p.ecologyLayer==='verge'&&/^expanded-(grass|fern)-/.test(p.doodadRef||'')&&p.heightM<=.8&&p.widthM<=2&&Number.isFinite(p.trackDistance)&&Number.isFinite(p.trackLateral));
 if(!candidates.length&&!row.widthCorrected)continue;
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);
 editor.withRaceGeometryReadCache(()=>{
  const bins=new Set(),tile=race.road.tileMap,painted=Object.keys(tile?.cells||{}).length>0;
  for(const p of candidates){
   const side=Math.sign(p.trackLateral)||1,bin=Math.floor(p.trackDistance/35),key=`${bin}:${side}`;
   if(bins.has(key))continue;
   const pose=editor.getRaceWorldPoseAtDistance(p.trackDistance);
   if(pose.segment?.bridge||pose.segment?.isBridge)continue;
   const half=Number(pose.segment?.roadWidthM||race.road.width)/2;
   const offset=side*(half+p.widthM/2+1.0+(bin%3)*.35);
   const x=pose.x+Math.cos(pose.yaw)*offset,z=pose.z-Math.sin(pose.yaw)*offset;
   const cell=tile?.cells?.[`${Math.floor(x/tile.cellSizeM)},${Math.floor(z/tile.cellSizeM)}`];
   if((painted&&!cell)||/water|river|lake/.test(cell?.tileId||tile?.defaultTileId||''))continue;
   const q=editor.getRaceRouteProjectionForWorldPoint({x,z});
   if(!q||Math.abs(q.distance-p.trackDistance)>8||Math.abs(q.lateral)<half+p.widthM/2+.8)continue;
   const ground=editor.getRaceRawGroundElevationAtWorldPoint({x,z},pose.elevation);
   if(Math.abs(ground-pose.elevation)*12>1.2)continue;
   p.x=Math.round(x*100)/100;p.z=Math.round(z*100)/100;p.trackLateral=q.lateral;
   p.nearVergeCue=true;delete p.solid;delete p.collidable;
   bins.add(key);row.moved++;
  }
 });
 race.source||={};race.source.nearVergeReview=1;
 if(apply&&(row.moved||row.widthCorrected)){
  doc.savedAt=Date.now();write(root+path,doc);
  const mp=root+path.replace('document.json','metadata.json');if(fs.existsSync(mp)){const m=read(mp);m.savedAt=doc.savedAt;write(mp,m);}
 }
 if(report.length%25===0)console.log(`Audited ${report.length} races`);
}
fs.writeFileSync('artifacts/roadside-speed-cues.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({races:report.length,moved:report.reduce((n,r)=>n+r.moved,0),changed:report.filter(r=>r.moved||r.widthCorrected).length,widthCorrections:report.filter(r=>r.widthCorrected),wideRoads:report.filter(r=>r.medianWidthM>12).length},null,2));
