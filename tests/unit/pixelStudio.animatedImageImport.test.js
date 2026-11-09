import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {parseAnimatedImage,decodeAnimatedImage,pngChunk,riffChunk,webpFile} from '../../src/ui/pixel-editor/animatedImageImport.js';
import {makeApng,makeAnimatedWebp} from '../helpers/animatedImageFixtures.js';
const png = new Uint8Array(await new Blob([Uint8Array.of(137,80,78,71,13,10,26,10),pngChunk('IHDR',Uint8Array.of(0,0,0,2,0,0,0,1,8,6,0,0,0)),pngChunk('IDAT',deflateSync(Uint8Array.of(0,255,255,255,255,255,0,0,255))),pngChunk('IEND',new Uint8Array())]).arrayBuffer());
const webp = webpFile([riffChunk('VP8L',Uint8Array.of(0x2f,1,0,0,0))]);
for (const poster of [false,true]) test(`APNG preserves frame count, delays, disposal and excludes poster (${poster})`,async()=>{
  const result=parseAnimatedImage(await makeApng([png,png],{poster}).arrayBuffer());
  assert.equal(result.width,2);assert.equal(result.height,1);assert.equal(result.loop,true);
  assert.deepEqual(result.frames.map(f=>f.durationMs),[70,230]);
  assert.deepEqual(result.frames.map(f=>f.disposal),[1,2]);
  for(const frame of result.frames){assert.equal(frame.blob.type,'image/png');assert.equal(parseAnimatedImage(await frame.blob.arrayBuffer()),null);}
});
test('WebP demux reconstructs independent images and preserves blend/disposal/timing',async()=>{
  const result=parseAnimatedImage(await makeAnimatedWebp([webp,webp]).arrayBuffer());
  assert.deepEqual(result.frames.map(f=>[f.width,f.height,f.durationMs,f.disposal,f.blend]),[[2,1,70,1,false],[2,1,230,1,false]]);
  for(const f of result.frames)assert.equal(parseAnimatedImage(await f.blob.arrayBuffer()),null);
});
test('static PNG/WebP and unrelated formats use the existing still-image importer',async()=>{
  assert.equal(parseAnimatedImage(png),null);assert.equal(parseAnimatedImage(webp),null);
  assert.equal(await decodeAnimatedImage(new Uint8Array([0xff,0xd8,0xff])),null);
});
test('truncated animation fails rather than silently importing a single frame',async()=>{
  for(const blob of [makeApng([png,png]),makeAnimatedWebp([webp,webp])]){
    const bytes=new Uint8Array(await blob.arrayBuffer());assert.throws(()=>parseAnimatedImage(bytes.subarray(0,bytes.length-8)),/Truncated|Incomplete/);
  }
});
test('compositor decodes all frames, replaces source pixels, applies disposal and scales',async()=>{
  const calls=[];
  const ctx={clearRect:(...args)=>calls.push(['clear',...args]),drawImage:()=>calls.push(['draw']),getImageData:()=>({data:Uint8ClampedArray.of(255,0,0,255)}),putImageData:()=>calls.push(['restore'])};
  let images=0;
  const result=await decodeAnimatedImage(await makeApng([png,png]).arrayBuffer(),{maxDimension:1,loadImage:async()=>{images++;return {};},createCanvas:()=>({getContext:()=>ctx})});
  assert.equal(images,2);assert.equal(result.width,1);assert.equal(result.height,1);
  assert.deepEqual(result.frames.map(f=>[...f.pixels]),[[0xff0000ff],[0xff0000ff]]);
  assert.ok(calls.some(c=>c[0]==='restore'));assert.ok(calls.filter(c=>c[0]==='clear').length>=5);
});
