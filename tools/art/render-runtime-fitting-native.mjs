#!/usr/bin/env node
// Isolated static native renderer. No game bootstrap, physics stepping or storage writes.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const [repoArg,carArg,bundleArg,outArg]=process.argv.slice(2);
assert.ok(outArg,'Usage: node render-runtime-fitting.mjs REPO CAR_DOCUMENT OVERLAY_DIRECTORY OUTPUT_DIRECTORY');
const option=process.argv.slice(6).filter(v=>v==='--evidence-view'||v.startsWith('--evidence-view='));
assert.ok(option.length<=1,'Supply exactly one requested evidence view');
const evidenceView=option[0]?.slice('--evidence-view='.length);
if(option.length)assert.ok(['frontRight','rearRight','rearLeft','frontLeft'].includes(evidenceView),'Evidence capture requires one named oblique');
const repo=path.resolve(repoArg),bundle=path.resolve(bundleArg),out=path.resolve(outArg);
assert.ok(!out.includes('/data/server-storage/'),'Output must be outside production storage');
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Output directory must be empty');
const sha=b=>createHash('sha256').update(b).digest('hex');
const decode=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const bytes=fs.readFileSync(carArg),doc=decode(carArg),overlay=JSON.parse(fs.readFileSync(path.join(bundle,'art-overlay.json')));
assert.equal(sha(bytes),overlay.expectedDocumentSha256);assert.equal(doc.car.id,overlay.id);assert.equal(doc.car.name,overlay.name);
const car=structuredClone(doc.car);car.art=overlay.art;
const refs=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(v.artRef)refs.add(v.artRef);Object.values(v).forEach(walk);};walk(car.art);
const arts={},hashes={};for(const ref of refs){assert.ok(!ref.includes('/')&&!ref.includes('..'));const own=path.join(bundle,'art',ref,'document.json'),p=fs.existsSync(own)?own:path.join(repo,'data/server-storage/files/art',ref,'document.json');assert.ok(fs.existsSync(p),'Missing native art: '+ref);arts[ref]=decode(p);delete arts[ref].editor;hashes[ref]=sha(fs.readFileSync(p));}

const require=createRequire(path.join(repo,'package.json'));
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
for(const [file,family]of [['DejaVuSansMono.ttf','monospace'],['DejaVuSansMono-Bold.ttf','monospace'],['DejaVuSans.ttf','sans-serif']]){const fp='/usr/share/fonts/truetype/dejavu/'+file;if(fs.existsSync(fp))GlobalFonts.registerFromPath(fp,family);}
globalThis.document={createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}};
globalThis.Image=class extends Image{async decode(){return this;}};
const {renderNativeFitting}=await import('./render-runtime-fitting-core.mjs');
const result=await renderNativeFitting({car,arts,evidenceView},'file://'+repo);
const evidence=result.layerEvidence;delete result.layerEvidence;
if(evidenceView)assert.ok(evidence,'Requested view did not produce evidence');
fs.mkdirSync(out,{recursive:true});for(const [name,b64]of Object.entries(result.images))fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(b64,'base64'));delete result.images;
Object.assign(result,{inputDocumentSha256:sha(bytes),overlaySha256:sha(fs.readFileSync(path.join(bundle,'art-overlay.json'))),nativeHashes:hashes,execution:'Native @napi-rs/canvas in managed sandbox; actual game renderer methods',browserVerified:false,fontMapping:'DejaVu Sans Mono registered as monospace; DejaVu Sans as sans-serif',productionWrites:0,physicsStepped:false,staticPreviewOnly:true,gameplayAccepted:false});
fs.writeFileSync(path.join(out,'render-report.json'),JSON.stringify(result,null,2)+'\n');
if(evidence){
  const hashes={};
  for(const [file,b64] of Object.entries(evidence.images)){
    const bytes=Buffer.from(b64,'base64');hashes[file]=sha(bytes);fs.writeFileSync(path.join(out,file),bytes);
  }
  fs.writeFileSync(path.join(out,'native-layer-evidence.json'),JSON.stringify({...evidence.receipt,
    inputDocumentSha256:result.inputDocumentSha256,overlaySha256:result.overlaySha256,nativeArtHashes:result.nativeHashes,pngHashes:hashes},null,2)+'\n');
}
console.log(JSON.stringify({id:result.id,output:out,exteriorFrames:result.exterior.length,cockpitViews:result.cockpit.length}));
