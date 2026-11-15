import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {terrainArtMaterials} from './terrain-materials.mjs';
const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
const rows=[];
for(const row of ledger.rows){
 let doc=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));
 if(doc.__chainsawStorage)doc=JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')));
 const counts=new Map();
 for(const cell of Object.values(doc.race.road?.tileMap?.cells||{}))for(const slot of ['artRef','roughArtRef']){
  const ref=cell[slot]||null, material=terrainArtMaterials[ref]||null;
  const status=!material?'unclassified':material===cell.tileId?'matching':'mismatch';
  const key=JSON.stringify({slot,ref,tileId:cell.tileId,material,status});counts.set(key,(counts.get(key)||0)+1);
 }
 rows.push({race:row.raceRef,pack:row.environmentPack,ground:doc.race.groundPlaneArtRef,defaultTileId:doc.race.road?.tileMap?.defaultTileId,layers:[...counts].map(([key,cells])=>({...JSON.parse(key),cells}))});
}
const mismatchRows=rows.filter(r=>r.layers.some(l=>l.status==='mismatch'));
const unclassifiedRows=rows.filter(r=>r.layers.some(l=>l.status==='unclassified'));
console.log(JSON.stringify({total:rows.length,mismatchRaceCount:mismatchRows.length,unclassifiedRaceCount:unclassifiedRows.length,note:'Counts are per visual slot, not unique cells. Unknown art requires visual classification; known mismatches block release. Ground/road/shoulder visual review remains separate.',rows},null,2));
if(mismatchRows.length||unclassifiedRows.length)process.exitCode=1;
