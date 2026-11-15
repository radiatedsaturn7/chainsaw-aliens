import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {terrainArtMaterials} from './terrain-materials.mjs';
import {roadTextureSettings,roadTextureForSegment,shoulderTextureForSegment} from '../../src/racing/RaceRoadTextures.js';
import {roadVisualStatus} from './road-materials.mjs';
const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
const rows=[];
for(const row of ledger.rows){
 let doc=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));
 if(doc.__chainsawStorage)doc=JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')));
 const counts=new Map();
 for(const cell of Object.values(doc.race.road?.tileMap?.cells||{}))for(const slot of ['artRef','roughArtRef','tileArtRef']){
  if(slot==='tileArtRef'&&!Object.hasOwn(cell,slot))continue;
  const ref=cell[slot]||null, material=terrainArtMaterials[ref]||null;
  const status=!material?'unclassified':material===cell.tileId?'matching':'mismatch';
  const key=JSON.stringify({slot,ref,tileId:cell.tileId,material,status});counts.set(key,(counts.get(key)||0)+1);
 }
 const materialCounts={};for(const c of Object.values(doc.race.road?.tileMap?.cells||{}))materialCounts[c.tileId]=(materialCounts[c.tileId]||0)+1;
 const groundIntent=Object.keys(materialCounts).sort((a,b)=>materialCounts[b]-materialCounts[a])[0]||doc.race.road?.tileMap?.defaultTileId;
 const groundStatus=terrainArtMaterials[doc.race.groundPlaneArtRef]===groundIntent?'matching':'mismatch';
 const settings=roadTextureSettings(doc.race),roadEvidence=new Map();
 for(const seg of [...(doc.race.road.segments||[]),...(doc.race.road.network?.edges||[])]){const t=roadTextureForSegment(settings,seg),ref=t?.enabled===false?'':t?.artRef||'',status=roadVisualStatus(ref,seg.surface,doc.race);const sh=shoulderTextureForSegment(settings,seg);const key=JSON.stringify({surface:seg.surface,ref,status,shoulderArtRef:sh?.artRef||null,shoulderEnabled:sh?.enabled!==false});roadEvidence.set(key,(roadEvidence.get(key)||0)+1);}
 rows.push({groundIntent,groundStatus,roadEvidence:[...roadEvidence].map(([key,sections])=>({...JSON.parse(key),sections})),race:row.raceRef,pack:row.environmentPack,ground:doc.race.groundPlaneArtRef,defaultTileId:doc.race.road?.tileMap?.defaultTileId,layers:[...counts].map(([key,cells])=>({...JSON.parse(key),cells}))});
}
const mismatchRows=rows.filter(r=>r.layers.some(l=>l.status==='mismatch'));
const unclassifiedRows=rows.filter(r=>r.layers.some(l=>l.status==='unclassified'));
const roadProblems=rows.filter(r=>r.roadEvidence.some(e=>['mismatch','unclassified'].includes(e.status)));const groundProblems=rows.filter(r=>r.groundStatus!=='matching');
console.log(JSON.stringify({roadProblemCount:roadProblems.length,groundProblemCount:groundProblems.length,total:rows.length,mismatchRaceCount:mismatchRows.length,unclassifiedRaceCount:unclassifiedRows.length,note:'Counts are per visual slot, not unique cells. Unknown art requires visual classification; known mismatches block release. Ground/road/shoulder visual review remains separate.',rows},null,2));
if(mismatchRows.length||unclassifiedRows.length||roadProblems.length||groundProblems.length)process.exitCode=1;
