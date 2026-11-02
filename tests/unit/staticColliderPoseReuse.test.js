import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StaticColliderCollision, prepareStaticRaceColliders} from '../../src/racing/simulation/StaticRaceColliderWorld.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';

// Run the same collision solver with the original per-point pose calculation
// and allocating transform. This also checks event lifetime/aliasing, not just
// the arithmetic of an isolated vector helper.
const moduleUrl = new URL('../../src/racing/simulation/StaticRaceColliderWorld.js', import.meta.url);
let referenceSource = fs.readFileSync(moduleUrl, 'utf8');
assert.ok(referenceSource.includes('const sliceEndPose = slicePoses[slice - 1];'));
referenceSource = referenceSource
  .replace(/    const slicePoses = Array.from\(\{length: slices\}, \(_, index\) =>\n      this.poseAt\(previousState, proposedState, \(index \+ 1\) \/ slices\)\);/, '')
  .replace('const sliceEndPose = slicePoses[slice - 1];', 'const sliceEndPose = this.poseAt(previousState, proposedState, sliceEndFraction);')
  .replace('return addVector3(position, rotated, rotated);', 'return addVector3(position, rotated);')
  .replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${new URL(path, moduleUrl).href}'`);
const {StaticColliderCollision: ReferenceSolver} = await import(`data:text/javascript;base64,${Buffer.from(referenceSource).toString('base64')}`);

test('shared sweep poses retain exact impact events with fewer pose calculations', () => {
  const world = prepareStaticRaceColliders([
    {id:'wall',type:'box',center:{x:0,y:1,z:0},size:{x:.1,y:4,z:10}},
    {id:'floor',type:'plane',point:{y:-1},normal:{x:0,y:1,z:0}}
  ]);
  const candidates = Array.from({length:24}, (_, i) => ({id:`p${i}`,localPoint:{x:(i%3)-1,y:(i%2)*.8,z:(i%5)-2}}));
  const actual = new StaticColliderCollision({candidates});
  const reference = new ReferenceSolver({candidates});
  let actualCalls=0, referenceCalls=0;
  const pose = actual.poseAt;
  actual.poseAt = function(...args) { actualCalls++; return pose.apply(this,args); };
  reference.poseAt = function(...args) { referenceCalls++; return pose.apply(this,args); };
  let seed=123;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const state=()=>({position:{x:random()*10-5,y:random()*4,z:random()*12-6},orientation:quaternionFromEuler(random(),random()*6,random()),velocity:{x:10,y:-3,z:5},angularVelocityWorld:{x:random()*20,y:random()*40,z:random()*20}});
  for(let i=0;i<200;i++) {
    const args={previousState:state(),proposedState:state(),world,toleranceM:.008,dt:1/60};
    assert.deepEqual(actual.findEarliestImpact(args),reference.findEarliestImpact(args),`sweep ${i}`);
  }
  assert.ok(actualCalls < referenceCalls, `${actualCalls} vs ${referenceCalls}`);
});
