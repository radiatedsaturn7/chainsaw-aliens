import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('road profile buckets retain distance/shoulder behavior without rebuilding large keys', () => {
  const editor = Object.create(RaceEditor.prototype);
  let revision = 'large-track-signature', revisions = 0, queries = 0;
  Object.defineProperty(editor, 'selectedRace', {value:{road:{}}});
  editor.raceRoadSurfaceProfileCache = new Map();
  editor.getActiveRaceRuntimeType = () => 'point-to-point';
  editor.getRaceSurfaceGeometryRevisionKey = () => { revisions++; return revision; };
  editor.getRaceRoadCorridorSampleAtDistance = distance => {
    queries++;
    return {elevation:distance, grade:.1, routeElevation:distance, terrainElevation:distance-1,
      roadHalfWidth:5, stampedHalfWidth:7, blendWidth:2};
  };
  editor.withRaceGeometryReadCache(() => {
    const first = editor.getRaceRoadSurfaceProfileAtDistance(10);
    assert.strictEqual(editor.getRaceRoadSurfaceProfileAtDistance(10.01),first);
    assert.equal(editor.getRaceRoadSurfaceProfileAtDistance(10,{includeShoulders:false}).stampedHalfWidth,5);
    assert.equal(editor.getRaceRoadSurfaceProfileAtDistance(11).elevation,11);
    assert.equal(revisions,1);
    assert.equal(queries,3);
  });
  editor.withRaceGeometryReadCache(() => {
    assert.equal(editor.getRaceRoadSurfaceProfileAtDistance(10).elevation,10);
    assert.equal(queries,3);
    revision = 'edited-track';
  });
  editor.withRaceGeometryReadCache(() => {
    editor.getRaceRoadSurfaceProfileAtDistance(10);
    assert.equal(queries,4);
    editor.clearRaceRuntimeSurfaceCaches();
    editor.getRaceRoadSurfaceProfileAtDistance(10);
    assert.equal(queries,5);
  });
});

test('corridor cache keeps authored sample arrays uncached and invalidates revision buckets',()=>{
 const editor=Object.create(RaceEditor.prototype);
 let revision='first',queries=0,revisions=0;
 editor.getActiveRaceRuntimeType=()=> 'destination';
 editor.raceRoadCorridorCache=new Map();
 editor.getRaceSurfaceGeometryRevisionKey=()=>{revisions++;return revision;};
 editor.getRaceSurfaceModel=()=>({sampleDeckAtDistance:(distance,options)=>({distance,options,query:++queries})});
 editor.withRaceGeometryReadCache(()=>{
  const first=editor.getRaceRoadCorridorSampleAtDistance(50);
  assert.strictEqual(editor.getRaceRoadCorridorSampleAtDistance(50.01),first);
  editor.getRaceRoadCorridorSampleAtDistance(51);
  assert.equal(revisions,1);
  assert.equal(queries,2);
  const samples=[];
  assert.notStrictEqual(editor.getRaceRoadCorridorSampleAtDistance(50,{samples}),editor.getRaceRoadCorridorSampleAtDistance(50,{samples}));
  assert.equal(queries,4);
  editor.clearRaceRuntimeSurfaceCaches();
  assert.notStrictEqual(editor.getRaceRoadCorridorSampleAtDistance(50),first);
 });
 revision='edited';
 editor.withRaceGeometryReadCache(()=>editor.getRaceRoadCorridorSampleAtDistance(50));
 assert.equal(queries,6);
});

test('roadbed scope resolves persistent profiles once and clears on geometry invalidation',()=>{
 const editor=Object.create(RaceEditor.prototype);
 Object.defineProperty(editor,'selectedRace',{value:{}});
 editor.getActiveRaceRuntimeType=()=> 'destination';
 editor.ensureRaceTileMap=()=>({});
 editor.getRaceRouteLength=()=>100;
 let revisions=0;
 editor.getRaceSurfaceGeometryRevisionKey=()=>{revisions++;return 'route';};
 const profile={revision:1},replacement={revision:2};
 editor.raceRoadbedProfileCache=new Map([['route:destination:0:1000',profile]]);
 editor.withRaceGeometryReadCache(()=>{
  assert.strictEqual(editor.getRaceRoadbedProfile(),profile);
  assert.strictEqual(editor.getRaceRoadbedProfile(),profile);
  assert.equal(revisions,1);
  editor.clearRaceRuntimeSurfaceCaches();
  editor.raceRoadbedProfileCache.set('route:destination:0:1000',replacement);
  assert.strictEqual(editor.getRaceRoadbedProfile(),replacement);
  assert.equal(revisions,2);
 });
});

test('hot selected-object lookups retain saved-car precedence and live edits',()=>{
 const editor=Object.create(RaceEditor.prototype);
 const draft={id:'shared',__playtestId:'draft'},saved={id:'other',__playtestId:'shared'};
 editor.project={cars:[draft,saved],selectedCarId:'shared',races:[{id:'a'},{id:'b'}],selectedRaceId:'b'};
 assert.strictEqual(editor.selectedCar,saved);
 assert.strictEqual(editor.selectedRace,editor.project.races[1]);
 editor.project.cars[1]={id:'replacement'};
 assert.strictEqual(editor.selectedCar,draft);
 editor.project.selectedCarId='unknown';
 assert.strictEqual(editor.selectedCar,draft);
 editor.project.selectedRaceId='unknown';
 assert.strictEqual(editor.selectedRace,editor.project.races[0]);
});

test('normalization is scoped to a synchronous read and respects replacements and invalidation',()=>{
 const editor=new RaceEditor({},{mode:'race'});
 const road=editor.selectedRace.road;
 editor.ensureRaceTileMap();
 const originalBounds=editor.getRaceTileMapElevationBounds.bind(editor);
 let boundsReads=0;
 editor.getRaceTileMapElevationBounds=(...args)=>{boundsReads++;return originalBounds(...args);};
 editor.withRaceGeometryReadCache(()=>{
  const map=editor.ensureRaceTileMap();
  assert.strictEqual(editor.ensureRaceTileMap(),map);
  assert.equal(boundsReads,1);
  const margin=editor.ensureRaceMarginSettings();
  assert.strictEqual(editor.ensureRaceMarginSettings(),margin);
  editor.selectedRace.margin={widthM:999};
  assert.equal(editor.ensureRaceMarginSettings().widthM,.65);
  editor.selectedRace.margin.widthM=-5;
  editor.clearRaceRuntimeSurfaceCaches();
  assert.equal(editor.ensureRaceMarginSettings().widthM,.08);
  editor.ensureRaceTileMap();
  assert.equal(boundsReads,2);
  road.tileMap={...map};
  assert.notStrictEqual(editor.ensureRaceTileMap(),map);
  assert.equal(boundsReads,3);
 });
 editor.selectedRace.margin.widthM=999;
 assert.equal(editor.ensureRaceMarginSettings().widthM,.65);
 editor.ensureRaceTileMap();
 assert.equal(boundsReads,4);
});

test('path samples resolve long signatures only once per step and read scope',()=>{
 const editor=Object.create(RaceEditor.prototype);
 Object.defineProperty(editor,'selectedRace',{value:{road:{}}});
 let revisions=0,builds=0,revision='original';
 editor.getRacePathSampleCacheSignature=step=>{revisions++;return revision.repeat(1000)+step;};
 editor.getRacePathSamples=({step})=>[{step,build:++builds}];
 let first;
 editor.withRaceGeometryReadCache(()=>{
  first=editor.getRacePathSamplesCached({step:10});
  for(let i=0;i<1000;i++)assert.strictEqual(editor.getRacePathSamplesCached({step:10}),first);
  assert.equal(revisions,1);
  assert.notStrictEqual(editor.getRacePathSamplesCached({step:18}),first);
  assert.equal(revisions,2);
  editor.clearRaceRuntimeSurfaceCaches();
  assert.notStrictEqual(editor.getRacePathSamplesCached({step:10}),first);
 });
 assert.equal(revisions,3);
 editor.withRaceGeometryReadCache(()=>editor.getRacePathSamplesCached({step:10}));
 assert.equal(revisions,4);
 assert.equal(builds,3);
 revision='edited';
 editor.withRaceGeometryReadCache(()=>editor.getRacePathSamplesCached({step:10}));
 assert.equal(builds,4);
 editor.getRacePathSamplesCached({step:10});
 editor.getRacePathSamplesCached({step:10});
 assert.equal(revisions,7);
});

test('network path samples use the scoped cache without altering network sampling',()=>{
 const editor=Object.create(RaceEditor.prototype);
 Object.defineProperty(editor,'selectedRace',{value:{road:{network:{}}}});
 let calls=0;const index={};
 editor.getRaceNetworkQueryIndex=()=>{calls++;return index;};
 editor.getRacePathSamples=({step})=>[{step}];
 editor.withRaceGeometryReadCache(()=>{
  const first=editor.getRacePathSamplesCached({step:10});
  for(let i=0;i<100;i++)assert.strictEqual(editor.getRacePathSamplesCached({step:10}),first);
  assert.equal(calls,1);
 });
 editor.withRaceGeometryReadCache(()=>editor.getRacePathSamplesCached({step:10}));
 assert.equal(calls,2);
});
