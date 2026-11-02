import test from 'node:test';
import assert from 'node:assert/strict';
import {sweepWheelCylinders, pointForFeature} from '../../src/racing/simulation/WheelCylinderCollision.js';

function fixture() {
 let poseReads=0;
 const cylinder={wheelId:'fl',previousHubPositionWorld:{x:0,y:.337,z:0},hubPositionWorld:{x:.1,y:.337,z:0},
  get previousWheelForwardWorld(){poseReads++;return {x:1,y:0,z:0};},wheelForwardWorld:{x:1,y:0,z:0},
  previousWheelLateralWorld:{x:0,y:0,z:1},wheelLateralWorld:{x:0,y:0,z:1},
  previousSuspensionAxisWorld:{x:0,y:-1,z:0},suspensionAxisWorld:{x:0,y:-1,z:0},radiusM:.337,widthM:.245,validTreadContact:true};
 const environment={sampleTerrainAtWorldPoint:()=>({heightM:0,normal:{x:0,y:1,z:0}}),
  physicsTerrainQueryFrame:{sampler:{triangleCount:2},wheelActivationBounds:[{}],
   classifyCollisionFeaturesInBounds:()=>({discontinuity:true}),segmentTriangleSweep:()=>({hit:false})}};
 return {cylinder,environment,reads:()=>poseReads,run:()=>sweepWheelCylinders({cylinders:[cylinder],environment})};
}
const feature={angleRad:0,widthOffsetM:0};
test('active wheel features reuse the two endpoint poses but refresh on the next sweep',()=>{
 const f=fixture();f.run();assert.equal(f.reads(),2);
 f.cylinder.hubPositionWorld.x=5;const points=[];
 f.environment.physicsTerrainQueryFrame.segmentTriangleSweep=(start,end)=>{points.push(end);return {hit:false};};
 f.run();assert.equal(f.reads(),4);assert.ok(points.length>10);
 assert.ok(points.every(p=>p.x>4),'new sweep must use moved hub');
});
test('smooth road does not compute wheel poses',()=>{
 const f=fixture();f.environment.terrainCollisionClassification='smooth-connected-surface';
 assert.equal(f.run(),null);assert.equal(f.reads(),0);
});
test('failed sweeps release the pose scope and public feature queries stay fresh',()=>{
 const f=fixture();f.environment.physicsTerrainQueryFrame.segmentTriangleSweep=()=>{throw Error('query failed');};
 assert.throws(f.run,/query failed/);
 const old=pointForFeature(f.cylinder,feature,1);f.cylinder.hubPositionWorld.x=8;
 const next=pointForFeature(f.cylinder,feature,1);
 assert.equal(old.pose.hub.x,.1);assert.equal(next.pose.hub.x,8);assert.notEqual(old.pose,next.pose);
});
test('nested sweeps restore the enclosing pose scope',()=>{
 const outer=fixture(),inner=fixture();let nested=false;
 outer.environment.physicsTerrainQueryFrame.segmentTriangleSweep=()=>{
  if(!nested){nested=true;inner.run();}return {hit:false};
 };
 outer.run();assert.equal(inner.reads(),2);assert.equal(outer.reads(),2);
});
