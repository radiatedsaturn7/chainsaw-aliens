import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {referenceRawGround} from './fixtures/rawGroundElevationReference.js';
const create=()=>{
 const e=new RaceEditor({});
 e.selectedRace.source={importVersion:1};
 e.selectedRace.road.elevationRange={min:-100,max:100};
 e.selectedRace.road.tileMap={cellSizeM:10,preserveCellSize:true,minElevation:-100,maxElevation:100,revision:1,defaultTileId:'grass',cells:{
  '0,0':{elevation:-20},'1,0':{elevation:5},'0,1':{elevation:10},'1,1':{elevation:25}}};
 return e;
};
test('numeric terrain read cache matches original terrain and survey extension exactly',()=>{
 const e=create(),r=create();
 e.withRaceGeometryReadCache(()=>{
  for(let i=0;i<1000;i++){
   const point={x:(i*17%80)-30,z:(i*23%80)-30};
   const fallback=i%7-3;
   assert.equal(e.getRaceRawGroundElevationAtWorldPoint(point,fallback),referenceRawGround.getRaceRawGroundElevationAtWorldPoint.call(r,point,fallback));
  }
 });
 // The same values must survive a warmed persistent cache and new read scope.
 e.withRaceGeometryReadCache(()=>{for(let i=0;i<100;i++)assert.equal(e.getRaceRawGroundElevationAtWorldPoint({x:5,z:5},0),-20);});
});
test('cached heights invalidate on revision, explicit invalidation and subsequent read scope',()=>{
 const e=create();
 const p={x:5,z:5};
 e.withRaceGeometryReadCache(()=>{
  assert.equal(e.getRaceRawGroundElevationAtWorldPoint(p,0),-20);
  const map=e.ensureRaceTileMap();map.cells['0,0'].elevation=12;map.revision++;
  assert.equal(e.getRaceRawGroundElevationAtWorldPoint(p,0),12);
  map.cells['0,0'].elevation=13;e.clearRaceRuntimeSurfaceCaches();
  assert.equal(e.getRaceRawGroundElevationAtWorldPoint(p,0),13);
 });
 e.ensureRaceTileMap().cells['0,0'].elevation=14;
 e.clearRaceRuntimeSurfaceCaches();
 e.withRaceGeometryReadCache(()=>assert.equal(e.getRaceRawGroundElevationAtWorldPoint(p,0),14));
});
test('unpainted terrain still respects different fallback elevations',()=>{
 const e=new RaceEditor({}),r=new RaceEditor({});
 e.withRaceGeometryReadCache(()=>{
  for(const fallback of [0,12,-5,12,0])assert.equal(e.getRaceRawGroundElevationAtWorldPoint({x:500,z:500},fallback),referenceRawGround.getRaceRawGroundElevationAtWorldPoint.call(r,{x:500,z:500},fallback));
 });
});

test('an empty editor can query fallback terrain inside a read scope',()=>{
 const e=new RaceEditor({});e.project.races=[];
 e.withRaceGeometryReadCache(()=>assert.equal(e.getRaceRawGroundElevationAtWorldPoint({x:0,z:0},.5),.5));
});

test('bake sampler matches bilinear terrain, survey extension and fallback without repeated corner reads',()=>{
 const e=create();
 e.withRaceGeometryReadCache(()=>{
  const sample=e.createRaceBakeGroundSampler(0);
  for(let i=0;i<1000;i++){
   const point={x:(i*17%800)/10-30,z:(i*23%800)/10-30};
   assert.equal(sample(point),e.getRaceGroundElevationAtWorldPoint(point,0));
  }
  const fresh=e.createRaceBakeGroundSampler(0);
  const original=e.getRaceRawGroundElevationAtWorldPoint.bind(e);let reads=0;
  e.getRaceRawGroundElevationAtWorldPoint=(...args)=>{reads++;return original(...args);};
  for(let i=0;i<1000;i++)fresh({x:6+i/1000,z:6+i/1000});
  assert.equal(reads,4,'one set of corners per immutable interpolation cell');
 });
 const empty=new RaceEditor({});
 empty.withRaceGeometryReadCache(()=>{
  const sample=empty.createRaceBakeGroundSampler(7);
  for(const point of [{x:0,z:0},{x:-20.5,z:50.25}])assert.equal(sample(point),empty.getRaceGroundElevationAtWorldPoint(point,7));
 });
});

test('new bake sampler sees edited terrain rather than retaining a previous bake cache',()=>{
 const e=create();
 e.withRaceGeometryReadCache(()=>assert.equal(e.createRaceBakeGroundSampler()({x:5,z:5}),-20));
 e.ensureRaceTileMap().cells['0,0'].elevation=14;e.clearRaceRuntimeSurfaceCaches();
 e.withRaceGeometryReadCache(()=>assert.equal(e.createRaceBakeGroundSampler()({x:5,z:5}),14));
});
