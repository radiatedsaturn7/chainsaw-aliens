import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {assertVisualOnly,assertLedger} from '../../tools/race-environments/visual-contract.mjs';
test('environment ledger covers every saved selector race exactly once',()=>{const l=JSON.parse(fs.readFileSync('data/race-environments/ledger.json')),m=JSON.parse(fs.readFileSync('data/server-storage/files/manifest.json'));assertLedger(l,Object.keys(m.folders.races));const bad=structuredClone(l);bad.rows[1].siteGroup=bad.rows[0].siteGroup;assert.throws(()=>assertLedger(bad,Object.keys(m.folders.races)),/Shared site/);});
test('visual contract permits refs but rejects physics, lighting, weights and scenery changes',()=>{const r={skyboxArtRef:'a',skyboxSettings:{artRef:'a',scaleX:1},weather:'clear',brightness:.4,road:{segments:[{surface:'asphalt',x:1}],tileMap:{cells:{a:{artRef:'a',tileId:'dirt',tileWeights:{dirt:1}}}}},scenery:[{artRef:'tree',x:5}]};const a=structuredClone(r);a.skyboxArtRef='b';a.skyboxSettings.artRef='b';a.road.tileMap.cells.a.artRef='brown';assertVisualOnly(r,a);for(const mutate of [r=>r.weather='snow',r=>r.brightness=.8,r=>r.road.segments[0].surface='gravel',r=>r.road.segments[0].x=2,r=>r.road.tileMap.cells.a.tileWeights.dirt=.5,r=>r.scenery[0].artRef='other',r=>r.skyboxSettings.scaleX=2]){const b=structuredClone(a);mutate(b);assert.throws(()=>assertVisualOnly(r,b));}});
import {skySeamMetrics} from '../../tools/race-environments/seam.mjs';
test('seam diagnostics flag a vertical discontinuity, never substitute for visual review',()=>{assert.equal(skySeamMetrics(Array(40).fill('#112233'),4,10).numericWarning,false);const bad=Array(40).fill('#000000');for(let y=0;y<10;y++)bad[y*4+3]='#ffffff';const metrics=skySeamMetrics(bad,4,10);assert.equal(metrics.numericWarning,true);assert.equal(metrics.visualReviewRequired,true);});

test('all effective texture refs can vary without permitting shoulder physics or tile weights',()=>{const r={margin:{artRef:'edge',collisionMode:'solid',widthM:2},roadTextures:{surfaceRoads:{gravel:{artRef:'gravel',roughArtRef:'rough',repeatM:12}},surfaceShoulders:{dirt:{artRef:'verge',repeatM:5}}},road:{tileMap:{cells:{a:{tileId:'snow',tileWeights:{snow:1}}}}}};const a=structuredClone(r);a.margin.artRef='new-edge';a.roadTextures.surfaceRoads.gravel.roughArtRef='new-rough';a.roadTextures.surfaceShoulders.dirt.artRef='new-verge';a.road.tileMap.cells.a.artRef='forest';a.road.tileMap.cells.a.roughArtRef='forest';assertVisualOnly(r,a);for(const mutate of [x=>x.margin.collisionMode='none',x=>x.margin.widthM=4,x=>x.roadTextures.surfaceShoulders.dirt.repeatM=6,x=>x.road.tileMap.cells.a.tileId='grass',x=>x.road.tileMap.cells.a.tileWeights.snow=.5]){const b=structuredClone(a);mutate(b);assert.throws(()=>assertVisualOnly(r,b));}});

test('same-site evidence cannot authorize incompatible weather or time',()=>{const rows=[{raceRef:'a',siteGroup:'same',sharingEvidence:['same physical site'],authoredEnvironment:{timeOfDay:'day',weather:'clear'}},{raceRef:'b',siteGroup:'same',sharingEvidence:['same physical site'],authoredEnvironment:{timeOfDay:'night',weather:'snow'}}];assert.throws(()=>assertLedger({rows},['a','b']),/incompatible authored environment/);});

import {authoredFreeRaceArtwork} from '../helpers/campaignArtworkValidation.mjs';
test('free-race art requires an exact active binding and runtime selector, never a blanket exemption',()=>{
 const registry={schemaVersion:1,assets:{sky:{raceRef:'free',slot:'sky',reason:'exact authored location'}}},menu={screens:[{elements:[{source:'races',binding:'raceRef'}]}]},manifest={folders:{races:{free:'free.json'},art:{sky:'sky.json'}}},read=()=>({race:{skyboxArtRef:'sky',skyboxSettings:{artRef:'sky'}}});
 assert.deepEqual([...authoredFreeRaceArtwork(registry,menu,manifest,read,[])],['sky']);
 assert.throws(()=>authoredFreeRaceArtwork(registry,{screens:[]},manifest,read,[]),/selector/);
 assert.throws(()=>authoredFreeRaceArtwork(registry,menu,{folders:{races:{},art:{sky:'sky.json'}}},read,[]),/Unreachable/);
 assert.throws(()=>authoredFreeRaceArtwork(registry,menu,manifest,()=>({race:{skyboxArtRef:'other'}}),[]),/placement/);
 assert.throws(()=>authoredFreeRaceArtwork(registry,menu,manifest,read,['free.json']),/campaign guard/);
 assert.throws(()=>authoredFreeRaceArtwork({schemaVersion:1,assets:{sky:{raceRef:'free',slot:'preload',reason:'unused'}}},menu,manifest,read,[]),/Invalid/);
});

import {resolveDiagnosticRaceChoice} from '../../tools/race-environments/selector.mjs';
test('diagnostic selector aliases must exactly match the manifest folder and logical race',()=>{
 assert.equal(resolveDiagnosticRaceChoice([{value:'A — B'}],'A — B','races/A %E2%80%94 B/document.json').mode,'exact-logical-name');
 assert.equal(resolveDiagnosticRaceChoice([{value:'A %E2%80%94 B'}],'A — B','races/A %E2%80%94 B/document.json').mode,'exact-manifest-encoded-folder');
 assert.throws(()=>resolveDiagnosticRaceChoice([{value:'other'}],'A — B','races/A %E2%80%94 B/document.json'),/absent/);
 assert.throws(()=>resolveDiagnosticRaceChoice([{value:'other'}],'A — B','races/other/document.json'),/does not identify/);
});

import {assertTerrainArtMaterial} from '../../tools/race-environments/terrain-materials.mjs';
test('material-specific terrain rejects snow/rock and dirt/gravel swaps in normal and rough layers',()=>{
 for(const [ref,correct,wrong] of [['ground-alpine-snow-granite-v1','snow','gravel'],['ground-decomposed-granite-dirt-v1','dirt','gravel'],['ground-winter-snow-litter-v1','snow','grass'],['ground-temperate-grass-v1','grass','snow'],['ground-alpine-rock-v2','gravel','snow'],['ground-gray-gravel-v2','gravel','dirt']]){
  for(const slot of ['artRef','roughArtRef']){
   assertTerrainArtMaterial({[slot]:ref},{tileId:correct});
   assert.throws(()=>assertTerrainArtMaterial({[slot]:ref},{tileId:wrong}),/must visually represent/);
  }
 }
});
import {gunzipSync} from 'node:zlib';
import {terrainArtMaterials} from '../../tools/race-environments/terrain-materials.mjs';
test('Northeast visual bindings declare a matching material for every normal and rough terrain cell',()=>{
 const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
 const rows=ledger.rows.filter(r=>r.environmentPack==='northeast-corridor-pack11');
 assert.equal(rows.length,20);
 let cells=0;
 for(const row of rows){
  let doc=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));
  if(doc.__chainsawStorage)doc=JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')));
  const entries=Object.values(doc.race.road.tileMap.cells);assert.ok(entries.length>0,row.raceRef);
  for(const cell of entries){
   assert.ok(terrainArtMaterials[cell.artRef],`${row.raceRef}: undeclared terrain art ${cell.artRef}`);
   if(cell.roughArtRef)assert.ok(terrainArtMaterials[cell.roughArtRef],`${row.raceRef}: undeclared rough art`);
   assertTerrainArtMaterial(cell,{tileId:cell.tileId});cells++;
  }
 }
 assert.ok(cells>20);
});

test('PPIR snow cells keep snow artwork after distant-horizon correction',()=>{
 const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
 const row=ledger.rows.find(r=>r.binding?.skyboxArtRef==='environment-v1-ppir-noon');
 let doc=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));
 if(doc.__chainsawStorage)doc=JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')));
 const cells=Object.values(doc.race.road.tileMap.cells);assert.ok(cells.length>0);
 for(const c of cells){assert.equal(c.tileId,'snow');assert.ok(terrainArtMaterials[c.artRef]);assert.ok(terrainArtMaterials[c.roughArtRef]);assertTerrainArtMaterial(c,{tileId:c.tileId});}
});
