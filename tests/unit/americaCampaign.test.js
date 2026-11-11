import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createAmericaWorldMap,AMERICA_OPENING_RACE} from '../../src/menus/AmericaWorldMap.js';
import {normalizeMenuElement} from '../../src/menus/MenuDocument.js';
import {worldMapNodes,worldMapSelectableNodes,raceCompletionKey} from '../../src/menus/MenuWorldMap.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const catalog=read('data/campaigns/america/catalog.json');
const map=normalizeMenuElement({type:'world-map',...createAmericaWorldMap(catalog)});
const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;
const raceFor=s=>decode(read(path.join('data/server-storage/files',s.documentPath))).race;
const expected=['Tower Hill Road','Mount Washington Auto Road','Laurel Highlands Scenic Byway','Ohio River Crossing','Ozark Backroads','Data Center City','Historic Route 66','Pikes Peak Highway','Moki Dugway','Oak Creek Canyon','Angeles Crest Highway'];

test('eleven ordered Middle Route locations resolve to installed races',()=>{
 assert.deepEqual(catalog.map(s=>s.label||s.name),expected);
 assert.equal(new Set(catalog.map(s=>s.id)).size,11);
 const manifest=read('data/server-storage/files/manifest.json');
 for(const [i,stage] of catalog.entries()){
  assert.equal(stage.branch,'middle');assert.equal(stage.stage,i+1);
  assert.equal(manifest.folders.races[stage.name],stage.documentPath);
  assert.ok(Number.isFinite(stage.location.lat)&&Number.isFinite(stage.location.lon));
  const race=raceFor(stage);assert.equal(race.id,stage.id);assert.equal(race.type,'destination');
  assert.equal(race.finishBehavior.menuScreen,'world-map');
 }
 assert.ok(!Object.keys(manifest.folders.races).some(n=>/^(North|South|Middle) \d\d - /.test(n)));
});

test('nine imported stages retain connected GPS provenance, usable elevation and realistic widths',()=>{
 for(const stage of catalog.filter(s=>!s.preserveExisting)){
  const race=raceFor(stage),source=read(`data/campaigns/america/middle-sources/${stage.sourceKey}.json`);
  const ids=new Set(source.ways.map(w=>w.id));
  assert.ok(race.source.osmWayIds.length>0);
  assert.ok(race.source.osmWayIds.every(id=>ids.has(id)));
  const gps=race.source.routeReference.originalGeometry;
  assert.ok(gps.length>2);
  const visited=new Set();
  for(const p of gps){
   const key=`${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
   assert.ok(!visited.has(key),`${stage.name}: repeated GPS position`);visited.add(key);
  }
  assert.ok(race.road.nodes.length>2&&race.road.nodes.length<=600);
  assert.equal(race.road.nodes.length,race.road.segments.length+1);
  assert.equal(race.road.nodes[0].role,'start');assert.equal(race.road.nodes.at(-1).role,'finish');
  assert.ok(race.road.segments.every(s=>s.length>0&&Number.isFinite(s.elevation)&&s.roadWidthM>=3&&s.roadWidthM<=30));
  assert.equal(race.source.elevationMissingNodeCount,0);
  assert.ok(race.road.nodes.some(n=>Math.abs(n.elevation)>.1));
  assert.equal(race.road.autoExtend,false);assert.ok(['snow','clear','storm'].includes(race.weather));
  assert.ok(race.scenery.length>20);assert.equal(race.drivingGuide.line,true);
  assert.ok(race.codriver.calls.every(c=>c.generated==='steering-recce-v3'&&c.at>=0&&c.at<=stage.lengthM*1.03));
  assert.ok(stage.estimatedDrivingSeconds>0);assert.ok(stage.durationRangeSeconds[0]<stage.estimatedDrivingSeconds);
 }
});

test('single geographic route unlocks exactly one next race at a time',()=>{
 assert.equal(map.nodes.length,11);assert.equal(map.connections.length,10);
 const parameters={};
 assert.equal(worldMapSelectableNodes(worldMapNodes(map,null,null,parameters)).length,1);
 assert.equal(map.nodes[0].raceRef,AMERICA_OPENING_RACE);
 for(const [i,stage] of catalog.entries()){
  const nodes=worldMapNodes(map,null,null,parameters);
  assert.equal(nodes[i].locked,false);
  if(i<10)assert.equal(nodes[i+1].locked,true);
  if(i)assert.ok(map.connections.some(c=>c.from===catalog[i-1].id&&c.to===stage.id));
  parameters[raceCompletionKey(stage.name)]=true;
  assert.equal(worldMapSelectableNodes(worldMapNodes(map,null,null,parameters)).length,Math.min(11,i+2));
 }
 // The requested St Louis stop is east of the Ozarks; geography is not faked.
 assert.ok(map.nodes[5].x>map.nodes[4].x);
 assert.ok(map.nodes[1].y<map.nodes[0].y);
});

test('saved menu retains route progression with editable pin positions and old completions cannot skip new stages',()=>{
 const menu=decode(read('data/server-storage/files/menus/Game Menu/document.json'));
 const saved=normalizeMenuElement(menu.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map'));
 const progression=nodes=>nodes.map(({id,raceRef,unlockParameter,unlockValue,completedParameter})=>({id,raceRef,unlockParameter,unlockValue,completedParameter}));
 assert.deepEqual(progression(saved.nodes),progression(map.nodes));
 assert.deepEqual(saved.connections.map(({from,to})=>({from,to})),map.connections.map(({from,to})=>({from,to})));
 assert.ok(saved.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
 const parameters={[raceCompletionKey('North 01 - Providence - Blackstone')]:true,[raceCompletionKey(AMERICA_OPENING_RACE)]:true};
 assert.deepEqual(worldMapSelectableNodes(worldMapNodes(saved,null,null,parameters)).map(n=>n.raceRef),catalog.slice(0,2).map(s=>s.name));
 assert.equal(menu.parameters.campaignOpeningRace,AMERICA_OPENING_RACE);
});

test('campaign map remains extensible beyond eleven races',()=>{
 const extra={...catalog.at(-1),id:'future-stage',name:'Future Stage',stage:12,location:{lat:33,lon:-119}};
 const expanded=createAmericaWorldMap([...catalog,extra]);
 assert.equal(expanded.nodes.length,12);assert.equal(expanded.connections.length,11);
 assert.equal(expanded.nodes.at(-1).unlockParameter,raceCompletionKey(catalog.at(-1).name));
});

test('every campaign document loads editable GPS geometry',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 for(const stage of catalog){
  const race=raceFor(stage);editor.applyLoadedRaceDocument(race);
  assert.equal(editor.selectedRace.id,stage.id);
  assert.equal(editor.selectedRace.road.nodes.length,race.road.nodes.length);
  assert.ok(editor.getRacePathSamples({step:10}).length>20);
 }
});

test('geographic pins and selected labels stay legible on phone and landscape maps',async()=>{
 const {worldMapNodePoint,worldMapNodeRadius}=await import('../../src/menus/MenuWorldMap.js');
 const {drawWorldMap}=await import('../../src/menus/MenuWorldMapRenderer.js');
 for(const b of [{x:20,y:80,w:351,h:500},{x:40,y:60,w:760,h:238}]){
  const points=map.nodes.map(n=>worldMapNodePoint(n,b,map)),diameter=2*(worldMapNodeRadius(b,map)+5);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>diameter,'selection rings overlap');
  const labels=[];const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{}});
  drawWorldMap(ctx,b,map,null,{}, {},catalog[0].name,{drawText:(text,x,y,width)=>labels.push({text,x,y,width})});
  assert.ok(labels.some(l=>l.text.includes('Tower Hill Road')));
  assert.ok(!labels.some(l=>l.text===catalog[2].name),'avoid overlapping long geographic labels; show them in the selected detail');
 }
});
