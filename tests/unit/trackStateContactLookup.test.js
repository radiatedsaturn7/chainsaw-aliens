import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackStateContactAccumulator} from '../../src/racing/trackState/TrackStateContactAccumulator.js';
import {TrackStateContactAccumulator as Reference} from './fixtures/contactAccumulatorReference.js';

test('30-car contact lookup preserves exact aggregates, events, restore and clear', () => {
  const state=()=>({cellSizeM:.5,fixedStepMs:100,stepIndex:0,accumulatorMs:0,queueEvent:e=>e});
  const aState=state(), bState=state();
  const actual=new TrackStateContactAccumulator(aState), reference=new Reference(bState);
  for(let frame=0;frame<60;frame++) {
    for(let car=0;car<30;car++) for(let wheel=0;wheel<4;wheel++) {
      const x=car*2+frame*.13, z=wheel*.43+frame*.07;
      const contact={vehicleId:`car-${car}`,wheelId:`wheel-${wheel}`,position:{x,z},previousPosition:{x:x-.13,z:z-.07},contactDurationSeconds:1/60,normalLoadN:1800+car*31,speedMps:12,slip:.13,brakeLock:frame%7===0?.4:0,wheelSpin:.2,tireTemperatureF:95};
      const options={collectAcceptedKeys:frame%2===0};
      assert.deepEqual(actual.accumulate(contact,options),reference.accumulate(contact,options));
    }
    if(frame%6===5) {
      aState.stepIndex++;bState.stepIndex++;
      assert.deepEqual(actual.flushStep(aState.stepIndex),reference.flushStep(bState.stepIndex));
    }
    aState.accumulatorMs=bState.accumulatorMs=(frame%6+1)%6*100/6;
    if(frame===25) {
      assert.deepEqual(actual.createSnapshot(),reference.createSnapshot());
      actual.restoreSnapshot(actual.createSnapshot());reference.restoreSnapshot(reference.createSnapshot());
    }
    if(frame===40) { actual.clear();reference.clear(); }
  }
  assert.deepEqual(actual.createSnapshot(),reference.createSnapshot());
  assert.deepEqual(actual.flushStep(100),reference.flushStep(100));
});

test('vehicle and wheel IDs cannot alias across nested lookup keys',()=>{
  const a=new TrackStateContactAccumulator({cellSizeM:1,fixedStepMs:100,stepIndex:0,accumulatorMs:0});
  for(const [vehicleId,wheelId] of [['a\0b','c'],['a','b\0c'],['__proto__','constructor']]) {
    a.accumulate({vehicleId,wheelId,x:0,z:0,normalLoadN:1000});
  }
  assert.equal(a.lastAggregateSlots.size,3);
});

test('direct physical totals preserve supplied work across cells, time slices and snapshot restore',()=>{
 const state=()=>({cellSizeM:.5,fixedStepMs:100,stepIndex:0,accumulatorMs:37,queueEvent:e=>e});
 const aState=state(),bState=state(),actual=new TrackStateContactAccumulator(aState),reference=new Reference(bState);
 let seed=8730;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const fields=['rollingDistanceM','groundedContactDurationSeconds','normalImpulseNs',
  'longitudinalSlipWorkJ','lateralScrubWorkJ','lockedWheelWorkJ','wheelspinWorkJ',
  'surfaceHeatingWorkJ','rubberDepositionWorkJ','waterDisplacementImpulseNs',
  'looseMaterialSweepWorkJ','materialPickupCapacity','carriedMaterialDepositCapacity'];
 for(let i=0;i<300;i++) {
  const x=random()*10-5,z=random()*10-5;
  const totals=Object.fromEntries(fields.map((field,j)=>[field,(j+1)*random()*100]));
  // Exercise missing, zero, invalid and explicit per-step supplied totals.
  if(i%3===0)delete totals.normalImpulseNs;
  if(i%5===0)totals.wheelspinWorkJ=0;
  if(i%7===0)totals.surfaceHeatingWorkJ=NaN;
  const contact={vehicleId:`car-${i%9}`,wheelId:`wheel-${i%4}`,position:{x,z},
   previousPosition:{x:x+random()*2-1,z:z+random()*2-1},
   contactDurationSeconds:.02+random()*.25,normalLoadN:1000+random()*4000,
   contactScale:random(),speedMps:random()*30,physicalMutationTotals:totals};
  assert.deepEqual(actual.accumulate(contact),reference.accumulate(contact));
  if(i%30===29) {
   assert.deepEqual(actual.createSnapshot(),reference.createSnapshot());
   actual.restoreSnapshot(actual.createSnapshot());reference.restoreSnapshot(reference.createSnapshot());
   aState.stepIndex++;bState.stepIndex++;
   assert.deepEqual(actual.flushStep(aState.stepIndex),reference.flushStep(bState.stepIndex));
  }
 }
 assert.deepEqual(actual.createSnapshot(),reference.createSnapshot());
 assert.deepEqual(actual.flushStep(100),reference.flushStep(100));
});
