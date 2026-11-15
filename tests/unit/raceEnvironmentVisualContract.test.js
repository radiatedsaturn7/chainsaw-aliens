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

import {resolveDiagnosticRaceChoice,assertRequestedRaceCoverage} from '../../tools/race-environments/selector.mjs';
test('diagnostic selector aliases must exactly match the manifest folder and logical race',()=>{
 assert.equal(resolveDiagnosticRaceChoice([{value:'A — B'}],'A — B','races/A %E2%80%94 B/document.json').mode,'exact-logical-name');
 assert.equal(resolveDiagnosticRaceChoice([{value:'A %E2%80%94 B'}],'A — B','races/A %E2%80%94 B/document.json').mode,'exact-manifest-encoded-folder');
 assert.throws(()=>resolveDiagnosticRaceChoice([{value:'other'}],'A — B','races/A %E2%80%94 B/document.json'),/absent/);
 assert.throws(()=>resolveDiagnosticRaceChoice([{value:'other'}],'A — B','races/other/document.json'),/does not identify/);
});

import {assertTerrainArtMaterial} from '../../tools/race-environments/terrain-materials.mjs';
test('material-specific terrain rejects snow/rock and dirt/gravel swaps in normal and rough layers',()=>{
 for(const [ref,correct,wrong] of [['ground-volcanic-cinder-v1','gravel','snow'],['ground-volcanic-snow-v1','snow','gravel'],['ground-plains-snow-straw-v1','snow','grass'],['ground-prairie-grass-v1','grass','dirt'],['ground-snow-chaparral-v1','snow','dirt'],['ground-alpine-snow-granite-v1','snow','gravel'],['ground-decomposed-granite-dirt-v1','dirt','gravel'],['ground-winter-snow-litter-v1','snow','grass'],['ground-patchy-snow-leaf-v1','snow','dirt'],['ground-temperate-grass-v1','grass','snow'],['ground-alpine-rock-v2','gravel','snow'],['ground-gray-gravel-v2','gravel','dirt']]){
  for(const slot of ['artRef','roughArtRef']){
   assertTerrainArtMaterial({[slot]:ref},{tileId:correct});
   assert.throws(()=>assertTerrainArtMaterial({[slot]:ref},{tileId:wrong}),/must visually represent/);
  }
 }
});
import {gunzipSync} from 'node:zlib';
import {terrainArtMaterials} from '../../tools/race-environments/terrain-materials.mjs';
test('Northeast, Plains and Western visual bindings declare a matching material for every normal and rough terrain cell',()=>{
 const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
 const rows=ledger.rows.filter(r=>['northeast-corridor-pack11','plains-route66-pack12','western-mountains-pacific-pack13','south-greatlakes-pack14'].includes(r.environmentPack));
 assert.equal(rows.length,88);
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

 test('Angeles Forest preserves snow material with visibly snowy art, never dry scrub',()=>{
 const l=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
 const row=l.rows.find(r=>r.raceRef==='Angeles Forest Highway — County N3');
 let d=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));if(d.__chainsawStorage)d=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));
 const cells=Object.values(d.race.road.tileMap.cells);assert.equal(cells.length,17952);
 for(const c of cells){assert.equal(c.tileId,'snow');assert.equal(c.artRef,'ground-snow-chaparral-v1');assert.equal(c.roughArtRef,c.artRef);assertTerrainArtMaterial(c,{tileId:c.tileId});}
 });

test('requested native QA cannot silently omit a misspelled, unbound or filtered route',()=>{
 const selected=[{raceRef:'exact'}];assertRequestedRaceCoverage(selected,['exact']);
 assert.throws(()=>assertRequestedRaceCoverage(selected,['typo']),/missing from QA selection/);
 assert.throws(()=>assertRequestedRaceCoverage([],['exact']),/missing from QA selection/);
 assert.throws(()=>assertRequestedRaceCoverage(selected,['exact','exact']),/Duplicate/);
});

test('final island and legacy bindings preserve exact baseline cell coverage including four empty default-grass maps',()=>{
 const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
 const rows=ledger.rows.filter(r=>r.environmentPack==='islands-legacy-final-pack15');assert.equal(rows.length,20);
 const expected=[1585,15397,0,0,48133,0,0,23975,17222,13857,22230,16422,25807,20196,16380,15180,7065,16536,11622,11934];
 const recipes=JSON.parse(fs.readFileSync('data/race-environments/pack15-recipes.json')).recipes;assert.equal(recipes.length,20);
 for(const [i,recipe] of recipes.entries()){
  const row=rows.find(r=>r.raceRef===recipe.raceRef);assert.ok(row);
  let doc=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));if(doc.__chainsawStorage)doc=JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')));
  const map=doc.race.road.tileMap,entries=Object.values(map.cells);assert.equal(entries.length,expected[i],row.raceRef);
  if(!entries.length){assert.equal(map.defaultTileId,'grass');assert.equal(recipe.ground,'ground-temperate-grass-v1');}
  for(const cell of entries){for(const slot of ['artRef','roughArtRef'])assert.ok(terrainArtMaterials[cell[slot]],row.raceRef+': '+slot);assertTerrainArtMaterial(cell,{tileId:cell.tileId});}
 }
});

test('all245 routes have declared terrain in both layers and material-correct ground planes',()=>{
 const l=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));assert.equal(l.rows.length,245);let total=0,empty=0;
 for(const row of l.rows){let d=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));if(d.__chainsawStorage)d=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));const map=d.race.road.tileMap,counts={};
  for(const cell of Object.values(map.cells)){assert.ok(cell.artRef&&cell.roughArtRef,row.raceRef);assertTerrainArtMaterial(cell,{tileId:cell.tileId});counts[cell.tileId]=(counts[cell.tileId]||0)+1;total++;}
  const dominant=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]||map.defaultTileId;if(!Object.keys(counts).length)empty++;
  assert.equal(terrainArtMaterials[d.race.groundPlaneArtRef],dominant,row.raceRef+' ground plane substrate');
 }
 assert.equal(total,3355076);assert.equal(empty,4);
 assert.throws(()=>assertTerrainArtMaterial({artRef:'unclassified-example'},{tileId:'grass'}),/Unclassified/);
 assert.throws(()=>assertTerrainArtMaterial({artRef:'ground-frosted-grass-v1'},{tileId:'snow'}),/must visually represent/);
});

test('new surface-specific art preserves exact inherited sampling and active physics',()=>{
 const base={road:{segments:[{surface:'asphalt'},{surface:'dirt'},{surface:'gravel'}]},roadTextures:{road:{artRef:'asphaltRoad',repeatM:3,repeatWidthM:3,mipmaps:true,mipmapDistance:10,filterMode:'inherit',anisotropy:16}}};
 const a=structuredClone(base);a.roadTextures.surfaceRoads={dirt:{...base.roadTextures.road,artRef:'road-dirt-packed'},gravel:{...base.roadTextures.road,artRef:'road-gravel-gray'}};assertVisualOnly(base,a);
 for(const mutate of [x=>x.roadTextures.surfaceRoads.dirt.repeatM=5,x=>x.roadTextures.surfaceRoads.dirt.enabled=false,x=>x.roadTextures.surfaceRoads.dirt.filterMode='smooth',x=>x.roadTextures.surfaceRoads.snow={...base.roadTextures.road,artRef:'snowroad'},x=>x.road.segments[1].surface='asphalt']){const b=structuredClone(a);mutate(b);assert.throws(()=>assertVisualOnly(base,b));}
});

import {roadVisualStatus} from '../../tools/race-environments/road-materials.mjs';
test('road visual cover requires known snow art and actual freezing authored snowfall',()=>{
 const snow={weather:'snow',weatherIntensity:1,weatherTemperatureC:-8};assert.equal(roadVisualStatus('snowroad','asphalt',snow),'authored-snow-cover');
 for(const r of [{...snow,weather:'clear'},{...snow,weatherIntensity:0},{...snow,weatherTemperatureC:8},{...snow,weatherTemperatureC:undefined}])assert.equal(roadVisualStatus('snowroad','asphalt',r),'mismatch');
 assert.equal(roadVisualStatus('invented-snow','asphalt',snow),'unclassified');assert.equal(roadVisualStatus('road-dirt-packed','asphalt',snow),'mismatch');
});

 test('legacy tileArtRef is a visual-only cell fallback, never permission to change physics or arbitrary nested fields',()=>{
 const before={road:{tileMap:{cells:{a:{tileId:'snow',tileWeights:{snow:1},artRef:'new',roughArtRef:'new',tileArtRef:'old'}}}},scenery:[{tileArtRef:'unrelated'}]};
 const after=structuredClone(before);after.road.tileMap.cells.a.tileArtRef='new';assertVisualOnly(before,after);
 const weights=structuredClone(after);weights.road.tileMap.cells.a.tileWeights.snow=.5;assert.throws(()=>assertVisualOnly(before,weights));
 const other=structuredClone(after);other.scenery[0].tileArtRef='new';assert.throws(()=>assertVisualOnly(before,other));
 });
