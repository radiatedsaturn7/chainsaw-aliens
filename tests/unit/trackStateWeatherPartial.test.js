import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
import {createTrackStateCell,clampTrackStateCell,clampTrackStateWeatherFields} from '../../src/racing/trackState/TrackStateCell.js';

test('weather-only normalization preserves full normalization of changed weather fields',()=>{
 let seed=519;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(let i=0;i<2000;i++) {
  const a=createTrackStateCell({base:{sunExposure:random(),surfaceTemperatureC:random()*80}});
  for(const field of ['moistureDepthMm','standingWaterDepthMm','snowDepthMm','iceDepthMm','surfaceTemperatureC'])a[field]=(random()-.2)*100;
  if(i<3)a.standingWaterDepthMm=[NaN,Infinity,-Infinity][i];
  const b={...a};clampTrackStateCell(b);clampTrackStateWeatherFields(a);assert.deepEqual(a,b);
 }
 const raw={standingWaterDepthMm:-4,rubber:5};
 assert.deepEqual(clampTrackStateWeatherFields({...raw}),clampTrackStateCell({...raw}));
});

test('rain, snow, freeze/thaw and stale-cell catchup retain exact history and bounded time steps',()=>{
 const states=[new TrackState({seed:4,maxCellsPerStep:64}),new TrackState({seed:4,maxCellsPerStep:64})];
 states[1].debugFullWeatherClamp=true;
 for(const s of states)for(let i=0;i<200;i++)s.sample({x:i*3,z:0});
 let largestDt=0;
 for(const s of states){const original=s.applyWeatherToCell;s.applyWeatherToCell=function(cell,forcing,dt,...rest){largestDt=Math.max(largestDt,dt);return original.call(this,cell,forcing,dt,...rest);};}
 for(let i=0;i<80;i++) {
  const forcing={type:i<30?'storm':i<50?'snow':'clear',precipitationRateMmPerS:i<50?.014:0,
    ambientTemperatureC:i<30?12:i<50?-10:18,sunIntensity:i>=50?.8:0,windIntensity:.5,humidity:.8};
  for(const s of states){const r=s.advance(.1,forcing);assert.ok(r.processedCellCount<=64);}
 }
 for(let i=0;i<200;i++)assert.deepEqual(states[0].sample({x:i*3,z:0}),states[1].sample({x:i*3,z:0}));
 assert.equal(largestDt,.1,'catchup does not multiply fluid/weather dt');
 assert.equal(states[0].getChecksum(),states[1].getChecksum());
 assert.deepEqual(states[0].getConservationTotals(),states[1].getConservationTotals());
});

test('catching up a distant wet cell does not multiply its next water transfer by dormant time',()=>{
 const state=new TrackState({sampleBaseSurface:({x,z})=>({baseSurfaceId:'asphalt',friction:1,
  elevationM:x===1.5&&z===.5?0:x===.5&&z===.5?1:2})});
 const source=state.getOrCreateCell({x:0,z:0},{coordinates:true});
 const receiver=state.getOrCreateCell({x:1,z:0},{coordinates:true});
 state.mutateCell({x:0,z:0},{standingWaterDepthMm:20});
 state.advance(.1,{type:'storm',precipitationRateMmPerS:.014,ambientTemperatureC:12,humidity:.95});
 state.stepIndex+=600;
 state.catchUpCellWeather(source,state.stepIndex);
 state.catchUpCellWeather(receiver,state.stepIndex);
 const before=source.standingWaterDepthMm,other=receiver.standingWaterDepthMm;
 state.applyConservativeFlow([source]);
 assert.ok(before>1 && source.standingWaterDepthMm<before,'exercise actual water transfer');
 assert.ok(source.standingWaterDepthMm>=0);
 assert.ok(before-source.standingWaterDepthMm<=before*.22+1e-6);
 assert.ok(Math.abs((before+other)-(source.standingWaterDepthMm+receiver.standingWaterDepthMm))<2e-6);
});
