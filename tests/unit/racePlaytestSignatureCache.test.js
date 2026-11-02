import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
function fixture(){
 const e=Object.create(RaceEditor.prototype);
 const race={id:'mountain',road:{width:3,nodes:[{x:0,z:0,elevation:0},{x:10,z:20,elevation:5}],segments:[{length:25,roadWidthM:8}],tileMap:{revision:0,cellSizeM:5},groundTiles:[]},margin:{}};
 e.project={races:[race],selectedRaceId:race.id};
 e.playtestSession={running:true,worldBake:{}};
 e.raceInput={paused:false};
 e.nodeReads=0;
 e.getRaceEditableNodes=()=>{e.nodeReads++;return e.selectedRace.road.nodes;};
 e.ensureRaceTileMap=()=>e.selectedRace.road.tileMap;
 e.ensureRaceMarginSettings=()=>e.selectedRace.margin;
 e.getActiveRaceRuntimeType=()=> 'point-to-point';
 e.getRaceRouteLength=()=>25;
 e.getRaceRoadHalfWidthWorld=()=>4;
 e.getRaceBoundaryWidthWorld=()=>.2;
 e.getRaceVisibleMarginWidthWorld=()=>.2;
 e.getRaceShoulderWidthWorld=()=>12;
 e.getRaceRoadTerrainBlendWidthWorld=()=>15;
 return e;
}
test('running bake retains only static signatures, with dynamic caches fresh every frame',()=>{
 const e=fixture();let first,path,frame;
 e.withRaceGeometryReadCache(()=>{
  first=e.getRaceSurfaceGeometryRevisionKey();path=e.getRacePathSampleCacheSignature();
  frame=e.raceGeometryReadCache;frame.weatherState={old:true};frame.rawMapPoints=['old'];
 });
 const reads=e.nodeReads;
 for(let i=0;i<100;i++)e.withRaceGeometryReadCache(()=>{
  assert.equal(e.getRaceSurfaceGeometryRevisionKey(),first);
  assert.equal(e.getRacePathSampleCacheSignature(),path);
  assert.notStrictEqual(e.raceGeometryReadCache,frame);
  assert.equal(e.raceGeometryReadCache.weatherState,undefined);
  assert.equal(e.raceGeometryReadCache.rawMapPoints,null);
 });
 assert.equal(e.nodeReads,reads);
});
test('geometry edits, revision changes, bake swaps, pauses and new sessions discard retained signatures',()=>{
 const e=fixture();
 const read=()=>e.withRaceGeometryReadCache(()=>e.getRaceSurfaceGeometryRevisionKey());
 let previous=read();
 e.selectedRace.road.nodes[1].x+=1;
 e.clearRaceRuntimeSurfaceCaches();
 assert.notEqual(read(),previous);previous=read();
 e.selectedRace.road.tileMap.revision++;
 assert.notEqual(read(),previous);
 for(const change of [()=>e.playtestSession.worldBake={},()=>e.playtestSession={...e.playtestSession},()=>e.selectedRace.road={...e.selectedRace.road},()=>e.selectedRace.road.tileMap={...e.selectedRace.road.tileMap}]){
  read();const reads=e.nodeReads;change();read();assert.ok(e.nodeReads>reads);
 }
 e.raceInput.paused=true;read();const reads=e.nodeReads;read();assert.ok(e.nodeReads>reads);
 e.selectedRace.road.nodes[0].x+=10;e.raceInput.paused=false;
 previous=read();
 e.playtestSession.running=false;e.selectedRace.road.nodes[0].x+=10;
 assert.notEqual(read(),previous);
});
test('explicit invalidation clears current shared signature maps inside nested scope',()=>{
 const e=fixture();
 e.withRaceGeometryReadCache(()=>{
  const before=e.getRacePathSampleCacheSignature();
  e.withRaceGeometryReadCache(()=>{
   e.selectedRace.road.nodes[0].x=70;e.clearRaceRuntimeSurfaceCaches();
   assert.notEqual(e.getRacePathSampleCacheSignature(),before);
  });
 });
 assert.equal(e.raceGeometryReadCache,undefined);
});
