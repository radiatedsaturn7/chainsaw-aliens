import test from 'node:test';
import assert from 'node:assert/strict';
import { createRaceRoadBoundary } from '../../src/racing/RaceRoadBoundary.js';
import { triangulateSplitTerrainTriangle } from '../../src/racing/RaceTerrainTriangulation.js';
const p = (x,z,elevation,distance=0) => ({x,z,elevation,distance});
test('terrain boundary follows the baked dip, including intermediate heights', () => {
 const a=p(0,0,2,0),b=p(0,5,0,5),c=p(0,10,2,10);
 const boundary=createRaceRoadBoundary([[a,b],[b,c]]);
 for(const [z,height] of [[0,2],[2.5,1],[5,0],[7.5,1],[10,2]]) {
  const v=p(1e-8,z,99); assert.equal(boundary.snap(v),true);
  assert.equal(v.x,0);assert.equal(v.elevation,height);assert.equal(v.roadSeamDistance,z);
 }
 assert.equal(a.elevation,2);assert.equal(b.elevation,0,'road never moves');
});
test('neighboring switchback edges retain their own heights', () => {
 const boundary=createRaceRoadBoundary([[p(0,0,1),p(0,10,1)],[p(.01,0,4),p(.01,10,4)]]);
 const a=p(0,5,9),b=p(.01,5,9),between=p(.005,5,3);
 boundary.snap(a);boundary.snap(b);
 assert.equal(a.elevation,1);assert.equal(b.elevation,4);
 assert.equal(boundary.snap(between),false);assert.equal(between.elevation,3);
});
test('finite road boundaries do not promote nearby or extended terrain to immutable seams', () => {
 const boundary=createRaceRoadBoundary([[p(0,0,1),p(0,10,1)]]);
 for(const v of [p(0,11,5),p(.015,5,5)]) {
  Object.assign(v,{exactRoadSeam:true,trackSeam:true,roadSeamElevation:5});
  assert.equal(boundary.snap(v),false);assert.equal(v.elevation,5);
  assert.equal(v.exactRoadSeam,false);assert.equal(v.roadSeamElevation,undefined);
 }
});
test('welding shared terrain updates adjacent faces without discarding their footprint', () => {
 const boundary=createRaceRoadBoundary([[p(0,0,0),p(0,10,1)]]);
 const a=p(0,0,9),b=p(0,10,9),c=p(.01,5,1);
 const triangles=triangulateSplitTerrainTriangle([a,p(0,5,9),b,c],[a,b,c]);
 for(const v of new Set(triangles.flat()))boundary.snap(v);
 assert.equal(triangles.length,4);
 const area=triangles.reduce((sum,[a,b,c])=>sum+Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2,0);
 assert.ok(Math.abs(area-.05)<1e-10);
 assert.equal(triangles[0][1],a);assert.equal(a.elevation,0);
 assert.equal(triangles[1][2],b);assert.equal(b.elevation,1);
});

test('heightmap builder keeps a dipping road authoritative over higher terrain', async () => {
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});
 const sections=[0,5,10].map((z,i)=>({center:p(0,z,0,z),left:p(-2,z,i===1?0:1,z),right:p(2,z,i===1?0:1,z),metrics:{outerHalfWidth:10}}));
 editor.getRaceTileMapEntries=()=>[['-1,-1',{}],['1,1',{}]];
 editor.getRaceTileMapCell=()=>({tileId:'grass'});
 editor.getRaceGroundElevationAtWorldPoint=()=>3;
 editor.getRaceRouteProjectionForWorldPoint=()=>null;
 editor.getRaceSurfaceModel=()=>({});
 const cells=editor.buildRaceExplicitHeightmapTerrainCells({tileMap:{cellSizeM:20},surfaceBake:{sections},runtimeType:'destination',routeLength:10});
 const vertices=[...new Set(cells.flatMap(c=>c.points))];
 const seams=vertices.filter(p=>p.exactRoadSeam);
 assert.ok(seams.length>=6);
 for(const v of seams){
  const expected=1-Math.min(v.z,10-v.z)/5;
  assert.ok(Math.abs(v.elevation-expected)<1e-9,`road controls height at ${v.x},${v.z}`);
 }
 for(const x of [-2,2]) assert.ok(seams.some(p=>p.x===x&&p.z===5&&p.elevation===0),'terrain includes road dip vertex');
 // Test coverage independently of elevations: the join must retain the ground.
 const inside=(x,z,[a,b,c])=>{
  const cross=(p,q)=>(q.x-p.x)*(z-p.z)-(q.z-p.z)*(x-p.x);
  const values=[cross(a,b),cross(b,c),cross(c,a)];
  return values.every(v=>v>=-1e-8)||values.every(v=>v<=1e-8);
 };
 for(const x of [-2.001,-2.01,-2.5,2.001,2.01,2.5])for(let z=.25;z<10;z+=.5){
  assert.ok(cells.some(c=>inside(x,z,c.points)),`no missing terrain beside dip at ${x},${z}`);
 }
});

test('terrain just outside the snap tolerance converges to road height without collapsing its footprint', () => {
 const boundary=createRaceRoadBoundary([[p(0,0,1),p(0,10,1)]]);
 const a=p(.00002,5,20),b=p(.00004,5,-20);
 boundary.constrainHeight(a);boundary.constrainHeight(b);
 assert.equal(a.x,.00002);assert.equal(b.x,.00004);
 assert.ok(Math.abs(a.elevation-1)*12<=.00002*.750001);
 assert.ok(Math.abs(b.elevation-1)*12<=.00004*.750001);
 assert.ok(Math.abs(a.elevation-b.elevation)*12<.00005);
});
