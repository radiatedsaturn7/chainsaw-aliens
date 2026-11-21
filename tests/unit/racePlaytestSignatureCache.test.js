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


function updateFixture(){
 const e=fixture();e.game={};e.previewOffset=0;
 for(const name of ['syncRacePhysicalGamepad','updateRacePlaytestFps','updateRaceMapThumbstickPan','updateRaceKeyboardInput'])e[name]=()=>{};
 e.isLivePlaytestSession=()=>true;e.hasPhysicalRaceGamepad=()=>false;
 e.getRaceWorldPoseAtDistance=()=>{e.getRaceSurfaceGeometryRevisionKey();return {x:0,z:10,yaw:0};};
 e.getRaceSessionCar=()=>({});e.getRaceCarTuning=()=>({});
 let simulationScope;
 e.updatePlaytestSafely=()=>e.withRaceGeometryReadCache(()=>{
  simulationScope=e.raceGeometryReadCache;e.getRaceSurfaceGeometryRevisionKey();return true;
 });
 e.surfaceReads=0;
 e.getRaceSurfaceModel=()=>({samplePhysicsGeometry:p=>{
  e.surfaceReads++;e.getRaceSurfaceGeometryRevisionKey();return {valid:true,region:'road',heightM:p.y};
 }});
 e.getRaceRouteProjectionForWorldPoint=()=>({distance:10});
 e.playtestSession.vehicleDynamicsRunner={state:{orientation:{x:0,y:0,z:0,w:1},
  position:{x:0,y:.55,z:10},grounded:true,supportedWheelCount:4,
  contactPatches:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{
   validTreadContact:true,normalLoadN:1000,contactPointWorld:{x:0,y:0,z:10}
  }]))}};
 e.updateRaceAutomaticVehicleRecovery=dt=>{
  assert.equal(e.raceGeometryReadCache,simulationScope,'post-simulation recovery must share the read cache');
  return RaceEditor.prototype.updateRaceAutomaticVehicleRecovery.call(e,dt);
 };
 return e;
}
test('full update shares road signatures across simulation, assists and recovery',()=>{
 const e=updateFixture();
 e.update({},1/60);const reads=e.nodeReads;
 assert.ok(reads>0);assert.equal(e.surfaceReads,12);assert.equal(e.raceGeometryReadCache,undefined);
 for(let i=0;i<50;i++)e.update({},1/60);
 assert.equal(e.nodeReads,reads,'unchanged road must not be reserialized by post-simulation reads');
 e.selectedRace.road.tileMap.revision++;e.update({},1/60);
 assert.ok(e.nodeReads>reads,'authored changes must still invalidate the cache');
});
test('failed simulation and thrown recovery still close the read scope and frame budget',()=>{
 for(const failure of ['simulation','recovery']){
  const e=updateFixture();let finished=0,recoveryCalls=0;
  e.playtestSession.frameBudget={finish:()=>finished++};
  e.updateRaceAutomaticVehicleRecovery=()=>{recoveryCalls++;throw new Error('recovery failure');};
  if(failure==='simulation')e.updatePlaytestSafely=()=>false;
  if(failure==='simulation')e.update({},1/60);
  else assert.throws(()=>e.update({},1/60),/recovery failure/);
  assert.equal(recoveryCalls,failure==='simulation'?0:1);
  assert.equal(finished,1);assert.equal(e.deferRaceFrameBudgetFinish,false);
  assert.equal(e.raceGeometryReadCache,undefined);
 }
});
