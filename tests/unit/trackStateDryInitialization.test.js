import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
const create=()=>new TrackState({eventHistoryLimit:Infinity,sampleBaseSurface:({x})=>({baseSurfaceId:'asphalt',surfaceTemperatureC:20,sunExposure:(Math.floor(x)%3+3)%3/2,windExposure:.7})});
test('cached dry initialization matches full history exactly, including changing weather and wet fallback',()=>{
 const cached=create(),reference=create();reference.catchUpNewDryCellWeather=()=>false;
 for(let step=0;step<300;step++){
  const forcing=step<180?{type:'clear',ambientTemperatureC:step<90?18:25,sunIntensity:.8,windIntensity:.2,precipitationRateMmPerS:0}:{type:'rain',ambientTemperatureC:12,precipitationRateMmPerS:.2};
  for(const state of [cached,reference])state.advance(.05,forcing);
  for(let i=0;i<3;i++){
   const p={x:step*3+i,z:1};
   assert.deepEqual(cached.sample(p),reference.sample(p));
   assert.deepEqual(cached.getCell(p),reference.getCell(p));
  }
 }
 assert.equal(cached.getChecksum(),reference.getChecksum());
});
test('restored snapshots and older-step requests preserve dry initialization results',()=>{
 const cached=create(),reference=create();reference.catchUpNewDryCellWeather=()=>false;
 for(let i=0;i<30;i++)for(const s of [cached,reference])s.advance(.05,{type:'clear',sunIntensity:.8});
 cached.sample({x:0,z:0});reference.sample({x:0,z:0});
 const snapshot=reference.createSnapshot();cached.restoreSnapshot(snapshot);reference.restoreSnapshot(snapshot);
 for(const s of [cached,reference])s.advance(.05,{type:'clear',sunIntensity:.4});
 assert.deepEqual(cached.sample({x:3,z:0}),reference.sample({x:3,z:0}));
 assert.deepEqual(cached.getOrCreateCell({x:6,z:0},{throughStep:5}),reference.getOrCreateCell({x:6,z:0},{throughStep:5}));
});
test('many new equivalent dry cells replay forcing history once',()=>{
 const state=create();for(let i=0;i<200;i++)state.advance(.05,{type:'clear'});
 let calls=0;const original=state.getWeatherForStep.bind(state);state.getWeatherForStep=(...args)=>{calls++;return original(...args);};
 for(let i=0;i<500;i++)state.sample({x:i*3,z:0});
 assert.ok(calls<=201,`unexpected per-cell weather replay: ${calls}`);
});
