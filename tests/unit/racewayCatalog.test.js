import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {createCampaignHubMenus,campaignEventCategory} from '../../src/menus/CampaignHubMenus.js';
const root=path.resolve('data/server-storage/files');
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const catalog=read('data/campaigns/america/raceways/catalog.json');
const side=read('data/campaigns/america/side-races/catalog.json');
const events=[...catalog.filter(e=>e.venueKey),...side.filter(e=>e.venueKey)];

test('Turini terrain stays aligned with its mountain road without kilometre-wide cuttings',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const event=catalog.find(e=>e.id==='legacy-turini');
 const doc=read(path.join(root,event.documentPath));
 const editor=new RaceEditor({});editor.applyLoadedRaceDocument(doc);
 const bake=editor.withRaceGeometryReadCache(()=>editor.getRaceSurfaceBake({step:2.5,routeLength:editor.getRaceRouteLength(),runtimeType:'destination',allowVisualExtension:true}));
 assert.ok(bake.sections.length>5000);
 assert.ok(bake.sections.every(s=>s.metrics.transitionWidth<300),'misaligned elevations create enormous terrain fields');
});

test('every reviewed raceway layout resolves to dense mapped geometry and distinct course provenance',()=>{
 const keys=new Set(),shapes=new Set(),rallyShapes=new Set();
 const rallySourcesRoot=path.resolve('data/campaigns/america/raceways/sources');
 // Reproducible short Fuji OSM loops: dense 50m sampling, exact reviewed source ways.
 const fujiShort=new Map([
  ['raceway-fuji-short-outer',[39,[148620323,196331214,196331215]]],
  ['raceway-fuji-short-middle',[35,[148620323,196331214,196331215,196353740,196353741]]],
  ['raceway-fuji-short-inner',[29,[148620323,196331214,196353740]]],
 ]);
 for(const event of events){
  assert.equal(event.status,'installed');assert.ok(!keys.has(event.raceRef));keys.add(event.raceRef);
  const {race}=read(path.join(root,event.documentPath));
  assert.equal(race.name,event.raceRef);assert.equal(race.type,event.import_kind==='road'?'destination':'circuit');const short=fujiShort.get(event.id);
  if(short){
   assert.equal(race.road.nodes.length,short[0],event.raceRef);
   assert.deepEqual(race.source.osmWayIds,short[1],event.raceRef);
   assert.ok(race.road.segments.every(s=>s.length<=50.01),event.raceRef);
   fujiShort.delete(event.id);
  }else assert.ok(race.road.nodes.length>35,event.raceRef);
  const source=race.source;
  if(event.id.startsWith('rally-')){
   // Long rally parent roads can come from a published organizer trace or a
   // reviewed mapped road. Verify the raw snapshot and separate saved routes.
   assert.ok(source.rallyCollection?.id,event.raceRef);
   assert.match(source.layoutReference,/^https:\/\//,event.raceRef);
   assert.ok(source.geometryMethod,event.raceRef);
   const snapshot=path.resolve(source.sourceSnapshot);
   assert.equal(path.dirname(snapshot),rallySourcesRoot,event.raceRef);
   assert.equal(createHash('sha256').update(fs.readFileSync(snapshot)).digest('hex'),source.sourceSha256,event.raceRef);
   assert.ok(source.provider,event.raceRef);
   if(source.provider.includes('OpenStreetMap'))assert.ok(source.osmWayIds.length>0,event.raceRef);
   const geometry=JSON.stringify(race.road.nodes.map(({x,y,elevation})=>[x,y,elevation]));
   const digest=createHash('sha256').update(geometry).digest('hex');
   assert.ok(!rallyShapes.has(digest),event.raceRef);rallyShapes.add(digest);
  }else{
   assert.ok(source.osmWayIds.length>0,event.raceRef);assert.match(source.provider,/OpenStreetMap/,event.raceRef);
   assert.match(source.layoutGeometrySha256,/^[0-9a-f]{64}$/,event.raceRef);
   assert.ok(!shapes.has(source.layoutGeometrySha256),event.raceRef);shapes.add(source.layoutGeometrySha256);
  }
  assert.equal(race.road.autoExtend,false);assert.equal(race.road.nodes.length,race.road.segments.length+1);
  const [a,b]=[race.road.nodes[0],race.road.nodes.at(-1)];if(race.type==='circuit')assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.01,event.raceRef);
  assert.ok(race.road.nodes.every(p=>[p.x,p.y,p.elevation].every(Number.isFinite)));
  assert.ok(race.road.segments.every(s=>s.length>0&&s.roadWidthM>=3&&s.roadWidthM<=30));
  assert.equal(race.triggers.length,0,'Do not copy the intro timeout/cutscenes');
  assert.ok(race.roadTextures.road.artRef);assert.ok(race.scenery.length>0,event.raceRef);
  if(event.hubStage)assert.equal(campaignEventCategory(event),'raceways');
 }
 assert.equal(fujiShort.size,0,'All three reviewed Fuji short courses remain installed');
 for(const venue of ['watkins','road-america','road-atlanta','vir','sebring','indianapolis','homestead','daytona','laguna','willow','lime','mid-ohio'])assert.ok(events.some(e=>e.venueKey===venue),venue);
});

test('legacy references stay stable and oval banking is present without banking the infield',()=>{
 for(const [name,id] of [['Daytona Tri-Oval','daytona-tri-oval'],['WeatherTech Raceway Laguna Seca','weathertech-raceway'],['Nurburgring Nordschleife','nurburgring-nordschleife']]){
  const e=catalog.find(e=>e.raceRef===name);const r=read(path.join(root,e.documentPath)).race;
  assert.equal(r.id,id);assert.ok(r.road.nodes.length>60,name);
 }
 for(const [id,bank] of [['raceway-daytona-oval',31],['raceway-homestead-oval',19],['raceway-indianapolis-oval',9.2]]){
  const r=read(path.join(root,catalog.find(e=>e.id===id).documentPath)).race;
  assert.ok(r.road.segments.some(s=>s.banking===bank),id);
 }
 const drift=side.find(e=>e.id==='H11-S08');assert.equal(read(path.join(root,drift.documentPath)).race.campaign.scoring,'drift');
 const road=read(path.join(root,catalog.find(e=>e.id==='raceway-daytona-sports-car').documentPath)).race;
 assert.ok(road.road.segments.some(s=>s.banking===0));assert.ok(road.road.segments.some(s=>s.banking===31));
});

test('all installed US layouts appear once in campaign menus and remain optional',()=>{
 const main=read('data/campaigns/america/catalog.json'),research=read('AI/last-on-the-grid/last_on_the_grid_99_side_races.json');
 const {screens}=createCampaignHubMenus(main,research,[...side,...catalog]);
 const buttons=screens.flatMap(s=>s.elements).filter(e=>e.action?.parameter==='raceRef');
 for(const event of events.filter(e=>e.hubStage))assert.equal(buttons.filter(b=>b.action.value===event.raceRef).length,1,event.raceRef);
 for(const s of screens)assert.ok(s.elements.filter(e=>e.type==='button').length<=8,s.id);
 assert.equal(main.length,11);
 const researchedIds=research.hubs.flatMap(hub=>hub.races.map(race=>race.id)).sort();
 assert.equal(researchedIds.length,99);
 assert.deepEqual(side.filter(event=>event.id!=='detour-tower-hill').map(event=>event.id).sort(),researchedIds);
 const detours=side.filter(event=>event.id==='detour-tower-hill');
 assert.equal(detours.length,1);
 const [tower]=detours;
 assert.equal(tower.status,'installed');assert.equal(tower.raceRef,'Tower Hill Road');
 assert.equal(tower.hubRaceRef,'Providence, RI — Landmark Run');
 assert.equal(tower.documentPath,'races/Tower Hill Road/document.json');
 assert.equal(campaignEventCategory(tower),'detours');
 assert.equal(read(path.join(root,tower.documentPath)).race.name,tower.raceRef);
});
