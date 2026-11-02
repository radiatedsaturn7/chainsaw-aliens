// CPU-only reproduction of buildup history + staggered existing road cells.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { TrackState } from '../../src/racing/trackState/TrackState.js';
function run(mode) {
  const state = new TrackState({sampleBaseSurface: () => ({baseSurfaceId:'asphalt', friction:1})});
  state.debugDisableWeatherReplayCache = mode !== 'blocks';
  if (mode === 'linear') state.getWeatherForStep = function(step) {
    let result = null;
    for (const [at, forcing] of this.weatherTimeline) { if (at > step) break; result = forcing; }
    return result;
  };
  const cells = Array.from({length:256}, (_, x) => state.getOrCreateCell({x,z:0},{coordinates:true}));
  for (let tick=1; tick<=600; tick++) state.recordWeatherTransition(tick, {
    type:'storm', precipitationRateMmPerS:.02*Math.min(1,tick/300),
    ambientTemperatureC:13,sunIntensity:0,windIntensity:.9,humidity:.9
  });
  cells.forEach((cell, i) => state.catchUpCellWeather(cell, i%32));
  state.stepIndex=600;
  const start=performance.now();
  for (const cell of cells) state.catchUpCellWeather(cell);
  return {mode,ms:performance.now()-start,checksum:state.getChecksum(),
    reusedSteps:state.performanceCounters.weatherReplayReusedSteps};
}
for(let round=0;round<3;round++) {
  const results=(round%2?['blocks','indexed','linear']:['linear','indexed','blocks']).map(run);
  for(const result of results){assert.equal(result.checksum,results[0].checksum);console.log(JSON.stringify({round,...result}));}
}
