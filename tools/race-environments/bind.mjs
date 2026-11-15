import fs from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {assertVisualOnly,assertLedger} from './visual-contract.mjs';
const root='data/server-storage/files/';
const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
const manifest=JSON.parse(fs.readFileSync(root+'manifest.json'));
const apply=process.argv.includes('--apply');
const decode=s=>{const d=JSON.parse(s);return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
assertLedger(ledger,Object.keys(manifest.folders.races));
const pending=[];
const registered=ref=>{assert.ok(manifest.folders.art[ref],`Missing artwork ${ref}`);return ref;};
// Preflight every target and every untouched race before writing the first file.
for(const row of ledger.rows){
 const file=root+row.documentPath,raw=JSON.parse(fs.readFileSync(file)),doc=decode(JSON.stringify(raw));
 const baseline=decode(execFileSync('git',['show',ledger.base+':'+file],{maxBuffer:40e6}));
 if(!row.binding){assert.deepEqual(doc,baseline,`Unplanned race mutation ${row.raceRef}`);continue;}
 const next=structuredClone(doc),r=next.race,b=row.binding;
 assert.ok(Object.keys(b).every(k=>['skyboxArtRef','groundPlaneArtRef','terrainArtMap','terrainTileArtById','roadArtMap'].includes(k)),'Unsupported binding');
 if(b.skyboxArtRef){r.skyboxArtRef=registered(b.skyboxArtRef);r.skyboxSettings={...r.skyboxSettings,artRef:r.skyboxArtRef};}
 if(b.groundPlaneArtRef)r.groundPlaneArtRef=registered(b.groundPlaneArtRef);
 const replace=(obj,key,map)=>{if(obj&&map&&Object.hasOwn(map,obj[key]))obj[key]=registered(map[obj[key]]);};
 for(const tile of [...Object.values(r.road?.groundTiles||{}),...Object.values(r.road?.tileMap?.cells||{})])if(tile&&typeof tile==='object')for(const key of ['artRef','roughArtRef'])replace(tile,key,b.terrainArtMap);
 for(const tile of Object.values(r.road?.tileMap?.cells||{}))if(b.terrainTileArtById?.[tile.tileId]){tile.artRef=registered(b.terrainTileArtById[tile.tileId]);tile.roughArtRef=tile.artRef;}
 for(const texture of [r.roadTextures?.road,r.roadTextures?.shoulder,...Object.values(r.roadTextures?.surfaceRoads||{}),...Object.values(r.roadTextures?.surfaceShoulders||{}),r.margin])for(const key of ['artRef','roughArtRef'])replace(texture,key,b.roadArtMap);
 assertVisualOnly(baseline.race,r);
 if(!apply)assert.deepEqual(doc,next,`Binding not applied: ${row.raceRef}`);
 assert.deepEqual({...baseline,race:null},{...next,race:null},'Document metadata changed');
 pending.push({file,raw,next,race:row.raceRef});
}
if(apply)for(const {file,raw,next}of pending){const out=raw.__chainsawStorage?{...raw,data:gzipSync(JSON.stringify(next),{mtime:0}).toString('base64')}:next;const temp=file+'.environment-tmp';fs.writeFileSync(temp,JSON.stringify(out,null,2)+'\n');fs.renameSync(temp,file);}
console.log(JSON.stringify({mode:apply?'applied':'checked',total:ledger.rows.length,bindings:pending.map(p=>({race:p.race,ref:p.next.race.skyboxArtRef}))}));
