import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {beforeEach} from 'node:test';
import {upsertCachedProjectFile} from '../../src/ui/serverStorage.js';
import {GARAGE_SAVED_TIRES,savedGarageTireRef} from '../../src/garage/GarageSavedTires.js';
import {getTireArtRefs} from '../../src/racing/raceTires.js';
const root=new URL('../../data/server-storage/files/',import.meta.url);
const read=(folder,name)=>{let d=JSON.parse(readFileSync(new URL(`${folder}/${encodeURIComponent(name)}/document.json`,root)));return d.encoding==='json-gzip-base64'?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const tires=new Map(GARAGE_SAVED_TIRES.map(name=>[name,read('tires',name)]));
// These physics/menu tests hydrate real saved tire definitions; pixel payloads
// are tiny stand-ins because no bitmap rendering occurs here.
const art=new Map([...new Set([...tires.values()].flatMap(getTireArtRefs))].map(name=>[name,{kind:'art',width:1,height:1,frames:[['#222222']]}]));
export const savedTireForRef=ref=>structuredClone(tires.get(savedGarageTireRef(ref)));
function seed(){for(const [folder,entries] of [['tires',tires],['art',art]])for(const [name,data] of entries)upsertCachedProjectFile(folder,name,JSON.stringify({folder,name,savedAt:1,version:1,data}));}
seed();beforeEach(seed);
