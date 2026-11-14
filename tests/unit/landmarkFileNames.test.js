import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sanitizeProjectFileName,saveProjectFile,loadProjectFile,hydrateProjectFilePayload,resetProjectFilesForTests} from '../../src/ui/projectFiles.js';

const ref='landmark-city-ny-new-york-public-library-stephen-a-schwarzman-building';
// Exercise the actual duplicate sanitizers without starting a server or seeding files.
const readSanitizer=(file,name)=>{
 const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
 const match=source.match(new RegExp(`function ${name}\\([^]*?\\n}`));
 assert.ok(match,`${file} sanitizer exists`);
 return vm.runInNewContext(`(${match[0]})`);
};
const sanitizers=[sanitizeProjectFileName,
 readSanitizer('../../tools/playwright/static-server.cjs','normalizeName'),
 readSanitizer('../../tools/seed_builtin_race_files.mjs','sanitizeProjectFileName')];

test('canonical landmark names up to 80 survive every storage sanitizer; legacy rules stay unchanged',()=>{
 assert.equal(ref.length,70);
 const boundary='landmark-city-ny-'+ 'a'.repeat(62)+'z';
 assert.equal(boundary.length,80);
 for(const sanitize of sanitizers){
  assert.equal(sanitize(ref),ref);
  assert.equal(sanitize(boundary),boundary);
  for(const invalid of [boundary+'z','x'.repeat(70),ref.toUpperCase(),ref+'/',ref.replace('-ny-','-n1-'),ref.replace('-public-','--public-')]){
   const legacy=invalid.trim().replace(/\s+/g,' ').replace(/[\\/:*?"<>|]/g,'').slice(0,64);
   assert.equal(sanitize(invalid),legacy);
  }
  assert.equal(sanitize('  Old  / Car:*?"<>|  '),'Old  Car');
  assert.notEqual(sanitize(ref),sanitize(ref.slice(0,-1)+'x'));
 }
});

test('exact landmark art and doodad names round-trip cached and hydrated documents',async()=>{
 resetProjectFilesForTests();
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='POST')return {ok:true,json:async()=>({ok:true,file:JSON.parse(options.body)})};
  const parsed=new URL(String(url),'http://localhost');
  assert.equal(parsed.searchParams.get('name'),ref);
  const folder=parsed.searchParams.get('folder');
  return {ok:true,json:async()=>({ok:true,file:{folder,name:ref,version:1,savedAt:1,data:{artRef:ref}}})};
 };
 try{
  for(const folder of ['art','doodads']){
   const saved=saveProjectFile(folder,ref,{artRef:ref});
   assert.equal(saved.name,ref);
   assert.equal(loadProjectFile(folder,ref).data.artRef,ref);
   const hydrated=await hydrateProjectFilePayload(folder,ref,{forceRefresh:true});
   assert.equal(hydrated.name,ref);
   assert.equal(hydrated.data.artRef,ref);
  }
 }finally{globalThis.fetch=originalFetch;resetProjectFilesForTests();}
});
