import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {createAmericaWorldMap} from '../../src/menus/AmericaWorldMap.js';
import {normalizeMenuElement} from '../../src/menus/MenuDocument.js';
import {worldMapNodes,worldMapSelectableNodes,raceCompletionKey,worldMapDirectionalNode} from '../../src/menus/MenuWorldMap.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const catalog=read('../../data/campaigns/america/catalog.json');
const map=normalizeMenuElement({type:'world-map',...createAmericaWorldMap(catalog)});
const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;

test('24 real-road races have GPS provenance and installed playable documents',()=>{
 assert.equal(catalog.length,24);assert.equal(new Set(catalog.map(s=>s.id)).size,24);
 for(const stage of catalog){
  const race=decode(read(`../../data/server-storage/files/races/${stage.name}/document.json`)).race;
  assert.equal(race.type,'destination');assert.equal(race.laps,1);
  assert.equal(race.source.elevationSmoothingRadiusM,45);
  assert.equal(race.source.shoulderFlatJoinM,8);
  assert.equal(race.source.shoulderBlendWidthM,32);
  assert.equal(race.source.shoulderMaxSlope,.22);
  assert.ok(race.road.segments.every(s=>s.bumpiness<=.035));
  assert.equal(race.drivingGuide.line,true);
  assert.equal(race.codriver.enabled,false);
  assert.ok(race.codriver.calls.every(c=>c.generated==='steering-recce-v3' && c.at>=0 && c.at<=stage.lengthM));
  assert.equal(race.finishBehavior.menuScreen,'world-map');
  assert.ok(race.source.osmWayIds.length>0);
  assert.ok(race.source.routeReference.originalGeometry.length>2);
  assert.ok(race.road.nodes.length>2&&race.road.nodes.length<=600);
  assert.equal(race.road.nodes[0].role,'start');assert.equal(race.road.nodes.at(-1).role,'finish');
  assert.ok(race.road.segments.every(s=>s.length>0&&Number.isFinite(s.elevation)));
  assert.equal(race.road.nodes.length,race.road.segments.length+1);
  assert.ok(Math.hypot(race.road.nodes.at(-1).x-race.road.nodes[0].x,race.road.nodes.at(-1).y-race.road.nodes[0].y)>50);
  assert.equal(race.id,stage.id);
  assert.equal(race.name,stage.name);
  const sourceIds=new Set(read('../../data/campaigns/america/osm-ways.json').map(w=>w.id));
  assert.ok(race.source.osmWayIds.every(id=>sourceIds.has(id)));
 }
});
test('three independent eight-race branches run right to left between shared endpoints',()=>{
 assert.equal(map.nodes.length,26);assert.equal(map.connections.length,27);
 assert.equal(worldMapSelectableNodes(worldMapNodes(map,null,null,{})).length,3);
 for(const branch of ['north','middle','south']){
  const stages=catalog.filter(s=>s.branch===branch);assert.equal(stages.length,8);
  let previous=map.nodes.find(n=>n.id==='providence');const parameters={};
  for(const [i,stage] of stages.entries()){
   const node=map.nodes.find(n=>n.id===stage.id);assert.ok(node.x<previous.x);
   assert.equal(stage.stage,i+1);assert.equal(stage.difficulty,i+1);
   if(i&&i<7)assert.ok(stage.location.lon<stages[i-1].location.lon); // California branches turn toward LA for the finale.
   assert.ok(map.connections.some(c=>c.from===previous.id&&c.to===node.id));
   assert.equal(worldMapNodes(map,null,null,parameters).find(n=>n.id===stage.id).locked,false);
   parameters[raceCompletionKey(stage.name)]=true;previous=node;
  }
  assert.ok(map.connections.some(c=>c.from===previous.id&&c.to==='los-angeles'));
  const available=worldMapSelectableNodes(worldMapNodes(map,null,null,parameters));
  assert.equal(available.length,10); // eight on this branch + two other starting races
 }
});
test('saved menu matches campaign and direction controls follow westward progress',()=>{
 const menu=decode(read('../../data/server-storage/files/menus/Game Menu/document.json'));
 const saved=normalizeMenuElement(menu.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map'));
 assert.deepEqual(saved.nodes,map.nodes);assert.deepEqual(saved.connections,map.connections);
 const north=catalog.filter(s=>s.branch==='north');
 const parameters={[raceCompletionKey(north[0].name)]:true};
 const nodes=worldMapNodes(saved,null,null,parameters);
 assert.equal(worldMapDirectionalNode(nodes,north[0].name,'left',{x:0,y:0,w:960,h:500},saved).raceRef,north[1].name);
});

test('dense map keeps endpoint labels and selection rings legible at phone and desktop sizes',async()=>{
 const {drawWorldMap}=await import('../../src/menus/MenuWorldMapRenderer.js');
 const {worldMapNodePoint,worldMapNodeRadius}=await import('../../src/menus/MenuWorldMap.js');
 for(const b of [{x:20,y:80,w:351,h:500},{x:40,y:60,w:760,h:238},{x:50,y:80,w:1100,h:500}]){
  const labels=[];const stack=[];
  const ctx=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();}},{get:(o,k)=>k in o?o[k]:()=>{}});
  drawWorldMap(ctx,b,map,null,{}, {},catalog[0].name,{drawText:(text,x,y,width)=>labels.push({text,x,y,width})});
  for(const name of ['Providence','Los Angeles']){
   const label=labels.find(l=>l.text===name);assert.ok(label);
   assert.ok(label.x-label.width/2>=b.x&&label.x+label.width/2<=b.x+b.w);
  }
  assert.ok(!labels.some(l=>l.text===catalog[1].name)); // full race name stays in selected detail
  const radius=worldMapNodeRadius(b,map)+5;
  const points=map.nodes.filter(n=>n.kind==='race').map(n=>worldMapNodePoint(n,b,map));
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>radius*2);
  }
 }
});

test('every campaign track loads into the race editor with editable GPS nodes and terrain',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 for(const stage of catalog){
  const race=decode(read(`../../data/server-storage/files/races/${stage.name}/document.json`)).race;
  editor.applyLoadedRaceDocument(race);
  const loaded=editor.selectedRace;
  assert.equal(loaded.id,stage.id);assert.equal(loaded.type,'destination');
  assert.equal(loaded.road.nodes.length,race.road.nodes.length);
  assert.equal(loaded.road.tileMap.cellSizeM,race.road.tileMap.cellSizeM);
  assert.equal(loaded.weather,race.weather);assert.equal(loaded.timeOfDay,race.timeOfDay);
  assert.ok(editor.getRacePathSamples({step:10}).length>20);
  assert.ok(editor.getRaceGroundTileChoices().some(t=>t.id===loaded.road.tileMap.defaultTileId));
 }
});
