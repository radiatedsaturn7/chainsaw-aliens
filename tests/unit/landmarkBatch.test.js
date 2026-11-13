import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {roadContinuationSamples} from '../../src/racing/RaceRoadContinuations.js';
import {roadClearance} from '../../tools/campaigns/landmarkPlacement.mjs';
const root='data/server-storage/files/';
const read=p=>{const v=JSON.parse(fs.readFileSync(p));return v.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(v.data,'base64'))):v;};
const hash=d=>crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex');
test('all 200 landmarks retain individually resumable progress; imported does not imply visual QA',()=>{
 const brief=read('AI/last-on-the-grid/state-expansion-landmark-artwork.json');
 const ledger=read('data/campaigns/america/state-expansion/landmark-art-progress.json');
 const refs=brief.cities.flatMap(c=>c.landmarks.map(m=>m.suggestedArtRef));
 assert.equal(refs.length,200);assert.deepEqual(Object.keys(ledger.assets).sort(),refs.sort());
 for(const row of Object.values(ledger.assets)){
  assert.ok(['pending','passed'].includes(row.visualQA));
  if(row.visualQA==='passed')assert.ok(row.visualEvidence?.length,'Visual pass needs screenshot evidence');
 }
});
test('registered Providence sprites resolve, retain source alpha, and keep every road corridor clear',()=>{
 const ledger=read('data/campaigns/america/state-expansion/landmark-art-progress.json');
 const manifest=read(root+'manifest.json');
 const city=read('data/campaigns/america/state-expansion/landmarks/RI.json');
 const {race}=read(root+manifest.folders.races[city.raceRef]);
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);
 const samples=roadContinuationSamples(race.road,editor.getRacePathSamplesCached({step:2}),editor.getRaceRouteLength());
 const segments=samples.slice(1).map((b,i)=>({a:samples[i],b,halfWidth:Math.max(editor.getRaceRoadWidthMForSegment(samples[i].segment),editor.getRaceRoadWidthMForSegment(b.segment))/2,samplingPaddingM:2}));
 for(const mark of city.landmarks){
  const name=mark.suggestedArtRef,row=ledger.assets[name];
  const art=read(root+manifest.folders.art[name]);
  assert.ok(art.frames[0].some(p=>p===null),'True transparent saved sprite required');
  const {doodad:def}=read(root+manifest.folders.doodads[name]);
  assert.equal(def.artRef,name);assert.equal(def.defaultRule.behavior,'collide');
  const props=race.scenery.filter(p=>p.id===`city-landmark-${name}`);assert.equal(props.length,1);
  assert.deepEqual(props[0].previewDoodad,def);
  const clearance=roadClearance(props[0],def,segments);assert.ok(clearance>=5,name);
  assert.equal(row.roadSha256,hash(race.road));assert.ok(Math.abs(clearance-row.placementDetails.minimumRoadClearanceM)<1e-6);
 }
});
