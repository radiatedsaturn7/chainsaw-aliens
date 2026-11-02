import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackStateContactAccumulator} from '../../src/racing/trackState/TrackStateContactAccumulator.js';
import {queueRaceTrackStateTireEvents} from '../../src/racing/trackState/TrackStateIntegration.js';
import {RACE_WHEEL_IDS} from '../../src/racing/simulation/SimulationMath.js';

function createState() {
 const state={cellSizeM:.5,fixedStepMs:100,stepIndex:0,accumulatorMs:0,queueEvent:e=>e};
 state.contactAccumulator=new TrackStateContactAccumulator(state);
 state.queueTireContact=(c,o)=>state.contactAccumulator.accumulate(c,o);
 return state;
}

for(const pooled of [false,true])test(`AI events without receipts preserve aggregates and events (pooled=${pooled})`,()=>{
 const reference=createState(),actual=createState();
 const pools=Array.from({length:30},()=>Object.fromEntries(RACE_WHEEL_IDS.map(id=>[id,{}])));
 let accepted=0;
 for(let frame=0;frame<121;frame++) {
  for(let car=0;car<30;car++) {
   const positions={},previous={},normalLoads={},scales={};
   for(let wheel=0;wheel<4;wheel++) {
    const id=RACE_WHEEL_IDS[wheel],x=car*2+frame*.17,z=wheel*.43-frame*.09;
    positions[id]={x,z};previous[id]={x:x-.17,z:z+.09};
    normalLoads[id]=1900+car*30;scales[id]=(frame+wheel)%13===0?0:1;
   }
   const options={vehicleId:`ai-${car}`,wheelSurfaceState:{positions},previousPositions:previous,
    normalLoads,wheelContactScaleByWheel:scales,speedMps:13,contactDurationSeconds:1/20,
    tireSlipByWheel:{fl:.2,fr:.1,rl:.4,rr:.3},brakeState:{lockByWheel:{fl:frame%7===0?.5:0}},
    tireCompoundByWheel:{fl:'rally',rr:'street'},tireTemperatures:{fl:90,rr:100}};
   accepted+=queueRaceTrackStateTireEvents(reference,options).length;
   const receipts=queueRaceTrackStateTireEvents(actual,{...options,
    collectAcceptedEvents:false,wheelIds:RACE_WHEEL_IDS,contactByWheel:pooled?pools[car]:null});
   assert.equal(receipts.length,0);
  }
  assert.deepEqual(actual.contactAccumulator.createSnapshot(),reference.contactAccumulator.createSnapshot());
  if(frame%2===1) {
   reference.stepIndex++;actual.stepIndex++;
   assert.deepEqual(actual.contactAccumulator.flushStep(actual.stepIndex),
    reference.contactAccumulator.flushStep(reference.stepIndex));
  }
  reference.accumulatorMs=actual.accumulatorMs=frame%2===0?50:0;
 }
 assert.ok(accepted>0);
 // Changing pooled inputs after queuing must not alter any pending aggregate.
 assert.ok(actual.contactAccumulator.size>0);
 const snapshot=actual.contactAccumulator.createSnapshot();
 if(pooled)for(const pool of pools)for(const input of Object.values(pool)) {
  input.normalLoadN=0;input.position.x=999999;input.slipEnergy=999;
 }
 assert.deepEqual(actual.contactAccumulator.createSnapshot(),snapshot);
});
