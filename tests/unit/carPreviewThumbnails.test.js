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
   return new Promise(resolve=>{finishVerification=()=>resolve(Response.json({...request,verified:false}));});
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
