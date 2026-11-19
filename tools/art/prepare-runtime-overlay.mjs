#!/usr/bin/env node
/** Prepare an offline, hash-bound art overlay. Never writes a live vehicle or manifest.
 * node tools/art/prepare-runtime-overlay.mjs CAR_DOCUMENT FITTING_CONFIG OUTPUT_DIRECTORY
 * Fitting config requires exact id/name, rosterCommit, expectedDocumentSha256,
 * sourceDirectory, sourceHashes, mapping, measured authoredWheelAnchors,
 * wheelFit and per-car cockpitCalibration. Source previews are not acceptance.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {decodePng,buildCatalogDocuments} from '../../scripts/car-catalog-import.mjs';
import {prepareCarSheet,carSheetDocument,assignCarTireSheet} from '../../src/racing/CarGraphicImport.js';
import {normalizeTireSheetOpacity} from '../../src/racing/CarTireTextureFit.js';
import {applyCockpitAnchors} from '../../scripts/car-catalog-cockpit.mjs';
import {normalizeGauge} from '../../src/racing/CarGauges.js';
import {validateMeasuredPrep,applyMeasuredPrep,canonicalizeMeasuredTireMetadata,readMeasuredFile,checkMeasuredOutput,freezeMeasuredSource,decodeFrozenSource} from './measured-prep-replay.mjs';

import {requiresRuntimeSourceAlias,verifyRuntimeSourceAlias} from './verify-runtime-source-alias.mjs';

const args=process.argv.slice(2);
const replayTokens=args.flatMap((arg,i)=>arg.startsWith('--measured-replay')?[i]:[]);
const measuredReplay=replayTokens.length>0;
if(measuredReplay)assert.ok(args.length===4&&replayTokens.length===1&&replayTokens[0]===3&&args[3]==='--measured-replay'
  &&args.slice(0,3).every(a=>a&&!a.startsWith('--')),'Usage: prepare-runtime-overlay.mjs DOC CONFIG OUTPUT --measured-replay');
const pawpawTokens=args.flatMap((arg,i)=>arg.startsWith('--pawpaw-exact-248')?[i]:[]);
const pawpaw248=pawpawTokens.length>0;
if(pawpaw248)assert.ok(!measuredReplay&&args.length===4&&pawpawTokens.length===1&&pawpawTokens[0]===3&&args[3]==='--pawpaw-exact-248'
  &&args.slice(0,3).every(a=>a&&!a.startsWith('--')),'Usage: prepare-runtime-overlay.mjs DOC CONFIG OUTPUT --pawpaw-exact-248');
const [documentArg,configArg,outputArg]=args;
assert.ok(documentArg&&configArg&&outputArg,'Expected car document, fitting config and empty output directory');
const documentPath=path.resolve(documentArg),configPath=path.resolve(configArg),output=path.resolve(outputArg);
const repo=path.resolve(new URL('../../',import.meta.url).pathname);
const production=path.join(repo,'data/server-storage');
assert.ok(output!==production&&!output.startsWith(production+path.sep),'Offline output only');
assert.ok(!output.includes(path.sep+'data'+path.sep+'server-storage'),'Never target production storage in another checkout');
assert.ok(!fs.existsSync(output)||fs.readdirSync(output).length===0,'Output directory must be empty');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readInput=(measuredReplay||pawpaw248)?readMeasuredFile:fs.readFileSync;
const inputBytes=readInput(documentPath),configBytes=readInput(configPath),cfg=JSON.parse(configBytes);

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
const source=path.resolve(cfg.sourceDirectory);
const aliasRequired=requiresRuntimeSourceAlias({phases,cfg,identity,source});
let pawpawControls;
if(pawpaw248){
  assert.equal(cfg.id,'pawpaw-clover-2012','The exact optics mode is only for Pawpaw Clover 2012');
  assert.equal(sha(configBytes),'87acb8a59793d06710f7694fa896877fa105c9907223dbc0ccf2df7bd17daf75','Unreviewed Pawpaw fitting config bytes');
  assert.ok(aliasRequired,'Verified Pawpaw source alias is mandatory');
  pawpawControls=structuredClone(cfg);
  delete pawpawControls.nativeBodyTransformOverrides;
  assert.equal(pawpawControls.tireImportOpaqueThreshold,248);
  delete pawpawControls.tireImportOpaqueThreshold;
  validateMeasuredPrep(pawpawControls);
}
let aliasBinding;
if(aliasRequired){
  assert.ok(pawpaw248&&!measuredReplay&&cfg.id==='pawpaw-clover-2012',
    'Source aliases have no generic replay; verified Pawpaw requires --pawpaw-exact-248');
  assert.ok(readMeasuredFile(documentPath).equals(inputBytes)&&readMeasuredFile(configPath).equals(configBytes),
    'Alias document or fitting config changed during snapshot');
  checkMeasuredOutput(output,repo,source);
  aliasBinding=verifyRuntimeSourceAlias({repo,documentPath,cfg,source,original,queue,identity,phases,sha});
  if(pawpaw248){
    assert.equal(aliasBinding.sourcePackageId,'source-pawpaw-clover-2012');
    assert.equal(aliasBinding.pins.historicalRecordSha256,'f27e5cac996bd14b7d1c0f6b4a12c8640bbd4bd33e4c8459b3954bdf3e591896');
    assert.equal(aliasBinding.pins.queueRecordSha256,'187adab60c646d5ff0d87fa003973fca47dcf4086e7b5352d30cecac9d0ba94c');
    assert.equal(aliasBinding.pins.packageStatusSha256,'f9c93e53b7e87f673addca45c9c9c27222ef7e287d87011f81bc637894d36c0b');
  }
}
if(measuredReplay)validateMeasuredPrep(cfg);
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
const images={},sourceHashes={};
let pinnedSource;
if(aliasBinding){
  Object.assign(images,decodeFrozenSource(aliasBinding.pngBytes,decodePng));
  Object.assign(sourceHashes,cfg.sourceHashes);
}else if(measuredReplay){
  checkMeasuredOutput(output,repo,source);
  pinnedSource=freezeMeasuredSource(repo,source,cfg,decodePng);
  Object.assign(images,pinnedSource.images);
  Object.assign(sourceHashes,cfg.sourceHashes);
}else{
const marker=path.join(source,'package-status.json'),sourceStatus=fs.existsSync(marker)?JSON.parse(fs.readFileSync(marker)):null;
if(sourceStatus){
  assert.equal(sourceStatus.id,cfg.id);
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
let pawpawAlphaPixels;
if(pawpaw248){
  assert.deepEqual(Object.fromEntries(Object.entries(car.art.angleLayers).map(([slot,v])=>[slot,v.body.transforms])),
    cfg.nativeBodyTransformOverrides,'The pinned Pawpaw config must describe the existing source body placement exactly');
  applyMeasuredPrep(car,pawpawControls);
}
if(measuredReplay)applyMeasuredPrep(car,cfg);
let tires;
if(pawpaw248){
  const data=new Uint8ClampedArray(images.tires.data);
  let changed=0,extra=0;
  for(let i=3;i<data.length;i+=4)if(data[i]>=248&&data[i]<255){if(data[i]<250)extra++;data[i]=255;changed++;}
  assert.equal(changed,1152270);
  assert.equal(extra,5731);
  pawpawAlphaPixels={changed,extra};
  tires={...images.tires,data};
}else tires=normalizeTireSheetOpacity(images.tires);
const tireDoc=carSheetDocument(tires,prepareCarSheet(tires,{columns:2,rows:1}));
const tireRef=`catalog-${cfg.id}-tires`;assignCarTireSheet(car,tireRef,tireDoc);built.art[tireRef]=tireDoc;
for(const layer of Object.values(car.art.angleLayers)){layer.tires.tireMode='auto';layer.tires.visible=true;}
if(measuredReplay||pawpaw248)canonicalizeMeasuredTireMetadata(car);
for(const value of Object.values(car.art.tireTreads||{}))Object.assign(value,car.art.tireSurfaces.tread);
const next={...original,car},withoutArt=doc=>{const copy=structuredClone(doc);delete copy.car.art;return copy;};
assert.deepEqual(withoutArt(next),withoutArt(original),'Non-art vehicle fields changed');
assert.equal(sha(fs.readFileSync(documentPath)),cfg.expectedDocumentSha256,'Input document mutated');
const ownRefs=['body','dashboard','tires'].map(role=>`catalog-${cfg.id}-${role}`);
assert.deepEqual(Object.keys(built.art).sort(),[...ownRefs].sort());
const overlay={id:cfg.id,name:cfg.name,rosterCommit:cfg.rosterCommit,
  expectedDocumentSha256:cfg.expectedDocumentSha256,art:car.art};
const overlayBytes=Buffer.from(JSON.stringify(overlay,null,2)+'\n');
const packNative=doc=>Buffer.from(JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',
  data:gzipSync(JSON.stringify(doc),{mtime:0}).toString('base64')})+'\n');
if(pawpaw248){
  assert.deepEqual(Object.fromEntries(Object.entries(car.art.angleLayers).map(([slot,v])=>[slot,v.body.transforms])),
    cfg.nativeBodyTransformOverrides,'Pawpaw body changed');
  assert.equal(sha(overlayBytes),'8feffb540cf350ae03d22f2f0b5f0dd6fce7b47dac0d50abe305296951fbc062','Pawpaw overlay differs from exact reviewed optics');
  const hashes={body:'d125f7f402ebd5be8537e55faac9ba26b046f2981c56c72ad7f4fb67b551063f',
    dashboard:'379529c065f0d30f7cca70ec4f1b7cb659e1c2d0a4484c43787d3ccae5e1b58b',
    tires:'6dc938bdf7e855fc2493bae69561838d412586af30f13d012c9ca310fbe4c7fd'};
  for(const [role,h] of Object.entries(hashes))assert.equal(sha(packNative(built.art[`catalog-${cfg.id}-${role}`])),h,'Stale Pawpaw native '+role);
}
if(measuredReplay||aliasBinding){
  checkMeasuredOutput(output,repo,source);
  fs.mkdirSync(output,{mode:0o700});
}else fs.mkdirSync(output,{recursive:true});
const nativeHashes={},manifest={folders:{art:{}}};
for(const [ref,doc] of Object.entries(built.art)){
  const relative=`art/${ref}/document.json`,dest=path.join(output,relative);
  const bytes=packNative(doc);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
  fs.writeFileSync(path.join(path.dirname(dest),'metadata.json'),JSON.stringify({name:ref,folder:'art',savedAt:Date.now(),version:1})+'\n');
  nativeHashes[ref]=sha(bytes);manifest.folders.art[ref]=relative;
}
fs.writeFileSync(path.join(output,'art-overlay.json'),overlayBytes);
fs.writeFileSync(path.join(output,'manifest-delta.json'),JSON.stringify(manifest,null,2)+'\n');
const status={id:cfg.id,status:'runtime-prepared-awaiting-visual-fitting',runtimeFitted:false,
  productionIntegrated:false,gameplayAccepted:false,inputDocumentSha256:cfg.expectedDocumentSha256,
  rosterCommit:cfg.rosterCommit,identityHandoff:queue.source,sourceHashes,nativeHashes,
  sharedSteeringWheelReference:car.art.interior.steeringWheel.artRef,
  fittingConfigSha256:sha((measuredReplay||aliasBinding)?configBytes:fs.readFileSync(configPath)),nonArtFieldsPreserved:true,
  deferred:['per-car exterior and cockpit fitting review','fixed rear camera and smoke','full gameplay and manifest acceptance']};
if(measuredReplay)status.measuredReplay={mode:'measured-replay',version:1,overlaySha256:sha(overlayBytes),
  packageStatusSha256:pinnedSource.packageStatusSha256,packageConfigSha256:pinnedSource.packageConfigSha256,
  inertConfigFields:['measurementReview','cockpitCalibration.instrumentPodBounds','cockpitCalibration.renderedInstrumentPodBounds']};
if(aliasBinding)status.sourceAlias={mode:'verified-source-alias',version:1,sourcePackageId:aliasBinding.sourcePackageId,
  runtimeDocumentId:cfg.id,overlaySha256:sha(overlayBytes),...aliasBinding.pins};
if(pawpaw248)status.exactPawpawOptics={threshold:248,overlaySha256:sha(overlayBytes),...pawpawAlphaPixels};
fs.writeFileSync(path.join(output,'runtime-preparation.json'),JSON.stringify(status,null,2)+'\n');
console.log(JSON.stringify({id:cfg.id,status:status.status,ownManifestKeys:ownRefs,productionWrites:0}));
