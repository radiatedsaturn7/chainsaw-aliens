// Exercise the real worker preparation and transfer pipeline in an isolated,
// deliberately small-stack process per saved stage (keeps memory bounded too).
import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runChild=promisify(execFile);
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const skipped=new Set((process.argv.find(a=>a.startsWith('--skip='))?.slice(7)||'').split(','));
const sideRaces=process.argv.includes('--side-races');
const expansion=process.argv.includes('--state-expansion');
const wilderness=process.argv.includes('--wilderness');
const raceways=process.argv.includes('--raceways')||expansion||wilderness;
const catalog=JSON.parse(fs.readFileSync(new URL(raceways?'../../data/campaigns/america/raceways/catalog.json':sideRaces?'../../data/campaigns/america/side-races/catalog.json':'../../data/campaigns/america/catalog.json',import.meta.url)))
 .filter(stage=>(!wilderness||stage.id.startsWith('detour-'))&&(!expansion||/^(city|state)-/.test(stage.id))&&(!sideRaces||stage.status==='installed')&&!skipped.has(stage.id)).map(stage=>({...stage,name:stage.name||stage.raceRef}));

const auditEdges=process.argv.includes('--audit-edges');
const stageTimeoutMs=Math.max(1000,Number(process.argv.find(a=>a.startsWith('--timeout-ms='))?.slice(13))||360000);
const id=process.argv.find(a=>a.startsWith('--stage='))?.slice(8);
if(id){
 const stage=catalog.find(s=>s.id===id);assert.ok(stage,`Unknown stage ${id}`);
 const stored=JSON.parse(fs.readFileSync(path.resolve(fileURLToPath(new URL('../../data/server-storage/files/',import.meta.url)),stage.documentPath||`races/${stage.name}/document.json`)));
 const doc=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 const {buildRaceTransferPackage}=await import('../../src/ui/raceWorldBakeWorker.js');
 {
  const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
  RaceEditor.prototype.onRaceTerrainBuildProgress=state=>console.error(JSON.stringify(state));
 }
 let phase='load';const started=Date.now();
 try {
  const p=await buildRaceTransferPackage(doc.race,{includeRaceDocument:true,includeArtAssets:false,reportProgress:(_p,next)=>{phase=next;if(process.argv.includes('--progress'))console.error(`${stage.id}: ${phase} (${((Date.now()-started)/1000).toFixed(1)}s)`);}});
  assert.ok(p.packedSampler.positions.length>0,'physics triangles');
  assert.ok(p.packedTerrain.positions.length>0,'render triangles');
  assert.ok(p.header.routeLength>0,'timed route');
  const copy=structuredClone(p,{transfer:[...new Set([...p.physicsTransferables,...p.terrainTransferables,...p.raceTileMapTransferables])]});
  assert.ok(copy.packedSampler.positions.length>0,'transferred physics');
  assert.ok(copy.packedTerrain.positions.every(Number.isFinite),'finite render geometry');
  assert.ok(copy.packedSampler.positions.every(Number.isFinite),'finite physics geometry');
  if(id==='america-middle-laurel'){
   const {sampleRaceBakedSurface}=await import('../../src/racing/RaceBakedSurfaceSampler.js');
   const heights=[];
   for(const dx of [-.001,0,.001])for(const dz of [-.001,0,.001]){
    const sample=sampleRaceBakedSurface(copy.packedSampler,{x:-444.56068+dx,z:1950+dz});
    assert.ok(sample,'Laurel recorded seam coverage');heights.push(sample.elevation*12);
   }
   assert.ok(Math.max(...heights)-Math.min(...heights)<.02,'Laurel recorded seam continuity');
  }
  const {sampleRaceBakedSurface:probeSurface}=await import('../../src/racing/RaceBakedSurfaceSampler.js');
  const sections=copy.header.surfaceBake?.sections||[];
  const probePoints=sections.filter((_,i)=>i%Math.max(1,Math.floor(sections.length/500))===0).map(s=>s.center);
  for(const point of probePoints)probeSurface(copy.packedSampler,point);
  const probeStarted=performance.now();
  for(let repeat=0;repeat<3;repeat++)for(const point of probePoints)probeSurface(copy.packedSampler,point);
  const physicsProbeMeanMs=probePoints.length?(performance.now()-probeStarted)/(3*probePoints.length):null;
  let recordingAudit;
  if(id==='america-middle-ozark'){
   const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
   const {createAdaptiveTerrainField}=await import('../../src/racing/RaceAdaptiveTerrain.js');
   const {sampleRaceBakedSurface}=await import('../../src/racing/RaceBakedSurfaceSampler.js');
   const editor=new RaceEditor({});editor.applyLoadedRaceDocument(doc);
   const surfaceBake=editor.withRaceGeometryReadCache(()=>editor.getRaceSurfaceBake({step:copy.header.surfaceBake.step,routeLength:copy.header.routeLength,runtimeType:copy.header.runtimeType,allowVisualExtension:true}));
   const field=createAdaptiveTerrainField({surfaceBake,sampleGround:p=>editor.getRaceGroundElevationAtWorldPoint(p,0)});
   recordingAudit=[];
   for(const [x,z] of [[-5389.896603,-8529.456283],[-4702.952143,-6692.8527],[-4642.86631,-6744.305953]]){
    let maxErrorM=0,samples=0;const start=performance.now();
    for(let dx=-20;dx<=20;dx+=2)for(let dz=-20;dz<=20;dz+=2){
     const point={x:x+dx,z:z+dz},expected=field.query(point.x,point.z);
     if(expected.distanceToRoad<6)continue;
     const actual=sampleRaceBakedSurface(copy.packedSampler,point);
     assert.ok(actual,`recorded terrain has coverage at ${point.x},${point.z}`);
     maxErrorM=Math.max(maxErrorM,Math.abs(actual.elevation-expected.elevation)*12);samples++;
    }
    recordingAudit.push({x,z,samples,maxErrorM,queryAndFieldMs:performance.now()-start});
    assert.ok(maxErrorM<=.2,`recorded terrain height deviation ${maxErrorM}m`);
   }
  }
  let seamAudit;
  if(auditEdges){
   const {auditTerrainEdges}=await import('../vehicle-validation/audit-terrain-edges.mjs');
   const result=auditTerrainEdges(copy.packedSampler);
   seamAudit={steepMicroEdges:result.steepMicroEdges.length,discrepancies:result.cracks.length,maxHeightErrorM:result.cracks[0]?.error||0};
   fs.writeFileSync(`artifacts/${id}-terrain-edge-audit.json`,JSON.stringify(result,null,2));
  }
  console.log(JSON.stringify({id,name:stage.name,seamAudit,recordingAudit,physicsProbeMeanMs,ok:true,terrainStats:copy.header.terrainGenerationStats,peakRssKB:process.resourceUsage().maxRSS,triangles:copy.packedSampler.positions.length/9,seconds:(Date.now()-started)/1000}));
 }catch(error){console.error(`${stage.name}: failed during ${phase}\n${error.stack}`);process.exitCode=1;}
}else{
 const results=new Array(catalog.length);let next=0;
 const jobs=Math.max(1,Math.min(2,Number(process.argv.find(a=>a.startsWith('--jobs='))?.slice(7))||1));
 await Promise.all(Array.from({length:jobs},async()=>{
 for(;;){
  const index=next++;if(index>=catalog.length)return;const stage=catalog[index];
  const result=await runChild(process.execPath,['--stack_size=128',fileURLToPath(import.meta.url),`--stage=${stage.id}`,...(raceways?['--raceways']:[]),...(sideRaces?['--side-races']:[]),...(auditEdges?['--audit-edges']:[])],{encoding:'utf8',timeout:stageTimeoutMs,maxBuffer:4*1024*1024}).then(value=>({...value,status:0}),error=>({stdout:error.stdout,stderr:error.stderr,status:1,error,signal:error.signal}));
  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
  if(result.status!==0){const error=result.error?.message||result.stderr||`Exit ${result.status}, signal ${result.signal}`;console.error(`${stage.name}: ${error}`);results[index]={id:stage.id,ok:false,error};}
  else results[index]=JSON.parse(result.stdout.trim().split('\n').at(-1));
 }
 }));
 const reportArg=process.argv.find(a=>a.startsWith('--report='));
 if(reportArg)fs.writeFileSync(reportArg.slice(9),JSON.stringify({checkedAt:new Date().toISOString(),stackSizeKB:128,stageTimeoutMs,results},null,2)+'\n');
 console.log(`${results.filter(r=>r.ok).length}/${catalog.length} campaign races prepared successfully.`);
 if(results.some(r=>!r.ok))process.exitCode=1;
}
