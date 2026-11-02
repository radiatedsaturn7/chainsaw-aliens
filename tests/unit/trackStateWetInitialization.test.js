import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';

function pair(base={}) {
 const options={eventHistoryLimit:Infinity,sampleBaseSurface:p=>({baseSurfaceId:p.x<0?'dirt':'asphalt',sunExposure:p.z<0?.4:1,...base})};
 const cached=new TrackState(options),reference=new TrackState(options);
 reference.catchUpNewWetCellWeather=()=>false;
 // This is the uncached recurrence oracle, including the separate block cache.
 reference.debugDisableWeatherReplayCache=true;
 return [cached,reference];
}
const storm={type:'storm',precipitationRateMmPerS:.014111,ambientTemperatureC:13,windIntensity:.9,humidity:.96,sunIntensity:.12};
function compare(states,points){
 for(const point of points){
  const a=states[0].getOrCreateCell(point),b=states[1].getOrCreateCell(point);
  assert.deepEqual(a,b);
  assert.deepEqual(states[0].totals,states[1].totals);
  assert.equal(states[0].cellSampleRevisions.get(a),states[1].cellSampleRevisions.get(b));
  assert.equal(states[0].visualRevision,states[1].visualRevision);
  assert.deepEqual(states[0].visualCellRevisions,states[1].visualCellRevisions);
 }
 assert.deepEqual(states[0].createSnapshot(),states[1].createSnapshot());
}
for(const scenario of ['storm','freeze-thaw','changing-weather']) test(`new wet-cell cache exactly preserves ${scenario} recurrence, totals and snapshots`,()=>{
 const states=pair({standingWaterDepthMm:scenario==='freeze-thaw'?1:0});
 for(let i=0;i<1200;i++){
  let forcing=storm;
  if(scenario==='freeze-thaw')forcing={...storm,type:i<600?'snow':'rain',ambientTemperatureC:i<600?-8:22};
  if(scenario==='changing-weather')forcing={...storm,precipitationRateMmPerS:i%200<100?.014111:0,ambientTemperatureC:8+i/100};
  for(const state of states)state.advance(.1,forcing);
 }
 compare(states,[{x:1,z:1},{x:2,z:1},{x:-2,z:1},{x:-3,z:-2},{x:3,z:1}]);
 for(const state of states)state.advance(.1,storm);
 compare(states,[{x:4,z:1},{x:5,z:1}]);
 // Existing contaminated cells do not use pristine-cell weather reuse.
 for(const state of states)state.mutateCell({x:1,z:1},{oil:.5,standingWaterDepthMm:5});
 for(let i=0;i<10;i++)for(const state of states)state.advance(.1,storm);
 compare(states,[{x:1,z:1},{x:6,z:1}]);
});

test('wet initialization replays weather once per profile and preserves older requests',t=>{
 const states=pair();
 for(let i=0;i<1200;i++)for(const state of states)state.advance(.1,storm);
 const counts=[0,0];
 states.forEach((state,index)=>{const apply=state.applyWeatherToCell.bind(state);state.applyWeatherToCell=(...args)=>{counts[index]++;return apply(...args);};});
 compare(states,Array.from({length:20},(_,i)=>({x:i+1,z:1})));
 assert.equal(counts[0],1200);
 assert.equal(counts[1],24000);
 t.diagnostic(`Weather recurrence calls: ${counts[0]} cached / ${counts[1]} reference`);
 assert.deepEqual(states[0].getOrCreateCell({x:100,z:1},{throughStep:600}),states[1].getOrCreateCell({x:100,z:1},{throughStep:600}));
 assert.deepEqual(states[0].totals,states[1].totals);
});

test('wet initialization cache resets after snapshot restore and history rebasing',()=>{
 const states=pair();
 for(let i=0;i<100;i++)for(const state of states)state.advance(.1,storm);
 compare(states,[{x:1,z:1}]);
 for(const state of states)state.restoreSnapshot(state.createSnapshot());
 compare(states,[{x:2,z:1}]);
 for(const state of states)state.historyBaseStepIndex=50;
 compare(states,[{x:3,z:1},{x:4,z:1}]);
});
