import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
const read = p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const root='data/server-storage/files/';
const manifest=read(root+'manifest.json');
const catalog=read('data/campaigns/america/regional-fences.json');
test('regional fence kit references registered transparent art and explicitly solid barrier definitions',()=>{
 assert.equal(new Set(catalog.assets.map(a=>a.name)).size,catalog.assets.length);
 for(const a of catalog.assets){
  const d=read(root+manifest.folders.doodads[a.name]).doodad;
  const raw=read(root+manifest.folders.art[a.name]);
  const art=raw.__chainsawStorage ? JSON.parse(zlib.gunzipSync(Buffer.from(raw.data,'base64'))):raw;
  assert.equal(d.artRef,a.name);assert.equal(d.isFence,true);
  assert.equal(d.fenceMirrorRepeat,a.mirrorRepeat);assert.match(d.name,/solid fence/);
  assert.equal(d.widthM,a.widthM);assert.equal(d.heightM,a.heightM);
  assert.equal(art.width,512);assert.ok(art.frames[0].flat(Infinity).includes(null));
  const panels=buildRaceFencePlacements([{x:0,z:0},{x:d.widthM*3,z:0}],d);
  assert.ok(Math.abs(panels.reduce((n,p)=>n+p.widthM,0)-d.widthM*3)<1e-7);
  assert.ok(panels.every(p=>p.solid&&p.previewDoodad.defaultRule.behavior==='collide'));
  if(!a.mirrorRepeat) assert.ok(panels.every(p=>p.fenceU1>p.fenceU0));
 }
});
