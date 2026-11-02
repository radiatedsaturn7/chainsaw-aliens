import test from 'node:test';
import assert from 'node:assert/strict';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {referenceForceAllocation} from './fixtures/forceAllocationReference.js';

test('two-output force allocation exactly matches generic distribution',()=>{
 const model=new PowertrainModel();
 let seed=789;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<20000;i++) {
  const ids=i%2?['fl','fr']:['front','rear'];
  const capacities={[ids[0]]:random()*20000,[ids[1]]:random()*20000};
  const shares={[ids[0]]:random(),[ids[1]]:i%5?random():0};
  const target=random()*60000;
  assert.deepEqual(model.allocateForceWithinCapacities(target,capacities,shares),referenceForceAllocation.allocateForceWithinCapacities(target,capacities,shares));
 }
 for(const a of [0,-1,1,Infinity,NaN,undefined,'20'])for(const b of [0,-1,1,Infinity,NaN])for(const target of [0,10,Infinity,NaN]){
  const capacities={['__proto__']:a,constructor:b},shares={['__proto__']:b,constructor:a};
  assert.deepEqual(model.allocateForceWithinCapacities(target,capacities,shares),referenceForceAllocation.allocateForceWithinCapacities(target,capacities,shares));
 }
 for(const capacities of [{},{fl:20},{fl:10,fr:20,rl:30,rr:40}]){
  assert.deepEqual(model.allocateForceWithinCapacities(75,capacities),referenceForceAllocation.allocateForceWithinCapacities(75,capacities));
 }
});
