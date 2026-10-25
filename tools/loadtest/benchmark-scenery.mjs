import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
const packed=JSON.parse(fs.readFileSync('data/server-storage/files/races/p2loadtest/document.json'));
const doc=JSON.parse(gunzipSync(Buffer.from(packed.data,'base64')));
const e=new RaceEditor({});e.applyLoadedRaceDocument(doc,{name:'p2loadtest'});
e.playtestSession={routeRuntimeType:'network',routeLength:15700,worldBake:{surfaceRevision:'benchmark'}};
e.getRaceArtSpriteCanvas=()=>null;
const sprites=e.ensureRaceScenery();
const times=[];let key;
for(let i=0;i<120;i++){const start=performance.now();key=e.getRaceThreeDoodadSceneKey(sprites);times.push(performance.now()-start);}
const sorted=times.slice(20).sort((a,b)=>a-b);
const result={authority:'Node CPU scene invalidation only; no GPU',scenery:sprites.length,firstMs:times[0],p50Ms:sorted[50],p95Ms:sorted[95],keyBytes:key.length};
console.log(JSON.stringify(result));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
