import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSurfaceModel } from '../../src/racing/RaceSurfaceModel.js';

test('surface samples reuse classification metrics across both sides and all corridor regions', () => {
  let seed = 612;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const model = new RaceSurfaceModel({ elevationScaleM: 12 });
  const original = model.getCorridorMetrics;
  let calls = 0;
  model.getCorridorMetrics = function (...args) { calls++; return original.apply(this, args); };
  const regions = new Set();
  for (let i = 0; i < 2000; i++) {
    const deck = { x: random() * 50, z: random() * 50, elevation: random() * 10,
      roadHalfWidth: 2 + random() * 8, marginWidth: random() * 3, shoulderWidth: random() * 3,
      blendWidth: random() * 20, leftTerrainElevation: random() * 12, rightTerrainElevation: random() * 12,
      yaw: random() * Math.PI * 2, bankAngleRad: (random() - .5) * .3,
      segment: { surface: i % 2 ? 'asphalt' : 'dirt' } };
    const lateral = (random() - .5) * 180;
    const expected = model.classifyLateral(lateral, deck, deck.segment);
    calls = 0;
    const sample = model.sampleTrack(i, lateral, { deckSample: deck, physicsContact: i % 2 === 0 });
    assert.equal(calls, 1);
    assert.deepEqual(sample.metrics, expected.metrics);
    assert.equal(sample.region, expected.region);
    assert.equal(sample.blend, expected.blend);
    assert.ok(Number.isFinite(sample.elevation));
    regions.add(sample.region);
  }
  assert.deepEqual([...regions].sort(), ['margin', 'road', 'shoulder', 'terrain', 'transition']);
});

test('corridor reuse does not cache stale editor widths between samples', () => {
  let width = 2;
  const model = new RaceSurfaceModel({ getRoadHalfWidth: () => width });
  const deck = { x: 0, z: 0, elevation: 0, segment: { surface: 'asphalt' } };
  const narrow = model.sampleTrack(0, 3, { deckSample: deck });
  width = 5;
  const wide = model.sampleTrack(0, 3, { deckSample: deck });
  assert.equal(narrow.metrics.roadHalfWidth, 2);
  assert.notEqual(narrow.region, 'road');
  assert.equal(wide.metrics.roadHalfWidth, 5);
  assert.equal(wide.region, 'road');
});

test('planning corridor matches complete cross sections without sampling terrain edges', () => {
  let width = 3, terrainCalls = 0;
  const model = new RaceSurfaceModel({getRoadHalfWidth:()=>width,
    getWorldPoseAtDistance:d=>({x:d,z:d/2,yaw:d/300,elevation:2,grade:.15,segment:{banking:12}}),
    sampleRawTerrain:()=>{terrainCalls++;return 1;}});
  for (const runtimeType of ['circuit','destination']) for (const distance of [-5,0,75,1000]) {
    for (width of [2,5,12]) {
      const options={runtimeType,routeLength:1000,allowVisualExtension:true};
      const expected=model.getCrossSectionAtDistance(distance,options);
      terrainCalls=0;
      const actual=model.getCorridorAtDistance(distance,options);
      assert.deepEqual(actual.metrics,expected.metrics);
      assert.deepEqual(actual.deck,expected.deck);
      assert.equal(terrainCalls,0);
    }
  }
});

test('physics off-road fallback reuses only same-query projection and deck with exact outputs',()=>{
 let width=3,elevation=2;
 const counts={projection:0,deck:0};
 const segment={surface:'asphalt',banking:8};
 const make=()=>new RaceSurfaceModel({elevationScaleM:12,getRouteLength:()=>1000,
  projectWorldToTrack:p=>{counts.projection++;return {distance:p.z,lateral:p.x,segment,yaw:0};},
  getWorldPoseAtDistance:d=>{counts.deck++;return {x:0,z:d,yaw:0,elevation,grade:.1,segment};},
  getRoadHalfWidth:()=>width,getMarginWidth:()=>1,getShoulderWidth:()=>1,
  sampleRawTerrain:p=>.1+Math.sin(p.x/50)*.1,getSurfaceById:id=>({id,grip:.8})});
 const current=make(),baseline=make();
 // Ignoring the prepared argument restores the previous fallback path.
 baseline.sampleWorld=function(x,z,options){return RaceSurfaceModel.prototype.sampleWorld.call(this,x,z,options);};
 for(const lateral of [-100,-10,-6,6,10,100])for(const z of [0,75,999]){
  const point={x:lateral,z,y:40};
  const expected=baseline.samplePhysicsGeometry(point);
  counts.projection=0;counts.deck=0;
  const actual=current.samplePhysicsGeometry(point);
  assert.deepEqual(actual,expected);
  assert.equal(counts.projection,1);assert.equal(counts.deck,1);
 }
 const retained=current.samplePhysicsGeometry({x:6,z:75});const saved=structuredClone(retained);
 width=9;elevation=4;
 const changed=current.samplePhysicsGeometry({x:6,z:75});
 assert.deepEqual(changed,baseline.samplePhysicsGeometry({x:6,z:75}));
 assert.notEqual(changed.heightM,retained.heightM);assert.deepEqual(retained,saved);
 const deckSample={x:0,z:75,yaw:0,elevation:6,roadHalfWidth:2,segment};
 assert.deepEqual(current.samplePhysicsGeometry({x:100,z:75},{deckSample}),baseline.samplePhysicsGeometry({x:100,z:75},{deckSample}));
});
