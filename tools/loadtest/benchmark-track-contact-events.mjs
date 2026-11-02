import fs from 'node:fs';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
const fields=['contactDurationSeconds','groundedDurationSeconds','loadDuration','distanceM','slipWork',
 'slipDurationWeighted','directionXWeighted','directionZWeighted','speedWeight','speedWeighted',
 'rollingDistanceM','groundedContactDurationSeconds','normalImpulseNs','longitudinalSlipWorkJ',
 'lateralScrubWorkJ','lockedWheelWorkJ','wheelspinWorkJ','surfaceHeatingWorkJ','rubberDepositionWorkJ',
 'waterDisplacementImpulseNs','looseMaterialSweepWorkJ','materialPickupCapacity',
 'carriedMaterialDepositCapacity','maxBrakeLock','maxWheelSpin','temperatureWeight','temperatureWeighted'];
const aggregates=Array.from({length:10000},(_,i)=>({
 ...Object.fromEntries(fields.map((k,j)=>[k,(i+j+1)/123.4567])),
 stepIndex:1,vehicleId:`ai-${i%30}`,wheelId:['fl','fr','rl','rr'][i%4],x:i,z:0,cellKey:`${i},0`,compoundId:'street'}));
const results=[];let expected;
for(let round=0;round<6;round++)for(const legacy of round%2?[false,true]:[true,false]){
 const state=new TrackState();state.debugLegacyContactEvents=legacy;
 for(let i=0;i<aggregates.length;i++)state.contactAccumulator.aggregates.set(String(i),aggregates[i]);
 global.gc?.();const memory=process.memoryUsage().heapUsed;
 const at=performance.now();state.contactAccumulator.flushStep(1,{collectEvents:false});
 const elapsedMs=performance.now()-at,heapDelta=process.memoryUsage().heapUsed-memory;
 const serialized=JSON.stringify(state.pendingEvents);
 if(expected===undefined)expected=serialized;else assert.equal(serialized,expected);
 results.push({round,legacy,elapsedMs,heapDelta,events:state.pendingEvents.length});
}
const result={identicalEvents:true,results};
fs.writeFileSync('artifacts/mountain-stress/contact-event-benchmark.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
