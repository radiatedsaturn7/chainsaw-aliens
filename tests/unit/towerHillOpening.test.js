import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createMechanicalState,applyMechanicalMission,stepMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const race=read('../../data/server-storage/files/races/Tower Hill Road/document.json').race;
test('Tower Hill opening retains GPS, finite runouts, Providence terrain and dense roadside scenery',()=>{
 assert.deepEqual(race.source.osmWayIds,[19365929]);
 assert.ok(race.source.routeReference.originalGeometry.length>20);
 assert.equal(race.road.autoExtend,false);
 assert.ok(race.road.continuations.start.length&&race.road.continuations.finish.length);
 assert.equal(race.groundPlaneArtRef,'providenceGround');
 assert.equal(race.finishBehavior.cutsceneRef,'lastongridintro');
 assert.equal(race.raceStart.cutsceneRef,'introtowerhill');
 assert.equal(new RaceEditor({}).normalizeLoadedRaceDocument(race).raceStart.cutsceneRef,'introtowerhill');
 assert.equal(race.timeOfDay,'night');assert.equal(race.weather,'snow');
 assert.ok(race.scenery.length>2000);
 for(const ref of ['tree','frozenrock','frozenbush'])assert.ok(race.scenery.filter(s=>s.doodadRef===ref).length>100);
 assert.ok(race.scenery.filter(s=>!s.fenceId).every(s=>Math.abs(s.trackLateral)>=9+s.widthM/2));
 const state=applyMechanicalMission(createMechanicalState(),race.mechanicalMission);
 assert.ok(Math.abs(state.fuel-.153)<1e-12);assert.ok(state.fuel>.15,'starts above low fuel lamp threshold');assert.equal(state.headlights,true);
});
test('authored storm ramps precipitation, accumulation and visibility over 120 race seconds',()=>{
 const e=new RaceEditor({});
 const state=ms=>e.getRaceWeatherState(race,{elapsedMs:ms});
 const start=state(0),middle=state(60000),end=state(120000);
 assert.equal(start.precipitationIntensity,.05);assert.equal(middle.precipitationIntensity,.525);assert.equal(end.precipitationIntensity,1);
 assert.equal(end.effectiveIntensity,1);assert.equal(end.snowDepthInches,6);
 assert.ok(start.visibilityDistanceM>middle.visibilityDistanceM);assert.ok(middle.visibilityDistanceM>end.visibilityDistanceM);
 assert.deepEqual(state(240000),end);assert.deepEqual(state(-1000),start);
 assert.equal(e.getRaceWeatherState(race,{elapsedMs:120000,debugEnvironment:{weatherIntensity:.2}}).visualIntensity,.2);
 const normalized=e.normalizeLoadedRaceDocument(race);assert.deepEqual(normalized.weatherRamp,race.weatherRamp);
});


test('opening fuel allowance crosses the actual warning threshold at half a mile, then uses normal consumption',()=>{
 for(const throttle of [0,.35,1]){
  const s=applyMechanicalMission(createMechanicalState(),race.mechanicalMission);
  const telemetry={rpm:2000,maxRpm:7000,throttle,speedMps:10};
  for(let i=0;i<804;i++)stepMechanicalState(s,.1,telemetry);
  assert.ok(s.fuel>.15);assert.equal(s.fuelWarningRun.distanceM,804);
  stepMechanicalState(s,.1,{...telemetry,speedMps:6.72});
  assert.equal(s.fuelWarningRun.distanceM,804.672);assert.ok(Math.abs(s.fuel-.15)<1e-12);assert.ok(s.fuel<=.15);
  stepMechanicalState(s,.1,{...telemetry,throttle:1});assert.ok(s.fuel<.15);
  const nextRace=applyMechanicalMission(createMechanicalState(s),{});assert.equal(nextRace.fuelWarningRun,null);
 }
});

test('six outside guardrails have connected editable fence paths clear of the road',()=>{
 const e=new RaceEditor({});e.applyLoadedRaceDocument(race);
 const fences=race.scenery.filter(s=>s.fencePath);
 assert.equal(fences.length,6);
 for(const fence of fences){
  assert.equal(fence.doodadRef,'fenceguardrail');assert.ok(fence.fencePath.points.length>20);
  for(const p of fence.fencePath.points)assert.ok(Math.abs(e.getRaceRouteProjectionForWorldPoint(p).lateral)>=5.5);
 }
});

test('finish skips results and waits for the black fade before navigating exactly once',()=>{
 const e=new RaceEditor({});e.applyLoadedRaceDocument(race);
 e.playtestSession={running:true};let finishes=0,paused=false;
 e.finishPlaytest=()=>{finishes++;};e.vehicleDynamicsAuthority={workerBridge:{setPaused:v=>paused=v}};
 e.showRaceResults();assert.equal(e.playtestSession.raceResults,undefined);assert.equal(paused,true);
 const fade=e.playtestSession.finishFade;assert.equal(fade.durationMs,800);
 e.updatePlaytest(.4);assert.equal(finishes,0);assert.equal(fade.elapsedMs,400);
 e.toggleRacePause();assert.equal(e.raceInput.paused,true);
 e.updatePlaytest(.4);assert.equal(finishes,0,'must draw fully black before leaving');
 const ctx={save(){},restore(){},fillRect(){}};e.drawRaceFinishFade(ctx,{x:0,y:0,w:800,h:600});
 assert.equal(ctx.fillStyle,'rgba(0,0,0,1)');assert.equal(fade.blackDrawn,true);e.updatePlaytest(.016);e.updatePlaytest(.016);assert.equal(finishes,1);
});

test('3:30 of active racing starts the same fade, excludes paused time and survives world bake',async()=>{
 const {buildRaceTransferPackage}=await import('../../src/ui/raceWorldBakeWorker.js');
 const p=await buildRaceTransferPackage(race,{includeArtAssets:false});assert.ok(p.packedSampler.positions.length>0);
 const e=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});e.applyLoadedRaceDocument(race);
 const car=e.normalizeLoadedCarDocument(read('../../data/server-storage/files/cars/RTG-001/document.json').car);e.project.cars=[car];
 e.startPlaytest(car.id,{hydrateCars:false,preparedWorldBake:{...p.header,surfaceSampler:p.packedSampler,packedTerrain:p.packedTerrain}});
 const s=e.playtestSession;Object.assign(s,{countdownRemainingMs:0,startupFramePending:false,launchLockMs:0,elapsedMs:209990});
 e.raceInput.paused=true;e.updatePlaytest(.02);assert.equal(s.elapsedMs,209990);assert.equal(s.finishFade,undefined);
 e.raceInput.paused=false;s.countdownRemainingMs=5000;e.updatePlaytest(.02);assert.equal(s.elapsedMs,209990);assert.equal(s.finishFade,undefined);
 s.countdownRemainingMs=0;e.updatePlaytest(.02);assert.equal(s.elapsedMs,210000);assert.equal(s.finishReason,'time-limit');assert.ok(s.finishFade);assert.equal(s.raceResults,undefined);
 assert.equal(s.mechanical.fuelWarningRun.targetDistanceM,804.672);
 e.disposeRacePlaytestSession(s,'test');
});

test('snowroad replaces default road meshes with two tracks following the curved road ribbon',()=>{
 const e=new RaceEditor({});e.applyLoadedRaceDocument(race);
 assert.equal(race.surfaceArt?.asphalt,undefined);
 assert.equal(race.roadTextures.road.artRef,'snowroad');assert.equal(race.roadTextures.road.repeatWidthM,0);
 const sections=[
  {center:{distance:0,yaw:0},left:{x:-3.5,z:0,elevation:0},right:{x:3.5,z:0,elevation:0}},
  {center:{distance:14,yaw:Math.PI/4},left:{x:2.525,z:12.475,elevation:1},right:{x:7.475,z:7.525,elevation:1}},
  {center:{distance:28,yaw:Math.PI/2},left:{x:20,z:13.5,elevation:2},right:{x:20,z:6.5,elevation:2}}
 ];
 const meshes=e.getRaceStaticTrackSurfaceMeshes({surfaceBake:{sections},routeLength:28,runtimeType:'destination',mesh:{triangles:[]}});
 assert.equal(meshes.roadMeshes.length,2);assert.equal(meshes.roadPaintMeshes.length,0);
 for(const [i,m] of meshes.roadMeshes.entries()){
  assert.equal(m.source,'road-texture');assert.equal(m.artRef,'snowroad');
  assert.deepEqual(m.points.map(p=>p.u),[0,1,1,0]);
  assert.deepEqual(m.points.map(p=>p.v),[-(i+1)*2,-(i+1)*2,-i*2,-i*2]);
  assert.equal(m.points[0].x,sections[i+1].left.x);assert.equal(m.points[0].elevation,sections[i+1].left.elevation);
 }
});

test('Tower Hill homes use all four saved doodads, wooded setbacks and mostly first-half placements',async()=>{
 const {normalizeRaceDoodadDocument}=await import('../../src/racing/raceDoodads.js');
 const {placeTowerHillHouses,loadTowerHillHouseDefinitions}=await import('../../tools/campaigns/tower_hill_houses.mjs');
 const houses=race.scenery.filter(s=>s.id?.startsWith('tower-house-'));
 assert.equal(houses.length,18);assert.equal(new Set(houses.map(h=>h.doodadRef)).size,4);
 const e=new RaceEditor({});e.applyLoadedRaceDocument(race);
 const length=e.getRacePathSamplesCached({step:5}).at(-1).distance;
 assert.equal(houses.filter(h=>h.trackDistance<length*.5).length,15);
 for(const h of houses){
  const doc=read(`../../data/server-storage/files/doodads/${h.doodadRef}/document.json`);
  const def=normalizeRaceDoodadDocument(doc);
  assert.equal(def.artRef,h.doodadRef);assert.equal(def.defaultRule.behavior,'collide');assert.equal(def.rules.length,0);
  assert.ok(def.hitboxWidthM>8);assert.ok(def.heightM>6);assert.ok(def.groundOffsetM>=0);
  const projection=e.getRaceRouteProjectionForWorldPoint(h);
  assert.ok(Math.abs(projection.lateral)>=9+h.widthM/2);
  assert.ok(Math.abs(projection.lateral)<35);
  assert.ok(race.scenery.some(s=>s.doodadRef==='tree'&&Math.hypot(s.x-h.x,s.z-h.z)<40),'woodland remains around each home');
 }
 const copy=structuredClone(race);placeTowerHillHouses(copy,loadTowerHillHouseDefinitions());
 assert.deepEqual(copy.scenery,race.scenery,'re-authoring must not duplicate homes or keep removing vegetation');
 assert.ok(e.collectSelectedRaceArtRefs().includes('house1'));
});
