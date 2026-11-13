import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceRoadbedProfile,sampleRaceRoadbedProfileAtDistance} from '../../src/racing/RaceRoadDeckProfile.js';
import {sampleRoadContinuation} from '../../src/racing/RaceRoadContinuations.js';
import {reverseRaceRoute} from '../../src/racing/reverseRaceRoute.js';
const read=name=>{const doc=JSON.parse(fs.readFileSync(`data/server-storage/files/races/${name}/document.json`));return (doc.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(doc.data,'base64'))):doc).race;};
const editorFor=race=>{const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);return editor;};
test('legacy extrapolation is optional; finite authored bends preserve the timed profile',()=>{
 const samples=[{distance:0,x:0,z:0,elevation:0,yaw:0},{distance:100,x:0,z:100,elevation:1,yaw:0}];
 const road={autoExtend:false,continuations:{start:[{offset:-30,x:0,z:-30,elevation:0,yaw:0}],finish:[{offset:30,x:10,z:125,elevation:.8,yaw:1}]}};
 const build=autoExtend=>buildRaceRoadbedProfile({routeLength:100,absoluteRouteElevation:true,allowVisualExtension:true,autoExtend,continuationRange:{minVisualDistance:-30,maxVisualDistance:130},adapter:{clampElevation:v=>v,getWorldPoseAtDistance:d=>d<0||d>100?sampleRoadContinuation(road,d,samples,100):{x:0,z:d,elevation:d/100,yaw:0},sampleTerrain:()=>0}});
 const old=build(true),finite=build(false);
 assert.deepEqual(finite.samples.filter(p=>p.distance>=0&&p.distance<=100),old.samples);
 assert.equal(finite.samples[0].distance,-30);assert.equal(finite.samples.at(-1).distance,130);
 const far=sampleRaceRoadbedProfileAtDistance(2000,finite);assert.equal(far.distance,130);assert.equal(far.x,10);
 assert.ok(sampleRaceRoadbedProfileAtDistance(2000,old).elevation>10);
});
test('saved campaign roads have finite approaches, terrain and no Providence start reversal',()=>{
 const stages=JSON.parse(fs.readFileSync('data/campaigns/america/catalog.json'));
 const names=[...new Set([...stages.map(s=>s.documentPath?.split('/')[1]||s.name),...fs.readdirSync('data/server-storage/files/races').filter(n=>n.startsWith('Mount Washington Auto Road'))])];
 assert.equal(names.length,12);
 for(const name of names){
  const race=read(name),road=race.road;assert.equal(road.autoExtend,false,name);
  for(const side of ['start','finish']){
   // Straight timing-line relocation can resample/trim a finite approach.
   // Validate its extent and ordering rather than an obsolete 80-node count.
   const approach=road.continuations[side];assert.ok(approach.length>=2,name);
   assert.ok(approach.every((p,i)=>Number.isFinite(p.offset)&&(!i||p.offset>approach[i-1].offset)),name);
   assert.ok(Math.max(...approach.map(p=>Math.abs(p.offset)))>=350,name);
   assert.ok(Math.max(...approach.map(p=>Math.abs(p.offset)))<=450,name);
   for(const p of road.continuations[side]){
    assert.ok(Number.isFinite(p.elevation));
    const cell=road.tileMap.cells[`${Math.floor(p.x/road.tileMap.cellSizeM)},${Math.floor(p.z/road.tileMap.cellSizeM)}`];assert.ok(cell,`${name}: ground below ${side}`);
   }
  }
 }
 const race=read(stages[0].name),[a,b,c]=race.road.nodes;
 assert.ok((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)>0);
 assert.ok(race.source.routeReference.originalGeometry.length>0);
});
test('Mount Washington continuation turns downhill, joins continuously and projects as road',()=>{
 const name=fs.readdirSync('data/server-storage/files/races').find(n=>n.startsWith('Mount Washington Auto Road')&&!n.endsWith('Copy'));
 const editor=editorFor(read(name)),length=editor.getRaceRouteLength();
 const profile=editor.getRaceRoadbedProfile({routeLength:length,allowVisualExtension:true});
 const at=d=>editor.sampleRaceRoadbedProfileAtDistance(d,profile);
 assert.ok(at(length+400).elevation<at(length).elevation-1);
 assert.ok(Math.abs(at(length+400).yaw-at(length).yaw)>.5);
 assert.ok(Math.abs(at(length+.01).elevation-at(length).elevation)*12<.01);
 assert.ok(Math.abs(at(-.01).elevation-at(0).elevation)*12<.01);
 const p=at(length+200),projection=editor.getRaceRouteProjectionForWorldPoint(p);
 assert.ok(Math.abs(projection.distance-(length+200))<2);
 assert.ok(Math.hypot(at(length+.01).x-at(length).x,at(length+.01).z-at(length).z)<.02);
 const end=at(length+400);
 assert.equal(editor.getRaceRouteProjectionForWorldPoint({x:end.x+Math.sin(end.yaw)*100,z:end.z+Math.cos(end.yaw)*100}).segment,null);
 assert.ok(projection.distanceToRoute<1);
 assert.ok(at(length+5000).elevation===at(length+400).elevation);
 for(let i=1;i<profile.samples.length;i++){
  const a=profile.samples[i-1],b=profile.samples[i];
  assert.ok(Math.abs((b.elevation-a.elevation)*12/(b.distance-a.distance))<.25,`grade at ${b.distance}`);
 }
});
test('auto extension setting survives serialization and disabled empty ends stay finite',()=>{
 const editor=editorFor({id:'finite',name:'finite',type:'destination',road:{autoExtend:false,nodes:[{x:0,y:0,elevation:0},{x:0,y:100,elevation:1}],segments:[{length:100}]}});
 assert.equal(editor.getRaceVisualDistanceRange().startVisualExtension,0);
 assert.equal(editor.getRaceWorldPoseAtDistance(300,{allowVisualExtension:true}).z,100);
 assert.equal(editor.serializeSelectedRaceDocument().race.road.autoExtend,false);
 assert.ok(editor.getMenuItems('settings').some(i=>i.id==='race-auto-extend'));
 editor.handleMenuAction('race-auto-extend');assert.equal(editor.selectedRace.road.autoExtend,true);
 editor.handleMenuAction('undo');assert.equal(editor.selectedRace.road.autoExtend,false);
});

test('reversing a road swaps its finite approaches and driving direction',()=>{
 const race={type:'destination',road:{autoExtend:false,nodes:[{x:0,y:0},{x:0,y:100}],segments:[{}],continuations:{start:[{offset:-20,x:0,z:-20,yaw:0}],finish:[{offset:30,x:5,z:125,yaw:1}]}}};
 reverseRaceRoute(race);
 assert.equal(race.road.continuations.start[0].offset,-30);
 assert.equal(race.road.continuations.finish[0].offset,20);
 assert.equal(race.road.continuations.start[0].x,5);
 reverseRaceRoute(race);
 assert.ok(Math.abs(race.road.continuations.finish[0].yaw-1)<1e-10);
});
test('world bake includes finite runouts once and ground beyond their ends',()=>{
 const cells={};for(let z=-4;z<10;z++)for(let x=-4;x<5;x++)cells[`${x},${z}`]={tileId:'grass',elevation:0};
 const editor=editorFor({id:'bake-finite',name:'bake-finite',type:'destination',source:{importVersion:3},road:{autoExtend:false,width:8,elevationRange:{min:-100,max:100},nodes:[{x:0,y:0,elevation:0},{x:0,y:100,elevation:0}],segments:[{length:100,roadWidthM:8,surface:'asphalt'}],tileMap:{preserveCellSize:true,cellSizeM:20,cells,defaultTileId:'grass'},continuations:{start:[{offset:-30,x:0,z:-30,elevation:0,yaw:0}],finish:[{offset:40,x:10,z:139,elevation:0,yaw:.25}]}}});
 const bake=editor.buildRaceWorldBake({routeLength:100,runtimeType:'destination',validate:false});
 const distances=bake.surfaceBake.sections.map(s=>s.deck.distance);
 assert.equal(distances[0],-30);assert.equal(distances.at(-1),140);
 assert.ok(distances.every((d,i)=>!i||d>distances[i-1]));
 assert.ok(bake.terrainCells.some(c=>c.points.some(p=>p.z>150)));
 assert.ok(bake.mesh.triangles.some(t=>t.region==='road'&&t.vertices.some(p=>p.z>100)));
});
