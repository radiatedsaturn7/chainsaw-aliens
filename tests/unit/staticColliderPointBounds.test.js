import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStaticRaceColliders,StaticColliderCollision} from '../../src/racing/simulation/StaticRaceColliderWorld.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';

test('per-point bounds preserve unpruned impact events for moving and rotating bodies',(t)=>{
 const prepared=prepareStaticRaceColliders([
  {id:'wall',type:'box',center:{x:0,y:1,z:0},size:{x:.05,y:3,z:15}},
  {id:'box',type:'box',center:{x:3,y:1,z:2},size:{x:2,y:2,z:2}},
  {id:'sheet',type:'triangle-mesh',surfaceOnly:true,twoSided:true,
   triangles:[[{x:-8,y:0,z:0},{x:-8,y:3,z:0},{x:-8,y:0,z:4}]]}
 ]);
 const colliders=prepared.colliders;
 assert.equal(colliders.length,3);
 assert.equal(colliders.find(c=>c.id==='sheet').triangles.length,1);
 const world={querySweptAabb:()=>colliders};
 const unpruned={querySweptAabb:()=>colliders.map(c=>({...c,bounds:null}))};
 const solver=new StaticColliderCollision({candidates:[{id:'a',localPoint:{x:-1,y:0,z:-2}},{id:'b',localPoint:{x:1,y:0,z:2}},{id:'c',localPoint:{x:0,y:1,z:0}}]});
 let seed=19;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const state=()=>({position:{x:random()*20-10,y:random()*5-1,z:random()*20-10},orientation:quaternionFromEuler(random(),random()*6,random()),velocity:{x:10,y:-1,z:5},angularVelocityWorld:{x:1,y:1,z:1}});
 const summarize=result=>result.impact&&({fraction:result.impact.fraction,events:result.impact.events.map(e=>({fraction:e.fraction,point:e.point,normal:e.normal,featureId:e.featureId,collider:e.collider.id,penetrationM:e.penetrationM,candidateIndex:e.candidateIndex}))});
 let hits=0, optimizedTests=0, referenceTests=0;
 const accounting=increment=>({start(){},end(){},count(name){if(name==='staticColliderNarrowphaseTests')increment();}});
 for(let i=0;i<500;i++){
  const args={previousState:state(),proposedState:state(),toleranceM:.008,dt:1/60};
  const result=solver.findEarliestImpact({...args,world,physicsCostAccounting:accounting(()=>optimizedTests++)});
  if(result.impact) hits++;
  assert.deepEqual(summarize(result),summarize(solver.findEarliestImpact({...args,world:unpruned,physicsCostAccounting:accounting(()=>referenceTests++)})),`sweep ${i}`);
 }
 assert.ok(hits>50);
 assert.ok(optimizedTests<referenceTests*.7);
 t.diagnostic(`Triangle checks: ${optimizedTests} filtered / ${referenceTests} unfiltered`);
});

test('point bounds skip unreachable triangles while preserving solid-below overlap',()=>{
 const solver=new StaticColliderCollision({candidates:[{id:'point',localPoint:{x:0,y:0,z:0}}]});
 const mesh={id:'ground',type:'triangle-mesh',solidBelow:true,
  triangles:[[{x:-10,y:2,z:-10},{x:0,y:2,z:10},{x:10,y:2,z:-10}]]};
 const collider=prepareStaticRaceColliders([mesh]).colliders[0];
 const state={position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},angularVelocityWorld:{x:0,y:0,z:0}};
 let tests=0;
 const result=solver.findEarliestImpact({previousState:state,proposedState:state,world:{querySweptAabb:()=>[collider]},toleranceM:.008,dt:1/60,
  physicsCostAccounting:{start(){},end(){},count(name){if(name==='staticColliderNarrowphaseTests')tests++;}}});
 assert.equal(tests,0);
 assert.equal(result.impact.fraction,0);
 assert.equal(result.impact.events[0].penetrationM,2);
});
