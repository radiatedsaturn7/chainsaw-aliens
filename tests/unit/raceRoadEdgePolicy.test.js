import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createDefaultRace,createBuiltInTestRaces} from '../../src/racing/raceData.js';
import {createRaceStaticColliderWorld} from '../../src/racing/RaceSimulation.js';

const root='data/server-storage/files/';
const read=path=>{const d=JSON.parse(fs.readFileSync(path));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};

test('all saved roads load without invisible margin/shoulder collision or boundary resets',()=>{
 const editor=new RaceEditor({});
 const races=read(root+'manifest.json').folders.races;
 assert.ok(Object.keys(races).length>=24);
 for(const [name,path] of Object.entries(races)){
  const race=editor.normalizeLoadedRaceDocument(read(root+path));
  assert.equal(race.margin.collisionMode,'none',name);
  assert.equal(race.margin.collisionEdge,'none',name);
  for(const segment of [...race.road.segments,...(race.road.network?.edges||[])]) assert.ok(!segment.boundaryCollidable,name);
  for(const surface of ['gravel','wet-gravel']) assert.notEqual(race.roadTextures?.surfaceShoulders?.[surface]?.artRef,'shoulder-dirt-grass',name);
 }
 const moki=read(root+races['Moki Dugway']).race;
 assert.equal(moki.roadTextures.surfaceShoulders.dirt.artRef,'ground-canyon-rock-v2');
 assert.equal(moki.roadTextures.surfaceShoulders.gravel.artRef,'ground-red-gravel-v2');
});

test('new and built-in roads default to collision-free edges',()=>{
 for(const race of [createDefaultRace(),...createBuiltInTestRaces()]){
  assert.equal(race.margin.collisionMode,'none',race.name);
  assert.equal(race.margin.collisionEdge,'none',race.name);
 }
});

test('collision-free edges generate no invisible walls and preserve authored barriers',()=>{
 const editor=new RaceEditor({});
 const segment={surface:'asphalt',length:100,roadWidthM:8};
 editor.selectedRace.road.segments=[segment];
 editor.selectedRace.staticColliders=[{id:'guardrail',type:'box',center:{x:5,y:1,z:50},size:{x:.3,y:2,z:20}}];
 editor.ensureRaceScenery=()=>[];
 editor.getRacePathSamplesCached=()=>[{x:0,z:0,elevation:0,segment},{x:0,z:100,elevation:0,segment}];
 const authority={};
 createRaceStaticColliderWorld(editor,{authority,worldBake:{},runtimeType:'destination',routeLength:100});
 assert.equal(editor.getRaceEdgeCollisionMode(segment),'none');
 assert.deepEqual(authority.staticColliderDefinitions.map(c=>c.id),['guardrail']);
});
