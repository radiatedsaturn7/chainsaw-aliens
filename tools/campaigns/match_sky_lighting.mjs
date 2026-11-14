import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {raceBrightness} from '../../src/racing/RaceLighting.js';

// One-time library migration, also safe to rerun after importing older races.
// Keep the independent editor controls: this sets values, not a runtime lock.
const root=fileURLToPath(new URL('../../data/server-storage/files/',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const check=process.argv.includes('--check');
let checked=0,changed=0;
for(const relative of Object.values(manifest.folders.races)){
 const file=path.join(root,relative),stored=JSON.parse(fs.readFileSync(file));
 const compact=stored.__chainsawStorage==='compact-v1';
 const doc=compact?JSON.parse(gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 if(!doc.race)throw Error('Missing race: '+relative);
 checked++;
 const brightness=raceBrightness(doc.race);
 if(doc.race.visualFx?.skyBrightness===brightness)continue;
 changed++;
 if(check)continue;
 doc.race.visualFx={...doc.race.visualFx,skyBrightness:brightness};
 doc.savedAt=Date.now();
 if(compact)stored.data=gzipSync(JSON.stringify(doc)).toString('base64');
 fs.writeFileSync(file,JSON.stringify(compact?stored:doc,null,2)+'\n');
}
console.log(JSON.stringify({checked,[check?'mismatches':'updated']:changed}));
if(check&&changed)process.exitCode=1;
