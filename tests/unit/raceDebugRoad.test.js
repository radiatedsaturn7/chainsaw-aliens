import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
import {DEBUG_ROAD_SURFACES, debugRoadTextureSettings} from '../../src/racing/RaceDebugRoad.js';
import {buildRoadTextureStrips} from '../../src/racing/RaceRoadTextures.js';
import {buildRaceBakedSurfaceSampler,packRaceBakedSurfaceSampler} from '../../src/racing/RaceBakedSurfaceSampler.js';
import {applyPackedDebugRoad,createPackedRaceWorkerEnvironmentProvider} from '../../src/racing/simulation/PackedRaceWorkerEnvironment.js';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

function snowyTrack() {
  return new TrackState({sampleBaseSurface:p=>({region:p.x<10?'road':'terrain',baseSurfaceId:'snow',friction:.34,elevationM:12,normal:{x:0,y:1,z:0}}),profileOverrides:{snow:{snowDepthMm:25.4}}});
}
test('road override changes existing and unseen road cells, leaves terrain intact, restores authored snow',()=>{
  const track=snowyTrack();
  const road=track.sample({x:0,z:0}).cell;
  const terrain=structuredClone(track.sample({x:20,z:0}).cell);
  track.setDebugRoad({surface:'asphalt',snowDepthMm:0});
  for (const z of [0,100]) {
    const sample=track.sample({x:0,z});
    assert.equal(sample.effectiveSurfaceId,'asphalt');
    assert.equal(sample.cell.snowDepthMm,0);
    assert.equal(sample.cell.iceDepthMm,0);
    assert.equal(sample.cell.baseGrip,1);
    assert.equal(sample.cell.elevationM,12);
  }
  assert.deepEqual(track.sample({x:20,z:0}).cell,terrain);
  assert.ok(track.visualDirtyKeys.has(road.key));
  track.setDebugRoad({});
  assert.equal(track.sample({x:0,z:0}).cell.snowDepthMm,25.4);
  assert.equal(track.sample({x:0,z:200}).cell.baseSurfaceId,'snow');
});
test('road depth and material are independent and prior snowfall is not replayed after clearing',()=>{
  const track=snowyTrack();
  track.advance(1,{type:'snow',ambientTemperatureC:-5,precipitationRateMmPerS:1});
  track.setDebugRoad({surface:'asphalt',snowDepthMm:0});
  assert.equal(track.sample({x:0,z:100}).cell.snowDepthMm,0);
  track.setDebugRoad({surface:'asphalt',snowDepthMm:76.2});
  assert.equal(track.sample({x:0,z:100}).cell.snowDepthMm,76.2);
  assert.equal(track.sample({x:0,z:100}).cell.baseSurfaceId,'asphalt');
});
test('debug ribbon overrides all authored surface mappings without editing the race',()=>{
  const race={roadTextures:{road:{artRef:'snowroad'},surfaceRoads:{snow:{artRef:'road-snow-packed'}},debugSurfaces:{asphalt:'asphaltRoad'}}};
  const before=structuredClone(race);
  const settings=debugRoadTextureSettings(race,{surface:'asphalt'});
  const section=z=>({center:{distance:z,segment:{surface:'snow'}},left:{x:-3,z,elevation:2},right:{x:3,z,elevation:2}});
  const bake={surfaceBake:{sections:[section(0),section(10)]}};
  const strips=buildRoadTextureStrips(bake,settings);
  assert.ok(strips.roadMeshes.length);
  assert.ok(strips.roadMeshes.every(mesh=>mesh.artRef==='asphaltRoad'));
  assert.deepEqual(race,before);
  assert.equal(debugRoadTextureSettings(race,{}).overrideRoad,undefined);
  for(const surface of DEBUG_ROAD_SURFACES)assert.ok(fs.existsSync(`data/server-storage/files/art/${surface.artRef}/document.json`));
});
test('pause Road menu stays within eight rows and sends session-only overrides to worker',()=>{
  const editor=new RaceEditor({});
  const before=JSON.stringify(editor.selectedRace);
  const updates=[];
  editor.playtestSession={trackState:snowyTrack()};
  editor.vehicleDynamicsAuthority={workerBridge:{client:{submitDebugRoad:update=>updates.push(structuredClone(update))}}};
  editor.hydrateRaceArt=async()=>null;
  editor.raceInput.pauseMenuMode='debug-road';
  let rows=editor.getRacePauseMenuRows();
  assert.ok(rows.length<=8);
  rows.find(r=>r.id==='race-debug-road-surface').onClick();
  assert.equal(editor.playtestSession.debugRoad.surface,'asphalt');
  assert.equal(updates.at(-1).surface,'asphalt');
  rows.find(r=>r.id==='race-debug-road-snow').onClick();
  assert.equal(editor.playtestSession.debugRoad.snowDepthMm,0);
  assert.equal(editor.areRaceDebugDecalsHidden(),true);
  rows.find(r=>r.id==='race-debug-road-reset').onClick();
  assert.deepEqual(editor.playtestSession.debugRoad,{});
  assert.equal(JSON.stringify(editor.selectedRace),before);
});
test('packed worker uses asphalt physics on snow geometry after a live road override',()=>{
  const surfaceSampler=packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({mesh:{layered:true,triangles:[
    {region:'road',materialId:'snow',vertices:[{x:-100,y:-100,elevation:0},{x:100,y:-100,elevation:0},{x:100,y:100,elevation:0}]},
    {region:'road',materialId:'snow',vertices:[{x:-100,y:-100,elevation:0},{x:100,y:100,elevation:0},{x:-100,y:100,elevation:0}]}
  ]},elevationScaleM:1}));
  const track=new TrackState({profileOverrides:{snow:{snowDepthMm:25.4}}});
  applyPackedDebugRoad(track,surfaceSampler,{surface:'asphalt',snowDepthMm:0});
  const provider=createPackedRaceWorkerEnvironmentProvider({surfaceSampler,trackState:track});
  let environment,runner;
  runner=new VehicleDynamicsRunner({initialState:{heightM:.55},config:{telemetryRetention:'none'},environmentProvider:request=>(environment=provider(request,runner.config))});
  runner.advance(1/60);
  for(const material of Object.values(environment.materialByWheel)) {
    assert.equal(material.surfaceId,'asphalt');
    assert.equal(material.snowDepthMm,0);
    assert.equal(material.surfaceGripScale,1);
  }
  applyPackedDebugRoad(track,surfaceSampler,{});
  assert.equal(track.sample({x:0,z:10}).cell.snowDepthMm,25.4);
});
