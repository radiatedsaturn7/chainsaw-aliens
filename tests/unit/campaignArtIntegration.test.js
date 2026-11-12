import {applyCampaignArtCoverage} from '../../tools/campaigns/campaign_art_coverage.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {roadTextureSettings,roadTextureForSegment,showBuiltInRoadMarkings} from '../../src/racing/RaceRoadTextures.js';
const root='data/server-storage/files/';
const read=p=>{let d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const manifest=read(root+'manifest.json'),imports=read('data/campaigns/america/art-imports.json');
const expanded=read('data/campaigns/america/expanded-art.json').assets;
const race=read(root+'races/Laurel Highlands Scenic Byway/document.json').race;
test('reviewed PNG imports are registered, bounded and preserve alpha',()=>{
 assert.equal(Object.keys(imports).length,134+expanded.length);
 for(const [name,record] of Object.entries(imports)){
  const file=root+manifest.folders.art[name],raw=fs.readFileSync(file),art=read(file);
  assert.equal(createHash('sha256').update(raw).digest('hex'),record.documentSha256);
  const currentSourceHash=createHash('sha256').update(fs.readFileSync(record.source)).digest('hex');
  const pending=read('data/campaigns/america/art-import-pending.json').invalidSources?.[name];
  if(pending){assert.equal(currentSourceHash,pending.sourceSha256);assert.notEqual(currentSourceHash,record.sourceSha256);assert.match(pending.error,/PNG/);}
  else assert.equal(currentSourceHash,record.sourceSha256);
  const maxEdge=expanded.find(a=>a.name===name)?.maxEdge||512;
  assert.ok(art.width<=maxEdge&&art.height<=maxEdge);assert.equal(art.frames[0].length,art.width*art.height);
  assert.ok(art.frames[0].some(Boolean));
  if(/\/(vegetation|rocks|regions|roadside|decals|expanded)\//.test(record.source))assert.ok(art.frames[0].includes(null));
 }
});
test('Laurel artwork uses the road ribbon, saved ground art and valid doodad definitions',()=>{
 const textures=roadTextureSettings(race);assert.equal(textures.road.artRef,'road-asphalt-patched');
 assert.equal(textures.road.repeatWidthM,0);assert.equal(showBuiltInRoadMarkings(race),false);
 const cells=Object.values(race.road.tileMap.cells);
 assert.deepEqual(new Set(cells.map(c=>c.artRef)),new Set(['ground-frozen-forest']));
 const props=race.scenery.filter(p=>/^(leafless|frozen-bush|gray-rock)/.test(p.doodadRef||'')||p.id.startsWith('campaign-art-laurel-'));
 assert.ok(props.length>100);
 for(const p of props){
  const d=read(root+manifest.folders.doodads[p.doodadRef]).doodad;
  assert.equal(p.artRef,d.artRef);assert.ok(manifest.folders.art[d.artRef]);assert.equal(p.previewDoodad.id,d.id);
 }
 assert.ok(race.road.segments.every(s=>s.surface==='asphalt'));
 assert.ok(Math.max(...race.road.segments.map(s=>s.bumpiness))>.35,'frost-damage gameplay retained');
});
test('new scenery leaves the full road corridor clear, including adjacent hairpins',()=>{
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);
 for(const p of race.scenery.filter(p=>/^(leafless|frozen-bush|gray-rock)/.test(p.doodadRef||'')||p.id.startsWith('campaign-art-laurel-'))){
  const projection=editor.getRaceRouteProjectionForWorldPoint({x:p.x,z:p.z});
  assert.ok(Math.abs(projection.lateral)>=10+p.widthM/2-1e-6,p.id);
 }
});


test('new road ribbons match uniform physical surfaces and leave mixed stages uncovered',()=>{
 for(const [name,art,surface] of [['Ohio River Crossing','road-asphalt-wet','wet-asphalt'],['Historic Route 66','road-asphalt-faded66','asphalt'],['Angeles Crest Highway','road-asphalt-worn','asphalt']]){
  const r=read(root+manifest.folders.races[name]).race;
  assert.equal(roadTextureSettings(r).road.artRef,art);
  assert.ok(r.road.segments.every(s=>s.surface===surface));
 }
 for(const name of ['Data Center City','Pikes Peak Highway','Oak Creek Canyon','Moki Dugway']){
  const r=read(root+manifest.folders.races[name]).race;
  const settings=roadTextureSettings(r);
  for(const segment of r.road.segments)assert.ok(settings.surfaceRoads[segment.surface]?.artRef,'each physical surface gets its own ribbon');
 }
});

test('regional props keep clear of the road and preserve Tower Hill snowroad',()=>{
 for(const name of ['Tower Hill Road','Mount Washington Auto Road — point-to-point','Ohio River Crossing','Data Center City','Ozark Backroads','Historic Route 66','Pikes Peak Highway','Moki Dugway','Oak Creek Canyon','Angeles Crest Highway']){
  const r=read(root+manifest.folders.races[name]).race;
  const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(r);
  const props=r.scenery.filter(p=>p.id.startsWith('campaign-regional-'));
  assert.equal(new Set(props.map(p=>p.id)).size,props.length);
  for(const p of props){assert.ok(manifest.folders.doodads[p.doodadRef]);assert.ok(Math.abs(editor.getRaceRouteProjectionForWorldPoint(p).lateral)>=10+p.widthM/2-1e-6);}
  if(name==='Tower Hill Road')assert.equal(roadTextureSettings(r).road.artRef,'snowroad');
  if(name.startsWith('Mount Washington'))assert.equal(roadTextureSettings(r).road.artRef,'road-snow-packed');
 }
});

test('every delivered PNG is imported exactly once and decals remain surface art',()=>{
 const inventory=read('assets/campaign-art/inventory.json');
 assert.equal(inventory.assetCount,134);
 const bySource=new Map(Object.values(imports).map(r=>[r.source,r]));
 assert.equal(bySource.size,134+expanded.length);
 for(const asset of inventory.assets){
  assert.ok(bySource.has(`assets/campaign-art/${asset.path}`),asset.path); // Generator refreshes inventory hashes after the full revision.
 }
 const catalog=read('data/campaigns/america/catalog.json');
 for(const entry of catalog){
  const r=read(root+entry.documentPath).race;
  assert.ok(!r.scenery.some(p=>(p.artRef||'').startsWith('decal-')),'overhead decals must not be upright billboards');
 }
});

test('all delivered art has an actual campaign use, including ground decals and physical surface ribbons',()=>{
 const used=new Set();
 for(const e of read('data/campaigns/america/catalog.json')){
  const r=read(root+e.documentPath).race,settings=roadTextureSettings(r);
  used.add(r.skyboxArtRef);
  for(const p of [...r.scenery,...r.decals,...Object.values(r.road.tileMap.cells)])used.add(p.artRef);
  for(const segment of r.road.segments){used.add(roadTextureForSegment(settings,segment).artRef);if(r.margin?.shoulderMode==='on')used.add((settings.surfaceShoulders[segment.surface]||settings.shoulder).artRef);}
  for(const p of r.scenery.filter(p=>p.fenceId?.startsWith('campaign-complete'))){assert.equal(p.previewDoodad.isFence,true);assert.equal(p.previewDoodad.defaultRule.behavior,'collide');assert.ok(p.previewDoodad.fenceThicknessM>0);}
 }
 const deferred=new Set(expanded.filter(a=>a.deferredReason).map(a=>a.name));
 assert.deepEqual(Object.keys(imports).filter(name=>name!=='ground-snow-dead-grass'&&!deferred.has(name)&&!used.has(name)),[]);
});

test('exposed terrain keeps material weights and the marked turnout is a usable pull-off',()=>{
 const expected={'ground-brown-dirt-v2':'dirt','ground-industrial-concrete-v2':'asphalt','ground-industrial-rubble-v2':'gravel','ground-canyon-rock-v2':'gravel','ground-gray-gravel-v2':'gravel','ground-red-gravel-v2':'gravel','ground-desert-scrub-v2':'dirt','ground-alpine-rock-v2':'gravel'};
 const editor=new RaceEditor({});
 for(const entry of read('data/campaigns/america/catalog.json')){
  const r=read(root+entry.documentPath).race;
  for(const c of Object.values(r.road.tileMap.cells))if(expected[c.artRef])assert.equal(editor.normalizeRaceTileMapCell(c).tileId,expected[c.artRef]);
  if(entry.sourceKey==='angeles'){
   const turnout=r.scenery.find(p=>p.id==='campaign-complete-angeles-angeles-crest-turnout-sign')?.campaignPlacement?.turnout;
   assert.ok(turnout);assert.ok(turnout.spread<=1.2);assert.ok(turnout.widthM>=6&&turnout.lengthM>=12);
  }
 }
});

test('campaign scenery covers the corridor and terrain has continuous artwork instead of isolated grid patches',()=>{
 for(const entry of read('data/campaigns/america/catalog.json')){
  if(!entry.sourceKey && entry.stage===0)continue;
  const r=read(root+entry.documentPath).race;
  if(entry.name==='Tower Hill Road')continue;
  const cells=r.road.tileMap.cells;
  assert.ok(Object.values(cells).every(c=>manifest.folders.art[c.artRef]),entry.name+' has no untextured cells');
  assert.ok(manifest.folders.art[r.groundPlaneArtRef],entry.name+' distant ground');
  let edges=0,same=0;
  for(const [key,c] of Object.entries(cells)){
   const [x,z]=key.split(',').map(Number);
   for(const k of [`${x+1},${z}`,`${x},${z+1}`])if(cells[k]){edges++;if(c.artRef===cells[k].artRef)same++;}
  }
  assert.ok(same/edges>.9,entry.name+' must use broad terrain areas');
  if(entry.sourceKey!=='laurel')assert.ok(!r.scenery.some(p=>['tree','frozenbush','frozenrock','Factory'].includes(p.doodadRef)),entry.name+' generic scenery');
  for(const p of r.scenery.filter(p=>p.campaignAppearance)){
   assert.ok(p.widthM<=p.campaignAppearance.originalWidthM+1e-6);
   assert.ok(p.heightM<=p.campaignAppearance.originalHeightM+1e-6);
   const original=read(root+manifest.folders.doodads[p.campaignAppearance.originalRef]).doodad;
   assert.ok(p.previewDoodad.hitboxWidthM>0);
   assert.ok(p.previewDoodad.hitboxWidthM<=Math.max(original.hitboxWidthM,p.campaignAppearance.originalWidthM));
   assert.deepEqual(p.previewDoodad.defaultRule,original.defaultRule);
  }
 }
});

test('coverage preserves customized obstacle hitboxes, rules and positions and is repeatable',()=>{
 const custom={id:'old',artRef:'frozenrock',widthM:4,heightM:3,hitboxWidthM:2.36,hitboxHeightM:1.7,weightKg:1200,defaultRule:{behavior:'collide',speedDrainPercent:32,damage:{panels:4}}};
 const p={id:'test',doodadRef:'frozenrock',widthM:4,heightM:3,x:10,z:30,previewDoodad:custom};
 const r={scenery:[p],road:{tileMap:{cellSizeM:55,cells:{'0,0':{elevation:12}}}}};
 const definition=name=>({id:name,artRef:name,widthM:6,heightM:5});
 applyCampaignArtCoverage(r,'angeles',definition);
 assert.equal(p.previewDoodad.hitboxWidthM,2.36);assert.equal(p.previewDoodad.hitboxHeightM,1.7);
 assert.deepEqual(p.previewDoodad.defaultRule,custom.defaultRule);assert.equal(p.previewDoodad.weightKg,1200);
 assert.equal(p.x,10);assert.equal(p.z,30);assert.equal(r.road.tileMap.cells['0,0'].elevation,12);
 const first=structuredClone(r);applyCampaignArtCoverage(r,'angeles',definition);assert.deepEqual(r,first);
});

test('every campaign doodad and its artwork resolves and is included in the preload list',()=>{
 const editor=new RaceEditor({});
 for(const entry of read('data/campaigns/america/catalog.json')){
  const r=read(root+entry.documentPath).race;editor.applyLoadedRaceDocument(r);
  const refs=new Set(editor.collectSelectedRaceArtRefs());
  for(const p of r.scenery){
   assert.ok(manifest.folders.doodads[p.doodadRef],entry.name+': '+p.doodadRef);
   assert.ok(manifest.folders.art[p.artRef],entry.name+': '+p.artRef);
   assert.ok(refs.has(p.artRef));
   if(p.previewDoodad)assert.equal(editor.resolveRaceDoodadForScenery(p).artRef,p.artRef);
  }
 }
});

test('road detail repeats along each imported campaign stage and landmarks leave the road clear',()=>{
 const editor=new RaceEditor({});
 for(const entry of read('data/campaigns/america/catalog.json').filter(e=>e.sourceKey)){
  const r=read(root+entry.documentPath).race;editor.applyLoadedRaceDocument(r);
  const length=editor.getRaceRouteLength(),details=r.decals.filter(d=>d.id.startsWith('campaign-detail-'));
  assert.ok(details.length>=Math.floor(length/350)-1,entry.name);
  for(const p of r.scenery.filter(p=>p.id.includes('-landmark-'))){
   assert.ok(manifest.folders.doodads[p.doodadRef]);
   assert.ok(Math.abs(editor.getRaceRouteProjectionForWorldPoint(p).lateral)>=10+p.widthM/2-1e-6,p.id);
  }
 }
});


test('expanded landmarks use reviewed regions and stay outside the driving corridor',()=>{
 const catalog=read('data/campaigns/america/catalog.json');
 for(const entry of catalog){
  const key=entry.sourceKey||(catalog.indexOf(entry)===0?'tower':'mount');
  const r=read(root+entry.documentPath).race,editor=new RaceEditor({});editor.applyLoadedRaceDocument(r);
  for(const p of r.scenery.filter(p=>p.artRef?.startsWith('expanded-'))){
   const a=expanded.find(a=>a.name===p.artRef);
   assert.ok(a?.placements.some(plan=>plan.race===key),p.artRef+' in '+entry.name);
   assert.ok(Math.abs(editor.getRaceRouteProjectionForWorldPoint(p).lateral)>=10+p.widthM/2-1e-6,p.id);
   assert.equal(p.previewDoodad.defaultRule.behavior,a.kind==='vegetation'?'flatten':a.kind==='background'?'decoration':'collide');
   if(a.kind==='fence')assert.equal(p.previewDoodad.isFence,true);
  }
 }
 for(const a of expanded.filter(a=>a.deferredReason)){assert.equal(a.placements.length,0);assert.ok(manifest.folders.art[a.name]);}
});

 test('matching campaign skyboxes use saved editor settings and preload',()=>{
 const catalog=read('data/campaigns/america/catalog.json');
 for(const [i,e] of catalog.entries()){
  const key=e.sourceKey||(i===0?'tower':'mount'),r=read(root+e.documentPath).race;
  const a=expanded.find(a=>a.kind==='skybox'&&a.placements.some(p=>p.race===key));
  assert.ok(a);assert.equal(r.skyboxArtRef,a.name);assert.equal(r.skyboxSettings.artRef,a.name);
  const editor=new RaceEditor({});editor.applyLoadedRaceDocument(r);assert.ok(editor.collectSelectedRaceArtRefs().includes(a.name));
 }
});

 test('art refresh retains native fence panel geometry',()=>{
 for(const e of read('data/campaigns/america/catalog.json'))for(const p of read(root+e.documentPath).race.scenery){
  if(!p.fenceId||!p.campaignArtBounds)continue;
  assert.equal(p.widthM,p.campaignArtBounds.widthM,p.id);assert.equal(p.heightM,p.campaignArtBounds.heightM,p.id);
 }
});

test('eastern foliage is grounded, region-specific and soft plants do not become solid barriers',()=>{
 const foliage=expanded.filter(a=>a.source.startsWith('foliage-expansion/'));
 assert.equal(foliage.length,22);
 const counts=new Map();
 for(const a of foliage){
  const art=read(root+manifest.folders.art[a.name]),def=read(root+manifest.folders.doodads[a.name]).doodad;
  assert.ok(art.frames[0].includes(null),a.name+' transparent background');
  const bottom=art.frames[0].reduce((last,c,i)=>c&&(c.length<9||parseInt(c.slice(-2),16)>=32)?Math.floor(i/art.width):last,-1);
  assert.ok(Math.abs(def.groundOffsetM-a.heightM*(art.height-1-bottom)/art.height)<.0001,a.name+' grounding');
  if(a.kind==='vegetation'){assert.equal(def.defaultRule.behavior,'flatten');assert.equal(def.defaultRule.damage.panels,0);}
  if(a.kind==='tree')assert.ok(def.hitboxWidthM<=.65,a.name+' trunk hitbox');
 }
 for(const [i,e] of read('data/campaigns/america/catalog.json').entries()){
  const key=e.sourceKey||(i===0?'tower':'mount'),r=read(root+e.documentPath).race;
  for(const p of r.scenery){
   const a=foliage.find(a=>a.name===p.artRef);if(!a)continue;
   assert.ok(a.placements.some(plan=>plan.race===key),p.id);
   const scale=p.heightM/a.heightM;
   assert.ok(Math.abs(p.groundOffsetM-a.groundOffsetM*scale)<1e-8,p.id+' scaled padding');
   assert.equal(p.previewDoodad.groundOffsetM,p.groundOffsetM);
   if(p.campaignDistanceLayer)continue;
   counts.set(a.name,(counts.get(a.name)||0)+1);
  }
 }
 for(const a of foliage)assert.equal(counts.get(a.name),a.placements.length,a.name+' all planned placements');
});

test('every campaign has biome-specific distant clusters inside saved terrain and outside the road corridor',()=>{
 const configs=read('data/campaigns/america/distant-scenery.json');
 for(const [i,e] of read('data/campaigns/america/catalog.json').entries()){
  const key=e.sourceKey||(i===0?'tower':'mount'),r=read(root+e.documentPath).race,config=configs[key],tile=r.road.tileMap;
  const allowed=new Set([...config.refs.flat(),...(config.upper?.refs||[])]);
  const placements=r.scenery.filter(p=>p.campaignDistanceLayer);
  assert.ok(placements.length>150,e.name+' distant layer');
  assert.ok(placements.some(p=>Math.abs(p.trackLateral)>400),e.name+' distant horizon');
  for(const p of placements){
   assert.ok(allowed.has(p.doodadRef),p.id+' biome');
   assert.ok(Math.abs(p.trackLateral)>=65,p.id+' road clearance');
   assert.ok(tile.cells[`${Math.floor(p.x/tile.cellSizeM)},${Math.floor(p.z/tile.cellSizeM)}`],p.id+' terrain coverage');
   assert.ok(manifest.folders.doodads[p.doodadRef],p.id+' saved asset');
  }
 }
});
