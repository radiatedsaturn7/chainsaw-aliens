// Exercise the real worker preparation and transfer pipeline in an isolated,
// deliberately small-stack process per saved stage (keeps memory bounded too).
import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const catalog=JSON.parse(fs.readFileSync(new URL('../../data/campaigns/america/catalog.json',import.meta.url)));
catalog.unshift({id:'america-opening-tower-hill',name:'Tower Hill Road'});
const id=process.argv.find(a=>a.startsWith('--stage='))?.slice(8);
if(id){
 const stage=catalog.find(s=>s.id===id);assert.ok(stage,`Unknown stage ${id}`);
 const stored=JSON.parse(fs.readFileSync(new URL(`../../data/server-storage/files/races/${stage.name}/document.json`,import.meta.url)));
 const doc=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 const {buildRaceTransferPackage}=await import('../../src/ui/raceWorldBakeWorker.js');
 let phase='load';const started=Date.now();
 try {
  const p=await buildRaceTransferPackage(doc.race,{includeRaceDocument:true,includeArtAssets:false,reportProgress:(_p,next)=>{phase=next;}});
  assert.ok(p.packedSampler.positions.length>0,'physics triangles');
  assert.ok(p.packedTerrain.positions.length>0,'render triangles');
  assert.ok(p.header.routeLength>0,'timed route');
  const copy=structuredClone(p,{transfer:[...new Set([...p.physicsTransferables,...p.terrainTransferables,...p.raceTileMapTransferables])]});
  assert.ok(copy.packedSampler.positions.length>0,'transferred physics');
  assert.ok(copy.packedTerrain.positions.every(Number.isFinite),'finite render geometry');
  assert.ok(copy.packedSampler.positions.every(Number.isFinite),'finite physics geometry');
  console.log(JSON.stringify({id,name:stage.name,ok:true,triangles:copy.packedSampler.positions.length/9,seconds:(Date.now()-started)/1000}));
 }catch(error){console.error(`${stage.name}: failed during ${phase}\n${error.stack}`);process.exitCode=1;}
}else{
 const results=[];
 for(const stage of catalog){
  const result=spawnSync(process.execPath,['--stack_size=128',fileURLToPath(import.meta.url),`--stage=${stage.id}`],{encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
  if(result.status!==0){results.push({id:stage.id,ok:false,error:result.error?.message||result.stderr});}
  else results.push(JSON.parse(result.stdout.trim().split('\n').at(-1)));
 }
 const reportArg=process.argv.find(a=>a.startsWith('--report='));
 if(reportArg)fs.writeFileSync(reportArg.slice(9),JSON.stringify({checkedAt:new Date().toISOString(),stackSizeKB:128,results},null,2)+'\n');
 console.log(`${results.filter(r=>r.ok).length}/${catalog.length} campaign races prepared successfully.`);
 if(results.some(r=>!r.ok))process.exitCode=1;
}
