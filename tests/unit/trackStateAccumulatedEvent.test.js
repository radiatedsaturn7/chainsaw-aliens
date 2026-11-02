import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
import {normalizeAccumulatedTireContactEvent} from '../../src/racing/trackState/TrackStateEvents.js';
import {normalizeTrackStateEvent as referenceEvent} from './fixtures/trackStateEventsReference.js';
import {TrackStateContactAccumulator as Reference} from './fixtures/contactAccumulatorReference.js';

const fields=['contactDurationSeconds','groundedDurationSeconds','loadDuration','distanceM','slipWork',
 'slipDurationWeighted','directionXWeighted','directionZWeighted','speedWeight','speedWeighted',
 'rollingDistanceM','groundedContactDurationSeconds','normalImpulseNs','longitudinalSlipWorkJ',
 'lateralScrubWorkJ','lockedWheelWorkJ','wheelspinWorkJ','surfaceHeatingWorkJ','rubberDepositionWorkJ',
 'waterDisplacementImpulseNs','looseMaterialSweepWorkJ','materialPickupCapacity',
 'carriedMaterialDepositCapacity','maxBrakeLock','maxWheelSpin','temperatureWeight','temperatureWeighted'];

test('direct accumulated events preserve legacy values and serialized order, including extreme numbers',()=>{
 let seed=914;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 const special=[0,-0,NaN,Infinity,-Infinity,1e-10,1e-9,1e100,Number.MAX_VALUE,undefined];
 let captured;
 const reference=new Reference({queueEvent:e=>(captured=referenceEvent(e,13))});
 for(let i=0;i<4000;i++) {
  const a={stepIndex:5,vehicleId:'ai-1',wheelId:'fl',x:1.123456789,z:-2.123456789,cellKey:'1,-3',compoundId:'street'};
  for(const field of fields)a[field]=i<special.length?special[i]:(random()-.1)*10**(random()*18-8);
  reference.aggregates.set('one',a);reference.flushStep(5);
  const actual=normalizeAccumulatedTireContactEvent(a,13,5);
  assert.deepEqual(actual,captured);
  assert.equal(JSON.stringify(actual),JSON.stringify(captured));
 }
});

test('fast contact enqueue preserves wet-road state, history, checksum and restored saves',()=>{
 const create=()=>new TrackState({seed:42,sampleBaseSurface:()=>({baseSurfaceId:'asphalt',friction:1,region:'road'})});
 const a=create(),b=create();b.debugLegacyContactEvents=true;
 for(let step=0;step<40;step++) {
  for(let car=0;car<8;car++) for(const wheel of ['fl','fr','rl','rr']) {
   const x=car*2+step*.12,z=wheel[1]==='l'?.2:1.8;
   const c={vehicleId:`ai-${car}`,wheelId:wheel,position:{x,z},previousPosition:{x:x-.12,z},
    normalLoadN:2000+car*100,speedMps:12,slip:.2,contactDurationSeconds:.1,
    tireTemperatureF:100,brakeLock:step%3===0?.5:0,wheelSpin:.3};
   a.queueTireContact(c);b.queueTireContact(c);
  }
  const forcing={type:'storm',precipitationMmPerHour:40,ambientTemperatureC:12};
  a.advance(.1,forcing);b.advance(.1,forcing);
 }
 assert.deepEqual(a.eventHistory,b.eventHistory);
 assert.equal(a.getChecksum(),b.getChecksum());
 assert.deepEqual(a.createSnapshot(),b.createSnapshot());
 assert.equal(TrackState.fromSnapshot(a.createSnapshot()).getChecksum(),TrackState.fromSnapshot(b.createSnapshot()).getChecksum());
 const event=a.eventHistory[0];
 assert.equal(a.queueEvent(event),null,'duplicate canonical event still rejected');
});
