#!/usr/bin/env node
/** Prepare an offline, hash-bound art overlay. Never writes a live vehicle or manifest.
 * node tools/art/prepare-runtime-overlay.mjs CAR_DOCUMENT FITTING_CONFIG OUTPUT_DIRECTORY
 * Fitting config requires exact id/name, rosterCommit, expectedDocumentSha256,
 * sourceDirectory, sourceHashes, mapping, measured authoredWheelAnchors,
 * wheelFit and per-car cockpitCalibration. Source previews are not acceptance.
 */
import fs from 'node:fs';
import {resolveRuntimeId} from './runtime-source-binding.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {decodePng,buildCatalogDocuments} from '../../scripts/car-catalog-import.mjs';
import {prepareCarSheet,carSheetDocument,assignCarTireSheet} from '../../src/racing/CarGraphicImport.js';
import {normalizeTireSheetOpacity} from '../../src/racing/CarTireTextureFit.js';
import {applyCockpitAnchors} from '../../scripts/car-catalog-cockpit.mjs';
import {normalizeGauge} from '../../src/racing/CarGauges.js';

const [documentArg,configArg,outputArg]=process.argv.slice(2);
assert.ok(documentArg&&configArg&&outputArg,'Expected car document, fitting config and empty output directory');
const documentPath=path.resolve(documentArg),configPath=path.resolve(configArg),output=path.resolve(outputArg);
const repo=path.resolve(new URL('../../',import.meta.url).pathname);
const production=path.join(repo,'data/server-storage');
assert.ok(output!==production&&!output.startsWith(production+path.sep),'Offline output only');
assert.ok(!output.includes(path.sep+'data'+path.sep+'server-storage'),'Never target production storage in another checkout');
assert.ok(!fs.existsSync(output)||fs.readdirSync(output).length===0,'Output directory must be empty');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputBytes=fs.readFileSync(documentPath),cfg=JSON.parse(fs.readFileSync(configPath));
assert.match(cfg.expectedDocumentSha256||'',/^[a-f0-9]{64}$/);
assert.equal(sha(inputBytes),cfg.expectedDocumentSha256,'Vehicle changed since fitting input was recorded');
assert.match(cfg.rosterCommit||'',/^[a-f0-9]{40}$/);
assert.match(cfg.id||'',/^[a-z0-9-]+$/);
const phases=path.join(repo,'data/vehicle-catalog/phases');
const latest=fs.readdirSync(phases).filter(f=>/^art-handoff-queue-v\d+\.json$/.test(f))
  .sort((a,b)=>Number(b.match(/v(\d+)/)[1])-Number(a.match(/v(\d+)/)[1]))[0];
const queue=JSON.parse(fs.readFileSync(path.join(phases,latest)));
const identity=queue.queue.find(x=>x.id===cfg.id&&x.name===cfg.name);
assert.ok(identity?.status==='placeholder','Only a confirmed new-art candidate may be prepared');
const stored=JSON.parse(inputBytes);
const original=stored.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(stored.data,'base64'))):stored;
assert.equal(original.car?.id,cfg.id);assert.equal(original.car.name,cfg.name);
assert.ok(!cfg.visualHold,'Resolve source defects before runtime preparation');
assert.ok(cfg.authoredWheelAnchors&&cfg.cockpitCalibration,'Measured exterior and cockpit anchors required');
assert.ok(['average','cover'].includes(cfg.wheelFit),'Explicit wheel fit policy required');
for(const slot of ['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft']){
  const points=cfg.authoredWheelAnchors[slot];
  assert.ok(Array.isArray(points)&&points.length===2,`Two measured wheel anchors required: ${slot}`);
  for(const p of points)assert.ok(['fl','fr','rl','rr'].includes(p.wheel)&&[p.x,p.y,p.radius].every(Number.isFinite)&&p.radius>0);
}
for(const [key,length] of [['size',2],['cluster',4],['wheel',3]]){
  const values=cfg.cockpitCalibration[key];
  assert.ok(Array.isArray(values)&&values.length===length&&values.every(Number.isFinite),`Invalid cockpit ${key}`);
}
const source=path.resolve(cfg.sourceDirectory),images={},sourceHashes={};
const marker=path.join(source,'package-status.json'),sourceStatus=fs.existsSync(marker)?JSON.parse(fs.readFileSync(marker)):null;
if(sourceStatus){
  assert.equal(resolveRuntimeId(sourceStatus),cfg.id,'Source package must bind to this exact runtime ID');
  assert.equal(sourceStatus.name,cfg.name);
  assert.equal(path.basename(source),sourceStatus.id);
  assert.deepEqual(cfg.mapping,sourceStatus.mapping,'Fitting mapping differs from the reviewed source package');
}
const sourceConfig=path.join(source,'package-config.json');
if(fs.existsSync(sourceConfig))assert.ok(!JSON.parse(fs.readFileSync(sourceConfig)).visualHold,'Source package is held');
for(const role of ['body','dashboard','tires']){
  const file=path.join(source,role+'.png');sourceHashes[role]=sha(fs.readFileSync(file));
  assert.equal(sourceHashes[role],cfg.sourceHashes?.[role],`Stale ${role} source`);
  if(sourceStatus)assert.equal(sourceHashes[role],sourceStatus.sourceHashes[role]);
  images[role]=decodePng(file);
}
assert.deepEqual(cfg.cockpitCalibration.size,[images.dashboard.width,images.dashboard.height]);
const built=buildCatalogDocuments({car:structuredClone(original.car),mapping:cfg.mapping,
  authoredWheelAnchors:cfg.authoredWheelAnchors,wheelFit:cfg.wheelFit,
  provenance:{sources:identity.sources.map(s=>({url:s.url,fields:s.fields?.length?s.fields:['identity']})),
    estimates:['Original artwork placement only. Offline preparation; full gameplay acceptance deferred.']}},
  images.body,images.dashboard,sourceHashes);
const car=structuredClone(original.car);car.art=built.car.car.art;
Object.assign(car.art.interior.dashboard,{scaleX:1,scaleY:1,offsetX:0,offsetY:0});
applyCockpitAnchors(car,cfg.cockpitCalibration);
if(cfg.cockpitCalibration.gaugeBackground){
  assert.match(cfg.cockpitCalibration.gaugeBackground,/^#[0-9a-f]{6}([0-9a-f]{2})?$/i,'Use an explicit per-car gauge backing color');
  const widgets=car.art.gauges.interior.widgets,values=widgets.filter(widget=>widget.showValue!==false);
  const x=Math.min(...values.map(g=>g.x)),y=Math.min(...values.map(g=>g.y));
  const right=Math.max(...values.map(g=>g.x+g.width)),bottom=Math.max(...values.map(g=>g.y+g.height));
  // Number widgets do not draw their background property. The existing native
  // decoration widget supplies a compact backing without changing the engine.
  widgets.unshift(normalizeGauge({id:'cockpit-instrument-backing',name:'Instrument backing',source:'decoration',
    format:'icon',enabled:true,x,y,width:right-x,height:bottom-y,color:cfg.cockpitCalibration.gaugeBackground,
    showValue:false,textTemplate:'',outline:0}));
}
if(cfg.cockpitCalibration.wheelOpening&&cfg.wheelSizeReference!=='wrx-derived-airslayer'){
  // Preserve individually measured sizes; the shared helper's viewport scale is
  // only the explicitly requested WRX-derived reference, not a fleet default.
  Object.assign(car.art.interior.steeringWheel,{sizeSpace:'dashboard',scaleX:1,scaleY:1});
}
if(cfg.cockpitCalibration.viewportWheelScale!==undefined){
  const scale=cfg.cockpitCalibration.viewportWheelScale;
  assert.ok(Number.isFinite(scale)&&scale>=.05&&scale<=12,'Invalid individually fitted viewport wheel scale');
  if(cfg.wheelSizeReference==='wrx-derived-airslayer')assert.equal(scale,1.6875,'Preserve the explicitly requested WRX reference size');
  Object.assign(car.art.interior.steeringWheel,{sizeSpace:'viewport',scaleX:scale,scaleY:scale});
}
if(cfg.steeringWheelSource){
  const {artRef,frameIndex=0}=cfg.steeringWheelSource;
  assert.ok(['steeringwheel','buse-steeringwheel','ct-steeringwheel','pz-steeringwheel'].includes(artRef),'Select an existing reviewed steering-wheel asset');
  assert.equal(frameIndex,0,'Reviewed reusable steering wheels each have one frame');
  Object.assign(car.art.interior.steeringWheel,{artRef,frameIndex});
}
const tires=normalizeTireSheetOpacity(images.tires);
const tireDoc=carSheetDocument(tires,prepareCarSheet(tires,{columns:2,rows:1}));
const tireRef=`catalog-${cfg.id}-tires`;assignCarTireSheet(car,tireRef,tireDoc);built.art[tireRef]=tireDoc;
for(const layer of Object.values(car.art.angleLayers)){layer.tires.tireMode='auto';layer.tires.visible=true;}
for(const value of Object.values(car.art.tireTreads||{}))Object.assign(value,car.art.tireSurfaces.tread);
const next={...original,car},withoutArt=doc=>{const copy=structuredClone(doc);delete copy.car.art;return copy;};
assert.deepEqual(withoutArt(next),withoutArt(original),'Non-art vehicle fields changed');
assert.equal(sha(fs.readFileSync(documentPath)),cfg.expectedDocumentSha256,'Input document mutated');
const ownRefs=['body','dashboard','tires'].map(role=>`catalog-${cfg.id}-${role}`);
assert.deepEqual(Object.keys(built.art).sort(),[...ownRefs].sort());
fs.mkdirSync(output,{recursive:true});const nativeHashes={},manifest={folders:{art:{}}};
for(const [ref,doc] of Object.entries(built.art)){
  const relative=`art/${ref}/document.json`,dest=path.join(output,relative);
  const bytes=Buffer.from(JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',
    data:gzipSync(JSON.stringify(doc),{mtime:0}).toString('base64')})+'\n');
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
  fs.writeFileSync(path.join(path.dirname(dest),'metadata.json'),JSON.stringify({name:ref,folder:'art',savedAt:Date.now(),version:1})+'\n');
  nativeHashes[ref]=sha(bytes);manifest.folders.art[ref]=relative;
}
const overlay={id:cfg.id,name:cfg.name,rosterCommit:cfg.rosterCommit,
  expectedDocumentSha256:cfg.expectedDocumentSha256,art:car.art};
fs.writeFileSync(path.join(output,'art-overlay.json'),JSON.stringify(overlay,null,2)+'\n');
fs.writeFileSync(path.join(output,'manifest-delta.json'),JSON.stringify(manifest,null,2)+'\n');
const status={id:cfg.id,status:'runtime-prepared-awaiting-visual-fitting',runtimeFitted:false,
  productionIntegrated:false,gameplayAccepted:false,inputDocumentSha256:cfg.expectedDocumentSha256,
  rosterCommit:cfg.rosterCommit,identityHandoff:queue.source,sourceHashes,nativeHashes,
  sharedSteeringWheelReference:car.art.interior.steeringWheel.artRef,
  fittingConfigSha256:sha(fs.readFileSync(configPath)),nonArtFieldsPreserved:true,
  deferred:['per-car exterior and cockpit fitting review','fixed rear camera and smoke','full gameplay and manifest acceptance']};
fs.writeFileSync(path.join(output,'runtime-preparation.json'),JSON.stringify(status,null,2)+'\n');
console.log(JSON.stringify({id:cfg.id,status:status.status,ownManifestKeys:ownRefs,productionWrites:0}));
