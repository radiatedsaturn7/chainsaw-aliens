#!/usr/bin/env node
/** Generation-only native packaging. Never writes production documents/manifest.
 * node tools/art/build-car-source-package.mjs assets/car-catalog/ID/package-config.json
 * {id,name,mapping:[8 unique indices],bodyPng:'body.png',dashboardPng:'dashboard.png',
 * tiresPng:'tires.png',sources:[{url,fields:['identity']}],cockpitCalibration:{...},authoredWheelAnchors?:{...}}
 */
import fs from 'node:fs';import path from 'node:path';import {gzipSync,gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {decodePng,buildCatalogDocuments} from '../../scripts/car-catalog-import.mjs';
import {carSheetDocument,prepareCarSheet} from '../../src/racing/CarGraphicImport.js';
import {normalizeTireSheetOpacity,fitTireTextureRegions} from '../../src/racing/CarTireTextureFit.js';
const cfgPath=path.resolve(process.argv[2]),dir=path.dirname(cfgPath),cfg=JSON.parse(fs.readFileSync(cfgPath));
assert.ok(!cfg.visualHold,'Resolve the recorded source visual hold before marking a package complete');
const repo=path.resolve(new URL('../../',import.meta.url).pathname),root=path.join(repo,'data/server-storage/files');
assert.ok(/^[a-z0-9-]+$/.test(cfg.id));assert.equal(path.basename(dir),cfg.id);
const carPath=path.join(root,'cars',cfg.name,'document.json');let doc=null,handoff=null;
if(fs.existsSync(carPath)){const stored=JSON.parse(fs.readFileSync(carPath));doc=stored.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(stored.data,'base64'))):stored;assert.equal(doc.car.id,cfg.id);}
else {
  const phases=path.join(repo,'data/vehicle-catalog/phases');
  const snapshots=fs.readdirSync(phases).filter(f=>/^art-handoff-queue-v\d+\.json$/.test(f)).sort((a,b)=>Number(b.match(/v(\d+)/)[1])-Number(a.match(/v(\d+)/)[1]));
  for(const file of snapshots){const queue=JSON.parse(fs.readFileSync(path.join(phases,file)));const entry=queue.queue.find(x=>x.id===cfg.id&&x.name===cfg.name);if(entry){handoff={source:queue.source,entry};break;}}
  if(!handoff){
    const supplement=path.join(phases,'art-handoff-queue-source-supplement.json');
    if(fs.existsSync(supplement)){const queue=JSON.parse(fs.readFileSync(supplement));const entry=queue.queue.find(x=>x.id===cfg.id&&x.name===cfg.name);if(entry){assert.equal(entry.handoffScope,'source-generation-only');assert.equal(entry.runtimeDocumentIdVerified,false);handoff={source:queue.source,entry};}}
  }
  assert.ok(handoff?.entry?.identityStatus==='handoff-ready'&&handoff.entry.referenceVehicle&&handoff.entry.sources?.length,'Exact verified handoff identity required; never generate unresolved candidate slots');
}
assert.ok(Array.isArray(cfg.mapping)&&cfg.mapping.length===8&&new Set(cfg.mapping).size===8&&cfg.mapping.every(x=>Number.isInteger(x)&&x>=0&&x<8),'Explicit eight-angle mapping required');
const hashes={},stats={};const read=(role,f)=>{const p=path.resolve(dir,f);assert.equal(path.dirname(p),dir);const im=decodePng(p);hashes[role]=createHash('sha256').update(fs.readFileSync(p)).digest('hex');let clear=0,solid=0;for(let i=3;i<im.data.length;i+=4){if(im.data[i]===0)clear++;if(im.data[i]>=250)solid++;}assert.ok(clear>100&&solid>100,role+' needs real alpha and solid artwork');stats[role]={width:im.width,height:im.height,clearPixels:clear,nearOpaquePixels:solid};return im;};
const body=read('body',cfg.bodyPng||'body.png'),dashboard=read('dashboard',cfg.dashboardPng||'dashboard.png');
const sources=(cfg.sources||doc?.car.catalogProvenance.sources||handoff.entry.sources).map(s=>({url:s.url,fields:s.fields?.length?s.fields:['identity and visual reference']}));
const built=doc?buildCatalogDocuments({car:doc.car,mapping:cfg.mapping,provenance:{sources,estimates:['Original fictional 2994 restoration art; no manufacturer pixels. Full production placement/visual/browser checks deferred to coordinated test phase.']},...(cfg.authoredWheelAnchors?{authoredWheelAnchors:cfg.authoredWheelAnchors,wheelFit:'cover'}:{})},body,dashboard,hashes):{art:{[`catalog-${cfg.id}-body`]:carSheetDocument(body),[`catalog-${cfg.id}-dashboard`]:(()=>{const frame=[];for(let i=0;i<dashboard.data.length;i+=4){const [r,g,b,a]=dashboard.data.subarray(i,i+4);frame.push(a?'#'+[r,g,b,...(a===255?[]:[a])].map(v=>v.toString(16).padStart(2,'0')).join(''):null);}return {kind:'actor-state-animation',width:dashboard.width,height:dashboard.height,fps:1,frames:[frame]};})()}};
let tireRegions=null;if(cfg.tiresPng){const tires=normalizeTireSheetOpacity(read('tires',cfg.tiresPng));const td=carSheetDocument(tires,prepareCarSheet(tires,{columns:2,rows:1}));tireRegions=fitTireTextureRegions(td.frames,td.width,td.height,{treadFrame:0,wheelFrame:1});assert.ok(tireRegions.wheel.region.radius>td.width*.2,'Wheel opaque region unexpectedly small');assert.ok(tireRegions.tread.region.height>td.height*.2,'Tread opaque region unexpectedly small');built.art[`catalog-${cfg.id}-tires`]=td;}
const nd=path.join(dir,'native');fs.mkdirSync(nd,{recursive:true});let frames=0;const nativeFiles={};
for(const [ref,d]of Object.entries(built.art)){assert.ok(d.frames.every(f=>f.length===d.width*d.height));const unique=new Set(d.frames.map(f=>createHash('sha256').update(JSON.stringify(f)).digest('hex')));assert.equal(unique.size,d.frames.length,'Duplicate native frames');const bytes=gzipSync(JSON.stringify(d),{mtime:0});const rel=`native/${ref}.json`;fs.writeFileSync(path.join(dir,rel),JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:bytes.toString('base64')})+'\n');const back=JSON.parse(gunzipSync(bytes));assert.deepEqual(back,d);nativeFiles[ref]=rel;frames+=d.frames.length;}
const status={schemaVersion:1,id:cfg.id,name:cfg.name,referenceVehicle:doc?.car.catalogProvenance.referenceVehicle||handoff.entry.referenceVehicle,identityHandoff:handoff?.source||null,base:'40ed6400fd2de4e309b7b8216e2350922ecfa63b',status:'generated-native-package',productionIntegrated:false,sourceHashes:hashes,sourceStats:stats,mapping:cfg.mapping,nativeFiles,nativeFrameCount:frames,tireRegions,cockpitCalibration:cfg.cockpitCalibration||null,wheelPlacement:cfg.authoredWheelAnchors?'authored-unverified':'deferred-to-test-phase',checks:{pngDecode:true,realAlpha:true,eightUniqueExteriorFrames:true,nativeRoundtrip:true,identityMatched:true},deferred:['production wheel/body placement acceptance','fixed rear gameplay camera','cockpit steering/gauge visibility','desktop and touch driving','full manifest validation'],sources};
status.runtimeDocumentIdVerified=handoff?.entry?.runtimeDocumentIdVerified!==false;
status.runtimeDocumentId=status.runtimeDocumentIdVerified?cfg.id:null;
status.stableCarId=handoff?.entry?.stableCarId||'saved-car:'+cfg.name;
if(!status.runtimeDocumentIdVerified)status.runtimeBindingNote='Temporary source-package key only. Bind to the exact car.id from the private runtime document before preparing or integrating a runtime overlay.';
const statusPath=path.join(dir,'package-status.json'),statusTemp=statusPath+'.tmp';fs.writeFileSync(statusTemp,JSON.stringify(status,null,2)+'\n');fs.renameSync(statusTemp,statusPath);console.log(JSON.stringify({id:cfg.id,status:status.status,frames,productionWrites:0}));
