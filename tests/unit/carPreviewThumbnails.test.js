import test from 'node:test';
import assert from 'node:assert/strict';
import {paintCarThumbnail,carThumbnailNeedsFallback,resetCarPreviewThumbnailsForTests} from '../../src/ui/shared/carPreviewThumbnails.js';
import {clearCachedProjectFilesForTests} from '../../src/ui/serverStorage.js';

test('rejected saved-car previews enable fallback, but stock verification in flight does not',async()=>{
 const previous={document:globalThis.document,fetch:globalThis.fetch};
 const hash='a'.repeat(64),name='Alder RS 1994',id='alder-rs-1994';
 let finishVerification,requests=0;
 resetCarPreviewThumbnailsForTests();clearCachedProjectFilesForTests();
 globalThis.document={baseURI:'https://fixture.invalid/game/'};
 globalThis.fetch=async(url,{body}={})=>{
  if(String(url).endsWith('/__storage/preview-stock')){
   requests++;const request=JSON.parse(body);
   return new Promise(resolve=>{finishVerification=()=>resolve(Response.json({...request,ok:true,verified:false}));});
  }
  return Response.json({schemaVersion:1,rendererVersion:'menu-native-v1',releaseRevision:hash,anglesDeg:[0,45,90,135,180,225,270,315],carsByName:{[name]:id},previews:{[id]:{url:`assets/car-previews/${id}.webp`,frameWidth:256,frameHeight:144,frameCount:8,sourceSha256:hash,stockSources:[{folder:'cars',name,sha256:hash}]}}});
 };
 try{
  const paint=()=>paintCarThumbnail({drawImage(){throw Error('Rejected image must not draw');}},{x:0,y:0,w:256,h:144},name);
  assert.equal(carThumbnailNeedsFallback(name),false);
  paint();await new Promise(r=>setTimeout(r,0));paint();
  await new Promise(r=>setTimeout(r,0));
  assert.equal(requests,1);assert.equal(carThumbnailNeedsFallback(name),false);
  finishVerification();await new Promise(r=>setTimeout(r,0));
  assert.equal(carThumbnailNeedsFallback(name),true);
  assert.equal(carThumbnailNeedsFallback('New custom car'),true);
  assert.equal(paint(),false);
 }finally{Object.assign(globalThis,previous);resetCarPreviewThumbnailsForTests();clearCachedProjectFilesForTests();}
});

test('loaded atlas remains visible during periodic verification but stops drawing after rejection',async()=>{
 const previous={document:globalThis.document,fetch:globalThis.fetch,Image:globalThis.Image},now=Date.now;
 const hash='b'.repeat(64),name='Map car',id='map-car';let clock=100000,finishVerification,requests=0,draws=0;
 resetCarPreviewThumbnailsForTests();clearCachedProjectFilesForTests();Date.now=()=>clock;
 globalThis.document={baseURI:'https://fixture.invalid/game/'};
 globalThis.Image=class{
  naturalWidth=2048;naturalHeight=144;
  set src(value){queueMicrotask(()=>this.onload?.());}
  removeAttribute(){}
 };
 globalThis.fetch=async(url,{body}={})=>{
  if(String(url).endsWith('/__storage/preview-stock')){
   requests++;const request=JSON.parse(body);
   return new Promise(resolve=>{finishVerification=ok=>resolve(Response.json({...request,ok:true,verified:ok}));});
  }
  return Response.json({schemaVersion:1,rendererVersion:'menu-native-v1',releaseRevision:hash,anglesDeg:[0,45,90,135,180,225,270,315],carsByName:{[name]:id},previews:{[id]:{url:`assets/car-previews/${id}.webp`,frameWidth:256,frameHeight:144,frameCount:8,sourceSha256:hash,stockSources:[{folder:'cars',name,sha256:hash}]}}});
 };
 const tick=()=>new Promise(r=>setTimeout(r,0));
 const paint=angle=>paintCarThumbnail({drawImage(){draws++;}},{x:0,y:0,w:100,h:70},name,angle,undefined,undefined,true);
 try{
  assert.equal(paint(135),false);await tick();assert.equal(paint(135),false);await tick();
  finishVerification(true);await tick();paint(135);await tick();assert.equal(paint(135),true);
  clock+=6000;
  assert.equal(paint(135),true,'parked car stays visible on verification expiry');await tick();assert.equal(requests,2);
  for(const angle of [135,135,180,225])assert.equal(paint(angle),true,'parked and traveling atlas frames remain visible while pending');
  finishVerification(true);await tick();assert.equal(paint(225),true);
  clock+=6000;assert.equal(paint(225),true);await tick();finishVerification(false);await tick();
  const before=draws;assert.equal(paint(225),false);assert.equal(draws,before);assert.equal(carThumbnailNeedsFallback(name,225,true),true);
 }finally{Date.now=now;Object.assign(globalThis,previous);resetCarPreviewThumbnailsForTests();clearCachedProjectFilesForTests();}
});
