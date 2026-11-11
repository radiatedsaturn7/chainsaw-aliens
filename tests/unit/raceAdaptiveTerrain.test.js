import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAdaptiveRaceTerrain,createAdaptiveTerrainField,triangulateTerrainBoundary} from '../../src/racing/RaceAdaptiveTerrain.js';
const p=(x,z,elevation=0)=>({x,z,elevation});
const bake=()=>({sections:[0,2.5,5,7.5,10].map(z=>({center:p(0,z),left:p(-2,z,Math.abs(5-z)/5),right:p(2,z,Math.abs(5-z)/5),metrics:{transitionWidth:10}}))});
const config=()=>({surfaceBake:bake(),bounds:{minX:-10,maxX:10,minZ:0,maxZ:10},sourceCellSize:10,sampleGround:()=>2,tileAt:()=>({tileId:'grass'})});
test('ear triangulation preserves graded collinear boundary vertices without a center fan',()=>{
 const boundary=[p(0,0),p(5,0,2),p(10,0),p(10,10),p(0,10)];
 const triangles=triangulateTerrainBoundary(boundary);
 assert.equal(triangles.length,3);
 for(let i=0;i<boundary.length;i++)assert.ok(triangles.some(t=>t.includes(boundary[i])&&t.includes(boundary[(i+1)%boundary.length])));
 assert.ok(triangles.flat().every(v=>boundary.includes(v)));
});
test('height field follows exact baked road dip and transitions continuously to ground',()=>{
 const field=createAdaptiveTerrainField(config());
 assert.equal(field.sample(-2,5).elevation,0);
 assert.equal(field.sample(-2,2.5).elevation,.5);
 assert.ok(field.sample(-2.00001,5).elevation<.00001);
 assert.equal(field.sample(-40,5).elevation,2);
});
test('adaptive cells preserve road boundary, terrain coverage, and near-road size limits',()=>{
 const result=buildAdaptiveRaceTerrain(config());
 assert.ok(result.terrainCells.length);
 for(const cell of result.terrainCells){
  assert.equal(cell.points.length,3);
  for(const v of cell.points)if(v.distanceToRoad<12)assert.ok(cell.adaptiveTerrainCellSizeM<=2.5);
  for(const v of cell.points)if(Math.abs(v.x)===2&&v.z>=0&&v.z<=10)assert.ok(Math.abs(v.elevation-Math.abs(5-v.z)/5)<1e-6);
 }
 const field=createAdaptiveTerrainField(config());
 for(const x of [-2.01,-3,-6,2.01,3,6])for(let z=.3;z<10;z+=.7){
  const t=result.terrainCells.find(({points:[a,b,c]})=>{
   const cross=(a,b)=>(b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x);
   const values=[cross(a,b),cross(b,c),cross(c,a)];return values.every(v=>v>=-1e-10)||values.every(v=>v<=1e-10);
  });assert.ok(t,`ground coverage at ${x},${z}`);
 }
 assert.ok(Number.isFinite(result.stats.maxHeightErrorM));
});

test('nearly duplicate collinear clipping remnants do not erase a surrounding polygon',()=>{
 const polygon=[p(0,0),p(2,0),p(2,2),p(1,2),p(1+8e-8,2),p(1,2),p(0,2)];
 const triangles=triangulateTerrainBoundary(polygon);
 const area=triangles.reduce((s,[a,b,c])=>s+Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2,0);
 assert.ok(Math.abs(area-4)<1e-6);
});
test('overlapping hairpin transition fields remain continuous and keep each road height',()=>{
 const sections=[{center:p(0,0),left:p(-2,0),right:p(2,0)},
 {center:p(0,10),left:p(-2,10),right:p(2,10)},
 {center:p(5,15,.5),left:p(5,17,.5),right:p(5,13,.5)},
 {center:p(10,10,1),left:p(12,10,1),right:p(8,10,1)},
 {center:p(10,0,1),left:p(12,0,1),right:p(8,0,1)}].map(s=>({...s,metrics:{transitionWidth:12}}));
 const field=createAdaptiveTerrainField({surfaceBake:{sections},sampleGround:()=>0});
 assert.equal(field.sample(2,5).elevation,0);assert.equal(field.sample(8,5).elevation,1);
 assert.ok(Math.abs(field.sample(5-.00001,5).elevation-field.sample(5+.00001,5).elevation)<.0001);
});
test('painted tile boundaries survive subdivision on an independently aligned grid',()=>{
 const result=buildAdaptiveRaceTerrain({...config(),sourceCellSize:7.5});
 for(const c of result.terrainCells){
  for(const axis of ['x','z']){
   const values=c.points.map(p=>p[axis]);
   assert.equal(Math.floor((Math.min(...values)+1e-6)/7.5),Math.floor((Math.max(...values)-1e-6)/7.5));
  }
 }
});

test('subdivision limits triangle reach and shares a single height at every terrain vertex',()=>{
 const {terrainCells}=buildAdaptiveRaceTerrain(config());
 const heights=new Map();
 for(const cell of terrainCells){
  for(const a of cell.points){
   const key=`${Math.round(a.x*1e6)},${Math.round(a.z*1e6)}`;
   if(heights.has(key))assert.ok(Math.abs(heights.get(key)-a.elevation)<1e-6);
   heights.set(key,a.elevation);
   for(const b of cell.points)assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<=cell.adaptiveTerrainCellSizeM*Math.SQRT2+1e-6,'no triangle reaches outside its refined cell');
  }
 }
});

test('refined triangles share one material descriptor per authored source tile',()=>{
 const requested=new Set();
 const result=buildAdaptiveRaceTerrain({...config(),tileAt:({x,z})=>{
  const key=`${Math.floor(x/10)},${Math.floor(z/10)}`;
  assert.ok(!requested.has(key),'do not allocate a descriptor for every triangle');
  requested.add(key);return {key,tileId:'grass'};
 }});
 const descriptors=new Set(result.terrainCells.map(cell=>cell.tileCell));
 assert.equal(descriptors.size,requested.size);
 assert.ok(descriptors.size<result.terrainCells.length/2);
});

test('banked, changing-width road edges remain authoritative',()=>{
 const field=createAdaptiveTerrainField({sampleGround:()=>9,surfaceBake:{sections:[
  {left:p(-2,0,.1),right:p(2,0,-.1)},
  {left:p(-5,10,.5),right:p(3,10,.2)}
 ]}});
 assert.ok(Math.abs(field.sample(-3.5,5).elevation-.3)<1e-12);
 assert.ok(Math.abs(field.sample(2.5,5).elevation-.05)<1e-12);
 assert.ok(Math.abs(field.sample(-3.500001,5).elevation-.3)<1e-5);
});

test('reusing unchanged conforming polygons preserves the complete mesh',()=>{
 const options={...config(),sourceCellSize:7.5};
 const reused=buildAdaptiveRaceTerrain(options);
 const rebuilt=buildAdaptiveRaceTerrain({...options,reuseConformingPolygons:false});
 const signature=result=>result.terrainCells.map(cell=>cell.points.map(p=>`${p.x},${p.z},${p.elevation}`).sort().join('|')).sort();
 assert.deepEqual(signature(reused),signature(rebuilt));
 assert.equal(reused.stats.unresolvedHeightErrors,rebuilt.stats.unresolvedHeightErrors);
 assert.equal(new Set(reused.terrainCells.map(c=>c.key)).size,reused.terrainCells.length);
});
