import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {projectStorageUrl} from '../../src/ui/projectStorageUrls.js';
import {hydrateProjectFile,hydrateServerStorage,clearCachedProjectFilesForTests,
 listServerIndexedFiles,readCachedProjectFile,saveServerFile,deleteServerFile,renameServerFile,
 isProjectStorageReadOnly} from '../../src/ui/serverStorage.js';
import {PROJECT_FOLDERS,loadProjectFile,deleteProjectFile,renameProjectFile} from '../../src/ui/projectFiles.js';
import {loadServerPreferenceAsync,saveServerPreference} from '../../src/ui/serverPreferences.js';

const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const root='/data/server-storage/files/';
async function fixture(run,{failure=()=>new Response('<html>Missing API</html>',{status:404})}={}) {
 const prior=globalThis.fetch;clearCachedProjectFilesForTests();const calls=[];
 const docs=new Map(),meta=new Map(),assets=new Map();const folders={};
 const add=(folder,name,data,metadata={})=>{
  const path=`${folder}/${name}/document.json`;
  (folders[folder] ||= {})[name]=path;
  docs.set(root+path.split('/').map(encodeURIComponent).join('/'),data);
  meta.set(root+path.replace('/document.json','/metadata.json').split('/').map(encodeURIComponent).join('/'),metadata);
 };
 globalThis.fetch=async(url,options={})=>{
  const key=String(url);calls.push([key,options.method||'GET']);
  if(key.startsWith('/__storage/'))return failure(key,options);
  if(key===root+'manifest.json')return json({folders});
  if(docs.has(key))return json(docs.get(key));
  if(meta.has(key))return json(meta.get(key));
  if(assets.has(key))return new Response(assets.get(key));
  return json({error:'missing'},404);
 };
 try {await run({add,calls,docs,meta,assets});}finally{globalThis.fetch=prior;clearCachedProjectFilesForTests();}
}
test('storage URLs retain project subdirectory in pages and workers',()=>{
 for(const module of ['https://example.github.io/game/src/ui/projectStorageUrls.js','https://example.github.io/game/src/ui/projectStorageUrls.js?v=2']) {
  assert.equal(projectStorageUrl('/__storage/index',module),'/game/__storage/index');
  assert.equal(projectStorageUrl('data/server-storage/files/manifest.json',module),'/game/data/server-storage/files/manifest.json');
 }
 assert.equal(projectStorageUrl('/__storage/index','https://example.com/src/ui/projectStorageUrls.js'),'/__storage/index');
});
test('every editor folder lists lazily and opens into the shared synchronous cache',async()=>fixture(async({add})=>{
 for(const folder of PROJECT_FOLDERS)add(folder,'Published',{kind:folder,marker:123},{savedAt:17});
 const result=await hydrateServerStorage();assert.equal(result.readOnly,true);
 for(const folder of PROJECT_FOLDERS){
  assert.ok(listServerIndexedFiles(folder).Published);
  assert.equal((await hydrateProjectFile(folder,'Published')).data.marker,123);
  assert.equal(loadProjectFile(folder,'Published').data.kind,folder);
 }
}));
test('opening one compressed file hydrates binary refs without fetching unrelated files',async()=>fixture(async({add,assets,calls})=>{
 const name='50% # café';
 const doc={kind:'font',font:{__chainsawAssetRef:'assets/font.ttf',mime:'font/ttf'}};
 add('fonts',name,{__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:gzipSync(JSON.stringify(doc)).toString('base64')});
 add('races','Huge unrelated',{huge:true});
 assets.set(`http://localhost${root}fonts/${encodeURIComponent(name)}/assets/font.ttf`,new Uint8Array([1,2,3]));
 const loaded=await hydrateProjectFile('fonts',name);
 assert.equal(loaded.data.font,'data:font/ttf;base64,AQID');assert.equal(loaded.storageSource,'static');
 assert.equal(calls.some(([url])=>url.includes('Huge')),false);
}));
test('concurrent static opens share document download',async()=>fixture(async({add,calls})=>{
 add('cars','Shared',{car:{name:'Shared'}});
 const loaded=await Promise.all(Array.from({length:8},()=>hydrateProjectFile('cars','Shared')));
 assert.ok(loaded.every(v=>v.data.car.name==='Shared'));
 assert.equal(calls.filter(([url])=>url===root+'cars/Shared/document.json').length,1);
}));
for(const [label,failure] of [['network',()=>{throw new TypeError('NetworkError');}],['server 503',()=>json({error:'down'},503)],['HTML success',()=>new Response('<html>static fallback</html>')]]) {
 test(`${label} read failure falls back to published files`,async()=>fixture(async({add})=>{
  add('art','Fallback',{pixels:[1]});assert.deepEqual((await hydrateProjectFile('art','Fallback')).data,{pixels:[1]});
 },{failure}));
}
test('missing static assets are visible failures rather than blank graphics',async()=>fixture(async({add})=>{
 add('art','Broken',{image:{__chainsawAssetRef:'missing.png',mime:'image/png'}});
 await assert.rejects(hydrateProjectFile('art','Broken'),/Could not load published file/);
 assert.equal(readCachedProjectFile('art','Broken',{allowSyncFetch:false}),null);
}));
test('static metadata hides deleted entries and preserves system-car flags',async()=>fixture(async({add})=>{
 add('cars','Preset',{car:{}},{systemFile:true});add('art','Removed',{pixels:[]},{deleted:true});
 await hydrateProjectFile('cars','Preset');assert.equal(listServerIndexedFiles('cars').Preset.systemFile,true);
 assert.equal(await hydrateProjectFile('art','Removed'),null);
}));
test('preferences use published settings and changes stay available in-session without claiming persistence',async()=>fixture(async({add})=>{
 add('settings','published-test-launch',{value:{menuRef:'Splash'}});
 assert.deepEqual(await loadServerPreferenceAsync('published-test-launch'),{menuRef:'Splash'});
 assert.equal((await saveServerPreference('published-test-launch',{menuRef:'Other'})).ok,false);
 assert.deepEqual(await loadServerPreferenceAsync('published-test-launch'),{menuRef:'Other'});
}));
test('static writes are not reported as durable and rename/delete cannot erase published cache',async()=>fixture(async({add})=>{
 add('art','Original',{pixels:[1]});await hydrateProjectFile('art','Original');
 assert.equal(isProjectStorageReadOnly(),true);
 assert.equal((await saveServerFile('art','Original',{pixels:[2]})).persisted,false);
 await assert.rejects(deleteServerFile('art','Original'),/read-only/);
 await assert.rejects(renameServerFile('art','Original','Other'),/read-only/);
 assert.throws(()=>deleteProjectFile('art','Original'),/read-only/);
 assert.throws(()=>renameProjectFile('art','Original','Other'),/read-only/);
 assert.equal(JSON.parse(readCachedProjectFile('art','Original')).data.pixels[0],1);
}));

test('listing does not download documents; selected actors warm referenced art for legacy readers',async()=>fixture(async({add,calls})=>{
 add('actors','Hero',{actor:{artRef:'Hero sprite'}});add('art','Hero sprite',{frames:[[1]]});add('races','Unrelated',{road:[]});
 await hydrateServerStorage();assert.equal(calls.some(([url])=>url.endsWith('/document.json')),false);
 await hydrateProjectFile('actors','Hero');
 assert.deepEqual(loadProjectFile('art','Hero sprite').data.frames,[[1]]);
 assert.equal(calls.some(([url])=>url.includes('Unrelated/document')),false);
}));
